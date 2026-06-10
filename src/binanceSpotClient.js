'use strict';

const crypto = require('crypto');
const https = require('https');
const { URL } = require('url');

/**
 * Client Binance Spot API untuk AKUN PERSONAL.
 * Semua fungsi menerima `cfg` (hasil config.fromRequest(req)) supaya
 * credentials bisa berbeda per-request (dari UI / localStorage).
 *
 * Beda dengan Binance Pay MERCHANT API:
 *  - Signature pakai HMAC-SHA256 atas query string (bukan body).
 *  - Auth header: X-MBX-APIKEY.
 *  - Endpoint: GET /sapi/v1/pay/transactions (USER_DATA),
 *    cukup permission "Enable Reading".
 */

function sign(queryString, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(queryString)
    .digest('hex');
}

function buildQuery(params) {
  return Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

/** GET via modul https, dengan dukungan pin IP (resolveIp) + SNI yang benar. */
function httpsGet(fullUrl, headers, resolveIp) {
  return new Promise((resolve, reject) => {
    const u = new URL(fullUrl);
    const options = {
      method: 'GET',
      hostname: resolveIp || u.hostname,
      port: u.port || 443,
      path: `${u.pathname}${u.search}`,
      headers: { ...headers, Host: u.hostname },
      servername: u.hostname, // SNI tetap hostname asli
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, text: body }));
    });
    req.on('error', reject);
    req.setTimeout(20000, () => req.destroy(new Error('request timeout')));
    req.end();
  });
}

/**
 * Panggil endpoint SIGNED (USER_DATA) via GET.
 * @param {string} endpoint
 * @param {object} params
 * @param {object} cfg - config dari fromRequest(req)
 */
async function signedGet(endpoint, params = {}, cfg) {
  if (!cfg.apiKey || !cfg.apiSecret) {
    throw new Error('API key / secret belum diisi');
  }
  const withTs = { ...params, timestamp: Date.now(), recvWindow: 60000 };
  const qs = buildQuery(withTs);
  const signature = sign(qs, cfg.apiSecret);
  const url = `${cfg.baseUrl}${endpoint}?${qs}&signature=${signature}`;

  const { status, text } = await httpsGet(
    url,
    { 'X-MBX-APIKEY': cfg.apiKey },
    cfg.resolveIp
  );

  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    throw new Error(`Binance response bukan JSON (HTTP ${status}): ${text}`);
  }

  if (status < 200 || status >= 300) {
    const msg = json.msg || json.message || `HTTP ${status}`;
    const err = new Error(`Binance API error: ${msg}`);
    err.code = json.code;
    err.response = json;
    throw err;
  }

  return json;
}

/**
 * Ambil riwayat Binance Pay (transfer masuk/keluar) akun ini.
 * @param {object} opts
 * @param {number} [opts.startTime] epoch ms
 * @param {number} [opts.endTime]   epoch ms
 * @param {number} [opts.limit]     default 100, max 100
 * @param {object} opts.cfg         config dari fromRequest(req)
 * @returns {Promise<Array>}
 */
async function getPayTransactions({ startTime, endTime, limit = 100, cfg } = {}) {
  const json = await signedGet('/sapi/v1/pay/transactions', { startTime, endTime, limit }, cfg);
  if (Array.isArray(json)) return json;
  return Array.isArray(json.data) ? json.data : [];
}

/**
 * Ambil riwayat deposit on-chain ke akun Binance.
 * @param {object} opts
 * @param {number} [opts.startTime] epoch ms
 * @param {number} [opts.endTime]   epoch ms
 * @param {string} [opts.coin]      filter per coin, contoh "USDT"
 * @param {number} [opts.limit]     default 100, max 1000
 * @param {object} opts.cfg         config dari fromRequest(req)
 * @returns {Promise<Array>}
 */
async function getDepositHistory({ startTime, endTime, coin, limit = 100, cfg } = {}) {
  const json = await signedGet(
    '/sapi/v1/capital/deposit/hisrec',
    { startTime, endTime, coin, limit, status: 1 },
    cfg
  );
  return Array.isArray(json) ? json : [];
}

/**
 * Mapping network label Binance (dari deposit history) ke label umum.
 */
const NETWORK_LABEL_MAP = {
  TRX: 'TRC20', BSC: 'BEP20', ETH: 'ERC20', BNB: 'BEP2',
  SOL: 'SOL', MATIC: 'MATIC', AVAXC: 'AVAXC', ARB: 'ARBITRUM', OP: 'OPTIMISM',
};

function normalizeNetwork(network) {
  return NETWORK_LABEL_MAP[String(network).toUpperCase()] || String(network).toUpperCase();
}

module.exports = { getPayTransactions, getDepositHistory, normalizeNetwork, sign, signedGet };
