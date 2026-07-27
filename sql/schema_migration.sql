-- ══════════════════════════════════════════════════════════
-- MIGRASI SKEMA — Money Watch Pro (KONSOLIDASI)
-- ══════════════════════════════════════════════════════════
-- Jalankan SEKALI di Supabase SQL Editor project Anda
-- (Dashboard Supabase → SQL Editor → New query → tempel → Run).
--
-- File ini MENGGANTIKAN dua migrasi terpisah sebelumnya
-- (idx_universe_migration.sql, trade_strategy_migration.sql) —
-- aman dijalankan kapan pun, termasuk kalau salah satu/keduanya
-- sudah pernah dijalankan (semua kolom pakai IF NOT EXISTS).
--
-- Menambahkan ke tabel user_settings:
--   idx_universe / idx_universe_info  — hasil import Excel Daftar Saham (Admin Panel)
--   admin_meta / admin_extra          — override nama/sektor per-ticker (Admin Panel)
--   trade_strategy                    — pilihan strategi per emiten (Dashboard)
--   sek_tax_override                  — override komisi per sekuritas (Pengaturan Pajak)
--   schema_version                    — penanda versi skema, dibaca aplikasi saat login
--                                        untuk mendeteksi kalau migrasi ini BELUM
--                                        dijalankan, dan menampilkan peringatan di UI
--                                        (bukan cuma di console) supaya tidak ada lagi
--                                        fitur yang "tersimpan tapi hilang lagi setelah
--                                        reload" karena upsert gagal diam-diam.
--
-- Tidak perlu policy RLS baru — kolom baru otomatis mengikuti
-- policy row-level yang sudah berlaku di tabel user_settings.
-- ══════════════════════════════════════════════════════════

alter table public.user_settings
  add column if not exists idx_universe jsonb,
  add column if not exists idx_universe_info jsonb,
  add column if not exists admin_meta jsonb,
  add column if not exists admin_extra jsonb,
  add column if not exists trade_strategy jsonb,
  add column if not exists sek_tax_override jsonb,
  add column if not exists schema_version integer;

-- Tandai baris yang sudah ada (dibuat sebelum migrasi ini) sebagai versi 2,
-- supaya baris lama tidak terus-menerus memicu peringatan "skema belum update"
-- di UI padahal kolomnya sudah baru saja ditambahkan barusan.
update public.user_settings set schema_version = 2 where schema_version is null;

-- ══════════════════════════════════════════════════════════
-- FIX: "data hilang saat pindah device"
-- ══════════════════════════════════════════════════════════
-- Sinkronisasi transaksi/dividen/dll sebelumnya delete-semua-lalu-insert-ulang:
-- kalau insert gagal di tengah jalan (network putus, dsb), baris di cloud
-- sudah kadung terhapus tanpa penggantinya, dan device lain yang login
-- berikutnya menarik tabel yang kosong itu. Kode aplikasi sekarang upsert
-- dulu baru bersihkan baris usang — tapi upsert butuh unique constraint di
-- bawah ini supaya ON CONFLICT (user_id, <id>) bisa bekerja.
--
-- Baris duplikat (kalau ada, dari histori delete+insert yang gagal
-- sebagian) dibersihkan dulu sebelum constraint ditambahkan — disimpan
-- hanya baris dengan ctid terbesar (paling baru) per (user_id, id).

do $$
begin
  delete from public.transactions a using public.transactions b
    where a.user_id=b.user_id and a.tx_id=b.tx_id and a.ctid<b.ctid;
  delete from public.dividends a using public.dividends b
    where a.user_id=b.user_id and a.div_id=b.div_id and a.ctid<b.ctid;
  delete from public.rdn_mutations a using public.rdn_mutations b
    where a.user_id=b.user_id and a.rdn_id=b.rdn_id and a.ctid<b.ctid;
  delete from public.crypto_tx a using public.crypto_tx b
    where a.user_id=b.user_id and a.tx_id=b.tx_id and a.ctid<b.ctid;
  delete from public.etf_tx a using public.etf_tx b
    where a.user_id=b.user_id and a.tx_id=b.tx_id and a.ctid<b.ctid;
  delete from public.rd_tx a using public.rd_tx b
    where a.user_id=b.user_id and a.tx_id=b.tx_id and a.ctid<b.ctid;
end $$;

alter table public.transactions
  drop constraint if exists transactions_user_tx_unique,
  add constraint transactions_user_tx_unique unique (user_id, tx_id);
alter table public.dividends
  drop constraint if exists dividends_user_div_unique,
  add constraint dividends_user_div_unique unique (user_id, div_id);
alter table public.rdn_mutations
  drop constraint if exists rdn_mutations_user_rdn_unique,
  add constraint rdn_mutations_user_rdn_unique unique (user_id, rdn_id);
alter table public.crypto_tx
  drop constraint if exists crypto_tx_user_tx_unique,
  add constraint crypto_tx_user_tx_unique unique (user_id, tx_id);
alter table public.etf_tx
  drop constraint if exists etf_tx_user_tx_unique,
  add constraint etf_tx_user_tx_unique unique (user_id, tx_id);
alter table public.rd_tx
  drop constraint if exists rd_tx_user_tx_unique,
  add constraint rd_tx_user_tx_unique unique (user_id, tx_id);
