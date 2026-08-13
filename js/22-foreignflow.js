// ============================================================
// FOREIGN FLOW — data asing beli/jual RIIL per saham, langsung dari
// API resmi IDX (www.idx.co.id/primary/TradingSummary/GetStockSummary),
// BUKAN estimasi dari volume seperti "Skor Big Money" (CMF) di tab
// Analisa Lengkap. Endpoint ini publik (dipakai situs idx.co.id sendiri
// untuk menampilkan ringkasan perdagangan), tapi TIDAK menyediakan CORS
// untuk domain lain — jadi tetap lewat proxy publik yang sama dengan
// Yahoo Finance (FH.PROXIES di 03-engine.js).
//
// PENTING — batasan jujur: satu request GetStockSummary mengembalikan
// SEMUA ~960 saham IDX untuk SATU tanggal (bukan per-ticker), jadi kita
// filter di sisi klien. Kalau endpoint ini suatu saat berubah/diblokir
// proxy, tab ini akan menampilkan pesan gagal yang jelas — TIDAK diam-diam
// jatuh ke angka simulasi.
// ============================================================

var IDXFS_MEM_CACHE = {}; // 'YYYYMMDD' (tanggal ASLI dari respons) -> rows ringkas

function idxDateStr(d){
  return d.getFullYear()+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0');
}

function idxCacheGet(dateStr){
  if(IDXFS_MEM_CACHE[dateStr]) return IDXFS_MEM_CACHE[dateStr];
  try{
    var raw = localStorage.getItem('mw_idxfs_'+dateStr);
    if(raw){ var rows = JSON.parse(raw); IDXFS_MEM_CACHE[dateStr]=rows; return rows; }
  }catch(e){}
  return null;
}
function idxCacheSet(dateStr, rows){
  IDXFS_MEM_CACHE[dateStr] = rows;
  try{ localStorage.setItem('mw_idxfs_'+dateStr, JSON.stringify(rows)); }catch(e){
    // localStorage penuh — bersihkan cache foreign-flow lama (data lain tidak disentuh)
    try{
      Object.keys(localStorage).filter(function(k){return k.indexOf('mw_idxfs_')===0;})
        .sort().slice(0,5).forEach(function(k){ localStorage.removeItem(k); });
      localStorage.setItem('mw_idxfs_'+dateStr, JSON.stringify(rows));
    }catch(e2){}
  }
}

// ── Fetch 1 hari GetStockSummary via proxy, coba requestedDateStr dulu.
// Hasil di-cache berdasarkan tanggal ASLI dari field `Date` di respons
// (bukan tanggal yang diminta) — supaya weekend/libur yang kebetulan
// dijawab API dengan data hari bursa terakhir tidak dianggap baris baru. ──
function idxFetchStockSummary(requestedDateStr, cb, pi){
  pi = pi||0;
  if(!window.FH || pi >= FH.PROXIES.length){ cb(new Error('ALL_PROXIES_FAILED'), null); return; }
  var yUrl = 'https://www.idx.co.id/primary/TradingSummary/GetStockSummary?date='+requestedDateStr+'&start=0&length=9999';
  fetch(FH.PROXIES[pi](yUrl))
    .then(function(r){ if(!r.ok) throw new Error('HTTP_'+r.status); return r.json(); })
    .then(function(d){
      if(!d || !Array.isArray(d.data) || !d.data.length) throw new Error('NO_DATA');
      var actualDate = (d.data[0].Date||'').slice(0,10).replace(/-/g,'');
      if(!actualDate) throw new Error('NO_DATE');
      // Ringkas — cuma field yang kita perlukan, supaya cache localStorage tidak membengkak
      var rows = d.data.map(function(r){
        return {code:r.StockCode, close:r.Close||0, volume:r.Volume||0,
                fBuy:r.ForeignBuy||0, fSell:r.ForeignSell||0};
      });
      idxCacheSet(actualDate, rows);
      cb(null, {dateStr:actualDate, rows:rows});
    })
    .catch(function(){ idxFetchStockSummary(requestedDateStr, cb, pi+1); });
}

