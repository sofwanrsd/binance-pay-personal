'use strict';

/**
 * Client KV via Upstash REST API (kompatibel dengan Vercel KV).
 * Dipakai untuk storage persisten di serverless (Vercel) di mana
 * filesystem bersifat ephemeral.
 *
 * Aktif kalau env tersedia:
 *   KV_REST_API_URL   (atau UPSTASH_REDIS_REST_URL)
 *   KV_REST_API_TOKEN (atau UPSTASH_REDIS_REST_TOKEN)
 *
 * Kalau tidak ada, isEnabled() = false dan caller pakai fallback in-memory.
 */

const URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';

function isEnabled() {
  return Boolean(URL && TOKEN);
}

async function command(args) {
  const res = await fetch(URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`KV error HTTP ${res.status}: ${txt}`);
  }
  const json = await res.json();
  return json.result;
}

// ---- helper tingkat tinggi ----

async function get(key) {
  const v = await command(['GET', key]);
  if (v == null) return null;
  try { return JSON.parse(v); } catch (e) { return v; }
}

async function set(key, value) {
  const v = typeof value === 'string' ? value : JSON.stringify(value);
  return command(['SET', key, v]);
}

async function del(key) {
  return command(['DEL', key]);
}

/** Tambah anggota ke set. */
async function sadd(key, member) {
  return command(['SADD', key, String(member)]);
}

/** Cek member ada di set. */
async function sismember(key, member) {
  const r = await command(['SISMEMBER', key, String(member)]);
  return r === 1 || r === '1';
}

/** Tambah id ke index set (daftar semua invoice id). */
async function smembers(key) {
  const r = await command(['SMEMBERS', key]);
  return Array.isArray(r) ? r : [];
}

module.exports = { isEnabled, get, set, del, sadd, sismember, smembers };
