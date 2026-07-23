// ============================================================
// SUPABASE DATA SYNC
// ============================================================
async function _supaReplaceTable(table, uid, rows){
  // Atomically replace: only delete after we know rows are ready to insert.
  // If insert fails, we throw so caller knows data may be inconsistent.
  var delRes = await _supabase.from(table).delete().eq('user_id', uid);
  if(delRes.error) throw new Error('Delete '+table+' failed: '+delRes.error.message);
  if(rows && rows.length > 0){
    var insRes = await _supabase.from(table).insert(rows);
    if(insRes.error) throw new Error('Insert '+table+' failed: '+insRes.error.message);
  }
}

async function supaSaveAllData(){
  if(!_currentUser) return;
  var uid = _currentUser.id;
  try {
    var basePayload = {user_id:uid,active_sekuritas:activeSekuritas,rdn_balance:rdnBalance,cash_accounts:CASH_ACCOUNTS,tax_cfg:TAX_SETTINGS,sek_tax_override:sekTaxOverride||{},trade_strategy:tradeStrategy||{},next_tx_id:nextTxId,next_div_id:nextDivId,next_rdn_id:nextRdnId,next_crypto_id:nextCryptoId||1,next_etf_id:nextEtfId||1,next_rd_id:nextRdId||1,updated_at:new Date().toISOString()};
    // Sinkronisasi Daftar Saham (hasil import Excel IDX + override Admin Panel)
    // lintas perangkat — lihat sql/idx_universe_migration.sql.
    var idxPayload = {
      idx_universe: (typeof IDX_UNIVERSE!=='undefined') ? IDX_UNIVERSE : null,
      idx_universe_info: (typeof IDX_UNIVERSE_INFO!=='undefined') ? IDX_UNIVERSE_INFO : null,
      admin_meta: (typeof ADMIN_META!=='undefined') ? ADMIN_META : {},
      admin_extra: (typeof ADMIN_EXTRA!=='undefined') ? ADMIN_EXTRA : []
    };
    var settingsRes = await _supabase.from('user_settings').upsert(Object.assign({}, basePayload, idxPayload), {onConflict:'user_id'});
    if(settingsRes.error && /column .* does not exist/i.test(settingsRes.error.message||'')){
      // Migrasi kolom Daftar Saham belum dijalankan di Supabase — simpan tanpa
      // field baru dulu, supaya sinkronisasi data lain (transaksi, dividen, dst)
      // tidak ikut gagal hanya karena fitur ini belum di-setup.
      console.warn('Kolom sinkronisasi Daftar Saham belum ada di Supabase. Jalankan sql/idx_universe_migration.sql sekali di SQL Editor Supabase agar daftar saham ikut tersinkron.');
      settingsRes = await _supabase.from('user_settings').upsert(basePayload, {onConflict:'user_id'});
    }
    if(settingsRes.error && /column .* does not exist/i.test(settingsRes.error.message||'')){
      // Kolom trade_strategy/sek_tax_override juga belum ada — strip keduanya
      // supaya sisa data (transaksi, dividen, RDN, dst) tetap tersinkron.
      // Strategi per-emiten & override komisi TIDAK akan ikut tersimpan ke
      // cloud sampai sql/trade_strategy_migration.sql dijalankan.
      console.warn('Kolom trade_strategy/sek_tax_override belum ada di Supabase. Jalankan sql/trade_strategy_migration.sql sekali di SQL Editor Supabase agar Strategi per Emiten ikut tersinkron & tidak hilang saat reload.');
      var strippedPayload = Object.assign({}, basePayload);
      delete strippedPayload.trade_strategy;
      delete strippedPayload.sek_tax_override;
      settingsRes = await _supabase.from('user_settings').upsert(strippedPayload, {onConflict:'user_id'});
    }
    if(settingsRes.error) throw new Error('Upsert user_settings failed: '+settingsRes.error.message);

    await _supaReplaceTable('transactions', uid,
      (transactions&&transactions.length>0) ? transactions.map(function(t){return {user_id:uid,tx_id:t.id,date:t.date,action:t.action,ticker:t.ticker,sekuritas:t.sekuritas,lot:t.lot,shares:t.shares,price:t.price,gross:t.gross,commission:t.commission,tax:t.tax,net:t.net,pl:t.pl||0};}) : null);

    await _supaReplaceTable('dividends', uid,
      (dividends&&dividends.length>0) ? dividends.map(function(d){return {user_id:uid,div_id:d.id,date:d.date,ticker:d.ticker,shares:d.shares,dps:d.dps,gross:d.gross,pph:d.pph,net:d.net,yield:d.yield||0};}) : null);

    await _supaReplaceTable('rdn_mutations', uid,
      (rdnMutations&&rdnMutations.length>0) ? rdnMutations.map(function(r){return {user_id:uid,rdn_id:r.id,date:r.date,type:r.type,description:r.description||'',amount_in:r.amountIn||0,amount_out:r.amountOut||0,balance:r.balance||0};}) : null);

    await _supaReplaceTable('crypto_tx', uid,
      (cryptoTx&&cryptoTx.length>0) ? cryptoTx.map(function(c){return {user_id:uid,tx_id:c.id,date:c.date,action:c.action,coin:c.coin,amount:c.amount,price_idr:c.priceIdr||0,total_idr:c.totalIdr||0,pl:c.pl||0};}) : null);

    await _supaReplaceTable('etf_tx', uid,
      (etfTx&&etfTx.length>0) ? etfTx.map(function(e){return {user_id:uid,tx_id:e.id,date:e.date,action:e.action,ticker:e.ticker,shares:e.shares,price_usd:e.priceUsd||0,total_usd:e.totalUsd||0,total_idr:e.totalIdr||0,kurs:e.kurs||0,pl_idr:e.pl||0};}) : null);

    var rdU=(rdTx||[]).filter(function(r){return r._userInput===true;});
    await _supaReplaceTable('rd_tx', uid,
      rdU.length>0 ? rdU.map(function(r){return {user_id:uid,tx_id:r.id,date:r.date,action:r.action,name:r.name||'',platform:r.platform||'',units:r.units||0,nav:r.nav||0,total_idr:r.total||0,pl:r.pl||0};}) : null);

    var diRes = await _supabase.from('div_invest').upsert({user_id:uid,data:divInvestData||[],next_id:_divInvestId||1,updated_at:new Date().toISOString()},{onConflict:'user_id'});
    if(diRes.error) throw new Error('Upsert div_invest failed: '+diRes.error.message);
  } catch(err){ console.warn('Supabase save error:',err); throw err; }
}

