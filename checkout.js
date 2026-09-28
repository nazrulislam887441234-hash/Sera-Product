// Firebase Modular SDK CDN Imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getAuth, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
  getFirestore, 
  doc, 
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  writeBatch
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

// State Management
let currentUser = null;
let cartProducts = [];
let deleteIndexTarget = null;
let appliedDiscount = null;
let createdOrderSnapshot = null;

// DOM Elements
const loadingOverlay = document.getElementById('loading-overlay');
const loadingText = document.getElementById('loading-text');
const lockedScreen = document.getElementById('locked-screen');
const emptyCartScreen = document.getElementById('empty-cart-screen');
const errorScreen = document.getElementById('error-screen');
const errorMessageEl = document.getElementById('error-message');
const checkoutSection = document.getElementById('checkout-section');
const productListContainer = document.getElementById('product-list');

// Form & Inputs
const checkoutForm = document.getElementById('checkout-form');
const nameInput = document.getElementById('name');
const phoneInput = document.getElementById('phone');
const deliverySiteSelect = document.getElementById('delivery-site');
const vibagInput = document.getElementById('vibag');
const jelaInput = document.getElementById('jela');
const thanaInput = document.getElementById('thana');
const noteInput = document.getElementById('note');

// Promo & Summary
const promoInput = document.getElementById('promo-code');
const applyPromoBtn = document.getElementById('apply-promo-btn');
const promoMessageEl = document.getElementById('promo-message');
const summarySubtotalEl = document.getElementById('summary-subtotal');
const summaryDeliveryEl = document.getElementById('summary-delivery');
const summaryDiscountEl = document.getElementById('summary-discount');
const summaryTotalEl = document.getElementById('summary-total');
const submitOrderBtn = document.getElementById('submit-order-btn');

// Modals
const deleteModal = document.getElementById('delete-modal');
const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
const successModal = document.getElementById('success-modal');
const successTitle = document.getElementById('success-message-title');
const toastNotification = document.getElementById('toast-notification');

// ==========================================
// HELPER FUNCTIONS
// ==========================================

// Convert Western digits to Bangla digits
function toBanglaNum(num) {
  if (num === null || num === undefined) return '০';
  const banglaDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return num.toString().replace(/\d/g, (digit) => banglaDigits[digit]);
}

// Format Currency to Bangla ৳
function formatCurrency(amount) {
  const formatted = new Intl.NumberFormat('en-IN').format(amount || 0);
  return `৳${toBanglaNum(formatted)}`;
}

// Show Custom Toast Message
function showToast(msg) {
  toastNotification.textContent = msg;
  toastNotification.classList.remove('hidden');
  setTimeout(() => {
    toastNotification.classList.add('hidden');
  }, 3000);
}

// Loader Control
function showLoader(text = "তথ্য লোড হচ্ছে...") {
  loadingText.textContent = text;
  loadingOverlay.classList.remove('hidden');
}

function hideLoader() {
  loadingOverlay.classList.add('hidden');
}

// Redirect Helper
function redirectTo(url) {
  window.location.href = url;
}

// ==========================================
// 1. AUTHENTICATION CHECK
// ==========================================
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    redirectTo('https://seraproduct.com/login');
    return;
  }

  currentUser = {
    uid: user.uid,
    email: user.email
  };

  await initializeCheckout();
});

