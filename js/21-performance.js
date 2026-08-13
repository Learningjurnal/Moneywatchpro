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
  perfRenderDisposition();
  perfRenderActivity();
  perfRenderOtherAssets();
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

// ── Disposition Effect — rata-rata lama tahan saham UNTUNG vs RUGI.
// "Tanggal buka posisi" = tanggal BUY pertama sejak lot ticker itu terakhir
// nol (bukan per-lot FIFO, tapi cukup untuk mengukur pola tahan-lepas —
// metodologi P&L per trade tetap avg-cost yang sama dengan seluruh app). ──
function perfComputeDisposition(){
  var pos={}, trades=[];
  (transactions||[]).slice().sort(function(a,b){return a.date.localeCompare(b.date);}).forEach(function(tx){
    if(!pos[tx.ticker]) pos[tx.ticker]={lot:0,cost:0,openDate:null};
    var p=pos[tx.ticker];
    if(tx.type==='BUY'){
      if(p.lot<=0) p.openDate=tx.date;
      p.lot+=tx.lot; p.cost+=tx.gross;
    } else if(tx.type==='SELL' && p.lot>0){
      var avg=p.cost/(p.lot*100), sold=tx.lot*100, pnl=tx.gross-avg*sold;
      var holdDays = p.openDate ? Math.round((new Date(tx.date)-new Date(p.openDate))/86400000) : null;
      trades.push({ticker:tx.ticker, pnl:pnl, holdDays:holdDays});
      p.lot-=tx.lot; p.cost=Math.max(0,p.cost-avg*sold);
      if(p.lot<=0){ p.lot=0; p.cost=0; p.openDate=null; }
    }
  });
  var winners = trades.filter(function(t){return t.pnl>0 && t.holdDays!=null;});
  var losers  = trades.filter(function(t){return t.pnl<0 && t.holdDays!=null;});
  var avg = function(arr){ return arr.length ? arr.reduce(function(a,t){return a+t.holdDays;},0)/arr.length : null; };
  return {winners:winners.length, losers:losers.length, avgHoldWin:avg(winners), avgHoldLoss:avg(losers)};
}
function perfRenderDisposition(){
  var d = perfComputeDisposition();
  el('perf-hold-win').textContent = d.avgHoldWin!=null ? Math.round(d.avgHoldWin) : '—';
  el('perf-hold-loss').textContent = d.avgHoldLoss!=null ? Math.round(d.avgHoldLoss) : '—';
  var box = el('perf-disposition-insight');
  if(d.avgHoldWin==null || d.avgHoldLoss==null){
    box.innerHTML = '<span style="color:var(--text3)">Butuh minimal 1 transaksi SELL untung dan 1 rugi untuk membandingkan pola tahan-lepas.</span>';
    return;
  }
  var ratio = d.avgHoldLoss / (d.avgHoldWin||1);
  if(ratio>=1.3){
    box.innerHTML = '⚠️ Anda menahan saham <b class="dn">rugi ' + ratio.toFixed(1) + 'x lebih lama</b> daripada saham untung ('+Math.round(d.avgHoldLoss)+' vs '+Math.round(d.avgHoldWin)+' hari) — pola klasik <i>disposition effect</i> (enggan realisasi rugi, buru-buru kunci untung). Pertimbangkan aturan cut-loss yang lebih disiplin.';
  } else if(ratio<=0.77){
    box.innerHTML = '✅ Anda justru menahan saham <b class="up">untung lebih lama</b> daripada rugi ('+Math.round(d.avgHoldWin)+' vs '+Math.round(d.avgHoldLoss)+' hari) — pola yang lebih sehat, membiarkan pemenang berkembang (let winners run).';
  } else {
    box.innerHTML = 'Pola tahan-lepas relatif seimbang antara saham untung ('+Math.round(d.avgHoldWin)+' hari) dan rugi ('+Math.round(d.avgHoldLoss)+' hari) — tidak ada indikasi disposition effect yang signifikan.';
  }
}

