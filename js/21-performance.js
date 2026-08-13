// ============================================================
// PORTFOLIO PERFORMANCE — halaman analisa kinerja portofolio
// (Total Equity, Riwayat Ekuitas, Alokasi, Kumulatif vs IHSG,
// Ringkasan Trading, Realized Gain & Dividen, + Manajemen Risiko
// yang dipindahkan dari Dashboard). Semua angka dihitung dari data
// riil aplikasi (transactions[]/dividends[]/equityHistory) — tidak
// ada simulasi, kecuali dicatat jelas (lihat catatan benchmark IHSG).
// ============================================================

var PERF_STATE = { eqPeriod:'YTD', allocMode:'saham' };

function renderPerformance(){
  if(typeof equitySnapshotToday==='function') equitySnapshotToday(); // jaga-jaga kalau user langsung buka halaman ini tanpa lewat Dashboard dulu
  perfRenderEquity(PERF_STATE.eqPeriod);
  perfRenderAllocation(PERF_STATE.allocMode);
  perfRenderBenchmark();
  perfRenderTradeSummary();
  perfRenderRealized();
  if(typeof renderRisiko==='function') renderRisiko();
}

// ── Filter array {date,...} berdasarkan periode, relatif ke tanggal TERAKHIR di array ──
function perfFilterByPeriod(hist, period){
  if(!hist || !hist.length || period==='ALL') return hist||[];
  var last = new Date(hist[hist.length-1].date);
  var cutoff = new Date(last);
  if(period==='1W') cutoff.setDate(cutoff.getDate()-7);
  else if(period==='1M') cutoff.setMonth(cutoff.getMonth()-1);
  else if(period==='3M') cutoff.setMonth(cutoff.getMonth()-3);
  else if(period==='YTD') cutoff = new Date(last.getFullYear(),0,1);
  else if(period==='1Y') cutoff.setFullYear(cutoff.getFullYear()-1);
  var cutoffStr = cutoff.toISOString().slice(0,10);
  return hist.filter(function(h){ return h.date >= cutoffStr; });
}

function perfSetEqPeriod(period, btn){
  PERF_STATE.eqPeriod = period;
  var box = el('perf-eq-period');
  if(box) box.querySelectorAll('.pbtn').forEach(function(b){ b.classList.remove('on'); });
  if(btn) btn.classList.add('on');
  perfRenderEquity(period);
}

