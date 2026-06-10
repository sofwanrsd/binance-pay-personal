import React, { useState } from 'react';
import Credentials from './components/Credentials.jsx';
import CreateInvoice from './components/CreateInvoice.jsx';
import CheckInvoice from './components/CheckInvoice.jsx';
import InvoiceList from './components/InvoiceList.jsx';
import DebugPanel from './components/DebugPanel.jsx';

export default function App() {
  // dipakai untuk trigger refresh list dari komponen lain
  const [refreshKey, setRefreshKey] = useState(0);
  const [checkId, setCheckId] = useState('');

  const refreshList = () => setRefreshKey((k) => k + 1);

  return (
    <>
      <div className="topbar">
        <div className="topbar-left">
          <span className="logo-badge">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                stroke="#0a0c14" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <h1>Binance Pay Gateway</h1>
        </div>
        <a className="nav" href="/docs">API Docs</a>
      </div>

      <div className="container">
        <Credentials />
        <CreateInvoice onCreated={refreshList} setCheckId={setCheckId} />
        <CheckInvoice checkId={checkId} setCheckId={setCheckId} onChange={refreshList} />
        <InvoiceList refreshKey={refreshKey} onSelect={setCheckId} />
        <DebugPanel />
      </div>
    </>
  );
}
