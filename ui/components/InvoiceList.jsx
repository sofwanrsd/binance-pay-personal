import React, { useState } from 'react';
import { Badge } from './InvoiceView.jsx';

export default function InvoiceList({ invoices, onRefresh, onSelect }) {
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    await onRefresh();
    setLoading(false);
  };

  return (
    <div className="card">
      <div className="list-header">
        <h2>Semua Invoice</h2>
        <button className="btn btn-outline" onClick={refresh} disabled={loading}>
          {loading ? <><span className="spinner" />...</> : 'Refresh'}
        </button>
      </div>
      {!invoices || invoices.length === 0 ? (
        <div className="empty-state">Belum ada invoice</div>
      ) : (
        invoices.map((inv) => (
          <div key={inv.id} className="inv-list-item" onClick={() => onSelect(inv.id)}>
            <div className="inv-list-left">
              <div className="inv-list-id">{inv.id}</div>
              <div className="inv-list-amount">{inv.expectedAmount} {inv.currency}</div>
            </div>
            <Badge status={inv.status} />
          </div>
        ))
      )}
    </div>
  );
}
