// ============================================================
// MODAL
// ============================================================
var modalType='';
function openModal(type){
  modalType=type;
  var secOpts=Object.keys(SEKURITAS).map(function(s){
    var sf=SEKURITAS[s];
    return '<option value="'+s+'"'+(s===activeSekuritas?' selected':'')+'>'+s
      +' (Komisi B:'+(sf.buyFee*100).toFixed(2)+'% J:'+(sf.sellFee*100).toFixed(2)+'%)</option>';
  }).join('');
  var tkrOpts=Object.keys(DB).map(function(t){return '<option value="'+t+'">'+t+' — '+DB[t].name+'</option>'}).join('');

  if(type==='setor'||type==='tarik'){
    var isIn=type==='setor';
    el('m-title').textContent=isIn?'Setor Dana ke RDN':'Tarik Dana dari RDN';
    el('m-title').style.color=isIn?'var(--green)':'var(--red)';
    el('m-body').innerHTML='<div class="fgrid"><div class="fg ffull"><label class="flabel">Tanggal</label><input class="finput" type="date" id="mf-date" value="'+today()+'"></div><div class="fg ffull"><label class="flabel">Jumlah Dana (Rp)</label><input class="finput" type="number" id="mf-amount" placeholder="Contoh: 50000000" oninput="updateAmtPreview()"></div><div class="fg ffull"><label class="flabel">Keterangan</label><input class="finput" type="text" id="mf-ket" placeholder="'+(isIn?'Setoran rutin, top-up, dll':'Penarikan profit, kebutuhan mendesak, dll')+'"></div></div><div class="taxbox"><div style="font-size:9px;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;margin-bottom:7px">'+(isIn?'DANA MASUK RDN':'DANA KELUAR RDN')+'</div><div class="taxrow tot"><span>Jumlah</span><span class="mono '+(isIn?'up':'dn')+'" id="amt-preview">Rp 0</span></div></div><div style="margin-top:14px;display:flex;gap:8px;justify-content:flex-end"><button class="btn btn-ghost" onclick="closeModal()">Batal</button><button class="btn '+(isIn?'btn-green':'btn-red')+'" onclick="submitRdn()">Konfirmasi '+(isIn?'Setor':'Tarik')+'</button></div>';
  } else if(type==='fee'){
    el('m-title').textContent='Catat Biaya & Fee Sekuritas';
    el('m-title').style.color='var(--amber)';
    var feeOpts=FEE_TYPES.map(function(f){return '<option value="'+f.value+'">'+f.label+'</option>';}).join('');
    el('m-body').innerHTML=
      '<div class="fgrid">'
      +'<div class="fg ffull"><label class="flabel">Tanggal</label><input class="finput" type="date" id="mf-date" value="'+today()+'"></div>'
      +'<div class="fg"><label class="flabel">Jenis Biaya</label><select class="finput fsel" id="mf-fee-type" onchange="onFeeTypeChange()">'+feeOpts+'</select></div>'
      +'<div class="fg"><label class="flabel">Sekuritas</label><select class="finput fsel" id="mf-fee-sec">'+secOpts+'</select></div>'
      +'<div class="fg ffull"><label class="flabel">Jumlah Biaya (Rp)</label><input class="finput" type="number" id="mf-amount" placeholder="Contoh: 10000" min="1" oninput="updateAmtPreview()"></div>'
      +'<div class="fg ffull"><label class="flabel">Keterangan Tambahan</label><input class="finput" type="text" id="mf-ket" placeholder="Opsional — mis: bulan Januari 2026"></div>'
      +'</div>'
      +'<div class="taxbox" style="margin-top:8px">'
        +'<div style="font-size:9px;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;margin-bottom:6px">INFO JENIS BIAYA</div>'
        +'<div id="fee-hint" style="font-size:11px;color:var(--text2);margin-bottom:8px">'+FEE_TYPES[0].hint+'</div>'
        +'<div class="taxrow tot"><span>Jumlah Biaya (keluar RDN)</span><span class="mono dn" id="amt-preview">Rp 0</span></div>'
      +'</div>'
      +'<div style="margin-top:14px;display:flex;gap:8px;justify-content:flex-end">'
        +'<button class="btn btn-ghost" onclick="closeModal()">Batal</button>'
        +'<button class="btn btn-amber" onclick="submitFee()">💾 Simpan Biaya</button>'
      +'</div>';
    setTimeout(function(){
      var sel=el('mf-fee-sec');
      if(sel) sel.value=detectActiveSekuritas();
    },30);
  } else if(type==='buy'||type==='sell'){
    var isBuy=type==='buy';
    el('m-title').textContent=isBuy?'Input Pembelian Saham':'Input Penjualan Saham';
    el('m-title').style.color=isBuy?'var(--green)':'var(--red)';
    var sf=SEKURITAS[activeSekuritas]||SEKURITAS['Mirae Asset'];
    el('m-body').innerHTML=
      '<div class="fgrid">'
      +'<div class="fg ffull"><label class="flabel">Tanggal</label><input class="finput" type="date" id="mf-date" value="'+today()+'"></div>'
      +'<div class="fg"><label class="flabel">Sekuritas</label><select class="finput fsel" id="mf-sec" onchange="onSecChange()">'+secOpts+'</select></div>'
      +'<div class="fg"><label class="flabel">Kode Saham</label><select class="finput fsel" id="mf-ticker" onchange="prefillPrice()">'+tkrOpts+'</select></div>'
      +'<div class="fg"><label class="flabel">Jumlah Lot</label><input class="finput" type="number" id="mf-lot" placeholder="1" min="1" oninput="txCalcLive()"></div>'
      +'<div class="fg"><label class="flabel">Harga/Lembar (Rp)</label><input class="finput" type="text" inputmode="numeric" id="mf-price" placeholder="Contoh: 67303" oninput="txCalcLive()"></div>'
      +'<div class="fg ffull"><label class="flabel">Catatan (opsional)</label><input class="finput" type="text" id="mf-notes" placeholder="Alasan entry / catatan (opsional)"></div>'
      +'</div>'
      +'<div class="taxbox">'
        +'<div style="font-size:9px;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;margin-bottom:7px">RINCIAN '+(isBuy?'PEMBELIAN':'PENJUALAN')+' — sesuai regulasi BEI & DJP</div>'
        +'<div class="taxrow"><span>Nilai Kotor (lot × 100 × harga)</span><span class="mono" id="mc-g">Rp 0</span></div>'
        +'<div class="taxrow"><span id="mc-k-lbl">Komisi '+(isBuy?'Beli':'Jual')+' ('+((isBuy?sf.buyFee:sf.sellFee)*100).toFixed(2)+'%)</span><span class="mono amb" id="mc-k">Rp 0</span></div>'
        +'<div class="taxrow"><span id="mc-ppn-lbl">PPN '+(TAX_SETTINGS.ppn*100).toFixed(0)+'% × Komisi</span><span class="mono dn" id="mc-ppn">Rp 0</span></div>'
        +'<div class="taxrow"><span>Levy BEI+KPEI+KSEI ('+(TAX_SETTINGS.levy*100).toFixed(3)+'%)</span><span class="mono dn" id="mc-levy">Rp 0</span></div>'
        +(isBuy?'':'<div class="taxrow"><span>PPh Final Jual ('+(TAX_SETTINGS.pphJual*100).toFixed(1)+'% — hanya jual)</span><span class="mono dn" id="mc-pph">Rp 0</span></div>')
        +'<div class="taxrow tot"><span>Total '+(isBuy?'Dibayar':'Diterima')+'</span><span class="mono '+(isBuy?'amb':'up')+'" id="mc-tot">Rp 0</span></div>'
        +'<div class="taxrow" style="border-top:1px solid var(--border2);margin-top:6px;padding-top:7px"><span>Avg Beli Saat Ini</span><span class="mono neu" id="mc-avg-cur">—</span></div>'
        +(isBuy?'<div class="taxrow"><span style="color:var(--amber)">Avg Beli Baru (setelah transaksi)</span><span class="mono amb" id="mc-avg-new">—</span></div>':'')
      +'</div>'
      +'<div style="margin-top:14px;display:flex;gap:8px;justify-content:flex-end">'
        +'<button class="btn btn-ghost" onclick="closeModal()">Batal</button>'
        +'<button class="btn '+(isBuy?'btn-green':'btn-red')+'" onclick="submitTxModal()">Konfirmasi '+(isBuy?'Beli':'Jual')+'</button>'
      +'</div>';
    setTimeout(function(){var t=el('mf-ticker').value;if(t&&(prices[t]||DB[t])){el('mf-price').value=prices[t]||DB[t].base;}txCalcLive();},50);
  } else if(type==='div'){
    el('m-title').textContent='Catat Penerimaan Dividen';
    el('m-title').style.color='var(--purple)';
    var porto=getPortfolio();
    el('m-body').innerHTML='<div class="fgrid"><div class="fg ffull"><label class="flabel">Tanggal Pembayaran</label><input class="finput" type="date" id="mf-date" value="'+today()+'"></div><div class="fg"><label class="flabel">Kode Saham</label><select class="finput fsel" id="mf-ticker" onchange="prefillShares()">'+tkrOpts+'</select></div><div class="fg"><label class="flabel">Jumlah Lembar</label><input class="finput" type="number" id="mf-shares" placeholder="Lembar dimiliki" oninput="divCalcLive()"></div><div class="fg ffull"><label class="flabel">Dividen per Lembar (Rp)</label><input class="finput" type="number" id="mf-dps" placeholder="Contoh: 250" oninput="divCalcLive()"></div></div><div class="taxbox"><div style="font-size:9px;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;margin-bottom:7px">RINCIAN DIVIDEN</div><div class="taxrow"><span>Dividen Kotor</span><span class="mono" id="dc-g">Rp 0</span></div><div class="taxrow"><span>PPh Dividen (10%)</span><span class="mono dn" id="dc-t">-Rp 0</span></div><div class="taxrow tot"><span>Diterima Bersih</span><span class="mono up" id="dc-n">Rp 0</span></div></div><div style="margin-top:14px;display:flex;gap:8px;justify-content:flex-end"><button class="btn btn-ghost" onclick="closeModal()">Batal</button><button class="btn btn-purple" onclick="submitDivModal()">Simpan Dividen</button></div>';
    setTimeout(function(){var t=el('mf-ticker').value;var p=porto.find(function(pp){return pp.ticker===t});if(p)el('mf-shares').value=p.shares;divCalcLive();},50);
  } else if(type==='sec'){
    el('m-title').textContent='Ganti Sekuritas Aktif';
    el('m-title').style.color='var(--accent)';
    el('m-body').innerHTML='<div style="margin-bottom:12px"><select class="finput fsel" id="mf-sec-choose">'+Object.keys(SEKURITAS).map(function(s){return '<option value="'+s+'"'+(s===activeSekuritas?' selected':'')+'>'+s+'</option>'}).join('')+'</select></div><div id="sec-fee-preview"></div><div style="margin-top:14px;display:flex;gap:8px;justify-content:flex-end"><button class="btn btn-ghost" onclick="closeModal()">Batal</button><button class="btn btn-blue" onclick="saveSecuritas()">Simpan</button></div>';
    function updateSecPreview(){
      var s=el('mf-sec-choose').value; var sf=SEKURITAS[s];
      var ovr=sekTaxOverride[s]||{};
      var bFee=(ovr.beli!=null?ovr.beli:sf.buyFee);
      var jFee=(ovr.jual!=null?ovr.jual:sf.sellFee);
      var ppn=TAX_SETTINGS.ppn, levy=TAX_SETTINGS.levy, pphJ=TAX_SETTINGS.pphJual;
      // per 100 saham @ Rp 5000 (gross=500000) untuk representasi persentase
      var totBrate=((bFee*(1+ppn)+levy)*100).toFixed(3);
      var totJrate=((jFee*(1+ppn)+levy+pphJ)*100).toFixed(3);
      el('sec-fee-preview').innerHTML=
        '<div class="taxbox">'
        +'<div style="font-size:9px;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;margin-bottom:6px">RINCIAN BIAYA TOTAL</div>'
        +'<div class="taxrow"><span>Komisi Beli</span><span class="mono amb">'+(bFee*100).toFixed(3)+'%</span></div>'
        +'<div class="taxrow"><span>PPN '+( ppn*100).toFixed(0)+'% × Komisi</span><span class="mono dn">'+(bFee*ppn*100).toFixed(4)+'%</span></div>'
        +'<div class="taxrow"><span>Levy '+( levy*100).toFixed(3)+'%</span><span class="mono dn">'+(levy*100).toFixed(3)+'%</span></div>'
        +'<div class="taxrow tot"><span>Total Biaya Beli</span><span class="mono amb">'+totBrate+'%</span></div>'
        +'<div class="taxrow" style="margin-top:6px"><span>Komisi Jual</span><span class="mono amb">'+(jFee*100).toFixed(3)+'%</span></div>'
        +'<div class="taxrow"><span>PPN '+( ppn*100).toFixed(0)+'% × Komisi</span><span class="mono dn">'+(jFee*ppn*100).toFixed(4)+'%</span></div>'
        +'<div class="taxrow"><span>Levy '+( levy*100).toFixed(3)+'%</span><span class="mono dn">'+(levy*100).toFixed(3)+'%</span></div>'
        +'<div class="taxrow"><span>PPh Final Jual '+(pphJ*100).toFixed(1)+'%</span><span class="mono dn">'+(pphJ*100).toFixed(1)+'%</span></div>'
        +'<div class="taxrow tot"><span>Total Biaya Jual</span><span class="mono dn">'+totJrate+'%</span></div>'
        +'</div>';
    }
    el('mf-sec-choose').onchange=updateSecPreview;
    setTimeout(updateSecPreview,30);
  }
  el('modal').classList.add('on');
}


