// ============================================================
// CEK KESEHATAN DATA — pemindaian anomali data lokal: saldo RDN minus
// berkepanjangan, transaksi duplikat, mutasi RDN yatim, saham tanpa
// sektor jelas, counter ID yang drift, dan nilai portofolio yang
// tidak wajar (NaN/negatif). Semua dihitung dari data yang SUDAH ADA
// di localStorage/Supabase — tidak ada fetch eksternal, jadi selalu
// instan dan tidak bisa gagal karena jaringan.
// ============================================================

function dhCheckRdnNegative(){
  var rdn = (typeof calcRdnBalance==='function') ? calcRdnBalance() : 0;
  if(rdn>=0) return {status:'ok', title:'Saldo RDN', detail:'Saldo RDN saat ini positif (Rp '+fmt(rdn)+').'};
  // Cari sejak kapan saldo mulai minus (baris terakhir sebelum baris minus pertama yang bertahan)
  var muts=(rdnMutations||[]).slice().sort(function(a,b){return a.date.localeCompare(b.date)||(a.id-b.id);});
  var since=null;
  for(var i=0;i<muts.length;i++){ if(muts[i].balance<0){ since=muts[i].date; break; } }
  return {status:'warn', title:'Saldo RDN Minus', detail:'Saldo RDN saat ini Rp '+fmt(rdn)+' (minus) — kemungkinan Anda membeli saham melebihi kas tercatat.'+(since?' Mulai minus sejak sekitar '+since+'.':''), count:1};
}

function dhCheckDuplicateTx(){
  var seen={}, dups=[];
  (transactions||[]).forEach(function(tx){
    var key=[tx.date,tx.ticker,tx.type,tx.lot,tx.price,tx.sekuritas].join('|');
    if(seen[key]) dups.push(tx); else seen[key]=true;
  });
  if(!dups.length) return {status:'ok', title:'Transaksi Duplikat', detail:'Tidak ditemukan transaksi dengan tanggal, ticker, tipe, lot, harga, dan sekuritas yang persis sama.'};
  return {status:'warn', title:'Kemungkinan Transaksi Duplikat', detail:dups.length+' transaksi punya kembaran persis (tanggal+ticker+tipe+lot+harga+sekuritas sama) — cek apakah ini hasil bulk-import yang ter-upload dua kali: '+dups.slice(0,5).map(function(t){return t.date+' '+t.type+' '+t.ticker;}).join(', ')+(dups.length>5?', dst.':''), count:dups.length};
}

function dhCheckOrphanRdn(){
  var txIds={}; (transactions||[]).forEach(function(t){ txIds[t.id]=true; });
  var orphans=(rdnMutations||[]).filter(function(m){
    return m.linkedTxId!=null && String(m.linkedTxId).indexOf('div-')!==0 && !txIds[m.linkedTxId] && !txIds[parseInt(m.linkedTxId,10)];
  });
  if(!orphans.length) return {status:'ok', title:'Mutasi RDN Yatim', detail:'Semua mutasi RDN yang tertaut ke transaksi saham (BUY/SELL) masih punya transaksi induk yang valid.'};
  return {status:'warn', title:'Mutasi RDN Yatim', detail:orphans.length+' mutasi RDN menunjuk ke transaksi saham yang sudah tidak ada (mungkin terhapus tanpa lewat tombol Hapus) — saldo RDN tetap benar (dihitung dari mutasi, bukan dari transaksi), tapi baris ini jadi tidak bisa ditelusuri asalnya.', count:orphans.length};
}

function dhCheckMissingSector(){
  var porto=(typeof getPortfolio==='function')?getPortfolio():[];
  var missing=porto.filter(function(p){ return !p.info || !p.info.sector || p.info.sector==='Lainnya'; });
  if(!porto.length) return {status:'ok', title:'Sektor Saham', detail:'Belum ada posisi saham.'};
  if(!missing.length) return {status:'ok', title:'Sektor Saham', detail:'Semua '+porto.length+' saham yang dipegang punya data sektor lengkap.'};
  return {status:'warn', title:'Saham Tanpa Sektor Jelas', detail:missing.length+' dari '+porto.length+' saham tercatat sektor "Lainnya" (generik) — analisa Sektoral & Konsentrasi Risiko untuk saham ini kurang akurat: '+missing.map(function(p){return p.ticker;}).join(', ')+'. Perbaiki lewat 🛠 Kelola Daftar Saham.', count:missing.length};
}

function dhCheckIdCounters(){
  if(typeof _maxIdPlus1!=='function') return {status:'ok', title:'Counter ID', detail:'Pemeriksaan dilewati (fungsi bantu belum termuat).'};
  var checks=[
    {name:'Transaksi Saham', next:nextTxId, arr:transactions},
    {name:'Dividen', next:nextDivId, arr:dividends},
    {name:'Mutasi RDN', next:nextRdnId, arr:rdnMutations},
    {name:'Crypto', next:typeof nextCryptoId!=='undefined'?nextCryptoId:1, arr:(typeof cryptoTx!=='undefined'?cryptoTx:[])},
    {name:'ETF', next:typeof nextEtfId!=='undefined'?nextEtfId:1, arr:(typeof etfTx!=='undefined'?etfTx:[])},
    {name:'Reksa Dana', next:typeof nextRdId!=='undefined'?nextRdId:1, arr:(typeof rdTx!=='undefined'?rdTx:[])}
  ];
  var drifted=checks.filter(function(c){ return c.next < _maxIdPlus1(c.arr); });
  if(!drifted.length) return {status:'ok', title:'Counter ID', detail:'Semua counter ID (penomoran transaksi berikutnya) sudah lebih besar dari ID maksimum yang ada — aman dari risiko ID bentrok saat sinkronisasi.'};
  return {status:'error', title:'Counter ID Tidak Sinkron', detail:'Counter berikut LEBIH RENDAH dari ID maksimum yang sudah ada (risiko ID bentrok saat menambah data baru / sinkronisasi cloud): '+drifted.map(function(c){return c.name+' (counter='+c.next+', seharusnya ≥'+_maxIdPlus1(c.arr)+')';}).join('; ')+'. Ini seharusnya otomatis diperbaiki tiap kali data dimuat ulang (lihat komentar _maxIdPlus1 di 02-storage.js) — kalau masih muncul di sini, muat ulang halaman (refresh) dulu sebelum menambah transaksi baru.', count:drifted.length};
}

