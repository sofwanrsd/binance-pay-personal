'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const matcher = require('../src/paymentMatcher');

const NOW = Date.now();

// kriteria dasar
function crit(over = {}) {
  return {
    amount: 5.0037,
    currency: 'USDT',
    network: null,
    tolerancePercent: 0.5,
    startTime: NOW - 30 * 60 * 1000,
    endTime: NOW + 5 * 60 * 1000,
    ...over,
  };
}

function payTx(over = {}) {
  return {
    transactionId: 'TX_' + Math.random().toString(36).slice(2, 10),
    amount: '5.0037',
    currency: 'USDT',
    transactionTime: NOW,
    ...over,
  };
}

function deposit(over = {}) {
  return {
    id: 'DEP_' + Math.random().toString(36).slice(2, 8),
    amount: '5.0037',
    coin: 'USDT',
    network: 'TRX',
    insertTime: NOW,
    txId: '0xabc',
    ...over,
  };
}

const normalizeNetwork = (n) => (String(n).toUpperCase() === 'TRX' ? 'TRC20' : String(n).toUpperCase());

test('toAmount: parsing angka', () => {
  assert.strictEqual(matcher.toAmount('5.0037'), 5.0037);
  assert.strictEqual(matcher.toAmount('-0.01'), -0.01);
  assert.ok(Number.isNaN(matcher.toAmount('abc')));
});

test('isIncome: positif = masuk', () => {
  assert.strictEqual(matcher.isIncome({ amount: '5' }), true);
  assert.strictEqual(matcher.isIncome({ amount: '-5' }), false);
});

test('amountMatches: dalam toleransi', () => {
  assert.strictEqual(matcher.amountMatches(5.01, 5.0037, 0.5), true);
  assert.strictEqual(matcher.amountMatches(4.0, 5.0037, 0.5), false);
});

test('matchPay: cocok sempurna', () => {
  assert.strictEqual(matcher.matchPay(payTx(), crit()).ok, true);
});

test('matchPay: tolak transaksi keluar (negatif)', () => {
  const r = matcher.matchPay(payTx({ amount: '-5.0037' }), crit());
  assert.strictEqual(r.ok, false);
  assert.match(r.reason, /bukan transaksi masuk/);
});

test('matchPay: tolak mata uang beda', () => {
  const r = matcher.matchPay(payTx({ currency: 'BNB' }), crit());
  assert.strictEqual(r.ok, false);
  assert.match(r.reason, /mata uang/);
});

test('matchPay: tolak kurang bayar', () => {
  const r = matcher.matchPay(payTx({ amount: '4.0' }), crit());
  assert.strictEqual(r.ok, false);
  assert.match(r.reason, /kurang bayar/);
});

test('matchPay: tolak di luar window waktu', () => {
  const r = matcher.matchPay(payTx({ transactionTime: NOW + 60 * 60 * 1000 }), crit());
  assert.strictEqual(r.ok, false);
  assert.match(r.reason, /window waktu/);
});

test('findPayMatch: temukan transaksi cocok di antara banyak', () => {
  const txs = [
    payTx({ amount: '1.0' }),
    payTx({ amount: '5.0037' }),
    payTx({ amount: '-5.0037' }),
  ];
  const m = matcher.findPayMatch(txs, crit());
  assert.ok(m);
  assert.strictEqual(m.method, 'BINANCE_PAY');
  assert.strictEqual(m.amount, 5.0037);
});

test('findPayMatch: tidak ada yang cocok -> null', () => {
  const txs = [payTx({ amount: '1.0' }), payTx({ amount: '2.0' })];
  assert.strictEqual(matcher.findPayMatch(txs, crit()), null);
});

test('matchDeposit: cocok dengan network benar', () => {
  const r = matcher.matchDeposit(deposit(), crit({ network: 'TRC20' }), 'TRC20');
  assert.strictEqual(r.ok, true);
});

test('matchDeposit: tolak network beda', () => {
  const r = matcher.matchDeposit(deposit({ network: 'BSC' }), crit({ network: 'TRC20' }), 'BEP20');
  assert.strictEqual(r.ok, false);
  assert.match(r.reason, /network tidak cocok/);
});

test('findDepositMatch: temukan deposit cocok + normalisasi network', () => {
  const deposits = [deposit({ amount: '1.0' }), deposit({ amount: '5.0037' })];
  const m = matcher.findDepositMatch(deposits, crit(), normalizeNetwork);
  assert.ok(m);
  assert.strictEqual(m.method, 'ONCHAIN');
  assert.strictEqual(m.network, 'TRC20');
  assert.strictEqual(m.amount, 5.0037);
});