// ============================================================
// CRYPTO DATABASE (harga dalam USD, konversi ke IDR)
// ============================================================
var CRYPTO_DB = {
  'BTC':  {name:'Bitcoin',       category:'Layer 1',   baseUSD:67000,  color:'#f7931a', icon:'₿'},
  'ETH':  {name:'Ethereum',      category:'Layer 1',   baseUSD:3200,   color:'#627eea', icon:'Ξ'},
  'BNB':  {name:'BNB Chain',     category:'Layer 1',   baseUSD:580,    color:'#f0b90b', icon:'B'},
  'SOL':  {name:'Solana',        category:'Layer 1',   baseUSD:175,    color:'#9945ff', icon:'◎'},
  'ADA':  {name:'Cardano',       category:'Layer 1',   baseUSD:0.45,   color:'#0033ad', icon:'₳'},
  'AVAX': {name:'Avalanche',     category:'Layer 1',   baseUSD:36,     color:'#e84142', icon:'A'},
  'DOT':  {name:'Polkadot',      category:'Layer 0',   baseUSD:7.5,    color:'#e6007a', icon:'●'},
  'LINK': {name:'Chainlink',     category:'Oracle',    baseUSD:14.5,   color:'#375bd2', icon:'⬡'},
  'MATIC':{name:'Polygon',       category:'Layer 2',   baseUSD:0.72,   color:'#8247e5', icon:'M'},
  'XRP':  {name:'Ripple XRP',    category:'Payments',  baseUSD:0.58,   color:'#00aae4', icon:'X'},
  'DOGE': {name:'Dogecoin',      category:'Meme',      baseUSD:0.165,  color:'#c2a633', icon:'Ð'},
  'UNI':  {name:'Uniswap',       category:'DeFi',      baseUSD:9.8,    color:'#ff007a', icon:'U'},
  'ATOM': {name:'Cosmos',        category:'Layer 0',   baseUSD:8.2,    color:'#2e3148', icon:'⚛'},
  'LTC':  {name:'Litecoin',      category:'Payments',  baseUSD:85,     color:'#bfbbbb', icon:'Ł'},
  'NEAR': {name:'NEAR Protocol', category:'Layer 1',   baseUSD:6.4,    color:'#00c08b', icon:'N'},
};

var CRYPTO_CATEGORIES = {
  'Layer 1':   '#00c8ff',
  'Layer 2':   '#a78bfa',
  'Layer 0':   '#ffc107',
  'DeFi':      '#00e5a0',
  'Oracle':    '#ff6b6b',
  'Payments':  '#2dd4bf',
  'Meme':      '#fb923c',
};

// ETF AMERIKA DATABASE (harga USD)
var ETF_DB = {
  'SPY':  {name:'SPDR S&P 500 ETF',          category:'Broad Market',  baseUSD:520,   color:'#00c8ff', expense:0.0945},
  'QQQ':  {name:'Invesco Nasdaq-100',         category:'Tech',          baseUSD:445,   color:'#a78bfa', expense:0.20},
  'VTI':  {name:'Vanguard Total Stock Mkt',   category:'Broad Market',  baseUSD:248,   color:'#00e5a0', expense:0.03},
  'VOO':  {name:'Vanguard S&P 500',           category:'Broad Market',  baseUSD:489,   color:'#4da6ff', expense:0.03},
  'IWM':  {name:'iShares Russell 2000',       category:'Small Cap',     baseUSD:198,   color:'#ffc107', expense:0.19},
  'GLD':  {name:'SPDR Gold Shares',           category:'Komoditas',     baseUSD:218,   color:'#f59e0b', expense:0.40},
  'TLT':  {name:'iShares 20+ Yr Treasury',    category:'Bond',          baseUSD:88,    color:'#34d399', expense:0.15},
  'XLK':  {name:'Technology Select SPDR',     category:'Tech',          baseUSD:210,   color:'#c084fc', expense:0.10},
  'XLF':  {name:'Financial Select SPDR',      category:'Financial',     baseUSD:43,    color:'#60a5fa', expense:0.10},
  'ARKK': {name:'ARK Innovation ETF',         category:'Innovation',    baseUSD:48,    color:'#ff6b6b', expense:0.75},
  'VNQ':  {name:'Vanguard Real Estate ETF',   category:'REIT',          baseUSD:84,    color:'#fb923c', expense:0.12},
  'EEM':  {name:'iShares MSCI Emerging Mkts', category:'EM',            baseUSD:42,    color:'#2dd4bf', expense:0.68},
  'AGG':  {name:'iShares US Aggregate Bond',  category:'Bond',          baseUSD:96,    color:'#84cc16', expense:0.03},
  'SCHD': {name:'Schwab US Dividend Equity',  category:'Dividend',      baseUSD:28,    color:'#e879f9', expense:0.06},
  'VGT':  {name:'Vanguard Info Technology',   category:'Tech',          baseUSD:515,   color:'#38bdf8', expense:0.10},
};

var ETF_CATEGORIES = {
  'Broad Market':  '#00c8ff',
  'Tech':          '#a78bfa',
  'Small Cap':     '#ffc107',
  'Komoditas':     '#f59e0b',
  'Bond':          '#34d399',
  'Financial':     '#60a5fa',
  'Innovation':    '#ff6b6b',
  'REIT':          '#fb923c',
  'EM':            '#2dd4bf',
  'Dividend':      '#e879f9',
};

// REKSA DANA DATABASE
var RD_DB = {
  'BIBIT-SAHAM':   {name:'Bibit Saham Indonesia',        mi:'PT Bibit Investasi Digital', type:'Saham',         baseNAB:2850,  risk:'Tinggi',   color:'#00e5a0'},
  'MITRA-SAHAM':   {name:'Mitra Dana Saham Perdana',     mi:'PT Mitra Asset Management',  type:'Saham',         baseNAB:4120,  risk:'Tinggi',   color:'#00c8ff'},
  'SCHRODER':      {name:'Schroder Dana Istimewa',       mi:'PT Schroder Investment Mgmt',type:'Saham',         baseNAB:6780,  risk:'Tinggi',   color:'#a78bfa'},
  'BNI-SAHAM':     {name:'BNI Dana Saham',               mi:'PT BNI Asset Management',    type:'Saham',         baseNAB:3450,  risk:'Tinggi',   color:'#4da6ff'},
  'MANULIFE-PT':   {name:'Manulife Pendapatan Tetap',    mi:'PT Manulife Aset Manajemen', type:'Pendapatan Tetap',baseNAB:1890, risk:'Sedang',  color:'#ffc107'},
  'BNI-PT':        {name:'BNI Dana Premium Plus',        mi:'PT BNI Asset Management',    type:'Pendapatan Tetap',baseNAB:2340, risk:'Sedang',  color:'#fb923c'},
  'MANDIRI-PT':    {name:'Mandiri Investa Dana Syariah', mi:'PT Mandiri Investasi',       type:'Pendapatan Tetap',baseNAB:1650, risk:'Sedang',  color:'#34d399'},
  'BIBIT-PU':      {name:'Bibit Pasar Uang',             mi:'PT Bibit Investasi Digital', type:'Pasar Uang',    baseNAB:1245,  risk:'Rendah',   color:'#2dd4bf'},
  'BCA-PU':        {name:'BCA Dana Tunai',               mi:'PT BCA Investment Mgmt',     type:'Pasar Uang',    baseNAB:1356,  risk:'Rendah',   color:'#c084fc'},
  'TRIM-PU':       {name:'Trim Kas 2',                   mi:'PT Trimegah Asset Mgmt',     type:'Pasar Uang',    baseNAB:1178,  risk:'Rendah',   color:'#60a5fa'},
  'CAMPURAN-GBK':  {name:'Garuda Biru Kencana',          mi:'PT Garuda Dana Investasi',   type:'Campuran',      baseNAB:3210,  risk:'Sedang',   color:'#f59e0b'},
  'CAMPURAN-HDI':  {name:'Hana Dinamika Indonesia',      mi:'PT Hana Asset Management',   type:'Campuran',      baseNAB:2780,  risk:'Sedang',   color:'#e879f9'},
};

var RD_TYPES = {
  'Saham':           {color:'#00c8ff', desc:'Risiko tinggi, return tertinggi, > 80% saham'},
  'Pendapatan Tetap':{color:'#00e5a0', desc:'Risiko sedang, obligasi & surat utang'},
  'Pasar Uang':      {color:'#ffc107', desc:'Risiko rendah, deposito & SBI, aman'},
  'Campuran':        {color:'#a78bfa', desc:'Kombinasi saham, obligasi & pasar uang'},
};

// ============================================================
// NEW STATE
// ============================================================
var cryptoTx = [];
var etfTx = [];
var rdTx = [];
var cryptoPrices = {};
var etfPrices = {};
var rdNAB = {};
var usdIdr = 17823.65; // kurs real dari XLSX
var nextCryptoId = 1;
var nextEtfId = 1;
var nextRdId = 1;

// ============================================================
// LOAD DATA REAL — CRYPTO, ETF, REKSA DANA
// ============================================================
function loadSampleCrypto(){
  usdIdr = XLSX_DATA.kurs_usd || 17823.65;
  XLSX_DATA.crypto.forEach(function(c){
    if(c.lot > 0){
      // Injeksi transaksi crypto contoh DIHAPUS — hanya daftarkan metadata coin
      var avgIdr = c.avg_idr || (c.modal > 0 && c.lot > 0 ? Math.round(c.modal/c.lot) : 0);
      CRYPTO_DB[c.code] = {
        name: c.name || c.code,
        category: 'Layer 1',
        baseIDR: c.price_idr || avgIdr || 1,
        color: c.code==='BTC' ? '#f7931a' : '#0033ad',
        icon: c.code[0]
      };
      // Set current price — LANGSUNG DALAM IDR (tanpa kurs USD)
      cryptoPrices[c.code] = c.price_idr;
    }
  });
}

function loadSampleEtf(){
  // Data ETF di jurnal kosong — skip
}

function loadSampleRd(){
  // Semua reksa dana SUDAH DICAIRKAN — tidak ada posisi aktif
  // Hanya daftarkan ke RD_DB untuk tampilan di tab Reksa Dana (mode riwayat)
  var rdColorMap = {'Saham':'#00c8ff','Pendapatan Tetap':'#00e5a0','Pasar Uang':'#ffc107','Campuran':'#a78bfa'};
  var rdRiskMap  = {'Saham':'Tinggi','Campuran':'Sedang','Pendapatan Tetap':'Sedang','Pasar Uang':'Rendah'};
  XLSX_DATA.funds.forEach(function(f, i){
    var key = 'RD-'+i;
    RD_DB[key] = {
      name: f.name.slice(0,35),
      mi:   f.account||'Bibit',
      type: f.category==='Pasar Uang'?'Pasar Uang':f.category==='Pendapatan Tetap'?'Pendapatan Tetap':f.category==='Saham'?'Saham':'Campuran',
      baseNAB: 1000,
      risk: rdRiskMap[f.category]||'Sedang',
      color: rdColorMap[f.category]||'#a78bfa',
      isHistory: true,
      gl: f.gl||0,
      gl_pct: f.gl_pct||0,
      status: f.status||'DICAIRKAN'
    };
    // TIDAK ada addRdTx karena tidak ada posisi aktif
  });
}