// ── Frekuensi Trading vs Realized P&L per bulan ──
function perfComputeMonthlyActivity(){
  var byMonth={};
  (transactions||[]).forEach(function(tx){
    var m=tx.date.slice(0,7);
    if(!byMonth[m]) byMonth[m]={trades:0,pnl:0};
    byMonth[m].trades++;
  });
  var pos={};
  (transactions||[]).slice().sort(function(a,b){return a.date.localeCompare(b.date);}).forEach(function(tx){
    if(!pos[tx.ticker]) pos[tx.ticker]={lot:0,cost:0};
    var p=pos[tx.ticker];
    if(tx.type==='BUY'){ p.lot+=tx.lot; p.cost+=tx.gross; }
    else if(tx.type==='SELL' && p.lot>0){
      var avg=p.cost/(p.lot*100), sold=tx.lot*100, pnl=tx.gross-avg*sold;
      var m=tx.date.slice(0,7);
      if(!byMonth[m]) byMonth[m]={trades:0,pnl:0};
      byMonth[m].pnl+=pnl;
      p.lot-=tx.lot; p.cost=Math.max(0,p.cost-avg*sold);
    }
  });
  var months=Object.keys(byMonth).sort();
  return months.map(function(m){ return {month:m, trades:byMonth[m].trades, pnl:byMonth[m].pnl}; });
}
function perfRenderActivity(){
  var data = perfComputeMonthlyActivity();
  kc('perfActivity');
  var cv = el('perfActivityChart');
  var box = el('perf-activity-insight');
  if(!data.length){
    if(box) box.innerHTML = '<span style="color:var(--text3)">Belum ada transaksi.</span>';
    return;
  }
  if(cv){
    charts['perfActivity'] = new Chart(cv,{
      type:'bar', // base type wajib ada di Chart.js v4 utk mixed chart, per-dataset type di bawah yang menimpanya
      data:{labels:data.map(function(d){return d.month;}),
        datasets:[
          {type:'bar', label:'Jumlah Order', data:data.map(function(d){return d.trades;}), backgroundColor:'rgba(47,106,243,.55)', borderRadius:3, yAxisID:'y'},
          {type:'line', label:'Realized P&L', data:data.map(function(d){return d.pnl;}), borderColor:'#41f3a7', backgroundColor:'transparent', tension:.3, pointRadius:2, borderWidth:2, yAxisID:'y1'}
        ]},
      options:{responsive:true,maintainAspectRatio:false,
        plugins:{legend:{display:true,labels:{color:'#8a90ad',font:{size:9},boxWidth:10}},
          tooltip:Object.assign({},TT,{callbacks:{label:function(c){ return c.dataset.label==='Realized P&L' ? 'P&L: '+(c.parsed.y>=0?'+':'')+'Rp '+fmtK(c.parsed.y) : 'Order: '+c.parsed.y; }}})},
        scales:{
          x:{ticks:{color:'#8a90ad',font:{size:9},maxTicksLimit:8},grid:{display:false}},
          y:{position:'left',ticks:{color:'#555d6e',font:{size:9}},grid:{color:'rgba(255,255,255,.04)'},title:{display:false}},
          y1:{position:'right',ticks:{color:'#555d6e',font:{size:9},callback:function(v){return fmtK(v);}},grid:{display:false}}
        }}
    });
  }
  if(box){
    if(data.length<3){
      box.innerHTML = '<span style="color:var(--text3)">Butuh riwayat minimal 3 bulan untuk melihat pola korelasi frekuensi vs hasil.</span>';
    } else {
      var trades=data.map(function(d){return d.trades;}), pnls=data.map(function(d){return d.pnl;});
      var r = (typeof qtPearson==='function') ? qtPearson(trades,pnls) : null;
      if(r==null || isNaN(r)){
        box.innerHTML = '<span style="color:var(--text3)">Korelasi tidak dapat dihitung (variasi data terlalu kecil).</span>';
      } else if(r<=-0.3){
        box.innerHTML = '⚠️ Korelasi <b class="dn">negatif</b> (r='+r.toFixed(2)+') antara jumlah order per bulan dan hasil realized P&L — bulan dengan lebih banyak transaksi cenderung hasilnya lebih buruk, indikasi kemungkinan <i>overtrading</i>.';
      } else if(r>=0.3){
        box.innerHTML = 'Korelasi <b class="up">positif</b> (r='+r.toFixed(2)+') antara frekuensi trading dan hasil — belum ada indikasi overtrading dari data ini.';
      } else {
        box.innerHTML = 'Tidak ada korelasi kuat (r='+r.toFixed(2)+') antara frekuensi trading dan hasil bulanan — jumlah transaksi tidak terlihat memengaruhi performa secara sistematis.';
      }
    }
  }
}