// ── Total Equity: hero + chart + tabel riwayat (data riil equityHistory) ──
function perfRenderEquity(period){
  var full = (typeof equityHistoryLoad==='function') ? equityHistoryLoad() : [];
  var filtered = perfFilterByPeriod(full, period);
  var valEl = el('perf-equity-value'), subEl = el('perf-equity-sub'), cntEl = el('perf-eq-table-count');

  if(full.length===0){
    if(valEl) valEl.textContent = 'Rp '+fmtK((typeof computeCurrentAUM==='function')?computeCurrentAUM():0);
    if(subEl) subEl.innerHTML = '<span style="color:var(--text3)">Riwayat ekuitas terkumpul otomatis tiap hari Anda membuka aplikasi — kembali besok untuk mulai melihat grafik.</span>';
    if(cntEl) cntEl.textContent = '0 hari';
    kc('perfEq');
    el('perf-eq-tbody').innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--text3);padding:16px">Belum ada riwayat</td></tr>';
    return;
  }

  var latest = full[full.length-1].equity;
  if(valEl) valEl.textContent = 'Rp '+fmtK(latest);

  if(filtered.length>=2){
    var base = filtered[0].equity;
    var chg = latest-base, chgPct = base>0?(chg/base*100):0;
    if(subEl) subEl.innerHTML = '<span class="'+(chg>=0?'up':'dn')+'">'+(chg>=0?'▲ +':'▼ ')+'Rp '+fmtK(Math.abs(chg))+' ('+(chgPct>=0?'+':'')+chgPct.toFixed(2)+'%)</span> <span style="color:var(--text3)">periode '+period+'</span>';
  } else {
    if(subEl) subEl.innerHTML = '<span style="color:var(--text3)">Data periode ini belum cukup — coba periode lebih panjang</span>';
  }
  if(cntEl) cntEl.textContent = full.length+' hari tercatat';

  // Chart
  kc('perfEq');
  var cv = el('perfEquityChart');
  if(cv && filtered.length>=2){
    var grad = cv.getContext('2d').createLinearGradient(0,0,0,190);
    grad.addColorStop(0,'rgba(47,106,243,.35)'); grad.addColorStop(1,'rgba(47,106,243,0)');
    charts['perfEq'] = new Chart(cv,{type:'line',data:{labels:filtered.map(function(h){return h.date;}),
      datasets:[{data:filtered.map(function(h){return h.equity;}),borderColor:'#2f6af3',backgroundColor:grad,fill:true,tension:.3,pointRadius:0,borderWidth:2}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:Object.assign({},TT,{callbacks:{label:function(c){return 'Rp '+fmtK(c.parsed.y);}}})},
        scales:{x:{ticks:{color:'#8a90ad',font:{size:9},maxTicksLimit:7},grid:{display:false}},
                 y:{ticks:{color:'#555d6e',font:{size:9},callback:function(v){return fmtK(v);}},grid:{color:'rgba(255,255,255,.04)'}}}}});
  }

  // Tabel riwayat — reverse kronologis, P&L dihitung dari FULL history (bukan hasil filter)
  // supaya baris pertama di periode manapun tetap benar dibanding hari sebelumnya.
  var rows = filtered.slice().reverse().map(function(h){
    var i = full.indexOf(h);
    var prevEq = i>0 ? full[i-1].equity : h.equity;
    var pnl = h.equity - prevEq;
    return {date:h.date, equity:h.equity, pnl:pnl};
  });
  el('perf-eq-tbody').innerHTML = rows.length ? rows.map(function(r){
    return '<tr><td class="mono" style="font-size:11px">'+r.date+'</td>'
      +'<td class="mono" style="font-size:11px">Rp '+fmtK(r.equity)+'</td>'
      +'<td class="mono '+(r.pnl>=0?'up':'dn')+'" style="font-size:11px">'+(r.pnl>=0?'+':'')+'Rp '+fmtK(r.pnl)+'</td></tr>';
  }).join('') : '<tr><td colspan="3" style="text-align:center;color:var(--text3);padding:16px">Tidak ada data di periode ini</td></tr>';
}

// ── Alokasi Portofolio: donut Saham vs Sektor ──
function perfSetAllocMode(mode, btn){
  PERF_STATE.allocMode = mode;
  var container = btn ? btn.closest('.cheader') : null;
  if(container) container.querySelectorAll('.pbtn').forEach(function(b){ b.classList.remove('on'); });
  if(btn) btn.classList.add('on');
  perfRenderAllocation(mode);
}
function perfRenderAllocation(mode){
  var porto = (typeof getPortfolio==='function') ? getPortfolio() : [];
  var total = porto.reduce(function(a,p){return a+p.mv;},0);
  var items;
  if(mode==='sektor'){
    var bySec = {};
    porto.forEach(function(p){ var s=p.info.sector||'Lainnya'; bySec[s]=(bySec[s]||0)+p.mv; });
    items = Object.keys(bySec).map(function(s,i){ return {label:s, val:bySec[s], color:COLORS[i%12]}; });
  } else {
    items = porto.map(function(p,i){ return {label:p.ticker, val:p.mv, color:COLORS[i%12]}; });
  }
  items.sort(function(a,b){ return b.val-a.val; });

  el('perf-alloc-center-val').textContent = 'Rp '+fmtK(total);
  el('perf-alloc-center-sub').textContent = porto.length+' '+(mode==='sektor'?'sektor':'posisi');

  kc('perfAlloc');
  var cv = el('perfAllocDonut');
  if(cv && items.length){
    charts['perfAlloc'] = new Chart(cv,{type:'doughnut',
      data:{labels:items.map(function(x){return x.label;}),
            datasets:[{data:items.map(function(x){return x.val;}),backgroundColor:items.map(function(x){return x.color;}),borderWidth:0,hoverOffset:4}]},
      options:{responsive:true,maintainAspectRatio:false,cutout:'68%',
        plugins:{legend:{display:false},tooltip:Object.assign({},TT,{callbacks:{label:function(c){return c.label+': Rp '+fmtK(c.parsed);}}})}}});
  }
  el('perf-alloc-legend').innerHTML = items.length ? items.map(function(x){
    var pct = total>0 ? (x.val/total*100) : 0;
    return '<div style="display:flex;align-items:center;gap:7px;padding:4px 0">'
      +'<span style="width:8px;height:8px;border-radius:2px;background:'+x.color+';flex-shrink:0"></span>'
      +'<span style="font-size:11px;color:var(--text2);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+x.label+'</span>'
      +'<span class="mono" style="font-size:11px;font-weight:600">'+pct.toFixed(1)+'%</span>'
      +'</div>';
  }).join('') : '<div style="color:var(--text3);font-size:11px;text-align:center;padding:16px">Belum ada posisi saham</div>';
}

