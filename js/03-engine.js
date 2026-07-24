// ============================================================
// LOAD DATA REAL KE STATE
// ============================================================
function loadSample(){
  // RDN
  addRdn('2026-01-01','SETOR','Modal investasi awal 2026', XLSX_DATA.total_equity,'Mirae Asset');
  addRdn('2026-05-31','TARIK','Mark-to-market unrealized loss', XLSX_DATA.change_rp,'Mirae Asset');
  addRdn('2026-05-31','SETOR','Penerimaan dividen 2026',XLSX_DATA.dividend_2026,'Mirae Asset');

  // Extend DB dengan semua saham real
  var sectorMap = {
    'Financials':'Keuangan','Energy':'Energi','Infrastructures':'Infrastruktur',
    'Consumer Non-Cyclicals':'Konsumer Primer','Basic Materials':'Barang Baku',
    'Consumer Cyclicals':'Konsumer Non-Primer','Healthcare':'Kesehatan',
    'Transportation & Logistic':'Infrastruktur','Properties':'Properti',
  };
  XLSX_DATA.stocks.forEach(function(s){
    DB[s.code] = {name:s.code, base:s.price||s.avg||100, sector:sectorMap[s.sector]||s.sector||'Lainnya', beta:1.0};
    prices[s.code] = s.price||s.avg||100;
  });

  // Transactions (satu BUY per posisi, dengan harga avg real)
  XLSX_DATA.stocks.forEach(function(s, i){
    addTx(dAgo(300-i*5),'BUY',s.code,s.lot||1,s.avg||100,'Mirae Asset');
  });

  // Dividends real
  XLSX_DATA.dividends.slice(0,10).forEach(function(d, i){
    var stk = XLSX_DATA.stocks.find(function(s){return s.code===d.code});
    if(stk && stk.shares>0 && d.avg_per_year>0){
      addDiv(dAgo(150-i*14), d.code, stk.shares, Math.round(d.avg_per_year/stk.shares)||10);
    }
  });
}


// ── Deteksi sekuritas aktif dari transaksi portofolio ──
// Returns sekuritas yang paling sering dipakai pada transaksi BUY terbaru (30 hari terakhir),
// atau jika tidak ada, sekuritas dengan total lot terbanyak.
function detectActiveSekuritas(){
  if(transactions.length === 0) return activeSekuritas;
  // Cek 30 hari terakhir
  var cutoff = new Date(); cutoff.setDate(cutoff.getDate()-30);
  var cutoffStr = cutoff.toISOString().slice(0,10);
  var recent = transactions.filter(function(t){ return t.date >= cutoffStr && t.type==='BUY'; });
  var pool = recent.length > 0 ? recent : transactions.filter(function(t){ return t.type==='BUY'; });
  if(pool.length === 0) return activeSekuritas;
  // Hitung frekuensi per sekuritas
  var freq = {};
  pool.forEach(function(t){
    var s = t.sekuritas||''; if(!s) return;
    freq[s] = (freq[s]||0) + 1;
  });
  // Pilih yang terbanyak, tie-break: transaksi terbaru
  var sorted = Object.keys(freq).sort(function(a,b){
    return freq[b] - freq[a] || 0;
  });
  return sorted[0] || activeSekuritas;
}

// Jenis biaya RDN non-saham (fee, materai, dll)
var FEE_TYPES = [
  { value:'DATA_FEE',  label:'Data Fee / Subscription',   hint:'Biaya langganan data pasar real-time' },
  { value:'MATERAI',   label:'Bea Materai',                hint:'Bea materai dokumen (Rp 10.000/dok)' },
  { value:'MIGRASI',   label:'Biaya Migrasi',              hint:'Biaya pindah rekening antar sekuritas' },
  { value:'ADMIN',     label:'Biaya Administrasi',         hint:'Biaya bulanan rekening atau kartu saham' },
  { value:'TRANSFER',  label:'Biaya Transfer Bank',        hint:'Biaya transfer RDN ke bank lain' },
  { value:'PENALTY',   label:'Denda / Penalti',            hint:'Denda gagal bayar atau pelanggaran' },
  { value:'LAINNYA',   label:'Biaya Lainnya',              hint:'Biaya operasional lainnya' },
];

function addRdn(date, type, ket, amount, sekuritas, linkedTxId){
  // FIX AUDIT F2: sebelumnya rdnBalance+=amount lalu balance:rdnBalance ditulis
  // TANPA mengurutkan ulang rdnMutations dulu — mutasi bertanggal MUNDUR yang
  // ditambahkan setelah mutasi lain akan dapat snapshot "balance" yang salah
  // secara kronologis (lihat AUDIT_FINANCIAL_ENGINE.md Temuan #2, terverifikasi
  // reproduksi langsung). rebuildRdnBalance() selalu re-sort by date dulu lalu
  // menghitung ulang penuh, jadi kolom balance per-baris selalu benar berapa
  // pun urutan penambahannya.
  rdnMutations.push({
    id:nextRdnId++, date:date, type:type, ket:ket,
    amount:amount, balance:0, sekuritas:sekuritas,
    linkedTxId: linkedTxId||null
  });
  if(typeof rebuildRdnBalance==='function') rebuildRdnBalance();
  else rdnBalance += amount; // fallback (seharusnya tidak pernah terjadi di app ini)
  // Note: saveData() harus dipanggil dari caller utama (addTx/addDiv/submitRdn)
}

function addTx(date,type,ticker,lot,price,sekuritas){
  var isBuy = type==='BUY';
  var gross  = lot*100*price;
  var c      = calcTxComponents(gross, isBuy, sekuritas);
  var txId   = nextTxId++;
  // tax = ppn + levy + pph (semua komponen non-komisi, untuk backward compat display)
  transactions.push({id:txId,date:date,type:type,ticker:ticker,lot:lot,price:price,
    gross:gross, komisi:c.komisi, ppn:c.ppn, levy:c.levy, pph:c.pph,
    tax:c.ppn+c.levy+c.pph, net:c.net, sekuritas:sekuritas});
  // Update RDN — tag dengan linkedTxId agar bisa dihapus bersama
  if(isBuy){
    addRdn(date,'BUY','Beli '+lot+' lot '+ticker+' @ Rp '+fmt(price),-c.net,sekuritas, txId);
  } else {
    addRdn(date,'SELL','Jual '+lot+' lot '+ticker+' @ Rp '+fmt(price),c.net,sekuritas, txId);
  }
  saveData();
}

