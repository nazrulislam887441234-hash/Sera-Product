// Firebase SDK Modular imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    sendPasswordResetEmail, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    getDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ==========================================
// FIREBASE CONFIGURATION (Placeholder)
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyBRSt2aoSJ-lumYAWGAXE6ncui7__TqJ4E",
  authDomain: "sera-product.firebaseapp.com",
  projectId: "sera-product",
  storageBucket: "sera-product.firebasestorage.app",
  messagingSenderId: "516762224598",
  appId: "1:516762224598:web:b6a571f355a8a4a97c0677",
  measurementId: "G-RLMWH43FXX"
};
// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM Elements
const loginForm = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('login-btn');
const btnText = loginBtn.querySelector('.btn-text');
const loader = loginBtn.querySelector('.loader');
const togglePasswordBtn = document.getElementById('toggle-password');
const eyeIcon = document.getElementById('eye-icon');
const forgotPasswordBtn = document.getElementById('forgot-password-btn');

// Modal Elements
const modalOverlay = document.getElementById('custom-modal');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');
const modalHeaderBg = document.getElementById('modal-header-bg');
const modalIcon = document.getElementById('modal-icon');
const modalCloseX = document.getElementById('modal-close-x');
const modalOkBtn = document.getElementById('modal-ok-btn');
const modalDynamicArea = document.getElementById('modal-dynamic-area');
const modalDetailsContainer = document.getElementById('modal-details-container');
const modalDetails = document.getElementById('modal-details');
const modalFooterActions = document.getElementById('modal-footer-actions');

// SVG Icons for Modal Types
const icons = {
    error: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>',
    success: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>',
    info: '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>',
    loading: '<path d="M21 12a9 9 0 1 1-6.219-8.56"></path>'
};

// ==========================================
// REUSABLE CUSTOM MODAL SYSTEM
// ==========================================
function showModal({ title, message, type = 'error', technicalError = null, customContent = '', showFooter = true }) {
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    modalDynamicArea.innerHTML = customContent;

    // Set Header Colors and Icons based on Type
    if (type === 'error') {
        modalHeaderBg.style.backgroundColor = 'var(--error-color)';
        modalIcon.innerHTML = icons.error;
    } else if (type === 'success') {
        modalHeaderBg.style.backgroundColor = 'var(--success-color)';
        modalIcon.innerHTML = icons.success;
    } else if (type === 'loading') {
        modalHeaderBg.style.backgroundColor = 'var(--primary-orange)';
        modalIcon.innerHTML = icons.loading;
        modalIcon.style.animation = 'spin 1s linear infinite';
    } else {
        modalHeaderBg.style.backgroundColor = 'var(--info-color)';
        modalIcon.innerHTML = icons.info;
    }

    if (type !== 'loading') {
        modalIcon.style.animation = 'none';
    }

    // Technical Error Details
    if (technicalError) {
        modalDetailsContainer.classList.remove('hidden');
        modalDetails.textContent = technicalError.toString();
    } else {
        modalDetailsContainer.classList.add('hidden');
        modalDetails.textContent = '';
    }

    // Footer buttons handling
    if (showFooter) {
        modalFooterActions.classList.remove('hidden');
    } else {
        modalFooterActions.classList.add('hidden');
    }

    modalOverlay.classList.remove('hidden');
}

function closeModal() {
    modalOverlay.classList.add('hidden');
    modalDynamicArea.innerHTML = '';
}

modalCloseX.addEventListener('click', closeModal);
modalOkBtn.addEventListener('click', closeModal);

// Close modal on ESC key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modalOverlay.classList.contains('hidden')) {
        closeModal();
    }
});

// ==========================================
// PASSWORD VISIBILITY TOGGLE
// ==========================================
togglePasswordBtn.addEventListener('click', () => {
    const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordInput.setAttribute('type', type);
    
    if (type === 'text') {
        eyeIcon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
    } else {
        eyeIcon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
    }
});

// ==========================================
// AUTH STATE & REDIRECT FLOW
// ==========================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        await checkResellerAndRedirect(user.uid);
    }
});

async function checkResellerAndRedirect(uid) {
    try {
        const docRef = doc(db, "reseller", uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            window.location.replace('https://seraproduct.com/reseller/dashboard');
        } else {
            window.location.replace('https://seraproduct.com/reseller/next-signup.html');
        }
    } catch (error) {
        console.error("Reseller doc check error:", error);
        showModal({
            title: "ডাটাবেস ত্রুটি",
            message: "রিসেলার একাউন্ট তথ্য যাচাই করতে সমস্যা হয়েছে।",
            type: "error",
            technicalError: error
        });
    }
}

