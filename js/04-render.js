// ============================================================
// RENDER FUNCTIONS
// ============================================================
function renderDashboard(){
  var porto=getPortfolio();
  var cryptoPorto=getCryptoPortfolio();
  var etfPorto=getEtfPortfolio();
  var rdPorto=getRdPortfolio();

  // ── nilai masing-masing kelas aset ──
  var sahamMV   = porto.reduce(function(a,p){return a+p.mv},0);
  var sahamCost = porto.reduce(function(a,p){return a+p.cost},0);
  var crMV      = cryptoPorto.reduce(function(a,p){return a+p.mv},0);
  var crCost    = cryptoPorto.reduce(function(a,p){return a+p.cost},0);
  var etfMV     = etfPorto.reduce(function(a,p){return a+p.mvIdr},0);
  var etfCost   = etfPorto.reduce(function(a,p){return a+p.costIdr},0);
  var rdMV      = rdPorto.reduce(function(a,p){return a+p.mv},0);
  var rdCost    = rdPorto.reduce(function(a,p){return a+p.cost},0);
  // Reksa dana: semua sudah dicairkan. Tampilkan gain kumulatif historis jika tidak ada posisi aktif
  var rdGainHistoris = 0; // data injeksi historis dihapus — mulai kosong
  var rdDisplayVal   = rdMV > 0 ? rdMV : 0; // nilai aktif = 0 karena semua dicairkan
  var rdn       = calcRdnBalance();

  // ── AUM = semua aset investasi + kas RDN ──
  var AUM = (sahamMV||0) + (crMV||0) + (etfMV||0) + (rdMV||0) + Math.max(0,rdn||0);
  var totalCost = (sahamCost||0) + (crCost||0) + (etfCost||0) + (rdCost||0);
  var totalUnreal = AUM - totalCost - Math.max(0,rdn||0);
  var real = getRealizedPnl();
  var yr = new Date().getFullYear();
  var divYTD = dividends.filter(function(d){return new Date(d.date).getFullYear()===yr}).reduce(function(a,d){return a+d.net},0);
  var divCnt = dividends.filter(function(d){return new Date(d.date).getFullYear()===yr}).length;
  var aumPct = totalCost>0 ? (totalUnreal/totalCost*100).toFixed(2) : '0.00';

  // bobot (% dari AUM)
  var AUMsafe = AUM||1;
  var wSaham  = (sahamMV/AUMsafe*100);
  var wCrypto = (crMV/AUMsafe*100);
  var wEtf    = (etfMV/AUMsafe*100);
  var wRd     = (rdMV/AUMsafe*100);
  var wKas    = (Math.max(0,rdn)/AUMsafe*100);

  // ── Hero AUM ──
  el('d-aum').textContent = 'Rp '+fmtK(AUM);
  el('d-aum-sub').innerHTML =
    '<span class="'+(totalUnreal>=0?'up':'dn')+'" style="font-family:\'IBM Plex Mono\',monospace;font-size:11px">'+(totalUnreal>=0?'▲ +':'▼ ')+'Rp '+fmtK(totalUnreal)+' ('+aumPct+'%)</span>'+
    '<span style="color:var(--text3);font-size:10px;font-family:\'IBM Plex Mono\',monospace;margin-left:8px">dari total modal Rp '+fmtK(totalCost)+'</span>';
  el('d-aum-badges').innerHTML =
    '<span class="badge b-up">'+porto.length+' Saham</span>'+
    '<span class="badge" style="background:rgba(247,147,26,.12);color:#f7931a">'+cryptoPorto.length+' Crypto</span>'+
    '<span class="badge b-neu">'+etfPorto.length+' ETF</span>'+
    '<span class="badge b-pur">'+rdPorto.length+' RD</span>';

  // ── P&L cards ──
  el('d-unreal').className='mval '+(totalUnreal>=0?'up':'dn');
  el('d-unreal').textContent=(totalUnreal>=0?'+':'')+'Rp '+fmtK(totalUnreal);
  el('d-unreal-sub').innerHTML='<span class="'+(totalUnreal>=0?'up':'dn')+'">'+aumPct+'% return</span>';
  el('d-real').className='mval '+(real>=0?'up':'dn');
  el('d-real').textContent=(real>=0?'+':'')+'Rp '+fmtK(real);
  el('d-rdn').textContent='Rp '+fmtK(rdn);

  // ── 4 Asset Cards ──
  // Saham
  el('d-porto').textContent='Rp '+fmtK(sahamMV);
  el('d-porto-bobot').textContent=wSaham.toFixed(1)+'%';
  el('d-porto-bar').style.width=Math.min(wSaham,100)+'%';
  var sahamPnl=sahamMV-sahamCost;
  el('d-porto-sub').innerHTML='<span class="'+(sahamPnl>=0?'up':'dn')+'">'+(sahamPnl>=0?'+':'')+'Rp '+fmtK(sahamPnl)+'</span>';
  el('d-porto-cnt').textContent=porto.length+' saham';
  // Crypto
  el('d-crypto').textContent='Rp '+fmtK(crMV);
  el('d-crypto-bobot').textContent=wCrypto.toFixed(1)+'%';
  el('d-crypto-bar').style.width=Math.min(wCrypto,100)+'%';
  var crPnl=crMV-crCost;
  el('d-crypto-sub').innerHTML='<span class="'+(crPnl>=0?'up':'dn')+'">'+(crPnl>=0?'+':'')+'Rp '+fmtK(crPnl)+'</span>';
  el('d-crypto-cnt').textContent=cryptoPorto.length+' aset';
  // ETF
  el('d-etf').textContent='Rp '+fmtK(etfMV);
  el('d-etf-bobot').textContent=wEtf.toFixed(1)+'%';
  el('d-etf-bar').style.width=Math.min(wEtf,100)+'%';
  var etfPnl=etfMV-etfCost;
  el('d-etf-sub').innerHTML='<span class="'+(etfPnl>=0?'up':'dn')+'">'+(etfPnl>=0?'+':'')+'Rp '+fmtK(etfPnl)+'</span>';
  el('d-etf-cnt').textContent=etfPorto.length+' ETF';
  // Reksa Dana — nilai aktif dari user transactions saja
  var rdAktif = rdPorto.length > 0;
  el('d-rd').textContent = rdAktif ? 'Rp '+fmtK(rdMV) : 'Rp 0';
  el('d-rd').style.color = rdAktif ? 'var(--purple)' : 'var(--text3)';
  el('d-rd-bobot').textContent = wRd.toFixed(1)+'%';
  el('d-rd-bar').style.width = Math.min(wRd,100)+'%';
  el('d-rd-sub').innerHTML = rdAktif
    ? '<span class="'+(rdMV-rdCost>=0?'up':'dn')+'">'+(rdMV-rdCost>=0?'+':'')+'Rp '+fmtK(rdMV-rdCost)+'</span>'
    : '<span style="font-size:10px;color:var(--text3)">Tidak ada posisi aktif</span>';
  el('d-rd-cnt').textContent = rdAktif ? rdPorto.length+' produk aktif' : 'klik untuk lihat riwayat';

  // ── AUM Donut ──
  kc('aumD');
  var cvAum=el('aumDonut');
  if(cvAum){
    charts['aumD']=new Chart(cvAum,{
      type:'doughnut',
      data:{
        labels:['Saham IDX','Crypto','ETF AS','Reksa Dana','Kas RDN'],
        datasets:[{
          data:[sahamMV,crMV,etfMV,rdMV,Math.max(0,rdn)],
          backgroundColor:['#00e5a0','#f7931a','#00c8ff','#a78bfa','#ffc107'],
          borderWidth:0,hoverOffset:5
        }]
      },
      options:{
        responsive:true,maintainAspectRatio:false,cutout:'62%',
        plugins:{legend:{display:false},tooltip:Object.assign({},TT,{callbacks:{
          label:function(c){
            var pct=(c.parsed/AUMsafe*100).toFixed(1);
            return c.label+': Rp '+fmtK(c.parsed)+' ('+pct+'%)';
          }
        }})}
      }
    });
  }
  // Legend AUM
  var aumItems=[
    {label:'Saham IDX', val:sahamMV, pct:wSaham,  color:'#00e5a0'},
    {label:'Crypto',    val:crMV,    pct:wCrypto,  color:'#f7931a'},
    {label:'ETF AS',    val:etfMV,   pct:wEtf,     color:'#00c8ff'},
    {label:'Reksa Dana',val:rdMV,    pct:wRd,      color:'#a78bfa'},
    {label:'Kas RDN',   val:Math.max(0,rdn), pct:wKas, color:'#ffc107'},
  ];
  el('aum-leg').innerHTML=aumItems.map(function(it){
    return '<div style="display:flex;align-items:center;gap:6px">'+
      '<div style="width:7px;height:7px;border-radius:2px;background:'+it.color+';flex-shrink:0"></div>'+
      '<span style="font-size:10px;color:var(--text2);flex:1">'+it.label+'</span>'+
      '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:10px;font-weight:600;color:'+it.color+'">'+it.pct.toFixed(1)+'%</span>'+
      '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:9px;color:var(--text3);min-width:60px;text-align:right">'+fmtK(it.val)+'</span>'+
    '</div>';
  }).join('');
  el('d-aum-total-badge').textContent='Rp '+fmtK(AUM);

  // ── IHSG + Movers ──
  var movers=Object.entries(prices).map(function(e){var t=e[0],p=e[1];return{t:t,p:p,c:((p-DB[t].base)/DB[t].base*100)}}).sort(function(a,b){return b.c-a.c});
  el('gainers').innerHTML=movers.slice(0,3).map(function(m){
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;border-bottom:1px solid var(--border)">'+
      '<span class="tp">'+m.t+'</span>'+
      '<span class="mono" style="font-size:10px;color:var(--text2)">'+fmt(m.p)+'</span>'+
      '<span class="badge b-up">+'+m.c.toFixed(2)+'%</span></div>';
  }).join('');
  el('losers').innerHTML=movers.slice(-3).reverse().map(function(m){
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;border-bottom:1px solid var(--border)">'+
      '<span class="tp">'+m.t+'</span>'+
      '<span class="mono" style="font-size:10px;color:var(--text2)">'+fmt(m.p)+'</span>'+
      '<span class="badge b-dn">'+m.c.toFixed(2)+'%</span></div>';
  }).join('');

  // ── Tabel ringkasan semua aset ──
  var allRows=[];
  porto.forEach(function(p){
    allRows.push({name:p.ticker,desc:p.info.name,kelas:'Saham IDX',lot:p.lot||0,mv:p.mv,cost:p.cost,pnl:p.unreal,ret:p.ret,color:'#00e5a0'});
  });
  cryptoPorto.forEach(function(p){
    allRows.push({name:p.coin,desc:p.info.name,kelas:'Crypto',lot:p.qty||0,mv:p.mv,cost:p.cost,pnl:p.unreal,ret:p.ret,color:'#f7931a'});
  });
  etfPorto.forEach(function(p){
    allRows.push({name:p.ticker,desc:p.info.name,kelas:'ETF AS',lot:p.qty||0,mv:p.mvIdr,cost:p.costIdr,pnl:p.unrIdr,ret:p.ret,color:'#00c8ff'});
  });
  rdPorto.forEach(function(p){
    allRows.push({name:p.code,desc:p.info.name,kelas:'Reksa Dana',lot:0,mv:p.mv,cost:p.cost,pnl:p.unreal,ret:p.ret,color:'#a78bfa'});
  });
  // apply sort
  (function(){
    var sk=_assetSort.key, asc=_assetSort.asc;
    if(sk==='name') allRows.sort(function(a,b){return asc?a.name.localeCompare(b.name):b.name.localeCompare(a.name);});
    else if(sk==='lot') allRows.sort(function(a,b){return asc?a.lot-b.lot:b.lot-a.lot;});
    else if(sk==='pnl') allRows.sort(function(a,b){return asc?a.pnl-b.pnl:b.pnl-a.pnl;});
    else if(sk==='ret') allRows.sort(function(a,b){return asc?a.ret-b.ret:b.ret-a.ret;});
    else allRows.sort(function(a,b){return asc?a.mv-b.mv:b.mv-a.mv;});
    ['name','lot','mv','pnl','ret'].forEach(function(k){
      var ico=el('sort-ico-'+k);
      if(ico) ico.textContent=k===sk?(asc?'↑':'↓'):'↕';
    });
  })();
  el('d-total-items').textContent=allRows.length+' instrumen aktif'+(rdGainHistoris>0?' · Gain RD historis: +Rp '+fmtK(rdGainHistoris):'');
  el('d-asset-tbody').innerHTML=allRows.map(function(r){
    var bobot=(r.mv/AUMsafe*100);
    var lotDisp=r.kelas==='Saham IDX'?r.lot+(r.lot?'':'—'):
                r.kelas==='Crypto'?(+r.lot).toFixed(4):
                r.lot||'—';
    return '<tr>'+
      '<td><div style="display:flex;align-items:center;gap:6px">'+
        '<div style="width:3px;height:28px;border-radius:2px;background:'+r.color+'"></div>'+
        '<div><div class="mono" style="font-size:11px;font-weight:600">'+r.name+'</div>'+
        '<div style="font-size:9px;color:var(--text3)">'+r.desc.slice(0,22)+(r.desc.length>22?'…':'')+'</div></div>'+
      '</div></td>'+
      '<td><span class="badge" style="background:rgba(255,255,255,.05);color:'+r.color+'">'+r.kelas+'</span></td>'+
      '<td class="mono" style="font-size:11px;color:var(--text2)">'+lotDisp+'</td>'+
      '<td class="mono" style="font-weight:600">Rp '+fmtK(r.mv)+'</td>'+
      '<td class="mono" style="color:var(--text2)">Rp '+fmtK(r.cost)+'</td>'+
      '<td class="mono '+(r.pnl>=0?'up':'dn')+'">'+(r.pnl>=0?'+':'')+'Rp '+fmtK(r.pnl)+'</td>'+
      '<td class="mono '+(r.ret>=0?'up':'dn')+'">'+(r.ret>=0?'+':'')+r.ret.toFixed(2)+'%</td>'+
      '<td><div style="display:flex;align-items:center;gap:6px">'+
        '<div style="width:50px;background:var(--bg5);height:3px;border-radius:2px">'+
          '<div style="width:'+Math.min(bobot/Math.max(wSaham,wCrypto,wEtf,wRd,1)*100,100).toFixed(0)+'%;height:100%;background:'+r.color+';border-radius:2px"></div>'+
        '</div>'+
        '<span class="mono" style="font-size:10px;color:'+r.color+';font-weight:700">'+bobot.toFixed(1)+'%</span>'+
      '</div></td>'+
    '</tr>';
  }).join('')||'<tr><td colspan="8" style="text-align:center;color:var(--text3);padding:16px">Belum ada aset</td></tr>';

  // ── Recent TX ──
  el('recent-tx').innerHTML=transactions.slice().reverse().slice(0,4).map(function(tx){
    var isBuy=tx.type==='BUY';
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid var(--border)">'+
      '<div style="display:flex;align-items:center;gap:6px">'+
        '<span class="badge '+(isBuy?'b-up':'b-dn')+'">'+tx.type+'</span>'+
        '<div><div class="mono" style="font-size:10px">'+tx.ticker+' · '+tx.lot+' lot</div>'+
        '<div style="font-size:9px;color:var(--text3);font-family:\'IBM Plex Mono\',monospace">'+tx.date+'</div></div>'+
      '</div>'+
      '<div style="text-align:right;font-family:\'IBM Plex Mono\',monospace;font-size:10px">'+
        '<div style="color:'+(isBuy?'var(--red)':'var(--green)')+'">'+(isBuy?'-':'+')+' Rp '+fmtK(tx.net)+'</div>'+
        '<div style="font-size:9px;color:var(--text3)">'+tx.sekuritas+'</div>'+
      '</div></div>';
  }).join('')||'<div style="color:var(--text3);text-align:center;padding:12px;font-size:11px">Belum ada transaksi</div>';

  // ── Kas & Likuiditas (semua akun) ──
  // Saham/RDN = calcRdnBalance(), CASH_ACCOUNTS.saham dikecualikan agar tidak double count
  var totalCashAll = Object.entries(CASH_ACCOUNTS).reduce(function(a,e){
    if(e[0]==='saham') return a; // RDN sudah dihitung lewat rdn
    return a + (e[1].isUsd ? e[1].balance*usdIdr : e[1].balance);
  }, 0) + Math.max(0,rdn);
  el('d-kas-detail').innerHTML=
    '<div class="taxrow" style="padding:3px 0"><span style="color:var(--green);font-size:11px">💰 Kas Saham (RDN)</span><span class="mono up" style="font-size:11px">'+fmtK(Math.max(0,rdn))+'</span></div>'+
    Object.entries(CASH_ACCOUNTS).filter(function(e){return e[0]!=='saham';}).map(function(e){
      var k=e[0],c=e[1]; var val=c.isUsd?c.balance*usdIdr:c.balance;
      return '<div class="taxrow" style="padding:3px 0"><span style="color:'+c.color+';font-size:11px">'+c.label+'</span><span class="mono" style="color:'+c.color+';font-size:11px">'+fmtK(val)+'</span></div>';
    }).join('')+
    '<div style="border-top:1px solid var(--border);margin-top:6px;padding-top:6px">'+
    '<div class="taxrow tot"><span style="font-weight:600;font-size:11px">Total Kas</span><span class="mono up" style="font-size:12px;font-weight:700">Rp '+fmtK(totalCashAll)+'</span></div>'+
    '<div class="prog" style="margin-top:4px"><div class="progf" style="width:'+Math.min(totalCashAll/(AUMsafe||1)*100,100).toFixed(1)+'%;background:var(--amber)"></div></div>'+
    '<div style="font-size:9px;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;margin-top:4px">'+
      (totalCashAll/(AUMsafe||1)<0.05?'⚠️ Kas total rendah':totalCashAll/(AUMsafe||1)>0.30?'ℹ️ Kas tinggi':'✅ Likuiditas proporsional')+
    '</div></div>';

  buildIhsgChart('1H');
  buildModalPosisiChart(porto);

  // ── Sektoral — dari getPortfolio() (transaksi user) ──
  var sectColors = {
    'Keuangan':'#3b82f6','Energi':'#f97316','Infrastruktur':'#f43f5e',
    'Konsumer Primer':'#10b981','Barang Baku':'#eab308','Konsumer Non-Primer':'#22c55e',
    'Kesehatan':'#14b8a6','Transportasi':'#2dd4bf','Properti':'#8b5cf6',
    'Teknologi':'#a78bfa','Perbankan':'#60a5fa','Tambang':'#fb923c',
    'Lainnya':'#4a5e82'
  };
  var sectByMV = {};
  porto.forEach(function(p){
    var sec = (p.info && p.info.sector) || (DB[p.ticker] && DB[p.ticker].sector) || 'Lainnya';
    sectByMV[sec] = (sectByMV[sec]||0) + p.mv;
  });
  var sectTotalMV = Object.values(sectByMV).reduce(function(a,v){return a+v},0)||1;
  var sectItems = Object.entries(sectByMV).filter(function(e){return e[1]>0})
    .sort(function(a,b){return b[1]-a[1]});
  el('d-sectoral-detail').innerHTML = sectItems.length > 0
    ? sectItems.map(function(e){
        var pct = e[1]/sectTotalMV*100;
        var col = sectColors[e[0]]||'#4a5e82';
        return '<div style="margin-bottom:7px">'+
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px">'+
            '<span style="font-size:11px;display:flex;align-items:center;gap:5px">'+
              '<span style="width:7px;height:7px;border-radius:50%;background:'+col+';display:inline-block"></span>'+
              e[0]+'</span>'+
            '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:10px">'+
              '<span style="color:'+col+';font-weight:700">'+pct.toFixed(1)+'%</span>'+
              ' <span style="color:var(--text3)">'+fmtK(e[1])+'</span>'+
            '</span>'+
          '</div>'+
          '<div style="height:3px;background:var(--bg5);border-radius:2px">'+
            '<div style="width:'+Math.min(pct,100).toFixed(1)+'%;height:100%;background:'+col+';border-radius:2px"></div>'+
          '</div></div>';
    }).join('')
    : '<div style="color:var(--text3);font-size:11px;padding:10px 0;text-align:center">Belum ada posisi — tambahkan transaksi beli saham</div>';

  // ── Dividen — hanya dari user transactions ──
  var divTotal = dividends.reduce(function(a,d){return a+d.net},0);
  var yr2=new Date().getFullYear();
  var divYTD=dividends.filter(function(d){return d.date&&d.date.startsWith(yr2+'')}).reduce(function(a,d){return a+d.net},0);
  el('d-div-total').textContent = 'Rp '+fmtK(divTotal);
  el('d-div-info').textContent = dividends.length > 0
    ? dividends.length+' pembayaran tercatat · Rata-rata Rp '+fmtK(Math.round(divTotal/(dividends.length||1)))+'/tx'
    : 'Belum ada data dividen — isi manual di tab Dividen';
  // List per saham dari user transactions
  var divByTicker={};
  dividends.forEach(function(d){ divByTicker[d.ticker]=(divByTicker[d.ticker]||0)+d.net; });
  var topDiv=Object.entries(divByTicker).sort(function(a,b){return b[1]-a[1]}).slice(0,12);
  el('d-dividen-list').innerHTML = topDiv.length > 0
    ? topDiv.map(function(e){
        return '<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;border-bottom:1px solid var(--border)">'+
          '<span class="tp" style="font-size:10px">'+e[0]+'</span>'+
          '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:10px;color:var(--green)">+'+fmtK(e[1])+'</span>'+
        '</div>';
      }).join('')
    : '<div style="color:var(--text3);font-size:11px;padding:8px 0">Belum ada dividen tercatat</div>';
  el('d-div').textContent='Rp '+fmtK(divYTD);
  el('d-div-sub').textContent=dividends.length>0?dividends.length+' pembayaran total':'—';

  renderStrategyPanel();
  renderDashRisk();
  if(el('ai-box') && !el('ai-box').dataset.live) aiRunHeuristic();

  // Re-apply hide masks after every render
  applyMetricMasks();

  // ── Sumber data — live counts ──
  var subEl = el('d-sumber-sub');
  if(subEl){
    var sahamAktif = porto.length;
    var cryptoAktif = getCryptoPortfolio().length;
    var rdAktif = getRdPortfolio().length;
    var parts = [];
    if(sahamAktif > 0) parts.push(sahamAktif+' saham aktif');
    if(cryptoAktif > 0) parts.push(cryptoAktif+' crypto');
    if(rdAktif > 0) parts.push(rdAktif+' reksa dana aktif');
    parts.push('Kurs USD/IDR: Rp '+Math.round(usdIdr).toLocaleString('id-ID'));
    subEl.textContent = parts.join(' · ');
  }
}

