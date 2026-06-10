'use strict';

const config = require('./config');

/**
 * Gerbang akses deployment. Kalau APP_ACCESS_KEY di-set, setiap request
 * ke /api WAJIB membawa header X-App-Key yang cocok. Ini mencegah orang
 * lain memakai deployment kamu sebagai proxy gratis ke Binance.
 *
 * Kalau APP_ACCESS_KEY kosong, gerbang dinonaktifkan (terbuka) —
 * cocok untuk dev lokal, TIDAK disarankan untuk URL publik.
 *
 * Endpoint /api/health dikecualikan supaya health check tetap jalan.
 */
function accessGuard(req, res, next) {
  if (!config.appAccessKey) return next(); // gerbang nonaktif
  if (req.path === '/health') return next();

  const provided = req.headers['x-app-key'];
  if (provided && provided === config.appAccessKey) return next();

  return res.status(401).json({ error: 'akses ditolak: X-App-Key tidak valid' });
}

module.exports = accessGuard;
