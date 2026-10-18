// ==========================================
// FIREBASE: শুধু PROMO CODE ও ORDER-এর জন্য
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  runTransaction
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
const db = getFirestore(app);

// ==========================================
// LOCAL STORAGE CONFIGURATION
// Product page ও Cart page-এ একই Key ব্যবহার করবেন
// ==========================================
const CART_STORAGE_KEY = "sera_product_cart";

let cartProducts = [];
let deleteIndexTarget = null;
let appliedDiscount = null;
let createdOrderSnapshot = null;
let isSubmittingOrder = false;

// ==========================================
// DOM ELEMENTS
// ==========================================
const loadingOverlay = document.getElementById("loading-overlay");
const loadingText = document.getElementById("loading-text");

const lockedScreen = document.getElementById("locked-screen");
const emptyCartScreen = document.getElementById("empty-cart-screen");
const errorScreen = document.getElementById("error-screen");
const errorMessageEl = document.getElementById("error-message");

const checkoutSection = document.getElementById("checkout-section");
const productListContainer = document.getElementById("product-list");

const checkoutForm = document.getElementById("checkout-form");
const nameInput = document.getElementById("name");
const phoneInput = document.getElementById("phone");
const deliverySiteSelect = document.getElementById("delivery-site");
const vibagInput = document.getElementById("vibag");
const jelaInput = document.getElementById("jela");
const thanaInput = document.getElementById("thana");
const noteInput = document.getElementById("note");

const promoInput = document.getElementById("promo-code");
const applyPromoBtn = document.getElementById("apply-promo-btn");
const promoMessageEl = document.getElementById("promo-message");

const summarySubtotalEl = document.getElementById("summary-subtotal");
const summaryDeliveryEl = document.getElementById("summary-delivery");
const summaryDiscountEl = document.getElementById("summary-discount");
const summaryTotalEl = document.getElementById("summary-total");

const submitOrderBtn = document.getElementById("submit-order-btn");

const deleteModal = document.getElementById("delete-modal");
const cancelDeleteBtn = document.getElementById("cancel-delete-btn");
const confirmDeleteBtn = document.getElementById("confirm-delete-btn");

const successModal = document.getElementById("success-modal");
const successTitle = document.getElementById("success-message-title");
const toastNotification = document.getElementById("toast-notification");

// ==========================================
// HELPER FUNCTIONS
// ==========================================
function toBanglaNum(value) {
  if (value === null || value === undefined) return "০";

  const digits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

  return String(value).replace(/\d/g, digit => digits[Number(digit)]);
}

function formatCurrency(amount) {
  const number = Number(amount) || 0;
  const formatted = new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2
  }).format(number);

  return `৳${toBanglaNum(formatted)}`;
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function showToast(message) {
  if (!toastNotification) {
    alert(message);
    return;
  }

  toastNotification.textContent = message;
  toastNotification.classList.remove("hidden");

  setTimeout(() => {
    toastNotification.classList.add("hidden");
  }, 3000);
}

function showLoader(message = "তথ্য লোড হচ্ছে...") {
  if (loadingText) loadingText.textContent = message;
  if (loadingOverlay) loadingOverlay.classList.remove("hidden");
}

function hideLoader() {
  if (loadingOverlay) loadingOverlay.classList.add("hidden");
}

function showError(message) {
  if (errorMessageEl) errorMessageEl.textContent = message;
  if (errorScreen) errorScreen.classList.remove("hidden");
}

function getProductUnitPrice(product) {
  const quantity = Math.max(1, Number(product.quantity) || 1);
  const totalPrice = Number(product.productPrice) || 0;

  // কার্টে productPrice-এ পণ্যের মোট দাম সংরক্ষিত থাকে
  return totalPrice / quantity;
}

