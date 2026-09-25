import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

// State variables
let currentResellerData = null;
let isEditMode = false;
let currentUser = null;

// DOMContentLoaded Initialization
document.addEventListener("DOMContentLoaded", () => {
    initApp();
});

function initApp() {
    handleAuthState();
    loadFooter();
}

// Authentication Handler
function handleAuthState() {
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = "https://seraproduct.com/reseller/login";
            return;
        }
        currentUser = user;
        await loadResellerData(user.uid);
    });
}

// Load Reseller Data securely (Read-only document read for current UID)
async function loadResellerData(uid) {
    try {
        const resellerRef = doc(db, "reseller", uid);
        const resellerSnap = await getDoc(resellerRef);

        if (!resellerSnap.exists()) {
            hideLoading();
            showMissingUserModal();
            return;
        }

        currentResellerData = resellerSnap.data();
        renderAllData(currentResellerData);
        hideLoading();
    } catch (error) {
        console.error("Reseller data load error:", error);
        hideLoading();
        showToast("তথ্য লোড করতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।", "error");
    }
}

// Render All Data Sections
function renderAllData(data) {
    renderProfile(data);
    renderPersonalInfo(data);
    renderFinancialInfo(data);
    renderAccountStatus(data);
    renderAccountInfo(data);
    renderReferralInfo(data);
    renderNidImages(data);
}

function renderProfile(data) {
    const name = data.name || "রিসেলার";
    document.getElementById("profile-name").textContent = name;
    document.getElementById("profile-email").textContent = data.email || "ইমেইল পাওয়া যায়নি";
    
    // Set initials
    const initials = name.charAt(0).toUpperCase();
    document.getElementById("profile-initials").textContent = initials;
}

function renderPersonalInfo(data) {
    document.getElementById("val-name").textContent = data.name || "-";
    document.getElementById("val-email").textContent = data.email || "-";
    
    // Phone
    const phone = data.phone || "";
    document.getElementById("val-phone-display").textContent = phone || "-";
    document.getElementById("val-phone-input").value = phone;

    // WhatsApp
    const whatsApp = data.whatsApp || "";
    document.getElementById("val-whatsapp-display").textContent = whatsApp || "-";
    document.getElementById("val-whatsapp-input").value = whatsApp;
}

function renderFinancialInfo(data) {
    const balance = typeof data.balance === "number" ? data.balance : 0;
    document.getElementById("val-balance").textContent = formatBalance(balance);
    document.getElementById("val-sendMoneyNumber").textContent = data.sendMoneyNumber || "-";
    document.getElementById("val-transectionId").textContent = data.transectionId || "-";
}

function renderAccountStatus(data) {
    // Verification Status
    const verified = data.verified === true;
    const verifiedBox = document.getElementById("status-verified-box");
    const verifiedIcon = document.getElementById("icon-verified");
    const verifiedText = document.getElementById("text-verified");

    if (verified) {
        verifiedIcon.className = "status-icon success";
        verifiedIcon.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
        verifiedText.textContent = "আপনার একাউন্ট ভেরিফাইড করা আছে!";
        verifiedText.className = "success";
    } else {
        verifiedIcon.className = "status-icon danger";
        verifiedIcon.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
        verifiedText.textContent = "আপনার একাউন্ট verified করা হয়নি!";
        verifiedText.className = "danger";
    }

    // Active Status
    const active = data.active === true;
    const activeIcon = document.getElementById("icon-active");
    const activeText = document.getElementById("text-active");

    if (active) {
        activeIcon.className = "status-icon success";
        activeIcon.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
        activeText.textContent = "আপনার একাউন্ট এক্টিভ করা আছে!";
        activeText.className = "success";
    } else {
        activeIcon.className = "status-icon danger";
        activeIcon.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
        activeText.textContent = "আপনার একাউন্ট এক্টিভ করা নেই";
        activeText.className = "danger";
    }
}

function renderAccountInfo(data) {
    document.getElementById("val-uid").textContent = data.uid || currentUser.uid;
    document.getElementById("val-createdAt").textContent = formatDate(data.createdAt);
}

