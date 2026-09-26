import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    collection, 
    query, 
    orderBy, 
    limit, 
    startAfter, 
    getDocs 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ==========================================
// 1. Firebase Configuration
// (আপনার Firebase config এখানে বসানো আছে)
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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ==========================================
// DOM Elements
// ==========================================
const productGrid = document.getElementById("productGrid");
const emptyState = document.getElementById("emptyState");
const errorState = document.getElementById("errorState");
const loadMoreContainer = document.getElementById("loadMoreContainer");
const loadMoreBtn = document.getElementById("loadMoreBtn");
const retryBtn = document.getElementById("retryBtn");
const mobileMenuBtn = document.getElementById("mobileMenuBtn");
const mobileMenu = document.getElementById("mobileMenu");
const logoutBtn = document.getElementById("logoutBtn");
const resellerNameDisplay = document.getElementById("resellerNameDisplay");
const customModal = document.getElementById("customModal");
const modalTitle = document.getElementById("modalTitle");
const modalMessage = document.getElementById("modalMessage");
const modalActionBtn = document.getElementById("modalActionBtn");

// State variables
let lastVisibleDoc = null;
let isFetching = false;
let activeSliders = [];

// ==========================================
// Modal Helper Functions (No alert() used)
// ==========================================
function showModal(title, message, callback) {
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    customModal.style.display = "flex";
    
    modalActionBtn.onclick = () => {
        customModal.style.display = "none";
        if (typeof callback === "function") {
            callback();
        }
    };
}

// ==========================================
// Mobile Menu Toggle
// ==========================================
mobileMenuBtn.addEventListener("click", () => {
    mobileMenu.classList.toggle("open");
});

// ==========================================
// Authentication & Reseller Verification
// ==========================================
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "https://seraproduct.com/reseller/login";
        return;
    }

    try {
        const resellerRef = doc(db, "reseller", user.uid);
        const resellerSnap = await getDoc(resellerRef);

        if (!resellerSnap.exists()) {
            showModal(
                "রিসেলার তথ্য অনুপস্থিত", 
                "আপনার রিসেলার তথ্য পাওয়া যায়নি!", 
                () => {
                    signOut(auth).then(() => {
                        window.location.href = "https://seraproduct.com/reseller/login";
                    });
                }
            );
            return;
        }

        const resellerData = resellerSnap.data();
        const isActive = resellerData.active === true;
        const isVerified = resellerData.verified === true;

        if (!isActive) {
            showModal(
                "অ্যাকাউন্ট ইনঅ্যাক্টিভ", 
                "আপনার রিসেলার অ্যাকাউন্ট বর্তমানে এক্টিভ নয়।", 
                () => {
                    window.location.href = "https://seraproduct.com/reseller/login";
                }
            );
            return;
        }

        if (!isVerified) {
            showModal(
                "অ্যাকাউন্ট ভেরিফাই হয়নি", 
                "আপনার রিসেলার অ্যাকাউন্ট এখনো ভেরিফাইড হয়নি।", 
                () => {
                    window.location.href = "https://seraproduct.com/reseller/login";
                }
            );
            return;
        }

        if (resellerData.name || resellerData.fullName) {
            resellerNameDisplay.textContent = resellerData.name || resellerData.fullName;
        }

        loadProducts(true);

    } catch (error) {
        console.error("Reseller verification error:", error);
        showErrorState();
    }
});

// Logout handling
logoutBtn.addEventListener("click", async () => {
    try {
        await signOut(auth);
        window.location.href = "https://seraproduct.com/reseller/login";
    } catch (error) {
        console.error("Logout error:", error);
    }
});

// ==========================================
// Product Loading & Pagination (Limit 20)
// ==========================================
async function loadProducts(isInitial = false) {
    if (isFetching) return;
    isFetching = true;

    if (isInitial) {
        productGrid.innerHTML = getSkeletonHTML(6);
        emptyState.style.display = "none";
        errorState.style.display = "none";
        loadMoreContainer.style.display = "none";
    } else {
        loadMoreBtn.disabled = true;
        loadMoreBtn.innerHTML = `<span>আরও প্রোডাক্ট লোড হচ্ছে...</span>`;
    }

    try {
        let q;
        if (isInitial || !lastVisibleDoc) {
            q = query(
                collection(db, "products"),
                orderBy("createdAt", "desc"),
                limit(20)
            );
        } else {
            q = query(
                collection(db, "products"),
                orderBy("createdAt", "desc"),
                startAfter(lastVisibleDoc),
                limit(20)
            );
        }

        const querySnapshot = await getDocs(q);

        if (isInitial) {
            productGrid.innerHTML = "";
            activeSliders.forEach(clearInterval);
            activeSliders = [];
        }

        if (querySnapshot.empty && isInitial) {
            emptyState.style.display = "block";
            loadMoreContainer.style.display = "none";
            isFetching = false;
            return;
        }

        if (querySnapshot.empty) {
            loadMoreContainer.style.display = "none";
            isFetching = false;
            return;
        }

        lastVisibleDoc = querySnapshot.docs[querySnapshot.docs.length - 1];

        querySnapshot.forEach((docSnap) => {
            const product = { id: docSnap.id, ...docSnap.data() };
            const cardEl = createProductCard(product);
            productGrid.appendChild(cardEl);
        });

        if (querySnapshot.docs.length < 20) {
            loadMoreContainer.style.display = "none";
        } else {
            loadMoreContainer.style.display = "block";
        }

    } catch (error) {
        console.error("Error loading products:", error);
        if (isInitial) {
            productGrid.innerHTML = "";
            errorState.style.display = "block";
        } else {
            showModal("ত্রুটি", "প্রোডাক্ট লোড করতে সমস্যা হয়েছে। দয়া করে আবার চেষ্টা করুন।");
        }
    } finally {
        isFetching = false;
        if (!isInitial) {
            loadMoreBtn.disabled = false;
            loadMoreBtn.innerHTML = `
                <span>আরও দেখুন</span>
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><polyline points="6 9 12 15 18 9"></polyline></svg>
            `;
        }
    }
}