async function supaLoadAllData(){
  if(!_currentUser) return false;
  var uid=_currentUser.id;
  try {
    var sRes=await _supabase.from('user_settings').select('*').eq('user_id',uid).maybeSingle();
    if(sRes.data){
      var s=sRes.data;activeSekuritas=s.active_sekuritas||'Mirae Asset';rdnBalance=s.rdn_balance||0;if(s.cash_accounts)Object.assign(CASH_ACCOUNTS,s.cash_accounts);if(s.tax_cfg){Object.assign(TAX_SETTINGS,s.tax_cfg);if(typeof saveTaxSettings==='function')saveTaxSettings();}if(s.sek_tax_override)sekTaxOverride=s.sek_tax_override;if(s.trade_strategy)tradeStrategy=s.trade_strategy;nextTxId=s.next_tx_id||1;nextDivId=s.next_div_id||1;nextRdnId=s.next_rdn_id||1;nextCryptoId=s.next_crypto_id||1;nextEtfId=s.next_etf_id||1;nextRdId=s.next_rd_id||1;
      // Daftar Saham (import Excel IDX + override Admin Panel) — samakan dengan perangkat lain
      try{
        var univChanged = (s.idx_universe && typeof idxApplyFromCloud==='function') ? idxApplyFromCloud(s.idx_universe, s.idx_universe_info) : false;
        var adminChanged = (typeof adminApplyFromCloud==='function') ? adminApplyFromCloud(s.admin_meta, s.admin_extra) : false;
        if((univChanged || adminChanged) && typeof rdRebuildFromReal==='function'){
          if(typeof _scBaseCache!=='undefined') _scBaseCache=null;
          if(typeof QT!=='undefined') QT.scData=[];
          if(typeof RD_META!=='undefined') RD_META.universeLoaded=false;
          rdRebuildFromReal();
          if(typeof rdLoadUniverse==='function') rdLoadUniverse(true);
        }
      }catch(e){ console.warn('Sinkronisasi Daftar Saham dari cloud gagal:', e); }
    }
    var txRes=await _supabase.from('transactions').select('*').eq('user_id',uid).order('date',{ascending:true});
    if(txRes.data&&txRes.data.length>0) transactions=txRes.data.map(function(t){return {id:t.tx_id,date:t.date,action:t.action,ticker:t.ticker,sekuritas:t.sekuritas,lot:t.lot,shares:t.shares,price:t.price,gross:t.gross,commission:t.commission,tax:t.tax,net:t.net,pl:t.pl};});
    var divRes=await _supabase.from('dividends').select('*').eq('user_id',uid).order('date',{ascending:true});
    if(divRes.data&&divRes.data.length>0) dividends=divRes.data.map(function(d){return {id:d.div_id,date:d.date,ticker:d.ticker,shares:d.shares,dps:d.dps,gross:d.gross,pph:d.pph,net:d.net,yield:d.yield};});
    var rdnRes=await _supabase.from('rdn_mutations').select('*').eq('user_id',uid).order('date',{ascending:true});
    if(rdnRes.data&&rdnRes.data.length>0) rdnMutations=rdnRes.data.map(function(r){return {id:r.rdn_id,date:r.date,type:r.type,description:r.description,amountIn:r.amount_in,amountOut:r.amount_out,balance:r.balance};});
    var cRes=await _supabase.from('crypto_tx').select('*').eq('user_id',uid).order('date',{ascending:true});
    if(cRes.data&&cRes.data.length>0) cryptoTx=cRes.data.map(function(c){return {id:c.tx_id,date:c.date,action:c.action,coin:c.coin,amount:c.amount,priceIdr:c.price_idr,totalIdr:c.total_idr,pl:c.pl};});
    var eRes=await _supabase.from('etf_tx').select('*').eq('user_id',uid).order('date',{ascending:true});
    if(eRes.data&&eRes.data.length>0) etfTx=eRes.data.map(function(e){return {id:e.tx_id,date:e.date,action:e.action,ticker:e.ticker,shares:e.shares,priceUsd:e.price_usd,totalUsd:e.total_usd,totalIdr:e.total_idr,kurs:e.kurs,pl:e.pl_idr,_userInput:true};});
    var rRes=await _supabase.from('rd_tx').select('*').eq('user_id',uid).order('date',{ascending:true});
    if(rRes.data&&rRes.data.length>0) rdTx=rRes.data.map(function(r){return {id:r.tx_id,date:r.date,action:r.action,name:r.name,platform:r.platform,units:r.units,nav:r.nav,total:r.total_idr,pl:r.pl,_userInput:true};});
    var diRes=await _supabase.from('div_invest').select('*').eq('user_id',uid).maybeSingle();
    if(diRes.data){divInvestData=diRes.data.data||[];_divInvestId=diRes.data.next_id||1;}
    return true;
  } catch(err){ console.warn('Supabase load error:',err); return false; }
}

