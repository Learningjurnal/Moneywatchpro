// ==========================================
// HARGA WAJAR — MoS Valuation Engine
// ==========================================

var hwData = { rows: [], ticker: '', currentPrice: 0, minReturn: 6, projYears: 5 };
var hwHistChart = null;

function hw_defaultRows() {
  var currentYear = new Date().getFullYear();
  var rows = [];
  for (var i = 4; i >= 0; i--) {
    rows.push({ year: currentYear - i, eps: '', equity: '', shares: '', dps: '', per: '', netIncome: '' });
  }
  return rows;
}

function hw_init() {
  try {
    var saved = localStorage.getItem('hw_state');
    if (saved) {
      var s = JSON.parse(saved);
      // Validate: must have rows array
      if (s && Array.isArray(s.rows) && s.rows.length > 0) {
        hwData = s;
      } else {
        hwData.rows = hw_defaultRows();
      }
    } else {
      hwData.rows = hw_defaultRows();
    }
  } catch(e) { hwData.rows = hw_defaultRows(); }
  hw_renderTable();
  hw_renderHistoryList();
}

function hw_renderTable() {
  var tbody = document.getElementById('hw-data-body');
  if (!tbody) return;
  if (!hwData.rows || !hwData.rows.length) hwData.rows = hw_defaultRows();
  // Use DOM API to avoid any attribute escaping issues
  tbody.innerHTML = '';
  var inpStyle = 'background:var(--bg3);border:1px solid var(--border);color:var(--text);font-family:"IBM Plex Mono",monospace;font-size:11px;padding:3px 5px;border-radius:1px;box-sizing:border-box;width:100%';
  var placeholders = {year:'e.g. 2024',eps:'e.g. 350',equity:'e.g. 150537',shares:'e.g. 99062',dps:'e.g. 168',per:'e.g. 16.5',netIncome:'e.g. 33948'};
  var widths = {year:'70px',eps:'100px',equity:'130px',shares:'120px',dps:'100px',per:'80px',netIncome:'130px'};
  // Validation rules: warn if value seems wrong unit
  function hw_cellWarn(field, val) {
    if (!val || val === '') return false;
    var v = parseFloat(val);
    if (isNaN(v)) return true;
    if (field === 'shares' && v < 100) return true;   // shares < 100 juta = sangat kecil, mungkin salah unit
    if (field === 'equity' && v < 1) return true;      // equity < 1 Miliar = mungkin salah unit
    if (field === 'netIncome' && v < 0) return true;
    if (field === 'per' && (v < 1 || v > 150)) return true;
    if (field === 'eps' && v <= 0) return true;
    return false;
  }
  hwData.rows.forEach(function(row, i) {
    var tr = document.createElement('tr');
    var allFields = ['year','eps','equity','shares','dps','per','netIncome'];
    allFields.forEach(function(field) {
      var td = document.createElement('td');
      var inp = document.createElement('input');
      inp.type = 'number';
      var v = (row[field] !== '' && row[field] !== undefined && row[field] !== null) ? row[field] : '';
      inp.value = v;
      inp.placeholder = placeholders[field] || '';
      inp.setAttribute('style', inpStyle);
      inp.style.width = widths[field] || '80px';
      // Highlight cell if value looks wrong
      if (hw_cellWarn(field, v)) {
        inp.style.borderColor = 'var(--amber)';
        inp.style.background = 'rgba(255,187,0,.08)';
        inp.title = 'Periksa unit: ' + ({shares:'Juta lembar (contoh: 99062 = 99 miliar lembar)',equity:'Miliar Rp (contoh: 150537 = Rp 150,5 Triliun)',per:'Antara 1–150x',eps:'Harus positif',netIncome:'Miliar Rp'}[field] || '');
      }
      inp.setAttribute('data-hw-row', String(i));
      inp.setAttribute('data-hw-field', field);
      td.appendChild(inp);
      tr.appendChild(td);
    });
    // Delete button
    var tdDel = document.createElement('td');
    var btnDel = document.createElement('button');
    btnDel.textContent = '×';
    btnDel.setAttribute('style','background:none;border:none;color:var(--red);cursor:pointer;font-size:14px;padding:0 6px');
    btnDel.onclick = (function(idx){ return function(){ hw_removeRow(idx); }; })(i);
    tdDel.appendChild(btnDel);
    tr.appendChild(tdDel);
    tbody.appendChild(tr);
  });
  var cp = document.getElementById('hw-current-price');
  if (cp) cp.value = hwData.currentPrice || '';
  var mr = document.getElementById('hw-min-return');
  if (mr) mr.value = hwData.minReturn || 6;
  var py = document.getElementById('hw-proj-years');
  if (py) py.value = hwData.projYears || 5;
  var ti = document.getElementById('hw-ticker-input');
  if (ti) ti.value = hwData.ticker || '';
}

