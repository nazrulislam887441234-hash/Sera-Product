// Sera Product Profile JavaScript Application
// Using Firebase Modular SDK (v9+) & Vanilla JS

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --- Configuration Constants ---
const LOGIN_URL = "https://seraproduct.com/login"; // Fallback login URL if needed

// Firebase Configuration (Replace with your live Sera Product project credentials)
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
const skeletonLoader = document.getElementById("skeleton-loader");
const profileContent = document.getElementById("profile-content");
const errorState = document.getElementById("error-state");
const emptyState = document.getElementById("empty-state");
const retryBtn = document.getElementById("retry-btn");
const footerContainer = document.getElementById("footer-container");

let footerLoaded = false;
let footerLoadPromise = null;

// Format Firestore Timestamp to Bengali Date and Time
function formatCreatedAt(createdAtField) {
    if (!createdAtField) {
        return "তথ্য পাওয়া যায়নি";
    }
    try {
        let dateObj;
        // Check if it's a Firestore Timestamp object with .toDate()
        if (typeof createdAtField.toDate === "function") {
            dateObj = createdAtField.toDate();
        } else if (createdAtField instanceof Date) {
            dateObj = createdAtField;
        } else if (createdAtField.seconds) {
            dateObj = new Date(createdAtField.seconds * 1000);
        } else {
            dateObj = new Date(createdAtField);
        }

        if (isNaN(dateObj.getTime())) {
            return "তথ্য পাওয়া যায়নি";
        }

        const formatter = new Intl.DateTimeFormat("bn-BD", {
            dateStyle: "long",
            timeStyle: "short",
            timeZone: "Asia/Dhaka"
        });
        return formatter.format(dateObj);
    } catch (err) {
        console.error("Date formatting error:", err);
        return "তথ্য পাওয়া যায়নি";
    }
}

// Load Footer Function
async function loadFooter() {
    if (footerLoaded) return;
    footerLoadPromise = (async () => {
        try {
            const response = await fetch("https://seraproduct.com/footer");
            if (!response.ok) {
                throw new Error(`Footer request failed: ${response.status}`);
            }
            const footerHTML = await response.text();
            if (!footerHTML.trim()) {
                throw new Error("Footer content is empty.");
            }
            footerContainer.innerHTML = footerHTML;
            footerLoaded = true;
        } catch (error) {
            console.error("Footer loading error:", error);
            footerContainer.innerHTML = `
                <div class="footer-error">
                    Footer লোড করা যায়নি।
                </div>
            `;
        }
    })();
    await footerLoadPromise;
}

// Smooth scroll to Footer with loading check
async function scrollToFooter() {
    if (!footerLoaded) {
        if (footerLoadPromise) {
            await footerLoadPromise;
        } else {
            await loadFooter();
        }
    }
    footerContainer.scrollIntoView({ behavior: "smooth", block: "start" });
}

