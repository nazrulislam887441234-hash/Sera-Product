import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    doc, 
    getDoc, 
    getDocs, 
    query, 
    where, 
    orderBy, 
    limit, 
    startAfter 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Firebase Config Parameters
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
const db = getFirestore(app);

// Global Application State Variables
let lastVisibleDoc = null;
let currentSearchType = 'default'; // Options: 'default', 'status', 'uid', 'orderId'
let currentSearchQuery = '';
let isFetching = false;
let activeRequestToken = 0; // Race Condition Protection Flag

// Status Dictionary
const STATUS_LABELS = {
    pending: "নতুন অর্ডার",
    confirm: "অর্ডার গ্রহণ করা হয়েছে!",
    processing: "কোরিয়ারে পাঠানো হয়েছে!",
    cancel: "অর্ডার বাতিল করা হয়েছে!",
    return: "অর্ডার রিটার্ন করা হয়েছে!",
    delivery: "অর্ডার সফল ভাবে ডেলিভারি করা হয়েছে!"
};

const STATUS_CLASSES = {
    pending: "badge-pending",
    confirm: "badge-confirm",
    processing: "badge-processing",
    cancel: "badge-cancel",
    return: "badge-return",
    delivery: "badge-delivery"
};

// DOM Elements
const ordersContainer = document.getElementById('ordersContainer');
const loadingIndicator = document.getElementById('loadingIndicator');
const paginationArea = document.getElementById('paginationArea');
const loadMoreBtn = document.getElementById('loadMoreBtn');
const noOrdersBox = document.getElementById('noOrdersBox');
const orderIdSearch = document.getElementById('orderIdSearch');
const uidSearch = document.getElementById('uidSearch');
const statusFilter = document.getElementById('statusFilter');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const filterStatusBanner = document.getElementById('filterStatusBanner');

// SVG Icon Helpers
const COPY_SVG = `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>`;

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    loadFooter();
    setupEventListeners();
    fetchOrders(true);
});

// Event Listeners Setup
function setupEventListeners() {
    // Order ID Search with Debounce
    let orderDebounce;
    orderIdSearch.addEventListener('input', (e) => {
        clearTimeout(orderDebounce);
        const val = e.target.value.trim();
        orderDebounce = setTimeout(() => {
            if (val) {
                uidSearch.value = '';
                statusFilter.value = 'all';
                currentSearchType = 'orderId';
                currentSearchQuery = val;
                fetchOrders(true);
            } else if (currentSearchType === 'orderId') {
                resetFilters();
            }
        }, 600);
    });

    // UID Search with Debounce
    let uidDebounce;
    uidSearch.addEventListener('input', (e) => {
        clearTimeout(uidDebounce);
        const val = e.target.value.trim();
        uidDebounce = setTimeout(() => {
            if (val) {
                orderIdSearch.value = '';
                statusFilter.value = 'all';
                currentSearchType = 'uid';
                currentSearchQuery = val;
                fetchOrders(true);
            } else if (currentSearchType === 'uid') {
                resetFilters();
            }
        }, 600);
    });

    // Status Filter Change
    statusFilter.addEventListener('change', (e) => {
        const val = e.target.value;
        orderIdSearch.value = '';
        uidSearch.value = '';
        if (val !== 'all') {
            currentSearchType = 'status';
            currentSearchQuery = val;
        } else {
            currentSearchType = 'default';
            currentSearchQuery = '';
        }
        fetchOrders(true);
    });

    // Load More Button
    loadMoreBtn.addEventListener('click', () => {
        if (!isFetching) fetchOrders(false);
    });

    // Clear Search Filters Button
    clearSearchBtn.addEventListener('click', () => {
        resetFilters();
    });
}

function resetFilters() {
    orderIdSearch.value = '';
    uidSearch.value = '';
    statusFilter.value = 'all';
    currentSearchType = 'default';
    currentSearchQuery = '';
    fetchOrders(true);
}

// Fetch Footer Dynamically
async function loadFooter() {
    try {
        const response = await fetch('https://seraproduct.com/footer');
        if (response.ok) {
            const html = await response.text();
            document.getElementById('footer-container').innerHTML = html;
        }
    } catch (err) {
        console.error("Footer load error:", err);
    }
}

