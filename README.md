# 💼 Money Watch Pro

Gabungan **Money Watch** (file utama — jurnal & analisa investasi ala quant trader) dan bagian terbaik **Wealth OS** (personal family office). Satu aplikasi untuk membentuk portofolio pribadi, menganalisanya, dan menganalisa saham **sebelum membeli**.

## Cara Menjalankan

Buka `index.html` langsung di browser (double-click), atau lewat server lokal:

```bash
npx serve .
```

Login memakai akun Supabase yang sama dengan Money Watch lama — data jurnal, transaksi, dan dividen tersinkron otomatis.

## Struktur File

File asli Money Watch (10.700 baris) dipecah menjadi modul yang dimuat berurutan — **isi kode tidak diubah**, hanya dipisah pada batas seksi, sehingga seluruh struktur dan perilaku asli tetap utuh:

| File | Isi |
|---|---|
| `index.html` | Shell aplikasi: auth, topbar, navigasi, semua kontainer halaman |
| `css/main.css` | Seluruh style Money Watch (tema violet glassmorphism) |
| `css/wealth.css` | Style tambahan modul Wealth |
| `js/00-config.js` | Kredensial Supabase |
| `js/01-data.js` | Database sekuritas, tarif pajak BEI/DJP, sektor IDX, database saham, data XLSX |
| `js/02-storage.js` | Sinkronisasi Supabase, localStorage, export/import/backup |
| `js/03-engine.js` | Mesin transaksi/dividen/RDN, kalkulasi portofolio, harga live Yahoo Finance, ticker tape, chart IHSG |
| `js/04-render.js` | Render Dashboard, RDN, Transaksi, Portofolio, Dividen, Sektoral, Risiko, Pajak |
| `js/05-assets.js` | Modal input, Crypto, ETF AS, Reksa Dana, import mutasi |
| `js/06-analysis-router.js` | Candle Analysis, metrik risiko, saran AI, router halaman (`goPage`), init |
| `js/07-flowscan.js` | FlowScan (CMF/RSI/MA/VWAP), Ranking, Heatmap, Scanner, Alerts, Watchlist |
| `js/08-auth.js` | Sistem login (Supabase, sesi 30 menit) |
| `js/09-divinvest.js` | Dividend Investing dashboard |
| `js/10-hargawajar.js` | Harga Wajar — valuasi Margin of Safety |
| `js/11-quant.js` | QuantTrader: Backtester, Screener LQ45, Pairs Trading, Correlation, Monthly Returns |
| `js/12-clean.js` | **BARU** — Fresh start: purge data injeksi lama (sekali jalan) + nol-kan data pribadi lampiran XLSX + kontrol zoom A−/A/A+ |
| `js/13-realdata.js` | **BARU** — Real Data Engine: OHLCV harian 1 thn dari Yahoo (cache per hari di localStorage) untuk FlowScan, Candle, Correlation, Ranking, Heatmap, Scanner, Alerts, Watchlist, Screener + **Verdict Gabungan** di FlowScan (skor 0–100 dari Big Money 30% · Trend MA 25% · RSI 15% · CMF 15% · VWAP 5% · Momentum 3 bln 10%). Setiap halaman menampilkan badge sumber data (RIIL/SIMULASI); bila fetch gagal, fallback simulasi selalu ditandai jelas |
| `js/14-admin.js` | **BARU** — Admin Panel Kelola Daftar Saham: edit nama/sektor, tambah/kecualikan ticker, **import Excel IDX Stock Screener** (reset total universe bawaan), sinkron lintas perangkat via Supabase |
| `js/15-txbulk.js` | **BARU** — Bulk Import Transaksi: download template Excel siap isi + upload banyak transaksi beli/jual sekaligus, dengan pratinjau & validasi per baris sebelum masuk ke jurnal |
| `js/20-wealth.js` | **BARU** — Modul Wealth (adaptasi Wealth OS) |
| `sql/idx_universe_migration.sql` | **BARU** — Migrasi Supabase untuk sinkronisasi Daftar Saham (lihat bagian di bawah) |

Setiap modul JS adalah script global klasik yang dimuat berurutan lewat `<script src>` di `index.html` — persis seperti saat masih satu file.

## Perubahan v6.2 — Visual & Bulk Import Dividen

