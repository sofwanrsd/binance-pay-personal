'use strict';

const config = require('./config');
const store = require('./orderStore');

/**
 * Logika inti: memutuskan apakah sebuah transaksi Binance Pay cocok dengan
 * sebuah invoice. SEMUA aturan keamanan ada di sini.
 *
 * Sumber kebenaran = data transaksi dari API history akun sendiri, BUKAN
 * klaim/ screenshot buyer.
 */

/** Normalisasi amount string Binance ("-0.0001") jadi number. */
function toAmount(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : NaN;
}

/** Transaksi dianggap "masuk" (income) kalau nominalnya positif. */
function isIncome(tx) {
  return toAmount(tx.amount) > 0;
}

/**
 * Cek apakah satu transaksi memenuhi syarat untuk sebuah invoice.
 * @returns {{ ok: boolean, reason?: string }}
 */
function verifyMatch(invoice, tx) {
  if (!invoice || !tx) return { ok: false, reason: 'data kurang' };

  const txId = String(tx.transactionId || '');
  if (!txId) return { ok: false, reason: 'transaksi tanpa id' };

  // 1) Anti-replay: transaksi sudah pernah dipakai invoice lain
  if (store.isTransactionUsed(txId)) {
    return { ok: false, reason: 'transaksi sudah pernah dipakai' };
  }

  // 2) Harus transaksi MASUK (income), bukan kamu yang bayar
  if (!isIncome(tx)) {
    return { ok: false, reason: 'bukan transaksi masuk' };
  }

  // 3) Mata uang harus sama
  if (String(tx.currency || '').toUpperCase() !== invoice.currency) {
    return { ok: false, reason: 'mata uang tidak cocok' };
  }

  // 4) Nominal cocok dalam toleransi
  const txAmount = Math.abs(toAmount(tx.amount));
  const expected = invoice.expectedAmount;
  const tolerance = (expected * config.amountTolerancePercent) / 100;
  const diff = Math.abs(txAmount - expected);
  if (diff > tolerance) {
    if (txAmount < expected - tolerance) {
      return { ok: false, reason: `kurang bayar (${txAmount} < ${expected})` };
    }
    return { ok: false, reason: `nominal tidak cocok (${txAmount} vs ${expected})` };
  }

  // 5) Waktu transaksi dalam window invoice (+ grace period)
  const txTime = Number(tx.transactionTime || 0);
  const graceMs = config.matchGraceMinutes * 60 * 1000;
  // Beri sedikit kelonggaran sebelum createdAt untuk selisih jam server
  const startOk = txTime >= invoice.createdAt - 5 * 60 * 1000;
  const endOk = txTime <= invoice.expiresAt + graceMs;
  if (!startOk || !endOk) {
    return { ok: false, reason: 'di luar window waktu invoice' };
  }

  return { ok: true };
}

/**
 * Tandai invoice sebagai PAID berdasarkan transaksi yang sudah terverifikasi.
 * Melakukan dedupe (markTransactionUsed) secara atomik-ish (single thread).
 * @returns {object|null} invoice terupdate, atau null kalau gagal/keduluan.
 */
function settleInvoice(invoice, tx) {
  const txId = String(tx.transactionId);

  // Cek ulang tepat sebelum commit (hindari race di event loop)
  if (store.isTransactionUsed(txId)) return null;
  const current = store.get(invoice.id);
  if (!current || current.status !== 'PENDING') return null;

  store.markTransactionUsed(txId);
  return store.update(invoice.id, {
    status: 'PAID',
    transactionId: txId,
    paidAmount: Math.abs(toAmount(tx.amount)),
    paidAt: Date.now(),
    transactionTime: Number(tx.transactionTime || 0),
  });
}

/**
 * Cari invoice PENDING yang cocok untuk sebuah transaksi (dipakai poller).
 * @returns {object|null} invoice yang cocok.
 */
function findMatchingInvoice(tx) {
  const candidates = store.pending();
  // Urutkan dari yang terbaru biar deterministik kalau ada beberapa cocok
  candidates.sort((a, b) => b.createdAt - a.createdAt);
  for (const inv of candidates) {
    if (verifyMatch(inv, tx).ok) return inv;
  }
  return null;
}

