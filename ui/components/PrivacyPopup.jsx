import React, { useState, useEffect } from 'react';
import { ShieldCheck, Check, Lock } from 'lucide-react';

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
          <ShieldCheck size={30} />
        </div>
        <h3 className="modal-title">Privasi &amp; Keamanan Data</h3>
        <p className="modal-text">
          Aplikasi ini <strong style={{ color: 'var(--text-primary)' }}>stateless</strong> dan <strong>TIDAK menyimpan</strong> API Key, Secret Key, atau Pay ID Anda di server database.
        </p>

        <ul className="modal-list">
          <li>Credentials hanya tersimpan secara lokal di <strong>browser Anda</strong> (localStorage).</li>
          <li>Setiap request dikirim langsung ke Binance secara aman melalui perantara proxy HTTPS.</li>
          <li>Server tidak mencatat atau menyimpan log credentials pengguna.</li>
          <li>Selalu gunakan Binance API Key <strong>Read-only</strong> demi keamanan maksimal.</li>
        </ul>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
          <button className="btn btn-primary" onClick={accept}>
            <Check size={16} />
            <span>Saya Mengerti &amp; Lanjutkan</span>
          </button>
        </div>
      </div>
    </div>
  );
}