// Main Data Fetching Manager
async function fetchOrders(isNewQuery = false) {
    if (isFetching) return;
    
    isFetching = true;
    const requestToken = ++activeRequestToken;

    if (isNewQuery) {
        ordersContainer.innerHTML = '';
        lastVisibleDoc = null;
        noOrdersBox.style.display = 'none';
        paginationArea.style.display = 'none';
    }

    loadingIndicator.style.display = 'block';
    updateFilterBanner();

    try {
        if (currentSearchType === 'orderId') {
            await fetchSingleOrderById(currentSearchQuery, requestToken);
        } else {
            await fetchPaginatedOrders(isNewQuery, requestToken);
        }
    } catch (error) {
        console.error("Firestore Query Error:", error);
        if (requestToken === activeRequestToken && isNewQuery) {
            noOrdersBox.style.display = 'block';
        }
    } finally {
        if (requestToken === activeRequestToken) {
            loadingIndicator.style.display = 'none';
            isFetching = false;
        }
    }
}

// Fetch Exact Document Lookup (Order ID)
async function fetchSingleOrderById(orderId, token) {
    const docRef = doc(db, "orders", orderId);
    const snapshot = await getDoc(docRef);

    if (token !== activeRequestToken) return;

    if (snapshot.exists()) {
        renderOrderCard(snapshot.data(), snapshot.id);
        noOrdersBox.style.display = 'none';
    } else {
        noOrdersBox.style.display = 'block';
    }
    paginationArea.style.display = 'none';
}

// Fetch Paginated Collections (Default, Status, UID)
async function fetchPaginatedOrders(isNewQuery, token) {
    let q;
    const constraints = [];

    if (currentSearchType === 'status') {
        constraints.push(where("status", "==", currentSearchQuery));
        constraints.push(orderBy("createdAt", "desc"));
    } else if (currentSearchType === 'uid') {
        constraints.push(where("uid", "==", currentSearchQuery));
        constraints.push(orderBy("createdAt", "desc"));
    } else {
        constraints.push(orderBy("createdAt", "desc"));
    }

    if (lastVisibleDoc) {
        constraints.push(startAfter(lastVisibleDoc));
    }

    constraints.push(limit(20));

    q = query(collection(db, "orders"), ...constraints);
    const querySnapshot = await getDocs(q);

    if (token !== activeRequestToken) return;

    if (!querySnapshot.empty) {
        lastVisibleDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
        querySnapshot.forEach(docSnap => {
            renderOrderCard(docSnap.data(), docSnap.id);
        });

        if (querySnapshot.docs.length === 20) {
            paginationArea.style.display = 'block';
        } else {
            paginationArea.style.display = 'none';
        }
        noOrdersBox.style.display = 'none';
    } else {
        if (isNewQuery) {
            noOrdersBox.style.display = 'block';
        }
        paginationArea.style.display = 'none';
    }
}

