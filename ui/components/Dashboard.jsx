import React, { useState } from 'react';
import Credentials from './Credentials.jsx';
import CheckPayment from './CheckPayment.jsx';
import DebugPanel from './DebugPanel.jsx';
import { CreditCard, Activity, Settings, ShieldCheck, Zap, QrCode, Cpu, CheckCircle2 } from 'lucide-react';
import { getCreds } from '../clientApi.js';

const TABS = [
  { id: 'payment', label: 'Cek Pembayaran', icon: CreditCard },
  { id: 'monitor', label: 'Monitor Akun', icon: Activity },
  { id: 'account', label: 'Pengaturan API', icon: Settings },
];

export default function Dashboard({ nav }) {
  const [tab, setTab] = useState('payment');
  const creds = getCreds();
  const hasCreds = Boolean(creds.apiKey && creds.apiSecret);

  return (
    <div className="container">
      <div className="hero-card">
        <div className="hero-top">
          <div className="hero-title-group">
            <div className="hero-icon-circle">
              <Zap size={22} className="text-binance-gold" />
            </div>
            <div>
              <div className="hero-title-row">
                <h2>Binance Payment Engine</h2>
                <span className="hero-tag-pill">Stateless API</span>
              </div>
              <p className="hero-desc">
                API gateway personal untuk pengecekan otomatis transaksi Binance Pay &amp; On-Chain Deposit.
                Seluruh data diproses secara real-time langsung ke Binance tanpa penyimpanan database.
              </p>
            </div>
          </div>
        </div>

        <div className="hero-grid-stats">
          <div className="hero-stat-box">
            <div className="hero-stat-header">
              <ShieldCheck size={16} className="text-binance-green" />
              <span>KEAMANAN</span>
            </div>
            <div className="hero-stat-val text-binance-green">
              <CheckCircle2 size={13} />
              <span>Read-Only</span>
            </div>
          </div>

          <div className="hero-stat-box">
            <div className="hero-stat-header">
              <QrCode size={16} className="text-binance-gold" />
              <span>BINANCE PAY ID</span>
            </div>
            <div className="hero-stat-val font-mono text-binance-gold">
              {creds.payId ? creds.payId : 'Belum Diset'}
            </div>
          </div>

          <div className="hero-stat-box">
            <div className="hero-stat-header">
              <Cpu size={16} style={{ color: 'var(--binance-blue)' }} />
              <span>MODE SERVER</span>
            </div>
            <div className="hero-stat-val" style={{ color: 'var(--binance-blue)' }}>
              100% Stateless
            </div>
          </div>
        </div>
      </div>

      <div className="tabs-header">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              className={`tab-btn ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              <Icon size={17} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {tab === 'payment' && <CheckPayment onGoToSettings={() => setTab('account')} />}
      {tab === 'monitor' && <DebugPanel />}
      {tab === 'account' && <Credentials />}
    </div>
  );
}
