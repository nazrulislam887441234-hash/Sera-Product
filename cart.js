import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
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

// Initialize Firebase Services
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// State Management Variables
let cartItems = [];
let currentCartRef = null;
let itemIndexToRemove = null;

// Helper: Convert English numbers to Bengali numerals
function toBengaliNumerals(num) {
    const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return num.toString().replace(/\d/g, digit => bnDigits[digit]);
}

// Helper: Format price with Bengali numerals and commas
function formatPrice(amount) {
    if (amount === undefined || amount === null) return '০';
    const formattedNum = Math.round(amount).toLocaleString('en-US');
    return toBengaliNumerals(formattedNum);
}

// Hide full-screen loader
function hideLoader() {
    const loader = document.getElementById("full-screen-loader");
    if (loader) {
        loader.classList.add("hidden");
    }
}

// Custom Modal Notification / Prompt
function showCustomModal(message, isConfirm = true, onConfirm = null) {
    const modal = document.getElementById("custom-modal");
    const modalMessage = document.getElementById("modal-message");
    const cancelBtn = document.getElementById("modal-cancel-btn");
    const confirmBtn = document.getElementById("modal-confirm-btn");

    modalMessage.textContent = message;
    modal.classList.remove("hidden");

    if (!isConfirm) {
        cancelBtn.classList.add("hidden");
        confirmBtn.textContent = "ঠিক আছে";
        confirmBtn.onclick = () => {
            modal.classList.add("hidden");
        };
    } else {
        cancelBtn.classList.remove("hidden");
        confirmBtn.textContent = "সরিয়ে দিন";
        
        cancelBtn.onclick = () => {
            modal.classList.add("hidden");
            itemIndexToRemove = null;
        };

        confirmBtn.onclick = () => {
            modal.classList.add("hidden");
            if (onConfirm) onConfirm();
        };
    }
}

// Dynamic Footer Loader
async function loadFooter() {
    try {
        const response = await fetch("https://seraproduct.com/footer");
        if (response.ok) {
            const footerHtml = await response.text();
            document.getElementById("footer-container").innerHTML = footerHtml;
        }
    } catch (error) {
        console.warn("Footer load request failed, main application unaffected.", error);
    }
}

// Update Quantity Function (Firestore & UI)
async function updateQuantity(index, change) {
    if (!currentCartRef) return;

    const item = cartItems[index];
    const currentQty = item.quantity || 1;
    const currentTotalPrice = item.productPrice;

    // ১ ভাগ হিসাব করার সূত্র
    const unitPrice = currentTotalPrice / currentQty;
    const newQty = currentQty + change;

    if (newQty < 1) return; // ১ এর নিচে নামবে না

    const newTotalPrice = unitPrice * newQty;

    // লোকাল অবজেক্ট আপডেট
    cartItems[index] = {
        ...item,
        quantity: newQty,
        productPrice: newTotalPrice
    };

    // তাত্ক্ষণিক UI রেন্ডার
    renderCartUI();

    // Firestore-এ ডাটা আপডেট
    try {
        await updateDoc(currentCartRef, {
            productItem: cartItems
        });
    } catch (error) {
        console.error("Quantity update failed:", error);
        showCustomModal("পরিমাণ আপডেট করা সম্ভব হয়নি। আবার চেষ্টা করুন।", false);
    }
}

