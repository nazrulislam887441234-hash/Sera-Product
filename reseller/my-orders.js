import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    query, 
    where, 
    orderBy, 
    limit, 
    getDocs, 
    getDoc,
    doc,
    startAfter 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ==========================================
// FIREBASE CONFIGURATION
// ==========================================
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

// Application State
let currentUser = null;
let lastVisibleDoc = null;
let isLoading = false;
let hasMoreOrders = true;
let currentSearchQuery = "";
const PAGE_SIZE = 20;

// DOM Elements
const ordersContainer = document.getElementById('ordersContainer');
const loadMoreBtn = document.getElementById('loadMoreBtn');
const loadingMoreDiv = document.getElementById('loadingMore');
const emptyStateDiv = document.getElementById('emptyState');
const errorStateDiv = document.getElementById('errorState');
const errorMessageText = document.getElementById('errorMessageText');
const userEmailDisplay = document.getElementById('userEmailDisplay');
const logoutBtn = document.getElementById('logoutBtn');
const retryBtn = document.getElementById('retryBtn');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const clearSearchBtn = document.getElementById('clearSearchBtn');

// SVG Icons Repository
const ICONS = {
    user: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
    phone: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>',
    package: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"></line><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>',
    location: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>',
    shield: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>',
    wallet: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>',
    calendar: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>',
    chevron: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>',
    shoppingBag: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>'
};

// ==========================================
// INITIALIZATION & AUTH STATE HANDLER
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    handleAuthState();
    loadFooter();

    loadMoreBtn.addEventListener('click', () => {
        if (!isLoading && hasMoreOrders) {
            loadMoreOrders();
        }
    });

    searchBtn.addEventListener('click', handleSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch();
    });

    searchInput.addEventListener('input', (e) => {
        if (e.target.value.trim().length > 0) {
            clearSearchBtn.classList.remove('hidden');
        } else {
            clearSearchBtn.classList.add('hidden');
            if (currentSearchQuery !== "") {
                currentSearchQuery = "";
                loadOrders();
            }
        }
    });

    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        clearSearchBtn.classList.add('hidden');
        currentSearchQuery = "";
        loadOrders();
    });

    retryBtn.addEventListener('click', () => {
        hideError();
        loadOrders();
    });

    logoutBtn.addEventListener('click', async () => {
        try {
            await signOut(auth);
            window.location.href = "https://seraproduct.com/reseller/login";
        } catch (error) {
            console.error("Logout error:", error);
        }
    });
}

function handleAuthState() {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            if (userEmailDisplay) {
                userEmailDisplay.textContent = user.email || user.phoneNumber || "রিসেলার অ্যাকাউন্ট";
            }
            loadOrders();
        } else {
            window.location.href = "https://seraproduct.com/reseller/login";
        }
    });
}

// ==========================================
// SEARCH HANDLER
// ==========================================
async function handleSearch() {
    if (!currentUser) return;
    const queryVal = searchInput.value.trim();
    if (!queryVal) {
        currentSearchQuery = "";
        loadOrders();
        return;
    }

    currentSearchQuery = queryVal;
    showLoadingState();
    hideError();
    hideEmptyState();
    ordersContainer.innerHTML = '';

    // Check if the input looks like a Firestore Document ID (usually alphanumeric / around 20 chars)
    if (queryVal.length >= 15 && !queryVal.includes(' ')) {
        try {
            const docRef = doc(db, "reseller_orders", queryVal);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const orderData = docSnap.data();
                if (orderData.uid === currentUser.uid) {
                    const cardElement = renderOrderCard(docSnap.id, orderData);
                    ordersContainer.appendChild(cardElement);
                    loadMoreBtn.classList.add('hidden');
                    hasMoreOrders = false;
                    return;
                }
            }
        } catch (err) {
            console.log("Not a direct doc ID or search fallback needed", err);
        }
    }

    // Otherwise, perform phone number query (Paginated by 20)
    try {
        const q = query(
            collection(db, "reseller_orders"),
            where("uid", "==", currentUser.uid),
            where("customerPhone", "==", queryVal),
            orderBy("createdAt", "desc"),
            limit(PAGE_SIZE)
        );

        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            showEmptyState();
            loadMoreBtn.classList.add('hidden');
            hasMoreOrders = false;
            return;
        }

        lastVisibleDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
        hasMoreOrders = querySnapshot.docs.length === PAGE_SIZE;

        querySnapshot.forEach((docSnap) => {
            const orderData = docSnap.data();
            const cardElement = renderOrderCard(docSnap.id, orderData);
            ordersContainer.appendChild(cardElement);
        });

        if (hasMoreOrders) {
            loadMoreBtn.classList.remove('hidden');
        } else {
            loadMoreBtn.classList.add('hidden');
        }

    } catch (error) {
        console.error("Search error:", error);
        showError("সার্চ করার সময় সমস্যা হয়েছে। ফায়ারবেস ইনডেক্স প্রয়োজন হতে পারে।");
    }
}