loadMoreBtn.addEventListener("click", () => {
    loadProducts(false);
});

retryBtn.addEventListener("click", () => {
    errorState.style.display = "none";
    loadProducts(true);
});

// ==========================================
// Product Card & Image Slider Generator
// ==========================================
function createProductCard(product) {
    const card = document.createElement("div");
    card.className = "product-card";

    const productSlug = product.productSlug || product.id;
    const productUrl = `https://seraproduct.com/reseller/product?${productSlug}`;

    const images = Array.isArray(product.image) && product.image.length > 0 
        ? product.image 
        : ["https://seraproduct.com/photo/placeholder.png"];

    const resellerPrice = Number(product.resellerPrice) || 0;
    const resellerOldPrice = Number(product.resellerOldPrice) || 0;
    const hasDiscount = resellerOldPrice > resellerPrice;

    let discountAmount = 0;
    let discountPercentage = 0;

    if (hasDiscount) {
        discountAmount = resellerOldPrice - resellerPrice;
        discountPercentage = Math.round((discountAmount / resellerOldPrice) * 100);
    }

    const formattedResellerPrice = resellerPrice.toLocaleString("bn-BD");
    const formattedOldPrice = resellerOldPrice.toLocaleString("bn-BD");

    let sliderImagesHtml = "";
    images.forEach((imgUrl, index) => {
        const activeClass = index === 0 ? "active" : "";
        sliderImagesHtml += `
            <img src="${imgUrl}" alt="${product.productName || 'Product'}" class="product-slide-img ${activeClass}" loading="lazy" onerror="this.src='https://seraproduct.com/photo/placeholder.png'">
        `;
    });

    card.innerHTML = `
        <div class="product-image-container" data-url="${productUrl}">
            ${sliderImagesHtml}
            ${hasDiscount ? `<div class="discount-badge">${discountPercentage.toLocaleString("bn-BD")}% ছাড়</div>` : ""}
        </div>
        <div class="product-card-body">
            <div>
                <h3 class="product-title" data-url="${productUrl}" title="${product.productName || ''}">${product.productName || 'নামহীন প্রোডাক্ট'}</h3>
                <div class="product-price-area">
                    <div class="price-label">রিসেলার মূল্য</div>
                    <div class="price-row">
                        <span class="current-price">৳${formattedResellerPrice}</span>
                        ${hasDiscount ? `<span class="old-price">৳${formattedOldPrice}</span>` : ""}
                    </div>
                    ${hasDiscount ? `<div class="discount-info-text">${discountAmount.toLocaleString("bn-BD")} টাকা ডিসকাউন্ট • ${discountPercentage.toLocaleString("bn-BD")}% ছাড়</div>` : ""}
                </div>
            </div>
            <button class="see-details-btn" data-url="${productUrl}">
                <span>দেখুন</span>
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
            </button>
        </div>
    `;

    const openNewTab = () => {
        window.open(productUrl, "_blank", "noopener,noreferrer");
    };

    card.querySelector(".product-image-container").addEventListener("click", openNewTab);
    card.querySelector(".product-title").addEventListener("click", openNewTab);
    card.querySelector(".see-details-btn").addEventListener("click", openNewTab);

    if (images.length > 1) {
        const imgElements = card.querySelectorAll(".product-slide-img");
        let currentIdx = 0;
        
        const sliderInterval = setInterval(() => {
            imgElements[currentIdx].classList.remove("active");
            currentIdx = (currentIdx + 1) % imgElements.length;
            imgElements[currentIdx].classList.add("active");
        }, 3500);

        activeSliders.push(sliderInterval);
    }

    return card;
}

function getSkeletonHTML(count) {
    let html = "";
    for (let i = 0; i < count; i++) {
        html += `
            <div class="product-card skeleton-card">
                <div class="skeleton-img"></div>
                <div class="skeleton-body">
                    <div class="skeleton-line title"></div>
                    <div class="skeleton-line price"></div>
                    <div class="skeleton-line btn"></div>
                </div>
            </div>
        `;
    }
    return html;
}

// ==========================================
// Footer Fetch Integration
// ==========================================
async function fetchAndLoadFooter() {
    const footerContainer = document.getElementById("footer-container");
    try {
        const response = await fetch("https://seraproduct.com/footer");
        if (response.ok) {
            const footerHtml = await response.text();
            footerContainer.innerHTML = footerHtml;
        } else {
            footerContainer.innerHTML = `<div style="text-align:center; padding: 20px; color: #6b7280; font-size: 14px;">© Sera Product Reseller Portal</div>`;
        }
    } catch (error) {
        console.error("Footer fetch error:", error);
        footerContainer.innerHTML = `<div style="text-align:center; padding: 20px; color: #6b7280; font-size: 14px;">© Sera Product Reseller Portal</div>`;
    }
}

fetchAndLoadFooter();