function hw_addYear() {
  var lastYear = hwData.rows.length ? hwData.rows[hwData.rows.length-1].year : new Date().getFullYear()-1;
  hwData.rows.push({ year: lastYear+1, eps:'', equity:'', shares:'', dps:'', per:'', netIncome:'' });
  hw_renderTable();
}

function hw_removeRow(i) {
  hwData.rows.splice(i, 1);
  hw_renderTable();
  hw_clearResults();
}

function hw_resetAll() {
  if (!confirm('Reset semua data dan hapus data tersimpan?')) return;
  try { localStorage.removeItem('hw_state'); } catch(e) {}
  hwData = { rows: hw_defaultRows(), ticker: '', currentPrice: 0, minReturn: 6, projYears: 5 };
  hw_renderTable();
  hw_clearResults();
}

function hw_syncInputs() {
  hwData.ticker = (document.getElementById('hw-ticker-input')||{}).value || '';
  hwData.currentPrice = parseFloat((document.getElementById('hw-current-price')||{}).value) || 0;
  hwData.minReturn = parseFloat((document.getElementById('hw-min-return')||{}).value) || 6;
  hwData.projYears = parseInt((document.getElementById('hw-proj-years')||{}).value) || 5;
  // Read ALL inputs from tbody rows in order: year, eps, equity, shares, dps, per, netIncome
  var fields = ['year','eps','equity','shares','dps','per','netIncome'];
  var trows = document.querySelectorAll('#hw-data-body tr');
  trows.forEach(function(tr, ri) {
    if (!hwData.rows[ri]) return;
    var inputs = tr.querySelectorAll('input[type="number"]');
    inputs.forEach(function(inp, ci) {
      if (ci < fields.length) {
        var val = parseFloat(inp.value);
        hwData.rows[ri][fields[ci]] = isNaN(val) ? '' : val;
      }
    });
  });
}

function hw_avg(arr) {
  var valid = arr.filter(function(v){ return typeof v === 'number' && !isNaN(v) && v !== 0; });
  if (!valid.length) return 0;
  return valid.reduce(function(s,v){ return s+v; }, 0) / valid.length;
}

