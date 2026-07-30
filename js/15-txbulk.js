// ╔══════════════════════════════════════════════════════════╗
// ║  BULK IMPORT TRANSAKSI — download template & upload Excel ║
// ║  Tab Transaksi: catat banyak transaksi beli/jual sekaligus║
// ║  dari file .xlsx, komisi/pajak tetap dihitung otomatis    ║
// ║  lewat calcTxComponents() yang sama dengan input manual.  ║
// ╚══════════════════════════════════════════════════════════╝

// ── 1. TEMPLATE — unduh .xlsx siap isi ──
function txDownloadTemplate(){
  if(typeof XLSX==='undefined'){ if(typeof showSaveStatus==='function') showSaveStatus('⚠ Pustaka Excel belum termuat, coba lagi sebentar','var(--red)'); return; }

  var sample = [
    {Tanggal:'2026-01-15', Aksi:'BUY', 'Kode Saham':'BBCA', Sekuritas:'Mirae Asset', Lot:10, 'Harga per Lembar':9500},
    {Tanggal:'2026-02-03', Aksi:'SELL', 'Kode Saham':'BBCA', Sekuritas:'Mirae Asset', Lot:5, 'Harga per Lembar':9800}
  ];
  var wsTx = XLSX.utils.json_to_sheet(sample);
  wsTx['!cols'] = [{wch:12},{wch:8},{wch:12},{wch:16},{wch:8},{wch:16}];

  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsTx, 'Transaksi');

  var wsSek = XLSX.utils.aoa_to_sheet([['Sekuritas Valid — salin persis ke kolom Sekuritas']].concat(
    Object.keys(SEKURITAS).map(function(s){ return [s]; })
  ));
  wsSek['!cols'] = [{wch:26}];
  XLSX.utils.book_append_sheet(wb, wsSek, 'Daftar Sekuritas');

  var petunjuk = [
    ['PETUNJUK PENGISIAN — Template Transaksi Money Watch Pro'],
    [''],
    ['Kolom', 'Keterangan'],
    ['Tanggal', 'Format YYYY-MM-DD, contoh: 2026-01-15'],
    ['Aksi', 'Isi BUY (beli) atau SELL (jual) — huruf besar'],
    ['Kode Saham', 'Kode ticker IDX, contoh: BBCA, TLKM, BBRI (tanpa akhiran .JK)'],
    ['Sekuritas', 'Harus sama persis dengan salah satu nama di sheet "Daftar Sekuritas"'],
    ['Lot', '1 lot = 100 lembar. Angka bulat, harus lebih besar dari 0'],
    ['Harga per Lembar', 'Harga saat transaksi dalam Rupiah, harus lebih besar dari 0'],
    [''],
    ['Komisi, PPN, Levy BEI, dan PPh dihitung OTOMATIS oleh aplikasi sesuai sekuritas & tarif pajak yang sedang aktif — jangan diisi manual.'],
    ['Hapus 2 baris contoh di sheet "Transaksi" sebelum mengisi data Anda, atau timpa langsung baris tersebut.'],
    ['Setelah selesai, unggah file ini lewat tombol "📤 Upload Excel" di tab Transaksi.']
  ];
  var wsInfo = XLSX.utils.aoa_to_sheet(petunjuk);
  wsInfo['!cols'] = [{wch:18},{wch:78}];
  XLSX.utils.book_append_sheet(wb, wsInfo, 'Petunjuk');

  XLSX.writeFile(wb, 'Template_Transaksi_MoneyWatchPro.xlsx');
  if(typeof showSaveStatus==='function') showSaveStatus('✓ Template diunduh — isi lalu upload kembali');
}

// ── 2. UPLOAD — pilih file & mulai proses ──
function txImportExcel(){
  if(typeof XLSX==='undefined'){ if(typeof showSaveStatus==='function') showSaveStatus('⚠ Pustaka Excel belum termuat, coba lagi sebentar','var(--red)'); return; }
  var inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = '.xlsx,.xls';
  inp.onchange = function(){
    var f = inp.files && inp.files[0];
    if(!f) return;
    var reader = new FileReader();
    reader.onload = function(e){
      try{
        var wb = XLSX.read(new Uint8Array(e.target.result), {type:'array', cellDates:true});
        var sheetName = wb.SheetNames.indexOf('Transaksi') > -1 ? 'Transaksi' : wb.SheetNames[0];
        var rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {defval:''});
        txProcessImportRows(rows, f.name);
      }catch(err){
        if(typeof showSaveStatus==='function') showSaveStatus('⚠ Gagal membaca file: '+err.message,'var(--red)');
      }
    };
    reader.readAsArrayBuffer(f);
  };
  inp.click();
}

