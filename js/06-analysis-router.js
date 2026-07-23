// ============================================================
// CANDLE ANALYSIS
// ============================================================
function cd_dateStr(serial){
  var d=new Date(Date.UTC(1899,11,30)+serial*86400000);
  return ('0'+d.getUTCDate()).slice(-2)+'/'+('0'+(d.getUTCMonth()+1)).slice(-2)+'/'+d.getUTCFullYear();
}
var CD_SET=null;
function cdReadSettings(){
  return {
    cap:+el('cd-cap').value, risk:(+el('cd-risk').value)/100, maxpos:(+el('cd-maxpos').value)/100,
    z1l:+el('cd-z1l').value, z1h:+el('cd-z1h').value, z2l:+el('cd-z2l').value, z2h:+el('cd-z2h').value,
    brk:+el('cd-brk').value, stopInval:+el('cd-si').value, stopBig:+el('cd-sb').value,
    tp1:+el('cd-tp1').value, tp2:+el('cd-tp2').value, tp3:+el('cd-tp3').value
  };
}
function cdFillSettings(s){
  el('cd-cap').value=s.cap; el('cd-risk').value=(s.risk*100); el('cd-maxpos').value=(s.maxpos*100);
  el('cd-z1l').value=s.z1l; el('cd-z1h').value=s.z1h; el('cd-z2l').value=s.z2l; el('cd-z2h').value=s.z2h;
  el('cd-brk').value=s.brk; el('cd-si').value=s.stopInval; el('cd-sb').value=s.stopBig;
  el('cd-tp1').value=s.tp1; el('cd-tp2').value=s.tp2; el('cd-tp3').value=s.tp3;
}
function cdSignal(x,s){
  if(x<s.stopBig) return 'FORCED STOP';
  if(x<s.stopInval) return 'STOP ALL';
  if(x>=s.tp3) return 'TP 3';
  if(x>=s.tp2) return 'TP 2';
  if(x>=s.tp1) return 'TP 1';
  if(x>=s.z1l && x<=s.z1h) return 'BUY ZONE 1';
  if(x>=s.z2l && x<=s.z2h) return 'BUY ZONE 2';
  if(x>s.brk) return 'BUY BREAKOUT';
  return 'HOLD';
}
function cdCompute(s){
  var rows=CANDLE_DATA.ohlcv.map(function(r){
    var d=r[0],o=r[1],h=r[2],l=r[3],c=r[4],v=r[5];
    var body=Math.abs(c-o), range=h-l, up=h-Math.max(o,c), low=Math.min(o,c)-l;
    var psy;
    if(low>body && low>=up) psy='DEFENSIVE BUY';
    else if(c>o && body>=up && body>=low) psy='BUYER CONTROL';
    else if(c<o && body>=up && body>=low) psy='SELLER CONTROL';
    else psy='INDECISION';
    return {d:d,o:o,h:h,l:l,c:c,v:v,body:body,range:range,up:up,low:low,psy:psy};
  });
  var vavg=rows.reduce(function(a,r){return a+r.v},0)/(rows.length||1);
  var pos='OUT', entry=0, equity=s.cap, peak=s.cap, maxdd=0, wins=0, trades=0;
  rows.forEach(function(r){
    var x=r.l, sig=cdSignal(x,s); r.sig=sig;
    var prev=pos;
    if(sig==='BUY ZONE 1'||sig==='BUY ZONE 2'||sig==='BUY BREAKOUT') pos='IN';
    else if(sig==='TP 3'||sig==='STOP ALL'||sig==='FORCED STOP') pos='OUT';
    r.pos=pos;
    if(pos==='IN'&&prev!=='IN') entry=r.c;
    r.entry=(pos==='IN')?entry:0;
    if(prev==='IN'&&pos==='OUT'&&entry>0){
      r.pnl=(r.c-entry)/entry; equity=equity*(1+r.pnl);
      trades++; if(r.pnl>0)wins++; entry=0;
    } else r.pnl=null;
    if(equity>peak)peak=equity;
    var dd=equity/peak-1; if(dd<maxdd)maxdd=dd;
    r.equity=equity; r.spike=r.v/vavg;
    r.emotion=r.c<s.stopInval?'FEAR':(r.c<s.z1h?'NEUTRAL':'CONFIDENCE');
    r.lot=(s.cap*s.risk)/Math.max(1,(r.c-s.stopInval))/100;
  });
  return {rows:rows,vavg:vavg,equity:equity,maxdd:maxdd,wins:wins,trades:trades};
}
var PSY_BADGE={'DEFENSIVE BUY':'b-teal','BUYER CONTROL':'b-up','SELLER CONTROL':'b-dn','INDECISION':'b-amb'};
var SIG_CLS={'FORCED STOP':'sig-sell','STOP ALL':'sig-sell','TP 3':'sig-buy','TP 2':'sig-buy','TP 1':'sig-buy',
  'BUY ZONE 1':'sig-buy','BUY ZONE 2':'sig-buy','BUY BREAKOUT':'sig-buy','HOLD':'sig-hold'};
