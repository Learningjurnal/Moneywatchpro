// ============================================================
// QUANTTRADER MODULE — Backtester, Screener, Pairs, Heatmap, Correlation
// Integrated with Yahoo Finance live engine (FH/yfFetch above)
// ============================================================

var QT = {
  liveCache: {},   // cache harga live per ticker
  btStrat: 'ma',  // strategi aktif
  btData: null,   // data OHLCV saat ini
  btCharts: {},
  scData: [],
  corrData: null,
  mrData: {}
};

var LQ45_STOCKS = [
  {t:'BBCA',n:'Bank Central Asia',s:'Perbankan'},
  {t:'BBRI',n:'Bank Rakyat Indonesia',s:'Perbankan'},
  {t:'BMRI',n:'Bank Mandiri',s:'Perbankan'},
  {t:'BBNI',n:'Bank Negara Indonesia',s:'Perbankan'},
  {t:'TLKM',n:'Telkom Indonesia',s:'Telekomunikasi'},
  {t:'ASII',n:'Astra International',s:'Otomotif'},
  {t:'UNVR',n:'Unilever Indonesia',s:'Consumer'},
  {t:'ANTM',n:'Aneka Tambang',s:'Pertambangan'},
  {t:'ADRO',n:'Adaro Energy',s:'Batubara'},
  {t:'AMRT',n:'Alfamart',s:'Ritel'},
  {t:'ARTO',n:'Bank Jago',s:'Perbankan'},
  {t:'BRPT',n:'Barito Pacific',s:'Petrokimia'},
  {t:'AKRA',n:'AKR Corporindo',s:'Distribusi'},
  {t:'INDF',n:'Indofood',s:'Consumer'},
  {t:'PTBA',n:'Bukit Asam',s:'Batubara'}
];
var QT_MONTHS=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

// ── Page init hooks ──
var _origGoPage2 = window.goPage;
window.goPage = function(page, btn){
  if(_origGoPage2) _origGoPage2.call(this, page, btn);
  if(page === 'backtester')   { /* auto nothing, wait for user */ }
  if(page === 'screener')     { if(!QT.scData.length) scBuildSim(); else scRenderTable(); }
  if(page === 'factor-heatmap') fhmRender();
  if(page === 'correlation')  corrRender();
  if(page === 'monthly-returns') mrRender();
  if(page === 'pairs')        { /* wait */ }
  if(page === 'harga-wajar')  { if(!window._hwInited){ window._hwInited=true; try{hw_init();}catch(e){} } else { try{hw_renderTable();}catch(e){} } }
};

// ── Yahoo Finance live fetch helper (wrapper around existing FH engine) ──
function qtFetchOHLCV(ticker, rangeDays, cb){
  var sym = ticker.toUpperCase() + '.JK';
  var range = rangeDays <= 365 ? '1y' : (rangeDays <= 730 ? '2y' : (rangeDays <= 1095 ? '3y' : '5y'));
  var yUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/' + sym + '?interval=1d&range=' + range;
  var proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(yUrl);

  el('bt-data-status') && (el('bt-data-status').textContent = '📡 Mengambil data live ' + sym + '...');

  fetch(proxyUrl)
  .then(function(r){ return r.json(); })
  .then(function(d){
    var result = d && d.chart && d.chart.result && d.chart.result[0];
    if(!result) throw new Error('NO_DATA');
    var quotes = result.indicators.quote[0];
    var timestamps = result.timestamp;
    var data = timestamps.map(function(ts, i){
      return {
        date: new Date(ts*1000).toISOString().slice(0,10),
        open: quotes.open[i] || 0,
        high: quotes.high[i] || 0,
        low: quotes.low[i] || 0,
        close: quotes.close[i] || 0,
        volume: quotes.volume[i] || 0
      };
    }).filter(function(d){ return d.close > 0; });

    el('bt-src-label') && (el('bt-src-label').textContent = '● LIVE Yahoo Finance');
    el('bt-src-label') && (el('bt-src-label').style.color = 'var(--green)');
    el('bt-src-ticker') && (el('bt-src-ticker').textContent = sym);
    el('bt-src-count') && (el('bt-src-count').textContent = data.length + ' baris');
    if(data.length){
      el('bt-src-date') && (el('bt-src-date').textContent = data[data.length-1].date);
      el('bt-src-price') && (el('bt-src-price').textContent = 'Rp ' + Math.round(data[data.length-1].close).toLocaleString('id-ID'));
    }
    el('bt-data-status') && (el('bt-data-status').textContent = '✅ Data live: ' + data.length + ' hari');
    cb(null, data);
  })
  .catch(function(err){
    // Try second proxy
    var proxyUrl2 = 'https://corsproxy.io/?' + encodeURIComponent(yUrl);
    fetch(proxyUrl2).then(function(r){ return r.json(); })
    .then(function(d){
      var result = d && d.chart && d.chart.result && d.chart.result[0];
      if(!result) throw new Error('NO_DATA');
      var quotes = result.indicators.quote[0];
      var timestamps = result.timestamp;
      var data = timestamps.map(function(ts, i){
        return { date: new Date(ts*1000).toISOString().slice(0,10), open: quotes.open[i]||0, high: quotes.high[i]||0, low: quotes.low[i]||0, close: quotes.close[i]||0, volume: quotes.volume[i]||0 };
      }).filter(function(d){ return d.close > 0; });
      el('bt-src-label') && (el('bt-src-label').textContent = '● LIVE Yahoo Finance');
      el('bt-src-label') && (el('bt-src-label').style.color = 'var(--green)');
      el('bt-src-count') && (el('bt-src-count').textContent = data.length + ' baris');
      if(data.length){ el('bt-src-date') && (el('bt-src-date').textContent = data[data.length-1].date); el('bt-src-price') && (el('bt-src-price').textContent = 'Rp ' + Math.round(data[data.length-1].close).toLocaleString('id-ID')); }
      el('bt-data-status') && (el('bt-data-status').textContent = '✅ Data live (proxy 2): ' + data.length + ' hari');
      cb(null, data);
    })
    .catch(function(){
      // Fallback to simulation
      el('bt-data-status') && (el('bt-data-status').textContent = '⚠️ Proxy gagal — pakai data simulasi');
      el('bt-src-label') && (el('bt-src-label').textContent = 'Simulasi');
      el('bt-src-label') && (el('bt-src-label').style.color = 'var(--amber)');
      cb(null, qtGenSim(ticker, rangeDays));
    });
  });
}

