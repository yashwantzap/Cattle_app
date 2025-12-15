/* =====================================================
   CORE HELPERS
===================================================== */
function el(id) {
  return document.getElementById(id);
}
function show(id) {
  el(id)?.classList.remove('hidden');
  el(id)?.classList.add('show');
}
function hide(id) {
  el(id)?.classList.add('hidden');
  el(id)?.classList.remove('show');
}
function msg(id, text, type = 'default') {
  const element = el(id);
  if (!element) return;
  element.textContent = text;
  element.style.color = '';
  element.style.backgroundColor = 'transparent';

  if (type === 'error') {
    element.style.color = 'var(--error-red)';
    element.style.fontWeight = '500';
  } else if (type === 'success') {
    element.style.color = 'var(--success-green)';
    element.style.fontWeight = '500';
  } else {
    element.style.color = 'var(--text-muted)';
  }
}
function clearMsg(id) {
  msg(id, '');
}

/* =====================================================
   APP STATE & INITIALIZATION
===================================================== */
let APP = {
  user: null,
  cattle: null, 
  tempUser: null,
  dashboardStats: {
      farmers: 130,
      cows: 350,
      bulls: 80
  }
};

/* =====================================================
   CODE MODIFICATION POINT 1: Add New Section IDs
   -----------------------------------------------------
   To enable routing for the new pages you added in index.html,
   add their IDs here.
   
   Example: The menu item for "Registered Farmers" has data-section="farmers-section".
   You MUST add 'farmers-section' to the array below.
   =====================================================
*/
const SECTIONS = [
    'auth-section', 
    'dashboard-section', 
    'profile-section', 
    'predictor-section',
    // --- ADD NEW SECTION IDs HERE ---
    'farmers-section', 
    'estrous-section',
    'bot-section',
    'remedies-section',
    'viewer-section',
    'locations-section',
    'count-section',
    'podcast-section'
    // ---------------------------------
];
const MOCK_OTP = "123456";

document.addEventListener('DOMContentLoaded', () => {
  SECTIONS.forEach(s => hide(s));
  show('auth-section');

  el('tab-register').classList.add('active');
  hide('login-card');

  setStep(1); 
});

/* =====================================================
   NAVIGATION & ROUTING
===================================================== */
document.querySelector('.sidebar-menu')?.addEventListener('click', (e) => {
  const item = e.target.closest('.menu-item');
  if (!item) return;

  const sectionId = item.getAttribute('data-section');

  // Highlight active menu
  document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
  item.classList.add('active');

  SECTIONS.forEach(s => hide(s));

  if (sectionId && APP.user) {
    show(sectionId);
    
    /* =====================================================
       CODE MODIFICATION POINT 2: Initialize New Pages
       -----------------------------------------------------
       If a new page needs data loaded or steps reset when opened,
       add its initialization logic here.
       =====================================================
    */
    if (sectionId === 'dashboard-section') {
      loadDashboardStats();
    } else if (sectionId === 'profile-section') {
      loadProfileData();
    } else if (sectionId === 'predictor-section') {
      // Reset predictor steps when entering the section
      setStep(1); 
    } 
    // --- ADD INITIALIZATION FOR NEW SECTIONS HERE ---
    // Example: 
    // else if (sectionId === 'farmers-section') {
    //   loadFarmersList(); 
    // }
    // ------------------------------------------------
    return;
  }

  // Handle unauthorized or unimplemented pages
  if (!APP.user && sectionId) {
    alert('Please Login/Register first.');
    show('auth-section');
    document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
  } else if (!sectionId) {
    // This block handles menu items without a data-section attribute
    show('dashboard-section'); 
    document.querySelector('[data-section="dashboard-section"]')?.classList.add('active');
  }
});


/* =====================================================
   AUTH FLOW (API Integration)
===================================================== */

// --- Tab Switching ---
el('tab-register')?.addEventListener('click', () => {
  el('tab-register').classList.add('active');
  el('tab-login').classList.remove('active');
  show('register-card');
  hide('login-card');
  hide('otp-mini');
  clearMsg('user-messages');
  clearMsg('login-messages');
});

el('tab-login')?.addEventListener('click', () => {
  el('tab-login').classList.add('active');
  el('tab-register').classList.remove('active');
  show('login-card');
  hide('register-card');
  hide('otp-mini');
  clearMsg('user-messages');
  clearMsg('login-messages');
});

