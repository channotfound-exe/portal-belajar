# PROGRESS — Portal Belajar Sains Data (Versi Situs Statis)

## Status Saat Ini: Teruji Penuh & Siap Deploy

### Yang Sudah Selesai
1. **Konversi ke Arsitektur Statis Murni**:
   - Menghapus `server.py`, `MULAI_PORTAL.bat`, folder `hasil_sesi/`, serta seluruh panggilan endpoint `/api/*` di `app.js`.
   - Memindahkan arsip Markdown soal & modul ke luar folder deploy (`../arsip-bank-soal-md/`) sehingga folder `portal-belajar-sains-data/` hanya berisi aset web statis siap unggah.
   - Menempatkan `index.html` (termasuk inline SVG favicon bebas 404) dan `.nojekyll` di root folder dengan seluruh aset menggunakan **path relatif** (`styles.css`, `app.js`, `data/courses_index.json`, `data/courses/*.json`).
2. **Konten Belajar Lengkap (13 Mata Kuliah — Semester 1 & 3)**:
   - **Modul Baca Efisien** per bab (`Sesi 1–8` + `Tambahan UAS`), **Cheat Sheet Rumus**, **Tambahan Potensial UAS**, dan **Flashcard Cepat**.
   - **1.950 Soal Pilihan Ganda** (`150` soal per mata kuliah dalam 3 tahap: Tahap 1 [1–50], Tahap 2 [51–100], Tahap 3 [101–150 HOTS], urut per bab, prioritas UAS, 0 duplikat).
   - **650 Lab Praktek** (`50` lab per mata kuliah):
     - **394 lab Python interaktif** (Python standar, `numpy`, `pandas`) berjalan di browser via **Pyodide v0.26.4**.
     - **96 lab Python lanjut** (`scipy`, `scikit-learn`, `matplotlib`) ditandai jelas sebagai **Contoh Baca-Saja** lengkap dengan kode solusi, pengujian, serta output referensi terverifikasi.
     - **160 lab Analisis Kasus** dengan evaluasi rubrik kata kunci di browser.
3. **Live Coding Pyodide (Lazy Loading)**:
   - Runtime **Pyodide v0.26.4** dimuat dari CDN hanya saat tombol jalankan / sandbox digunakan.
   - Paket `numpy` dan `pandas` dimuat secara *lazy* hanya ketika kode membutuhkannya.
4. **Penyimpanan & Ekspor Sisi Browser**:
   - Skor, jawaban, soal salah, status bab paham, catatan pribadi, progres lab, dan riwayat laporan tersimpan di `localStorage`.
   - Ekspor laporan diagnostik sesi ke file `.md` menggunakan `Blob` + `download` langsung di browser.
5. **Privasi, Keamanan & Dokumentasi Deploy**:
   - Pembersihan nama mahasiswa, NIM, inisial pemilik, path lokal pribadi, dan referensi server lokal di seluruh berkas folder portal.
   - Menambahkan `README.md` berisi panduan uji lokal (`python -m http.server`) serta langkah deploy ke **GitHub Pages** dan **Netlify**.