function hw_recalc() {
  hw_syncInputs();

  var btn = document.getElementById('hw-hitung-btn');
  if (btn) { btn.textContent = '\u23f3 Menghitung...'; btn.style.opacity = '.7'; btn.disabled = true; }

  function done() { if (btn) { btn.textContent = '\u26a1 HITUNG'; btn.style.opacity = '1'; btn.disabled = false; } }

  // Debug: show what was read from DOM
  console.log('[HW] hwData after sync:', JSON.stringify({
    ticker: hwData.ticker, price: hwData.currentPrice, minRet: hwData.minReturn, N: hwData.projYears,
    rows: hwData.rows.map(function(r){ return {yr:r.year,eps:r.eps,eq:r.equity,sh:r.shares,ni:r.netIncome}; })
  }));
  function fmt(n, dec) { return (n === null || n === undefined || isNaN(n)) ? '\u2014' : Math.round(n).toLocaleString('id-ID'); }
  function fmtD(n, dec) { return (n === null || n === undefined || isNaN(n)) ? '\u2014' : n.toFixed(dec !== undefined ? dec : 1); }
  function fmtPct(n) { if (n === null || n === undefined || isNaN(n)) return '\u2014'; return (n >= 0 ? '+' : '') + n.toFixed(1) + '%'; }
  function fmtRp(n) { return 'Rp ' + fmt(n); }

  // === Validation ===
  var errors = [];
  if (!hwData.ticker) errors.push('Kode saham belum diisi');
  if (!hwData.currentPrice || hwData.currentPrice <= 0) errors.push('Harga saham saat ini belum diisi');
  var rows = hwData.rows.filter(function(r) {
    return parseFloat(r.eps) > 0 && parseFloat(r.equity) > 0 && parseFloat(r.shares) > 0;
  });
  if (rows.length < 2) errors.push('Minimal 2 baris data lengkap (EPS, Total Equity, Shares)');

  if (errors.length) {
    hw_clearResults();
    var badge = document.getElementById('hw-verdict-badge');
    if (badge) { badge.textContent = '\u26a0\ufe0f DATA TIDAK LENGKAP'; badge.style.background = 'rgba(255,187,0,.12)'; badge.style.color = 'var(--amber)'; badge.style.borderColor = 'rgba(255,187,0,.3)'; }
    var cEl = document.getElementById('hw-conclusion'); var cTx = document.getElementById('hw-conclusion-text');
    if (cEl && cTx) { cEl.style.display = 'block'; cEl.style.borderLeftColor = 'var(--amber)'; cTx.innerHTML = '<b style="color:var(--amber)">Lengkapi data berikut:</b><br>' + errors.map(function(e){ return '\u2022 ' + e; }).join('<br>'); }
    done(); return;
  }

  // Sort rows by year ascending
  rows = rows.slice().sort(function(a, b) { return a.year - b.year; });

  // === Sanity check: warn if data looks wrong ===
  var warnings = [];
  rows.forEach(function(r) {
    var eq = parseFloat(r.equity), sh = parseFloat(r.shares), ni = parseFloat(r.netIncome), eps = parseFloat(r.eps);
    // If equity >> shares in raw numbers, shares probably entered as lembar not juta
    if (sh > 0 && eq > 0 && sh > eq * 10000) warnings.push('Tahun ' + r.year + ': Shares (' + sh.toLocaleString('id-ID') + ') tampak terlalu besar — pastikan dalam Juta lembar, bukan lembar penuh');
    // If shares looks like it's in lembar (very large number > 1 billion = >1000 juta)
    if (sh > 100000000) warnings.push('Tahun ' + r.year + ': Shares ' + sh.toLocaleString('id-ID') + ' terlalu besar — masukkan dalam JUTA lembar (bagi dengan 1.000.000)');
    // If NI given but ROE would be > 200% → likely NI in Rupiah not Miliar
    if (ni > 0 && eq > 0 && (ni / eq) > 2) warnings.push('Tahun ' + r.year + ': Net Income / Equity > 200% — pastikan Net Income dalam Miliar Rp, bukan Rp');
    // If equity seems to be in Rp not Miliar (< 1 for any reasonable company)
    if (eq > 0 && eq < 100) warnings.push('Tahun ' + r.year + ': Total Equity = ' + eq + ' — terlalu kecil, pastikan dalam Miliar Rp');
  });

  if (warnings.length) {
    // Show warnings but don't block calculation
    var wEl = document.getElementById('hw-data-warnings');
    if (!wEl) {
      wEl = document.createElement('div');
      wEl.id = 'hw-data-warnings';
      wEl.style.cssText = 'margin-top:8px;padding:8px 12px;background:rgba(255,34,68,.08);border-left:3px solid var(--red);border-radius:2px;font-size:9px;font-family:"IBM Plex Mono",monospace';
      var tableCard = document.querySelector('#page-hargawajar .card:nth-child(2)');
      if (tableCard) tableCard.appendChild(wEl);
    }
    wEl.innerHTML = '<b style="color:var(--red)">⚠️ PERINGATAN DATA:</b><br>' + warnings.map(function(w){ return '• ' + w; }).join('<br>');
    wEl.style.display = 'block';
  } else {
    var wEl2 = document.getElementById('hw-data-warnings');
    if (wEl2) wEl2.style.display = 'none';
  }
  var latest = rows[rows.length - 1];
  var ticker = hwData.ticker.toUpperCase();
  var price0 = hwData.currentPrice;
  var minRet = hwData.minReturn;
  var N = hwData.projYears;
  var reqReturn = minRet / 100;

  // === Step 1: Initial IRR = EPS_latest / Price ===
  var eps0 = parseFloat(latest.eps);
  var irr = eps0 / price0;
  var irrPass = (irr * 100) >= minRet;

  // === Step 2a: Average ROE ===
  // ROE = Net Income / Total Equity  (both in Miliar Rp — same unit, ratio is pure)
  // Fallback if netIncome empty: NI = EPS(Rp) * Shares(juta) / 1000 → Miliar Rp
  var roeList = [];
  rows.forEach(function(r) {
    var eq = parseFloat(r.equity);
    if (!(eq > 0)) return;
    var ni = parseFloat(r.netIncome);
    if (!(ni > 0)) {
      var e = parseFloat(r.eps), s = parseFloat(r.shares);
      if (e > 0 && s > 0) ni = (e * s) / 1000; // Rp * juta / 1000 = Miliar
      else return;
    }
    var roe = ni / eq;
    if (roe > 0 && roe < 2) roeList.push(roe); // sanity cap: >200% ROE = data error
  });
  var avgROE = roeList.length ? roeList.reduce(function(s,v){return s+v;},0) / roeList.length : 0;

  // === Step 2b: Average DPR = DPS / EPS (cap at 1.0) ===
  var dprWarning = false;
  var dprList = [];
  rows.forEach(function(r) {
    var e = parseFloat(r.eps);
    if (!(e > 0)) return;
    var d = parseFloat(r.dps);
    if (isNaN(d) || d < 0) d = 0;
    var v = d / e;
    if (v > 1.0) { dprWarning = true; v = 1.0; }
    dprList.push(v);
  });
  var avgDPR = dprList.length ? dprList.reduce(function(s,v){return s+v;},0) / dprList.length : 0;

  // === Step 2c: ROE after payout ===
  var roeAfterPayout = avgROE * (1 - avgDPR);

  // === Step 3a: Equity per Share (Rp/saham) ===
  // equity: Miliar Rp → ×1e9 = Rp
  // shares: Juta lembar → ×1e6 = lembar
  var equityMiliar = parseFloat(latest.equity);
  var sharesJuta = parseFloat(latest.shares);
  var equityPerShare = (equityMiliar * 1e9) / (sharesJuta * 1e6);

  // === Step 3b: Future Equity per Share ===
  var futureEquityPerShare = equityPerShare * Math.pow(1 + roeAfterPayout, N);

  // === Step 4: Future EPS ===
  var futureEPS = futureEquityPerShare * avgROE;

  // === Step 5: Average PER ===
  var perList = [];
  rows.forEach(function(r) {
    var p = parseFloat(r.per);
    if (p > 0 && p < 200) perList.push(p);
  });
  var avgPER = perList.length ? perList.reduce(function(s,v){return s+v;},0) / perList.length : 0;

  // === Future Price ===
  var futurePrice = futureEPS * avgPER;

  // === Harga Wajar = PV of Future Price ===
  var fairValue = (avgPER > 0 && futureEPS > 0) ? futurePrice / Math.pow(1 + reqReturn, N) : 0;

  // === MoS ===
  var mosPct = fairValue > 0 ? (fairValue - price0) / fairValue * 100 : -Infinity;
  var mosPass = isFinite(mosPct) && mosPct > 0;
  var overallPass = irrPass && mosPass;

  // === Render verdict ===
  document.getElementById('hw-ticker-display').textContent = ticker;
  var badge = document.getElementById('hw-verdict-badge');
  var verdCard = document.getElementById('hw-verdict-card');
  if (overallPass) {
    badge.textContent = '\u2705 UNDERVALUED \u2014 LAYAK BELI';
    badge.style.cssText += ';background:rgba(0,212,170,.15);color:var(--green);border-color:rgba(0,212,170,.4)';
    verdCard.style.borderTopColor = 'var(--green)';
  } else if (!irrPass && !mosPass) {
    badge.textContent = '\ud83d\udeab OVERVALUED \u2014 HINDARI';
    badge.style.cssText += ';background:rgba(255,34,68,.12);color:var(--red);border-color:rgba(255,34,68,.3)';
    verdCard.style.borderTopColor = 'var(--red)';
  } else {
    badge.textContent = '\u26a0\ufe0f PERHATIKAN \u2014 BORDERLINE';
    badge.style.cssText += ';background:rgba(255,187,0,.12);color:var(--amber);border-color:rgba(255,187,0,.3)';
    verdCard.style.borderTopColor = 'var(--amber)';
  }

  // === Render numbers ===
  var mosPctDisplay = isFinite(mosPct) ? fmtPct(mosPct) : (mosPct === -Infinity ? '\u2212\u221e' : '\u221e');
  document.getElementById('hw-fair-price').textContent = fmtRp(fairValue);
  document.getElementById('hw-fair-price').style.color = mosPass ? 'var(--green)' : 'var(--red)';
  document.getElementById('hw-current-display').textContent = fmtRp(price0);
  document.getElementById('hw-mos-pct').textContent = mosPctDisplay;
  document.getElementById('hw-mos-pct').style.color = (isFinite(mosPct) && mosPct > 30) ? 'var(--green)' : (isFinite(mosPct) && mosPct > 0) ? 'var(--amber)' : 'var(--red)';
  document.getElementById('hw-irr-display').textContent = fmtPct(irr * 100);
  document.getElementById('hw-irr-display').style.color = irrPass ? 'var(--green)' : 'var(--red)';

  var gaugeVal = isFinite(mosPct) ? Math.min(Math.max((mosPct + 100) / 200 * 100, 0), 100) : (mosPct === -Infinity ? 0 : 100);
  document.getElementById('hw-mos-bar').style.width = gaugeVal + '%';
  document.getElementById('hw-mos-bar').style.background = mosPass ? 'var(--green)' : 'var(--red)';
  document.getElementById('hw-mos-label').textContent = mosPctDisplay;
  document.getElementById('hw-mos-label').style.color = mosPass ? 'var(--green)' : 'var(--red)';

  // Metrics panel
  document.getElementById('hw-v-roe').textContent = fmtPct(avgROE * 100);
  document.getElementById('hw-v-dpr').textContent = fmtPct(avgDPR * 100);
  document.getElementById('hw-v-per').textContent = fmtD(avgPER, 1) + 'x';
  document.getElementById('hw-v-eps').textContent = fmtRp(eps0);
  document.getElementById('hw-v-eq').textContent = fmtRp(equityPerShare);
  document.getElementById('hw-v-feps').textContent = fmtRp(futureEPS);
  document.getElementById('hw-v-fsp').textContent = fmtRp(futurePrice);
  document.getElementById('hw-v-roe2').textContent = fmtPct(roeAfterPayout * 100);

  // Steps breakdown
  var stepsCard = document.getElementById('hw-steps-card');
  var stepsBody = document.getElementById('hw-steps-body');
  if (stepsCard && stepsBody) {
    stepsCard.style.display = 'block';
    var steps = [
      { label: 'Step 1 \u2014 IRR Awal', val: fmtPct(irr*100) + (irrPass ? ' \u2705' : ' \u274c'), desc: 'EPS terkini \u00f7 Harga Saham', ok: irrPass },
      { label: 'Step 2a \u2014 Avg ROE', val: fmtPct(avgROE*100), desc: roeList.length + ' tahun data (NI \u00f7 Equity)', ok: avgROE > 0 },
      { label: 'Step 2b \u2014 Avg DPR', val: fmtPct(avgDPR*100), desc: dprList.length + ' tahun' + (dprWarning ? ' \u26a0\ufe0f DPS>EPS di-cap 100%' : ''), ok: true },
      { label: 'Step 2c \u2014 ROE after Payout', val: fmtPct(roeAfterPayout*100), desc: 'ROE \u00d7 (1 \u2212 DPR)', ok: roeAfterPayout > 0 },
      { label: 'Step 3a \u2014 Equity / Share kini', val: fmtRp(equityPerShare), desc: equityMiliar.toLocaleString('id-ID') + 'M \u00f7 ' + sharesJuta.toLocaleString('id-ID') + 'jt lbr', ok: equityPerShare > 0 },
      { label: 'Step 3b \u2014 Future Equity/Share', val: fmtRp(futureEquityPerShare), desc: 'Proyeksi ' + N + ' tahun ke depan', ok: futureEquityPerShare > 0 },
      { label: 'Step 4 \u2014 Future EPS', val: fmtRp(futureEPS), desc: 'Future Equity \u00d7 Avg ROE', ok: futureEPS > 0 },
      { label: 'Step 5 \u2014 Avg PER', val: fmtD(avgPER, 1) + 'x', desc: perList.length + ' tahun data PER', ok: avgPER > 0 },
      { label: 'Harga Saham Masa Depan', val: fmtRp(futurePrice), desc: 'Future EPS \u00d7 Avg PER', ok: futurePrice > 0 },
      { label: 'Harga Wajar (PV)', val: fmtRp(fairValue), desc: 'Discounted ' + N + ' thn @ ' + minRet + '%/thn', ok: fairValue > 0 },
      { label: 'Margin of Safety', val: mosPctDisplay, desc: mosPass ? 'Undervalued \u2014 saham di bawah nilai wajar' : 'Overvalued \u2014 saham di atas nilai wajar', ok: mosPass },
    ];
    stepsBody.innerHTML = steps.map(function(s) {
      return '<div style="background:var(--bg3);border-radius:2px;padding:7px 9px;border-left:2px solid ' + (s.ok ? 'var(--green)' : 'var(--red)') + '">'
        + '<div style="font-size:8px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px">' + s.label + '</div>'
        + '<div style="font-size:13px;font-weight:700;font-family:\'IBM Plex Mono\',monospace;color:var(--text);margin:2px 0">' + s.val + '</div>'
        + '<div style="font-size:9px;color:var(--text3)">' + s.desc + '</div>'
        + '</div>';
    }).join('');
  }

  // Chart
  hw_renderChart(rows);

  // Kesimpulan
  var cEl = document.getElementById('hw-conclusion');
  var cTx = document.getElementById('hw-conclusion-text');
  if (cEl && cTx) {
    var verdictLabel, verdictColor, action;
    if (overallPass) {
      verdictLabel = 'UNDERVALUED'; verdictColor = 'var(--green)';
      action = 'Layak dipertimbangkan untuk dibeli. Harga saat ini memberikan margin keamanan yang memadai.';
    } else if (!irrPass && !mosPass) {
      verdictLabel = 'OVERVALUED'; verdictColor = 'var(--red)';
      action = 'Tidak disarankan dibeli pada harga ini. Tunggu koreksi atau cari emiten lain.';
    } else {
      verdictLabel = 'BORDERLINE'; verdictColor = 'var(--amber)';
      action = 'Posisi valuasi di batas. Pertimbangkan dengan cermat sebelum mengambil posisi.';
    }
    var mosAbs = fairValue - price0;
    var mosAbsStr = isFinite(mosAbs) ? fmtRp(Math.abs(mosAbs)) : '\u2014';
    var lines = [
      ticker + ' dinilai <b style="color:' + verdictColor + '">' + verdictLabel + '</b> berdasarkan metodologi MoS (9-step).',
      'Harga wajar: <b>' + fmtRp(fairValue) + '</b> \u00b7 Proyeksi ' + N + ' tahun \u00b7 Min return ' + minRet + '%/thn.',
      'Harga pasar <b>' + fmtRp(price0) + '</b> berada <b>' + (mosAbs >= 0 ? mosAbsStr + ' di bawah' : mosAbsStr + ' di atas') + '</b> nilai wajar \u2192 MoS <b style="color:' + (mosPass ? 'var(--green)' : 'var(--red)') + '">' + mosPctDisplay + '</b>.',
      'Initial IRR <b>' + fmtPct(irr*100) + '</b> vs threshold ' + minRet + '% \u2192 <b style="color:' + (irrPass ? 'var(--green)' : 'var(--red)') + '">' + (irrPass ? 'LULUS' : 'TIDAK LULUS') + '</b>.',
      'Avg ROE: <b>' + fmtPct(avgROE*100) + '</b> \u00b7 Avg DPR: <b>' + fmtPct(avgDPR*100) + '</b> \u00b7 Future EPS: <b>' + fmtRp(futureEPS) + '</b> \u00b7 Future Price: <b>' + fmtRp(futurePrice) + '</b>.',
      '<b>\u2192 ' + action + '</b>'
    ];
    cTx.innerHTML = lines.join('<br>');
    cEl.style.display = 'block';
    cEl.style.borderLeftColor = verdictColor;
  }

  // Save state & reset button
  hwData._result = { fairValue: fairValue, mosPct: mosPct, irr: irr*100, futurePrice: futurePrice, futureEPS: futureEPS, avgROE: avgROE, avgDPR: avgDPR, avgPER: avgPER, roeAfterPayout: roeAfterPayout, equityPerShare: equityPerShare };
  done();
}
function hw_renderChart(rows) {
  hwData._lastRows = rows;
  var chartCard = document.getElementById('hw-chart-card');
  if (!chartCard) return;
  chartCard.style.display = 'block';
  var ctx = document.getElementById('hw-history-chart');
  if (!ctx) return;
  if (hwHistChart) { hwHistChart.destroy(); hwHistChart = null; }
  var labels = rows.map(function(r){ return r.year; });
  var tickStyle = { color: '#b8bdd4', font: { size: 9, family: 'IBM Plex Mono' } };
  var gridStyle = { color: 'rgba(255,255,255,.05)' };
  var legendOpts = { labels: { color: '#b8bdd4', font: { family: 'IBM Plex Mono', size: 9 }, boxWidth: 10, padding: 10 } };

  var datasets, scales;
  if (hwChartMode === 'eps') {
    var epsData = rows.map(function(r){ return parseFloat(r.eps)||null; });
    var perData = rows.map(function(r){ return parseFloat(r.per)||null; });
    datasets = [
      { label: 'EPS (Rp)', data: epsData, backgroundColor: 'rgba(255,102,0,.55)', borderColor: 'rgba(255,102,0,.8)', borderWidth: 1, yAxisID: 'y', borderRadius: 2 },
      { label: 'PER (x)', data: perData, type: 'line', borderColor: '#0088ff', backgroundColor: 'transparent', yAxisID: 'y2', tension: .35, pointRadius: 4, pointBackgroundColor: '#0088ff', pointBorderColor: '#0a0a0f', pointBorderWidth: 1.5, borderWidth: 1.5 }
    ];
    scales = {
      x: { ticks: tickStyle, grid: gridStyle },
      y: { position: 'left', ticks: Object.assign({}, tickStyle, { callback: function(v){ return v >= 1000 ? (v/1000).toFixed(1)+'k' : v; } }), grid: gridStyle, title: { display: true, text: 'EPS (Rp)', color: '#ff6600', font: { size: 8 } } },
      y2: { position: 'right', ticks: tickStyle, grid: { display: false }, title: { display: true, text: 'PER (x)', color: '#0088ff', font: { size: 8 } } }
    };
  } else {
    var eqData = rows.map(function(r){ return parseFloat(r.equity)||null; });
    var niData = rows.map(function(r){ return parseFloat(r.netIncome)||null; });
    datasets = [
      { label: 'Total Equity (M Rp)', data: eqData, backgroundColor: 'rgba(0,212,170,.45)', borderColor: 'rgba(0,212,170,.8)', borderWidth: 1, yAxisID: 'y', borderRadius: 2 },
      { label: 'Net Income (M Rp)', data: niData, type: 'line', borderColor: '#ffc107', backgroundColor: 'transparent', yAxisID: 'y2', tension: .35, pointRadius: 4, pointBackgroundColor: '#ffc107', pointBorderColor: '#0a0a0f', pointBorderWidth: 1.5, borderWidth: 1.5 }
    ];
    scales = {
      x: { ticks: tickStyle, grid: gridStyle },
      y: { position: 'left', ticks: Object.assign({}, tickStyle, { callback: function(v){ return v >= 1000 ? (v/1000).toFixed(0)+'k' : v; } }), grid: gridStyle, title: { display: true, text: 'Equity (M)', color: '#00d4aa', font: { size: 8 } } },
      y2: { position: 'right', ticks: Object.assign({}, tickStyle, { callback: function(v){ return v >= 1000 ? (v/1000).toFixed(0)+'k' : v; } }), grid: { display: false }, title: { display: true, text: 'Net Inc (M)', color: '#ffc107', font: { size: 8 } } }
    };
  }

  if(hwHistChart){ try{ hwHistChart.destroy(); }catch(e){} hwHistChart=null; }
  hwHistChart = new Chart(ctx, {
    type: 'bar',
    data: { labels: labels, datasets: datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      plugins: {
        legend: legendOpts,
        tooltip: {
          backgroundColor: 'rgba(10,10,20,.92)',
          titleColor: '#ff6600',
          bodyColor: '#c0c0d8',
          borderColor: 'rgba(255,102,0,.3)',
          borderWidth: 1,
          titleFont: { family: 'IBM Plex Mono', size: 10 },
          bodyFont: { family: 'IBM Plex Mono', size: 9 },
          callbacks: {
            label: function(ctx) {
              var v = ctx.parsed.y;
              if (v === null) return ctx.dataset.label + ': N/A';
              return ctx.dataset.label + ': ' + (v >= 1000 ? v.toLocaleString('id-ID') : v);
            }
          }
        }
      },
      scales: scales
    }
  });
}

