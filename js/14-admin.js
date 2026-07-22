// ╔══════════════════════════════════════════════════════════╗
// ║  ADMIN PANEL — Kelola Daftar Saham                        ║
// ║  Perbaiki nama/sektor yang salah tafsir, tambah ticker    ║
// ║  baru, kecualikan yang tidak relevan, paksa muat ulang    ║
// ║  data riil per saham. Menutup akar masalah: universe yang ║
// ║  dulu terpotong diam-diam jatuh ke harga simulasi acak.   ║
// ╚══════════════════════════════════════════════════════════╝

var ADMIN_META  = {};  // code -> {name, sector, excluded}
var ADMIN_EXTRA = [];  // kode ticker tambahan yang didaftarkan manual

function adminLoadMeta(){ try{ var r=localStorage.getItem('mw_admin_meta_v1'); if(r) ADMIN_META=JSON.parse(r)||{}; }catch(e){} }
function adminSaveMeta(){ try{ localStorage.setItem('mw_admin_meta_v1', JSON.stringify(ADMIN_META)); }catch(e){} }
function adminLoadExtra(){ try{ var r=localStorage.getItem('mw_admin_extra_v1'); if(r) ADMIN_EXTRA=JSON.parse(r)||[]; }catch(e){} }
function adminSaveExtra(){ try{ localStorage.setItem('mw_admin_extra_v1', JSON.stringify(ADMIN_EXTRA)); }catch(e){} }

// Terapkan override tersimpan ke struktur data inti (FS_UNIV & DB) yang dipakai
// seluruh halaman analisa — sekali diterapkan, perubahan langsung tersebar.
function adminApplyOverrides(){
  ADMIN_EXTRA.forEach(function(code){
    if(!FS_UNIV.some(function(u){ return u.t===code; })){
      var m = ADMIN_META[code]||{};
      FS_UNIV.push({t:code, n:m.name||code, s:m.sector||'IHSG', cap:0});
    }
  });
  Object.keys(ADMIN_META).forEach(function(code){
    var m = ADMIN_META[code];
    var u = FS_UNIV.find(function(x){ return x.t===code; });
    if(u){ if(m.name) u.n=m.name; if(m.sector) u.s=m.sector; }
    if(typeof DB!=='undefined' && DB[code]){ if(m.name) DB[code].name=m.name; if(m.sector) DB[code].sector=m.sector; }
  });
}

function adminAllKnownTickers(){
  var tks=[], seen={};
  try{ getPortfolio().forEach(function(p){ if(!seen[p.ticker]){ seen[p.ticker]=1; tks.push({t:p.ticker, src:'portofolio'}); } }); }catch(e){}
  FS_UNIV.forEach(function(u){ if(!seen[u.t]){ seen[u.t]=1; tks.push({t:u.t, src:'universe'}); } });
  try{ LQ45_STOCKS.forEach(function(s){ if(!seen[s.t]){ seen[s.t]=1; tks.push({t:s.t, src:'lq45'}); } }); }catch(e){}
  ADMIN_EXTRA.forEach(function(t){ if(!seen[t]){ seen[t]=1; tks.push({t:t, src:'custom'}); } });
  return tks;
}

function adminResolve(code){
  var m = ADMIN_META[code]||{};
  var u = FS_UNIV.find(function(x){ return x.t===code; });
  var name = m.name || (u&&u.n) || (typeof DB!=='undefined'&&DB[code]&&DB[code].name) || code;
  var sector = m.sector || (u&&u.s) || (typeof DB!=='undefined'&&DB[code]&&DB[code].sector) || 'Lainnya';
  return {name:name, sector:sector};
}