- **Chart IHSG jadi area chart** dengan latar hitam solid, gradasi hijau/merah mengikuti tren, mengganti candlestick lama. Tinggi kontainer mengikuti ukuran nyata (bukan angka tetap 155px) agar proporsional dengan chart lain (referensi: halaman Monthly Returns).
- **Logo mono color** — SVG "MW" di layar login & topbar yang tadinya dua warna (biru+hijau) sekarang satu warna aksen violet, konsisten dengan tema.
- **Sidebar jadi "spoiler"/accordion** — 6 kategori (Portofolio, Analitik Pra-Beli, Market, Keuangan, Wealth, Pengaturan) bisa dilipat/dibuka per kategori, status tersimpan per browser. Kategori yang berisi halaman aktif otomatis terbuka saat navigasi (termasuk dari tombol di luar sidebar, mis. "Detail →").
- **Bulk import Dividen** (tab Dividen) — tombol **⬇ Download Template** dan **📤 Upload Excel**, pola sama persis dengan bulk import Transaksi: pratinjau & validasi per baris sebelum masuk jurnal, PPh 10% dihitung otomatis, satu kali simpan untuk seluruh batch. Menggantikan tombol "Impor Dividen Lampiran" lama yang sudah tidak berfungsi (mengacu data lampiran yang sudah dikosongkan di v6.1).
- **FIX: Nilai Pasar 0 untuk saham yang baru dibeli/diimpor** — `prices{}` (dipakai Portofolio/Dashboard) dan cache data riil di `js/13-realdata.js` (dipakai FlowScan/Ranking/dst) adalah dua cache terpisah yang sebelumnya tidak saling sinkron; saham yang hanya punya data dari cache kedua tetap tampil harga 0 sampai siklus fetch berkala lain kebetulan menyentuhnya. Sekarang: (1) transaksi baru — manual maupun bulk import — langsung memicu fetch harga riil untuk ticker yang belum punya harga, (2) setiap siklus refresh data riil (termasuk tombol ↻ di Admin Panel) otomatis menyinkronkan harga ke seluruh saham di portofolio Anda.

## Perubahan v6 — Mode Data Real

- **Navigasi pindah ke sidebar kiri** (menggantikan dropdown di topbar), dikelompokkan: Overview, Portofolio, Analitik Pra-Beli, Market, Keuangan, Wealth, Pengaturan.
- **Semua fitur Saran AI dihapus** (kartu 🧠 Saran AI di Dashboard, tab 🤖 AI Analisa di FlowScan, API key Claude).
- **Mulai benar-benar kosong**: injeksi portofolio contoh (23 emiten), transaksi historis, dividen lampiran, crypto contoh, dan riwayat reksa dana lampiran semuanya dinonaktifkan. `js/12-clean.js` juga membersihkan localStorage lama satu kali (flag `mw_fresh_v6`).
- ⚠️ **Data cloud**: jika akun Supabase Anda pernah menyinkron data injeksi versi lama, setelah login buka **💾 Backup → Hapus Semua Data** sekali untuk mengosongkan cloud, lalu isi data real Anda.
- **Harga live Yahoo Finance diperkuat**: semua ticker portofolio diambil tiap siklus (bukan 2 per 2 menit), `previousClose` Yahoo disimpan sehingga % perubahan harian di ticker tape akurat, dan ticker tape hanya menampilkan harga yang sudah terkonfirmasi live (plus USD/IDR & crypto live). Terverifikasi identik dengan endpoint `query1.finance.yahoo.com` untuk saham `.JK` dan IHSG (`^JKSE`).

## Modul Wealth (menu 💼 Wealth ▾)

Bagian terbaik Wealth OS, ditulis ulang mengikuti tema & pola kode Money Watch:

- **🌐 Net Worth** — kekayaan bersih total: nilai portofolio Money Watch (saham + crypto + ETF + reksa dana + kas RDN/wallet, otomatis) + bank + deposito/obligasi/emas + piutang − hutang. Termasuk **Wealth Score** 0–100, donut alokasi aset, passive income engine (memakai dividen riil 12 bulan terakhir dari jurnal), critical insights, dan checklist **Analisa Pra-Beli** yang menautkan toolkit quant.
- **🏦 Bank & Dana Darurat** — rekening di luar RDN + meter dana darurat 3/6 bulan.
- **💳 Hutang** — debt ratio, debt-to-income, strategi pelunasan Avalanche vs Snowball.
- **🧾 Piutang** — progres pembayaran per debitur, collection rate.
- **🔥 FIRE & Proyeksi** — FIRE number 25×, 4% rule, skenario Lean/Regular/Fat, proyeksi 20 tahun (slider CAGR/inflasi/investasi, nominal vs riil), estimasi tahun FIRE.

Data Wealth disimpan di `localStorage` (`mw_wealth_v1`) dengan tombol Export/Import JSON tersendiri di halaman Net Worth. Isi asumsi awal lewat **⚙ Asumsi & Aset Lain** (pemasukan, pengeluaran, deposito, obligasi, emas).