// ── Kinerja Aset Lain — Crypto/ETF/Reksa Dana. Halaman Performance yang
// lain hanya menghitung ini untuk saham (getRealizedPnl()); di sini
// realized P&L dihitung dengan metodologi avg-cost yang SAMA untuk
// ketiga kelas aset, supaya konsisten dengan cara saham dihitung. ──
function perfRealizedGeneric(txArr, buyType, sellType, tickerField, priceValField){
  var pos={}, real=0;
  (txArr||[]).slice().sort(function(a,b){return a.date.localeCompare(b.date);}).forEach(function(tx){
    var key=tx[tickerField];
    if(!pos[key]) pos[key]={qty:0,cost:0};
    var p=pos[key];
    var val = priceValField(tx);
    if(tx.type===buyType){ p.qty+=val.qty; p.cost+=val.amount; }
    else if(tx.type===sellType && p.qty>0){
      var avg=p.cost/p.qty, sold=Math.min(val.qty,p.qty);
      real += val.amount - avg*sold;
      p.qty-=sold; p.cost=Math.max(0,p.cost-avg*sold);
    }
  });
  return real;
}
function perfRenderOtherAssets(){
  var box = el('perf-other-assets');
  if(!box) return;
  var cards=[];

  // Crypto
  var cp = (typeof getCryptoPortfolio==='function') ? getCryptoPortfolio() : [];
  var cMV=cp.reduce(function(a,p){return a+p.mv;},0), cCost=cp.reduce(function(a,p){return a+p.cost;},0);
  var cUnreal=cMV-cCost;
  var cReal = perfRealizedGeneric(cryptoTx, 'BUY','SELL','coin', function(tx){return {qty:tx.qty, amount:tx.total};});
  cards.push(perfAssetCard('🪙 Crypto', cMV, cCost, cUnreal, cReal, cp.length));

  // ETF
  var ep = (typeof getEtfPortfolio==='function') ? getEtfPortfolio() : [];
  var eMV=ep.reduce(function(a,p){return a+p.mvIdr;},0), eCost=ep.reduce(function(a,p){return a+p.costIdr;},0);
  var eUnreal=eMV-eCost;
  var eReal = perfRealizedGeneric(etfTx, 'BUY','SELL','ticker', function(tx){return {qty:tx.shares, amount:tx.totalIdr};});
  cards.push(perfAssetCard('📊 ETF AS', eMV, eCost, eUnreal, eReal, ep.length));

  // Reksa Dana
  var rp = (typeof getRdPortfolio==='function') ? getRdPortfolio() : [];
  var rMV=rp.reduce(function(a,p){return a+p.mv;},0), rCost=rp.reduce(function(a,p){return a+p.cost;},0);
  var rUnreal=rMV-rCost;
  var rReal = perfRealizedGeneric((rdTx||[]).filter(function(t){return t._userInput===true;}), 'BELI','JUAL','code', function(tx){return {qty:tx.units, amount:tx.amount};});
  cards.push(perfAssetCard('🏦 Reksa Dana', rMV, rCost, rUnreal, rReal, rp.length));

  box.innerHTML = cards.join('');
}
function perfAssetCard(label, mv, cost, unreal, real, posCount){
  var retPct = cost>0 ? (unreal/cost*100) : 0;
  return '<div class="metric" style="margin:0">'
    +'<div class="mlabel">'+label+'</div>'
    +'<div class="mval" style="font-size:17px">Rp '+fmtK(mv)+'</div>'
    +'<div class="msub neu" style="margin-bottom:8px">'+posCount+' posisi aktif · modal Rp '+fmtK(cost)+'</div>'
    +'<div style="display:flex;justify-content:space-between;font-size:10.5px;margin-bottom:4px"><span style="color:var(--text3)">Unrealized</span><span class="'+(unreal>=0?'up':'dn')+' mono">'+(unreal>=0?'+':'')+'Rp '+fmtK(unreal)+' ('+(retPct>=0?'+':'')+retPct.toFixed(1)+'%)</span></div>'
    +'<div style="display:flex;justify-content:space-between;font-size:10.5px"><span style="color:var(--text3)">Realized</span><span class="'+(real>=0?'up':'dn')+' mono">'+(real>=0?'+':'')+'Rp '+fmtK(real)+'</span></div>'
    +'</div>';
}

