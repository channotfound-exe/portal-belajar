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
6. **Hasil Pengujian Langsung via `python -m http.server 8000` + Chrome**:
   - Seluruh 13 JSON dimuat (`HTTP 200`), filter Semester 1 (6) & Semester 3 (7) akurat.
   - Modul baca, KaTeX, Cheat Sheet, Flashcard, dan tanda sudah paham berfungsi dan tersimpan.
   - Simulasi soal Tahap 1–3, koreksi langsung, pembahasan, update skor, dan persistensi `localStorage` setelah reload berjalan normal.
   - Live coding Pyodide v0.26.4 (stdlib Python pada ALPROG Lab #1 dan lazy loading `numpy` pada Kalkulus Lab #24) lulus uji otomatis di browser, dan contoh baca-saja (`scipy` pada Statistika Lab #5) tampil jelas.
   - Ekspor laporan diagnostik `.md` (`Blob` download + riwayat `localStorage`) berjalan di sisi browser.
   - Perbaikan minor pasca-uji: penambahan inline SVG favicon (menghilangkan 404 `favicon.ico`), pembaruan langsung badge `#lab-detail-status` saat lab lulus, dan penambahan `aria-label` aksesibilitas.

---

### Hal yang Tidak Dapat Berjalan Tanpa Server / Keterbatasan Mode Statis
- **Pustaka Python di luar `stdlib + numpy + pandas`**: Sebanyak 96 lab yang mengimpor `scipy`, `scikit-learn`, atau `matplotlib` tidak dieksekusi di browser dan disajikan sebagai contoh baca-saja beserta output yang diharapkan.
- **Penyimpanan ke folder disk server secara langsung**: Digantikan oleh unduhan browser (`Blob` + `<a download>`) dan riwayat `localStorage`.
- **Sinkronisasi lintas perangkat**: Karena tanpa database/server, data `localStorage` hanya tersimpan di browser dan perangkat yang digunakan saat itu.
- **Akses Offline Penuh**: Pyodide, KaTeX, Marked.js, dan Google Fonts membutuhkan koneksi internet saat dimuat dari CDN.

---

### Langkah Berikutnya
1. Deploy folder `portal-belajar-sains-data/` ke **GitHub Pages** atau **Netlify** mengikuti panduan di `README.md`.
2. *(Opsional)* Tambahkan fitur ekspor/impor cadangan progres `localStorage` dalam format `.json` apabila ingin memindahkan progres antar perangkat.