// ==========================================
// LOAD ORDERS FROM FIRESTORE
// ==========================================
async function loadOrders() {
    if (!currentUser) return;

    showLoadingState();
    hideError();
    hideEmptyState();

    try {
        const q = query(
            collection(db, "reseller_orders"),
            where("uid", "==", currentUser.uid),
            orderBy("createdAt", "desc"),
            limit(PAGE_SIZE)
        );

        const querySnapshot = await getDocs(q);
        
        ordersContainer.innerHTML = '';

        if (querySnapshot.empty) {
            showEmptyState();
            loadMoreBtn.classList.add('hidden');
            hasMoreOrders = false;
            return;
        }

        lastVisibleDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
        hasMoreOrders = querySnapshot.docs.length === PAGE_SIZE;

        querySnapshot.forEach((docSnap) => {
            const orderData = docSnap.data();
            const orderId = docSnap.id;
            const cardElement = renderOrderCard(orderId, orderData);
            ordersContainer.appendChild(cardElement);
        });

        if (hasMoreOrders) {
            loadMoreBtn.classList.remove('hidden');
        } else {
            loadMoreBtn.classList.add('hidden');
        }

    } catch (error) {
        console.error("Error loading orders:", error);
        showError("অর্ডার লোড করতে সমস্যা হয়েছে। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।");
    }
}

async function loadMoreOrders() {
    if (!currentUser || !lastVisibleDoc || isLoading) return;

    isLoading = true;
    loadingMoreDiv.classList.remove('hidden');
    loadMoreBtn.classList.add('hidden');

    try {
        let q;
        if (currentSearchQuery) {
            q = query(
                collection(db, "reseller_orders"),
                where("uid", "==", currentUser.uid),
                where("customerPhone", "==", currentSearchQuery),
                orderBy("createdAt", "desc"),
                startAfter(lastVisibleDoc),
                limit(PAGE_SIZE)
            );
        } else {
            q = query(
                collection(db, "reseller_orders"),
                where("uid", "==", currentUser.uid),
                orderBy("createdAt", "desc"),
                startAfter(lastVisibleDoc),
                limit(PAGE_SIZE)
            );
        }

        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            hasMoreOrders = false;
            loadingMoreDiv.classList.add('hidden');
            return;
        }

        lastVisibleDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
        hasMoreOrders = querySnapshot.docs.length === PAGE_SIZE;

        querySnapshot.forEach((docSnap) => {
            const orderData = docSnap.data();
            const orderId = docSnap.id;
            const cardElement = renderOrderCard(orderId, orderData);
            ordersContainer.appendChild(cardElement);
        });

        if (hasMoreOrders) {
            loadMoreBtn.classList.remove('hidden');
        }

    } catch (error) {
        console.error("Error loading more orders:", error);
        showError("আরও অর্ডার লোড করতে সমস্যা হয়েছে।");
    } finally {
        isLoading = false;
        loadingMoreDiv.classList.add('hidden');
    }
}

