import React from 'react';

const BASE = typeof window !== 'undefined' ? window.location.origin : 'https://your-app.vercel.app';

const curlExample = `curl -X POST ${BASE}/api/debug/overview \\
  -H "Content-Type: application/json" \\
  -H "X-Binance-Api-Key: API_KEY_KAMU" \\
  -H "X-Binance-Api-Secret: API_SECRET_KAMU" \\
  -d '{ "days": 7 }'`;

const jsExample = `const res = await fetch("${BASE}/api/debug/overview", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Binance-Api-Key": process.env.BINANCE_API_KEY,
    "X-Binance-Api-Secret": process.env.BINANCE_API_SECRET,
  },
  body: JSON.stringify({ days: 7 }),
});
const data = await res.json();
console.log(data.balances, data.timeline);`;

const invoiceExample = `// 1. Buat invoice
const inv = await fetch("${BASE}/api/invoices", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Binance-Api-Key": KEY,
    "X-Binance-Api-Secret": SECRET,
    "X-Binance-Pay-Id": PAY_ID,
  },
  body: JSON.stringify({ amount: 5, currency: "USDT" }),
}).then(r => r.json());

// 2. Cek status (poll tiap 15 detik)
const status = await fetch(
  "${BASE}/api/invoices/" + inv.invoiceId + "/check",
  { method: "POST", headers: { /* sama spt di atas */ } }
).then(r => r.json());

if (status.status === "PAID") {
  // kirim barang / aktivasi
}`;

function Step({ n, title, children }) {
  return (
    <div className="tut-step">
      <div className="tut-num">{n}</div>
      <div className="tut-step-body">
        <div className="tut-step-title">{title}</div>
        <div className="tut-step-content">{children}</div>
      </div>
    </div>
  );
}

function Code({ children }) {
  return <pre className="ep-pre" style={{ marginTop: 10 }}>{children}</pre>;
}

export default function Tutorial() {
  return (
    <>
      <div className="card">
        <h2>Cara Kerja</h2>
        <p style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.65 }}>
          Web ini adalah <strong style={{ color: 'var(--txt)' }}>penyedia API</strong> untuk
          cek pembayaran dan aktivitas akun Binance. Server tidak menyimpan credentials —
          setiap request membawa API Key sendiri lewat header, dipakai sekali, lalu dibuang.
          Cocok dihubungkan ke web, bot, atau sistem lain.
        </p>
      </div>

      <div className="card">
        <h2>Setup Awal</h2>
        <Step n="1" title="Buat API Key di Binance">
          Buka Binance &rarr; Settings &rarr; API Management &rarr; Create API.
          Centang <strong>Enable Reading</strong> saja. Jangan aktifkan Trading/Withdraw.
        </Step>
        <Step n="2" title="Ambil Pay ID (opsional)">
          Untuk fitur invoice Binance Pay: buka app Binance &rarr; Pay &rarr; lihat Pay ID
          (9 digit) di pojok kanan atas.
        </Step>
        <Step n="3" title="Masukkan di tab Pengaturan">
          Buka Dashboard &rarr; tab Pengaturan &rarr; isi API Key, Secret, Pay ID &rarr; Simpan.
          Tersimpan di browser kamu, bukan di server.
        </Step>
      </div>

      <div className="card">
        <h2>Cek Akun (cURL)</h2>
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>
          Ambil saldo + timeline aktivitas 7 hari terakhir:
        </p>
        <Code>{curlExample}</Code>
      </div>

      <div className="card">
        <h2>Integrasi JavaScript</h2>
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>
          Panggil dari web/bot kamu sendiri:
        </p>
        <Code>{jsExample}</Code>
      </div>

      <div className="card">
        <h2>Alur Invoice (Payment Gateway)</h2>
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>
          Buat invoice, lalu poll status sampai PAID:
        </p>
        <Code>{invoiceExample}</Code>
      </div>

      <div className="card">
        <h2>Catatan Keamanan</h2>
        <ul className="modal-list" style={{ marginTop: 0 }}>
          <li>Selalu gunakan API Key <strong>Read-only</strong></li>
          <li>Credentials dikirim via header, tidak pernah disimpan server</li>
          <li>Simpan Secret kamu di environment variable, jangan hardcode</li>
          <li>Restrict API Key ke IP tertentu di Binance bila memungkinkan</li>
        </ul>
      </div>
    </>
  );
}
