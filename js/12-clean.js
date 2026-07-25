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

// ── 4. Sidebar "spoiler" — grup nav bisa dilipat, status tersimpan per browser ──
var SIDE_OPEN_KEY = 'mw_side_open_groups';
function sideSaveOpenGroups(){
  try{
    var open = [].slice.call(document.querySelectorAll('.side-group.open')).map(function(g){ return g.getAttribute('data-group'); });
    localStorage.setItem(SIDE_OPEN_KEY, JSON.stringify(open));
  }catch(e){}
}
function sideToggleGroup(btn){
  var group = btn.closest('.side-group');
  if(!group) return;
  group.classList.toggle('open');
  sideSaveOpenGroups();
}
function sideSyncActiveGroup(){
  document.querySelectorAll('.side-group').forEach(function(g){ g.classList.remove('has-active'); });
  var activeBtn = document.querySelector('.side-nav button.on');
  if(!activeBtn) return;
  var group = activeBtn.closest('.side-group');
  if(group){ group.classList.add('open','has-active'); sideSaveOpenGroups(); }
}
function sideInit(){
  var saved = null;
  try{ var r = localStorage.getItem(SIDE_OPEN_KEY); if(r) saved = JSON.parse(r); }catch(e){}
  if(saved){
    document.querySelectorAll('.side-group').forEach(function(g){
      if(saved.indexOf(g.getAttribute('data-group')) > -1) g.classList.add('open');
    });
  }
  sideSyncActiveGroup(); // grup berisi halaman aktif selalu ikut terbuka
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', sideInit);
else sideInit();

// Hook goPage supaya grup terkait otomatis terbuka saat navigasi dari luar sidebar
// (mis. tombol "Detail →" di dalam kartu dashboard)
var _sideGoPage = window.goPage;
window.goPage = function(page, btn){
  _sideGoPage.call(this, page, btn);
  sideSyncActiveGroup();
};

// ── 5. Ciutkan sidebar (desktop) — ikon saja, status tersimpan per browser ──
var SIDE_COLLAPSE_KEY = 'mw_side_collapsed';
function sideToggleCollapse(){
  var nav = document.getElementById('side-nav'); if(!nav) return;
  var collapsed = nav.classList.toggle('collapsed');
  try{ localStorage.setItem(SIDE_COLLAPSE_KEY, collapsed?'1':'0'); }catch(e){}
}
(function sideRestoreCollapse(){
  try{
    if(localStorage.getItem(SIDE_COLLAPSE_KEY)==='1'){
      var apply=function(){ var nav=document.getElementById('side-nav'); if(nav) nav.classList.add('collapsed'); };
      if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', apply); else apply();
    }
  }catch(e){}
})();

// ── 6. Cari halaman di sidebar — filter tombol yang cocok, buka grup terkait ──
function sideNavFilter(q){
  q=(q||'').trim().toLowerCase();
  var groups = document.querySelectorAll('.side-group');
  if(!q){
    document.querySelectorAll('.side-nav button').forEach(function(b){ b.classList.remove('side-hit-hidden'); });
    // kembalikan status buka/tutup grup ke preferensi tersimpan, bukan dipaksa terbuka semua
    var saved=null; try{ var r=localStorage.getItem(SIDE_OPEN_KEY); if(r) saved=JSON.parse(r); }catch(e){}
    groups.forEach(function(g){
      var name=g.getAttribute('data-group');
      g.classList.toggle('open', !!(saved && saved.indexOf(name)>-1));
    });
    sideSyncActiveGroup();
    return;
  }
  groups.forEach(function(g){
    var anyMatch=false;
    g.querySelectorAll('.side-group-items button').forEach(function(b){
      var label=(b.querySelector('.side-label')?b.querySelector('.side-label').textContent:b.textContent).toLowerCase();
      var hit=label.indexOf(q)>-1;
      b.classList.toggle('side-hit-hidden', !hit);
      if(hit) anyMatch=true;
    });
    g.classList.toggle('open', anyMatch);
  });
  var topBtn=document.querySelector('.side-nav-scroll > button.on')||document.querySelector('.side-nav-scroll > button');
  document.querySelectorAll('.side-nav-scroll > button').forEach(function(b){
    var label=(b.querySelector('.side-label')?b.querySelector('.side-label').textContent:b.textContent).toLowerCase();
    b.classList.toggle('side-hit-hidden', label.indexOf(q)===-1);
  });
}
// Pintasan keyboard Ctrl/Cmd+K untuk fokus ke kolom cari sidebar
document.addEventListener('keydown', function(e){
  if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='k'){
    var inp=document.getElementById('side-nav-search');
    if(inp){ e.preventDefault(); inp.focus(); inp.select(); }
  }
});
