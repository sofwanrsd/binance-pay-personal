import React, { useState } from 'react';
import { api } from '../api.js';
import InvoiceView from './InvoiceView.jsx';

export default function CreateInvoice({ onCreated, setCheckId }) {
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USDT');
  const [network, setNetwork] = useState('');
  const [productId, setProductId] = useState('');
  const [buyer, setBuyer] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    setResult(null);
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      setError('Amount wajib diisi dan harus > 0');
      return;
    }
    const body = { amount: amt, currency: currency.trim() || 'USDT' };
    if (network.trim()) body.network = network.trim();
    if (productId.trim()) body.productId = productId.trim();
    if (buyer.trim()) body.buyer = buyer.trim();

    setLoading(true);
    const { ok, data } = await api('/invoices', { method: 'POST', body: JSON.stringify(body) });
    setLoading(false);

    if (!ok) {
      setError(data.error || 'Error');
      return;
    }
    setCheckId(data.invoiceId);
    setResult({
      id: data.invoiceId,
      status: data.status,
      currency: data.currency,
      expectedAmount: data.amountToPay,
      expiresAt: data.expiresAt,
      paymentOptions: data.paymentOptions,
    });
    onCreated && onCreated();
  };

  return (
    <div className="card">
      <h2>Buat Invoice</h2>
      <div className="form-grid">
        <div className="field">
          <label>Amount</label>
          <input type="number" value={amount} placeholder="5.00" step="0.01" min="0.01"
            onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="field">
          <label>Currency</label>
          <input type="text" value={currency} onChange={(e) => setCurrency(e.target.value)} />
        </div>
        <div className="field">
          <label>Network (opsional)</label>
          <input type="text" value={network} placeholder="TRC20 / BEP20 / PAY"
            onChange={(e) => setNetwork(e.target.value)} />
        </div>
        <div className="field">
          <label>Product ID (opsional)</label>
          <input type="text" value={productId} placeholder="PROD-001"
            onChange={(e) => setProductId(e.target.value)} />
        </div>
        <div className="field">
          <label>Buyer (opsional)</label>
          <input type="text" value={buyer} placeholder="username"
            onChange={(e) => setBuyer(e.target.value)} />
        </div>
      </div>
      <div className="btn-row">
        <button className="btn btn-primary" onClick={submit} disabled={loading}>
          {loading ? <><span className="spinner" />Membuat...</> : 'Buat Invoice'}
        </button>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      {result && <><div className="alert alert-success">Invoice berhasil dibuat!</div><InvoiceView inv={result} /></>}
    </div>
  );
}