// ── Parsing tanggal — terima Date object (Excel format tanggal), teks YYYY-MM-DD, atau DD/MM/YYYY ──
function txParseDate(v){
  if(v instanceof Date && !isNaN(v)) return v.toISOString().slice(0,10);
  if(typeof v==='number' && v>0){
    var d = new Date(Math.round((v-25569)*86400*1000));
    if(!isNaN(d)) return d.toISOString().slice(0,10);
  }
  var s = String(v||'').trim();
  var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if(m) return m[1]+'-'+('0'+m[2]).slice(-2)+'-'+('0'+m[3]).slice(-2);
  var m2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if(m2) return m2[3]+'-'+('0'+m2[2]).slice(-2)+'-'+('0'+m2[1]).slice(-2);
  return null;
}

function txValidateRow(r, idx){
  var date = txParseDate(r['Tanggal']);
  var type = String(r['Aksi']||'').trim().toUpperCase();
  var ticker = String(r['Kode Saham']||'').trim().toUpperCase().replace(/\.JK$/,'');
  var sekuritas = String(r['Sekuritas']||'').trim();
  var lot = parsePrice(r['Lot']);
  var price = parsePrice(r['Harga per Lembar']);

  var errs = [];
  if(!date) errs.push('Tanggal tidak valid (pakai format YYYY-MM-DD)');
  if(type!=='BUY' && type!=='SELL') errs.push('Aksi harus BUY atau SELL');
  if(!ticker) errs.push('Kode Saham kosong');
  if(!sekuritas || !SEKURITAS[sekuritas]) errs.push('Sekuritas "'+sekuritas+'" tidak dikenali — lihat sheet Daftar Sekuritas');
  // FIX AUDIT F7: tolak juga Infinity, bukan cuma NaN/negatif/nol
  if(!(lot>0) || !isFinite(lot)) errs.push('Lot harus angka > 0');
  if(!(price>0) || !isFinite(price)) errs.push('Harga harus angka > 0');

  return {row:idx+2, date:date, type:type, ticker:ticker, sekuritas:sekuritas, lot:lot, price:price, ok:errs.length===0, errs:errs};
}

// FIX AUDIT F6: kunci pencocokan duplikat — persis sama di semua kolom berarti
// hampir pasti baris yang sama diupload dua kali (skenario umum: user ragu
// apakah upload pertama berhasil, lalu upload ulang file yang sama).
function txDupKey(r){ return [r.date,r.type,r.ticker,r.lot,r.price,r.sekuritas].join('|'); }

var TX_IMPORT_ROWS = [];
var TX_IMPORT_DUPES = [];