function addDiv(date,ticker,shares,dps){
  // FIX AUDIT F1: pakai TAX_SETTINGS.pphDividen (single source of truth),
  // bukan literal 0.1 — lihat AUDIT_FINANCIAL_ENGINE.md Temuan #1.
  var gross=shares*dps;var tax=gross*TAX_SETTINGS.pphDividen;var net=gross-tax;
  var divId = nextDivId++;
  dividends.push({id:divId,date:date,ticker:ticker,shares:shares,dps:dps,gross:gross,tax:tax,net:net});
  addRdn(date,'DIVIDEN','Dividen '+ticker+' Rp '+fmt(dps)+'/lbr',net,'—', 'div-'+divId);
  saveData();
}

// ============================================================
// PORTFOLIO CALC
// ============================================================
var _portoCache=null, _portoCacheKey='';
function _invalidatePortoCache(){ _portoCache=null; _portoCacheKey=''; }
function getPortfolio(){
  // FIX: cache key lama cuma menghitung JUMLAH key di prices{} — begitu key
  // sebuah ticker sudah ada (mis. dari updatePrices() simulasi), UPDATE NILAI
  // ke harga riil (dari fhFetchStocks/rdFetchLivePrice/dst) tidak mengubah
  // jumlah key, jadi cache lama tetap dipakai dan Nilai Pasar macet di angka
  // lama (termasuk macet di 0). Sekarang sertakan nilai harga tiap ticker yang
  // benar-benar dipegang (bukan seluruh 900+ isi DB) sebagai sidik jari cache.
  var heldTickers={};
  transactions.forEach(function(tx){ heldTickers[tx.ticker]=1; });
  var priceSig=Object.keys(heldTickers).sort().map(function(t){ return t+':'+(prices[t]||0); }).join(',');
  var cacheKey=transactions.length+'|'+priceSig;
  if(_portoCache && _portoCacheKey===cacheKey) return _portoCache;
  var pos={};
  transactions.slice().sort(function(a,b){return a.date.localeCompare(b.date)}).forEach(function(tx){
    if(!pos[tx.ticker])pos[tx.ticker]={ticker:tx.ticker,lot:0,cost:0,shares:0};
    var p=pos[tx.ticker];
    if(tx.type==='BUY'){p.lot+=tx.lot;p.shares+=tx.lot*100;p.cost+=tx.gross;}
    else if(tx.type==='SELL'){
      var avg=p.shares>0?p.cost/p.shares:0;
      var sold=tx.lot*100;
      p.lot-=tx.lot;p.shares-=sold;p.cost=Math.max(0,p.cost-avg*sold);
    }
  });
  var result=Object.values(pos).filter(function(p){return p.lot>0}).map(function(p){
    var info=DB[p.ticker]||{name:p.ticker,sector:'Lainnya',beta:1.0};
    var mp=prices[p.ticker]||info.base||0;
    var mv=mp*p.shares;
    var avg=p.shares>0?p.cost/p.shares:0;
    var unreal=mv-p.cost;
    var ret=p.cost>0?(unreal/p.cost)*100:0;
    return Object.assign({},p,{mp:mp,price:mp,mv:mv,avg:avg,unreal:unreal,ret:ret,info:info});
  });
  _portoCache=result; _portoCacheKey=cacheKey;
  return result;
}

// ── Riwayat Ekuitas Harian (AUM) — satu snapshot per hari, disimpan lokal ──
function computeCurrentAUM(){
  var porto=getPortfolio(), cryptoPorto=getCryptoPortfolio(), etfPorto=getEtfPortfolio(), rdPorto=getRdPortfolio();
  var sahamMV=porto.reduce(function(a,p){return a+p.mv},0);
  var crMV=cryptoPorto.reduce(function(a,p){return a+p.mv},0);
  var etfMV=etfPorto.reduce(function(a,p){return a+p.mvIdr},0);
  var rdMV=rdPorto.reduce(function(a,p){return a+p.mv},0);
  var rdn=(typeof calcRdnBalance==='function')?calcRdnBalance():0;
  return (sahamMV||0)+(crMV||0)+(etfMV||0)+(rdMV||0)+(rdn||0);
}
function equityHistoryLoad(){
  try{ return JSON.parse(localStorage.getItem('equityHistory')||'[]'); }catch(e){ return []; }
}
function equityHistorySave(arr){ try{ localStorage.setItem('equityHistory', JSON.stringify(arr)); }catch(e){} }
function equitySnapshotToday(){
  if(!transactions.length && !(rdnMutations&&rdnMutations.length)) return [];
  var today=new Date().toISOString().slice(0,10);
  var aum=computeCurrentAUM();
  var hist=equityHistoryLoad();
  var last=hist[hist.length-1];
  if(last && last.date===today) last.equity=aum;
  else hist.push({date:today,equity:aum});
  if(hist.length>730) hist=hist.slice(-730);
  equityHistorySave(hist);
  return hist;
}

function getRealizedPnl(){
  var pos={};var real=0;
  transactions.slice().sort(function(a,b){return a.date.localeCompare(b.date)}).forEach(function(tx){
    if(!pos[tx.ticker])pos[tx.ticker]={lot:0,cost:0};
    var p=pos[tx.ticker];
    if(tx.type==='BUY'){p.lot+=tx.lot;p.cost+=tx.gross;}
    else if(tx.type==='SELL'&&p.lot>0){
      var avg=p.cost/(p.lot*100);var sold=tx.lot*100;
      real+=(tx.gross-avg*sold);p.lot-=tx.lot;p.cost=Math.max(0,p.cost-avg*sold);
    }
  });
  return real;
}

function calcRdnBalance(){
  // FIX AUDIT F3: sebelumnya fungsi ini "percaya" variabel cache rdnBalance
  // apa adanya (hanya menghitung ulang jika kebetulan 0) — model kepercayaan
  // BEDA dari rebuildRdnBalance() yang SELALU menghitung ulang penuh. Dua
  // fungsi berbeda untuk satu nilai yang sama = pelanggaran Single Source of
  // Truth (lihat AUDIT_FINANCIAL_ENGINE.md Temuan #3). Sekarang calcRdnBalance
  // HANYA memanggil rebuildRdnBalance() dan mengembalikan hasilnya — satu
  // jalur kebenaran untuk keduanya. Aman secara performa: rdnMutations biasa
  // berjumlah puluhan-ratusan baris, bukan jutaan.
  if(!Array.isArray(rdnMutations)) rdnMutations = [];
  if(typeof rebuildRdnBalance === 'function'){ rebuildRdnBalance(); return rdnBalance; }
  // Fallback jika rebuildRdnBalance entah kenapa belum termuat (seharusnya tidak pernah terjadi)
  var bal = 0;
  rdnMutations.forEach(function(r){
    if(typeof r.amount === 'number' && r.amount !== 0) bal += r.amount;
    else bal += (r.amountIn||r.amount_in||0) - (r.amountOut||r.amount_out||0);
  });
  return isNaN(bal) ? 0 : bal;
}

