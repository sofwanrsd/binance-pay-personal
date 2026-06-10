import React, { useState } from 'react';
import { getCreds, setCreds, clearCreds } from '../api.js';

export default function Credentials() {
  const init = getCreds();
  const [apiKey, setApiKey] = useState(init.apiKey);
  const [apiSecret, setApiSecret] = useState(init.apiSecret);
  const [payId, setPayId] = useState(init.payId);
  const [saved, setSaved] = useState(false);

  const save = () => {
    setCreds({ apiKey, apiSecret, payId });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const clear = () => {
    clearCreds();
    setApiKey('');
    setApiSecret('');
    setPayId('');
  };

  return (
    <div className="card">
      <h2>Credentials</h2>
      <div className="form-grid three">
        <div className="field">
          <label>API Key</label>
          <input type="password" value={apiKey} placeholder="Binance API Key"
            onChange={(e) => setApiKey(e.target.value)} />
        </div>
        <div className="field">
          <label>API Secret</label>
          <input type="password" value={apiSecret} placeholder="Binance API Secret"
            onChange={(e) => setApiSecret(e.target.value)} />
        </div>
        <div className="field">
          <label>Pay ID</label>
          <input type="text" value={payId} placeholder="123456789"
            onChange={(e) => setPayId(e.target.value)} />
        </div>
      </div>
      <div className="btn-row">
        <button className="btn btn-primary" onClick={save}>Simpan</button>
        <button className="btn btn-outline" onClick={clear}>Hapus</button>
        {saved && <span className="saved-msg">Tersimpan di localStorage</span>}
      </div>
    </div>
  );
}
