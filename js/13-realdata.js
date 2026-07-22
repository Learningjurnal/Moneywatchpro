// ╔══════════════════════════════════════════════════════════╗
// ║  REAL DATA ENGINE — sambungkan Kelompok B ke Yahoo riil  ║
// ║  FlowScan · Candle · Correlation · Ranking · Heatmap ·   ║
// ║  Scanner · Screener → data OHLCV harian riil (cache/hari)║
// ║  + VERDICT GABUNGAN: satu skor insight dari semua tools  ║
// ╚══════════════════════════════════════════════════════════╝

var RD_STORE  = {};   // tk → rows [{date,open,high,low,close,volume}] — RIIL saja
var RD_STALE  = {};   // tk → rows dari cache hari sebelumnya (fallback lebih baik dari simulasi)
var RD_FAILED = {};   // tk → true bila fetch gagal sesi ini
var RD_META   = { loading:false, universeLoaded:false, scLiveDone:false };
var RD_TODAY  = new Date().toISOString().slice(0,10);

// ── Cache localStorage per hari ──
function rdSave(tk, rows){
  RD_STORE[tk] = rows;
  try{
    var compact = rows.map(function(r){ return [r.date, r.open, r.high, r.low, r.close, r.volume]; });
    localStorage.setItem('mw_rd_'+tk, JSON.stringify({d:RD_TODAY, r:compact}));
  }catch(e){}
}
function _rdExpand(c){ return c.map(function(a){ return {date:a[0], open:a[1], high:a[2], low:a[3], close:a[4], volume:a[5]}; }); }
function rdGet(tk){
  if(RD_STORE[tk]) return RD_STORE[tk];
  try{
    var raw = localStorage.getItem('mw_rd_'+tk);
    if(!raw) return null;
    var o = JSON.parse(raw);
    if(!o || !o.r || !o.r.length) return null;
    var rows = _rdExpand(o.r);
    if(o.d === RD_TODAY){ RD_STORE[tk] = rows; return rows; }
    RD_STALE[tk] = rows; // cache lama: dipakai sebagai fallback, tapi tetap re-fetch
    return null;
  }catch(e){ return null; }
}
function rdGetAny(tk){ return rdGet(tk) || RD_STALE[tk] || null; }
function rdIsReal(tk){ return !!rdGetAny(tk); }

// ── Fetch Yahoo 1 tahun harian — TANPA fallback simulasi (caller yang memutuskan) ──
function rdFetchYahoo(tk, cb, pi){
  pi = pi || 0;
  if(pi >= FH.PROXIES.length){ RD_FAILED[tk] = true; cb(new Error('ALL_PROXIES_FAILED'), null); return; }
  var yUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/' + tk + '.JK?interval=1d&range=1y';
  fetch(FH.PROXIES[pi](yUrl))
  .then(function(r){ if(!r.ok) throw new Error('HTTP_'+r.status); return r.json(); })
  .then(function(d){
    var res = d && d.chart && d.chart.result && d.chart.result[0];
    if(!res || !res.timestamp) throw new Error('NO_DATA');
    var q = res.indicators.quote[0];
    var rows = res.timestamp.map(function(ts,i){
      return {date:new Date(ts*1000).toISOString().slice(0,10),
              open:q.open[i]||0, high:q.high[i]||0, low:q.low[i]||0,
              close:q.close[i]||0, volume:q.volume[i]||0};
    }).filter(function(r){ return r.close > 0; });
    if(rows.length < 20) throw new Error('TOO_FEW');
    rdSave(tk, rows);
    delete RD_FAILED[tk];
    cb(null, rows);
  })
  .catch(function(){ rdFetchYahoo(tk, cb, pi+1); });
}
function rdEnsure(tk, cb){
  if(rdGet(tk)){ cb(null); return; }
  if(RD_FAILED[tk]){ cb('failed'); return; }
  rdFetchYahoo(tk, function(err){ cb(err); });
}

