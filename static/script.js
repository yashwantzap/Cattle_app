// static/script.js
// Portrait-first frontend logic, MOCK = true for testing (no backend required)
const MOCK = true;

// helper selectors
function el(id){ return document.getElementById(id); }
function addClass(elm, cls){ if(!elm) return; elm.classList.add(cls); }
function remClass(elm, cls){ if(!elm) return; elm.classList.remove(cls); }
function show(id){ const n = el(id); if(!n) return; n.classList.remove('hidden'); setTimeout(()=> n.classList.add('show'), 20); }
function hide(id){ const n = el(id); if(!n) return; n.classList.remove('show'); setTimeout(()=> n.classList.add('hidden'), 180); }
function setMsg(id, txt, isError=false){ const n = el(id); if(!n) return; n.textContent = txt; n.style.color = isError ? '#ef4444' : '#1e40af'; }

let APP = { user: null, lastOtp: null, cattle: null };

// basic mock helpers
function sleep(ms){ return new Promise(resolve => setTimeout(resolve, ms)); }
function genOtp(){ const v = Math.floor(100000 + Math.random()*900000).toString(); APP.lastOtp = v; console.log('[MOCK] OTP:', v); return v; }
function fakePrediction(){ const diseased = Math.random() > 0.45; return { predicted_label: diseased ? 'Diseased' : 'Healthy', confidence: Math.round((0.6 + Math.random()*0.35)*100), vet:{name:'Dr. Ramesh', mobile:'9876501234'}, gopa:{name:'Suresh', mobile:'9123456780'} }; }

// ensure dashboard nav button exists and wires behavior
function ensureNavButtons(){
  const nav = document.querySelector('.topbar .topbar-right');
  if(!nav) return;

  // ensure Dashboard
  if(!el('btn-dashboard')){
    const btn = document.createElement('button');
    btn.id = 'btn-dashboard';
    btn.className = 'icon-btn hidden';
    btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 13h8V3H3v10zM3 21h8v-6H3v6zM13 21h8V11h-8v10zM13 3v6h8V3h-8z" fill="currentColor"/></svg><span>Dashboard</span>';
    nav.insertBefore(btn, el('btn-profile'));
    btn.addEventListener('click', ()=> { hide('profile-section'); show('dashboard-section'); });
  }

  // ensure Profile exists
  if(!el('btn-profile')){ /* profile button defined in HTML; if not, no-op */ }
  if(!el('btn-logout')){ /* logout defined in HTML; if not, no-op */ }
}

// show/hide panels
function showAuth(){ show('auth-section'); hide('dashboard-section'); hide('profile-section'); hide('otp-mini'); }
function showDashboard(){ hide('auth-section'); show('dashboard-section'); hide('profile-section'); hide('otp-mini'); }
function showProfile(){ hide('auth-section'); hide('dashboard-section'); show('profile-section'); }

// clear fields & reset UI
function resetToAuth(){
  APP = { user:null, lastOtp:null, cattle:null };
  remClass(el('btn-dashboard'), 'show'); addClass(el('btn-dashboard'), 'hidden');
  remClass(el('btn-profile'), 'show'); addClass(el('btn-profile'), 'hidden');
  remClass(el('btn-logout'), 'show'); addClass(el('btn-logout'), 'hidden');

  // clear inputs
  ['name','mobile','village','mandal','district','login-mobile','otp-input','cattle-id','age'].forEach(id => { if(el(id)) el(id).value = ''; });
  if(el('preview')) el('preview').innerHTML = 'Preview will appear here';
  hide('result-area');
  showAuth();
}

