/**
 * Sera Product - Customer My Orders Engine
 * Fully secured customer order portal integrated with Firebase JS SDK v10+
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    query, 
    where, 
    orderBy, 
    limit, 
    startAfter, 
    getDocs, 
    getDoc, 
    doc,
    onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 1. Firebase Configuration Initialization
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

// Application State Parameters
let currentUser = null;
let lastVisibleDoc = null;
let currentStatusFilter = "all";
let activeRealtimeUnsubscribe = null;
const PAGE_SIZE = 20;

// Status Bengali Mapping Setup
const STATUS_MAP = {
    pending: { text: "নতুন অর্ডার", class: "pending" },
    confirm: { text: "অর্ডার গ্রহণ করা হয়েছে!", class: "confirm" },
    processing: { text: "কোরিয়ারে পাঠানো হয়েছে!", class: "processing" },
    return: { text: "অর্ডার রিটার্ন করা হয়েছে!", class: "return" },
    delivery: { text: "অর্ডার সফল ভাবে ডেলিভারি করা হয়েছে!", class: "delivery" },
    cancel: { text: "অর্ডার বাতিল করা হয়েছে!", class: "cancel" }
};

// UI Element Handles
const globalLoader = document.getElementById("globalLoader");
const loaderText = document.getElementById("loaderText");
const ordersContainer = document.getElementById("ordersContainer");
const emptyState = document.getElementById("emptyState");
const emptyStateMessage = document.getElementById("emptyStateMessage");
const loadMoreBtn = document.getElementById("loadMoreBtn");
const paginationWrapper = document.getElementById("paginationWrapper");
const orderSearchInput = document.getElementById("orderSearchInput");
const clearSearchBtn = document.getElementById("clearSearchBtn");
const statusFilter = document.getElementById("statusFilter");
const dynamicFooter = document.getElementById("dynamicFooter");

/* ==========================================================================
   Security Guard & Authentication Listener
   ========================================================================== */
showLoader("সেশন যাচাই করা হচ্ছে...");

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        // Enforce strict security redirect if unauthenticated
        window.location.href = "https://seraproduct.com/login";
        return;
    }

    currentUser = user;
    
    // Load external footer concurrently
    loadExternalFooter();

    // Fetch initial order set safely tied to currentUser.uid
    await fetchInitialOrders();
    hideLoader();
});

/* ==========================================================================
   Loader and Notification Utility Methods
   ========================================================================== */
function showLoader(message = "তথ্য লোড হচ্ছে...") {
    if (loaderText) loaderText.textContent = message;
    if (globalLoader) globalLoader.classList.remove("hidden");
}

function hideLoader() {
    if (globalLoader) globalLoader.classList.add("hidden");
}