// ============================================================
// MARKET
// ── HIDE/SHOW METRIC VALUES ──────────────────────────────────
var _hiddenMetrics = {};
var MASK = '••••••••';

function loadHiddenMetrics(){
  try{ _hiddenMetrics=JSON.parse(localStorage.getItem('ihsg_hidden_metrics')||'{}'); }catch(e){}
}
function saveHiddenMetrics(){
  try{ localStorage.setItem('ihsg_hidden_metrics', JSON.stringify(_hiddenMetrics)); }catch(e){}
}

// Called after renderDashboard to re-apply masks
function applyMetricMasks(){
  ['aum','unreal','real','rdn','div'].forEach(function(k){
    if(_hiddenMetrics[k]) _maskMetric(k);
    else _unmaskMetric(k);
  });
}

function _maskMetric(k){
  var val=el('d-'+k), eye=el('eye-'+k);
  if(!val) return;
  if(!val._rv) val._rv=val.innerHTML;
  val.innerHTML='<span style="letter-spacing:3px;color:var(--text3)">••••••••</span>';
  if(eye) eye.textContent='🚫';
  // Hide sub-elements for AUM
  if(k==='aum'){
    var s=el('d-aum-sub'),b=el('d-aum-badges');
    if(s&&!s._rv){s._rv=s.innerHTML;s.innerHTML='';}
    if(b&&!b._rv){b._rv=b.innerHTML;b.innerHTML='';}
  }
  if(k==='unreal'){
    var s2=el('d-unreal-sub'); if(s2&&!s2._rv){s2._rv=s2.innerHTML;s2.innerHTML='';}
  }
}

function _unmaskMetric(k){
  var val=el('d-'+k), eye=el('eye-'+k);
  if(!val) return;
  if(val._rv){val.innerHTML=val._rv; delete val._rv;}
  if(eye) eye.textContent='👁';
  if(k==='aum'){
    var s=el('d-aum-sub'),b=el('d-aum-badges');
    if(s&&s._rv){s.innerHTML=s._rv; delete s._rv;}
    if(b&&b._rv){b.innerHTML=b._rv; delete b._rv;}
  }
  if(k==='unreal'){
    var s2=el('d-unreal-sub'); if(s2&&s2._rv){s2.innerHTML=s2._rv; delete s2._rv;}
  }
}

function toggleMetric(k){
  _hiddenMetrics[k]=!_hiddenMetrics[k];
  saveHiddenMetrics();
  if(_hiddenMetrics[k]) _maskMetric(k);
  else {
    // Force renderDashboard to repopulate, then unmask
    delete el('d-'+k)._rv;
    renderDashboard();
    // renderDashboard will call applyMetricMasks() which leaves this one unmasked
  }
}

// ============================================================
// YAHOO FINANCE REALTIME ENGINE (tanpa API key)
// ============================================================
var FH = {
  status: 'off',              // 'off' | 'live' | 'error' | 'loading'
  timer: null,                // interval handle
  IHSG_SYM: '%5EJKSE',        // ^JKSE URL-encoded
  USD_SYM:  'USDIDR%3DX',     // USDIDR=X URL-encoded
  _stockIdx: 0,
  _simTimer: null,
  PROXIES: [
    function(u){ return 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u); },
    function(u){ return 'https://corsproxy.io/?' + encodeURIComponent(u); },
    function(u){ return 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(u); }
  ]
};

// ── Core: fetch Yahoo Finance chart endpoint, mencoba tiap proxy berurutan ──
function yfFetch(symbol, cb, proxyIdx){
  proxyIdx = proxyIdx||0;
  if(proxyIdx >= FH.PROXIES.length){ cb(new Error('ALL_PROXIES_FAILED'), null); return; }
  var yUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/' + symbol + '?interval=1m&range=1d';
  var url = FH.PROXIES[proxyIdx](yUrl);
  fetch(url)
  .then(function(r){
    if(r.status===429){ throw new Error('RATE_LIMIT'); }
    if(!r.ok){ throw new Error('HTTP_'+r.status); }
    return r.json();
  })
  .then(function(d){
    var result = d && d.chart && d.chart.result && d.chart.result[0];
    var meta = result && result.meta;
    if(meta && meta.regularMarketPrice > 0){ cb(null, meta); }
    else { throw new Error('NO_DATA'); }
  })
  .catch(function(){
    yfFetch(symbol, cb, proxyIdx+1);
  });
}

// ── Update badge UI ──
function fhSetBadge(status, text){
  FH.status = status;
  fhUpdateLoadBanners(status);
  var dot = el('fh-dot'), lbl = el('fh-label'), badge = el('fh-badge');
  if(!dot||!lbl) return;
  var colors = { live:'#00e5a0', error:'#ff3d5a', off:'#4a5e82', loading:'#ffc107', limit:'#ffc107' };
  dot.style.background = colors[status]||'#4a5e82';
  lbl.textContent = text;
  if(badge){
    badge.style.borderColor = status==='live'  ? 'rgba(0,229,160,.3)' :
                              status==='error'  ? 'rgba(255,61,90,.3)' :
                              status==='limit'  ? 'rgba(255,193,7,.3)' : 'var(--border)';
  }
}

// ── Banner loading ringan di Dashboard & Portofolio Saham — status pengambilan harga live ──
function fhUpdateLoadBanners(status){
  var msg = status==='loading' ? '⏳ Memuat harga live dari Yahoo Finance...'
          : (status==='error'||status==='limit') ? '⚠ Gagal terhubung ke sumber harga — menampilkan data tersimpan terakhir'
          : null;
  [['dash-load-banner','dash-load-text'],['porto-load-banner','porto-load-text']].forEach(function(pair){
    var banner=el(pair[0]), text=el(pair[1]);
    if(!banner||!text) return;
    if(msg){
      banner.className='load-banner on '+(status==='loading'?'st-loading':'st-error');
      text.textContent=msg;
    } else {
      banner.className='load-banner';
    }
  });
}

