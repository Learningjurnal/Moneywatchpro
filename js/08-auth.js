
// ╔══════════════════════════════════════════════════════════╗
// ║                   AUTH SYSTEM                           ║
// ║  SHA-256 hash · session token · brute-force guard       ║
// ╚══════════════════════════════════════════════════════════╝

var AUTH = { SESSION_MS: 30 * 60 * 1000, _sesTimer: null, _barTimer: null, _sesStart: 0, _sesExp: 0 };

// ── Auth stubs — Supabase handles everything ──
function authLoadAcc(){ return _currentUser ? {user: _currentUser.email} : null; }
function authSaveAcc(obj){}
function authSaveSession(u){ return {}; }
function authLoadSession(){ return _currentUser?{user:_currentUser.email, exp: AUTH._sesExp}:null; }
function authClearSession(){ _currentUser=null; AUTH._sesExp=0; }
function authBumpSession(){ if(_currentUser){ AUTH._sesExp = Date.now() + AUTH.SESSION_MS; } }


// ── Show / Hide app ──
function authShowApp(username){
  var overlay = document.getElementById('auth-overlay');
  var app = document.getElementById('main-app');
  if(overlay) overlay.classList.add('hidden');
  if(app) app.style.display='';
  // Show session info
  var si = el('session-info'), su = el('session-user');
  if(si) si.style.display='flex';
  if(su) su.textContent = username;
  // Start session countdown bar
  AUTH._sesStart = Date.now();
  AUTH._sesExp = Date.now() + AUTH.SESSION_MS;
  authStartTimeoutBar();
  // Rebuild ticker tape after login (data may now be loaded)
  try{ buildTickerTape(); }catch(e){}
  // Activity listeners reset timer
  ['click','keydown','mousemove'].forEach(function(ev){
    document.addEventListener(ev, authBumpSession, {passive:true});
  });
  // Auto-logout check every 60s
  if(AUTH._sesTimer) clearInterval(AUTH._sesTimer);
  AUTH._sesTimer = setInterval(function(){
    var s = authLoadSession();
    if(!s || (s.exp && Date.now() > s.exp)){ authLogout(); }
  }, 60000);
}

function authStartTimeoutBar(){
  var bar = el('auth-timeout-bar');
  if(!bar) return;
  if(AUTH._barTimer) clearInterval(AUTH._barTimer);
  AUTH._barTimer = setInterval(function(){
    var s = authLoadSession();
    if(!s){ clearInterval(AUTH._barTimer); return; }
    var remaining = s.exp - Date.now();
    var pct = Math.max(0, (remaining / AUTH.SESSION_MS) * 100);
    bar.style.width = pct + '%';
    bar.style.background = pct < 20 ? '#ff3d5a' : pct < 50 ? '#ffc107' : 'var(--accent)';
  }, 1000);
}

// ── UI navigation ──
function authShowLogin(){
  el('auth-login-form').style.display='';
  el('auth-setup-form').style.display='none';
  el('auth-reset-form').style.display='none';
  el('auth-err').style.display='none';
  var lk=el('auth-lock-msg'); if(lk) lk.style.display='none';
}


function authShowSetup(msg){
  el('auth-login-form').style.display='none';
  el('auth-setup-form').style.display='';
  el('auth-reset-form').style.display='none';
  el('auth-err').style.display='none';
  var sm = el('auth-setup-msg'); if(sm) sm.textContent = msg||'Buat akun baru';
  var sb = el('auth-setup-back'); if(sb) sb.style.display = '';
}

function authShowReset(){
  el('auth-login-form').style.display='none';
  el('auth-setup-form').style.display='none';
  el('auth-reset-form').style.display='';
  el('auth-err').style.display='none';
}

function authShowErr(msg){
  var e = el('auth-err');
  if(!e) return;
  e.style.display='block'; e.textContent='⚠️ '+msg;
}

// ── Login via Supabase ──
function authDoLogin(){
  var uInput=(el('auth-username')&&el('auth-username').value||'').trim();
  var pInput=(el('auth-password')&&el('auth-password').value||'');
  if(!uInput||!pInput){ authShowErr('Isi email dan password.'); return; }
  var btn=el('auth-login-btn');
  if(btn){ btn.disabled=true; btn.textContent='Masuk...'; }
  _supabase.auth.signInWithPassword({email:uInput,password:pInput})
    .then(function(result){
      if(btn){ btn.disabled=false; btn.textContent='Masuk \u2192'; }
      if(result.error){ authShowErr('Email atau password salah. Coba lagi.'); return; }
      _currentUser=result.data.user;
      var displayName=(_currentUser.user_metadata&&_currentUser.user_metadata.display_name)||_currentUser.email||'User';
      supaLoadAllData().then(function(){ authShowApp(displayName); }).catch(function(loadErr){ authShowErr('Login berhasil tapi gagal memuat data: '+(loadErr&&loadErr.message||'unknown')); if(btn){ btn.disabled=false; btn.textContent='Masuk \u2192'; } });
    })
    .catch(function(err){
      if(btn){ btn.disabled=false; btn.textContent='Masuk \u2192'; }
      authShowErr('Gagal login: '+(err&&err.message||'unknown'));
    });
}


