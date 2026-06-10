'use strict';

const express = require('express');
const config = require('./config');
const client = require('./binanceSpotClient');
const matcher = require('./paymentMatcher');

const router = express.Router();

// Cache deposit address (stabil per akun+coin+network, tidak berubah).
// Key: apiKey:coin:network -> { address, tag }. TTL 6 jam.
const addrCache = new Map();
const ADDR_TTL = 6 * 60 * 60 * 1000;

async function getCachedAddress(coin, network, cfg) {
  const key = `${cfg.apiKey}:${coin}:${network}`;
  const hit = addrCache.get(key);
  if (hit && Date.now() - hit.at < ADDR_TTL) return hit.data;
  const data = await client.getDepositAddress({ coin, network, cfg });
  addrCache.set(key, { data, at: Date.now() });
  return data;
}

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

function round8(n) {
  return Math.round(n * 1e8) / 1e8;
}

/**
 * Saran nominal unik: tambah desimal acak kecil supaya tiap tagihan
 * punya nominal khas dan mudah dicocokkan. Sistem pemanggil yang menyimpan
 * nominal ini, server tidak menyimpan apa pun.
 */
function suggestUniqueAmount(base, cfg) {
  if (!cfg.uniqueAmount) return round8(base);
  const extra = Math.round(Math.random() * cfg.uniqueAmountMax * 10000) / 10000;
  return round8(base + extra);
}

async function buildPaymentOptions(amount, currency, network, cfg) {
  const options = [];
  const net = network ? String(network).toUpperCase() : null;

  if (!net || net === 'PAY') {
    if (cfg.payId) {
      options.push({
        method: 'BINANCE_PAY',
        description: 'Transfer via Binance Pay (butuh akun Binance)',
        payId: cfg.payId,
        amountToPay: amount,
        currency,
        instruction:
          'Buka Binance app -> Pay -> kirim TEPAT ' + amount + ' ' + currency +
          ' ke Pay ID ' + cfg.payId,
      });
    }
  }

  if (cfg.onChainEnabled && (!net || net !== 'PAY')) {
    const networks = net ? [net] : cfg.acceptedNetworks;
    // ambil address paralel dari Binance (selalu address terkini + memo/tag)
    const fetches = networks.map((n) =>
      getCachedAddress(currency, n, cfg)
        .then((a) => ({ n, a }))
        .catch((e) => ({ n, err: e.message }))
    );
    const results = await Promise.all(fetches);
    for (const r of results) {
      if (r.err || !r.a || !r.a.address) continue;
      const opt = {
        method: 'ONCHAIN',
        network: r.n,
        description: 'Transfer on-chain via ' + r.n,
        depositAddress: r.a.address,
        amountToPay: amount,
        currency,
        instruction:
          'Kirim TEPAT ' + amount + ' ' + currency + ' via jaringan ' + r.n +
          ' ke address: ' + r.a.address,
      };
      if (r.a.tag) {
        opt.memo = r.a.tag;
        opt.instruction += ' (WAJIB sertakan MEMO/Tag: ' + r.a.tag + ')';
      }
      options.push(opt);
    }
  }

  return options;
}

// ----------------------------------------------------------------
// POST /api/payment-options
// Bangun instruksi pembayaran + saran nominal unik (STATELESS).
// Sistem pemanggil yang menyimpan nominal ini untuk dicek nanti.
// body: { amount, currency?, network? }
// ----------------------------------------------------------------
router.post('/payment-options', async (req, res) => {
  const cfg = config.fromRequest(req);
  const { amount, currency, network } = req.body || {};

  const base = Number(amount);
  if (!base || base <= 0) {
    return res.status(400).json({ error: 'amount wajib diisi dan harus > 0' });
  }

  const cur = String(currency || cfg.acceptedCurrencies[0] || 'USDT').toUpperCase();
  if (!cfg.acceptedCurrencies.includes(cur)) {
    return res.status(400).json({ error: 'currency ' + cur + ' tidak didukung', accepted: cfg.acceptedCurrencies });
  }

  const net = network ? String(network).toUpperCase() : null;
  const validNetworks = ['PAY', ...cfg.acceptedNetworks];
  if (net && !validNetworks.includes(net)) {
    return res.status(400).json({ error: 'network ' + net + ' tidak didukung', accepted: validNetworks });
  }

  const amountToPay = suggestUniqueAmount(base, cfg);
  const paymentOptions = await buildPaymentOptions(amountToPay, cur, net, cfg);
  res.json({
    amountToPay,
    currency: cur,
    network: net,
    tolerancePercent: cfg.amountTolerancePercent,
    paymentOptions,
  });
});

