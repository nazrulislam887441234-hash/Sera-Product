import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
  getFirestore, 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs, 
  startAfter, 
  doc, 
  onSnapshot, 
  updateDoc, 
  arrayUnion,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// CONSTANTS
const CART_PAGE_URL = "/cart";
const LOGIN_PAGE_URL = "https://seraproduct.com/login";
const CHECKOUT_PAGE_URL = "https://seraproduct.com/checkout";
const PAGE_SIZE = 20;

// FIREBASE CONFIGURATION
const firebaseConfig = {
  apiKey: "AIzaSyBRSt2aoSJ-lumYAWGAXE6ncui7__TqJ4E",
  authDomain: "sera-product.firebaseapp.com",
  projectId: "sera-product",
  storageBucket: "sera-product.firebasestorage.app",
  messagingSenderId: "516762224598",
  appId: "1:516762224598:web:b6a571f355a8a4a97c0677",
  measurementId: "G-RLMWH43FXX"
};

// INITIALIZE FIREBASE
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// GLOBAL STATE
let currentUser = null;
let currentCategoryDoc = null;
let lastVisibleProductDoc = null;
let isPageLoading = false;
let userCartProductIds = new Set();
let cartUnsubscribe = null;
let activeSliderIntervals = [];

// DOM ELEMENTS
const cartIconButton = document.getElementById("cartIconButton");
const cartBadge = document.getElementById("cartBadge");
const categoryBannerSection = document.getElementById("categoryBannerSection");
const categoryBannerImgWrap = document.getElementById("categoryBannerImgWrap");
const categoryTitleText = document.getElementById("categoryTitleText");
const mainLoading = document.getElementById("mainLoading");
const stateMessageCard = document.getElementById("stateMessageCard");
const stateTitleText = document.getElementById("stateTitleText");
const stateSubtitleText = document.getElementById("stateSubtitleText");
const productsGrid = document.getElementById("productsGrid");
const loadMoreContainer = document.getElementById("loadMoreContainer");
const btnLoadMore = document.getElementById("btnLoadMore");
const btnLoadSpinner = document.getElementById("btnLoadSpinner");
const loadMoreText = document.getElementById("loadMoreText");
const noMoreProductsText = document.getElementById("noMoreProductsText");

// MODAL ELEMENTS
const customModalOverlay = document.getElementById("customModalOverlay");
const modalTitle = document.getElementById("modalTitle");
const modalBody = document.getElementById("modalBody");
const modalCloseBtn = document.getElementById("modalCloseBtn");
const modalPrimaryBtn = document.getElementById("modalPrimaryBtn");
const modalFooter = document.getElementById("modalFooter");

// TOAST ELEMENTS
const toastContainer = document.getElementById("toastContainer");
const toastMessage = document.getElementById("toastMessage");

// HELPER: Bengali Number Formatter
function toBengaliNumerals(num) {
  if (num === null || num === undefined) return '';
  const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return num.toString().replace(/\d/g, (x) => bnDigits[x]);
}

function formatTaka(amount) {
  const formatted = Number(amount || 0).toLocaleString('en-IN');
  return `৳ ${toBengaliNumerals(formatted)}`;
}

// HELPER: Extract Clean Category Slug from Query String
function getCategorySlugFromURL() {
  const search = window.location.search;
  if (!search || search.length <= 1) return null;
  
  const rawQuery = search.substring(1);
  const firstParam = rawQuery.split('&')[0];
  const paramKey = firstParam.split('=')[0];
  
  if (!paramKey) return null;
  
  const ignoreParams = ['fbclid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid'];
  if (ignoreParams.includes(paramKey.toLowerCase())) {
    return null;
  }
  
  return decodeURIComponent(paramKey);
}