function showToast(message) {
    const container = document.getElementById("toastContainer");
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerHTML = `
        <svg viewBox="0 0 24 24" class="svg-icon"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
        <span>${message}</span>
    `;
    container.appendChild(toast);
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

/* ==========================================================================
   External Footer Dynamic Loader
   ========================================================================== */
async function loadExternalFooter() {
    try {
        const response = await fetch("https://seraproduct.com/footer");
        if (response.ok) {
            const footerHtml = await response.text();
            dynamicFooter.innerHTML = footerHtml;
        } else {
            throw new Error("Footer load failed");
        }
    } catch (err) {
        dynamicFooter.innerHTML = `<div style="text-align:center; padding:20px; color:#666; font-size:12px;">© Sera Product - সর্বস্বত্ব সংরক্ষিত</div>`;
    }
}

/* ==========================================================================
   Firestore Query Core Logic (Strict User Isolation)
   ========================================================================== */

/**
 * Builds standard secure Firestore queries explicitly bounded by user UID.
 */
function buildOrdersQuery(status = "all", startDoc = null) {
    const constraints = [
        where("uid", "==", currentUser.uid),
        orderBy("createdAt", "desc")
    ];

    if (status !== "all") {
        constraints.push(where("status", "==", status));
    }

    if (startDoc) {
        constraints.push(startAfter(startDoc));
    }

    constraints.push(limit(PAGE_SIZE));

    return query(collection(db, "orders"), ...constraints);
}

/**
 * Initial Fetch and Listener Subscription
 */
async function fetchInitialOrders() {
    showLoader("অর্ডার লোড করা হচ্ছে...");
    ordersContainer.innerHTML = "";
    emptyState.classList.add("hidden");
    paginationWrapper.classList.add("hidden");
    lastVisibleDoc = null;

    // Clean previous real-time listeners if active
    if (activeRealtimeUnsubscribe) {
        activeRealtimeUnsubscribe();
        activeRealtimeUnsubscribe = null;
    }

    try {
        const q = buildOrdersQuery(currentStatusFilter);
        
        // Listen to first page updates in real-time securely
        activeRealtimeUnsubscribe = onSnapshot(q, (snapshot) => {
            hideLoader();
            if (snapshot.empty) {
                ordersContainer.innerHTML = "";
                emptyStateMessage.textContent = "আপনার এখনো কোনো অর্ডার নেই।";
                emptyState.classList.remove("hidden");
                paginationWrapper.classList.add("hidden");
                return;
            }

            emptyState.classList.add("hidden");
            ordersContainer.innerHTML = "";
            
            snapshot.docs.forEach(docSnap => {
                renderOrderCard(docSnap.id, docSnap.data());
            });

            lastVisibleDoc = snapshot.docs[snapshot.docs.length - 1];

            if (snapshot.docs.length === PAGE_SIZE) {
                paginationWrapper.classList.remove("hidden");
            } else {
                paginationWrapper.classList.add("hidden");
            }
        }, (error) => {
            hideLoader();
            console.error("Firestore Query Error:", error);
            showToast("অর্ডারের তথ্য আনতে সমস্যা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।");
        });

    } catch (error) {
        hideLoader();
        showToast("অর্ডারের তথ্য আনতে সমস্যা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।");
    }
}

/**
 * Pagination: Load Next 20 Orders
 */
async function loadMoreOrders() {
    if (!lastVisibleDoc || !currentUser) return;

    showLoader("আরোও অর্ডার আনা হচ্ছে...");

    try {
        const nextQuery = buildOrdersQuery(currentStatusFilter, lastVisibleDoc);
        const snapshot = await getDocs(nextQuery);

        hideLoader();

        if (snapshot.empty) {
            paginationWrapper.classList.add("hidden");
            showToast("আর কোনো অর্ডার নেই!");
            return;
        }

        snapshot.docs.forEach(docSnap => {
            renderOrderCard(docSnap.id, docSnap.data());
        });

        lastVisibleDoc = snapshot.docs[snapshot.docs.length - 1];

        if (snapshot.docs.length < PAGE_SIZE) {
            paginationWrapper.classList.add("hidden");
        }

    } catch (error) {
        hideLoader();
        showToast("অর্ডারের তথ্য আনতে সমস্যা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।");
    }
}

/**
 * Exact Order ID Direct Search
 */
async function searchOrderById(orderId) {
    if (!orderId.trim()) return;

    showLoader("অর্ডার খোঁজা হচ্ছে...");
    
    // Stop real-time listener during manual direct search
    if (activeRealtimeUnsubscribe) {
        activeRealtimeUnsubscribe();
        activeRealtimeUnsubscribe = null;
    }

    ordersContainer.innerHTML = "";
    paginationWrapper.classList.add("hidden");
    emptyState.classList.add("hidden");

    try {
        const orderDocRef = doc(db, "orders", orderId.trim());
        const orderSnap = await getDoc(orderDocRef);

        hideLoader();

        if (!orderSnap.exists()) {
            emptyStateMessage.textContent = "এই অর্ডার আইডিতে কোনো অর্ডার পাওয়া যায়নি!";
            emptyState.classList.remove("hidden");
            return;
        }

        const orderData = orderSnap.data();

        // STRICT SECURITY CHECK: Validate document uid matching auth UID
        if (orderData.uid !== currentUser.uid) {
            emptyStateMessage.textContent = "এই অর্ডারটি আপনার নয়!";
            emptyState.classList.remove("hidden");
            return;
        }

        // Render validated matching order
        renderOrderCard(orderSnap.id, orderData);

    } catch (error) {
        hideLoader();
        showToast("অর্ডারের তথ্য আনতে সমস্যা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।");
    }
}

/* ==========================================================================
   UI Component Rendering Engine
   ========================================================================== */

function renderOrderCard(orderId, data) {
    const card = document.createElement("div");
    card.className = "order-card";
    card.id = `order-card-${orderId}`;

    const statusInfo = STATUS_MAP[data.status] || { text: data.status || "অজানা", class: "pending" };
    const formattedDate = formatTimestamp(data.createdAt);

    card.innerHTML = `
        <div class="card-compact">
            <div class="compact-header">
                <div class="order-id-group">
                    <span class="order-id-label">অর্ডার আইডি:</span>
                    <span class="order-id-val">${orderId}</span>
                    <button class="icon-btn copy-btn" data-copy="${orderId}" title="অর্ডার আইডি কপি করুন">
                        <svg viewBox="0 0 24 24" class="svg-icon"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
                    </button>
                </div>
                <div class="status-badge ${statusInfo.class}">
                    ${statusInfo.text}
                </div>
            </div>

            <div class="compact-info-grid">
                <div class="info-item">
                    <svg viewBox="0 0 24 24" class="svg-icon"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                    <span><strong>নাম:</strong> ${escapeHtml(data.name || "N/A")}</span>
                </div>
                <div class="info-item">
                    <svg viewBox="0 0 24 24" class="svg-icon"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
                    <span><strong>ফোন:</strong> 
                        <a href="tel:${data.phone || ''}" class="phone-link">${escapeHtml(data.phone || "N/A")}</a>
                    </span>
                    ${data.phone ? `
                    <button class="icon-btn copy-btn" data-copy="${data.phone}" data-toast="ফোন নম্বর কপি হয়েছে!" title="ফোন নম্বর কপি করুন">
                        <svg viewBox="0 0 24 24" class="svg-icon"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
                    </button>` : ''}
                </div>
            </div>

            <button class="toggle-details-btn" data-target="expanded-${orderId}">
                <span>সব তথ্য দেখুন</span>
                <svg viewBox="0 0 24 24" class="svg-icon chevron-icon"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>
            </button>
        </div>

        <div id="expanded-${orderId}" class="card-expanded hidden">
            <!-- Customer Details Block -->
            <div class="section-block">
                <div class="section-title">
                    <svg viewBox="0 0 24 24" class="svg-icon"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                    <span>গ্রাহক ও ডেলিভারি তথ্য</span>
                </div>
                <div class="customer-details-list">
                    <div class="detail-line"><span class="detail-label">নাম:</span><span class="detail-val">${escapeHtml(data.name || "N/A")}</span></div>
                    <div class="detail-line"><span class="detail-label">ফোন:</span><span class="detail-val">${escapeHtml(data.phone || "N/A")}</span></div>
                    <div class="detail-line"><span class="detail-label">উপজেলা/থানা:</span><span class="detail-val">${escapeHtml(data.thana || "N/A")}</span></div>
                    <div class="detail-line"><span class="detail-label">জেলা:</span><span class="detail-val">${escapeHtml(data.jela || "N/A")}</span></div>
                    <div class="detail-line"><span class="detail-label">বিভাগ:</span><span class="detail-val">${escapeHtml(data.vibag || "N/A")}</span></div>
                    <div class="detail-line"><span class="detail-label">ডেলিভারি এলাকা:</span><span class="detail-val">${data.deliverySite === "outside_dhaka" ? "ঢাকার বাইরে" : "ঢাকার ভেতরে"}</span></div>
                    <div class="detail-line"><span class="detail-label">ইমেইল:</span><span class="detail-val">${escapeHtml(data.email || "N/A")}</span></div>
                    <div class="detail-line"><span class="detail-label">ইউ আই ডি:</span><span class="detail-val">${data.uid}</span></div>
                    ${data.note ? `<div class="detail-line"><span class="detail-label">নোট:</span><span class="detail-val">${escapeHtml(data.note)}</span></div>` : ''}
                    <div class="detail-line"><span class="detail-label">অর্ডারের তারিখ:</span><span class="detail-val">${formattedDate.date} (${formattedDate.time})</span></div>
                </div>
            </div>

            <!-- Products List Block -->
            <div class="section-block">
                <div class="section-title">
                    <svg viewBox="0 0 24 24" class="svg-icon"><path d="M20 7h-4V4c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v3H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zM10 4h4v3h-4V4zm10 16H4V9h16v11z"/></svg>
                    <span>অর্ডারকৃত পণ্যসমূহ</span>
                </div>
                <div class="product-items-list">
                    ${renderProductItems(data.productItem)}
                </div>
            </div>

            <!-- Price Breakdown Section -->
            <div class="section-block">
                <div class="price-breakdown">
                    <div class="price-row">
                        <span>প্রোডাক্ট ডেলিভারি চার্জ:</span>
                        <span>${data.deliveryCharge || 0} টাকা</span>
                    </div>
                    <div class="price-row">
                        <span>ডেলিভারি চার্জ ছাড়া:</span>
                        <span>${data.subtotal || 0} টাকা নেওয়া হয়েছে!</span>
                    </div>
                    ${(data.discount && Number(data.discount) > 0) ? `
                    <div class="price-row">
                        <span>ডিসকাউন্ট:</span>
                        <span>${data.discount} টাকা</span>
                    </div>` : ''}
                    <div class="price-row total-row">
                        <span>সর্বমোট পরিশােধিত:</span>
                        <span>${data.total || 0} টাকা</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    ordersContainer.appendChild(card);
}

/**
 * Renders individual product items from productItem array
 */
function renderProductItems(items) {
    if (!Array.isArray(items) || items.length === 0) {
        return `<p style="font-size:12px; color:#666;">কোনো পণ্যের তথ্য পাওয়া যায়নি।</p>`;
    }

    return items.map(item => {
        const qty = item.quantity || 1;
        const fallbackImg = "https://seraproduct.com/photo/logo.png";
        
        let variantsHtml = '';
        if (Array.isArray(item.variants) && item.variants.length > 0) {
            variantsHtml = item.variants.map(v => {
                let text = `${escapeHtml(v.name || '')}: ${escapeHtml(v.value || '')}`;
                if (v.extraPrice && Number(v.extraPrice) > 0) {
                    text += ` (এই variant এর জন্য ${v.extraPrice} টাকা নেওয়া হয়েছে!)`;
                }
                return `<span class="variant-tag">${text}</span>`;
            }).join(' ');
        }

        return `
            <div class="product-item-card">
                <img src="${item.productImage || fallbackImg}" 
                     alt="${escapeHtml(item.productName || 'Product')}" 
                     class="product-img" 
                     loading="lazy" 
                     onerror="this.src='${fallbackImg}'">
                <div class="product-info">
                    <div class="product-name">${escapeHtml(item.productName || 'অজানা পণ্য')}</div>
                    <div class="product-meta">
                        <span>পরিমাণ: ${qty} টি</span>
                        ${item.warranty ? ` | <span>ওয়ারেন্টি: ${escapeHtml(item.warranty)}</span>` : ''}
                    </div>
                    ${variantsHtml ? `<div style="margin-top:2px;">${variantsHtml}</div>` : ''}
                    ${item.freeDelivery ? `<span class="badge-free-delivery">এই পণ্যটার জন্য ফ্রি ডেলিভারি!</span>` : ''}
                    <div class="product-price-summary">
                        এই প্রোডাক্টের জন্য মোট: ${item.productPrice || 0} টাকা নেওয়া হয়েছে
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

/* ==========================================================================
   Helper & Event Listeners
   ========================================================================== */

// Event Delegation for Copy Buttons and Expand Toggles
document.addEventListener("click", (e) => {
    // Copy Button Handler
    const copyBtn = e.target.closest(".copy-btn");
    if (copyBtn) {
        const textToCopy = copyBtn.getAttribute("data-copy");
        const customToast = copyBtn.getAttribute("data-toast") || "অর্ডার আইডি কপি হয়েছে!";
        if (textToCopy) {
            navigator.clipboard.writeText(textToCopy).then(() => {
                showToast(customToast);
            });
        }
        return;
    }

    // Expand Details Toggle Handler
    const toggleBtn = e.target.closest(".toggle-details-btn");
    if (toggleBtn) {
        const targetId = toggleBtn.getAttribute("data-target");
        const expandedSection = document.getElementById(targetId);
        const labelSpan = toggleBtn.querySelector("span");
        const chevron = toggleBtn.querySelector(".chevron-icon");

        if (expandedSection.classList.contains("hidden")) {
            expandedSection.classList.remove("hidden");
            labelSpan.textContent = "তথ্য লুকান";
            chevron.style.transform = "rotate(180deg)";
        } else {
            expandedSection.classList.add("hidden");
            labelSpan.textContent = "সব তথ্য দেখুন";
            chevron.style.transform = "rotate(0deg)";
        }
    }
});

// Search Box Events
orderSearchInput.addEventListener("input", (e) => {
    if (e.target.value.trim().length > 0) {
        clearSearchBtn.classList.remove("hidden");
    } else {
        clearSearchBtn.classList.add("hidden");
    }
});

orderSearchInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
        const val = orderSearchInput.value.trim();
        if (val) {
            searchOrderById(val);
        } else {
            fetchInitialOrders();
        }
    }
});

