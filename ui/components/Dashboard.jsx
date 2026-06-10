import React, { useState } from 'react';
import Credentials from './Credentials.jsx';
import CheckPayment from './CheckPayment.jsx';
import DebugPanel from './DebugPanel.jsx';

const TABS = [
  { id: 'payment', label: 'Cek Pembayaran' },
  { id: 'monitor', label: 'Monitor Akun' },
  { id: 'account', label: 'Pengaturan' },
];

export default function Dashboard() {
  const [tab, setTab] = useState('payment');

  return (
    <div className="container">
      <div className="hero">
        <div>
          <div className="hero-title">Binance Payment Checker</div>
          <div className="hero-sub">
            API stateless untuk cek pembayaran masuk &amp; monitor akun Binance. Server tidak menyimpan apa pun.
          </div>
        </div>
        <div className="hero-icon">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <path d="M3 9h18M7 3v4m10-4v4M5 7h14a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9a2 2 0 012-2z"
              stroke="#0a0c14" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <div key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </div>
        ))}
      </div>

      {tab === 'payment' && <CheckPayment />}
      {tab === 'monitor' && <DebugPanel />}
      {tab === 'account' && <Credentials />}
    </div>
  );
}
