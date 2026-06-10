'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

// Pastikan pakai in-memory store (tanpa KV) untuk test deterministik
delete process.env.KV_REST_API_URL;
delete process.env.UPSTASH_REDIS_REST_URL;

const store = require('../src/orderStore');
const matcher = require('../src/paymentMatcher');

const NOW = Date.now();

// invoice dasar untuk dipakai test
function makeInvoice(over = {}) {
  return {
    id: 'INV_TEST_' + Math.random().toString(36).slice(2, 8),
    baseAmount: 5,
    expectedAmount: 5.0037,
    currency: 'USDT',
    network: null,
    status: 'PENDING',
    createdAt: NOW - 5 * 60 * 1000,
    expiresAt: NOW + 25 * 60 * 1000,
    claimAttempts: 0,
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

test('toAmount: parsing angka', () => {
  assert.strictEqual(matcher.toAmount('5.0037'), 5.0037);
  assert.strictEqual(matcher.toAmount('-0.01'), -0.01);
  assert.ok(Number.isNaN(matcher.toAmount('abc')));
});

test('isIncome: positif = masuk', () => {
  assert.strictEqual(matcher.isIncome({ amount: '5' }), true);
  assert.strictEqual(matcher.isIncome({ amount: '-5' }), false);
});

test('verifyMatch: cocok sempurna', async () => {
  const inv = makeInvoice();
  const r = await matcher.verifyMatch(inv, payTx());
  assert.strictEqual(r.ok, true);
});

test('verifyMatch: tolak transaksi keluar (negatif)', async () => {
  const inv = makeInvoice();
  const r = await matcher.verifyMatch(inv, payTx({ amount: '-5.0037' }));
  assert.strictEqual(r.ok, false);
  assert.match(r.reason, /bukan transaksi masuk/);
});

test('verifyMatch: tolak mata uang beda', async () => {
  const inv = makeInvoice();
  const r = await matcher.verifyMatch(inv, payTx({ currency: 'BNB' }));
  assert.strictEqual(r.ok, false);
  assert.match(r.reason, /mata uang/);
});

test('verifyMatch: tolak kurang bayar', async () => {
  const inv = makeInvoice();
  const r = await matcher.verifyMatch(inv, payTx({ amount: '4.0' }));
  assert.strictEqual(r.ok, false);
  assert.match(r.reason, /kurang bayar/);
});

test('verifyMatch: tolak di luar window waktu', async () => {
  const inv = makeInvoice();
  const r = await matcher.verifyMatch(inv, payTx({ transactionTime: NOW + 60 * 60 * 1000 }));
  assert.strictEqual(r.ok, false);
  assert.match(r.reason, /window waktu/);
});

test('verifyMatch: toleransi nominal dalam batas', async () => {
  // default toleransi 0.5% dari 5.0037 = ~0.025
  const inv = makeInvoice();
  const r = await matcher.verifyMatch(inv, payTx({ amount: '5.01' }));
  assert.strictEqual(r.ok, true);
});

test('settleInvoice: tandai PAID + dedupe anti-replay', async () => {
  const inv = await store.save(makeInvoice());
  const tx = payTx();

  const settled = await matcher.settleInvoice(inv, tx);
  assert.ok(settled);
  assert.strictEqual(settled.status, 'PAID');
  assert.strictEqual(settled.transactionId, String(tx.transactionId));

  // transaksi yang sama tidak boleh dipakai lagi
  assert.strictEqual(await store.isTransactionUsed(tx.transactionId), true);
  const r = await matcher.verifyMatch(makeInvoice(), tx);
  assert.strictEqual(r.ok, false);
  assert.match(r.reason, /sudah pernah dipakai/);
});

test('settleInvoice: invoice non-PENDING tidak bisa di-settle', async () => {
  const inv = await store.save(makeInvoice({ status: 'PAID' }));
  const settled = await matcher.settleInvoice(inv, payTx());
  assert.strictEqual(settled, null);
});

test('verifyDepositMatch: deposit on-chain cocok', async () => {
  const inv = makeInvoice({ network: 'TRC20' });
  const deposit = {
    id: 'DEP_' + Math.random().toString(36).slice(2, 8),
    amount: '5.0037',
    coin: 'USDT',
    network: 'TRX',
    insertTime: NOW,
    txId: '0xabc',
  };
  const r = await matcher.verifyDepositMatch(inv, deposit, 'TRC20');
  assert.strictEqual(r.ok, true);
});

test('verifyDepositMatch: tolak network beda', async () => {
  const inv = makeInvoice({ network: 'TRC20' });
  const deposit = {
    id: 'DEP_' + Math.random().toString(36).slice(2, 8),
    amount: '5.0037', coin: 'USDT', network: 'BSC', insertTime: NOW,
  };
  const r = await matcher.verifyDepositMatch(inv, deposit, 'BEP20');
  assert.strictEqual(r.ok, false);
  assert.match(r.reason, /network tidak cocok/);
});
