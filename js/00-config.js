var SUPA_URL = 'https://rcyhwlclvlhwmzlmhfsp.supabase.co';
var SUPA_KEY = 'sb_publishable_WsyRBvZ5luumOeNIXp2IAA_RR3QBi_o';
var _supabase = supabase.createClient(SUPA_URL, SUPA_KEY);
var _currentUser = null;

// Versi skema Supabase yang diharapkan kode ini (lihat sql/schema_migration.sql).
// Dibandingkan dengan kolom schema_version di user_settings saat login — kalau
// belum sesuai, UI menampilkan peringatan supaya drift skema kelihatan di
// aplikasi, bukan cuma di console.
var SCHEMA_VERSION = 2;
window._schemaOutdated = false;