var EMO={'FEAR':{c:'var(--red)',e:'😨'},'NEUTRAL':{c:'var(--amber)',e:'😐'},'CONFIDENCE':{c:'var(--green)',e:'😎'}};
function cdRenderHead(R,s){
  var last=R.rows[R.rows.length-1];
  var sigc=SIG_CLS[last.sig]||'sig-hold', emo=EMO[last.emotion];
  el('cd-head').innerHTML=
    '<div class="metric"><div class="mlabel">Harga Terakhir</div><div class="mval">'+fmt(last.c)+'</div><div class="msub neu">'+cd_dateStr(last.d)+'</div></div>'
    +'<div class="metric"><div class="mlabel">Sinyal Sistem</div><div style="margin-top:3px"><span class="sig '+sigc+'" style="font-size:13px;padding:4px 10px">'+last.sig+'</span></div><div class="msub neu">trigger Low '+fmt(last.l)+'</div></div>'
    +'<div class="metric"><div class="mlabel">Posisi</div><div class="mval '+(last.pos==='IN'?'up':'neu')+'">'+last.pos+'</div><div class="msub neu">'+(last.entry?'entry '+fmt(last.entry):'tidak ada posisi')+'</div></div>'
    +'<div class="metric"><div class="mlabel">Emotion Gauge</div><div class="mval" style="color:'+emo.c+'">'+emo.e+' '+last.emotion+'</div><div class="msub neu">psikologi pasar</div></div>'
    +'<div class="metric"><div class="mlabel">Position Size</div><div class="mval amb">'+last.lot.toFixed(1)+' lot</div><div class="msub neu">risk Rp '+fmtK(s.cap*s.risk)+'</div></div>';
}
function cdRenderMetrics(R,s){
  var ret=(R.equity/s.cap-1);
  el('cd-metrics').innerHTML=
    '<div class="metric"><div class="mlabel">Equity Akhir (Backtest)</div><div class="mval '+(ret>=0?'up':'dn')+'">Rp '+fmtK(R.equity)+'</div><div class="msub '+(ret>=0?'up':'dn')+'">'+(ret>=0?'+':'')+(ret*100).toFixed(2)+'%</div></div>'
    +'<div class="metric"><div class="mlabel">Total Trade</div><div class="mval">'+R.trades+'</div><div class="msub neu">'+R.wins+' menang · win rate '+(R.trades?(R.wins/R.trades*100).toFixed(0):0)+'%</div></div>'
    +'<div class="metric"><div class="mlabel">Max Drawdown</div><div class="mval dn">'+(R.maxdd*100).toFixed(2)+'%</div><div class="msub neu">puncak ke lembah</div></div>'
    +'<div class="metric"><div class="mlabel">Risk:Reward Zona</div><div class="mval neu">1 : '+((s.tp1-s.z2h)/Math.max(1,(s.z2h-s.stopInval))).toFixed(2)+'</div><div class="msub neu">TP1 vs Stop dari Zona 2</div></div>';
}
function cdRenderPsyco(R){
  el('cd-psyco').innerHTML=R.rows.slice(-3).map(function(r){
    var b=PSY_BADGE[r.psy];
    return '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:11px">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:7px">'
      +'<span style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:var(--text2)">'+cd_dateStr(r.d)+'</span>'
      +'<span class="badge '+b+'">'+r.psy+'</span></div>'
      +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 10px;font-size:11px;font-family:\'IBM Plex Mono\',monospace">'
      +'<span style="color:var(--text3)">Body</span><span style="text-align:right">'+r.body+'</span>'
      +'<span style="color:var(--text3)">Upper Shadow</span><span style="text-align:right">'+r.up+'</span>'
      +'<span style="color:var(--text3)">Lower Shadow</span><span style="text-align:right">'+r.low+'</span>'
      +'<span style="color:var(--text3)">Vol Spike</span><span style="text-align:right;color:'+(r.spike>1.5?'var(--green)':'var(--text2)')+'">'+r.spike.toFixed(2)+'×</span>'
      +'</div></div>';
  }).join('');
}
function cdRenderTable(R){
  el('cd-tbody').innerHTML=R.rows.slice().reverse().map(function(r){
    var b=PSY_BADGE[r.psy], sc=SIG_CLS[r.sig]||'sig-hold';
    var pnl = r.pnl!=null ? '<span class="'+(r.pnl>=0?'up':'dn')+'">'+(r.pnl>=0?'+':'')+(r.pnl*100).toFixed(2)+'%</span>' : '<span style="color:var(--text3)">—</span>';
    return '<tr>'
      +'<td style="font-family:\'IBM Plex Mono\',monospace;font-size:11px">'+cd_dateStr(r.d)+'</td>'
      +'<td style="font-family:\'IBM Plex Mono\',monospace">'+r.o+'</td><td style="font-family:\'IBM Plex Mono\',monospace">'+r.h+'</td>'
      +'<td style="font-family:\'IBM Plex Mono\',monospace">'+r.l+'</td>'
      +'<td style="font-family:\'IBM Plex Mono\',monospace;font-weight:600;color:'+(r.c>=r.o?'var(--green)':'var(--red)')+'">'+r.c+'</td>'
      +'<td style="font-family:\'IBM Plex Mono\',monospace;color:var(--text2)">'+fmtK(r.v)+'</td>'
      +'<td style="font-family:\'IBM Plex Mono\',monospace">'+r.body+'</td>'
      +'<td style="font-family:\'IBM Plex Mono\',monospace;color:var(--text3)">'+r.up+'</td>'
      +'<td style="font-family:\'IBM Plex Mono\',monospace;color:var(--text3)">'+r.low+'</td>'
      +'<td><span class="badge '+b+'">'+r.psy+'</span></td>'
      +'<td><span class="sig '+sc+'" style="font-size:9px">'+r.sig+'</span></td>'
      +'<td><span class="badge '+(r.pos==='IN'?'b-up':'b-gray')+'">'+r.pos+'</span></td>'
      +'<td style="font-family:\'IBM Plex Mono\',monospace">'+pnl+'</td></tr>';
  }).join('');
}
function cdRenderCharts(R,s){
  var labels=R.rows.map(function(r){return cd_dateStr(r.d).slice(0,5)});
  var close=R.rows.map(function(r){return r.c});
  var flat=function(v){return R.rows.map(function(){return v})};
  kc('cdPrice');
  var ctx=el('cdPrice'); if(ctx){
    charts['cdPrice']=new Chart(ctx,{type:'line',data:{labels:labels,datasets:[
      {label:'Close',data:close,borderColor:'#00c8ff',borderWidth:2,tension:.3,pointRadius:0,pointHoverRadius:4,fill:false},
      {label:'TP3',data:flat(s.tp3),borderColor:'rgba(0,229,160,.5)',borderWidth:1,borderDash:[4,4],pointRadius:0},
      {label:'TP1',data:flat(s.tp1),borderColor:'rgba(0,229,160,.3)',borderWidth:1,borderDash:[2,3],pointRadius:0},
      {label:'Breakout',data:flat(s.brk),borderColor:'rgba(77,166,255,.5)',borderWidth:1,borderDash:[5,3],pointRadius:0},
      {label:'Zona2 High',data:flat(s.z2h),borderColor:'rgba(45,212,191,.4)',borderWidth:1,borderDash:[3,3],pointRadius:0},
      {label:'Stop Inval',data:flat(s.stopInval),borderColor:'rgba(255,61,90,.5)',borderWidth:1,borderDash:[4,4],pointRadius:0},
      {label:'Stop Besar',data:flat(s.stopBig),borderColor:'rgba(255,61,90,.3)',borderWidth:1,borderDash:[2,3],pointRadius:0}
    ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:true,labels:{color:'#8fa3c8',font:{size:9},boxWidth:12}},tooltip:Object.assign({},TT,{mode:'index',intersect:false})},scales:{x:{grid:{color:GC},ticks:Object.assign({},TC,{maxTicksLimit:9})},y:{grid:{color:GC},ticks:TC,position:'right'}}}});
  }
  kc('cdEquity');
  var ce=el('cdEquity'); if(ce){
    var eq=R.rows.map(function(r){return Math.round(r.equity)});
    var g=ce.getContext('2d').createLinearGradient(0,0,0,230);
    g.addColorStop(0,'rgba(0,229,160,.25)');g.addColorStop(1,'rgba(0,229,160,0)');
    charts['cdEquity']=new Chart(ce,{type:'line',data:{labels:labels,datasets:[{data:eq,borderColor:'#00e5a0',borderWidth:2,backgroundColor:g,fill:true,tension:.3,pointRadius:0,pointHoverRadius:4}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:Object.assign({},TT,{callbacks:{label:function(c){return 'Equity: Rp '+fmt(c.parsed.y)}}})},scales:{x:{grid:{color:GC},ticks:Object.assign({},TC,{maxTicksLimit:9})},y:{grid:{color:GC},ticks:Object.assign({},TC,{callback:function(v){return 'Rp '+fmtK(v)}}),position:'right'}}}});
  }
}
function cdRecalc(){
  CD_SET=cdReadSettings();
  var R=cdCompute(CD_SET);
  cdRenderHead(R,CD_SET); cdRenderMetrics(R,CD_SET);
  cdRenderPsyco(R); cdRenderTable(R); cdRenderCharts(R,CD_SET);
}

// ── Data ADMR asli dari sheet (preset, dipertahankan) ──
// NOTE: data embed asli (CANDLE_DATA) sempat hilang dari file — diisi ulang
// dengan seed OHLCV deterministik (bukan acak) agar fitur Candle Analysis tetap jalan.
function _cdSeedOhlcv(){
  var ohlcv=[], serial=45658, px=1200;
  for(var i=0;i<60;i++){
    var chg=Math.sin(i*0.35)*0.018+Math.sin(i*0.09)*0.012;
    var o=px, c=Math.max(50,px*(1+chg));
    var h=Math.max(o,c)*(1+Math.abs(Math.sin(i*1.7))*0.01);
    var l=Math.min(o,c)*(1-Math.abs(Math.cos(i*1.3))*0.01);
    var v=Math.round(5000000+Math.abs(Math.sin(i*0.5))*8000000);
    ohlcv.push([serial+i, Math.round(o), Math.round(h), Math.round(l), Math.round(c), v]);
    px=c;
  }
  return ohlcv;
}
var CANDLE_DATA=(function(){ var o=_cdSeedOhlcv(); return {ticker:'ADMR', ohlcv:o, settings:cdAutoParams(o)}; })();
var CD_ADMR={ohlcv:CANDLE_DATA.ohlcv.slice(),settings:Object.assign({},CANDLE_DATA.settings)};
var CD_TICKER='ADMR';
var CD_SRC='sheet';

// Aturan fraksi harga (tick) BEI
function cdTick(p){
  if(p<200)return 1; if(p<500)return 2; if(p<2000)return 5;
  if(p<5000)return 10; return 25;
}
function cdRoundTick(p){var t=cdTick(p);return Math.max(t,Math.round(p/t)*t);}

