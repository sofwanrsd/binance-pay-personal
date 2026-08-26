import React, { useState } from 'react';
import { api, copy } from '../clientApi.js';
import QRCodeModal from './QRCodeModal.jsx';
import { CreditCard, QrCode, Copy, CheckCircle, RefreshCw, AlertCircle, ExternalLink, Clock, ShieldAlert } from 'lucide-react';

const AMOUNT_PRESETS = [5, 10, 25, 50, 100];
const CURRENCY_PRESETS = ['USDT', 'BUSD', 'BNB', 'BTC', 'ETH'];

export default function CheckPayment({ onGoToSettings }) {
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

  // QR Modal State
  const [qrModal, setQrModal] = useState({ open: false, title: '', value: '', network: '' });

  const genOptions = async () => {
    setOptErr('');
    setOptions(null);
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      setOptErr('Amount wajib diisi dan harus lebih dari 0');
      return;
    }
    const body = { amount: amt, currency: currency.trim() || 'USDT' };
    if (network.trim()) body.network = network.trim();

    setOptLoading(true);
    const { ok, data } = await api('/payment-options', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    setOptLoading(false);

    if (!ok) {
      setOptErr(data.error || 'Terjadi kesalahan saat membuat instruksi pembayaran');
      return;
    }
    setOptions(data);
    setAmount(String(data.amountToPay));
  };

  const checkPayment = async () => {
    setCheckErr('');
    setCheckResult(null);
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      setCheckErr('Amount wajib diisi');
      return;
    }
    const body = {
      amount: amt,
      currency: currency.trim() || 'USDT',
      sinceMinutes: Number(sinceMinutes) || 60,
    };
    if (network.trim()) body.network = network.trim();

    setCheckLoading(true);
    const { ok, data } = await api('/check-payment', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    setCheckLoading(false);

    if (!ok) {
      setCheckErr(data.error || 'Terjadi kesalahan saat memeriksa pembayaran');
      return;
    }
    setCheckResult(data);
  };

  return (
    <>
      {qrModal.open && (
        <QRCodeModal
          title={qrModal.title}
          value={qrModal.value}
          network={qrModal.network}
          onClose={() => setQrModal({ open: false, title: '', value: '', network: '' })}
        />
      )}

      <div className="card">
        <div className="card-title">
          <h2>
            <span className="title-icon"><CreditCard size={18} /></span>
            <span>Detail &amp; Verifikasi Pembayaran</span>
          </h2>
          <span className="card-subtitle">Generate invoice unik &amp; verifikasi transaksi otomatis</span>
        </div>

        <div className="form-grid">
          <div className="field">
            <label>
              <span>Amount (Jumlah Pembayaran)</span>
              <span className="required-star">*</span>
            </label>
            <input
              type="number"
              value={amount}
              placeholder="Contoh: 10.00"
              step="0.0001"
              min="0.0001"
              onChange={(e) => setAmount(e.target.value)}
            />
            <div className="preset-pills">
              {AMOUNT_PRESETS.map((p) => (
                <button
                  key={p}
                  className={`pill-btn ${parseFloat(amount) === p ? 'active' : ''}`}
                  onClick={() => setAmount(String(p))}
                >
                  ${p}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label>
              <span>Koin / Currency</span>
              <span className="required-star">*</span>
            </label>
            <input
              type="text"
              value={currency}
              placeholder="USDT"
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            />
            <div className="preset-pills">
              {CURRENCY_PRESETS.map((c) => (
                <button
                  key={c}
                  className={`pill-btn ${currency === c ? 'active' : ''}`}
                  onClick={() => setCurrency(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label>Metode / Network Pembayaran</label>
            <select value={network} onChange={(e) => setNetwork(e.target.value)}>
              <option value="">Semua Metode (Binance Pay + On-chain)</option>
              <option value="PAY">Binance Pay (Pay ID / QR)</option>
              <option value="TRC20">On-chain — TRC20 (Tron)</option>
              <option value="BEP20">On-chain — BEP20 (BNB Smart Chain)</option>
            </select>
          </div>

          <div className="field">
            <label>Window Waktu Pengecekan (Menit)</label>
            <input
              type="number"
              value={sinceMinutes}
              min="1"
              max="10080"
              onChange={(e) => setSinceMinutes(e.target.value)}
            />
          </div>
        </div>

        <div className="btn-row">
          <button className="btn btn-outline" onClick={genOptions} disabled={optLoading}>
            {optLoading ? <span className="spinner" /> : <QrCode size={16} />}
            <span>Buat Instruksi Bayar</span>
          </button>
          <button className="btn btn-primary" onClick={checkPayment} disabled={checkLoading}>
            {checkLoading ? <span className="spinner" /> : <RefreshCw size={16} />}
            <span>Cek Pembayaran Masuk</span>
          </button>
        </div>

        {optErr && (
          <div className="alert alert-error">
            <AlertCircle size={18} />
            <span>{optErr}</span>
          </div>
        )}
        {checkErr && (
          <div className="alert alert-error">
            <AlertCircle size={18} />
            <span>{checkErr}</span>
          </div>
        )}

        {options && (
          <div className="payment-instruction-box">
            <div className="payment-header-alert">
              <div>
                <strong>Minta Buyer Bayar Nominal Unik Tepat:</strong>
                <p style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>
                  Toleransi selisih nominal: {options.tolerancePercent || 0}%
                </p>
              </div>
              <div className="payment-header-amount">
                {options.amountToPay} {options.currency}
              </div>
            </div>

            {(Array.isArray(options.paymentOptions) ? options.paymentOptions : []).map((o, i) => (
              <div className="pay-card" key={i}>
                <div className="pay-card-top">
                  <span className="method-tag">
                    {o.method === 'BINANCE_PAY' ? '⚡ BINANCE PAY' : `🌐 ${o.method.replace('_', ' ')} (${o.network})`}
                  </span>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() =>
                      setQrModal({
                        open: true,
                        title: o.method === 'BINANCE_PAY' ? 'QR Code Binance Pay ID' : `QR Code Address (${o.network})`,
                        value: o.method === 'BINANCE_PAY' ? o.payId : o.depositAddress,
                        network: o.network || 'PAY ID',
                      })
                    }
                  >
                    <QrCode size={14} />
                    <span>Tampilkan QR</span>
                  </button>
                </div>

                {o.method === 'BINANCE_PAY' ? (
                  <div className="inv-row">
                    <span className="inv-label">Binance Pay ID</span>
                    <button className="copy-val-btn" onClick={() => copy(o.payId, 'Pay ID')}>
                      <span>{o.payId}</span>
                      <Copy size={13} />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="inv-row">
                      <span className="inv-label">Jaringan / Network</span>
                      <span className="inv-val">{o.network}</span>
                    </div>
                    <div className="inv-row">
                      <span className="inv-label">Deposit Address</span>
                      <button className="copy-val-btn" onClick={() => copy(o.depositAddress, 'Deposit Address')}>
                        <span>{o.depositAddress}</span>
                        <Copy size={13} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {checkResult && (
          checkResult.paid ? (
            <div className="receipt-card">
              <div className="receipt-header">
                <CheckCircle size={24} />
                <span>PEMBAYARAN DITEMUKAN &amp; VERIFIKASI SUKSES</span>
              </div>
              <div className="inv-row">
                <span className="inv-label">Status Verifikasi</span>
                <span className="status-badge badge-paid">PAID / TERBAYAR</span>
              </div>
              <div className="inv-row">
                <span className="inv-label">Metode Pembayaran</span>
                <span className="inv-val">{checkResult.match.method.replace('_', ' ')}</span>
              </div>
              <div className="inv-row">
                <span className="inv-label">Jumlah Diterima</span>
                <span className="inv-val highlight">
                  {checkResult.match.amount} {checkResult.match.currency}
                </span>
              </div>
              {checkResult.match.network && (
                <div className="inv-row">
                  <span className="inv-label">Jaringan (Network)</span>
                  <span className="inv-val">{checkResult.match.network}</span>
                </div>
              )}
              <div className="inv-row">
                <span className="inv-label">Transaction ID</span>
                <button
                  className="copy-val-btn"
                  onClick={() => copy(checkResult.match.transactionId, 'Transaction ID')}
                >
                  <span>{checkResult.match.transactionId}</span>
                  <Copy size={13} />
                </button>
              </div>
              {checkResult.match.txHash && (
                <div className="inv-row">
                  <span className="inv-label">Tx Hash (Blockchain)</span>
                  <button className="copy-val-btn" onClick={() => copy(checkResult.match.txHash, 'Tx Hash')}>
                    <span>{checkResult.match.txHash}</span>
                    <Copy size={13} />
                  </button>
                </div>
              )}
              <div className="inv-row">
                <span className="inv-label">Waktu Transaksi</span>
                <span className="inv-val">
                  {new Date(checkResult.match.transactionTime).toLocaleString('id-ID')}
                </span>
              </div>
            </div>
          ) : (
            <div className="alert alert-info">
              <Clock size={18} />
              <span>
                Belum ada pembayaran cocok dalam {checkResult.criteria.windowMinutes} menit terakhir untuk nominal{' '}
                <strong>{amount} {currency}</strong>.
              </span>
            </div>
          )
        )}
      </div>
    </>
  );
}
