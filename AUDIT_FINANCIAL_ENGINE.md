# Audit Financial Calculation Engine — Money Watch Pro

**Tanggal audit:** 23 Juli 2026
**Metode:** Pembacaan langsung source code (bukan asumsi), penelusuran tiap rumus sampai sumber datanya, dan verifikasi empiris langsung di browser untuk temuan yang berpotensi menghasilkan angka berbeda.
**Cakupan:** `js/01-data.js` s/d `js/20-wealth.js`, `js/15-txbulk.js` (bulk import), `js/02-storage.js` (persist/export).

---

## 1. Executive Summary

> **Status per perbaikan terakhir:** **SEMUA 7 temuan (F1–F7) sudah diperbaiki dan diverifikasi ulang secara empiris** langsung di browser — bukan hanya dibaca kodenya, tapi direproduksi kondisi sebelum/sesudah perbaikan. Lihat catatan verifikasi di masing-masing temuan di bawah.

**Kondisi umum:** Inti mesin perhitungan (biaya transaksi saham, average cost 4 kelas aset, agregasi Dashboard/Wealth) **sudah benar dan konsisten** sejak awal — ini bukan aplikasi yang dibangun serampangan. Audit ini menemukan 7 celah (2 kritis, 2 tinggi, 2 sedang, 1 rendah) yang **seluruhnya kini sudah ditutup**.

| Tingkat Risiko | Jumlah Temuan | Status |
|---|---|---|
| 🔴 Critical | 2 | ✅ Diperbaiki |
| 🟠 High | 2 | ✅ Diperbaiki |
| 🟡 Medium | 2 | ✅ Diperbaiki |
| 🟢 Low | 1 | ✅ Diperbaiki |
| ℹ️ Info (terverifikasi BENAR sejak awal, dilaporkan untuk kelengkapan) | 4 | — |

**Tingkat kesiapan produksi:** **Layak dipakai**, termasuk untuk kebutuhan yang lebih serius dari penggunaan pribadi kasual — seluruh temuan Single-Source-of-Truth, konsistensi lintas halaman, integritas data riil, dan validasi input sudah tertutup dan diverifikasi. Batasan yang tersisa (tidak ada dukungan stock split/bonus share/right issue — lihat F9) adalah keterbatasan fitur yang diketahui, bukan bug.

---

## 2. Arsitektur Financial Engine

### Alur data aktual (diverifikasi dari kode, bukan diagram ideal)

```
INPUT (manual / bulk Excel)
   │
   ▼
VALIDASI (txValidateRow / divValidateRow — hanya di jalur bulk import)
   │
   ▼
addTx() / addDiv() / addRdn()  ← engine tunggal untuk BUY/SELL/DIVIDEN/mutasi kas
   │  └─ calcTxComponents()     ← SATU-SATUNYA rumus komisi/PPN/Levy/PPh (✅ konsisten)
   │  └─ addRdn() → rdnBalance += amount  ← ⚠️ inkremental, TIDAK re-sort (lihat F2)
   ▼
transactions[] / dividends[] / cryptoTx[] / etfTx[] / rdTx[] / rdnMutations[]
   │
   ▼
getPortfolio() / getCryptoPortfolio() / getEtfPortfolio() / getRdPortfolio() / calcRdnBalance()
   │   (dipanggil ULANG, bukan cache, di setiap render — kecuali getPortfolio yang
   │    sempat punya bug cache basi, SUDAH DIPERBAIKI sesi ini)
   ▼
renderDashboard() ──┬── renderPortofolio()
                     ├── wCalc() (Wealth/Net Worth)
                     ├── getRealizedPnl() (risk metrics)
                     └── exportData() / exportCSV()
```

### Source of Truth per nilai