// Fetch and Render Buyer Profile
async function fetchAndRenderProfile(user) {
    try {
        skeletonLoader.classList.remove("hidden");
        profileContent.classList.add("hidden");
        errorState.classList.add("hidden");
        emptyState.classList.add("hidden");

        const buyerRef = doc(db, "buyers", user.uid);
        const buyerSnap = await getDoc(buyerRef);

        skeletonLoader.classList.add("hidden");

        if (!buyerSnap.exists()) {
            emptyState.classList.remove("hidden");
            return;
        }

        const data = buyerSnap.data();
        const name = data.name || "নাম পাওয়া যায়নি";
        const phone = data.phone || "তথ্য পাওয়া যায়নি";
        const email = data.email || user.email || "ইমেইল পাওয়া যায়নি";
        const createdAtFormatted = formatCreatedAt(data.createdAt);
        const isBlocked = data.block === true;

        let htmlContent = "";

        // Blocked Account Alert Section (If blocked)
        if (isBlocked) {
            htmlContent += `
                <div class="blocked-alert-card">
                    <div class="blocked-icon-wrap">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>
                    </div>
                    <div class="blocked-content">
                        <h3>আপনার একাউন্ট ব্লক করা হয়েছে</h3>
                        <p>আপনি কখনো এখান থেকে অর্ডার করতে পারবেন না❌。</p>
                    </div>
                </div>
            `;
        }

        // Profile Header / Card
        htmlContent += `
            <div class="profile-header-card">
                <div class="profile-avatar-wrap">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                </div>
                <div class="profile-title-info">
                    <h1>${escapeHTML(name)}</h1>
                    <p class="email-text">${escapeHTML(email)}</p>
                </div>
            </div>
        `;

        // Account Information Section
        htmlContent += `
            <div class="info-section">
                <h2 class="section-title">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    একাউন্ট তথ্য
                </h2>
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">নাম</span>
                        <span class="info-value">${escapeHTML(name)}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">মোবাইল নম্বর</span>
                        <span class="info-value">${escapeHTML(phone)}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">ইমেইল</span>
                        <span class="info-value">${escapeHTML(email)}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">একাউন্ট তৈরি হয়েছে</span>
                        <span class="info-value">${escapeHTML(createdAtFormatted)}</span>
                    </div>
                </div>
            </div>
        `;

        // Profile Action Menu (Grid Cards)
        htmlContent += `
            <div class="action-grid">
                <a href="https://seraproduct.com/all-product" class="action-card">
                    <div class="action-icon-wrap">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
                    </div>
                    <div class="action-text">
                        <h3>সব পণ্য দেখুন</h3>
                        <p>আমাদের সমস্ত পণ্য ব্রাউজ করুন</p>
                    </div>
                </a>

                <a href="https://seraproduct.com/categories" class="action-card">
                    <div class="action-icon-wrap">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                    </div>
                    <div class="action-text">
                        <h3>সব ক্যাটাগরি দেখুন</h3>
                        <p>ক্যাটাগরি অনুযায়ী পণ্য খুঁজুন</p>
                    </div>
                </a>

                <a href="https://seraproduct.com/my-orders" class="action-card">
                    <div class="action-icon-wrap">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
                    </div>
                    <div class="action-text">
                        <h3>সকল অর্ডার দেখুন</h3>
                        <p>আপনার অর্ডারগুলোর বর্তমান অবস্থা</p>
                    </div>
                </a>

                <a href="https://seraproduct.com/cart" class="action-card">
                    <div class="action-icon-wrap">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
                    </div>
                    <div class="action-text">
                        <h3>কার্টে যোগ করা পণ্য দেখুন</h3>
                        <p>আপনার কার্টের পণ্যসমূহ</p>
                    </div>
                </a>

                <button id="contact-action-btn" class="action-card" style="width:100%; text-align:left; background:var(--card-bg); cursor:pointer; font-family:inherit;">
                    <div class="action-icon-wrap">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                    </div>
                    <div class="action-text">
                        <h3>যোগাযোগ করুন</h3>
                        <p>আমাদের সাথে যোগাযোগ করুন</p>
                    </div>
                </button>
            </div>
        `;

        profileContent.innerHTML = htmlContent;
        profileContent.classList.remove("hidden");

        // Attach event listener for contact button scroll
        const contactBtn = document.getElementById("contact-action-btn");
        if (contactBtn) {
            contactBtn.addEventListener("click", (e) => {
                e.preventDefault();
                scrollToFooter();
            });
        }

    } catch (err) {
        console.error("Error fetching buyer profile:", err);
        skeletonLoader.classList.add("hidden");
        errorState.classList.remove("hidden");
    }
}

// XSS Protection helper
function escapeHTML(str) {
    if (!str) return "";
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}

// Authentication State Observer
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        // User not logged in, redirect to login URL
        window.location.href = LOGIN_URL;
        return;
    }

    // Load profile using strictly auth.currentUser.uid
    await fetchAndRenderProfile(user);
});

// Retry Button Listener
retryBtn.addEventListener("click", () => {
    const currentUser = auth.currentUser;
    if (currentUser) {
        fetchAndRenderProfile(currentUser);
    } else {
        window.location.href = LOGIN_URL;
    }
});

// Load Footer on Page Load
loadFooter();