// ── Kumpulkan sampai `wantDays` hari bursa unik (mundur dari hari ini),
// maksimal `maxAttempts` percobaan tanggal kalender supaya tidak mundur
// tanpa batas kalau proxy/endpoint benar-benar gagal total. ──
function idxFetchRecentDays(wantDays, cb){
  var maxAttempts = wantDays + 12; // buffer untuk weekend + libur bursa
  var collected = {}; // dateStr -> rows
  var attempt = 0;
  var anyFetchSucceeded = false;

  function tryNext(cursorDate){
    if(Object.keys(collected).length >= wantDays || attempt >= maxAttempts){
      finish();
      return;
    }
    attempt++;
    var reqStr = idxDateStr(cursorDate);
    var cached = idxCacheGet(reqStr);
    if(cached){
      collected[reqStr] = cached; anyFetchSucceeded = true;
      cursorDate.setDate(cursorDate.getDate()-1);
      tryNext(cursorDate);
      return;
    }
    idxFetchStockSummary(reqStr, function(err, res){
      if(!err && res){
        anyFetchSucceeded = true;
        if(!collected[res.dateStr]) collected[res.dateStr] = res.rows;
      }
      cursorDate.setDate(cursorDate.getDate()-1);
      tryNext(cursorDate);
    });
  }
  function finish(){
    var dates = Object.keys(collected).sort(); // ascending kronologis
    if(!anyFetchSucceeded){ cb(new Error('ALL_FAILED'), null); return; }
    cb(null, dates.map(function(d){ return {dateStr:d, rows:collected[d]}; }));
  }
  tryNext(new Date());
}

var FS_FOREIGN = { loading:false, loadedTk:null, days:null };

function fsRenderForeign(){
  var tk = FS_G.tk;
  var box = el('fs-foreign-body');
  if(!tk || !box) return;

  // Sudah pernah dimuat untuk ticker yang sama — tampilkan lagi tanpa fetch ulang
  if(FS_FOREIGN.loadedTk===tk && FS_FOREIGN.days){
    fsRenderForeignPaint(tk, FS_FOREIGN.days);
    return;
  }
  if(FS_FOREIGN.loading) return;
  FS_FOREIGN.loading = true;
  box.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text3);font-size:11px">⏳ Mengambil data Foreign Flow riil dari IDX…</div>';

  idxFetchRecentDays(7, function(err, days){
    FS_FOREIGN.loading = false;
    if(err || !days || !days.length){
      box.innerHTML = '<div class="alert alert-warn">⚠ Gagal mengambil data Foreign Flow dari IDX (endpoint publik idx.co.id mungkin sedang memblokir proxy, atau semua proxy CORS gratis sedang down). Coba lagi beberapa saat, atau muat ulang halaman. Angka di tab "Analisa Lengkap" (Skor Big Money / CMF) tetap berjalan normal — itu estimasi dari volume, tidak bergantung pada endpoint ini.</div>';
      return;
    }
    FS_FOREIGN.loadedTk = tk;
    FS_FOREIGN.days = days;
    fsRenderForeignPaint(tk, days);
  });
}