// ==========================================
// RENDER ORDER CARD (INITIAL + EXPANDED)
// ==========================================
function renderOrderCard(orderId, order) {
    const card = document.createElement('div');
    card.className = 'order-card';

    const customerName = order.customerName || "নামবিহীন কাস্টমার";
    const customerPhone = order.customerPhone ? formatBanglaNumber(order.customerPhone) : "নাম্বার নেই";
    const productName = order.productName || "প্রোডাক্টের নাম নেই";
    const productImage = order.productImage || "";
    const statusObj = getOrderStatusInfo(order.orderStatus);

    let imageHtml = '';
    if (productImage) {
        imageHtml = `<img src="${escapeHtml(productImage)}" alt="${escapeHtml(productName)}" loading="lazy" onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\'product-fallback-img\\'>${ICONS.shoppingBag}</div>';">`;
    } else {
        imageHtml = `<div class="product-fallback-img">${ICONS.shoppingBag}</div>`;
    }

    // Initial Summary View with Order ID and Status displayed directly
    card.innerHTML = `
        <div class="order-summary-view">
            <div class="product-info-preview">
                <div class="product-img-box">
                    ${imageHtml}
                </div>
                <div class="product-meta-preview">
                    <div class="card-top-tags">
                        <span class="card-order-id-tag">অর্ডার আইডি: ${escapeHtml(orderId)}</span>
                        <span class="status-badge ${statusObj.className}">${statusObj.text}</span>
                    </div>
                    <h3 class="product-title-text">${escapeHtml(productName)}</h3>
                    <div class="customer-name-phone">
                        <span>${ICONS.user} ${escapeHtml(customerName)}</span>
                        <span>${ICONS.phone} ${escapeHtml(customerPhone)}</span>
                    </div>
                </div>
            </div>
            <div class="order-summary-actions">
                <button class="expand-details-btn" onclick="toggleOrderDetails(this)">
                    <span>সম্পূর্ণ তথ্য দেখুন</span>
                    ${ICONS.chevron}
                </button>
            </div>
        </div>
        <div class="order-detailed-view">
            ${renderDetailedContent(orderId, order, statusObj)}
        </div>
    `;

    return card;
}

// Toggle Order Details Accordion
window.toggleOrderDetails = function(button) {
    const card = button.closest('.order-card');
    const isExpanded = card.classList.contains('expanded');
    
    card.classList.toggle('expanded', !isExpanded);
    const spanText = button.querySelector('span');
    if (spanText) {
        spanText.textContent = isExpanded ? "সম্পূর্ণ তথ্য দেখুন" : "তথ্য লুকান";
    }
}

