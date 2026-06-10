'use strict';

/**
 * Logika fulfillment: dijalankan SETELAH pembayaran terverifikasi (status PAID).
 * Di sinilah aksi bisnis: kirim akun/stok, aktivasi lisensi, kirim notif, dll.
 *
 * Dibuat defensif terhadap pemanggilan ganda (idempotent) lewat flag `fulfilled`.
 * Deteksi pembayaran (poller/claim) sengaja DIPISAH dari pengiriman barang,
 * jadi kalau pengiriman gagal, invoice tetap tercatat PAID dan bisa di-retry.
 */

const store = require('./orderStore');

/**
 * @param {object} invoice - invoice yang sudah berstatus PAID
 * @returns {Promise<void>}
 */
async function fulfillOrder(invoice) {
  if (!invoice) return;

  if (invoice.fulfilled) {
    console.log(`[fulfillment] invoice ${invoice.id} sudah fulfilled, skip`);
    return;
  }

  try {
    console.log(
      `[fulfillment] memproses invoice ${invoice.id} ` +
        `(${invoice.paidAmount || invoice.expectedAmount} ${invoice.currency}) ` +
        `tx=${invoice.transactionId || '-'}`
    );

    // ====================================================================
    // TODO: GANTI dengan aksi bisnis nyata. Contoh:
    //   - const stok = await ambilStok(invoice.productId);
    //   - await kirimKeBuyer(invoice.buyer, stok);
    //   - await kirimEmailKonfirmasi(invoice.email, invoice);
    // Kalau salah satu gagal, lempar error supaya `fulfilled` tidak diset
    // dan bisa di-retry nanti.
    // ====================================================================

    store.update(invoice.id, { fulfilled: true, fulfilledAt: Date.now() });
    console.log(`[fulfillment] invoice ${invoice.id} selesai di-fulfill`);
  } catch (err) {
    console.error(`[fulfillment] GAGAL fulfill ${invoice.id}: ${err.message}`);
    throw err; // jangan tandai fulfilled biar bisa di-retry
  }
}

module.exports = { fulfillOrder };