function txProcessImportRows(rows, fileName){
  if(!rows.length){ if(typeof showSaveStatus==='function') showSaveStatus('⚠ File kosong atau tidak ada baris data','var(--red)'); return; }
  var parsed = rows.map(function(r,i){ return txValidateRow(r,i); });
  var okRows = parsed.filter(function(p){ return p.ok; });
  var invalid = parsed.filter(function(p){ return !p.ok; });

  // Pisahkan baris valid yang identik dengan transaksi yang SUDAH ADA di jurnal
  // atau dengan baris LAIN di batch yang sama — jangan auto-impor, minta konfirmasi.
  var existingKeys = {};
  transactions.forEach(function(t){ existingKeys[txDupKey({date:t.date,type:t.type,ticker:t.ticker,lot:t.lot,price:t.price,sekuritas:t.sekuritas})] = true; });
  var seenInBatch = {};
  var valid = [], dupes = [];
  okRows.forEach(function(p){
    var key = txDupKey(p);
    if(existingKeys[key] || seenInBatch[key]) dupes.push(p);
    else { valid.push(p); seenInBatch[key] = true; }
  });
  TX_IMPORT_ROWS = valid;
  TX_IMPORT_DUPES = dupes;

  var body =
    '<div style="font-size:12px;color:var(--text2);margin-bottom:12px">File <b>'+fileName+'</b>: '+
      '<b class="up">'+valid.length+' baris valid</b>'+
      (dupes.length ? ' &nbsp;·&nbsp; <b class="amb">'+dupes.length+' kemungkinan duplikat (dilewati kecuali dicentang)</b>' : '')+
      (invalid.length ? ' &nbsp;·&nbsp; <b class="dn">'+invalid.length+' baris bermasalah (akan dilewati)</b>' : '')+'.</div>'+
    (invalid.length ? '<div style="max-height:150px;overflow-y:auto;background:var(--bg3);border-radius:8px;padding:8px 10px;margin-bottom:12px;font-size:11px;color:var(--text2)">'+
      invalid.map(function(p){ return '<div style="padding:3px 0;border-bottom:1px solid var(--border)">Baris '+p.row+': '+p.errs.join('; ')+'</div>'; }).join('')+
    '</div>' : '')+
    (dupes.length ? '<div style="background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.25);border-radius:8px;padding:8px 10px;margin-bottom:12px;font-size:11px;color:var(--text2)">'+
      '<div style="margin-bottom:5px"><b class="amb">⚠ Baris berikut identik dengan transaksi yang sudah ada</b> (tanggal, aksi, kode, lot, harga, sekuritas sama persis) — kemungkinan file diupload dua kali:</div>'+
      dupes.map(function(p){ return '<div style="padding:2px 0">Baris '+p.row+': '+p.date+' '+p.type+' '+p.ticker+' '+p.lot+' lot @ Rp '+fmt(p.price)+'</div>'; }).join('')+
      '<label style="display:flex;align-items:center;gap:6px;margin-top:8px;cursor:pointer"><input type="checkbox" id="tx-import-dupes-chk"> <span>Impor juga baris duplikat ini (saya yakin ini transaksi baru, bukan duplikat)</span></label>'+
    '</div>' : '')+
    (valid.length ? '<div style="overflow-x:auto;max-height:240px;overflow-y:auto;border:1px solid var(--border);border-radius:8px">'+
      '<table class="tbl"><thead><tr><th>Tanggal</th><th>Aksi</th><th>Kode</th><th>Sekuritas</th><th>Lot</th><th>Harga</th></tr></thead><tbody>'+
      valid.map(function(p){
        return '<tr><td class="mono">'+p.date+'</td><td><span class="badge '+(p.type==='BUY'?'b-up':'b-dn')+'">'+p.type+'</span></td>'+
          '<td class="tp">'+p.ticker+'</td><td style="font-size:11px">'+p.sekuritas+'</td>'+
          '<td class="mono">'+p.lot+'</td><td class="mono">Rp '+fmt(p.price)+'</td></tr>';
      }).join('')+
      '</tbody></table></div>' : (dupes.length ? '' : '<div style="font-size:12px;color:var(--red)">Tidak ada baris valid untuk diimpor — perbaiki file lalu upload ulang.</div>'));

  el('m-title').textContent = '📤 Konfirmasi Impor Transaksi';
  el('m-title').style.color = 'var(--accent)';
  el('m-body').innerHTML = body +
    '<div style="margin-top:14px;display:flex;gap:8px;justify-content:flex-end">'+
      '<button class="btn btn-ghost" onclick="closeModal()">Batal</button>'+
      (valid.length||dupes.length ? '<button class="btn btn-green" onclick="txConfirmImport()">✓ Impor Transaksi</button>' : '')+
    '</div>';
  el('modal').classList.add('on');
}

function txConfirmImport(){
  var includeDupes = !!(el('tx-import-dupes-chk') && el('tx-import-dupes-chk').checked);
  var rows = TX_IMPORT_ROWS.concat(includeDupes ? TX_IMPORT_DUPES : []);
  TX_IMPORT_ROWS = []; TX_IMPORT_DUPES = [];
  closeModal();
  if(!rows.length) return;

  // addTx() memanggil saveData() (upload penuh) di tiap baris — untuk impor
  // massal itu O(n^2) di jaringan. Nonaktifkan sementara, simpan sekali di akhir.
  var realSaveData = saveData;
  saveData = function(){};
  try{
    rows.forEach(function(r){ addTx(r.date, r.type, r.ticker, r.lot, r.price, r.sekuritas); });
  } finally {
    saveData = realSaveData;
  }
  if(typeof rebuildRdnBalance==='function') rebuildRdnBalance();
  saveData();

  if(typeof updatePrices==='function') updatePrices();
  renderTransaksi();
  if(typeof renderDashboard==='function') renderDashboard();
  if(typeof showSaveStatus==='function') showSaveStatus('✓ '+rows.length+' transaksi berhasil diimpor');

  // FIX: ticker BARU (belum ada di `prices[]`) sebelumnya menampilkan Nilai
  // Pasar 0 sampai rotasi fetch berkala menjangkaunya (bisa beberapa menit).
  // Ambil harga riil sekarang juga untuk semua ticker yang baru diimpor.
  if(typeof rdFetchLivePrices==='function'){
    var tickersNeedingPrice = rows.filter(function(r){ return !prices[r.ticker]; }).map(function(r){ return r.ticker; });
    if(tickersNeedingPrice.length){
      rdFetchLivePrices(tickersNeedingPrice, function(){
        renderTransaksi();
        if(typeof renderDashboard==='function') renderDashboard();
        if(typeof showSaveStatus==='function') showSaveStatus('✓ Harga live '+tickersNeedingPrice.length+' saham baru dimuat');
      });
    }
  }
}

