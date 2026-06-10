import React, { useState } from 'react';
import { api, fmtTime } from '../api.js';

const TYPE_COLOR = {
  PAY: '#8b7cff', DEPOSIT: '#22c55e', WITHDRAW: '#ef4444',
  CONVERT: '#22d3ee', DIVIDEN: '#c084fc',
};

export default function DebugPanel() {
  const [hours, setHours] = useState(24);
  const [coin, setCoin] = useState('');
  const [loading, setLoading] = useState('');
  const [error, setError] = useState('');
  const [content, setContent] = useState(null);

  const run = async (key, fn) => {
    setError('');
    setContent(null);
    setLoading(key);
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading('');
    }
  };

  const fail = (data) =>
    setError((data.error || 'Error') + (data.code ? ` (code: ${data.code})` : ''));

  const debugPay = () => run('pay', async () => {
    const { ok, data } = await api('/debug/pay-history', {
      method: 'POST', body: JSON.stringify({ hours: Number(hours) }),
    });
    if (!ok) return fail(data);
    setContent({ kind: 'pay', ...data });
  });

  const debugPayFull = () => run('payfull', async () => {
    const { ok, data } = await api('/debug/pay-history', {
      method: 'POST', body: JSON.stringify({ full: true, days: 90 }),
    });
    if (!ok) return fail(data);
    setContent({ kind: 'payfull', ...data });
  });

  const debugDeposit = () => run('dep', async () => {
    const { ok, data } = await api('/debug/deposit-history', {
      method: 'POST', body: JSON.stringify({ hours: Number(hours), coin: coin.trim() || undefined }),
    });
    if (!ok) return fail(data);
    setContent({ kind: 'deposit', ...data });
  });

  const debugWithdraw = () => run('wd', async () => {
    const { ok, data } = await api('/debug/withdraw-history', {
      method: 'POST', body: JSON.stringify({ hours: Number(hours), coin: coin.trim() || undefined }),
    });
    if (!ok) return fail(data);
    setContent({ kind: 'withdraw', ...data });
  });

  const debugBalances = () => run('bal', async () => {
    const { ok, data } = await api('/debug/balances', { method: 'POST', body: JSON.stringify({}) });
    if (!ok) return fail(data);
    setContent({ kind: 'balances', ...data });
  });

  const debugOverview = () => run('ov', async () => {
    const { ok, data } = await api('/debug/overview', { method: 'POST', body: JSON.stringify({ days: 30 }) });
    if (!ok) return fail(data);
    setContent({ kind: 'overview', ...data });
  });

  return (
    <div className="card">
      <h2>Debug — Cek Koneksi Binance</h2>
      <div className="form-grid">
        <div className="field">
          <label>Berapa jam ke belakang (max 168)</label>
          <input type="number" value={hours} min="1" max="168"
            onChange={(e) => setHours(e.target.value)} />
        </div>
        <div className="field">
          <label>Filter Coin (opsional, untuk deposit)</label>
          <input type="text" value={coin} placeholder="USDT"
            onChange={(e) => setCoin(e.target.value)} />
        </div>
      </div>
      <div className="btn-row">
        <button className="btn btn-primary" onClick={debugPay} disabled={!!loading}>
          {loading === 'pay' ? <><span className="spinner" />...</> : 'Cek Pay History'}
        </button>
        <button className="btn btn-green" onClick={debugPayFull} disabled={!!loading}>
          {loading === 'payfull' ? <><span className="spinner" />...</> : 'Pay History Full (90 hari)'}
        </button>
        <button className="btn btn-outline" onClick={debugDeposit} disabled={!!loading}>Cek Deposit History</button>
        <button className="btn btn-outline" onClick={debugWithdraw} disabled={!!loading}>Cek Withdraw History</button>
        <button className="btn btn-outline" onClick={debugBalances} disabled={!!loading}>Cek Saldo</button>
        <button className="btn btn-green" onClick={debugOverview} disabled={!!loading}>
          {loading === 'ov' ? <><span className="spinner" />...</> : 'Lihat Semua (Overview)'}
        </button>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      {content && <DebugResult c={content} />}
    </div>
  );
}

function Rows({ items, render, empty }) {
  if (!items || items.length === 0) return <div className="empty-state">{empty}</div>;
  return <div className="invoice-card">{items.map(render)}</div>;
}

