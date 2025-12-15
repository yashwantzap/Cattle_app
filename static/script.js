/* =====================================================
    CONFIGURATION FLAG
    -----------------------------------------------------
    Set to TRUE for frontend development/testing (bypasses all backend API calls).
    Set to FALSE for deployment to production (requires a working backend).
    ===================================================== */
const IS_MOCK_ENABLED = true; 

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
    MOCK TESTING UTILITIES (Conditional)
    -----------------------------------------------------
    These utilities are only active when IS_MOCK_ENABLED is true.
    ===================================================== */
const MOCK_USER_FARMER = {
    name: 'Test Farmer (Mock Btn)',
    mobile: '9876543210',
    village: 'Mock Village',
    mandal: 'Mock Mandal',
    district: 'Mock District',
    role: 'farmer'
};

/**
 * Mocks the login using the dedicated Mock Login Button.
 */
function mockLogin(mockUser) {
    APP.user = mockUser;

    hide('auth-section');
    show('dashboard-section');
    loadDashboardStats();

    document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
    document.querySelector('[data-section="dashboard-section"]')?.classList.add('active');

    console.log(`Successfully logged in mock user via button: ${APP.user.name}`);
}

// Global button handler for the mock login (Only active in mock mode)
if (IS_MOCK_ENABLED) {
    el('mock-login-btn')?.addEventListener('click', () => {
        mockLogin(MOCK_USER_FARMER);
    });
}

// Global button handler for logout (Always available, but should be tied to a backend call if IS_MOCK_ENABLED is false)
el('logout-btn')?.addEventListener('click', () => {
    // In a real scenario, an API call to /api/logout would occur here.
    
    APP.user = null;
    APP.cattle = null;

    SECTIONS.forEach(s => hide(s));
    show('auth-section');

    // Reset tabs and messages
    el('tab-register')?.classList.add('active');
    el('tab-login')?.classList.remove('active');
    show('register-card');
    hide('login-card');
    hide('otp-mini');
    clearMsg('user-messages');
    clearMsg('login-messages');

    // De-highlight all menu items
    document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));

    console.log("Logged out.");
});


/* =====================================================
    SECTION DEFINITIONS & INITIALIZATION
===================================================== */
const SECTIONS = [
    'auth-section',
    'dashboard-section',
    'profile-section',
    'predictor-section',
    'farmers-section',
    'estrous-section',
    'bot-section',
    'remedies-section',
    'viewer-section',
    'locations-section',
    'count-section',
    'podcast-section'
];

const MOCK_OTP = "123456"; 

document.addEventListener('DOMContentLoaded', () => {
    SECTIONS.forEach(s => hide(s));
    show('auth-section');

    if (el('tab-register')) {
        el('tab-register').classList.add('active');
    }
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

    document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');

    SECTIONS.forEach(s => hide(s));

    if (sectionId && APP.user) {
        show(sectionId);

        if (sectionId === 'dashboard-section') {
            loadDashboardStats();
        } else if (sectionId === 'profile-section') {
            loadProfileData();
        } else if (sectionId === 'predictor-section') {
            setStep(1);
        } else if (sectionId === 'farmers-section') {
             loadFarmersList();
        } else if (sectionId === 'estrous-section') {
             initializeEstrousMonitoring();
        } else if (sectionId === 'bot-section') {
             initializeAvrBot();
        } else if (sectionId === 'remedies-section') {
             loadRemediesList();
        } else if (sectionId === 'viewer-section') {
             initializeViewer();
        } else if (sectionId === 'locations-section') {
             loadLocationsData();
        } else if (sectionId === 'count-section') {
             loadCountData();
        } else if (sectionId === 'podcast-section') {
             loadPodcastData();
        }
        return;
    }

    if (!APP.user && sectionId) {
        alert('Please Login/Register first.');
        show('auth-section');
        document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
    } else if (!sectionId) {
        show('dashboard-section');
        document.querySelector('[data-section="dashboard-section"]')?.classList.add('active');
    }
});


/* =====================================================
    AUTH FLOW (Conditional API Integration)
===================================================== */