/**
 * Verifikasi deposit on-chain cocok dengan invoice.
 * Struktur deposit item beda dari Pay transaction:
 *  - id          -> dipakai sebagai transactionId (dedupe)
 *  - amount      -> string, selalu positif
 *  - coin        -> "USDT" dll
 *  - network     -> "TRX"/"BSC" dll (perlu dinormalisasi ke TRC20/BEP20)
 *  - insertTime  -> epoch ms
 *  - status      -> 1 = success (sudah difilter di client)
 *
 * @param {object} invoice
 * @param {object} deposit - item dari getDepositHistory()
 * @param {string} normalizedNetwork - hasil normalizeNetwork(deposit.network)
 * @returns {{ ok: boolean, reason?: string }}
 */
function verifyDepositMatch(invoice, deposit, normalizedNetwork) {
  if (!invoice || !deposit) return { ok: false, reason: 'data kurang' };

  const txId = String(deposit.id || '');
  if (!txId) return { ok: false, reason: 'deposit tanpa id' };

  // 1) Anti-replay
  if (store.isTransactionUsed(txId)) {
    return { ok: false, reason: 'deposit sudah pernah dipakai' };
  }

  // 2) Coin harus sama dengan currency invoice
  if (String(deposit.coin || '').toUpperCase() !== invoice.currency) {
    return { ok: false, reason: 'coin tidak cocok' };
  }

  // 3) Network harus masuk daftar acceptedNetworks invoice (kalau ada)
  if (invoice.network && invoice.network !== normalizedNetwork) {
    return { ok: false, reason: 'network tidak cocok dengan invoice' };
  }

  // 4) Nominal cocok dalam toleransi
  const depositAmount = Math.abs(toAmount(deposit.amount));
  const expected = invoice.expectedAmount;
  const tolerance = (expected * config.amountTolerancePercent) / 100;
  const diff = Math.abs(depositAmount - expected);
  if (diff > tolerance) {
    if (depositAmount < expected - tolerance) {
      return { ok: false, reason: `kurang bayar (${depositAmount} < ${expected})` };
    }
    return { ok: false, reason: `nominal tidak cocok (${depositAmount} vs ${expected})` };
  }

  // 5) Waktu deposit dalam window invoice + grace
  const depositTime = Number(deposit.insertTime || 0);
  const graceMs = config.matchGraceMinutes * 60 * 1000;
  const startOk = depositTime >= invoice.createdAt - 5 * 60 * 1000;
  const endOk = depositTime <= invoice.expiresAt + graceMs;
  if (!startOk || !endOk) {
    return { ok: false, reason: 'di luar window waktu invoice' };
  }

  return { ok: true };
}

/**
 * Settle invoice dari deposit on-chain yang sudah terverifikasi.
 * @returns {object|null}
 */
function settleInvoiceFromDeposit(invoice, deposit, normalizedNetwork) {
  const txId = String(deposit.id);

  if (store.isTransactionUsed(txId)) return null;
  const current = store.get(invoice.id);
  if (!current || current.status !== 'PENDING') return null;

  store.markTransactionUsed(txId);
  return store.update(invoice.id, {
    status: 'PAID',
    transactionId: txId,
    txHash: deposit.txId || '',          // hash on-chain
    paidAmount: Math.abs(toAmount(deposit.amount)),
    paidAt: Date.now(),
    transactionTime: Number(deposit.insertTime || 0),
    payMethod: 'ONCHAIN',
    network: normalizedNetwork,
  });
}

/**
 * Cari invoice PENDING yang cocok untuk sebuah deposit (dipakai poller).
 * @returns {object|null}
 */
function findMatchingInvoiceForDeposit(deposit, normalizedNetwork) {
  const candidates = store.pending();
  candidates.sort((a, b) => b.createdAt - a.createdAt);
  for (const inv of candidates) {
    if (verifyDepositMatch(inv, deposit, normalizedNetwork).ok) return inv;
  }
  return null;
}

module.exports = {
  verifyMatch,
  settleInvoice,
  findMatchingInvoice,
  verifyDepositMatch,
  settleInvoiceFromDeposit,
  findMatchingInvoiceForDeposit,
  isIncome,
  toAmount,
};
