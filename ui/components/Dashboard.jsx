import React, { useState } from 'react';
import Credentials from './Credentials.jsx';
import CreateInvoice from './CreateInvoice.jsx';
import CheckInvoice from './CheckInvoice.jsx';
import InvoiceList from './InvoiceList.jsx';
import DebugPanel from './DebugPanel.jsx';

export default function Dashboard() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [checkId, setCheckId] = useState('');
  const refreshList = () => setRefreshKey((k) => k + 1);

  return (
    <div className="container">
      <Credentials />
      <CreateInvoice onCreated={refreshList} setCheckId={setCheckId} />
      <CheckInvoice checkId={checkId} setCheckId={setCheckId} onChange={refreshList} />
      <InvoiceList refreshKey={refreshKey} onSelect={setCheckId} />
      <DebugPanel />
    </div>
  );
}
