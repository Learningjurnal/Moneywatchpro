/**
 * Money Watch Pro — AI Proxy (Cloudflare Worker)
 * ================================================
 * Proxy kecil untuk fitur "Konsultasi Live (Claude)" di AI Guide, supaya
 * Anthropic API key TIDAK PERNAH disimpan di browser pengguna (localStorage
 * bisa dibaca lewat DevTools oleh siapa pun yang punya akses ke perangkat
 * itu). Key hanya hidup di sini, sebagai Cloudflare secret di server.
 *
 * Frontend cukup memanggil URL worker ini dengan {prompt}; worker yang
 * menambahkan header x-api-key sebelum meneruskan ke Anthropic.
 *
 * Cara deploy — lihat workers/ai-proxy/README.md.
 */

// Ganti/tambah origin yang boleh memanggil worker ini. Origin GitHub Pages
// Anda WAJIB ada di sini, kalau tidak browser akan memblokir respons (CORS).
const ALLOWED_ORIGINS = [
  'https://learningjurnal.github.io',
  'http://localhost:8123',
  'http://127.0.0.1:8123',
];

const MAX_TOKENS_CAP = 1200; // batas atas, mengabaikan permintaan client yang lebih besar
const MODEL = 'claude-sonnet-4-20250514';

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }
    if (!ALLOWED_ORIGINS.includes(origin)) {
      return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
        status: 403,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }
    if (!env.ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: 'Worker belum dikonfigurasi — ANTHROPIC_API_KEY secret belum di-set' }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Body harus JSON valid' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }
    if (!body || typeof body.prompt !== 'string' || !body.prompt.trim()) {
      return new Response(JSON.stringify({ error: 'Field "prompt" (string) wajib diisi' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: Math.min(body.max_tokens || MAX_TOKENS_CAP, MAX_TOKENS_CAP),
        messages: [{ role: 'user', content: body.prompt }],
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      }),
    });

    const data = await anthropicRes.text(); // teruskan mentah — frontend yang parse
    return new Response(data, {
      status: anthropicRes.status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  },
};
