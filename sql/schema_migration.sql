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