// ============================================================
// CRYPTO FUNCTIONS
// ============================================================
function updateCryptoPrices(){
  Object.keys(CRYPTO_DB).forEach(function(c){
    var base = CRYPTO_DB[c].baseIDR || cryptoPrices[c] || (CRYPTO_DB[c].baseUSD ? CRYPTO_DB[c].baseUSD*usdIdr : 1);
    cryptoPrices[c] = base * (1 + (Math.random()*0.05 - 0.025));
  });
}

function addCryptoTx(date,type,coin,qty,priceIdr){
  var isBuy = type==='BUY';
  var total = qty * priceIdr;
  cryptoTx.push({id:nextCryptoId++,date:date,type:type,coin:coin,qty:qty,priceIdr:priceIdr,total:total});
}

function getCryptoPortfolio(){
  var pos = {};
  cryptoTx.slice().sort(function(a,b){return a.date.localeCompare(b.date)}).forEach(function(tx){
    if(!pos[tx.coin]) pos[tx.coin] = {coin:tx.coin, qty:0, cost:0};
    var p = pos[tx.coin];
    if(tx.type==='BUY'){p.qty+=tx.qty; p.cost+=tx.total;}
    else if(tx.type==='SELL'){
      var avgCost = p.qty>0 ? p.cost/p.qty : 0;
      p.qty = Math.max(0, p.qty-tx.qty);
      p.cost = Math.max(0, p.cost - avgCost*tx.qty);
    }
  });
  return Object.values(pos).filter(function(p){return p.qty>0.000001}).map(function(p){
    var info = CRYPTO_DB[p.coin] || {name:p.coin, category:'Lainnya', baseIDR:0, color:'#4a5e82'};
    var priceIdr = cryptoPrices[p.coin] || info.baseIDR || (info.baseUSD ? info.baseUSD*usdIdr : 0) || 0;
    var priceUSD = usdIdr>0 ? priceIdr / usdIdr : 0;
    var mv = p.qty * priceIdr;
    var avg = p.qty>0 ? p.cost/p.qty : 0;
    var unreal = mv - p.cost;
    var ret = p.cost>0 ? (unreal/p.cost)*100 : 0;
    return Object.assign({},p,{info:info,priceUSD:priceUSD,priceIdr:priceIdr,mv:mv,avg:avg,unreal:unreal,ret:ret});
  });
}

function renderCrypto(){
  var porto = getCryptoPortfolio();
  var totalMV = porto.reduce(function(a,p){return a+p.mv},0);
  var totalCost = porto.reduce(function(a,p){return a+p.cost},0);
  var unreal = totalMV - totalCost;
  var best = porto.reduce(function(a,p){return p.ret>a.ret?p:a},{ret:-Infinity,coin:'-'});

  el('cr-total').textContent = 'Rp '+fmtK(totalMV);
  el('cr-total').className = 'mval lg';
  el('cr-total-sub').innerHTML = '<span class="'+(unreal>=0?'up':'dn')+'">'+(unreal>=0?'+':'')+'Rp '+fmtK(unreal)+'</span>';
  el('cr-modal').textContent = 'Rp '+fmtK(totalCost);
  el('cr-unreal').className = 'mval '+(unreal>=0?'up':'dn');
  el('cr-unreal').textContent = (unreal>=0?'+':'')+'Rp '+fmtK(unreal);
  var pct = totalCost>0 ? (unreal/totalCost*100).toFixed(2) : 0;
  el('cr-unreal-pct').innerHTML = '<span class="'+(unreal>=0?'up':'dn')+'">'+pct+'%</span>';
  el('cr-kurs').textContent = 'Rp '+fmt(Math.round(usdIdr));
  el('cr-best').textContent = best.coin!=='-' ? (best.ret>=0?'+':'')+best.ret.toFixed(2)+'%' : '-';
  el('cr-best').className = 'mval '+(best.ret>=0?'up':'dn');
  el('cr-best-sub').textContent = best.coin!=='-' ? best.coin : '';
  el('cr-cnt').textContent = porto.length+' aset';

  // Donut
  kc('cryptoDonut');
  var cvD = el('cryptoDonut');
  if(cvD && porto.length){
    var cols = porto.map(function(p){return p.info.color||'#4a5e82'});
    charts['cryptoDonut'] = new Chart(cvD,{type:'doughnut',data:{labels:porto.map(function(p){return p.coin}),datasets:[{data:porto.map(function(p){return p.mv}),backgroundColor:cols,borderWidth:0,hoverOffset:4}]},options:{responsive:true,maintainAspectRatio:false,cutout:'68%',plugins:{legend:{display:false},tooltip:Object.assign({},TT,{callbacks:{label:function(c){return c.label+': Rp '+fmtK(c.parsed)}}})}}});
  }
  var totV = totalMV||1;
  el('crypto-leg').innerHTML = porto.slice(0,8).map(function(p){return '<div style="display:flex;align-items:center;gap:7px;margin-bottom:5px"><div style="width:8px;height:8px;border-radius:2px;background:'+(p.info.color||'#4a5e82')+';flex-shrink:0"></div><span style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:var(--text2);flex:1">'+p.coin+'</span><span style="font-family:\'IBM Plex Mono\',monospace;font-size:11px">'+((p.mv/totV)*100).toFixed(1)+'%</span></div>'}).join('');

  // Price chart (BTC + ETH combined)
  kc('cryptoPrice');
  var cvP = el('cryptoPriceChart');
  if(cvP){
    var labels = Array.from({length:24},function(_,i){return i+1+'h'});
    var btcBase = (cryptoPrices['BTC']||1.3e9)/1e6;
    var btcData = labels.map(function(){return +(btcBase*(1+(Math.random()*0.04-0.02))).toFixed(2)});
    var ethBase = (cryptoPrices['ETH']||(3200*usdIdr))/1e6;
    var ethData = labels.map(function(){return +(ethBase*(1+(Math.random()*0.04-0.02))).toFixed(2)});
    charts['cryptoPrice'] = new Chart(cvP,{type:'line',data:{labels:labels,datasets:[{label:'BTC (jt)',data:btcData,borderColor:'#f7931a',borderWidth:2,fill:false,tension:.4,pointRadius:0},{label:'ETH (jt)',data:ethData,borderColor:'#627eea',borderWidth:2,fill:false,tension:.4,pointRadius:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:true,labels:{color:'#8fa3c8',font:{size:9}}},tooltip:Object.assign({},TT)},scales:{x:{grid:{color:GC},ticks:Object.assign({},TC,{maxTicksLimit:8})},y:{grid:{color:GC},ticks:Object.assign({},TC,{callback:function(v){return 'Rp '+fmtK(v*1e6)}}),position:'right'}}}});
  }

  // Table
  el('crypto-tbody').innerHTML = porto.map(function(p){
    var alloc = totalMV>0 ? (p.mv/totalMV*100) : 0;
    var sig = p.ret>10?'BUY':p.ret<-10?'SELL':'HOLD';
    var sigCls = sig==='BUY'?'sig-buy':sig==='SELL'?'sig-sell':'sig-hold';
    var catColor = CRYPTO_CATEGORIES[p.info.category]||'#4a5e82';
    var qtyDisp = p.qty < 0.001 ? p.qty.toFixed(6) : p.qty < 1 ? p.qty.toFixed(4) : p.qty.toFixed(2);
    return '<tr><td><span class="tp" style="border-color:'+(p.info.color||'#4a5e82')+'">'+p.coin+'</span></td><td style="font-size:11px;color:var(--text2)">'+p.info.name+'</td><td><span class="badge" style="background:rgba(255,255,255,.06);color:'+catColor+'">'+p.info.category+'</span></td><td class="mono">'+qtyDisp+'</td><td class="mono">Rp '+fmt(Math.round(p.avg))+'</td><td class="mono" style="color:var(--accent)">Rp '+fmt(Math.round(p.priceIdr))+'</td><td class="mono" style="color:var(--text2)">$'+p.priceUSD.toFixed(2)+'</td><td class="mono">Rp '+fmtK(p.mv)+'</td><td class="mono" style="color:var(--text2)">Rp '+fmtK(p.cost)+'</td><td class="mono '+(p.unreal>=0?'up':'dn')+'">'+(p.unreal>=0?'+':'')+'Rp '+fmtK(p.unreal)+'</td><td class="mono '+(p.ret>=0?'up':'dn')+'">'+(p.ret>=0?'+':'')+p.ret.toFixed(2)+'%</td><td><div class="prog" style="width:70px"><div class="progf" style="width:'+Math.min(alloc,100).toFixed(1)+'%;background:'+(p.info.color||'#4a5e82')+'"></div></div><div style="font-size:9px;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;margin-top:2px">'+alloc.toFixed(1)+'%</div></td><td><span class="sig '+sigCls+'">'+sig+'</span></td></tr>';
  }).join('')||'<tr><td colspan="13" style="text-align:center;color:var(--text3);padding:16px">Belum ada posisi crypto</td></tr>';

  // Tx history
  var pos3 = {};
  el('crypto-tx-tbody').innerHTML = cryptoTx.slice().sort(function(a,b){return b.date.localeCompare(a.date)}).map(function(tx){
    var isBuy = tx.type==='BUY';
    if(!pos3[tx.coin]) pos3[tx.coin]={qty:0,cost:0};
    var pnlHtml='—';
    if(!isBuy && pos3[tx.coin].qty>0){
      var avgC = pos3[tx.coin].cost/pos3[tx.coin].qty;
      var pnl = (tx.priceIdr - avgC)*tx.qty;
      pnlHtml='<span class="'+(pnl>=0?'up':'dn')+'">'+(pnl>=0?'+':'')+'Rp '+fmtK(pnl)+'</span>';
    }
    if(isBuy){pos3[tx.coin].qty+=tx.qty;pos3[tx.coin].cost+=tx.total;}
    var qtyDisp2 = tx.qty<0.001?tx.qty.toFixed(6):tx.qty<1?tx.qty.toFixed(4):tx.qty.toFixed(2);
    return '<tr><td class="mono" style="color:var(--text2);font-size:11px">'+tx.date+'</td><td><span class="badge '+(isBuy?'b-up':'b-dn')+'">'+tx.type+'</span></td><td><span class="tp">'+ tx.coin+'</span></td><td class="mono">'+qtyDisp2+'</td><td class="mono">Rp '+fmt(Math.round(tx.priceIdr))+'</td><td class="mono">Rp '+fmtK(tx.total)+'</td><td>'+pnlHtml+'</td><td><button class="btn btn-ghost btn-xs" style="color:var(--accent)" onclick="editCryptoTx('+tx.id+')" title="Edit transaksi">✎</button> <button class="btn btn-ghost btn-xs" style="color:var(--red)" onclick="delCryptoTx('+tx.id+')" title="Hapus transaksi">✕</button></td></tr>';
  }).join('')||'<tr><td colspan="8" style="text-align:center;color:var(--text3);padding:14px">Belum ada transaksi</td></tr>';
}

function delCryptoTx(id){
  if(confirm('Hapus transaksi crypto ini?')){
    cryptoTx=cryptoTx.filter(function(t){return t.id!==id});
    saveData();
    showSaveStatus('✓ Transaksi crypto dihapus');
    renderCrypto();
  }
}