// ----------------------------------------------------------------
// POST /api/check-payment
// Cek apakah ADA pembayaran masuk yang cocok dengan kriteria (STATELESS).
// Tidak menyimpan apa pun. Anti-replay tanggung jawab pemanggil.
// body: { amount, currency?, network?, sinceMinutes?, tolerancePercent? }
// ----------------------------------------------------------------
router.post('/check-payment', async (req, res) => {
  const cfg = config.fromRequest(req);
  if (!cfg.apiKey || !cfg.apiSecret) {
    return res.status(400).json({ error: 'API Key dan Secret belum diisi' });
  }

  const { amount, currency, network, sinceMinutes, tolerancePercent } = req.body || {};
  const amt = Number(amount);
  if (!amt || amt <= 0) {
    return res.status(400).json({ error: 'amount wajib diisi dan harus > 0' });
  }

  const cur = String(currency || cfg.acceptedCurrencies[0] || 'USDT').toUpperCase();
  const net = network ? String(network).toUpperCase() : null;
  const windowMin = Math.min(Number(sinceMinutes) || 60, 7 * 24 * 60); // max 7 hari
  const startTime = Date.now() - windowMin * 60 * 1000;
  const endTime = Date.now();

  const criteria = {
    amount: amt,
    currency: cur,
    network: net && net !== 'PAY' ? net : null,
    tolerancePercent: Number(tolerancePercent) || cfg.amountTolerancePercent,
    startTime,
    endTime,
  };

  // ambil Pay + deposit paralel; salah satu gagal tidak menggagalkan semua
  const [payResult, depositResult] = await Promise.allSettled([
    (!net || net === 'PAY')
      ? client.getPayTransactions({ startTime, endTime, limit: 100, cfg })
      : Promise.resolve([]),
    (cfg.onChainEnabled && net !== 'PAY')
      ? client.getDepositHistory({ startTime, endTime, limit: 100, cfg })
      : Promise.resolve([]),
  ]);

  let match = null;
  if (payResult.status === 'fulfilled') {
    match = matcher.findPayMatch(payResult.value, criteria);
  }
  if (!match && depositResult.status === 'fulfilled') {
    match = matcher.findDepositMatch(depositResult.value, criteria, client.normalizeNetwork);
  }

  const errors = {};
  if (payResult.status === 'rejected') errors.pay = payResult.reason?.message;
  if (depositResult.status === 'rejected') errors.deposit = depositResult.reason?.message;

  res.json({
    paid: Boolean(match),
    match: match || null,
    criteria: { amount: amt, currency: cur, network: net, windowMinutes: windowMin },
    ...(Object.keys(errors).length ? { errors } : {}),
  });
});

// ----------------------------------------------------------------
// POST /api/debug/pay-history — test koneksi + cek riwayat Pay
// ----------------------------------------------------------------
router.post('/debug/pay-history', async (req, res) => {
  const cfg = config.fromRequest(req);
  if (!cfg.apiKey || !cfg.apiSecret) {
    return res.status(400).json({ error: 'API Key dan Secret belum diisi' });
  }
  try {
    const { hours = 24, full = false, days } = req.body || {};

    if (full) {
      const lookbackDays = Math.min(Number(days) || 90, 365);
      const startTime = Date.now() - lookbackDays * 24 * 60 * 60 * 1000;
      const result = await client.getAllPayTransactions({ startTime, endTime: Date.now(), cfg });
      return res.json({
        ok: true,
        full: true,
        count: result.transactions.length,
        daysBack: lookbackDays,
        apiCalls: result.calls,
        truncated: result.truncated,
        transactions: result.transactions,
      });
    }

    const startTime = Date.now() - Math.min(Number(hours) || 24, 168) * 60 * 60 * 1000;
    const txs = await client.getPayTransactions({ startTime, endTime: Date.now(), limit: 100, cfg });
    res.json({
      ok: true,
      count: txs.length,
      hoursBack: Math.min(Number(hours) || 24, 168),
      transactions: txs,
    });
  } catch (err) {
    res.status(502).json({ ok: false, error: err.message, code: err.code });
  }
});

// ----------------------------------------------------------------
// POST /api/debug/deposit-history
// ----------------------------------------------------------------
router.post('/debug/deposit-history', async (req, res) => {
  const cfg = config.fromRequest(req);
  if (!cfg.apiKey || !cfg.apiSecret) {
    return res.status(400).json({ error: 'API Key dan Secret belum diisi' });
  }
  try {
    const { hours = 24, coin } = req.body || {};
    const startTime = Date.now() - Math.min(Number(hours) || 24, 168) * 60 * 60 * 1000;
    const deposits = await client.getDepositHistory({ startTime, endTime: Date.now(), coin: coin || undefined, limit: 100, cfg });
    res.json({
      ok: true,
      count: deposits.length,
      hoursBack: Math.min(Number(hours) || 24, 168),
      deposits,
    });
  } catch (err) {
    res.status(502).json({ ok: false, error: err.message, code: err.code });
  }
});