function renderRdn(){
  var rdn=calcRdnBalance();
  var setors=rdnMutations.filter(function(r){return r.type==='SETOR'});
  var tariks=rdnMutations.filter(function(r){return r.type==='TARIK'});
  var totalIn=setors.reduce(function(a,r){return a+r.amount},0);
  var totalOut=Math.abs(tariks.reduce(function(a,r){return a+r.amount},0));
  var usedBuy=transactions.filter(function(t){return t.type==='BUY'}).reduce(function(a,t){return a+t.net},0);

  el('rdn-saldo').textContent='Rp '+fmtK(rdn);
  el('rdn-sekuritas').textContent=activeSekuritas;
  el('rdn-in').textContent='Rp '+fmtK(totalIn);
  el('rdn-in-cnt').textContent=setors.length+' kali setor';
  el('rdn-out').textContent='Rp '+fmtK(totalOut);
  el('rdn-out-cnt').textContent=tariks.length+' kali tarik';
  el('rdn-used').textContent='Rp '+fmtK(usedBuy);

  var feeMuts=rdnMutations.filter(function(r){
    return ['DATA_FEE','MATERAI','MIGRASI','ADMIN','TRANSFER','PENALTY','LAINNYA','FEE'].indexOf(r.type)>=0;
  });
  var totalFee=Math.abs(feeMuts.reduce(function(a,r){return a+r.amount;},0));
  el('rdn-summary').innerHTML=
    '<div class="taxrow" style="padding:5px 0"><span style="color:var(--text2)">Total Setoran</span><span class="mono up">+ Rp '+fmtK(totalIn)+'</span></div>'
    +'<div class="taxrow" style="padding:5px 0"><span style="color:var(--text2)">Total Penarikan</span><span class="mono dn">- Rp '+fmtK(totalOut)+'</span></div>'
    +'<div class="taxrow" style="padding:5px 0"><span style="color:var(--text2)">Dana Untuk Beli</span><span class="mono dn">- Rp '+fmtK(usedBuy)+'</span></div>'
    +'<div class="taxrow" style="padding:5px 0"><span style="color:var(--text2)">Hasil Jual Saham</span><span class="mono up">+ Rp '+fmtK(transactions.filter(function(t){return t.type==='SELL'}).reduce(function(a,t){return a+t.net},0))+'</span></div>'
    +'<div class="taxrow" style="padding:5px 0"><span style="color:var(--text2)">Penerimaan Dividen</span><span class="mono up">+ Rp '+fmtK(dividends.filter(function(d){return d._src!=='lampiran'}).reduce(function(a,d){return a+d.net},0))+'</span></div>'
    +(totalFee>0?'<div class="taxrow" style="padding:5px 0"><span style="color:var(--text2)">Biaya & Fee ('+(feeMuts.length+' catatan')+')</span><span class="mono dn">- Rp '+fmtK(totalFee)+'</span></div>':'')
    +'<div style="border-top:1px solid var(--border2);margin-top:6px;padding-top:8px;display:flex;justify-content:space-between;font-family:\'IBM Plex Mono\',monospace;font-weight:600;font-size:13px"><span>Saldo Aktif</span><span class="up">Rp '+fmtK(rdn)+'</span></div>';

  // Deteksi sekuritas dari portofolio
  var detectedSek = detectActiveSekuritas();
  var sec=SEKURITAS[detectedSek]||SEKURITAS[activeSekuritas];
  var ovr=sekTaxOverride[detectedSek]||{};
  var bFee=(ovr.beli!=null?ovr.beli:sec.buyFee)*100;
  var jFee=(ovr.jual!=null?ovr.jual:sec.sellFee)*100;

  // Hitung distribusi transaksi per sekuritas
  var bySekTx={};
  transactions.forEach(function(t){
    var s=t.sekuritas||'(tidak ada)';
    if(!bySekTx[s]) bySekTx[s]={cnt:0,lot:0,lastDate:''};
    bySekTx[s].cnt++;
    bySekTx[s].lot+=(t.lot||0);
    if(t.date>bySekTx[s].lastDate) bySekTx[s].lastDate=t.date;
  });
  var sekRows=Object.keys(bySekTx).sort(function(a,b){return bySekTx[b].cnt-bySekTx[a].cnt;}).map(function(s){
    var isActive=(s===detectedSek);
    var sf=SEKURITAS[s];
    return '<div class="taxrow" style="padding:4px 0'+(isActive?';border-left:2px solid var(--accent);padding-left:6px':'')+'">'
      +'<span style="font-size:11px'+(isActive?';color:var(--accent);font-weight:600':'')+'">'+(isActive?'★ ':'')+s+'</span>'
      +'<span class="mono" style="font-size:10px;color:var(--text2)">'+bySekTx[s].cnt+' tx · '+bySekTx[s].lot+' lot</span>'
      +'</div>';
  }).join('') || '<div style="color:var(--text3);font-size:11px">Belum ada transaksi</div>';

  el('rdn-sec-info').innerHTML=
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'
    +'<div><span style="font-size:13px;font-weight:600;color:var(--accent)">'+detectedSek+'</span>'
    +'<span style="font-size:9px;color:var(--text3);margin-left:6px;font-family:\'IBM Plex Mono\',monospace">auto-detect dari portofolio</span></div>'
    +'<button class="btn btn-ghost btn-xs" onclick="openModal(\'sec\')">Ganti</button></div>'
    +'<div class="taxrow"><span>Komisi Beli</span><span class="mono amb">'+bFee.toFixed(3)+'%</span></div>'
    +'<div class="taxrow"><span>Komisi Jual</span><span class="mono amb">'+jFee.toFixed(3)+'%</span></div>'
    +'<div class="taxrow"><span>PPh Final Jual</span><span class="mono dn">'+(TAX_SETTINGS.pphJual*100).toFixed(1)+'%</span></div>'
    +'<div class="taxrow"><span>PPN × Komisi</span><span class="mono dn">'+(TAX_SETTINGS.ppn*100).toFixed(0)+'%</span></div>'
    +'<div class="taxrow"><span>Levy BEI+KPEI+KSEI</span><span class="mono dn">'+(TAX_SETTINGS.levy*100).toFixed(3)+'%</span></div>'
    +'<div style="border-top:1px solid var(--border2);margin-top:8px;padding-top:8px;font-size:9px;color:var(--text3);letter-spacing:.6px;font-family:\'IBM Plex Mono\',monospace;margin-bottom:5px">DISTRIBUSI SEKURITAS</div>'
    +sekRows;

  var filter=el('rdn-filter')?el('rdn-filter').value:'all';
  var FEE_SUBTYPES=['DATA_FEE','MATERAI','MIGRASI','ADMIN','TRANSFER','PENALTY','LAINNYA','FEE'];
  var list=rdnMutations.slice().reverse().filter(function(r){
    if(filter==='all') return true;
    if(filter==='FEE') return FEE_SUBTYPES.indexOf(r.type)>=0;
    return r.type===filter;
  });
  el('rdn-tbody').innerHTML=list.map(function(r){
    var isin=r.amount>0;
    var typeColors={'SETOR':'b-up','TARIK':'b-dn','BUY':'b-dn','SELL':'b-up','DIVIDEN':'b-pur','FEE':'b-amb',
      'DATA_FEE':'b-amb','MATERAI':'b-amb','MIGRASI':'b-amb','ADMIN':'b-amb','TRANSFER':'b-amb','PENALTY':'b-dn','LAINNYA':'b-amb'};
    var typeLabels={'SETOR':'SETOR','TARIK':'TARIK','BUY':'BELI','SELL':'JUAL','DIVIDEN':'DIVIDEN','FEE':'FEE',
      'DATA_FEE':'DATA FEE','MATERAI':'MATERAI','MIGRASI':'MIGRASI','ADMIN':'ADMIN','TRANSFER':'TRANSFER','PENALTY':'DENDA','LAINNYA':'BIAYA'};
    // SETOR, TARIK, FEE dan sub-jenisnya bisa dihapus langsung
    var canDel = (r.type==='SETOR'||r.type==='TARIK'||r.type==='FEE'||
      ['DATA_FEE','MATERAI','MIGRASI','ADMIN','TRANSFER','PENALTY','LAINNYA'].indexOf(r.type)>=0);
    var delBtn = canDel
      ? '<button class="btn btn-ghost btn-xs" style="color:var(--red)" onclick="delRdnManual('+r.id+')" title="Hapus mutasi ini">✕</button>'
      : '<span class="badge b-gray" style="font-size:9px;cursor:default" title="Hapus via tab '+r.type+'">auto</span>';
    return '<tr>'
      +'<td class="mono" style="color:var(--text2);font-size:11px">'+r.date+'</td>'
      +'<td><span class="badge '+(typeColors[r.type]||'b-gray')+'">'+(typeLabels[r.type]||r.type)+'</span></td>'
      +'<td style="max-width:200px;color:var(--text2);font-size:11px">'+r.ket+'</td>'
      +'<td class="mono up">'+(isin?'Rp '+fmtK(r.amount):'—')+'</td>'
      +'<td class="mono dn">'+(!isin?'Rp '+fmtK(Math.abs(r.amount)):'—')+'</td>'
      +'<td class="mono" style="font-weight:600">Rp '+fmtK(r.balance)+'</td>'
      +'<td>'+delBtn+'</td>'
      +'</tr>';
  }).join('')||'<tr><td colspan="7" style="text-align:center;color:var(--text3);padding:16px">Belum ada mutasi</td></tr>';

  buildRdnChart();
}