// ── Adapter: rows Yahoo → format FlowScan {dt,o,h,l,c,v,obv,ad,mfv,big,up,mfm} ──
function rdToFs(rows, days){
  var slice = rows.slice(-Math.max(5, days));
  var avgV = slice.reduce(function(s,r){ return s+r.volume; },0) / Math.max(1,slice.length);
  var obv = 0, ad = 0;
  return slice.map(function(r){
    var o=r.open||r.close, h=r.high||r.close, l=r.low||r.close, c=r.close, v=r.volume||0;
    var mfm = (h-l) > 0 ? ((c-l)-(h-c))/(h-l) : 0;
    obv += c >= o ? v : -v;
    ad  += mfm * v;
    return {dt:new Date(r.date), o:o, h:h, l:l, c:c, v:v, obv:obv, ad:ad,
            mfv:mfm*v, big:v > avgV*1.8, up:c >= o, mfm:mfm};
  });
}

// ══════════════════════════════════════════════
// OVERRIDE 1 — fsGenData: cache-first data riil
// Semua pemakai (FlowScan, Ranking, Heatmap, Scanner, Alerts,
// Watchlist, Candle via cdGenOhlcv) otomatis ikut riil.
// ══════════════════════════════════════════════
var _fsGenSim = fsGenData;
fsGenData = function(tk, days){
  var rows = rdGetAny(tk);
  if(rows && rows.length >= 15) return rdToFs(rows, days);
  return _fsGenSim(tk, days);
};

// ══════════════════════════════════════════════
// OVERRIDE 2 — qtFetchOHLCV: cache-first (≤ 1 thn)
// Backtester/Screener/Pairs/Monthly Returns hemat request.
// ══════════════════════════════════════════════
var _qtFetchOrig = qtFetchOHLCV;
qtFetchOHLCV = function(tk, rangeDays, cb){
  var rows = rdGet(String(tk).toUpperCase());
  if(rows && rangeDays <= 380){
    try{
      el('bt-data-status') && (el('bt-data-status').textContent = '✅ Data riil (cache hari ini): '+rows.length+' hari');
      el('bt-src-label') && (el('bt-src-label').textContent = '● LIVE Yahoo (cache)', el('bt-src-label').style.color = 'var(--green)');
    }catch(e){}
    cb(null, rows.slice());
    return;
  }
  _qtFetchOrig(tk, rangeDays, function(err, data){ cb(err, data); });
};

// ══════════════════════════════════════════════
// OVERRIDE 3 — fsRunAnalysis: fetch riil dulu, lalu analisa + VERDICT
// ══════════════════════════════════════════════
var _fsRunOrig = fsRunAnalysis;
fsRunAnalysis = function(){
  var inp = el('fs-ticker-input');
  var tk = (inp ? inp.value : 'BBCA').trim().toUpperCase().replace(/\.JK$/i,'');
  if(!tk) return;
  if(!rdIsReal(tk) && !RD_FAILED[tk]){
    _fsRunOrig();                      // tampilkan dulu (simulasi, ditandai jelas)
    rdRenderVerdict(tk, true);
    rdEnsure(tk, function(err){        // lalu ganti dengan data riil begitu tiba
      _fsRunOrig();
      rdRenderVerdict(tk, false);
      rdUpdateBanners();
    });
    rdUpdateBanners();
    return;
  }
  _fsRunOrig();
  rdRenderVerdict(tk, false);
  rdUpdateBanners();
};

