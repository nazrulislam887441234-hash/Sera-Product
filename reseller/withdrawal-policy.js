// Firebase Modular SDK Imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Firebase Configuration Placeholder
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
const loadingOverlay = document.getElementById('loading-overlay');
const mainContent = document.getElementById('main-content');
const customModal = document.getElementById('custom-modal');
const modalMessage = document.getElementById('modal-message');
const modalCloseBtn = document.getElementById('modal-close-btn');

/**
 * Show Custom Modal Popup
 * @param {string} msg 
 * @param {function} onClose 
 */
function showModal(msg, onClose = null) {
    modalMessage.textContent = msg;
    customModal.classList.remove('hidden');

    const handleClose = () => {
        customModal.classList.add('hidden');
        modalCloseBtn.removeEventListener('click', handleClose);
        if (typeof onClose === 'function') {
            onClose();
        }
    };

    modalCloseBtn.addEventListener('click', handleClose);
}

/**
 * Safely Load Dynamic Footer
 */
async function loadFooter() {
    try {
        const response = await fetch('https://seraproduct.com/footer');
        if (response.ok) {
            const footerHtml = await response.text();
            document.getElementById('footer-container').innerHTML = footerHtml;
        }
    } catch (error) {
        console.warn('Footer URL dynamic fetch error:', error);
        // Fail-safe: Policy page load won't crash if footer fails to load
    }
}

/**
 * Check User Auth and Reseller Document Existence
 */
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        // User not logged in -> Redirect to login page
        window.location.href = "https://seraproduct.com/reseller/login";
        return;
    }

    try {
        // Check only specific reseller/{uid} document
        const resellerRef = doc(db, "reseller", user.uid);
        const resellerSnap = await getDoc(resellerRef);

        if (!resellerSnap.exists()) {
            // Reseller document missing -> Popup -> Signout -> Redirect to login
            showModal("আপনার reseller তথ্য পাওয়া যায়নি!", async () => {
                await signOut(auth);
                window.location.href = "https://seraproduct.com/reseller/login";
            });
            return;
        }

        // If auth & reseller check pass successfully:
        // 1. Fetch Footer
        await loadFooter();

        // 2. Hide Loading Screen & Show Main Policy Content
        loadingOverlay.classList.add('hidden');
        mainContent.classList.remove('hidden');

    } catch (error) {
        console.error("Firestore document check error:", error);
        showModal("ত্রুটি ঘটেছে! অনুগ্রহ করে পুনরায় চেষ্টা করুন।", async () => {
            await signOut(auth);
            window.location.href = "https://seraproduct.com/reseller/login";
        });
    }
});
