// ╔══════════════════════════════════════════════════════════╗
// ║  WEALTH MODULE — Personal Family Office                  ║
// ║  Diadaptasi dari Wealth OS, terintegrasi Money Watch     ║
// ║  Net Worth · Bank & Dana Darurat · Hutang · Piutang ·    ║
// ║  FIRE & Proyeksi · Wealth Score                          ║
// ╚══════════════════════════════════════════════════════════╝

// ── STATE ──
var WEALTH_KEY = 'mw_wealth_v1';
var WEALTH = {
  income: 0,      // pemasukan / bln (Rp)
  expense: 0,     // pengeluaran / bln (Rp) — dasar dana darurat & FIRE
  deposito: 0, emas: 0, obligasi: 0,
  bank: [],       // {id,bank,no,saldo,type}
  debt: [],       // {id,nama,tipe,bunga,outstanding,cicilan}
  piutang: []     // {id,nama,keperluan,pokok,terbayar,jatuhTempo,status}
};
var wCharts = {};
var WPAGES = ['wealth','wbank','wdebt','wpiutang','wfire'];

function wSave(){
  try{ localStorage.setItem(WEALTH_KEY, JSON.stringify(WEALTH)); }catch(e){}
}
function wLoad(){
  try{
    var r = localStorage.getItem(WEALTH_KEY);
    if(r){ var d = JSON.parse(r); if(d && typeof d==='object') Object.keys(WEALTH).forEach(function(k){ if(d[k]!==undefined) WEALTH[k]=d[k]; }); }
  }catch(e){}
}
function wUid(){ return Date.now() + Math.floor(Math.random()*1000); }

// ── FORMAT ──
function wRp(n){
  var a = Math.abs(n||0), s = n<0 ? '-' : '';
  if(a>=1e12) return s+'Rp '+(a/1e12).toFixed(2)+' T';
  if(a>=1e9)  return s+'Rp '+(a/1e9).toFixed(2)+' M';
  if(a>=1e6)  return s+'Rp '+(a/1e6).toFixed(1)+' jt';
  return s+'Rp '+Math.round(a).toLocaleString('id-ID');
}
function wPct(num, den){ return den>0 ? (num/den*100) : 0; }
function wNum(id){ var e2=el(id); return e2 ? (parseFloat(e2.value)||0) : 0; }
function wVal(id){ var e2=el(id); return e2 ? e2.value.trim() : ''; }

// ── KALKULASI TERPADU — gabungkan data Wealth + portofolio Money Watch ──
function wCalc(){
  var inv = {saham:0, crypto:0, etf:0, rd:0, kas:0};
  try{
    if(typeof getPortfolio==='function')       inv.saham  = getPortfolio().reduce(function(a,p){return a+p.mv},0);
    if(typeof getCryptoPortfolio==='function') inv.crypto = getCryptoPortfolio().reduce(function(a,p){return a+p.mv},0);
    if(typeof getEtfPortfolio==='function')    inv.etf    = getEtfPortfolio().reduce(function(a,p){return a+(p.mvIdr||0)},0);
    if(typeof getRdPortfolio==='function')     inv.rd     = getRdPortfolio().reduce(function(a,p){return a+p.mv},0);
    // FIX AUDIT F5: sebelumnya RDN negatif dibulatkan ke 0 (Math.max(0,...)) —
    // liabilitas kas riil hilang dari Net Worth. Sekarang nilai mentah (boleh
    // negatif) ikut menekan Net Worth, bukan disembunyikan. Donut alokasi di
    // bawah sudah aman karena baris .filter(v>0) otomatis menyisihkan nilai
    // negatif dari chart tanpa perlu variabel terpisah.
    var rdn = (typeof calcRdnBalance==='function') ? calcRdnBalance() : 0;
    var kasLain = 0;
    if(typeof CASH_ACCOUNTS!=='undefined'){
      var kurs = (typeof usdIdr!=='undefined' && usdIdr>0) ? usdIdr : 16200;
      Object.keys(CASH_ACCOUNTS).forEach(function(k){
        if(k==='saham') return; // kas saham = RDN, sudah dihitung
        var c = CASH_ACCOUNTS[k];
        kasLain += (c.balance||0) * (c.isUsd ? kurs : 1);
      });
    }
    inv.kas = rdn + kasLain;
  }catch(e){ console.warn('wCalc invest:', e); }
  var invTotal = inv.saham + inv.crypto + inv.etf + inv.rd + inv.kas;

  var bankTotal = WEALTH.bank.reduce(function(s,x){return s+(x.saldo||0)},0);
  var piu = WEALTH.piutang.reduce(function(a,x){
    if(x.status!=='Lunas') a.sisa += Math.max(0,(x.pokok||0)-(x.terbayar||0));
    a.pokok += (x.pokok||0); a.terbayar += (x.terbayar||0); return a;
  },{sisa:0,pokok:0,terbayar:0});
  var debt = WEALTH.debt.reduce(function(a,x){ a.t+=(x.outstanding||0); a.c+=(x.cicilan||0); return a; },{t:0,c:0});

  // Passive income: dividen riil 12 bln terakhir (dari jurnal Money Watch) + bunga instrumen
  var div12 = 0;
  try{
    if(typeof dividends!=='undefined'){
      var cut = new Date(); cut.setFullYear(cut.getFullYear()-1);
      var cutS = cut.toISOString().slice(0,10);
      div12 = dividends.filter(function(d){return d.date>=cutS}).reduce(function(s,d){return s+(d.net||0)},0);
    }
  }catch(e){}
  var passive = div12 + WEALTH.deposito*0.055 + WEALTH.obligasi*0.065; // per tahun

  var aset = invTotal + bankTotal + WEALTH.deposito + WEALTH.emas + WEALTH.obligasi + piu.sisa;
  var net  = aset - debt.t;
  var emMonths = WEALTH.expense>0 ? bankTotal/WEALTH.expense : 0;
  var score = wScoreCalc({aset:aset, net:net, debt:debt, emMonths:emMonths, passive:passive, inv:inv});
  return {inv:inv, invTotal:invTotal, bankTotal:bankTotal, piu:piu, debt:debt,
          div12:div12, passive:passive, aset:aset, net:net, emMonths:emMonths, score:score};
}

// ── WEALTH SCORE 0–100 (adaptasi Wealth OS) ──
function wScoreCalc(a){
  if(a.aset<=0) return 0;
  var sc = 0;
  var dr = a.debt.t / a.aset;
  sc += dr<0.2 ? 25 : dr<0.4 ? 15 : 5;                                  // rasio hutang
  sc += a.emMonths>=6 ? 20 : a.emMonths>=3 ? 12 : 4;                    // dana darurat
  sc += ((a.inv.saham>0?1:0)+(a.inv.crypto>0?1:0)+(a.inv.etf>0?1:0)+(a.inv.rd>0?1:0))*5; // diversifikasi
  var pc = WEALTH.expense>0 ? (a.passive/12)/WEALTH.expense : 0;
  sc += pc>=0.5 ? 20 : pc>=0.3 ? 12 : 5;                                // passive coverage
  sc += a.net>1e9 ? 15 : a.net>5e8 ? 10 : 5;                            // net worth tier
  return Math.min(100, sc);
}

