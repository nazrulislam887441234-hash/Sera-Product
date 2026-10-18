import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";

import {
    getFirestore,
    collection,
    query,
    where,
    orderBy,
    limit,
    startAfter,
    getDocs
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const FOOTER_API_URL = "https://seraproduct.com/footer";
const PRODUCT_PAGE_BASE = "https://seraproduct.com/product?";

const PAGE_SIZE = 20;

const firebaseConfig = {
    apiKey: "AIzaSyBRSt2aoSJ-lumYAWGAXE6ncui7__TqJ4E",
    authDomain: "sera-product.firebaseapp.com",
    projectId: "sera-product",
    storageBucket: "sera-product.firebasestorage.app",
    messagingSenderId: "516762224598",
    appId: "1:516762224598:web:b6a571f355a8a4a97c0677",
    measurementId: "G-RLMWH43FXX"
};

// --------------------------------------------------------------------------
// Firebase Initialization
// --------------------------------------------------------------------------
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --------------------------------------------------------------------------
// Application State
// --------------------------------------------------------------------------
let lastVisibleDoc = null;
let isLoadingProducts = false;
let hasMoreProducts = true;

// --------------------------------------------------------------------------
// DOM Elements
// --------------------------------------------------------------------------
const productsGrid = document.getElementById("products-grid");
const loadMoreBtn = document.getElementById("load-more-btn");
const noMoreMsg = document.getElementById("no-more-msg");
const emptyState = document.getElementById("empty-state");
const globalLoading = document.getElementById("global-loading");
const footerContainer = document.getElementById("footer-container");

// --------------------------------------------------------------------------
// SVG Placeholder
// --------------------------------------------------------------------------
const IMAGE_PLACEHOLDER = `
<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="0 0 24 24"
     fill="none"
     stroke="#cccccc"
     stroke-width="1.5"
     aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <circle cx="8.5" cy="8.5" r="1.5"/>
    <polyline points="21 15 16 10 5 21"/>
</svg>
`;

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------
function formatCurrency(amount) {
    const num = Number(amount) || 0;

    return `৳ ${num.toLocaleString("bn-BD")}`;
}

function showLoading() {
    globalLoading?.classList.remove("hidden");
}

function hideLoading() {
    globalLoading?.classList.add("hidden");
}

function setLoadMoreState(loading) {
    if (!loadMoreBtn) return;

    const btnText = loadMoreBtn.querySelector(".btn-text");
    const btnSpinner = loadMoreBtn.querySelector(".btn-spinner");

    if (btnText) {
        btnText.textContent = loading
            ? "লোড হচ্ছে..."
            : "আরও দেখুন";
    }

    btnSpinner?.classList.toggle("hidden", !loading);
    loadMoreBtn.disabled = loading;
}

function showProductError() {
    if (!productsGrid) return;

    let errorBox = document.getElementById("product-load-error");

    if (!errorBox) {
        errorBox = document.createElement("div");
        errorBox.id = "product-load-error";
        errorBox.className = "product-load-error";
        errorBox.style.cssText =
            "padding:16px;text-align:center;color:#d32f2f;";

        productsGrid.parentElement?.appendChild(errorBox);
    }

    errorBox.textContent =
        "পণ্য লোড করা যায়নি। ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।";

    errorBox.classList.remove("hidden");
}

function hideProductError() {
    document.getElementById("product-load-error")
        ?.classList.add("hidden");
}

// --------------------------------------------------------------------------
// Product Image
// Only the first image is displayed. No slider or intervals.
// --------------------------------------------------------------------------
function createProductImage(product) {
    const wrapper = document.createElement("div");
    wrapper.className = "card-media-wrapper";

    if (product.freeDelivery === true) {
        const badge = document.createElement("div");
        badge.className = "free-delivery-badge";
        badge.textContent = "ডেলিভারি ফ্রি!";
        wrapper.appendChild(badge);
    }

    const imageContainer = document.createElement("div");
    imageContainer.className = "slider-container";

    const imageUrl = Array.isArray(product.image)
        ? product.image[0]
        : "";

    if (typeof imageUrl === "string" && imageUrl.trim()) {
        const img = document.createElement("img");

        img.className = "slider-img active";
        img.alt = String(product.productName || "Product Image");
        img.loading = "lazy";
        img.decoding = "async";
        img.src = imageUrl;

        img.onerror = () => {
            imageContainer.innerHTML = IMAGE_PLACEHOLDER;
            img.remove();
        };

        imageContainer.appendChild(img);
    } else {
        imageContainer.innerHTML = IMAGE_PLACEHOLDER;
        imageContainer.style.cssText =
            "display:flex;align-items:center;justify-content:center;";
    }

    wrapper.appendChild(imageContainer);

    return wrapper;
}

// --------------------------------------------------------------------------
// Product Price
// --------------------------------------------------------------------------
function createPriceSection(product) {
    const section = document.createElement("div");
    section.className = "price-section";

    const currentPrice = Number(product.customerPrice) || 0;

    const price = document.createElement("div");
    price.className = "current-price";
    price.textContent = formatCurrency(currentPrice);

    section.appendChild(price);

    const oldPrice = Number(product.customerOldPrice) || 0;

    if (oldPrice > currentPrice) {
        const discountAmount = oldPrice - currentPrice;
        const discountPercent = Math.round(
            (discountAmount / oldPrice) * 100
        );

        const oldPriceLine = document.createElement("div");
        oldPriceLine.className = "old-price-line";

        const oldPriceText = document.createElement("span");
        oldPriceText.className = "old-price";
        oldPriceText.textContent = formatCurrency(oldPrice);

        const savings = document.createElement("span");
        savings.className = "savings-tag";
        savings.textContent =
            `সাশ্রয়: ${formatCurrency(discountAmount)}`;

        const discount = document.createElement("span");
        discount.className = "discount-badge";
        discount.textContent = `${discountPercent}% ছাড়`;

        oldPriceLine.append(oldPriceText, savings, discount);
        section.appendChild(oldPriceLine);
    }

    return section;
}

// --------------------------------------------------------------------------
// Product Card
// Click anywhere on the card to open the product page.
// --------------------------------------------------------------------------
function renderProductCard(product) {
    const card = document.createElement("div");

    card.className = "product-card";
    card.dataset.productId = product.id;
    card.style.cursor = "pointer";

    const media = createProductImage(product);

    const body = document.createElement("div");
    body.className = "card-body";

    const title = document.createElement("h2");
    title.className = "product-title";
    title.textContent = product.productName || "অনামক পণ্য";

    const priceSection = createPriceSection(product);

    body.append(title, priceSection);
    card.append(media, body);

    // Open the product page on click.
    // No login, cart, checkout, or purchase action.
    card.addEventListener("click", () => {
        if (!product.productSlug) return;

        const productUrl =
            PRODUCT_PAGE_BASE + product.productSlug;

        window.open(productUrl, "_blank", "noopener");
    });

    return card;
}

// --------------------------------------------------------------------------
// Fast Product Rendering with DocumentFragment
// --------------------------------------------------------------------------
function renderProducts(products) {
    if (!productsGrid || !products.length) return;

    const fragment = document.createDocumentFragment();

    products.forEach((product) => {
        fragment.appendChild(renderProductCard(product));
    });

    // One DOM insertion for the entire batch.
    productsGrid.appendChild(fragment);
}

// --------------------------------------------------------------------------
// Fetch Products — Paginated Firestore Query
// --------------------------------------------------------------------------
async function fetchProducts(isFirstLoad = false) {
    if (isLoadingProducts || !productsGrid) return;

    if (!isFirstLoad && (!hasMoreProducts || !lastVisibleDoc)) {
        return;
    }

    isLoadingProducts = true;

    if (isFirstLoad) {
        showLoading();

        productsGrid.replaceChildren();
        lastVisibleDoc = null;
        hasMoreProducts = true;

        if (emptyState) emptyState.classList.add("hidden");
        if (noMoreMsg) noMoreMsg.classList.add("hidden");
        if (loadMoreBtn) loadMoreBtn.classList.add("hidden");
    } else {
        setLoadMoreState(true);
    }

    try {
        const constraints = [
            where("active", "==", true),
            orderBy("createdAt", "desc")
        ];

        if (!isFirstLoad && lastVisibleDoc) {
            constraints.push(startAfter(lastVisibleDoc));
        }

        constraints.push(limit(PAGE_SIZE));

        const productsQuery = query(
            collection(db, "products"),
            ...constraints
        );

        const snapshot = await getDocs(productsQuery);

        hideProductError();

        if (snapshot.empty) {
            if (isFirstLoad) {
                emptyState?.classList.remove("hidden");
            }

            hasMoreProducts = false;

            loadMoreBtn?.classList.add("hidden");

            if (productsGrid.children.length > 0) {
                noMoreMsg?.classList.remove("hidden");
            } else {
                noMoreMsg?.classList.add("hidden");
            }

            return;
        }

        lastVisibleDoc = snapshot.docs[snapshot.docs.length - 1];

        // Prepare all product objects before touching the DOM.
        const products = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data()
        }));

        renderProducts(products);

        if (emptyState) {
            emptyState.classList.add("hidden");
        }

        hasMoreProducts = snapshot.docs.length === PAGE_SIZE;

        if (hasMoreProducts) {
            loadMoreBtn?.classList.remove("hidden");
            noMoreMsg?.classList.add("hidden");
        } else {
            loadMoreBtn?.classList.add("hidden");
            noMoreMsg?.classList.remove("hidden");
        }

    } catch (error) {
        console.error("Error fetching products:", error);

        showProductError();

        // Allow retrying if the request failed.
        if (isFirstLoad) {
            loadMoreBtn?.classList.add("hidden");
        } else {
            loadMoreBtn?.classList.remove("hidden");
        }

    } finally {
        isLoadingProducts = false;
        hideLoading();
        setLoadMoreState(false);
    }
}

// --------------------------------------------------------------------------
// Footer
// --------------------------------------------------------------------------
async function loadFooter() {
    if (!footerContainer) return;

    try {
        const response = await fetch(FOOTER_API_URL);

        if (!response.ok) return;

        const footerHtml = await response.text();
        footerContainer.innerHTML = footerHtml;

    } catch (error) {
        console.error("Error loading footer:", error);
    }
}

// --------------------------------------------------------------------------
// Initialization
// --------------------------------------------------------------------------
function initProductPage() {
    // Load products and footer independently.
    fetchProducts(true);
    loadFooter();

    loadMoreBtn?.addEventListener("click", () => {
        fetchProducts(false);
    });
}

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        initProductPage,
        { once: true }
    );
} else {
    initProductPage();
}

// ==========================================================================
// END — FAST PRODUCT DISPLAY
// ==========================================================================