// ╔══════════════════════════════════════════════════════════╗
// ║  BULK IMPORT DIVIDEN — download template & upload Excel   ║
// ╚══════════════════════════════════════════════════════════╝

function divDownloadTemplate(){
  if(typeof XLSX==='undefined'){ if(typeof showSaveStatus==='function') showSaveStatus('⚠ Pustaka Excel belum termuat, coba lagi sebentar','var(--red)'); return; }

  // Default tarif PPh diisi dari pengaturan pajak yang SEDANG aktif — cuma
  // sebagai contoh awal, kolom ini boleh diubah per baris supaya dividen
  // lama yang dikenai tarif regulasi BERBEDA (PPh dividen sempat berubah
  // dari waktu ke waktu) tetap tercatat dengan tarif historisnya, bukan
  // dipaksa memakai tarif yang berlaku sekarang untuk semua baris.
  var defPct = (TAX_SETTINGS.pphDividen*100).toFixed(0);
  var sample = [
    {Tanggal:'2026-03-15', 'Kode Saham':'BBCA', 'Jumlah Lembar':5900, 'Dividen per Lembar':250, 'PPh Dividen (%)':defPct},
    {Tanggal:'2026-06-20', 'Kode Saham':'TLKM', 'Jumlah Lembar':10000, 'Dividen per Lembar':85, 'PPh Dividen (%)':defPct}
  ];
  var wsDiv = XLSX.utils.json_to_sheet(sample);
  wsDiv['!cols'] = [{wch:12},{wch:12},{wch:14},{wch:18},{wch:16}];

  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsDiv, 'Dividen');

  var petunjuk = [
    ['PETUNJUK PENGISIAN — Template Dividen Money Watch Pro'],
    [''],
    ['Kolom', 'Keterangan'],
    ['Tanggal', 'Tanggal pembayaran dividen, format YYYY-MM-DD'],
    ['Kode Saham', 'Kode ticker IDX, contoh: BBCA, TLKM (tanpa akhiran .JK)'],
    ['Jumlah Lembar', 'Jumlah lembar saham yang Anda miliki saat cum date'],
    ['Dividen per Lembar', 'Dividen per lembar dalam Rupiah, SEBELUM dipotong pajak'],
    ['PPh Dividen (%)', 'Tarif PPh final dividen SAAT dividen itu dibayarkan (bukan tarif hari ini) — isi angka, mis. 10 untuk 10%. Kosongkan untuk pakai tarif yang sedang aktif di Pengaturan Pajak ('+defPct+'%).'],
    [''],
    ['PENTING: tarif PPh dividen bisa berubah mengikuti regulasi pemerintah dari waktu ke waktu. Isi kolom PPh Dividen (%) sesuai tarif yang BERLAKU SAAT dividen itu dibayarkan, jangan disamakan semua ke tarif sekarang kalau riwayat Anda mencakup beberapa tahun dengan tarif berbeda.'],
    ['Dividen yang diimpor akan menambah saldo RDN, sama seperti input manual "+ Catat Dividen".'],
    ['Hapus 2 baris contoh sebelum mengisi data Anda, atau timpa langsung baris tersebut.'],
    ['Setelah selesai, unggah file ini lewat tombol "📤 Upload Excel" di tab Dividen.']
  ];
  var wsInfo = XLSX.utils.aoa_to_sheet(petunjuk);
  wsInfo['!cols'] = [{wch:18},{wch:78}];
  XLSX.utils.book_append_sheet(wb, wsInfo, 'Petunjuk');

  XLSX.writeFile(wb, 'Template_Dividen_MoneyWatchPro.xlsx');
  if(typeof showSaveStatus==='function') showSaveStatus('✓ Template dividen diunduh — isi lalu upload kembali');
}