// ── Fetch historis harian IHSG (^JKSE) via Yahoo — infrastruktur sama dengan
// rdFetchYahoo() di 13-realdata.js, TAPI simbolnya TIDAK boleh diberi akhiran
// .JK (itu cuma berlaku untuk ticker saham individual, bukan indeks). ──
function rdFetchIhsgDaily(cb, pi){
  pi = pi||0;
  var cached = (typeof rdGetAny==='function') ? rdGetAny('IHSG_DAILY') : null;
  if(cached){ cb(null, cached); return; }
  if(!window.FH || pi >= FH.PROXIES.length){ cb(new Error('ALL_PROXIES_FAILED'), null); return; }
  var yUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/'+FH.IHSG_SYM+'?interval=1d&range=2y';
  fetch(FH.PROXIES[pi](yUrl))
    .then(function(r){ if(!r.ok) throw new Error('HTTP_'+r.status); return r.json(); })
    .then(function(d){
      var res = d && d.chart && d.chart.result && d.chart.result[0];
      if(!res || !res.timestamp) throw new Error('NO_DATA');
      var q = res.indicators.quote[0];
      var rows = res.timestamp.map(function(ts,i){
        return {date:new Date(ts*1000).toISOString().slice(0,10), close:q.close[i]||0};
      }).filter(function(r){ return r.close>0; });
      if(rows.length<20) throw new Error('TOO_FEW');
      if(typeof rdSave==='function') rdSave('IHSG_DAILY', rows);
      cb(null, rows);
    })
    .catch(function(){ rdFetchIhsgDaily(cb, pi+1); });
}
// Cari close IHSG pada tanggal tertentu — kalau tidak ada (weekend/libur bursa
// saat snapshot ekuitas tercatat), pakai closing hari bursa terakhir sebelumnya.
function perfNearestIhsgClose(rows, dateStr){
  var result = null;
  for(var i=0;i<rows.length;i++){
    if(rows[i].date<=dateStr) result = rows[i]; else break;
  }
  return result ? result.close : null;
}

