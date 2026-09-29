// ==========================================================================
// Firebase Modular Imports
// ==========================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
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
    startAfter, 
    arrayUnion, 
    setDoc,
    onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ==========================================================================
// Configuration & Constants
// ==========================================================================
const CART_PAGE_URL = "/cart";
const LOGIN_PAGE_URL = "https://seraproduct.com/login";
const CHECKOUT_PAGE_URL = "https://seraproduct.com/checkout";
const FOOTER_API_URL = "https://seraproduct.com/footer";
const PRODUCT_PAGE_BASE = "https://seraproduct.com/product?";

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

// ==========================================================================
// Application State
// ==========================================================================
let currentUser = null;
let userCartProductIds = new Set();
let lastVisibleDoc = null;
let isLoadingProducts = false;
let cartUnsubscribe = null;
const activeSliders = new Map(); // Stores interval IDs for image sliders

// SVG Icons Cache
const SVG_ICONS = {
    cart: `<svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>`,
    flash: `<svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`,
    placeholder: `<svg viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`
};

// ==========================================================================
// DOM Elements Cache
// ==========================================================================
const productsGrid = document.getElementById("products-grid");
const loadMoreBtn = document.getElementById("load-more-btn");
const noMoreMsg = document.getElementById("no-more-msg");
const emptyState = document.getElementById("empty-state");
const cartBadge = document.getElementById("cart-badge");
const cartIconBtn = document.getElementById("cart-icon-btn");
const globalLoading = document.getElementById("global-loading");
const customModal = document.getElementById("custom-modal");
const modalBody = document.getElementById("modal-body");
const modalCloseBtn = document.getElementById("modal-close-btn");
const toastContainer = document.getElementById("toast-container");
const footerContainer = document.getElementById("footer-container");

// ==========================================================================
// Formatting Helper Functions
// ==========================================================================
function formatCurrency(amount) {
    const num = Number(amount) || 0;
    return `৳ ${num.toLocaleString('bn-BD')}`;
}

// ==========================================================================
// UI System: Loading, Modals & Toasts
// ==========================================================================
function showLoading() {
    globalLoading.classList.remove("hidden");
}

function hideLoading() {
    globalLoading.classList.add("hidden");
}

function showModal(contentHtml) {
    modalBody.innerHTML = contentHtml;
    customModal.classList.remove("hidden");
    customModal.setAttribute("aria-hidden", "false");
}

function closeModal() {
    customModal.classList.add("hidden");
    customModal.setAttribute("aria-hidden", "true");
    modalBody.innerHTML = "";
}

modalCloseBtn.addEventListener("click", closeModal);
customModal.addEventListener("click", (e) => {
    if (e.target === customModal) closeModal();
});

