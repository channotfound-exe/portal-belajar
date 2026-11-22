# Portal Belajar Sains Data (Situs Statis)

Portal pembelajaran mandiri Program Studi Sains Data (Semester 1 & Semester 3) dalam bentuk **situs statis murni** (`HTML + CSS + JS + JSON`) tanpa backend server.

## Fitur Utama
- **Modul Baca Efisien (13 Mata Kuliah)**: Ringkasan materi terstruktur per bab (`Sesi 1–8` + `Tambahan UAS`), poin inti, rumus/sintaks (dirender dengan **KaTeX**), jebakan ujian, penandaan bab paham, dan catatan pribadi di `localStorage`.
- **Tambahan Potensial UAS & Cheat Sheet**: Melengkapi topik-topik BMP yang tidak muncul atau hanya berupa gambar pada slide asli.
- **Simulasi Soal 3 Tahap (1.950 Soal Total — 150 Soal/Matkul)**:
  - Filter per Tahap (Tahap 1: 1–50, Tahap 2: 51–100, Tahap 3: 101–150 HOTS), per Bab, Prioritas UAS (`🎯 Fokus UAS`), maupun soal salah (`Remedial`).
  - Mode **Latihan (Koreksi Langsung)** dan **Simulasi Ujian Timer 60 Menit**.
  - Seluruh jawaban, skor, dan tanda sulit tersimpan otomatis di `localStorage`.
- **Live Coding di Browser (Pyodide v0.26.4)**:
  - Menjalankan kode Python dan *unit test* langsung di browser pengunjung tanpa server.
  - Paket `numpy` dan `pandas` dimuat secara *lazy* (hanya saat dibutuhkan oleh soal atau sandbox).
  - Soal praktik yang membutuhkan library di luar paket aktif (`scipy`, `scikit-learn`, `matplotlib`) ditampilkan sebagai **Contoh Baca-Saja** lengkap dengan kode solusi, pengujian, serta output yang diharapkan.
  - Mata kuliah non-pemrograman dilengkapi **Latihan Analisis Kasus** dengan evaluasi rubrik kata kunci.
- **Ekspor Analisis Sesi ke Markdown (`.md`)**:
  - Menghasilkan laporan diagnostik otomatis (peta akurasi per bab, daftar subtopik yang wajib diulang, daftar soal salah, dan rencana aksi) yang dapat langsung diunduh lewat browser (`Blob` + `download`) atau disimpan ke riwayat `localStorage`.

---

## Struktur Folder
```text
.
├── index.html
├── styles.css
├── app.js
├── .nojekyll
├── README.md
├── PROGRESS.md
└── data/
    ├── courses_index.json
    └── courses/
        ├── alprog.json
        ├── analitik_big_data.json
        ├── bahasa_indonesia.json
        ├── basis_data_nosql.json
        ├── dasar_infrastruktur_ti.json
        ├── data_mining.json
        ├── kalkulus_diferensial.json
        ├── pancasila.json
        ├── pengantar_kecerdasan_artifisial.json
        ├── pengantar_sains_data.json
        ├── pengantar_sistem_informasi.json
        ├── pengantar_statistika_matematis.json
        └── statistika.json
```

---

## Uji Coba Lokal
Karena browser memblokir `fetch()` pada protokol `file://`, jalankan folder ini lewat server statis sederhana:

```bash
cd portal-belajar-sains-data
python -m http.server 8000
```
Lalu buka `http://localhost:8000` di browser.

---

## Cara Deploy ke GitHub Pages
1. Buat repositori baru di GitHub (misalnya `portal-belajar-sains-data`).
2. Unggah **seluruh isi folder** `portal-belajar-sains-data/` (pastikan `index.html` dan `.nojekyll` berada di root repositori):
   ```bash
   cd portal-belajar-sains-data
   git init
   git add .
   git commit -m "Deploy static Portal Belajar Sains Data"
   git branch -M main
   git remote add origin https://github.com/<username>/<nama-repo>.git
   git push -u origin main
   ```
3. Buka **Settings → Pages** pada repositori GitHub Anda.
4. Pada bagian **Build and deployment**, pilih **Source: Deploy from a branch**, lalu pilih branch **`main`** dan folder **`/ (root)`**, kemudian klik **Save**.
5. Tunggu 1–2 menit; situs Anda akan aktif di `https://<username>.github.io/<nama-repo>/`.

---

## Cara Deploy ke Netlify
### Opsi A — Drag & Drop (Tercepat, tanpa Git)
1. Masuk ke [https://app.netlify.com/](https://app.netlify.com/) dan pilih **Add new site → Deploy manually**.
2. Tarik dan lepas (*drag & drop*) folder **`portal-belajar-sains-data`** langsung ke area unggah Netlify.
3. Dalam beberapa detik, situs langsung aktif dengan URL `https://<random-name>.netlify.app` (dapat diubah di **Site configuration → Change site name**).

### Opsi B — Via GitHub
1. Push folder ke repositori GitHub seperti langkah di atas.
2. Di Netlify pilih **Add new site → Import an existing project → GitHub**.
3. Pilih repositori, kosongkan **Build command** (karena situs sudah statis murni), dan isi **Publish directory** dengan `.` (root).
4. Klik **Deploy site**.

---

## Catatan Keterbatasan Mode Statis (Tanpa Server)
- **Koneksi Internet untuk CDN**: Pyodide (`v0.26.4`), KaTeX, Marked.js, dan Google Fonts dimuat dari CDN saat dibuka di browser.
- **Paket Python di Pyodide**: Hanya pustaka standar Python, `numpy`, dan `pandas` yang dimuat (secara *lazy*). Sebanyak **96 soal praktik** yang memakai `scipy`, `scikit-learn`, atau `matplotlib` ditampilkan sebagai **Contoh Baca-Saja** beserta kode dan output referensinya.
- **Penyimpanan Lokal**: Progres, skor, catatan pribadi, dan riwayat laporan sesi disimpan di `localStorage` perangkat masing-masing pengunjung (tidak disinkronkan antar perangkat).
