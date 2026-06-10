import React from 'react';

export default function StatsBar({ invoices }) {
  const total = invoices.length;
  const pending = invoices.filter((i) => i.status === 'PENDING').length;
  const paid = invoices.filter((i) => i.status === 'PAID').length;
  const paidSum = invoices
    .filter((i) => i.status === 'PAID')
    .reduce((s, i) => s + (Number(i.paidAmount) || Number(i.expectedAmount) || 0), 0);

  const cards = [
    { label: 'Total Invoice', value: total, accent: 'var(--accent)' },
    { label: 'Pending', value: pending, accent: '#eab308' },
    { label: 'Paid', value: paid, accent: '#22c55e' },
    { label: 'Total Diterima', value: paidSum ? paidSum.toFixed(2) : '0', accent: 'var(--accent2)', suffix: 'USDT' },
  ];

  return (
    <div className="stats-grid">
      {cards.map((c) => (
        <div className="stat-card" key={c.label}>
          <div className="stat-label">{c.label}</div>
          <div className="stat-value" style={{ color: c.accent }}>
            {c.value}{c.suffix && <span className="stat-suffix"> {c.suffix}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
