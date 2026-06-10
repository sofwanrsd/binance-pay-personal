'use strict';

/**
 * Penyimpanan invoice dengan persistensi ke file JSON.
 *
 * Tujuan: data tidak hilang saat server restart. Tetap simpel & tanpa
 * dependency tambahan. Untuk skala besar / banyak instance, GANTI ke
 * database (Postgres/MySQL/Redis) yang mendukung transaksi atomik.
 *
 * Penulisan dibuat atomic (tulis ke file temp lalu rename) supaya file
 * tidak korup kalau proses mati di tengah penulisan.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'invoices.json');

/** @type {Map<string, object>} invoiceId -> invoice */
const invoices = new Map();
/** @type {Set<string>} transactionId yang sudah dipakai klaim (dedupe / anti-replay) */
const usedTransactions = new Set();

let dirty = false;
let flushTimer = null;

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function load() {
  try {
    if (!fs.existsSync(DATA_FILE)) return;
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    if (!raw.trim()) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.invoices)) {
      for (const inv of parsed.invoices) {
        if (inv && inv.id) invoices.set(inv.id, inv);
      }
    }
    if (Array.isArray(parsed.usedTransactions)) {
      for (const id of parsed.usedTransactions) usedTransactions.add(id);
    }
    console.log(`[store] load ${invoices.size} invoice dari ${DATA_FILE}`);
  } catch (e) {
    console.error(`[store] gagal load ${DATA_FILE}: ${e.message}`);
  }
}

function persist() {
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
  flushTimer = setTimeout(() => {
    flushTimer = null;
    if (dirty) persist();
  }, 200);
}

function save(invoice) {
  const record = { ...invoice, updatedAt: Date.now() };
  invoices.set(invoice.id, record);
  scheduleFlush();
  return record;
}

function get(id) {
  return invoices.get(id) || null;
}

function update(id, patch = {}) {
  const existing = invoices.get(id);
  if (!existing) return null;
  const updated = { ...existing, ...patch, updatedAt: Date.now() };
  invoices.set(id, updated);
  scheduleFlush();
  return updated;
}

function all() {
  return Array.from(invoices.values());
}

/** Semua invoice yang masih menunggu pembayaran (PENDING & belum expired). */
function pending() {
  const now = Date.now();
  return Array.from(invoices.values()).filter(
    (inv) => inv.status === 'PENDING' && inv.expiresAt > now
  );
}

// ---- Dedupe / anti-replay transaksi ----
function isTransactionUsed(transactionId) {
  return usedTransactions.has(String(transactionId));
}

function markTransactionUsed(transactionId) {
  usedTransactions.add(String(transactionId));
  scheduleFlush();
}

/** Flush sinkron, dipanggil saat shutdown supaya data terakhir tersimpan. */
function flushSync() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (dirty) persist();
}

load();

module.exports = {
  save,
  get,
  update,
  all,
  pending,
  isTransactionUsed,
  markTransactionUsed,
  flushSync,
};
