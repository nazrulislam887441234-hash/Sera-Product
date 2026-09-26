import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    EmailAuthProvider, 
    reauthenticateWithCredential, 
    updatePassword, 
    signOut 
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    getDoc 
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// Firebase Configuration (প্লাসহোল্ডার)
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
const initialLoader = document.getElementById("initial-loader");
const passwordForm = document.getElementById("password-form");
const currentPasswordInput = document.getElementById("current-password");
const newPasswordInput = document.getElementById("new-password");
const confirmPasswordInput = document.getElementById("confirm-password");
const submitBtn = document.getElementById("submit-btn");
const errorAlert = document.getElementById("error-alert");

// Modal Elements
const customModal = document.getElementById("custom-modal");
const modalTitle = document.getElementById("modal-title");
const modalMessage = document.getElementById("modal-message");
const modalIconContainer = document.getElementById("modal-icon-container");
const modalActionBtn = document.getElementById("modal-action-btn");

// Hamburger Menu Elements
const hamburgerBtn = document.getElementById("hamburger-btn");
const mobileMenu = document.getElementById("mobile-menu");
const mobileLogoutBtn = document.getElementById("mobile-logout-btn");

let currentUser = null;
let currentResellerEmail = "";

// Load Footer dynamically via fetch
async function loadFooter() {
    const footerContainer = document.getElementById("footer-container");
    try {
        const response = await fetch("https://seraproduct.com/footer");
        if (!response.ok) throw new Error("Footer load failed");
        const footerHtml = await response.text();
        footerContainer.innerHTML = footerHtml;
    } catch (error) {
        footerContainer.innerHTML = `
            <footer style="background:#222; color:#fff; text-align:center; padding:20px; font-size:14px;">
                <p>&copy; 2026 Sera Product. সর্বস্বত্ব সংরক্ষিত।</p>
            </footer>
        `;
    }
}

// Custom Popup Display Function
function showModal(type, title, message, buttonText, onAction) {
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    modalActionBtn.textContent = buttonText;
    
    modalIconContainer.className = `modal-icon-container ${type}`;
    if (type === 'success') {
        modalIconContainer.innerHTML = `<svg viewBox="0 0 24 24" width="28" height="28" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    } else {
        modalIconContainer.innerHTML = `<svg viewBox="0 0 24 24" width="28" height="28" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
    }

    customModal.classList.remove("hidden");
    
    // Clear old event listeners by cloning button
    const newBtn = modalActionBtn.cloneNode(true);
    modalActionBtn.parentNode.replaceChild(newBtn, modalActionBtn);
    
    newBtn.addEventListener("click", () => {
        customModal.classList.add("hidden");
        if (onAction) onAction();
    });
}

// Show Error Alert in form
function showError(message) {
    errorAlert.textContent = message;
    errorAlert.classList.remove("hidden");
    errorAlert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideError() {
    errorAlert.textContent = "";
    errorAlert.classList.add("hidden");
}

// Authentication and Reseller Validation Check
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "https://seraproduct.com/reseller/login";
        return;
    }

    currentUser = user;
    currentResellerEmail = user.email;

    try {
        const resellerDocRef = doc(db, "reseller", user.uid);
        const resellerSnap = await getDoc(resellerDocRef);

        if (!resellerSnap.exists()) {
            showModal('error', 'অনুমতি অস্বীকৃত', 'আপনার রিসেলার তথ্য পাওয়া যায়নি!', 'লগইন পেজে যান', async () => {
                await signOut(auth);
                window.location.href = "https://seraproduct.com/reseller/login";
            });
            return;
        }

        // All checks passed, hide initial loader
        initialLoader.style.opacity = "0";
        setTimeout(() => initialLoader.remove(), 300);

    } catch (error) {
        showError("রিসেলার তথ্য যাচাই করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।");
        initialLoader.style.opacity = "0";
        setTimeout(() => initialLoader.remove(), 300);
    }
});

// Password Visibility Toggle with SVG Eye Icons
document.querySelectorAll(".toggle-password").forEach(button => {
    button.addEventListener("click", () => {
        const targetId = button.getAttribute("data-target");
        const input = document.getElementById(targetId);
        
        if (input.type === "password") {
            input.type = "text";
            button.innerHTML = `<svg class="eye-icon" viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;
        } else {
            input.type = "password";
            button.innerHTML = `<svg class="eye-icon" viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
        }
    });
});

// Hamburger Menu Toggle
hamburgerBtn.addEventListener("click", () => {
    mobileMenu.classList.toggle("show");
});

mobileLogoutBtn.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "https://seraproduct.com/reseller/login";
});

// Handle Password Change Form Submission
passwordForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError();

    const currentPass = currentPasswordInput.value;
    const newPass = newPasswordInput.value;
    const confirmPass = confirmPasswordInput.value;

    // Validation Rules
    if (!currentPass || !newPass || !confirmPass) {
        showError("সবগুলো তথ্য পূরণ করুন।");
        return;
    }

    if (newPass.length < 6) {
        showError("নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।");
        return;
    }

    if (newPass !== confirmPass) {
        showError("নতুন পাসওয়ার্ড এবং নিশ্চিত পাসওয়ার্ড মিলছে না।");
        return;
    }

    if (currentPass === newPass) {
        showError("বর্তমান এবং নতুন পাসওয়ার্ড একই হতে পারবে না।");
        return;
    }

    // Set Loading State on Button
    submitBtn.disabled = true;
    submitBtn.textContent = "পাসওয়ার্ড পরিবর্তন হচ্ছে...";

    try {
        // Re-authenticate user for security compliance
        const credential = EmailAuthProvider.credential(currentResellerEmail, currentPass);
        await reauthenticateWithCredential(currentUser, credential);

        // Update password in Firebase Auth
        await updatePassword(currentUser, newPass);

        // Success Popup & Redirect Action
        showModal(
            'success', 
            'পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে!', 
            'আপনার অ্যাকাউন্টের পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে।', 
            'ড্যাশবোর্ডে যান', 
            () => {
                window.location.href = "https://seraproduct.com/reseller/dashboard";
            }
        );

    } catch (error) {
        console.error("Password change error code:", error.code);
        let errorMsg = "পাসওয়ার্ড পরিবর্তন করা সম্ভব হয়নি। আবার চেষ্টা করুন।";

        if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential' || error.code === 'auth/invalid-email') {
            errorMsg = "বর্তমান পাসওয়ার্ড সঠিক নয়। পাসওয়ার্ড পরিবর্তন করা সম্ভব হয়নি। আবার চেষ্টা করুন।";
        } else if (error.code === 'auth/weak-password') {
            errorMsg = "নতুন পাসওয়ার্ডটি খুব দুর্বল। কমপক্ষে ৬ অক্ষরের শক্তিশালী পাসওয়ার্ড দিন।";
        } else if (error.code === 'auth/requires-recent-login') {
            errorMsg = "নিরাপত্তার জন্য পুনরায় লগইন করুন।";
        }

        showError(errorMsg);
        submitBtn.disabled = false;
        submitBtn.textContent = "পাসওয়ার্ড পরিবর্তন করুন";
    }
});

// Load Footer on Window Load
window.addEventListener("DOMContentLoaded", loadFooter);