// ══════════════════════════════════════════════
// ROUTER HOOK — pola sama dengan modul QuantTrader
// ══════════════════════════════════════════════
var _wOrigGoPage = window.goPage;
window.goPage = function(page, btn){
  if(_wOrigGoPage) _wOrigGoPage.call(this, page, btn);
  if(WPAGES.indexOf(page) > -1){
    var pg = el('page-'+page);
    if(pg && pg.classList.contains('on')) wRenderPage(page);
  }
};

function wRenderPage(name){
  switch(name){
    case 'wealth':   wRenderNet(); break;
    case 'wbank':    wRenderBank(); break;
    case 'wdebt':    wRenderDebt(); break;
    case 'wpiutang': wRenderPiutang(); break;
    case 'wfire':    wRenderFire(); break;
  }
}
function wKillChart(id){ if(wCharts[id]){ try{wCharts[id].destroy();}catch(e){} delete wCharts[id]; } }

// ══════════════════════════════════════════════
// PAGE 1 — NET WORTH DASHBOARD
// ══════════════════════════════════════════════
function wRenderNet(){
  var a = wCalc();
  var dr = wPct(a.debt.t, a.aset);
  var grade = a.score>=75 ? 'Excellent' : a.score>=55 ? 'Good' : 'Fair';
  var gradeCls = a.score>=75 ? 'b-up' : a.score>=55 ? 'b-gray' : 'b-dn';
  var fireTarget = WEALTH.expense*12*25;
  var firePct = fireTarget>0 ? Math.min(100, a.net/fireTarget*100) : 0;
  var ring = 2*Math.PI*34;

  el('page-wealth').innerHTML =
  '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">'+
    '<div><div class="ptitle">💼 Net Worth — Personal Family Office</div><div class="psub">Kekayaan bersih gabungan: portofolio Money Watch + aset pribadi</div></div>'+
    '<div style="display:flex;gap:6px;flex-wrap:wrap">'+
      '<button class="btn btn-ghost btn-sm" onclick="wExport()">⬇ Export</button>'+
      '<button class="btn btn-ghost btn-sm" onclick="wImport()">⬆ Import</button>'+
      '<button class="btn btn-blue btn-sm" onclick="wModalSettings()">⚙ Asumsi & Aset Lain</button>'+
    '</div>'+
  '</div>'+
  '<div class="w-hero">'+
    '<div class="w-hero-label">Total Net Worth</div>'+
    '<div class="w-hero-value">'+wRp(a.net)+'</div>'+
    '<div class="w-hero-sub">Aset '+wRp(a.aset)+' &nbsp;·&nbsp; Hutang <span class="dn">'+wRp(a.debt.t)+'</span> ('+dr.toFixed(1)+'%)</div>'+
  '</div>'+
  '<div class="row4">'+
    '<div class="metric"><div class="mlabel">Portofolio Investasi</div><div class="mval">'+wRp(a.invTotal)+'</div><div class="msub neu">saham + crypto + ETF + RD + kas</div></div>'+
    '<div class="metric"><div class="mlabel">Kas & Bank</div><div class="mval">'+wRp(a.bankTotal)+'</div><div class="msub '+(a.emMonths>=6?'up':a.emMonths>=3?'amb':'dn')+'">Dana darurat '+a.emMonths.toFixed(1)+' bln '+(a.emMonths>=6?'✓':'⚠')+'</div></div>'+
    '<div class="metric"><div class="mlabel">Passive Income</div><div class="mval up">'+wRp(a.passive/12)+'<span style="font-size:11px;color:var(--text3)">/bln</span></div><div class="msub neu">dividen 12 bln: '+wRp(a.div12)+'</div></div>'+
    '<div class="metric" style="display:flex;align-items:center;gap:12px">'+
      '<div class="w-ring"><svg width="84" height="84" style="transform:rotate(-90deg)">'+
        '<circle cx="42" cy="42" r="34" fill="none" stroke="var(--bg4)" stroke-width="7"/>'+
        '<circle cx="42" cy="42" r="34" fill="none" stroke="var(--accent)" stroke-width="7" stroke-linecap="round" stroke-dasharray="'+ring+'" stroke-dashoffset="'+(ring*(1-a.score/100))+'"/>'+
      '</svg><div class="w-ring-center"><div style="font-size:19px;font-weight:700;font-family:\'Share Tech Mono\',monospace">'+a.score+'</div><div style="font-size:9px;color:var(--text3)">score</div></div></div>'+
      '<div><div class="mlabel">Wealth Score</div><span class="badge '+gradeCls+'">'+grade+'</span>'+
      '<div class="msub neu" style="margin-top:6px">FIRE '+firePct.toFixed(1)+'%</div></div>'+
    '</div>'+
  '</div>'+
  '<div class="g2c">'+
    '<div class="card"><div class="cheader"><span class="ctitle">ALOKASI ASET</span><button class="btn btn-ghost btn-xs" onclick="goPage(\'portofolio\')">Detail →</button></div>'+
      '<div style="display:flex;align-items:center;gap:18px">'+
        '<div style="position:relative;width:150px;height:150px;flex-shrink:0"><canvas id="w-alloc-chart"></canvas></div>'+
        '<div style="flex:1" id="w-alloc-legend"></div>'+
      '</div>'+
    '</div>'+
    '<div class="card"><div class="cheader"><span class="ctitle">PASSIVE INCOME ENGINE</span></div>'+
      '<div class="w-mini"><span style="color:var(--text3)">Dividen saham (riil, 12 bln jurnal)</span><b class="up">'+wRp(a.div12/12)+'/bln</b></div>'+
      '<div class="w-mini"><span style="color:var(--text3)">Deposito · asumsi 5.5% p.a.</span><b class="up">'+wRp(WEALTH.deposito*0.055/12)+'/bln</b></div>'+
      '<div class="w-mini"><span style="color:var(--text3)">Obligasi · asumsi 6.5% p.a.</span><b class="up">'+wRp(WEALTH.obligasi*0.065/12)+'/bln</b></div>'+
      '<div class="w-mini" style="border-top:1px solid var(--border2);margin-top:4px;padding-top:9px"><b>Total</b><b class="up" style="font-size:14px">'+wRp(a.passive/12)+'/bln</b></div>'+
      '<div style="margin-top:10px;font-size:11px;color:var(--text3)">Coverage pengeluaran: <b class="'+(WEALTH.expense>0&&a.passive/12>=WEALTH.expense*0.5?'up':'amb')+'">'+(WEALTH.expense>0?(a.passive/12/WEALTH.expense*100).toFixed(1):'—')+'%</b> dari '+wRp(WEALTH.expense)+'/bln</div>'+
    '</div>'+
  '</div>'+
  '<div class="g2c">'+
    '<div class="card"><div class="cheader"><span class="ctitle">CRITICAL INSIGHTS</span></div>'+wInsights(a)+'</div>'+
    '<div class="card"><div class="cheader"><span class="ctitle">🔬 ANALISA PRA-BELI (QUANT TOOLKIT)</span></div>'+
      '<div style="font-size:11px;color:var(--text3);margin-bottom:10px;line-height:1.6">Checklist ala quant trader sebelum membeli saham — jalankan berurutan:</div>'+
      [['hargawajar','💎 1. Harga Wajar','Valuasi & Margin of Safety'],
       ['flowscan','🔬 2. FlowScan','Aliran dana besar, CMF, RSI, VWAP'],
       ['candle','🕯 3. Candle Analysis','Pola candlestick & timing entry'],
       ['backtester','⚡ 4. Backtester','Uji strategi pada data historis'],
       ['screener','🔍 5. Screener LQ45','Bandingkan dengan alternatif'],
       ['risiko','⚠️ 6. Manajemen Risiko','Position sizing & risk per trade']]
      .map(function(t){ return '<div class="w-mini" style="cursor:pointer" onclick="goPage(\''+t[0]+'\')"><span><b>'+t[1]+'</b> <span style="color:var(--text3)">— '+t[2]+'</span></span><span style="color:var(--accent)">→</span></div>'; }).join('')+
    '</div>'+
  '</div>';

  // Donut alokasi
  wKillChart('alloc');
  var items = [
    {l:'Saham IDX', v:a.inv.saham,  c:'#818cf8'},
    {l:'Crypto',    v:a.inv.crypto, c:'#f7931a'},
    {l:'ETF AS',    v:a.inv.etf,    c:'#38bdf8'},
    {l:'Reksa Dana',v:a.inv.rd,     c:'#c084fc'},
    {l:'Kas RDN/Wallet', v:a.inv.kas, c:'#34d399'},
    {l:'Bank',      v:a.bankTotal,  c:'#fbbf24'},
    {l:'Deposito/Obligasi/Emas', v:WEALTH.deposito+WEALTH.obligasi+WEALTH.emas, c:'#94a3b8'},
    {l:'Piutang',   v:a.piu.sisa,   c:'#fb7185'}
  ].filter(function(x){return x.v>0});
  el('w-alloc-legend').innerHTML = items.map(function(x){
    return '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;font-size:11px">'+
      '<span style="display:flex;align-items:center;gap:6px"><span style="width:8px;height:8px;border-radius:2px;background:'+x.c+';display:inline-block"></span>'+x.l+'</span>'+
      '<b>'+wPct(x.v,a.aset).toFixed(1)+'%</b></div>';
  }).join('') || '<div style="font-size:11px;color:var(--text3)">Belum ada data aset</div>';
  var cv = el('w-alloc-chart');
  if(cv && items.length && typeof Chart!=='undefined'){
    wCharts['alloc'] = new Chart(cv.getContext('2d'), {type:'doughnut',
      data:{labels:items.map(function(x){return x.l}), datasets:[{data:items.map(function(x){return x.v}), backgroundColor:items.map(function(x){return x.c}), borderColor:'rgba(19,19,31,.9)', borderWidth:2}]},
      options:{responsive:true,maintainAspectRatio:false,cutout:'68%',plugins:{legend:{display:false},tooltip:{callbacks:{label:function(c){return c.label+': '+wRp(c.raw)}}}}}
    });
  }
}

