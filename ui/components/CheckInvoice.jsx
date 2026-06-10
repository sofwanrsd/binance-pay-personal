import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api.js';
import InvoiceView from './InvoiceView.jsx';

export default function CheckInvoice({ checkId, setCheckId, onChange }) {
  const [txId, setTxId] = useState('');
  const [loading, setLoading] = useState(false);
  const [inv, setInv] = useState(null);
  const [error, setError] = useState('');
  const [polling, setPolling] = useState(false);
  const pollRef = useRef(null);

  // bersihkan poller saat unmount
  useEffect(() => () => clearInterval(pollRef.current), []);

  const stopPoll = () => {
    clearInterval(pollRef.current);
    pollRef.current = null;
    setPolling(false);
  };

  const check = async () => {
    const id = (checkId || '').trim();
    if (!id) return;
    setError('');
    setLoading(true);
    const { ok, data } = await api(`/invoices/${id}/check`, { method: 'POST' });
    setLoading(false);
    if (!ok) { setError(data.error || 'Error'); return; }
    setInv(data.invoice || data);

    if (data.status === 'PENDING') {
      stopPoll();
      setPolling(true);
      pollRef.current = setInterval(async () => {
        const r = await api(`/invoices/${id}/check`, { method: 'POST' });
        if (!r.ok) return;
        setInv(r.data.invoice || r.data);
        if (r.data.status !== 'PENDING') { stopPoll(); onChange && onChange(); }
      }, 15000);
    } else {
      stopPoll();
      onChange && onChange();
    }
  };

  const claim = async () => {
    const id = (checkId || '').trim();
    const t = txId.trim();
    if (!id || !t) { setError('Isi Invoice ID dan Transaction ID'); return; }
    setError('');
    setLoading(true);
    const { ok, data } = await api(`/invoices/${id}/claim`, {
      method: 'POST', body: JSON.stringify({ transactionId: t }),
    });
    setLoading(false);
    if (!ok) { setError(data.error || 'Error'); return; }
    stopPoll();
    setInv(data.invoice || data);
    onChange && onChange();
  };

  return (
    <div className="card">
      <h2>Cek / Klaim Invoice</h2>
      <div className="form-grid">
        <div className="field">
          <label>Invoice ID</label>
          <input type="text" value={checkId} placeholder="INV..."
            onChange={(e) => setCheckId(e.target.value)} />
        </div>
        <div className="field">
          <label>Transaction ID (untuk klaim Pay)</label>
          <input type="text" value={txId} placeholder="320..."
            onChange={(e) => setTxId(e.target.value)} />
        </div>
      </div>
      <div className="btn-row">
        <button className="btn btn-primary" onClick={check} disabled={loading}>
          {loading ? <><span className="spinner" />Cek...</> : 'Cek Status'}
        </button>
        <button className="btn btn-green" onClick={claim} disabled={loading}>Klaim via TxId</button>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      {inv && <InvoiceView inv={inv} />}
      {polling && <div className="alert alert-info"><span className="spinner" />Auto-cek tiap 15 detik...</div>}
    </div>
  );
}