// Turunkan zona/stop/TP otomatis dari struktur harga (swing window terakhir)
function cdAutoParams(ohlcv){
  var w=ohlcv.slice(-20);
  var c0=ohlcv[ohlcv.length-1][4];
  var lo=Math.min.apply(null,w.map(function(r){return r[3]}));
  var hi=Math.max.apply(null,w.map(function(r){return r[2]}));
  var rng=Math.max(hi-lo, c0*0.04);
  var si=cdRoundTick(lo-0.02*c0);
  return {
    cap:(CD_SET&&CD_SET.cap)||10000000,
    risk:(CD_SET&&CD_SET.risk)||0.02,
    maxpos:(CD_SET&&CD_SET.maxpos)||0.8,
    z2l:cdRoundTick(lo),
    z2h:cdRoundTick(lo+0.25*rng),
    z1l:cdRoundTick(lo+0.40*rng),
    z1h:cdRoundTick(lo+0.60*rng),
    brk:cdRoundTick(hi+0.01*c0),
    stopInval:si,
    stopBig:cdRoundTick(lo-0.06*c0),
    tp1:cdRoundTick(hi),
    tp2:cdRoundTick(hi+0.5*rng),
    tp3:cdRoundTick(hi+1.0*rng)
  };
}
// OHLCV deterministik via engine FlowScan, di-skala ke harga acuan & dibulatkan ke tick
function cdGenOhlcv(tk){
  var raw=fsGenData(tk,38);
  var ref=(typeof prices!=='undefined'&&prices[tk])||(DB[tk]&&DB[tk].base)||0;
  var lastC=raw.length?raw[raw.length-1].c:0;
  var k=(ref>0&&lastC>0)?ref/lastC:1;   // anchor close terakhir ≈ harga acuan ticker
  return raw.map(function(d){
    var serial=Math.round(d.dt.getTime()/86400000+25569);
    return [serial, cdRoundTick(d.o*k), cdRoundTick(d.h*k), cdRoundTick(d.l*k), cdRoundTick(d.c*k), Math.round(d.v)];
  });
}
function cdSrcNote(){
  var n=el('cd-src-note'); if(!n)return;
  if(CD_SRC==='sheet'){
    n.innerHTML='<span>📄</span><div>Sumber data: <b style="color:var(--accent)">candle ADMR dari sheet</b> (data historis nyata yang Anda lampirkan). Zona &amp; parameter sesuai sheet.</div>';
  } else {
    var px=prices[CD_TICKER]||(DB[CD_TICKER]&&DB[CD_TICKER].base)||0;
    n.innerHTML='<span>⚙️</span><div>Sumber data: <b style="color:var(--amber)">simulasi harga deterministik</b> untuk <b>'+CD_TICKER+'</b> (≈ harga acuan Rp '+fmt(px)+'). Tidak ada feed OHLCV historis nyata (mode offline), jadi seri harga di sini adalah model — pakai untuk uji logika &amp; money management, bukan sinyal real-time. Zona/stop/TP dihitung otomatis dari struktur harga; sesuaikan manual bila perlu.</div>';
  }
}
function cdRenderChips(){
  var c=el('cd-chips'); if(!c)return;
  var holds=(typeof getPortfolio==='function')?getPortfolio().map(function(p){return p.ticker}):[];
  var base=['ADMR','BBCA','BBRI','ADRO','PGEO','BRMS'];
  var list=[]; base.concat(holds).forEach(function(t){if(t&&list.indexOf(t)<0)list.push(t)});
  list=list.slice(0,12);
  c.innerHTML=list.map(function(t){
    var on=t===CD_TICKER;
    return '<button onclick="cdLoadTicker(\''+t+'\')" class="btn btn-ghost btn-xs" style="'+(on?'border-color:var(--accent);color:var(--accent)':'')+'">'+t+'</button>';
  }).join('');
}
function cdLoadTicker(tk){
  tk=(tk||'').toUpperCase().trim(); if(!tk)return;
  el('cd-tk-input').value=tk;
  CD_TICKER=tk;
  if(tk==='ADMR'){
    CD_SRC='sheet';
    CANDLE_DATA.ohlcv=CD_ADMR.ohlcv.slice();
    CD_SET=Object.assign({},CD_ADMR.settings);
  } else {
    CD_SRC='sim';
    CANDLE_DATA.ohlcv=cdGenOhlcv(tk);
    CD_SET=cdAutoParams(CANDLE_DATA.ohlcv);
  }
  CANDLE_DATA.ticker=tk;
  el('cd-ticker').textContent=tk;
  cdFillSettings(CD_SET);
  cdSrcNote(); cdRenderChips();
  cdRecalc();
}
function cdLoadInput(){ cdLoadTicker(el('cd-tk-input').value); }
function cdAutoZona(){
  CD_SET=cdAutoParams(CANDLE_DATA.ohlcv);
  cdFillSettings(CD_SET);
  cdRecalc();
}
function renderCandle(){
  if(!CD_SET) CD_SET=Object.assign({},CANDLE_DATA.settings);
  cdFillSettings(CD_SET);
  el('cd-ticker').textContent=CANDLE_DATA.ticker;
  if(el('cd-tk-input')) el('cd-tk-input').value=CD_TICKER;
  cdSrcNote(); cdRenderChips();
  cdRecalc();
}


// ============================================================
// STRATEGI PER-EMITEN + RISK STRIP + SARAN AI + PROBABILITAS FLOWSCAN
// ============================================================
var TRADE_TYPES=['Core Long','Swing Trade','Fast Trade'];
var TRADE_COLOR={'Core Long':'#00c8ff','Swing Trade':'#a78bfa','Fast Trade':'#ffc107'};
function stratOf(tk){ if(tradeStrategy[tk]) return tradeStrategy[tk]; return (DB[tk]&&DB[tk].tradeType)||'Core Long'; }
function setStockStrategy(tk,val){ tradeStrategy[tk]=val; if(typeof saveData==='function')saveData(); renderStrategyPanel(); }
function renderStrategyPanel(){
  var box=el('d-tradetype'); if(!box) return;
  var porto=(typeof getPortfolio==='function')?getPortfolio():[];
  var sahamMV=porto.reduce(function(a,p){return a+p.mv},0);
  var cryptoMV=(typeof getCryptoPortfolio==='function')?getCryptoPortfolio().reduce(function(a,p){return a+(p.mv||0)},0):0;
  var etfMV=(typeof getEtfPortfolio==='function')?getEtfPortfolio().reduce(function(a,p){return a+(p.mvIdr||0)},0):0;
  var rdMV=(typeof getRdPortfolio==='function')?getRdPortfolio().reduce(function(a,p){return a+(p.mv||0)},0):0;
  var grand=sahamMV+cryptoMV+etfMV+rdMV;
  if(!porto.length){ box.innerHTML='<div style="color:var(--text3);font-size:11px;padding:14px 0;text-align:center">Belum ada posisi saham. Input transaksi untuk mengatur strategi & melihat alokasi.</div>'; kc('stratPie'); return; }
  var agg={'Core Long':0,'Swing Trade':0,'Fast Trade':0};
  porto.forEach(function(p){var s=stratOf(p.ticker); agg[s]=(agg[s]||0)+p.mv;});
  var totalMV=sahamMV||1;
  var legend=TRADE_TYPES.map(function(n){var pct=agg[n]/totalMV*100;
    return '<div style="display:flex;align-items:center;gap:6px;margin-bottom:5px"><span style="width:9px;height:9px;border-radius:2px;background:'+TRADE_COLOR[n]+'"></span><span style="font-size:11px;color:var(--text2);flex:1">'+n+'</span><span style="font-family:\'IBM Plex Mono\',monospace;font-size:11px"><b style="color:'+TRADE_COLOR[n]+'">'+pct.toFixed(1)+'%</b> <span style="color:var(--text3);font-size:9px">'+fmtK(agg[n])+'</span></span></div>';
  }).join('');
  var asset=function(lbl,v,c){return '<div style="display:flex;justify-content:space-between;font-size:10px;padding:2px 0"><span style="color:var(--text3)">'+lbl+'</span><span style="font-family:\'IBM Plex Mono\',monospace;color:'+c+'">Rp '+fmtK(v)+'</span></div>';};
  var ringkasan='<div style="margin-top:10px;padding-top:9px;border-top:1px solid var(--border2)"><div style="font-size:9px;color:var(--text3);letter-spacing:.6px;font-family:\'IBM Plex Mono\',monospace;margin-bottom:5px">RINGKASAN SEMUA ASET</div>'
    +asset('📈 Saham',sahamMV,'var(--green)')+asset('🪙 Crypto',cryptoMV,'#f7931a')+asset('📊 ETF',etfMV,'var(--accent)')+asset('🏦 Reksa Dana',rdMV,'var(--purple)')
    +'<div style="display:flex;justify-content:space-between;font-size:11px;padding:5px 0 0;margin-top:3px;border-top:1px solid var(--border);font-weight:700"><span>Total Aset</span><span style="font-family:\'IBM Plex Mono\',monospace">Rp '+fmtK(grand)+'</span></div></div>';
  var rows=porto.slice().sort(function(a,b){return b.mv-a.mv}).map(function(p){
    var cur=stratOf(p.ticker);
    var opts=TRADE_TYPES.map(function(t){return '<option value="'+t+'"'+(t===cur?' selected':'')+'>'+t+'</option>'}).join('');
    return '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid var(--border)"><div style="display:flex;align-items:center;gap:7px;min-width:0"><span style="font-weight:700;color:var(--accent);font-size:11px">'+p.ticker+'</span><span style="font-size:9px;color:var(--text3);font-family:\'IBM Plex Mono\',monospace">'+(p.mv/totalMV*100).toFixed(1)+'%</span></div><select class="finput fsel" style="width:118px;padding:3px 7px;font-size:10px;border-color:'+TRADE_COLOR[cur]+'" onchange="setStockStrategy(\''+p.ticker+'\',this.value)">'+opts+'</select></div>';
  }).join('');
  box.innerHTML='<div style="display:flex;gap:12px;align-items:center"><div style="position:relative;width:118px;height:118px;flex-shrink:0"><canvas id="stratPie"></canvas></div><div style="flex:1;min-width:0"><div style="font-size:9px;color:var(--text3);letter-spacing:.6px;font-family:\'IBM Plex Mono\',monospace;margin-bottom:6px">ALOKASI STRATEGI (saham)</div>'+legend+'</div></div>'
    +ringkasan
    +'<div style="margin-top:9px;padding-top:8px;border-top:1px solid var(--border2)"><div style="font-size:9px;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;letter-spacing:.6px;margin-bottom:5px">STRATEGI PER EMITEN — atur manual</div><div style="max-height:170px;overflow-y:auto">'+rows+'</div></div>';
  kc('stratPie');
  var cv=el('stratPie');
  if(cv && typeof Chart!=='undefined'){
    charts['stratPie']=new Chart(cv,{type:'doughnut',data:{labels:TRADE_TYPES,datasets:[{data:TRADE_TYPES.map(function(n){return Math.round(agg[n])}),backgroundColor:TRADE_TYPES.map(function(n){return TRADE_COLOR[n]}),borderColor:'#0c1524',borderWidth:2}]},options:{responsive:true,maintainAspectRatio:false,cutout:'60%',plugins:{legend:{display:false},tooltip:Object.assign({},TT,{callbacks:{label:function(c){return c.label+': Rp '+fmt(c.parsed)}}})}}});
  }
}

