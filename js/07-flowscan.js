// ============================================================
// FLOWSCAN — BIG MONEY ANALISA ENGINE (dari index.html)
// ============================================================
var FS_UNIV=[
  {t:'BBCA',n:'Bank Central Asia',s:'Perbankan',cap:950},
  {t:'BBRI',n:'Bank Rakyat Indonesia',s:'Perbankan',cap:780},
  {t:'BMRI',n:'Bank Mandiri',s:'Perbankan',cap:620},
  {t:'TLKM',n:'Telkom Indonesia',s:'Telekomunikasi',cap:580},
  {t:'ASII',n:'Astra International',s:'Otomotif',cap:450},
  {t:'BBNI',n:'Bank Negara Indonesia',s:'Perbankan',cap:320},
  {t:'UNVR',n:'Unilever Indonesia',s:'Konsumer',cap:270},
  {t:'ADRO',n:'Adaro Energy',s:'Energi',cap:240},
  {t:'ANTM',n:'Aneka Tambang',s:'Tambang',cap:200},
  {t:'PGAS',n:'Perusahaan Gas Negara',s:'Energi',cap:185},
  {t:'INDF',n:'Indofood Sukses Makmur',s:'Konsumer',cap:175},
  {t:'KLBF',n:'Kalbe Farma',s:'Farmasi',cap:165},
  {t:'ICBP',n:'Indofood CBP',s:'Konsumer',cap:160},
  {t:'SMGR',n:'Semen Indonesia',s:'Industri',cap:140},
  {t:'PTBA',n:'Bukit Asam',s:'Tambang',cap:125},
  {t:'JSMR',n:'Jasa Marga',s:'Infrastruktur',cap:120},
  {t:'INCO',n:'Vale Indonesia',s:'Tambang',cap:115},
  {t:'MAPI',n:'Mitra Adiperkasa',s:'Ritel',cap:110},
  {t:'PWON',n:'Pakuwon Jati',s:'Properti',cap:95},
  {t:'CPIN',n:'Charoen Pokphand',s:'Konsumer',cap:90},
  {t:'MYOR',n:'Mayora Indah',s:'Konsumer',cap:88},
  {t:'ACES',n:'Ace Hardware',s:'Ritel',cap:82},
  {t:'AUTO',n:'Astra Otoparts',s:'Otomotif',cap:72},
  {t:'PGEO',n:'Pertamina Geothermal',s:'Energi',cap:68},
  {t:'ADMR',n:'Adaro Minerals',s:'Tambang',cap:65},
  {t:'ARCI',n:'Archi Indonesia',s:'Tambang',cap:60},
  {t:'BUMI',n:'Bumi Resources',s:'Energi',cap:58},
  {t:'SMDR',n:'Samudera Indonesia',s:'Transportasi',cap:55},
  {t:'SIDO',n:'Industri Jamu Sido Muncul',s:'Konsumer',cap:52},
  {t:'WIFI',n:'Solusi Sinergi Digital',s:'Teknologi',cap:48},
];

// Tambahkan saham dari portofolio real — gunakan nama dari DB jika ada
XLSX_DATA.stocks.forEach(function(s){
  if(!FS_UNIV.find(function(u){return u.t===s.code})){
    var dbInfo = DB[s.code];
    var nama = (dbInfo && dbInfo.name) ? dbInfo.name : s.code;
    FS_UNIV.push({t:s.code,n:nama,s:s.sector||'IHSG',cap:Math.round(s.amount/1e9)||1});
  }
});
// Untuk semua entry di FS_UNIV, update nama dari DB jika tersedia dan lebih baik
FS_UNIV = FS_UNIV.map(function(u){
  var dbInfo = DB[u.t];
  if(dbInfo && dbInfo.name && dbInfo.name !== u.t) u.n = dbInfo.name;
  return u;
});
// Dedup FS_UNIV by ticker
(function(){ var seen={}; FS_UNIV=FS_UNIV.filter(function(u){ if(seen[u.t]) return false; seen[u.t]=true; return true; }); })();

var FS_G={tk:'BBCA',days:30,data:null,a:null};
var FS_WL=[];
var fsWlSort='default';
var FS_CHARTS={};
var FS_RD=[];

// ── seed RNG ──
function fsSd(s){var h=0;for(var i=0;i<s.length;i++)h=(Math.imul(31,h)+s.charCodeAt(i))|0;return Math.abs(h);}
function fsSr(s){var x=Math.sin(s+1)*10000;return x-Math.floor(x);}