function showToast(message) {
    const toast = document.createElement("div");
    toast.className = "toast-item";
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

function showNoticeModal(title, description, isSuccess = true) {
    const iconClass = isSuccess ? "success" : "error";
    const iconSvg = isSuccess 
        ? `<svg class="modal-notice-icon ${iconClass}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`
        : `<svg class="modal-notice-icon ${iconClass}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`;

    const html = `
        <div class="modal-notice">
            ${iconSvg}
            <h3 class="modal-notice-title">${title}</h3>
            <p class="modal-notice-desc">${description}</p>
            <button id="modal-notice-ok" class="btn-modal btn-modal-submit" style="width: 100%;">ঠিক আছে</button>
        </div>
    `;
    showModal(html);
    document.getElementById("modal-notice-ok").addEventListener("click", closeModal);
}

// ==========================================================================
// Authentication & Cart Realtime Listener
// ==========================================================================
function initAuthAndCart() {
    cartIconBtn.href = CART_PAGE_URL;

    onAuthStateChanged(auth, (user) => {
        currentUser = user;
        if (user) {
            setupCartListener(user.uid);
        } else {
            if (cartUnsubscribe) cartUnsubscribe();
            userCartProductIds.clear();
            updateCartBadge(0);
            refreshAllProductButtons();
        }
    });
}

function setupCartListener(uid) {
    if (cartUnsubscribe) cartUnsubscribe();

    const cartDocRef = doc(db, "carts", uid);
    cartUnsubscribe = onSnapshot(cartDocRef, (docSnap) => {
        userCartProductIds.clear();
        if (docSnap.exists()) {
            const data = docSnap.data();
            const items = Array.isArray(data.productItem) ? data.productItem : [];
            updateCartBadge(items.length);
            
            items.forEach(item => {
                if (item.productId) {
                    userCartProductIds.add(item.productId);
                }
            });
        } else {
            updateCartBadge(0);
        }
        refreshAllProductButtons();
    }, (error) => {
        console.error("Cart realtime error:", error);
    });
}

function updateCartBadge(count) {
    cartBadge.textContent = count;
}

// ==========================================================================
// Fetching Products from Firestore
// Firestore Composite Index Requirement Note:
// Collection: "products"
// Fields: active ASC, createdAt DESC
// ==========================================================================
async function fetchProducts(isFirstLoad = false) {
    if (isLoadingProducts) return;
    isLoadingProducts = true;

    if (isFirstLoad) {
        showLoading();
        productsGrid.innerHTML = "";
        lastVisibleDoc = null;
    } else {
        setLoadMoreState(true);
    }

    try {
        let q;
        if (isFirstLoad) {
            q = query(
                collection(db, "products"),
                where("active", "==", true),
                orderBy("createdAt", "desc"),
                limit(20)
            );
        } else {
            q = query(
                collection(db, "products"),
                where("active", "==", true),
                orderBy("createdAt", "desc"),
                startAfter(lastVisibleDoc),
                limit(20)
            );
        }

        const querySnapshot = await getDocs(q);
        
        if (isFirstLoad && querySnapshot.empty) {
            emptyState.classList.remove("hidden");
            loadMoreBtn.classList.add("hidden");
            noMoreMsg.classList.add("hidden");
        } else {
            emptyState.classList.add("hidden");

            if (!querySnapshot.empty) {
                lastVisibleDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
                
                querySnapshot.forEach((docSnap) => {
                    const productData = docSnap.data();
                    const productObj = { id: docSnap.id, ...productData };
                    renderProductCard(productObj);
                });
            }

            if (querySnapshot.docs.length < 20) {
                loadMoreBtn.classList.add("hidden");
                if (!isFirstLoad || querySnapshot.docs.length > 0) {
                    noMoreMsg.classList.remove("hidden");
                }
            } else {
                loadMoreBtn.classList.remove("hidden");
                noMoreMsg.classList.add("hidden");
            }
        }
    } catch (error) {
        console.error("Error fetching products:", error);
        showNoticeModal("ত্রুটি", "পণ্য লোড করতে সমস্যা হয়েছে। ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।", false);
    } finally {
        isLoadingProducts = false;
        if (isFirstLoad) hideLoading();
        setLoadMoreState(false);
    }
}

function setLoadMoreState(isLoading) {
    const btnText = loadMoreBtn.querySelector(".btn-text");
    const btnSpinner = loadMoreBtn.querySelector(".btn-spinner");
    if (isLoading) {
        btnText.textContent = "লোড হচ্ছে...";
        btnSpinner.classList.remove("hidden");
        loadMoreBtn.disabled = true;
    } else {
        btnText.textContent = "আরোও দেখুন";
        btnSpinner.classList.add("hidden");
        loadMoreBtn.disabled = false;
    }
}

// ==========================================================================
// Product Card Rendering & Interactions
// ==========================================================================
function renderProductCard(product) {
    const card = document.createElement("div");
    card.className = "product-card";
    card.dataset.productId = product.id;

    // Card Click -> Open product page in new tab
    card.addEventListener("click", (e) => {
        if (e.target.closest(".card-actions")) return; // Exclude button clicks
        if (product.productSlug) {
            const productUrl = `${PRODUCT_PAGE_BASE}${product.productSlug}`;
            window.open(productUrl, "_blank");
        }
    });

    // Image & Slider Setup
    const images = Array.isArray(product.image) && product.image.length > 0 ? product.image : [];
    let sliderHtml = "";
    
    if (images.length === 0) {
        sliderHtml = `<div class="slider-container" style="display:flex;align-items:center;justify-content:center;">${SVG_ICONS.placeholder}</div>`;
    } else {
        const imgElements = images.map((imgUrl, idx) => 
            `<img src="${imgUrl}" alt="${product.productName || 'Product Image'}" class="slider-img ${idx === 0 ? 'active' : ''}" loading="lazy" />`
        ).join("");
        sliderHtml = `<div class="slider-container" id="slider-${product.id}">${imgElements}</div>`;
    }

    // Free Delivery Badge
    const freeDeliveryHtml = product.freeDelivery === true 
        ? `<div class="free-delivery-badge">ডেলিভারি ফ্রি!</div>` 
        : "";

    // Discount Calculation
    const custPrice = Number(product.customerPrice) || 0;
    const oldPrice = Number(product.customerOldPrice) || 0;
    let oldPriceHtml = "";

    if (oldPrice > custPrice) {
        const discountAmount = oldPrice - custPrice;
        const discountPercent = Math.round((discountAmount / oldPrice) * 100);
        oldPriceHtml = `
            <div class="old-price-line">
                <span class="old-price">${formatCurrency(oldPrice)}</span>
                <span class="savings-tag">সাশ্রয়: ${formatCurrency(discountAmount)}</span>
                <span class="discount-badge">${discountPercent}% ছাড়</span>
            </div>
        `;
    }

    card.innerHTML = `
        <div class="card-media-wrapper">
            ${freeDeliveryHtml}
            ${sliderHtml}
        </div>
        <div class="card-body">
            <h2 class="product-title">${product.productName || 'অনামক পণ্য'}</h2>
            <div class="price-section">
                <div class="current-price">${formatCurrency(custPrice)}</div>
                ${oldPriceHtml}
            </div>
            <div class="card-actions" id="actions-${product.id}">
                ${renderCardButtonsHtml(product.id)}
            </div>
        </div>
    `;

    productsGrid.appendChild(card);

    // Initialize Auto Slider if multiple images exist
    if (images.length > 1) {
        initAutoSlider(product.id, images.length);
    }

    // Attach Action Events
    attachButtonListeners(card, product);
}

function renderCardButtonsHtml(productId) {
    const isAlreadyInCart = userCartProductIds.has(productId);

    if (isAlreadyInCart) {
        return `
            <div class="cart-added-msg">এই পণ্যটা কার্টে যোগ করা আছে!</div>
            <button class="btn-action btn-order-now btn-order-event">
                ${SVG_ICONS.flash}
                <span>এখনই অর্ডার করুন</span>
            </button>
        `;
    } else {
        return `
            <button class="btn-action btn-order-now btn-order-event">
                ${SVG_ICONS.flash}
                <span>এখনই অর্ডার করুন</span>
            </button>
            <button class="btn-action btn-add-cart btn-cart-event">
                ${SVG_ICONS.cart}
                <span>কার্টে যোগ করুন</span>
            </button>
        `;
    }
}

function refreshAllProductButtons() {
    const cards = productsGrid.querySelectorAll(".product-card");
    cards.forEach(card => {
        const productId = card.dataset.productId;
        const actionsContainer = card.querySelector(`#actions-${productId}`);
        if (actionsContainer) {
            actionsContainer.innerHTML = renderCardButtonsHtml(productId);
        }
    });
}

function attachButtonListeners(card, product) {
    card.addEventListener("click", (e) => {
        const orderBtn = e.target.closest(".btn-order-event");
        const cartBtn = e.target.closest(".btn-cart-event");

        if (orderBtn) {
            e.stopPropagation();
            handleActionClick(product, "order");
        } else if (cartBtn) {
            e.stopPropagation();
            handleActionClick(product, "cart");
        }
    });
}

function initAutoSlider(productId, imageCount) {
    if (activeSliders.has(productId)) {
        clearInterval(activeSliders.get(productId));
    }

    let currentIndex = 0;
    const intervalId = setInterval(() => {
        const container = document.getElementById(`slider-${productId}`);
        if (!container) {
            clearInterval(intervalId);
            activeSliders.delete(productId);
            return;
        }

        const imgs = container.querySelectorAll(".slider-img");
        if (imgs.length === 0) return;

        imgs[currentIndex].classList.remove("active");
        currentIndex = (currentIndex + 1) % imageCount;
        imgs[currentIndex].classList.add("active");
    }, 3500); // 3.5 Seconds

    activeSliders.set(productId, intervalId);
}

// ==========================================================================
// Product Actions (Cart & Checkout Flow)
// ==========================================================================
async function handleActionClick(product, actionType) {
    // 1. Auth Check
    if (!currentUser) {
        window.location.href = LOGIN_PAGE_URL;
        return;
    }

    const isAlreadyInCart = userCartProductIds.has(product.id);

    // 2. If already in cart and clicking "Order Now", direct redirect to checkout
    if (isAlreadyInCart && actionType === "order") {
        window.location.href = CHECKOUT_PAGE_URL;
        return;
    }

    // 3. Variant Check
    const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;

    if (hasVariants) {
        openVariantModal(product, actionType);
    } else {
        // Direct save without variants
        await executeAddToCart(product, [], actionType);
    }
}

function openVariantModal(product, actionType) {
    const variants = product.variants;
    
    let groupsHtml = variants.map((group, groupIdx) => {
        const optionsHtml = (group.values || []).map((valObj, valIdx) => {
            const extraText = valObj.extraPrice > 0 ? ` (+${formatCurrency(valObj.extraPrice)})` : '';
            const isChecked = valIdx === 0 ? 'checked' : '';
            return `
                <label class="variant-label">
                    <input type="radio" name="variant_group_${groupIdx}" value="${valIdx}" class="variant-input" ${isChecked} />
                    <span>${valObj.value}${extraText}</span>
                </label>
            `;
        }).join("");

        return `
            <div class="variant-group">
                <div class="variant-group-name">${group.name}</div>
                <div class="variant-options">${optionsHtml}</div>
            </div>
        `;
    }).join("");

    const modalHtml = `
        <div class="variant-modal-title">পণ্যের অপশন নির্বাচন করুন</div>
        <form id="variant-form">
            ${groupsHtml}
            <div class="variant-actions">
                <button type="button" id="variant-cancel-btn" class="btn-modal btn-modal-cancel">বাতিল</button>
                <button type="submit" class="btn-modal btn-modal-submit">
                    ${actionType === 'order' ? 'অর্ডার করুন' : 'কার্টে যোগ করুন'}
                </button>
            </div>
        </form>
    `;

    showModal(modalHtml);

    document.getElementById("variant-cancel-btn").addEventListener("click", closeModal);

    document.getElementById("variant-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const selectedVariants = [];
        let isValid = true;

        variants.forEach((group, groupIdx) => {
            const selectedRadio = document.querySelector(`input[name="variant_group_${groupIdx}"]:checked`);
            if (!selectedRadio) {
                isValid = false;
                return;
            }
            const valIdx = parseInt(selectedRadio.value, 10);
            const valObj = group.values[valIdx];

            selectedVariants.push({
                name: group.name,
                value: valObj.value,
                extraPrice: Number(valObj.extraPrice) || 0
            });
        });

        if (!isValid) {
            showToast("অনুগ্রহ করে সবকটি অপশন নির্বাচন করুন।");
            return;
        }

        closeModal();
        await executeAddToCart(product, selectedVariants, actionType);
    });
}