// ══════════════════════════════════════════════
// VERDICT GABUNGAN — satu skor dari semua analitik Kelompok B
// Komponen: Big Money (30%) · Trend MA (25%) · RSI (15%) ·
//           CMF (15%) · VWAP (5%) · Momentum 3 bln (10%)
// ══════════════════════════════════════════════
function rdRenderVerdict(tk, fetching){
  var pg = el('page-flowscan'); if(!pg) return;
  var box = el('rd-verdict');
  if(!box){
    pg.insertAdjacentHTML('afterbegin', '<div id="rd-verdict" style="margin-bottom:11px"></div>');
    box = el('rd-verdict');
  }
  var data = FS_G.data, a = FS_G.a;
  if(!data || !a || FS_G.tk !== tk){ box.innerHTML=''; return; }

  var real = rdIsReal(tk);
  var rows = rdGetAny(tk);
  var last = a.last;

  // — komponen skor —
  var wsum = 0, parts = [];
  function add(label, score, weight, detail){
    wsum += score * weight;
    parts.push({label:label, score:Math.round(score), detail:detail});
  }
  // 1. Big Money (skor FlowScan asli)
  add('Big Money Flow', a.sc, 0.30, a.bu+' hari akumulasi vs '+a.bd+' distribusi');
  // 2. Trend MA
  var tScore = 40, tTxt = 'harga di sekitar MA';
  if(last.ma20 && last.ma50){
    if(last.c > last.ma20 && last.ma20 > last.ma50){ tScore=95; tTxt='uptrend — harga > MA'+a.maFP+' > MA'+a.maSP; }
    else if(last.c > last.ma20){ tScore=70; tTxt='harga di atas MA'+a.maFP; }
    else if(last.c < last.ma20 && last.ma20 < last.ma50){ tScore=10; tTxt='downtrend — harga < MA'+a.maFP+' < MA'+a.maSP; }
    else { tScore=35; tTxt='harga di bawah MA'+a.maFP; }
  }
  add('Trend (MA)', tScore, 0.25, tTxt);
  // 3. RSI
  var r = a.rl, rScore, rTxt;
  if(r >= 45 && r <= 65){ rScore=80; rTxt='sehat ('+r.toFixed(0)+')'; }
  else if(r > 65 && r <= 75){ rScore=55; rTxt='mulai jenuh beli ('+r.toFixed(0)+')'; }
  else if(r > 75){ rScore=25; rTxt='overbought ('+r.toFixed(0)+') — rawan koreksi'; }
  else if(r >= 30){ rScore=55; rTxt='melemah ('+r.toFixed(0)+')'; }
  else { rScore=45; rTxt='oversold ('+r.toFixed(0)+') — bisa technical rebound'; }
  add('Momentum (RSI)', rScore, 0.15, rTxt);
  // 4. CMF
  var cmf = a.cl, cScore, cTxt;
  if(cmf > 0.10){ cScore=90; cTxt='aliran dana masuk kuat ('+cmf.toFixed(2)+')'; }
  else if(cmf > 0){ cScore=65; cTxt='aliran dana positif tipis ('+cmf.toFixed(2)+')'; }
  else if(cmf > -0.10){ cScore=40; cTxt='aliran dana negatif tipis ('+cmf.toFixed(2)+')'; }
  else { cScore=12; cTxt='dana keluar deras ('+cmf.toFixed(2)+')'; }
  add('Money Flow (CMF)', cScore, 0.15, cTxt);
  // 5. VWAP
  var vScore = 50, vTxt = '—';
  try{
    var vw = fsCalcVWAP(data); var lv = vw[vw.length-1];
    if(lv > 0){ if(last.c >= lv){ vScore=75; vTxt='harga di atas VWAP ('+fsP(lv)+')'; } else { vScore=32; vTxt='harga di bawah VWAP ('+fsP(lv)+')'; } }
  }catch(e){}
  add('Posisi vs VWAP', vScore, 0.05, vTxt);
  // 6. Momentum 3 bulan (hanya bermakna pada data riil 1 thn)
  var mScore = 50, mTxt = 'data < 3 bulan';
  if(rows && rows.length > 70){
    var cl2 = rows.map(function(x){return x.close;});
    var m3 = (cl2[cl2.length-1]-cl2[cl2.length-66])/cl2[cl2.length-66]*100;
    if(m3 > 10){ mScore=85; } else if(m3 > 0){ mScore=65; } else if(m3 > -10){ mScore=35; } else { mScore=15; }
    mTxt = (m3>=0?'+':'')+m3.toFixed(1)+'% dalam 3 bulan';
  }
  add('Momentum 3 Bulan', mScore, 0.10, mTxt);

  var total = Math.round(wsum);
  var label, colr, advice;
  if(total >= 70){ label='POTENSI NAIK KUAT'; colr='var(--green)'; advice='Mayoritas indikator selaras positif. Layak lanjut ke Harga Wajar & Backtester untuk konfirmasi, lalu tentukan sizing di Manajemen Risiko.'; }
  else if(total >= 55){ label='CENDERUNG POSITIF'; colr='#7dd87d'; advice='Bias positif tapi belum bulat. Tunggu konfirmasi (harga menembus MA / CMF menguat) atau beli bertahap.'; }
  else if(total >= 45){ label='NETRAL — TUNGGU'; colr='var(--amber)'; advice='Sinyal campuran. Tidak ada edge yang jelas — lebih baik menunggu daripada memaksakan entry.'; }
  else { label='LEMAH — HINDARI'; colr='var(--red)'; advice='Mayoritas indikator negatif. Hindari entry baru; bila sudah punya posisi, evaluasi cut loss di Manajemen Risiko.'; }

  var srcBadge = fetching
    ? '<span class="badge b-gray">⏳ mengambil data riil Yahoo...</span>'
    : real
      ? '<span class="badge b-up">✓ DATA RIIL YAHOO · '+(rows?rows[rows.length-1].date:'')+'</span>'
      : '<span class="badge b-dn">⚠ SIMULASI — fetch gagal, jangan jadikan dasar keputusan</span>';

  box.innerHTML =
  '<div class="card" style="border-color:'+(real?'rgba(129,140,248,.35)':'rgba(255,193,7,.3)')+'">'+
    '<div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap">'+
      '<div style="text-align:center;min-width:130px">'+
        '<div class="mlabel">🎯 VERDICT GABUNGAN</div>'+
        '<div style="font-size:40px;font-weight:800;font-family:\'Share Tech Mono\',monospace;color:'+colr+';line-height:1.1">'+total+'</div>'+
        '<div style="font-size:12px;font-weight:700;color:'+colr+'">'+label+'</div>'+
        '<div style="margin-top:6px">'+srcBadge+'</div>'+
      '</div>'+
      '<div style="flex:1;min-width:260px">'+
        parts.map(function(p){
          var c2 = p.score>=65?'var(--green)':p.score<=35?'var(--red)':'var(--amber)';
          return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">'+
            '<span style="width:130px;font-size:11.5px;color:var(--text2);flex-shrink:0">'+p.label+'</span>'+
            '<div style="flex:1;height:7px;border-radius:99px;background:var(--bg4);overflow:hidden"><div style="height:100%;width:'+p.score+'%;background:'+c2+';border-radius:99px"></div></div>'+
            '<span style="width:30px;text-align:right;font-size:11.5px;font-family:\'Share Tech Mono\',monospace;color:'+c2+'">'+p.score+'</span>'+
            '<span style="width:230px;font-size:10.5px;color:var(--text3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+p.detail+'">'+p.detail+'</span>'+
          '</div>';
        }).join('')+
        '<div style="margin-top:8px;font-size:11.5px;color:var(--text2);line-height:1.6;border-top:1px solid var(--border);padding-top:8px">💡 '+advice+
        ' <span style="color:var(--text3)">Skor = probabilitas relatif, bukan jaminan.</span></div>'+
      '</div>'+
    '</div>'+
  '</div>';
}

