import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Firebase Configuration (signup.js এর মতো একই কনফিগ দিন)
const firebaseConfig = {
  apiKey: "AIzaSyBRSt2aoSJ-lumYAWGAXE6ncui7__TqJ4E",
  authDomain: "sera-product.firebaseapp.com",
  projectId: "sera-product",
  storageBucket: "sera-product.firebasestorage.app",
  messagingSenderId: "516762224598",
  appId: "1:516762224598:web:b6a571f355a8a4a97c0677",
  measurementId: "G-RLMWH43FXX"
};
// Cloudflare Worker URL - আপনার ডেপ্লয় করা Worker URL এখানে বসান
const WORKER_UPLOAD_URL = "https://image.seraproduct.com";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM Elements
const pageLoader = document.getElementById('page-loader');
const regCard = document.getElementById('registration-card');
const form = document.getElementById('details-form');
const btn = document.getElementById('submit-details-btn');
const btnText = btn.querySelector('.btn-text');
const loader = btn.querySelector('.loader');

// Modal Elements
const modal = document.getElementById('custom-modal');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');
const modalDetailsContainer = document.getElementById('modal-details-container');
const modalDetails = document.getElementById('modal-details');
const progressContainer = document.getElementById('upload-progress-container');
const closeBtns = document.querySelectorAll('.close-modal, .close-modal-btn');

let currentUser = null;

// Modal Functions
function showModal(title, message, isError = false, errorDetails = null, showProgress = false) {
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    
    if (showProgress) {
        progressContainer.classList.remove('hidden');
    } else {
        progressContainer.classList.add('hidden');
    }

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
    btn.addEventListener('click', () => {
        if(!btn.disabled) modal.classList.add('hidden');
    });
});

// AUTH GUARD & DUPLICATE CHECK
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.replace('signup.html');
        return;
    }
    currentUser = user;
    
    try {
        const docRef = doc(db, "reseller", user.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            window.location.replace('/dashboard');
        } else {
            pageLoader.classList.add('hidden');
            regCard.classList.remove('hidden');
        }
    } catch (error) {
        console.error(error);
        showModal("ত্রুটি", "ডাটাবেস কানেকশনে সমস্যা হয়েছে।", true, error);
    }
});

// Helper: File to URL via Cloudflare Worker
async function uploadImageToWorker(fileObj) {
    const formData = new FormData();
    formData.append('image', fileObj);

    const response = await fetch(WORKER_UPLOAD_URL, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    if (!result.success) {
        throw new Error(result.error || "Upload failed in Worker");
    }
    
    return result.url;
}

function setLoading(isLoading) {
    btn.disabled = isLoading;
    if(isLoading) {
        btnText.textContent = "একাউন্ট তৈরি হচ্ছে...";
        loader.classList.remove('hidden');
        // disable modal close buttons during load
        closeBtns.forEach(b => b.disabled = true);
    } else {
        btnText.textContent = "একাউন্ট তৈরি করুন";
        loader.classList.add('hidden');
        closeBtns.forEach(b => b.disabled = false);
    }
}

// Form Submission
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Get values
    const name = document.getElementById('name').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const whatsApp = document.getElementById('whatsApp').value.trim();
    const nidFrontFile = document.getElementById('nidFront').files[0];
    const nidBackFile = document.getElementById('nidBack').files[0];
    const sendMoneyNumber = document.getElementById('sendMoneyNumber').value.trim();
    const transectionId = document.getElementById('transectionId').value.trim();

    // Basic Validation (Pattern matching is handled by HTML5, but we ensure not empty)
    if (!name || !phone || !whatsApp || !nidFrontFile || !nidBackFile || !sendMoneyNumber || !transectionId) {
        showModal("সতর্কতা", "সকল তথ্য সঠিকভাবে পূরণ করুন।", true);
        return;
    }

    setLoading(true);
    showModal("অপেক্ষা করুন", "আপনার ছবি এবং তথ্য আপলোড হচ্ছে...", false, null, true);

    try {
        // 1. Upload NID Front
        const frontUrl = await uploadImageToWorker(nidFrontFile);
        // 2. Upload NID Back
        const backUrl = await uploadImageToWorker(nidBackFile);

        // 3. Save to Firestore
        const resellerData = {
            name: name,
            email: currentUser.email,
            phone: phone,
            whatsApp: whatsApp,
            sendMoneyNumber: sendMoneyNumber,
            transectionId: transectionId,
            active: false,
            verified: false,
            nidFront: frontUrl,
            nidBack: backUrl,
            uid: currentUser.uid,
            createdAt: serverTimestamp(),
            balance: 0
        };

        await setDoc(doc(db, "reseller", currentUser.uid), resellerData);
        
        // Success!
        progressContainer.classList.add('hidden');
        modalTitle.textContent = "অভিনন্দন!";
        modalMessage.textContent = "আপনার রিসেলার একাউন্ট সফলভাবে তৈরি হয়েছে।";
        
        setTimeout(() => {
            window.location.replace('/dashboard');
        }, 2000);

    } catch (error) {
        console.error("Submission Error: ", error);
        setLoading(false);
        showModal("ত্রুটি (Error)", "তথ্য সংরক্ষণ করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।", true, error);
    }
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