// ==========================================
// LOCAL STORAGE CART
// Expected format:
// {
//   "productItem": [
//     {
//       "productId": "...",
//       "productName": "...",
//       "productImage": "...",
//       "productPrice": 100,
//       "quantity": 1,
//       "freeDelivery": false,
//       "variants": [],
//       "warranty": ""
//     }
//   ]
// }
// ==========================================
function readCartFromLocalStorage() {
  try {
    const rawData = localStorage.getItem(CART_STORAGE_KEY);

    if (!rawData) return [];

    const parsedData = JSON.parse(rawData);

    // আগের নির্ধারিত object format
    if (parsedData && Array.isArray(parsedData.productItem)) {
      return parsedData.productItem;
    }

    // যদি LocalStorage-এ সরাসরি array রাখা থাকে
    if (Array.isArray(parsedData)) {
      return parsedData;
    }

    return [];
  } catch (error) {
    console.error("LocalStorage cart read error:", error);
    showToast("কার্টের তথ্য পড়া যায়নি।");
    return [];
  }
}

function saveCartToLocalStorage() {
  try {
    localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify({
        productItem: cartProducts
      })
    );

    // একই সাইটের অন্য পেজে কার্ট আপডেটের সংকেত
    window.dispatchEvent(
      new CustomEvent("sera-cart-updated", {
        detail: { productItem: cartProducts }
      })
    );

    return true;
  } catch (error) {
    console.error("LocalStorage cart save error:", error);
    showToast("কার্ট আপডেট করা যায়নি।");
    return false;
  }
}

// ==========================================
// INITIALIZATION
// কোনো Login / Auth / Buyer Profile দরকার নেই
// ==========================================
function initializeCheckout() {
  hideLoader();

  if (lockedScreen) lockedScreen.classList.add("hidden");
  if (errorScreen) errorScreen.classList.add("hidden");

  cartProducts = readCartFromLocalStorage()
    .filter(product =>
      product &&
      typeof product === "object" &&
      Number(product.productPrice) >= 0
    )
    .map(product => ({
      ...product,
      quantity: Math.max(1, Math.floor(Number(product.quantity) || 1)),
      productPrice: Number(product.productPrice) || 0
    }));

  renderProductCards();
  recalculateTotals();

  loadFooter();
}

document.addEventListener("DOMContentLoaded", initializeCheckout);

// ==========================================
// PRODUCT CARDS RENDER
// ==========================================
function renderProductCards() {
  if (!productListContainer) return;

  productListContainer.innerHTML = "";

  if (cartProducts.length === 0) {
    if (checkoutSection) checkoutSection.classList.add("hidden");
    if (emptyCartScreen) emptyCartScreen.classList.remove("hidden");
    recalculateTotals();
    return;
  }

  if (emptyCartScreen) emptyCartScreen.classList.add("hidden");
  if (checkoutSection) checkoutSection.classList.remove("hidden");

  // DOM fragment ব্যবহার করে একসঙ্গে কার্ড যোগ করা হচ্ছে
  const fragment = document.createDocumentFragment();

  cartProducts.forEach((product, index) => {
    const card = document.createElement("div");
    card.className = "product-card";

    const quantity = Math.max(1, Number(product.quantity) || 1);
    const productName = escapeHTML(product.productName || "পণ্য");
    const productImage = escapeHTML(
      product.productImage || "https://seraproduct.com/photo/logo.png"
    );

    const variantsHTML = Array.isArray(product.variants)
      ? product.variants.map(variant => `
          <span class="badge badge-variant">
            ${escapeHTML(variant.name || "")}: ${escapeHTML(variant.value || "")}
          </span>
        `).join(" ")
      : "";

    const freeDeliveryHTML = product.freeDelivery === true
      ? '<span class="badge badge-free-delivery">ফ্রি ডেলিভারি</span>'
      : "";

    const warrantyHTML = product.warranty
      ? `<span>ওয়ারেন্টি: ${escapeHTML(product.warranty)}</span>`
      : "";

    card.innerHTML = `
      <img
        src="${productImage}"
        alt="${productName}"
        class="product-img"
        onerror="this.onerror=null;this.src='https://seraproduct.com/photo/logo.png'"
      >

      <div class="product-details">
        <h3 class="product-title">${productName}</h3>

        <div class="product-price">
          ${formatCurrency(product.productPrice)}
        </div>

        <div class="quantity-controller">
          <button
            type="button"
            class="btn-qty btn-minus"
            data-index="${index}"
            ${quantity <= 1 ? "disabled" : ""}
          >-</button>

          <span class="qty-value">${toBanglaNum(quantity)}</span>

          <button
            type="button"
            class="btn-qty btn-plus"
            data-index="${index}"
          >+</button>
        </div>

        <div class="product-meta">
          ${freeDeliveryHTML}
          ${variantsHTML}
          ${warrantyHTML}
        </div>
      </div>

      <button
        type="button"
        class="delete-btn"
        data-index="${index}"
        title="পণ্যটি সরিয়ে ফেলুন"
        aria-label="পণ্যটি সরিয়ে ফেলুন"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      </button>
    `;

    fragment.appendChild(card);
  });

  productListContainer.appendChild(fragment);
}