// wire DOM events
document.addEventListener('DOMContentLoaded', ()=> {
  ensureNavButtons();

  // initial state: only auth visible
  resetToAuth();

  // tabs
  el('tab-register').addEventListener('click', ()=> {
    el('tab-register').classList.add('active'); el('tab-login').classList.remove('active');
    remClass(el('register-card'), 'hidden'); addClass(el('login-card'), 'hidden');
  });
  el('tab-login').addEventListener('click', ()=> {
    el('tab-login').classList.add('active'); el('tab-register').classList.remove('active');
    remClass(el('login-card'), 'hidden'); addClass(el('register-card'), 'hidden');
  });

  // Submit register -> send OTP (mock)
  el('submit-user').addEventListener('click', async ()=>{
    setMsg('user-messages','Sending...');
    const name = el('name').value.trim();
    const mobile = el('mobile').value.trim();
    if(!name || !/^\d{10}$/.test(mobile)){ setMsg('user-messages','Enter name and 10-digit mobile.', true); return; }
    APP.user = { name, mobile, village: el('village').value.trim(), mandal: el('mandal').value.trim(), district: el('district').value.trim() };
    await sleep(400);
    genOtp();
    setMsg('user-messages','OTP sent (mock). Check console.');
    show('otp-mini');
  });

  // Login -> request OTP with mobile (mock)
  el('btn-login').addEventListener('click', async ()=>{
    const mobile = el('login-mobile').value.trim();
    if(!/^\d{10}$/.test(mobile)){ setMsg('login-messages','Enter a valid 10-digit mobile.', true); return; }
    APP.user = { name:'Existing User', mobile, village:'Rampuram', mandal:'Chintalapudi', district:'Eluru' };
    await sleep(300);
    genOtp();
    setMsg('login-messages','OTP sent (mock). Check console.');
    show('otp-mini');
  });

  // Verify OTP
  el('verify-otp').addEventListener('click', async ()=>{
    const otp = el('otp-input').value.trim();
    setMsg('otp-messages','Verifying...');
    await sleep(400);
    if(otp !== APP.lastOtp){ setMsg('otp-messages','Invalid OTP', true); return; }
    // show dashboard + navbar
    remClass(el('btn-profile'), 'hidden'); remClass(el('btn-profile'), 'show');
    remClass(el('btn-logout'), 'hidden'); remClass(el('btn-logout'), 'show');
    remClass(el('btn-dashboard'), 'hidden'); remClass(el('btn-dashboard'), 'show');

    // populate UI
    if(el('dash-user')) el('dash-user').textContent = `${APP.user.name} • ${APP.user.mobile} • ${APP.user.village || '—'}`;
    if(el('prof-name')) el('prof-name').textContent = APP.user.name;
    if(el('prof-mobile')) el('prof-mobile').textContent = APP.user.mobile;
    if(el('prof-village')) el('prof-village').textContent = APP.user.village || '';
    if(el('prof-mandal')) el('prof-mandal').textContent = APP.user.mandal || '';
    if(el('prof-district')) el('prof-district').textContent = APP.user.district || '';

    // NOTE: In a non-mock app, a successful login would also fetch APP.cattle data here.
    if(APP.cattle) {
        if(el('cattle-id')) el('cattle-id').value = APP.cattle.cattle_id;
        if(el('gender')) el('gender').value = APP.cattle.gender;
        if(el('age')) el('age').value = APP.cattle.age;
    }


    setMsg('otp-messages','Verified. Welcome!');
    showDashboard();
  });

  // Resend OTP
  el('resend-otp').addEventListener('click', ()=> { genOtp(); setMsg('otp-messages','OTP resent (mock).'); });

  // Navbar actions
  el('btn-profile').addEventListener('click', ()=> { showProfile(); });
  el('btn-dashboard').addEventListener('click', ()=> { showDashboard(); });
  el('btn-logout').addEventListener('click', ()=> {
    if(confirm('Logout?')) resetToAuth();
  });

  // Cattle save/update function (API INTEGRATION)
  el('submit-cattle').addEventListener('click', async ()=>{
    const cid = el('cattle-id').value.trim();
    const ageVal = parseFloat(el('age').value);
    const genderVal = el('gender').value;

    if(!cid){ setMsg('cattle-messages','Enter cattle ID', true); return; }
    if(isNaN(ageVal) || ageVal < 0){ setMsg('cattle-messages','Enter valid age (must be a positive number).', true); return; }
    
    setMsg('cattle-messages','Saving...');
    
    const payload = { cattle_id: cid, gender: genderVal, age: ageVal };
    
    try {
        const response = await fetch('/api/submit_cattle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        
        if (data.ok) {
            APP.cattle = payload; // Update local state
            setMsg('cattle-messages', data.message || 'Cattle details saved.');
        } else {
            setMsg('cattle-messages', data.error || 'Failed to save details.', true);
        }
    } catch(e) {
        setMsg('cattle-messages', 'Network error during save.', true);
    }
  });

  // Image preview
  el('image-file').addEventListener('change', (ev)=>{
    const f = ev.target.files[0];
    if(!f) return;
    const reader = new FileReader();
    reader.onload = e => { el('preview').innerHTML = `<img src="${e.target.result}" style="max-width:100%;border-radius:10px;"/>`; };
    reader.readAsDataURL(f);
  });

  // Predict
  el('submit-prediction').addEventListener('click', async ()=>{
    if(!el('image-file').files.length){ setMsg('prediction-messages','Attach an image', true); return; }
    
    // NOTE: This prediction logic is still MOCK as it doesn't use the new backend API call
    setMsg('prediction-messages','Predicting...');
    await sleep(900);
    const r = fakePrediction();
    el('result-content').innerHTML = `
      <div class="${r.predicted_label === 'Diseased' ? 'result-warning' : 'result-success'}" style="padding:12px;border-radius:8px">
        <h4 style="margin:0 0 8px 0">Status: ${r.predicted_label}</h4>
        <p style="margin:0 0 6px 0">Confidence: <strong>${r.confidence}%</strong></p>
        <p style="margin:0 0 6px 0"><strong>Vet:</strong> ${r.vet.name} • ${r.vet.mobile}</p>
        <p style="margin:0"> <strong>Gopalamitra:</strong> ${r.gopa.name} • ${r.gopa.mobile}</p>
      </div>
    `;
    show('result-area');
    setMsg('prediction-messages','Completed.');
  });

  // Profile: edit action (simple inline edit)
  if(el('edit-profile')){
    el('edit-profile').addEventListener('click', ()=>{
      const newName = prompt('Edit name', APP.user ? APP.user.name : '');
      if(newName !== null && newName.trim() !== ''){
        APP.user.name = newName.trim();
        if(el('prof-name')) el('prof-name').textContent = APP.user.name;
        if(el('dash-user')) el('dash-user').textContent = `${APP.user.name} • ${APP.user.mobile} • ${APP.user.village || '—'}`;
        setMsg('prediction-messages','Profile updated.');
      }
    });
  }

  // Back to dashboard from profile
  if(el('back-to-dash')) el('back-to-dash').addEventListener('click', ()=> showDashboard());
});