// CUSTOM MODAL SYSTEM
function openCustomModal({ title, bodyHTML, primaryBtnText, onPrimaryClick, showCancel = false, cancelBtnText = "বাতিল" }) {
  modalTitle.textContent = title || "বিজ্ঞপ্তি";
  modalBody.innerHTML = bodyHTML || "";
  
  modalFooter.innerHTML = "";
  
  if (showCancel) {
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "btn-secondary-modal";
    cancelBtn.textContent = cancelBtnText;
    cancelBtn.onclick = closeCustomModal;
    modalFooter.appendChild(cancelBtn);
  }
  
  const primaryBtn = document.createElement("button");
  primaryBtn.type = "button";
  primaryBtn.className = "btn-primary-modal";
  primaryBtn.textContent = primaryBtnText || "ঠিক আছে";
  primaryBtn.onclick = () => {
    if (onPrimaryClick) {
      const shouldClose = onPrimaryClick();
      if (shouldClose !== false) closeCustomModal();
    } else {
      closeCustomModal();
    }
  };
  modalFooter.appendChild(primaryBtn);
  
  customModalOverlay.classList.remove("hidden");
}

function closeCustomModal() {
  customModalOverlay.classList.add("hidden");
}

modalCloseBtn.addEventListener("click", closeCustomModal);
customModalOverlay.addEventListener("click", (e) => {
  if (e.target === customModalOverlay) closeCustomModal();
});

// CUSTOM TOAST SYSTEM
function showToast(message) {
  toastMessage.textContent = message;
  toastContainer.classList.remove("hidden");
  setTimeout(() => {
    toastContainer.classList.add("hidden");
  }, 3000);
}

// NAVIGATION HANDLERS
cartIconButton.addEventListener("click", () => {
  window.location.href = CART_PAGE_URL;
});

// INITIALIZATION FLOW
document.addEventListener("DOMContentLoaded", () => {
  loadFooter();
  initAuthListener();
  initCategoryPage();
});

// LOAD EXTERNAL FOOTER
function loadFooter() {
  fetch("https://seraproduct.com/footer")
    .then(response => {
      if (response.ok) return response.text();
      throw new Error("Footer load failed");
    })
    .then(html => {
      const container = document.getElementById("footer-container");
      if (container) container.innerHTML = html;
    })
    .catch(() => {
      // Quiet fail for footer
    });
}

// AUTH & REALTIME CART BADGE
function initAuthListener() {
  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
      listenToUserCart(user.uid);
    } else {
      if (cartUnsubscribe) cartUnsubscribe();
      userCartProductIds.clear();
      updateCartBadgeUI(0);
      reRenderProductCardsCartStatus();
    }
  });
}

function listenToUserCart(uid) {
  if (cartUnsubscribe) cartUnsubscribe();
  
  const cartRef = doc(db, "carts", uid);
  cartUnsubscribe = onSnapshot(cartRef, (docSnap) => {
    userCartProductIds.clear();
    let itemCount = 0;
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      const productItems = data.productItem || [];
      itemCount = productItems.length;
      
      productItems.forEach(item => {
        if (item.productId) {
          userCartProductIds.add(item.productId);
        }
      });
    }
    
    updateCartBadgeUI(itemCount);
    reRenderProductCardsCartStatus();
  }, (error) => {
    console.error("Cart listener error:", error);
  });
}

function updateCartBadgeUI(count) {
  if (count > 0) {
    cartBadge.textContent = toBengaliNumerals(count);
    cartBadge.classList.remove("hidden");
  } else {
    cartBadge.classList.add("hidden");
  }
}

