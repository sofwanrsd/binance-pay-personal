import React, { useState } from 'react';
import { getCreds, setCreds, clearCreds, getAppKey, setAppKey, api, notifyToast } from '../clientApi.js';
import { Settings, Eye, EyeOff, Save, Trash2, CheckCircle2, AlertCircle, RefreshCw, KeyRound, Lock, ShieldCheck } from 'lucide-react';

export default function Credentials() {
  const init = getCreds();
  const [apiKey, setApiKey] = useState(init.apiKey);
  const [apiSecret, setApiSecret] = useState(init.apiSecret);
  const [payId, setPayId] = useState(init.payId);
  const [appKey, setAppKeyState] = useState(getAppKey());

  const [showKey, setShowKey] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [showAppKey, setShowAppKey] = useState(false);

  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const save = () => {
    setCreds({ apiKey, apiSecret, payId });
    setAppKey(appKey);
    notifyToast('Pengaturan API & Credentials tersimpan di localStorage!', 'success');
  };

  const clear = () => {
    clearCreds();
    setAppKey('');
    setApiKey('');
    setApiSecret('');
    setPayId('');
    setAppKeyState('');
    setTestResult(null);
    notifyToast('Semua credentials telah dihapus dari localStorage', 'info');
  };

  const testConnection = async () => {
    setTestLoading(true);
    setTestResult(null);
    save(); // simpan terlebih dahulu sebelum tes

    const { ok, data } = await api('/debug/balances', { method: 'POST', body: JSON.stringify({}) });
    setTestLoading(false);

    if (ok) {
      setTestResult({
        success: true,
        message: `Koneksi Berhasil! Akun Binance terhubung. (${data.count || 0} saldo ditemukan)`,
      });
      notifyToast('Koneksi API Binance Berhasil!', 'success');
    } else {
      setTestResult({
        success: false,
        message: `Gagal Terhubung: ${data.error || 'API Key atau Secret salah/kadaluarsa'}` + (data.code ? ` (Code: ${data.code})` : ''),
      });
      notifyToast('Gagal terhubung ke API Binance', 'error');
    }
  };

  return (
    <div className="card">
      <div className="card-title">
        <h2>
          <span className="title-icon"><Settings size={18} /></span>
          <span>Pengaturan Binance Credentials</span>
        </h2>
        <span className="card-subtitle">Tersimpan aman secara lokal di browser kamu (localStorage)</span>
      </div>

      <div className="form-grid three">
        <div className="field">
          <label>
            <span>Binance API Key</span>
            <span className="required-star">*</span>
          </label>
          <div className="input-wrap">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              placeholder="Masukkan Binance API Key"
              onChange={(e) => setApiKey(e.target.value)}
            />
            <button className="icon-btn-eye" type="button" onClick={() => setShowKey(!showKey)}>
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div className="field">
          <label>
            <span>Binance API Secret</span>
            <span className="required-star">*</span>
          </label>
          <div className="input-wrap">
            <input
              type={showSecret ? 'text' : 'password'}
              value={apiSecret}
              placeholder="Masukkan Binance API Secret"
              onChange={(e) => setApiSecret(e.target.value)}
            />
            <button className="icon-btn-eye" type="button" onClick={() => setShowSecret(!showSecret)}>
              {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div className="field">
          <label>Binance Pay ID (9 Digit)</label>
          <input
            type="text"
            value={payId}
            placeholder="Contoh: 123456789"
            onChange={(e) => setPayId(e.target.value)}
          />
        </div>
      </div>

      <div className="form-grid full" style={{ marginTop: 14 }}>
        <div className="field">
          <label>App Key Protection (Opsional - Jika deployment Vercel/Server diproteksi header X-App-Key)</label>
          <div className="input-wrap">
            <input
              type={showAppKey ? 'text' : 'password'}
              value={appKey}
              placeholder="Secret X-App-Key (opsional)"
              onChange={(e) => setAppKeyState(e.target.value)}
            />
            <button className="icon-btn-eye" type="button" onClick={() => setShowAppKey(!showAppKey)}>
              {showAppKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
      </div>

      <div className="btn-row">
        <button className="btn btn-primary" onClick={save}>
          <Save size={16} />
          <span>Simpan Credentials</span>
        </button>
        <button className="btn btn-green" onClick={testConnection} disabled={testLoading || !apiKey || !apiSecret}>
          {testLoading ? <span className="spinner" /> : <ShieldCheck size={16} />}
          <span>Tes Koneksi Binance</span>
        </button>
        <button className="btn btn-danger" onClick={clear}>
          <Trash2 size={16} />
          <span>Hapus</span>
        </button>
      </div>

      {testResult && (
        <div className={`alert ${testResult.success ? 'alert-success' : 'alert-error'}`}>
          {testResult.success ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{testResult.message}</span>
        </div>
      )}
    </div>
  );
}
