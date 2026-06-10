import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api.js';
import Credentials from './Credentials.jsx';
import CreateInvoice from './CreateInvoice.jsx';
import CheckInvoice from './CheckInvoice.jsx';
import InvoiceList from './InvoiceList.jsx';
import DebugPanel from './DebugPanel.jsx';
import StatsBar from './StatsBar.jsx';

const TABS = [
  { id: 'invoice', label: 'Invoice' },
  { id: 'monitor', label: 'Monitor Akun' },
  { id: 'account', label: 'Pengaturan' },
];

export default function Dashboard() {
  const [tab, setTab] = useState('invoice');
  const [checkId, setCheckId] = useState('');
  const [invoices, setInvoices] = useState([]);

  const loadInvoices = useCallback(async () => {
    const { ok, data } = await api('/invoices');
    if (ok && Array.isArray(data)) {
      setInvoices([...data].sort((a, b) => b.createdAt - a.createdAt));
    }
  }, []);

  useEffect(() => { loadInvoices(); }, [loadInvoices]);

  const pendingCount = invoices.filter((i) => i.status === 'PENDING').length;

  return (
    <div className="container">
      <div className="hero">
        <div>
          <div className="hero-title">Selamat datang</div>
          <div className="hero-sub">
            Kelola invoice, monitor pembayaran, dan cek aktivitas akun Binance kamu dalam satu tempat.
          </div>
        </div>
        <div className="hero-icon">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <path d="M3 9h18M7 3v4m10-4v4M5 7h14a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9a2 2 0 012-2z"
              stroke="#0a0c14" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      <StatsBar invoices={invoices} />

      <div className="tabs">
        {TABS.map((t) => (
          <div key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
            {t.id === 'invoice' && pendingCount > 0 && <span className="tab-count">{pendingCount}</span>}
          </div>
        ))}
      </div>

      {tab === 'invoice' && (
        <>
          <CreateInvoice onCreated={loadInvoices} setCheckId={setCheckId} />
          <CheckInvoice checkId={checkId} setCheckId={setCheckId} onChange={loadInvoices} />
          <InvoiceList invoices={invoices} onRefresh={loadInvoices} onSelect={setCheckId} />
        </>
      )}

      {tab === 'monitor' && <DebugPanel />}

      {tab === 'account' && <Credentials />}
    </div>
  );
}