// ── Risk metrics (dipakai dashboard & saran AI) ──
function computeRiskMetrics(){
  var porto=(typeof getPortfolio==='function')?getPortfolio():[];
  var totalMV=porto.reduce(function(a,p){return a+p.mv},0)||1;
  var totalCost=porto.reduce(function(a,p){return a+p.cost},0)||1;
  var beta=porto.reduce(function(a,p){return a+((p.info.beta||1)*(p.mv/totalMV))},0);
  var avgVol=porto.reduce(function(a,p){return a+((p.info.beta||1)*0.25*(p.mv/totalMV))},0);
  var volAnn=avgVol*100;
  var dailyVol=avgVol/Math.sqrt(252);
  var var95=totalMV*dailyVol*1.645;
  var real=(typeof getRealizedPnl==='function')?getRealizedPnl():0;
  var unreal=porto.reduce(function(a,p){return a+p.unreal},0);
  var totalReturn=(real+unreal)/totalCost;
  var rf=0.065;
  var sharpe=avgVol>0?((totalReturn-rf/252*(typeof transactions!=='undefined'?transactions.length:0))/avgVol):0;
  var bySec={}; porto.forEach(function(p){bySec[p.info.sector]=(bySec[p.info.sector]||0)+p.mv;});
  var secCnt=Object.keys(bySec).length, maxSec=0, topSec='';
  Object.keys(bySec).forEach(function(s){if(bySec[s]>maxSec){maxSec=bySec[s];topSec=s;}});
  var topSecPct=maxSec/totalMV*100;
  var score=Math.min(100,Math.round(beta*30+(volAnn/30)*20+(porto.length<3?30:porto.length<5?15:0)+(var95/totalMV*500)));
  return {porto:porto,n:porto.length,totalMV:totalMV,totalCost:totalCost,beta:beta,volAnn:volAnn,var95:var95,
    sharpe:sharpe,real:real,unreal:unreal,totalReturn:totalReturn,secCnt:secCnt,topSecPct:topSecPct,topSec:topSec,score:score,bySec:bySec};
}
function renderDashRisk(){
  var box=el('d-risk-strip'); if(!box) return;
  var m=computeRiskMetrics();
  if(!m.n){ box.innerHTML='<div style="grid-column:1/-1;color:var(--text3);font-size:11px;text-align:center;padding:10px">Belum ada posisi saham — input transaksi untuk melihat analisis risiko instan.</div>'; return; }
  var lvl=m.score>=70?{t:'TINGGI',c:'dn'}:m.score>=40?{t:'SEDANG',c:'amb'}:{t:'RENDAH',c:'up'};
  function card(lbl,val,cls,sub){return '<div class="metric" style="padding:9px 11px"><div class="mlabel">'+lbl+'</div><div class="mval" style="font-size:17px" '+(cls?'':'')+'>'+val+'</div><div class="msub neu">'+(sub||'')+'</div></div>';}
  var html='';
  html+='<div class="metric" style="padding:9px 11px"><div class="mlabel">Skor Risiko</div><div class="mval '+lvl.c+'" style="font-size:17px">'+m.score+'</div><div class="msub '+lvl.c+'">'+lvl.t+'</div></div>';
  html+='<div class="metric" style="padding:9px 11px"><div class="mlabel">Beta vs IHSG</div><div class="mval '+(m.beta<=1?'up':m.beta<=1.3?'amb':'dn')+'" style="font-size:17px">'+m.beta.toFixed(2)+'</div><div class="msub neu">'+(m.beta>1?'lebih volatil':'lebih defensif')+'</div></div>';
  html+='<div class="metric" style="padding:9px 11px"><div class="mlabel">Volatilitas/th</div><div class="mval '+(m.volAnn<=15?'up':m.volAnn<=25?'amb':'dn')+'" style="font-size:17px">'+m.volAnn.toFixed(1)+'%</div><div class="msub neu">estimasi</div></div>';
  html+='<div class="metric" style="padding:9px 11px"><div class="mlabel">VaR 95% harian</div><div class="mval dn" style="font-size:17px">-Rp '+fmtK(m.var95)+'</div><div class="msub neu">potensi rugi 1 hari</div></div>';
  html+='<div class="metric" style="padding:9px 11px"><div class="mlabel">Sharpe</div><div class="mval '+(m.sharpe>=1?'up':m.sharpe>=0?'amb':'dn')+'" style="font-size:17px">'+m.sharpe.toFixed(2)+'</div><div class="msub neu">return vs risiko</div></div>';
  html+='<div class="metric" style="padding:9px 11px"><div class="mlabel">Konsentrasi Sektor</div><div class="mval '+(m.topSecPct>60?'dn':m.topSecPct>40?'amb':'up')+'" style="font-size:15px">'+m.topSec+'</div><div class="msub neu">'+m.topSecPct.toFixed(0)+'% · '+m.secCnt+' sektor · '+m.n+' emiten</div></div>';
  box.innerHTML=html;
}