## Alur Analisa Pra-Beli (ala quant trader)

1. **💎 Harga Wajar** — valuasi & margin of safety
2. **🔬 FlowScan** — aliran dana besar (CMF, RSI, MA, VWAP)
3. **🕯 Candle Analysis** — pola & timing entry
4. **⚡ Backtester** — uji strategi pada data historis
5. **🔍 Screener LQ45** — bandingkan dengan alternatif
6. **⚠️ Manajemen Risiko** — position sizing sebelum eksekusi

## Bulk Import Transaksi (tab Transaksi)

Dua tombol baru di tab **Transaksi**:

- **⬇ Download Template** — mengunduh `Template_Transaksi_MoneyWatchPro.xlsx` berisi sheet "Transaksi" siap isi (kolom: Tanggal, Aksi, Kode Saham, Sekuritas, Lot, Harga per Lembar) plus sheet "Daftar Sekuritas" (nama sekuritas yang valid) dan sheet "Petunjuk".
- **📤 Upload Excel** — pilih file yang sudah diisi. Setiap baris divalidasi (format tanggal, Aksi harus BUY/SELL, Sekuritas harus dikenal, Lot & Harga harus angka positif); hasilnya ditampilkan sebagai pratinjau — baris valid dalam tabel, baris bermasalah dengan alasan spesifik per baris — sebelum Anda klik konfirmasi. Komisi, PPN, Levy, dan PPh dihitung otomatis sama seperti input manual (mengikuti sekuritas & tarif pajak yang aktif), bukan diisi dari file.

Tab **Dividen** punya fitur serupa (⬇ Download Template / 📤 Upload Excel): kolom Tanggal, Kode Saham, Jumlah Lembar, Dividen per Lembar — PPh 10% dihitung otomatis dan dividen yang diimpor menambah saldo RDN, sama seperti input manual "+ Catat Dividen".

## Kelola Daftar Saham & Sinkronisasi Lintas Perangkat

Menu **🛠 Kelola Daftar Saham** (sidebar → Pengaturan) punya fitur **Import & RESET TOTAL** dari file Excel resmi IDX Stock Screener (kolom wajib: `Kode Saham`, `Nama Perusahaan`, `Sektor`; opsional: `Subsektor`, `Industri`, `Index`, `Mkt Cap`). Meng-import akan menghapus total universe bawaan dan Screener LQ45 statis, digantikan sepenuhnya oleh isi file — LQ45 otomatis dibangun ulang dari kolom `Index`. Portofolio & watchlist Anda tidak ikut terhapus.

**Agar daftar saham ini otomatis ikut ke perangkat/browser lain saat Anda login**, jalankan migrasi berikut **sekali** di Supabase SQL Editor project Anda:

```
sql/idx_universe_migration.sql
```

Ini menambah 4 kolom (`idx_universe`, `idx_universe_info`, `admin_meta`, `admin_extra`) ke tabel `user_settings` yang sudah ada. Tanpa migrasi ini, fitur import tetap berfungsi penuh tapi **hanya tersimpan lokal di browser tersebut** (aplikasi mendeteksi kolom belum ada dan otomatis melewati sinkronisasi bagian ini tanpa mengganggu sinkronisasi data lain seperti transaksi/dividen). Setelah migrasi dijalankan, import/edit/hapus/kecualikan saham di satu perangkat akan otomatis muncul di perangkat lain saat login berikutnya. Tombol **↺ Kembalikan ke Daftar Bawaan** juga menghapus salinan di cloud, bukan hanya lokal.

## Keamanan & Publikasi ke GitHub

- **Data pribadi sudah dihapus dari kode sumber** (v6.1): nilai portofolio, daftar kepemilikan, riwayat dividen, dan riwayat reksa dana yang dulu tertanam di `js/02-storage.js` dan `js/06-analysis-router.js` sudah diganti metadata pasar netral. Data riil Anda hanya hidup di localStorage browser dan Supabase — tidak pernah masuk repo.
- **Kunci Supabase di `js/00-config.js`** adalah *publishable/anon key* yang memang dirancang untuk sisi klien. Namun keamanannya bergantung pada **Row Level Security (RLS)** — pastikan RLS aktif di SEMUA tabel (`transactions`, `dividends`, `rdn_mutations`, `crypto_tx`, `etf_tx`, `rd_tx`, `user_settings`, `div_invest`) dengan policy `user_id = auth.uid()`. Tanpa RLS, siapa pun yang membaca repo bisa membaca data Anda.
- Jika ragu dengan status RLS, jadikan repo **Private** dulu.
- Aplikasi 100% statis — kompatibel langsung dengan **GitHub Pages** (Settings → Pages → deploy from branch).