function renderTransaksi(){
  var search=(el('tx-search')?el('tx-search').value:'').toUpperCase();
  var filter=el('tx-filter')?el('tx-filter').value:'all';
  var buys=transactions.filter(function(t){return t.type==='BUY'});
  var sells=transactions.filter(function(t){return t.type==='SELL'});
  el('tx-cnt').textContent=transactions.length;
  el('tx-buy').textContent='Rp '+fmtK(buys.reduce(function(a,t){return a+t.net},0));
  el('tx-buy-cnt').textContent=buys.length+' transaksi';
  el('tx-sell').textContent='Rp '+fmtK(sells.reduce(function(a,t){return a+t.net},0));
  el('tx-sell-cnt').textContent=sells.length+' transaksi';
  el('tx-tax').textContent='Rp '+fmtK(transactions.reduce(function(a,t){return a+t.tax+t.komisi},0));

  var pos={};
  transactions.slice().sort(function(a,b){return a.date.localeCompare(b.date)}).forEach(function(tx){
    if(!pos[tx.ticker])pos[tx.ticker]={lot:0,cost:0};
    var p=pos[tx.ticker];
    if(tx.type==='BUY'){p.lot+=tx.lot;p.cost+=tx.net;}
    else if(tx.type==='SELL'&&p.lot>0){var avg=p.cost/(p.lot*100);p.lot-=tx.lot;p.cost=Math.max(0,p.cost-avg*tx.lot*100);}
  });

  var list=transactions.slice().sort(function(a,b){return b.date.localeCompare(a.date)}).filter(function(tx){
    return tx.ticker.toUpperCase().indexOf(search)>=0&&(filter==='all'||tx.type===filter)
  });

  var pos2={};
  el('tx-tbody').innerHTML=list.map(function(tx){
    var isBuy=tx.type==='BUY';
    if(!pos2[tx.ticker])pos2[tx.ticker]={lot:0,cost:0};
    var pnlHtml='—';
    if(!isBuy&&pos2[tx.ticker].lot>0){
      var avg2=pos2[tx.ticker].cost/(pos2[tx.ticker].lot*100);
      var pnl=(tx.price-avg2)*tx.lot*100;
      pnlHtml='<span class="'+(pnl>=0?'up':'dn')+'">'+(pnl>=0?'+':'')+'Rp '+fmtK(pnl)+'</span>';
    }
    if(isBuy){pos2[tx.ticker].lot+=tx.lot;pos2[tx.ticker].cost+=tx.net;}
    return '<tr style="'+(_txSelected.has(tx.id)?'background:rgba(0,200,255,.05)':'')+'">'
      +'<td><input type="checkbox" '+ (_txSelected.has(tx.id)?'checked':'')+' onchange="txToggleSel('+tx.id+',this.checked)" style="cursor:pointer"></td>'
      +'<td class="mono" style="color:var(--text2);font-size:11px">'+tx.date+'</td>'
      +'<td><span class="badge '+(isBuy?'b-up':'b-dn')+'">'+tx.type+'</span></td>'
      +'<td><span class="tp">'+tx.ticker+'</span></td>'
      +'<td style="font-size:11px;color:var(--text2)">'+tx.sekuritas+'</td>'
      +'<td class="mono">'+tx.lot+'</td>'
      +'<td class="mono">'+tx.lot*100+'</td>'
      +'<td class="mono">Rp '+fmt(tx.price)+'</td>'
      +'<td class="mono">Rp '+fmtK(tx.gross)+'</td>'
      +'<td class="mono amb">Rp '+fmtK(tx.komisi)+'</td>'
      +'<td class="mono dn">Rp '+fmtK(tx.tax)+'</td>'
      +'<td class="mono" style="font-weight:600">Rp '+fmtK(tx.net)+'</td>'
      +'<td>'+pnlHtml+'</td>'
      +'<td style="display:flex;gap:4px;align-items:center">'
        +'<button class="btn btn-ghost btn-xs" style="color:var(--accent)" onclick="editTx('+tx.id+')" title="Edit transaksi">✎</button>'
        +'<button class="btn btn-ghost btn-xs" style="color:var(--red)" onclick="delTx('+tx.id+')" title="Hapus transaksi">✕</button>'
      +'</td>'
      +'</tr>';
  }).join('')||'<tr><td colspan="13" style="text-align:center;color:var(--text3);padding:16px;font-family:\'IBM Plex Mono\',monospace">Belum ada transaksi</td></tr>';
}

