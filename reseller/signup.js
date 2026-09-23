// Firebase Configuration - আপনার প্রজেক্টের রিয়েল কনফিগ এখানে বসান
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
const form = document.getElementById('signup-form');
const btn = document.getElementById('submit-btn');
const btnText = btn.querySelector('.btn-text');
const loader = btn.querySelector('.loader');
const togglePassword = document.getElementById('toggle-password');
const passwordInput = document.getElementById('password');

// Modal Elements
const modal = document.getElementById('custom-modal');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');
const modalDetailsContainer = document.getElementById('modal-details-container');
const modalDetails = document.getElementById('modal-details');
const closeBtns = document.querySelectorAll('.close-modal, .close-modal-btn');

// Toggle Password Visibility
togglePassword.addEventListener('click', () => {
    const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordInput.setAttribute('type', type);
});

// Modal Logic
function showModal(title, message, isError = false, errorDetails = null) {
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    
    if (isError && errorDetails) {
        modalDetailsContainer.classList.remove('hidden');
        modalDetails.textContent = errorDetails.toString();
        modal.querySelector('.modal-header').style.backgroundColor = 'var(--error-color)';
    } else {
        modalDetailsContainer.classList.add('hidden');
        modal.querySelector('.modal-header').style.backgroundColor = isError ? 'var(--error-color)' : 'var(--primary-orange)';
    }
    
    modal.classList.remove('hidden');
}

closeBtns.forEach(btn => {
    btn.addEventListener('click', () => modal.classList.add('hidden'));
});

function setLoading(isLoading) {
    btn.disabled = isLoading;
    if (isLoading) {
        btnText.textContent = "অপেক্ষা করুন...";
        loader.classList.remove('hidden');
    } else {
        btnText.textContent = "চালিয়ে যান";
        loader.classList.add('hidden');
    }
}

// Handle Form Submit
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
        showModal("সতর্কতা", "ইমেইল এবং পাসওয়ার্ড অবশ্যই দিতে হবে।", true);
        return;
    }

    setLoading(true);

    try {
        let userCredential;
        try {
            // Attempt Sign In first
            userCredential = await signInWithEmailAndPassword(auth, email, password);
        } catch (signInError) {
            // If user doesn't exist, Create Account
            if (signInError.code === 'auth/user-not-found' || signInError.code === 'auth/invalid-credential') {
                try {
                    userCredential = await createUserWithEmailAndPassword(auth, email, password);
                } catch (signUpError) {
                    throw signUpError;
                }
            } else {
                throw signInError;
            }
        }

        const user = userCredential.user;
        
        // Check Firestore for existing reseller document
        const docRef = doc(db, "reseller", user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            // Document exists -> Dashboard
            window.location.href = '/dashboard';
        } else {
            // Document does NOT exist -> Next Signup Phase
            window.location.href = 'next-signup.html';
        }

    } catch (error) {
        console.error(error);
        let errorMsg = "একটি সমস্যা হয়েছে। দয়া করে আবার চেষ্টা করুন।";
        if (error.code === 'auth/email-already-in-use') errorMsg = "এই ইমেইল দিয়ে ইতোমধ্যে একাউন্ট আছে। সঠিক পাসওয়ার্ড দিয়ে লগইন করুন।";
        if (error.code === 'auth/weak-password') errorMsg = "পাসওয়ার্ডটি খুব দুর্বল। অন্তত ৬ অক্ষরের পাসওয়ার্ড দিন।";
        if (error.code === 'auth/network-request-failed') errorMsg = "ইন্টারনেট সংযোগ চেক করুন।";
        
        showModal("ত্রুটি (Error)", errorMsg, true, error);
        setLoading(false);
    }
});