function renderReferralInfo(data) {
    document.getElementById("val-refferalCode").textContent = data.refferalCode || "প্রযোজ্য নয়";
    document.getElementById("val-refferalUserId").textContent = data.refferalUserId || "প্রযোজ্য নয়";
}

function renderNidImages(data) {
    // NID Front
    const frontImg = document.getElementById("val-nidFront");
    const frontFallback = document.querySelector("#wrapper-nidFront .nid-fallback");
    if (data.nidFront && data.nidFront.trim() !== "") {
        frontImg.src = data.nidFront;
        frontImg.classList.remove("hidden");
        frontFallback.classList.add("hidden");
    } else {
        frontImg.classList.add("hidden");
        frontFallback.classList.remove("hidden");
    }

    // NID Back
    const backImg = document.getElementById("val-nidBack");
    const backFallback = document.querySelector("#wrapper-nidBack .nid-fallback");
    if (data.nidBack && data.nidBack.trim() !== "") {
        backImg.src = data.nidBack;
        backImg.classList.remove("hidden");
        backFallback.classList.add("hidden");
    } else {
        backImg.classList.add("hidden");
        backFallback.classList.remove("hidden");
    }
}

// Utility Formatters
function formatBalance(amount) {
    try {
        return "৳ " + amount.toLocaleString("en-BD");
    } catch (e) {
        return "৳ " + amount;
    }
}

function formatDate(timestamp) {
    if (!timestamp) return "প্রযোজ্য নয়";
    try {
        let date;
        if (timestamp.toDate && typeof timestamp.toDate === "function") {
            date = timestamp.toDate();
        } else if (timestamp.seconds) {
            date = new Date(timestamp.seconds * 1000);
        } else {
            date = new Date(timestamp);
        }
        return date.toLocaleDateString("bn-BD", {
            year: "numeric",
            month: "long",
            day: "numeric"
        });
    } catch (e) {
        return "তারিখ উপলব্ধ নেই";
    }
}

// Edit Mode Toggle
window.toggleEditMode = function() {
    if (isEditMode) return;
    isEditMode = true;

    document.getElementById("edit-action-bar").classList.remove("hidden");
    document.getElementById("edit-toggle-btn").classList.add("hidden");

    document.getElementById("val-phone-display").classList.add("hidden");
    document.getElementById("val-phone-input").classList.remove("hidden");
    document.querySelector("#box-phone .edit-indicator").classList.remove("hidden");
    document.getElementById("box-phone").classList.add("active-edit-box");

    document.getElementById("val-whatsapp-display").classList.add("hidden");
    document.getElementById("val-whatsapp-input").classList.remove("hidden");
    document.querySelector("#box-whatsapp .edit-indicator").classList.remove("hidden");
    document.getElementById("box-whatsapp").classList.add("active-edit-box");
}

window.cancelEdit = function() {
    isEditMode = false;
    
    document.getElementById("edit-action-bar").classList.add("hidden");
    document.getElementById("edit-toggle-btn").classList.remove("hidden");

    if (currentResellerData) {
        document.getElementById("val-phone-input").value = currentResellerData.phone || "";
        document.getElementById("val-whatsapp-input").value = currentResellerData.whatsApp || "";
    }

    document.getElementById("val-phone-display").classList.remove("hidden");
    document.getElementById("val-phone-input").classList.add("hidden");
    document.querySelector("#box-phone .edit-indicator").classList.add("hidden");
    document.getElementById("box-phone").classList.remove("active-edit-box");
    document.getElementById("error-phone").classList.remove("show");

    document.getElementById("val-whatsapp-display").classList.remove("hidden");
    document.getElementById("val-whatsapp-input").classList.add("hidden");
    document.querySelector("#box-whatsapp .edit-indicator").classList.add("hidden");
    document.getElementById("box-whatsapp").classList.remove("active-edit-box");
    document.getElementById("error-whatsapp").classList.remove("show");
}

// Validation Functions
function validatePhone(phone) {
    const regex = /^01[3-9]\d{8}$/;
    return regex.test(phone);
}

