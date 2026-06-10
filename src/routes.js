'use strict';

const express = require('express');
const crypto = require('crypto');
const config = require('./config');
const client = require('./binanceSpotClient');
const store = require('./orderStore');
const matcher = require('./paymentMatcher');
const { fulfillOrder } = require('./fulfillment');

const router = express.Router();

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

function round8(n) {
  return Math.round(n * 1e8) / 1e8;
}

function computeExpectedAmount(base, cfg) {
  if (!cfg.uniqueAmount) return round8(base);
  const extra = Math.round(Math.random() * cfg.uniqueAmountMax * 10000) / 10000;
  return round8(base + extra);
}

function genInvoiceId() {
  const ts = Date.now().toString(36);
  const rnd = crypto.randomBytes(4).toString('hex');
  return 'INV' + ts + rnd.toUpperCase();
}

function buildPaymentOptions(invoice, cfg) {
  const options = [];
  const net = invoice.network;

  if (!net || net === 'PAY') {
    if (cfg.payId) {
      options.push({
        method: 'BINANCE_PAY',
        description: 'Transfer via Binance Pay (butuh akun Binance)',
        payId: cfg.payId,
        amountToPay: invoice.expectedAmount,
        currency: invoice.currency,
        instruction:
          'Buka Binance app -> Pay -> kirim TEPAT ' +
          invoice.expectedAmount + ' ' + invoice.currency +
          ' ke Pay ID ' + cfg.payId,
      });
    }
  }

  if (cfg.onChainEnabled && (!net || net !== 'PAY')) {
    const networks = net ? [net] : cfg.acceptedNetworks;
    for (const n of networks) {
      const address = cfg.depositAddresses[n];
      if (!address) continue;
      options.push({
        method: 'ONCHAIN',
        network: n,
        description: 'Transfer on-chain via ' + n,
        depositAddress: address,
        amountToPay: invoice.expectedAmount,
        currency: invoice.currency,
        instruction:
          'Kirim TEPAT ' + invoice.expectedAmount + ' ' +
          invoice.currency + ' via jaringan ' + n +
          ' ke address: ' + address,
      });
    }
  }

  return options;
}

// ----------------------------------------------------------------
// POST /api/invoices — buat invoice baru
// ----------------------------------------------------------------
router.post('/invoices', (req, res) => {
  const cfg = config.fromRequest(req);
  const { amount, currency, network, productId, buyer } = req.body || {};

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

  const now = Date.now();
  const expectedAmount = computeExpectedAmount(base, cfg);
  const invoice = store.save({
    id: genInvoiceId(),
    baseAmount: round8(base),
    expectedAmount,
    currency: cur,
    network: net,
    productId: productId || null,
    buyer: buyer || null,
    status: 'PENDING',
    createdAt: now,
    expiresAt: now + cfg.invoiceExpiryMinutes * 60 * 1000,
    claimAttempts: 0,
  });

  res.status(201).json({
    invoiceId: invoice.id,
    status: invoice.status,
    currency: invoice.currency,
    amountToPay: invoice.expectedAmount,
    expiresAt: invoice.expiresAt,
    paymentOptions: buildPaymentOptions(invoice, cfg),
  });
});

// ----------------------------------------------------------------
// GET /api/invoices — daftar semua invoice
// ----------------------------------------------------------------
router.get('/invoices', (req, res) => {
  res.json(store.all());
});

// ----------------------------------------------------------------
// GET /api/invoices/:id — cek status invoice
// ----------------------------------------------------------------
router.get('/invoices/:id', (req, res) => {
  const inv = store.get(req.params.id);
  if (!inv) return res.status(404).json({ error: 'invoice tidak ditemukan' });
  res.json(inv);
});

