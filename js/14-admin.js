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
  var keys = (typeof IDX_SECTORS!=='undefined') ? Object.keys(IDX_SECTORS) : [];
  ['IHSG','Lainnya'].forEach(function(k){ if(keys.indexOf(k)===-1) keys.push(k); });
  if(selected && keys.indexOf(selected)===-1) keys = [selected].concat(keys);
  return keys.map(function(k){ return '<option value="'+k+'"'+(k===selected?' selected':'')+'>'+k+'</option>'; }).join('');
}

function adminRenderPage(){
  var pg = el('page-admin'); if(!pg) return;
  var q = (el('adm-search') && el('adm-search').value || '').toUpperCase().trim();
  var all = adminAllKnownTickers();
  if(q) all = all.filter(function(x){ return x.t.indexOf(q) > -1; });
  all.sort(function(a,b){ return a.t.localeCompare(b.t); });

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
    '<div class="cheader"><span class="ctitle">DAFTAR SAHAM DIPANTAU ('+all.length+')</span>'+
      '<input class="finput" id="adm-search" placeholder="Cari kode..." style="width:160px" oninput="adminRenderPage()" value="'+q.replace(/"/g,'&quot;')+'"></div>'+
    '<div style="overflow-x:auto"><table class="tbl"><thead><tr><th>Kode</th><th>Nama</th><th>Sektor</th><th>Sumber</th><th>Status</th><th>Aksi</th></tr></thead><tbody>'+
    (all.length ? all.map(function(x){
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
adminLoadMeta();
adminLoadExtra();
adminApplyOverrides();