// ==========================================
// INITIALIZATION FLOW
// ==========================================
async function initializeCheckout() {
  showLoader("আপনার অ্যাকাউন্টের তথ্য যাচাই করা হচ্ছে...");

  try {
    // 2. Buyer Account Check
    const buyerRef = doc(db, "buyers", currentUser.uid);
    const buyerSnap = await getDoc(buyerRef);

    if (!buyerSnap.exists()) {
      hideLoader();
      errorMessageEl.textContent = "আপনার কাস্টমার অ্যাকাউন্টের তথ্য পাওয়া যায়নি।";
      errorScreen.classList.remove('hidden');
      setTimeout(() => redirectTo('https://seraproduct.com/login'), 3000);
      return;
    }

    const buyerData = buyerSnap.data();

    // 3. Block Check
    if (buyerData.block === true) {
      hideLoader();
      lockedScreen.classList.remove('hidden');
      return;
    }

    // 4. Cart Data Load
    showLoader("কার্টের তথ্য লোড করা হচ্ছে...");
    const cartRef = doc(db, "carts", currentUser.uid);
    const cartSnap = await getDoc(cartRef);

    if (!cartSnap.exists()) {
      hideLoader();
      emptyCartScreen.classList.remove('hidden');
      return;
    }

    const cartData = cartSnap.data();
    if (!cartData.productItem || !Array.isArray(cartData.productItem) || cartData.productItem.length === 0) {
      hideLoader();
      emptyCartScreen.classList.remove('hidden');
      return;
    }

    cartProducts = cartData.productItem;
    
    // Render UI
    renderProductCards();
    recalculateTotals();
    
    checkoutSection.classList.remove('hidden');
    hideLoader();

  } catch (err) {
    console.error("Initialization Error:", err);
    hideLoader();
    errorMessageEl.textContent = "অর্ডার তৈরি করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।";
    errorScreen.classList.remove('hidden');
  }
}

// ==========================================
// 6. PRODUCT CARDS RENDER
// ==========================================
function renderProductCards() {
  productListContainer.innerHTML = '';

  if (cartProducts.length === 0) {
    checkoutSection.classList.add('hidden');
    emptyCartScreen.classList.remove('hidden');
    return;
  }

  cartProducts.forEach((prod, index) => {
    const card = document.createElement('div');
    card.className = 'product-card';

    // Variants HTML
    let variantsHTML = '';
    if (prod.variants && Array.isArray(prod.variants) && prod.variants.length > 0) {
      variantsHTML = prod.variants.map(v => 
        `<span class="badge badge-variant">${v.name}: ${v.value}</span>`
      ).join(' ');
    }

    // Free Delivery HTML
    const freeDeliveryHTML = prod.freeDelivery === true 
      ? `<span class="badge badge-free-delivery">ফ্রি ডেলিভারি</span>` 
      : '';

    // Warranty HTML
    const warrantyHTML = prod.warranty 
      ? `<span>ওয়ারেন্টি: ${prod.warranty}</span>` 
      : '';

    card.innerHTML = `
      <img src="${prod.productImage}" alt="${prod.productName}" class="product-img" onerror="this.src='https://seraproduct.com/photo/logo.png'">
      <div class="product-details">
        <h3 class="product-title">${prod.productName}</h3>
        <div class="product-price">${formatCurrency(prod.productPrice)}</div>
        <div class="product-meta">
          ${freeDeliveryHTML}
          ${variantsHTML}
          ${warrantyHTML}
        </div>
      </div>
      <button type="button" class="delete-btn" data-index="${index}" title="পণ্যটি সরিয়ে ফেলুন">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      </button>
    `;

    productListContainer.appendChild(card);
  });

  // Attach Delete Events
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      deleteIndexTarget = parseInt(e.currentTarget.getAttribute('data-index'));
      deleteModal.classList.remove('hidden');
    });
  });
}

// ==========================================
// 7. PRODUCT DELETE FLOW
// ==========================================
cancelDeleteBtn.addEventListener('click', () => {
  deleteIndexTarget = null;
  deleteModal.classList.add('hidden');
});

confirmDeleteBtn.addEventListener('click', async () => {
  if (deleteIndexTarget === null) return;
  
  deleteModal.classList.add('hidden');
  showLoader("পণ্য রিমুভ করা হচ্ছে...");

  try {
    cartProducts.splice(deleteIndexTarget, 1);
    const cartRef = doc(db, "carts", currentUser.uid);

    const batch = writeBatch(db);
    batch.update(cartRef, { productItem: cartProducts });
    await batch.commit();

    deleteIndexTarget = null;
    hideLoader();

    if (cartProducts.length === 0) {
      checkoutSection.classList.add('hidden');
      emptyCartScreen.classList.remove('hidden');
    } else {
      renderProductCards();
      await validatePromoCode(true); // Re-validate active promo code against new subtotal
      recalculateTotals();
    }

  } catch (err) {
    console.error("Delete Error:", err);
    hideLoader();
    showToast("পণ্য রিমুভ করা সম্ভব হয়নি। আবার চেষ্টা করুন।");
  }
});