// --- Request OTP ---
async function requestOtp(isRegister) {
  const messageId = isRegister ? 'user-messages' : 'login-messages';
  clearMsg(messageId);

  const mobile = el(isRegister ? 'mobile' : 'login-mobile').value;
  const data = {
    name: isRegister ? el('name').value : '',
    mobile: mobile,
    village: isRegister ? el('village').value : '',
    mandal: isRegister ? el('mandal').value : '',
    district: isRegister ? el('district').value : ''
  };

  try {
    const response = await fetch('/api/submit_user_info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await response.json();

    if (response.ok) {
      show('otp-mini');
      msg('otp-messages', `${result.message}. (Use OTP: ${MOCK_OTP})`, 'success');
    } else {
      const errorText = result.errors ? result.errors.join('<br>') : result.error || 'Registration failed.';
      msg(messageId, errorText, 'error');
    }
  } catch (e) {
    msg(messageId, 'Network error. Could not reach server.', 'error');
  }
}

el('submit-user')?.addEventListener('click', () => requestOtp(true));
el('btn-login')?.addEventListener('click', () => requestOtp(false));

// --- Verify OTP ---
el('verify-otp')?.addEventListener('click', async () => {
  const otp = el('otp-input').value;
  clearMsg('otp-messages');

  try {
    const response = await fetch('/api/verify_otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ otp })
    });
    const result = await response.json();

    if (response.ok) {
      // Authentication successful, navigate
      // APP.user is updated here based on Flask session data (backend handles persistence)
      
      hide('auth-section');
      show('dashboard-section');
      loadDashboardStats();

      // Highlight Dashboard menu item
      document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
      document.querySelector('[data-section="dashboard-section"]')?.classList.add('active');
    } else {
      msg('otp-messages', result.error || 'Verification failed.', 'error');
    }
  } catch (e) {
    msg('otp-messages', 'Network error. Could not verify OTP.', 'error');
  }
});

el('resend-otp')?.addEventListener('click', async () => {
    clearMsg('otp-messages');
    try {
        const response = await fetch('/api/resend_otp', { method: 'POST' });
        const result = await response.json();
        
        if (response.ok) {
            msg('otp-messages', `${result.message}. (Use OTP: ${MOCK_OTP})`, 'success');
        } else {
            msg('otp-messages', result.error || 'Failed to resend OTP.', 'error');
        }
    } catch (e) {
        msg('otp-messages', 'Network error during resend.', 'error');
    }
});


/* =====================================================
   DASHBOARD VIEW
===================================================== */
function loadDashboardStats() {
    const stats = APP.dashboardStats;
    el('stat-farmers').textContent = stats.farmers;
    el('stat-cows').textContent = stats.cows;
    el('stat-bulls').textContent = stats.bulls;
    el('stat-total').textContent = stats.cows + stats.bulls;
}


/* =====================================================
   PREDICTOR FLOW (Combined Submission)
===================================================== */
function setStep(step) {
  // Update steps: Step 1 = Details, Step 2 = Predict, Step 3 = Result
  [1, 2, 3].forEach(i => {
    el(`step-${i}`)?.classList.toggle('active', i <= step);
  });
  // Clear result area when going back to step 1 or 2
  if (step < 3) {
      hide('result-area');
      clearMsg('cattle-details-messages');
      clearMsg('prediction-messages');
  }
}

// --- Image Preview ---
el('image-file')?.addEventListener('change', function(e) {
  const preview = el('preview');
  preview.innerHTML = 'Preview will appear here'; 
  
  if (e.target.files.length > 0) {
    const file = e.target.files[0];
    const validImageTypes = ['image/jpeg', 'image/png', 'image/jpg'];

    if (!validImageTypes.includes(file.type)) {
        preview.innerHTML = '<span style="color:var(--error-red); font-weight:600;">Error: File must be JPG or PNG.</span>';
        e.target.value = ''; 
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
      const img = document.createElement('img');
      img.src = e.target.result;
      img.style.maxWidth = '100%';
      img.style.maxHeight = '150px';
      img.style.objectFit = 'contain';
      img.style.borderRadius = '6px';
      preview.innerHTML = '';
      preview.appendChild(img);
    };
    reader.readAsDataURL(file);
  }
});

// --- Combined Submission: Save Cattle + Run Prediction (API Integration) ---
el('submit-prediction')?.addEventListener('click', async () => {
  clearMsg('cattle-details-messages');
  clearMsg('prediction-messages');
  setStep(1); 

  const cattleId = el('cattle-id').value.trim();
  const age = el('age').value;
  const gender = el('gender').value;
  const imageFile = el('image-file').files[0];
  const diseaseType = document.querySelector('input[name="disease"]:checked')?.value;
  
  // 1. Client-Side Validation
  if (!cattleId || !age || parseInt(age) <= 0) {
    msg('cattle-details-messages', 'Cattle ID and a valid Age are required.', 'error');
    return;
  }
  if (!imageFile) {
    msg('prediction-messages', 'Please upload an image for prediction.', 'error');
    return;
  }

  // 2. Save Cattle Details (API Call)
  // This is required to set the 'cattle_details' in the Flask session before prediction
  try {
      const saveResponse = await fetch('/api/submit_cattle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cattle_id: cattleId, gender: gender, age: age })
      });
      const saveResult = await saveResponse.json();

      if (!saveResponse.ok) {
          msg('cattle-details-messages', saveResult.error || 'Failed to save cattle details.', 'error');
          return;
      }
      
      // Update APP state with saved data
      APP.cattle = { id: cattleId, gender: gender, age: age };
      msg('cattle-details-messages', saveResult.message, 'success');

      // 3. Run Prediction (API Call)
      setStep(2);
      msg('prediction-messages', 'Running prediction...', 'default');
      
      const predictFormData = new FormData();
      predictFormData.append('disease_type', diseaseType);
      predictFormData.append('file', imageFile);
      
      const predictResponse = await fetch('/api/predict', {
          method: 'POST',
          body: predictFormData
      });
      const predictResult = await predictResponse.json();
      
      if (predictResponse.ok) {
          msg('prediction-messages', 'Prediction complete!', 'success');
          displayResult(diseaseType, predictResult.predicted_label, predictResult.confidence);
          setStep(3);
      } else {
          msg('prediction-messages', predictResult.error || predictResult.warning || 'Prediction failed.', 'error');
          setStep(2);
      }
  } catch (e) {
      msg('prediction-messages', 'Network or server error during submission.', 'error');
      setStep(1);
  }
});

