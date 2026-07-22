// ╔══════════════════════════════════════════════════════════╗
// ║  FRESH START — kosongkan semua data injeksi              ║
// ║  User menguji DATA REAL: tidak ada angka contoh/lampiran ║
// ╚══════════════════════════════════════════════════════════╝

// ── 1. Purge localStorage satu kali (data lama hasil injeksi versi sebelumnya) ──
// Berjalan SEBELUM DOMContentLoaded (top-level), jadi loadData() membaca keadaan bersih.
(function(){
  try{
    if(localStorage.getItem('mw_fresh_v6')) return; // sudah pernah dibersihkan
    ['ihsg_pro_master_v5','porto_imported_v1','ihsg_cash_v1','ihsg_divinvest_v1',
     'hw_history','hw_state','claude_api_key','mw_wealth_v1'
    ].forEach(function(k){ localStorage.removeItem(k); });
    localStorage.setItem('mw_fresh_v6','1');
    console.log('🧹 Fresh start: data injeksi lokal dibersihkan');
  }catch(e){}
})();

// ── 2. Nol-kan data pribadi yang tertanam di XLSX_DATA (lampiran lama) ──
// Metadata pasar TETAP dipertahankan: daftar saham (nama/sektor/harga acuan),
// kurs, dan metadata coin — dibutuhkan oleh DB, screener, dan analisa.
(function(){
  if(typeof XLSX_DATA==='undefined') return;
  var zeroNum = ['total_equity','nett_value','change_rp','change_pct','cash','equity_val',
    'crypto_etf','fund_alloc','p2p','cap_gain_2026','dividend_2026','fund_aktif',
    'fund_gain_total','dividend_total'];
  zeroNum.forEach(function(k){ if(k in XLSX_DATA) XLSX_DATA[k]=0; });
  if(Array.isArray(XLSX_DATA.funds))      XLSX_DATA.funds=[];
  if(Array.isArray(XLSX_DATA.dividends))  XLSX_DATA.dividends=[];
  if(XLSX_DATA.fund_margin_by_cat && typeof XLSX_DATA.fund_margin_by_cat==='object') XLSX_DATA.fund_margin_by_cat={};
  ['core_long','swing_trade','fast_trade','sectoral'].forEach(function(k){
    if(Array.isArray(XLSX_DATA[k])) XLSX_DATA[k]=[];
    else if(typeof XLSX_DATA[k]==='number') XLSX_DATA[k]=0;
  });
})();

// ── 3. Kontrol ukuran tampilan (A− / A / A+) ──
// Default 1.15 — teks lebih besar & mudah dibaca; tersimpan per browser.
var MW_ZOOM_KEY = 'mw_ui_zoom';
var MW_ZOOM_DEFAULT = 1.15;
function mwApplyZoom(z){ try{ document.body.style.zoom = z; }catch(e){} }
function mwZoom(delta){
  var z = parseFloat(localStorage.getItem(MW_ZOOM_KEY)) || MW_ZOOM_DEFAULT;
  z = (delta === 0) ? MW_ZOOM_DEFAULT : Math.min(1.6, Math.max(0.85, Math.round((z + delta) * 100) / 100));
  try{ localStorage.setItem(MW_ZOOM_KEY, z); }catch(e){}
  mwApplyZoom(z);
  if(typeof showSaveStatus === 'function') showSaveStatus('Tampilan ' + Math.round(z * 100) + '%');
}
mwApplyZoom(parseFloat(localStorage.getItem(MW_ZOOM_KEY)) || MW_ZOOM_DEFAULT);