6. **Hasil Pengujian Langsung via `python -m http.server 8000` + Chrome (Versi Statis Awal)**:
   - Seluruh 13 JSON dimuat (`HTTP 200`), filter Semester 1 (6) & Semester 3 (7) akurat.
   - Modul baca, KaTeX, Cheat Sheet, Flashcard, dan tanda sudah paham berfungsi dan tersimpan.
   - Simulasi soal Tahap 1–3, koreksi langsung, pembahasan, update skor, dan persistensi `localStorage` setelah reload berjalan normal.
   - Live coding Pyodide v0.26.4 (stdlib Python pada ALPROG Lab #1 & #2 dan lazy loading `numpy` pada Kalkulus Lab #24) lulus uji otomatis di browser, dan contoh baca-saja (`scipy` pada Statistika Lab #5) tampil jelas.
   - Ekspor laporan diagnostik `.md` (`Blob` download + riwayat `localStorage`) berjalan di sisi browser.
   - Perbaikan minor pasca-uji: penambahan inline SVG favicon, pembaruan langsung badge `#lab-detail-status` saat lab lulus, dan penambahan `aria-label` aksesibilitas.
7. **Konversi ke PWA Siap Pasang di Subpath GitHub Pages (`/portal-belajar/`)**:
   - Menambahkan `manifest.json` dengan seluruh path relatif (`start_url: "./"`, `scope: "./"`, `display: "standalone"`, `orientation: "portrait"`, `theme_color` & `background_color` `#0b1020`, `lang: "id"`, ikon `192x192` & `512x512` untuk `any` dan `maskable`).
   - Membuat ikon PNG `icons/icon-192.png` dan `icons/icon-512.png` (desain `"SD"` putih di atas gradasi utama portal).
   - Menambahkan Service Worker `sw.js` (`portal-v1`, `skipWaiting()`, `clients.claim()`, pembersihan cache lama saat `activate`, precache 21 berkas lokal termasuk seluruh `data/`, strategi *cache-first* lokal dan *stale-while-revalidate* untuk CDN).
   - Memperbarui `index.html`, `styles.css`, dan `app.js` untuk registrasi `sw.js`, `<link rel="manifest">`, `<meta name="theme-color">`, `<link rel="apple-touch-icon">`, tombol `Pasang Aplikasi` (`beforeinstallprompt`), dan indikator `Mode Offline` (`navigator.onLine`).
   - Tidak ada perubahan apa pun pada isi folder `data/`.
   - **Hasil Uji PWA di Chrome (`http://localhost:8000`)**:
     - `0` error dan `0` warning di konsol (seluruh 27 request pada halaman utama `200`/`304`, termasuk `manifest.json`, `icons/icon-192.png`, `icons/icon-512.png`, dan `sw.js`).
     - Event `beforeinstallprompt` tertangkap dan menampilkan tombol **`📲 Pasang Aplikasi`** di topbar.
     - Indikator **`📴 Mode Offline`** langsung tampil saat koneksi berubah offline.
     - Saat halaman di-*reload* penuh dalam mode **DevTools Offline**, seluruh 27 aset (termasuk 13 JSON mata kuliah dan aset CDN Google Fonts, KaTeX, serta Marked.js) berhasil dimuat **`200 OK`** langsung dari cache `sw.js` (`portal-v1` dan `portal-runtime-v1`).

---

### Hal yang Tidak Dapat Berjalan Tanpa Server / Keterbatasan Mode Statis
- **Pustaka Python di luar `stdlib + numpy + pandas`**: Sebanyak 96 lab yang mengimpor `scipy`, `scikit-learn`, atau `matplotlib` tidak dieksekusi di browser dan disajikan sebagai contoh baca-saja beserta output yang diharapkan.
- **Penyimpanan ke folder disk server secara langsung**: Digantikan oleh unduhan browser (`Blob` + `<a download>`) dan riwayat `localStorage`.
- **Sinkronisasi lintas perangkat**: Karena tanpa database/server, data `localStorage` hanya tersimpan di browser dan perangkat yang digunakan saat itu.
- **Akses Offline Penuh Sebelum Kunjungan Pertama**: Aset lokal (`index.html`, `styles.css`, `app.js`, `manifest.json`, ikon, dan seluruh `data/`) di-*precache* oleh `sw.js`, sedangkan CDN (KaTeX, Marked.js, Pyodide, Google Fonts) di-*cache* ke `portal-runtime-v1` setelah pertama kali dimuat.

---

### Langkah Berikutnya
1. Verifikasi PWA di Chrome pada `http://localhost:8000` (server `python -m http.server 8000` sudah aktif; aktifkan `chrome://inspect/#remote-debugging` di Chrome jika ingin agen melakukan cek DevTools otomatis).
2. Push isi `portal-belajar-sains-data/` ke repositori GitHub `https://github.com/channotfound-exe/portal-belajar.git` branch `main` dan aktifkan GitHub Pages.
3. *(Opsional)* Tambahkan fitur ekspor/impor cadangan progres `localStorage` dalam format `.json` apabila ingin memindahkan progres antar perangkat.