function adminStatusFor(code){
  if(ADMIN_META[code] && ADMIN_META[code].excluded) return {label:'⛔ Dikecualikan', cls:'b-neu'};
  if(typeof rdIsReal==='function' && rdIsReal(code)){
    var rows = typeof rdGetAny==='function' ? rdGetAny(code) : null;
    var d = rows && rows.length ? rows[rows.length-1].date : '';
    return {label:'✓ REAL · '+d, cls:'b-up'};
  }
  if(typeof RD_FAILED!=='undefined' && RD_FAILED[code]) return {label:'✗ Gagal — SIMULASI', cls:'b-dn'};
  if(typeof RD_META!=='undefined' && RD_META.loading) return {label:'⏳ Antre...', cls:'b-neu'};
  return {label:'○ SIMULASI', cls:'b-dn'};
}

function adminKey(code){ return code.replace(/[^A-Z0-9]/gi,''); }

function adminSectorOptions(selected){
  var keys = idxUniqueSectors() || ((typeof IDX_SECTORS!=='undefined') ? Object.keys(IDX_SECTORS) : []);
  keys = keys.slice();
  ['IHSG','Lainnya'].forEach(function(k){ if(keys.indexOf(k)===-1) keys.push(k); });
  if(selected && keys.indexOf(selected)===-1) keys = [selected].concat(keys);
  return keys.map(function(k){ return '<option value="'+k+'"'+(k===selected?' selected':'')+'>'+k+'</option>'; }).join('');
}

// ══════════════════════════════════════════════
// IMPORT UNIVERSE DARI FILE EXCEL IDX — reset total
// (mis. hasil export "IDX Stock Screener") — menggantikan SELURUH
// universe bawaan (FS_UNIV/DB/LQ45_STOCKS) dengan isi file.
// Portofolio & watchlist milik user TIDAK ikut terhapus.
// ══════════════════════════════════════════════
var IDX_UNIVERSE = null;      // array mentah hasil import terakhir (null = pakai bawaan)
var IDX_UNIVERSE_INFO = null; // {fileName, importedAt, count}

function idxLoadUniverse(){
  try{
    var r = localStorage.getItem('mw_idx_universe_v1');
    if(r) IDX_UNIVERSE = JSON.parse(r);
    var i = localStorage.getItem('mw_idx_universe_info_v1');
    if(i) IDX_UNIVERSE_INFO = JSON.parse(i);
  }catch(e){}
}
function idxSaveUniverse(rows, info){
  try{
    localStorage.setItem('mw_idx_universe_v1', JSON.stringify(rows));
    localStorage.setItem('mw_idx_universe_info_v1', JSON.stringify(info));
  }catch(e){}
}

// RESET TOTAL: timpa FS_UNIV/DB/LQ45_STOCKS bawaan dengan data hasil import.
// DB[].base sengaja 0 (bukan ditebak) — harga sesungguhnya menyusul dari fetch
// Yahoo Finance riil (lihat 13-realdata.js), bukan angka fiktif.
function idxApplyUniverse(){
  if(!IDX_UNIVERSE || !IDX_UNIVERSE.length) return;
  FS_UNIV = IDX_UNIVERSE.map(function(x){ return {t:x.t, n:x.n, s:x.s, cap:x.cap||0}; });
  Object.keys(DB).forEach(function(k){ delete DB[k]; });
  IDX_UNIVERSE.forEach(function(x){ DB[x.t] = {name:x.n, sector:x.s, base:0, beta:1.0}; });
  LQ45_STOCKS = IDX_UNIVERSE.filter(function(x){ return x.idx && x.idx.indexOf('LQ45')>-1; })
                            .map(function(x){ return {t:x.t, n:x.n, s:x.s}; });
  // Buang cache harga untuk ticker yang sudah tidak ada di DB baru (delisted/
  // berganti kode) — mencegah data basi ikut terbawa & dipakai lagi.
  if(typeof prices!=='undefined'){
    Object.keys(prices).forEach(function(t){ if(!DB[t]) delete prices[t]; });
  }
  if(typeof prevCloses!=='undefined'){
    Object.keys(prevCloses).forEach(function(t){ if(!DB[t]) delete prevCloses[t]; });
  }
}

function idxUniqueSectors(){
  if(!IDX_UNIVERSE || !IDX_UNIVERSE.length) return null;
  var set = {};
  IDX_UNIVERSE.forEach(function(x){ if(x.s) set[x.s]=1; });
  return Object.keys(set).sort();
}