function loadDataFromLocalStorage(){
  try{var raw=localStorage.getItem('ihsg_pro_master_v5');if(!raw)return false;var d=JSON.parse(raw);if(!d||!d.transactions)return false;transactions=d.transactions||[];dividends=d.dividends||[];rdnMutations=d.rdnMutations||[];activeSekuritas=d.activeSekuritas||'Mirae Asset';rdnBalance=d.rdnBalance||0;nextTxId=d.nextTxId||(transactions.length+1);nextDivId=d.nextDivId||(dividends.length+1);nextRdnId=d.nextRdnId||(rdnMutations.length+1);cryptoTx=d.cryptoTx||[];etfTx=d.etfTx||[];rdTx=(d.rdTx||[]).filter(function(tx){return tx._userInput===true;});nextCryptoId=d.nextCryptoId||(cryptoTx.length+1);nextEtfId=d.nextEtfId||(etfTx.length+1);nextRdId=d.nextRdId||(rdTx.length+1);tradeStrategy=d.tradeStrategy||{};sekTaxOverride=d.sekTaxOverride||{};return true;}catch(e){return false;}
}

// ============================================================
// LOCALSTORAGE — PERSISTENSI DATA
// ============================================================
var LS_KEY = 'ihsg_pro_master_v5'; // bump: start fresh, manual entry only

