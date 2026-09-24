// Firebase SDK Modular imports from CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
const globalLoader = document.getElementById('global-loader');
const appContainer = document.getElementById('app-container');
const alertBox = document.getElementById('alert-box');
const alertMessage = document.getElementById('alert-message');

const generateSection = document.getElementById('generate-section');
const displaySection = document.getElementById('display-section');
const customCodeInput = document.getElementById('custom-code-input');
const generateBtn = document.getElementById('generate-btn');

const referralCodeText = document.getElementById('referral-code-text');
const referralLinkInput = document.getElementById('referral-link-input');
const copyBtn = document.getElementById('copy-btn');
const copyLinkBtn = document.getElementById('copy-link-btn');
const shareLinkBtn = document.getElementById('share-link-btn');

const toggleEditBtn = document.getElementById('toggle-edit-btn');
const updateSection = document.getElementById('update-section');
const newCodeInput = document.getElementById('new-code-input');
const updateBtn = document.getElementById('update-btn');
const footerContainer = document.getElementById('footer-container');

// State Variables
let currentUser = null;
let isProcessing = false;

// Utility: Show Alert Message in Bengali
function showAlert(message, type = 'error') {
    alertMessage.textContent = message;
    alertBox.className = `alert-box ${type}`;
    alertBox.classList.remove('hidden');
    
    // Auto hide success alerts after 5 seconds
    if (type === 'success') {
        setTimeout(() => {
            alertBox.classList.add('hidden');
        }, 5000);
    }
}

// Utility: Hide Alert
function hideAlert() {
    alertBox.classList.add('hidden');
}

// Check if Referral Code already exists in Firestore using 'code' field
async function checkCodeExists(code) {
    const q = query(collection(db, "referral_code"), where("code", "==", code));
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
}

// Utility: Validate allowed characters (a-z, A-Z, 0-9) and return invalid characters if any
function getInvalidCharacters(code) {
    const regex = /^[a-zA-Z0-9]+$/;
    if (regex.test(code)) {
        return [];
    }
    // Find all unique invalid characters
    const invalidChars = code.match(/[^a-zA-Z0-9]/g) || [];
    return [...new Set(invalidChars)];
}

// Dynamic Footer Loader from https://seraproduct.com/footer
async function loadFooter() {
    try {
        const response = await fetch('https://seraproduct.com/footer');
        if (response.ok) {
            const footerHtml = await response.text();
            footerContainer.innerHTML = footerHtml;
        } else {
            footerContainer.innerHTML = '<footer style="text-align:center; padding:20px; font-size:13px; color:#666;">&copy; Sera Product. All rights reserved.</footer>';
        }
    } catch (err) {
        console.error('Footer load error:', err);
        footerContainer.innerHTML = '<footer style="text-align:center; padding:20px; font-size:13px; color:#666;">&copy; Sera Product. All rights reserved.</footer>';
    }
}

// Initialize Authentication State Observer
onAuthStateChanged(auth, async (user) => {
    hideAlert();
    globalLoader.classList.remove('hidden');
    appContainer.classList.add('hidden');

    if (!user) {
        globalLoader.classList.add('hidden');
        showAlert("অনুগ্রহ করে প্রথমে লগইন করুন।", "error");
        return;
    }

    currentUser = user;

    try {
        const resellerRef = doc(db, "reseller", user.uid);
        const resellerSnap = await getDoc(resellerRef);

        if (!resellerSnap.exists()) {
            globalLoader.classList.add('hidden');
            showAlert("আপনার Reseller অ্যাকাউন্ট পাওয়া যায়নি।", "error");
            return;
        }

        const resellerData = resellerSnap.data();

        if (resellerData.active !== true) {
            globalLoader.classList.add('hidden');
            showAlert("আপনার অ্যাকাউন্ট বর্তমানে সক্রিয় নয়।", "error");
            return;
        }

        if (resellerData.verified !== true) {
            globalLoader.classList.add('hidden');
            showAlert("আপনার অ্যাকাউন্ট এখনো ভেরিফাইড নয়।", "error");
            return;
        }

        const referralRef = doc(db, "referral_code", user.uid);
        const referralSnap = await getDoc(referralRef);

        globalLoader.classList.add('hidden');
        appContainer.classList.remove('hidden');

        if (referralSnap.exists()) {
            const referralData = referralSnap.data();
            const code = referralData.code;
            referralCodeText.textContent = code;
            referralLinkInput.value = `https://seraproduct.com/reseller/signup?ref=${code}`;
            generateSection.classList.add('hidden');
            displaySection.classList.remove('hidden');
        } else {
            generateSection.classList.remove('hidden');
            displaySection.classList.add('hidden');
        }

    } catch (error) {
        console.error("Initialization Error:", error);
        globalLoader.classList.add('hidden');
        showAlert("তথ্য লোড করার সময় সমস্যা হয়েছে। আবার চেষ্টা করুন।", "error");
    }
});