function renderPortofolio(){
  var porto=getPortfolio();
  var totalMV=porto.reduce(function(a,p){return a+p.mv},0);
  var totalCost=porto.reduce(function(a,p){return a+p.cost},0);
  var unreal=totalMV-totalCost;
  var pct=totalCost>0?unreal/totalCost*100:0;
  var best=porto.reduce(function(a,p){return p.ret>a.ret?p:a},{ret:-Infinity,ticker:'-'});

  el('p-invest').textContent='Rp '+fmtK(totalCost);
  el('p-market').textContent='Rp '+fmtK(totalMV);
  el('p-unreal').className='mval '+(unreal>=0?'up':'dn');
  el('p-unreal').textContent=(unreal>=0?'+':'')+'Rp '+fmtK(unreal);
  el('p-unreal-pct').innerHTML='<span class="'+(unreal>=0?'up':'dn')+'">'+pct.toFixed(2)+'% dari modal</span>';
  el('p-best').className='mval '+(best.ret>=0?'up':'dn');
  el('p-best').textContent=best.ret!==-Infinity?(best.ret>=0?'+':'')+best.ret.toFixed(2)+'%':'-';
  el('p-best-sub').textContent=best.ticker!=='-'?best.ticker:'';

  el('porto-tbody').innerHTML=porto.map(function(p,i){
    var alloc=totalMV>0?(p.mv/totalMV*100):0;
    var sig=p.ret>5?'BUY':p.ret<-5?'SELL':'HOLD';
    var sigCls=sig==='BUY'?'sig-buy':sig==='SELL'?'sig-sell':'sig-hold';
    var secColor=IDX_SECTORS[p.info.sector]?IDX_SECTORS[p.info.sector].color:'#4a5e82';
    return '<tr><td><span class="tp" style="border-color:'+COLORS[i%12]+'">'+p.ticker+'</span></td><td style="font-size:11px;color:var(--text2)">'+p.info.name+'</td><td><span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;font-family:\'IBM Plex Mono\',monospace;color:var(--text2)"><span class="sec-dot" style="background:'+secColor+'"></span>'+p.info.sector+'</span></td><td class="mono">'+p.lot+'</td><td class="mono">'+p.shares+'</td><td class="mono">Rp '+fmt(p.avg)+'</td><td class="mono" style="color:var(--accent)">Rp '+fmt(p.mp)+'</td><td class="mono">Rp '+fmtK(p.mv)+'</td><td class="mono" style="color:var(--text2)">Rp '+fmtK(p.cost)+'</td><td class="mono '+(p.unreal>=0?'up':'dn')+'">'+(p.unreal>=0?'+':'')+'Rp '+fmtK(p.unreal)+'</td><td class="mono '+(p.ret>=0?'up':'dn')+'">'+(p.ret>=0?'+':'')+p.ret.toFixed(2)+'%</td><td><div class="prog" style="width:70px"><div class="progf" style="width:'+alloc.toFixed(1)+'%;background:'+COLORS[i%12]+'"></div></div><div style="font-size:9px;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;margin-top:2px">'+alloc.toFixed(1)+'%</div></td><td><span class="sig '+sigCls+'">'+sig+'</span></td></tr>';
  }).join('')||'<tr><td colspan="13" style="text-align:center;color:var(--text3);padding:16px;font-family:\'IBM Plex Mono\',monospace">Belum ada posisi aktif</td></tr>';
}