// ── Kinerja Kumulatif Portofolio vs IHSG (% return, dari data riil) ──
function perfRenderBenchmark(){
  var hist = (typeof equityHistoryLoad==='function') ? equityHistoryLoad() : [];
  var noteEl = el('perf-bench-note');
  if(hist.length<2){
    kc('perfBench');
    if(noteEl) noteEl.innerHTML = 'Riwayat ekuitas belum cukup (min. 2 hari tercatat) untuk membandingkan dengan IHSG.';
    el('perf-bench-porto-val').textContent='—'; el('perf-bench-ihsg-val').textContent='—';
    return;
  }
  if(noteEl) noteEl.innerHTML = 'Portofolio dihitung dari '+hist.length+' snapshot ekuitas harian aplikasi (tercatat tiap kali Anda buka Dashboard/Performance). IHSG dari data historis riil Yahoo Finance. Titik portofolio akan makin rapat seiring Anda rutin membuka aplikasi.';
  rdFetchIhsgDaily(function(err, ihsgRows){
    kc('perfBench');
    var cv = el('perfBenchChart');
    if(err || !ihsgRows){
      if(noteEl) noteEl.innerHTML += ' <span class="dn">⚠ Gagal ambil data historis IHSG — hanya menampilkan kurva portofolio.</span>';
    }
    var base = hist[0].equity;
    var portoPct = hist.map(function(h){ return base>0 ? ((h.equity/base-1)*100) : 0; });
    var ihsgPct = null;
    if(ihsgRows){
      var baseIhsg = perfNearestIhsgClose(ihsgRows, hist[0].date);
      if(baseIhsg){
        ihsgPct = hist.map(function(h){
          var c = perfNearestIhsgClose(ihsgRows, h.date);
          return c ? ((c/baseIhsg-1)*100) : null;
        });
      }
    }
    el('perf-bench-porto-val').textContent = (portoPct[portoPct.length-1]>=0?'+':'')+portoPct[portoPct.length-1].toFixed(2)+'%';
    el('perf-bench-porto-val').className = 'mono '+(portoPct[portoPct.length-1]>=0?'up':'dn');
    if(ihsgPct){
      var lastIhsg = ihsgPct[ihsgPct.length-1];
      el('perf-bench-ihsg-val').textContent = lastIhsg!=null ? (lastIhsg>=0?'+':'')+lastIhsg.toFixed(2)+'%' : '—';
      el('perf-bench-ihsg-val').className = 'mono '+(lastIhsg>=0?'up':'dn');
    } else {
      el('perf-bench-ihsg-val').textContent='—';
    }
    if(!cv) return;
    var datasets = [{label:'Portofolio', data:portoPct, borderColor:'#2f6af3', backgroundColor:'transparent', tension:.3, pointRadius:0, borderWidth:2}];
    if(ihsgPct) datasets.push({label:'IHSG', data:ihsgPct, borderColor:'#8070d2', backgroundColor:'transparent', tension:.3, pointRadius:0, borderWidth:2, borderDash:[4,3]});
    charts['perfBench'] = new Chart(cv,{type:'line',data:{labels:hist.map(function(h){return h.date;}),datasets:datasets},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:Object.assign({},TT,{callbacks:{label:function(c){return c.dataset.label+': '+(c.parsed.y>=0?'+':'')+c.parsed.y.toFixed(2)+'%';}}})},
        scales:{x:{ticks:{color:'#8a90ad',font:{size:9},maxTicksLimit:7},grid:{display:false}},
                 y:{ticks:{color:'#555d6e',font:{size:9},callback:function(v){return v.toFixed(0)+'%';}},grid:{color:'rgba(255,255,255,.04)'}}}}});
  });
}

// ── Statistik trading dari transaksi SELL yang sudah direalisasi (avg-cost,
// metodologi identik dengan getRealizedPnl()/getPortfolio() — satu sumber
// kebenaran untuk cara menghitung P&L per posisi) ──
function perfComputeTradeStats(){
  var pos={}, trades=[];
  (transactions||[]).slice().sort(function(a,b){return a.date.localeCompare(b.date);}).forEach(function(tx){
    if(!pos[tx.ticker]) pos[tx.ticker]={lot:0,cost:0};
    var p=pos[tx.ticker];
    if(tx.type==='BUY'){ p.lot+=tx.lot; p.cost+=tx.gross; }
    else if(tx.type==='SELL' && p.lot>0){
      var avg=p.cost/(p.lot*100), sold=tx.lot*100, pnl=tx.gross-avg*sold;
      trades.push({ticker:tx.ticker, pnl:pnl});
      p.lot-=tx.lot; p.cost=Math.max(0,p.cost-avg*sold);
    }
  });
  var wins=trades.filter(function(t){return t.pnl>0;});
  var losses=trades.filter(function(t){return t.pnl<0;});
  var grossProfit=wins.reduce(function(a,t){return a+t.pnl;},0);
  var grossLoss=Math.abs(losses.reduce(function(a,t){return a+t.pnl;},0));
  return {
    trades:trades, wins:wins.length, losses:losses.length,
    grossProfit:grossProfit, grossLoss:grossLoss,
    maxProfit: wins.length ? Math.max.apply(null,wins.map(function(t){return t.pnl;})) : 0,
    maxLoss: losses.length ? Math.min.apply(null,losses.map(function(t){return t.pnl;})) : 0,
    avgProfit: wins.length ? grossProfit/wins.length : 0,
    avgLoss: losses.length ? -(grossLoss/losses.length) : 0,
    winRate: trades.length ? (wins.length/trades.length*100) : null,
    profitFactor: grossLoss>0 ? (grossProfit/grossLoss) : (grossProfit>0 ? Infinity : null),
    totalTxValue: (transactions||[]).reduce(function(a,t){return a+t.gross;},0),
    totalOrders: (transactions||[]).length
  };
}