function wInsights(a){
  var ins = [];
  var cc = WEALTH.debt.filter(function(x){return x.bunga>20}).sort(function(x,y){return y.bunga-x.bunga})[0];
  if(cc) ins.push({ic:'🔥', bg:'rgba(248,113,113,.12)', title:'Hutang bunga tinggi '+cc.bunga+'% p.a.', desc:cc.nama+': '+wRp(cc.outstanding)+'. Lunasi paling dulu (avalanche) untuk hemat bunga terbesar.', badge:'Prioritas 1', cls:'b-dn'});
  WEALTH.piutang.filter(function(x){return x.status==='Telat'||x.status==='Macet'}).slice(0,2).forEach(function(x){
    ins.push({ic:'⏰', bg:'rgba(251,191,36,.12)', title:'Piutang '+x.status.toLowerCase()+': '+x.nama, desc:'Sisa '+wRp((x.pokok||0)-(x.terbayar||0))+(x.jatuhTempo?' · jatuh tempo '+new Date(x.jatuhTempo).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'}):''), badge:'Tindak lanjut', cls:'b-dn'});
  });
  if(WEALTH.expense>0 && a.emMonths<3) ins.push({ic:'🛡', bg:'rgba(251,191,36,.12)', title:'Dana darurat kritis', desc:'Hanya '+a.emMonths.toFixed(1)+' bulan pengeluaran. Target minimal 3 bulan ('+wRp(WEALTH.expense*3)+').', badge:'Urgent', cls:'b-dn'});
  // FIX AUDIT F5: tampilkan RDN minus sebagai liabilitas, jangan disembunyikan
  if(a.inv && a.inv.kas<0) ins.push({ic:'💳', bg:'rgba(248,113,113,.12)', title:'Saldo RDN minus '+wRp(Math.abs(a.inv.kas)), desc:'Anda membeli saham melebihi kas yang tercatat. Nilai ini sudah dikurangkan dari Net Worth sebagai liabilitas — segera setor dana untuk menutupinya.', badge:'Liabilitas', cls:'b-dn'});
  try{
    if(typeof getPortfolio==='function'){
      var losers = getPortfolio().filter(function(p){return p.ret<=-25}).sort(function(x,y){return x.ret-y.ret}).slice(0,2);
      losers.forEach(function(p){
        ins.push({ic:'📉', bg:'rgba(248,113,113,.12)', title:p.ticker+' rugi '+Math.abs(p.ret).toFixed(0)+'%', desc:'Floating loss '+wRp(p.unreal)+'. Evaluasi via Harga Wajar & FlowScan: hold, average down, atau cut loss.', badge:'Review', cls:'b-gray'});
      });
    }
  }catch(e){}
  if(WEALTH.expense===0 && WEALTH.income===0) ins.push({ic:'⚙️', bg:'rgba(129,140,248,.12)', title:'Lengkapi asumsi keuangan', desc:'Isi pemasukan & pengeluaran bulanan di "Asumsi & Aset Lain" agar dana darurat, FIRE, dan Wealth Score akurat.', badge:'Setup', cls:'b-gray'});
  if(!ins.length) ins.push({ic:'✅', bg:'rgba(52,211,153,.12)', title:'Kondisi keuangan sehat', desc:'Tidak ada masalah kritis terdeteksi. Pantau berkala & disiplin pada rencana.', badge:'Baik', cls:'b-up'});
  return ins.slice(0,4).map(function(x){
    return '<div class="w-insight"><div class="w-insight-ic" style="background:'+x.bg+'">'+x.ic+'</div>'+
      '<div style="flex:1"><div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;margin-bottom:3px">'+
      '<b style="font-size:12px">'+x.title+'</b><span class="badge '+x.cls+'">'+x.badge+'</span></div>'+
      '<div style="font-size:11px;color:var(--text2);line-height:1.55">'+x.desc+'</div></div></div>';
  }).join('');
}

// ══════════════════════════════════════════════
// PAGE 2 — BANK & DANA DARURAT
// ══════════════════════════════════════════════
function wRenderBank(){
  var a = wCalc();
  var t3 = WEALTH.expense*3, t6 = WEALTH.expense*6;
  var grads = ['linear-gradient(135deg,#1e1b4b,#312e81)','linear-gradient(135deg,#083344,#155e75)','linear-gradient(135deg,#14532d,#166534)','linear-gradient(135deg,#1a1a2e,#16213e)','linear-gradient(135deg,#4a044e,#701a75)'];
  var fillCls = a.emMonths>=6 ? 'green' : a.emMonths>=3 ? 'amber' : 'red';

  el('page-wbank').innerHTML =
  '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px">'+
    '<div><div class="ptitle">🏦 Bank & Dana Darurat</div><div class="psub">Rekening di luar RDN — RDN & kas trading dikelola di menu Keuangan</div></div>'+
    '<button class="btn btn-blue btn-sm" onclick="wModalBank()">＋ Tambah Rekening</button>'+
  '</div>'+
  '<div class="row4">'+
    '<div class="metric"><div class="mlabel">Total Saldo Bank</div><div class="mval">'+wRp(a.bankTotal)+'</div></div>'+
    '<div class="metric"><div class="mlabel">Dana Darurat</div><div class="mval '+(a.emMonths>=6?'up':a.emMonths>=3?'amb':'dn')+'">'+a.emMonths.toFixed(1)+' bln</div><div class="msub neu">'+(a.emMonths>=6?'✓ Ideal':'target 6 bln')+'</div></div>'+
    '<div class="metric"><div class="mlabel">Target 6 Bulan</div><div class="mval">'+wRp(t6)+'</div><div class="msub neu">'+wRp(WEALTH.expense)+'/bln × 6</div></div>'+
    '<div class="metric"><div class="mlabel">'+(a.bankTotal>=t6?'Surplus':'Kekurangan')+'</div><div class="mval '+(a.bankTotal>=t6?'up':'dn')+'">'+wRp(Math.abs(a.bankTotal-t6))+'</div></div>'+
  '</div>'+
  '<div class="g2c"><div>'+
    (WEALTH.bank.length ? WEALTH.bank.map(function(b,i){
      return '<div class="w-bank-card" style="background:'+grads[i%grads.length]+'">'+
        '<div style="display:flex;justify-content:space-between;align-items:flex-start">'+
          '<div><div style="font-size:10px;opacity:.65;margin-bottom:4px">Saldo Rekening</div><div style="font-size:21px;font-weight:700;font-family:\'Share Tech Mono\',monospace">'+wRp(b.saldo)+'</div></div>'+
          '<div style="text-align:right"><div style="font-size:11px;opacity:.75">'+(b.type||'Tabungan')+' · '+(b.no||'—')+'</div>'+
          '<div style="display:flex;gap:4px;margin-top:8px;justify-content:flex-end">'+
            '<button class="btn btn-xs" style="background:rgba(255,255,255,.15);border-color:rgba(255,255,255,.25);color:#fff" onclick="wModalBank('+b.id+')">✎</button>'+
            '<button class="btn btn-xs" style="background:rgba(255,255,255,.15);border-color:rgba(255,255,255,.25);color:#fff" onclick="wConfirmDelete(\'bank\','+b.id+',\''+(b.bank||'')+'\')">🗑</button>'+
          '</div></div>'+
        '</div>'+
        '<div style="font-size:11px;opacity:.7;margin-top:12px">Bank '+(b.bank||'—')+'</div>'+
      '</div>';
    }).join('') : '<div class="card" style="text-align:center;color:var(--text3);font-size:12px;padding:30px">Belum ada rekening. Klik <b>＋ Tambah Rekening</b>.</div>')+
  '</div>'+
  '<div class="card" style="align-self:start"><div class="cheader"><span class="ctitle">METER DANA DARURAT</span></div>'+
    '<div class="w-track" style="height:12px"><div class="w-fill '+fillCls+'" style="width:'+Math.min(100,wPct(a.bankTotal,t6)).toFixed(0)+'%"></div></div>'+
    '<div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text3);margin-top:5px"><span>0</span><span>3 bln — '+wRp(t3)+'</span><span>6 bln — '+wRp(t6)+'</span></div>'+
    '<div style="margin-top:14px;font-size:11px;color:var(--text2);line-height:1.9">'+
      '<div>• Standar: <b>6 bulan</b> pengeluaran (single income), <b>3 bulan</b> (dual income)</div>'+
      '<div>• Pisahkan rekening dana darurat dari rekening operasional & RDN</div>'+
      (WEALTH.expense<=0 ? '<div class="amb" style="margin-top:6px">⚠ Isi pengeluaran bulanan di menu Net Worth → Asumsi & Aset Lain</div>'
        : a.emMonths<6 ? '<div class="amb" style="margin-top:6px">⚠ Perlu tambah <b>'+wRp(t6-a.bankTotal)+'</b> untuk mencapai 6 bulan</div>'
        : '<div class="up" style="margin-top:6px">✓ Dana darurat memadai — surplus bisa dialokasikan ke investasi</div>')+
    '</div>'+
  '</div></div>';
}

// ══════════════════════════════════════════════
// PAGE 3 — HUTANG (avalanche & snowball)
// ══════════════════════════════════════════════
function wRenderDebt(){
  var a = wCalc();
  var dti = WEALTH.income>0 ? wPct(a.debt.c, WEALTH.income) : 0;
  var byRate = WEALTH.debt.slice().sort(function(x,y){return (y.bunga||0)-(x.bunga||0)});
  var bySize = WEALTH.debt.slice().sort(function(x,y){return (x.outstanding||0)-(y.outstanding||0)});

  el('page-wdebt').innerHTML =
  '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px">'+
    '<div><div class="ptitle">💳 Hutang & Kewajiban</div><div class="psub">Strategi pelunasan avalanche (hemat bunga) vs snowball (motivasi)</div></div>'+
    '<button class="btn btn-blue btn-sm" onclick="wModalDebt()">＋ Tambah Hutang</button>'+
  '</div>'+
  '<div class="row4">'+
    '<div class="metric"><div class="mlabel">Total Hutang</div><div class="mval dn">'+wRp(a.debt.t)+'</div></div>'+
    '<div class="metric"><div class="mlabel">Debt Ratio</div><div class="mval '+(wPct(a.debt.t,a.aset)>40?'dn':'neu')+'">'+wPct(a.debt.t,a.aset).toFixed(1)+'%</div><div class="msub neu">dari total aset · target &lt;40%</div></div>'+
    '<div class="metric"><div class="mlabel">Debt-to-Income</div><div class="mval '+(dti>40?'dn':'up')+'">'+(WEALTH.income>0?dti.toFixed(1)+'%':'—')+'</div><div class="msub neu">'+(WEALTH.income>0?(dti>40?'⚠ di atas batas aman':'✓ aman (<40%)'):'isi pemasukan di Asumsi')+'</div></div>'+
    '<div class="metric"><div class="mlabel">Cicilan / bln</div><div class="mval">'+wRp(a.debt.c)+'</div></div>'+
  '</div>'+
  '<div class="card" style="margin-bottom:10px;padding:0;overflow:hidden">'+
    '<div style="overflow-x:auto"><table class="tbl"><thead><tr><th>Nama</th><th>Tipe</th><th>Outstanding</th><th>Bunga/thn</th><th>Cicilan/bln</th><th>Prioritas</th><th></th></tr></thead><tbody>'+
    (byRate.length ? byRate.map(function(x,i){
      return '<tr><td><b>'+x.nama+'</b></td>'+
      '<td><span class="badge '+(i===0?'b-dn':'b-gray')+'">'+(x.tipe||'—')+'</span></td>'+
      '<td><b>'+wRp(x.outstanding)+'</b></td>'+
      '<td class="dn"><b>'+(x.bunga||0)+'%</b></td>'+
      '<td>'+wRp(x.cicilan)+'</td>'+
      '<td><span class="badge '+(i===0?'b-dn':i===1?'b-gray':'b-up')+'">'+(i===0?'Lunasi dulu':'P'+(i+1))+'</span></td>'+
      '<td style="white-space:nowrap"><button class="btn btn-blue btn-xs" onclick="wModalDebtPay('+x.id+')" title="Catat pembayaran">💰 Bayar</button> <button class="btn btn-ghost btn-xs" onclick="wModalDebt('+x.id+')">✎</button> <button class="btn btn-red btn-xs" onclick="wConfirmDelete(\'debt\','+x.id+',\''+(x.nama||'')+'\')">🗑</button></td></tr>';
    }).join('') : '<tr><td colspan="7" style="text-align:center;color:var(--text3);padding:24px">Belum ada hutang tercatat 🎉</td></tr>')+
    '</tbody></table></div>'+
  '</div>'+
  '<div class="g2c">'+
    '<div class="card"><div class="cheader"><span class="ctitle">DEBT AVALANCHE</span><span class="badge b-up">Hemat bunga maksimal</span></div>'+
      (byRate.map(function(x,i){
        return '<div style="margin-bottom:11px"><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px"><span>'+(i+1)+'. '+x.nama+'</span><b class="dn">'+(x.bunga||0)+'%</b></div>'+
        '<div class="w-track" style="height:6px"><div class="w-fill amber" style="width:'+wPct(x.outstanding,a.debt.t).toFixed(0)+'%"></div></div></div>';
      }).join('') || '<div style="font-size:11px;color:var(--text3)">—</div>')+
      '<div style="font-size:10px;color:var(--text3);margin-top:6px">Urutkan pelunasan dari bunga tertinggi. Matematis paling hemat.</div>'+
    '</div>'+
    '<div class="card"><div class="cheader"><span class="ctitle">DEBT SNOWBALL</span><span class="badge b-gray">Motivasi tinggi</span></div>'+
      (bySize.map(function(x,i){
        return '<div style="margin-bottom:11px"><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px"><span>'+(i+1)+'. '+x.nama+'</span><b class="neu">'+wRp(x.outstanding)+'</b></div>'+
        '<div class="w-track" style="height:6px"><div class="w-fill" style="width:'+wPct(x.outstanding,a.debt.t).toFixed(0)+'%"></div></div></div>';
      }).join('') || '<div style="font-size:11px;color:var(--text3)">—</div>')+
      '<div style="font-size:10px;color:var(--text3);margin-top:6px">Lunasi dari nominal terkecil. Quick win menjaga konsistensi.</div>'+
    '</div>'+
  '</div>';
}

// ══════════════════════════════════════════════
// PAGE 4 — PIUTANG
// ══════════════════════════════════════════════
function wRenderPiutang(){
  var piu = WEALTH.piutang;
  var tP = piu.reduce(function(s,x){return s+(x.pokok||0)},0);
  var tT = piu.reduce(function(s,x){return s+(x.terbayar||0)},0);
  var colors = {'Lancar':['rgba(129,140,248,.15)','#818cf8'],'Lunas':['rgba(52,211,153,.15)','#34d399'],'Telat':['rgba(251,191,36,.15)','#fbbf24'],'Macet':['rgba(248,113,113,.15)','#f87171']};

  el('page-wpiutang').innerHTML =
  '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px">'+
    '<div><div class="ptitle">🧾 Piutang</div><div class="psub">Uang yang dipinjamkan ke pihak lain — pantau progres pembayarannya</div></div>'+
    '<button class="btn btn-blue btn-sm" onclick="wModalPiutang()">＋ Tambah Piutang</button>'+
  '</div>'+
  '<div class="row4">'+
    '<div class="metric"><div class="mlabel">Total Pokok</div><div class="mval">'+wRp(tP)+'</div></div>'+
    '<div class="metric"><div class="mlabel">Outstanding</div><div class="mval amb">'+wRp(tP-tT)+'</div></div>'+
    '<div class="metric"><div class="mlabel">Collection Rate</div><div class="mval up">'+wPct(tT,tP).toFixed(1)+'%</div></div>'+
    '<div class="metric"><div class="mlabel">Lunas</div><div class="mval">'+piu.filter(function(x){return x.status==='Lunas'}).length+'/'+piu.length+'</div><div class="msub neu">debitur</div></div>'+
  '</div>'+
  '<div class="card">'+
    (piu.length ? piu.map(function(x){
      var sisa = (x.pokok||0)-(x.terbayar||0);
      var pct = wPct(x.terbayar, x.pokok);
      var c = colors[x.status] || colors['Lancar'];
      var badgeCls = x.status==='Lunas' ? 'b-up' : (x.status==='Telat'||x.status==='Macet') ? 'b-dn' : 'b-gray';
      return '<div class="w-piu-row">'+
        '<div class="w-piu-av" style="background:'+c[0]+';color:'+c[1]+'">'+(x.nama||'?').charAt(0).toUpperCase()+'</div>'+
        '<div style="flex:1;min-width:0">'+
          '<div style="font-size:12px;font-weight:600">'+x.nama+'</div>'+
          '<div style="font-size:10px;color:var(--text3)">'+(x.keperluan||'—')+(x.jatuhTempo?' · jatuh tempo '+new Date(x.jatuhTempo).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'}):'')+'</div>'+
          '<div style="margin-top:5px"><div class="w-track" style="height:5px"><div class="w-fill '+(x.status==='Lunas'?'green':x.status==='Telat'||x.status==='Macet'?'red':'')+'" style="width:'+pct.toFixed(0)+'%"></div></div>'+
          '<div style="font-size:10px;color:var(--text3);margin-top:3px">'+pct.toFixed(0)+'% terbayar · '+wRp(x.terbayar)+' dari '+wRp(x.pokok)+'</div></div>'+
        '</div>'+
        '<div style="text-align:right;flex-shrink:0">'+
          '<div style="font-size:13px;font-weight:700;font-family:\'Share Tech Mono\',monospace">'+wRp(sisa)+'</div>'+
          '<div style="font-size:9px;color:var(--text3)">sisa</div>'+
          '<span class="badge '+badgeCls+'" style="margin-top:4px;display:inline-block">'+x.status+'</span>'+
          '<div style="display:flex;gap:4px;margin-top:6px;justify-content:flex-end">'+
            (x.status!=='Lunas' ? '<button class="btn btn-blue btn-xs" onclick="wModalPiutangPay('+x.id+')" title="Catat pembayaran diterima">💰 Terima</button>' : '')+
            '<button class="btn btn-ghost btn-xs" onclick="wModalPiutang('+x.id+')">✎</button>'+
            '<button class="btn btn-red btn-xs" onclick="wConfirmDelete(\'piutang\','+x.id+',\''+(x.nama||'')+'\')">🗑</button>'+
          '</div>'+
        '</div>'+
      '</div>';
    }).join('') : '<div style="text-align:center;color:var(--text3);font-size:12px;padding:30px">Belum ada piutang tercatat.</div>')+
  '</div>';
}

// ══════════════════════════════════════════════
// PAGE 5 — FIRE & PROYEKSI
// ══════════════════════════════════════════════
function wRenderFire(){
  var a = wCalc();
  var annualExp = WEALTH.expense*12;
  var target = annualExp*25;
  var pct = target>0 ? Math.min(100, a.net/target*100) : 0;

  el('page-wfire').innerHTML =
  '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px">'+
    '<div><div class="ptitle">🔥 FIRE & Proyeksi Kekayaan</div><div class="psub">Financial Independence, Retire Early — aturan 25× pengeluaran tahunan & 4% withdrawal</div></div>'+
    '<button class="btn btn-ghost btn-sm" onclick="wModalSettings()">⚙ Ubah Asumsi</button>'+
  '</div>'+
  '<div class="row4">'+
    '<div class="metric"><div class="mlabel">Net Worth</div><div class="mval">'+wRp(a.net)+'</div></div>'+
    '<div class="metric"><div class="mlabel">FIRE Number (25×)</div><div class="mval">'+(target>0?wRp(target):'—')+'</div><div class="msub neu">'+wRp(annualExp)+'/thn × 25</div></div>'+
    '<div class="metric"><div class="mlabel">Progress</div><div class="mval up">'+pct.toFixed(1)+'%</div></div>'+
    '<div class="metric"><div class="mlabel">4% Withdrawal</div><div class="mval">'+wRp(a.net*0.04/12)+'<span style="font-size:11px;color:var(--text3)">/bln</span></div><div class="msub '+(WEALTH.expense>0&&a.net*0.04/12>=WEALTH.expense?'up':'neu')+'">'+(WEALTH.expense>0&&a.net*0.04/12>=WEALTH.expense?'✓ sudah menutup pengeluaran':'vs pengeluaran '+wRp(WEALTH.expense)+'/bln')+'</div></div>'+
  '</div>'+
  '<div class="card" style="margin-bottom:10px">'+
    '<div class="cheader"><span class="ctitle">PROYEKSI 20 TAHUN</span>'+
      '<div style="display:flex;gap:16px;flex-wrap:wrap">'+
        '<div class="w-slider"><label>CAGR</label><input type="range" id="w-cagr" min="4" max="20" value="12" step="1" oninput="wProjRecalc()"><b id="w-cagr-v">12%</b></div>'+
        '<div class="w-slider"><label>Inflasi</label><input type="range" id="w-infl" min="2" max="8" value="4" step="1" oninput="wProjRecalc()"><b id="w-infl-v">4%</b></div>'+
        '<div class="w-slider"><label>Invest/bln</label><input type="range" id="w-inv" min="0" max="30" value="5" step="1" oninput="wProjRecalc()"><b id="w-inv-v">5jt</b></div>'+
      '</div>'+
    '</div>'+
    '<div class="row3" id="w-proj-cards"></div>'+
    '<div style="position:relative;height:260px"><canvas id="w-proj-chart"></canvas></div>'+
  '</div>'+
  '<div class="g2c">'+
    '<div class="card"><div class="cheader"><span class="ctitle">FIRE SCENARIOS</span></div>'+
      [{n:'Lean FIRE', t:annualExp*0.7*25, d:'Gaya hidup hemat (70% pengeluaran)'},
       {n:'Regular FIRE', t:target, d:'Gaya hidup saat ini'},
       {n:'Fat FIRE', t:target*2, d:'Gaya hidup premium (2×)'}].map(function(s){
        var sp = s.t>0 ? Math.min(100, a.net/s.t*100) : 0;
        return '<div style="margin-bottom:13px"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px">'+
          '<b>'+s.n+'</b><span class="'+(a.net>=s.t&&s.t>0?'up':'neu')+'">'+(s.t>0?(a.net>=s.t?'✓ Tercapai':wRp(s.t)):'—')+'</span></div>'+
          '<div style="font-size:10px;color:var(--text3);margin-bottom:4px">'+s.d+'</div>'+
          '<div class="w-track" style="height:7px"><div class="w-fill" style="width:'+sp.toFixed(0)+'%"></div></div></div>';
      }).join('')+
    '</div>'+
    '<div class="card"><div class="cheader"><span class="ctitle">ESTIMASI TAHUN FIRE</span></div><div id="w-fire-years"></div>'+
      '<div style="font-size:10px;color:var(--text3);margin-top:8px">Simulasi compound: net worth × (1+CAGR) + investasi bulanan × 12, hingga mencapai FIRE Number.</div>'+
    '</div>'+
  '</div>';
  wProjRecalc();
}

function wProjRecalc(){
  var a = wCalc();
  var cagr = wNum('w-cagr')/100, infl = wNum('w-infl')/100, inv = wNum('w-inv')*1e6;
  var elC = el('w-cagr-v'), elI = el('w-infl-v'), elV = el('w-inv-v');
  if(elC) elC.textContent = (cagr*100).toFixed(0)+'%';
  if(elI) elI.textContent = (infl*100).toFixed(0)+'%';
  if(elV) elV.textContent = (inv/1e6).toFixed(0)+'jt';

  var years = [], nominal = [], riil = [], y0 = new Date().getFullYear();
  var nw = a.net;
  for(var y=0; y<=20; y++){
    years.push(y0+y);
    nominal.push(Math.round(nw));
    riil.push(Math.round(nw/Math.pow(1+infl,y)));
    nw = nw*(1+cagr) + inv*12;
  }
  var target = WEALTH.expense*12*25;
  var cards = el('w-proj-cards');
  if(cards) cards.innerHTML =
    '<div class="metric"><div class="mlabel">5 Tahun ('+(y0+5)+')</div><div class="mval">'+wRp(nominal[5])+'</div><div class="msub neu">riil: '+wRp(riil[5])+'</div></div>'+
    '<div class="metric"><div class="mlabel">10 Tahun ('+(y0+10)+')</div><div class="mval">'+wRp(nominal[10])+'</div><div class="msub neu">riil: '+wRp(riil[10])+'</div></div>'+
    '<div class="metric"><div class="mlabel">20 Tahun ('+(y0+20)+')</div><div class="mval">'+wRp(nominal[20])+'</div><div class="msub neu">riil: '+wRp(riil[20])+'</div></div>';

  // Estimasi tahun FIRE per level investasi bulanan
  var fy = el('w-fire-years');
  if(fy){
    fy.innerHTML = [3,5,10,15].map(function(m){
      var nw2 = a.net, yr = 0;
      if(target>0){ while(nw2<target && yr<50){ nw2 = nw2*(1+cagr) + m*1e6*12; yr++; } }
      return '<div class="w-mini"><span style="color:var(--text3)">Investasi '+m+' jt/bln</span><b style="color:var(--accent);font-family:\'Share Tech Mono\',monospace">'+(target<=0?'—':(yr<50?(y0+yr):'> '+(y0+50)))+'</b></div>';
    }).join('');
  }

  wKillChart('proj');
  var cv = el('w-proj-chart');
  if(cv && typeof Chart!=='undefined'){
    var ds = [
      {label:'Nominal', data:nominal, borderColor:'#818cf8', backgroundColor:'rgba(129,140,248,.08)', fill:true, tension:.3, pointRadius:0, borderWidth:2},
      {label:'Riil (setelah inflasi)', data:riil, borderColor:'#34d399', fill:false, tension:.3, pointRadius:0, borderWidth:1.5, borderDash:[5,3]}
    ];
    if(target>0) ds.push({label:'FIRE Number', data:years.map(function(){return target}), borderColor:'rgba(251,191,36,.6)', fill:false, pointRadius:0, borderWidth:1, borderDash:[2,3]});
    wCharts['proj'] = new Chart(cv.getContext('2d'), {type:'line',
      data:{labels:years, datasets:ds},
      options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
        plugins:{legend:{labels:{color:'#a8a8c8',font:{size:10},boxWidth:14}},tooltip:{callbacks:{label:function(c){return c.dataset.label+': '+wRp(c.raw)}}}},
        scales:{x:{ticks:{color:'#6b6b8a',font:{size:9},maxTicksLimit:11},grid:{color:'rgba(129,140,248,.05)'}},
                y:{ticks:{color:'#6b6b8a',font:{size:9},callback:function(v){return (v/1e9).toFixed(1)+'M'}},grid:{color:'rgba(129,140,248,.05)'}}}}
    });
  }
}

// ══════════════════════════════════════════════
// MODAL CRUD
// ══════════════════════════════════════════════
function wOpenModal(title, bodyHtml){
  el('wm-title').textContent = title;
  el('wm-body').innerHTML = bodyHtml;
  el('wmodal').classList.add('on');
}
function wCloseModal(){ el('wmodal').classList.remove('on'); }
function wFind(type,id){ return WEALTH[type].filter(function(x){return x.id==id})[0] || null; }
function wRerender(){ wSave(); wRenderPage(WPAGES.filter(function(p){ var pg=el('page-'+p); return pg&&pg.classList.contains('on'); })[0] || 'wealth'); }

function wConfirmDelete(type, id, nama){
  wOpenModal('Hapus Data',
    '<p style="font-size:13px;margin-bottom:16px">Hapus <b>'+nama+'</b>? Tindakan ini tidak dapat dibatalkan.</p>'+
    '<div style="display:flex;gap:8px;justify-content:flex-end">'+
      '<button class="btn btn-ghost" onclick="wCloseModal()">Batal</button>'+
      '<button class="btn btn-red" onclick="wDelete(\''+type+'\','+id+')">Hapus</button>'+
    '</div>');
}
function wDelete(type, id){
  WEALTH[type] = WEALTH[type].filter(function(x){return x.id!=id});
  wCloseModal(); wRerender();
}

function wField(label, id, val, ph, type){
  return '<div class="w-field"><label>'+label+'</label><input class="finput" id="'+id+'" type="'+(type||'text')+'" value="'+(val!==undefined&&val!==null?val:'')+'" placeholder="'+(ph||'')+'"></div>';
}
function wSelect(label, id, opts, val){
  return '<div class="w-field"><label>'+label+'</label><select class="finput" id="'+id+'">'+
    opts.map(function(o){return '<option'+(o===val?' selected':'')+'>'+o+'</option>'}).join('')+'</select></div>';
}
function wFooter(saveCall){
  return '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:6px">'+
    '<button class="btn btn-ghost" onclick="wCloseModal()">Batal</button>'+
    '<button class="btn btn-blue" onclick="'+saveCall+'">Simpan</button></div>';
}

// — Bank —
function wModalBank(id){
  var it = id ? wFind('bank',id) : null;
  wOpenModal((it?'Edit':'Tambah')+' Rekening Bank',
    '<div class="w-frow">'+wField('Bank','wf-bank',it?it.bank:'','BCA')+wField('No. Rekening','wf-no',it?it.no:'','***-1234')+'</div>'+
    '<div class="w-frow">'+wField('Saldo (Rp)','wf-saldo',it?it.saldo:'','85000000','number')+wSelect('Tipe','wf-type',['Tabungan','Giro','Deposito'],it?it.type:'Tabungan')+'</div>'+
    wFooter('wSaveBank('+(it?it.id:'null')+')'));
}
function wSaveBank(id){
  var obj = {id:id||wUid(), bank:wVal('wf-bank'), no:wVal('wf-no'), saldo:wNum('wf-saldo'), type:wVal('wf-type')};
  if(!obj.bank){ alert('Nama bank wajib diisi'); return; }
  if(id) WEALTH.bank = WEALTH.bank.map(function(x){return x.id==id?obj:x});
  else WEALTH.bank.push(obj);
  wCloseModal(); wRerender();
}

// — Debt —
function wModalDebt(id){
  var it = id ? wFind('debt',id) : null;
  wOpenModal((it?'Edit':'Tambah')+' Hutang',
    wField('Nama Hutang','wf-nama',it?it.nama:'','KPR Rumah BCA')+
    '<div class="w-frow">'+wSelect('Tipe','wf-tipe',['KPR','Kartu Kredit','Kendaraan','Pinjaman','Paylater','Lainnya'],it?it.tipe:'KPR')+wField('Bunga/thn (%)','wf-bunga',it?it.bunga:'','8.5','number')+'</div>'+
    '<div class="w-frow">'+wField('Outstanding (Rp)','wf-outstanding',it?it.outstanding:'','680000000','number')+wField('Cicilan/bln (Rp)','wf-cicilan',it?it.cicilan:'','7200000','number')+'</div>'+
    wFooter('wSaveDebt('+(it?it.id:'null')+')'));
}
function wSaveDebt(id){
  var old = id ? wFind('debt',id) : null;
  var obj = {id:id||wUid(), nama:wVal('wf-nama'), tipe:wVal('wf-tipe'), bunga:wNum('wf-bunga'), outstanding:wNum('wf-outstanding'), cicilan:wNum('wf-cicilan'), payments:old?old.payments:[]};
  if(!obj.nama){ alert('Nama hutang wajib diisi'); return; }
  if(id) WEALTH.debt = WEALTH.debt.map(function(x){return x.id==id?obj:x});
  else WEALTH.debt.push(obj);
  wCloseModal(); wRerender();
}

// — Bayar Hutang —
function wPaymentHistoryHtml(payments){
  if(!payments || !payments.length) return '<div style="font-size:10px;color:var(--text3);margin-top:12px">Belum ada riwayat pembayaran.</div>';
  var sorted = payments.slice().sort(function(a,b){return (b.date||'').localeCompare(a.date||'');});
  return '<div style="margin-top:12px;border-top:1px solid var(--border);padding-top:10px">'+
    '<div style="font-size:10px;color:var(--text3);margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">Riwayat Pembayaran</div>'+
    '<div style="max-height:140px;overflow-y:auto">'+
    sorted.map(function(p){
      return '<div style="display:flex;justify-content:space-between;font-size:11px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.04)">'+
        '<span style="color:var(--text3)">'+(p.date?new Date(p.date).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'}):'—')+'</span>'+
        '<b>'+wRp(p.amount)+'</b></div>';
    }).join('')+
    '</div></div>';
}
function wModalDebtPay(id){
  var it = wFind('debt', id); if(!it) return;
  wOpenModal('💰 Bayar Hutang — '+it.nama,
    '<div style="font-size:11px;color:var(--text3);margin-bottom:10px">Outstanding saat ini: <b style="color:var(--text)">'+wRp(it.outstanding)+'</b></div>'+
    '<div class="w-frow">'+wField('Jumlah Pembayaran (Rp)','wf-pay-amt','',it.cicilan||'','number')+wField('Tanggal','wf-pay-date',new Date().toISOString().slice(0,10),'','date')+'</div>'+
    wFooter('wSaveDebtPay('+id+')')+
    wPaymentHistoryHtml(it.payments));
}
function wSaveDebtPay(id){
  var it = wFind('debt', id); if(!it) return;
  var amt = wNum('wf-pay-amt');
  if(!amt || amt<=0){ alert('Jumlah pembayaran harus lebih dari 0'); return; }
  var date = wVal('wf-pay-date') || new Date().toISOString().slice(0,10);
  if(!Array.isArray(it.payments)) it.payments = [];
  it.payments.push({id:wUid(), date:date, amount:amt});
  it.outstanding = Math.max(0, (it.outstanding||0) - amt);
  WEALTH.debt = WEALTH.debt.map(function(x){return x.id==id?it:x});
  wCloseModal(); wRerender();
}

// — Piutang —
function wModalPiutang(id){
  var it = id ? wFind('piutang',id) : null;
  wOpenModal((it?'Edit':'Tambah')+' Piutang',
    '<div class="w-frow">'+wField('Nama Debitur','wf-nama',it?it.nama:'','Budi Santoso')+wField('Keperluan','wf-keperluan',it?it.keperluan:'','Modal usaha')+'</div>'+
    '<div class="w-frow">'+wField('Pokok (Rp)','wf-pokok',it?it.pokok:'','25000000','number')+wField('Sudah Terbayar (Rp)','wf-terbayar',it?it.terbayar:0,'0','number')+'</div>'+
    '<div class="w-frow">'+wField('Jatuh Tempo','wf-tempo',it?it.jatuhTempo:'','','date')+wSelect('Status','wf-status',['Lancar','Telat','Lunas','Macet'],it?it.status:'Lancar')+'</div>'+
    wFooter('wSavePiutang('+(it?it.id:'null')+')'));
}
function wSavePiutang(id){
  var old = id ? wFind('piutang',id) : null;
  var obj = {id:id||wUid(), nama:wVal('wf-nama'), keperluan:wVal('wf-keperluan'), pokok:wNum('wf-pokok'), terbayar:wNum('wf-terbayar'), jatuhTempo:wVal('wf-tempo'), status:wVal('wf-status'), payments:old?old.payments:[]};
  if(!obj.nama){ alert('Nama debitur wajib diisi'); return; }
  if(id) WEALTH.piutang = WEALTH.piutang.map(function(x){return x.id==id?obj:x});
  else WEALTH.piutang.push(obj);
  wCloseModal(); wRerender();
}

// — Terima Pembayaran Piutang —
function wModalPiutangPay(id){
  var it = wFind('piutang', id); if(!it) return;
  var sisa = Math.max(0, (it.pokok||0)-(it.terbayar||0));
  wOpenModal('💰 Terima Pembayaran — '+it.nama,
    '<div style="font-size:11px;color:var(--text3);margin-bottom:10px">Sisa piutang: <b style="color:var(--text)">'+wRp(sisa)+'</b></div>'+
    '<div class="w-frow">'+wField('Jumlah Diterima (Rp)','wf-pay-amt','',sisa||'','number')+wField('Tanggal','wf-pay-date',new Date().toISOString().slice(0,10),'','date')+'</div>'+
    wFooter('wSavePiutangPay('+id+')')+
    wPaymentHistoryHtml(it.payments));
}
function wSavePiutangPay(id){
  var it = wFind('piutang', id); if(!it) return;
  var amt = wNum('wf-pay-amt');
  if(!amt || amt<=0){ alert('Jumlah pembayaran harus lebih dari 0'); return; }
  var date = wVal('wf-pay-date') || new Date().toISOString().slice(0,10);
  if(!Array.isArray(it.payments)) it.payments = [];
  it.payments.push({id:wUid(), date:date, amount:amt});
  it.terbayar = Math.min(it.pokok||0, (it.terbayar||0) + amt);
  if(it.terbayar >= (it.pokok||0)) it.status = 'Lunas';
  WEALTH.piutang = WEALTH.piutang.map(function(x){return x.id==id?it:x});
  wCloseModal(); wRerender();
}

// — Asumsi & aset lain —
function wModalSettings(){
  wOpenModal('Asumsi & Aset Lain',
    '<div style="font-size:11px;color:var(--text3);margin-bottom:12px;line-height:1.6">Angka-angka ini menjadi dasar dana darurat, FIRE number, DTI, dan Wealth Score. Nilai portofolio saham/crypto/ETF/RD otomatis diambil dari jurnal Money Watch.</div>'+
    '<div class="w-frow">'+wField('Pemasukan / bln (Rp)','wf-income',WEALTH.income||'','15000000','number')+wField('Pengeluaran / bln (Rp)','wf-expense',WEALTH.expense||'','8000000','number')+'</div>'+
    '<div class="w-frow">'+wField('Deposito (Rp)','wf-deposito',WEALTH.deposito||'','0','number')+wField('Obligasi / SBN (Rp)','wf-obligasi',WEALTH.obligasi||'','0','number')+'</div>'+
    wField('Emas / Logam Mulia (Rp)','wf-emas',WEALTH.emas||'','0','number')+
    wFooter('wSaveSettings()'));
}
function wSaveSettings(){
  WEALTH.income   = wNum('wf-income');
  WEALTH.expense  = wNum('wf-expense');
  WEALTH.deposito = wNum('wf-deposito');
  WEALTH.obligasi = wNum('wf-obligasi');
  WEALTH.emas     = wNum('wf-emas');
  wCloseModal(); wRerender();
}

// ══════════════════════════════════════════════
// EXPORT / IMPORT (JSON, terpisah dari backup jurnal)
// ══════════════════════════════════════════════
function wExport(){
  try{
    var payload = {_app:'MoneyWatchPro-Wealth', _version:'1.0', _exportedAt:new Date().toISOString(), wealth:WEALTH};
    var blob = new Blob([JSON.stringify(payload,null,2)], {type:'application/json'});
    var a2 = document.createElement('a');
    a2.href = URL.createObjectURL(blob);
    a2.download = 'wealth_backup_'+new Date().toISOString().slice(0,10)+'.json';
    document.body.appendChild(a2); a2.click(); document.body.removeChild(a2);
    URL.revokeObjectURL(a2.href);
  }catch(e){ alert('Gagal export: '+e.message); }
}
function wImport(){
  var inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.json';
  inp.onchange = function(){
    var f = inp.files[0]; if(!f) return;
    var rd = new FileReader();
    rd.onload = function(ev){
      try{
        var d = JSON.parse(ev.target.result);
        var w = d.wealth || d;
        if(!w || typeof w!=='object' || (!w.bank && !w.debt && !w.piutang)) throw new Error('Format tidak dikenali');
        Object.keys(WEALTH).forEach(function(k){ if(w[k]!==undefined) WEALTH[k]=w[k]; });
        wRerender();
      }catch(e){ alert('Gagal import: '+e.message); }
    };
    rd.readAsText(f);
  };
  inp.click();
}

// ── INIT ──
wLoad();