function editCryptoTx(id){
  var tx = cryptoTx.find(function(t){ return t.id === id; });
  if(!tx) return;
  var isBuy = tx.type==='BUY';
  var coinOpts = Object.keys(CRYPTO_DB).map(function(c){
    return '<option value="'+c+'"'+(c===tx.coin?' selected':'')+'>'+c+' — '+CRYPTO_DB[c].name+'</option>';
  }).join('');

  el('m-title').textContent = 'Edit Transaksi Crypto — '+tx.coin;
  el('m-title').style.color = isBuy?'var(--green)':'var(--red)';
  el('m-body').innerHTML =
    '<div style="background:rgba(255,193,7,.07);border:1px solid rgba(255,193,7,.2);border-radius:7px;padding:8px 12px;margin-bottom:12px;font-size:11px;color:var(--amber)">'+
      '⚠️ Mengedit transaksi akan menghitung ulang posisi & P&L crypto secara otomatis.'+
    '</div>'+
    '<div class="fgrid">'+
      '<div class="fg ffull"><label class="flabel">Tanggal</label><input class="finput" type="date" id="ecr-date" value="'+tx.date+'"></div>'+
      '<div class="fg"><label class="flabel">Tipe</label><select class="finput fsel" id="ecr-type"><option value="BUY"'+(isBuy?' selected':'')+'>BUY — Beli</option><option value="SELL"'+(!isBuy?' selected':'')+'>SELL — Jual</option></select></div>'+
      '<div class="fg"><label class="flabel">Koin</label><select class="finput fsel" id="ecr-coin">'+coinOpts+'</select></div>'+
      '<div class="fg"><label class="flabel">Jumlah Koin</label><input class="finput" type="number" id="ecr-qty" value="'+tx.qty+'" step="0.0001" oninput="ecrCalcLive()"></div>'+
      '<div class="fg"><label class="flabel">Harga per Unit (IDR)</label><input class="finput" type="number" id="ecr-price" value="'+tx.priceIdr+'" oninput="ecrCalcLive()"></div>'+
    '</div>'+
    '<div class="taxbox">'+
      '<div style="font-size:9px;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;margin-bottom:7px">PREVIEW SETELAH EDIT</div>'+
      '<div class="taxrow"><span>Total Transaksi</span><span class="mono" id="ecr-tot">Rp '+fmt(Math.round(tx.total))+'</span></div>'+
    '</div>'+
    '<div style="margin-top:14px;display:flex;gap:8px;justify-content:flex-end">'+
      '<button class="btn btn-ghost" onclick="closeModal()">Batal</button>'+
      '<button class="btn btn-amber" onclick="updateCryptoTx('+id+')">💾 Simpan Perubahan</button>'+
    '</div>';
  el('modal').classList.add('on');
}

function ecrCalcLive(){
  var qty=parseFloat(el('ecr-qty')&&el('ecr-qty').value||0);
  var price=parseFloat(el('ecr-price')&&el('ecr-price').value||0);
  if(el('ecr-tot'))el('ecr-tot').textContent='Rp '+fmt(Math.round(qty*price));
}

function updateCryptoTx(id){
  var date=el('ecr-date').value;
  var type=el('ecr-type').value;
  var coin=el('ecr-coin').value;
  var qty=parseFloat(el('ecr-qty').value||0);
  var price=parseFloat(el('ecr-price').value||0);
  if(!date||!coin||qty<=0||price<=0){ alert('Lengkapi semua data!'); return; }

  var idx = cryptoTx.findIndex(function(t){ return t.id === id; });
  if(idx === -1){ alert('Transaksi tidak ditemukan'); return; }
  cryptoTx[idx] = {id:id, date:date, type:type, coin:coin, qty:qty, priceIdr:price, total:qty*price};

  saveData();
  showSaveStatus('✓ Transaksi crypto diperbarui');
  closeModal();
  renderCrypto();
}

function openCryptoModal(type){
  var isBuy = type==='BUY'||type==='buy';
  var coinOpts = Object.keys(CRYPTO_DB).map(function(c){return '<option value="'+c+'">'+c+' — '+CRYPTO_DB[c].name+'</option>'}).join('');
  var overlay = el('modal');
  el('m-title').textContent = isBuy?'Beli Aset Crypto':'Jual Aset Crypto';
  el('m-title').style.color = isBuy?'var(--green)':'var(--red)';
  el('m-body').innerHTML = '<div class="fgrid"><div class="fg ffull"><label class="flabel">Tanggal</label><input class="finput" type="date" id="mf-date" value="'+today()+'"></div><div class="fg"><label class="flabel">Koin</label><select class="finput fsel" id="cr-coin" onchange="crCalcLive()">'+coinOpts+'</select></div><div class="fg"><label class="flabel">Jumlah Koin</label><input class="finput" type="number" id="cr-qty" placeholder="0.01" step="0.0001" oninput="crCalcLive()"></div><div class="fg ffull"><label class="flabel">Harga per Unit (IDR)</label><input class="finput" type="number" id="cr-price" placeholder="Misal: 1050000000" oninput="crCalcLive()"></div></div><div class="taxbox"><div class="taxrow"><span>Total Transaksi</span><span class="mono" id="cr-tot">Rp 0</span></div></div><div style="margin-top:14px;display:flex;gap:8px;justify-content:flex-end"><button class="btn btn-ghost" onclick="closeModal()">Batal</button><button class="btn '+(isBuy?'btn-green':'btn-red')+'" onclick="submitCryptoModal(\''+type+'\')">Konfirmasi '+(isBuy?'Beli':'Jual')+'</button></div>';
  overlay.classList.add('on');
}

function crCalcLive(){
  var qty=parseFloat(el('cr-qty')&&el('cr-qty').value||0);
  var price=parseFloat(el('cr-price')&&el('cr-price').value||0);
  if(el('cr-tot'))el('cr-tot').textContent='Rp '+fmt(qty*price);
}

function submitCryptoModal(type){
  var date=el('mf-date').value;var coin=el('cr-coin').value;
  var qty=parseFloat(el('cr-qty').value||0);var price=parseFloat(el('cr-price').value||0);
  if(!date||!coin||qty<=0||price<=0){alert('Lengkapi semua data!');return;}
  addCryptoTx(date,type.toUpperCase(),coin,qty,price);
  saveData();
  showSaveStatus('✓ Transaksi crypto '+coin+' tersimpan');
  closeModal();renderCrypto();
}

// ============================================================
// ETF FUNCTIONS
// ============================================================
function updateEtfPrices(){
  Object.keys(ETF_DB).forEach(function(e){
    etfPrices[e] = ETF_DB[e].baseUSD * (1 + (Math.random()*0.04 - 0.02));
  });
}

function addEtfTx(date,type,ticker,shares,priceUSD,kurs){
  var totalUSD = shares*priceUSD;
  var totalIdr = totalUSD*(kurs||usdIdr);
  etfTx.push({id:nextEtfId++,date:date,type:type,ticker:ticker,shares:shares,priceUSD:priceUSD,totalUSD:totalUSD,totalIdr:totalIdr,kurs:kurs||usdIdr});
}

function getEtfPortfolio(){
  var pos = {};
  etfTx.slice().sort(function(a,b){return a.date.localeCompare(b.date)}).forEach(function(tx){
    if(!pos[tx.ticker]) pos[tx.ticker]={ticker:tx.ticker,shares:0,costUSD:0,costIdr:0};
    var p = pos[tx.ticker];
    if(tx.type==='BUY'){p.shares+=tx.shares;p.costUSD+=tx.totalUSD;p.costIdr+=tx.totalIdr;}
    else if(tx.type==='SELL'){
      var avgUSD=p.shares>0?p.costUSD/p.shares:0;
      var avgIdr=p.shares>0?p.costIdr/p.shares:0;
      p.shares=Math.max(0,p.shares-tx.shares);
      p.costUSD=Math.max(0,p.costUSD-avgUSD*tx.shares);
      p.costIdr=Math.max(0,p.costIdr-avgIdr*tx.shares);
    }
  });
  return Object.values(pos).filter(function(p){return p.shares>0}).map(function(p){
    var info=ETF_DB[p.ticker]||{name:p.ticker,category:'Lainnya',baseUSD:0,color:'#4a5e82'};
    var priceUSD=etfPrices[p.ticker]||info.baseUSD;
    var mvUSD=p.shares*priceUSD;
    var mvIdr=mvUSD*usdIdr;
    var avgUSD=p.shares>0?p.costUSD/p.shares:0;
    var unrUSD=mvUSD-p.costUSD;
    var unrIdr=mvIdr-p.costIdr;
    var ret=p.costIdr>0?(unrIdr/p.costIdr)*100:0;
    return Object.assign({},p,{info:info,priceUSD:priceUSD,mvUSD:mvUSD,mvIdr:mvIdr,avgUSD:avgUSD,unrUSD:unrUSD,unrIdr:unrIdr,ret:ret});
  });
}