function divImportExcel(){
  if(typeof XLSX==='undefined'){ if(typeof showSaveStatus==='function') showSaveStatus('⚠ Pustaka Excel belum termuat, coba lagi sebentar','var(--red)'); return; }
  var inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = '.xlsx,.xls';
  inp.onchange = function(){
    var f = inp.files && inp.files[0];
    if(!f) return;
    var reader = new FileReader();
    reader.onload = function(e){
      try{
        var wb = XLSX.read(new Uint8Array(e.target.result), {type:'array', cellDates:true});
        var sheetName = wb.SheetNames.indexOf('Dividen') > -1 ? 'Dividen' : wb.SheetNames[0];
        var rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {defval:''});
        divProcessImportRows(rows, f.name);
      }catch(err){
        if(typeof showSaveStatus==='function') showSaveStatus('⚠ Gagal membaca file: '+err.message,'var(--red)');
      }
    };
    reader.readAsArrayBuffer(f);
  };
  inp.click();
}

function divValidateRow(r, idx){
  var date = txParseDate(r['Tanggal']);
  var ticker = String(r['Kode Saham']||'').trim().toUpperCase().replace(/\.JK$/,'');
  var shares = parsePrice(r['Jumlah Lembar']);
  var dps = parsePrice(r['Dividen per Lembar']);
  // Kolom PPh Dividen (%) opsional — kosong = pakai tarif TAX_SETTINGS yang
  // sedang aktif (backward-compatible dengan template lama yang belum
  // punya kolom ini). Diisi = tarif HISTORIS baris itu, bisa beda-beda per
  // baris kalau riwayat dividen mencakup periode dengan regulasi berbeda.
  var pphRaw = r['PPh Dividen (%)'];
  var pphPct = (pphRaw===''||pphRaw==null) ? (TAX_SETTINGS.pphDividen*100) : parsePrice(pphRaw);

  var errs = [];
  if(!date) errs.push('Tanggal tidak valid (pakai format YYYY-MM-DD)');
  if(!ticker) errs.push('Kode Saham kosong');
  // FIX AUDIT F7: tolak juga Infinity, bukan cuma NaN/negatif/nol
  if(!(shares>0) || !isFinite(shares)) errs.push('Jumlah Lembar harus angka > 0');
  if(!(dps>0) || !isFinite(dps)) errs.push('Dividen per Lembar harus angka > 0');
  if(!isFinite(pphPct) || pphPct<0 || pphPct>100) errs.push('PPh Dividen (%) harus angka 0-100');

  return {row:idx+2, date:date, ticker:ticker, shares:shares, dps:dps, pphPct:pphPct, ok:errs.length===0, errs:errs};
}

// FIX AUDIT F6: kunci pencocokan duplikat untuk dividen
function divDupKey(r){ return [r.date,r.ticker,r.shares,r.dps].join('|'); }

var DIV_IMPORT_ROWS = [];
var DIV_IMPORT_DUPES = [];