// ==========================================
// QUANTITY AND DELETE EVENTS
// Event delegation: প্রতিটি বাটনে আলাদা listener নয়
// ==========================================
if (productListContainer) {
  productListContainer.addEventListener("click", event => {
    const minusButton = event.target.closest(".btn-minus");
    const plusButton = event.target.closest(".btn-plus");
    const deleteButton = event.target.closest(".delete-btn");

    if (minusButton) {
      updateCheckoutQuantity(Number(minusButton.dataset.index), -1);
      return;
    }

    if (plusButton) {
      updateCheckoutQuantity(Number(plusButton.dataset.index), 1);
      return;
    }

    if (deleteButton) {
      deleteIndexTarget = Number(deleteButton.dataset.index);

      if (deleteModal) deleteModal.classList.remove("hidden");
    }
  });
}

// ==========================================
// QUANTITY UPDATE
// ==========================================
async function updateCheckoutQuantity(index, change) {
  if (index < 0 || index >= cartProducts.length) return;

  const product = cartProducts[index];
  const oldQuantity = Math.max(1, Number(product.quantity) || 1);
  const unitPrice = getProductUnitPrice(product);
  const newQuantity = oldQuantity + change;

  if (newQuantity < 1) return;

  cartProducts[index] = {
    ...product,
    quantity: newQuantity,
    productPrice: unitPrice * newQuantity
  };

  if (!saveCartToLocalStorage()) return;

  renderProductCards();
  await validatePromoCode(true);
  recalculateTotals();
}

// ==========================================
// DELETE PRODUCT
// ==========================================
if (cancelDeleteBtn) {
  cancelDeleteBtn.addEventListener("click", () => {
    deleteIndexTarget = null;

    if (deleteModal) deleteModal.classList.add("hidden");
  });
}

if (confirmDeleteBtn) {
  confirmDeleteBtn.addEventListener("click", async () => {
    if (
      deleteIndexTarget === null ||
      deleteIndexTarget < 0 ||
      deleteIndexTarget >= cartProducts.length
    ) {
      return;
    }

    const previousCart = [...cartProducts];

    cartProducts.splice(deleteIndexTarget, 1);

    if (!saveCartToLocalStorage()) {
      cartProducts = previousCart;
      return;
    }

    deleteIndexTarget = null;

    if (deleteModal) deleteModal.classList.add("hidden");

    renderProductCards();
    await validatePromoCode(true);
    recalculateTotals();
  });
}

// ==========================================
// CALCULATION LOGIC
// ==========================================
function calculateSubtotal() {
  return cartProducts.reduce(
    (sum, product) => sum + (Number(product.productPrice) || 0),
    0
  );
}

