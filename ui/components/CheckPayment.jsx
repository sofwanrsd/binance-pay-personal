import React, { useState } from 'react';
import { api, copy } from '../api.js';

export default function CheckPayment() {
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USDT');
  const [network, setNetwork] = useState('');
  const [sinceMinutes, setSinceMinutes] = useState(60);

  const [options, setOptions] = useState(null);
  const [optErr, setOptErr] = useState('');
  const [optLoading, setOptLoading] = useState(false);

  const [checkResult, setCheckResult] = useState(null);
  const [checkErr, setCheckErr] = useState('');
  const [checkLoading, setCheckLoading] = useState(false);

  const genOptions = async () => {
    setOptErr('');
    setOptions(null);
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setOptErr('Amount wajib diisi dan harus > 0'); return; }
    const body = { amount: amt, currency: currency.trim() || 'USDT' };
    if (network.trim()) body.network = network.trim();
    setOptLoading(true);
    const { ok, data } = await api('/payment-options', { method: 'POST', body: JSON.stringify(body) });
    setOptLoading(false);
    if (!ok) { setOptErr(data.error || 'Error'); return; }
    setOptions(data);
    // sinkronkan amount ke nominal unik yang disarankan untuk pengecekan
    setAmount(String(data.amountToPay));
  };

  const checkPayment = async () => {
    setCheckErr('');
    setCheckResult(null);
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setCheckErr('Amount wajib diisi'); return; }
    const body = { amount: amt, currency: currency.trim() || 'USDT', sinceMinutes: Number(sinceMinutes) || 60 };
    if (network.trim()) body.network = network.trim();
    setCheckLoading(true);
    const { ok, data } = await api('/check-payment', { method: 'POST', body: JSON.stringify(body) });
    setCheckLoading(false);
    if (!ok) { setCheckErr(data.error || 'Error'); return; }
    setCheckResult(data);
  };

  return (
    <>
      <div className="card">
        <h2>Detail Pembayaran</h2>
        <div className="form-grid">
          <div className="field">
            <label>Amount</label>
            <input type="number" value={amount} placeholder="5.00" step="0.0001" min="0.0001"
              onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="field">
            <label>Currency</label>
            <input type="text" value={currency} onChange={(e) => setCurrency(e.target.value)} />
          </div>
          <div className="field">
            <label>Metode / Network</label>
            <select value={network} onChange={(e) => setNetwork(e.target.value)}>
              <option value="">Semua metode</option>
              <option value="PAY">Binance Pay (Pay ID)</option>
              <option value="TRC20">On-chain — TRC20 (Tron)</option>
              <option value="BEP20">On-chain — BEP20 (BSC)</option>
            </select>
          </div>
          <div className="field">
            <label>Window cek (menit)</label>
            <input type="number" value={sinceMinutes} min="1" max="10080"
              onChange={(e) => setSinceMinutes(e.target.value)} />
          </div>
        </div>
        <div className="btn-row">
          <button className="btn btn-outline" onClick={genOptions} disabled={optLoading}>
            {optLoading ? <><span className="spinner" />...</> : 'Buat Instruksi Bayar'}
          </button>
          <button className="btn btn-primary" onClick={checkPayment} disabled={checkLoading}>
            {checkLoading ? <><span className="spinner" />Mengecek...</> : 'Cek Pembayaran'}
          </button>
        </div>
        {optErr && <div className="alert alert-error">{optErr}</div>}
        {checkErr && <div className="alert alert-error">{checkErr}</div>}

        {options && (
          <>
            <div className="alert alert-info">
              Minta buyer bayar TEPAT <strong>{options.amountToPay} {options.currency}</strong> (toleransi {options.tolerancePercent}%)
            </div>
            {(Array.isArray(options.paymentOptions) ? options.paymentOptions : []).map((o, i) => (
              <div className="pay-option" key={i}>
                <div className="method-label">{o.method.replace('_', ' ')}</div>
                {o.method === 'BINANCE_PAY' ? (
                  <div className="inv-row">
                    <span className="inv-label">Pay ID</span>
                    <span className="inv-value copyable" onClick={() => copy(o.payId)}>{o.payId}</span>
                  </div>
                ) : (
                  <>
                    <div className="inv-row">
                      <span className="inv-label">Network</span>
                      <span className="inv-value">{o.network}</span>
                    </div>
                    <div className="inv-row">
                      <span className="inv-label">Address</span>
                      <span className="inv-value copyable" onClick={() => copy(o.depositAddress)}>{o.depositAddress}</span>
                    </div>
                  </>
                )}
                <p className="copy-hint">klik nilai untuk salin</p>
              </div>
            ))}
          </>
        )}

        {checkResult && (
          checkResult.paid ? (
            <>
              <div className="alert alert-success">Pembayaran DITEMUKAN</div>
              <div className="invoice-card">
                <div className="inv-row"><span className="inv-label">Metode</span><span className="inv-value">{checkResult.match.method.replace('_', ' ')}</span></div>
                <div className="inv-row"><span className="inv-label">Jumlah</span><span className="inv-value highlight">{checkResult.match.amount} {checkResult.match.currency}</span></div>
                {checkResult.match.network && <div className="inv-row"><span className="inv-label">Network</span><span className="inv-value">{checkResult.match.network}</span></div>}
                <div className="inv-row"><span className="inv-label">Tx ID</span><span className="inv-value copyable" onClick={() => copy(checkResult.match.transactionId)}>{checkResult.match.transactionId}</span></div>
                {checkResult.match.txHash && <div className="inv-row"><span className="inv-label">Tx Hash</span><span className="inv-value copyable" onClick={() => copy(checkResult.match.txHash)}>{checkResult.match.txHash}</span></div>}
                <div className="inv-row"><span className="inv-label">Waktu</span><span className="inv-value">{new Date(checkResult.match.transactionTime).toLocaleString('id-ID')}</span></div>
              </div>
            </>
          ) : (
            <div className="alert alert-info">
              Belum ada pembayaran cocok dalam {checkResult.criteria.windowMinutes} menit terakhir.
            </div>
          )
        )}
      </div>
    </>
  );
}