var _divSelected = new Set();

function renderDividen(){
  var yearFilter = el('div-year-filter')&&el('div-year-filter').value||'all';
  var growthRate = parseFloat(el('div-growth-sel')&&el('div-growth-sel').value||0.08);

  // Hanya dari user transactions (XLSX sudah dikosongkan)
  var filtered = yearFilter==='all' ? dividends.slice() :
    dividends.filter(function(d){ return d.date && d.date.startsWith(yearFilter); });
  filtered.sort(function(a,b){ return b.date.localeCompare(a.date); });

  var totalNet = dividends.reduce(function(a,d){return a+d.net},0);
  var totalTax = dividends.reduce(function(a,d){return a+d.tax},0);
  var yr = new Date().getFullYear();
  var ytd = dividends.filter(function(d){return d.date&&d.date.startsWith(yr)});
  var ytdNet = ytd.reduce(function(a,d){return a+d.net},0);
  var porto = getPortfolio();
  var totalMV = porto.reduce(function(a,p){return a+p.mv},0)||1;

  el('dv-total').textContent = 'Rp '+fmtK(totalNet);
  el('dv-total-sub').textContent = dividends.length+' catatan dividen';
  el('dv-ytd').textContent = 'Rp '+fmtK(ytdNet);
  el('dv-ytd-sub').textContent = ytd.length+' pembayaran '+yr;
  el('dv-tax').textContent = 'Rp '+fmtK(totalTax);
  el('dv-yield').textContent = totalMV>0?(totalNet/totalMV*100).toFixed(2)+'%':'0,00%';

  // ── Chart: per tahun ──
  kc('divYC');
  var byYr={};
  dividends.forEach(function(d){ var y=d.date?d.date.slice(0,4):'?'; byYr[y]=(byYr[y]||0)+d.net; });
  var years = Object.keys(byYr).sort();
  var cvY = el('divYearChart');
  if(cvY && years.length){
    charts['divYC'] = new Chart(cvY, {type:'bar',
      data:{labels:years, datasets:[{data:years.map(function(y){return byYr[y]}),
        backgroundColor:'rgba(0,229,160,.65)', borderRadius:4}]},
      options:{responsive:true,maintainAspectRatio:false,
        plugins:{legend:{display:false},tooltip:Object.assign({},TT,{callbacks:{label:function(c){return 'Rp '+fmtK(c.parsed.y)}}})},
        scales:{x:{grid:{color:GC},ticks:TC},y:{grid:{color:GC},ticks:Object.assign({},TC,{callback:function(v){return 'Rp '+fmtK(v)}}),position:'right'}}}
    });
  }

  // ── Chart: per saham ──
  kc('divC');
  var byT={};
  dividends.forEach(function(d){ byT[d.ticker]=(byT[d.ticker]||0)+d.net; });
  var tks = Object.keys(byT).sort(function(a,b){return byT[b]-byT[a]}).slice(0,10);
  var cvD = el('divChart');
  if(cvD && tks.length){
    charts['divC'] = new Chart(cvD, {type:'bar',
      data:{labels:tks, datasets:[{data:tks.map(function(t){return byT[t]}),
        backgroundColor:COLORS.slice(0,tks.length), borderRadius:4}]},
      options:{responsive:true,maintainAspectRatio:false,
        plugins:{legend:{display:false},tooltip:Object.assign({},TT,{callbacks:{label:function(c){return 'Rp '+fmtK(c.parsed.y)}}})},
        scales:{x:{grid:{color:GC},ticks:TC},y:{grid:{color:GC},ticks:Object.assign({},TC,{callback:function(v){return 'Rp '+fmtK(v)}}),position:'right'}}}
    });
  }

  // ── Proyeksi 5 tahun ──
  var baseYr = totalNet > 0 ? totalNet : (ytdNet||1000000);
  var projYears=[2027,2028,2029,2030,2031];
  var projVals = projYears.map(function(y,i){ return Math.round(baseYr*Math.pow(1+growthRate,i+1)); });
  var cards = el('div-proj-cards');
  if(cards) cards.innerHTML = projYears.map(function(y,i){
    var val=projVals[i]; var pct=((val-baseYr)/baseYr*100).toFixed(0);
    return '<div style="background:rgba(0,229,160,.06);border:1px solid rgba(0,229,160,.15);border-radius:9px;padding:10px;text-align:center">'+
      '<div style="font-size:11px;font-weight:700;color:var(--green);margin-bottom:4px">'+y+'</div>'+
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:13px;font-weight:600">Rp '+fmtK(val)+'</div>'+
      '<div style="font-size:10px;color:var(--text3);margin-top:2px">+'+pct+'% vs base</div>'+
    '</div>';
  }).join('');
  kc('divProj');
  var cvP = el('divProjChart');
  if(cvP){
    charts['divProj'] = new Chart(cvP, {type:'line',
      data:{labels:projYears.map(String),datasets:[
        {data:projVals, borderColor:'#00e5a0', borderWidth:2, fill:true, tension:.4, pointRadius:4,
         backgroundColor:'rgba(0,229,160,.08)'},
        {data:projYears.map(function(){return baseYr}), borderColor:'rgba(255,255,255,.15)',
         borderWidth:1, borderDash:[4,3], fill:false, pointRadius:0}
      ]},
      options:{responsive:true,maintainAspectRatio:false,
        plugins:{legend:{display:false},tooltip:Object.assign({},TT,{callbacks:{label:function(c){return 'Rp '+fmtK(c.parsed.y)}}})},
        scales:{x:{grid:{color:GC},ticks:TC},y:{grid:{color:GC},ticks:Object.assign({},TC,{callback:function(v){return 'Rp '+fmtK(v)}}),position:'right'}}}
    });
  }

  // ── Tabel ──
  var selBtns = el('div-del-sel-btn');
  if(selBtns) selBtns.style.display = _divSelected.size>0?'inline-flex':'none';

  el('div-tbody').innerHTML = filtered.map(function(d){
    var mp = prices[d.ticker]||DB[d.ticker]&&DB[d.ticker].base||1;
    var yld = d.dps && mp ? (d.dps/mp*100).toFixed(2)+'%' : '—';
    var isSel = _divSelected.has(d.id);
    var sharesDisp = (d.shares||0).toLocaleString('id-ID') || '<span style="color:var(--red)">?</span>';
    var dpsDisp   = d.dps ? 'Rp '+fmt(d.dps) : '<span style="color:var(--red)">?</span>';
    var taxDisp   = d.tax!=null ? 'Rp '+fmtK(d.tax) : '<span style="color:var(--red)">?</span>';
    return '<tr style="'+(isSel?'background:rgba(0,200,255,.05)':'')+'">'
      +'<td><input type="checkbox" '+(isSel?'checked':'')+' onchange="divToggleSel('+d.id+',this.checked)" style="cursor:pointer"></td>'
      +'<td class="mono" style="color:var(--text2);font-size:11px">'+d.date+'</td>'
      +'<td><span class="tp">'+d.ticker+'</span></td>'
      +'<td class="mono">'+sharesDisp+'</td>'
      +'<td class="mono">'+dpsDisp+'</td>'
      +'<td class="mono">Rp '+fmtK(d.gross||0)+'</td>'
      +'<td class="mono dn">'+taxDisp+'</td>'
      +'<td class="mono up">Rp '+fmtK(d.net||0)+'</td>'
      +'<td><span class="badge b-amb">'+yld+'</span></td>'
      +'<td style="display:flex;gap:4px">'
        +'<button class="btn btn-ghost btn-xs" style="color:var(--accent)" onclick="editDiv('+d.id+')" title="Edit">✎</button>'
        +'<button class="btn btn-ghost btn-xs" style="color:var(--red)" onclick="delDiv('+d.id+')" title="Hapus">✕</button>'
      +'</td>'
      +'</tr>';
  }).join('')||'<tr><td colspan="10" style="text-align:center;color:var(--text3);padding:16px">Belum ada data dividen. Klik "+ Catat Dividen" untuk mulai.</td></tr>';
}

