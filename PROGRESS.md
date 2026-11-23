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
8. **Redesign Tema Pastel Kalem, Mobile-First & Gamifikasi Ringan (`portal-v4`)**:
   - **Palet & Tipografi**: Tema terang krem `#FAF6EF` + kartu putih lembut (`#FFFFFF`), aksen *sage green* (`#B7D3C0`), lavender (`#D5C8F0`), *peach* (`#FFD9C7`), dan *baby blue* (`#CFE3F5`), teks utama `#33324A` / sekunder `#5E5D75` (kontras >= 4.5:1), sudut membulat `16–24px`, tipografi **Plus Jakarta Sans** & **JetBrains Mono**, font dasar `16px`. Tersedia **Mode Gelap Pastel (`#1F1D2E`)** yang mengikuti preferensi sistem secara default dan dapat diganti via tombol topbar atau menu `Pengaturan` (`localStorage`).
   - **Identitas Visual & Dashboard**: Tiap dari 13 mata kuliah memiliki warna pastel dan emoji khas sendiri di kartu, badge semester, dan dua progress bar (persen bab selesai dan persen soal benar), dilengkapi dekorasi gelombang SVG pada hero dashboard dan menghormati `prefers-reduced-motion`.
   - **Navigasi Mobile-First & Halaman Soal Fokus**: Sidebar pada layar lebar dan *bottom navigation* 5 menu (`Beranda`, `Belajar`, `Latihan`, `Statistik`, `Pengaturan`) pada HP; halaman soal menampilkan **satu soal per layar**, opsi jawaban berbentuk kartu besar, pembahasan buka-tutup (`<details>`), *skeleton loading*, *empty state*, serta blok kode dan konsol output Pyodide bernuansa pastel lembut yang jelas dibaca di mode terang maupun gelap.
   - **Gamifikasi Ringan (`localStorage`)**: Pencatatan *streak* harian, **XP** (paham bab, soal benar, lab lulus), lencana pencapaian di halaman `Statistik`, serta animasi konfeti halus saat menyelesaikan suatu tahap/bab.
   - **Aset PWA Pastel**: Pembaruan `manifest.json` (`theme_color` & `background_color` `#FAF6EF`), pembuatan ulang `icons/icon-192.png` dan `icons/icon-512.png` bergaya gradien *sage*–lavender, dan kenaikan versi cache `sw.js` (dari `portal-v1` ke `portal-v2` hingga `portal-v4` pasca perbaikan UI/CSS, tetap *precache* 21 berkas lokal dan seluruh path relatif). Tidak ada file di dalam `data/` yang diubah.
   - **Hasil Uji Desktop (`1280x800`) & Mobile (`390x844`) di Chrome (`http://localhost:8000`)**:
     - `node --check app.js` dan `node --check sw.js` lulus; `verify_pwa.py` memverifikasi 21 target precache dan `manifest.json`; `0` error konsol dan `0` issue Chromium pada hard reload dan normal reload dengan Service Worker `portal-v4`.
     - Teruji di Desktop & Mobile `390x844`: `Beranda` (kartu matkul & filter semester), `Belajar` (modul bab, `Tandai Paham` +20 XP, `Tambahan UAS`, `Flashcard`), `Latihan` (kunjungan langsung mengisi dropdown tahap/bab, 1 soal per layar, umpan balik mint/pink + XP, drawer `#quiz-navigator-drawer` buka-tutup, `Lab Praktek & Pyodide`), `Statistik` (lencana, ekspor `.md`), `Pengaturan` (toggle tema Terang/Gelap/Sistem & status PWA `Aktif (portal-v4 siap offline)`), tanpa *horizontal overflow* di `390x844` serta chip `Sem 1` rapi satu baris.