var tradeStrategy = {};
function saveData(){
  if(typeof _invalidatePortoCache==='function') _invalidatePortoCache();
  try {
    var payload={transactions:transactions,dividends:dividends,rdnMutations:rdnMutations,activeSekuritas:activeSekuritas,rdnBalance:rdnBalance,nextTxId:nextTxId,nextDivId:nextDivId,nextRdnId:nextRdnId,cryptoTx:cryptoTx,etfTx:etfTx,rdTx:rdTx,nextCryptoId:nextCryptoId,nextEtfId:nextEtfId,nextRdId:nextRdId,tradeStrategy:tradeStrategy,sekTaxOverride:sekTaxOverride,savedAt:new Date().toISOString()};
    localStorage.setItem(LS_KEY, JSON.stringify(payload));
  } catch(e){}
  if(_currentUser){ supaSaveAllData().catch(function(e){console.warn('Supabase sync:',e);}); }
}

function loadData(){ return loadDataFromLocalStorage(); }

function clearData(){
  if(!confirm('\u26a0\ufe0f Hapus SEMUA data transaksi tersimpan dan mulai dari awal?\n\nTindakan ini tidak bisa dibatalkan!')) return;
  if(_currentUser){var uid=_currentUser.id;Promise.all([_supabase.from('transactions').delete().eq('user_id',uid),_supabase.from('dividends').delete().eq('user_id',uid),_supabase.from('rdn_mutations').delete().eq('user_id',uid),_supabase.from('crypto_tx').delete().eq('user_id',uid),_supabase.from('etf_tx').delete().eq('user_id',uid),_supabase.from('rd_tx').delete().eq('user_id',uid),_supabase.from('user_settings').delete().eq('user_id',uid),_supabase.from('div_invest').delete().eq('user_id',uid)]).then(function(){localStorage.removeItem('ihsg_pro_master_v5');location.reload();});}
  else{localStorage.removeItem('ihsg_pro_master_v5');location.reload();}
}


// ── EXPORT: download file JSON berisi semua data ──
function exportData(){
  try {
    var payload = {
      _version: '1.0',
      _app: 'IHSG Pro Master',
      _exportedAt: new Date().toISOString(),
      transactions: transactions,
      dividends: dividends,
      rdnMutations: rdnMutations,
      activeSekuritas: activeSekuritas,
      rdnBalance: rdnBalance,
      nextTxId: nextTxId, nextDivId: nextDivId, nextRdnId: nextRdnId,
      cryptoTx: cryptoTx, etfTx: etfTx, rdTx: rdTx,
      nextCryptoId: nextCryptoId, nextEtfId: nextEtfId, nextRdId: nextRdId,
    };
    var json = JSON.stringify(payload, null, 2);
    var blob = new Blob([json], {type:'application/json'});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    var d = new Date().toISOString().split('T')[0];
    a.href = url; a.download = 'ihsg_backup_'+d+'.json';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    showSaveStatus('✓ Backup berhasil didownload');
  } catch(e){ alert('Gagal export: '+e.message); }
}

// ── EXPORT: download CSV khusus transaksi saham ──
function exportCSV(){
  try {
    var rows = [['Tanggal','Tipe','Kode','Lot','Saham','Harga','Kotor','Komisi','PPh','Nett','Sekuritas']];
    transactions.slice().sort(function(a,b){return a.date.localeCompare(b.date)}).forEach(function(tx){
      rows.push([tx.date,tx.type,tx.ticker,tx.lot,tx.lot*100,tx.price,tx.gross,tx.komisi,tx.tax,tx.net,tx.sekuritas]);
    });
    var csv = rows.map(function(r){ return r.join(','); }).join('\n');
    var blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8'});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    var d = new Date().toISOString().split('T')[0];
    a.href = url; a.download = 'transaksi_saham_'+d+'.csv';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    showSaveStatus('✓ CSV transaksi didownload');
  } catch(e){ alert('Gagal export CSV: '+e.message); }
}

