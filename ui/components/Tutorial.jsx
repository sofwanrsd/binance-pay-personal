import React, { useState } from 'react';
import { copy } from '../clientApi.js';
import { BookOpen, Copy, Shield, Key, Terminal, Code2, CheckCircle2 } from 'lucide-react';

const BASE = typeof window !== 'undefined' ? window.location.origin : 'https://your-app.vercel.app';

const CODE_EXAMPLES = {
  curl: `curl -X POST ${BASE}/api/debug/overview \\
  -H "Content-Type: application/json" \\
  -H "X-Binance-Api-Key: API_KEY_KAMU" \\
  -H "X-Binance-Api-Secret: API_SECRET_KAMU" \\
  -d '{ "days": 7 }'`,

  nodejs: `const res = await fetch("${BASE}/api/debug/overview", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Binance-Api-Key": process.env.BINANCE_API_KEY,
    "X-Binance-Api-Secret": process.env.BINANCE_API_SECRET,
  },
  body: JSON.stringify({ days: 7 }),
});
const data = await res.json();
console.log(data.balances, data.timeline);`,

  python: `import requests

url = "${BASE}/api/debug/overview"
headers = {
    "Content-Type": "application/json",
    "X-Binance-Api-Key": "API_KEY_KAMU",
    "X-Binance-Api-Secret": "API_SECRET_KAMU"
}
payload = {"days": 7}

response = requests.post(url, json=payload, headers=headers)
print(response.json())`,

  php: `<?php
$ch = curl_init("${BASE}/api/debug/overview");
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'X-Binance-Api-Key: API_KEY_KAMU',
    'X-Binance-Api-Secret: API_SECRET_KAMU'
]);
curl_setopt($ch, CURLOPT_POST, 1);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['days' => 7]));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

$response = curl_exec($ch);
curl_close($ch);
echo $response;`
};

export default function Tutorial() {
  const [lang, setLang] = useState('curl');

  return (
    <>
      <div className="card">
        <div className="card-title">
          <h2>
            <span className="title-icon"><BookOpen size={20} /></span>
            <span>Panduan &amp; Tutorial Integrasi API</span>
          </h2>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13.5, lineHeight: 1.65 }}>
          Web ini merupakan <strong style={{ color: 'var(--text-primary)' }}>penyedia API gateway stateless</strong> untuk
          pengecekan pembayaran masuk dan monitoring transaksi Binance. Server tidak menyimpan API Key &amp; Secret Anda —
          setiap request membawa credentials sendiri via Header HTTP, diproses secara real-time ke Binance, lalu dibuang.
        </p>
      </div>

      <div className="card">
        <div className="card-title">
          <h2>
            <span className="title-icon"><Key size={18} /></span>
            <span>Langkah Setup Binance API</span>
          </h2>
        </div>

        <div className="tut-step">
          <div className="tut-num">1</div>
          <div>
            <div className="tut-step-title">Buat API Key di Binance</div>
            <div className="tut-step-content">
              Buka aplikasi/web Binance &rarr; <strong>Settings / Security</strong> &rarr; <strong>API Management</strong> &rarr; <strong>Create API</strong>.
              Centang opsi <strong>Enable Reading</strong> saja. Pastikan <u>TIDAK</u> mengaktifkan izin Trading atau Withdrawal!
            </div>
          </div>
        </div>

        <div className="tut-step">
          <div className="tut-num">2</div>
          <div>
            <div className="tut-step-title">Ambil Binance Pay ID (Opsional)</div>
            <div className="tut-step-content">
              Untuk mengaktifkan fitur Binance Pay: Buka aplikasi Binance &rarr; <strong>Pay</strong> &rarr; Salin Pay ID (9 digit angka) di bagian profil Pay Anda.
            </div>
          </div>
        </div>

        <div className="tut-step">
          <div className="tut-num">3</div>
          <div>
            <div className="tut-step-title">Simpan di Tab Pengaturan</div>
            <div className="tut-step-content">
              Buka Dashboard &rarr; tab <strong>Pengaturan API</strong> &rarr; Isikan API Key, Secret, dan Pay ID &rarr; Klik Simpan. Credentials tersimpan aman di browser Anda (localStorage).
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          <h2>
            <span className="title-icon"><Code2 size={18} /></span>
            <span>Contoh Kode Integrasi</span>
          </h2>

          <div className="preset-pills">
            <button className={`pill-btn ${lang === 'curl' ? 'active' : ''}`} onClick={() => setLang('curl')}>cURL</button>
            <button className={`pill-btn ${lang === 'nodejs' ? 'active' : ''}`} onClick={() => setLang('nodejs')}>Node.js</button>
            <button className={`pill-btn ${lang === 'python' ? 'active' : ''}`} onClick={() => setLang('python')}>Python</button>
            <button className={`pill-btn ${lang === 'php' ? 'active' : ''}`} onClick={() => setLang('php')}>PHP</button>
          </div>
        </div>

        <div style={{ position: 'relative' }}>
          <pre className="ep-pre">{CODE_EXAMPLES[lang]}</pre>
          <button
            className="btn btn-outline btn-sm"
            style={{ position: 'absolute', top: 12, right: 12 }}
            onClick={() => copy(CODE_EXAMPLES[lang], `Kode ${lang.toUpperCase()}`)}
          >
            <Copy size={13} />
            <span>Salin Kode</span>
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          <h2>
            <span className="title-icon"><Shield size={18} /></span>
            <span>Prinsip Keamanan Maksimal</span>
          </h2>
        </div>

        <ul className="modal-list">
          <li>Selalu gunakan API Key dengan hak akses <strong>Read-Only</strong>.</li>
          <li>Credentials dikirim langsung melalui Request Header HTTP secara encrypted (HTTPS).</li>
          <li>Jangan pernah membagikan Secret Key Anda kepada siapapun.</li>
          <li>Jika memungkinkan, lakukan pembatasan IP (IP Whitelisting) pada Binance API Key Management.</li>
        </ul>
      </div>
    </>
  );
}