function renderEtf(){
  var porto=getEtfPortfolio();
  var totalMVIdr=porto.reduce(function(a,p){return a+p.mvIdr},0);
  var totalMVUSD=porto.reduce(function(a,p){return a+p.mvUSD},0);
  var totalCostIdr=porto.reduce(function(a,p){return a+p.costIdr},0);
  var unrIdr=totalMVIdr-totalCostIdr;
  var best=porto.reduce(function(a,p){return p.ret>a.ret?p:a},{ret:-Infinity,ticker:'-'});

  el('etf-total').textContent='Rp '+fmtK(totalMVIdr);
  el('etf-total-sub').innerHTML='<span class="'+(unrIdr>=0?'up':'dn')+'">'+(unrIdr>=0?'+':'')+'Rp '+fmtK(unrIdr)+'</span>';
  el('etf-total-usd').textContent='$ '+fmtK(totalMVUSD);
  el('etf-unreal').className='mval '+(unrIdr>=0?'up':'dn');
  el('etf-unreal').textContent=(unrIdr>=0?'+':'')+'Rp '+fmtK(unrIdr);
  var pct=totalCostIdr>0?(unrIdr/totalCostIdr*100).toFixed(2):0;
  el('etf-unreal-pct').innerHTML='<span class="'+(unrIdr>=0?'up':'dn')+'">'+pct+'%</span>';
  el('etf-kurs').textContent='Rp '+fmt(Math.round(usdIdr));
  el('etf-best').textContent=best.ticker!=='-'?(best.ret>=0?'+':'')+best.ret.toFixed(2)+'%':'-';
  el('etf-best').className='mval '+(best.ret>=0?'up':'dn');
  el('etf-best-sub').textContent=best.ticker!=='-'?best.ticker:'';
  el('etf-cnt').textContent=porto.length+' ETF';

  // Donut
  kc('etfDonut');
  var cvE=el('etfDonut');
  if(cvE&&porto.length){
    var cols=porto.map(function(p){return p.info.color||'#4a5e82'});
    charts['etfDonut']=new Chart(cvE,{type:'doughnut',data:{labels:porto.map(function(p){return p.ticker}),datasets:[{data:porto.map(function(p){return p.mvIdr}),backgroundColor:cols,borderWidth:0,hoverOffset:4}]},options:{responsive:true,maintainAspectRatio:false,cutout:'68%',plugins:{legend:{display:false},tooltip:Object.assign({},TT,{callbacks:{label:function(c){return c.label+': Rp '+fmtK(c.parsed)}}})}}});
  }
  var totV2=totalMVIdr||1;
  el('etf-leg').innerHTML=porto.slice(0,8).map(function(p){return '<div style="display:flex;align-items:center;gap:7px;margin-bottom:5px"><div style="width:8px;height:8px;border-radius:2px;background:'+(p.info.color||'#4a5e82')+';flex-shrink:0"></div><span style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:var(--text2);flex:1">'+p.ticker+'</span><span style="font-family:\'IBM Plex Mono\',monospace;font-size:11px">'+((p.mvIdr/totV2)*100).toFixed(1)+'%</span></div>'}).join('');

  // Category breakdown
  var byCat={};porto.forEach(function(p){var cat=p.info.category;if(!byCat[cat])byCat[cat]={mv:0,cnt:0};byCat[cat].mv+=p.mvIdr;byCat[cat].cnt++;});
  el('etf-category').innerHTML=Object.entries(byCat).sort(function(a,b){return b[1].mv-a[1].mv}).map(function(e){
    var cat=e[0],d=e[1];var col=ETF_CATEGORIES[cat]||'#4a5e82';var pctCat=(d.mv/totalMVIdr*100);
    return '<div style="margin-bottom:9px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px"><div style="display:flex;align-items:center;gap:6px"><span class="sec-dot" style="background:'+col+'"></span><span style="font-size:11px;font-weight:600">'+cat+'</span></div><span style="font-family:\'IBM Plex Mono\',monospace;font-size:10px">'+pctCat.toFixed(1)+'%</span></div><div class="prog"><div class="progf" style="width:'+pctCat.toFixed(1)+'%;background:'+col+'"></div></div><div style="font-size:9px;color:var(--text3);margin-top:2px">'+d.cnt+' ETF · Rp '+fmtK(d.mv)+'</div></div>';
  }).join('')||'<div style="color:var(--text3);text-align:center;padding:16px">Belum ada ETF</div>';

  // Table
  el('etf-tbody').innerHTML=porto.map(function(p){
    var alloc=totalMVIdr>0?(p.mvIdr/totalMVIdr*100):0;
    var sig=p.ret>8?'BUY':p.ret<-8?'SELL':'HOLD';
    var sigCls=sig==='BUY'?'sig-buy':sig==='SELL'?'sig-sell':'sig-hold';
    var catCol=ETF_CATEGORIES[p.info.category]||'#4a5e82';
    return '<tr><td><span class="tp" style="border-color:'+(p.info.color||'#4a5e82')+'">'+p.ticker+'</span></td><td style="font-size:11px;color:var(--text2)">'+p.info.name+'</td><td><span class="badge" style="background:rgba(255,255,255,.06);color:'+catCol+'">'+p.info.category+'</span></td><td class="mono">'+p.shares+'</td><td class="mono">$'+p.avgUSD.toFixed(2)+'</td><td class="mono" style="color:var(--accent)">$'+p.priceUSD.toFixed(2)+'</td><td class="mono">Rp '+fmtK(p.mvIdr)+'</td><td class="mono" style="color:var(--text2)">Rp '+fmtK(p.costIdr)+'</td><td class="mono '+(p.unrIdr>=0?'up':'dn')+'">'+(p.unrIdr>=0?'+':'')+'Rp '+fmtK(p.unrIdr)+'</td><td class="mono '+(p.unrUSD>=0?'up':'dn')+'">'+(p.unrUSD>=0?'+':'')+'$'+Math.abs(p.unrUSD).toFixed(2)+'</td><td class="mono '+(p.ret>=0?'up':'dn')+'">'+(p.ret>=0?'+':'')+p.ret.toFixed(2)+'%</td><td><div class="prog" style="width:70px"><div class="progf" style="width:'+Math.min(alloc,100).toFixed(1)+'%;background:'+(p.info.color||'#4a5e82')+'"></div></div><div style="font-size:9px;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;margin-top:2px">'+alloc.toFixed(1)+'%</div></td><td><span class="sig '+sigCls+'">'+sig+'</span></td></tr>';
  }).join('')||'<tr><td colspan="13" style="text-align:center;color:var(--text3);padding:16px">Belum ada posisi ETF</td></tr>';

  // Tx history
  var posE={};
  el('etf-tx-tbody').innerHTML=etfTx.slice().sort(function(a,b){return b.date.localeCompare(a.date)}).map(function(tx){
    var isBuy=tx.type==='BUY';
    if(!posE[tx.ticker])posE[tx.ticker]={shares:0,costUSD:0};
    var pnlHtml='—';
    if(!isBuy&&posE[tx.ticker].shares>0){
      var avgU=posE[tx.ticker].costUSD/posE[tx.ticker].shares;
      var pnlUSD=(tx.priceUSD-avgU)*tx.shares;
      var pnlIdr=pnlUSD*tx.kurs;
      pnlHtml='<span class="'+(pnlIdr>=0?'up':'dn')+'">'+(pnlIdr>=0?'+':'')+'Rp '+fmtK(pnlIdr)+'</span>';
    }
    if(isBuy){posE[tx.ticker].shares+=tx.shares;posE[tx.ticker].costUSD+=tx.totalUSD;}
    return '<tr><td class="mono" style="color:var(--text2);font-size:11px">'+tx.date+'</td><td><span class="badge '+(isBuy?'b-up':'b-dn')+'">'+tx.type+'</span></td><td><span class="tp">'+tx.ticker+'</span></td><td class="mono">'+tx.shares+'</td><td class="mono">$'+tx.priceUSD.toFixed(2)+'</td><td class="mono">$'+tx.totalUSD.toFixed(2)+'</td><td class="mono">Rp '+fmtK(tx.totalIdr)+'</td><td class="mono" style="color:var(--text2)">'+fmt(Math.round(tx.kurs))+'</td><td>'+pnlHtml+'</td><td><button class="btn btn-ghost btn-xs" style="color:var(--red)" onclick="delEtfTx('+tx.id+')">✕</button></td></tr>';
  }).join('')||'<tr><td colspan="10" style="text-align:center;color:var(--text3);padding:14px">Belum ada transaksi</td></tr>';
}

function delEtfTx(id){
  if(confirm('Hapus transaksi ETF ini?')){
    etfTx=etfTx.filter(function(t){return t.id!==id});
    saveData();
    showSaveStatus('✓ Transaksi ETF dihapus');
    renderEtf();
  }
}

function openEtfModal(type){
  var isBuy=type==='BUY'||type==='buy';
  var tOpts=Object.keys(ETF_DB).map(function(t){return '<option value="'+t+'">'+t+' — '+ETF_DB[t].name+'</option>'}).join('');
  el('m-title').textContent=isBuy?'Beli ETF Amerika':'Jual ETF Amerika';
  el('m-title').style.color=isBuy?'var(--green)':'var(--red)';
  el('m-body').innerHTML='<div class="fgrid"><div class="fg ffull"><label class="flabel">Tanggal</label><input class="finput" type="date" id="mf-date" value="'+today()+'"></div><div class="fg"><label class="flabel">Ticker ETF</label><select class="finput fsel" id="etf-ticker" onchange="etfCalcLive()">'+tOpts+'</select></div><div class="fg"><label class="flabel">Jumlah Lembar</label><input class="finput" type="number" id="etf-shares" placeholder="1" min="1" oninput="etfCalcLive()"></div><div class="fg"><label class="flabel">Harga (USD)</label><input class="finput" type="number" id="etf-price" placeholder="Harga pasar" oninput="etfCalcLive()"></div><div class="fg ffull"><label class="flabel">Kurs USD/IDR</label><input class="finput" type="number" id="etf-kurs-inp" value="'+Math.round(usdIdr)+'" oninput="etfCalcLive()"></div></div><div class="taxbox"><div style="font-size:9px;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;margin-bottom:7px">RINCIAN TRANSAKSI</div><div class="taxrow"><span>Total USD</span><span class="mono" id="etf-tot-usd">$ 0</span></div><div class="taxrow tot"><span>Total IDR</span><span class="mono '+(isBuy?'amb':'up')+'" id="etf-tot-idr">Rp 0</span></div></div><div style="margin-top:14px;display:flex;gap:8px;justify-content:flex-end"><button class="btn btn-ghost" onclick="closeModal()">Batal</button><button class="btn '+(isBuy?'btn-green':'btn-red')+'" onclick="submitEtfModal(\''+type+'\')">Konfirmasi '+(isBuy?'Beli':'Jual')+'</button></div>';
  var info=ETF_DB[Object.keys(ETF_DB)[0]];
  setTimeout(function(){
    var tick=el('etf-ticker')&&el('etf-ticker').value;
    if(tick&&ETF_DB[tick])el('etf-price').value=ETF_DB[tick].baseUSD;
    etfCalcLive();
  },50);
  el('modal').classList.add('on');
}

function etfCalcLive(){
  var shares=parseFloat(el('etf-shares')&&el('etf-shares').value||0);
  var price=parseFloat(el('etf-price')&&el('etf-price').value||0);
  var kursInp=parseFloat(el('etf-kurs-inp')&&el('etf-kurs-inp').value||usdIdr);
  var totUSD=shares*price;var totIdr=totUSD*kursInp;
  if(el('etf-tot-usd'))el('etf-tot-usd').textContent='$ '+totUSD.toFixed(2);
  if(el('etf-tot-idr'))el('etf-tot-idr').textContent='Rp '+fmt(Math.round(totIdr));
}

function submitEtfModal(type){
  var date=el('mf-date').value;var ticker=el('etf-ticker').value;
  var shares=parseFloat(el('etf-shares').value||0);var price=parseFloat(el('etf-price').value||0);
  var kursInp=parseFloat(el('etf-kurs-inp').value||usdIdr);
  if(!date||!ticker||shares<=0||price<=0){alert('Lengkapi semua data!');return;}
  addEtfTx(date,type.toUpperCase(),ticker,shares,price,kursInp);
  saveData();
  showSaveStatus('✓ Transaksi ETF '+ticker+' tersimpan');
  closeModal();renderEtf();
}

// ============================================================
// REKSA DANA FUNCTIONS
// ============================================================
function updateRdNAB(){
  Object.keys(RD_DB).forEach(function(r){
    rdNAB[r] = RD_DB[r].baseNAB * (1 + (Math.random()*0.02 - 0.008));
  });
}

function addRdTx(date,type,code,amount,nab){
  var units = amount / nab;
  rdTx.push({id:nextRdId++, date:date, type:type, code:code,
             amount:amount, nab:nab, units:units, _userInput:true});
}

function getRdPortfolio(){
  var pos={};
  rdTx.slice().sort(function(a,b){return a.date.localeCompare(b.date)}).forEach(function(tx){
    if(!pos[tx.code])pos[tx.code]={code:tx.code,units:0,cost:0};
    var p=pos[tx.code];
    if(tx.type==='BELI'){p.units+=tx.units;p.cost+=tx.amount;}
    else if(tx.type==='JUAL'){
      var avgNAB=p.units>0?p.cost/p.units:0;
      p.units=Math.max(0,p.units-tx.units);
      p.cost=Math.max(0,p.cost-avgNAB*tx.units);
    }
  });
  return Object.values(pos).filter(function(p){return p.units>0.001}).map(function(p){
    var info=RD_DB[p.code]||{name:p.code,type:'Lainnya',mi:'',baseNAB:1000,risk:'Sedang',color:'#4a5e82'};
    var nab=rdNAB[p.code]||info.baseNAB;
    var mv=p.units*nab;
    var avgNAB=p.units>0?p.cost/p.units:0;
    var unreal=mv-p.cost;
    var ret=p.cost>0?(unreal/p.cost)*100:0;
    return Object.assign({},p,{info:info,nab:nab,mv:mv,avgNAB:avgNAB,unreal:unreal,ret:ret});
  });
}

var _rdHistoryFilter = 'all';
function rdFilterPlatform(plat, btn){
  _rdHistoryFilter = plat;
  document.querySelectorAll('#page-reksadana .cheader .btn').forEach(function(b){ b.style.color=''; });
  if(btn) btn.style.color='var(--accent)';
  renderReksaDana();
}