// CATEGORY PAGE MAIN LOGIC
async function initCategoryPage() {
  const categorySlug = getCategorySlugFromURL();
  
  if (!categorySlug) {
    showStateMessage("ক্যাটাগরি পাওয়া যায়নি!", "ইউআরএল-এ সঠিক ক্যাটাগরি উল্লেখ নেই।");
    return;
  }
  
  try {
    // Single Document/Category Query
    const catQuery = query(
      collection(db, "categories"),
      where("categorySlug", "==", categorySlug),
      limit(1)
    );
    
    const catSnap = await getDocs(catQuery);
    
    if (catSnap.empty) {
      showStateMessage("ক্যাটাগরিটি পাওয়া যায়নি!", "আপনার অনুসন্ধানকৃত ক্যাটাগরিটি খুঁজে পাওয়া যায়নি।");
      return;
    }

    const catDoc = catSnap.docs[0];
    currentCategoryDoc = {
      id: catDoc.id,
      ...catDoc.data()
    };
    
    renderCategoryHeader(currentCategoryDoc);
    await loadInitialProducts(currentCategoryDoc.id);

  } catch (error) {
    console.error("Error loading category:", error);
    showStateMessage("ত্রুটি ঘটেছে!", "তথ্য লোড করতে সমস্যা হয়েছে। অনুগ্রহ করে রিফ্রেশ করুন।");
  }
}

function renderCategoryHeader(catData) {
  const catName = catData.categoryName || "পণ্যসমূহ";
  categoryTitleText.textContent = `${catName} এর পণ্যসমূহ`;
  
  if (catData.image) {
    categoryBannerImgWrap.innerHTML = `<img src="${catData.image}" alt="${catName}" loading="lazy" onerror="this.style.display='none'">`;
  } else {
    categoryBannerImgWrap.style.display = "none";
  }
  
  categoryBannerSection.classList.remove("hidden");
}

function showStateMessage(title, subtitle) {
  mainLoading.classList.add("hidden");
  stateTitleText.textContent = title;
  stateSubtitleText.textContent = subtitle || "";
  stateMessageCard.classList.remove("hidden");
}

// PRODUCTS FETCHING & PAGINATION
async function loadInitialProducts(categoryId) {
  mainLoading.classList.remove("hidden");
  
  try {
    const prodQuery = query(
      collection(db, "products"),
      where("categoryId", "==", categoryId),
      where("active", "==", true),
      orderBy("createdAt", "desc"),
      limit(PAGE_SIZE)
    );
    
    const snap = await getDocs(prodQuery);
    mainLoading.classList.add("hidden");
    
    if (snap.empty) {
      showStateMessage("এই ক্যাটাগরিতে বর্তমানে কোনো পণ্য নেই।", "");
      return;
    }
    
    lastVisibleProductDoc = snap.docs[snap.docs.length - 1];
    productsGrid.classList.remove("hidden");
    
    snap.docs.forEach(docSnap => {
      renderProductCard(docSnap.id, docSnap.data());
    });
    
    if (snap.docs.length === PAGE_SIZE) {
      loadMoreContainer.classList.remove("hidden");
      btnLoadMore.onclick = () => loadMoreProducts(categoryId);
    } else {
      loadMoreContainer.classList.remove("hidden");
      btnLoadMore.classList.add("hidden");
      noMoreProductsText.classList.remove("hidden");
    }

  } catch (error) {
    console.error("Error fetching products:", error);
    showStateMessage("পণ্য লোড করা সম্ভব হয়নি", "ফায়ারস্টোর ইনডেক্স সমস্যা হতে পারে।");
  }
}

async function loadMoreProducts(categoryId) {
  if (isPageLoading || !lastVisibleProductDoc) return;
  isPageLoading = true;
  
  btnLoadSpinner.classList.remove("hidden");
  loadMoreText.textContent = "লোড হচ্ছে...";
  
  try {
    const nextQuery = query(
      collection(db, "products"),
      where("categoryId", "==", categoryId),
      where("active", "==", true),
      orderBy("createdAt", "desc"),
      startAfter(lastVisibleProductDoc),
      limit(PAGE_SIZE)
    );
    
    const snap = await getDocs(nextQuery);
    
    btnLoadSpinner.classList.add("hidden");
    loadMoreText.textContent = "আরোও দেখুন";
    isPageLoading = false;
    
    if (snap.empty) {
      btnLoadMore.classList.add("hidden");
      noMoreProductsText.classList.remove("hidden");
      return;
    }
    
    lastVisibleProductDoc = snap.docs[snap.docs.length - 1];
    
    snap.docs.forEach(docSnap => {
      renderProductCard(docSnap.id, docSnap.data());
    });
    
    if (snap.docs.length < PAGE_SIZE) {
      btnLoadMore.classList.add("hidden");
      noMoreProductsText.classList.remove("hidden");
    }

  } catch (error) {
    console.error("Error loading more products:", error);
    isPageLoading = false;
    btnLoadSpinner.classList.add("hidden");
    loadMoreText.textContent = "আরোও দেখুন";
    openCustomModal({ title: "ত্রুটি", bodyHTML: "আরও পণ্য লোড করা যায়নি।" });
  }
}