// ── Fetch IHSG via Yahoo Finance ──
function fhFetchIHSG(){
  yfFetch(FH.IHSG_SYM, function(err, meta){
    if(err){ fhSetBadge('error','IHSG Gagal'); return; }
    fhApplyIHSG(
      meta.regularMarketPrice,
      meta.previousClose||meta.regularMarketPrice,
      meta.regularMarketOpen||meta.regularMarketPrice,
      meta.regularMarketDayHigh||meta.regularMarketPrice,
      meta.regularMarketDayLow||meta.regularMarketPrice
    );
    fhSetBadge('live','● LIVE');
  });
}

function fhApplyIHSG(price, prev, open, high, low){
  ihsgCur  = price;
  ihsgBase = prev||price;
  ihsgHist.push(Math.round(price*100)/100);
  if(ihsgHist.length>120) ihsgHist.shift();
  if(open>0){ var e=el('ihsg-op'); if(e) e.textContent=open.toLocaleString('id-ID',{minimumFractionDigits:2}); }
  if(high>0){ var e=el('ihsg-hi'); if(e) e.textContent=high.toLocaleString('id-ID',{minimumFractionDigits:2}); }
  if(low>0){  var e=el('ihsg-lo'); if(e) e.textContent=low.toLocaleString('id-ID',{minimumFractionDigits:2}); }
  updateTopbar();
  if(typeof currentPage!=='undefined' && currentPage==='dashboard'){
    try{ buildIhsgChart('1H'); }catch(e){}
    try{ renderPage('dashboard'); }catch(e){}
  }
}

// ── Fetch harga saham IDX via Yahoo Finance ──
// Semua ticker portofolio diambil dalam satu putaran, dijeda 1,5 dtk per request
// agar tidak membanjiri proxy publik. previousClose disimpan untuk % harian akurat.
var prevCloses = {};
function fhFetchStocks(){
  var porto = getPortfolio();
  var codes = porto.length > 0
    ? porto.map(function(p){ return p.ticker; })
    : ['BBCA','BBRI','BMRI','TLKM','ASII','ANTM'];
  // Sertakan ticker yang sedang dilihat di Candlestick/Flowscan + chip umum,
  // supaya analisa tidak pakai DB[t].base yang bisa basi
  var extra = ['BBCA','BBRI','TLKM'];
  if(typeof CD_TICKER!=='undefined' && CD_TICKER) extra.unshift(CD_TICKER);
  extra.forEach(function(t){ if(codes.indexOf(t)<0) codes.push(t); });
  if(!codes.length) return;
  codes.forEach(function(code, i){
    setTimeout(function(){
      yfFetch(code+'.JK', function(err, meta){
        if(!err && meta && meta.regularMarketPrice > 0){
          prices[code] = meta.regularMarketPrice;
          if(meta.previousClose > 0) prevCloses[code] = meta.previousClose;
          if(typeof DB!=='undefined' && DB[code]) DB[code].base = meta.regularMarketPrice; // sinkronkan baseline analisa
        }
      });
    }, i*1500);
  });
  // Bangun ulang ticker tape sekali setelah seluruh batch selesai
  setTimeout(function(){ try{ buildTickerTape(); }catch(e){} }, codes.length*1500 + 3000);
}

// ── Fetch kurs USD/IDR via Yahoo Finance ──
function fhFetchKurs(){
  yfFetch(FH.USD_SYM, function(err, meta){
    if(!err && meta && meta.regularMarketPrice > 10000) usdIdr = meta.regularMarketPrice;
  });
}

// FIX AUDIT F4: harga ETF sebelumnya cuma simulasi Math.random() satu kali saat
// load, tidak pernah diperbarui — padahal ticker ETF AS (VOO, QQQ, dst) adalah
// simbol Yahoo Finance yang valid TANPA akhiran .JK, jadi bisa pakai yfFetch()
// yang sama persis dengan saham IDX. updateEtfPrices() (Math.random) tetap ada
// sebagai fallback simulasi kalau fetch riil gagal — pola sama dengan updatePrices().
function fhFetchEtf(){
  var held = (typeof getEtfPortfolio==='function') ? getEtfPortfolio().map(function(p){return p.ticker;}) : [];
  var codes = held.length ? held : Object.keys(ETF_DB).slice(0,5);
  codes.forEach(function(code, i){
    setTimeout(function(){
      yfFetch(code, function(err, meta){
        if(!err && meta && meta.regularMarketPrice > 0){
          etfPrices[code] = meta.regularMarketPrice;
          if(typeof ETF_DB!=='undefined' && ETF_DB[code]) ETF_DB[code].baseUSD = meta.regularMarketPrice;
          if(typeof currentPage!=='undefined' && currentPage==='etf'){ try{ renderEtf(); }catch(e){} }
        }
      });
    }, i*1500);
  });
}

// ── Fetch harga crypto LANGSUNG dalam IDR via Yahoo Finance (pair -IDR) ──
function fhFetchCrypto(){
  var codes = Object.keys(CRYPTO_DB);
  codes.forEach(function(code, i){
    setTimeout(function(){
      yfFetch(code+'-IDR', function(err, meta){
        if(!err && meta && meta.regularMarketPrice > 0){
          cryptoPrices[code] = meta.regularMarketPrice;
        }
      });
    }, i*1500);
  });
}

// ── Start Yahoo Finance realtime engine ──
function fhStart(){
  if(FH._simTimer){ clearInterval(FH._simTimer); FH._simTimer=null; }
  fhSetBadge('loading','Menghubungkan...');
  fhFetchIHSG();
  setTimeout(fhFetchKurs,   2000);
  setTimeout(fhFetchStocks, 4000);
  setTimeout(fhFetchCrypto, 6000);
  setTimeout(fhFetchEtf,    8000);
  if(FH.timer) clearInterval(FH.timer);
  var tick = 0;
  FH.timer = setInterval(function(){
    tick++;
    fhFetchIHSG();                       // IHSG tiap 15 detik
    if(tick%8===0)  fhFetchStocks();     // saham tiap 2 menit
    if(tick%8===0)  fhFetchCrypto();     // crypto tiap 2 menit
    if(tick%8===0)  fhFetchEtf();        // ETF tiap 2 menit
    if(tick%40===0) fhFetchKurs();       // kurs tiap 10 menit
    if(tick%4===0)  renderPage(currentPage);
  }, 15000);
}

