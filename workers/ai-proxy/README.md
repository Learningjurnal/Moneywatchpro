# AI Proxy — Cloudflare Worker

Menyimpan Anthropic API key di server (Cloudflare), bukan di browser, untuk
fitur **"✨ Konsultasi Live (Claude)"** di AI Guide (Dashboard). Tanpa ini,
fitur tetap berfungsi lewat key yang Anda masukkan sendiri di
**🔑 API Key** (disimpan di `localStorage` browser Anda) — worker ini
opsional, untuk yang ingin key-nya tidak pernah menyentuh browser sama sekali.

Cloudflare Workers punya **free tier** (100.000 request/hari) — cukup untuk
pemakaian personal.

## Deploy (sekali saja)

1. Install Wrangler (CLI resmi Cloudflare), kalau belum ada:
   ```bash
   npm install -g wrangler
   ```
2. Login ke akun Cloudflare Anda:
   ```bash
   wrangler login
   ```
3. Masuk ke folder ini dan deploy:
   ```bash
   cd workers/ai-proxy
   wrangler deploy
   ```
   Wrangler akan menampilkan URL worker Anda, contoh:
   `https://moneywatch-ai-proxy.<username>.workers.dev`
4. Set API key Anthropic sebagai **secret** (tidak pernah tersimpan di kode/repo):
   ```bash
   wrangler secret put ANTHROPIC_API_KEY
   ```
   Tempel API key Anda saat diminta.
5. **Penting:** buka `worker.js`, edit `ALLOWED_ORIGINS` supaya berisi domain
   GitHub Pages Anda yang sebenarnya (mis. `https://username.github.io`),
   lalu `wrangler deploy` ulang. Tanpa ini, browser akan memblokir
   respons worker karena origin tidak dikenali (proteksi CORS).

## Sambungkan ke aplikasi

Di Money Watch Pro: **Dashboard → AI Guide → 🌐 Worker URL**, tempel URL
worker dari langkah 3. Aplikasi otomatis memakai worker ini untuk
"Konsultasi Live" alih-alih memanggil Anthropic langsung dari browser.
Kosongkan lagi untuk kembali ke mode key-di-browser.

## Keamanan

- `ALLOWED_ORIGINS` di `worker.js` adalah satu-satunya proteksi terhadap
  pemakaian tak sah — pastikan hanya berisi domain Anda sendiri.
- Untuk pemakaian publik/banyak pengguna, tambahkan **Rate Limiting Rule**
  di dashboard Cloudflare (Workers & Pages → worker Anda → Settings →
  Rate limiting) supaya satu sumber tidak bisa menghabiskan kuota API key
  Anda dengan spam request.
- `max_tokens` dibatasi maksimum 1200 di sisi worker (`MAX_TOKENS_CAP`),
  mengabaikan permintaan client yang lebih besar — bentuk pertahanan dasar
  terhadap penyalahgunaan kuota.