function validateWhatsApp(whatsApp) {
    const regex = /^01[3-9]\d{8}$/;
    return regex.test(whatsApp);
}

// Save Changes to Firebase (Strict security: only phone and whatsApp updated)
window.saveChanges = async function() {
    const newPhone = document.getElementById("val-phone-input").value.trim();
    const newWhatsApp = document.getElementById("val-whatsapp-input").value.trim();

    let isValid = true;

    const phoneError = document.getElementById("error-phone");
    if (!validatePhone(newPhone)) {
        phoneError.textContent = "সঠিক ফোন নম্বর লিখুন।";
        phoneError.classList.add("show");
        isValid = false;
    } else {
        phoneError.classList.remove("show");
    }

    const whatsappError = document.getElementById("error-whatsapp");
    if (!validateWhatsApp(newWhatsApp)) {
        whatsappError.textContent = "সঠিক WhatsApp নম্বর লিখুন।";
        whatsappError.classList.add("show");
        isValid = false;
    } else {
        whatsappError.classList.remove("show");
    }

    if (!isValid) return;

    const saveBtn = document.getElementById("save-btn");
    saveBtn.disabled = true;
    saveBtn.textContent = "সংরক্ষণ করা হচ্ছে...";

    try {
        const resellerRef = doc(db, "reseller", currentUser.uid);
        
        await updateDoc(resellerRef, {
            phone: newPhone,
            whatsApp: newWhatsApp
        });

        currentResellerData.phone = newPhone;
        currentResellerData.whatsApp = newWhatsApp;

        renderPersonalInfo(currentResellerData);
        
        saveBtn.disabled = false;
        saveBtn.textContent = "সংরক্ষণ করুন";
        
        cancelEdit();
        showToast("আপনার তথ্য সফলভাবে আপডেট হয়েছে।", "success");
    } catch (error) {
        console.error("Update error:", error);
        saveBtn.disabled = false;
        saveBtn.textContent = "সংরক্ষণ করুন";
        showToast("তথ্য আপডেট করতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।", "error");
    }
}

// Image Preview Lightbox
window.openImagePreview = function(wrapper) {
    const img = wrapper.querySelector("img");
    if (!img || img.classList.contains("hidden") || !img.src) return;
    
    const modal = document.getElementById("image-modal");
    const zoomedImg = document.getElementById("modal-zoomed-img");
    zoomedImg.src = img.src;
    modal.classList.remove("hidden");
}

window.closeImagePreview = function() {
    document.getElementById("image-modal").classList.add("hidden");
}

window.handleImageError = function(img) {
    img.classList.add("hidden");
    if (img.parentElement) {
        const fallback = img.parentElement.querySelector(".nid-fallback");
        if (fallback) fallback.classList.remove("hidden");
    }
}

// Missing User Modal
function showMissingUserModal() {
    document.getElementById("missing-user-modal").classList.remove("hidden");
}

// Logout
window.logoutUser = async function() {
    try {
        await signOut(auth);
        window.location.href = "https://seraproduct.com/reseller/login";
    } catch (error) {
        console.error("Logout error:", error);
        window.location.href = "https://seraproduct.com/reseller/login";
    }
}

// Toast System
function showToast(message, type = "success") {
    const container = document.getElementById("toast-container");
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    
    let iconSvg = type === "success" 
        ? `<svg viewBox="0 0 24 24" width="20" height="20" stroke="#10b981" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`
        : `<svg viewBox="0 0 24 24" width="20" height="20" stroke="#ef4444" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;

    toast.innerHTML = `${iconSvg}<span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Dynamic Footer Loader
async function loadFooter() {
    const footerContainer = document.getElementById("footer-container");
    try {
        const response = await fetch("https://seraproduct.com/footer");
        if (!response.ok) {
            throw new Error("Footer load failed");
        }
        const html = await response.text();
        footerContainer.innerHTML = html;
    } catch (error) {
        footerContainer.innerHTML = "";
    }
}

// Hide Loading Skeleton
function hideLoading() {
    document.getElementById("skeleton-container").classList.add("hidden");
    document.getElementById("app-container").classList.remove("hidden");
}