// Render Order Card DOM
function renderOrderCard(order, docId) {
    const card = document.createElement('article');
    card.className = 'order-card';

    const orderIdVal = order.orderId || docId || 'N/A';
    const nameVal = order.name || 'N/A';
    const phoneVal = order.phone || '';
    const statusKey = (order.status || '').toLowerCase();
    const statusText = STATUS_LABELS[statusKey] || 'অজানা স্ট্যাটাস';
    const statusBadgeClass = STATUS_CLASSES[statusKey] || 'badge-unknown';

    card.innerHTML = `
        <div class="order-card-header">
            <div class="card-top-row">
                <div class="order-id-badge">
                    <span>অর্ডার আইডি: ${escapeHtml(orderIdVal)}</span>
                    <button class="copy-btn" title="কপি করুন" data-copy="${escapeHtml(orderIdVal)}" data-msg="অর্ডার আইডি কপি হয়েছে!">
                        ${COPY_SVG}
                    </button>
                </div>
                <div class="status-badge ${statusBadgeClass}">
                    ${escapeHtml(statusText)}
                </div>
            </div>

            <div class="customer-basic-info">
                <div class="info-item">
                    <strong>কাস্টমারের নাম:</strong> ${escapeHtml(nameVal)}
                </div>
                <div class="info-item">
                    <strong>কাস্টমারের ফোন:</strong> 
                    ${phoneVal ? `
                        <a href="tel:${escapeHtml(phoneVal)}" class="clickable-phone">${escapeHtml(phoneVal)}</a>
                        <button class="copy-btn" title="ফোন নম্বর কপি" data-copy="${escapeHtml(phoneVal)}" data-msg="ফোন নম্বর কপি হয়েছে!">
                            ${COPY_SVG}
                        </button>
                    ` : 'ফোন নম্বর নেই'}
                </div>
            </div>

            <div class="card-action-bar">
                <button class="btn btn-primary toggle-expand-btn">
                    <svg class="btn-svg" viewBox="0 0 24 24"><path d="M12 5.83L15.17 9l1.41-1.41L12 3 7.41 7.59 8.83 9 12 5.83zm0 12.34L8.83 15l-1.41 1.41L12 21l4.59-4.59L15.17 15 12 18.17z"/></svg>
                    <span>সব তথ্য দেখুন</span>
                </button>
            </div>
        </div>

        <div class="order-card-expanded">
            <!-- Full Expanded Order Details Rendered Dynamically -->
        </div>
    `;

    // Copy Handler
    card.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const textToCopy = btn.getAttribute('data-copy');
            const msg = btn.getAttribute('data-msg');
            copyToClipboard(textToCopy, msg);
        });
    });

    // Expand / Collapse Handler
    const expandBtn = card.querySelector('.toggle-expand-btn');
    const expandedArea = card.querySelector('.order-card-expanded');
    let isExpanded = false;

    expandBtn.addEventListener('click', () => {
        isExpanded = !isExpanded;
        if (isExpanded) {
            if (!expandedArea.hasChildNodes()) {
                expandedArea.innerHTML = renderExpandedContent(order, orderIdVal);
                attachExpandedEvents(expandedArea);
            }
            expandedArea.style.display = 'block';
            expandBtn.querySelector('span').textContent = 'তথ্য বন্ধ করুন';
            expandBtn.classList.replace('btn-primary', 'btn-secondary');
        } else {
            expandedArea.style.display = 'none';
            expandBtn.querySelector('span').textContent = 'সব তথ্য দেখুন';
            expandBtn.classList.replace('btn-secondary', 'btn-primary');
        }
    });

    ordersContainer.appendChild(card);
}