// ==========================================
// CALCULATION LOGIC (8, 9, 10, 11, 12, 13, 18)
// ==========================================
function calculateSubtotal() {
  return cartProducts.reduce((sum, item) => sum + (Number(item.productPrice) || 0), 0);
}

function calculateDeliveryCharge() {
  const deliverySite = deliverySiteSelect.value;
  if (!deliverySite) return 0;

  let totalDelivery = 0;
  cartProducts.forEach(prod => {
    if (prod.freeDelivery !== true) {
      if (deliverySite === 'inside_dhaka') {
        totalDelivery += 60;
      } else if (deliverySite === 'outside_dhaka') { // এখানে outside বানান ঠিক করো
        totalDelivery += 120;
      }
    }
  });
  return totalDelivery;
}
function recalculateTotals() {
  const subtotal = calculateSubtotal();
  const deliveryCharge = calculateDeliveryCharge();
  const discount = appliedDiscount ? Number(appliedDiscount) : 0;
  const total = subtotal + deliveryCharge - discount;

  summarySubtotalEl.textContent = formatCurrency(subtotal);
  summaryDeliveryEl.textContent = formatCurrency(deliveryCharge);
  summaryDiscountEl.textContent = discount > 0 ? `-${formatCurrency(discount)}` : '-৳০';
  summaryTotalEl.textContent = formatCurrency(total < 0 ? 0 : total);

  return { subtotal, deliveryCharge, discount: appliedDiscount, total: total < 0 ? 0 : total };
}

deliverySiteSelect.addEventListener('change', recalculateTotals);

// ==========================================
// 14, 15, 16, 17. PROMO CODE VALIDATION
// ==========================================
applyPromoBtn.addEventListener('click', () => validatePromoCode(false));

async function validatePromoCode(silent = false) {
  const code = promoInput.value.trim();
  if (!code) {
    appliedDiscount = null;
    promoMessageEl.className = 'promo-message hidden';
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

    // Shopping Limit Check
    if (promoData.shoppingLimit && subtotal < promoData.shoppingLimit) {
      appliedDiscount = null;
      showPromoMsg(`সর্বনিম্ন ৳${toBanglaNum(promoData.shoppingLimit)} এর কেনাকাটায় এই কোডটি প্রযোজ্য।`, "error");
      if (!silent) hideLoader();
      recalculateTotals();
      return;
    }

    // Expired Time Check
    if (promoData.expiredTime && Date.now() > promoData.expiredTime) {
      appliedDiscount = null;
      showPromoMsg("প্রোমো কোডের মেয়াদ শেষ হয়ে গেছে।", "error");
      if (!silent) hideLoader();
      recalculateTotals();
      return;
    }

    // Discount Applied
    if (promoData.discountPrice && Number(promoData.discountPrice) > 0) {
      appliedDiscount = Number(promoData.discountPrice);
      showPromoMsg(`প্রোমো কোড সফলভাবে প্রযোজ্য হয়েছে! ৳${toBanglaNum(appliedDiscount)} ডিসকাউন্ট।`, "success");
    } else {
      appliedDiscount = null;
      showPromoMsg("প্রোমো কোডটিতে কোনো ডিসকাউন্ট পাওয়া যায়নি।", "error");
    }

    if (!silent) hideLoader();
    recalculateTotals();

  } catch (err) {
    console.error("Promo Error:", err);
    appliedDiscount = null;
    if (!silent) {
      hideLoader();
      showPromoMsg("প্রোমো কোড যাচাই করতে সমস্যা হয়েছে।", "error");
    }
    recalculateTotals();
  }
}

function showPromoMsg(text, type) {
  promoMessageEl.textContent = text;
  promoMessageEl.className = `promo-message ${type}`;
}

// ==========================================
// 21. ORDER ID GENERATOR
// ==========================================
function generateOrderId() {
  const random7Digit = Math.floor(1000000 + Math.random() * 9000000);
  return `S-P-${random7Digit}-SP-ORDER`;
}

