import React, { useState } from 'react';
import { api, fmtTime } from '../clientApi.js';
import { Activity, RefreshCw, Wallet, ArrowDownCircle, ArrowUpCircle, History, Clock, PieChart, Layers } from 'lucide-react';

const TYPE_COLOR = {
  PAY: 'var(--binance-yellow)',
  DEPOSIT: 'var(--binance-green)',
  WITHDRAW: 'var(--binance-red)',
  CONVERT: 'var(--binance-blue)',
  DIVIDEN: 'var(--binance-purple)',
};

export default function DebugPanel() {
  const [hours, setHours] = useState(24);
  const [coin, setCoin] = useState('');
  const [loading, setLoading] = useState('');
  const [error, setError] = useState('');
  const [content, setContent] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

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

  const debugPay = () =>
    run('pay', async () => {
      const { ok, data } = await api('/debug/pay-history', {
        method: 'POST',
        body: JSON.stringify({ hours: Number(hours) }),
      });
      if (!ok) return fail(data);
      setContent({ kind: 'pay', ...data });
    });

  const debugPayFull = () =>
    run('payfull', async () => {
      const { ok, data } = await api('/debug/pay-history', {
        method: 'POST',
        body: JSON.stringify({ full: true, days: 90 }),
      });
      if (!ok) return fail(data);
      setContent({ kind: 'payfull', ...data });
    });

  const debugDeposit = () =>
    run('dep', async () => {
      const { ok, data } = await api('/debug/deposit-history', {
        method: 'POST',
        body: JSON.stringify({ hours: Number(hours), coin: coin.trim() || undefined }),
      });
      if (!ok) return fail(data);
      setContent({ kind: 'deposit', ...data });
    });

  const debugWithdraw = () =>
    run('wd', async () => {
      const { ok, data } = await api('/debug/withdraw-history', {
        method: 'POST',
        body: JSON.stringify({ hours: Number(hours), coin: coin.trim() || undefined }),
      });
      if (!ok) return fail(data);
      setContent({ kind: 'withdraw', ...data });
    });

  const debugBalances = () =>
    run('bal', async () => {
      const { ok, data } = await api('/debug/balances', { method: 'POST', body: JSON.stringify({}) });
      if (!ok) return fail(data);
      setContent({ kind: 'balances', ...data });
    });

  const debugOverview = () =>
    run('ov', async () => {
      const { ok, data } = await api('/debug/overview', {
        method: 'POST',
        body: JSON.stringify({ days: 30 }),
      });
      if (!ok) return fail(data);
      setContent({ kind: 'overview', ...data });
    });

  return (
    <div className="card">
      <div className="card-title">
        <h2>
          <span className="title-icon"><Activity size={18} /></span>
          <span>Monitor &amp; History Akun Binance</span>
        </h2>
        <span className="card-subtitle">Inspeksi saldo, histori transaksi Binance Pay, Deposit &amp; Withdraw</span>
      </div>

      <div className="form-grid">
        <div className="field">
          <label>Window Waktu Monitoring (Jam, max 168)</label>
          <input
            type="number"
            value={hours}
            min="1"
            max="168"
            onChange={(e) => setHours(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Filter Koin (Opsional, contoh: USDT, BTC)</label>
          <input
            type="text"
            value={coin}
            placeholder="USDT"
            onChange={(e) => setCoin(e.target.value.toUpperCase())}
          />
        </div>
      </div>

      {/* Row 1: 4 Equal Balanced Buttons */}
      <div className="btn-row four-cols" style={{ marginTop: 20 }}>
        <button className="btn btn-primary" onClick={debugPay} disabled={!!loading}>
          {loading === 'pay' ? <span className="spinner" /> : <History size={16} />}
          <span>Pay History ({hours}h)</span>
        </button>

        <button className="btn btn-green" onClick={debugPayFull} disabled={!!loading}>
          {loading === 'payfull' ? <span className="spinner" /> : <Clock size={16} />}
          <span>Pay History Full (90d)</span>
        </button>

        <button className="btn btn-outline" onClick={debugDeposit} disabled={!!loading}>
          {loading === 'dep' ? <span className="spinner" /> : <ArrowDownCircle size={16} className="text-binance-green" />}
          <span>Deposit History</span>
        </button>

        <button className="btn btn-outline" onClick={debugWithdraw} disabled={!!loading}>
          {loading === 'wd' ? <span className="spinner" /> : <ArrowUpCircle size={16} className="text-binance-red" />}
          <span>Withdraw History</span>
        </button>
      </div>

      {/* Row 2: 2 Equal Balanced Buttons */}
      <div className="btn-row two-cols" style={{ marginTop: 12 }}>
        <button className="btn btn-outline" onClick={debugBalances} disabled={!!loading}>
          {loading === 'bal' ? <span className="spinner" /> : <Wallet size={16} className="text-binance-gold" />}
          <span>Cek Saldo Wallet SPOT</span>
        </button>

        <button className="btn btn-green" onClick={debugOverview} disabled={!!loading}>
          {loading === 'ov' ? <span className="spinner" /> : <Layers size={16} />}
          <span>Overview Lengkap (30 Hari)</span>
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {content && (
        <DebugResult
          c={content}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
        />
      )}
    </div>
  );
}

function DebugResult({ c, searchTerm, setSearchTerm }) {
  if (c.kind === 'pay' || c.kind === 'payfull') {
    const span = c.kind === 'payfull' ? `${c.daysBack} hari (${c.apiCalls} API call)` : `${c.hoursBack} jam terakhir`;
    const filtered = (c.transactions || []).filter((t) => {
      const query = searchTerm.toLowerCase();
      return (
        !query ||
        t.currency?.toLowerCase().includes(query) ||
        t.amount?.toString().includes(query) ||
        t.transactionId?.toLowerCase().includes(query)
      );
    });

    return (
      <div style={{ marginTop: 24 }}>
        <div className="alert alert-success">
          Ditemukan {c.count} transaksi Binance Pay dalam {span}
        </div>

        <div className="mon-section-header">
          <div className="mon-section-title">Timeline Binance Pay</div>
          <div className="input-wrap" style={{ width: 220 }}>
            <input
              type="text"
              placeholder="Cari transaksi..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ padding: '8px 12px', fontSize: 12.5 }}
            />
          </div>
        </div>

        <div className="mon-list">
          {filtered.length === 0 ? (
            <div className="empty-state">Tidak ada transaksi ditemukan</div>
          ) : (
            filtered.map((t) => {
              const masuk = Number(t.amount) > 0;
              return (
                <div className="mon-row" key={t.transactionId}>
                  <div className="mon-left">
                    <span
                      className="mon-type-pill"
                      style={{ background: masuk ? 'var(--binance-green)' : 'var(--binance-red)' }}
                    >
                      {masuk ? 'PAY MASUK' : 'PAY KELUAR'}
                    </span>
                    <span className="row-time">{fmtTime(t.transactionTime)} &middot; ID: {t.transactionId}</span>
                  </div>
                  <span className={`mon-right ${masuk ? 'amt-in' : 'amt-out'}`}>
                    {masuk ? '+' : ''}{t.amount} {t.currency}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  if (c.kind === 'deposit') {
    return (
      <div style={{ marginTop: 24 }}>
        <div className="alert alert-success">
          Koneksi OK — {c.count} deposit ditemukan ({c.hoursBack} jam terakhir)
        </div>
        <div className="mon-list" style={{ marginTop: 14 }}>
          {(c.deposits || []).length === 0 ? (
            <div className="empty-state">Tidak ada deposit ditemukan</div>
          ) : (
            c.deposits.map((d) => (
              <div className="mon-row" key={d.id}>
                <div className="mon-left">
                  <span className="mon-type-pill" style={{ background: 'var(--binance-green)' }}>
                    DEPOSIT
                  </span>
                  <span className="row-time">{fmtTime(d.insertTime)} &middot; Network: {d.network}</span>
                </div>
                <span className="mon-right amt-in">+{d.amount} {d.coin}</span>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  if (c.kind === 'withdraw') {
    return (
      <div style={{ marginTop: 24 }}>
        <div className="alert alert-success">
          Koneksi OK — {c.count} withdraw ditemukan ({c.hoursBack} jam terakhir)
        </div>
        <div className="mon-list" style={{ marginTop: 14 }}>
          {(c.withdrawals || []).length === 0 ? (
            <div className="empty-state">Tidak ada withdraw ditemukan</div>
          ) : (
            c.withdrawals.map((w) => (
              <div className="mon-row" key={w.id}>
                <div className="mon-left">
                  <span className="mon-type-pill" style={{ background: 'var(--binance-red)' }}>
                    WITHDRAW
                  </span>
                  <span className="row-time">{w.applyTime} &middot; Network: {w.network}</span>
                </div>
                <span className="mon-right amt-out">-{w.amount} {w.coin}</span>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  if (c.kind === 'balances') {
    return (
      <div style={{ marginTop: 24 }}>
        <div className="alert alert-success">
          Koneksi OK — Total {c.count} aset aktif ({c.accountType || 'SPOT'})
        </div>
        <div className="mon-list" style={{ marginTop: 14 }}>
          {(c.balances || []).length === 0 ? (
            <div className="empty-state">Saldo wallet kosong</div>
          ) : (
            c.balances.map((b) => (
              <div className="mon-row" key={b.asset}>
                <span className="mon-left" style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {b.asset}
                </span>
                <span className="mon-right">
                  {b.free}
                  {parseFloat(b.locked) > 0 && (
                    <span style={{ color: 'var(--text-muted)', fontSize: 12, marginLeft: 8 }}>
                      (Locked: {b.locked})
                    </span>
                  )}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  if (c.kind === 'overview') {
    const failed = Object.entries(c.sources || {}).filter(([, v]) => !v).map(([k]) => k);
    const counts = {};
    for (const t of c.timeline || []) counts[t.type] = (counts[t.type] || 0) + 1;

    return (
      <div style={{ marginTop: 24 }}>
        <div className="alert alert-success">
          Akun {c.accountType || 'SPOT'} — {c.balances?.length || 0} aset, {c.timeline?.length || 0} aktivitas ({c.daysBack} hari)
        </div>
        {failed.length > 0 && <div className="alert alert-error">Gagal memuat: {failed.join(', ')}</div>}

        <div className="summary-grid" style={{ marginTop: 14 }}>
          {Object.entries(counts).map(([type, n]) => (
            <div className="summary-tile" key={type}>
              <div className="st-label">{type}</div>
              <div className="st-value" style={{ color: TYPE_COLOR[type] || 'var(--text-primary)' }}>
                {n}
              </div>
            </div>
          ))}
        </div>

        <div className="mon-section-title" style={{ marginTop: 20 }}>
          <Wallet size={15} /> Saldo Wallet
        </div>
        <div className="mon-list" style={{ marginTop: 8 }}>
          {(c.balances || []).map((b) => (
            <div className="mon-row" key={b.asset}>
              <span className="mon-left" style={{ fontWeight: 700 }}>{b.asset}</span>
              <span className="mon-right">
                {b.free}
                {parseFloat(b.locked) > 0 && (
                  <span style={{ color: 'var(--text-muted)', fontSize: 12, marginLeft: 8 }}>
                    · locked {b.locked}
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>

        <div className="mon-section-title" style={{ marginTop: 20 }}>
          <Activity size={15} /> Timeline Aktivitas Lengkap
        </div>
        <div className="mon-list" style={{ marginTop: 8 }}>
          {(c.timeline || []).map((t, i) => {
            const out = String(t.amount).trim().startsWith('-');
            return (
              <div className="mon-row" key={i}>
                <div className="mon-left">
                  <span className="mon-type-pill" style={{ background: TYPE_COLOR[t.type] || 'var(--border-color)' }}>
                    {t.type}
                  </span>
                  <span className="row-time">{fmtTime(t.time)}{t.network ? ` \u00b7 ${t.network}` : ''}</span>
                </div>
                <span className={`mon-right ${out ? 'amt-out' : 'amt-in'}`}>
                  {t.amount} {t.asset}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
}