// ── Daftar akun baru via Supabase ──
function authDoSetup(){
  var u=(el('auth-new-user')&&el('auth-new-user').value||'').trim();
  var p=(el('auth-new-pass')&&el('auth-new-pass').value||'');
  var p2=(el('auth-new-pass2')&&el('auth-new-pass2').value||'');
  if(!u||!u.includes('@')){ authShowErr('Gunakan alamat email yang valid.'); return; }
  if(p.length<8){ authShowErr('Password minimal 8 karakter.'); return; }
  if(p!==p2){ authShowErr('Password tidak cocok.'); return; }
  var setupBtn=document.querySelector('#auth-setup-form .auth-btn:not([data-added])');
  if(setupBtn){ setupBtn.disabled=true; setupBtn.textContent='Membuat akun...'; }
  _supabase.auth.signUp({email:u,password:p})
    .then(function(result){
      if(setupBtn){ setupBtn.disabled=false; setupBtn.textContent='Buat Akun \u2192'; }
      if(result.error){ authShowErr('Gagal buat akun: '+result.error.message); return; }
      var msg=el('auth-setup-msg');
      if(msg){msg.style.color='var(--green)';msg.style.background='rgba(0,229,160,.08)';msg.style.border='1px solid rgba(0,229,160,.2)';msg.innerHTML='\u2705 Akun berhasil dibuat!<br><br>Silakan login dengan email dan password yang baru dibuat.';}
      var sf=el('auth-setup-form');
      if(sf){var btn2=document.createElement('button');btn2.className='auth-btn';btn2.style.marginTop='12px';btn2.textContent='Ke halaman login \u2192';btn2.setAttribute('data-added','1');btn2.onclick=function(){authShowLogin();};sf.appendChild(btn2);}
    })
    .catch(function(err){
      if(setupBtn){ setupBtn.disabled=false; setupBtn.textContent='Buat Akun \u2192'; }
      authShowErr('Gagal membuat akun. ('+(err&&err.message||'unknown')+')');
    });
}


// ── Reset password via Supabase ──
function authDoReset(){
  var email=(el('auth-reset-code')&&el('auth-reset-code').value||'').trim();
  if(!email||!email.includes('@')){ authShowErr('Masukkan alamat email yang terdaftar.'); return; }
  _supabase.auth.resetPasswordForEmail(email).then(function(result){
    if(result.error){ authShowErr('Gagal kirim reset: '+result.error.message); return; }
    var e=el('auth-err');
    if(e){ e.style.display='block'; e.style.color='var(--green)'; e.textContent='\u2705 Link reset password dikirim ke email Anda.'; }
  }).catch(function(err){ authShowErr('Gagal kirim reset: '+(err&&err.message||'unknown')); });
}


// ── Logout via Supabase ──
function authLogout(){
  if(!confirm('Yakin ingin logout?')) return;
  function _doLogoutUI(){
    _currentUser=null;
    if(AUTH._sesTimer){ clearInterval(AUTH._sesTimer); AUTH._sesTimer=null; }
    if(AUTH._barTimer){ clearInterval(AUTH._barTimer); AUTH._barTimer=null; }
    var app=document.getElementById('main-app');
    var overlay=document.getElementById('auth-overlay');
    if(app) app.style.display='none';
    if(overlay) overlay.classList.remove('hidden');
    var si=el('session-info'); if(si) si.style.display='none';
    ['auth-username','auth-password'].forEach(function(id){ var e=el(id); if(e) e.value=''; });
    var ae=el('auth-err'); if(ae) ae.style.display='none';
    authShowLogin();
  }
  _supabase.auth.signOut().then(function(){ _doLogoutUI(); }).catch(function(){ _doLogoutUI(); });
}


// ── Init auth — cek Supabase session ──
function authInit(){
  _supabase.auth.getSession().then(function(result){
    var session=result.data&&result.data.session;
    if(session&&session.user){
      _currentUser=session.user;
      var displayName=(_currentUser.user_metadata&&_currentUser.user_metadata.display_name)||_currentUser.email||'User';
      supaLoadAllData().then(function(){ authShowApp(displayName); }).catch(function(){ authShowLogin(); });
    } else { authShowLogin(); }
  }).catch(function(){ authShowLogin(); });
  _supabase.auth.onAuthStateChange(function(event,session){
    if(event==='SIGNED_OUT'||!session){ if(_currentUser){ _currentUser=null; } }
  });
}