9. **Penambahan 5 Fitur Belajar Interaktif & Pembaruan Cache (`portal-v5`)**:
   - **Flashcard Poin Inti & Spaced Repetition**: Flashcard dibentuk dari tiap butir `summary_points` per bab dengan penanda **Belum Hafal** / **Sudah Hafal (+5 XP)** dan filter deck (`Semua Poin Inti`, `Hanya Belum Hafal`, `Sudah Hafal`); kartu yang belum hafal diprioritaskan di antrean dan disisipkan kembali lebih sering agar cepat terkuasai (`prog.flashcards` di `localStorage`).
   - **4 Mode Soal**: **Latihan per Bab**, **Latihan Acak** (+ tombol acak ulang), **Remedial (Soal Salah)**, dan **Simulasi UAS** dengan **Jumlah Soal** (`10`, `20`, `30`, `50`, `Semua`) & **Durasi Timer** (`15`, `30`, `60`, `90` Menit) yang dapat diatur, sementara koreksi dan `<details>` pembahasan baru terbuka setelah `Selesaikan & Koreksi` atau timer habis.
   - **Bookmark Soal & Catatan Pribadi per Bab/Soal**: Tombol **Bookmark (`B`)** + filter status `🔖 Di-bookmark` + penanda grid soal, serta kolom **Catatan Pribadi Soal** (`prog.questionNotes`) mendampingi **Catatan Pribadi Bab** (`prog.notes`) dengan *autosave* ke `localStorage`.
   - **Pencarian Global dengan Hasil Disorot**: Tombol **Cari (`Ctrl+K`)** di topbar mencari lintas **13 mata kuliah** (`Modul & Istilah`, `Tambahan UAS`, `Bank Soal`, serta `Catatan & Bookmark`), menyorot kata cocok dengan `<mark class="search-hl">` di daftar hasil maupun langsung di dalam modul/soal saat dibuka.
   - **Lanjut dari Posisi Terakhir**: Menyimpan posisi aktif (`__lastPosition` dan `prog.lastState` per mata kuliah: `section`, tab, indeks bab/lab, tahap, mode, dan `qKey`), menampilkannya pada tombol **Lanjut** di Beranda dan memulihkan langsung posisi tersebut.
   - **Service Worker `portal-v5`**: Versi cache [sw.js](sw.js) dinaikkan ke `portal-v5` / `portal-runtime-v5` tanpa mengubah satu pun file di folder `data/`.
   - **Hasil Uji Desktop (`1280x800`) & Mobile (`390x844`) di Chrome (`http://localhost:8000`)**:
     - `node --check app.js` dan `node --check sw.js` lulus; `verify_pwa.py` memverifikasi 21 target precache dan `manifest.json`; `git status -s -- data/` bersih.
     - Chrome QA mengonfirmasi `Aktif (portal-v5 siap offline)`, `0` error konsol & `0` issue Chromium, antrean flashcard pengulangan berjarak (`44` → `45` kartu saat ditandai Belum Hafal, `+5 XP` & persistensi `Hafal: 1/44`), seluruh 4 mode soal (`Acak`, `Remedial`, `Simulasi UAS` `10 Soal`/`15 Menit` menyembunyikan pembahasan hingga selesai lalu membuka koreksi & banner skor), bookmark + catatan soal/bab bertahan setelah reload, pencarian global `"Bayes"` menyorot `<mark>` di daftar maupun isi modul `Statistika — Sesi 2`, tombol `▶ Lanjut` memulihkan posisi tepat ke bab/soal terakhir, serta layout Mobile `390x844` bebas overflow.