function hw_clearResults() {
  ['hw-fair-price','hw-current-display','hw-mos-pct','hw-irr-display','hw-v-roe','hw-v-dpr','hw-v-per','hw-v-eps','hw-v-eq','hw-v-feps','hw-v-fsp','hw-v-roe2','hw-ticker-display'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.textContent = '—';
  });
  var badge = document.getElementById('hw-verdict-badge');
  if (badge) { badge.textContent = 'BELUM DIHITUNG'; badge.style.background='var(--bg4)'; badge.style.color='var(--text3)'; badge.style.borderColor='var(--border)'; }
  if (document.getElementById('hw-steps-card')) document.getElementById('hw-steps-card').style.display = 'none';
  if (document.getElementById('hw-chart-card')) document.getElementById('hw-chart-card').style.display = 'none';
  hwChartMode = 'eps'; hwData._lastRows = null;
  if (document.getElementById('hw-mos-bar')) document.getElementById('hw-mos-bar').style.width = '50%';
  if (document.getElementById('hw-conclusion')) document.getElementById('hw-conclusion').style.display = 'none';
  if (document.getElementById('hw-verdict-card')) document.getElementById('hw-verdict-card').style.borderTopColor = 'var(--text3)';
}

function hw_saveToStorage() {
  hw_syncInputs();
  try { localStorage.setItem('hw_state', JSON.stringify(hwData)); } catch(e) {}
  // Save to history
  if (hwData.ticker && hwData._result) {
    try {
      var hist = JSON.parse(localStorage.getItem('hw_history')||'[]');
      var r = hwData._result;
      hist.unshift({
        ticker: hwData.ticker,
        date: new Date().toLocaleDateString('id-ID'),
        price: hwData.currentPrice,
        fairValue: r.fairValue,
        mosPct: r.mosPct,
        irr: r.irr
      });
      hist = hist.slice(0, 20);
      localStorage.setItem('hw_history', JSON.stringify(hist));
      hw_renderHistoryList();
      if (typeof showSaveStatus === 'function') showSaveStatus('Analisa disimpan', 'var(--green)');
    } catch(e) {}
  }
}