// ── Simulation fallback ──
function qtGenSim(ticker, days){
  var baseP = {BBCA:9500,BBRI:4800,BMRI:7200,TLKM:3300,ASII:5800,ANTM:1700,ADRO:3200,UNVR:3700,INDF:6900,PTBA:3100};
  var price = baseP[ticker.toUpperCase()] || 5000;
  var seed = ticker.charCodeAt(0) * 17 + (ticker.charCodeAt(1)||7);
  var rng = function(){ seed=(seed*1664525+1013904223)&0xffffffff; return (seed>>>0)/0x100000000; };
  var data = [];
  var now = new Date();
  for(var i=days; i>0; i--){
    var d = new Date(now); d.setDate(d.getDate()-i);
    if(d.getDay()===0||d.getDay()===6) continue;
    var ch = (rng()-0.49)*0.025;
    price = Math.max(100, price*(1+ch));
    var o = Math.round(price*(0.99+rng()*0.02));
    var c = Math.round(price);
    var h = Math.round(Math.max(o,c)*(1+rng()*0.01));
    var l = Math.round(Math.min(o,c)*(1-rng()*0.01));
    data.push({date:d.toISOString().slice(0,10),open:o,high:h,low:l,close:c,volume:Math.round(rng()*5e7+1e7)});
  }
  el('bt-src-count') && (el('bt-src-count').textContent = data.length + ' baris (sim)');
  return data;
}

// ── TA functions ──
function qtSMA(arr, n){ return arr.map(function(_,i){ if(i<n-1)return null; return arr.slice(i-n+1,i+1).reduce(function(s,v){return s+v;},0)/n; }); }
function qtEMA(arr, n){ var k=2/(n+1),em=[]; arr.forEach(function(v,i){ em.push(i===0?v:v*k+em[i-1]*(1-k)); }); return em; }
function qtRSI(close, n){
  var rs=[]; var gain=0, loss=0;
  for(var i=1;i<=n;i++){ var ch=close[i]-close[i-1]; if(ch>0)gain+=ch; else loss-=ch; }
  gain/=n; loss/=n;
  rs.push(loss===0?100:100-100/(1+gain/loss));
  for(var j=n+1;j<close.length;j++){
    var ch2=close[j]-close[j-1]; var g=ch2>0?ch2:0; var l=ch2<0?-ch2:0;
    gain=(gain*(n-1)+g)/n; loss=(loss*(n-1)+l)/n;
    rs.push(loss===0?100:100-100/(1+gain/loss));
  }
  var out=new Array(n).fill(null); rs.forEach(function(v){out.push(v);}); return out;
}
function qtPearson(a, b){
  var n=Math.min(a.length,b.length); var mx=0,my=0;
  for(var i=0;i<n;i++){mx+=a[i];my+=b[i];} mx/=n;my/=n;
  var num=0,da=0,db=0;
  for(var j=0;j<n;j++){var x=a[j]-mx,y=b[j]-my;num+=x*y;da+=x*x;db+=y*y;}
  return da&&db?num/Math.sqrt(da*db):0;
}

// ── Backtest strategies ──
function btSetStrat(s, el2){
  QT.btStrat = s;
  ['ma','rsi','xgb'].forEach(function(x){ var b=el('bt-strat-'+x); if(b){b.className=b.className.replace(' on','').replace('on','').trim();} });
  var btn=el('bt-strat-'+s); if(btn) btn.className=(btn.className+' on').trim();
  ['ma','rsi','xgb'].forEach(function(x){ var p=el('bt-params-'+x); if(p) p.style.display = x===s?'block':'none'; });
}

function btFetchLive(){
  var ticker = (el('bt-ticker').value||'BBCA').toUpperCase().replace('.JK','');
  var days = parseInt(el('bt-period').value||730);
  qtFetchOHLCV(ticker, days, function(err, data){
    QT.btData = data;
  });
}

