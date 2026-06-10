# Binance Pay Gateway — Personal

Penyedia API untuk cek pembayaran & aktivitas akun Binance **personal** (bukan merchant). Web sebagai API provider — **tidak menyimpan credentials sama sekali**. Cocok dihubungkan ke web, bot, atau sistem lain.

Mendukung dua metode pembayaran:
- **Binance Pay** (transfer via Pay ID)
- **On-chain deposit** (USDT TRC20, BEP20, dll)

## Arsitektur

```
ui/          Frontend React + Vite (dashboard, tutorial, API docs)
api/         Serverless entry point (Express, untuk Vercel + dev lokal)
src/         Logic backend (STATELESS — tidak menyimpan apa pun)
  config.js            Baca credentials per-request dari header
  routes.js            Semua endpoint API
  binanceSpotClient.js Client Binance Spot API (signed requests)
  paymentMatcher.js    Pure functions matching pembayaran
  rateLimit.js         Rate limiter per IP
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

### Tanpa Database

Server **stateless** — tidak menyimpan invoice/order sama sekali, jadi **tidak butuh database**. Pencatatan order, anti-replay (cegah satu transaksi dipakai dua kali), dan logika bisnis adalah tanggung jawab sistem pemanggil (web/bot kamu).

## Endpoint API

Base URL: `/api`

### Payment (stateless)

| Method | Path | Fungsi |
|--------|------|--------|
| POST | `/payment-options` | Buat instruksi bayar + saran nominal unik |
| POST | `/check-payment` | Cek apakah ada pembayaran masuk yang cocok |

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

### Alur pembayaran (JavaScript)

```js
const headers = {
  'Content-Type': 'application/json',
  'X-Binance-Api-Key': KEY,
  'X-Binance-Api-Secret': SECRET,
  'X-Binance-Pay-Id': PAY_ID,
};

// 1. Minta instruksi bayar + nominal unik (simpan di DB sistem kamu)
const opt = await fetch(BASE + '/api/payment-options', {
  method: 'POST', headers,
  body: JSON.stringify({ amount: 5, currency: 'USDT' }),
}).then((r) => r.json());
// opt.amountToPay -> nominal unik yang harus dibayar buyer

// 2. Cek apakah pembayaran sudah masuk (poll berkala)
const check = await fetch(BASE + '/api/check-payment', {
  method: 'POST', headers,
  body: JSON.stringify({
    amount: opt.amountToPay,
    currency: 'USDT',
    sinceMinutes: 30,
  }),
}).then((r) => r.json());

if (check.paid) {
  // check.match.transactionId -> simpan agar tidak dipakai ulang (anti-replay)
  // kirim barang / aktivasi
}
```

## Cara Kerja Matching

Pembayaran diverifikasi dari **history akun sendiri** (bukan klaim buyer). Aturan di `paymentMatcher.js`:

- Hanya transaksi **masuk** (income) yang dihitung
- Nominal cocok dalam toleransi (default ±0.5%)
- Mata uang / coin & network sesuai
- Waktu dalam window yang diminta (`sinceMinutes`)

**Anti-replay** (cegah satu transaksi dipakai dua kali) adalah tanggung jawab sistem pemanggil — simpan `transactionId` dari hasil `/check-payment` di database kamu. Disarankan minta buyer bayar dengan **nominal unik** (pakai `amountToPay` dari `/payment-options`) supaya matching akurat.

## Testing

```bash
npm test         # atau: node --test
```

Unit test mencakup logika matching: income/keluar, toleransi nominal, window waktu, dan matching deposit on-chain (pure functions, tanpa state).

## Konfigurasi (Environment)

| Env | Default | Keterangan |
|-----|---------|-----------|
| `ACCEPTED_CURRENCIES` | `USDT` | Mata uang diterima (pisah koma) |
| `ACCEPTED_NETWORKS` | `TRC20` | Jaringan on-chain diterima |
| `AMOUNT_TOLERANCE_PERCENT` | `0.5` | Toleransi selisih nominal |
| `UNIQUE_AMOUNT` | `true` | Saran nominal unik di `/payment-options` |
| `RATE_LIMIT_MAX` | `60` | Max request per IP per window |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Window rate limit |

## Catatan

- API Key cukup permission **Enable Reading** — jangan aktifkan trading/withdraw
- Server stateless — tidak ada database, tidak ada poller; pengecekan via `/check-payment` on-demand
- Untuk lihat semua history > 7 hari, pakai mode `full` di `/debug/pay-history`