function renderReksaDana(){
  // ── Data dari XLSX (semua sudah dicairkan) ──
  var funds = XLSX_DATA.funds;
  var totalGain = funds.reduce(function(a,f){return a+(f.gl||0)},0);
  var mc = XLSX_DATA.fund_margin_by_cat;

  var gainBIBIT  = mc.BIBIT  ? (mc.BIBIT.Saham  + mc.BIBIT.FixedIncome  + mc.BIBIT.MoneyMarket)  : 0;
  var gainIPOT   = mc.IPOT   ? (mc.IPOT.Saham   + mc.IPOT.FixedIncome   + mc.IPOT.MoneyMarket)   : 0;
  var gainPOEMS  = mc.POEMS  ? (mc.POEMS.Saham  + mc.POEMS.FixedIncome  + mc.POEMS.MoneyMarket)  : 0;

  // ── Posisi aktif dari rdTx ──
  var porto = getRdPortfolio();
  var aktivMV = porto.reduce(function(a,p){return a+p.mv},0);

  // ── Metrics ──
  el('rd-total').textContent = 'Rp '+fmtK(totalGain);
  el('rd-gain-bibit').textContent  = 'Rp '+fmtK(gainBIBIT);
  el('rd-gain-bibit-sub').textContent = Object.keys(mc.BIBIT||{}).length+' kategori';
  el('rd-gain-ipot').className = 'mval '+(gainIPOT>=0?'up':'dn');
  el('rd-gain-ipot').textContent   = (gainIPOT>=0?'+':'')+'Rp '+fmtK(gainIPOT);
  el('rd-gain-ipot-sub').textContent = 'IPOT platform';
  el('rd-gain-poems').textContent  = 'Rp '+fmtK(gainPOEMS);
  el('rd-gain-poems-sub').textContent = 'POEMS platform';
  el('rd-aktif-val').textContent   = aktivMV>0 ? 'Rp '+fmtK(aktivMV) : 'Rp 0';
  el('rd-aktif-val').className     = 'mval '+(aktivMV>0?'up':'neu');
  el('rd-aktif-sub').textContent   = aktivMV>0 ? porto.length+' produk aktif' : '0 produk (semua dicairkan)';

  // ── Chart: gain per kategori ──
  kc('rdPerf');
  var catGain = {};
  funds.forEach(function(f){ catGain[f.category] = (catGain[f.category]||0) + (f.gl||0); });
  var catKeys = Object.keys(catGain).sort(function(a,b){return catGain[b]-catGain[a]});
  var catColors = {'Pasar Uang':'#ffc107','Pendapatan Tetap':'#00e5a0','Saham':'#00c8ff','Campuran':'#a78bfa'};
  var cvP = el('rdPerfChart');
  if(cvP) charts['rdPerf'] = new Chart(cvP,{
    type:'bar',
    data:{labels:catKeys,datasets:[{
      data:catKeys.map(function(c){return catGain[c]}),
      backgroundColor:catKeys.map(function(c){return (catGain[c]>=0?'rgba(0,229,160,.7)':'rgba(255,61,90,.6)')}),
      borderRadius:4
    }]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:Object.assign({},TT,{callbacks:{label:function(c){return 'Gain: Rp '+fmtK(c.parsed.y)}}})},
      scales:{x:{grid:{color:GC},ticks:TC},y:{grid:{color:GC},ticks:Object.assign({},TC,{callback:function(v){return 'Rp '+fmtK(v)}}),position:'right'}}}
  });

  // ── Chart: donut per platform ──
  kc('rdDonut');
  var platData = [
    {label:'BIBIT',  val:gainBIBIT,  color:'#00c8ff'},
    {label:'IPOT',   val:gainIPOT,   color:'#a78bfa'},
    {label:'POEMS',  val:gainPOEMS,  color:'#ffc107'},
  ].filter(function(p){return p.val>0});
  var cvD = el('rdDonut');
  if(cvD && platData.length) charts['rdDonut'] = new Chart(cvD,{
    type:'doughnut',
    data:{labels:platData.map(function(p){return p.label}),
          datasets:[{data:platData.map(function(p){return p.val}),
                     backgroundColor:platData.map(function(p){return p.color}),borderWidth:0,hoverOffset:4}]},
    options:{responsive:true,maintainAspectRatio:false,cutout:'65%',
      plugins:{legend:{display:false},tooltip:Object.assign({},TT,{callbacks:{label:function(c){return c.label+': Rp '+fmtK(c.parsed)}}})}}
  });
  var totalPlatGain = gainBIBIT+gainIPOT+gainPOEMS||1;
  el('rd-leg').innerHTML = platData.map(function(p){
    return '<div style="display:flex;align-items:center;gap:7px;margin-bottom:7px">'
      +'<div style="width:8px;height:8px;border-radius:2px;background:'+p.color+';flex-shrink:0"></div>'
      +'<span style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:var(--text2);flex:1">'+p.label+'</span>'
      +'<span style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:'+p.color+';font-weight:700">'+(p.val/totalPlatGain*100).toFixed(1)+'%</span>'
      +'<span style="font-family:\'IBM Plex Mono\',monospace;font-size:10px;color:var(--text3);min-width:55px;text-align:right">'+fmtK(p.val)+'</span>'
      +'</div>';
  }).join('');

  // ── Tabel posisi aktif (rdTx) ──
  el('rd-tbody').innerHTML = porto.length===0
    ? '<tr><td colspan="10" style="text-align:center;color:var(--text3);padding:16px">Belum ada posisi aktif — gunakan + Beli RD untuk menambahkan</td></tr>'
    : porto.map(function(p){
        var info = RD_DB[p.code]||{name:p.code,type:'?',mi:'',color:'#4a5e82',risk:'?'};
        var col  = (RD_TYPES[info.type]||{color:'#4a5e82'}).color;
        var riskCls = info.risk==='Tinggi'?'b-dn':info.risk==='Sedang'?'b-amb':'b-up';
        return '<tr>'
          +'<td style="font-size:11px">'+info.name+'</td>'
          +'<td><span class="badge" style="background:rgba(255,255,255,.06);color:'+col+'">'+info.type+'</span></td>'
          +'<td style="font-size:10px;color:var(--text2)">'+info.mi+'</td>'
          +'<td class="mono">'+p.units.toFixed(2)+'</td>'
          +'<td class="mono" style="color:var(--text2)">Rp '+fmt(Math.round(p.avgNAB))+'</td>'
          +'<td class="mono" style="color:var(--accent)">Rp '+fmt(Math.round(p.nab))+'</td>'
          +'<td class="mono">Rp '+fmtK(p.mv)+'</td>'
          +'<td class="mono '+(p.unreal>=0?'up':'dn')+'">'+(p.unreal>=0?'+':'')+'Rp '+fmtK(p.unreal)+'</td>'
          +'<td class="mono '+(p.ret>=0?'up':'dn')+'">'+(p.ret>=0?'+':'')+p.ret.toFixed(2)+'%</td>'
          +'<td><span class="badge '+riskCls+'">'+info.risk+'</span></td>'
          +'<td><button class="btn btn-ghost btn-xs" style="color:var(--red)" onclick="openRdModal(\'jual\')" title="Jual posisi">− Jual</button></td>'
          +'</tr>';
    }).join('');

  // ── History table dari XLSX ──
  var filtered = _rdHistoryFilter==='all' ? funds : funds.filter(function(f){return f.account===_rdHistoryFilter});
  el('rd-history-tbody').innerHTML = filtered.map(function(f){
    var col = {'Pasar Uang':'#ffc107','Pendapatan Tetap':'#00e5a0','Saham':'#00c8ff','Campuran':'#a78bfa'}[f.category]||'#4a5e82';
    var gl = f.gl||0;
    var pct = f.gl_pct||0;
    var accBadge = f.account==='BIBIT'?'b-neu':f.account==='IPOT'?'b-pur':'b-amb';
    return '<tr>'
      +'<td style="font-size:11px">'+f.name+'</td>'
      +'<td><span class="badge" style="background:rgba(255,255,255,.05);color:'+col+'">'+f.category+'</span></td>'
      +'<td><span class="badge '+accBadge+'">'+f.account+'</span></td>'
      +'<td class="mono '+(gl>=0?'up':'dn')+'">'+(gl>=0?'+':'')+'Rp '+fmtK(gl)+'</td>'
      +'<td class="mono '+(pct>=0?'up':'dn')+'">'+(pct>=0?'+':'')+pct.toFixed(2)+'%</td>'
      +'<td class="mono" style="color:var(--text3)">—</td>'
      +'<td><span class="badge b-gray" style="font-size:9px">DICAIRKAN</span></td>'
      +'</tr>';
  }).join('')||'<tr><td colspan="7" style="text-align:center;color:var(--text3);padding:14px">Tidak ada data</td></tr>';

  // ── Log transaksi user ──
  var posRd={};
  el('rd-tx-tbody').innerHTML = rdTx.slice().sort(function(a,b){return b.date.localeCompare(a.date)}).map(function(tx){
    var isBeli=tx.type==='BELI';
    if(!posRd[tx.code])posRd[tx.code]={units:0,cost:0};
    var pnlHtml='—';
    if(!isBeli&&posRd[tx.code].units>0){
      var avgN=posRd[tx.code].cost/posRd[tx.code].units;
      var pnl=(tx.nab-avgN)*tx.units;
      pnlHtml='<span class="'+(pnl>=0?'up':'dn')+'">'+(pnl>=0?'+':'')+'Rp '+fmtK(pnl)+'</span>';
    }
    if(isBeli){posRd[tx.code].units+=tx.units;posRd[tx.code].cost+=tx.amount;}
    var rdInfo=RD_DB[tx.code]||{name:tx.code,type:'?',color:'#4a5e82'};
    var tCol=(RD_TYPES[rdInfo.type]||{color:'#4a5e82'}).color;
    return '<tr>'
      +'<td class="mono" style="color:var(--text2);font-size:11px">'+tx.date+'</td>'
      +'<td><span class="badge '+(isBeli?'b-up':'b-dn')+'">'+tx.type+'</span></td>'
      +'<td><span style="font-size:11px">'+rdInfo.name+'</span> <span class="badge" style="background:rgba(255,255,255,.05);color:'+tCol+'">'+rdInfo.type+'</span></td>'
      +'<td class="mono">'+tx.units.toFixed(2)+'</td>'
      +'<td class="mono">Rp '+fmt(Math.round(tx.nab))+'</td>'
      +'<td class="mono">Rp '+fmtK(tx.amount)+'</td>'
      +'<td>'+pnlHtml+'</td>'
      +'<td><button class="btn btn-ghost btn-xs" style="color:var(--amber)" onclick="editRdTx('+tx.id+')" title="Edit transaksi">✎</button> <button class="btn btn-ghost btn-xs" style="color:var(--red)" onclick="delRdTx('+tx.id+')">✕</button></td>'
      +'</tr>';
  }).join('')||'<tr><td colspan="8" style="text-align:center;color:var(--text3);padding:14px">Belum ada transaksi manual</td></tr>';
}

function delRdTx(id){
  if(confirm('Hapus transaksi reksa dana ini?')){
    rdTx=rdTx.filter(function(t){return t.id!==id});
    saveData();
    showSaveStatus('✓ Transaksi reksa dana dihapus');
    renderReksaDana();
  }
}

function editRdTx(id){
  var tx=rdTx.find(function(t){return t.id===id;});
  if(!tx){alert('Transaksi tidak ditemukan');return;}
  var rdOpts=Object.keys(RD_DB).map(function(c){var rdi=RD_DB[c];return '<option value="'+c+'"'+(c===tx.code?' selected':'')+'>'+rdi.name+' ('+rdi.type+')</option>';}).join('');
  el('m-title').textContent='Edit Transaksi Reksa Dana';
  el('m-title').style.color='var(--amber)';
  el('m-body').innerHTML=''
    +'<div class="fgrid">'
    +'<div class="fg ffull"><label class="flabel">Tanggal</label><input class="finput" type="date" id="ed-rd-date" value="'+tx.date+'"></div>'
    +'<div class="fg ffull"><label class="flabel">Reksa Dana</label><select class="finput fsel" id="ed-rd-code">'+rdOpts+'</select></div>'
    +'<div class="fg ffull"><label class="flabel">Jenis</label>'
    +'<select class="finput fsel" id="ed-rd-type">'
    +'<option value="BELI"'+(tx.type==='BELI'?' selected':'')+'>BELI</option>'
    +'<option value="JUAL"'+(tx.type==='JUAL'?' selected':'')+'>JUAL</option>'
    +'</select></div>'
    +'<div class="fg ffull"><label class="flabel">Jumlah (Rp)</label><input class="finput" type="number" id="ed-rd-amount" value="'+Math.round(tx.amount)+'"></div>'
    +'<div class="fg ffull"><label class="flabel">NAB per Unit (Rp)</label><input class="finput" type="number" id="ed-rd-nab" value="'+Math.round(tx.nab)+'"></div>'
    +'</div>'
    +'<div class="taxbox" style="margin-top:10px">'
    +'<div class="taxrow"><span>Unit = Jumlah / NAB</span><span class="mono" style="color:var(--amber)" id="ed-rd-units">'+tx.units.toFixed(2)+' unit</span></div>'
    +'</div>'
    +'<div style="margin-top:14px;display:flex;gap:8px;justify-content:flex-end">'
    +'<button class="btn btn-ghost" onclick="closeModal()">Batal</button>'
    +'<button class="btn btn-amber" onclick="submitEditRdTx('+id+')">Simpan Perubahan</button>'
    +'</div>';

  // Live recalc units
  function rdEditCalc(){
    var amt=parseFloat(el('ed-rd-amount')&&el('ed-rd-amount').value||0);
    var nab=parseFloat(el('ed-rd-nab')&&el('ed-rd-nab').value||1);
    var units=nab>0?amt/nab:0;
    if(el('ed-rd-units')) el('ed-rd-units').textContent=units.toFixed(2)+' unit';
  }
  setTimeout(function(){
    if(el('ed-rd-amount')) el('ed-rd-amount').oninput=rdEditCalc;
    if(el('ed-rd-nab')) el('ed-rd-nab').oninput=rdEditCalc;
  },50);
  el('modal').classList.add('on');
}