// Generate Full Expanded Details Section
function renderExpandedContent(order, orderIdVal) {
    const deliverySiteText = order.deliverySite === 'outside_dhaka' ? 'ঢাকার বাইরে' :
                             order.deliverySite === 'inside_dhaka' ? 'ঢাকার ভেতরে' : (order.deliverySite || 'N/A');
    
    const formattedDate = formatBengaliDateTime(order.createdAt);
    const noteText = order.note && order.note.trim() !== '' ? order.note : 'কোনো নোট নেই';
    const emailText = order.email || 'ইমেইল নেই';
    const uidVal = order.uid || 'ইউ আই ডি নেই';

    // Products Generation
    let productsHTML = '';
    if (Array.isArray(order.productItem) && order.productItem.length > 0) {
        productsHTML = order.productItem.map(prod => {
            const imgUrl = prod.productImage || 'https://seraproduct.com/photo/logo.png';
            const name = prod.productName || 'পণ্যের নাম নেই';
            const qty = prod.quantity ? `${prod.quantity}টি` : '১টি';
            const price = prod.productPrice !== undefined ? prod.productPrice : 0;
            const freeDeliveryTag = prod.freeDelivery === true ? `<span class="tag tag-free-delivery">এই পণ্যটার জন্য ফ্রি ডেলিভারি!</span>` : '';
            const warrantyTag = prod.warranty && prod.warranty.trim() !== '' ? `<span class="tag tag-warranty">ওয়ারেন্টি: ${escapeHtml(prod.warranty)}</span>` : '';

            // Variants Render
            let variantsHTML = '';
            if (Array.isArray(prod.variants) && prod.variants.length > 0) {
                variantsHTML = prod.variants.map(v => {
                    const vName = v.name || 'ভেরিয়েন্ট';
                    const vVal = v.value || '';
                    const vExtra = v.extraPrice && Number(v.extraPrice) > 0 
                        ? `<div>এই variant এর জন্য ${v.extraPrice} টাকা নেওয়া হয়েছে!</div>` 
                        : '';
                    return `<div class="variant-box"><strong>${escapeHtml(vName)}:</strong> ${escapeHtml(vVal)}${vExtra}</div>`;
                }).join('');
            }

            return `
                <div class="product-item-card">
                    <img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(name)}" class="product-img" loading="lazy" onerror="this.src='https://seraproduct.com/photo/logo.png'">
                    <div class="product-details">
                        <div class="product-name">${escapeHtml(name)}</div>
                        <div><strong>পরিমাণ:</strong> ${escapeHtml(qty)}</div>
                        <div class="product-tags">${freeDeliveryTag}${warrantyTag}</div>
                        ${variantsHTML}
                        <div class="product-price-info">এই প্রোডাক্টের জন্য মোট: ${price} টাকা নেওয়া হয়েছে</div>
                    </div>
                </div>
            `;
        }).join('');
    } else {
        productsHTML = '<p>কোনো পণ্য পাওয়া যায়নি!</p>';
    }

    // Financial Calculation Summary
    const deliveryChargeVal = order.deliveryCharge !== undefined ? order.deliveryCharge : 0;
    const subtotalVal = order.subtotal !== undefined ? order.subtotal : 0;
    const discountVal = order.discount !== undefined ? order.discount : 0;
    const totalVal = order.total !== undefined ? order.total : 0;

    return `
        <!-- Customer Details -->
        <div class="expanded-section">
            <h4 class="section-title">কাস্টমার তথ্য</h4>
            <div class="details-grid">
                <div class="detail-row"><strong>কাস্টমারের নাম:</strong> ${escapeHtml(order.name || 'N/A')}</div>
                <div class="detail-row">
                    <strong>কাস্টমারের ফোন:</strong> 
                    ${order.phone ? `<a href="tel:${escapeHtml(order.phone)}" class="clickable-phone">${escapeHtml(order.phone)}</a>` : 'N/A'}
                </div>
                <div class="detail-row">
                    <strong>ইমেইল:</strong> 
                    ${order.email ? `<a href="mailto:${escapeHtml(emailText)}">${escapeHtml(emailText)}</a>` : 'ইমেইল নেই'}
                </div>
                <div class="detail-row">
                    <strong>ইউ আই ডি:</strong> ${escapeHtml(uidVal)}
                    ${order.uid ? `<button class="copy-btn" data-copy="${escapeHtml(order.uid)}" data-msg="ইউ আই ডি কপি হয়েছে!">${COPY_SVG}</button>` : ''}
                </div>
                <div class="detail-row"><strong>উপজেলা/থানা:</strong> ${escapeHtml(order.thana || 'N/A')}</div>
                <div class="detail-row"><strong>জেলা:</strong> ${escapeHtml(order.jela || 'N/A')}</div>
                <div class="detail-row"><strong>বিভাগ:</strong> ${escapeHtml(order.vibag || 'N/A')}</div>
                <div class="detail-row"><strong>ডেলিভারি লোকেশন:</strong> ${escapeHtml(deliverySiteText)}</div>
                <div class="detail-row" style="grid-column: 1 / -1;"><strong>নোট:</strong> ${escapeHtml(noteText)}</div>
                <div class="detail-row" style="grid-column: 1 / -1;"><strong>তারিখ ও সময়:</strong> ${escapeHtml(formattedDate)}</div>
            </div>
        </div>

        <!-- Product List -->
        <div class="expanded-section">
            <h4 class="section-title">পণ্যের তালিকা</h4>
            <div class="product-list">
                ${productsHTML}
            </div>
        </div>

        <!-- Price Summary -->
        <div class="expanded-section">
            <div class="summary-card">
                <div class="summary-row">
                    <span>প্রোডাক্ট ডেলিভারি চার্জ:</span>
                    <span>${deliveryChargeVal} টাকা</span>
                </div>
                <div class="summary-row">
                    <span>ডেলিভারি চার্জ ছাড়া:</span>
                    <span>${subtotalVal} টাকা</span>
                </div>
                ${discountVal > 0 ? `
                <div class="summary-row">
                    <span>ডিসকাউন্ট:</span>
                    <span>-${discountVal} টাকা</span>
                </div>` : ''}
                <div class="summary-row total-row">
                    <span>সর্বমোট:</span>
                    <span>${totalVal} টাকা</span>
                </div>
            </div>
        </div>
    `;
}