// ══════════════════════════════════════════════
// UNIVERSE LOADER — data riil untuk Ranking/Heatmap/Scanner/Alerts/Watchlist
// ══════════════════════════════════════════════
function rdUniverseTickers(){
  // FIX AUDIT: versi lama memotong ke FS_UNIV.slice(0,12) lalu .slice(0,20) total —
  // bila portofolio user sendiri sudah >20 saham (kasus nyata), saham miliknya yang
  // terpotong diam-diam jatuh ke fallback SIMULASI tanpa peringatan (harga acak,
  // itulah sumber "kesalahan penafsiran saham" — PGEO/CDIA/SMDR dsb menampilkan
  // harga fiktif). Sekarang: portofolio, watchlist, dan saham tambahan admin milik
  // user SELALU ikut dimuat tanpa batas. Bagian FS_UNIV (bisa 900+ saham setelah
  // import Excel IDX) dibatasi ke top-N market cap agar tidak membanjiri proxy
  // publik dengan ratusan request sekaligus — sisanya tetap bisa dimuat manual
  // per-saham lewat tombol ↻ di Kelola Daftar Saham.
  var tks = [], seen = {};
  try{ getPortfolio().forEach(function(p){ if(!seen[p.ticker]){ seen[p.ticker]=1; tks.push(p.ticker); } }); }catch(e){}
  try{ FS_WL.forEach(function(w){ if(!seen[w.t]){ seen[w.t]=1; tks.push(w.t); } }); }catch(e){}
  try{ LQ45_STOCKS.forEach(function(s){ if(!seen[s.t]){ seen[s.t]=1; tks.push(s.t); } }); }catch(e){}
  var univSource = FS_UNIV.length > 60
    ? FS_UNIV.slice().sort(function(a,b){ return (b.cap||0)-(a.cap||0); }).slice(0, 30)
    : FS_UNIV;
  univSource.forEach(function(u){ if(!seen[u.t]){ seen[u.t]=1; tks.push(u.t); } });
  if(typeof ADMIN_EXTRA !== 'undefined'){ ADMIN_EXTRA.forEach(function(t){ if(!seen[t]){ seen[t]=1; tks.push(t); } }); }
  if(typeof ADMIN_META !== 'undefined'){ tks = tks.filter(function(t){ return !(ADMIN_META[t] && ADMIN_META[t].excluded); }); }
  return tks;
}

