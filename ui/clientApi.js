// Helper API + manajemen credentials (localStorage) + Toast system

export function getCreds() {
  return {
    apiKey: localStorage.getItem('bnApiKey') || '',
    apiSecret: localStorage.getItem('bnApiSecret') || '',
    payId: localStorage.getItem('bnPayId') || '',
  };
}

export function setCreds({ apiKey, apiSecret, payId }) {
  if (apiKey !== undefined) localStorage.setItem('bnApiKey', apiKey);
  if (apiSecret !== undefined) localStorage.setItem('bnApiSecret', apiSecret);
  if (payId !== undefined) localStorage.setItem('bnPayId', payId);
}

export function clearCreds() {
  ['bnApiKey', 'bnApiSecret', 'bnPayId'].forEach((k) => localStorage.removeItem(k));
}

export function getAppKey() {
  return localStorage.getItem('bnAppKey') || '';
}

export function setAppKey(v) {
  if (v) localStorage.setItem('bnAppKey', v);
  else localStorage.removeItem('bnAppKey');
}

function headers() {
  const c = getCreds();
  const h = { 'Content-Type': 'application/json' };
  if (c.apiKey) h['X-Binance-Api-Key'] = c.apiKey;
  if (c.apiSecret) h['X-Binance-Api-Secret'] = c.apiSecret;
  if (c.payId) h['X-Binance-Pay-Id'] = c.payId;
  const appKey = getAppKey();
  if (appKey) h['X-App-Key'] = appKey;
  return h;
}

export async function api(path, opts = {}) {
  const res = await fetch('/api' + path, { headers: headers(), ...opts });
  const data = await res.json().catch(() => ({ error: 'response bukan JSON' }));
  return { ok: res.ok, status: res.status, data };
}

export function notifyToast(message, type = 'info') {
  window.dispatchEvent(new CustomEvent('binance-toast', { detail: { message, type } }));
}

export function copy(text, label = 'Teks') {
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    notifyToast(`${label} telah disalin ke clipboard!`, 'success');
  }).catch(() => {
    notifyToast(`Gagal menyalin ${label}`, 'error');
  });
}

export function fmtTime(ms) {
  if (!ms) return '-';
  return new Date(Number(ms)).toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'medium'
  });
}