function idxImportFile(){
  var inp = el('adm-import-file');
  var f = inp && inp.files && inp.files[0];
  if(!f){ if(typeof showSaveStatus==='function') showSaveStatus('⚠ Pilih file Excel dulu','var(--red)'); return; }
  if(typeof XLSX==='undefined'){ if(typeof showSaveStatus==='function') showSaveStatus('⚠ Pustaka pembaca Excel belum termuat, coba lagi sebentar','var(--red)'); return; }
  if(!confirm('⚠️ RESET TOTAL daftar saham?\n\nSeluruh universe bawaan, Screener LQ45, dan semua saham/override yang pernah Anda tambahkan akan DIHAPUS dan diganti total dengan isi file:\n\n"'+f.name+'"\n\nPortofolio & watchlist Anda TIDAK ikut terhapus. Lanjutkan?')) return;

  if(typeof showSaveStatus==='function') showSaveStatus('📥 Membaca '+f.name+'...');
  var reader = new FileReader();
  reader.onload = function(e){
    try{
      var wb = XLSX.read(new Uint8Array(e.target.result), {type:'array'});
      var sheet = wb.Sheets[wb.SheetNames[0]];
      var rows = XLSX.utils.sheet_to_json(sheet, {defval:''});
      var parsed = rows.map(function(r){
        var code = String(r['Kode Saham']||'').trim().toUpperCase();
        return {
          t: code,
          n: String(r['Nama Perusahaan']||code).trim(),
          s: String(r['Sektor']||'Lainnya').trim(),
          sub: String(r['Subsektor']||'').trim(),
          ind: String(r['Industri']||'').trim(),
          idx: String(r['Index']||'').trim(),
          cap: (parseFloat(r['Mkt Cap'])||0) / 1e12
        };
      }).filter(function(x){ return x.t; });

      if(!parsed.length){
        if(typeof showSaveStatus==='function') showSaveStatus('⚠ Tidak ada baris valid — pastikan file punya kolom "Kode Saham"','var(--red)');
        return;
      }

      IDX_UNIVERSE = parsed;
      var info = {fileName:f.name, importedAt:new Date().toISOString(), count:parsed.length};
      IDX_UNIVERSE_INFO = info;
      idxSaveUniverse(parsed, info);
      idxApplyUniverse();

      // Reset total tambahan admin — nama/sektor override & ticker manual lama sudah tidak relevan
      ADMIN_META = {}; ADMIN_EXTRA = [];
      adminSaveMeta(); adminSaveExtra();

      // Bangun ulang seluruh turunan: Screener/Heatmap, Ranking, banner status
      _scBaseCache = null;
      QT.scData = [];
      RD_META.universeLoaded = false;
      try{ rdRebuildFromReal(); }catch(err){}
      try{ rdLoadUniverse(true); }catch(err){}

      if(typeof showSaveStatus==='function') showSaveStatus('✓ '+parsed.length+' saham diimpor dari '+f.name+' — universe direset total');
      adminRenderPage();
    }catch(err){
      if(typeof showSaveStatus==='function') showSaveStatus('⚠ Gagal membaca Excel: '+err.message,'var(--red)');
    }
  };
  reader.readAsArrayBuffer(f);
}

function idxResetToDefault(){
  if(!confirm('Kembalikan ke daftar saham bawaan (hapus hasil import Excel)? Halaman akan dimuat ulang.')) return;
  try{
    localStorage.removeItem('mw_idx_universe_v1');
    localStorage.removeItem('mw_idx_universe_info_v1');
    localStorage.removeItem('mw_admin_meta_v1');
    localStorage.removeItem('mw_admin_extra_v1');
  }catch(e){}
  location.reload();
}

var ADMIN_RENDER_LIMIT = 100;