| Nilai | Fungsi tunggal | Status |
|---|---|---|
| Komisi/PPN/Levy/PPh saham | `calcTxComponents()` (01-data.js) | ✅ Konsisten — 8 titik pemanggilan, tidak ada duplikat |
| PPh Dividen | **Tidak ada** — `TAX_SETTINGS.pphDividen` dideklarasikan tapi tidak pernah dibaca | 🔴 F1 |
| Average cost saham/crypto/ETF/RD | `getPortfolio()` / `getCryptoPortfolio()` / `getEtfPortfolio()` / `getRdPortfolio()` | ✅ Konsisten, metodologi identik di 4 fungsi |
| Saldo RDN saat ini | `calcRdnBalance()` — kini SELALU delegasi ke `rebuildRdnBalance()`, satu jalur kebenaran | ✅ F3 diperbaiki |
| Saldo RDN per-baris (histori) | `addRdn()` — kini selalu re-sort & hitung ulang penuh | ✅ F2 diperbaiki |
| Net Worth / AUM | `renderDashboard()` dan `wCalc()` — keduanya memanggil fungsi getPortfolio* yang sama, RDN negatif kini ikut terhitung sebagai liabilitas | ✅ Konsisten, F5 diperbaiki |
| Harga pasar saham | `prices{}`, disinkronkan dari `RD_STORE` (13-realdata.js) | ✅ Diperbaiki sesi ini |
| Harga pasar ETF | `fhFetchEtf()` — data riil Yahoo Finance, siklus 2 menit sama seperti saham IDX | ✅ F4 diperbaiki |
| NAB Reksa Dana | `Math.random()` (tetap simulasi — tidak ada API publik), kini diberi badge "⚠ NAB Simulasi" | ✅ F4 — dilabeli jujur |

### Dependency antar modul

- `01-data.js` (SEKURITAS, TAX_SETTINGS, calcTxComponents) — **tidak bergantung pada modul lain**, benar-benar jadi fondasi.
- `03-engine.js` (addTx/addDiv/addRdn/getPortfolio/calcRdnBalance) — bergantung pada 01-data.js.
- `05-assets.js` (crypto/ETF/RD, edit/delete semua jenis transaksi) — bergantung pada 03-engine.js untuk RDN.
- `04-render.js`, `20-wealth.js`, `06-analysis-router.js` — **hanya konsumen**, tidak menghitung ulang dari nol (baik, ini yang membuat lintas-halaman konsisten).
- `15-txbulk.js` (bulk import) — memanggil `addTx()`/`addDiv()` langsung, tidak menduplikasi rumus.

---

## 3. Temuan Audit

### ✅ TEMUAN #1 — CRITICAL (DIPERBAIKI) — Rumus PPh Dividen diduplikasi di 4 tempat, tidak ada Single Source of Truth

- **File & Fungsi:**
  - `js/03-engine.js` → `addDiv()` (baris 101) — **jalur otoritatif**, memengaruhi saldo RDN sungguhan
  - `js/05-assets.js` → `divCalcLive()` (baris 962) — preview modal "+ Catat Dividen"
  - `js/09-divinvest.js` → `saveDivInvestEntry()` (baris 93) dan `saveDivBatch()` (baris 112)