function calculateDeliveryCharge() {
  const deliverySite = deliverySiteSelect?.value || "";

  if (!deliverySite) return 0;

  let totalDelivery = 0;

  cartProducts.forEach(product => {
    if (product.freeDelivery === true) return;

    if (deliverySite === "inside_dhaka") {
      totalDelivery += 60;
    } else if (deliverySite === "outside_dhaka") {
      totalDelivery += 120;
    }
  });

  return totalDelivery;
}

function recalculateTotals() {
  const subtotal = calculateSubtotal();
  const deliveryCharge = calculateDeliveryCharge();
  const discount = Math.max(0, Number(appliedDiscount) || 0);

  const total = Math.max(0, subtotal + deliveryCharge - discount);

  if (summarySubtotalEl) {
    summarySubtotalEl.textContent = formatCurrency(subtotal);
  }

  if (summaryDeliveryEl) {
    summaryDeliveryEl.textContent = formatCurrency(deliveryCharge);
  }

  if (summaryDiscountEl) {
    summaryDiscountEl.textContent =
      discount > 0 ? `-${formatCurrency(discount)}` : "-৳০";
  }

  if (summaryTotalEl) {
    summaryTotalEl.textContent = formatCurrency(total);
  }

  return { subtotal, deliveryCharge, discount, total };
}

if (deliverySiteSelect) {
  deliverySiteSelect.addEventListener("change", recalculateTotals);
}

// ==========================================
// PROMO CODE VALIDATION
// আগের Firestore promoCode collection ব্যবহার হবে
// Login লাগবে না
// ==========================================
if (applyPromoBtn) {
  applyPromoBtn.addEventListener("click", () => validatePromoCode(false));
}

async function validatePromoCode(silent = false) {
  const code = promoInput?.value.trim() || "";

  if (!code) {
    appliedDiscount = null;

    if (promoMessageEl) {
      promoMessageEl.textContent = "";
      promoMessageEl.className = "promo-message hidden";
    }

    recalculateTotals();
    return;
  }

  if (!silent) showLoader("প্রোমো কোড যাচাই করা হচ্ছে...");

  try {
    const promoRef = doc(db, "promoCode", code);
    const promoSnap = await getDoc(promoRef);
    const subtotal = calculateSubtotal();

    if (!promoSnap.exists()) {
      appliedDiscount = null;
      showPromoMsg("প্রোমো কোডটি সঠিক নয়।", "error");
      if (!silent) hideLoader();
      recalculateTotals();
      return;
    }

    const promoData = promoSnap.data();

    if (
      promoData.shoppingLimit &&
      subtotal < Number(promoData.shoppingLimit)
    ) {
      appliedDiscount = null;

      showPromoMsg(
        `সর্বনিম্ন ${formatCurrency(promoData.shoppingLimit)} এর কেনাকাটায় এই কোডটি প্রযোজ্য।`,
        "error"
      );

      if (!silent) hideLoader();
      recalculateTotals();
      return;
    }

    if (
      promoData.expiredTime &&
      Date.now() > Number(promoData.expiredTime)
    ) {
      appliedDiscount = null;
      showPromoMsg("প্রোমো কোডের মেয়াদ শেষ হয়ে গেছে।", "error");

      if (!silent) hideLoader();
      recalculateTotals();
      return;
    }

    if (Number(promoData.discountPrice) > 0) {
      appliedDiscount = Number(promoData.discountPrice);

      showPromoMsg(
        `প্রোমো কোড সফলভাবে প্রযোজ্য হয়েছে! ${formatCurrency(appliedDiscount)} ডিসকাউন্ট।`,
        "success"
      );
    } else {
      appliedDiscount = null;
      showPromoMsg("প্রোমো কোডটিতে কোনো ডিসকাউন্ট পাওয়া যায়নি।", "error");
    }

    if (!silent) hideLoader();
    recalculateTotals();

  } catch (error) {
    console.error("Promo Error:", error);

    appliedDiscount = null;

    if (!silent) {
      hideLoader();
      showPromoMsg(
        "প্রোমো কোড যাচাই করতে সমস্যা হয়েছে। ইন্টারনেট সংযোগ পরীক্ষা করুন।",
        "error"
      );
    }

    recalculateTotals();
  }
}

