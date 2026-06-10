'use strict';

require('dotenv').config();

function num(name, def, env) {
  const v = (env || process.env)[name];
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : def;
}

/**
 * Base config dari environment variables (untuk dev lokal & Vercel env vars).
 * Dipakai sebagai fallback kalau request tidak bawa credentials di header.
 */
const envConfig = {
  apiKey: process.env.BINANCE_API_KEY || '',
  apiSecret: process.env.BINANCE_API_SECRET || '',
  baseUrl: process.env.BINANCE_BASE_URL || 'https://api.binance.com',
  resolveIp: process.env.BINANCE_RESOLVE_IP || '',
  payId: process.env.BINANCE_PAY_ID || '',
  acceptedCurrencies: (process.env.ACCEPTED_CURRENCIES || 'USDT')
    .split(',').map((s) => s.trim().toUpperCase()).filter(Boolean),
  invoiceExpiryMinutes: num('INVOICE_EXPIRY_MINUTES', 30),
  amountTolerancePercent: num('AMOUNT_TOLERANCE_PERCENT', 0.5),
  uniqueAmount: (process.env.UNIQUE_AMOUNT || 'true').toLowerCase() !== 'false',
  uniqueAmountMax: num('UNIQUE_AMOUNT_MAX', 0.0099),
  pollIntervalSeconds: num('POLL_INTERVAL_SECONDS', 20),
  matchGraceMinutes: num('MATCH_GRACE_MINUTES', 10),
  maxClaimAttempts: num('MAX_CLAIM_ATTEMPTS', 10),
  acceptedNetworks: (process.env.ACCEPTED_NETWORKS || 'TRC20,BEP20')
    .split(',').map((s) => s.trim().toUpperCase()).filter(Boolean),
  onChainEnabled: (process.env.ONCHAIN_ENABLED || 'true').toLowerCase() !== 'false',
  port: parseInt(process.env.PORT || '3000', 10),
};

/**
 * Buat config dari request Express.
 * Credentials WAJIB dikirim lewat header per-request (mode API provider):
 *   X-Binance-Api-Key, X-Binance-Api-Secret, X-Binance-Pay-Id
 *
 * Tidak ada fallback ke env var, supaya deployment publik tidak
 * membocorkan akun pemilik server. Setiap pemanggil pakai akunnya sendiri.
 * Field lain (toleransi, expiry, dll) tetap dari env.
 *
 * @param {import('express').Request} req
 * @returns {typeof envConfig}
 */
function fromRequest(req) {
  const headerKey    = req.headers['x-binance-api-key'];
  const headerSecret = req.headers['x-binance-api-secret'];
  const headerPayId  = req.headers['x-binance-pay-id'];

  return {
    ...envConfig,
    apiKey:    (headerKey    && headerKey.trim())    || '',
    apiSecret: (headerSecret && headerSecret.trim()) || '',
    payId:     (headerPayId  && headerPayId.trim())  || '',
  };
}

module.exports = { ...envConfig, fromRequest };