// PRODUCT CARD RENDERER
function renderProductCard(docId, productData) {
  const actualId = productData.id || docId;
  const productName = productData.productName || "নামহীন পণ্য";
  const customerPrice = Number(productData.customerPrice || 0);
  const customerOldPrice = Number(productData.customerOldPrice || 0);
  const isFreeDelivery = productData.freeDelivery === true;
  const productSlug = productData.productSlug || actualId;
  const images = Array.isArray(productData.image) && productData.image.length > 0 
    ? productData.image 
    : [];

  const card = document.createElement("div");
  card.className = "product-card";
  card.dataset.productId = actualId;

  // Compute Discounts
  let hasDiscount = false;
  let discountAmount = 0;
  let discountPercent = 0;

  if (customerOldPrice > customerPrice) {
    hasDiscount = true;
    discountAmount = customerOldPrice - customerPrice;
    discountPercent = Math.round((discountAmount / customerOldPrice) * 100);
  }

  // Image Slider HTML Construction
  let imagesHTML = "";
  if (images.length > 0) {
    imagesHTML = images.map((imgUrl, idx) => `
      <div class="slider-slide ${idx === 0 ? 'active' : ''}">
        <img src="${imgUrl}" alt="${productName}" class="product-image" loading="lazy" onerror="this.onerror=null; this.outerHTML='<svg class=\\'image-fallback-svg\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\'><rect x=\\'3\\' y=\\'3\\' width=\\'18\\' height=\\'18\\' rx=\\'2\\'/><circle cx=\\'8.5\\' cy=\\'8.5\\' r=\\'1.5\\'/><path d=\\'M21 15l-5-5L5 21\\'/></svg>';">
      </div>
    `).join("");
  } else {
    imagesHTML = `
      <div class="slider-slide active">
        <svg class="image-fallback-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <path d="M21 15l-5-5L5 21"/>
        </svg>
      </div>
    `;
  }

  const isAlreadyInCart = userCartProductIds.has(actualId);

  card.innerHTML = `
    <div class="product-card-top">
      <div class="slider-container" id="slider-${actualId}">
        ${imagesHTML}
      </div>
      <div class="badge-stack">
        ${isFreeDelivery ? `<span class="badge-free-delivery"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:10px;height:10px"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>ডেলিভারি ফ্রি!</span>` : ''}
        ${hasDiscount ? `<span class="badge-discount-percent">${toBengaliNumerals(discountPercent)}% ছাড়</span>` : ''}
      </div>
    </div>
    
    <div class="product-card-body">
      <h3 class="product-title">${productName}</h3>
      
      <div class="price-container">
        <div class="current-price">${formatTaka(customerPrice)}</div>
        ${hasDiscount ? `
          <div class="old-price-row">
            <span class="old-price">${formatTaka(customerOldPrice)}</span>
            <span class="discount-amount">সাশ্রয় ${formatTaka(discountAmount)}</span>
          </div>
        ` : ''}
      </div>

      <div class="card-actions">
        ${isAlreadyInCart ? `<div class="cart-added-info">এই পণ্যটা কার্টে যোগ করা আছে!</div>` : ''}
        
        <button type="button" class="btn-card btn-order-now action-btn-order" data-action="order">
          <svg class="btn-svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="9" cy="21" r="1"></circle>
            <circle cx="20" cy="21" r="1"></circle>
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
          </svg>
          এখনই অর্ডার করুন
        </button>

        ${!isAlreadyInCart ? `
          <button type="button" class="btn-card btn-add-cart action-btn-cart" data-action="cart">
            <svg class="btn-svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            কার্টে যোগ করুন
          </button>
        ` : ''}
      </div>
    </div>
  `;

  // Product Card Click -> Open Detail Page
  card.addEventListener("click", (e) => {
    if (e.target.closest("button")) return; // Don't trigger when clicking action buttons
    window.open(`https://seraproduct.com/product?${productSlug}`, "_blank");
  });

  // Action Buttons Handler
  const orderBtn = card.querySelector(".action-btn-order");
  const cartBtn = card.querySelector(".action-btn-cart");

  if (orderBtn) {
    orderBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      handleProductAction({ docId, productData: { ...productData, id: actualId } }, "ORDER_NOW");
    });
  }

  if (cartBtn) {
    cartBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      handleProductAction({ docId, productData: { ...productData, id: actualId } }, "ADD_TO_CART");
    });
  }

  productsGrid.appendChild(card);

  // Setup Image Slider if multiple images exist
  if (images.length > 1) {
    setupCardImageSlider(card, actualId, images.length);
  }
}

