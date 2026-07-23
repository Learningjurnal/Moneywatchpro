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
  if(!(lot>0)) errs.push('Lot harus angka > 0');
  if(!(price>0)) errs.push('Harga harus angka > 0');

  return {row:idx+2, date:date, type:type, ticker:ticker, sekuritas:sekuritas, lot:lot, price:price, ok:errs.length===0, errs:errs};
}

var TX_IMPORT_ROWS = [];

function txProcessImportRows(rows, fileName){
  if(!rows.length){ if(typeof showSaveStatus==='function') showSaveStatus('⚠ File kosong atau tidak ada baris data','var(--red)'); return; }
  var parsed = rows.map(function(r,i){ return txValidateRow(r,i); });
  var valid = parsed.filter(function(p){ return p.ok; });
  var invalid = parsed.filter(function(p){ return !p.ok; });
  TX_IMPORT_ROWS = valid;

  var body =
    '<div style="font-size:12px;color:var(--text2);margin-bottom:12px">File <b>'+fileName+'</b>: '+
      '<b class="up">'+valid.length+' baris valid</b>'+(invalid.length ? ' &nbsp;·&nbsp; <b class="dn">'+invalid.length+' baris bermasalah (akan dilewati)</b>' : '')+'.</div>'+
    (invalid.length ? '<div style="max-height:150px;overflow-y:auto;background:var(--bg3);border-radius:8px;padding:8px 10px;margin-bottom:12px;font-size:11px;color:var(--text2)">'+
      invalid.map(function(p){ return '<div style="padding:3px 0;border-bottom:1px solid var(--border)">Baris '+p.row+': '+p.errs.join('; ')+'</div>'; }).join('')+
    '</div>' : '')+
    (valid.length ? '<div style="overflow-x:auto;max-height:240px;overflow-y:auto;border:1px solid var(--border);border-radius:8px">'+
      '<table class="tbl"><thead><tr><th>Tanggal</th><th>Aksi</th><th>Kode</th><th>Sekuritas</th><th>Lot</th><th>Harga</th></tr></thead><tbody>'+
      valid.map(function(p){
        return '<tr><td class="mono">'+p.date+'</td><td><span class="badge '+(p.type==='BUY'?'b-up':'b-dn')+'">'+p.type+'</span></td>'+
          '<td class="tp">'+p.ticker+'</td><td style="font-size:11px">'+p.sekuritas+'</td>'+
          '<td class="mono">'+p.lot+'</td><td class="mono">Rp '+fmt(p.price)+'</td></tr>';
      }).join('')+
      '</tbody></table></div>' : '<div style="font-size:12px;color:var(--red)">Tidak ada baris valid untuk diimpor — perbaiki file lalu upload ulang.</div>');

  el('m-title').textContent = '📤 Konfirmasi Impor Transaksi';
  el('m-title').style.color = 'var(--accent)';
  el('m-body').innerHTML = body +
    '<div style="margin-top:14px;display:flex;gap:8px;justify-content:flex-end">'+
      '<button class="btn btn-ghost" onclick="closeModal()">Batal</button>'+
      (valid.length ? '<button class="btn btn-green" onclick="txConfirmImport()">✓ Impor '+valid.length+' Transaksi</button>' : '')+
    '</div>';
  el('modal').classList.add('on');
}

function txConfirmImport(){
  var rows = TX_IMPORT_ROWS.slice();
  TX_IMPORT_ROWS = [];
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
}