// ── Stop (fallback ke simulasi) ──
function fhStop(){
  if(FH.timer){ clearInterval(FH.timer); FH.timer=null; }
  fhSetBadge('off','Simulasi');
  if(!FH._simTimer){
    FH._simTimer = setInterval(function(){
      updatePrices();
      renderPage(currentPage);
    }, 6000);
  }
}

// ── Simulasi (fallback) ──
function updatePrices(){
  Object.keys(DB).forEach(function(t){
    var realStock = XLSX_DATA.stocks.find(function(s){return s.code===t});
    if(realStock && realStock.price>0){
      prices[t] = realStock.price * (1 + (Math.random()*0.004-0.002));
    } else {
      prices[t] = Math.round(rnd(DB[t].base));
    }
  });
  ihsgCur += (Math.random()-.48)*25;
  ihsgCur  = Math.max(ihsgBase*0.92, Math.min(ihsgBase*1.08, ihsgCur));
  ihsgHist.push(Math.round(ihsgCur*100)/100);
  if(ihsgHist.length>120) ihsgHist.shift();
  updateTopbar();
  if(typeof currentPage!=='undefined' && (currentPage==='portfolio'||currentPage==='dashboard')){
    try{ renderPage(currentPage); }catch(e){}
  }
}

// ── Settings Modal ──
function openFinnhubSettings(){
  el('m-title').textContent = '📡 Yahoo Finance — Harga Realtime';
  el('m-title').style.color = 'var(--accent)';
  var sc = FH.status==='live'?'var(--green)':FH.status==='error'?'var(--red)':'var(--text3)';
  var st = FH.status==='live'?'● Live':FH.status==='error'?'● Error':FH.status==='loading'?'⏳ Menghubungkan...':'○ Simulasi';
  el('m-body').innerHTML =
    '<div style="font-size:12px;color:var(--text2);margin-bottom:14px;line-height:1.7">'+
      'Data harga realtime diambil langsung dari <strong style="color:var(--accent)">Yahoo Finance</strong> — tidak perlu API key.<br>'+
      'Request diteruskan via CORS proxy publik (allorigins → corsproxy.io → codetabs), otomatis pindah jika satu proxy gagal.'+
    '</div>'+
    '<div style="background:rgba(0,200,255,.06);border:1px solid rgba(0,200,255,.15);border-radius:8px;padding:9px 12px;margin-bottom:11px;font-size:11px;color:var(--text2);line-height:1.65">'+
      '<div style="font-weight:700;color:var(--accent);margin-bottom:3px">📊 Data realtime:</div>'+
      '• IHSG — tiap 15 detik<br>'+
      '• Saham IDX portofolio — tiap 2 menit<br>'+
      '• USD/IDR — tiap 10 menit'+
    '</div>'+
    '<div style="background:rgba(255,61,90,.06);border:1px solid rgba(255,61,90,.15);border-radius:8px;padding:9px 12px;margin-bottom:12px;font-size:11px;color:var(--text2);line-height:1.65">'+
      '<div style="font-weight:700;color:var(--red);margin-bottom:3px">⚠️ Jika Error:</div>'+
      '1. Semua proxy publik mungkin sedang rate-limited — sistem otomatis fallback ke simulasi<br>'+
      '2. Klik "Coba Lagi" untuk reconnect manual'+
    '</div>'+
    '<div style="display:flex;justify-content:space-between;align-items:center">'+
      '<span style="font-size:11px;font-family:\'IBM Plex Mono\',monospace">Status: <span id="fh-modal-status" style="color:'+sc+'">'+st+'</span></span>'+
      '<div style="display:flex;gap:7px">'+
        '<button class="btn btn-ghost" onclick="fhDisconnect()">Pakai Simulasi</button>'+
        '<button class="btn btn-blue" onclick="fhConnect()">📡 Coba Lagi</button>'+
      '</div>'+
    '</div>';
  el('modal').classList.add('on');
}

function fhConnect(){
  closeModal();
  fhStart();
  showSaveStatus('Menghubungkan ke Yahoo Finance...');
}

function fhDisconnect(){
  if(FH.timer){ clearInterval(FH.timer); FH.timer=null; }
  closeModal();
  fhStop();
  showSaveStatus('Mode simulasi aktif');
}

function updateTopbar(){
  var diff=ihsgCur-ihsgBase;var pct=(diff/ihsgBase*100).toFixed(2);
  var sign=diff>=0?'+':'';
  var ihsgFmt=ihsgCur.toLocaleString('id-ID',{minimumFractionDigits:2,maximumFractionDigits:2});
  el('tb-ihsg').textContent=ihsgFmt;
  el('tb-chg').className='ibar-chg '+(diff>=0?'up':'dn');
  el('tb-chg').textContent=sign+diff.toFixed(2)+' ('+sign+pct+'%)';
  // Update chart header
  var cd=el('ihsg-close-disp'); if(cd) cd.textContent=ihsgFmt;
  var cc=el('ihsg-chg-disp');
  if(cc){
    cc.textContent=(diff>=0?'▲ ':'▼ ')+Math.abs(diff).toFixed(2)+' ('+sign+pct+'%)';
    cc.className='badge '+(diff>=0?'b-up':'b-dn');
  }
  var rdn=calcRdnBalance();
  el('tb-rdn').textContent='Rp '+fmtK(rdn);
}

function updateClock(){el('clock').textContent=new Date().toLocaleTimeString('id-ID')}