// ==========================================
// LOGIN SUBMIT LOGIC
// ==========================================
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
        showModal({
            title: "সতর্কতা",
            message: "অনুগ্রহ করে ইমেইল এবং পাসওয়ার্ড উভয়ই পূরণ করুন।",
            type: "error"
        });
        return;
    }

    setLoading(true);

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const uid = userCredential.user.uid;
        await checkResellerAndRedirect(uid);
    } catch (error) {
        console.error("Login Error code:", error.code);
        setLoading(false);
        
        let customMsg = "একটি অজানা সমস্যা হয়েছে। দয়া করে আবার চেষ্টা করুন।";
        
        if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found') {
            customMsg = "ইমেইল অথবা পাসওয়ার্ড সঠিক নয়। আপনার তথ্য যাচাই করে আবার চেষ্টা করুন।";
        } else if (error.code === 'auth/invalid-email') {
            customMsg = "সঠিক ইমেইল এড্রেস দিন।";
        } else if (error.code === 'auth/too-many-requests') {
            customMsg = "অনেকবার চেষ্টা করা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।";
        } else if (error.code === 'auth/network-request-failed') {
            customMsg = "ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।";
        }

        showModal({
            title: "লগিন ব্যর্থ হয়েছে",
            message: customMsg,
            type: "error",
            technicalError: error
        });
    }
});

function setLoading(isLoading) {
    loginBtn.disabled = isLoading;
    if (isLoading) {
        btnText.textContent = "লগিন হচ্ছে...";
        loader.classList.remove('hidden');
    } else {
        btnText.textContent = "লগিন করুন";
        loader.classList.add('hidden');
    }
}

// ==========================================
// FORGOT PASSWORD POPUP & FLOW
// ==========================================
forgotPasswordBtn.addEventListener('click', () => {
    const formHtml = `
        <form id="reset-form">
            <div class="form-group" style="margin-bottom: 15px;">
                <label for="reset-email">ইমেইল এড্রেস</label>
                <input type="email" id="reset-email" placeholder="আপনার একাউন্টের ইমেইল লিখুন" required style="width:100%; padding: 10px 12px; border: 1px solid var(--border-color); border-radius: 6px; font-size: 1rem;">
            </div>
            <div style="display: flex; gap: 10px; margin-top: 20px;">
                <button type="button" class="secondary-btn" id="reset-cancel-btn" style="flex:1;">বাতিল</button>
                <button type="submit" class="primary-btn" id="reset-submit-btn" style="flex:1;">রিসেট লিংক পাঠান</button>
            </div>
        </form>
    `;

    showModal({
        title: "পাসওয়ার্ড রিসেট করুন",
        message: "আপনার নিবন্ধিত ইমেইল এড্রেসটি নিচে প্রদান করুন:",
        type: "info",
        customContent: formHtml,
        showFooter: false
    });

    // Handle Reset Form Actions inside Modal
    document.getElementById('reset-cancel-btn').addEventListener('click', closeModal);
    
    document.getElementById('reset-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const resetEmail = document.getElementById('reset-email').value.trim();
        
        if (!resetEmail) {
            return;
        }

        const submitBtn = document.getElementById('reset-submit-btn');
        submitBtn.disabled = true;
        submitBtn.textContent = "পাঠানো হচ্ছে...";

        try {
            await sendPasswordResetEmail(auth, resetEmail);
            
            showModal({
                title: "সফল",
                message: "আপনার ইমেইলে একটি লিংক পাঠানো হয়েছে! Inbox অথবা Spam ফোল্ডার চেক করুন। এবং ক্লিক করে নতুন পাসওয়ার্ড তৈরি করুন।",
                type: "success"
            });
        } catch (error) {
            console.error("Reset Error:", error);
            let resetErrText = "পাসওয়ার্ড রিসেট লিংক পাঠাতে সমস্যা হয়েছে।";
            
            if (error.code === 'auth/user-not-found') {
                resetErrText = "এই ইমেইল দিয়ে কোনো একাউন্ট পাওয়া যায়নি।";
            } else if (error.code === 'auth/invalid-email') {
                resetErrText = "সঠিক ইমেইল এড্রেস দিন।";
            } else if (error.code === 'auth/too-many-requests') {
                resetErrText = "অনেকবার চেষ্টা করা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।";
            } else if (error.code === 'auth/network-request-failed') {
                resetErrText = "ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।";
            }

            showModal({
                title: "ত্রুটি",
                message: resetErrText,
                type: "error",
                technicalError: error
            });
        }
    });
});
// ================================
// Sera Product Footer Loader
// ================================
async function loadFooter() {
    const footerContainer = document.getElementById("footer-container");

    if (!footerContainer) return;

    try {
        const response = await fetch("https://seraproduct.com/footer", {
            method: "GET",
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error(`Footer request failed: ${response.status}`);
        }

        const footerHTML = await response.text();

        if (!footerHTML.trim()) {
            throw new Error("Footer content is empty.");
        }

        footerContainer.innerHTML = footerHTML;

    } catch (error) {
        console.error("Footer loading error:", error);

        footerContainer.innerHTML = `
            <div style="
                padding:20px;
                text-align:center;
                color:#777;
                font-size:14px;
            ">
                Footer লোড করা যায়নি।
            </div>
        `;
    }
}

loadFooter();