// Render UI Components
function renderCartUI() {
    const productContainer = document.getElementById("product-list-container");
    const emptyCartContainer = document.getElementById("empty-cart-container");
    const checkoutSection = document.getElementById("checkout-section");
    const cartCountText = document.getElementById("cart-count-text");

    productContainer.innerHTML = "";

    if (!cartItems || cartItems.length === 0) {
        cartCountText.textContent = "";
        emptyCartContainer.classList.remove("hidden");
        checkoutSection.classList.add("hidden");
        return;
    }

    emptyCartContainer.classList.add("hidden");
    checkoutSection.classList.remove("hidden");

    // Product Count Title update
    const countBn = toBengaliNumerals(cartItems.length);
    cartCountText.textContent = `আপনার কার্টে ${countBn}টি পণ্য রয়েছে`;

    // Render individual item cards
    cartItems.forEach((product, index) => {
        const card = document.createElement("div");
        card.className = "product-card";

        const currentQty = product.quantity || 1;

        // Free Delivery Badge HTML
        const freeDeliveryHTML = product.freeDelivery === true 
            ? `<div class="badge-free-delivery">ফ্রি ডেলিভারি</div>` 
            : ``;

        // Image Placeholder fallback
        const imageUrl = product.productImage || 'https://seraproduct.com/photo/logo.png';

        // Variants List HTML
        let variantsHTML = "";
        if (Array.isArray(product.variants) && product.variants.length > 0) {
            variantsHTML = product.variants.map(v => {
                const name = v.name || 'ভ্যারিয়েন্ট';
                const value = v.value || '';
                const extra = v.extraPrice ? ` (অতিরিক্ত মূল্য: ৳${formatPrice(v.extraPrice)})` : '';
                return `<div class="meta-item">${name}: ${value}${extra}</div>`;
            }).join("");
        }

        // Warranty HTML
        let warrantyHTML = "";
        if (product.warranty && product.warranty.trim() !== "") {
            warrantyHTML = `<div class="meta-item">ওয়ারেন্টি: ${product.warranty}</div>`;
        }

        const metaSectionHTML = (variantsHTML || warrantyHTML) 
            ? `<div class="meta-details">${variantsHTML}${warrantyHTML}</div>` 
            : ``;

        card.innerHTML = `
            <div>
                <div class="image-container">
                    <img src="${imageUrl}" alt="${product.productName || 'পণ্য'}" class="product-image" onerror="this.onerror=null;this.src='https://seraproduct.com/photo/logo.png';">
                </div>
                ${freeDeliveryHTML}
                <h3 class="product-name">${product.productName || 'অজ্ঞাত পণ্য'}</h3>
                <div class="product-price">৳ ${formatPrice(product.productPrice)}</div>
                
                <!-- Quantity Controller Container -->
                <div class="quantity-controller">
                    <button class="btn-qty btn-minus" data-index="${index}" ${currentQty <= 1 ? 'disabled' : ''}>-</button>
                    <span class="qty-value">${toBengaliNumerals(currentQty)}</span>
                    <button class="btn-qty btn-plus" data-index="${index}">+</button>
                </div>

                ${metaSectionHTML}
            </div>
            <button class="btn-remove" data-index="${index}" aria-label="পণ্য সরিয়ে দিন">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
                <span>সরিয়ে দিন</span>
            </button>
        `;

        productContainer.appendChild(card);
    });

    // Attach Event Listeners to Quantity Buttons
    document.querySelectorAll(".btn-minus").forEach(button => {
        button.addEventListener("click", (e) => {
            const idx = parseInt(e.currentTarget.getAttribute("data-index"), 10);
            updateQuantity(idx, -1);
        });
    });

    document.querySelectorAll(".btn-plus").forEach(button => {
        button.addEventListener("click", (e) => {
            const idx = parseInt(e.currentTarget.getAttribute("data-index"), 10);
            updateQuantity(idx, 1);
        });
    });

    // Attach Event Listeners to Remove Buttons
    document.querySelectorAll(".btn-remove").forEach(button => {
        button.addEventListener("click", (e) => {
            const idx = parseInt(e.currentTarget.getAttribute("data-index"), 10);
            initiateRemoveProduct(idx, e.currentTarget);
        });
    });
}

// Remove Product Handler
function initiateRemoveProduct(index, buttonElement) {
    itemIndexToRemove = index;
    showCustomModal("আপনি কি এই পণ্যটি কার্ট থেকে সরিয়ে দিতে চান?", true, async () => {
        await executeRemoveProduct(index, buttonElement);
    });
}

async function executeRemoveProduct(index, buttonElement) {
    if (!currentCartRef) return;

    // Prevent duplicate triggers
    buttonElement.disabled = true;
    const btnSpan = buttonElement.querySelector("span");
    if (btnSpan) btnSpan.textContent = "সরানো হচ্ছে...";

    try {
        const updatedItems = cartItems.filter((_, idx) => idx !== index);

        // Update Firestore Document
        await updateDoc(currentCartRef, {
            productItem: updatedItems
        });

        // Update local memory state
        cartItems = updatedItems;

        // Immediately update UI
        renderCartUI();
    } catch (error) {
        console.error("Error removing item:", error);
        showCustomModal("পণ্যটি সরানো যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।", false);
        buttonElement.disabled = false;
        if (btnSpan) btnSpan.textContent = "সরিয়ে দিন";
    }
}

// Fetch Cart Data
async function loadUserCart(uid) {
    try {
        currentCartRef = doc(db, "carts", uid);
        const cartSnap = await getDoc(currentCartRef);

        if (cartSnap.exists()) {
            const data = cartSnap.data();
            cartItems = Array.isArray(data.productItem) ? data.productItem : [];
        } else {
            cartItems = [];
        }

        renderCartUI();
    } catch (error) {
        console.error("Firestore read failure:", error);
        showCustomModal("কার্টের তথ্য লোড করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।", false);
    } finally {
        hideLoader();
    }
}

// Application Lifecycle Core Execution
document.addEventListener("DOMContentLoaded", () => {
    loadFooter();

    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = "https://seraproduct.com/login";
        } else {
            await loadUserCart(user.uid);
        }
    });
});
