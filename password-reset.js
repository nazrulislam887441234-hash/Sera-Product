// Firebase SDK Modular imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    sendPasswordResetEmail 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

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

// DOM Elements
const resetForm = document.getElementById('reset-form');
const emailInput = document.getElementById('email');
const submitBtn = document.getElementById('submit-btn');
const btnIcon = submitBtn.querySelector('.btn-icon');
const btnText = submitBtn.querySelector('.btn-text');
const loader = submitBtn.querySelector('.loader');

// Modal Elements
const modalOverlay = document.getElementById('custom-modal');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');
const modalHeaderBg = document.getElementById('modal-header-bg');
const modalIcon = document.getElementById('modal-icon');
const modalCloseX = document.getElementById('modal-close-x');
const modalOkBtn = document.getElementById('modal-ok-btn');
const modalDetailsContainer = document.getElementById('modal-details-container');
const modalDetails = document.getElementById('modal-details');

// SVG Icons for Modal Types
const modalIcons = {
    error: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>',
    success: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>',
    loading: '<path d="M21 12a9 9 0 1 1-6.219-8.56"></path>'
};

// ==========================================
// REUSABLE CUSTOM MODAL SYSTEM
// ==========================================
function showModal({ title, message, type = 'error', technicalError = null }) {
    modalTitle.textContent = title;
    modalMessage.textContent = message;

    // Set Header Colors and Icons based on Type
    if (type === 'error') {
        modalHeaderBg.style.backgroundColor = 'var(--error-color)';
        modalIcon.innerHTML = modalIcons.error;
    } else if (type === 'success') {
        modalHeaderBg.style.backgroundColor = 'var(--success-color)';
        modalIcon.innerHTML = modalIcons.success;
    } else if (type === 'loading') {
        modalHeaderBg.style.backgroundColor = 'var(--primary-orange)';
        modalIcon.innerHTML = modalIcons.loading;
        modalIcon.style.animation = 'spin 1s linear infinite';
    } else {
        modalHeaderBg.style.backgroundColor = 'var(--info-color)';
        modalIcon.innerHTML = modalIcons.error;
    }

    if (type !== 'loading') {
        modalIcon.style.animation = 'none';
    }

    // Technical Error Details (Sanitized: No secrets or credentials)
    if (technicalError) {
        modalDetailsContainer.classList.remove('hidden');
        modalDetails.textContent = technicalError.toString();
    } else {
        modalDetailsContainer.classList.add('hidden');
        modalDetails.textContent = '';
    }

    modalOverlay.classList.remove('hidden');
}

function closeModal() {
    modalOverlay.classList.add('hidden');
}

modalCloseX.addEventListener('click', closeModal);
modalOkBtn.addEventListener('click', closeModal);

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modalOverlay.classList.contains('hidden')) {
        closeModal();
    }
});

// ==========================================
// FORM VALIDATION & SUBMIT HANDLER
// ==========================================
resetForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();

    // Step 1: Empty Validation
    if (!email) {
        showModal({
            title: "সতর্কতা",
            message: "ইমেইল এড্রেস লিখুন।",
            type: "error"
        });
        return;
    }

    // Step 2: Invalid Email Pattern Validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showModal({
            title: "সঠিক ইমেইল দিন",
            message: "সঠিক ইমেইল এড্রেস লিখুন।",
            type: "error"
        });
        return;
    }

    // Step 3 & 9: Loading State & Prevent Multiple Requests
    setLoading(true, "লিংক পাঠানো হচ্ছে...");

    try {
        // Step 4: Firebase Password Reset Call
        await sendPasswordResetEmail(auth, email);

        // Step 5: Success Popup
        setLoading(false);
        showModal({
            title: "সফল",
            message: "আপনার ইমেইলে একটি রিসেট লিংক পাঠানো হয়েছে!\n\nInbox অথবা Spam ফোল্ডার চেক করুন এবং ইমেইলে থাকা লিংকে ক্লিক করে নতুন পাসওয়ার্ড তৈরি করুন।",
            type: "success"
        });

        // Clear Email Input after successful submission
        emailInput.value = "";

    } catch (error) {
        console.error("Password Reset Error code:", error.code);
        setLoading(false);
        
        // Step 8: Firebase Error Handling in Bengali
        let customMsg = "পাসওয়ার্ড রিসেট লিংক পাঠানো যায়নি। কিছুক্ষণ পরে আবার চেষ্টা করুন।";
        
        if (error.code === 'auth/user-not-found') {
            customMsg = "এই ইমেইল দিয়ে কোনো অ্যাকাউন্ট পাওয়া যায়নি।";
        } else if (error.code === 'auth/invalid-email') {
            customMsg = "সঠিক ইমেইল এড্রেস লিখুন।";
        } else if (error.code === 'auth/too-many-requests') {
            customMsg = "অনেকবার চেষ্টা করা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।";
        } else if (error.code === 'auth/network-request-failed') {
            customMsg = "ইন্টারনেট সংযোগে সমস্যা হয়েছে। আপনার ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।";
        }

        showModal({
            title: "রিসেট ব্যর্থ হয়েছে",
            message: customMsg,
            type: "error",
            technicalError: error.message // Safe raw message without secrets
        });
    }
});

function setLoading(isLoading, text = "রিসেট লিংক পাঠান") {
    submitBtn.disabled = isLoading;
    if (isLoading) {
        btnIcon.classList.add('hidden');
        btnText.textContent = text;
        loader.classList.remove('hidden');
    } else {
        btnIcon.classList.remove('hidden');
        btnText.textContent = "রিসেট লিংক পাঠান";
        loader.classList.add('hidden');
    }
}

// ==========================================
// FOOTER DYNAMIC FETCH (Fetch API)
// ==========================================
async function loadFooter() {
    const footerContainer = document.getElementById('footer-container');
    try {
        const response = await fetch("https://seraproduct.com/footer");
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const footerHtml = await response.text();
        footerContainer.innerHTML = footerHtml;
    } catch (error) {
        console.warn("Footer load failed, displaying fallback:", error);
        // Fallback footer to ensure the page doesn't break
        footerContainer.innerHTML = `
            <footer style="background-color: #2d3748; color: #fff; text-align: center; padding: 20px; font-size: 0.9rem;">
                <p>&copy; 2026 Sera Product. সর্বস্বত্ব সংরক্ষিত।</p>
            </footer>
        `;
    }
}

// Load footer on window load
window.addEventListener('DOMContentLoaded', loadFooter);