// ── Dividen helpers ──
function divToggleAll(checked){
  var vis = el('div-tbody').querySelectorAll('input[type=checkbox]');
  vis.forEach(function(cb){ cb.checked=checked; });
  dividends.forEach(function(d){ checked ? _divSelected.add(d.id) : _divSelected.delete(d.id); });
  var b=el('div-del-sel-btn'); if(b) b.style.display=_divSelected.size>0?'inline-flex':'none';
}
function divToggleSel(id, checked){
  checked ? _divSelected.add(id) : _divSelected.delete(id);
  var b=el('div-del-sel-btn'); if(b) b.style.display=_divSelected.size>0?'inline-flex':'none';
}
function deleteSelectedDiv(){
  if(_divSelected.size===0) return;
  if(!confirm('Hapus '+_divSelected.size+' dividen terpilih?')) return;
  _divSelected.forEach(function(id){
    dividends = dividends.filter(function(d){return d.id!==id});
    rdnMutations = rdnMutations.filter(function(r){return r.linkedTxId!=='div-'+id});
  });
  _divSelected.clear();
  rebuildRdnBalance();
  saveData();
  showSaveStatus('✓ Dividen terpilih dihapus');
  renderDividen();
}
function clearAllDiv(){
  if(!confirm('⚠️ Hapus SEMUA catatan dividen? Ini tidak bisa dibatalkan.')) return;
  var ids = dividends.map(function(d){return d.id});
  ids.forEach(function(id){
    rdnMutations = rdnMutations.filter(function(r){return r.linkedTxId!=='div-'+id});
  });
  dividends = [];
  _divSelected.clear();
  rebuildRdnBalance();
  saveData();
  showSaveStatus('✓ Semua dividen dihapus');
  renderDividen();
}
function selectAllDiv(){
  var allChecked = _divSelected.size===dividends.length && dividends.length>0;
  divToggleAll(!allChecked);
  renderDividen();
}
function editDiv(id){
  var d = dividends.find(function(x){return x.id===id}); if(!d) return;
  var tkrOpts = Object.keys(DB).map(function(t){return '<option value="'+t+'"'+(t===d.ticker?' selected':'')+'>'+t+'</option>'}).join('');
  el('m-title').textContent='Edit Dividen — '+d.ticker;
  el('m-title').style.color='var(--green)';
  el('m-body').innerHTML=
    '<div class="fgrid">'+
      '<div class="fg"><label class="flabel">Tanggal</label><input class="finput" type="date" id="ed-date" value="'+(d.date||today())+'"></div>'+
      '<div class="fg"><label class="flabel">Ticker</label><select class="finput fsel" id="ed-ticker">'+tkrOpts+'</select></div>'+
      '<div class="fg"><label class="flabel">Lembar Saham</label><input class="finput" type="number" id="ed-shares" value="'+(d.shares||0)+'" oninput="edDivCalc()"></div>'+
      '<div class="fg"><label class="flabel">Dividen/Lembar (Rp)</label><input class="finput" type="number" id="ed-dps" value="'+(d.dps||0)+'" oninput="edDivCalc()"></div>'+
      '<div class="fg"><label class="flabel">PPh (%)</label><input class="finput" type="number" id="ed-pph-pct" value="10" min="0" max="100" step="0.1" oninput="edDivCalc()"></div>'+
    '</div>'+
    '<div class="taxbox">'+
      '<div class="taxrow"><span>Kotor</span><span class="mono" id="ed-gross">Rp 0</span></div>'+
      '<div class="taxrow"><span>PPh</span><span class="mono dn" id="ed-tax">-Rp 0</span></div>'+
      '<div class="taxrow tot"><span>Bersih</span><span class="mono up" id="ed-net">Rp 0</span></div>'+
    '</div>'+
    '<div style="margin-top:14px;display:flex;gap:8px;justify-content:flex-end">'+
      '<button class="btn btn-ghost" onclick="closeModal()">Batal</button>'+
      '<button class="btn btn-green" onclick="submitEditDiv('+id+')">💾 Simpan</button>'+
    '</div>';
  setTimeout(function(){ edDivCalc(); }, 50);
  el('modal').classList.add('on');
}
function edDivCalc(){
  var shares=parseFloat(el('ed-shares')&&el('ed-shares').value||0);
  var dps=parseFloat(el('ed-dps')&&el('ed-dps').value||0);
  var pct=parseFloat(el('ed-pph-pct')&&el('ed-pph-pct').value||10)/100;
  var gross=shares*dps; var tax=gross*pct; var net=gross-tax;
  if(el('ed-gross')) el('ed-gross').textContent='Rp '+fmt(gross);
  if(el('ed-tax'))   el('ed-tax').textContent='-Rp '+fmt(tax);
  if(el('ed-net'))   el('ed-net').textContent='Rp '+fmt(net);
}
function submitEditDiv(id){
  var date=el('ed-date').value; var ticker=el('ed-ticker').value;
  var shares=parseFloat(el('ed-shares').value||0); var dps=parseFloat(el('ed-dps').value||0);
  var pct=parseFloat(el('ed-pph-pct').value||10)/100;
  if(!date||!ticker||shares<=0) { alert('Lengkapi data!'); return; }
  var gross=shares*dps; var tax=gross*pct; var net=gross-tax;
  var idx = dividends.findIndex(function(d){return d.id===id}); if(idx===-1) return;
  // Update RDN linked
  rdnMutations = rdnMutations.filter(function(r){return r.linkedTxId!=='div-'+id});
  dividends[idx] = {id:id,date:date,ticker:ticker,shares:shares,dps:dps,gross:gross,tax:tax,net:net};
  addRdn(date,'DIVIDEN','Dividen '+ticker+' Rp '+fmt(dps)+'/lbr',net,'—','div-'+id);
  rebuildRdnBalance();
  saveData();
  showSaveStatus('✓ Dividen '+ticker+' diperbarui');
  closeModal(); renderDividen();
}

function renderSektoral(){
  var porto=getPortfolio();
  var totalMV=porto.reduce(function(a,p){return a+p.mv},0)||1;
  var byS={};
  porto.forEach(function(p){
    var s=p.info.sector;
    if(!byS[s])byS[s]={mv:0,stocks:[]};
    byS[s].mv+=p.mv;byS[s].stocks.push(p);
  });
  var sectors=Object.keys(byS).sort(function(a,b){return byS[b].mv-byS[a].mv});
  var topSec=sectors[0]||'-';
  var secCnt=sectors.length;
  var divScore=Math.min(10,Math.round(secCnt*10/11+((secCnt>=5&&byS[topSec]&&byS[topSec].mv/totalMV<0.5)?2:0)));
  var concPct=byS[topSec]?(byS[topSec].mv/totalMV*100).toFixed(1):'0';

  el('sec-top').textContent=topSec;
  el('sec-top-pct').textContent=byS[topSec]?(byS[topSec].mv/totalMV*100).toFixed(1)+'% dari portofolio':'';
  el('sec-cnt').textContent=secCnt;
  el('sec-div-score').textContent=divScore+'/10';
  el('sec-div-score').className='mval '+(divScore>=6?'up':divScore>=4?'amb':'dn');
  el('sec-div-label').textContent=divScore>=7?'Sangat Terdiversifikasi':divScore>=5?'Cukup Terdiversifikasi':divScore>=3?'Perlu Diversifikasi':'Konsentrasi Tinggi';
  el('sec-conc').textContent=concPct+'%';
  el('sec-conc').className='mval '+(parseFloat(concPct)<=40?'up':parseFloat(concPct)<=60?'amb':'dn');
  el('sec-conc-sub').textContent=(topSec!=='-'?topSec:'')+ ' sektor teratas';

  el('sector-detail').innerHTML=sectors.map(function(s){
    var sv=byS[s];var alloc=(sv.mv/totalMV*100);
    var sInfo=IDX_SECTORS[s]||{color:'#4a5e82',desc:''};
    return '<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px"><div style="display:flex;align-items:center;gap:6px"><span class="sec-dot" style="background:'+sInfo.color+'"></span><span style="font-size:12px;font-weight:600">'+s+'</span></div><div style="text-align:right"><span style="font-family:\'IBM Plex Mono\',monospace;font-size:11px">'+alloc.toFixed(1)+'%</span></div></div><div class="prog"><div class="progf" style="width:'+alloc+'%;background:'+sInfo.color+'"></div></div><div style="font-size:10px;color:var(--text3);margin-top:2px">'+sv.stocks.length+' saham · Rp '+fmtK(sv.mv)+'</div></div>';
  }).join('')||'<div style="color:var(--text3);text-align:center;padding:20px">Belum ada portofolio</div>';

  el('sector-stocks').innerHTML=sectors.map(function(s){
    var sv=byS[s];var sInfo=IDX_SECTORS[s]||{color:'#4a5e82',desc:''};
    return '<div style="margin-bottom:14px"><div style="display:flex;align-items:center;gap:7px;margin-bottom:7px"><span class="sec-dot" style="background:'+sInfo.color+'"></span><span style="font-size:12px;font-weight:600">'+s+'</span><span class="badge b-gray" style="margin-left:auto">'+sInfo.desc+'</span></div><div style="display:flex;flex-wrap:wrap;gap:6px">'+sv.stocks.map(function(p){return '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:7px;padding:7px 10px;min-width:120px"><div style="display:flex;justify-content:space-between;align-items:center"><span class="tp" style="border-color:'+sInfo.color+'">'+p.ticker+'</span><span class="badge '+(p.ret>=0?'b-up':'b-dn')+'">'+(p.ret>=0?'+':'')+p.ret.toFixed(1)+'%</span></div><div style="font-size:10px;color:var(--text2);margin-top:3px">'+p.lot+' lot · Rp '+fmtK(p.mv)+'</div></div>'}).join('')+'</div></div>';
  }).join('')||'<div style="color:var(--text3);text-align:center;padding:20px">Belum ada portofolio</div>';

  buildSectorChart(porto);
}

