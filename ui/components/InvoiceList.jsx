import React, { useState, useEffect } from 'react';
import { api } from '../api.js';
import { Badge } from './InvoiceView.jsx';

export default function InvoiceList({ refreshKey, onSelect }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = async () => {
    setLoading(true);
    const { ok, data } = await api('/invoices');
    setLoading(false);
    setLoaded(true);
    if (ok && Array.isArray(data)) {
      setList([...data].sort((a, b) => b.createdAt - a.createdAt));
    } else {
      setList([]);
    }
  };

  useEffect(() => { if (refreshKey > 0) load(); }, [refreshKey]);

  return (
    <div className="card">
      <div className="list-header">
        <h2>Semua Invoice</h2>
        <button className="btn btn-outline" onClick={load} disabled={loading}>
          {loading ? <><span className="spinner" />...</> : 'Refresh'}
        </button>
      </div>
      {!loaded ? (
        <div className="empty-state">Klik Refresh untuk memuat</div>
      ) : list.length === 0 ? (
        <div className="empty-state">Belum ada invoice</div>
      ) : (
        list.map((inv) => (
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