// ── Cost Drag — total biaya transaksi (komisi+PPN+PPh+Levy) sebagai %
// nilai transaksi, per bulan. Dipakai di halaman Pajak & PPh. Field
// tx.tax sudah gabungan PPN+Levy+PPh (lihat calcTxComponents()) jadi
// tx.komisi+tx.tax = total biaya per transaksi, satu sumber yang sama
// dipakai tabel & kartu ringkasan Pajak yang sudah ada. ──
function renderCostDrag(){
  var avgEl=el('pj-drag-avg'), worstEl=el('pj-drag-worst'), bestEl=el('pj-drag-best'), cv=el('pjDragChart');
  if(!avgEl) return;
  var byMonth={};
  (transactions||[]).forEach(function(tx){
    var m=tx.date.slice(0,7);
    if(!byMonth[m]) byMonth[m]={gross:0,biaya:0};
    byMonth[m].gross+=tx.gross;
    byMonth[m].biaya+=(tx.komisi+tx.tax);
  });
  var months=Object.keys(byMonth).sort();
  kc('pjDrag');
  if(!months.length){
    avgEl.textContent='0,00%'; worstEl.textContent='—'; bestEl.textContent='—';
    return;
  }
  var totalGross=months.reduce(function(a,m){return a+byMonth[m].gross;},0);
  var totalBiaya=months.reduce(function(a,m){return a+byMonth[m].biaya;},0);
  avgEl.textContent=(totalGross>0?(totalBiaya/totalGross*100):0).toFixed(2).replace('.',',')+'%';

  var pcts=months.map(function(m){ var d=byMonth[m]; return {month:m, pct: d.gross>0?(d.biaya/d.gross*100):0}; });
  var worst=pcts.slice().sort(function(a,b){return b.pct-a.pct;})[0];
  var best=pcts.slice().sort(function(a,b){return a.pct-b.pct;})[0];
  worstEl.textContent=worst.month+' ('+worst.pct.toFixed(2).replace('.',',')+'%)';
  bestEl.textContent=best.month+' ('+best.pct.toFixed(2).replace('.',',')+'%)';

  if(cv){
    charts['pjDrag']=new Chart(cv,{type:'bar',
      data:{labels:months, datasets:[{data:pcts.map(function(p){return p.pct;}),
        backgroundColor:pcts.map(function(p){return p.pct>2?'rgba(226,29,72,.65)':p.pct>1?'rgba(251,191,36,.65)':'rgba(65,243,167,.65)';}),
        borderRadius:3}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},
        tooltip:Object.assign({},TT,{callbacks:{label:function(c){return c.parsed.y.toFixed(2)+'% dari nilai transaksi bulan itu';}}})},
        scales:{x:{ticks:{color:'#8a90ad',font:{size:9},maxTicksLimit:8},grid:{display:false}},
                 y:{ticks:{color:'#555d6e',font:{size:9},callback:function(v){return v+'%';}},grid:{color:'rgba(255,255,255,.04)'}}}}});
  }
}

// ── Yield on Cost & pertumbuhan dividen per saham (halaman Dividen).
// YoC dihitung di level POSISI (dividen Rp tahun ini ÷ modal Rp saat ini
// dari getPortfolio()) supaya tidak perlu rekonsiliasi jumlah lembar yang
// berubah antar pembayaran dividen — cuma untuk saham yang MASIH DIPEGANG
// (posisi yang sudah ditutup tidak lagi punya modal untuk dibandingkan). ──
function renderDividendYoC(){
  var box = el('div-yoc-tbody');
  if(!box) return;
  var porto = (typeof getPortfolio==='function') ? getPortfolio() : [];
  if(!porto.length){
    box.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:16px">Belum ada posisi saham aktif</td></tr>';
    return;
  }
  var thisYear = new Date().getFullYear();
  var lastYear = thisYear-1;
  var divByTickerYear = {}; // ticker -> {year -> total net}
  (dividends||[]).forEach(function(d){
    if(!d.date) return;
    var y = parseInt(d.date.slice(0,4),10);
    if(!divByTickerYear[d.ticker]) divByTickerYear[d.ticker]={};
    divByTickerYear[d.ticker][y] = (divByTickerYear[d.ticker][y]||0) + d.net;
  });
  var rows = porto.map(function(p){
    var byYr = divByTickerYear[p.ticker]||{};
    var divThis = byYr[thisYear]||0, divLast = byYr[lastYear]||0;
    var yoc = p.cost>0 ? (divThis/p.cost*100) : 0;
    var growth = divLast>0 ? ((divThis-divLast)/divLast*100) : (divThis>0 ? null : null); // null = tidak ada basis pembanding
    return {ticker:p.ticker, avg:p.avg, divThis:divThis, divLast:divLast, yoc:yoc, growth:growth};
  }).filter(function(r){ return r.divThis>0 || r.divLast>0; })
    .sort(function(a,b){ return b.yoc-a.yoc; });

  if(!rows.length){
    box.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:16px">Belum ada dividen tercatat untuk saham yang masih dipegang</td></tr>';
    return;
  }
  box.innerHTML = rows.map(function(r){
    var growthHtml = r.growth===null ? '<span style="color:var(--text3)">—</span>' :
      '<span class="'+(r.growth>=0?'up':'dn')+'">'+(r.growth>=0?'+':'')+r.growth.toFixed(1)+'%</span>';
    return '<tr>'
      +'<td><span class="tp">'+r.ticker+'</span></td>'
      +'<td class="mono" style="font-size:11px">Rp '+fmt(Math.round(r.avg))+'</td>'
      +'<td class="mono up" style="font-size:11px">Rp '+fmtK(r.divThis)+'</td>'
      +'<td class="mono '+(r.yoc>=5?'up':r.yoc>=2?'amb':'neu')+'" style="font-size:11px;font-weight:700">'+r.yoc.toFixed(2)+'%</td>'
      +'<td class="mono" style="font-size:11px;color:var(--text2)">Rp '+fmtK(r.divLast)+'</td>'
      +'<td class="mono" style="font-size:11px">'+growthHtml+'</td>'
      +'</tr>';
  }).join('');
}