// ==========================================
// RENDER DETAILED CONTENT A-TO-Z
// ==========================================
function renderDetailedContent(orderId, order, statusObj) {
    const formattedDate = formatDateTime(order.createdAt);
    const deliverySiteText = getDeliverySiteText(order.deliverySite);
    const deliveryChargeStatus = order.deliveryChargeStatus === true;

    // Profit calculation: fullProducePrice - sellPrice = result
    const fullProducePrice = Number(order.fullProducePrice) || 0;
    const sellPrice = Number(order.sellPrice) || 0;
    const profitResult = fullProducePrice - sellPrice;

    return `
        <!-- Order ID Banner -->
        <div class="order-id-banner">
            <span>অর্ডার আইডি: ${escapeHtml(orderId)}</span>
            ${formattedDate ? `<span class="order-date-text">${ICONS.calendar}${formattedDate}</span>` : ''}
        </div>

        <div class="detail-sections-grid">
            <!-- 1. Customer Information -->
            <div class="detail-box">
                <div class="detail-box-title">${ICONS.user} কাস্টমারের তথ্য</div>
                <div class="detail-row">
                    <span class="detail-label">কাস্টমারের নাম:</span>
                    <span class="detail-value">${escapeHtml(order.customerName || 'N/A')}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">কাস্টমারের ফোন:</span>
                    <span class="detail-value">${escapeHtml(order.customerPhone ? formatBanglaNumber(order.customerPhone) : 'N/A')}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">কাস্টমারের বিভাগ:</span>
                    <span class="detail-value">${escapeHtml(order.customerVibag || 'N/A')}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">কাস্টমারের জেলা:</span>
                    <span class="detail-value">${escapeHtml(order.customerJela || 'N/A')}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">থানা/উপজেলা:</span>
                    <span class="detail-value">${escapeHtml(order['upojela/thana'] || 'N/A')}</span>
                </div>
                ${order.customerNote ? `
                    <div class="customer-note-box">
                        <strong>কাস্টমারের নোট:</strong> "${escapeHtml(order.customerNote)}"
                    </div>
                ` : ''}
            </div>

            <!-- 2. Product & Variant Information -->
            <div class="detail-box">
                <div class="detail-box-title">${ICONS.package} পণ্যের তথ্য ও ভ্যারিয়েন্ট</div>
                <div class="detail-row">
                    <span class="detail-label">পণ্যের নাম:</span>
                    <span class="detail-value">${escapeHtml(order.productName || 'N/A')}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">পরিমাণ:</span>
                    <span class="detail-value">পরিমাণ: ${formatBanglaNumber(order.quantity || 1)}</span>
                </div>
                ${order.warranty ? `
                    <div class="detail-row">
                        <span class="detail-label">ওয়ারেন্টি:</span>
                        <span class="detail-value">ওয়ারেন্টি: ${escapeHtml(order.warranty)}</span>
                    </div>
                ` : ''}
                ${renderVariantsHtml(order.variants)}
            </div>

            <!-- 3. Delivery & Location Information -->
            <div class="detail-box">
                <div class="detail-box-title">${ICONS.location} ডেলিভারি তথ্য</div>
                <div class="detail-row">
                    <span class="detail-label">ডেলিভারি লোকেশন:</span>
                    <span class="detail-value">${deliverySiteText}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">ডেলিভারি চার্জ:</span>
                    <span class="detail-value">${formatDeliveryCharge(order.deliveryCharge, deliveryChargeStatus)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">চার্জের অবস্থা:</span>
                    <span class="detail-value">
                        <span class="status-badge ${deliveryChargeStatus ? 'delivery-badge-true' : 'delivery-badge-false'}">
                            ${deliveryChargeStatus ? 'ডেলিভারি চার্জ অগ্রিম করা হয়েছে।' : 'ডেলিভারি চার্জ অগ্রিম দেওয়া হয়নি!'}
                        </span>
                    </span>
                </div>
            </div>

            <!-- 4. Payment & Advance Information -->
            ${deliveryChargeStatus ? `
                <div class="detail-box">
                    <div class="detail-box-title">${ICONS.wallet} পেমেন্ট ও অগ্রিম তথ্য</div>
                    ${order.transectionId ? `
                        <div class="detail-row">
                            <span class="detail-label">ট্রাঞ্জেকশন আইডি:</span>
                            <span class="detail-value">${escapeHtml(order.transectionId)}</span>
                        </div>
                    ` : ''}
                    ${order.sendMoneyNumber ? `
                        <div class="detail-row">
                            <span class="detail-label">টাকা পাঠানোর নাম্বার:</span>
                            <span class="detail-value">${escapeHtml(formatBanglaNumber(order.sendMoneyNumber))}</span>
                        </div>
                    ` : ''}
                    ${order.SendDeliveryCharge !== null && order.SendDeliveryCharge !== undefined ? `
                        <div class="detail-row">
                            <span class="detail-label">অগ্রিম পাঠানো চার্জ:</span>
                            <span class="detail-value">${formatBDT(order.SendDeliveryCharge)}</span>
                        </div>
                    ` : ''}
                </div>
            ` : `
                <div class="detail-box">
                    <div class="detail-box-title">${ICONS.wallet} পেমেন্ট তথ্য</div>
                    <div class="detail-row">
                        <span class="detail-label">পেমেন্ট পদ্ধতি:</span>
                        <span class="detail-value">ক্যাশ অন ডেলিভারি (COD)</span>
                    </div>
                </div>
            `}

            <!-- 5. Price Calculation & Summary -->
            <div class="detail-box full-width">
                <div class="detail-box-title">${ICONS.wallet} মূল্য সংক্রান্ত তথ্য</div>
                <div class="detail-row">
                    <span class="detail-label">পণ্যের দাম:</span>
                    <span class="detail-value">${formatBDT(order.productPrice)}</span>
                </div>
                ${order.originalPrice && order.originalPrice !== order.productPrice ? `
                    <div class="detail-row">
                        <span class="detail-label">মূল পণ্যের মূল্য:</span>
                        <span class="detail-value">${formatBDT(order.originalPrice)}</span>
                    </div>
                ` : ''}
                <div class="detail-row">
                    <span class="detail-label">ভ্যারিয়েন্টসহ পণ্যের মূল্য:</span>
                    <span class="detail-value">${formatBDT(order.fullProducePrice)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">সাবটোটাল (${deliveryChargeStatus ? 'প্রফিট এবং ফুল দামসহ' : 'ডেলিভারি চার্জ ও প্রফিটসহ'}):</span>
                    <span class="detail-value">${formatBDT(order.subtotal)}</span>
                </div>
                ${order.sellPrice ? `
                    <div class="detail-row">
                        <span class="detail-label">আপনার বিক্রয় মূল্য:</span>
                        <span class="detail-value">${formatBDT(order.sellPrice)}</span>
                    </div>
                ` : ''}
                
                <!-- Profit Section Added -->
                <div class="detail-row" style="background-color: #fff7ed; padding: 8px 10px; border-radius: 6px; margin-top: 6px; border: 1px solid #ffedd5;">
                    <span class="detail-label" style="font-weight: 700; color: #c2410c;">আপনার প্রফিট :</span>
                    <span class="detail-value" style="font-weight: 700; color: #c2410c;">${formatBDT(profitResult)}</span>
                </div>

                <div class="detail-row" style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #f3f4f6; font-size: 1rem;">
                    <span class="detail-label" style="font-weight: 700; color: var(--text-main);">কাস্টমারের কাছ থেকে নেওয়া হবে:</span>
                    <span class="detail-value" style="color: var(--primary); font-size: 1.1rem;">${formatBDT(order.total)}</span>
                </div>
            </div>

            <!-- 6. Current Order Status -->
            <div class="detail-box full-width">
                <div class="detail-box-title">${ICONS.shield} অর্ডারের বর্তমান অবস্থা</div>
                <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
                    <span class="detail-label">স্ট্যাটাস:</span>
                    <span class="status-badge ${statusObj.className}">${statusObj.text}</span>
                </div>
            </div>
        </div>
    `;
}