// ----------------------------------------------------------------
// POST /api/debug/withdraw-history
// ----------------------------------------------------------------
router.post('/debug/withdraw-history', async (req, res) => {
  const cfg = config.fromRequest(req);
  if (!cfg.apiKey || !cfg.apiSecret) {
    return res.status(400).json({ error: 'API Key dan Secret belum diisi' });
  }
  try {
    const { hours = 24, coin } = req.body || {};
    const startTime = Date.now() - Math.min(Number(hours) || 24, 168) * 60 * 60 * 1000;
    const json = await client.signedGet('/sapi/v1/capital/withdraw/history', {
      startTime, endTime: Date.now(), coin: coin || undefined, limit: 100,
    }, cfg);
    const list = Array.isArray(json) ? json : [];
    res.json({ ok: true, count: list.length, hoursBack: Math.min(Number(hours) || 24, 168), withdrawals: list });
  } catch (err) {
    res.status(502).json({ ok: false, error: err.message, code: err.code });
  }
});

// ----------------------------------------------------------------
// POST /api/debug/balances
// ----------------------------------------------------------------
router.post('/debug/balances', async (req, res) => {
  const cfg = config.fromRequest(req);
  if (!cfg.apiKey || !cfg.apiSecret) {
    return res.status(400).json({ error: 'API Key dan Secret belum diisi' });
  }
  try {
    const json = await client.signedGet('/api/v3/account', {}, cfg);
    const balances = (json.balances || [])
      .filter((b) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0)
      .map((b) => ({ asset: b.asset, free: b.free, locked: b.locked }));
    res.json({ ok: true, count: balances.length, accountType: json.accountType, balances });
  } catch (err) {
    res.status(502).json({ ok: false, error: err.message, code: err.code });
  }
});

// ----------------------------------------------------------------
// POST /api/debug/overview — semua isi akun sekaligus
// ----------------------------------------------------------------
router.post('/debug/overview', async (req, res) => {
  const cfg = config.fromRequest(req);
  if (!cfg.apiKey || !cfg.apiSecret) {
    return res.status(400).json({ error: 'API Key dan Secret belum diisi' });
  }

  const { days = 30 } = req.body || {};
  const lookbackDays = Math.min(Number(days) || 30, 90);
  const startTime = Date.now() - lookbackDays * 24 * 60 * 60 * 1000;
  const endTime = Date.now();

  const safe = (p) => p.then((v) => ({ ok: true, v })).catch((e) => ({ ok: false, e: e.message }));

  const [bal, pay, dep, wd, conv, div] = await Promise.all([
    safe(client.signedGet('/api/v3/account', {}, cfg)),
    safe(client.getPayTransactions({ startTime, endTime, limit: 100, cfg })),
    safe(client.getDepositHistory({ startTime, endTime, limit: 100, cfg })),
    safe(client.signedGet('/sapi/v1/capital/withdraw/history', { startTime, endTime, limit: 100 }, cfg)),
    safe(client.signedGet('/sapi/v1/convert/tradeFlow', { startTime, endTime, limit: 100 }, cfg)),
    safe(client.signedGet('/sapi/v1/asset/assetDividend', { startTime, endTime, limit: 100 }, cfg)),
  ]);

  const balances = bal.ok
    ? (bal.v.balances || []).filter((b) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0)
        .map((b) => ({ asset: b.asset, free: b.free, locked: b.locked }))
    : [];

  const timeline = [];
  if (pay.ok) for (const t of pay.v) {
    timeline.push({ type: 'PAY', time: Number(t.transactionTime), amount: t.amount, asset: t.currency, ref: String(t.transactionId) });
  }
  if (dep.ok) for (const d of dep.v) {
    timeline.push({ type: 'DEPOSIT', time: Number(d.insertTime), amount: d.amount, asset: d.coin, network: client.normalizeNetwork(d.network || ''), ref: String(d.id) });
  }
  if (wd.ok && Array.isArray(wd.v)) for (const w of wd.v) {
    timeline.push({ type: 'WITHDRAW', time: new Date(w.applyTime).getTime(), amount: '-' + w.amount, asset: w.coin, network: w.network, ref: String(w.id) });
  }
  if (conv.ok && Array.isArray(conv.v.list)) for (const c of conv.v.list) {
    timeline.push({ type: 'CONVERT', time: Number(c.createTime), amount: c.fromAmount + ' ' + c.fromAsset + ' -> ' + c.toAmount, asset: c.toAsset, ref: String(c.orderId) });
  }
  if (div.ok && Array.isArray(div.v.rows)) for (const d of div.v.rows) {
    timeline.push({ type: 'DIVIDEN', time: Number(d.divTime), amount: d.amount, asset: d.asset, ref: String(d.tranId) });
  }
  timeline.sort((a, b) => b.time - a.time);

  res.json({
    ok: true,
    daysBack: lookbackDays,
    accountType: bal.ok ? bal.v.accountType : null,
    balances,
    timeline,
    sources: {
      balance: bal.ok, pay: pay.ok, deposit: dep.ok,
      withdraw: wd.ok, convert: conv.ok, dividen: div.ok,
    },
    errors: {
      balance: bal.ok ? null : bal.e, pay: pay.ok ? null : pay.e,
      deposit: dep.ok ? null : dep.e, withdraw: wd.ok ? null : wd.e,
      convert: conv.ok ? null : conv.e, dividen: div.ok ? null : div.e,
    },
  });
});

module.exports = router;