// Retry manual untuk satu ticker — membuka blokir RD_FAILED (dipakai Admin Panel)
function rdRetryTicker(code, cb){
  delete RD_FAILED[code];
  rdFetchYahoo(code, function(err){
    rdRebuildFromReal();
    if(cb) cb(err);
  });
}

function rdLoadUniverse(force){
  if(RD_META.loading) return;
  var all = rdUniverseTickers();
  var tks = all.filter(function(t){ return force ? true : (!rdGet(t) && !RD_FAILED[t]); });
  if(!tks.length){ rdRebuildFromReal(); return; }
  RD_META.loading = true;
  var i = 0, ok = 0;
  (function next(){
    if(i >= tks.length){
      RD_META.loading = false;
      rdRebuildFromReal();
      return;
    }
    var t = tks[i++];
    rdSetBannerText('⏳ Memuat data riil Yahoo: <b>'+t+'</b> ('+i+'/'+tks.length+')... Ranking, Heatmap, Scanner & Watchlist akan otomatis diperbarui.');
    rdFetchYahoo(t, function(err){ if(!err) ok++; setTimeout(next, 1600); });
  })();
}

// Bangun ulang seluruh struktur analisa dari data riil yang tersedia
function rdRebuildFromReal(){
  var realCount = rdUniverseTickers().filter(function(t){ return rdIsReal(t); }).length;
  RD_META.universeLoaded = realCount > 0;
  // FS_RD & FS_WL (pertahankan isi watchlist user)
  var wlTks = FS_WL.map(function(w){ return w.t; });
  FS_WL.length = 0; FS_RD.length = 0;
  try{ fsInit(); }catch(e){}
  // Buang saham yang dikecualikan lewat Admin Panel dari seluruh hasil analisa
  if(typeof ADMIN_META !== 'undefined'){
    var kept = FS_RD.filter(function(r){ return !(ADMIN_META[r.t] && ADMIN_META[r.t].excluded); });
    FS_RD.length = 0; kept.forEach(function(r){ FS_RD.push(r); });
  }
  // Bila data riil sudah ada: Ranking/Heatmap/Scanner/Alerts HANYA menampilkan
  // saham dengan data riil — jangan campur dengan entri simulasi (menyesatkan).
  if(RD_META.universeLoaded || rdUniverseTickers().some(function(t){ return rdIsReal(t); })){
    var realOnly = FS_RD.filter(function(r){ return rdIsReal(r.t); });
    if(realOnly.length >= 5){ FS_RD.length = 0; realOnly.forEach(function(r){ FS_RD.push(r); }); }
  }
  wlTks.forEach(function(t){
    if(!FS_WL.some(function(w){ return w.t===t; })){
      var info = FS_UNIV.find(function(u){ return u.t===t; }) || {t:t, n:t, s:'IHSG', cap:0};
      var d = fsGenData(t, 60);
      FS_WL.push(Object.assign({}, info, {data:d, a:fsProcess(d)}));
    }
  });
  // Screener & Factor Heatmap (QT.scData) dari data riil
  rdBuildScData();
  rdUpdateBanners();
  try{ renderPage(currentPage); }catch(e){}
  setTimeout(rdUpdateBanners, 300);
}