// ==========================================
// HELPER FUNCTIONS & FORMATTERS
// ==========================================
function renderVariantsHtml(variants) {
    if (!variants || typeof variants !== 'object' || Object.keys(variants).length === 0) {
        return '';
    }

    let tagsHtml = '';
    for (const [key, value] of Object.entries(variants)) {
        tagsHtml += `<span class="variant-tag">${escapeHtml(key)}: ${escapeHtml(String(value))}</span>`;
    }

    return `
        <div style="margin-top: 10px;">
            <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 4px;">ভ্যারিয়েন্টসমূহ:</div>
            <div class="variants-tags">${tagsHtml}</div>
        </div>
    `;
}

function getOrderStatusInfo(status) {
    switch (status) {
        case 'pending':
            return { text: 'অপেক্ষমান', className: 'status-pending' };
        case 'confirm':
            return { text: 'অর্ডার কনফার্ম করা হয়েছে!', className: 'status-confirm' };
        case 'processing':
            return { text: 'কুরিয়ারে পাঠানো হয়েছে!', className: 'status-processing' };
        case 'packaging':
            return { text: 'অর্ডার প্যাকেজ করা হচ্ছে!', className: 'status-packaging' };
        case 'delivery':
            return { text: 'ডেলিভারি সফল হয়েছে!', className: 'status-delivery' };
        case 'cancel':
            return { text: 'অর্ডার ক্যানসেল হয়েছে!', className: 'status-cancel' };
        case 'return':
            return { text: 'অর্ডার রিটার্ন করা হয়েছে!', className: 'status-return' };
        default:
            return { text: 'অর্ডারের বর্তমান অবস্থা আপডেট হচ্ছে', className: 'status-unknown' };
    }
}

