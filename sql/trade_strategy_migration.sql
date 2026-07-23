-- ══════════════════════════════════════════════════════════
-- MIGRASI: Strategi per Emiten & Override Komisi Sekuritas
-- ══════════════════════════════════════════════════════════
-- Jalankan SEKALI di Supabase SQL Editor project Money Watch Pro Anda
-- (Dashboard Supabase → SQL Editor → New query → tempel → Run).
--
-- Tanpa migrasi ini, pilihan "Strategi per Emiten" (Core Long / Swing
-- Trade / Fast Trade) di Dashboard akan terlihat tersimpan sesaat,
-- tapi hilang lagi setelah reload — karena upsert ke user_settings
-- gagal diam-diam (kolom belum ada) dan sesi berikutnya memuat ulang
-- data lama dari Supabase yang masih kosong.
--
-- Menambahkan 2 kolom ke tabel user_settings yang sudah ada:
--   trade_strategy    — pilihan strategi per ticker (Core Long/Swing/Fast)
--   sek_tax_override  — override komisi beli/jual per sekuritas
--
-- Aman dijalankan berkali-kali (IF NOT EXISTS) dan tidak mengubah/
-- menghapus data yang sudah ada di kolom lain.
-- ══════════════════════════════════════════════════════════

alter table public.user_settings
  add column if not exists trade_strategy jsonb,
  add column if not exists sek_tax_override jsonb;

-- Tidak perlu policy RLS baru — kolom baru ini otomatis mengikuti
-- policy row-level yang sudah berlaku di tabel user_settings
-- (biasanya: user hanya boleh baca/tulis baris user_id = auth.uid()
-- miliknya sendiri).