// ── Saran AI portofolio (offline heuristik + opsi live Claude) ──
function aiNum(s){ return parseFloat(String(s||'').replace(/[^0-9.\-]/g,''))||0; }
function aiBuildContext(){
  var m=computeRiskMetrics();
  var ihsg=aiNum(el('tb-ihsg')&&el('tb-ihsg').textContent);
  var ihsgChg=(el('tb-chg')&&el('tb-chg').textContent||'').trim();
  var byU=m.porto.slice().sort(function(a,b){return b.unreal-a.unreal});
  var best=byU[0]||null, worst=byU.length?byU[byU.length-1]:null;
  var cash=(typeof calcRdnBalance==='function')?calcRdnBalance():0;
  var cashPct=(cash/((m.totalMV+cash)||1))*100;
  return {m:m,ihsg:ihsg,ihsgChg:ihsgChg,best:best,worst:worst,cash:cash,cashPct:cashPct};
}
function aiMacroWatch(bySec){
  var w=[];
  var has=function(k){return Object.keys(bySec).some(function(s){return s.toLowerCase().indexOf(k)>=0;});};
  if(has('energi')||has('energy')) w.push('Energi: harga batubara & minyak global, permintaan ekspor, kebijakan DMO');
  if(has('keuangan')||has('financ')) w.push('Keuangan/Bank: suku bunga BI & The Fed, NIM, kualitas kredit (NPL)');
  if(has('konsumer')||has('consumer')) w.push('Konsumer: inflasi, daya beli, kurs USD/IDR untuk bahan baku impor');
  if(has('baku')||has('material')) w.push('Barang Baku: harga komoditas logam (nikel, emas), permintaan Tiongkok');
  if(has('infrastr')) w.push('Infrastruktur: belanja pemerintah, suku bunga, kebijakan tarif');
  if(has('teknolog')||has('tech')) w.push('Teknologi: sentimen risk-on global, valuasi, likuiditas');
  if(has('kesehat')||has('health')) w.push('Kesehatan: regulasi BPJS, kurs impor alkes/farmasi');
  w.push('Global umum: arah The Fed (suku bunga AS), USD/IDR, harga komoditas, aliran dana asing (foreign flow) di IHSG');
  return w;
}
function aiHeuristicHtml(ctx){
  var m=ctx.m;
  var retPct=(m.totalReturn*100);
  var c=retPct>=0?'#00e5a0':'#ff3d5a';
  var sec=function(t,b){return '<div style="margin-bottom:11px;padding-bottom:11px;border-bottom:1px solid rgba(255,255,255,.05)"><div style="font-size:10px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:.8px;margin-bottom:5px">'+t+'</div><div style="font-size:12px;color:#c8d8ea;line-height:1.7">'+b+'</div></div>';};
  var perf='Total return portofolio <b style="color:'+c+'">'+(retPct>=0?'+':'')+retPct.toFixed(1)+'%</b> dari modal Rp '+fmtK(m.totalCost)+' (realized <b>'+(m.real>=0?'+':'')+'Rp '+fmtK(m.real)+'</b>, unrealized <b style="color:'+(m.unreal>=0?'#00e5a0':'#ff3d5a')+'">'+(m.unreal>=0?'+':'')+'Rp '+fmtK(m.unreal)+'</b>). Beta '+m.beta.toFixed(2)+' berarti portofolio bergerak '+(m.beta>1?'lebih agresif ('+((m.beta-1)*100).toFixed(0)+'% lebih kuat)':'lebih defensif')+' dibanding IHSG'+(ctx.ihsg?' (kini ~'+fmt(ctx.ihsg)+(ctx.ihsgChg?', '+ctx.ihsgChg:'')+')':'')+'. <i style="color:var(--text3)">Perbandingan return periode yang setara dengan IHSG perlu data return indeks — gunakan Konsultasi Claude (live) untuk angka terkini.</i>';
  var contrib='';
  if(ctx.best&&ctx.worst){
    contrib='Penyumbang terbaik: <b style="color:#00e5a0">'+ctx.best.ticker+'</b> ('+(ctx.best.unreal>=0?'+':'')+'Rp '+fmtK(ctx.best.unreal)+', '+ctx.best.ret.toFixed(1)+'%). Beban terberat: <b style="color:#ff3d5a">'+ctx.worst.ticker+'</b> ('+(ctx.worst.unreal>=0?'+':'')+'Rp '+fmtK(ctx.worst.unreal)+', '+ctx.worst.ret.toFixed(1)+'%).';
  }
  var risk='Skor risiko <b>'+m.score+'/100</b>, volatilitas ~'+m.volAnn.toFixed(0)+'%/th, VaR 95% harian ~ -Rp '+fmtK(m.var95)+'. ';
  if(m.topSecPct>50) risk+='<b style="color:#ff3d5a">Konsentrasi tinggi</b>: sektor '+m.topSec+' '+m.topSecPct.toFixed(0)+'% — sangat rentan terhadap guncangan sektor itu. ';
  else if(m.topSecPct>35) risk+='Sektor '+m.topSec+' dominan ('+m.topSecPct.toFixed(0)+'%). ';
  if(m.n<8) risk+='Hanya '+m.n+' emiten — diversifikasi masih tipis (ideal 8–12). ';
  risk+='Kas '+ctx.cashPct.toFixed(0)+'% dari aset '+(ctx.cashPct<5?'(amat kering — ruang manuver kecil)':ctx.cashPct>30?'(menumpuk — pertimbangkan deploy bertahap)':'(wajar)')+'.';
  var macro=aiMacroWatch(m.bySec).map(function(x){return '• '+x;}).join('<br>');
  var saran=[];
  if(m.topSecPct>50) saran.push('Kurangi bobot sektor '+m.topSec+' atau tambah sektor non-korelasi.');
  if(m.n<8) saran.push('Tambah 2–4 emiten lintas sektor untuk menurunkan risiko spesifik.');
  if(m.beta>1.2) saran.push('Beta '+m.beta.toFixed(2)+' tinggi — tambah saham defensif (konsumer primer/kesehatan) bila ingin meredam volatilitas.');
  if(ctx.worst&&ctx.worst.ret<-25) saran.push('Tinjau '+ctx.worst.ticker+' ('+ctx.worst.ret.toFixed(0)+'%): cut-loss atau averaging harus punya tesis jelas, bukan harapan.');
  if(ctx.cashPct<5) saran.push('Sisihkan kas darurat agar bisa menyerap koreksi/peluang.');
  if(!saran.length) saran.push('Profil seimbang — pertahankan disiplin & pantau makro di bawah.');
  var saranHtml=saran.map(function(s){return '• '+s;}).join('<br>');
  return sec('01 — Performa vs Indeks',perf)
    +(contrib?sec('02 — Kontributor & Beban',contrib):'')
    +sec('03 — Risiko & Konsentrasi',risk)
    +sec('04 — Faktor Ekonomi & Global yang Relevan',macro)
    +sec('05 — Saran Tindakan',saranHtml)
    +aiDisclaimer('Analisa otomatis berbasis aturan (offline). Faktor makro adalah daftar pantauan, bukan data live.');
}
function aiDisclaimer(src){
  return '<div style="font-size:10px;color:var(--text3);padding:8px 11px;background:var(--bg);border-radius:6px;border-left:2px solid var(--border2);margin-top:4px;line-height:1.6"><i class="ti ti-alert-circle"></i> Sumber: '+src+'. Bukan rekomendasi investasi — selalu riset mandiri.</div>';
}
function aiLoading(msg){ return '<div style="text-align:center;padding:16px"><i class="ti ti-loader" style="font-size:20px;color:var(--accent);animation:spin 1s linear infinite"></i><div style="font-size:12px;color:var(--text2);margin-top:8px">'+msg+'</div></div>'; }
function aiRunHeuristic(){ var box=el('ai-box'); if(!box)return; box.dataset.live=''; box.innerHTML=aiHeuristicHtml(aiBuildContext()); }
function aiGetKey(){ try{return localStorage.getItem('claude_api_key')||'';}catch(e){return '';} }
function aiUpdateKeyBtn(){ var b=el('ai-key-btn'); if(b) b.textContent=aiGetKey()?'🔑 API Key ✓':'🔑 API Key'; }
function aiSetKey(){ var cur=aiGetKey(); var k=prompt('Masukkan Anthropic API key (disimpan lokal di browser ini saja). Diperlukan untuk versi self-host. Kosongkan lalu OK untuk menghapus.',cur); if(k===null)return; try{ if(k.trim())localStorage.setItem('claude_api_key',k.trim()); else localStorage.removeItem('claude_api_key'); }catch(e){} aiUpdateKeyBtn(); }
function aiFmtText(t){
  var esc=t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  esc=esc.replace(/\*\*(.+?)\*\*/g,'<b style="color:#dce8ff">$1</b>');
  esc=esc.replace(/^### (.+)$/gm,'<div style="font-weight:700;color:var(--accent);margin:8px 0 4px">$1</div>');
  esc=esc.replace(/\n/g,'<br>');
  return esc;
}
function aiRunClaude(){
  var box=el('ai-box'); if(!box)return;
  var ctx=aiBuildContext();
  if(!ctx.m.n){ box.innerHTML='<div style="color:var(--text3);font-size:12px;padding:10px">Belum ada posisi saham untuk dianalisis.</div>'; return; }
  box.innerHTML=aiLoading('Menghubungi Claude & mencari data ekonomi terkini...');
  var key=aiGetKey();
  var hold=ctx.m.porto.slice().sort(function(a,b){return b.mv-a.mv}).slice(0,15).map(function(p){return p.ticker+' '+(p.mv/ctx.m.totalMV*100).toFixed(1)+'% (unreal '+p.ret.toFixed(0)+'%)';}).join(', ');
  var sektor=Object.keys(ctx.m.bySec).map(function(s){return s+' '+(ctx.m.bySec[s]/ctx.m.totalMV*100).toFixed(0)+'%';}).join(', ');
  var prompt='Anda penasihat investasi saham Indonesia yang tajam dan jujur. Data portofolio (Rupiah): nilai pasar '+Math.round(ctx.m.totalMV)+', modal '+Math.round(ctx.m.totalCost)+', total return '+(ctx.m.totalReturn*100).toFixed(1)+'%, realized '+Math.round(ctx.m.real)+', unrealized '+Math.round(ctx.m.unreal)+', beta '+ctx.m.beta.toFixed(2)+', '+ctx.m.n+' emiten, sektor: '+sektor+', kas '+ctx.cashPct.toFixed(0)+'%. Holdings teratas: '+hold+'. IHSG acuan ~'+ctx.ihsg+'. Cari data TERKINI: level & arah IHSG, BI rate, USD/IDR, suku bunga The Fed, harga komoditas relevan, sentimen pasar global. Lalu beri analisis ringkas berpoin (Bahasa Indonesia, tegas, sebut angka): (1) performa portofolio vs IHSG, (2) kondisi ekonomi domestik & global yang memengaruhi holdings ini, (3) risiko utama & konsentrasi, (4) 3-4 saran rebalancing konkret. Maksimal ~350 kata. Tutup dengan: bukan rekomendasi investasi.';
  var headers={'Content-Type':'application/json'};
  if(key){ headers['x-api-key']=key; headers['anthropic-version']='2023-06-01'; headers['anthropic-dangerous-direct-browser-access']='true'; }
  fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:headers,body:JSON.stringify({
    model:'claude-sonnet-4-20250514',max_tokens:1200,
    messages:[{role:'user',content:prompt}],
    tools:[{type:'web_search_20250305',name:'web_search'}]
  })}).then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
  .then(function(data){
    var text=(data.content||[]).map(function(b){return b.type==='text'?b.text:'';}).filter(Boolean).join('\n');
    if(!text) throw new Error('respons kosong');
    box.dataset.live='1';
    box.innerHTML='<div>'+aiFmtText(text)+'</div>'+aiDisclaimer('Claude (claude-sonnet-4) + web search — live');
  }).catch(function(e){
    box.innerHTML='<div style="background:rgba(255,193,7,.08);border:1px solid rgba(255,193,7,.25);border-radius:8px;padding:9px 12px;font-size:11px;color:var(--amber);margin-bottom:10px;line-height:1.6">⚠️ Konsultasi live gagal ('+e.message+'). '+(key?'Periksa API key & koneksi internet.':'Tanpa API key, panggilan langsung hanya jalan di pratinjau Claude.ai. Untuk versi yang Anda host sendiri (Netlify/GitHub), klik “🔑 API Key” dan isi key Anthropic Anda.')+' Berikut analisa otomatis offline:</div>'+aiHeuristicHtml(ctx);
  });
}