function divProcessImportRows(rows, fileName){
  if(!rows.length){ if(typeof showSaveStatus==='function') showSaveStatus('⚠ File kosong atau tidak ada baris data','var(--red)'); return; }
  var parsed = rows.map(function(r,i){ return divValidateRow(r,i); });
  var okRows = parsed.filter(function(p){ return p.ok; });
  var invalid = parsed.filter(function(p){ return !p.ok; });

  var existingKeys = {};
  dividends.forEach(function(d){ existingKeys[divDupKey({date:d.date,ticker:d.ticker,shares:d.shares,dps:d.dps})] = true; });
  var seenInBatch = {};
  var valid = [], dupes = [];
  okRows.forEach(function(p){
    var key = divDupKey(p);
    if(existingKeys[key] || seenInBatch[key]) dupes.push(p);
    else { valid.push(p); seenInBatch[key] = true; }
  });
  DIV_IMPORT_ROWS = valid;
  DIV_IMPORT_DUPES = dupes;

  var body =
    '<div style="font-size:12px;color:var(--text2);margin-bottom:12px">File <b>'+fileName+'</b>: '+
      '<b class="up">'+valid.length+' baris valid</b>'+
      (dupes.length ? ' &nbsp;·&nbsp; <b class="amb">'+dupes.length+' kemungkinan duplikat (dilewati kecuali dicentang)</b>' : '')+
      (invalid.length ? ' &nbsp;·&nbsp; <b class="dn">'+invalid.length+' baris bermasalah (akan dilewati)</b>' : '')+'.</div>'+
    (invalid.length ? '<div style="max-height:150px;overflow-y:auto;background:var(--bg3);border-radius:8px;padding:8px 10px;margin-bottom:12px;font-size:11px;color:var(--text2)">'+
      invalid.map(function(p){ return '<div style="padding:3px 0;border-bottom:1px solid var(--border)">Baris '+p.row+': '+p.errs.join('; ')+'</div>'; }).join('')+
    '</div>' : '')+
    (dupes.length ? '<div style="background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.25);border-radius:8px;padding:8px 10px;margin-bottom:12px;font-size:11px;color:var(--text2)">'+
      '<div style="margin-bottom:5px"><b class="amb">⚠ Baris berikut identik dengan dividen yang sudah tercatat</b> (tanggal, kode, lembar, dividen/lembar sama persis) — kemungkinan file diupload dua kali:</div>'+
      dupes.map(function(p){ return '<div style="padding:2px 0">Baris '+p.row+': '+p.date+' '+p.ticker+' '+fmt(p.shares)+' lbr @ Rp '+fmt(p.dps)+'</div>'; }).join('')+
      '<label style="display:flex;align-items:center;gap:6px;margin-top:8px;cursor:pointer"><input type="checkbox" id="div-import-dupes-chk"> <span>Impor juga baris duplikat ini (saya yakin ini dividen baru, bukan duplikat)</span></label>'+
    '</div>' : '')+
    (valid.length ? '<div style="overflow-x:auto;max-height:240px;overflow-y:auto;border:1px solid var(--border);border-radius:8px">'+
      '<table class="tbl"><thead><tr><th>Tanggal</th><th>Kode</th><th>Lembar</th><th>Div/Lembar</th><th>Dividen Kotor</th><th>PPh %</th><th>Net</th></tr></thead><tbody>'+
      valid.map(function(p){
        var gross=p.shares*p.dps, net=gross*(1-p.pphPct/100);
        return '<tr><td class="mono">'+p.date+'</td><td class="tp">'+p.ticker+'</td>'+
          '<td class="mono">'+fmt(p.shares)+'</td><td class="mono">Rp '+fmt(p.dps)+'</td>'+
          '<td class="mono">Rp '+fmt(gross)+'</td><td class="mono">'+p.pphPct+'%</td>'+
          '<td class="mono">Rp '+fmt(net)+'</td></tr>';
      }).join('')+
      '</tbody></table></div>' : (dupes.length ? '' : '<div style="font-size:12px;color:var(--red)">Tidak ada baris valid untuk diimpor — perbaiki file lalu upload ulang.</div>'));

  el('m-title').textContent = '📤 Konfirmasi Impor Dividen';
  el('m-title').style.color = 'var(--purple)';
  el('m-body').innerHTML = body +
    '<div style="margin-top:14px;display:flex;gap:8px;justify-content:flex-end">'+
      '<button class="btn btn-ghost" onclick="closeModal()">Batal</button>'+
      (valid.length||dupes.length ? '<button class="btn btn-green" onclick="divConfirmImport()">✓ Impor Dividen</button>' : '')+
    '</div>';
  el('modal').classList.add('on');
}

function divConfirmImport(){
  var includeDupes = !!(el('div-import-dupes-chk') && el('div-import-dupes-chk').checked);
  var rows = DIV_IMPORT_ROWS.concat(includeDupes ? DIV_IMPORT_DUPES : []);
  DIV_IMPORT_ROWS = []; DIV_IMPORT_DUPES = [];
  closeModal();
  if(!rows.length) return;

  var realSaveData = saveData;
  saveData = function(){};
  try{
    rows.forEach(function(r){ addDiv(r.date, r.ticker, r.shares, r.dps, r.pphPct/100); });
  } finally {
    saveData = realSaveData;
  }
  if(typeof rebuildRdnBalance==='function') rebuildRdnBalance();
  saveData();

  if(typeof renderDividen==='function') renderDividen();
  if(typeof renderDashboard==='function') renderDashboard();
  if(typeof showSaveStatus==='function') showSaveStatus('✓ '+rows.length+' dividen berhasil diimpor');
}