function showPromoMsg(message, type) {
  if (!promoMessageEl) return;

  promoMessageEl.textContent = message;
  promoMessageEl.className = `promo-message ${type}`;
}

// ==========================================
// ORDER ID GENERATOR
// ==========================================
function generateOrderId() {
  const random7Digit = Math.floor(1000000 + Math.random() * 9000000);
  return `S-P-${random7Digit}-SP-ORDER`;
}

// ==========================================
// ORDER FORM VALIDATION
// ==========================================
function validateOrderForm() {
  const name = nameInput?.value.trim() || "";
  const phone = phoneInput?.value.trim() || "";
  const deliverySite = deliverySiteSelect?.value || "";
  const vibag = vibagInput?.value.trim() || "";
  const jela = jelaInput?.value.trim() || "";
  const thana = thanaInput?.value.trim() || "";

  if (!name) {
    showToast("আপনার নাম লিখুন।");
    return false;
  }

  if (!/^01\d{9}$/.test(phone)) {
    showToast("সঠিক ১১ সংখ্যার মোবাইল নাম্বার দিন।");
    return false;
  }

  if (!deliverySite) {
    showToast("ডেলিভারি এরিয়া নির্বাচন করুন।");
    return false;
  }

  if (!vibag || !jela || !thana) {
    showToast("বিভাগ, জেলা এবং থানা/উপজেলা লিখুন।");
    return false;
  }

  if (cartProducts.length === 0) {
    showToast("আপনার কার্টে কোনো পণ্য নেই।");
    return false;
  }

  return true;
}

// ==========================================
// SUBMIT ORDER
// Login UID / buyer profile / database cart নেই
// Order Firestore-এ save হবে
// ==========================================
if (submitOrderBtn) {
  submitOrderBtn.addEventListener("click", submitOrderFlow);
}

if (checkoutForm) {
  checkoutForm.addEventListener("submit", event => {
    event.preventDefault();
    submitOrderFlow();
  });
}