function DebugResult({ c }) {
  if (c.kind === 'pay' || c.kind === 'payfull') {
    const span = c.kind === 'payfull' ? `${c.daysBack} hari (${c.apiCalls} API call)` : `${c.hoursBack} jam terakhir`;
    return (
      <>
        <div className="alert alert-success">
          {c.count} transaksi Pay dalam {span}
          {c.truncated && <span style={{ color: '#eab308' }}> (terpotong, ada lebih banyak)</span>}
        </div>
        <Rows items={c.transactions} empty={`Tidak ada transaksi Pay dalam ${span}`}
          render={(t) => {
            const masuk = Number(t.amount) > 0;
            return (
              <div className="mon-row" key={t.transactionId}>
                <div className="mon-left">
                  <span className="type-pill" style={{ background: masuk ? '#22c55e' : '#ef4444' }}>{masuk ? 'MASUK' : 'KELUAR'}</span>
                  <span className="row-time">{fmtTime(t.transactionTime)}</span>
                </div>
                <span className={`mon-right ${masuk ? 'amt-in' : 'amt-out'}`}>{masuk ? '+' : ''}{t.amount} {t.currency}</span>
              </div>
            );
          }} />
      </>
    );
  }
  if (c.kind === 'deposit') {
    return (
      <>
        <div className="alert alert-success">Koneksi OK — {c.count} deposit dalam {c.hoursBack} jam terakhir</div>
        <Rows items={c.deposits} empty={`Tidak ada deposit dalam ${c.hoursBack} jam terakhir`}
          render={(d) => (
            <div className="mon-row" key={d.id}>
              <div className="mon-left">
                <span className="type-pill" style={{ background: '#22c55e' }}>DEPOSIT</span>
                <span className="row-time">{fmtTime(d.insertTime)} &middot; {d.network}</span>
              </div>
              <span className="mon-right amt-in">+{d.amount} {d.coin}</span>
            </div>
          )} />
      </>
    );
  }
  if (c.kind === 'withdraw') {
    return (
      <>
        <div className="alert alert-success">Koneksi OK — {c.count} withdraw dalam {c.hoursBack} jam terakhir</div>
        <Rows items={c.withdrawals} empty={`Tidak ada withdraw dalam ${c.hoursBack} jam terakhir`}
          render={(w) => (
            <div className="mon-row" key={w.id}>
              <div className="mon-left">
                <span className="type-pill" style={{ background: '#ef4444' }}>WITHDRAW</span>
                <span className="row-time">{w.applyTime} &middot; {w.network}</span>
              </div>
              <span className="mon-right amt-out">-{w.amount} {w.coin}</span>
            </div>
          )} />
      </>
    );
  }
  if (c.kind === 'balances') {
    return (
      <>
        <div className="alert alert-success">Koneksi OK — {c.count} aset ({c.accountType || ''})</div>
        <Rows items={c.balances} empty="Tidak ada saldo > 0"
          render={(b) => (
            <div className="mon-row" key={b.asset}>
              <span className="mon-asset">{b.asset}</span>
              <span className="mon-right">{b.free}{parseFloat(b.locked) > 0 ? <span style={{ color: 'var(--muted2)' }}> · locked {b.locked}</span> : ''}</span>
            </div>
          )} />
      </>
    );
  }
  if (c.kind === 'overview') {
    const failed = Object.entries(c.sources || {}).filter(([, v]) => !v).map(([k]) => k);
    const counts = {};
    for (const t of c.timeline) counts[t.type] = (counts[t.type] || 0) + 1;
    return (
      <>
        <div className="alert alert-success">
          Akun {c.accountType || ''} — {c.balances.length} aset, {c.timeline.length} aktivitas ({c.daysBack} hari)
        </div>
        {failed.length > 0 && <div className="alert alert-error">Gagal ambil: {failed.join(', ')}</div>}

        <div className="summary-grid">
          {Object.entries(counts).map(([type, n]) => (
            <div className="summary-tile" key={type}>
              <div className="st-label">{type}</div>
              <div className="st-value" style={{ color: TYPE_COLOR[type] || '#888' }}>{n}</div>
            </div>
          ))}
        </div>

        <div className="mon-section-title">Saldo</div>
        <Rows items={c.balances} empty="Tidak ada saldo"
          render={(b) => (
            <div className="mon-row" key={b.asset}>
              <span className="mon-asset">{b.asset}</span>
              <span className="mon-right">{b.free}{parseFloat(b.locked) > 0 ? <span style={{ color: 'var(--muted2)' }}> · locked {b.locked}</span> : ''}</span>
            </div>
          )} />
        <div className="mon-section-title">Timeline Aktivitas</div>
        <Rows items={c.timeline} empty={`Tidak ada aktivitas dalam ${c.daysBack} hari`}
          render={(t, i) => {
            const out = String(t.amount).trim().startsWith('-');
            return (
              <div className="mon-row" key={i}>
                <div className="mon-left">
                  <span className="type-pill" style={{ background: TYPE_COLOR[t.type] || '#888' }}>{t.type}</span>
                  <span className="row-time">{fmtTime(t.time)}{t.network ? ` \u00b7 ${t.network}` : ''}</span>
                </div>
                <span className={`mon-right ${out ? 'amt-out' : 'amt-in'}`}>{t.amount} {t.asset}</span>
              </div>
            );
          }} />
      </>
    );
  }
  return null;
}