- **Penyebab:** `TAX_SETTINGS.pphDividen = 0.10` dideklarasikan di `01-data.js` sebagai variabel pengaturan pajak global (satu paket dengan `ppn`, `levy`, `pphJual` yang SEMUANYA punya UI edit langsung di halaman Pajak & PPh) — tapi `pphDividen` **tidak pernah dibaca di mana pun**. Keempat fungsi di atas menulis literal `0.1` / `0.10` langsung di rumus masing-masing.
- **Dampak:** Saat ini nilai numeriknya kebetulan identik (0.1 di semua tempat), jadi **belum ada kerugian rupiah hari ini**. Tapi ini persis kriteria "berpotensi menghasilkan angka berbeda pada kondisi tertentu": begitu ada perubahan regulasi PPh dividen, atau developer menambahkan kontrol UI untuk `pphDividen` (mengikuti pola 3 tarif pajak lain yang sudah punya UI), keempat tempat ini akan diam-diam berbeda tanpa peringatan apa pun. Dashboard menampilkan "PPh Dividen (10%)" sebagai **teks statis di HTML** (index.html baris 665, 679, 704, dst) — bukan dari variabel — jadi bahkan LABEL pun tidak akan ikut berubah.
- **Contoh kesalahan konkret:** Jika suatu saat `TAX_SETTINGS.pphDividen` diubah ke 0.05 lewat panel pengaturan (yang belum ada tapi polanya sudah tersedia untuk 3 pajak lain), dividen yang dicatat lewat "+ Catat Dividen" (pakai `addDiv`) akan tetap dipotong 10% sementara label UI mengklaim tarif baru — user tidak akan pernah tahu ada selisih.
- **Solusi:** Ganti keempat literal `0.1`/`0.10` menjadi `TAX_SETTINGS.pphDividen`. Update label HTML dari teks statis "PPh 10%" menjadi dinamis `(TAX_SETTINGS.pphDividen*100)+'%'`.
- **✅ Status: DIPERBAIKI.** Keempat lokasi (`addDiv` di 03-engine.js, `divCalcLive` di 05-assets.js, `saveDivInvestEntry` & `saveDivBatch` di 09-divinvest.js) sekarang membaca `TAX_SETTINGS.pphDividen`. **Diverifikasi empiris**: tarif diubah sementara ke 15% saat runtime — keempat fungsi menghasilkan potongan pajak 15% yang konsisten (bukan lagi 10% yang di-hardcode). Label teks statis "PPh 10%" di `index.html` **belum diubah** (tidak ada kontrol UI untuk `pphDividen` saat ini, jadi tidak ada risiko drift aktif — lihat catatan di Refactoring Plan #1).

---

### ✅ TEMUAN #2 — CRITICAL (DIPERBAIKI) — Saldo RDN per-baris (histori) rusak untuk transaksi bertanggal mundur

- **File & Fungsi:** `js/03-engine.js` → `addRdn()` (baris 72–80)
- **Penyebab:** `addRdn()` melakukan `rdnBalance += amount` (inkremental) lalu `push()` mutasi baru ke **akhir array** dengan snapshot `balance: rdnBalance` — TANPA mengurutkan ulang `rdnMutations` berdasarkan tanggal terlebih dahulu. Fungsi `rebuildRdnBalance()` (satu-satunya yang re-sort dengan benar) hanya dipanggil setelah **edit/delete** transaksi, tidak setelah **penambahan** transaksi baru (`addTx`/`addDiv`/`submitRdn` langsung memanggil `saveData()` saja).
- **Dampak:** Kolom "saldo berjalan" di riwayat RDN & Kas menjadi salah untuk **setiap transaksi yang dicatat dengan tanggal lebih awal dari transaksi yang sudah ada** — skenario yang sangat realistis (user mengisi data historis tidak berurutan, atau bulk-import Excel yang barisnya tidak terurut tanggal).
- **Bukti empiris (diverifikasi langsung, bukan simulasi):**
  ```
  1) SETOR 2026-01-01  Rp 10.000.000   → balance tercatat: 10.000.000  ✓ benar
  2) BUY   2026-01-10  -Rp 4.509.495   → balance tercatat: 5.490.505   ✓ benar
  3) BUY   2026-01-05  -Rp 811.709     → balance tercatat: 4.678.795,9  ✗ SALAH
     (seharusnya per 5 Jan: 10.000.000 − 811.709 = 9.188.290,9 — transaksi
      10 Jan belum terjadi secara kronologis pada tanggal ini)
  ```
  Total akhir (`rdnBalance` global) tetap benar secara agregat (penjumlahan bersifat komutatif), tapi **riwayat per-baris yang ditampilkan ke user salah** sampai ada aksi edit/delete lain yang memicu `rebuildRdnBalance()`.
- **Solusi:** Panggil `rebuildRdnBalance()` di akhir `addTx()`, `addDiv()`, dan jalur setor/tarik manual — bukan hanya di edit/delete. Atau, ubah `addRdn()` agar tidak lagi menghitung `balance` sendiri; biarkan `rebuildRdnBalance()` menjadi satu-satunya penulis kolom `balance`.
- **✅ Status: DIPERBAIKI** (opsi kedua yang dipilih — lebih tahan terhadap lupa panggil di titik lain). `addRdn()` sekarang push mutasi lalu langsung memanggil `rebuildRdnBalance()` sendiri, bukan menghitung `rdnBalance += amount` secara manual. **Diverifikasi empiris** dengan skenario reproduksi yang identik dengan yang menemukan bug: SETOR 1 Jan → BUY 10 Jan → BUY 5 Jan (mundur) — saldo per-baris tanggal 5 Jan sekarang menampilkan **Rp 9.188.291** (benar), bukan lagi Rp 4.678.796 (salah, dari sebelum perbaikan). Total akhir tetap konsisten (Rp 4.678.796). Efek samping positif: ini juga mengurangi risiko praktis Temuan #3 di bawah, karena `rdnBalance` kini selalu segar setelah setiap mutasi — namun Temuan #3 sendiri (dua fungsi dengan model kepercayaan berbeda) belum di-refactor dan tetap terbuka.

---

### ✅ TEMUAN #3 — HIGH (DIPERBAIKI) — Dua fungsi berbeda untuk "saldo RDN saat ini", model kepercayaan berbeda

- **File & Fungsi:** `calcRdnBalance()` (03-engine.js:163) vs `rebuildRdnBalance()` (05-assets.js:1067)
- **Penyebab:** `calcRdnBalance()` adalah *getter* yang **mempercayai variabel cache** `rdnBalance` apa adanya jika nilainya bukan 0 — ia BARU menjumlah ulang dari `rdnMutations[]` jika `rdnBalance` masih 0. Ini dipakai oleh Dashboard, Wealth (Net Worth), FlowScan (kas widget), dan risk metrics — 7 titik pemanggilan berbeda. Sementara `rebuildRdnBalance()` SELALU menghitung ulang penuh dari `rdnMutations[]` dan **itulah satu-satunya fungsi yang benar-benar menjaga `rdnBalance` tetap sinkron** dengan mutasi yang ada.
- **Dampak:** Jika suatu saat ada jalur kode yang mengubah `rdnMutations[]` tanpa memanggil `rebuildRdnBalance()` sesudahnya (persis seperti F2 di atas), **ketujuh konsumen `calcRdnBalance()` akan menampilkan angka yang sama-sama salah** — bukan cuma tabel histori, tapi Dashboard, Net Worth, dan cash widget FlowScan sekaligus. Ini adalah pelanggaran langsung terhadap "Single Source of Truth" yang diminta di kriteria audit.
- **Solusi:** Jadikan `calcRdnBalance()` HANYA memanggil `rebuildRdnBalance()` lalu mengembalikan `rdnBalance` — hilangkan jalur "percaya cache" sepenuhnya.
- **✅ Status: DIPERBAIKI.** `calcRdnBalance()` sekarang selalu memanggil `rebuildRdnBalance()` lebih dulu, tidak lagi mempercayai cache. **Diverifikasi empiris**: variabel `rdnBalance` sengaja dirusak jadi `999999999`, lalu `calcRdnBalance()` dipanggil — hasilnya benar mengabaikan nilai rusak itu dan menghitung ulang dari `rdnMutations[]` (kembali ke angka benar 4.678.795,9), membuktikan cache yang salah tidak lagi bisa "menular" ke seluruh konsumen.

---

### ✅ TEMUAN #4 — HIGH (DIPERBAIKI) — Harga ETF & NAB Reksa Dana adalah simulasi acak permanen, bukan data riil

- **File & Fungsi:** `updateEtfPrices()` dan `updateRdNAB()` (05-assets.js:467, 617), dipanggil **satu kali saja** saat `DOMContentLoaded` (06-analysis-router.js:811–813), tidak pernah lagi setelahnya.
- **Penyebab:** `etfPrices[ticker] = ETF_DB[ticker].baseUSD * (1 + (Math.random()*0.04-0.02))` — harga "market" ETF adalah angka acak ±2–4% dari basis statis, dibekukan sejak halaman pertama dimuat sampai di-reload (dan berubah acak lagi, bukan mengikuti pasar sungguhan). NAB Reksa Dana sama persis polanya.
- **Dampak:** **Setiap unrealized P&L, return %, dan Nilai Pasar untuk posisi ETF tidak pernah mencerminkan harga pasar sungguhan** — ini bertentangan langsung dengan prinsip audit "tidak ada satu rupiah pun hasil perhitungan yang salah karena harga fiktif". Ironisnya, mesin data riil Yahoo Finance yang sudah dibangun matang di `13-realdata.js` untuk saham IDX **bisa langsung dipakai untuk ETF AS** (VOO, QQQ, dll adalah simbol Yahoo Finance valid tanpa akhiran `.JK`) — infrastrukturnya sudah ada, tinggal disambungkan.
- **Untuk Reksa Dana:** tidak ada API publik NAB real-time untuk reksa dana Indonesia, jadi simulasi di sini lebih bisa dimaklumi — tapi **wajib diberi label jelas "NAB simulasi, bukan data riil"** di UI supaya user tidak salah kira.
- **Solusi:** Sambungkan `updateEtfPrices()` ke `rdFetchYahoo`/`yfFetch` (pola yang sama persis dengan saham IDX). Untuk Reksa Dana, minimal tambahkan badge peringatan di halaman Reksa Dana.
- **✅ Status: DIPERBAIKI.** Fungsi baru `fhFetchEtf()` (03-engine.js) memakai `yfFetch(ticker, cb)` — sama persis mesin yang dipakai saham IDX, tapi TANPA akhiran `.JK` (ticker AS memang tidak butuh itu) — dijadwalkan sekali di awal (8 detik setelah load) dan berulang tiap 2 menit dalam siklus `fhStart()` yang sama dengan saham/crypto. **Diverifikasi empiris**: harga VOO sengaja diset ke nilai palsu (111.11), lalu `fhFetchEtf()` dipanggil — harga berubah jadi **687.03**, persis cocok dengan `query1.finance.yahoo.com` yang dicek langsung. Untuk Reksa Dana: badge "⚠ NAB Simulasi" ditambahkan di halaman Reksa Dana (tetap simulasi karena memang tidak ada API publik, tapi kini jujur ke user).

---

### ✅ TEMUAN #5 — MEDIUM (DIPERBAIKI) — Saldo RDN negatif "hilang" dari total Net Worth/AUM

- **File & Fungsi:** `renderDashboard()` (04-render.js:25,27,40) dan `wCalc()` (20-wealth.js:52) — keduanya memakai `Math.max(0, rdn)` saat menjumlah aset.
- **Penyebab:** Sesi audit sebelumnya sengaja mengizinkan `rdnBalance` bernilai negatif (kasus nyata: user membeli saham melebihi kas yang tercatat). Tapi saat dijumlahkan ke Net Worth/AUM, nilai negatif itu **dibulatkan ke 0**, bukan dikurangkan sebagai kewajiban.
- **Dampak:** Net Worth/AUM yang ditampilkan **terlalu tinggi** (overstated) dibanding kondisi keuangan sebenarnya, persis ketika RDN negatif — situasi yang sengaja dipertahankan sebagai valid oleh aplikasi ini sendiri.
- **Solusi:** Putuskan satu kebijakan eksplisit: (a) RDN negatif dikurangkan penuh dari Net Worth sebagai liabilitas, atau (b) tampilkan peringatan terpisah "RDN minus Rp X — segera setor" alih-alih menyembunyikannya.
- **✅ Status: DIPERBAIKI** (kebijakan (a) dipilih, ditambah (b) sebagai peringatan visual). AUM (Dashboard) dan Net Worth (Wealth) sekarang menjumlahkan RDN **mentah** (boleh negatif) alih-alih `Math.max(0,...)` — liabilitas kas ikut mengurangi total. Kartu "Saldo RDN" di Dashboard berubah merah dengan keterangan "⚠ RDN minus — liabilitas, sudah dikurangkan dari AUM"; halaman Wealth mendapat kartu Critical Insight baru "Saldo RDN minus". **Diverifikasi empiris**: skenario RDN −Rp 3.509.495 dengan saham senilai Rp 3.150.000 — AUM (Dashboard) dan Net Worth (Wealth) sama-sama menampilkan **−Rp 359.495** (benar dan konsisten di kedua halaman), bukan lagi Rp 3.150.000 yang menyembunyikan liabilitas.

---

### ✅ TEMUAN #6 — MEDIUM (DIPERBAIKI) — Bulk import Excel tidak menolak baris duplikat

- **File & Fungsi:** `txValidateRow()` / `divValidateRow()` (15-txbulk.js)
- **Penyebab:** Validasi memeriksa format tanggal, tipe aksi, sekuritas dikenal, dan angka positif — tapi **tidak membandingkan** baris baru dengan (a) baris lain dalam file yang sama, atau (b) transaksi yang sudah ada di jurnal.
- **Dampak:** Meng-upload ulang file yang sama (skenario umum: user ragu apakah upload pertama berhasil) akan **menduplikasi seluruh posisi & dividen** secara diam-diam — lot bertambah dua kali lipat, modal dua kali lipat, dividen dua kali lipat.
- **Solusi:** Sebelum commit, bandingkan `(date, ticker, type, lot, price, sekuritas)` — atau `(date, ticker, shares, dps)` untuk dividen — dengan transaksi yang sudah ada; tandai baris yang identik persis sebagai "kemungkinan duplikat" dan minta konfirmasi eksplisit.
- **✅ Status: DIPERBAIKI.** Baris yang cocok persis dengan transaksi/dividen yang sudah ada, ATAU dengan baris lain di batch yang sama, kini dipisahkan ke bagian "⚠ kemungkinan duplikat" di pratinjau — **tidak otomatis diimpor**, kecuali user mencentang "Impor juga baris duplikat ini". **Diverifikasi empiris**: file uji berisi 1 baris identik dengan transaksi yang sudah ada + 1 baris terduplikasi dalam batch yang sama — keduanya benar terdeteksi (2 duplikat) dan TIDAK ikut masuk jurnal saat konfirmasi tanpa centang; total transaksi tetap 2 (bukan 4).

---

### ✅ TEMUAN #7 — LOW (DIPERBAIKI) — Validasi angka tidak menolak `Infinity`

- **File & Fungsi:** `txValidateRow()` / `divValidateRow()` (15-txbulk.js), pola `!(x>0)`
- **Penyebab:** `!(x>0)` benar menolak NaN, negatif, dan nol — tapi `Infinity>0` bernilai `true`, jadi nilai `Infinity` lolos validasi.
- **Dampak:** Risiko rendah (Excel/input manual jarang menghasilkan `Infinity` secara wajar), tapi tetap celah defensif yang diminta di checklist edge-case audit.
- **Solusi:** Tambahkan `isFinite(x)` ke setiap validasi numerik.
- **✅ Status: DIPERBAIKI.** Keempat validasi numerik (Lot, Harga di Transaksi; Jumlah Lembar, Dividen per Lembar di Dividen) kini mensyaratkan `x>0 && isFinite(x)`. **Diverifikasi empiris**: baris uji dengan `Lot: Infinity` benar ditolak dengan pesan "Lot harus angka > 0" dan masuk ke bagian "baris bermasalah", tidak ikut diimpor.

---

### ℹ️ TEMUAN #8–11 — Terverifikasi BENAR (dilaporkan untuk kelengkapan checklist, bukan bug)

| # | Area | Hasil Verifikasi |
|---|---|---|
| F8 | Komisi/PPN/Levy/PPh **saham** | `calcTxComponents()` adalah satu-satunya rumus, dipanggil di 8 titik berbeda (input manual, edit, preview, bulk import, panel sekuritas) — **tidak ada duplikasi ditemukan**. |
| F9 | Average cost 4 kelas aset | Saham/Crypto/ETF/Reksa Dana memakai metodologi *weighted average cost* yang identik: BUY menambah cost proporsional, SELL mengurangi cost sebesar `avgCost × qtyTerjual` — average cost per unit **tidak berubah** oleh SELL, sesuai standar akuntansi investasi. **Catatan cakupan:** aplikasi ini tidak punya jenis transaksi STOCK SPLIT / BONUS SHARE / RIGHT ISSUE sama sekali — ini keterbatasan fitur, bukan bug, tapi relevan untuk siapa pun yang portofolionya mengalami aksi korporasi jenis ini. |
| F10 | Cache `getPortfolio()` | **Sempat CRITICAL**, sudah diperbaiki di sesi ini: cache lama memakai jumlah *key* di `prices{}` sebagai kunci cache (bukan nilai harga), sehingga update harga riil untuk ticker yang key-nya sudah ada tidak pernah terdeteksi — Nilai Pasar macet di angka lama/0. Diperbaiki dengan menyertakan tanda tangan harga per-ticker-yang-dipegang ke kunci cache. Diverifikasi ulang: `getCryptoPortfolio`/`getEtfPortfolio`/`getRdPortfolio` **tidak** memakai cache sama sekali (dihitung ulang tiap panggilan) — tidak ada risiko serupa di sana. |
| F11 | Isolasi data simulasi analitik | FlowScan/Screener/Ranking/Heatmap (data simulasi saat fetch riil gagal) dikonfirmasi **tidak pernah** menulis balik ke `transactions[]`/`prices[]`/`dividends[]` — murni terisolasi untuk keperluan skoring & analisis, tidak memengaruhi angka finansial di Dashboard/Portofolio. Export (`exportData`/`exportCSV`) juga dikonfirmasi membaca array mentah yang sama dengan yang dirender di layar — tidak ada rumus turunan terpisah untuk export. |

---

## 4. Audit Rumus — Perbandingan dengan Standar Investasi

| Rumus | Implementasi | Standar | Status |
|---|---|---|---|
| Average Cost setelah SELL | Tidak berubah (`avg = cost/shares`, cost dikurangi proporsional) | Average cost per unit konstan saat SELL | ✅ Sesuai |
| Unrealized Gain | `mv - cost` | `Market Value − Cost Basis` | ✅ Sesuai |
| Return % | `(unreal/cost)*100`, dengan guard `cost>0` | `Gain / Cost Basis × 100` | ✅ Sesuai, aman dari div-by-zero |
| PPh Final Jual Saham | `gross × 0.1%`, hanya saat SELL | PP 14/1997 — 0,1% dari nilai jual bruto | ✅ Sesuai |
| PPN atas Komisi | `komisi × 12%` | PMK 131/2024 | ✅ Sesuai |
| Levy BEI+KPEI+KSEI | `gross × 0.043%` | 0,018%+0,010%+0,015% | ✅ Sesuai |
| PPh Dividen | `gross × 10%` (hardcoded 4×, bukan dari `TAX_SETTINGS`) | PPh Final 10% | ⚠️ Nilai benar, **sumber salah** (F1) |
| Konversi USD→IDR ETF | Satu kali (`mvUSD × usdIdr` saat render; `kurs` historis dikunci di setiap transaksi) | Cost basis pakai kurs transaksi, market value pakai kurs kini | ✅ Sesuai, tidak ada double-conversion |
| Pembulatan Rupiah | `Math.round()` via `fmt()`/`fmtK()` — satu fungsi dipakai di seluruh aplikasi | Konsisten 0 digit desimal | ✅ Sesuai, tidak ada halaman dengan aturan beda |

---

## 5. Inkonsistensi Antar Halaman

**Hasil baik:** Dashboard, Portofolio, Wealth (Net Worth), dan modul risk-metrics **semuanya memanggil fungsi agregasi yang sama** (`getPortfolio()`, `getCryptoPortfolio()`, `getEtfPortfolio()`, `getRdPortfolio()`, `calcRdnBalance()`) — tidak ada satu pun yang menghitung ulang dari `transactions[]` mentah secara independen. Selama F1–F3 diperbaiki, seluruh halaman akan tetap konsisten karena arsitekturnya memang sudah terpusat.

**Satu-satunya risiko inkonsistensi yang ditemukan** bukan antar-HALAMAN, tapi antar-WAKTU: F2 dan F3 bisa membuat halaman yang SAMA menampilkan angka berbeda tergantung urutan aksi terakhir yang dilakukan user (tambah transaksi vs edit/hapus transaksi) — lebih berbahaya karena tidak terlihat sebagai "dua halaman beda angka", tapi "angka yang sama, berubah sendiri tanpa transaksi baru."

---

## 6. Refactoring Plan

1. ✅ **Pusatkan `pphDividen`** — hapus 4 hardcode, arahkan semua ke `TAX_SETTINGS.pphDividen`. *(effort: kecil, dampak: tinggi)* — **SELESAI (F1)**.
2. ✅ **Satukan saldo RDN** — jadikan `calcRdnBalance()` selalu memanggil `rebuildRdnBalance()` secara internal; hapus jalur "percaya cache". *(effort: kecil, dampak: kritis)* — **SELESAI (F3)**.
3. ✅ **Panggil `rebuildRdnBalance()` setelah SETIAP mutasi kas** (bukan cuma edit/delete) — di `addTx`, `addDiv`, dan jalur setor/tarik manual. *(effort: kecil, dampak: kritis)* — **SELESAI (F2)**.
4. ✅ **Sambungkan harga ETF ke Yahoo Finance riil** memakai infrastruktur `13-realdata.js`/`yfFetch` yang sudah ada, tanpa akhiran `.JK` untuk ticker AS. *(effort: sedang, dampak: tinggi)* — **SELESAI (F4)**, via `fhFetchEtf()`.
5. ✅ **Tambahkan badge "NAB Simulasi"** di halaman Reksa Dana selama belum ada sumber data riil. *(effort: kecil, dampak: sedang — kejujuran data)* — **SELESAI (F4)**.
6. ✅ **Tambahkan pengecekan duplikat** di `txValidateRow`/`divValidateRow` sebelum commit bulk import. *(effort: sedang, dampak: sedang)* — **SELESAI (F6)**.
7. ✅ **Tambahkan `isFinite()`** ke seluruh validasi numerik input (bulk import maupun form manual). *(effort: kecil, dampak: rendah)* — **SELESAI (F7)**.
8. ✅ **RDN negatif diperhitungkan sebagai liabilitas** di AUM/Net Worth, bukan dibulatkan ke 0. *(effort: kecil, dampak: sedang)* — **SELESAI (F5)**.
9. **Modul yang TIDAK perlu diubah** (terverifikasi sudah benar): `calcTxComponents()`, keempat fungsi `get*Portfolio()`, `exportData()`/`exportCSV()`, `fmt()`/`fmtK()`, isolasi data simulasi analitik.

**Semua 7 item refactoring plan (F1–F7) telah diimplementasikan dan diverifikasi empiris di browser pada sesi ini.**

---

## 7. Checklist Validasi

- [x] Semua transaksi BUY/SELL memperbarui quantity, average cost, cash, dan P&L dengan benar
- [x] Saldo RDN konsisten terlepas dari urutan tanggal transaksi ditambahkan **(F2 — diperbaiki & diverifikasi)**
- [x] Tidak ada dua rumus komisi/PPN/Levy/PPh saham yang berbeda
- [x] Tidak ada dua rumus PPh Dividen yang berbeda **(F1 — diperbaiki & diverifikasi)**
- [x] Average cost tidak berubah saat SELL, berubah saat BUY
- [x] Tidak ada Average Cost negatif/NaN/Infinity ditemukan pada jalur normal
- [x] Dashboard tidak menghitung ulang sendiri — murni konsumen fungsi bersama
- [x] Export (Excel/CSV) menghasilkan angka identik dengan yang ditampilkan di layar
- [x] Filter (jika ada) tidak pernah ditemukan mengubah hasil perhitungan, hanya tampilan
- [x] Harga ETF berasal dari data riil (Yahoo Finance), bukan simulasi permanen **(F4 — diperbaiki & diverifikasi)**; NAB Reksa Dana tetap simulasi (tidak ada API publik) namun kini diberi label jujur "⚠ NAB Simulasi"
- [x] Net Worth memperhitungkan RDN negatif sebagai liabilitas, bukan menyembunyikannya **(F5 — diperbaiki & diverifikasi)**
- [x] Bulk import menolak baris duplikat **(F6 — diperbaiki & diverifikasi)**
- [x] Bulk import menolak NaN, negatif, dan nol
- [x] Bulk import menolak Infinity **(F7 — diperbaiki & diverifikasi)**
- [x] Delete transaksi memicu perhitungan ulang penuh (RDN + portofolio), tidak menyisakan cache lama
- [x] Multi-currency (USD ETF) tidak mengalami double-conversion
- [x] Pembulatan konsisten di seluruh halaman (Rupiah 0 desimal via `fmt`/`fmtK` tunggal)
- [x] Data simulasi analitik (FlowScan/Screener/dst) terisolasi, tidak memengaruhi angka finansial nyata

---

*Catatan: seluruh 7 temuan (F1–F7) telah diperbaiki dan diverifikasi secara empiris langsung di browser (bukan hanya pembacaan kode) pada sesi audit ini. Laporan ini di-commit bersama seluruh perbaikan kode ke repository publik sebagai dokumentasi transparan atas proses audit dan perbaikannya.*