function adminRenderPage(){
  var pg = el('page-admin'); if(!pg) return;
  var q = (el('adm-search') && el('adm-search').value || '').toUpperCase().trim();
  var all = adminAllKnownTickers();
  if(q) all = all.filter(function(x){ return x.t.indexOf(q) > -1 || (adminResolve(x.t).name||'').toUpperCase().indexOf(q) > -1; });
  all.sort(function(a,b){ return a.t.localeCompare(b.t); });
  var totalMatch = all.length;
  var capped = all.length > ADMIN_RENDER_LIMIT;
  var display = capped ? all.slice(0, ADMIN_RENDER_LIMIT) : all;

  var totalAll = adminAllKnownTickers().length;
  var realN = adminAllKnownTickers().filter(function(x){ return typeof rdIsReal==='function' && rdIsReal(x.t); }).length;
  var srcLbl = {portofolio:'Portofolio Anda', universe:'Universe bawaan', lq45:'Screener LQ45', custom:'Ditambahkan manual'};

  pg.innerHTML =
  '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">'+
    '<div><div class="ptitle">🛠 Kelola Daftar Saham</div><div class="psub">Perbaiki nama/sektor yang salah, tambah ticker baru, kecualikan yang tidak relevan, atau paksa muat ulang data riil per saham</div></div>'+
    '<button class="btn btn-blue btn-sm" onclick="rdLoadUniverse(true)">📡 Muat Ulang SEMUA Data Riil</button>'+
  '</div>'+
  '<div class="row4" style="margin-top:11px">'+
    '<div class="metric"><div class="mlabel">Total Saham Dipantau</div><div class="mval">'+totalAll+'</div></div>'+
    '<div class="metric"><div class="mlabel">Data Riil</div><div class="mval up">'+realN+'</div></div>'+
    '<div class="metric"><div class="mlabel">Simulasi / Gagal</div><div class="mval dn">'+(totalAll-realN)+'</div></div>'+
    '<div class="metric"><div class="mlabel">Status Muat</div><div class="mval" style="font-size:14px">'+(RD_META.loading?'⏳ Sedang memuat...':'✓ Selesai')+'</div></div>'+
  '</div>'+
  '<div class="card" style="margin-top:11px">'+
    '<div class="cheader"><span class="ctitle">📄 SUMBER DAFTAR SAHAM</span></div>'+
    (IDX_UNIVERSE && IDX_UNIVERSE.length
      ? '<div style="font-size:11.5px;color:var(--text2);line-height:1.8;margin-bottom:10px">'+
          '<span class="badge b-up" style="font-size:9px">✓ IMPOR EXCEL AKTIF</span> — <b>'+(IDX_UNIVERSE_INFO?IDX_UNIVERSE_INFO.fileName:'')+'</b> · '+(IDX_UNIVERSE_INFO?IDX_UNIVERSE_INFO.count:IDX_UNIVERSE.length)+' saham · diimpor '+(IDX_UNIVERSE_INFO?new Date(IDX_UNIVERSE_INFO.importedAt).toLocaleString('id-ID'):'')+'<br>'+
          'Universe bawaan sudah DIHAPUS TOTAL dan digantikan file ini. Screener LQ45 otomatis mengikuti kolom Index di file.'+
        '</div>'+
        '<button class="btn btn-ghost btn-sm" onclick="idxResetToDefault()">↺ Kembalikan ke Daftar Bawaan</button>'
      : '<div style="font-size:11.5px;color:var(--text2);line-height:1.7;margin-bottom:10px">Saat ini memakai <b>universe bawaan</b> ('+totalAll+' saham). Upload file Excel IDX Stock Screener di bawah untuk mengganti total daftar ini dengan data resmi IDX terbaru.</div>')+
    '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;border-top:1px solid var(--border);padding-top:11px;margin-top:2px">'+
      '<div class="fg" style="width:280px"><label class="flabel">File Excel (.xlsx) — kolom wajib: Kode Saham, Nama Perusahaan, Sektor</label><input class="finput" type="file" id="adm-import-file" accept=".xlsx,.xls"></div>'+
      '<button class="btn btn-red btn-sm" onclick="idxImportFile()">📥 Import &amp; RESET TOTAL</button>'+
    '</div>'+
  '</div>'+
  '<div class="card" style="margin-top:11px">'+
    '<div class="cheader"><span class="ctitle">⚠️ KENAPA HARGA BISA SALAH</span></div>'+
    '<div style="font-size:11.5px;color:var(--text2);line-height:1.7">Saham dengan status <span class="badge b-dn" style="font-size:9px">○ SIMULASI</span> menampilkan harga acak, BUKAN harga pasar — biasanya karena belum sempat dimuat, gagal terhubung ke Yahoo Finance, atau baru ditambahkan. Klik <b>↻</b> pada baris tersebut untuk memuat ulang, atau <b>📡 Muat Ulang SEMUA</b> di atas.</div>'+
  '</div>'+
  '<div class="card" style="margin-top:11px">'+
    '<div class="cheader"><span class="ctitle">TAMBAH SAHAM BARU</span></div>'+
    '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end">'+
      '<div class="fg" style="width:120px"><label class="flabel">Kode Saham</label><input class="finput" id="adm-new-code" placeholder="Contoh: GOTO" style="text-transform:uppercase" onkeydown="if(event.key===\'Enter\')adminAddTicker()"></div>'+
      '<div class="fg" style="width:220px"><label class="flabel">Nama Perusahaan</label><input class="finput" id="adm-new-name" placeholder="Opsional — diisi otomatis dari Yahoo jika kosong"></div>'+
      '<div class="fg" style="width:180px"><label class="flabel">Sektor</label><select class="finput fsel" id="adm-new-sector">'+adminSectorOptions()+'</select></div>'+
      '<button class="btn btn-green btn-sm" onclick="adminAddTicker()">+ Tambah &amp; Muat</button>'+
    '</div>'+
  '</div>'+
  '<div class="card" style="margin-top:11px">'+
    '<div class="cheader"><span class="ctitle">DAFTAR SAHAM DIPANTAU ('+totalMatch+')</span>'+
      '<input class="finput" id="adm-search" placeholder="Cari kode / nama..." style="width:200px" oninput="adminRenderPage()" value="'+q.replace(/"/g,'&quot;')+'"></div>'+
    (capped ? '<div style="font-size:10.5px;color:var(--amber);margin-bottom:8px">⚠ Menampilkan '+ADMIN_RENDER_LIMIT+' dari '+totalMatch+' saham — ketik kode/nama di kolom pencarian untuk mempersempit.</div>' : '')+
    '<div style="overflow-x:auto"><table class="tbl"><thead><tr><th>Kode</th><th>Nama</th><th>Sektor</th><th>Sumber</th><th>Status</th><th>Aksi</th></tr></thead><tbody>'+
    (display.length ? display.map(function(x){
      var code = x.t, key = adminKey(code);
      var r = adminResolve(code);
      var st = adminStatusFor(code);
      var excluded = ADMIN_META[code] && ADMIN_META[code].excluded;
      return '<tr>'+
        '<td class="mono" style="font-weight:600">'+code+'</td>'+
        '<td><input class="finput" id="adm-name-'+key+'" value="'+r.name.replace(/"/g,'&quot;')+'" style="min-width:170px"></td>'+
        '<td><select class="finput fsel" id="adm-sector-'+key+'" style="min-width:150px">'+adminSectorOptions(r.sector)+'</select></td>'+
        '<td style="font-size:10.5px;color:var(--text3)">'+(srcLbl[x.src]||x.src)+'</td>'+
        '<td><span class="badge '+st.cls+'" style="font-size:10px">'+st.label+'</span></td>'+
        '<td style="white-space:nowrap"><div style="display:flex;gap:4px">'+
          '<button class="btn btn-ghost btn-xs" onclick="adminSaveRow(\''+code+'\')" title="Simpan nama/sektor">💾</button>'+
          '<button class="btn btn-ghost btn-xs" onclick="adminRefreshRow(\''+code+'\')" title="Muat ulang data riil dari Yahoo">↻</button>'+
          '<button class="btn '+(excluded?'btn-green':'btn-amber')+' btn-xs" onclick="adminToggleExclude(\''+code+'\')" title="'+(excluded?'Sertakan kembali ke analisa':'Kecualikan dari semua analisa')+'">'+(excluded?'✓ Sertakan':'⛔ Kecualikan')+'</button>'+
          (x.src==='custom' ? '<button class="btn btn-red btn-xs" onclick="adminDeleteCustom(\''+code+'\')" title="Hapus dari daftar">🗑</button>' : '')+
        '</div></td>'+
      '</tr>';
    }).join('') : '<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:20px">Tidak ada saham cocok pencarian.</td></tr>')+
    '</tbody></table></div>'+
  '</div>';
}

function adminAddTicker(){
  var code = (el('adm-new-code').value||'').toUpperCase().trim().replace(/\.JK$/,'');
  var name = (el('adm-new-name').value||'').trim();
  var sector = el('adm-new-sector').value;
  if(!code){ if(typeof showSaveStatus==='function') showSaveStatus('⚠ Kode saham wajib diisi','var(--red)'); return; }
  if(ADMIN_EXTRA.indexOf(code)===-1 && !FS_UNIV.some(function(u){ return u.t===code; })) ADMIN_EXTRA.push(code);
  ADMIN_META[code] = Object.assign({}, ADMIN_META[code]||{}, {name:name||code, sector:sector, excluded:false});
  adminSaveExtra(); adminSaveMeta();
  adminApplyOverrides();
  el('adm-new-code').value=''; el('adm-new-name').value='';
  if(typeof showSaveStatus==='function') showSaveStatus('✓ '+code+' ditambahkan — memuat data riil...');
  adminRenderPage();
  rdRetryTicker(code, function(){ adminRenderPage(); });
}

function adminSaveRow(code){
  var key = adminKey(code);
  var nameEl = el('adm-name-'+key), secEl = el('adm-sector-'+key);
  ADMIN_META[code] = Object.assign({}, ADMIN_META[code]||{}, {
    name: nameEl ? nameEl.value.trim() : '',
    sector: secEl ? secEl.value : ''
  });
  adminSaveMeta();
  adminApplyOverrides();
  try{ rdRebuildFromReal(); }catch(e){}
  if(typeof showSaveStatus==='function') showSaveStatus('✓ '+code+' disimpan');
  adminRenderPage();
}

function adminRefreshRow(code){
  if(typeof showSaveStatus==='function') showSaveStatus('📡 Memuat ulang '+code+'...');
  rdRetryTicker(code, function(err){
    if(typeof showSaveStatus==='function') showSaveStatus(err ? '⚠ '+code+' gagal — tetap simulasi' : '✓ '+code+' data riil termuat');
    adminRenderPage();
  });
}

function adminToggleExclude(code){
  var cur = ADMIN_META[code]||{};
  cur.excluded = !cur.excluded;
  ADMIN_META[code] = cur;
  adminSaveMeta();
  try{ rdRebuildFromReal(); }catch(e){}
  adminRenderPage();
}

function adminDeleteCustom(code){
  ADMIN_EXTRA = ADMIN_EXTRA.filter(function(t){ return t!==code; });
  delete ADMIN_META[code];
  adminSaveExtra(); adminSaveMeta();
  FS_UNIV = FS_UNIV.filter(function(u){ return u.t!==code; });
  try{ rdRebuildFromReal(); }catch(e){}
  adminRenderPage();
}

// ── Router hook — pola sama dengan modul Wealth/QuantTrader ──
var _adminGoPage = window.goPage;
window.goPage = function(page, btn){
  _adminGoPage.call(this, page, btn);
  if(page === 'admin') adminRenderPage();
};

// ── INIT ──
// Urutan penting: terapkan universe hasil import (jika ada) SEBELUM override
// admin per-ticker, supaya override selalu menimpa di atas dasar yang aktif.
idxLoadUniverse();
idxApplyUniverse();
adminLoadMeta();
adminLoadExtra();
adminApplyOverrides();