// ── IMPORT: restore dari file JSON backup ──
function importData(){
  var input = document.createElement('input');
  input.type = 'file'; input.accept = '.json,application/json';
  input.onchange = function(e){
    var file = e.target.files[0]; if(!file) return;
    var reader = new FileReader();
    reader.onload = function(ev){
      try {
        var d = JSON.parse(ev.target.result);
        if(!d.transactions) throw new Error('Format file tidak valid. Pastikan ini file backup dari IHSG Pro.');
        var txCount = (d.transactions||[]).length + (d.cryptoTx||[]).length + (d.etfTx||[]).length + (d.rdTx||[]).length;
        var exportDate = d._exportedAt ? new Date(d._exportedAt).toLocaleString('id-ID') : 'tidak diketahui';
        if(!confirm('Import data dari backup?\n\nFile: '+file.name+'\nDibuat: '+exportDate+'\nTotal '+txCount+' transaksi\n\n⚠️ Data saat ini akan diganti.')) return;

        transactions    = d.transactions    || [];
        dividends       = d.dividends       || [];
        rdnMutations    = d.rdnMutations    || [];
        activeSekuritas = d.activeSekuritas || 'Mirae Asset';
        rdnBalance      = d.rdnBalance      || 0;
        nextTxId        = d.nextTxId        || transactions.length+1;
        nextDivId       = d.nextDivId       || dividends.length+1;
        nextRdnId       = d.nextRdnId       || rdnMutations.length+1;
        cryptoTx        = d.cryptoTx        || [];
        etfTx           = d.etfTx           || [];
        rdTx            = d.rdTx            || [];
        nextCryptoId    = d.nextCryptoId    || cryptoTx.length+1;
        nextEtfId       = d.nextEtfId       || etfTx.length+1;
        nextRdId        = d.nextRdId        || rdTx.length+1;
        saveData();
        closeBackupModal();
        showSaveStatus('✓ '+txCount+' transaksi berhasil diimport', 'var(--accent)');
        renderDashboard();
      } catch(err){ alert('Gagal import: '+err.message); }
    };
    reader.readAsText(file);
  };
  input.click();
}

