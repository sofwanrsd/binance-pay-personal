import React from 'react';
import { copy, fmtTime } from '../api.js';

function Badge({ status }) {
  const cls = status === 'PAID' ? 'badge-paid'
    : status === 'EXPIRED' ? 'badge-expired' : 'badge-pending';
  return <span className={`status-badge ${cls}`}>{status}</span>;
}

function PayOption({ opt }) {
  return (
    <div className="pay-option">
      <div className="method-label">{opt.method.replace('_', ' ')}</div>
      {opt.method === 'BINANCE_PAY' ? (
        <div className="inv-row">
          <span className="inv-label">Pay ID</span>
          <span className="inv-value copyable" onClick={() => copy(opt.payId)}>{opt.payId}</span>
        </div>
      ) : (
        <>
          <div className="inv-row">
            <span className="inv-label">Network</span>
            <span className="inv-value">{opt.network}</span>
          </div>
          <div className="inv-row">
            <span className="inv-label">Address</span>
            <span className="inv-value copyable" onClick={() => copy(opt.depositAddress)}>{opt.depositAddress}</span>
          </div>
        </>
      )}
      <p className="copy-hint">klik nilai untuk salin</p>
    </div>
  );
}

export default function InvoiceView({ inv }) {
  if (!inv) return null;
  return (
    <div className="invoice-card">
      <div className="inv-row">
        <span className="inv-label">Invoice ID</span>
        <span className="inv-value copyable" onClick={() => copy(inv.id)}>{inv.id}</span>
      </div>
      <div className="inv-row">
        <span className="inv-label">Status</span>
        <Badge status={inv.status} />
      </div>
      <div className="inv-row">
        <span className="inv-label">Bayar Tepat</span>
        <span className="inv-value highlight">{inv.expectedAmount} {inv.currency}</span>
      </div>
      <div className="inv-row">
        <span className="inv-label">Berlaku sampai</span>
        <span className="inv-value">{fmtTime(inv.expiresAt)}</span>
      </div>
      {inv.transactionId && (
        <div className="inv-row">
          <span className="inv-label">Tx ID</span>
          <span className="inv-value copyable" onClick={() => copy(inv.transactionId)}>{inv.transactionId}</span>
        </div>
      )}
      {inv.txHash && (
        <div className="inv-row">
          <span className="inv-label">Tx Hash</span>
          <span className="inv-value copyable" onClick={() => copy(inv.txHash)}>{inv.txHash}</span>
        </div>
      )}
      {(inv.paymentOptions || []).map((o, i) => <PayOption key={i} opt={o} />)}
    </div>
  );
}

export { Badge };
