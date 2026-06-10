import React, { useState, useEffect } from 'react';

export default function PrivacyPopup() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('bnPrivacyAck')) setOpen(true);
  }, []);

  const accept = () => {
    localStorage.setItem('bnPrivacyAck', '1');
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={accept}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path d="M12 2l8 4v6c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V6l8-4z"
              stroke="#0a0c14" strokeWidth="2" strokeLinejoin="round" />
            <path d="M9 12l2 2 4-4" stroke="#0a0c14" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h3 className="modal-title">Privasi & Keamanan</h3>
        <p className="modal-text">
          Kami <strong>tidak menyimpan</strong> API Key, Secret Key, atau Pay ID kamu
          di server. Sama sekali.
        </p>
        <ul className="modal-list">
          <li>Credentials hanya tersimpan di <strong>browser kamu</strong> (localStorage)</li>
          <li>Saat request, dikirim langsung ke Binance via server kami tanpa disimpan</li>
          <li>Server hanya jadi perantara — pakai sekali, lalu dibuang</li>
          <li>Gunakan API Key <strong>Read-only</strong> untuk keamanan maksimal</li>
        </ul>
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={accept}>Saya mengerti</button>
        </div>
      </div>
    </div>
  );
}