function submitEditRdTx(id){
  var date=el('ed-rd-date').value;
  var code=el('ed-rd-code').value;
  var type=el('ed-rd-type').value;
  var amount=parseFloat(el('ed-rd-amount').value||0);
  var nab=parseFloat(el('ed-rd-nab').value||0);
  if(!date||!code||amount<=0||nab<=0){alert('Lengkapi semua data!');return;}
  var units=amount/nab;
  var idx=rdTx.findIndex(function(t){return t.id===id;});
  if(idx<0){alert('Transaksi tidak ditemukan');return;}
  rdTx[idx]=Object.assign(rdTx[idx],{date:date,code:code,type:type,amount:amount,nab:nab,units:units,_userInput:true});
  saveData();
  showSaveStatus('✓ Transaksi reksa dana diperbarui');
  closeModal();
  renderReksaDana();
}

function openRdModal(type){
  var isBeli=type==='BELI'||type==='beli';
  var rdOpts=Object.keys(RD_DB).map(function(c){var rdi=RD_DB[c];return '<option value="'+c+'">'+rdi.name+' ('+rdi.type+')</option>'}).join('');
  el('m-title').textContent=isBeli?'Beli Reksa Dana':'Jual Reksa Dana';
  el('m-title').style.color=isBeli?'var(--green)':'var(--red)';
  el('m-body').innerHTML='<div class="fgrid"><div class="fg ffull"><label class="flabel">Tanggal</label><input class="finput" type="date" id="mf-date" value="'+today()+'"></div><div class="fg ffull"><label class="flabel">Reksa Dana</label><select class="finput fsel" id="rd-code" onchange="rdCalcLive()">'+rdOpts+'</select></div><div class="fg ffull"><label class="flabel">'+(isBeli?'Jumlah Investasi (Rp)':'Jumlah Jual (Rp)')+'</label><input class="finput" type="number" id="rd-amount" placeholder="'+(isBeli?'Contoh: 1000000':'Contoh: 500000')+'" oninput="rdCalcLive()"></div><div class="fg ffull"><label class="flabel">NAB per Unit (Rp)</label><input class="finput" type="number" id="rd-nab" placeholder="NAB saat ini" oninput="rdCalcLive()"></div></div><div class="taxbox"><div style="font-size:9px;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;margin-bottom:7px">RINCIAN '+(isBeli?'PEMBELIAN':'PENJUALAN')+'</div><div class="taxrow"><span>Unit Diperoleh</span><span class="mono" id="rd-units-prev">0.00 unit</span></div><div class="taxrow tot"><span>'+(isBeli?'Total Invest':'Total Jual')+'</span><span class="mono up" id="rd-amt-prev">Rp 0</span></div></div><div style="margin-top:14px;display:flex;gap:8px;justify-content:flex-end"><button class="btn btn-ghost" onclick="closeModal()">Batal</button><button class="btn '+(isBeli?'btn-green':'btn-red')+'" onclick="submitRdModal(\''+type+'\')">Konfirmasi '+(isBeli?'Beli':'Jual')+'</button></div>';
  setTimeout(function(){
    var code=el('rd-code')&&el('rd-code').value;
    if(code&&RD_DB[code])el('rd-nab').value=Math.round(rdNAB[code]||RD_DB[code].baseNAB);
    rdCalcLive();
  },50);
  el('modal').classList.add('on');
}

function rdCalcLive(){
  var amt=parseFloat(el('rd-amount')&&el('rd-amount').value||0);
  var nab=parseFloat(el('rd-nab')&&el('rd-nab').value||1);
  var units=nab>0?amt/nab:0;
  if(el('rd-units-prev'))el('rd-units-prev').textContent=units.toFixed(2)+' unit';
  if(el('rd-amt-prev'))el('rd-amt-prev').textContent='Rp '+fmt(Math.round(amt));
}

function submitRdModal(type){
  var date=el('mf-date').value;var code=el('rd-code').value;
  var amount=parseFloat(el('rd-amount').value||0);var nab=parseFloat(el('rd-nab').value||0);
  if(!date||!code||amount<=0||nab<=0){alert('Lengkapi semua data!');return;}
  addRdTx(date,type.toUpperCase(),code,amount,nab);
  saveData();
  showSaveStatus('✓ Reksa dana tersimpan — dashboard diperbarui');
  closeModal();
  // Render page yang relevan dan sync dashboard
  renderReksaDana();
  // Jika user sedang di dashboard, refresh juga
  if(currentPage==='dashboard') renderDashboard();
}



function closeModal(){el('modal').classList.remove('on')}

function updateAmtPreview(){
  var v=parseFloat(el('mf-amount').value||0);
  el('amt-preview').textContent='Rp '+fmt(v);
}

function onSecChange(){
  txCalcLive();
}
function prefillPrice(){
  var t=el('mf-ticker').value;
  if(t&&(prices[t]||DB[t])){el('mf-price').value=prices[t]||DB[t].base||0;txCalcLive();}
}
function prefillShares(){
  var t=el('mf-ticker').value;var porto=getPortfolio();
  var p=porto.find(function(pp){return pp.ticker===t});
  if(p){el('mf-shares').value=p.shares;}divCalcLive();
}

function txCalcLive(){
  var secName = el('mf-sec')&&el('mf-sec').value||activeSekuritas;
  var sec     = SEKURITAS[secName]||SEKURITAS['Mirae Asset'];
  var isBuy   = modalType==='buy';
  var lot     = parseFloat(el('mf-lot')&&el('mf-lot').value||0);
  var price   = parsePrice(el('mf-price')&&el('mf-price').value||'0');
  var gross   = lot*100*price;
  var c       = calcTxComponents(gross, isBuy, secName);
  // FIX: label komisi harus memakai tarif EFEKTIF (termasuk override per sekuritas), bukan tarif default
  var feeRate = c.komisiRate;
  if(el('mc-g'))       el('mc-g').textContent = 'Rp '+fmt(gross);
  if(el('mc-k-lbl'))   el('mc-k-lbl').textContent = 'Komisi '+(isBuy?'Beli':'Jual')+' ('+(feeRate*100).toFixed(2)+'%)';
  if(el('mc-k'))       el('mc-k').textContent = 'Rp '+fmt(c.komisi);
  if(el('mc-ppn-lbl')) el('mc-ppn-lbl').textContent = 'PPN '+(TAX_SETTINGS.ppn*100).toFixed(0)+'% × Komisi';
  if(el('mc-ppn'))     el('mc-ppn').textContent = 'Rp '+fmt(c.ppn);
  if(el('mc-levy'))    el('mc-levy').textContent = 'Rp '+fmt(c.levy);
  if(el('mc-pph'))     el('mc-pph').textContent = 'Rp '+fmt(c.pph);
  if(el('mc-tot'))     el('mc-tot').textContent = 'Rp '+fmt(c.net);
  // Avg beli saat ini & avg baru setelah transaksi
  var tkr = el('mf-ticker')&&el('mf-ticker').value;
  var pos0 = getPortfolio().find(function(p){return p.ticker===tkr;});
  var curShares = pos0 ? pos0.shares : 0;
  var curCost   = pos0 ? pos0.cost   : 0;
  var curAvg    = curShares > 0 ? curCost/curShares : 0;
  if(el('mc-avg-cur')) el('mc-avg-cur').textContent = curAvg>0 ? 'Rp '+fmt(Math.round(curAvg)) : '—';
  if(isBuy && el('mc-avg-new')){
    if(lot>0 && price>0){
      var newShares = curShares + lot*100;
      var newAvg    = (curCost + gross) / newShares;
      el('mc-avg-new').textContent = 'Rp '+fmt(Math.round(newAvg));
    } else {
      el('mc-avg-new').textContent = '—';
    }
  }
}

function divCalcLive(){
  var shares=parseFloat(el('mf-shares')&&el('mf-shares').value||0);
  var dps=parseFloat(el('mf-dps')&&el('mf-dps').value||0);
  // FIX AUDIT F1: pakai TAX_SETTINGS.pphDividen, bukan literal 0.1
  var gross=shares*dps;var tax=gross*TAX_SETTINGS.pphDividen;var net=gross-tax;
  if(el('dc-g'))el('dc-g').textContent='Rp '+fmt(gross);
  if(el('dc-t'))el('dc-t').textContent='-Rp '+fmt(tax);
  if(el('dc-n'))el('dc-n').textContent='Rp '+fmt(net);
}

function onFeeTypeChange(){
  var sel=el('mf-fee-type'); if(!sel) return;
  var ft=FEE_TYPES.find(function(f){return f.value===sel.value;});
  if(ft&&el('fee-hint')) el('fee-hint').textContent=ft.hint;
}

function submitFee(){
  var date=el('mf-date').value;
  var amount=parseFloat(el('mf-amount')&&el('mf-amount').value||0);
  var feeType=(el('mf-fee-type')&&el('mf-fee-type').value)||'LAINNYA';
  var sek=(el('mf-fee-sec')&&el('mf-fee-sec').value)||activeSekuritas;
  var ket=el('mf-ket')&&el('mf-ket').value||'';
  if(!date||amount<=0){alert('Lengkapi tanggal dan jumlah biaya!');return;}
  var ft=FEE_TYPES.find(function(f){return f.value===feeType;})||{label:'Biaya Lainnya'};
  var keterangan=ft.label+(ket?' — '+ket:'');
  // Catat sebagai mutasi RDN keluar dengan type = feeType
  addRdn(date, feeType, keterangan, -amount, sek, null);
  saveData();
  showSaveStatus('✓ '+ft.label+' Rp '+fmt(amount)+' dicatat');
  closeModal(); renderPage(currentPage);
}

function submitRdn(){
  var date=el('mf-date').value;var amount=parseFloat(el('mf-amount').value||0);var ket=el('mf-ket').value||'';
  if(!date||amount<=0){alert('Lengkapi tanggal dan jumlah dana!');return;}
  var isIn=modalType==='setor';
  addRdn(date,isIn?'SETOR':'TARIK',ket||(isIn?'Setoran dana':'Penarikan dana'),isIn?amount:-amount,activeSekuritas,null);
  saveData();
  showSaveStatus('✓ '+(isIn?'Setoran':'Penarikan')+' berhasil disimpan');
  closeModal();renderPage(currentPage);
}

function submitTxModal(){
  var date=el('mf-date').value;var sec=el('mf-sec').value;var ticker=el('mf-ticker').value;
  var lot=parseFloat(el('mf-lot').value||0);var price=parsePrice(el('mf-price')&&el('mf-price').value||'0');
  if(!date||!ticker||lot<=0||price<=0){alert('Lengkapi semua data!');return;}
  addTx(date,modalType==='buy'?'BUY':'SELL',ticker,lot,price,sec);
  showSaveStatus('✓ Transaksi '+(modalType==='buy'?'Beli':'Jual')+' '+ticker+' tersimpan');
  closeModal();renderPage(currentPage);
  // FIX: ticker baru belum tentu punya harga live — ambil sekarang juga,
  // bukan menunggu rotasi fetch berkala (lihat catatan di rdFetchLivePrice).
  if(!prices[ticker] && typeof rdFetchLivePrice==='function'){
    rdFetchLivePrice(ticker, function(){ renderPage(currentPage); });
  }
}

function submitDivModal(){
  var date=el('mf-date').value;var ticker=el('mf-ticker').value;
  var shares=parseFloat(el('mf-shares').value||0);var dps=parseFloat(el('mf-dps').value||0);
  if(!date||!ticker||shares<=0||dps<=0){alert('Lengkapi semua data dividen!');return;}
  addDiv(date,ticker,shares,dps);
  showSaveStatus('✓ Dividen '+ticker+' tersimpan');
  closeModal();renderPage(currentPage);
}

function saveSecuritas(){
  var s=el('mf-sec-choose').value;
  activeSekuritas=s;
  saveData();
  showSaveStatus('✓ Sekuritas aktif: '+s);
  closeModal();renderPage(currentPage);
}

