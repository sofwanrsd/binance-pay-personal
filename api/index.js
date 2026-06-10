'use strict';

const express = require('express');
const path = require('path');

// Di Vercel (serverless), setiap request bisa dapat instance baru.
// Poller background tidak bisa jalan — gunakan /api/invoices/:id/check
// untuk trigger cek on-demand, atau buyer kirim TxId via /claim.

const app = express();

app.use(express.json());

// Serve static files dari public/ untuk dev lokal
// (di Vercel, static files dihandle langsung oleh CDN)
if (process.env.NODE_ENV !== 'production') {
  app.use(express.static(path.join(__dirname, '..', 'public')));
}

app.get('/api/health', (req, res) => res.json({ ok: true, ts: Date.now() }));

// Mount semua routes di /api
const routes = require('../src/routes');
app.use('/api', routes);

app.use((err, req, res, next) => {
  console.error('[unhandled]', err.message);
  res.status(500).json({ error: 'internal server error' });
});

// Export untuk Vercel serverless
module.exports = app;

// Jalan juga sebagai server biasa untuk dev lokal & npm start
if (require.main === module) {
  const config = require('../src/config');
  const store = require('../src/orderStore');
  const poller = require('../src/poller');

  const server = app.listen(config.port, () => {
    console.log(`Server jalan di http://localhost:${config.port}`);
    if (config.apiKey && config.apiSecret) {
      poller.start();
    } else {
      console.warn('[poller] tidak dimulai, isi .env dulu');
    }
  });

  function shutdown(sig) {
    console.log(`[${sig}] shutdown...`);
    poller.stop();
    server.close(() => {
      store.flushSync();
      process.exit(0);
    });
    setTimeout(() => { store.flushSync(); process.exit(0); }, 5000).unref();
  }
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}
