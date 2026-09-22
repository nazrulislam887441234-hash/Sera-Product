import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    verifyPasswordResetCode, 
    confirmPasswordReset, 
    applyActionCode 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// --- FIREBASE CONFIGURATION ---
// Replace values below with your specific production Firebase project configurations.
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

// DOM Elements & States
const stateLoading = document.getElementById('stateLoading');
const stateResetPassword = document.getElementById('stateResetPassword');
const stateVerifyEmail = document.getElementById('stateVerifyEmail');
const stateSuccess = document.getElementById('stateSuccess');
const stateError = document.getElementById('stateError');

const resetEmailText = document.getElementById('resetEmailText');
const resetPasswordForm = document.getElementById('resetPasswordForm');
const newPasswordInput = document.getElementById('newPassword');
const confirmPasswordInput = document.getElementById('confirmPassword');
const formError = document.getElementById('formError');
const resetSubmitBtn = document.getElementById('resetSubmitBtn');

const successTitle = document.getElementById('successTitle');
const successDesc = document.getElementById('successDesc');
const successContinueBtn = document.getElementById('successContinueBtn');
const verifyContinueBtn = document.getElementById('verifyContinueBtn');
const errorTitle = document.getElementById('errorTitle');
const errorDesc = document.getElementById('errorDesc');

// URL Parameter Handling
const urlParams = new URLSearchParams(window.location.search);
const mode = urlParams.get("mode");
const actionCode = urlParams.get("oobCode");
const continueUrl = urlParams.get("continueUrl");

// Safe Redirect Utility (Open Redirect Protection)
function getSafeRedirectUrl(targetUrl) {
    if (!targetUrl) return "https://seraproduct.com";
    try {
        const parsed = new URL(targetUrl);
        if (parsed.hostname === "seraproduct.com" || parsed.hostname.endsWith(".seraproduct.com")) {
            return targetUrl;
        }
    } catch (e) {
        // Invalid URL format fallback
    }
    return "https://seraproduct.com";
}

const safeContinueUrl = getSafeRedirectUrl(continueUrl);
successContinueBtn.href = safeContinueUrl;
verifyContinueBtn.href = safeContinueUrl;

// UI Switcher Helpers
function showState(stateElement) {
    [stateLoading, stateResetPassword, stateVerifyEmail, stateSuccess, stateError].forEach(el => {
        el.style.display = 'none';
    });
    stateElement.style.display = 'flex';
}

function displayError(title, description) {
    errorTitle.textContent = title;
    errorDesc.textContent = description;
    showState(stateError);
}

// Friendly Firebase Error Mapper
function getFriendlyErrorMessage(errorCode) {
    switch (errorCode) {
        case 'auth/expired-action-code':
            return "This authentication link has expired. Please request a new link.";
        case 'auth/invalid-action-code':
            return "This authentication link is invalid or has already been used.";
        case 'auth/user-disabled':
            return "This user account has been disabled.";
        case 'auth/user-not-found':
            return "No user account was found matching this request.";
        case 'auth/weak-password':
            return "The password is too weak. Please choose a stronger password.";
        case 'auth/too-many-requests':
            return "Too many requests. Please try again later.";
        default:
            return "Something went wrong. Please try again or request a new link.";
    }
}

// Main Initializer Action Switcher
async function init() {
    if (!mode || !actionCode) {
        displayError("Invalid Authentication Link", "This link is missing required parameters or may no longer be valid.");
        return;
    }

    if (mode === "resetPassword") {
        try {
            // Verify code and extract user's email securely from Firebase
            const email = await verifyPasswordResetCode(auth, actionCode);
            resetEmailText.textContent = email;
            showState(stateResetPassword);
        } catch (error) {
            displayError("Link Expired or Invalid", getFriendlyErrorMessage(error.code));
        }
    } else if (mode === "verifyEmail") {
        try {
            await applyActionCode(auth, actionCode);
            showState(stateVerifyEmail);
        } catch (error) {
            displayError("Verification Failed", getFriendlyErrorMessage(error.code));
        }
    } else {
        displayError("Unknown Action", "The specified action mode is not recognized.");
    }
}

// Password Visibility Toggles
document.querySelectorAll('.toggle-password').forEach(button => {
    button.addEventListener('click', () => {
        const input = button.parentElement.querySelector('input');
        const eyeOpen = button.querySelector('.eye-open');
        const eyeClosed = button.querySelector('.eye-closed');
        
        if (input.type === 'password') {
            input.type = 'text';
            eyeOpen.style.display = 'none';
            eyeClosed.style.display = 'block';
        } else {
            input.type = 'password';
            eyeOpen.style.display = 'block';
            eyeClosed.style.display = 'none';
        }
    });
});

// Password Strength Validation Logic
newPasswordInput.addEventListener('input', () => {
    const val = newPasswordInput.value;
    const bar1 = document.getElementById('bar1');
    const bar2 = document.getElementById('bar2');
    const bar3 = document.getElementById('bar3');
    const strengthText = document.getElementById('strengthText');

    let strengthScore = 0;
    if (val.length >= 8) strengthScore++;
    if (/[A-Z]/.test(val) && /[0-9]/.test(val)) strengthScore++;
    if (/[^A-Za-z0-9]/.test(val)) strengthScore++;

    // Reset indicator bars
    bar1.style.backgroundColor = 'var(--border)';
    bar2.style.backgroundColor = 'var(--border)';
    bar3.style.backgroundColor = 'var(--border)';

    if (val.length === 0) {
        strengthText.textContent = "Password strength";
        return;
    }

    if (val.length < 8) {
        strengthText.textContent = "Too short (min 8 chars)";
        bar1.style.backgroundColor = 'var(--error)';
        return;
    }

    if (strengthScore === 1) {
        strengthText.textContent = "Weak";
        bar1.style.backgroundColor = '#F59E0B';
    } else if (strengthScore === 2) {
        strengthText.textContent = "Medium";
        bar1.style.backgroundColor = '#F59E0B';
        bar2.style.backgroundColor = '#F59E0B';
    } else {
        strengthText.textContent = "Strong";
        bar1.style.backgroundColor = 'var(--success)';
        bar2.style.backgroundColor = 'var(--success)';
        bar3.style.backgroundColor = 'var(--success)';
    }
});

// Password Reset Form Submit Event Handler
resetPasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    formError.style.display = 'none';

    const newPassword = newPasswordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    if (newPassword.length < 8) {
        formError.textContent = "Password must be at least 8 characters long.";
        formError.style.display = 'block';
        return;
    }

    if (newPassword !== confirmPassword) {
        formError.textContent = "Passwords do not match.";
        formError.style.display = 'block';
        return;
    }

    // Disable UI & Show Submitting State
    resetSubmitBtn.disabled = true;
    resetSubmitBtn.textContent = "Updating Password...";

    try {
        await confirmPasswordReset(auth, actionCode, newPassword);
        successTitle.textContent = "Password Updated Successfully";
        successDesc.textContent = "Your SeraProduct account password has been changed successfully. You can now sign in using your new password.";
        showState(stateSuccess);
    } catch (error) {
        resetSubmitBtn.disabled = false;
        resetSubmitBtn.textContent = "Set New Password";
        formError.textContent = getFriendlyErrorMessage(error.code);
        formError.style.display = 'block';
    }
});

// Run Initial Check on Load
window.addEventListener('DOMContentLoaded', init);