// Attach Event Handlers for Copy Buttons inside Expanded View
function attachExpandedEvents(container) {
    container.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const text = btn.getAttribute('data-copy');
            const msg = btn.getAttribute('data-msg');
            copyToClipboard(text, msg);
        });
    });
}

// Update Active Filter Notice UI
function updateFilterBanner() {
    if (currentSearchType === 'default') {
        filterStatusBanner.style.display = 'none';
        clearSearchBtn.style.display = 'none';
    } else {
        filterStatusBanner.style.display = 'block';
        clearSearchBtn.style.display = 'inline-flex';
        
        if (currentSearchType === 'orderId') {
            filterStatusBanner.innerHTML = `ফিল্টার যুক্ত: <strong>অর্ডার আইডি (${escapeHtml(currentSearchQuery)})</strong>`;
        } else if (currentSearchType === 'uid') {
            filterStatusBanner.innerHTML = `ফিল্টার যুক্ত: <strong>ইউ আই ডি (${escapeHtml(currentSearchQuery)})</strong>`;
        } else if (currentSearchType === 'status') {
            const label = STATUS_LABELS[currentSearchQuery] || currentSearchQuery;
            filterStatusBanner.innerHTML = `ফিল্টার যুক্ত: <strong>স্ট্যাটাস (${escapeHtml(label)})</strong>`;
        }
    }
}

// Reusable Copy to Clipboard Function
function copyToClipboard(text, successMessage) {
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            showToast(successMessage);
        }).catch(() => {
            fallbackCopy(text, successMessage);
        });
    } else {
        fallbackCopy(text, successMessage);
    }
}

function fallbackCopy(text, successMessage) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
        document.execCommand('copy');
        showToast(successMessage);
    } catch (err) {
        console.error('Copy failed', err);
    }
    document.body.removeChild(textArea);
}

// Custom Toast System
function showToast(message) {
    const toast = document.getElementById('toastNotification');
    const msgSpan = document.getElementById('toastMessage');
    msgSpan.textContent = message;
    toast.style.display = 'flex';
    
    setTimeout(() => {
        toast.style.display = 'none';
    }, 2500);
}

// Safe HTML Escaping
function escapeHtml(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/[&<>"']/g, function(m) {
        return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        }[m];
    });
}

// Date & Time Parsing for Bangladesh Locale (Asia/Dhaka)
function formatBengaliDateTime(createdAt) {
    if (!createdAt) return 'তারিখ উপলব্ধ নেই';
    
    let dateObj;
    if (typeof createdAt.toDate === 'function') {
        dateObj = createdAt.toDate();
    } else if (createdAt.seconds) {
        dateObj = new Date(createdAt.seconds * 1000);
    } else {
        dateObj = new Date(createdAt);
    }

    if (isNaN(dateObj.getTime())) return 'তারিখ উপলব্ধ নেই';

    try {
        const dateOptions = {
            timeZone: 'Asia/Dhaka',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        };
        const timeOptions = {
            timeZone: 'Asia/Dhaka',
            hour: 'numeric',
            minute: 'numeric',
            hour12: true
        };

        const dateStr = new Intl.DateTimeFormat('bn-BD', dateOptions).format(dateObj);
        const timeStr = new Intl.DateTimeFormat('bn-BD', timeOptions).format(dateObj);

        return `অর্ডারের তারিখ: ${dateStr} | সময়: ${timeStr}`;
    } catch (e) {
        return dateObj.toLocaleString('bn-BD');
    }
}