// ----------------------------------------------------------------
// POST /api/invoices/:id/check — trigger cek on-demand ke Binance
// Dipakai di Vercel (tidak ada poller background)
// ----------------------------------------------------------------
router.post('/invoices/:id/check', async (req, res) => {
  const cfg = config.fromRequest(req);
  const inv = store.get(req.params.id);
  if (!inv) return res.status(404).json({ error: 'invoice tidak ditemukan' });

  if (inv.status !== 'PENDING') {
    return res.json({ status: inv.status, invoice: inv });
  }

  if (inv.expiresAt <= Date.now()) {
    const expired = store.update(inv.id, { status: 'EXPIRED' });
    return res.json({ status: 'EXPIRED', invoice: expired });
  }

  const lookbackMs = (cfg.invoiceExpiryMinutes + cfg.matchGraceMinutes + 60) * 60 * 1000;
  const startTime = Date.now() - lookbackMs;
  const endTime = Date.now();

  const [payResult, depositResult] = await Promise.allSettled([
    client.getPayTransactions({ startTime, endTime, limit: 100, cfg }),
    cfg.onChainEnabled
      ? client.getDepositHistory({ startTime, endTime, limit: 100, cfg })
      : Promise.resolve([]),
  ]);

  // Cek Pay
  if (payResult.status === 'fulfilled') {
    for (const tx of payResult.value) {
      if (!matcher.isIncome(tx)) continue;
      if (store.isTransactionUsed(String(tx.transactionId))) continue;
      if (!matcher.verifyMatch(inv, tx).ok) continue;
      const settled = matcher.settleInvoice(inv, tx);
      if (settled) {
        fulfillOrder(settled).catch((e) => console.error('[fulfillment]', e.message));
        return res.json({ status: 'PAID', invoice: settled });
      }
    }
  }

  // Cek on-chain deposit
  if (depositResult.status === 'fulfilled') {
    for (const deposit of depositResult.value) {
      if (!deposit.id) continue;
      if (store.isTransactionUsed(String(deposit.id))) continue;
      const network = client.normalizeNetwork(deposit.network || '');
      if (!cfg.acceptedNetworks.includes(network)) continue;
      if (!matcher.verifyDepositMatch(inv, deposit, network).ok) continue;
      const settled = matcher.settleInvoiceFromDeposit(inv, deposit, network);
      if (settled) {
        fulfillOrder(settled).catch((e) => console.error('[fulfillment]', e.message));
        return res.json({ status: 'PAID', invoice: settled });
      }
    }
  }

  const current = store.get(inv.id);
  res.json({ status: current.status, invoice: current });
});

// ----------------------------------------------------------------
// POST /api/invoices/:id/claim — verifikasi cepat via TxId
// ----------------------------------------------------------------
router.post('/invoices/:id/claim', async (req, res) => {
  const cfg = config.fromRequest(req);
  const inv = store.get(req.params.id);
  if (!inv) return res.status(404).json({ error: 'invoice tidak ditemukan' });

  if (inv.status === 'PAID') return res.json({ status: 'PAID', invoice: inv });
  if (inv.status !== 'PENDING') {
    return res.status(409).json({ error: 'invoice berstatus ' + inv.status });
  }
  if (inv.expiresAt <= Date.now()) {
    store.update(inv.id, { status: 'EXPIRED' });
    return res.status(409).json({ error: 'invoice sudah kedaluwarsa' });
  }
  if ((inv.claimAttempts || 0) >= cfg.maxClaimAttempts) {
    return res.status(429).json({ error: 'terlalu banyak percobaan klaim' });
  }

  store.update(inv.id, { claimAttempts: (inv.claimAttempts || 0) + 1 });

  const txId = String((req.body && req.body.transactionId) || '').trim();
  if (!txId) return res.status(400).json({ error: 'transactionId wajib diisi' });
  if (store.isTransactionUsed(txId)) {
    return res.status(409).json({ error: 'transactionId sudah pernah dipakai' });
  }

  try {
    const lookbackMs = (cfg.invoiceExpiryMinutes + cfg.matchGraceMinutes + 60) * 60 * 1000;
    const txs = await client.getPayTransactions({
      startTime: Date.now() - lookbackMs,
      endTime: Date.now(),
      limit: 100,
      cfg,
    });

    const tx = txs.find((t) => String(t.transactionId) === txId);
    if (!tx) {
      return res.status(404).json({ error: 'transaksi tidak ditemukan di akun. Pastikan TxId benar.' });
    }

    const check = matcher.verifyMatch(inv, tx);
    if (!check.ok) {
      return res.status(422).json({ error: 'verifikasi gagal: ' + check.reason });
    }

    const settled = matcher.settleInvoice(inv, tx);
    if (!settled) {
      return res.status(409).json({ error: 'gagal settle (mungkin sudah diproses)' });
    }

    fulfillOrder(settled).catch((e) => console.error('[fulfillment async]', e.message));
    return res.json({ status: 'PAID', invoice: settled });
  } catch (err) {
    console.error('[claim]', err.message);
    return res.status(502).json({ error: 'gagal cek ke Binance: ' + err.message });
  }
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
    const { hours = 24 } = req.body || {};
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
// POST /api/debug/deposit-history — test koneksi + cek riwayat deposit on-chain
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
// POST /api/debug/withdraw-history — cek riwayat withdraw (keluar)
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
// POST /api/debug/balances — cek saldo spot (yang > 0)
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

module.exports = router;