// ==========================================
// 19, 25, 27. SUBMIT ORDER LOGIC
// ==========================================
submitOrderBtn.addEventListener('click', submitOrderFlow);

async function submitOrderFlow() {
  const name = nameInput.value.trim();
  const phone = phoneInput.value.trim();
  const deliverySite = deliverySiteSelect.value;
  const vibag = vibagInput.value.trim();
  const jela = jelaInput.value.trim();
  const thana = thanaInput.value.trim();
  const note = noteInput.value.trim() || null;

  if (!name) { showToast("আপনার নাম লিখুন।"); return; }
  if (!/^01\d{9}$/.test(phone)) { showToast("সঠিক ১১ সংখ্যার মোবাইল নাম্বার দিন।"); return; }
  if (!deliverySite) { showToast("ডেলিভারি এরিয়া নির্বাচন করুন।"); return; }
  if (!vibag || !jela || !thana) { showToast("বিভাগ, জেলা এবং থানা/উপজেলা লিখুন।"); return; }
  if (!currentUser || cartProducts.length === 0) { showToast("অর্ডার তৈরি করা যায়নি।"); return; }

  const { subtotal, deliveryCharge, discount, total } = recalculateTotals();

  submitOrderBtn.disabled = true;
  showLoader("অর্ডার তৈরি হচ্ছে...");

  try {
    let finalOrderId = generateOrderId();
    let orderRef = doc(db, "orders", finalOrderId);
    let orderSnap = await getDoc(orderRef);
    while (orderSnap.exists()) {
      finalOrderId = generateOrderId();
      orderRef = doc(db, "orders", finalOrderId);
      orderSnap = await getDoc(orderRef);
    }

    const orderPayload = {
      orderId: finalOrderId,
      createdAt: serverTimestamp(),
      uid: currentUser.uid,
      email: currentUser.email,
      status: "pending",
      productItem: cartProducts,
      thana, jela, vibag,
      deliverSite: deliverySite,
      note,
      deliveryCharge: Number(deliveryCharge),
      phone,
      subtotal: Number(subtotal),
      discount: discount !== null ? Number(discount) : null,
      total: Number(total),
      name
    };

    // Step 1: আগে অর্ডার ক্রিয়েট হবে
    const { setDoc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
    await setDoc(orderRef, orderPayload);
    
    console.log("Order Created:", finalOrderId);

    // Snapshot for hidden copy
    createdOrderSnapshot = { ...orderPayload, createdAt: new Date().toISOString() };

    // Step 2: অর্ডার সফল হলে তারপর কার্ট খালি হবে
    try {
      const cartRef = doc(db, "carts", currentUser.uid);
      await updateDoc(cartRef, { productItem: [] });
      console.log("Cart cleared");
    } catch (cartErr) {
      console.warn("Cart clear failed but order is success:", cartErr);
      // কার্ট খালি না হলেও সমস্যা নেই, অর্ডার তো হয়েই গেছে
    }

    hideLoader();
    successModal.classList.remove('hidden');

  } catch (err) {
    console.error("Order Creation Error:", err);
    hideLoader();
    submitOrderBtn.disabled = false;
    showToast("অর্ডার তৈরি করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।");
  }
}

// ==========================================
// 29. HIDDEN JSON COPY INTERACTION
// ==========================================
successTitle.addEventListener('click', async () => {
  if (!createdOrderSnapshot) return;
  
  try {
    const jsonStr = JSON.stringify(createdOrderSnapshot, null, 2);
    await navigator.clipboard.writeText(jsonStr);
    showToast("তথ্য কপি হয়েছে।");
  } catch (err) {
    console.error("Clipboard copy failed:", err);
  }
});

// ==========================================
// 33. LOAD FOOTER DYNAMICALLY
// ==========================================
async function loadFooter() {
  try {
    const res = await fetch('https://seraproduct.com/footer');
    if (res.ok) {
      const html = await res.text();
      document.getElementById('footer-container').innerHTML = html;
    }
  } catch (err) {
    console.error("Footer load error:", err);
  }
}

loadFooter();