10. **Penambahan 5 Fitur Analitik, Rekomendasi, Cadangan JSON & Pengingat Harian (`portal-v6`)**:
    - **Halaman Statistik Lengkap (Grafik SVG Sendiri)**: Dua grafik batang SVG *inline* ringan (`#chart-courses-svg` untuk seluruh 13 mata kuliah dan `#chart-chapters-svg` per bab dengan garis batas target `80%`), kartu **Target Harian** (`10`–`50`/hari, tersimpan di `localStorage`), **Topik Terlemah** (`remedial_section` terbanyak salah), **Streak**, dan **Riwayat Sesi** (`__studySessions` + laporan tersimpan).
    - **Rekomendasi Belajar Terurut (`computeReviewPriorities`)**: Daftar **Bab yang Harus Diulang** diurutkan berdasarkan jumlah jawaban salah, jarak akurasi di bawah `80%`, bobot prioritas UAS, dan status paham, lengkap dengan subtopik lemah serta tombol **📖 Buka Modul** dan **🔁 Remedial Bab Ini**.
    - **Ekspor Laporan Sesi `.md` Ditingkatkan (`buildDiagnosticMarkdown`)**: Memuat ringkasan target harian & streak, **Urutan Prioritas Topik & Bab yang Harus Diulang** beserta subtopiknya, **Bagian yang Belum Ditandai Paham**, serta **Topik Terlemah & Daftar Soal Salah** beserta catatan pribadi soal.
    - **Ekspor & Impor Cadangan Progres JSON**: Penambahan tombol **⬆ Impor Cadangan (.json)** (`#btn-import-backup-json` + `#input-import-backup-json`) melengkapi ekspor terstruktur `schema_version: 2` (`theme_pref` + seluruh `progress`), dengan validasi JSON sebelum memulihkan ke `localStorage`.
    - **Banner Pengingat Dalam Aplikasi (`#daily-reminder-banner`)**: Menampilkan pengingat *"Belum belajar hari ini"* dengan target harian dan streak saat aktivitas hari ini masih `0`, tombol **▶ Mulai Belajar** serta **Nanti**, dan otomatis tersembunyi setelah aktivitas belajar pertama hari ini tercatat.
    - **Service Worker `portal-v6`**: Versi cache [sw.js](sw.js) dinaikkan ke `portal-v6` / `portal-runtime-v6` tanpa mengubah apa pun di dalam folder `data/`.
    - **Hasil Uji (`http://localhost:8000` Desktop `1280x800` & Mobile `390x844`)**:
      - `node --check app.js`, `node --check sw.js`, dan `verify_pwa.py` (21 aset precache & `manifest.json`) lulus; `git status -s -- data/` bersih.
      - Node CLI mengonfirmasi file ekspor `cadangan_progres_portal_2026-11-23.json` berisi `app: portal-belajar-sains-data`, `schema_version: 2`, `theme: light`, `xp: 90`, `dailyTarget: 20`, `sessions: 1`, `reports: 2`, dan 13 mata kuliah.
      - Chrome QA mengonfirmasi `Aktif (portal-v6 siap offline)`, `0` error konsol & `0` issue Chromium, banner *"Belum belajar hari ini"* tampil saat aktivitas `0` lalu menghilang otomatis begitu 1 aktivitas dilakukan, 2 grafik SVG kustom, target harian `20/hari` persisten, topik terlemah, urutan rekomendasi `#1`–`#8` + tombol `🔁 Remedial Bab Ini`, riwayat sesi, pratinjau & unduhan `.md` berisi urutan topik/bab belum dipahami, ekspor JSON berhasil, serta tampilan Mobile `390x844` bebas overflow halaman. *(Catatan: simulasi unggah file via `upload_file` Chrome DevTools MCP ke `#input-import-backup-json` ditolak oleh kebijakan workspace root server MCP, sehingga alur unggah dialog file browser belum dijalankan otomatis di Chrome).*

---

### Hal yang Tidak Dapat Berjalan Tanpa Server / Keterbatasan Mode Statis
- **Pustaka Python di luar `stdlib + numpy + pandas`**: Sebanyak 96 lab yang mengimpor `scipy`, `scikit-learn`, atau `matplotlib` tidak dieksekusi di browser dan disajikan sebagai contoh baca-saja beserta output yang diharapkan.
- **Penyimpanan ke folder disk server secara langsung**: Digantikan oleh unduhan browser (`Blob` + `<a download>`) dan riwayat `localStorage`.
- **Sinkronisasi lintas perangkat**: Karena tanpa database/server, data `localStorage` hanya tersimpan di browser dan perangkat yang digunakan saat itu; namun kini pengguna dapat **mengekspor & mengimpor cadangan `.json`** dari menu **Pengaturan** untuk memindahkan progres antar perangkat.
- **Akses Offline Penuh Sebelum Kunjungan Pertama**: Aset lokal (`index.html`, `styles.css`, `app.js`, `manifest.json`, ikon, dan seluruh `data/`) di-*precache* oleh `sw.js`, sedangkan CDN (KaTeX, Marked.js, Pyodide, Google Fonts) di-*cache* ke `portal-runtime-v6` setelah pertama kali dimuat.

---

### Langkah Berikutnya
1. Commit dan push pembaruan fitur analitik, rekomendasi, cadangan JSON, pengingat harian, dan `portal-v6` ke repositori GitHub `https://github.com/channotfound-exe/portal-belajar.git` branch `main` agar live di GitHub Pages.
2. *(Opsional)* Uji pilih file cadangan `.json` lewat dialog file browser langsung pada menu **Pengaturan → Impor Cadangan (.json)**.
