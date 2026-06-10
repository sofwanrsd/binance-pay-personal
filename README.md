# Binance Pay Gateway — Akun Personal

Backend payment gateway yang menggunakan akun Binance **personal** (bukan merchant) sebagai penerima pembayaran. Tidak butuh verifikasi bisnis, cukup akun Binance biasa dengan API key Read-only.

## Cara Kerja

```
Buyer                   Server kamu              Binance API
  |                          |                        |
  |-- POST /api/invoices --> |                        |
  |                          |-- buat invoice lokal   |
  |<-- invoiceId + payId --- |                        |
  |                          |                        |
  |-- bayar via Binance Pay->|                        |
  |   ke Pay ID kamu         |                        |
  |                          |                        |
  |-- POST /api/invoices     |                        |
  |   /:id/claim + txId ---> |                        |
  |                          |-- GET /sapi/v1/pay --> |
  |                          |   /transactions        |
  |                          |<-- list transaksi ----- |
  |                          |-- verifikasi match      |
  |<-- status PAID ----------|                        |
```

Selain klaim manual, ada **poller** yang berjalan di background setiap `POLL_INTERVAL_SECONDS` detik untuk mencocokkan transaksi masuk secara otomatis tanpa buyer perlu kirim TxId.

## Prasyarat

- Node.js >= 18
- Akun Binance (personal, tidak perlu verifikasi bisnis)
- API Key Binance dengan permission **Enable Reading** saja

## Setup

**1. Clone / download project lalu install dependencies**

```bash
npm install
```

**2. Buat API Key di Binance**

Binance > Settings > API Management > Create API
- Centang **Enable Reading** saja
- Restrict access to trusted IPs (opsional tapi disarankan)
- Salin API Key dan Secret Key

**3. Cari Pay ID kamu**

Binance app > Pay > ikon profil/QR pojok kanan atas > Pay ID (angka 9 digit)

**4. Buat file `.env`**

```bash
cp .env.example .env
```

Isi minimal:

```env
BINANCE_API_KEY=isi_api_key_kamu
BINANCE_API_SECRET=isi_api_secret_kamu
BINANCE_PAY_ID=123456789
```

**5. Jalankan server**

```bash
# Production
npm start

# Development (auto-restart saat file berubah)
npm run dev
```

## API Endpoints

### Buat Invoice Baru

```
POST /api/invoices
Content-Type: application/json

{
  "amount": 5.00,
  "currency": "USDT",
  "productId": "PROD-001",
  "buyer": "username_buyer"
}
```

Response:

```json
{
  "invoiceId": "INV1A2B3C4D5E6F",
  "status": "PENDING",
  "currency": "USDT",
  "amountToPay": 5.0037,
  "payId": "123456789",
  "expiresAt": 1749563004639,
  "instruction": "Bayar TEPAT 5.0037 USDT via Binance Pay ke Pay ID 123456789 ..."
}
```

> `amountToPay` sengaja diberi desimal unik kecil agar matching otomatis lebih akurat.

### Cek Status Invoice

```
GET /api/invoices/:invoiceId
```

### Klaim Pembayaran (Verifikasi Cepat)

Buyer kirim Transaction ID setelah bayar untuk verifikasi instan tanpa nunggu poller:

```
POST /api/invoices/:invoiceId/claim
Content-Type: application/json

{
  "transactionId": "320***********"
}
```

Transaction ID bisa dilihat buyer di: Binance app > Pay > riwayat transaksi > detail

### Daftar Semua Invoice

```
GET /api/invoices
```

> Lindungi endpoint ini dengan autentikasi sebelum deploy ke produksi.

### Health Check

```
GET /health
```

## Status Invoice

| Status | Keterangan |
|--------|-----------|
| `PENDING` | Menunggu pembayaran |
| `PAID` | Pembayaran terverifikasi |
| `EXPIRED` | Lewat batas waktu sebelum dibayar |

## Fulfillment

Edit `src/fulfillment.js` untuk menambahkan aksi setelah pembayaran berhasil (kirim barang, aktivasi akun, kirim email, dll):

```js
// src/fulfillment.js
async function fulfillOrder(invoice) {
  // Contoh: kirim email konfirmasi
  await sendEmail(invoice.buyer, invoice.productId);

  // Contoh: aktivasi lisensi
  await activateLicense(invoice.productId, invoice.buyer);

  store.update(invoice.id, { fulfilled: true, fulfilledAt: Date.now() });
}
```

## Struktur File

```
src/
  server.js           # Entry point Express
  config.js           # Konfigurasi dari .env
  routes.js           # API endpoints
  binanceSpotClient.js # Client Binance Spot API (signed requests)
  orderStore.js       # Penyimpanan invoice (file JSON, persistent)
  paymentMatcher.js   # Logika verifikasi & matching transaksi
  poller.js           # Background poller cek transaksi otomatis
  fulfillment.js      # Aksi setelah pembayaran berhasil
data/
  invoices.json       # Data invoice (dibuat otomatis)
.env.example          # Template konfigurasi
```

## Catatan Keamanan

- API Key hanya butuh **Read** permission — jangan aktifkan trading/withdraw
- Data invoice disimpan di `data/invoices.json` — backup file ini secara berkala
- Endpoint `GET /api/invoices` sebaiknya dilindungi API key/auth di produksi
- Untuk produksi dengan traffic tinggi, ganti `orderStore.js` ke database (Postgres/MySQL/Redis)
- Rate limit Binance: poller default 20 detik, jangan di-set di bawah 10 detik