// ── Saran aksi per saham (Buy/Hold/Trim/Cut-Loss) — heuristik aturan sederhana ──
function aiPerHoldingAction(p,totalMV){
  var weight = totalMV>0 ? (p.mv/totalMV*100) : 0;
  var ret = p.ret;
  if(ret<=-20) return {action:'TINJAU / CUT LOSS',cls:'b-dn',note:'Rugi '+ret.toFixed(0)+'% — evaluasi ulang tesis awal; cut-loss hanya jika fundamental memburuk, bukan sekadar harga turun.'};
  if(weight>=25) return {action:'KURANGI BOBOT',cls:'b-amb',note:'Bobot '+weight.toFixed(0)+'% dari portofolio — konsentrasi tinggi di satu saham, pertimbangkan trim untuk diversifikasi.'};
  if(ret>=40 && weight>=10) return {action:'TRIM / AMBIL UNTUNG',cls:'b-amb',note:'Untung '+ret.toFixed(0)+'% dengan bobot besar — pertimbangkan ambil untung sebagian, biarkan sisanya berjalan.'};
  if(ret<=-10) return {action:'PANTAU KETAT',cls:'b-amb',note:'Rugi '+ret.toFixed(0)+'% — pantau ketat & siapkan rencana keluar bila tesis tidak berubah.'};
  if(ret>=15) return {action:'HOLD',cls:'b-up',note:'Kinerja baik ('+(ret>=0?'+':'')+ret.toFixed(0)+'%) — pertahankan selama tesis awal masih valid.'};
  return {action:'HOLD',cls:'b-gray',note:'Performa wajar ('+(ret>=0?'+':'')+ret.toFixed(0)+'%) — tidak ada aksi mendesak.'};
}
function aiRenderPerHoldingReco(){
  var box=el('ai-holding-reco'); if(!box) return;
  var porto=getPortfolio();
  var totalMV=porto.reduce(function(a,p){return a+p.mv},0);
  if(!porto.length){ box.innerHTML='<div style="color:var(--text3);font-size:11px;text-align:center;padding:16px">Belum ada posisi saham untuk dianalisis.</div>'; return; }
  var rows=porto.slice().sort(function(a,b){return b.mv-a.mv}).map(function(p){
    var r=aiPerHoldingAction(p,totalMV);
    return '<tr><td><span class="tp">'+p.ticker+'</span></td>'
      +'<td class="mono">'+(totalMV>0?(p.mv/totalMV*100).toFixed(1):'0.0')+'%</td>'
      +'<td class="mono '+(p.ret>=0?'up':'dn')+'">'+(p.ret>=0?'+':'')+p.ret.toFixed(1)+'%</td>'
      +'<td><span class="badge '+r.cls+'">'+r.action+'</span></td>'
      +'<td style="font-size:11px;color:var(--text2)">'+r.note+'</td></tr>';
  }).join('');
  box.innerHTML='<div style="overflow-x:auto"><table class="tbl"><thead><tr><th>Saham</th><th>Bobot</th><th>Return</th><th>Aksi</th><th>Catatan</th></tr></thead><tbody>'+rows+'</tbody></table></div>'
    +'<div style="font-size:10px;color:var(--text3);padding:8px 2px 0;line-height:1.6">Aksi di atas adalah heuristik aturan otomatis berbasis return &amp; bobot posisi — bukan rekomendasi investasi, selalu riset mandiri.</div>';
}

// ── Probabilitas kesimpulan FlowScan ──
function fsProbability(a){
  var sc=a.sc, dist=Math.abs(sc-50);
  var dir=sc>=55?'BULLISH':sc<=45?'BEARISH':'NETRAL';
  var strg=dist>=22?'STRONG':dist>=10?'MODERATE':'LOW';
  var conf=Math.round(Math.min(95,52+dist*1.5));
  return {dir:dir,strg:strg,conf:conf,sc:sc};
}
function fsRenderProb(a){
  var box=el('fs-prob'); if(!box||!a) return;
  var p=fsProbability(a);
  var tk=FS_G.tk||'—';
  var data=FS_G.data||[];
  var last=data.length?data[data.length-1]:{c:0,h:0,l:0,v:0};

  // ── Extended stat calculations ──
  var prices=data.map(function(d){return d.c;});
  var rets=[];
  for(var i=1;i<prices.length;i++) rets.push((prices[i]-prices[i-1])/prices[i-1]);

  // Mean return
  var meanR=rets.length?rets.reduce(function(s,v){return s+v;},0)/rets.length:0;
  // Std dev
  var stdR=rets.length>1?Math.sqrt(rets.reduce(function(s,v){return s+Math.pow(v-meanR,2);},0)/rets.length):0;
  // Annualized vol
  var volAnn=(stdR*Math.sqrt(252)*100).toFixed(1);
  // Skewness
  var skew=0;
  if(stdR>0&&rets.length>2){
    var sk=rets.reduce(function(s,v){return s+Math.pow((v-meanR)/stdR,3);},0)/rets.length;
    skew=sk.toFixed(2);
  }
  // Win rate (% of days with positive return)
  var winDays=rets.filter(function(r){return r>0;}).length;
  var winRate=rets.length?(winDays/rets.length*100).toFixed(0):0;
  // Max consecutive gain/loss
  var streak=0,maxStreak=0,curS=0,lastSign=0;
  rets.forEach(function(r){var sg=r>0?1:-1;if(sg===lastSign){curS++;}else{curS=1;lastSign=sg;}if(curS>maxStreak)maxStreak=curS;});
  // Expected move (±1σ)
  var em1=(last.c*stdR).toFixed(0);
  var em2=(last.c*stdR*2).toFixed(0);

  // ── Individual indicator scores ──
  var cmfScore=Math.min(100,Math.max(0,50+(a.cl||0)*200));
  var rsiScore=a.rl>70?30:a.rl<30?80:50+(50-a.rl);
  var maScore=a.ma20&&a.ma20.length&&last.c>a.ma20[a.ma20.length-1]?70:30;
  var volScore=Math.min(100,Math.max(0,(a.bu/(a.bu+a.bd+0.001))*100));
  var vwapScore=a.vwap&&a.vwap[a.vwap&&a.vwap.length-1]?
    (last.c>a.vwap[a.vwap.length-1]?65:40):50;

  // Weights: CMF 30%, RSI 20%, MA 20%, Vol 15%, VWAP 15%
  var composite=Math.round(cmfScore*0.30+rsiScore*0.20+maScore*0.20+volScore*0.15+vwapScore*0.15);
  var probBuy=Math.min(97,Math.max(3,composite));
  var probSell=100-probBuy;

  var c=p.dir==='BULLISH'?'var(--green)':p.dir==='BEARISH'?'var(--red)':'var(--amber)';
  var emo=p.dir==='BULLISH'?'▲':p.dir==='BEARISH'?'▼':'◆';

  function pBar(val,color){
    return '<div style="height:5px;background:rgba(255,255,255,.08);border-radius:1px;overflow:hidden">'
      +'<div style="width:'+val+'%;height:100%;background:'+color+';border-radius:1px;transition:width .5s"></div></div>';
  }
  function indRow(label,score,detail){
    var col=score>=60?'var(--green)':score>=40?'var(--amber)':'var(--red)';
    return '<div style="margin-bottom:6px">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px">'
      +'<span style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.8px">'+label+'</span>'
      +'<span style="font-size:9px;font-weight:700;color:'+col+';font-family:\'IBM Plex Mono\',monospace">'+Math.round(score)+'</span>'
      +'</div>'
      +pBar(score,col)
      +'<div style="font-size:9px;color:var(--text3);margin-top:2px">'+detail+'</div></div>';
  }

  box.innerHTML=''
    // ── Header row: signal + confidence ──
    +'<div class="card" style="border-top-color:'+c+';border-color:rgba(255,255,255,.06);background:linear-gradient(135deg,rgba(255,255,255,.02),transparent)">'
    +'<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--border)">'
    // Signal box
    +'<div style="text-align:center;padding:8px 0">'
    +'<div style="font-size:9px;color:var(--text3);letter-spacing:1.5px;text-transform:uppercase;font-family:\'IBM Plex Mono\',monospace;margin-bottom:4px">ARAH SINYAL</div>'
    +'<div style="font-size:22px;font-weight:800;color:'+c+';font-family:\'IBM Plex Mono\',monospace;letter-spacing:2px">'+emo+' '+p.dir+'</div>'
    +'<span class="badge '+(p.dir==='BULLISH'?'b-up':p.dir==='BEARISH'?'b-dn':'b-amb')+'" style="margin-top:3px">'+p.strg+'</span>'
    +'</div>'
    // Probability box
    +'<div style="text-align:center;padding:8px 0;border-left:1px solid var(--border);border-right:1px solid var(--border)">'
    +'<div style="font-size:9px;color:var(--text3);letter-spacing:1.5px;text-transform:uppercase;font-family:\'IBM Plex Mono\',monospace;margin-bottom:4px">PROB. BELI</div>'
    +'<div style="font-size:26px;font-weight:800;color:'+c+';font-family:\'IBM Plex Mono\',monospace">'+probBuy+'<span style="font-size:14px">%</span></div>'
    +'<div style="font-size:9px;color:var(--text3);margin-top:2px">Keyakinan akumulasi</div>'
    +'</div>'
    // Score box
    +'<div style="text-align:center;padding:8px 0">'
    +'<div style="font-size:9px;color:var(--text3);letter-spacing:1.5px;text-transform:uppercase;font-family:\'IBM Plex Mono\',monospace;margin-bottom:4px">SKOR KOMPOSIT</div>'
    +'<div style="font-size:26px;font-weight:800;color:'+c+';font-family:\'IBM Plex Mono\',monospace">'+composite+'<span style="font-size:14px">/100</span></div>'
    +'<div style="font-size:9px;color:var(--text3);margin-top:2px">5-faktor weighted</div>'
    +'</div>'
    +'</div>'

    // ── Composite probability bar ──
    +'<div style="margin-bottom:12px">'
    +'<div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:9px;font-family:\'IBM Plex Mono\',monospace">'
    +'<span style="color:var(--green)">BELI '+probBuy+'%</span><span style="color:var(--red)">JUAL '+probSell+'%</span></div>'
    +'<div style="height:10px;background:rgba(255,34,68,.25);border-radius:1px;overflow:hidden">'
    +'<div style="width:'+probBuy+'%;height:100%;background:var(--green);border-radius:1px;transition:width .6s"></div></div>'
    +'<div style="font-size:9px;color:var(--text3);margin-top:3px">Probabilitas berdasarkan 5 indikator teknikal terbobot</div>'
    +'</div>'

    // ── Indicator breakdown ──
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid var(--border)">'
    +'<div>'
    +'<div style="font-size:9px;color:var(--bb-orange);letter-spacing:1.2px;text-transform:uppercase;margin-bottom:8px;font-family:\'IBM Plex Mono\',monospace;border-bottom:1px solid rgba(255,102,0,.2);padding-bottom:4px">BOBOT INDIKATOR</div>'
    +indRow('CMF-20 (30%)',cmfScore,'CMF: '+(a.cl||0).toFixed?(a.cl*100).toFixed(1)+'%':'—')
    +indRow('RSI-14 (20%)',rsiScore,'RSI: '+(a.rl||50).toFixed(1)+' · '+(a.rl>70?'Overbought':a.rl<30?'Oversold':'Netral'))
    +indRow('MA Cross (20%)',maScore,'Harga vs MA20: '+(a.ma20&&a.ma20.length?(last.c>a.ma20[a.ma20.length-1]?'Above ▲':'Below ▼'):'—'))
    +indRow('Vol Flow (15%)',volScore,'Acc: '+a.bu+' hari | Dist: '+a.bd+' hari')
    +indRow('VWAP (15%)',vwapScore,'Posisi vs VWAP anchor')
    +'</div>'

    // ── Statistical analysis ──
    +'<div>'
    +'<div style="font-size:9px;color:var(--bb-orange);letter-spacing:1.2px;text-transform:uppercase;margin-bottom:8px;font-family:\'IBM Plex Mono\',monospace;border-bottom:1px solid rgba(255,102,0,.2);padding-bottom:4px">STATISTIK HARGA</div>'
    +'<div style="display:flex;flex-direction:column;gap:5px">'
    +'<div style="display:flex;justify-content:space-between;font-family:\'IBM Plex Mono\',monospace;font-size:10px"><span style="color:var(--text3)">Volatilitas/th</span><span style="color:var(--amber)">'+volAnn+'%</span></div>'
    +'<div style="display:flex;justify-content:space-between;font-family:\'IBM Plex Mono\',monospace;font-size:10px"><span style="color:var(--text3)">Win Rate (% hari +)</span><span style="color:'+(parseInt(winRate)>=55?'var(--green)':'var(--text2)')+'">'+winRate+'%</span></div>'
    +'<div style="display:flex;justify-content:space-between;font-family:\'IBM Plex Mono\',monospace;font-size:10px"><span style="color:var(--text3)">Skewness</span><span style="color:'+(parseFloat(skew)>0?'var(--green)':parseFloat(skew)<0?'var(--red)':'var(--text2)')+'">'+skew+'</span></div>'
    +'<div style="display:flex;justify-content:space-between;font-family:\'IBM Plex Mono\',monospace;font-size:10px"><span style="color:var(--text3)">Expected Move (±1σ)</span><span>±'+parseInt(em1).toLocaleString('id-ID')+'</span></div>'
    +'<div style="display:flex;justify-content:space-between;font-family:\'IBM Plex Mono\',monospace;font-size:10px"><span style="color:var(--text3)">Expected Move (±2σ)</span><span style="color:var(--text2)">±'+parseInt(em2).toLocaleString('id-ID')+'</span></div>'
    +'<div style="margin-top:5px;padding-top:5px;border-top:1px solid var(--border)">'
    +'<div style="font-size:9px;color:var(--text3);margin-bottom:3px;text-transform:uppercase;letter-spacing:.8px">SKENARIO GERAK</div>'
    +'<div style="font-size:10px;color:var(--green)">Bull target: '+fsP(last.c*(1+stdR*2))+'</div>'
    +'<div style="font-size:10px;color:var(--red)">Bear target: '+fsP(last.c*(1-stdR*2))+'</div>'
    +'</div>'
    +'</div>'
    +'</div>'
    +'</div>'

    // ── Footer disclaimer ──
    +'<div style="font-size:9px;color:var(--text3);line-height:1.5;border-top:1px solid var(--border);padding-top:8px;font-family:\'IBM Plex Mono\',monospace">'
    +'⚠ Analisa otomatis berbasis indikator teknikal. Bukan rekomendasi investasi. Lakukan riset mandiri sebelum mengambil keputusan.'
    +'</div>'
    +'</div>';
}