function dhCheckPortfolioSanity(){
  var porto=(typeof getPortfolio==='function')?getPortfolio():[];
  var bad=porto.filter(function(p){ return !isFinite(p.avg) || !isFinite(p.mv) || p.avg<0 || p.cost<0; });
  if(!bad.length) return {status:'ok', title:'Kewajaran Nilai Portofolio', detail:'Tidak ada avg cost / nilai pasar yang NaN, tak terhingga, atau negatif pada posisi saham aktif.'};
  return {status:'error', title:'Nilai Portofolio Tidak Wajar', detail:bad.length+' posisi punya avg cost/nilai pasar yang tidak masuk akal (NaN atau negatif): '+bad.map(function(p){return p.ticker;}).join(', ')+' — kemungkinan ada transaksi dengan lot/harga 0 atau data yang rusak. Cek riwayat transaksi saham ini satu per satu.', count:bad.length};
}

function dhCheckExtremeValues(){
  var flagged=(transactions||[]).filter(function(tx){ return tx.lot>5000 || tx.price<=0 || tx.price>1000000 || !isFinite(tx.gross); });
  if(!flagged.length) return {status:'ok', title:'Transaksi dengan Nilai Ekstrem', detail:'Tidak ada transaksi dengan lot >5.000 atau harga di luar rentang wajar (kemungkinan salah ketik).'};
  return {status:'warn', title:'Transaksi dengan Nilai Berpotensi Salah Ketik', detail:flagged.length+' transaksi punya lot atau harga yang sangat tidak biasa — cek apakah ini salah input (mis. lot dan harga tertukar): '+flagged.slice(0,5).map(function(t){return t.date+' '+t.ticker+' '+t.lot+' lot @Rp'+fmt(t.price);}).join(', ')+(flagged.length>5?', dst.':''), count:flagged.length};
}

function dhRunAllChecks(){
  return [
    dhCheckRdnNegative(),
    dhCheckDuplicateTx(),
    dhCheckOrphanRdn(),
    dhCheckMissingSector(),
    dhCheckIdCounters(),
    dhCheckPortfolioSanity(),
    dhCheckExtremeValues()
  ];
}

function renderDataHealth(){
  var results = dhRunAllChecks();
  var errCnt=results.filter(function(r){return r.status==='error';}).length;
  var warnCnt=results.filter(function(r){return r.status==='warn';}).length;
  var okCnt=results.filter(function(r){return r.status==='ok';}).length;
  var overall = errCnt>0 ? {label:'Perlu Perhatian', cls:'dn', icon:'🔴'} : warnCnt>0 ? {label:'Ada Catatan', cls:'amb', icon:'🟡'} : {label:'Sehat', cls:'up', icon:'🟢'};

  var html = '<div class="ptitle">🩺 Cek Kesehatan Data</div>'
    +'<div class="psub">Pemindaian anomali data lokal — saldo RDN, transaksi duplikat, konsistensi ID, dan kewajaran nilai. Semua instan (tidak ada koneksi ke luar), aman dijalankan kapan saja.</div>'
    +'<div class="row3" style="margin-bottom:18px">'
      +'<div class="metric" style="margin:0"><div class="mlabel">Status Keseluruhan</div><div class="mval '+overall.cls+'" style="font-size:18px">'+overall.icon+' '+overall.label+'</div><div class="msub neu">'+results.length+' pemeriksaan dijalankan</div></div>'
      +'<div class="metric" style="margin:0"><div class="mlabel">Perlu Perhatian</div><div class="mval '+(errCnt>0?'dn':'up')+'" style="font-size:18px">'+errCnt+'</div><div class="msub neu">masalah serius</div></div>'
      +'<div class="metric" style="margin:0"><div class="mlabel">Catatan</div><div class="mval '+(warnCnt>0?'amb':'up')+'" style="font-size:18px">'+warnCnt+'</div><div class="msub neu">'+okCnt+' pemeriksaan bersih</div></div>'
    +'</div>'
    +'<div class="card">'
      +'<div class="cheader"><span class="ctitle">Hasil Pemeriksaan</span><button class="btn btn-ghost btn-xs" onclick="renderDataHealth()">🔄 Jalankan Ulang</button></div>'
      +results.map(function(r){
        var icon = r.status==='error' ? '🔴' : r.status==='warn' ? '🟡' : '🟢';
        var cls = r.status==='error' ? 'alert-warn' : r.status==='warn' ? 'alert-warn' : 'alert-ok';
        return '<div class="alert '+cls+'" style="margin-bottom:8px"><b>'+icon+' '+r.title+'</b><div style="margin-top:4px;font-weight:400">'+r.detail+'</div></div>';
      }).join('')
    +'</div>';

  el('page-datahealth').innerHTML = html;
}