// ── Bloomberg Ticker Tape ──
function buildTickerTape(){
  // HANYA data live Yahoo Finance yang ditampilkan — tanpa angka statis palsu.
  // % harian dihitung dari previousClose Yahoo (bukan DB.base yang bisa basi).
  var _stock=function(sym){
    var cur=typeof prices!=='undefined'&&prices[sym];
    var pc=typeof prevCloses!=='undefined'&&prevCloses[sym];
    if(!cur||cur<=0||!pc||pc<=0) return null; // tampilkan HANYA harga yang sudah terkonfirmasi live Yahoo
    var d=(cur-pc)/pc*100;
    return {sym:sym,val:Math.round(cur).toLocaleString('id-ID'),chg:(d>=0?'+':'')+d.toFixed(2)+'%',up:d>=0};
  };
  var _ihsgChg=(function(){ var d=ihsgCur-ihsgBase; var p=(d/(ihsgBase||1)*100); return {chg:(d>=0?'+':'')+p.toFixed(2)+'%',up:d>=0}; })();
  var items=[
    {sym:'IHSG', val:(typeof ihsgCur!=='undefined'?ihsgCur.toLocaleString('id-ID',{minimumFractionDigits:2}):'—'), chg:_ihsgChg.chg, up:_ihsgChg.up}
  ];
  // Saham: portofolio user + ticker umum yang punya harga live
  var seen={};
  var tickSyms=[];
  try{ getPortfolio().forEach(function(p){ tickSyms.push(p.ticker); }); }catch(e){}
  ['BBCA','BBRI','BMRI','TLKM','ANTM','ASII'].forEach(function(t){ tickSyms.push(t); });
  tickSyms.forEach(function(t){
    if(seen[t]) return; seen[t]=1;
    var it=_stock(t); if(it) items.push(it);
  });
  // Kurs & crypto live
  if(typeof usdIdr!=='undefined'&&usdIdr>10000) items.push({sym:'USD/IDR',val:Math.round(usdIdr).toLocaleString('id-ID'),chg:'kurs',up:true});
  if(typeof cryptoPrices!=='undefined'){
    if(cryptoPrices.BTC>0) items.push({sym:'BTC/IDR',val:fmtK(cryptoPrices.BTC),chg:'live',up:true});
    if(cryptoPrices.ETH>0) items.push({sym:'ETH/IDR',val:fmtK(cryptoPrices.ETH),chg:'live',up:true});
  }
  var html=items.map(function(it){
    var col=it.up?'var(--green)':'var(--red)';
    var arrow=it.up?'▲':'▼';
    return '<div class="tick-item">'
      +'<span class="tick-sym">'+it.sym+'</span>'
      +'<span class="tick-val">'+it.val+'</span>'
      +'<span class="tick-chg" style="color:'+col+'">'+arrow+' '+it.chg+'</span>'
      +'</div>';
  }).join('');
  // Duplicate for seamless loop
  html=html+html;
  var tc=el('ticker-inner');
  if(tc) tc.innerHTML=html;
}

// ============================================================
// CHARTS
// ============================================================
function kc(id){if(charts[id]){charts[id].destroy();delete charts[id];}}
var TC={color:'#8a90ad',font:{family:'IBM Plex Mono',size:9}};
var GC='rgba(255,102,0,.07)';
var TT={backgroundColor:'#0a0a0f',titleColor:'#b8bdd4',bodyColor:'#f5f5fa',borderColor:'rgba(255,102,0,.25)',borderWidth:1,titleFont:{family:'IBM Plex Mono'},bodyFont:{family:'IBM Plex Mono',size:11}};

function genIHSG(n){
  // Simulate realistic intraday IHSG from Open 6210 → Close 6195
  // Open=6210, High=6264, Low=6143, Close=6195 (data real 2 Jun 2026)
  var a=[];
  var open=6210, high=6264.26, low=6143.63, close=6195.43;
  var b=open;
  for(var i=0;i<n;i++){
    var prog=i/n;
    // Morning spike → midday dip → afternoon recovery
    var target;
    if(prog<0.2) target=open+(high-open)*(prog/0.2);       // morning rally to high
    else if(prog<0.5) target=high-(high-low)*((prog-0.2)/0.3); // pullback to low  
    else if(prog<0.8) target=low+(close-low)*((prog-0.5)/0.3);  // recovery to close
    else target=close;
    b=b*0.85+target*0.15+(Math.random()*8-4); // smooth with noise
    b=Math.max(low-20, Math.min(high+20, b));
    a.push(Math.round(b*100)/100);
  }
  return a;
}

function buildModalPosisiChart(porto){
  kc('modalposisi');
  var cv=el('modalPosisiChart'); if(!cv||!porto.length) return;
  var labels=porto.map(function(p){return p.ticker});
  // Stacked: bottom=retained(min), top-red=loss, top-green=gain
  var retained=porto.map(function(p){return Math.round(Math.min(p.cost,p.mv))});
  var loss=porto.map(function(p){return p.unreal<0?Math.round(Math.abs(p.unreal)):0});
  var gain=porto.map(function(p){return p.unreal>=0?Math.round(p.unreal):0});
  var ctx=cv.getContext('2d');
  charts['modalposisi']=new Chart(ctx,{
    type:'bar',
    data:{
      labels:labels,
      datasets:[
        {label:'Nilai Pasar',data:retained,backgroundColor:'rgba(45,212,191,.6)',borderColor:'#2dd4bf',borderWidth:1,stack:'s'},
        {label:'Rugi',      data:loss,    backgroundColor:'rgba(255,61,90,.7)',  borderColor:'#ff3d5a',borderWidth:1,stack:'s'},
        {label:'Untung',    data:gain,    backgroundColor:'rgba(0,229,160,.7)',  borderColor:'#00e5a0',borderWidth:1,stack:'s'}
      ]
    },
    options:{
      responsive:true,maintainAspectRatio:false,
      plugins:{
        legend:{
          display:true,
          labels:{color:'#8fa3c8',font:{size:10},boxWidth:12,padding:16}
        },
        tooltip:Object.assign({},TT,{mode:'index',intersect:false,callbacks:{
          label:function(c){
            var pf=porto[c.dataIndex];
            if(c.datasetIndex===0) return 'Nilai Pasar: Rp '+fmtK(pf.mv)+' (Modal: Rp '+fmtK(pf.cost)+')';
            if(c.datasetIndex===1&&pf.unreal<0) return 'Rugi: -Rp '+fmtK(Math.abs(pf.unreal))+' ('+pf.ret.toFixed(2)+'%)';
            if(c.datasetIndex===2&&pf.unreal>=0) return 'Untung: +Rp '+fmtK(pf.unreal)+' (+'+pf.ret.toFixed(2)+'%)';
            return null;
          },
          filter:function(item){ return item.parsed.y>0; }
        }})
      },
      scales:{
        x:{stacked:true,grid:{color:GC},ticks:Object.assign({},TC,{maxRotation:45,font:{size:9}})},
        y:{stacked:true,grid:{color:GC},ticks:Object.assign({},TC,{callback:function(v){return 'Rp'+fmtK(v)}}),position:'right'}
      }
    }
  });
}