function runBacktest(){
  var ticker = (el('bt-ticker').value||'BBCA').toUpperCase().replace('.JK','');
  var days = parseInt(el('bt-period').value||730);
  var capital = parseFloat(el('bt-capital').value||100000000);
  var comm = parseFloat(el('bt-comm').value||0.2)/100;

  el('bt-data-status').textContent = '⏳ Loading...';

  function doBacktest(data){
    QT.btData = data;
    var close = data.map(function(d){return d.close;});
    var dates = data.map(function(d){return d.date;});

    var signals = [];
    if(QT.btStrat==='ma'){
      var f=parseInt(el('bt-ma-fast').value||10), s2=parseInt(el('bt-ma-slow').value||30);
      var tp=el('bt-ma-type').value;
      var fast = tp==='ema'?qtEMA(close,f):qtSMA(close,f);
      var slow = tp==='ema'?qtEMA(close,s2):qtSMA(close,s2);
      for(var i=1;i<close.length;i++){
        if(fast[i]&&slow[i]&&fast[i-1]&&slow[i-1]){
          if(fast[i]>slow[i]&&fast[i-1]<=slow[i-1]) signals.push({i:i,type:'BUY'});
          else if(fast[i]<slow[i]&&fast[i-1]>=slow[i-1]) signals.push({i:i,type:'SELL'});
        }
      }
    } else if(QT.btStrat==='rsi'){
      var rn=parseInt(el('bt-rsi-n').value||14);
      var ros=parseInt(el('bt-rsi-os').value||30), rob=parseInt(el('bt-rsi-ob').value||70);
      var sl=parseFloat(el('bt-rsi-sl').value||5)/100;
      var rsi2=qtRSI(close,rn);
      var inPos=false, entryP=0;
      for(var ii=1;ii<close.length;ii++){
        if(rsi2[ii]!==null&&rsi2[ii-1]!==null){
          if(!inPos&&rsi2[ii]>ros&&rsi2[ii-1]<=ros){signals.push({i:ii,type:'BUY'});inPos=true;entryP=close[ii];}
          else if(inPos&&(rsi2[ii]<rob&&rsi2[ii-1]>=rob||close[ii]<entryP*(1-sl))){signals.push({i:ii,type:'SELL'});inPos=false;}
        }
      }
    } else {
      // XGBoost sim: random ML-like signals based on momentum
      var momentum = close.map(function(c,i){ return i<20?0:(c-close[i-20])/close[i-20]; });
      var inP=false;
      for(var iii=20;iii<close.length;iii++){
        if(!inP&&momentum[iii]>0.02){signals.push({i:iii,type:'BUY'});inP=true;}
        else if(inP&&momentum[iii]<-0.01){signals.push({i:iii,type:'SELL'});inP=false;}
      }
    }

    // Simulate equity
    var eq=[capital], bah=[capital], bah0=close[0];
    var cash=capital, shares=0, entryIdx=-1, entryP2=0;
    var txLog=[];
    signals.forEach(function(sig){
      if(sig.type==='BUY'&&cash>0){
        shares=Math.floor(cash/(close[sig.i]*100))*100;
        var cost=shares*close[sig.i]*(1+comm);
        if(shares>0){cash-=cost;entryP2=close[sig.i];entryIdx=sig.i;}
      } else if(sig.type==='SELL'&&shares>0){
        var proceeds=shares*close[sig.i]*(1-comm-0.001); // komisi + PPh jual 0.1%
        var pnl=proceeds-shares*entryP2*(1+comm);
        txLog.push({entry:dates[entryIdx],exit:dates[sig.i],entryP:entryP2,exitP:close[sig.i],dur:sig.i-entryIdx,ret:(close[sig.i]-entryP2)/entryP2*100,pnl:pnl});
        cash+=proceeds;shares=0;
      }
    });
    // Liquidate at end
    if(shares>0){
      var lp=close[close.length-1];
      cash+=shares*lp*(1-comm-0.001);shares=0;
    }

    // Build equity curve
    var runCash=capital, runShares=0;
    var equityArr=[];
    signals.forEach(function(sig){
      if(sig.type==='BUY'&&runCash>0){ var sh=Math.floor(runCash/(close[sig.i]*100))*100; if(sh>0){runCash-=sh*close[sig.i]*(1+comm);runShares=sh;} }
      else if(sig.type==='SELL'&&runShares>0){ runCash+=runShares*close[sig.i]*(1-comm-0.001);runShares=0; }
      equityArr.push({i:sig.i, val:runCash+(runShares*close[sig.i])});
    });

    var finalEq = cash;
    var totalRet = (finalEq-capital)/capital*100;
    var maxDD = 0, peak = capital, runEq2 = capital;
    var ddArr = [0];
    var allEq = [capital];
    var bahArr = close.map(function(c){return capital*c/bah0;});

    // Monthly returns for heatmap
    var monthMap = {};
    var prevMonthEnd = {price:close[0],idx:0};
    dates.forEach(function(dt,i){
      var ym = dt.slice(0,7);
      monthMap[ym] = {close:close[i], date:dt};
    });

    // DD
    var eqFull = close.map(function(c,i){
      var runC2 = capital, runS2 = 0;
      signals.forEach(function(sig){
        if(sig.i <= i){
          if(sig.type==='BUY'&&runC2>0){var sh2=Math.floor(runC2/(close[sig.i]*100))*100;if(sh2>0){runC2-=sh2*close[sig.i]*(1+comm);runS2=sh2;}}
          else if(sig.type==='SELL'&&runS2>0){runC2+=runS2*close[sig.i]*(1-comm-0.001);runS2=0;}
        }
      });
      return runC2+(runS2*c);
    });

    var ddFull = eqFull.map(function(v,i){
      if(v>peak2) peak2=v;
      return (v-peak2)/peak2*100;
    });
    var peak2 = capital;
    // re-calc dd properly
    peak2 = capital;
    ddFull = eqFull.map(function(v){
      if(v>peak2)peak2=v;
      return (v-peak2)/peak2*100;
    });
    var minDD = Math.min.apply(null, ddFull);

    var winTrades = txLog.filter(function(t){return t.pnl>0;}).length;
    var winRate = txLog.length ? winTrades/txLog.length*100 : 0;
    var totalPnl = txLog.reduce(function(s,t){return s+t.pnl;},0);

    // Display metrics
    var mEl = el('bt-metrics');
    mEl.innerHTML = [
      {l:'Total Return',v:(totalRet>=0?'+':'')+totalRet.toFixed(2)+'%',c:totalRet>=0?'var(--green)':'var(--red)'},
      {l:'Max Drawdown',v:minDD.toFixed(2)+'%',c:'var(--red)'},
      {l:'Total Trades',v:txLog.length,c:'var(--amber)'},
      {l:'Win Rate',v:winRate.toFixed(1)+'%',c:winRate>50?'var(--green)':'var(--amber)'},
      {l:'Net P&L',v:'Rp '+Math.round(totalPnl).toLocaleString('id-ID'),c:totalPnl>=0?'var(--green)':'var(--red)'},
      {l:'Modal Awal',v:'Rp '+capital.toLocaleString('id-ID'),c:'var(--text2)'},
      {l:'Modal Akhir',v:'Rp '+Math.round(finalEq).toLocaleString('id-ID'),c:finalEq>=capital?'var(--green)':'var(--red)'},
      {l:'Vs Buy&Hold',v:(totalRet-(close[close.length-1]-close[0])/close[0]*100).toFixed(2)+'%',c:'var(--amber)'}
    ].map(function(m){
      return '<div class="metric"><div class="mlabel">'+m.l+'</div><div class="mval" style="font-size:15px;color:'+m.c+'">'+m.v+'</div></div>';
    }).join('');

    // Equity chart
    if(QT.btCharts['eq']){QT.btCharts['eq'].destroy();}
    var cvEq = el('bt-equity-chart');
    if(cvEq){
      var sampStep = Math.max(1, Math.floor(dates.length/150));
      var sampDates = dates.filter(function(_,i){return i%sampStep===0;});
      var sampEq = eqFull.filter(function(_,i){return i%sampStep===0;});
      var sampBah = bahArr.filter(function(_,i){return i%sampStep===0;});
      var ctx = cvEq.getContext('2d');
      var grd = ctx.createLinearGradient(0,0,0,220);
      grd.addColorStop(0,'rgba(0,212,170,.2)');grd.addColorStop(1,'rgba(0,212,170,0)');
      QT.btCharts['eq'] = new Chart(ctx,{type:'line',data:{labels:sampDates,datasets:[
        {label:'Strategi',data:sampEq,borderColor:'#00d4aa',borderWidth:2,fill:true,backgroundColor:grd,tension:.3,pointRadius:0},
        {label:'Buy & Hold',data:sampBah,borderColor:'rgba(255,102,0,.6)',borderWidth:1.5,borderDash:[5,3],fill:false,tension:.3,pointRadius:0}
      ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#b8bdd4',font:{family:'IBM Plex Mono',size:10}}},tooltip:{backgroundColor:'rgba(10,10,20,.92)',titleColor:'#ff6600',bodyColor:'#c0c0d8'}},scales:{x:{ticks:{color:'#8a90ad',font:{size:9},maxTicksLimit:10},grid:{color:'rgba(255,102,0,.05)'}},y:{ticks:{color:'#8a90ad',font:{size:9},callback:function(v){return 'Rp'+fmtK(v);}},grid:{color:'rgba(255,102,0,.05)'}}}}});
    }

    // Drawdown chart
    if(QT.btCharts['dd']){QT.btCharts['dd'].destroy();}
    var cvDd = el('bt-dd-chart');
    if(cvDd){
      var sampDD = ddFull.filter(function(_,i){return i%Math.max(1,Math.floor(dates.length/120))===0;});
      var sampDt = dates.filter(function(_,i){return i%Math.max(1,Math.floor(dates.length/120))===0;});
      QT.btCharts['dd'] = new Chart(cvDd.getContext('2d'),{type:'line',data:{labels:sampDt,datasets:[{data:sampDD,borderColor:'#ff2244',borderWidth:1.5,fill:true,backgroundColor:'rgba(255,34,68,.1)',tension:.3,pointRadius:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#8a90ad',font:{size:9},maxTicksLimit:8},grid:{color:'rgba(255,102,0,.05)'}},y:{ticks:{color:'#8a90ad',font:{size:9},callback:function(v){return v.toFixed(1)+'%'}},grid:{color:'rgba(255,102,0,.05)'}}}}});
    }

    // Candlestick SVG
    var svg = el('bt-candle-svg');
    if(svg && data.length){
      var vb=900, vh=240, pad=40, last80 = data.slice(-80);
      var allH=last80.map(function(d){return d.high;}), allL=last80.map(function(d){return d.low;});
      var mn=Math.min.apply(null,allL), mx=Math.max.apply(null,allH), rng2=mx-mn||1;
      var bw=Math.max(3, (vb-pad*2)/last80.length-2);
      var toY=function(v){return pad+((mx-v)/rng2)*(vh-pad*2);};
      var svgHtml='<rect width="'+vb+'" height="'+vh+'" fill="none"/>';
      last80.forEach(function(d,i){
        var x=pad+i*(vb-pad*2)/last80.length+bw/2;
        var oy=toY(d.open),cy=toY(d.close),hy=toY(d.high),ly=toY(d.low);
        var up=d.close>=d.open;
        svgHtml+='<line x1="'+x+'" y1="'+hy+'" x2="'+x+'" y2="'+ly+'" stroke="'+(up?'#00d4aa':'#ff2244')+'" stroke-width="1"/>';
        svgHtml+='<rect x="'+(x-bw/2)+'" y="'+Math.min(oy,cy)+'" width="'+bw+'" height="'+Math.max(2,Math.abs(cy-oy))+'" fill="'+(up?'#00d4aa':'#ff2244')+'"/>';
      });
      // Draw signals on last80
      var start80 = data.length - 80;
      signals.forEach(function(sig){
        if(sig.i >= start80){
          var ri = sig.i - start80;
          var x = pad + ri * (vb-pad*2)/last80.length + bw/2;
          var y = toY(data[sig.i].close);
          if(sig.type==='BUY'){
            svgHtml+='<polygon points="'+(x)+','+(y+10)+' '+(x-5)+','+(y+18)+' '+(x+5)+','+(y+18)+'" fill="#00d4aa"/>';
          } else {
            svgHtml+='<polygon points="'+(x)+','+(y-10)+' '+(x-5)+','+(y-18)+' '+(x+5)+','+(y-18)+'" fill="#ff2244"/>';
          }
        }
      });
      svg.innerHTML = svgHtml;
      el('bt-candle-sub') && (el('bt-candle-sub').textContent = ticker+' · 80 hari terakhir · '+signals.length+' sinyal');
    }

    // Monthly heatmap
    var monthHm = el('bt-monthly-hm');
    if(monthHm){
      var mrets = {};
      dates.forEach(function(dt,i){
        var ym=dt.slice(0,7), y=dt.slice(0,4), m=dt.slice(5,7);
        if(!mrets[y]) mrets[y]={};
        mrets[y][m] = (close[i]-close[Math.max(0,i-22)])/close[Math.max(0,i-22)]*100;
      });
      var years = Object.keys(mrets).sort();
      var html='<div style="overflow-x:auto"><table style="border-collapse:collapse;font-size:9px;font-family:IBM Plex Mono,monospace">';
      html+='<tr><th style="padding:3px 6px;color:var(--text3)"></th>'+QT_MONTHS.map(function(m){return '<th style="padding:3px 5px;color:var(--text3)">'+m+'</th>';}).join('')+'</tr>';
      years.forEach(function(y){
        html+='<tr><td style="padding:3px 6px;font-weight:700;color:var(--text2)">'+y+'</td>';
        for(var mi=0;mi<12;mi++){
          var mk=('0'+(mi+1)).slice(-2);
          var v=mrets[y]&&mrets[y][mk]!==undefined?mrets[y][mk]:null;
          var bg=v===null?'transparent':v>=0?'rgba(0,212,170,'+(0.15+Math.min(Math.abs(v)/10,0.7))+')':'rgba(255,34,68,'+(0.15+Math.min(Math.abs(v)/10,0.7))+')';
          var col=v===null?'var(--text3)':v>=0?'var(--green)':'var(--red)';
          html+='<td style="background:'+bg+';color:'+col+';padding:4px 5px;text-align:center;border-radius:2px;min-width:38px">'+(v===null?'—':v.toFixed(1)+'%')+'</td>';
        }
        html+='</tr>';
      });
      html+='</table></div>';
      monthHm.innerHTML = html;
    }

    // Transaction log
    var tbody = el('bt-tx-tbody');
    if(tbody){
      tbody.innerHTML = txLog.slice(0,50).map(function(t,i){
        var retCol = t.ret>=0?'var(--green)':'var(--red)';
        return '<tr><td>'+(i+1)+'</td><td>'+t.entry+'</td><td>'+t.exit+'</td>'
          +'<td><span class="sig '+(t.ret>=0?'sig-buy':'sig-sell')+'">'+(t.ret>=0?'BUY':'SELL')+'</span></td>'
          +'<td>Rp '+Math.round(t.entryP).toLocaleString('id-ID')+'</td>'
          +'<td>Rp '+Math.round(t.exitP).toLocaleString('id-ID')+'</td>'
          +'<td>'+t.dur+'h</td>'
          +'<td style="color:'+retCol+'">'+(t.ret>=0?'+':'')+t.ret.toFixed(2)+'%</td>'
          +'<td style="color:'+retCol+'">'+(t.pnl>=0?'+':'')+'Rp '+Math.round(t.pnl).toLocaleString('id-ID')+'</td>'
          +'</tr>';
      }).join('');
    }
    el('bt-tx-count') && (el('bt-tx-count').textContent = txLog.length + ' trades');
    el('bt-empty').style.display='none';
    el('bt-results').style.display='block';
  }

  // Use live data if already fetched, otherwise fetch first
  if(QT.btData && QT.btData.length > 100){
    doBacktest(QT.btData);
  } else {
    qtFetchOHLCV(ticker, days, function(err, data){ doBacktest(data); });
  }
}

// ── Screener ──
function scBuildSim(){
  QT.scData = LQ45_STOCKS.map(function(st){
    var data = qtGenSim(st.t, 180);
    var close = data.map(function(d){return d.close;});
    var rsi2 = qtRSI(close, 14);
    var ma50 = qtSMA(close, 50);
    var rsiLast = rsi2[rsi2.length-1]||50;
    var lc=close[close.length-1], lm=ma50[ma50.length-1];
    var mom1m=(lc-close[close.length-22])/close[close.length-22]*100;
    var mom3m=(lc-close[Math.max(0,close.length-66)])/close[Math.max(0,close.length-66)]*100;
    var vol=Math.sqrt(close.slice(-30).slice(1).map(function(c,i){return Math.pow((c-close.slice(-30)[i])/close.slice(-30)[i]*100,2);}).reduce(function(a,b){return a+b;},0)/29);
    var score=Math.round((50-Math.abs(rsiLast-50))/50*40+(mom1m>0?Math.min(mom1m*2,30):0)+(lc>lm?20:0));
    return Object.assign({},st,{rsi:rsiLast,mom1m:mom1m,mom3m:mom3m,vol:vol,price:lc,aboveMa:lc>lm,score:score,live:false});
  });
  scRenderTable();
}

function scFetchAndRun(){
  el('sc-status').textContent='📡 Mengambil data live...';
  var pending = LQ45_STOCKS.length;
  var results = {};
  LQ45_STOCKS.forEach(function(st, idx){
    setTimeout(function(){
      yfFetch(st.t+'.JK', function(err, meta){
        if(!err && meta && meta.regularMarketPrice>0){
          results[st.t] = meta.regularMarketPrice;
        }
        pending--;
        if(pending<=0){
          // Update prices and rebuild
          QT.scData.forEach(function(s){
            if(results[s.t]) s.price = results[s.t];
          });
          scRenderTable();
          el('sc-status').textContent='✅ Data live per '+(new Date().toLocaleTimeString('id-ID'));
        }
      });
    }, idx * 800);
  });
}

function scRunFilter(){
  var rsiMin=parseFloat(el('sc-rsi-min').value||0);
  var rsiMax=parseFloat(el('sc-rsi-max').value||100);
  var momMin=parseFloat(el('sc-mom-min').value||-99);
  var maPos=el('sc-ma-pos').value;
  if(!QT.scData.length) scBuildSim();
  var filtered = QT.scData.filter(function(s){
    if(s.rsi<rsiMin||s.rsi>rsiMax) return false;
    if(s.mom1m<momMin) return false;
    if(maPos==='above'&&!s.aboveMa) return false;
    if(maPos==='below'&&s.aboveMa) return false;
    return true;
  });
  el('sc-result-count').textContent = filtered.length + ' / ' + QT.scData.length + ' saham';
  scRenderTable(filtered);
}

function scRenderTable(data2){
  var data3 = data2 || QT.scData;
  el('sc-result-count') && (el('sc-result-count').textContent = data3.length + ' saham');
  var tbody = el('sc-tbody');
  if(!tbody) return;
  tbody.innerHTML = data3.sort(function(a,b){return b.score-a.score;}).map(function(s){
    var rsiCol = s.rsi<30?'var(--green)':s.rsi>70?'var(--red)':'var(--amber)';
    var sig = s.rsi<30?'BUY':s.rsi>70?'SELL':'HOLD';
    var sigClass = s.rsi<30?'sig-buy':s.rsi>70?'sig-sell':'sig-hold';
    var scoreCol = s.score>70?'var(--green)':s.score>40?'var(--amber)':'var(--red)';
    return '<tr>'
      +'<td style="color:var(--bb-orange);font-weight:700">'+s.t+(s.live?'<span style="font-size:8px;color:var(--green);margin-left:4px">●</span>':'')+'</td>'
      +'<td style="color:var(--text2)">'+s.n+'</td>'
      +'<td><span class="badge b-gray">'+s.s+'</span></td>'
      +'<td>Rp '+Math.round(s.price).toLocaleString('id-ID')+'</td>'
      +'<td style="color:'+rsiCol+'">'+s.rsi.toFixed(1)+'</td>'
      +'<td style="color:'+(s.mom1m>=0?'var(--green)':'var(--red)')+'">'+(s.mom1m>=0?'+':'')+s.mom1m.toFixed(2)+'%</td>'
      +'<td style="color:'+(s.mom3m>=0?'var(--green)':'var(--red)')+'">'+(s.mom3m>=0?'+':'')+s.mom3m.toFixed(2)+'%</td>'
      +'<td style="color:var(--purple)">'+s.vol.toFixed(2)+'%</td>'
      +'<td style="color:'+(s.aboveMa?'var(--green)':'var(--red)')+'">'+(s.aboveMa?'▲ Atas':'▼ Bawah')+'</td>'
      +'<td style="color:'+scoreCol+';font-weight:700">'+s.score+'</td>'
      +'<td><span class="sig '+sigClass+'">'+sig+'</span></td>'
      +'</tr>';
  }).join('');
}

// ── Factor Heatmap ──
function fhmRender(){
  if(!QT.scData.length) scBuildSim();
  var factor = (el('fhm-factor')&&el('fhm-factor').value)||'rsi';
  var sort2 = (el('fhm-sort')&&el('fhm-sort').value)||'sector';
  var fLabels={rsi:'RSI (14)',mom1m:'Momentum 1M (%)',mom3m:'Momentum 3M (%)',vol:'Volatilitas 30D (%)',score:'Composite Score'};
  el('fhm-title') && (el('fhm-title').textContent = (fLabels[factor]||factor) + ' — LQ45 Universe');

  var stocks = QT.scData.slice();
  var vals = stocks.map(function(s){return parseFloat(s[factor])||0;});
  var mn=Math.min.apply(null,vals), mx=Math.max.apply(null,vals);

  var tile = function(s){
    var v=parseFloat(s[factor])||0, norm=(v-mn)/Math.max(mx-mn,.01);
    var bg,col;
    if(factor==='rsi'){bg=v<30?'rgba(0,212,170,.6)':v>70?'rgba(255,34,68,.6)':'rgba(255,187,0,.2)';col=v<30?'#00d4aa':v>70?'#ff2244':'#ffbb00';}
    else if(factor==='vol'){bg='rgba(155,127,232,'+(0.15+norm*0.7)+')';col='var(--purple)';}
    else{bg=v>=0?'rgba(0,212,170,'+(0.15+norm*0.7)+')':'rgba(255,34,68,'+(0.15+(1-norm)*0.7)+')';col=v>=0?'var(--green)':'var(--red)';}
    return '<div style="background:'+bg+';border-radius:3px;padding:8px 6px;border:1px solid rgba(255,255,255,.06)">'
      +'<div style="font-size:11px;font-weight:700;color:var(--text);font-family:IBM Plex Mono,monospace">'+s.t+'</div>'
      +'<div style="font-size:12px;font-weight:600;color:'+col+';font-family:IBM Plex Mono,monospace;margin-top:2px">'+(factor!=='rsi'&&v>=0?'+':'')+v.toFixed(factor==='score'?0:1)+'</div>'
      +'</div>';
  };

  var grid = el('fhm-grid');
  if(!grid) return;
  if(sort2==='sector'){
    var sec={};
    stocks.forEach(function(s){if(!sec[s.s])sec[s.s]=[];sec[s.s].push(s);});
    var h='';
    Object.entries(sec).forEach(function(e){
      h+='<div style="margin-bottom:14px"><div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">'+e[0]+'</div>'
        +'<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(90px,1fr));gap:4px">'+e[1].map(tile).join('')+'</div></div>';
    });
    grid.innerHTML=h;
  } else {
    stocks.sort(function(a,b){return (parseFloat(b[factor])||0)-(parseFloat(a[factor])||0);});
    grid.innerHTML='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(90px,1fr));gap:4px">'+stocks.map(tile).join('')+'</div>';
  }

  // Distribution chart
  if(QT.btCharts['fhm-dist']){QT.btCharts['fhm-dist'].destroy();}
  var cv = el('fhm-dist-chart');
  if(cv){
    QT.btCharts['fhm-dist'] = new Chart(cv.getContext('2d'),{type:'bar',data:{labels:stocks.map(function(s){return s.t;}),datasets:[{data:vals,backgroundColor:vals.map(function(v){return v>=0&&factor!=='rsi'?'rgba(0,212,170,.5)':'rgba(74,158,255,.5)';}),borderRadius:3}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#8a90ad',font:{size:9}},grid:{display:false}},y:{ticks:{color:'#555d6e',font:{size:9}},grid:{color:'rgba(255,255,255,.04)'}}}}}); 
  }
}

// ── Correlation Matrix ──
function corrRender(){
  if(!QT.scData.length) scBuildSim();
  var TICKERS=['BBCA','BBRI','BMRI','BBNI','TLKM','ASII','ANTM','ADRO','UNVR','AMRT'];
  var returns={};
  TICKERS.forEach(function(t){
    var d=qtGenSim(t,200); var close=d.map(function(x){return x.close;});
    returns[t]=close.slice(1).map(function(c,i){return (c-close[i])/close[i];});
  });
  var matrix=TICKERS.map(function(a){return TICKERS.map(function(b){return qtPearson(returns[a],returns[b]);});});
  var mEl=el('corr-matrix');
  if(mEl){
    var h='<div style="overflow-x:auto"><div style="display:grid;grid-template-columns:60px '+TICKERS.map(function(){return '1fr';}).join(' ')+';gap:2px">';
    h+='<div></div>'+TICKERS.map(function(t){return '<div style="font-size:10px;font-weight:700;color:var(--text2);text-align:center;padding:2px">'+t+'</div>';}).join('');
    TICKERS.forEach(function(a,i){
      h+='<div style="font-size:10px;font-weight:700;color:var(--text2);display:flex;align-items:center;padding-right:4px">'+a+'</div>';
      TICKERS.forEach(function(b,j){
        var v=matrix[i][j]; var bg,col;
        if(i===j){bg='rgba(255,255,255,.08)';col='var(--text3)';}
        else if(v>0){var int2=Math.min(1,v/.8);bg='rgba(0,212,170,'+(0.15+int2*.65)+')';col='var(--green)';}
        else{var int3=Math.min(1,Math.abs(v)/.8);bg='rgba(255,34,68,'+(0.15+int3*.65)+')';col='var(--red)';}
        h+='<div style="background:'+bg+';color:'+col+';display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:600;border-radius:2px;height:30px;margin:1px;font-family:IBM Plex Mono,monospace" title="'+a+' vs '+b+': '+v.toFixed(3)+'">'+(i===j?'1.00':v.toFixed(2))+'</div>';
      });
    });
    h+='</div></div>';
    mEl.innerHTML=h;
  }

  // Pairs insight
  var pairs2=[]; TICKERS.forEach(function(a,i){TICKERS.forEach(function(b,j){if(j>i)pairs2.push({a:a,b:b,v:matrix[i][j]});});}); pairs2.sort(function(x,y){return y.v-x.v;});
  var pEl=el('corr-pairs');
  if(pEl){
    var top=pairs2.slice(0,5), bot=pairs2.slice(-5).reverse();
    pEl.innerHTML='<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'
      +'<div><div style="font-size:11px;font-weight:700;color:var(--green);margin-bottom:8px">Korelasi Tertinggi — kandidat pairs trading</div>'
      +top.map(function(p){return '<div style="display:flex;justify-content:space-between;padding:6px 9px;background:var(--bg3);border-radius:2px;margin-bottom:4px;border:1px solid var(--border)"><span style="font-family:IBM Plex Mono,monospace;color:var(--text);font-size:12px">'+p.a+' / '+p.b+'</span><span style="color:var(--green);font-weight:700;font-family:IBM Plex Mono,monospace">+'+p.v.toFixed(3)+'</span></div>';}).join('')+'</div>'
      +'<div><div style="font-size:11px;font-weight:700;color:var(--red);margin-bottom:8px">Korelasi Terendah — kandidat diversifikasi</div>'
      +bot.map(function(p){return '<div style="display:flex;justify-content:space-between;padding:6px 9px;background:var(--bg3);border-radius:2px;margin-bottom:4px;border:1px solid var(--border)"><span style="font-family:IBM Plex Mono,monospace;color:var(--text);font-size:12px">'+p.a+' / '+p.b+'</span><span style="color:'+(p.v>=0?'var(--amber)':'var(--red)')+';font-weight:700;font-family:IBM Plex Mono,monospace">'+(p.v>=0?'+':'')+p.v.toFixed(3)+'</span></div>';}).join('')+'</div>'
      +'</div>';
  }
}

// ── Monthly Returns ──
function mrFetch(){
  var ticker = el('mr-ticker').value||'BBCA';
  el('mr-title') && (el('mr-title').textContent = 'Monthly Return — '+ticker+' (📡 Live)');
  qtFetchOHLCV(ticker, 1825, function(err, data){
    QT.mrData[ticker] = data;
    mrRender();
  });
}

function mrRender(){
  var ticker = (el('mr-ticker')&&el('mr-ticker').value)||'BBCA';
  var startY = parseInt((el('mr-year')&&el('mr-year').value)||2024);
  var data = QT.mrData[ticker] || qtGenSim(ticker, 365*3);
  el('mr-title') && (el('mr-title').textContent = 'Monthly Return — '+ticker);

  // Build monthly return map
  var monthRets = {};
  var close = data.map(function(d){return d.close;});
  var dates = data.map(function(d){return d.date;});
  dates.forEach(function(dt, i){
    var ym=dt.slice(0,7), y=parseInt(ym.slice(0,4));
    if(y<startY) return;
    if(i<22) return;
    var ret=(close[i]-close[i-22])/close[i-22]*100;
    monthRets[ym] = ret; // last day of month wins
  });

  // Heatmap
  var hmEl = el('mr-heatmap');
  if(hmEl){
    var years2=[]; var now2=new Date();
    for(var y=startY;y<=now2.getFullYear();y++) years2.push(y);
    var h='<div style="overflow-x:auto"><table style="border-collapse:collapse;font-size:10px;font-family:IBM Plex Mono,monospace">';
    h+='<tr><th style="padding:3px 8px;color:var(--text3);text-align:left">Tahun</th>'+QT_MONTHS.map(function(m){return '<th style="padding:3px 7px;color:var(--text3)">'+m+'</th>';}).join('')+'<th style="padding:3px 7px;color:var(--text3)">YTD</th></tr>';
    years2.forEach(function(y){
      h+='<tr><td style="padding:4px 8px;font-weight:700;color:var(--text2)">'+y+'</td>';
      var ytd=0;
      for(var mi=0;mi<12;mi++){
        var ym2=y+'-'+('0'+(mi+1)).slice(-2);
        var v=monthRets[ym2];
        var bg=v===undefined?'transparent':v>=0?'rgba(0,212,170,'+(0.12+Math.min(Math.abs(v)/8,.7))+')':'rgba(255,34,68,'+(0.12+Math.min(Math.abs(v)/8,.7))+')';
        var col=v===undefined?'var(--text3)':v>=0?'var(--green)':'var(--red)';
        h+='<td style="background:'+bg+';color:'+col+';padding:4px 5px;text-align:center;border-radius:2px;min-width:40px;border:1px solid var(--border)">'+(v===undefined?'—':v.toFixed(1)+'%')+'</td>';
        if(v!==undefined) ytd+=v;
      }
      h+='<td style="color:'+(ytd>=0?'var(--green)':'var(--red)')+';font-weight:700;padding:4px 8px;text-align:center">'+(ytd===0?'—':(ytd>=0?'+':'')+ytd.toFixed(1)+'%')+'</td>';
      h+='</tr>';
    });
    h+='</table></div>';
    hmEl.innerHTML=h;
  }

  // Average by month chart
  var byMo=Array(12).fill(null).map(function(){return [];});
  Object.keys(monthRets).forEach(function(ym){
    var mi=parseInt(ym.slice(5,7))-1;
    byMo[mi].push(monthRets[ym]);
  });
  var avg=byMo.map(function(a){return a.length?a.reduce(function(x,y){return x+y;},0)/a.length:0;});
  var wr=byMo.map(function(a){return a.length?a.filter(function(r){return r>0;}).length/a.length*100:0;});

  if(QT.btCharts['mr-avg']){QT.btCharts['mr-avg'].destroy();}
  if(QT.btCharts['mr-wr']){QT.btCharts['mr-wr'].destroy();}
  var cvAvg=el('mr-avg-chart'), cvWr=el('mr-wr-chart');
  if(cvAvg){
    QT.btCharts['mr-avg']=new Chart(cvAvg.getContext('2d'),{type:'bar',data:{labels:QT_MONTHS,datasets:[{data:avg,backgroundColor:avg.map(function(v){return v>=0?'rgba(0,212,170,.6)':'rgba(255,34,68,.6)';}),borderRadius:3}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#8a90ad',font:{size:10}},grid:{display:false}},y:{ticks:{color:'#555d6e',font:{size:9},callback:function(v){return v.toFixed(1)+'%';}},grid:{color:'rgba(255,102,0,.05)'}}}}});
  }
  if(cvWr){
    QT.btCharts['mr-wr']=new Chart(cvWr.getContext('2d'),{type:'bar',data:{labels:QT_MONTHS,datasets:[{data:wr,backgroundColor:'rgba(74,158,255,.5)',borderRadius:3}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#8a90ad',font:{size:10}},grid:{display:false}},y:{min:0,max:100,ticks:{color:'#555d6e',font:{size:9},callback:function(v){return v+'%';}},grid:{color:'rgba(255,102,0,.05)'}}}}});
  }
}

// ── Pairs Trading ──
function pairsFetch(){
  var a=(el('pt-a').value||'BBCA').toUpperCase(), b=(el('pt-b').value||'BBRI').toUpperCase();
  el('pt-stats').innerHTML='📡 Mengambil data live...';
  var dataA, dataB, done=0;
  function tryDone(){
    done++;
    if(done===2&&dataA&&dataB) pairsAnalyzeWith(a,b,dataA,dataB);
  }
  qtFetchOHLCV(a,365,function(e,d){dataA=d;tryDone();});
  setTimeout(function(){qtFetchOHLCV(b,365,function(e,d){dataB=d;tryDone();});},1000);
}

function pairsAnalyze(){
  var a=(el('pt-a').value||'BBCA').toUpperCase(), b=(el('pt-b').value||'BBRI').toUpperCase();
  pairsAnalyzeWith(a,b, qtGenSim(a,365), qtGenSim(b,365));
}

function pairsAnalyzeWith(a,b,dataA,dataB){
  var closeA=dataA.map(function(d){return d.close;}), closeB=dataB.map(function(d){return d.close;});
  var n=Math.min(closeA.length,closeB.length);
  var A=closeA.slice(-n), B=closeB.slice(-n);
  var dates=dataA.slice(-n).map(function(d){return d.date;});

  // Normalize to 100
  var normA=A.map(function(v){return v/A[0]*100;}), normB=B.map(function(v){return v/B[0]*100;});

  // Spread & z-score
  var spread=A.map(function(v,i){return v-B[i];});
  var spreadMean=spread.reduce(function(s,v){return s+v;},0)/spread.length;
  var spreadStd=Math.sqrt(spread.map(function(v){return Math.pow(v-spreadMean,2);}).reduce(function(s,v){return s+v;},0)/spread.length);
  var zscore=spread.map(function(v){return (v-spreadMean)/(spreadStd||1);});
  var lastZ=zscore[zscore.length-1];
  var corr=qtPearson(A,B);

  el('pt-stats').innerHTML=[
    'Pair: <b style="color:var(--bb-orange)">'+a+' / '+b+'</b>',
    'Korelasi: <b style="color:'+(corr>0.7?'var(--green)':corr>0.4?'var(--amber)':'var(--red)')+'">'+corr.toFixed(3)+'</b>',
    'Z-Score terakhir: <b style="color:'+(Math.abs(lastZ)>2?'var(--red)':Math.abs(lastZ)>1?'var(--amber)':'var(--green)')+'">'+lastZ.toFixed(2)+'</b>',
    'Spread Mean: <b>'+Math.round(spreadMean).toLocaleString('id-ID')+'</b>',
    'Spread Std: <b>'+Math.round(spreadStd).toLocaleString('id-ID')+'</b>',
    'Harga '+a+' terakhir: <b>Rp '+Math.round(A[A.length-1]).toLocaleString('id-ID')+'</b>',
    'Harga '+b+' terakhir: <b>Rp '+Math.round(B[B.length-1]).toLocaleString('id-ID')+'</b>'
  ].map(function(s){return '<div style="padding:3px 0;font-size:10px;color:var(--text2)">'+s+'</div>';}).join('');

  var sigBadge=el('pt-signal-badge');
  if(sigBadge){
    if(lastZ>2){sigBadge.textContent='SHORT '+a+' / LONG '+b;sigBadge.className='badge b-dn';}
    else if(lastZ<-2){sigBadge.textContent='LONG '+a+' / SHORT '+b;sigBadge.className='badge b-up';}
    else{sigBadge.textContent='DALAM BAND — No Signal';sigBadge.className='badge b-gray';}
  }

  // Z-score chart
  if(QT.btCharts['pt-spread']){QT.btCharts['pt-spread'].destroy();}
  var cvS=el('pt-spread-chart');
  if(cvS){
    var sampStep=Math.max(1,Math.floor(n/120));
    var sampZ=zscore.filter(function(_,i){return i%sampStep===0;});
    var sampD=dates.filter(function(_,i){return i%sampStep===0;});
    QT.btCharts['pt-spread']=new Chart(cvS.getContext('2d'),{type:'line',data:{labels:sampD,datasets:[
      {data:sampZ,borderColor:'#9b7fe8',borderWidth:1.5,fill:false,tension:.3,pointRadius:0,label:'Z-Score'},
      {data:sampZ.map(function(){return 2;}),borderColor:'rgba(255,34,68,.4)',borderWidth:1,borderDash:[5,3],fill:false,pointRadius:0,label:'+2σ'},
      {data:sampZ.map(function(){return -2;}),borderColor:'rgba(0,212,170,.4)',borderWidth:1,borderDash:[5,3],fill:false,pointRadius:0,label:'-2σ'},
      {data:sampZ.map(function(){return 0;}),borderColor:'rgba(255,255,255,.15)',borderWidth:1,fill:false,pointRadius:0,label:'Mean'}
    ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#b8bdd4',font:{family:'IBM Plex Mono',size:9}}}},scales:{x:{ticks:{color:'#8a90ad',font:{size:9},maxTicksLimit:10},grid:{color:'rgba(255,102,0,.05)'}},y:{ticks:{color:'#8a90ad',font:{size:9}},grid:{color:'rgba(255,102,0,.05)'}}}}}); 
  }

  // Price chart normalized
  if(QT.btCharts['pt-price']){QT.btCharts['pt-price'].destroy();}
  var cvP=el('pt-price-chart');
  if(cvP){
    var sampStep2=Math.max(1,Math.floor(n/120));
    var sNA=normA.filter(function(_,i){return i%sampStep2===0;}), sNB=normB.filter(function(_,i){return i%sampStep2===0;}), sD=dates.filter(function(_,i){return i%sampStep2===0;});
    QT.btCharts['pt-price']=new Chart(cvP.getContext('2d'),{type:'line',data:{labels:sD,datasets:[
      {data:sNA,borderColor:'#00d4aa',borderWidth:2,fill:false,tension:.3,pointRadius:0,label:a},
      {data:sNB,borderColor:'#ff6600',borderWidth:2,fill:false,tension:.3,pointRadius:0,label:b}
    ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#b8bdd4',font:{family:'IBM Plex Mono',size:10}}}},scales:{x:{ticks:{color:'#8a90ad',font:{size:9},maxTicksLimit:10},grid:{color:'rgba(255,102,0,.05)'}},y:{ticks:{color:'#8a90ad',font:{size:9},callback:function(v){return v.toFixed(0);}},grid:{color:'rgba(255,102,0,.05)'}}}}});
  }
}

// Init: build screener data on load so it's ready
setTimeout(function(){ if(!QT.scData.length) scBuildSim(); }, 2000);