function renderRisiko(){
  var porto=getPortfolio();
  var totalMV=porto.reduce(function(a,p){return a+p.mv},0)||1;
  var totalCost=porto.reduce(function(a,p){return a+p.cost},0)||1;

  // Beta portofolio (weighted)
  var portoBeta=porto.reduce(function(a,p){return a+(p.info.beta||1)*(p.mv/totalMV)},0);
  // Volatilitas estimasi (simplified, annualized)
  var avgVol=porto.reduce(function(a,p){return a+(p.info.beta||1)*0.25*(p.mv/totalMV)},0);
  var portVolAnn=(avgVol*100).toFixed(1);
  // VaR 95% = 1.645 * vol * portfolio_value / sqrt(252)
  var dailyVol=avgVol/Math.sqrt(252);
  var var95=totalMV*dailyVol*1.645;
  var var99=totalMV*dailyVol*2.326;
  // Sharpe (simplified)
  var realPnl=getRealizedPnl();
  var unreal=porto.reduce(function(a,p){return a+p.unreal},0);
  var totalReturn=(realPnl+unreal)/totalCost;
  var rfRate=0.065; // Risk-free 6.5% (BI rate approx)
  var sharpe=((totalReturn-rfRate/252*transactions.length)/avgVol).toFixed(2);
  // Win rate
  var sells=transactions.filter(function(t){return t.type==='SELL'});
  var wins=0;var pos2={};
  transactions.slice().sort(function(a,b){return a.date.localeCompare(b.date)}).forEach(function(tx){
    if(!pos2[tx.ticker])pos2[tx.ticker]={lot:0,cost:0};
    var p=pos2[tx.ticker];
    if(tx.type==='BUY'){p.lot+=tx.lot;p.cost+=tx.net;}
    else if(tx.type==='SELL'&&p.lot>0){if(tx.price>p.cost/(p.lot*100))wins++;p.lot-=tx.lot;p.cost=Math.max(0,p.cost-p.cost/(p.lot+tx.lot*100||1)*tx.lot*100);}
  });
  var winRate=sells.length>0?((wins/sells.length)*100).toFixed(1):0;
  // Max drawdown (simplified from unrealized)
  var worstRet=porto.reduce(function(a,p){return p.ret<a?p.ret:a},0);
  // Risk score (0-100)
  var riskScore=Math.min(100,Math.round(
    portoBeta*30 + (parseFloat(portVolAnn)/30)*20 +
    (porto.length<3?30:porto.length<5?15:0) +
    (parseFloat(var95)/totalMV*500)
  ));

  el('risk-score').textContent=riskScore;
  var riskLabel=riskScore>=70?'Risiko Tinggi':riskScore>=40?'Risiko Sedang':'Risiko Rendah';
  el('risk-score').className='mval lg '+(riskScore>=70?'dn':riskScore>=40?'amb':'up');
  el('risk-score-label').innerHTML='<span class="'+(riskScore>=70?'dn':riskScore>=40?'amb':'up')+'">'+riskLabel+'</span>';
  el('var-95').textContent='-Rp '+fmtK(var95);
  el('var-99').textContent='-Rp '+fmtK(var99);
  el('risk-sharpe').textContent=sharpe;
  el('risk-sharpe').className='mval '+(parseFloat(sharpe)>=1?'up':parseFloat(sharpe)>=0?'amb':'dn');
  el('risk-vol').textContent=portVolAnn+'%';
  el('risk-vol').className='mval '+(parseFloat(portVolAnn)<=15?'up':parseFloat(portVolAnn)<=25?'amb':'dn');
  el('risk-beta').textContent=portoBeta.toFixed(2);
  el('risk-beta').className='mval '+(portoBeta<=1?'up':portoBeta<=1.3?'amb':'dn');
  el('risk-dd').textContent=worstRet.toFixed(1)+'%';
  el('risk-win').textContent=winRate+'%';
  el('risk-win').className='mval '+(parseFloat(winRate)>=55?'up':parseFloat(winRate)>=40?'amb':'dn');
  el('risk-win-sub').textContent=wins+'/'+sells.length+' trade menang';

  // Risk per stock
  el('risk-per-stock').innerHTML=porto.map(function(p,i){
    var beta=p.info.beta||1;
    var weight=(p.mv/totalMV*100).toFixed(1);
    var vol=(beta*25).toFixed(1);
    var varStock=p.mv*beta*0.25/Math.sqrt(252)*1.645;
    var rLevel=beta>=1.3?'Tinggi':beta>=1.0?'Sedang':'Rendah';
    var rCls=beta>=1.3?'b-dn':beta>=1.0?'b-amb':'b-up';
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border)"><div style="display:flex;align-items:center;gap:8px"><span class="tp" style="border-color:'+COLORS[i%12]+'">'+p.ticker+'</span><div><div style="font-size:10px;color:var(--text2);font-family:\'IBM Plex Mono\',monospace">β='+beta.toFixed(2)+' · Vol '+vol+'%/yr</div><div style="font-size:9px;color:var(--text3);font-family:\'IBM Plex Mono\',monospace">Bobot '+weight+'% · VaR95: -Rp '+fmtK(varStock)+'</div></div></div><span class="badge '+rCls+'">'+rLevel+'</span></div>';
  }).join('')||'<div style="color:var(--text3);text-align:center;padding:16px">Belum ada posisi</div>';

  // Stress test
  var scenarios=[
    {name:'Krisis 2008 (−50%)',shock:-0.50,color:'var(--red)'},
    {name:'COVID-19 (−30%)',shock:-0.30,color:'var(--coral)'},
    {name:'Koreksi Ringan (−15%)',shock:-0.15,color:'var(--amber)'},
    {name:'Stagnasi (−5%)',shock:-0.05,color:'var(--text2)'},
    {name:'Bull Market (+20%)',shock:+0.20,color:'var(--green)'},
  ];
  el('stress-test').innerHTML=scenarios.map(function(sc){
    var impact=totalMV*(sc.shock*portoBeta);
    var newVal=totalMV+impact;
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--border)"><div><div style="font-size:11px;font-weight:600">'+sc.name+'</div><div style="font-size:10px;color:var(--text3);font-family:\'IBM Plex Mono\',monospace">Nilai portofolio → Rp '+fmtK(newVal)+'</div></div><span style="font-family:\'IBM Plex Mono\',monospace;font-size:12px;color:'+sc.color+';font-weight:600">'+(sc.shock>=0?'+':'')+fmt(Math.round(impact))+'</span></div>';
  }).join('');

  // Recommendations
  var recos=[];
  if(porto.length<5)recos.push({icon:'⚠️',text:'Diversifikasi lebih lanjut — portofolio Anda hanya '+porto.length+' saham. Ideal minimal 8−12 saham.',cls:'alert-warn'});
  if(portoBeta>1.2)recos.push({icon:'📊',text:'Beta tinggi ('+portoBeta.toFixed(2)+') — portofolio lebih volatile dari IHSG. Pertimbangkan tambah saham defensif.',cls:'alert-warn'});
  var byS2={};porto.forEach(function(p){byS2[p.info.sector]=(byS2[p.info.sector]||0)+p.mv});
  var secCnt2=Object.keys(byS2).length;
  if(secCnt2<4)recos.push({icon:'🔴',text:'Hanya '+secCnt2+' sektor — risiko sektoral tinggi. Tambah saham dari sektor berbeda.',cls:'alert-warn'});
  var maxSec=Object.values(byS2).reduce(function(a,b){return Math.max(a,b)},0);
  if(maxSec/totalMV>0.6)recos.push({icon:'⚡',text:'Satu sektor mendominasi >'+(maxSec/totalMV*100).toFixed(0)+'% portofolio. Rebalancing disarankan.',cls:'alert-warn'});
  if(parseFloat(sharpe)<0)recos.push({icon:'📉',text:'Sharpe Ratio negatif — return tidak sepadan dengan risiko yang diambil.',cls:'alert-warn'});
  if(recos.length===0)recos.push({icon:'✅',text:'Profil risiko portofolio dalam kondisi baik. Pertahankan strategi saat ini.',cls:'alert-ok'});

  el('risk-reco').innerHTML=recos.map(function(r){return '<div class="alert '+r.cls+'" style="margin-bottom:7px">'+r.icon+' '+r.text+'</div>'}).join('');

  buildRetDistChart(porto);
}