// ── IHSG Candlestick SVG Chart ──
function buildIhsgChart(tf){
  var svg=el('ihsgChart');if(!svg)return;
  tf=tf||'1H';

  // Generate realistic OHLCV candles from price history or simulation
  function makeCandles(closes,volatility){
    return closes.map(function(c,i){
      var prev=i>0?closes[i-1]:c;
      var bodyRange=Math.abs(c-prev)||c*volatility*0.5;
      var open=prev+(Math.random()-0.5)*bodyRange*0.3;
      var wick=c*volatility*(0.5+Math.random()*0.8);
      var high=Math.max(open,c)+wick*0.5;
      var low=Math.min(open,c)-wick*0.5;
      return {o:open,h:high,l:low,c:c};
    });
  }
  function genClose(n,base,vol,drift){
    var arr=[base],lo=base*0.75,hi=base*1.4;
    for(var i=1;i<n;i++){
      var v=arr[arr.length-1]*(1+(drift||0)+(Math.random()*vol*2-vol));
      arr.push(Math.max(lo,Math.min(hi,v)));
    }
    return arr;
  }
  var months=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  var candles,labels;

  if(tf==='1H'){
    var src=ihsgHist.length>=8?ihsgHist.slice(-40):genClose(40,ihsgCur,0.0008);
    candles=makeCandles(src,0.0012);
    var n0=new Date();
    labels=candles.map(function(_,i){
      var d=new Date(n0.getTime()-(candles.length-1-i)*90000);
      return ('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2);
    });
  } else if(tf==='3H'){
    var src2=ihsgHist.length>=8?ihsgHist.slice(-60):genClose(60,ihsgCur,0.0008);
    candles=makeCandles(src2,0.0012);
    var n1=new Date();
    labels=candles.map(function(_,i){
      var d=new Date(n1.getTime()-(candles.length-1-i)*180000);
      return ('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2);
    });
  } else if(tf==='1M'){
    var cl=genClose(22,ihsgCur,0.009,0.001);
    candles=makeCandles(cl,0.009);
    var now=new Date();
    labels=candles.map(function(_,i){
      var d=new Date(now.getFullYear(),now.getMonth(),now.getDate()-22+i+1);
      return ('0'+d.getDate()).slice(-2)+'/'+months[d.getMonth()];
    });
  } else if(tf==='1Y'){
    var cl2=genClose(60,ihsgCur*0.94,0.012,0.0003);
    // Resample to 60 weekly-ish candles
    candles=makeCandles(cl2,0.012);
    var now2=new Date();
    labels=candles.map(function(_,i){
      var d=new Date(now2.getFullYear(),now2.getMonth(),now2.getDate()-60+i);
      return ('0'+d.getDate()).slice(-2)+'/'+months[d.getMonth()];
    });
  } else {
    var src3=ihsgHist.length>=8?ihsgHist.slice(-40):genClose(40,ihsgCur,0.0008);
    candles=makeCandles(src3,0.0012);
    labels=candles.map(function(_,i){return ''+i;});
  }

  // SVG dimensions — tinggi mengikuti kontainer nyata, bukan angka tetap
  var VW=svg.parentElement?svg.parentElement.offsetWidth||700:700;
  var VH=svg.parentElement?svg.parentElement.offsetHeight||200:200;
  var padL=48, padR=8, padT=8, padB=22;
  var plotW=VW-padL-padR, plotH=VH-padT-padB;
  svg.setAttribute('viewBox','0 0 '+VW+' '+VH);
  svg.setAttribute('xmlns','http://www.w3.org/2000/svg');

  // Area chart: pakai harga penutupan tiap titik (bukan OHLC candle)
  var closes=candles.map(function(c){return c.c;});
  var mn=Math.min.apply(null,closes), mx=Math.max.apply(null,closes), rng=mx-mn||1;
  mn-=rng*0.08; mx+=rng*0.08; rng=mx-mn;
  var toY=function(v){return padT+((mx-v)/rng)*plotH;};
  var n=closes.length;
  var toX=function(i){return padL+(n<=1?0:(i/(n-1))*plotW);};

  var up=closes[closes.length-1]>=closes[0];
  var lineCol=up?'#00e5a0':'#f23645';
  var fillIdSuffix=up?'up':'dn';
  var gradId='ihsgFill-'+fillIdSuffix;

  var html='';
  // Latar hitam solid di belakang seluruh chart
  html+='<rect x="0" y="0" width="'+VW+'" height="'+VH+'" fill="#000000"/>';
  html+='<defs><linearGradient id="'+gradId+'" x1="0" y1="0" x2="0" y2="1">'+
    '<stop offset="0%" stop-color="'+lineCol+'" stop-opacity="0.35"/>'+
    '<stop offset="100%" stop-color="'+lineCol+'" stop-opacity="0"/>'+
  '</linearGradient></defs>';
  // Grid lines (Y)
  var yTicks=4;
  for(var gi=0;gi<=yTicks;gi++){
    var yv=mn+(rng*gi/yTicks);
    var gy=toY(yv);
    html+='<line x1="'+padL+'" y1="'+gy.toFixed(1)+'" x2="'+(VW-padR)+'" y2="'+gy.toFixed(1)+'" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>';
    html+='<text x="'+(padL-4)+'" y="'+(gy+3).toFixed(1)+'" text-anchor="end" font-size="8" fill="#787b86" font-family="IBM Plex Mono,monospace">'+Math.round(yv).toLocaleString('id-ID')+'</text>';
  }
  // X axis labels (show ~6 evenly)
  var xStep=Math.max(1,Math.floor(n/6));
  for(var xi=0;xi<n;xi+=xStep){
    if(labels[xi]) html+='<text x="'+toX(xi).toFixed(1)+'" y="'+(VH-4)+'" text-anchor="middle" font-size="8" fill="#787b86" font-family="IBM Plex Mono,monospace">'+labels[xi]+'</text>';
  }
  // Area path (isi gradasi turun ke dasar chart) + garis close di atasnya
  var linePts=closes.map(function(c,i){return toX(i).toFixed(1)+','+toY(c).toFixed(1);});
  var areaPath='M'+toX(0).toFixed(1)+','+(VH-padB)+' L'+linePts.join(' L')+' L'+toX(n-1).toFixed(1)+','+(VH-padB)+' Z';
  html+='<path d="'+areaPath+'" fill="url(#'+gradId+')" stroke="none"/>';
  html+='<polyline points="'+linePts.join(' ')+'" fill="none" stroke="'+lineCol+'" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>';
  // Titik terakhir ditandai bulatan kecil
  html+='<circle cx="'+toX(n-1).toFixed(1)+'" cy="'+toY(closes[n-1]).toFixed(1)+'" r="2.5" fill="'+lineCol+'"/>';
  svg.innerHTML=html;
}

function buildDonut(porto){
  kc('donut');var cv=el('donutChart');if(!cv||!porto.length)return;
  charts['donut']=new Chart(cv,{type:'doughnut',data:{labels:porto.map(function(p){return p.ticker}),datasets:[{data:porto.map(function(p){return p.mv}),backgroundColor:COLORS.slice(0,porto.length),borderWidth:0,hoverOffset:4}]},options:{responsive:true,maintainAspectRatio:false,cutout:'68%',plugins:{legend:{display:false},tooltip:Object.assign({},TT,{callbacks:{label:function(c){return c.label+': Rp '+fmtK(c.parsed)}}})}}});
}

function buildDivCharts(){
  // Charts are now built directly inside renderDividen()
  // This function is kept as stub for backward compatibility
}

function buildSectorChart(porto){
  kc('sector');var cv=el('sectorChart');if(!cv)return;
  var byS={};var totalMV=porto.reduce(function(a,p){return a+p.mv},0)||1;
  porto.forEach(function(p){byS[p.info.sector]=(byS[p.info.sector]||0)+p.mv});
  var labels=Object.keys(byS);var vals=labels.map(function(s){return byS[s]});
  var cols=labels.map(function(s){return sectorColor(s);});
  charts['sector']=new Chart(cv,{type:'doughnut',data:{labels:labels,datasets:[{data:vals,backgroundColor:cols,borderWidth:0,hoverOffset:5}]},options:{responsive:true,maintainAspectRatio:false,cutout:'55%',plugins:{legend:{display:false},tooltip:Object.assign({},TT,{callbacks:{label:function(c){return c.label+': '+(c.parsed/totalMV*100).toFixed(1)+'%'}}})}}});
}

function buildRdnChart(){
  kc('rdnf');var cv=el('rdnFlowChart');if(!cv)return;
  var months=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  var inM=new Array(12).fill(0);var outM=new Array(12).fill(0);var yr=new Date().getFullYear();
  rdnMutations.forEach(function(r){
    var dt=new Date(r.date);if(dt.getFullYear()!==yr)return;
    var m=dt.getMonth();
    if(r.amount>0)inM[m]+=r.amount;else outM[m]+=Math.abs(r.amount);
  });
  charts['rdnf']=new Chart(cv,{type:'bar',data:{labels:months,datasets:[{label:'Masuk',data:inM,backgroundColor:'rgba(0,229,160,.6)',borderRadius:3},{label:'Keluar',data:outM,backgroundColor:'rgba(255,61,90,.5)',borderRadius:3}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:Object.assign({},TT,{callbacks:{label:function(c){return c.dataset.label+': Rp '+fmtK(c.parsed.y)}}})},scales:{x:{grid:{color:GC},ticks:TC},y:{grid:{color:GC},ticks:Object.assign({},TC,{callback:function(v){return 'Rp '+fmtK(v)}}),position:'right'}}}});
}

function buildPnlChart(){
  kc('pnl');var cv=el('pnlChart');if(!cv)return;
  var cum=0;var data=[0];var labels=['Mulai'];
  var pos={};
  transactions.slice().sort(function(a,b){return a.date.localeCompare(b.date)}).forEach(function(tx){
    if(!pos[tx.ticker])pos[tx.ticker]={lot:0,cost:0};
    var p=pos[tx.ticker];
    if(tx.type==='BUY'){p.lot+=tx.lot;p.cost+=tx.gross;}
    if(tx.type==='SELL'&&p.lot>0){
      var avg=p.cost/(p.lot*100);cum+=(tx.gross-avg*tx.lot*100);
      data.push(Math.round(cum));labels.push(tx.date.slice(5));
      p.lot-=tx.lot;p.cost=Math.max(0,p.cost-avg*tx.lot*100);
    }
  });
  var last=data[data.length-1];var col=last>=0?'#00e5a0':'#ff3d5a';
  var ctx=cv.getContext('2d');var g=ctx.createLinearGradient(0,0,0,190);
  g.addColorStop(0,last>=0?'rgba(0,229,160,.18)':'rgba(255,61,90,.18)');g.addColorStop(1,'rgba(0,0,0,0)');
  charts['pnl']=new Chart(ctx,{type:'line',data:{labels:labels,datasets:[{data:data,borderColor:col,borderWidth:2,backgroundColor:g,fill:true,tension:.4,pointRadius:3,pointBackgroundColor:col}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:Object.assign({},TT,{callbacks:{label:function(c){return 'P&L: Rp '+fmt(c.parsed.y)}}})},scales:{x:{grid:{color:GC},ticks:Object.assign({},TC,{maxTicksLimit:7})},y:{grid:{color:GC},ticks:Object.assign({},TC,{callback:function(v){return 'Rp '+fmtK(v)}}),position:'right'}}}});
}

function buildRetDistChart(porto){
  kc('retdist');var cv=el('retDistChart');if(!cv)return;
  var returns=porto.map(function(p){return parseFloat(p.ret.toFixed(1))});
  var bins=[-30,-20,-15,-10,-5,0,5,10,15,20,30];
  var counts=new Array(bins.length-1).fill(0);
  returns.forEach(function(r){
    for(var i=0;i<bins.length-1;i++){if(r>=bins[i]&&r<bins[i+1]){counts[i]++;break;}}
  });
  var labels=bins.slice(0,-1).map(function(b,i){return b+'% to '+bins[i+1]+'%'});
  var bkgs=bins.slice(0,-1).map(function(b){return b>=0?'rgba(0,229,160,.65)':'rgba(255,61,90,.55)'});
  charts['retdist']=new Chart(cv,{type:'bar',data:{labels:labels,datasets:[{data:counts,backgroundColor:bkgs,borderRadius:3}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:Object.assign({},TT,{callbacks:{label:function(c){return c.parsed.y+' saham'}}})},scales:{x:{grid:{color:GC},ticks:Object.assign({},TC,{maxRotation:35})},y:{grid:{color:GC},ticks:Object.assign({},TC,{stepSize:1}),position:'right'}}}});
}