function getDeliverySiteText(site) {
    switch (site) {
        case 'inside_dhaka':
            return 'ঢাকার ভেতরে';
        case 'outside_dhaka':
            return 'ঢাকার বাইরে';
        default:
            return 'ডেলিভারি লোকেশন নির্ধারণ করা হয়নি';
    }
}

function formatDeliveryCharge(charge, isPaid) {
    if (isPaid && (charge === null || charge === undefined || charge === 0)) {
        return 'ডেলিভারি চার্জ অগ্রিম করা হয়েছে!';
    }
    if (charge !== null && charge !== undefined) {
        return formatBDT(charge);
    }
    return 'ডেলিভারি চার্জ প্রযোজ্য নয়';
}

function formatBDT(amount) {
    if (amount === null || amount === undefined || isNaN(amount)) return '৳০';
    const formattedNum = Number(amount).toLocaleString('en-IN');
    const banglaNum = convertToBanglaDigits(formattedNum);
    return `৳${banglaNum}`;
}

function formatBanglaNumber(num) {
    if (num === null || num === undefined) return '';
    return convertToBanglaDigits(String(num));
}

function convertToBanglaDigits(str) {
    const englishDigits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    const banglaDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    let result = String(str);
    for (let i = 0; i < 10; i++) {
        result = result.replaceAll(englishDigits[i], banglaDigits[i]);
    }
    return result;
}

function formatDateTime(timestamp) {
    if (!timestamp) return null;
    try {
        let date;
        if (typeof timestamp.toDate === 'function') {
            date = timestamp.toDate();
        } else if (timestamp.seconds) {
            date = new Date(timestamp.seconds * 1000);
        } else {
            date = new Date(timestamp);
        }

        if (isNaN(date.getTime())) return null;

        const options = {
            timeZone: 'Asia/Dhaka',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        };

        const formatter = new Intl.DateTimeFormat('bn-BD', options);
        let formatted = formatter.format(date);
        
        formatted = formatted.replace('AM', 'সকাল').replace('PM', 'রাত').replace('pm', 'রাত').replace('am', 'সকাল');
        return formatted;
    } catch (e) {
        console.error("Date formatting error:", e);
        return null;
    }
}

function escapeHtml(str) {
    if (typeof str !== 'string') return str;
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

async function loadFooter() {
    const footerContainer = document.getElementById('dynamicFooter');
    try {
        const response = await fetch('https://seraproduct.com/footer');
        if (response.ok) {
            const htmlText = await response.text();
            if (htmlText && htmlText.trim().length > 0) {
                footerContainer.innerHTML = htmlText;
            }
        }
    } catch (e) {
        console.log("Using default fallback footer due to fetch restriction/failure.");
    }
}

function showLoadingState() {
    // Handled via Skeleton or spinners
}

function showEmptyState() {
    emptyStateDiv.classList.remove('hidden');
}

function hideEmptyState() {
    emptyStateDiv.classList.add('hidden');
}

function showError(msg) {
    errorMessageText.textContent = msg;
    errorStateDiv.classList.remove('hidden');
    ordersContainer.innerHTML = '';
    loadMoreBtn.classList.add('hidden');
}

function hideError() {
    errorStateDiv.classList.add('hidden');
}