async function executeAddToCart(product, selectedVariants, actionType) {
    showLoading();

    try {
        // Price calculation
        const basePrice = Number(product.customerPrice) || 0;
        const extraSum = selectedVariants.reduce((sum, v) => sum + (Number(v.extraPrice) || 0), 0);
        const finalPrice = basePrice + extraSum;

        // Construct clean cart item
        const firstImage = Array.isArray(product.image) && product.image.length > 0 ? product.image[0] : "";
        
        const cartObject = {
            productId: product.id,
            productName: product.productName || "",
            productImage: firstImage,
            productPrice: finalPrice,
            freeDelivery: product.freeDelivery === true,
            variants: selectedVariants
        };

        // Add warranty field conditionally
        if (product.warranty !== undefined && product.warranty !== null && String(product.warranty).trim() !== "") {
            cartObject.warranty = String(product.warranty);
        }

        const userCartRef = doc(db, "carts", currentUser.uid);
        
        // Save to Firestore using arrayUnion
        await setDoc(userCartRef, {
            productItem: arrayUnion(cartObject)
        }, { merge: true });

        hideLoading();

        if (actionType === "cart") {
            showNoticeModal("সফল!", "পণ্যটি কার্টে যোগ করা হয়েছে!", true);
        } else if (actionType === "order") {
            window.location.href = CHECKOUT_PAGE_URL;
        }

    } catch (error) {
        console.error("Cart save error:", error);
        hideLoading();
        showNoticeModal("ত্রুটি", "পণ্যটি কার্টে যোগ করা যায়নি। আবার চেষ্টা করুন।", false);
    }
}

// ==========================================================================
// Footer Fetching
// ==========================================================================
async function loadFooter() {
    try {
        const response = await fetch(FOOTER_API_URL);
        if (response.ok) {
            const footerHtml = await response.text();
            footerContainer.innerHTML = footerHtml;
        }
    } catch (error) {
        console.error("Error loading footer:", error);
    }
}

// ==========================================================================
// Application Initialization
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
    initAuthAndCart();
    fetchProducts(true);
    loadFooter();

    loadMoreBtn.addEventListener("click", () => {
        fetchProducts(false);
    });
});
