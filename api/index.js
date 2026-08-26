'use strict';

const express = require('express');
const path = require('path');

// Di Vercel (serverless), setiap request bisa dapat instance baru.
// Server STATELESS — tidak menyimpan apa pun. Cek pembayaran on-demand
// via /api/check-payment.

const app = express();

app.use(express.json());

// Serve static files dari dist/ (UI build) dan ui/public/
app.use(express.static(path.join(__dirname, '..', 'dist')));
app.use(express.static(path.join(__dirname, '..', 'ui', 'public')));

app.get('/api/health', (req, res) => res.json({ ok: true, ts: Date.now() }));

// Mount semua routes di /api (access guard + rate limiting)
const accessGuard = require('../src/accessGuard');
const rateLimit = require('../src/rateLimit');
const routes = require('../src/routes');
app.use('/api', accessGuard, rateLimit, routes);

app.use((err, req, res, next) => {
  console.error('[unhandled]', err.message);
  res.status(500).json({ error: 'internal server error' });
});

// Export untuk Vercel serverless
module.exports = app;

// Jalan juga sebagai server biasa untuk dev lokal & npm start
if (require.main === module) {
  const config = require('../src/config');
  app.listen(config.port, () => {
    console.log(`Server (stateless) jalan di http://localhost:${config.port}`);
  });
}