function hw_renderHistoryList() {
  var el = document.getElementById('hw-history-list');
  if (!el) return;
  try {
    var hist = JSON.parse(localStorage.getItem('hw_history')||'[]');
    if (!hist.length) { el.innerHTML = '<div style="font-size:10px;color:var(--text3);text-align:center;padding:16px">Belum ada analisa tersimpan</div>'; return; }
    el.innerHTML = hist.map(function(h) {
      var mos = h.mosPct || 0;
      var col = mos > 20 ? 'var(--green)' : mos > 0 ? 'var(--amber)' : 'var(--red)';
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;border-bottom:1px solid var(--border);cursor:pointer" onclick="hw_loadHistory(this)" data-h=\''+JSON.stringify(h)+'\' style="transition:.1s" onmouseover="this.style.background=\'var(--bg3)\'" onmouseout="this.style.background=\'transparent\'">'
        + '<div><span style="font-weight:700;font-family:\'IBM Plex Mono\',monospace;color:var(--bb-orange);font-size:11px">'+h.ticker+'</span> <span style="font-size:9px;color:var(--text3)">'+h.date+'</span></div>'
        + '<div style="text-align:right"><div style="font-size:10px;color:var(--text);font-family:\'IBM Plex Mono\',monospace">Rp '+Math.round(h.fairValue||0).toLocaleString('id-ID')+'</div>'
        + '<div style="font-size:9px;color:'+col+'">'+(mos>=0?'+':'')+mos.toFixed(1)+'% MoS</div></div>'
        + '</div>';
    }).join('');
  } catch(e) {}
}

function hw_clearHistory() {
  if (!confirm('Hapus semua histori analisa?')) return;
  localStorage.removeItem('hw_history');
  hw_renderHistoryList();
}

// Init on page load
(function(){ try { if(document.getElementById('hw-data-body') && !window._hwInited){ window._hwInited=true; hw_init(); } } catch(e){} })();
// Also init when tab is clicked
var _hw_origGoPage = typeof goPage === 'function' ? goPage : null;

