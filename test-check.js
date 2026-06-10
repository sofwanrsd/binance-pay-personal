'use strict';

/**
 * Diagnostik: ambil SEMUA Pay Trade History (90 hari, limit 100) lewat client
 * asli app, tampilkan ringkas (MASUK/KELUAR) + JSON lengkap untuk dibandingkan
 * dengan aplikasi Binance.
 *
 * Jalankan: node test-check.js
 */

const client = require('./src/binanceSpotClient');
const matcher = require('./src/paymentMatcher');

async function main() {
  console.log('-> ambil Pay Trade History (90 hari, limit 100)...\n');
  const txs = await client.getPayTransactions({ limit: 100 });

  if (!txs.length) {
    console.log('(tidak ada transaksi)');
    return;
  }

  console.log('=== RINGKAS ===');
  for (const tx of txs) {
    const masuk = matcher.isIncome(tx);
    const arah = masuk ? 'MASUK ' : 'KELUAR';
    const waktu = new Date(Number(tx.transactionTime)).toISOString();
    const payer = tx.payerInfo ? tx.payerInfo.binanceId : '-';
    const receiver = tx.receiverInfo ? tx.receiverInfo.binanceId : '-';
    console.log(
      `[${arah}] ${tx.amount} ${tx.currency}  ${waktu}  type=${tx.orderType}  ` +
        `wallet=${tx.walletType}  payer=${payer} -> receiver=${receiver}  tx=${tx.transactionId}`
    );
  }

  const income = txs.filter((t) => matcher.isIncome(t));
  console.log(
    `\nTotal: ${txs.length} transaksi | MASUK: ${income.length} | KELUAR: ${txs.length - income.length}`
  );

  console.log('\n=== JSON LENGKAP ===');
  console.log(JSON.stringify(txs, null, 2));
}

main().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