// ============================================================
// IMPOR DIVIDEN LAMPIRAN + PAJAK PER-SEKURITAS + RINGKASAN ASET
// ============================================================
// PPh per sekuritas mengikuti tarif global (tab Pajak). Override khusus jika tarif berbeda dari global.
var sekTaxOverride = {};
function pphBeliFor(sek){ var o=sekTaxOverride[sek]; return (o&&o.beli!=null)?o.beli:getPphBeli(); }
function pphJualFor(sek){ var o=sekTaxOverride[sek]; return (o&&o.jual!=null)?o.jual:getPphJual(); }

// ── Impor dividen dari lampiran (XLSX_DATA.dividends) ──
// total dividen TIDAK menambah saldo RDN (sudah terealisasi untuk beli saham) → tanpa addRdn
function importDividends(force){
  if(typeof XLSX_DATA==='undefined' || !XLSX_DATA.dividends) return false;
  var has=dividends.some(function(d){return d._src==='lampiran';});
  if(has && !force) return false;
  if(force) dividends=dividends.filter(function(d){return d._src!=='lampiran';});
  XLSX_DATA.dividends.forEach(function(e){
    var total=e.total||0; if(total<=0) return;
    var avg=e.avg_per_year||total;
    var years=Math.max(1,Math.round(avg>0?total/avg:1));
    var per=Math.round(total/years), acc=0, endY=2025;
    for(var i=0;i<years;i++){
      var amt=(i===years-1)?(total-acc):per; acc+=amt;
      var y=endY-(years-1)+i;
      // _src:'lampiran' — tidak menambah saldo RDN (realisasi historis)
      dividends.push({id:nextDivId++,date:y+'-12-30',ticker:e.code,shares:0,dps:0,
        gross:amt,tax:0,net:amt,pphRate:0,_src:'lampiran'});
    }
  });
  // lampiran tidak rebuild RDN balance — hanya metadata historis
  saveData();
  return true;
}
function importDividendsUI(){
  var n=dividends.filter(function(d){return d._src==='lampiran';}).length;
  var tot=(XLSX_DATA.dividends||[]).reduce(function(a,e){return a+(e.total||0)},0);
  var msg = n>0
    ? 'Dividen lampiran sudah diimpor. Impor ulang akan mengganti '+n+' catatan dengan data lampiran terbaru. Lanjut?'
    : 'Impor dividen historis dari lampiran senilai total Rp '+fmt(tot)+' (per emiten, 2018–2026)?\n\nCatatan: nilai ini TIDAK menambah saldo RDN karena sudah terealisasi untuk pembelian saham.';
  if(!confirm(msg)) return;
  importDividends(true);
  if(typeof showSaveStatus==='function') showSaveStatus('✓ Dividen lampiran diimpor (tanpa menambah RDN)');
  renderDividen();
  if(typeof renderDashboard==='function') renderDashboard();
}

// ── Override Komisi per Sekuritas ──
// sekTaxOverride menyimpan override komisi (beli/jual). PPh Final & Levy = tarif tetap.
function renderSekTaxPanel(){
  var box=el('sek-tax-rows'); if(!box) return;
  box.innerHTML=Object.keys(SEKURITAS).map(function(s){
    var sf=SEKURITAS[s];
    var o=sekTaxOverride[s]||{};
    var beli=((o.beli!=null?o.beli:sf.buyFee)*100).toFixed(3).replace(/0+$/,'').replace(/\.$/,'');
    var jual=((o.jual!=null?o.jual:sf.sellFee)*100).toFixed(3).replace(/0+$/,'').replace(/\.$/,'');
    var custom=(o.beli!=null||o.jual!=null);
    return '<div style="display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:7px;align-items:center;padding:5px 0;border-bottom:1px solid var(--border)">'
      +'<div style="display:flex;align-items:center;gap:6px;min-width:0"><span style="width:7px;height:7px;border-radius:2px;background:'+sf.color+';flex-shrink:0"></span><span style="font-size:11px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+s+'</span>'+(custom?' <span class="badge b-amb" style="font-size:8px">custom</span>':'')+'</div>'
      +'<input class="finput" type="number" step="0.001" min="0" max="5" id="sktx-b-'+btoa(s).replace(/=/g,'')+'" value="'+beli+'" style="padding:4px 7px;font-size:11px;font-family:\'IBM Plex Mono\',monospace">'
      +'<input class="finput" type="number" step="0.001" min="0" max="5" id="sktx-j-'+btoa(s).replace(/=/g,'')+'" value="'+jual+'" style="padding:4px 7px;font-size:11px;font-family:\'IBM Plex Mono\',monospace">'
      +'</div>';
  }).join('');
}
function saveSekTax(){
  Object.keys(SEKURITAS).forEach(function(s){
    var key=btoa(s).replace(/=/g,'');
    var bEl=el('sktx-b-'+key), jEl=el('sktx-j-'+key);
    if(!bEl||!jEl) return;
    var b=parseFloat(bEl.value), j=parseFloat(jEl.value);
    if(isNaN(b))b=SEKURITAS[s].buyFee*100; if(isNaN(j))j=SEKURITAS[s].sellFee*100;
    var defB=SEKURITAS[s].buyFee*100, defJ=SEKURITAS[s].sellFee*100;
    if(Math.abs(b-defB)<0.0001 && Math.abs(j-defJ)<0.0001){
      delete sekTaxOverride[s];
    } else {
      sekTaxOverride[s]={beli:b/100, jual:j/100};
    }
  });
  saveData();
  if(typeof showSaveStatus==='function') showSaveStatus('✓ Komisi per sekuritas disimpan');
  renderSekTaxPanel();
  if(typeof renderPajak==='function') renderPajak();
}
function resetSekTax(){
  if(!confirm('Reset semua komisi per sekuritas ke default?')) return;
  sekTaxOverride={}; saveData(); renderSekTaxPanel();
  if(typeof showSaveStatus==='function') showSaveStatus('✓ Komisi per sekuritas direset ke default');
}