// Handle Custom Referral Code Generation
generateBtn.addEventListener('click', async () => {
    const userCode = customCodeInput.value.trim().toUpperCase();

    if (!userCode || userCode.length < 3 || userCode.length > 15) {
        showAlert("অনুগ্রহ করে ৩ থেকে ১৫ অক্ষরের একটি বৈধ রেফার কোড দিন।", "error");
        return;
    }

    // Validate allowed characters (a-z, A-Z, 0-9)
    const invalidChars = getInvalidCharacters(userCode);
    if (invalidChars.length > 0) {
        const charsString = invalidChars.map(c => `"${c}"`).join(", ");
        showAlert(`কোডে ${charsString} ব্যবহার করা হয়েছে, তাই কাজ করবে না। রিমুভ করুন।`, "error");
        return;
    }

    if (isProcessing || !currentUser) return;
    isProcessing = true;
    generateBtn.disabled = true;
    hideAlert();

    try {
        const resellerRef = doc(db, "reseller", currentUser.uid);
        const resellerSnap = await getDoc(resellerRef);

        if (!resellerSnap.exists() || resellerSnap.data().active !== true || resellerSnap.data().verified !== true) {
            throw new Error("ACCOUNT_NOT_AUTHORIZED");
        }

        const referralRef = doc(db, "referral_code", currentUser.uid);
        const existingSnap = await getDoc(referralRef);

        if (existingSnap.exists()) {
            const currentCode = existingSnap.data().code;
            referralCodeText.textContent = currentCode;
            referralLinkInput.value = `https://seraproduct.com/reseller/signup?ref=${currentCode}`;
            generateSection.classList.add('hidden');
            displaySection.classList.remove('hidden');
            showAlert("আপনার একটি রেফারেল কোড ইতিমধ্যে তৈরি করা আছে।", "info");
            isProcessing = false;
            generateBtn.disabled = false;
            return;
        }

        // Check if the specific code already exists in database using the 'code' field
        const codeExists = await checkCodeExists(userCode);
        if (codeExists) {
            showAlert("দুঃখিত, এই রেফার কোডটি ইতিমধ্যে অন্য কারো নামে ব্যবহৃত হচ্ছে। দয়া করে অন্য একটি কোড দিন।", "error");
            isProcessing = false;
            generateBtn.disabled = false;
            return;
        }

        // Create document with user's custom code
        await setDoc(referralRef, {
            uid: currentUser.uid,
            email: currentUser.email || resellerSnap.data().email,
            code: userCode,
            createdAt: serverTimestamp()
        });

        referralCodeText.textContent = userCode;
        referralLinkInput.value = `https://seraproduct.com/reseller/signup?ref=${userCode}`;
        generateSection.classList.add('hidden');
        displaySection.classList.remove('hidden');
        showAlert("রেফারেল কোড সফলভাবে তৈরি করা হয়েছে।", "success");

    } catch (err) {
        console.error("Generation error:", err);
        if (err.message === "ACCOUNT_NOT_AUTHORIZED") {
            showAlert("আপনার অ্যাকাউন্ট রেফারেল কোড তৈরির জন্য অনুমোদিত নয়।", "error");
        } else {
            showAlert("রেফারেল কোড তৈরি করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।", "error");
        }
    } finally {
        isProcessing = false;
        generateBtn.disabled = false;
    }
});

