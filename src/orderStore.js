'use strict';

/**
 * Penyimpanan invoice dengan dua backend:
 *  1. KV (Upstash/Vercel KV) — dipakai kalau env KV tersedia. Persisten di
 *     serverless (Vercel) di mana filesystem ephemeral.
 *  2. In-memory + file JSON — fallback untuk dev lokal / VPS.
 *
 * SEMUA fungsi async supaya seragam antar backend.
 */

const fs = require('fs');
const path = require('path');
const kv = require('./kvClient');

const USE_KV = kv.isEnabled();
const KEY_INV = (id) => `inv:${id}`;
const KEY_INDEX = 'inv:index';        // set semua invoice id
const KEY_TXSET = 'tx:used';          // set transactionId terpakai

// ---- backend in-memory (fallback) ----
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'invoices.json');
const invoices = new Map();
const usedTransactions = new Set();
let dirty = false;
let flushTimer = null;

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadLocal() {
  try {
    if (!fs.existsSync(DATA_FILE)) return;
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    if (!raw.trim()) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.invoices)) {
      for (const inv of parsed.invoices) if (inv && inv.id) invoices.set(inv.id, inv);
    }
    if (Array.isArray(parsed.usedTransactions)) {
      for (const id of parsed.usedTransactions) usedTransactions.add(id);
    }
    console.log(`[store] load ${invoices.size} invoice dari ${DATA_FILE}`);
  } catch (e) {
    console.error(`[store] gagal load: ${e.message}`);
  }
}

function persistLocal() {
  try {
    ensureDir();
    const snapshot = {
      invoices: Array.from(invoices.values()),
      usedTransactions: Array.from(usedTransactions),
      savedAt: Date.now(),
    };
    const tmp = `${DATA_FILE}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(snapshot, null, 2), 'utf8');
    fs.renameSync(tmp, DATA_FILE);
    dirty = false;
  } catch (e) {
    console.error(`[store] gagal persist: ${e.message}`);
  }
}

function scheduleFlush() {
  dirty = true;
  if (flushTimer) return;
  flushTimer = setTimeout(() => { flushTimer = null; if (dirty) persistLocal(); }, 200);
}

if (!USE_KV) loadLocal();
else console.log('[store] mode KV (persisten) aktif');

// ---- API publik (async) ----

async function save(invoice) {
  const record = { ...invoice, updatedAt: Date.now() };
  if (USE_KV) {
    await kv.set(KEY_INV(record.id), record);
    await kv.sadd(KEY_INDEX, record.id);
  } else {
    invoices.set(record.id, record);
    scheduleFlush();
  }
  return record;
}

async function get(id) {
  if (USE_KV) return kv.get(KEY_INV(id));
  return invoices.get(id) || null;
}

async function update(id, patch = {}) {
  const existing = await get(id);
  if (!existing) return null;
  const updated = { ...existing, ...patch, updatedAt: Date.now() };
  if (USE_KV) {
    await kv.set(KEY_INV(id), updated);
  } else {
    invoices.set(id, updated);
    scheduleFlush();
  }
  return updated;
}

async function all() {
  if (USE_KV) {
    const ids = await kv.smembers(KEY_INDEX);
    const out = [];
    for (const id of ids) {
      const inv = await kv.get(KEY_INV(id));
      if (inv) out.push(inv);
    }
    return out;
  }
  return Array.from(invoices.values());
}

/** Invoice PENDING yang belum expired. */
async function pending() {
  const now = Date.now();
  const list = await all();
  return list.filter((inv) => inv.status === 'PENDING' && inv.expiresAt > now);
}

// ---- dedupe / anti-replay ----
async function isTransactionUsed(transactionId) {
  if (USE_KV) return kv.sismember(KEY_TXSET, String(transactionId));
  return usedTransactions.has(String(transactionId));
}

async function markTransactionUsed(transactionId) {
  if (USE_KV) {
    await kv.sadd(KEY_TXSET, String(transactionId));
  } else {
    usedTransactions.add(String(transactionId));
    scheduleFlush();
  }
}

/** Flush sinkron saat shutdown (hanya untuk backend lokal). */
function flushSync() {
  if (USE_KV) return;
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  if (dirty) persistLocal();
}

module.exports = {
  save, get, update, all, pending,
  isTransactionUsed, markTransactionUsed, flushSync,
  usesKV: USE_KV,
};