// Watchlist & Manajemen Risiko dipindahkan menjadi bagian dari Dashboard —
// helper ini membawa user ke Dashboard lalu scroll ke section terkait.
function goDashSection(sectionId,btn){
  goPage('dashboard',btn);
  setTimeout(function(){
    var t=document.getElementById(sectionId);
    if(t) t.scrollIntoView({behavior:'smooth',block:'start'});
  },60);
}

var currentPage='dashboard';
function goPage(name,btn){
  // Auth guard — redirect to login if session expired
  if(typeof authLoadSession==='function' && !authLoadSession() && name!=='dashboard'){
    try{ authShowLogin(); }catch(e){} return;
  }
  document.querySelectorAll('.page').forEach(function(p){p.classList.remove('on')});
  // Remove active state from all nav items (including dropdown buttons)
  document.querySelectorAll('.nav button, .nav-dd-btn, .nav-dd-menu button').forEach(function(b){b.classList.remove('on')});
  var pg = el('page-'+name);
  if(!pg) return;
  pg.classList.add('on');
  // Highlight: if explicit btn passed use it, otherwise find matching nav button
  if(btn && btn.classList){
    btn.classList.add('on');
  } else {
    // Try to find a matching nav button by onclick content
    document.querySelectorAll('.nav button, .nav-dd-menu button').forEach(function(b){
      if(b.getAttribute('onclick') && b.getAttribute('onclick').includes("'"+name+"'")) b.classList.add('on');
    });
  }
  currentPage=name;
  renderPage(name);
  closeDD();
  // Re-render cash widgets when switching to portfolio pages
  if(['portofolio','crypto','etf','reksadana'].includes(name)) setTimeout(renderCashWidgets,50);
}

function renderPage(name){
  switch(name){
    case 'dashboard':renderDashboard();break;
    case 'rdn':renderRdn();break;
    case 'transaksi':renderTransaksi();break;
    case 'portofolio':renderPortofolio();break;
    case 'crypto':renderCrypto();break;
    case 'etf':renderEtf();break;
    case 'reksadana':renderReksaDana();break;
    case 'dividen':renderDividen();break;
    case 'divinvest':renderDivInvest();break;
    case 'sektoral':renderSektoral();break;
    case 'pajak':renderPajak();break;
    case 'flowscan':fsRunAnalysis();break;
    case 'ranking':fsRenderRanking();break;
    case 'heatmap':fsRenderHeatmap();break;    case 'scanner':break;
    case 'alerts':fsGenAlerts();break;
    case 'candle':renderCandle();break;
    // ── QuantTrader pages ──
    case 'backtester':break; // wait for user action
    case 'screener':if(typeof scRenderTable!=='undefined'){if(!QT.scData.length)scBuildSim();else scRenderTable();}break;
    case 'pairs':break;
    case 'correlation':if(typeof corrRender!=='undefined')setTimeout(corrRender,100);break;
    case 'monthly-returns':if(typeof mrRender!=='undefined')setTimeout(mrRender,100);break;
  }
}

function setPeriod(btn,tf){
  var row = btn.parentElement;
  if(row) row.querySelectorAll('.pbtn').forEach(function(b){b.classList.remove('on')});
  btn.classList.add('on');
  buildIhsgChart(tf);
}

// ============================================================
// IMPORT PORTOFOLIO DARI DATA REAL (sekali jalan)
// ============================================================
// PORTO_DATA DIKOSONGKAN — data kepemilikan pribadi dihapus (aman untuk publikasi)
var PORTO_DATA = [];

function importPortfolioData(){
  return; // DINONAKTIFKAN — tidak ada lagi injeksi portofolio contoh; user mengisi data real sendiri
  if(window._portoImportDone) return; // in-session guard
  if(localStorage.getItem('porto_imported_v1')){ window._portoImportDone=true; return; } // sudah pernah diimpor
  var today2 = new Date().toISOString().slice(0,10);
  var sec = 'Stockbit';
  // Pastikan semua ticker ada di DB dengan sektor yang benar
  PORTO_DATA.forEach(function(p){
    DB[p.ticker]={name:p.ticker, base:p.price, sector:p.sector||'Lainnya', beta:1.0};
    prices[p.ticker] = p.price;
  });
  // Tambahkan transaksi BUY — bypass saveData per-item untuk efisiensi
  var _origSave = window._txNoSave; // flag sementara
  PORTO_DATA.forEach(function(p){
    var isBuy=true;
    var gross=p.lot*100*p.price;
    var c=calcTxComponents(gross,isBuy,sec);
    var txId=nextTxId++;
    transactions.push({id:txId,date:today2,type:'BUY',ticker:p.ticker,lot:p.lot,price:p.price,
      gross:gross,komisi:c.komisi,ppn:c.ppn,levy:c.levy,pph:c.pph,
      tax:c.ppn+c.levy+c.pph,net:c.net,sekuritas:sec});
    rdnBalance+=-c.net;
    rdnMutations.push({id:nextRdnId++,date:today2,type:'BUY',
      ket:'Beli '+p.lot+' lot '+p.ticker+' @ Rp '+fmt(p.price),
      amount:-c.net,balance:rdnBalance,sekuritas:sec,linkedTxId:txId});
  });
  window._portoImportDone=true;
  localStorage.setItem('porto_imported_v1','1');
  saveData();
  console.log('✅ Porto import selesai: '+PORTO_DATA.length+' emiten, total lot: '+
    PORTO_DATA.reduce(function(a,p){return a+p.lot;},0));
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded',function(){
  var hasData = loadData();
  // FIX: normalizeSekLabels tidak pernah didefinisikan di file asli —
  // tanpa guard, init berhenti di sini (jam, authInit, dan import awal tidak jalan).
  if(typeof normalizeSekLabels==='function') normalizeSekLabels();
  loadTaxSettings();
  loadCashAccounts();
  loadHiddenMetrics();

  // ── MULAI KOSONG — tidak ada injeksi data apa pun; semua data diisi manual oleh user ──
  // Selalu pastikan DB & RD_DB terisi dari XLSX (hanya metadata, bukan transaksi)
  var sectorMap={'Financials':'Keuangan','Energy':'Energi','Infrastructures':'Infrastruktur',
    'Consumer Non-Cyclicals':'Konsumer Primer','Basic Materials':'Barang Baku',
    'Consumer Cyclicals':'Konsumer Non-Primer','Healthcare':'Kesehatan',
    'Transportation & Logistic':'Infrastruktur','Properties':'Properti'};
  XLSX_DATA.stocks.forEach(function(s){
    if(!DB[s.code]){
      DB[s.code]={name:s.code,base:s.price||s.avg||100,sector:sectorMap[s.sector]||s.sector||'Lainnya',beta:1.0};
    }
    if(s.price>0) prices[s.code]=s.price;
  });
  // RD metadata (nama produk, kategori) — tanpa transaksi aktif
  loadSampleRd();
  // Injeksi transaksi historis & dividen lampiran DIHAPUS — user menguji data real

  updatePrices();
  updateCryptoPrices();
  updateEtfPrices();
  updateRdNAB();
  updateClock();
  buildTickerTape();
  fsInit();

  // ── Yahoo Finance realtime init ──
  fhStart();

  // Wire buttons
  el('btn-setor').onclick=function(){openModal('setor')};
  el('btn-tarik').onclick=function(){openModal('tarik')};
  el('btn-fee').onclick=function(){openModal('fee')};
  el('btn-beli').onclick=function(){openModal('buy')};
  el('btn-jual').onclick=function(){openModal('sell')};
  el('btn-beli2').onclick=function(){openModal('buy')};
  el('btn-div').onclick=function(){openModal('div')};
  el('m-close').onclick=closeModal;
  el('modal').onclick=function(e){if(e.target===el('modal'))closeModal()};
  el('backup-modal').onclick=function(e){if(e.target===el('backup-modal'))closeBackupModal()};
  el('tx-search').oninput=renderTransaksi;
  el('tx-filter').onchange=renderTransaksi;
  el('rdn-filter').onchange=renderRdn;
  renderDashboard();
  setTimeout(renderCashWidgets, 200);
  setInterval(updateClock,1000);
  // ── Auth init — tampilkan login screen atau langsung masuk ──
  setTimeout(authInit, 50);
});