// ── BACKUP MODAL ──
function openBackupModal(){
  var lsSize = 0;
  try { lsSize = new Blob([localStorage.getItem(LS_KEY)||'']).size; } catch(e){}
  var kbSize = (lsSize/1024).toFixed(1);
  var txTotal = transactions.length + dividends.length + cryptoTx.length + etfTx.length + rdTx.length;
  var lastSave = '—';
  try { var d=JSON.parse(localStorage.getItem(LS_KEY)||'{}'); if(d.savedAt) lastSave=new Date(d.savedAt).toLocaleString('id-ID'); } catch(e){}

  el('backup-modal').style.display = 'flex';
  el('backup-modal-body').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:16px">
      <div style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:10px;text-align:center">
        <div style="font-size:22px;font-weight:800;font-family:'IBM Plex Mono',monospace;color:var(--accent)">${txTotal}</div>
        <div style="font-size:10px;color:var(--text3);margin-top:2px;letter-spacing:.8px;text-transform:uppercase">Total Transaksi</div>
      </div>
      <div style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:10px;text-align:center">
        <div style="font-size:22px;font-weight:800;font-family:'IBM Plex Mono',monospace;color:var(--green)">${kbSize} KB</div>
        <div style="font-size:10px;color:var(--text3);margin-top:2px;letter-spacing:.8px;text-transform:uppercase">Ukuran Data</div>
      </div>
      <div style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:10px;text-align:center">
        <div style="font-size:11px;font-weight:700;font-family:'IBM Plex Mono',monospace;color:var(--text2);line-height:1.4">${lastSave}</div>
        <div style="font-size:10px;color:var(--text3);margin-top:2px;letter-spacing:.8px;text-transform:uppercase">Terakhir Simpan</div>
      </div>
    </div>

    <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">
      <button class="btn btn-green" onclick="exportData()" style="justify-content:flex-start;gap:10px;padding:12px 14px;font-size:13px">
        <span style="font-size:20px">📥</span>
        <div style="text-align:left"><div style="font-weight:700">Download Backup JSON</div><div style="font-size:11px;opacity:.7;font-weight:400">Semua data: saham, crypto, ETF, reksa dana, RDN</div></div>
      </button>
      <button class="btn btn-blue" onclick="exportCSV()" style="justify-content:flex-start;gap:10px;padding:12px 14px;font-size:13px">
        <span style="font-size:20px">📊</span>
        <div style="text-align:left"><div style="font-weight:700">Download CSV Transaksi Saham</div><div style="font-size:11px;opacity:.7;font-weight:400">Bisa dibuka di Excel/Sheets — ${transactions.length} transaksi</div></div>
      </button>
      <button class="btn btn-ghost" onclick="importData()" style="justify-content:flex-start;gap:10px;padding:12px 14px;font-size:13px;border-color:rgba(0,200,255,.3)">
        <span style="font-size:20px">📤</span>
        <div style="text-align:left"><div style="font-weight:700">Restore dari Backup</div><div style="font-size:11px;opacity:.7;font-weight:400">Upload file JSON backup — data saat ini akan diganti</div></div>
      </button>
    </div>

    <div style="background:rgba(255,193,7,.06);border:1px solid rgba(255,193,7,.2);border-radius:8px;padding:10px 12px;font-size:11px;color:var(--text2);line-height:1.7">
      <div style="font-weight:700;color:var(--amber);margin-bottom:4px">⚠️ Penting — Backup Berkala</div>
      Data tersimpan di browser lokal (localStorage). Jika browser di-clear atau buka di device lain, data hilang.
      <strong style="color:var(--text)">Download backup JSON minimal seminggu sekali</strong> dan simpan di Google Drive atau email ke diri sendiri.
    </div>

    <div style="margin-top:12px;display:flex;justify-content:space-between;align-items:center">
      <button class="btn btn-ghost btn-sm" onclick="clearData()" style="color:var(--red);font-size:11px">🗑 Reset semua data</button>
      <button class="btn btn-ghost btn-sm" onclick="closeBackupModal()">Tutup</button>
    </div>
  `;
}

function closeBackupModal(){
  el('backup-modal').style.display = 'none';
}

function showSaveStatus(msg, color){
  var bar = el('save-status-bar');
  if(!bar) return;
  bar.textContent = msg;
  bar.style.color = color || 'var(--green)';
  bar.style.opacity = '1';
  setTimeout(function(){ bar.style.opacity = '0'; }, 2000);
}

// ============================================================
// HELPERS
// ============================================================
function fmt(n){return Math.round(n).toLocaleString('id-ID')}
function fmtK(n){var a=Math.abs(n);if(a>=1e12)return(n/1e12).toFixed(2)+'T';if(a>=1e9)return(n/1e9).toFixed(2)+'M';if(a>=1e6)return(n/1e6).toFixed(1)+'Jt';return fmt(n)}
function rnd(b,p){p=p||0.025;return b*(1+(Math.random()*p*2-p))}
function today(){return new Date().toISOString().split('T')[0]}
function el(id){return document.getElementById(id)}
function dAgo(n){var d=new Date();d.setDate(d.getDate()-n);return d.toISOString().split('T')[0]}

// ============================================================
// METADATA PASAR — data pribadi DIHAPUS (aman untuk publikasi)
// Hanya kode saham, sektor, dan harga acuan pasar yang disimpan.
// Portofolio Anda berasal dari input manual (localStorage/Supabase).
// ============================================================
var XLSX_DATA = {
  total_equity: 0, nett_value: 0, change_rp: 0, change_pct: 0,
  cash: 0, equity_val: 0, crypto_etf: 0, fund_alloc: 0, p2p: 0,
  cap_gain_2026: 0, dividend_2026: 0,
  kurs_usd: 17823.65,
  core_long: 0, swing_trade: 0, fast_trade: 0,
  sectoral:{},
  stocks:[
    {code:'BBCA',sector:'Financials',price:6500},
    {code:'BBRI',sector:'Financials',price:3020},
    {code:'BMRI',sector:'Financials',price:4420},
    {code:'BBNI',sector:'Financials',price:3700},
    {code:'TLKM',sector:'Infrastructures',price:2700},
    {code:'ASII',sector:'Consumer Cyclicals',price:5150},
    {code:'UNVR',sector:'Consumer Non-Cyclicals',price:1710},
    {code:'ANTM',sector:'Basic Materials',price:3120},
    {code:'ADRO',sector:'Energy',price:2300},
    {code:'PTBA',sector:'Energy',price:3100},
    {code:'INDF',sector:'Consumer Non-Cyclicals',price:6900},
    {code:'ICBP',sector:'Consumer Non-Cyclicals',price:11500},
    {code:'KLBF',sector:'Healthcare',price:1500},
    {code:'SMGR',sector:'Basic Materials',price:3800},
    {code:'PGAS',sector:'Energy',price:1600},
    {code:'JSMR',sector:'Infrastructures',price:4500},
  ],
  crypto:[
    {code:'BTC', name:'Bitcoin',  price_idr:1306967438},
    {code:'ETH', name:'Ethereum', price_idr:60000000},
    {code:'ADA', name:'Cardano',  price_idr:4143},
  ],
  fund_aktif: 0,
  fund_gain_total: 0,
  funds:[],
  fund_margin_by_cat:{},
  dividends:[],
  dividend_total: 0,
};

