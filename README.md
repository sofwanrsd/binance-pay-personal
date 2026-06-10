# Binance Pay Gateway — Personal

Penyedia API untuk cek pembayaran & aktivitas akun Binance **personal** (bukan merchant). Web sebagai API provider — **tidak menyimpan credentials sama sekali**. Cocok dihubungkan ke web, bot, atau sistem lain.

Mendukung dua metode pembayaran:
- **Binance Pay** (transfer via Pay ID)
- **On-chain deposit** (USDT TRC20, BEP20, dll)

## Arsitektur

```
ui/          Frontend React + Vite (dashboard, tutorial, API docs)
api/         Serverless entry point (Express, untuk Vercel + dev lokal)
src/         Logic backend
  config.js            Baca credentials per-request dari header
  routes.js            Semua endpoint API
  binanceSpotClient.js Client Binance Spot API (signed requests)
  paymentMatcher.js    Verifikasi & matching pembayaran (async)
  orderStore.js        Storage: KV (Vercel) atau in-memory (lokal)
  kvClient.js          Wrapper Upstash/Vercel KV
  poller.js            Background poller (dev lokal only)
  rateLimit.js         Rate limiter per IP
  fulfillment.js       Hook setelah pembayaran berhasil
test/        Unit test (node:test)
```

## Keamanan Credentials

Server **tidak pernah menyimpan** API Key/Secret/Pay ID. Setiap request wajib membawa header sendiri:

```
X-Binance-Api-Key: <api key>
X-Binance-Api-Secret: <api secret>
X-Binance-Pay-Id: <pay id>      (opsional, untuk fitur Binance Pay)
```

Server pakai sekali untuk memanggil Binance, lalu dibuang. Di UI, credentials disimpan di `localStorage` browser (tidak pernah ke server). Gunakan API Key **Read-only**.

## Setup Lokal

Butuh Node.js >= 18.

```bash
npm install
```

Jalankan dua proses (dua terminal):

```bash
npm run server   # backend Express di port 3000
npm run dev      # frontend Vite di port 5173 (proxy /api ke 3000)
```

Buka http://localhost:5173

## Build Produksi

```bash
npm run build    # output ke dist/
npm start        # jalankan backend Express
```

## Deploy ke Vercel

1. Import repo ke Vercel
2. Framework preset: otomatis (`@vercel/static-build` jalankan `npm run build`)
3. Region sudah di-set `sin1` (Singapura) untuk menghindari geoblock Binance
4. Deploy

**Penting:** untuk mode API provider publik, **jangan** isi env `BINANCE_API_KEY`/`BINANCE_API_SECRET` di Vercel — biarkan kosong supaya tiap pemanggil pakai akun sendiri.

### Storage Persisten (opsional tapi disarankan)

Filesystem Vercel ephemeral, jadi invoice tidak bertahan tanpa KV. Untuk invoice produktif, tambahkan Upstash Redis / Vercel KV lalu set env:

```
KV_REST_API_URL=https://xxx.upstash.io
KV_REST_API_TOKEN=xxxxx
```

Tanpa env ini, sistem otomatis fallback ke in-memory (cukup untuk dev/checking, tidak persisten).

## Endpoint API

Base URL: `/api`

### Invoice (Payment Gateway)

| Method | Path | Fungsi |
|--------|------|--------|
| POST | `/invoices` | Buat invoice baru |
| GET | `/invoices` | Daftar semua invoice |
| GET | `/invoices/:id` | Detail invoice |
| POST | `/invoices/:id/check` | Cek pembayaran on-demand |
| POST | `/invoices/:id/claim` | Klaim cepat via Transaction ID |

### Debug / Checking Akun (stateless)

| Method | Path | Fungsi |
|--------|------|--------|
| POST | `/debug/pay-history` | Riwayat Binance Pay (mode cepat / full 90 hari) |
| POST | `/debug/deposit-history` | Riwayat deposit on-chain |
| POST | `/debug/withdraw-history` | Riwayat withdraw on-chain |
| POST | `/debug/balances` | Saldo spot |
| POST | `/debug/overview` | Saldo + timeline gabungan semua aktivitas |

Dokumentasi interaktif lengkap (dengan try-out) tersedia di halaman `/docs`.

## Contoh Pemakaian

### Cek akun (cURL)

```bash
curl -X POST https://your-app.vercel.app/api/debug/overview \
  -H "Content-Type: application/json" \
  -H "X-Binance-Api-Key: API_KEY" \
  -H "X-Binance-Api-Secret: API_SECRET" \
  -d '{ "days": 7 }'
```

### Alur invoice (JavaScript)

```js
const headers = {
  'Content-Type': 'application/json',
  'X-Binance-Api-Key': KEY,
  'X-Binance-Api-Secret': SECRET,
  'X-Binance-Pay-Id': PAY_ID,
};

// 1. Buat invoice
const inv = await fetch(BASE + '/api/invoices', {
  method: 'POST', headers,
  body: JSON.stringify({ amount: 5, currency: 'USDT' }),
}).then((r) => r.json());

// 2. Poll status sampai PAID
const status = await fetch(BASE + '/api/invoices/' + inv.invoiceId + '/check', {
  method: 'POST', headers,
}).then((r) => r.json());

if (status.status === 'PAID') {
  // kirim barang / aktivasi
}
```

## Cara Kerja Matching

Pembayaran diverifikasi dari **history akun sendiri** (bukan klaim buyer). Aturan di `paymentMatcher.js`:

- Hanya transaksi **masuk** (income) yang dihitung
- Nominal cocok dalam toleransi (default ±0.5%)
- Mata uang / coin & network sesuai
- Waktu dalam window invoice + grace period
- Anti-replay: satu transaksi tidak bisa dipakai dua invoice

Tiap invoice diberi desimal unik kecil pada nominal supaya matching otomatis akurat.

## Testing

```bash
npm test         # atau: node --test
```

Unit test mencakup logika matching: income/keluar, toleransi nominal, window waktu, dedupe anti-replay, dan matching deposit on-chain.

## Konfigurasi (Environment)

| Env | Default | Keterangan |
|-----|---------|-----------|
| `ACCEPTED_CURRENCIES` | `USDT` | Mata uang diterima (pisah koma) |
| `ACCEPTED_NETWORKS` | `TRC20` | Jaringan on-chain diterima |
| `INVOICE_EXPIRY_MINUTES` | `30` | Masa berlaku invoice |
| `AMOUNT_TOLERANCE_PERCENT` | `0.5` | Toleransi selisih nominal |
| `POLL_INTERVAL_SECONDS` | `20` | Interval poller (dev lokal) |
| `RATE_LIMIT_MAX` | `60` | Max request per IP per window |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Window rate limit |
| `KV_REST_API_URL` | - | Upstash/Vercel KV (opsional) |
| `KV_REST_API_TOKEN` | - | Token KV (opsional) |

## Catatan

- API Key cukup permission **Enable Reading** — jangan aktifkan trading/withdraw
- Poller background hanya jalan di dev lokal / VPS, bukan di Vercel (pakai `/check` on-demand)
- Untuk lihat semua history > 7 hari, pakai mode `full` di `/debug/pay-history`