// Sumber kanonik Screener/Heatmap — TIDAK PERNAH difilter, agar exclude di Admin
// Panel bisa di-toggle bolak-balik tanpa kehilangan data (bug lama: memfilter
// QT.scData langsung membuatnya permanen hilang sampai reload halaman).
var _scBaseCache = null;
function rdBuildScData(){
  if(!_scBaseCache){
    if(!QT.scData.length){ try{ scBuildSim(); }catch(e){} }
    _scBaseCache = QT.scData.slice();
  }
  QT.scData = _scBaseCache.map(function(st){
    var rows = rdGetAny(st.t);
    if(!rows || rows.length < 70) return st;
    var close = rows.map(function(r){ return r.close; });
    var rsi2 = qtRSI(close, 14);
    var ma50 = qtSMA(close, 50);
    var rsiLast = rsi2[rsi2.length-1]||50;
    var lc = close[close.length-1], lm = ma50[ma50.length-1];
    var mom1m = (lc-close[close.length-22])/close[close.length-22]*100;
    var mom3m = (lc-close[Math.max(0,close.length-66)])/close[Math.max(0,close.length-66)]*100;
    var w30 = close.slice(-30);
    var vol = Math.sqrt(w30.slice(1).map(function(c,i){ return Math.pow((c-w30[i])/w30[i]*100,2); }).reduce(function(a,b){ return a+b; },0)/29);
    var score = Math.round((50-Math.abs(rsiLast-50))/50*40+(mom1m>0?Math.min(mom1m*2,30):0)+(lc>lm?20:0));
    return Object.assign({}, st, {rsi:rsiLast, mom1m:mom1m, mom3m:mom3m, vol:vol, price:lc, aboveMa:lc>lm, score:score, live:true});
  }).filter(function(st){
    return !(typeof ADMIN_META !== 'undefined' && ADMIN_META[st.t] && ADMIN_META[st.t].excluded);
  });
}