// AUTOMATIC INDEPENDENT IMAGE SLIDER
function setupCardImageSlider(cardElement, productId, totalImages) {
  let currentIndex = 0;
  const slides = cardElement.querySelectorAll(".slider-slide");

  const intervalId = setInterval(() => {
    slides[currentIndex].classList.remove("active");
    currentIndex = (currentIndex + 1) % totalImages;
    slides[currentIndex].classList.add("active");
  }, 3500);

  activeSliderIntervals.push(intervalId);
}

// RE-RENDER CARDS ON REAL-TIME CART STATUS CHANGE
function reRenderProductCardsCartStatus() {
  const cards = productsGrid.querySelectorAll(".product-card");
  cards.forEach(card => {
    const pId = card.dataset.productId;
    const isAlreadyInCart = userCartProductIds.has(pId);
    
    const actionsContainer = card.querySelector(".card-actions");
    const existingInfo = actionsContainer.querySelector(".cart-added-info");
    const existingCartBtn = actionsContainer.querySelector(".action-btn-cart");

    if (isAlreadyInCart) {
      if (!existingInfo) {
        const infoDiv = document.createElement("div");
        infoDiv.className = "cart-added-info";
        infoDiv.textContent = "এই পণ্যটা কার্টে যোগ করা আছে!";
        actionsContainer.insertBefore(infoDiv, actionsContainer.firstChild);
      }
      if (existingCartBtn) {
        existingCartBtn.remove();
      }
    }
  });
}

// PRODUCT ACTION (CART / ORDER) HANDLER
async function handleProductAction({ docId, productData }, actionType) {
  // 1. Auth Check
  if (!currentUser) {
    window.location.href = LOGIN_PAGE_URL;
    return;
  }

  const productId = productData.id || docId;
  const isAlreadyInCart = userCartProductIds.has(productId);

  // 2. If already in cart and clicked ORDER NOW -> direct checkout
  if (isAlreadyInCart && actionType === "ORDER_NOW") {
    window.location.href = CHECKOUT_PAGE_URL;
    return;
  }

  const hasVariants = Array.isArray(productData.variants) && productData.variants.length > 0;

  if (hasVariants) {
    // Open Custom Variant Popup
    showVariantSelectionPopup(productData, actionType);
  } else {
    // Save directly with base price
    const finalPrice = Number(productData.customerPrice || 0);
    await saveToCartAndProcess(productData, finalPrice, [], actionType);
  }
}

