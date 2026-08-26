import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { X, Copy, QrCode, ExternalLink } from 'lucide-react';
import { copy } from '../clientApi.js';

export default function QRCodeModal({ title, value, network, onClose }) {
  const [dataUrl, setDataUrl] = useState('');

  useEffect(() => {
    if (!value) return;
    QRCode.toDataURL(value, {
      width: 260,
      margin: 2,
      color: {
        dark: '#181A20',
        light: '#FFFFFF',
      },
    })
      .then((url) => setDataUrl(url))
      .catch((err) => console.error(err));
  }, [value]);

  if (!value) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal qr-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header-bar">
          <div className="modal-header-title">
            <QrCode size={20} className="text-binance-gold" />
            <span>{title || 'QR Code Pembayaran'}</span>
          </div>
          <button className="icon-btn-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="qr-container">
          {dataUrl ? (
            <div className="qr-card">
              <img src={dataUrl} alt="QR Code" className="qr-img" />
              {network && <span className="qr-network-badge">{network}</span>}
            </div>
          ) : (
            <div className="qr-skeleton">Loading QR...</div>
          )}
        </div>

        <div className="qr-value-box">
          <div className="qr-value-text">{value}</div>
          <button className="btn btn-outline btn-sm" onClick={() => copy(value, title || 'Nilai')}>
            <Copy size={14} />
            <span>Salin</span>
          </button>
        </div>

        <p className="qr-hint">Scan QR Code dengan aplikasi Binance atau Web3 Wallet</p>
      </div>
    </div>
  );
}
