'use strict';

const config = require('./config');
const client = require('./binanceSpotClient');
const store = require('./orderStore');
const matcher = require('./paymentMatcher');
const { fulfillOrder } = require('./fulfillment');

/**
 * Poller latar belakang: tiap interval jalankan DUA cek sekaligus:
 *  1. Binance Pay transactions  (/sapi/v1/pay/transactions)
 *  2. On-chain deposit history  (/sapi/v1/capital/deposit/hisrec)
 *
 * Keduanya dijalankan paralel (Promise.allSettled) supaya satu gagal
 * tidak memblokir yang lain.
 *
 * Juga menandai invoice yang lewat waktu jadi EXPIRED.
 */

let timer = null;
let running = false;

async function tick() {
  if (running) return; // hindari overlap kalau request sebelumnya lambat
  running = true;
  try {
    expireOverdue();

    const pending = store.pending();
    if (pending.length === 0) return; // tidak perlu hit API kalau tidak ada yang nunggu

    const lookbackMs = (config.invoiceExpiryMinutes + config.matchGraceMinutes + 60) * 60 * 1000;
    const startTime = Date.now() - lookbackMs;
    const endTime = Date.now();

    // Jalankan kedua cek paralel
    const [payResult, depositResult] = await Promise.allSettled([
      client.getPayTransactions({ startTime, endTime, limit: 100 }),
      config.onChainEnabled
        ? client.getDepositHistory({ startTime, endTime, limit: 100 })
        : Promise.resolve([]),
    ]);

    // --- 1) Proses Binance Pay transactions ---
    if (payResult.status === 'fulfilled') {
      for (const tx of payResult.value) {
        if (!matcher.isIncome(tx)) continue;
        if (store.isTransactionUsed(String(tx.transactionId))) continue;

        const invoice = matcher.findMatchingInvoice(tx);
        if (!invoice) continue;

        const settled = matcher.settleInvoice(invoice, tx);
        if (settled) {
          console.log(
            `[poller/pay] invoice ${settled.id} -> PAID ` +
              `(tx ${settled.transactionId}, ${settled.paidAmount} ${settled.currency})`
          );
          fulfillOrder(settled).catch((e) =>
            console.error('[fulfillment async]', e.message)
          );
        }
      }
    } else {
      console.error('[poller/pay] error:', payResult.reason?.message);
    }

    // --- 2) Proses on-chain deposits ---
    if (depositResult.status === 'fulfilled') {
      for (const deposit of depositResult.value) {
        const txId = String(deposit.id || '');
        if (!txId) continue;
        if (store.isTransactionUsed(txId)) continue;

        const normalizedNetwork = client.normalizeNetwork(deposit.network || '');

        // Skip kalau network tidak ada di acceptedNetworks
        if (!config.acceptedNetworks.includes(normalizedNetwork)) continue;

        const invoice = matcher.findMatchingInvoiceForDeposit(deposit, normalizedNetwork);
        if (!invoice) continue;

        const settled = matcher.settleInvoiceFromDeposit(invoice, deposit, normalizedNetwork);
        if (settled) {
          console.log(
            `[poller/onchain] invoice ${settled.id} -> PAID ` +
              `(deposit ${settled.transactionId}, ${settled.paidAmount} ${settled.currency}, ` +
              `network ${settled.network}, txHash ${settled.txHash || '-'})`
          );
          fulfillOrder(settled).catch((e) =>
            console.error('[fulfillment async]', e.message)
          );
        }
      }
    } else {
      console.error('[poller/onchain] error:', depositResult.reason?.message);
    }
  } catch (err) {
    console.error('[poller] error tidak terduga:', err.message);
  } finally {
    running = false;
  }
}

/** Tandai invoice PENDING yang sudah lewat expiry jadi EXPIRED. */
function expireOverdue() {
  const now = Date.now();
  for (const inv of store.all()) {
    if (inv.status === 'PENDING' && inv.expiresAt <= now) {
      store.update(inv.id, { status: 'EXPIRED' });
      console.log(`[poller] invoice ${inv.id} -> EXPIRED`);
    }
  }
}

function start() {
  if (timer) return;
  const intervalMs = Math.max(5, config.pollIntervalSeconds) * 1000;
  timer = setInterval(tick, intervalMs);
  console.log(
    `[poller] mulai, interval ${config.pollIntervalSeconds}s` +
      (config.onChainEnabled ? ' (Pay + on-chain)' : ' (Pay only)')
  );
  tick(); // jalankan sekali langsung tanpa nunggu interval pertama
}

function stop() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

module.exports = { start, stop, tick };