// CUSTOM VARIANT SELECTION POPUP
function showVariantSelectionPopup(product, actionType) {
  let html = `
    <p style="margin-bottom: 12px; color: var(--text-muted); font-size:13px;">পণ্যের অপশন নির্বাচন করুন:</p>
    <form id="variantSelectionForm">
  `;

  product.variants.forEach((vGroup, groupIdx) => {
    html += `
      <div class="variant-group">
        <div class="variant-group-title">${vGroup.name || 'অপশন'}:</div>
        <div class="variant-options-list">
    `;

    const valArray = Array.isArray(vGroup.values) ? vGroup.values : [];
    valArray.forEach((vVal, valIdx) => {
      const extraPrice = Number(vVal.extraPrice || 0);
      const extraLabel = extraPrice > 0 ? ` (+${formatTaka(extraPrice)})` : '';
      
      html += `
        <div class="variant-option-item">
          <input type="radio" name="variant_group_${groupIdx}" id="v_${groupIdx}_${valIdx}" value="${valIdx}" data-group-name="${vGroup.name || ''}" data-value-name="${vVal.value || ''}" data-extra-price="${extraPrice}">
          <label for="v_${groupIdx}_${valIdx}" class="variant-label">
            ${vVal.value || ''} <span class="variant-extra-price">${extraLabel}</span>
          </label>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;
  });

  html += `
      <span class="variant-error-msg hidden" id="variantErrorMsg">দয়া করে সব পণ্যের অপশন নির্বাচন করুন।</span>
    </form>
  `;

  openCustomModal({
    title: product.productName || "অপশন বাছাই করুন",
    bodyHTML: html,
    primaryBtnText: actionType === "ORDER_NOW" ? "এখনই অর্ডার করুন" : "কার্টে যোগ করুন",
    showCancel: true,
    cancelBtnText: "বাতিল",
    onPrimaryClick: () => {
      const form = document.getElementById("variantSelectionForm");
      const errEl = document.getElementById("variantErrorMsg");
      const selectedVariants = [];
      let totalExtra = 0;
      let allSelected = true;

      product.variants.forEach((vGroup, groupIdx) => {
        const selectedRadio = form.querySelector(`input[name="variant_group_${groupIdx}"]:checked`);
        if (!selectedRadio) {
          allSelected = false;
        } else {
          const extraPrice = Number(selectedRadio.dataset.extraPrice || 0);
          totalExtra += extraPrice;
          selectedVariants.push({
            name: selectedRadio.dataset.groupName,
            value: selectedRadio.dataset.valueName,
            extraPrice: extraPrice
          });
        }
      });

      if (!allSelected) {
        errEl.classList.remove("hidden");
        return false; // Keep modal open
      }

      errEl.classList.add("hidden");
      const finalPrice = Number(product.customerPrice || 0) + totalExtra;
      
      saveToCartAndProcess(product, finalPrice, selectedVariants, actionType);
      return true; // Close modal
    }
  });
}

// FIRESTORE CART SAVE WORKFLOW
async function saveToCartAndProcess(product, finalPrice, selectedVariants, actionType) {
  if (!currentUser) return;

  const firstImg = Array.isArray(product.image) && product.image.length > 0 ? product.image[0] : "";
  
  const cartObject = {
    productId: product.id,
    productName: product.productName || "",
    productImage: firstImg,
    productPrice: finalPrice,
    freeDelivery: product.freeDelivery === true,
    variants: selectedVariants,
    quantity: 1
  };

  if (product.warranty) {
    cartObject.warranty = product.warranty;
  }

  try {
    const userCartRef = doc(db, "carts", currentUser.uid);
    
    await setDoc(userCartRef, {
    productItem: arrayUnion(cartObject)
}, { merge: true });

    if (actionType === "ORDER_NOW") {
      window.location.href = CHECKOUT_PAGE_URL;
    } else {
      showToast("পণ্যটি কার্টে যোগ করা হয়েছে!");
    }

  } catch (error) {
    console.error("Error updating cart:", error);
    openCustomModal({
      title: "ত্রুটি",
      bodyHTML: "কার্টে সংরক্ষণ করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।"
    });
  }
}