// --- Step 3: Display Result ---
function displayResult(diseaseType, predictedLabel, confidence) {
  const resultContent = el('result-content');
  let resultHTML;
  const isDiseased = predictedLabel === 'Diseased';
  const confidenceRounded = confidence.toFixed(2);

  if (isDiseased) {
    resultHTML = `
      <div class="result-warning">
        <p><strong>🔴 ${diseaseType} Detection: Positive</strong></p>
        <p>Confidence: <strong>${confidenceRounded}%</strong></p>
        <p>The AI model detected high probability of ${diseaseType}.</p>
        <p>Immediate action is required. Contact the AVR vet team.</p>
      </div>
    `;
  } else {
    resultHTML = `
      <div class="result-success">
        <p><strong>🟢 ${diseaseType} Detection: Negative</strong></p>
        <p>Confidence: <strong>${confidenceRounded}%</strong></p>
        <p>The AI model prediction is negative for ${diseaseType}.</p>
        <p>Continue monitoring the cattle.</p>
      </div>
    `;
  }
  resultContent.innerHTML = resultHTML;
  show('result-area');
}

/* =====================================================
   PROFILE FLOW
===================================================== */
function toggleProfileInputs(disabled) {
  el('prof-name-input').disabled = disabled;
  el('prof-village-input').disabled = disabled;
  el('prof-mandal-input').disabled = disabled;
  el('prof-district-input').disabled = disabled;
}

function loadProfileData() {
  if (APP.user) {
    el('prof-name-input').value = APP.user.name || '';
    el('prof-mobile-input').value = APP.user.mobile || '';
    el('prof-village-input').value = APP.user.village || '';
    el('prof-mandal-input').value = APP.user.mandal || '';
    el('prof-district-input').value = APP.user.district || '';

    // Set avatar
    const name = APP.user.name || 'U';
    el('profile-avatar').textContent = name.charAt(0).toUpperCase();

    // Set initial state to disabled (read-only)
    toggleProfileInputs(true);
    hide('save-profile');
    show('edit-profile');
  }
}

el('edit-profile')?.addEventListener('click', () => {
  toggleProfileInputs(false);
  hide('edit-profile');
  show('save-profile');
});

el('save-profile')?.addEventListener('click', () => {
  // Mock Update APP state (In a real app, this would be an API PUT call)
  APP.user.name = el('prof-name-input').value;
  APP.user.village = el('prof-village-input').value;
  APP.user.mandal = el('prof-mandal-input').value;
  APP.user.district = el('prof-district-input').value;

  // Update avatar
  const name = APP.user.name || 'U';
  el('profile-avatar').textContent = name.charAt(0).toUpperCase();

  // Revert state
  toggleProfileInputs(true);
  hide('save-profile');
  show('edit-profile');

  alert('Profile updated successfully!');
});

el('back-to-dash')?.addEventListener('click', () => {
  hide('profile-section');
  show('dashboard-section');
  loadDashboardStats();

  // Highlight dashboard
  document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
  document.querySelector('[data-section="dashboard-section"]')?.classList.add('active');
});

/* =====================================================
   CODE MODIFICATION POINT 3: Define New Initialization Functions
   -----------------------------------------------------
   You must define functions for the new sections if they need 
   to load data or set up the UI. Call these functions in 
   MODIFICATION POINT 2.

   Example: 
   function loadFarmersList() {
       // Code to fetch and display the registered farmers list (API call needed)
       const farmersSection = el('farmers-section');
       farmersSection.innerHTML = '<h2>Registered Farmers</h2><p>Loading farmer data...</p>';
       // fetch('/api/get_farmers').then(data => ...);
   }

   function initializeAvrBot() {
       // Code to initialize the chat interface or chatbot widget
       console.log("AVR Bot interface initialized.");
   }
   // ------------------------------------------------
*/