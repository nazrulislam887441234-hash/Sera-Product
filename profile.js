// Sera Product Profile JavaScript Application
// Using Firebase Modular SDK (v9+) & Vanilla JS

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, updateDoc, query, collection, limit } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const LOGIN_URL = "https://seraproduct.com/login";

const firebaseConfig = {
  apiKey: "AIzaSyBRSt2aoSJ-lumYAWGAXE6ncui7__TqJ4E",
  authDomain: "sera-product.firebaseapp.com",
  projectId: "sera-product",
  storageBucket: "sera-product.firebasestorage.app",
  messagingSenderId: "516762224598",
  appId: "1:516762224598:web:b6a571f355a8a4a97c0677",
  measurementId: "G-RLMWH43FXX"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const skeletonLoader = document.getElementById("skeleton-loader");
const profileContent = document.getElementById("profile-content");
const errorState = document.getElementById("error-state");
const emptyState = document.getElementById("empty-state");
const retryBtn = document.getElementById("retry-btn");
const footerContainer = document.getElementById("footer-container");

let footerLoaded = false;
let footerLoadPromise = null;

// Custom Popup Function (No alert used)
function showCustomPopup(title, message, errorObj = null) {
    const existing = document.getElementById("custom-popup-overlay");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "custom-popup-overlay";
    overlay.className = "custom-popup-overlay";

    let errorHTML = "";
    if (errorObj) {
        const errStr = typeof errorObj === "string" ? errorObj : (errorObj.message || JSON.stringify(errorObj));
        errorHTML = `<div class="custom-popup-error-code">টেকনিক্যাল এরর: ${escapeHTML(errStr)}</div>`;
    }

    overlay.innerHTML = `
        <div class="custom-popup-box">
            <h3 class="custom-popup-title">${escapeHTML(title)}</h3>
            <p class="custom-popup-msg">${escapeHTML(message)}</p>
            ${errorHTML}
            <button id="popup-ok-btn" class="primary-btn">ঠিক আছে</button>
        </div>
    `;

    document.body.appendChild(overlay);
    document.getElementById("popup-ok-btn").addEventListener("click", () => {
        overlay.remove();
    });
}

function formatCreatedAt(createdAtField) {
    if (!createdAtField) return "তথ্য পাওয়া যায়নি";
    try {
        let dateObj;
        if (typeof createdAtField.toDate === "function") {
            dateObj = createdAtField.toDate();
        } else if (createdAtField instanceof Date) {
            dateObj = createdAtField;
        } else if (createdAtField.seconds) {
            dateObj = new Date(createdAtField.seconds * 1000);
        } else {
            dateObj = new Date(createdAtField);
        }

        if (isNaN(dateObj.getTime())) return "তথ্য পাওয়া যায়নি";

        return new Intl.DateTimeFormat("bn-BD", {
            dateStyle: "long",
            timeStyle: "short",
            timeZone: "Asia/Dhaka"
        }).format(dateObj);
    } catch (err) {
        console.error("Date formatting error:", err);
        return "তথ্য পাওয়া যায়নি";
    }
}

async function loadFooter() {
    if (footerLoaded) return;
    footerLoadPromise = (async () => {
        try {
            const response = await fetch("https://seraproduct.com/footer");
            if (!response.ok) throw new Error(`Footer request failed: ${response.status}`);
            const footerHTML = await response.text();
            if (!footerHTML.trim()) throw new Error("Footer content is empty.");
            footerContainer.innerHTML = footerHTML;
            footerLoaded = true;
        } catch (error) {
            console.error("Footer loading error:", error);
            footerContainer.innerHTML = `<div class="footer-error">Footer লোড করা যায়নি।</div>`;
        }
    })();
    await footerLoadPromise;
}

async function scrollToFooter() {
    if (!footerLoaded) {
        if (footerLoadPromise) await footerLoadPromise;
        else await loadFooter();
    }
    footerContainer.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function fetchAndRenderProfile(user) {
    try {
        skeletonLoader.classList.remove("hidden");
        profileContent.classList.add("hidden");
        errorState.classList.add("hidden");
        emptyState.classList.add("hidden");

        // Limit query to 1 for faster loading
        const buyerRef = doc(db, "buyers", user.uid);
        const buyerSnap = await getDoc(buyerRef);

        skeletonLoader.classList.add("hidden");

        if (!buyerSnap.exists()) {
            emptyState.classList.remove("hidden");
            return;
        }

        const data = buyerSnap.data();
        const name = data.name || "";
        const phone = data.phone || "";
        const email = data.email || user.email || "";
        const createdAtFormatted = formatCreatedAt(data.createdAt);
        const isBlocked = data.block === true;

        // Calculate profile completion %
        let completedFields = 0;
        let totalFields = 3;
        if (name) completedFields++;
        if (phone) completedFields++;
        if (email) completedFields++;
        const completionPercent = Math.round((completedFields / totalFields) * 100);
        const isProfileComplete = completionPercent === 100;

        // If profile is not complete, show error popup repeatedly
        if (!isProfileComplete) {
            showCustomPopup("প্রোফাইল অসম্পূর্ণ", "আপনার প্রোফাইলের তথ্য সম্পূর্ণ নয়। দয়া করে আপনার নাম, ইমেইল এবং ফোন নম্বর সঠিকভাবে সেট করুন।");
        }

        let htmlContent = "";

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

        htmlContent += `
            <div class="profile-header-card">
                <div class="profile-avatar-wrap">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                </div>
                <div class="profile-title-info">
                    <h1>${escapeHTML(name || "নাম সেট করা হয়নি")}</h1>
                    <p class="email-text">${escapeHTML(email || "ইমেইল সেট করা হয়নি")}</p>
                </div>
            </div>
        `;

        // Account Information Section with Completion Badge & UID Copy Feature
        htmlContent += `
            <div class="info-section">
                <h2 class="section-title">
                    <span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 6px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                        একাউন্ট তথ্য
                    </span>
                    <span class="completion-badge">কমপ্লিট: ${completionPercent}%</span>
                </h2>
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">ফায়ারবেস UID</span>
                        <div class="info-value-row">
                            <span class="info-value" id="uid-text">${escapeHTML(user.uid)}</span>
                            <button id="copy-uid-btn" class="copy-btn" title="UID কপি করুন">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                            </button>
                        </div>
                    </div>
                    <div class="info-item">
                        <span class="info-label">নাম</span>
                        <span class="info-value">${escapeHTML(name || "সেট করা নেই")}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">মোবাইল নম্বর</span>
                        <span class="info-value">${escapeHTML(phone || "সেট করা নেই")}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">ইমেইল</span>
                        <span class="info-value">${escapeHTML(email || "সেট করা নেই")}</span>
                    </div>
                    <div class="info-item" style="grid-column: 1 / -1;">
                        <span class="info-label">একাউন্ট তৈরি হয়েছে</span>
                        <span class="info-value">${escapeHTML(createdAtFormatted)}</span>
                    </div>
                </div>

                <!-- Update Name and Phone Form (Available if everything is linked or incomplete setup) -->
                <div class="edit-form-box">
                    <h3 style="margin:0 0 8px 0; font-size:1rem;">নাম ও ফোন নম্বর আপডেট করুন</h3>
                    <div class="form-group">
                        <label for="update-name">নাম</label>
                        <input type="text" id="update-name" value="${escapeHTML(name)}" placeholder="আপনার নাম লিখুন">
                    </div>
                    <div class="form-group">
                        <label for="update-phone">মোবাইল নম্বর</label>
                        <input type="text" id="update-phone" value="${escapeHTML(phone)}" placeholder="আপনার মোবাইল নম্বর লিখুন">
                    </div>
                    <button id="save-profile-btn" class="primary-btn" style="align-self: flex-start; margin-top: 4px;">সংরক্ষণ করুন</button>
                </div>
            </div>
        `;

        // Action Grid Menu
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
                        <p>আপনার কারতের পণ্যসমূহ</p>
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

        // Logout Button Section
        htmlContent += `
            <div class="logout-container">
                <button id="logout-btn" class="logout-btn">লগআউট করুন</button>
            </div>
        `;

        profileContent.innerHTML = htmlContent;
        profileContent.classList.remove("hidden");

        // Event listener for copying UID
        document.getElementById("copy-uid-btn").addEventListener("click", () => {
            navigator.clipboard.writeText(user.uid).then(() => {
                showCustomPopup("সফল", "ফায়ারবেস UID সফলভাবে কপি করা হয়েছে।");
            }).catch(err => {
                showCustomPopup("ত্রুটি", "UID কপি করা সম্ভব হয়নি।", err);
            });
        });

        // Event listener for updating profile (Name and Phone)
        document.getElementById("save-profile-btn").addEventListener("click", async () => {
            const newName = document.getElementById("update-name").value.trim();
            const newPhone = document.getElementById("update-phone").value.trim();

            if (!newName || !newPhone) {
                showCustomPopup("সতর্কতা", "নাম এবং মোবাইল নম্বর উভয়ই পূরণ করতে হবে।");
                return;
            }

            try {
                await updateDoc(buyerRef, {
                    name: newName,
                    phone: newPhone
                });
                showCustomPopup("সফল", "প্রোফাইল তথ্য সফলভাবে আপডেট করা হয়েছে।");
                fetchAndRenderProfile(user);
            } catch (err) {
                console.error("Profile update error:", err);
                showCustomPopup("ত্রুটি", "প্রোফাইল আপডেট করতে ব্যর্থ হয়েছে।", err);
            }
        });

        // Contact scroll button
        const contactBtn = document.getElementById("contact-action-btn");
        if (contactBtn) {
            contactBtn.addEventListener("click", (e) => {
                e.preventDefault();
                scrollToFooter();
            });
        }

        // Logout button action
        document.getElementById("logout-btn").addEventListener("click", async () => {
            try {
                await signOut(auth);
                window.location.href = LOGIN_URL;
            } catch (err) {
                showCustomPopup("ত্রুটি", "লগআউট করতে সমস্যা হয়েছে।", err);
            }
        });

    } catch (err) {
        console.error("Error fetching buyer profile:", err);
        skeletonLoader.classList.add("hidden");
        errorState.classList.remove("hidden");
        showCustomPopup("তথ্য লোড ত্রুটি", "প্রোফাইল তথ্য ফেচ করার সময় সমস্যা হয়েছে।", err);
    }
}

function escapeHTML(str) {
    if (!str) return "";
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = LOGIN_URL;
        return;
    }
    await fetchAndRenderProfile(user);
});

retryBtn.addEventListener("click", () => {
    const currentUser = auth.currentUser;
    if (currentUser) {
        fetchAndRenderProfile(currentUser);
    } else {
        window.location.href = LOGIN_URL;
    }
});

loadFooter();