// ══════════════════════════════════════════════
// OVERRIDE 4 — Correlation Matrix: data riil
// ══════════════════════════════════════════════
corrRender = function(){
  var tks = rdUniverseTickers().slice(0, 10);
  if(tks.length < 4) tks = ['BBCA','BBRI','BMRI','TLKM','ASII','ANTM'];
  var returns = {}, realN = 0;
  tks.forEach(function(t){
    var rows = rdGetAny(t);
    var close;
    if(rows && rows.length > 60){ close = rows.slice(-200).map(function(x){ return x.close; }); realN++; }
    else { close = qtGenSim(t, 200).map(function(x){ return x.close; }); }
    returns[t] = close.slice(1).map(function(c,i){ return (c-close[i])/close[i]; });
  });
  // samakan panjang deret (real vs sim bisa beda)
  var minLen = Math.min.apply(null, tks.map(function(t){ return returns[t].length; }));
  tks.forEach(function(t){ returns[t] = returns[t].slice(-minLen); });
  var matrix = tks.map(function(a){ return tks.map(function(b){ return qtPearson(returns[a], returns[b]); }); });

  var mEl = el('corr-matrix');
  if(mEl){
    var h = '<div style="margin-bottom:8px">'+(realN===tks.length
      ? '<span class="badge b-up">✓ DATA RIIL YAHOO — '+realN+' saham, return harian ~'+minLen+' hari</span>'
      : '<span class="badge '+(realN>0?'b-gray':'b-dn')+'">'+(realN>0? realN+'/'+tks.length+' saham riil — sisanya simulasi' : '⚠ SEMUA SIMULASI — muat data riil dulu')+'</span>')+'</div>';
    h += '<div style="overflow-x:auto"><div style="display:grid;grid-template-columns:60px '+tks.map(function(){ return '1fr'; }).join(' ')+';gap:2px">';
    h += '<div></div>'+tks.map(function(t){ return '<div style="font-size:10px;font-weight:700;color:var(--text2);text-align:center;padding:2px">'+t+'</div>'; }).join('');
    tks.forEach(function(a,i){
      h += '<div style="font-size:10px;font-weight:700;color:var(--text2);display:flex;align-items:center;padding-right:4px">'+a+'</div>';
      tks.forEach(function(b,j){
        var v = matrix[i][j], bg, col;
        if(i===j){ bg='rgba(255,255,255,.08)'; col='var(--text3)'; }
        else if(v>0){ var i2=Math.min(1,v/.8); bg='rgba(0,212,170,'+(0.15+i2*.65)+')'; col='var(--green)'; }
        else { var i3=Math.min(1,Math.abs(v)/.8); bg='rgba(255,34,68,'+(0.15+i3*.65)+')'; col='var(--red)'; }
        h += '<div style="background:'+bg+';color:'+col+';display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:600;border-radius:2px;height:30px;margin:1px;font-family:IBM Plex Mono,monospace" title="'+a+' vs '+b+': '+v.toFixed(3)+'">'+(i===j?'1.00':v.toFixed(2))+'</div>';
      });
    });
    h += '</div></div>';
    mEl.innerHTML = h;
  }
  var pairs2 = [];
  tks.forEach(function(a,i){ tks.forEach(function(b,j){ if(j>i) pairs2.push({a:a,b:b,v:matrix[i][j]}); }); });
  pairs2.sort(function(x,y){ return y.v-x.v; });
  var pEl = el('corr-pairs');
  if(pEl){
    var top = pairs2.slice(0,5), bot = pairs2.slice(-5).reverse();
    var row = function(p, colr){ return '<div style="display:flex;justify-content:space-between;padding:6px 9px;background:var(--bg3);border-radius:2px;margin-bottom:4px;border:1px solid var(--border)"><span style="font-family:IBM Plex Mono,monospace;color:var(--text);font-size:12px">'+p.a+' / '+p.b+'</span><span style="color:'+colr+';font-weight:700;font-family:IBM Plex Mono,monospace">'+(p.v>=0?'+':'')+p.v.toFixed(3)+'</span></div>'; };
    pEl.innerHTML = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'
      +'<div><div style="font-size:11px;font-weight:700;color:var(--green);margin-bottom:8px">Korelasi Tertinggi — kandidat pairs trading</div>'+top.map(function(p){ return row(p,'var(--green)'); }).join('')+'</div>'
      +'<div><div style="font-size:11px;font-weight:700;color:var(--red);margin-bottom:8px">Korelasi Terendah — kandidat diversifikasi</div>'+bot.map(function(p){ return row(p, p.v>=0?'var(--amber)':'var(--red)'); }).join('')+'</div>'
      +'</div>';
  }
};