// --- Tab Switching ---
el('tab-register')?.addEventListener('click', () => {
    el('tab-register').classList.add('active');
    el('tab-login')?.classList.remove('active');
    show('register-card');
    hide('login-card');
    hide('otp-mini');
    clearMsg('user-messages');
    clearMsg('login-messages');
});

el('tab-login')?.addEventListener('click', () => {
    el('tab-login').classList.add('active');
    el('tab-register')?.classList.remove('active');
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
    
    // Basic Client-Side Validation
    if (!data.mobile.trim() || (isRegister && !data.name.trim())) {
         msg(messageId, 'Name and Mobile number are required.', 'error');
         return;
    }

    if (IS_MOCK_ENABLED) {
        // MOCK LOGIC: Immediately show OTP field and success message
        show('otp-mini');
        msg('otp-messages', `OTP sent successfully to ${mobile}. (Use MOCK OTP: ${MOCK_OTP})`, 'success');
        return;
    }

    // REAL API LOGIC
    try {
        const response = await fetch('/api/submit_user_info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await response.json();

        if (response.ok) {
            show('otp-mini');
            msg('otp-messages', `${result.message}`, 'success');
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

    if (IS_MOCK_ENABLED) {
        // MOCK LOGIC: Bypass API call, validate against MOCK_OTP, and set APP.user from form fields
        if (otp !== MOCK_OTP) {
            msg('otp-messages', 'Invalid OTP. Please use the mock code: ' + MOCK_OTP, 'error');
            return;
        }

        let isLoggingIn = !el('login-card')?.classList.contains('hidden');
        let mobile, name, village, mandal, district;

        if (!isLoggingIn) { // Registration tab is active
            mobile = el('mobile')?.value || 'N/A';
            name = el('name')?.value || 'Mock User (Reg)';
            village = el('village')?.value || 'Mock Village';
            mandal = el('mandal')?.value || 'Mock Mandal';
            district = el('district')?.value || 'Mock District';
        } else { // Login tab is active
            mobile = el('login-mobile')?.value || 'N/A';
            name = 'Login User';
            village = 'Login Village';
            mandal = 'Login Mandal';
            district = 'Login District';
        }
        
        // Simulate network delay for effect
        msg('otp-messages', 'Verifying OTP (Mock)...', 'default');
        await new Promise(resolve => setTimeout(resolve, 500));

        APP.user = { name, mobile, village, mandal, district, role: 'farmer' };

        msg('otp-messages', 'Verification successful (Mock)!', 'success');

    } else {
        // REAL API LOGIC
        try {
            const response = await fetch('/api/verify_otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ otp })
            });
            const result = await response.json();

            if (response.ok) {
                // Backend is responsible for setting session and returning user data if needed
                // Assuming the backend handles setting APP.user (or equivalent session logic)
                msg('otp-messages', 'Verification successful!', 'success');
            } else {
                msg('otp-messages', result.error || 'Verification failed.', 'error');
                return; // Exit if verification failed
            }
        } catch (e) {
            msg('otp-messages', 'Network error. Could not verify OTP.', 'error');
            return; // Exit on network error
        }
    }

    // Common navigation logic (runs after success in both mock and real modes)
    hide('auth-section');
    show('dashboard-section');
    loadDashboardStats();

    document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
    document.querySelector('[data-section="dashboard-section"]')?.classList.add('active');
});

el('resend-otp')?.addEventListener('click', async () => {
    clearMsg('otp-messages');

    if (IS_MOCK_ENABLED) {
        msg('otp-messages', `OTP resent successfully. (Use MOCK OTP: ${MOCK_OTP})`, 'success');
        return;
    }

    // REAL API LOGIC
    try {
        const response = await fetch('/api/resend_otp', { method: 'POST' });
        const result = await response.json();

        if (response.ok) {
            msg('otp-messages', `${result.message}`, 'success');
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
    PREDICTOR FLOW (Conditional API Integration)
===================================================== */
function setStep(step) {
    [1, 2, 3].forEach(i => {
        el(`step-${i}`)?.classList.toggle('active', i <= step);
    });
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

// --- Combined Submission: Save Cattle + Run Prediction ---
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

    if (IS_MOCK_ENABLED) {
        // MOCK LOGIC
        try {
            // Mock Save Cattle Details
            APP.cattle = { id: cattleId, gender: gender, age: age };
            msg('cattle-details-messages', 'Cattle details saved successfully (Mock).', 'success');

            // Mock Run Prediction
            setStep(2);
            msg('prediction-messages', 'Running prediction (Mock)...', 'default');

            const mockConfidence = Math.random() * 50 + 50; 
            const mockResult = {
                predicted_label: mockConfidence > 75 ? 'Diseased' : 'Healthy',
                confidence: mockConfidence
            };

            await new Promise(resolve => setTimeout(resolve, 1500));

            msg('prediction-messages', 'Prediction complete (Mock)!', 'success');
            displayResult(diseaseType, mockResult.predicted_label, mockResult.confidence);
            setStep(3);
        } catch (e) {
            msg('prediction-messages', 'Front-end error during submission mock.', 'error');
            setStep(1);
        }
        return;
    }

    // REAL API LOGIC
    try {
        // 2. Save Cattle Details (API Call)
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

        const name = APP.user.name || 'U';
        el('profile-avatar').textContent = name.charAt(0).toUpperCase();

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

el('save-profile')?.addEventListener('click', async () => {
    const updatedData = {
        name: el('prof-name-input').value,
        village: el('prof-village-input').value,
        mandal: el('prof-mandal-input').value,
        district: el('prof-district-input').value
    };

    if (IS_MOCK_ENABLED) {
        // MOCK: Update APP state immediately
        Object.assign(APP.user, updatedData);
        alert('Profile updated successfully (Mock)!');
    } else {
        // REAL: Send update to API
        try {
            const response = await fetch('/api/update_profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedData)
            });
            const result = await response.json();

            if (response.ok) {
                Object.assign(APP.user, updatedData); // Update local state on success
                alert('Profile updated successfully!');
            } else {
                alert(result.error || 'Failed to update profile.');
            }
        } catch (e) {
            alert('Network error during profile update.');
        }
    }

    // Revert state
    const name = APP.user.name || 'U';
    el('profile-avatar').textContent = name.charAt(0).toUpperCase();
    toggleProfileInputs(true);
    hide('save-profile');
    show('edit-profile');
});

el('back-to-dash')?.addEventListener('click', () => {
    hide('profile-section');
    show('dashboard-section');
    loadDashboardStats();

    document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
    document.querySelector('[data-section="dashboard-section"]')?.classList.add('active');
});

/* =====================================================
    NEW SECTION INITIALIZATION FUNCTIONS
    (These are placeholders, assume API calls needed if IS_MOCK_ENABLED is false)
    =====================================================
*/
function loadFarmersList() {
    const farmersSection = el('farmers-section');
    if (!farmersSection) return;

    // Example of conditional data loading
    let dataMessage = "Loading farmer data from API...";
    if (IS_MOCK_ENABLED) {
        dataMessage = "Using mock farmer data (Test Farmer, Farmer B, Farmer C).";
    }

    farmersSection.innerHTML = `
        <h2 class="section-title">👨‍🌾 Registered Farmers</h2>
        <p class="section-subtitle">Displaying a list of all registered farmers and their details.</p>
        <div class="card p-3">
            <p><strong>Mock Status:</strong> ${dataMessage}</p>
            <ul>
                <li>${APP.user?.name || 'User 1'} - ${APP.user?.village || 'Village A'} (${APP.user?.mobile || '1234...'})</li>
                <li>Farmer B - Village C (9988...)</li>
                <li>Farmer C - Village D (7766...)</li>
            </ul>
        </div>
    `;
    console.log("Registered Farmers section initialized.");
}

function initializeEstrousMonitoring() {
    const estrousSection = el('estrous-section');
    if (!estrousSection) return;

    estrousSection.innerHTML = `
        <h2 class="section-title">🌡️ Estrous Monitoring</h2>
        <p class="section-subtitle">Tools and data to monitor cattle heat cycles and optimize breeding.</p>
        <div class="card p-3">
            <p><strong>Feature Placeholder:</strong> This section will show a calendar/timeline for projected estrous cycles. ${IS_MOCK_ENABLED ? '(Mock Data)' : '(Live Data)'}</p>
            <p class="text-muted">Currently in development...</p>
        </div>
    `;
    console.log("Estrous Monitoring section initialized.");
}

function initializeAvrBot() {
    const botSection = el('bot-section');
    if (!botSection) return;

    botSection.innerHTML = `
        <h2 class="section-title">💬 AVR Bot - Chat Assistant</h2>
        <p class="section-subtitle">Your AI companion for quick answers on cattle health and farming practices.</p>
        <div class="card p-3" style="height: 300px; overflow-y: scroll; border: 1px solid var(--border-color);">
            <p><strong>Bot:</strong> Hello, ${APP.user?.name || 'User'}! How can I assist you with your cattle today? ${IS_MOCK_ENABLED ? '(Mock Chat)' : '(Live Chat)'}</p>
            <p style="text-align: right; color: var(--success-green);"><strong>You:</strong> What are the signs of Foot-and-Mouth Disease?</p>
            <p><strong>Bot:</strong> The main signs include high fever, blistering lesions in the mouth and on the feet, and excessive drooling. Immediate isolation is crucial.</p>
        </div>
    `;
    console.log("AVR Bot section initialized.");
}

function loadRemediesList() {
    const remediesSection = el('remedies-section');
    if (!remediesSection) return;

    remediesSection.innerHTML = `
        <h2 class="section-title">🌿 Traditional Remedies</h2>
        <p class="section-subtitle">A database of verified local and traditional remedies for common ailments.</p>
        <div class="card p-3">
            <p><strong>Remedy 1 (Mastitis):</strong> Turmeric paste with Neem oil application.</p>
            <p><strong>Remedy 2 (Bloat):</strong> Drenching with a mixture of ginger, garlic, and jaggery.</p>
            <p class="text-muted">Always consult a veterinarian before administering any remedy.</p>
        </div>
    `;
    console.log("Traditional Remedies section initialized.");
}

function initializeViewer() {
    const viewerSection = el('viewer-section');
    if (!viewerSection) return;

    viewerSection.innerHTML = `
        <h2 class="section-title">👁️ Image Viewer & History</h2>
        <p class="section-subtitle">Review all your past uploaded images and prediction results.</p>
        <div class="card p-3">
            <p><strong>History Placeholder:</strong> Displays a list of recent predictions. ${IS_MOCK_ENABLED ? '(Mock History)' : '(Live History)'}</p>
            <ul>
                <li>Cattle ID: 001 - FMD (Negative) - 10/Dec</li>
                <li>Cattle ID: 002 - Lumpy Skin (Positive) - 09/Dec</li>
                <li>Cattle ID: ${APP.cattle?.id || '003'} - Disease: ${APP.cattle ? 'Last Prediction' : 'N/A'} - ${new Date().toLocaleDateString()}</li>
            </ul>
        </div>
    `;
    console.log("Image Viewer section initialized.");
}

function loadLocationsData() {
    const locSection = el('locations-section');
    if (locSection) locSection.innerHTML = `
        <h2 class="section-title">📍 Locations</h2>
        <p class="section-subtitle">Mapping of cattle/farms.</p>
        <div class="card p-3">
            <p>Geolocation feature placeholder. ${IS_MOCK_ENABLED ? '(Mock Map)' : '(Live Map)'}</p>
        </div>
    `;
    console.log("Locations section initialized.");
}

function loadCountData() {
    const countSection = el('count-section');
    if (countSection) countSection.innerHTML = `
        <h2 class="section-title">🔢 Cattle Count</h2>
        <p class="section-subtitle">Manual and automated cattle counting tools.</p>
        <div class="card p-3">
            <p>Computer Vision Counting interface placeholder. ${IS_MOCK_ENABLED ? '(Mock Count)' : '(Live Count)'}</p>
        </div>
    `;
    console.log("Count section initialized.");
}

function loadPodcastData() {
    const podcastSection = el('podcast-section');
    if (podcastSection) podcastSection.innerHTML = `
        <h2 class="section-title">🎙️ Educational Podcasts</h2>
        <p class="section-subtitle">Audio content for farmer education.</p>
        <div class="card p-3">
            <p>Podcast list and player placeholder. ${IS_MOCK_ENABLED ? '(Mock Podcasts)' : '(Live Podcasts)'}</p>
        </div>
    `;
    console.log("Podcast section initialized.");
}