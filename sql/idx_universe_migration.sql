-- ══════════════════════════════════════════════════════════
-- MIGRASI: Sinkronisasi Daftar Saham lintas perangkat
-- ══════════════════════════════════════════════════════════
-- Jalankan SEKALI di Supabase SQL Editor project Money Watch Pro Anda
-- (Dashboard Supabase → SQL Editor → New query → tempel → Run).
--
-- Menambahkan 4 kolom ke tabel user_settings yang sudah ada, untuk
-- menyimpan hasil import Excel IDX Stock Screener (Admin Panel →
-- Kelola Daftar Saham) dan override per-ticker (nama/sektor/exclude),
-- supaya otomatis muncul lagi saat Anda login dari perangkat lain.
--
-- Aman dijalankan berkali-kali (IF NOT EXISTS) dan tidak mengubah/
-- menghapus data yang sudah ada di kolom lain.
-- ══════════════════════════════════════════════════════════

alter table public.user_settings
  add column if not exists idx_universe jsonb,
  add column if not exists idx_universe_info jsonb,
  add column if not exists admin_meta jsonb,
  add column if not exists admin_extra jsonb;

-- Tidak perlu policy RLS baru — kolom baru ini otomatis mengikuti
-- policy row-level yang sudah berlaku di tabel user_settings
-- (biasanya: user hanya boleh baca/tulis baris user_id = auth.uid()
-- miliknya sendiri). Kalau Anda memakai mode tanpa login/auth (device_id),
-- sesuaikan dengan policy yang sudah Anda pakai untuk kolom lain di tabel ini.