function fsRenderForeignPaint(tk, days){
  var box = el('fs-foreign-body');
  var rowsForTk = days.map(function(d){
    var r = d.rows.find(function(x){return x.code===tk;});
    return {date:d.dateStr, close:r?r.close:null, fBuy:r?r.fBuy:0, fSell:r?r.fSell:0, volume:r?r.volume:0, found:!!r};
  });
  var withData = rowsForTk.filter(function(r){return r.found;});
  if(!withData.length){
    box.innerHTML = '<div class="alert alert-warn">⚠ '+tk+' tidak ditemukan di data ringkasan IDX '+days.length+' hari bursa terakhir — kemungkinan kode saham salah, baru IPO, atau sedang suspend.</div>';
    return;
  }

  var last = withData[withData.length-1];
  var netToday = last.fBuy - last.fSell;
  var pctOfVol = last.volume>0 ? (Math.abs(netToday)/last.volume*100) : 0;

  var totalBuy = withData.reduce(function(a,r){return a+r.fBuy;},0);
  var totalSell = withData.reduce(function(a,r){return a+r.fSell;},0);
  var netPeriod = totalBuy-totalSell;

  var fmtLbr = function(n){ return fmtK(n)+' lbr'; };

  var html = '';
  html += '<div class="row4" style="margin-bottom:16px">'
    +'<div class="metric"><div class="mlabel">Foreign Buy (hari terakhir)</div><div class="mval up" style="font-size:16px">'+fmtLbr(last.fBuy)+'</div><div class="msub neu">≈ Rp '+fmtK(last.fBuy*(last.close||0))+'</div></div>'
    +'<div class="metric"><div class="mlabel">Foreign Sell (hari terakhir)</div><div class="mval dn" style="font-size:16px">'+fmtLbr(last.fSell)+'</div><div class="msub neu">≈ Rp '+fmtK(last.fSell*(last.close||0))+'</div></div>'
    +'<div class="metric"><div class="mlabel">Net Foreign (hari terakhir)</div><div class="mval '+(netToday>=0?'up':'dn')+'" style="font-size:16px">'+(netToday>=0?'+':'')+fmtLbr(netToday)+'</div><div class="msub neu">'+pctOfVol.toFixed(1)+'% dari volume hari itu</div></div>'
    +'<div class="metric"><div class="mlabel">Net Foreign ('+withData.length+' hari bursa)</div><div class="mval '+(netPeriod>=0?'up':'dn')+'" style="font-size:16px">'+(netPeriod>=0?'+':'')+fmtLbr(netPeriod)+'</div><div class="msub neu">'+last.date.slice(0,4)+'-'+last.date.slice(4,6)+'-'+last.date.slice(6,8)+' (data terbaru)</div></div>'
    +'</div>';

  html += '<div class="card" style="margin-bottom:16px">'
    +'<div class="cheader"><span class="ctitle">Net Foreign Harian ('+withData.length+' Hari Bursa Terakhir)</span></div>'
    +'<div class="cw" style="height:190px"><canvas id="fsForeignChart"></canvas></div>'
    +'</div>';

  html += '<div class="card">'
    +'<div class="cheader"><span class="ctitle">Rincian Harian</span></div>'
    +'<div style="overflow-x:auto"><table class="tbl"><thead><tr><th>Tanggal</th><th>Foreign Buy</th><th>Foreign Sell</th><th>Net</th><th>% Volume</th></tr></thead><tbody>'
    +withData.slice().reverse().map(function(r){
      var net=r.fBuy-r.fSell, pct=r.volume>0?(Math.abs(net)/r.volume*100):0;
      return '<tr><td class="mono" style="font-size:11px">'+r.date.slice(0,4)+'-'+r.date.slice(4,6)+'-'+r.date.slice(6,8)+'</td>'
        +'<td class="mono up" style="font-size:11px">'+fmtLbr(r.fBuy)+'</td>'
        +'<td class="mono dn" style="font-size:11px">'+fmtLbr(r.fSell)+'</td>'
        +'<td class="mono '+(net>=0?'up':'dn')+'" style="font-size:11px">'+(net>=0?'+':'')+fmtLbr(net)+'</td>'
        +'<td class="mono" style="font-size:11px;color:var(--text2)">'+pct.toFixed(1)+'%</td></tr>';
    }).join('')
    +'</tbody></table></div>'
    +'<div style="font-size:10px;color:var(--text3);margin-top:10px">Sumber: API publik idx.co.id (TradingSummary/GetStockSummary) — data resmi transaksi asing harian, bukan estimasi. Nilai Rupiah adalah perkiraan (lembar × harga penutupan hari itu), bukan nilai transaksi asing yang sebenarnya per lot.</div>'
    +'</div>';

  box.innerHTML = html;

  kc('fsForeign');
  var cv = el('fsForeignChart');
  if(cv){
    charts['fsForeign'] = new Chart(cv,{type:'bar',
      data:{labels:withData.map(function(r){return r.date.slice(4,6)+'/'+r.date.slice(6,8);}),
            datasets:[{data:withData.map(function(r){return r.fBuy-r.fSell;}),
              backgroundColor:withData.map(function(r){return (r.fBuy-r.fSell)>=0?'rgba(65,243,167,.75)':'rgba(226,29,72,.75)';}),
              borderRadius:3}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},
        tooltip:Object.assign({},TT,{callbacks:{label:function(c){return (c.parsed.y>=0?'+':'')+fmtK(c.parsed.y)+' lbr';}}})},
        scales:{x:{ticks:{color:'#8a90ad',font:{size:9}},grid:{display:false}},
                 y:{ticks:{color:'#555d6e',font:{size:9},callback:function(v){return fmtK(v);}},grid:{color:'rgba(255,255,255,.04)'}}}}});
  }
}