var _txSelected = new Set();
function txToggleAll(checked){
  el('tx-tbody').querySelectorAll('input[type=checkbox]').forEach(function(cb){cb.checked=checked;});
  transactions.forEach(function(t){ checked?_txSelected.add(t.id):_txSelected.delete(t.id); });
  var b=el('tx-del-sel-btn'); if(b) b.style.display=_txSelected.size>0?'inline-flex':'none';
}
function txToggleSel(id, checked){
  checked?_txSelected.add(id):_txSelected.delete(id);
  var b=el('tx-del-sel-btn'); if(b) b.style.display=_txSelected.size>0?'inline-flex':'none';
}
function txSelectAll(){
  var allOn=_txSelected.size===transactions.length&&transactions.length>0;
  txToggleAll(!allOn); renderTransaksi();
}
function txDeleteSelected(){
  if(!_txSelected.size) return;
  if(!confirm('Hapus '+_txSelected.size+' transaksi terpilih?')) return;
  _txSelected.forEach(function(id){
    transactions=transactions.filter(function(t){return t.id!==id});
    rdnMutations=rdnMutations.filter(function(r){return r.linkedTxId!==id});
  });
  _txSelected.clear();
  rebuildRdnBalance(); saveData();
  showSaveStatus('✓ '+_txSelected.size+' transaksi dihapus');
  renderPage(currentPage);
}
function txClearAll(){
  if(!confirm('⚠️ Hapus SEMUA transaksi saham? Saldo RDN akan diatur ulang.')) return;
  transactions.forEach(function(t){ rdnMutations=rdnMutations.filter(function(r){return r.linkedTxId!==t.id;}); });
  transactions=[]; _txSelected.clear();
  rebuildRdnBalance(); saveData();
  showSaveStatus('✓ Semua transaksi dihapus');
  renderPage(currentPage);
}


function rebuildRdnBalance(){
  // Recalculate balance for all mutations in date order
  if(!Array.isArray(rdnMutations)) rdnMutations=[];
  rdnMutations.sort(function(a,b){return (a.date||'').localeCompare(b.date||'')||((a.id||0)-(b.id||0))});
  var bal = 0;
  rdnMutations.forEach(function(r){ bal += r.amount; r.balance = bal; });
  rdnBalance = bal;
}

function delTx(id){
  if(!confirm('Hapus transaksi ini?\nMutasi RDN terkait juga akan dihapus dan saldo akan dihitung ulang.')) return;
  if(!Array.isArray(transactions)) transactions=[];
  if(!Array.isArray(rdnMutations)) rdnMutations=[];
  transactions = transactions.filter(function(t){ return t.id !== id; });
  rdnMutations = rdnMutations.filter(function(r){ return r.linkedTxId !== id; });
  rebuildRdnBalance();
  saveData();
  showSaveStatus('✓ Transaksi dihapus & saldo RDN diperbarui');
  renderPage(currentPage);
}

function editTx(id){
  var tx = transactions.find(function(t){ return t.id === id; });
  if(!tx) return;
  var secOpts = Object.keys(SEKURITAS).map(function(s){
    return '<option value="'+s+'"'+(s===tx.sekuritas?' selected':'')+'>'+s+'</option>';
  }).join('');
  var tkrOpts = Object.keys(DB).map(function(t){
    return '<option value="'+t+'"'+(t===tx.ticker?' selected':'')+'>'+t+'</option>';
  }).join('');
  var isBuy = tx.type==='BUY';

  el('m-title').textContent = 'Edit Transaksi — '+tx.ticker;
  el('m-title').style.color = isBuy?'var(--green)':'var(--red)';
  el('m-body').innerHTML =
    '<div style="background:rgba(255,193,7,.07);border:1px solid rgba(255,193,7,.2);border-radius:7px;padding:8px 12px;margin-bottom:12px;font-size:11px;color:var(--amber)">'+
      '⚠️ Mengedit transaksi akan menghitung ulang saldo RDN dan portofolio secara otomatis.'+
    '</div>'+
    '<div class="fgrid">'+
      '<div class="fg ffull"><label class="flabel">Tanggal</label><input class="finput" type="date" id="ef-date" value="'+tx.date+'"></div>'+
      '<div class="fg"><label class="flabel">Tipe</label><select class="finput fsel" id="ef-type"><option value="BUY"'+(isBuy?' selected':'')+'>BUY — Beli</option><option value="SELL"'+(!isBuy?' selected':'')+'>SELL — Jual</option></select></div>'+
      '<div class="fg"><label class="flabel">Sekuritas</label><select class="finput fsel" id="ef-sec">'+secOpts+'</select></div>'+
      '<div class="fg"><label class="flabel">Kode Saham</label><select class="finput fsel" id="ef-ticker">'+tkrOpts+'</select></div>'+
      '<div class="fg"><label class="flabel">Lot</label><input class="finput" type="number" id="ef-lot" value="'+tx.lot+'" min="1" oninput="efCalcLive()"></div>'+
      '<div class="fg"><label class="flabel">Harga/Lembar (Rp)</label><input class="finput" type="number" id="ef-price" value="'+tx.price+'" oninput="efCalcLive()"></div>'+
    '</div>'+
    '<div class="taxbox">'+
      '<div style="font-size:9px;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;margin-bottom:7px">PREVIEW SETELAH EDIT</div>'+
      '<div class="taxrow"><span>Nilai Kotor</span><span class="mono" id="ef-gross">Rp 0</span></div>'+
      '<div class="taxrow"><span id="ef-k-lbl">Komisi</span><span class="mono amb" id="ef-komisi">Rp 0</span></div>'+
      '<div class="taxrow"><span id="ef-t-lbl">PPh</span><span class="mono dn" id="ef-tax">Rp 0</span></div>'+
      '<div class="taxrow tot"><span id="ef-net-lbl">Total Dibayar</span><span class="mono" id="ef-net">Rp 0</span></div>'+
    '</div>'+
    '<div style="margin-top:14px;display:flex;gap:8px;justify-content:flex-end">'+
      '<button class="btn btn-ghost" onclick="closeModal()">Batal</button>'+
      '<button class="btn btn-amber" onclick="updateTx('+id+')">💾 Simpan Perubahan</button>'+
    '</div>';

  setTimeout(function(){ efCalcLive(); }, 50);
  el('modal').classList.add('on');
}

function efCalcLive(){
  var lot   = parseFloat(el('ef-lot')&&el('ef-lot').value||0);
  var price = parsePrice(el('ef-price')&&el('ef-price').value||'0');
  var secNm = el('ef-sec')&&el('ef-sec').value||activeSekuritas;
  var type  = el('ef-type')&&el('ef-type').value||'BUY';
  var sec   = SEKURITAS[secNm]||SEKURITAS['Mirae Asset'];
  var isBuy = type==='BUY';
  var gross = lot*100*price;
  var c     = calcTxComponents(gross, isBuy, secNm);
  var feeRate = c.komisiRate; // FIX: tarif efektif (termasuk override per sekuritas)
  if(el('ef-gross'))   el('ef-gross').textContent   = 'Rp '+fmt(gross);
  if(el('ef-k-lbl'))   el('ef-k-lbl').textContent   = 'Komisi '+(isBuy?'Beli':'Jual')+' ('+(feeRate*100).toFixed(2)+'%)';
  if(el('ef-komisi'))  el('ef-komisi').textContent  = 'Rp '+fmt(c.komisi);
  if(el('ef-t-lbl'))   el('ef-t-lbl').textContent   = 'PPN+Levy'+(isBuy?'':'+PPh');
  if(el('ef-tax'))     el('ef-tax').textContent     = 'Rp '+fmt(c.ppn+c.levy+c.pph);
  if(el('ef-net-lbl')) el('ef-net-lbl').textContent = isBuy?'Total Dibayar':'Total Diterima';
  if(el('ef-net'))     el('ef-net').textContent     = 'Rp '+fmt(c.net);
}

function updateTx(id){
  var date   = el('ef-date').value;
  var type   = el('ef-type').value;
  var sec    = el('ef-sec').value;
  var ticker = el('ef-ticker').value;
  var lot    = parseFloat(el('ef-lot').value||0);
  var price  = parseFloat(el('ef-price').value||0);
  if(!date||!ticker||lot<=0||price<=0){ alert('Lengkapi semua data!'); return; }

  // Remove old RDN linked mutations
  rdnMutations = rdnMutations.filter(function(r){ return r.linkedTxId !== id; });

  // Recalculate using calcTxComponents (4-component fee model)
  var isBuy   = type==='BUY';
  var gross   = lot*100*parsePrice(String(price));
  var c       = calcTxComponents(gross, isBuy, sec);

  // Update the transaction in place
  var idx = transactions.findIndex(function(t){ return t.id === id; });
  if(idx === -1){ alert('Transaksi tidak ditemukan'); return; }
  transactions[idx] = {id:id, date:date, type:type, ticker:ticker,
                       lot:lot, price:price, gross:gross,
                       komisi:c.komisi, ppn:c.ppn, levy:c.levy, pph:c.pph,
                       tax:c.ppn+c.levy+c.pph, net:c.net, sekuritas:sec};

  // Re-add RDN mutation with linkedTxId
  if(isBuy){
    addRdn(date,'BUY','Beli '+lot+' lot '+ticker+' @ Rp '+fmt(price),-c.net, sec, id);
  } else {
    addRdn(date,'SELL','Jual '+lot+' lot '+ticker+' @ Rp '+fmt(price), c.net, sec, id);
  }
  rebuildRdnBalance();
  saveData();
  showSaveStatus('✓ Transaksi '+ticker+' berhasil diperbarui');
  closeModal();
  renderPage(currentPage);
}

function delDiv(id){
  if(!confirm('Hapus catatan dividen ini?')) return;
  dividends = dividends.filter(function(d){ return d.id !== id; });
  rdnMutations = rdnMutations.filter(function(r){ return r.linkedTxId !== 'div-'+id; });
  rebuildRdnBalance();
  saveData();
  showSaveStatus('✓ Dividen dihapus');
  renderPage(currentPage);
}

function delRdnManual(id){
  if(!confirm('Hapus mutasi RDN ini?')) return;
  rdnMutations = rdnMutations.filter(function(r){ return r.id !== id; });
  rebuildRdnBalance();
  saveData();
  showSaveStatus('✓ Mutasi RDN dihapus');
  renderPage(currentPage);
}

// ============================================================
// NAVIGATION
// ============================================================

// === EMBEDDED DATA: Mutasi_Final.xlsx (transaksi historis + candle ADMR) ===
var MUTASI_DATA={codes:[],sek:[],summary:{},totals:{r:0,f:0,bv:0,sv:0,n:0,db:0,ds:0,disc_b:0,disc_s:0,first:0,last:0},raw:[]};
function importMutasi(force){
  // FIX: mutToTx/registerMutPrices tidak pernah didefinisikan di file asli —
  // panggilan tanpa guard membuat init DOMContentLoaded mati diam-diam.
  if(typeof mutToTx!=='function') return false;
  var has=transactions.some(function(t){return t._mutasi;});
  if(has && !force) return false;
  if(force) transactions=transactions.filter(function(t){return !t._mutasi;});
  var tx=mutToTx();
  tx.forEach(function(t){t.id=nextTxId++;});
  transactions=transactions.concat(tx);
  if(typeof registerMutPrices==='function') registerMutPrices();
  saveData();
  return true;
}
function importMutasiUI(){
  var n=transactions.filter(function(t){return t._mutasi;}).length;
  var msg = n>0
    ? 'Mutasi sudah diimpor ('+fmt(n)+' transaksi). Impor ulang akan mengganti dengan data terbaru dari Mutasi_Final.xlsx. Lanjutkan?'
    : 'Impor '+fmt(MUTASI_DATA.totals.n)+' transaksi saham historis (2018–2026)?\n\nPajak diambil per-transaksi (termasuk diskon 0,18%/0,28%); program pajak global tidak diterapkan.';
  if(!confirm(msg)) return;
  importMutasi(true);
  if(typeof rebuildRdnBalance==='function') rebuildRdnBalance();
  if(typeof saveData==='function') saveData();
  if(typeof showSaveStatus==='function') showSaveStatus('✓ '+fmt(MUTASI_DATA.totals.n)+' transaksi mutasi diimpor','#00e5a0');
  if(typeof updatePrices==='function') updatePrices();
  renderTransaksi();
  if(typeof renderDashboard==='function') renderDashboard();
}