// ── format helpers ──
function fsV(n){if(!n||isNaN(n))return'—';if(n>=1e9)return(n/1e9).toFixed(2)+'M';if(n>=1e6)return(n/1e6).toFixed(1)+'Jt';if(n>=1e3)return(n/1e3).toFixed(0)+'Rb';return Math.round(n)+'';}
function fsP(n){if(!n||isNaN(n))return'—';return'Rp '+(n<100?n.toFixed(2):Math.round(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g,'.');}
function fsD(d){return new Date(d).toLocaleDateString('id-ID',{day:'2-digit',month:'short'});}
function fsPct(n){return(n>=0?'▲':'▼')+Math.abs(n).toFixed(2)+'%';}
function fsScColor(s){return s>=58?'#00e5a0':s<=42?'#ff3d5a':'#8fa3c8';}
function fsMkBdg(sig,sm){
  var cls=sig==='AKUMULASI'?'b-up':sig==='DISTRIBUSI'?'b-dn':'b-neu';
  var ic=sig==='AKUMULASI'?'ti-trending-up':sig==='DISTRIBUSI'?'ti-trending-down':'ti-minus';
  return '<span class="badge '+cls+'" style="'+(sm?'padding:2px 6px;font-size:10px':'')+
    '"><i class="ti '+ic+'"></i> '+sig+'</span>';
}

// ── data engine ──
function fsGenData(tk,days){
  var s=fsSd(tk),base=1000+fsSr(s)*14000,vol=5e6+fsSr(s+1)*50e6,price=base,obv=0,ad=0,data=[];
  // use real price as base if available
  var realStk=XLSX_DATA.stocks.find(function(x){return x.code===tk});
  if(realStk&&realStk.price>0) base=realStk.price, price=base;
  var bias=fsSr(s+99)>0.5?0.0003:-0.0002;
  for(var i=0;i<days;i++){
    var r=fsSr(s*i+i*7+13),r2=fsSr(s*i+i*3+7),r3=fsSr(s*i+i*11+29),r4=fsSr(s*i+i*17+41);
    var ret=(r-.49)*.03+bias,o=price,c=price*(1+ret);
    var h=Math.max(o,c)*(1+r2*.015),l=Math.min(o,c)*(1-r3*.015);
    var big=r4>.82,v=vol*(.5+r*.8)*(big?(2+r2*3):1);
    var mfm=(h-l)>0?((c-l)-(h-c))/(h-l):0;
    obv+=c>o?v:-v; ad+=mfm*v;
    var dt=new Date();dt.setDate(dt.getDate()-days+i);
    data.push({dt:dt,o:o,h:h,l:l,c:c,v:v,obv:obv,ad:ad,mfv:mfm*v,big:big,up:c>=o,mfm:mfm});
    price=c;
  }
  return data;
}
function fsCalcCMF(data,p){p=p||20;return data.map(function(_,i){if(i<p-1)return 0;var sm=0,sv=0;for(var j=i-p+1;j<=i;j++){sm+=data[j].mfv;sv+=data[j].v;}return sv>0?sm/sv:0;});}
function fsCalcMA(arr,p){return arr.map(function(_,i){if(i<p-1)return null;return arr.slice(i-p+1,i+1).reduce(function(a,b){return a+b;},0)/p;});}
function fsCalcRSI(data,p){p=p||14;var g=0,l=0;for(var i=1;i<=p;i++){var d=data[i].c-data[i-1].c;if(d>0)g+=d;else l-=d;}var ag=g/p,al=l/p,rsi=[];for(var i=0;i<p;i++)rsi.push(50);rsi.push(al===0?100:100-(100/(1+ag/al)));for(var i=p+1;i<data.length;i++){var d=data[i].c-data[i-1].c;ag=(ag*(p-1)+(d>0?d:0))/p;al=(al*(p-1)+(d<0?-d:0))/p;rsi.push(al===0?100:100-(100/(1+ag/al)));}return rsi;}

function fsProcess(data){
  var n=data.length;
  // Adaptasi periode indikator sesuai jumlah data tersedia
  var cmfP  = Math.max(3, Math.min(20, Math.floor(n*0.6)));
  var maFP  = Math.max(3, Math.min(20, Math.floor(n*0.5)));
  var maSP  = Math.max(5, Math.min(50, Math.floor(n*0.8)));
  var rsiP  = Math.max(3, Math.min(14, Math.floor(n*0.6)));
  var vmaP  = Math.max(3, Math.min(20, Math.floor(n*0.5)));

  var cmf=fsCalcCMF(data,cmfP);
  var cls=data.map(function(d){return d.c;});
  var vls=data.map(function(d){return d.v;});
  var ma20=fsCalcMA(cls,maFP),ma50=fsCalcMA(cls,maSP),vma20=fsCalcMA(vls,vmaP),rsi=fsCalcRSI(data,rsiP);
  data.forEach(function(d,i){
    d.ma20=ma20[i];d.ma50=ma50[i];d.vma20=vma20[i];d.cmf=cmf[i];d.rsi=rsi[i];
    d.vr=d.vma20?d.v/d.vma20:1;d.isBig=d.vr>=1.5;
    d.buyVol=d.mfm>0?d.v*d.mfm:0;d.sellVol=d.mfm<0?d.v*(-d.mfm):0;
    if(d.isBig&&d.up)d.sig='ACC';else if(d.isBig&&!d.up)d.sig='DIST';else d.sig='';
  });
  var cl=cmf[cmf.length-1]||0,rl=rsi[rsi.length-1]||50;
  var lookback=Math.min(n,20);
  var rec=data.slice(-lookback);
  var bu=rec.filter(function(d){return d.sig==='ACC';}).length;
  var bd=rec.filter(function(d){return d.sig==='DIST';}).length;
  var last=data[data.length-1],prev=data[data.length-2]||last;
  var chgPct=prev.c>0?((last.c-prev.c)/prev.c*100):0;
  var obvRef=data[Math.max(0,data.length-Math.min(10,n-1))];
  var adRef=data[Math.max(0,data.length-Math.min(5,n-1))];
  var obvT=obvRef?last.obv>obvRef.obv:false;
  var adT=adRef?last.ad>adRef.ad:false;
  var sc=40;
  if(cl>0.1)sc+=20;else if(cl>0)sc+=10;else if(cl<-0.1)sc-=20;else sc-=10;
  if(cl>0)sc+=5;if(bu>bd)sc+=20;if(bu>=2)sc+=10;if(obvT)sc+=10;if(rl>50&&rl<70)sc+=10;
  if(last.ma20&&last.c>last.ma20)sc+=10;
  sc=Math.max(0,Math.min(100,sc));
  var sig='NETRAL',str='Sinyal lemah';
  if(sc>=70){sig='AKUMULASI';str='Sinyal kuat';}else if(sc>=58){sig='AKUMULASI';str='Sinyal sedang';}
  else if(sc<=30){sig='DISTRIBUSI';str='Sinyal kuat';}else if(sc<=42){sig='DISTRIBUSI';str='Sinyal sedang';}
  return{cmf:cmf,ma20:ma20,ma50:ma50,rsi:rsi,cl:cl,rl:rl,bu:bu,bd:bd,sc:sc,sig:sig,str:str,
         chgPct:chgPct,obvT:obvT,adT:adT,last:last,prev:prev,cmfP:cmfP,maFP:maFP,maSP:maSP,rsiP:rsiP};
}

// ── nav / helpers ──
function fsSt(name,btn){
  var groups={all:['ov','vol','ind','vwap'],tbl:['tbl'],ai:['ai']};
  var show=groups[name]||[name];
  ['ov','vol','ind','vwap','tbl','ai'].forEach(function(t){
    var e=document.getElementById('fs-st-'+t);
    if(e) e.style.display=show.indexOf(t)>=0?'block':'none';
  });
  var pb=document.getElementById('fs-prob');
  if(pb) pb.style.display=(name==='all')?'block':'none';
  document.querySelectorAll('#page-flowscan .tab').forEach(function(b){b.classList.remove('on');});
  if(btn) btn.classList.add('on');
  if(name==='all' && FS_G.data){ fsRenderVWAP(); fsRenderProb(FS_G.a); }
}

function fsSetPeriod(d,btn){
  FS_G.days=d;
  // hanya hapus .on dari tombol period di FlowScan (parent row-nya)
  var row = btn.parentElement;
  if(row) row.querySelectorAll('.pbtn').forEach(function(b){b.classList.remove('on');});
  btn.classList.add('on');
  // re-run jika data sudah ada
  if(FS_G.data) fsRunAnalysis();
}

function fsQuickLoad(tk){
  var inp=document.getElementById('fs-ticker-input');
  if(inp) inp.value=tk;
  goPage('flowscan',null);
  fsRunAnalysis();
}

// ── analysis ──
function fsRunAnalysis(){
  var inp=document.getElementById('fs-ticker-input');
  var tk=(inp?inp.value:'BBCA').trim().toUpperCase().replace(/\.JK$/i,'');
  if(!tk) return;
  FS_G.tk=tk;
  var data=fsGenData(tk,FS_G.days);
  var a=fsProcess(data);
  FS_G.data=data; FS_G.a=a;
  var last=a.last,prev=a.prev;
  var chg=((last.c-prev.c)/prev.c*100);
  var info=FS_UNIV.find(function(u){return u.t===tk;})||{n:tk,s:'IHSG'};
  var rec=data.slice(-20);
  var bvBuy=rec.filter(function(d){return d.sig==='ACC';}).reduce(function(s,d){return s+d.buyVol;},0);
  var bvSell=rec.filter(function(d){return d.sig==='DIST';}).reduce(function(s,d){return s+d.sellVol;},0);
  var net=bvBuy-bvSell;

  var cards=document.getElementById('fs-cards');
  if(cards) cards.innerHTML=
    '<div class="metric"><div class="mlabel">Saham</div><div class="mval" style="font-size:20px">'+tk+'</div><div class="msub neu">'+info.s+'</div></div>'+
    '<div class="metric"><div class="mlabel">Harga</div><div class="mval" style="font-size:18px">'+fsP(last.c)+'</div><div class="msub '+(chg>=0?'up':'dn')+'">'+fsPct(chg)+' hari ini</div></div>'+
    '<div class="metric"><div class="mlabel">Sinyal</div><div style="margin-top:6px">'+fsMkBdg(a.sig)+'</div><div class="msub neu">'+a.str+'</div></div>'+
    '<div class="metric"><div class="mlabel">Skor Big Money</div><div class="mval" style="color:'+fsScColor(a.sc)+'">'+a.sc+'/100</div><div class="msub"><div class="prog"><div class="progf" style="width:'+a.sc+'%;background:'+fsScColor(a.sc)+'"></div></div></div></div>'+
    '<div class="metric"><div class="mlabel">Net Vol Institusional</div><div class="mval '+(net>=0?'up':'dn')+'">'+(net>=0?'+':'')+fsV(Math.abs(net))+'</div><div class="msub neu">'+a.bu+' acc / '+a.bd+' dist hari</div></div>';

  var pLbl=document.getElementById('fs-price-lbl');
  var periodLabel = FS_G.days===7?'1 Minggu':FS_G.days===30?'1 Bulan':FS_G.days===90?'3 Bulan':'1 Tahun';
  if(pLbl) pLbl.innerHTML = 'Harga terakhir: <strong>'+fsP(last.c)+'</strong> &nbsp;·&nbsp; Periode: <strong style="color:var(--accent)">'+periodLabel+'</strong> ('+FS_G.days+' hari)'+
    (FS_G.days<=7?' &nbsp;<span style="color:var(--amber);font-size:10px">⚠️ Indikator diadaptasi ke data pendek</span>':'');

  // Notice bar untuk timeframe pendek
  var noticeEl = document.getElementById('fs-period-notice');
  if(noticeEl){
    if(FS_G.days<=7){
      noticeEl.style.display='flex';
      noticeEl.innerHTML='<span style="color:var(--amber)">⚠️</span> <span style="font-size:11px;color:var(--text2)">Periode <strong>1 Minggu (7 hari)</strong> — periode indikator diadaptasi otomatis (CMF-'+a.cmfP+', RSI-'+a.rsiP+', MA'+a.maFP+'/'+a.maSP+'). Sinyal kurang akurat dibanding periode lebih panjang.</span>';
    } else {
      noticeEl.style.display='none';
    }
  }

  var wlBar=document.getElementById('fs-wl-bar-txt');
  var wlBtn=document.getElementById('fs-wl-btn');
  var inWl=FS_WL.some(function(w){return w.t===tk;});
  if(wlBar) wlBar.textContent=inWl?tk+' sudah ada di watchlist Anda':'Tambah '+tk+' ke watchlist untuk memantau secara rutin';
  if(wlBtn){wlBtn.textContent=inWl?'✓ Ada di Watchlist':'⭐ Tambah ke Watchlist';wlBtn.className='btn '+(inWl?'btn-ghost':'btn-blue')+' btn-sm';}

  fsRenderCharts();
  fsRenderInd();
  fsRenderDailyTable();
  // Render VWAP jika tab sedang terbuka
  var vwapTab = document.getElementById('fs-st-vwap');
  try{ fsRenderVWAP(); }catch(e){} // always render so VWAP data is ready

  // Hanya reset AI box jika ticker berubah (bukan hanya period change)
  var prevTk = FS_G._prevTk;
  var aiBox=document.getElementById('fs-ai-box');
  if(aiBox && tk !== prevTk){
    aiBox.innerHTML='<div style="text-align:center;padding:18px 0;color:var(--text3)"><i class="ti ti-brain" style="font-size:22px;display:block;margin-bottom:7px"></i>Tekan Generate untuk analisa AI mendalam.</div>';
  }
  // Kesimpulan probabilitas + tampilkan semua bila tab Analisa aktif
  fsRenderProb(a);
  var tblOpen=document.getElementById('fs-st-tbl'); tblOpen=tblOpen&&tblOpen.style.display!=='none';
  var aiOpen=document.getElementById('fs-st-ai'); aiOpen=aiOpen&&aiOpen.style.display!=='none';
  if(!tblOpen && !aiOpen){
    ['ov','vol','ind','vwap'].forEach(function(t){var e=document.getElementById('fs-st-'+t);if(e)e.style.display='block';});
    var pb=document.getElementById('fs-prob'); if(pb)pb.style.display='block';
    fsRenderVWAP();
  }
  FS_G._prevTk = tk;
}

function fsToogleWatchlistCurrent(){
  var tk=FS_G.tk;
  if(FS_WL.some(function(w){return w.t===tk;})){
    FS_WL=FS_WL.filter(function(w){return w.t!==tk;});
  } else {
    var info=FS_UNIV.find(function(u){return u.t===tk;})||{t:tk,n:tk,s:'IHSG',cap:0};
    var data=fsGenData(tk,60);var a=fsProcess(data);
    FS_WL.push(Object.assign({},info,{data:data,a:a}));
  }
  fsRunAnalysis();
}

// ── charts ──
function fsRenderCharts(){
  var data=FS_G.data,a=FS_G.a;
  if(!data) return;
  var lb=data.map(function(d){return fsD(d.dt);});
  var cl=data.map(function(d){return d.c;});
  var vl=data.map(function(d){return d.v;});
  var cm=a.cmf.map(function(v){return+(v*100).toFixed(2);});
  var rs=a.rsi;
  var vc=data.map(function(d){return d.sig==='ACC'?'rgba(0,229,160,.7)':d.sig==='DIST'?'rgba(255,61,90,.7)':'rgba(50,65,82,.8)';});
  var nf=data.map(function(d){return+((d.buyVol-d.sellVol)/1e6).toFixed(2);});

  Object.values(FS_CHARTS).forEach(function(c){try{c.destroy();}catch(e){}});FS_CHARTS={};

  var GC2='rgba(255,255,255,.04)',TC2={color:'#4a5e82',font:{size:10}};
  var bo={responsive:true,maintainAspectRatio:false,
    plugins:{legend:{display:false},tooltip:{backgroundColor:'rgba(6,11,23,.95)',borderColor:'rgba(255,255,255,.08)',borderWidth:1,titleColor:'#8fa3c8',bodyColor:'#dce8ff',bodyFont:{family:'IBM Plex Mono',size:11}}},
    scales:{x:{ticks:Object.assign({maxTicksLimit:8,autoSkip:true},TC2),grid:{display:false},border:{display:false}},
            y:{ticks:TC2,grid:{color:GC2},border:{display:false}}}};
  function mo(extra){return Object.assign({},bo,extra);}

  var cvPr=document.getElementById('fsCPr');
  if(cvPr) FS_CHARTS.pr=new Chart(cvPr,{type:'line',data:{labels:lb,datasets:[
    {data:cl,borderColor:'#4da6ff',borderWidth:1.5,pointRadius:0,fill:true,tension:0.3,backgroundColor:function(ctx){var g=ctx.chart.ctx.createLinearGradient(0,0,0,200);g.addColorStop(0,'rgba(77,166,255,.14)');g.addColorStop(1,'rgba(77,166,255,0)');return g;}},
    {data:a.ma20,borderColor:'rgba(0,229,160,.55)',borderWidth:1,pointRadius:0,fill:false,borderDash:[4,2],tension:0.3,spanGaps:true},
    {data:a.ma50,borderColor:'rgba(255,61,90,.45)',borderWidth:1,pointRadius:0,fill:false,borderDash:[6,3],tension:0.3,spanGaps:true}
  ]},options:mo({})});

  var cvVo=document.getElementById('fsCVo');
  if(cvVo) FS_CHARTS.vo=new Chart(cvVo,{type:'bar',data:{labels:lb,datasets:[{data:vl,backgroundColor:vc,borderWidth:0,borderRadius:2}]},options:mo({})});

  var cvCm=document.getElementById('fsCCm');
  if(cvCm) FS_CHARTS.cm=new Chart(cvCm,{type:'bar',data:{labels:lb,datasets:[{data:cm,backgroundColor:cm.map(function(v){return v>0?'rgba(0,229,160,.65)':'rgba(255,61,90,.65)';}),borderWidth:0,borderRadius:1}]},options:mo({})});

  var cvNf=document.getElementById('fsCNf');
  if(cvNf) FS_CHARTS.nf=new Chart(cvNf,{type:'bar',data:{labels:lb,datasets:[{data:nf,backgroundColor:nf.map(function(v){return v>=0?'rgba(0,229,160,.6)':'rgba(255,61,90,.6)';}),borderWidth:0,borderRadius:2}]},options:mo({})});

  var cvRs=document.getElementById('fsCRs');
  if(cvRs) FS_CHARTS.rs=new Chart(cvRs,{type:'line',data:{labels:lb,datasets:[
    {data:rs,borderColor:'#a78bfa',borderWidth:1.5,pointRadius:0,fill:false,tension:0.3},
    {data:Array(rs.length).fill(70),borderColor:'rgba(255,61,90,.3)',borderWidth:1,pointRadius:0,fill:false,borderDash:[3,3]},
    {data:Array(rs.length).fill(30),borderColor:'rgba(0,229,160,.3)',borderWidth:1,pointRadius:0,fill:false,borderDash:[3,3]}
  ]},options:mo({scales:Object.assign({},bo.scales,{y:Object.assign({},bo.scales.y,{min:0,max:100})})})}); 
}

function fsRenderInd(){
  var data=FS_G.data,a=FS_G.a;
  if(!data) return;
  var last=a.last;
  var n=data.length;
  var lookback=Math.min(n,20);
  // Label adaptif berdasarkan periode yang dipakai
  var cmfLabel = 'CMF-'+(a.cmfP||20);
  var rsiLabel = 'RSI-'+(a.rsiP||14);
  var volLabel = 'Vol Ratio vs MA'+(a.maFP||20);
  var bvLabel  = 'Big Vol Days ('+lookback+'h)';
  var items=[
    {n:'On-Balance Volume',v:(last.obv>=0?'+':'')+fsV(last.obv),d:a.obvT?'OBV naik → Big money masuk':'OBV turun → Tekanan jual dominan',p:a.obvT?72:28,c:a.obvT?'#00e5a0':'#ff3d5a'},
    {n:cmfLabel,v:(a.cl*100).toFixed(2)+'%',d:a.cl>0.1?'Tekanan beli kuat':a.cl>0?'Tekanan beli lemah':a.cl>-0.1?'Tekanan jual lemah':'Tekanan jual kuat',p:Math.min(100,Math.max(0,(a.cl+0.3)*167)),c:a.cl>0?'#00e5a0':'#ff3d5a'},
    {n:volLabel,v:last.vr.toFixed(2)+'×',d:last.vr>2?'Anomali institusional >2×':last.vr>1.5?'Volume di atas normal':last.vr>0.8?'Volume normal':'Volume sepi',p:Math.min(100,last.vr*40),c:last.vr>1.5?'#00e5a0':'#8fa3c8'},
    {n:'A/D Line',v:a.adT?'Naik':'Turun',d:a.adT?'A/D naik — akumulasi berlanjut':'A/D turun — distribusi berlanjut',p:a.adT?72:28,c:a.adT?'#00e5a0':'#ff3d5a'},
    {n:rsiLabel,v:a.rl.toFixed(1),d:a.rl>70?'Overbought':a.rl<30?'Oversold':a.rl>50?'Momentum positif':'Momentum negatif',p:a.rl,c:a.rl>70?'#ff3d5a':a.rl<30?'#00e5a0':'#8fa3c8'},
    {n:bvLabel,v:a.bu+' naik / '+a.bd+' turun',d:a.bu>a.bd?'Big vol dominan hari naik → Akumulasi':a.bu<a.bd?'Big vol dominan hari turun → Distribusi':'Imbang',p:a.bu+a.bd>0?Math.min(100,a.bu/(a.bu+a.bd)*100):50,c:a.bu>a.bd?'#00e5a0':a.bu<a.bd?'#ff3d5a':'#8fa3c8'}
  ];
  var grid=document.getElementById('fs-ind-grid');
  if(grid) grid.innerHTML=items.map(function(x){
    return '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:12px">'+
      '<div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.7px;margin-bottom:4px">'+x.n+'</div>'+
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:16px;font-weight:500;margin-bottom:3px;color:'+x.c+'">'+x.v+'</div>'+
      '<div style="font-size:11px;color:var(--text2);line-height:1.45">'+x.d+'</div>'+
      '<div style="height:3px;background:var(--bg5);border-radius:2px;margin-top:8px;overflow:hidden">'+
        '<div style="width:'+x.p+'%;height:100%;border-radius:2px;background:'+x.c+'"></div></div></div>';
  }).join('');
}

function fsRenderDailyTable(){
  var data=FS_G.data;
  if(!data) return;
  var tbody=document.getElementById('fs-daily-body');
  if(!tbody) return;
  tbody.innerHTML='';
  data.slice(-60).reverse().forEach(function(d){
    var chg=d.o>0?((d.c-d.o)/d.o*100):0;
    var vc=d.vr>=2?'#00e5a0':d.vr>=1.5?'rgba(0,229,160,.7)':d.vr<0.7?'#ff3d5a':'#8fa3c8';
    var sig=d.sig==='ACC'?'<span class="badge b-up"><i class="ti ti-trending-up"></i> Akumulasi</span>':d.sig==='DIST'?'<span class="badge b-dn"><i class="ti ti-trending-down"></i> Distribusi</span>':'';
    var cc=d.cmf>0.1?'#00e5a0':d.cmf<-0.1?'#ff3d5a':'#8fa3c8';
    var tr=document.createElement('tr');
    if(d.sig==='ACC')tr.style.background='rgba(0,229,160,.04)';
    if(d.sig==='DIST')tr.style.background='rgba(255,61,90,.04)';
    tr.innerHTML='<td class="mono">'+fsD(d.dt)+'</td><td class="mono">'+fsP(d.o)+'</td>'+
      '<td class="mono up">'+fsP(d.h)+'</td><td class="mono dn">'+fsP(d.l)+'</td>'+
      '<td class="mono" style="font-weight:600">'+fsP(d.c)+'</td>'+
      '<td class="mono '+(chg>=0?'up':'dn')+'">'+fsPct(chg)+'</td>'+
      '<td class="mono">'+fsV(d.v)+'</td>'+
      '<td class="mono" style="color:'+vc+';font-weight:'+(d.vr>=1.5?600:400)+'">'+d.vr.toFixed(2)+'×</td>'+
      '<td class="mono up">'+(d.buyVol>0?fsV(d.buyVol):'—')+'</td>'+
      '<td class="mono dn">'+(d.sellVol>0?fsV(d.sellVol):'—')+'</td>'+
      '<td class="mono" style="color:'+cc+'">'+(d.cmf*100).toFixed(1)+'%</td>'+
      '<td>'+sig+'</td>';
    tbody.appendChild(tr);
  });
}

// ── VWAP ENGINE ──────────────────────────────────────────────
function fsCalcVWAP(data){
  var cumTPV=0,cumVol=0;
  return data.map(function(d){
    var tp=(d.h+d.l+d.c)/3;
    cumTPV+=tp*d.v; cumVol+=d.v;
    return cumVol>0?cumTPV/cumVol:d.c;
  });
}
function fsCalcVWAPPeriod(data,period){
  return data.map(function(_,i){
    var slice=data.slice(Math.max(0,i-period+1),i+1);
    var sTPV=0,sVol=0;
    slice.forEach(function(d){var tp=(d.h+d.l+d.c)/3;sTPV+=tp*d.v;sVol+=d.v;});
    return sVol>0?sTPV/sVol:data[i].c;
  });
}
function fsCalcVWAPStdDev(data,vwap){
  var cumSq=0,cumVol=0;
  return data.map(function(d,i){
    var tp=(d.h+d.l+d.c)/3;
    var dev=tp-vwap[i];
    cumSq+=dev*dev*d.v; cumVol+=d.v;
    return cumVol>0?Math.sqrt(cumSq/cumVol):0;
  });
}
function fsRenderVWAP(){
  var data=FS_G.data,a=FS_G.a;
  if(!data||data.length<5) return;
  var sigma=parseFloat(document.getElementById('vwap-band-sel')&&document.getElementById('vwap-band-sel').value||2);
  var vwap=fsCalcVWAP(data);
  var std=fsCalcVWAPStdDev(data,vwap);
  var upper=vwap.map(function(v,i){return v+sigma*std[i];});
  var lower=vwap.map(function(v,i){return v-sigma*std[i];});
  var labels=data.map(function(d){return fsD(d.dt);});
  var closes=data.map(function(d){return d.c;});
  var last=data[data.length-1];
  var vL=vwap[vwap.length-1],uL=upper[upper.length-1],lL=lower[lower.length-1];
  // Chart 1: VWAP + bands
  if(FS_CHARTS.vwap){try{FS_CHARTS.vwap.destroy();}catch(e){}}
  var cv1=document.getElementById('fsVwapChart');
  var boV={responsive:true,maintainAspectRatio:false,
    plugins:{legend:{display:true,position:'top',labels:{color:'#4a5e82',font:{size:9},boxWidth:16}},
      tooltip:{backgroundColor:'rgba(6,11,23,.95)',borderColor:'rgba(255,255,255,.08)',borderWidth:1,
        titleColor:'#8fa3c8',bodyColor:'#dce8ff',bodyFont:{family:'IBM Plex Mono',size:10},
        callbacks:{label:function(c){return c.dataset.label+': '+fsP(c.parsed.y);}}}},
    scales:{x:{ticks:{maxTicksLimit:8,autoSkip:true,color:'#4a5e82',font:{size:9}},grid:{display:false},border:{display:false}},
            y:{ticks:{color:'#4a5e82',font:{size:9}},grid:{color:'rgba(255,255,255,.04)'},border:{display:false}}}};
  if(cv1) FS_CHARTS.vwap=new Chart(cv1,{type:'line',data:{labels:labels,datasets:[
    {label:'Harga',data:closes,borderColor:'rgba(77,166,255,.9)',borderWidth:1.5,pointRadius:0,fill:false,tension:.3},
    {label:'VWAP',data:vwap,borderColor:'#ffc107',borderWidth:2.5,pointRadius:0,fill:false,tension:.3},
    {label:'Upper +'+sigma+'σ',data:upper,borderColor:'rgba(255,61,90,.55)',borderWidth:1,pointRadius:0,fill:false,tension:.3,borderDash:[4,2]},
    {label:'Lower −'+sigma+'σ',data:lower,borderColor:'rgba(0,229,160,.55)',borderWidth:1,pointRadius:0,fill:false,tension:.3,borderDash:[4,2]},
  ]},options:boV});
  // Chart 2: Multi-period
  var vwap5=fsCalcVWAPPeriod(data,5),vwap20=fsCalcVWAPPeriod(data,20);
  if(FS_CHARTS.vwapM){try{FS_CHARTS.vwapM.destroy();}catch(e){}}
  var cv2=document.getElementById('fsVwapMulti');
  if(cv2) FS_CHARTS.vwapM=new Chart(cv2,{type:'line',data:{labels:labels,datasets:[
    {label:'Harga',data:closes,borderColor:'rgba(77,166,255,.7)',borderWidth:1.5,pointRadius:0,fill:false,tension:.3},
    {label:'VWAP-1D',data:vwap,borderColor:'#ffc107',borderWidth:2,pointRadius:0,fill:false,tension:.3},
    {label:'VWAP-5H',data:vwap5,borderColor:'#a78bfa',borderWidth:1.5,pointRadius:0,fill:false,tension:.3,borderDash:[4,2]},
    {label:'VWAP-20H',data:vwap20,borderColor:'#ff6b6b',borderWidth:1.5,pointRadius:0,fill:false,tension:.3,borderDash:[6,3]},
  ]},options:boV});
  // Level cards
  var aboveV=last.c>vL;
  var pctV=((last.c-vL)/vL*100).toFixed(2);
  var lvls=[
    {label:'VWAP Harian',val:vL,color:'#ffc107',desc:'Harga rata-rata berbobot volume'},
    {label:'Upper Band +'+sigma+'σ',val:uL,color:'#ff3d5a',desc:'Resistance / overbought zona'},
    {label:'Lower Band −'+sigma+'σ',val:lL,color:'#00e5a0',desc:'Support / oversold zona'},
    {label:'Harga Terakhir',val:last.c,color:aboveV?'#00e5a0':'#ff3d5a',desc:(aboveV?'Di atas':'Di bawah')+' VWAP ('+pctV+'%)'},
  ];
  var lvlEl=document.getElementById('vwap-levels');
  if(lvlEl) lvlEl.innerHTML=lvls.map(function(l){
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 10px;background:var(--bg3);border-radius:7px;border-left:3px solid '+l.color+'">'+
      '<div><div style="font-size:10px;color:var(--text3)">'+l.label+'</div><div style="font-size:10px;color:var(--text2);margin-top:1px">'+l.desc+'</div></div>'+
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:13px;font-weight:700;color:'+l.color+'">'+fsP(l.val)+'</div></div>';
  }).join('');
  // Signal text
  var sig='';
  if(last.c>uL) sig='<span style="color:#ff3d5a">⚠️ Di atas Upper Band (+'+sigma+'σ)</span><br>Kondisi <strong>overbought</strong>. Potensi pullback ke VWAP ('+fsP(vL)+').';
  else if(last.c<lL) sig='<span style="color:#00e5a0">🎯 Di bawah Lower Band (−'+sigma+'σ)</span><br>Kondisi <strong>oversold</strong>. Zona akumulasi, potensi bounce ke VWAP.';
  else if(last.c>vL) sig='<span style="color:#00e5a0">✅ Di atas VWAP</span><br>Tren <strong>bullish</strong>. VWAP '+fsP(vL)+' sebagai support dinamis.';
  else sig='<span style="color:#ff3d5a">📉 Di bawah VWAP</span><br>Tren <strong>bearish</strong>. VWAP '+fsP(vL)+' sebagai resistance.';
  var v5L=vwap5[vwap5.length-1],v20L=vwap20[vwap20.length-1];
  if(last.c>vL&&last.c>v5L&&last.c>v20L) sig+='<br><br>🔥 <strong>Triple VWAP Confluence Bullish</strong> — buyer dominan di semua timeframe.';
  if(last.c<vL&&last.c<v5L&&last.c<v20L) sig+='<br><br>❄️ <strong>Triple VWAP Confluence Bearish</strong> — seller dominan di semua timeframe.';
  var sE=document.getElementById('vwap-signal'); if(sE) sE.innerHTML=sig;
}

// ── ranking ──
function fsRenderRanking(){
  if(!FS_RD.length) return;
  var sort=document.getElementById('rk-sort')&&document.getElementById('rk-sort').value||'score';
  var sigF=document.getElementById('rk-sig')&&document.getElementById('rk-sig').value||'all';
  var list=[].concat(FS_RD);
  if(sigF!=='all') list=list.filter(function(r){return r.a.sig===sigF;});
  list.sort(function(a,b){if(sort==='score')return b.a.sc-a.a.sc;if(sort==='cap')return b.cap-a.cap;if(sort==='cmf')return b.a.cl-a.a.cl;if(sort==='chg')return b.a.chgPct-a.a.chgPct;return 0;});

  var acc=FS_RD.filter(function(r){return r.a.sig==='AKUMULASI';}).length;
  var dist=FS_RD.filter(function(r){return r.a.sig==='DISTRIBUSI';}).length;
  var neut=FS_RD.filter(function(r){return r.a.sig==='NETRAL';}).length;
  var avg=Math.round(FS_RD.reduce(function(s,r){return s+r.a.sc;},0)/FS_RD.length);
  var rkSum=document.getElementById('rk-sum');
  if(rkSum) rkSum.innerHTML=[
    {v:acc,l:'Akumulasi',c:'rgba(0,229,160,.1)',bc:'rgba(0,229,160,.2)',tc:'#00e5a0'},
    {v:dist,l:'Distribusi',c:'rgba(255,61,90,.1)',bc:'rgba(255,61,90,.2)',tc:'#ff3d5a'},
    {v:neut,l:'Netral',c:'var(--bg3)',bc:'var(--border)',tc:'var(--text2)'},
    {v:avg,l:'Avg Skor',c:'rgba(0,200,255,.08)',bc:'rgba(0,200,255,.2)',tc:'var(--accent)'},
  ].map(function(x){return '<div style="background:'+x.c+';border:.5px solid '+x.bc+';border-radius:8px;padding:10px 12px;text-align:center"><div class="mono" style="font-size:20px;font-weight:600;color:'+x.tc+'">'+x.v+'</div><div style="font-size:10px;color:var(--text3);margin-top:2px;text-transform:uppercase;letter-spacing:.8px">'+x.l+'</div></div>';}).join('');

  var rkChart=document.getElementById('rk-chart');
  if(rkChart){
    if(FS_CHARTS.rk){try{FS_CHARTS.rk.destroy();}catch(e){}}
    var top=list.slice(0,15);
    FS_CHARTS.rk=new Chart(rkChart,{type:'bar',
      data:{labels:top.map(function(r){return r.t;}),
            datasets:[{data:top.map(function(r){return r.a.sc;}),
              backgroundColor:top.map(function(r){return r.a.sig==='AKUMULASI'?'rgba(0,229,160,.75)':r.a.sig==='DISTRIBUSI'?'rgba(255,61,90,.75)':'rgba(60,75,95,.8)';}),borderWidth:0,borderRadius:3}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
        scales:{x:{ticks:{color:'#4a5e82',font:{family:'IBM Plex Mono',size:10}},grid:{display:false},border:{display:false}},
                y:{min:0,max:100,ticks:{color:'#4a5e82',font:{size:10}},grid:{color:'rgba(255,255,255,.04)'},border:{display:false}}}}});
  }

  var rkBody=document.getElementById('rk-body');
  if(rkBody) rkBody.innerHTML=list.map(function(r,i){
    var last=r.data[r.data.length-1];
    var inWl=FS_WL.some(function(w){return w.t===r.t;});
    return '<tr style="'+(r.a.sig==='AKUMULASI'?'background:rgba(0,229,160,.03)':r.a.sig==='DISTRIBUSI'?'background:rgba(255,61,90,.03)':'')+'">'
      +'<td class="mono" style="color:var(--text3)">'+(i+1)+'</td>'
      +'<td class="mono" style="font-weight:600;cursor:pointer;color:var(--accent)" onclick="fsQuickLoad(\''+r.t+'\')">'+r.t+'</td>'
      +'<td><div style="font-size:12px">'+r.n+'</div><span class="badge b-neu" style="font-size:9px">'+r.s+'</span></td>'
      +'<td class="mono">'+fsP(last.c)+'</td>'
      +'<td class="mono '+(r.a.chgPct>=0?'up':'dn')+'">'+fsPct(r.a.chgPct)+'</td>'
      +'<td class="mono" style="color:var(--text2)">'+r.cap+'T</td>'
      +'<td><div style="display:flex;align-items:center;gap:5px"><span class="mono" style="color:'+fsScColor(r.a.sc)+';min-width:22px;font-weight:600">'+r.a.sc+'</span><div class="prog" style="width:50px"><div class="progf" style="width:'+r.a.sc+'%;background:'+fsScColor(r.a.sc)+'"></div></div></div></td>'
      +'<td>'+fsMkBdg(r.a.sig,true)+'</td>'
      +'<td class="mono" style="color:'+(r.a.cl>0?'#00e5a0':'#ff3d5a')+'">'+(r.a.cl*100).toFixed(1)+'%</td>'
      +'<td class="mono" style="color:'+(r.a.rl>70?'#ff3d5a':r.a.rl<30?'#00e5a0':'var(--text2)')+'">'+r.a.rl.toFixed(1)+'</td>'
      +'<td><button class="btn btn-ghost btn-xs '+(inWl?'b-up':'')+'" onclick="fsTgWl(\''+r.t+'\');fsRenderRanking()" style="font-size:10px">'+(inWl?'★':'☆')+'</button></td>'
      +'<td><button class="btn btn-ghost btn-xs" onclick="fsQuickLoad(\''+r.t+'\')" style="font-size:10px">Lihat</button></td>'
      +'</tr>';
  }).join('');
}

// ── Heatmap tab switcher ──
function hmSwitchTab(tab, btn){
  var panels=['flow','factor'];
  panels.forEach(function(p){
    var panel=el('hm-panel-'+p);
    if(panel) panel.style.display=(p===tab)?'':'none';
    var tb=el('hm-tab-'+p);
    if(tb){ tb.classList.toggle('on',p===tab); }
  });
  if(tab==='factor') fhmRender();
  if(tab==='flow') fsRenderHeatmap();
}

// ── heatmap ──
function fsRenderHeatmap(){
  if(!FS_RD.length) return;
  var m=document.getElementById('hm-mode')&&document.getElementById('hm-mode').value||'score';
  var grid=document.getElementById('hm-grid');
  if(!grid) return;
  grid.innerHTML=[].concat(FS_RD).sort(function(a,b){return b.cap-a.cap;}).map(function(r){
    var last=r.data[r.data.length-1];
    var val,disp;
    if(m==='score'){val=r.a.sc;disp=''+val;}
    else if(m==='cmf'){val=r.a.cl;disp=(val*100).toFixed(1)+'%';}
    else{val=r.a.chgPct;disp=fsPct(val);}
    var cls=r.a.sig==='AKUMULASI'?'fs-hm-acc':r.a.sig==='DISTRIBUSI'?'fs-hm-dist':'fs-hm-neut';
    var vc=r.a.sig==='AKUMULASI'?'#00e5a0':r.a.sig==='DISTRIBUSI'?'#ff3d5a':'#8fa3c8';
    var inWl=FS_WL.some(function(w){return w.t===r.t;});
    return '<div class="fs-hm-cell '+cls+'" onclick="fsQuickLoad(\''+r.t+'\')" title="'+(inWl?'★ ':'')+r.n+' — '+r.a.sig+'">'
      +'<div class="mono" style="font-size:11px;font-weight:500;color:var(--text)">'+(inWl?'★ ':'')+r.t+'</div>'
      +'<div class="mono" style="font-size:13px;font-weight:700;color:'+vc+'">'+disp+'</div>'
      +'<div class="mono" style="font-size:10px;margin-top:1px;color:'+(r.a.chgPct>=0?'#00e5a0':'#ff3d5a')+'">'+fsPct(r.a.chgPct)+'</div>'
      +'</div>';
  }).join('');
}

// ── scanner ──
function fsRunScanner(){
  var mc=parseFloat(document.getElementById('sc-cmf')&&document.getElementById('sc-cmf').value||-1);
  var ms=parseFloat(document.getElementById('sc-sc')&&document.getElementById('sc-sc').value||0);
  var mv=parseFloat(document.getElementById('sc-vr')&&document.getElementById('sc-vr').value||0);
  var res=FS_RD.filter(function(r){var last=r.data[r.data.length-1];return r.a.cl>=mc&&r.a.sc>=ms&&last.vr>=mv;}).sort(function(a,b){return b.a.sc-a.a.sc;});
  var out=document.getElementById('sc-results');
  if(!out) return;
  if(res.length===0){out.innerHTML='<div style="color:var(--text3);text-align:center;padding:20px;font-size:13px">Tidak ada saham memenuhi kriteria. Turunkan threshold.</div>';return;}
  out.innerHTML='<div style="font-size:12px;color:var(--text2);margin-bottom:10px">'+res.length+' saham ditemukan</div>'
    +'<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px">'
    +res.map(function(r){
      var last=r.data[r.data.length-1];
      var bc=r.a.sig==='AKUMULASI'?'rgba(0,229,160,.08)':'rgba(255,61,90,.08)';
      var brd=r.a.sig==='AKUMULASI'?'rgba(0,229,160,.2)':'rgba(255,61,90,.2)';
      var inWl=FS_WL.some(function(w){return w.t===r.t;});
      return '<div style="background:'+bc+';border:.5px solid '+brd+';border-radius:8px;padding:12px">'
        +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">'
        +'<span class="mono" style="font-weight:600;font-size:13px;cursor:pointer;color:var(--text)" onclick="fsQuickLoad(\''+r.t+'\')">'+r.t+'</span>'
        +'<button class="btn btn-ghost btn-xs" onclick="fsTgWl(\''+r.t+'\');fsRunScanner()" style="font-size:10px">'+(inWl?'★':'☆')+'</button>'
        +'</div>'
        +'<div style="font-size:11px;color:var(--text2);margin-bottom:5px">'+r.n.split(' ').slice(0,3).join(' ')+'</div>'
        +'<div style="display:flex;justify-content:space-between;margin-bottom:5px">'
        +'<span class="mono" style="font-size:10px;color:'+(r.a.cl>0?'#00e5a0':'#ff3d5a')+'">CMF '+(r.a.cl*100).toFixed(1)+'%</span>'
        +'<span class="mono" style="font-size:10px;color:'+(last.vr>1.5?'#00e5a0':'var(--text2)')+'">'+last.vr.toFixed(1)+'×</span>'
        +'</div>'+fsMkBdg(r.a.sig,true)+'</div>';
    }).join('')+'</div>';
}

// ── alerts ──
function fsGenAlerts(){
  var als=[];
  FS_RD.filter(function(r){return r.a.sc>=70;}).slice(0,3).forEach(function(r){als.push({t:'al-a',ic:'ti-trending-up',title:'Akumulasi kuat: '+r.t,sub:'Skor '+r.a.sc+'/100 • CMF '+(r.a.cl*100).toFixed(1)+'% • '+r.a.bu+' hari big vol naik'});});
  FS_RD.filter(function(r){return r.a.sc<=32;}).slice(0,2).forEach(function(r){als.push({t:'al-d',ic:'ti-trending-down',title:'Distribusi terdeteksi: '+r.t,sub:'Skor '+r.a.sc+'/100 • CMF '+(r.a.cl*100).toFixed(1)+'% • '+r.a.bd+' hari big vol turun'});});
  FS_RD.filter(function(r){return r.data[r.data.length-1].vr>=2;}).slice(0,3).forEach(function(r){als.push({t:'al-n',ic:'ti-bolt',title:'Volume anomali: '+r.t+' — '+r.data[r.data.length-1].vr.toFixed(1)+'× rata-rata',sub:'Aktivitas institusional tidak biasa. Pantau arah pergerakan harga.'});});
  als.sort(function(){return Math.random()-.5;});
  var alList=document.getElementById('al-list');
  if(alList) alList.innerHTML=als.map(function(a){
    var now=new Date();var h=String(9+Math.floor(Math.random()*6)).padStart(2,'0'),m=String(Math.floor(Math.random()*60)).padStart(2,'0');
    return '<div class="al-item"><div class="al-ico '+a.t+'"><i class="ti '+a.ic+'"></i></div>'
      +'<div style="flex:1"><div style="font-size:12px;font-weight:500;margin-bottom:2px">'+a.title+'</div>'
      +'<div style="font-size:11px;color:var(--text2)">'+a.sub+'</div></div>'
      +'<div class="mono" style="font-size:10px;color:var(--text3);flex-shrink:0;margin-top:1px">'+h+':'+m+' WIB</div></div>';
  }).join('');
}

// ── watchlist ──
function fsTgWl(tk){
  if(FS_WL.some(function(w){return w.t===tk;})){
    FS_WL=FS_WL.filter(function(w){return w.t!==tk;});
  } else {
    var info=FS_UNIV.find(function(u){return u.t===tk;})||{t:tk,n:tk,s:'IHSG',cap:0};
    var data=fsGenData(tk,60);var a=fsProcess(data);
    FS_WL.push(Object.assign({},info,{data:data,a:a}));
  }
  var cnt=document.getElementById('fs-wl-count');
  if(cnt) cnt.textContent=FS_WL.length;
}

function fsAddFromInput(){
  var inp=document.getElementById('wl-add-input');
  if(!inp) return;
  var v=inp.value.trim().toUpperCase().replace(/\.JK$/i,'');
  if(!v) return;
  fsTgWl(v);
  inp.value='';
  fsRenderWlPage();
}

function fsSetWlSort(mode,btn){
  fsWlSort=mode;
  document.querySelectorAll('#wl-sort-row button').forEach(function(b){b.className='btn btn-ghost btn-sm';});
  btn.className='btn btn-blue btn-sm';
  fsRenderWlPage();
}

function fsRenderWlPage(){
  var list=[].concat(FS_WL);
  if(fsWlSort==='score') list.sort(function(a,b){return b.a.sc-a.a.sc;});
  else if(fsWlSort==='chg') list.sort(function(a,b){return b.a.chgPct-a.a.chgPct;});
  else if(fsWlSort==='signal'){var o={'AKUMULASI':0,'NETRAL':1,'DISTRIBUSI':2};list.sort(function(a,b){return (o[a.a.sig]||1)-(o[b.a.sig]||1);});}
  var el=document.getElementById('wl-page-list');
  if(!el) return;
  if(list.length===0){
    el.innerHTML='<div style="text-align:center;padding:28px;color:var(--text3)">Watchlist kosong. Tambah saham dari input di atas.</div>';
    return;
  }
  el.innerHTML='<div style="overflow-x:auto"><table class="tbl"><thead><tr><th>Kode</th><th>Nama</th><th>Harga</th><th>Chg%</th><th>Skor</th><th>Sinyal</th><th>CMF</th><th>Vol Ratio</th><th>RSI</th><th></th></tr></thead><tbody>'
    +list.map(function(w){
      var last=w.data[w.data.length-1],prev=w.data[w.data.length-2]||last;
      var chg=((last.c-prev.c)/prev.c*100);
      return '<tr style="'+(w.a.sig==='AKUMULASI'?'background:rgba(0,229,160,.03)':w.a.sig==='DISTRIBUSI'?'background:rgba(255,61,90,.03)':'')+'">'
        +'<td class="mono" style="font-weight:600;cursor:pointer;color:var(--accent)" onclick="fsQuickLoad(\''+w.t+'\')">'+w.t+'</td>'
        +'<td><div style="font-size:12px">'+w.n+'</div><span class="badge b-neu" style="font-size:9px">'+w.s+'</span></td>'
        +'<td class="mono">'+fsP(last.c)+'</td>'
        +'<td class="mono '+(chg>=0?'up':'dn')+'">'+fsPct(chg)+'</td>'
        +'<td><div style="display:flex;align-items:center;gap:5px"><span class="mono" style="color:'+fsScColor(w.a.sc)+';min-width:22px;font-weight:600">'+w.a.sc+'</span><div class="prog" style="width:50px"><div class="progf" style="width:'+w.a.sc+'%;background:'+fsScColor(w.a.sc)+'"></div></div></div></td>'
        +'<td>'+fsMkBdg(w.a.sig,true)+'</td>'
        +'<td class="mono" style="color:'+(w.a.cl>0?'#00e5a0':'#ff3d5a')+'">'+(w.a.cl*100).toFixed(1)+'%</td>'
        +'<td class="mono" style="color:'+(last.vr>1.5?'#00e5a0':'var(--text2)')+'">'+last.vr.toFixed(2)+'×</td>'
        +'<td class="mono" style="color:'+(w.a.rl>70?'#ff3d5a':w.a.rl<30?'#00e5a0':'var(--text2)')+'">'+w.a.rl.toFixed(1)+'</td>'
        +'<td><button class="btn btn-red btn-xs" onclick="fsTgWl(\''+w.t+'\');fsRenderWlPage()" style="font-size:10px">✕</button></td>'
        +'</tr>';
    }).join('')+'</tbody></table></div>';
}

// ── AI Analysis ──
function fsRunAI(){
  var data=FS_G.data,a=FS_G.a,tk=FS_G.tk;
  if(!data) return;
  var last=a.last,prev=a.prev;
  var chg=((last.c-prev.c)/prev.c*100);
  var mode=document.getElementById('fs-ai-mode')&&document.getElementById('fs-ai-mode').value||'standard';
  var rec=data.slice(-20);
  var bvBuy=rec.filter(function(d){return d.sig==='ACC';}).reduce(function(s,d){return s+d.buyVol;},0);
  var bvSell=rec.filter(function(d){return d.sig==='DIST';}).reduce(function(s,d){return s+d.sellVol;},0);
  var net=bvBuy-bvSell;
  var ma20L=a.ma20[a.ma20.length-1],ma50L=a.ma50[a.ma50.length-1];
  var p20=ma20L?((last.c-ma20L)/ma20L*100):0;
  var p50=ma50L?((last.c-ma50L)/ma50L*100):0;
  var info=FS_UNIV.find(function(u){return u.t===tk;})||{n:tk,s:'IHSG'};
  var box=document.getElementById('fs-ai-box');
  var btn=document.getElementById('fs-ai-btn');
  btn.disabled=true;btn.textContent='Generating...';
  box.innerHTML='<div style="text-align:center;padding:14px"><i class="ti ti-loader" style="font-size:20px;color:var(--accent);animation:spin 1s linear infinite"></i><div style="font-size:12px;color:var(--text2);margin-top:8px">Menganalisa big money flow...</div></div>';

  // Add spin animation
  if(!document.getElementById('fs-spin-style')){
    var st=document.createElement('style');st.id='fs-spin-style';
    st.textContent='@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}';
    document.head.appendChild(st);
  }

  setTimeout(function(){
    var s1,s2,s3,s4,s5;
    // reuse logic from index.html adapted
    if(a.sig==='AKUMULASI'){
      s1='Saham <strong>'+tk+'</strong> ('+info.s+') menunjukkan pola <strong style="color:#00e5a0">akumulasi institusional</strong> yang '+(a.sc>=70?'sangat kuat':'cukup signifikan')+' dengan skor '+a.sc+'/100. Dalam 20 hari terakhir, tercatat <strong>'+a.bu+' hari big volume pada hari harga naik</strong> vs '+a.bd+' hari big volume turun. CMF-20 di <strong style="color:#00e5a0">+'+(a.cl*100).toFixed(1)+'%</strong> mengkonfirmasi aliran uang besar masuk secara konsisten.';
      s4='<strong>Skenario Bullish</strong>: CMF tetap positif + volume beli dominan — target resistance sekitar <strong>'+fsP(last.h*1.03)+'</strong>.<br><br><strong>Skenario Bearish</strong>: Jika CMF berbalik negatif di bawah -10%, waspadai exit institusi. Break MA20 ke bawah adalah sinyal peringatan.';
    } else if(a.sig==='DISTRIBUSI'){
      s1='Analisa volume flow <strong>'+tk+'</strong> ('+info.s+') mengungkap <strong style="color:#ff3d5a">distribusi institusional</strong>. Tercatat <strong>'+a.bd+' hari big volume pada hari harga turun</strong> vs '+a.bu+' hari naik. CMF-20 di <strong style="color:#ff3d5a">'+(a.cl*100).toFixed(1)+'%</strong> mengkonfirmasi aliran uang keluar.';
      s4='<strong>Skenario Bearish</strong>: Distribusi dapat mendorong harga ke support MA50 '+fsP(ma50L||last.c*.92)+'.<br><br><strong>Skenario Reversal</strong>: Big volume bullish + CMF berbalik positif bisa tanda akumulasi baru dimulai.';
    } else {
      s1='Saham <strong>'+tk+'</strong> ('+info.s+') berada dalam <strong>fase konsolidasi netral</strong> (skor '+a.sc+'/100). Big volume hampir seimbang: '+a.bu+' hari naik vs '+a.bd+' hari turun. CMF '+(a.cl*100).toFixed(1)+'% belum memberikan sinyal arah yang jelas.';
      s4='<strong>Skenario Breakout</strong>: Big volume >2× + harga tembus resistance + CMF >+10% → sinyal akumulasi.<br><br><strong>Skenario Breakdown</strong>: Big vol hari turun + CMF <-10% → distribusi tahap awal.';
    }
    s2='Net volume beli institusional 20 hari: <span style="color:'+(net>=0?'#00e5a0':'#ff3d5a')+'">'+(net>=0?'+':'')+fsV(Math.abs(net))+(net>=0?' (net beli)':' (net jual)')+'</span>. '+(a.obvT?'OBV naik — tekanan beli dominan.':'OBV turun — tekanan jual masih dominan.')+' '+(a.adT?'A/D Line naik — uang kumulatif masuk.':'A/D Line turun — distribusi berlangsung.');
    s3='Harga '+fsP(last.c)+' berada <strong style="color:'+(p20>0?'#00e5a0':'#ff3d5a')+'">'+Math.abs(p20).toFixed(1)+'% '+(p20>0?'di atas':'di bawah')+'</strong> MA20 ('+fsP(ma20L)+') dan <strong style="color:'+(p50>0?'#00e5a0':'#ff3d5a')+'">'+Math.abs(p50).toFixed(1)+'% '+(p50>0?'di atas':'di bawah')+'</strong> MA50 ('+fsP(ma50L)+'). RSI-14: '+(a.rl>70?'<span style="color:#ff3d5a">overbought ('+a.rl.toFixed(1)+')</span>':a.rl<30?'<span style="color:#00e5a0">oversold ('+a.rl.toFixed(1)+')</span>':'<span>'+a.rl.toFixed(1)+'</span>')+'.';
    if(mode==='trade') s5=(a.sig==='AKUMULASI'?'Entry ideal: pullback ke MA20 '+fsP(ma20L||last.c*.97)+'. Stop loss di bawah MA50. R/R minimal 1:2. Target: '+fsP(last.h*1.03)+'.':a.sig==='DISTRIBUSI'?'Sudah holding: pertimbangkan reduce position. Belum masuk: <strong>hindari entry</strong> — tunggu reversal berupa big vol bullish + CMF positif 3 hari.':'<strong>Wait and see.</strong> Set alert di '+fsP(last.h*1.02)+' (buy) dan '+fsP(ma20L||last.c*.96)+' (stop).');
    else if(mode==='deep') s5=(a.sig==='AKUMULASI'?'Pola stealth accumulation terdeteksi — institusi mengisi posisi diam-diam. Investor retail yang masuk sekarang berpotensi ikut tren institusional sejak awal.':a.sig==='DISTRIBUSI'?'Distribusi bertahap bisa berlangsung mingguan. Retail sering terjebak beli saat institusi justru jual.':'Institusi belum menunjukkan posisi jelas. Bisa berarti base building sebelum rally.');
    else s5=(a.sig==='AKUMULASI'?'Saham ini layak dipantau. Konfirmasi dengan fundamental sebelum masuk. Pantau CMF dan big vol sebagai konfirmasi.':a.sig==='DISTRIBUSI'?'Ekstra hati-hati. Tunggu reversal volume yang jelas sebelum entry.':'Bersabar. Gunakan capital untuk saham dengan sinyal lebih jelas.');

    var html='<div style="display:flex;align-items:center;gap:9px;margin-bottom:13px;padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,.05)">';
    html+=fsMkBdg(a.sig);
    html+='<span style="font-size:11px;color:var(--text2)">Skor: <span class="mono" style="color:'+fsScColor(a.sc)+'">'+a.sc+'/100</span></span>';
    html+='<span style="font-size:11px;color:var(--text2)">CMF: <span class="mono" style="color:'+(a.cl>0?'#00e5a0':'#ff3d5a')+'">'+(a.cl*100).toFixed(1)+'%</span></span>';
    html+='</div>';
    var sections=[
      {t:'01 — Ringkasan Sinyal',ic:'ti-radar',b:s1},
      {t:'02 — Volume Institusional',ic:'ti-chart-bar',b:s2},
      {t:'03 — Level Teknikal',ic:'ti-chart-line',b:s3},
      {t:'04 — Skenario',ic:'ti-arrows-split-2',b:s4},
      {t:'05 — Strategi',ic:'ti-user-check',b:s5}
    ];
    sections.forEach(function(sec){
      html+='<div style="margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid rgba(255,255,255,.04)">';
      html+='<div style="font-size:11px;font-weight:600;color:var(--accent);text-transform:uppercase;letter-spacing:.8px;margin-bottom:7px"><i class="ti '+sec.ic+'"></i> '+sec.t+'</div>';
      html+='<div style="font-size:13px;color:#c8d8ea;line-height:1.85">'+sec.b+'</div></div>';
    });
    html+='<div style="font-size:11px;color:var(--text3);padding:9px 12px;background:var(--bg);border-radius:6px;border-left:2px solid var(--border2);margin-top:4px;line-height:1.6"><i class="ti ti-alert-circle" style="font-size:11px;vertical-align:-1px;margin-right:4px"></i>Analisa otomatis berbasis indikator teknikal. Bukan rekomendasi investasi. Selalu lakukan riset mandiri.</div>';
    box.innerHTML=html;
    btn.disabled=false;btn.textContent='Generate ↗';
  },900);
}

// ── quick add chips ──
function fsBuildQaChips(){
  var chips=['BBCA','BBRI','BMRI','ADRO','PGEO','ARCI','TLKM','ANTM','CDIA','SMDR'];
  var el=document.getElementById('wl-qa-chips');
  if(el) el.innerHTML=chips.map(function(t){
    return '<span class="wl-chip" onclick="fsTgWl(\''+t+'\');fsRenderWlPage()">'+t+'</span>';
  }).join('');
}

// ── init FlowScan ──
function setCashDisp(account){
  var input = el('cash-'+account+'-input');
  var disp = el('cash-'+account+'-disp');
  if(!input||!disp) return;
  var val = parseFloat(input.value)||0;
  var isUsd = CASH_ACCOUNTS[account] && CASH_ACCOUNTS[account].isUsd;
  disp.textContent = (isUsd?'$':'Rp ')+fmt(val);
}
function saveCashInput(account){
  var input = el('cash-'+account+'-input');
  if(!input) return;
  var val = parseFloat(input.value)||0;
  if(account==='saham'){
    // Saldo RDN bersumber dari mutasi — tambah entri penyesuaian
    var current = calcRdnBalance();
    var diff = val - current;
    if(Math.abs(diff) > 0){
      addRdn(today(),'SETOR', diff>=0?'Penyesuaian saldo masuk':'Penyesuaian saldo keluar', diff, activeSekuritas, null);
      saveData();
    }
    renderCashWidgets();
    updateTopbar();
    showSaveStatus('✓ Saldo RDN disesuaikan ke Rp '+fmtK(val));
    return;
  }
  CASH_ACCOUNTS[account].balance = val;
  saveCashAccounts();
  var disp = el('cash-'+account+'-disp');
  var isUsd = CASH_ACCOUNTS[account].isUsd;
  if(disp) disp.textContent = (isUsd?'$':'Rp ')+fmt(val);
  showSaveStatus('✓ Kas '+account+' disimpan');
}
function renderCashWidgets(){
  // Kas Saham (RDN) selalu sinkron dengan saldo RDN dari mutasi transaksi
  CASH_ACCOUNTS.saham.balance = calcRdnBalance();
  Object.keys(CASH_ACCOUNTS).forEach(function(k){
    var disp = el('cash-'+k+'-disp');
    var input = el('cash-'+k+'-input');
    var ca = CASH_ACCOUNTS[k];
    if(disp){ var isUsd=ca.isUsd; disp.textContent=(isUsd?'$':'Rp ')+fmt(ca.balance); }
    if(input){ input.value=Math.round(ca.balance); }
  });
}

function toggleDD(id, btn){
  var dropdown = document.getElementById(id);
  var menu = dropdown.querySelector('.nav-dd-menu');
  var isOpen = menu.classList.contains('open');
  // Close all first
  document.querySelectorAll('.nav-dd-menu').forEach(function(m){ m.classList.remove('open'); });
  document.querySelectorAll('.nav-dd-btn').forEach(function(b){ b.classList.remove('on'); });
  if(!isOpen){
    // Position using fixed coords from button bounding rect
    var rect = btn.getBoundingClientRect();
    menu.style.top = (rect.bottom + 4) + 'px';
    menu.style.left = rect.left + 'px';
    menu.classList.add('open');
    btn.classList.add('on');
  }
}
function closeDD(){
  document.querySelectorAll('.nav-dd-menu').forEach(function(m){ m.classList.remove('open'); });
  document.querySelectorAll('.nav-dd-btn').forEach(function(b){ b.classList.remove('on'); });
}
document.addEventListener('click', function(e){
  if(!e.target.closest('.nav-dropdown')) closeDD();
});

function fsInit(){
  // Re-dedup FS_UNIV (may have received duplicates from dynamic portfolio push)
  (function(){ var seen={}; FS_UNIV=FS_UNIV.filter(function(u){ if(seen[u.t]) return false; seen[u.t]=true; return true; }); })();
  FS_RD=FS_UNIV.map(function(u){
    var data=fsGenData(u.t,60);
    var a=fsProcess(data);
    return Object.assign({},u,{data:data,a:a});
  });
  XLSX_DATA.stocks.slice(0,6).forEach(function(s){
    var info=FS_UNIV.find(function(u){return u.t===s.code;})||{t:s.code,n:s.code,s:s.sector||'IHSG',cap:0};
    var data=fsGenData(s.code,60);var a=fsProcess(data);
    FS_WL.push(Object.assign({},info,{data:data,a:a}));
  });
  fsBuildQaChips();
}

