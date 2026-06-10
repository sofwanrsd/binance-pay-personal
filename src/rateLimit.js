'use strict';

/**
 * Rate limiter sederhana berbasis in-memory (sliding window per IP).
 *
 * Catatan: di serverless (Vercel) state in-memory tidak persisten antar
 * invocation, jadi ini "best effort" — tetap berguna menahan burst dalam
 * satu instance. Untuk rate limit ketat lintas instance, pakai KV/Redis.
 *
 * Konfigurasi via env:
 *   RATE_LIMIT_WINDOW_MS  (default 60000 = 1 menit)
 *   RATE_LIMIT_MAX        (default 60 request per window per IP)
 */

const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);
const MAX = parseInt(process.env.RATE_LIMIT_MAX || '60', 10);

/** @type {Map<string, number[]>} ip -> daftar timestamp request */
const hits = new Map();

function clientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return req.socket?.remoteAddress || req.ip || 'unknown';
}

function rateLimit(req, res, next) {
  const ip = clientIp(req);
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  const list = (hits.get(ip) || []).filter((t) => t > windowStart);
  list.push(now);
  hits.set(ip, list);

  // bersihkan map sesekali biar tidak bocor memori
  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      if (v.every((t) => t <= windowStart)) hits.delete(k);
    }
  }

  const remaining = Math.max(0, MAX - list.length);
  res.setHeader('X-RateLimit-Limit', String(MAX));
  res.setHeader('X-RateLimit-Remaining', String(remaining));

  if (list.length > MAX) {
    const retryMs = list[0] + WINDOW_MS - now;
    res.setHeader('Retry-After', String(Math.ceil(retryMs / 1000)));
    return res.status(429).json({
      error: 'terlalu banyak request, coba lagi nanti',
      retryAfterSeconds: Math.ceil(retryMs / 1000),
    });
  }

  next();
}

module.exports = rateLimit;
