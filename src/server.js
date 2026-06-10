'use strict';

const express = require('express');
const config = require('./config');
const routes = require('./routes');
const store = require('./orderStore');
const poller = require('./poller');

const app = express();

app.use(express.json());

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/api', routes);

app.use((req, res) => res.status(404).json({ error: 'not found' }));

const server = app.listen(config.port, () => {
  console.log(`Binance Pay (personal) gateway jalan di http://localhost:${config.port}`);
  if (!config.apiKey || !config.apiSecret) {
    console.warn('PERINGATAN: BINANCE_API_KEY / BINANCE_API_SECRET belum diisi di .env');
  }
  if (!config.payId) {
    console.warn('PERINGATAN: BINANCE_PAY_ID belum diisi, instruksi bayar tidak lengkap');
  }
  // Mulai poller hanya kalau kredensial ada (biar tidak spam error saat dev)
  if (config.apiKey && config.apiSecret) {
    poller.start();
  } else {
    console.warn('[poller] tidak dimulai karena kredensial kosong');
  }
});

// Graceful shutdown: hentikan poller & simpan data sebelum proses mati
function shutdown(signal) {
  console.log(`\n[${signal}] mematikan server, menyimpan data...`);
  poller.stop();
  server.close(() => {
    store.flushSync();
    console.log('[shutdown] selesai, data tersimpan');
    process.exit(0);
  });
  setTimeout(() => {
    store.flushSync();
    process.exit(0);
  }, 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