function renderPajak(){
  // Info bar
  var infoBar = el('pj-info-bar');
  if(infoBar) infoBar.textContent = 'ℹ️ Tarif aktif: Komisi sesuai sekuritas · PPN '+
    (TAX_SETTINGS.ppn*100).toFixed(0)+'% × Komisi · Levy '+
    (TAX_SETTINGS.levy*100).toFixed(3)+'% (BEI+KPEI+KSEI) · PPh Final Jual '+
    (TAX_SETTINGS.pphJual*100).toFixed(1)+'% · PPh Dividen 10%';
  if(typeof renderSekTaxPanel==='function') renderSekTaxPanel();

  var pj = TAX_SETTINGS.pphJual*100;
  var buys  = transactions.filter(function(t){return t.type==='BUY'});
  var sells = transactions.filter(function(t){return t.type==='SELL'});
  var totalPphBeli = buys.reduce(function(a,t){return a+t.tax},0);
  var totalPphJual = sells.reduce(function(a,t){return a+t.tax},0);
  var totalPph  = totalPphBeli + totalPphJual;
  var totalDiv  = dividends.reduce(function(a,d){return a+d.tax},0);
  var totalKom  = transactions.reduce(function(a,t){return a+t.komisi},0);

  el('pj-pph-label').textContent = 'PPh Final Jual ('+pj.toFixed(1)+'%) + Levy+PPN';
  el('pj-pph').textContent = 'Rp '+fmtK(totalPph);
  el('pj-pph-sub').textContent = buys.length+' beli + '+sells.length+' jual';
  el('pj-div').textContent = 'Rp '+fmtK(totalDiv);
  el('pj-div-sub').textContent = dividends.length+' pembayaran';
  el('pj-kom').textContent = 'Rp '+fmtK(totalKom);
  el('pj-kom-sub').textContent = transactions.length+' transaksi';
  el('pj-tot').textContent = 'Rp '+fmtK(totalPph+totalDiv+totalKom);

  // Badge rate
  if(el('pj-pph-rate-badge')) el('pj-pph-rate-badge').textContent = 'PPh Jual '+pj.toFixed(1)+'% · Levy '+(TAX_SETTINGS.levy*100).toFixed(3)+'% · PPN '+(TAX_SETTINGS.ppn*100).toFixed(0)+'%';

  // By sekuritas
  var bySec={};
  transactions.forEach(function(tx){
    if(!bySec[tx.sekuritas])bySec[tx.sekuritas]={cnt:0,komisi:0,pph:0};
    bySec[tx.sekuritas].cnt++;bySec[tx.sekuritas].komisi+=tx.komisi;bySec[tx.sekuritas].pph+=tx.tax;
  });
  el('pj-by-sec').innerHTML=Object.entries(bySec).map(function(e){
    var s=e[0],d=e[1];var sInfo=SEKURITAS[s]||{buyFee:0.0015,sellFee:0.0025,color:'#4a5e82'};
    return '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:10px;margin-bottom:8px">'+
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">'+
        '<span style="font-weight:600;font-size:12px;display:flex;align-items:center;gap:6px">'+
          '<span style="width:7px;height:7px;border-radius:50%;background:'+(sInfo.color||'#4a5e82')+';display:inline-block"></span>'+s+
        '</span><span class="badge b-gray">'+d.cnt+' tx</span></div>'+
      '<div class="taxrow"><span>Komisi</span><span class="mono amb">Rp '+fmtK(d.komisi)+'</span></div>'+
      '<div class="taxrow"><span>PPh (Beli+Jual)</span><span class="mono dn">Rp '+fmtK(d.pph)+'</span></div>'+
      '<div style="display:flex;gap:6px;margin-top:4px">'+
        '<span class="badge" style="font-size:9px;background:rgba(0,229,160,.1);color:var(--green)">Beli '+(sInfo.buyFee*100).toFixed(2)+'%</span>'+
        '<span class="badge" style="font-size:9px;background:rgba(255,61,90,.1);color:var(--red)">Jual '+(sInfo.sellFee*100).toFixed(2)+'%</span>'+
      '</div></div>';
  }).join('')||'<div style="color:var(--text3);text-align:center;padding:16px">Belum ada transaksi</div>';

  // Table ALL transactions (buy + sell)
  el('pj-tbody').innerHTML=transactions.slice().sort(function(a,b){return b.date.localeCompare(a.date)}).map(function(tx){
    var isBuy=tx.type==='BUY';
    return '<tr>'+
      '<td class="mono" style="color:var(--text2);font-size:11px">'+tx.date+'</td>'+
      '<td><span class="badge '+(isBuy?'b-up':'b-dn')+'">'+tx.type+'</span></td>'+
      '<td><span class="tp">'+tx.ticker+'</span></td>'+
      '<td style="font-size:11px;color:var(--text2)">'+tx.sekuritas+'</td>'+
      '<td class="mono">Rp '+fmtK(tx.gross)+'</td>'+
      '<td class="mono dn">Rp '+fmtK(tx.tax)+'</td>'+
      '<td class="mono amb">Rp '+fmtK(tx.komisi)+'</td>'+
      '<td class="mono" style="font-weight:600">Rp '+fmtK(tx.tax+tx.komisi)+'</td>'+
    '</tr>';
  }).join('')||'<tr><td colspan="8" style="text-align:center;color:var(--text3);padding:14px">Belum ada transaksi</td></tr>';

  // Tax settings UI populate — selalu sinkron dengan TAX_SETTINGS terkini
  var tpi = el('tax-ppn-input'), tli = el('tax-levy-input'), tji = el('tax-jual-input');
  if(tpi){ tpi.value=(TAX_SETTINGS.ppn*100).toFixed(0); }
  if(tli){ tli.value=(TAX_SETTINGS.levy*100).toFixed(3); } // display as persen: 0.043
  if(tji){ tji.value=(TAX_SETTINGS.pphJual*100).toFixed(2); }
  taxPreviewLive();

  // Simulator
  var simSec=el('sim-sec');
  if(simSec&&simSec.options.length===0){
    Object.keys(SEKURITAS).forEach(function(s){var o=document.createElement('option');o.value=s;o.textContent=s;simSec.appendChild(o)});
  }
  if(el('sim-sec')) el('sim-sec').onchange=el('sim-lot').oninput=el('sim-price').oninput=simCalcTax;
}

function simCalcTax(){
  var secName=el('sim-sec')&&el('sim-sec').value||'Stockbit';
  var lot=parseFloat(el('sim-lot')&&el('sim-lot').value)||0;
  var price=parseFloat(el('sim-price')&&el('sim-price').value)||0;
  var gross=lot*100*price;
  var cB=calcTxComponents(gross,true,secName);
  var cJ=calcTxComponents(gross,false,secName);
  if(el('s-gross'))       el('s-gross').textContent='Rp '+fmt(gross);
  if(el('s-pph-label'))   el('s-pph-label').textContent='PPh Final Jual ('+(TAX_SETTINGS.pphJual*100).toFixed(1)+'%)';
  if(el('s-pph'))         el('s-pph').textContent='-Rp '+fmt(cJ.pph);
  if(el('s-kom-label'))   el('s-kom-label').textContent='Komisi Jual ('+(cJ.komisiRate*100).toFixed(3)+'%) + PPN+Levy';
  if(el('s-kom'))         el('s-kom').textContent='-Rp '+fmt(cJ.komisi+cJ.ppn+cJ.levy);
  if(el('s-net'))         el('s-net').textContent='Rp '+fmt(cJ.net);
  if(el('s-buy'))         el('s-buy').textContent='Rp '+fmt(gross);
  if(el('s-pph-beli-label')) el('s-pph-beli-label').textContent='PPN+Levy Beli';
  if(el('s-pph-beli'))    el('s-pph-beli').textContent='-Rp '+fmt(cB.ppn+cB.levy);
  if(el('s-bkom-label'))  el('s-bkom-label').textContent='Komisi Beli ('+(cB.komisiRate*100).toFixed(3)+'%)';
  if(el('s-bkom'))        el('s-bkom').textContent='-Rp '+fmt(cB.komisi);
  if(el('s-btot'))        el('s-btot').textContent='Rp '+fmt(cB.net);
}

function taxPreviewLive(){
  var ppn  = parseFloat(el('tax-ppn-input')&&el('tax-ppn-input').value||TAX_SETTINGS.ppn*100)/100;
  var levy = parseFloat(el('tax-levy-input')&&el('tax-levy-input').value||TAX_SETTINGS.levy*100)/100;
  var j    = parseFloat(el('tax-jual-input')&&el('tax-jual-input').value||TAX_SETTINGS.pphJual*100)/100;
  if(el('tax-ppn-disp'))  el('tax-ppn-disp').textContent=(ppn*100).toFixed(0)+'%';
  if(el('tax-levy-disp')) el('tax-levy-disp').textContent=(levy*100).toFixed(3)+'%';
  if(el('tax-jual-disp')) el('tax-jual-disp').textContent=(j*100).toFixed(2)+'%';
  // Preview: 10 lot @ Rp 5.000, Stockbit komisi 0.15%/0.25%
  var gross=10*100*5000;
  var komB=gross*0.0015, komJ=gross*0.0025;
  var ppnB=komB*ppn, ppnJ=komJ*ppn;
  var levyB=gross*levy, levyJ=gross*levy;
  var pphJ=gross*j;
  if(el('tax-prev-beli')) el('tax-prev-beli').textContent='Rp '+fmt(komB+ppnB+levyB);
  if(el('tax-prev-jual')) el('tax-prev-jual').textContent='Rp '+fmt(komJ+ppnJ+levyJ+pphJ);
  if(el('tax-prev-diff')) el('tax-prev-diff').textContent='Rp '+fmt(komB+ppnB+levyB+komJ+ppnJ+levyJ+pphJ);
  simCalcTax();
}

function applyTaxPreset(ppn, pphJual, levy){
  if(ppn!==undefined)     TAX_SETTINGS.ppn=ppn;
  if(pphJual!==undefined) TAX_SETTINGS.pphJual=pphJual;
  if(levy!==undefined)    TAX_SETTINGS.levy=levy;
  var tpi=el('tax-ppn-input'), tli=el('tax-levy-input'), tji=el('tax-jual-input');
  if(tpi){tpi.value=(TAX_SETTINGS.ppn*100).toFixed(0);}
  if(tli){tli.value=(TAX_SETTINGS.levy*100).toFixed(3);}
  if(tji){tji.value=(TAX_SETTINGS.pphJual*100).toFixed(2);}
  taxPreviewLive();
  saveTaxSettings();
  saveData(); // FIX SINKRONISASI: kirim juga ke cloud — tanpa ini, login berikutnya menimpa balik dengan tarif lama
  showSaveStatus('✓ Preset pajak: PPN '+(TAX_SETTINGS.ppn*100).toFixed(0)+'% · Levy '+(TAX_SETTINGS.levy*100).toFixed(3)+'% · PPh Final Jual '+(TAX_SETTINGS.pphJual*100).toFixed(2)+'%');
}

function saveTaxFromUI(){
  var ppn  = parseFloat(el('tax-ppn-input').value||0)/100;
  var levy = parseFloat(el('tax-levy-input').value||0)/100;
  var j    = parseFloat(el('tax-jual-input').value||0)/100;
  TAX_SETTINGS.ppn=ppn; TAX_SETTINGS.levy=levy; TAX_SETTINGS.pphJual=j;
  saveTaxSettings();
  saveData(); // FIX SINKRONISASI: kirim juga ke cloud — tanpa ini, login berikutnya menimpa balik dengan tarif lama
  showSaveStatus('✓ Pajak disimpan: PPN '+(ppn*100).toFixed(0)+'% · Levy '+(levy*100).toFixed(3)+'% · PPh Jual '+(j*100).toFixed(2)+'%');
  renderPajak();
}