// Copy Code to Clipboard
copyBtn.addEventListener('click', () => {
    const code = referralCodeText.textContent;
    if (code && code !== '------') {
        navigator.clipboard.writeText(code).then(() => {
            showAlert("রেফারেল কোড সফলভাবে কপি হয়েছে।", "success");
        }).catch(() => {
            showAlert("কপি করতে ব্যর্থ হয়েছে।", "error");
        });
    }
});

// Copy Link to Clipboard
copyLinkBtn.addEventListener('click', () => {
    const link = referralLinkInput.value;
    if (link) {
        navigator.clipboard.writeText(link).then(() => {
            showAlert("রেফারেল লিংক সফলভাবে কপি হয়েছে।", "success");
        }).catch(() => {
            showAlert("লিংক কপি করতে ব্যর্থ হয়েছে।", "error");
        });
    }
});

// Share Link using Web Share API
shareLinkBtn.addEventListener('click', async () => {
    const link = referralLinkInput.value;
    if (navigator.share) {
        try {
            await navigator.share({
                title: 'Sera Product Reseller Referral',
                text: 'আমাদের সাথে রিসেলার হিসেবে যোগ দিন এবং আয় করুন!',
                url: link,
            });
        } catch (err) {
            console.log('Share canceled or failed', err);
        }
    } else {
        // Fallback: Copy link
        navigator.clipboard.writeText(link).then(() => {
            showAlert("ব্রাউজার শেয়ার সাপোর্ট না করায় লিংকটি কপি করা হয়েছে।", "success");
        });
    }
});

// Toggle Update Section View
toggleEditBtn.addEventListener('click', () => {
    updateSection.classList.toggle('hidden');
    newCodeInput.value = '';
});

// Handle Referral Code Update (With Existing Code Check)
updateBtn.addEventListener('click', async () => {
    const newCode = newCodeInput.value.trim().toUpperCase();
    
    if (!newCode || newCode.length < 3 || newCode.length > 15) {
        showAlert("অনুগ্রহ করে ৩ থেকে ১৫ অক্ষরের একটি বৈধ কোড দিন।", "error");
        return;
    }

    // Validate allowed characters (a-z, A-Z, 0-9)
    const invalidChars = getInvalidCharacters(newCode);
    if (invalidChars.length > 0) {
        const charsString = invalidChars.map(c => `"${c}"`).join(", ");
        showAlert(`কোডে ${charsString} ব্যবহার করা হয়েছে, তাই কাজ করবে না। রিমুভ করুন।`, "error");
        return;
    }

    if (isProcessing || !currentUser) return;
    isProcessing = true;
    updateBtn.disabled = true;
    hideAlert();

    try {
        // Check if new code already exists in database using 'code' field
        const codeExists = await checkCodeExists(newCode);
        if (codeExists) {
            showAlert("দুঃখিত, এই নতুন রেফার কোডটি ইতিমধ্যে অন্য কারো ব্যবহৃত হচ্ছে। দয়া করে অন্য কোড দিন।", "error");
            isProcessing = false;
            updateBtn.disabled = false;
            return;
        }

        const referralRef = doc(db, "referral_code", currentUser.uid);
        
        await updateDoc(referralRef, {
            code: newCode
        });

        referralCodeText.textContent = newCode;
        referralLinkInput.value = `https://seraproduct.com/reseller/signup?ref=${newCode}`;
        updateSection.classList.add('hidden');
        newCodeInput.value = '';
        showAlert("রেফারেল কোড সফলভাবে আপডেট করা হয়েছে।", "success");

    } catch (err) {
        console.error("Update error:", err);
        showAlert("কোড আপডেট করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।", "error");
    } finally {
        isProcessing = false;
        updateBtn.disabled = false;
    }
});

// Load footer on startup
loadFooter();