clearSearchBtn.addEventListener("click", () => {
    orderSearchInput.value = "";
    clearSearchBtn.classList.add("hidden");
    fetchInitialOrders();
});

// Status Filter Handler
statusFilter.addEventListener("change", (e) => {
    currentStatusFilter = e.target.value;
    orderSearchInput.value = "";
    clearSearchBtn.classList.add("hidden");
    fetchInitialOrders();
});

// Pagination Load More Click Handler
loadMoreBtn.addEventListener("click", () => {
    loadMoreOrders();
});

// Utility: Formatting Timestamp to Bengali Format
function formatTimestamp(timestamp) {
    if (!timestamp) return { date: "N/A", time: "N/A" };

    let dateObj;
    if (timestamp.toDate && typeof timestamp.toDate === "function") {
        dateObj = timestamp.toDate();
    } else {
        dateObj = new Date(timestamp);
    }

    if (isNaN(dateObj.getTime())) return { date: "N/A", time: "N/A" };

    const months = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
    const convertNums = (str) => str.replace(/\d/g, d => "০১২৩৪৫৬৭89"[d]);

    const day = convertNums(String(dateObj.getDate()));
    const month = months[dateObj.getMonth()];
    const year = convertNums(String(dateObj.getFullYear()));

    let hours = dateObj.getHours();
    const minutes = convertNums(String(dateObj.getMinutes()).padStart(2, '0'));
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; 
    const hoursFormatted = convertNums(String(hours));

    return {
        date: `${day} ${month} ${year}`,
        time: `${hoursFormatted}:${minutes} ${ampm}`
    };
}

// Utility: Escape HTML for XSS prevention
function escapeHtml(str) {
    if (typeof str !== "string") return str;
    return str.replace(/[&<>"']/g, (m) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    })[m]);
}