// ══════════════════════════════════════════════
// BANNER STATUS DATA — di semua halaman Kelompok B
// ══════════════════════════════════════════════
var RD_BANNER_PAGES = ['ranking','heatmap','scanner','alerts','watchlist','screener','candle','correlation'];
function rdBannerHtml(){
  var uTks = rdUniverseTickers();
  var realN = uTks.filter(function(t){ return rdIsReal(t); }).length;
  if(RD_META.loading) return '<span style="color:var(--amber)">⏳</span> <span id="rd-banner-txt">Memuat data riil Yahoo...</span>';
  if(realN === 0) return '<span style="color:var(--red)">⚠</span> <b style="color:var(--red)">DATA SIMULASI</b> — belum ada data riil. <button class="btn btn-blue btn-xs" onclick="rdLoadUniverse(true)">📡 Muat Data Riil Yahoo (±30 dtk)</button>';
  var full = realN >= uTks.length;
  return '<span style="color:'+(full?'var(--green)':'var(--amber)')+'">'+(full?'✓':'◐')+'</span> '+
    '<b style="color:'+(full?'var(--green)':'var(--amber)')+'">DATA RIIL YAHOO '+realN+'/'+uTks.length+' saham</b> '+
    '<span style="color:var(--text3)">· harian 1 thn · cache '+RD_TODAY+'</span> '+
    '<button class="btn btn-ghost btn-xs" onclick="rdLoadUniverse(true)">↻ Refresh</button>';
}
function rdUpdateBanners(){
  RD_BANNER_PAGES.forEach(function(p){
    var pg = el('page-'+p); if(!pg) return;
    var b = pg.querySelector('.rd-banner');
    if(!b){
      pg.insertAdjacentHTML('afterbegin', '<div class="rd-banner" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;background:rgba(129,140,248,.07);border:1px solid var(--border2);border-radius:10px;padding:8px 13px;margin-bottom:10px;font-size:12px"></div>');
      b = pg.querySelector('.rd-banner');
    }
    b.innerHTML = rdBannerHtml();
  });
}
function rdSetBannerText(html){
  RD_BANNER_PAGES.forEach(function(p){
    var pg = el('page-'+p); if(!pg) return;
    var b = pg.querySelector('.rd-banner'); if(!b) return;
    b.innerHTML = '<span style="color:var(--amber)">⏳</span> <span>'+html+'</span>';
  });
}

// ══════════════════════════════════════════════
// HOOK NAVIGASI — auto-fetch per halaman
// ══════════════════════════════════════════════
var _rdGoPage = window.goPage;
window.goPage = function(page, btn){
  _rdGoPage.call(this, page, btn);
  if(page === 'candle'){
    var tk = (typeof CD_TICKER !== 'undefined' && CD_TICKER) || null;
    if(tk && !rdIsReal(tk) && !RD_FAILED[tk]){
      rdEnsure(tk, function(err){ try{ renderCandle(); }catch(e){} });
    }
  }
  if(page === 'monthly-returns'){
    var t = (el('mr-ticker') && el('mr-ticker').value) || 'BBCA';
    if(!QT.mrData[t]) setTimeout(function(){ try{ mrFetch(); }catch(e){} }, 400);
  }
  if(page === 'screener' && RD_META.universeLoaded && !RD_META.scLiveDone){
    RD_META.scLiveDone = true;
    setTimeout(function(){ try{ rdBuildScData(); scRenderTable(); }catch(e){} }, 250);
  }
  if(RD_BANNER_PAGES.indexOf(page) >= 0 || page === 'flowscan'){
    setTimeout(rdUpdateBanners, 300);
  }
};

// ── INIT: muat cache hari ini ke memori, lalu auto-load universe ──
(function(){
  rdUniverseTickers().forEach(function(t){ rdGet(t); }); // warm dari localStorage
  setTimeout(function(){ rdLoadUniverse(false); }, 8000); // auto — hanya fetch yang belum ada cache hari ini
  setTimeout(rdUpdateBanners, 1500);
})();
