'use strict';

/**
 * Logika matching pembayaran — PURE & STATELESS.
 *
 * Tidak menyimpan apa pun. Menerima kriteria (amount, currency, network,
 * window waktu) lalu mencari transaksi/deposit yang cocok dari data history
 * akun. Anti-replay (cegah satu transaksi dipakai 2x) adalah tanggung jawab
 * sistem PEMANGGIL (web/bot), bukan server ini.
 *
 * Sumber kebenaran = data dari API history akun sendiri, bukan klaim buyer.
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

/** Cek nominal cocok dalam toleransi persen. */
function amountMatches(actual, expected, tolerancePercent) {
  const tolerance = (expected * tolerancePercent) / 100;
  return Math.abs(actual - expected) <= tolerance;
}

/**
 * Cek apakah satu transaksi Binance Pay cocok dengan kriteria.
 * @param {object} tx - item dari getPayTransactions()
 * @param {object} c  - kriteria
 * @param {number} c.amount         nominal yang diharapkan
 * @param {string} c.currency       mata uang (USDT, dll)
 * @param {number} c.tolerancePercent toleransi selisih (%)
 * @param {number} [c.startTime]    epoch ms — transaksi tidak boleh sebelum ini
 * @param {number} [c.endTime]      epoch ms — transaksi tidak boleh sesudah ini
 * @returns {{ ok: boolean, reason?: string }}
 */
function matchPay(tx, c) {
  if (!tx) return { ok: false, reason: 'data kurang' };
  if (!String(tx.transactionId || '')) return { ok: false, reason: 'transaksi tanpa id' };
  if (!isIncome(tx)) return { ok: false, reason: 'bukan transaksi masuk' };

  if (String(tx.currency || '').toUpperCase() !== String(c.currency).toUpperCase()) {
    return { ok: false, reason: 'mata uang tidak cocok' };
  }

  const amt = Math.abs(toAmount(tx.amount));
  if (!amountMatches(amt, c.amount, c.tolerancePercent)) {
    if (amt < c.amount) return { ok: false, reason: `kurang bayar (${amt} < ${c.amount})` };
    return { ok: false, reason: `nominal tidak cocok (${amt} vs ${c.amount})` };
  }

  const t = Number(tx.transactionTime || 0);
  if (c.startTime && t < c.startTime) return { ok: false, reason: 'di luar window waktu' };
  if (c.endTime && t > c.endTime) return { ok: false, reason: 'di luar window waktu' };

  return { ok: true };
}

/**
 * Cek apakah satu deposit on-chain cocok dengan kriteria.
 * @param {object} deposit - item dari getDepositHistory()
 * @param {object} c - kriteria (sama spt matchPay) + c.network opsional
 * @param {string} normalizedNetwork - hasil normalizeNetwork(deposit.network)
 * @returns {{ ok: boolean, reason?: string }}
 */
function matchDeposit(deposit, c, normalizedNetwork) {
  if (!deposit) return { ok: false, reason: 'data kurang' };
  if (!String(deposit.id || '')) return { ok: false, reason: 'deposit tanpa id' };

  if (String(deposit.coin || '').toUpperCase() !== String(c.currency).toUpperCase()) {
    return { ok: false, reason: 'coin tidak cocok' };
  }

  if (c.network && String(c.network).toUpperCase() !== normalizedNetwork) {
    return { ok: false, reason: 'network tidak cocok' };
  }

  const amt = Math.abs(toAmount(deposit.amount));
  if (!amountMatches(amt, c.amount, c.tolerancePercent)) {
    if (amt < c.amount) return { ok: false, reason: `kurang bayar (${amt} < ${c.amount})` };
    return { ok: false, reason: `nominal tidak cocok (${amt} vs ${c.amount})` };
  }

  const t = Number(deposit.insertTime || 0);
  if (c.startTime && t < c.startTime) return { ok: false, reason: 'di luar window waktu' };
  if (c.endTime && t > c.endTime) return { ok: false, reason: 'di luar window waktu' };

  return { ok: true };
}

/**
 * Cari transaksi Pay pertama yang cocok dari daftar.
 * @param {Array} txs
 * @param {object} c kriteria
 * @returns {object|null} transaksi yang cocok (sudah dinormalisasi)
 */
function findPayMatch(txs, c) {
  const sorted = [...txs].sort((a, b) => Number(b.transactionTime) - Number(a.transactionTime));
  for (const tx of sorted) {
    if (matchPay(tx, c).ok) {
      return {
        method: 'BINANCE_PAY',
        transactionId: String(tx.transactionId),
        amount: Math.abs(toAmount(tx.amount)),
        currency: tx.currency,
        transactionTime: Number(tx.transactionTime || 0),
      };
    }
  }
  return null;
}

/**
 * Cari deposit on-chain pertama yang cocok dari daftar.
 * @param {Array} deposits
 * @param {object} c kriteria
 * @param {function} normalizeNetwork
 * @returns {object|null} deposit yang cocok (sudah dinormalisasi)
 */
function findDepositMatch(deposits, c, normalizeNetwork) {
  const sorted = [...deposits].sort((a, b) => Number(b.insertTime) - Number(a.insertTime));
  for (const d of sorted) {
    const net = normalizeNetwork(d.network || '');
    if (matchDeposit(d, c, net).ok) {
      return {
        method: 'ONCHAIN',
        transactionId: String(d.id),
        txHash: d.txId || '',
        amount: Math.abs(toAmount(d.amount)),
        currency: d.coin,
        network: net,
        transactionTime: Number(d.insertTime || 0),
      };
    }
  }
  return null;
}

module.exports = {
  toAmount, isIncome, amountMatches,
  matchPay, matchDeposit, findPayMatch, findDepositMatch,
};