async function submitOrderFlow(event) {
  if (event) event.preventDefault();

  if (isSubmittingOrder) return;
  if (!validateOrderForm()) return;

  // Submit করার আগে LocalStorage থেকে সর্বশেষ কার্ট পড়া
  cartProducts = readCartFromLocalStorage();

  if (cartProducts.length === 0) {
    renderProductCards();
    showToast("আপনার কার্টে কোনো পণ্য নেই।");
    return;
  }

  const name = nameInput.value.trim();
  const phone = phoneInput.value.trim();
  const deliverySite = deliverySiteSelect.value;
  const vibag = vibagInput.value.trim();
  const jela = jelaInput.value.trim();
  const thana = thanaInput.value.trim();
  const note = noteInput?.value.trim() || "";

  const { subtotal, deliveryCharge, discount, total } = recalculateTotals();

  isSubmittingOrder = true;
  submitOrderBtn.disabled = true;

  try {
    let finalOrderId = null;
    let attempts = 0;

    while (attempts < 10) {
      const tempId = generateOrderId();
      const idRef = doc(db, "id", tempId);

      showLoader(`অর্ডার আইডি তৈরি হচ্ছে... (${toBanglaNum(attempts + 1)})`);

      try {
        await runTransaction(db, async transaction => {
          const idSnap = await transaction.get(idRef);

          if (idSnap.exists()) {
            throw new Error("ORDER_ID_EXISTS");
          }

          // Login UID এখানে আর ব্যবহার হচ্ছে না
          transaction.set(idRef, {
            use: true,
            createdAt: serverTimestamp(),
            guestOrder: true
          });
        });

        finalOrderId = tempId;
        break;

      } catch (error) {
        if (error.message === "ORDER_ID_EXISTS") {
          attempts++;
          continue;
        }

        throw error;
      }
    }

    if (!finalOrderId) {
      throw new Error("অর্ডার আইডি তৈরি করা যায়নি। আবার চেষ্টা করুন।");
    }

    showLoader("আপনার অর্ডার জমা হচ্ছে...");

    const orderRef = doc(db, "orders", finalOrderId);

    const orderPayload = {
      orderId: finalOrderId,
      createdAt: serverTimestamp(),
      productItem: cartProducts,
      status: "pending",

      // Guest checkout: uid ও email নেই
      guestOrder: true,

      thana,
      jela,
      vibag,
      deliverySite,
      note,
      deliveryCharge: Number(deliveryCharge),
      phone,
      subtotal: Number(subtotal),
      total: Number(total),
      discount: Number(discount),
      name
    };

    console.log("Guest Order Payload:", {
      ...orderPayload,
      createdAt: "serverTimestamp"
    });

    // Order save
    await setDoc(orderRef, orderPayload);

    createdOrderSnapshot = {
      ...orderPayload,
      createdAt: new Date().toISOString()
    };

    // অর্ডার সফলভাবে save হওয়ার পরই কার্ট পরিষ্কার হবে
    cartProducts = [];
    localStorage.removeItem(CART_STORAGE_KEY);

    appliedDiscount = null;

    if (promoInput) promoInput.value = "";

    if (promoMessageEl) {
      promoMessageEl.textContent = "";
      promoMessageEl.className = "promo-message hidden";
    }

    renderProductCards();
    recalculateTotals();

    hideLoader();

    if (successModal) {
      successModal.classList.remove("hidden");
    } else {
      showToast(`অর্ডার সফল হয়েছে! অর্ডার আইডি: ${finalOrderId}`);
    }

    // Order complete হওয়ার পর ডাবল-সাবমিশন বন্ধ থাকবে
    submitOrderBtn.disabled = true;

  } catch (error) {
    console.error("Order Creation Error:", error);

    hideLoader();

    submitOrderBtn.disabled = false;
    isSubmittingOrder = false;

    showToast(
      error.message && error.message !== "ORDER_ID_EXISTS"
        ? error.message
        : "অর্ডার জমা দিতে সমস্যা হয়েছে। আবার চেষ্টা করুন।"
    );
  }
}

// ==========================================
// SUCCESS TITLE CLICK: ORDER JSON COPY
// ==========================================
if (successTitle) {
  successTitle.addEventListener("click", async () => {
    if (!createdOrderSnapshot) return;

    try {
      await navigator.clipboard.writeText(
        JSON.stringify(createdOrderSnapshot, null, 2)
      );

      showToast("অর্ডারের তথ্য কপি হয়েছে।");
    } catch (error) {
      console.error("Clipboard copy failed:", error);
      showToast("তথ্য কপি করা যায়নি।");
    }
  });
}

// ==========================================
// SYNC CART IF ANOTHER PAGE UPDATES IT
// ==========================================
window.addEventListener("storage", event => {
  if (event.key !== CART_STORAGE_KEY) return;

  cartProducts = readCartFromLocalStorage();
  renderProductCards();
  recalculateTotals();
});

window.addEventListener("sera-cart-updated", () => {
  cartProducts = readCartFromLocalStorage();
  renderProductCards();
  recalculateTotals();
});

// ==========================================
// LOAD FOOTER
// ==========================================
async function loadFooter() {
  const footerContainer = document.getElementById("footer-container");
  if (!footerContainer) return;

  try {
    const response = await fetch("https://seraproduct.com/footer");

    if (response.ok) {
      footerContainer.innerHTML = await response.text();
    }
  } catch (error) {
    console.error("Footer load error:", error);
  }
}