function perfRenderTradeSummary(){
  var s = perfComputeTradeStats();
  var arcLen = 147.65; // panjang path semicircle r=47 (π×47)
  var pct = s.winRate===null ? 0 : s.winRate;
  var arc = el('perf-winrate-arc');
  if(arc){
    arc.style.strokeDashoffset = arcLen*(1-pct/100);
    arc.setAttribute('stroke', pct>=55?'#41f3a7':pct>=40?'#fbbf24':'#e21d48');
  }
  el('perf-winrate-val').textContent = s.winRate===null ? '—' : pct.toFixed(0)+'%';
  el('perf-winrate-trades').textContent = s.trades.length+' Trades';
  el('perf-wins').textContent = s.wins;
  el('perf-losses').textContent = s.losses;

  var pf = el('perf-profit-factor');
  pf.textContent = s.profitFactor===null ? '—' : (s.profitFactor===Infinity ? '∞' : s.profitFactor.toFixed(2));
  pf.className = 'mval '+(s.profitFactor===null?'neu':(s.profitFactor>=1.5?'up':s.profitFactor>=1?'amb':'dn'));

  el('perf-total-txval').textContent = 'Rp '+fmtK(s.totalTxValue);
  el('perf-total-orders').textContent = s.totalOrders+' order';

  el('perf-max-profit').textContent = 'Rp '+fmtK(s.maxProfit);
  el('perf-avg-profit').textContent = 'Rp '+fmtK(s.avgProfit);
  el('perf-max-loss').textContent = (s.maxLoss<0?'-':'')+'Rp '+fmtK(Math.abs(s.maxLoss));
  el('perf-avg-loss').textContent = (s.avgLoss<0?'-':'')+'Rp '+fmtK(Math.abs(s.avgLoss));

  // Top Gainer — dari performa per saham (realized+unrealized), metodologi sama dgn tab Portofolio
  var perf = (typeof getStockPerformanceByTicker==='function') ? getStockPerformanceByTicker() : [];
  var top = perf.filter(function(p){return p.total>0;}).sort(function(a,b){return b.total-a.total;}).slice(0,3);
  el('perf-top-gainer').innerHTML = top.length ? top.map(function(p){
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid var(--border)">'
      +'<span class="tp">'+p.ticker+'</span>'
      +'<span class="mono up" style="font-size:12px;font-weight:600">+Rp '+fmtK(p.total)+'</span>'
      +'</div>';
  }).join('') : '<div style="color:var(--text3);font-size:11px;text-align:center;padding:20px 0">Belum ada posisi untung — mulai trading untuk melihat top gainer</div>';
}

// ── Realized Gain (breakdown) & Total Dividen Diterima ──
function perfRenderRealized(){
  var totalRealized = (typeof getRealizedPnl==='function') ? getRealizedPnl() : 0;
  var s = perfComputeTradeStats();
  el('perf-realized-total').textContent = (totalRealized>=0?'+':'')+'Rp '+fmtK(totalRealized);
  el('perf-realized-total').className = 'mval lg '+(totalRealized>=0?'up':'dn');
  el('perf-realized-sub').textContent = s.trades.length+' transaksi jual direalisasikan';
  el('perf-realized-gain').textContent = '+Rp '+fmtK(s.grossProfit);
  el('perf-realized-loss').textContent = '-Rp '+fmtK(s.grossLoss);

  var divTotal = (dividends||[]).reduce(function(a,d){return a+(d.net||0);},0);
  el('perf-dividend-total').textContent = 'Rp '+fmtK(divTotal);
  el('perf-dividend-sub').textContent = (dividends||[]).length+' pembayaran';
}
