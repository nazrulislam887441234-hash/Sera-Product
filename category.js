/* ==========================================
   FIREBASE IMPORTS
   Firebase শুধু ক্যাটাগরি ও পণ্য লোড করবে
   ========================================== */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";

import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  startAfter
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

/* ==========================================
   CONFIGURATION
   ========================================== */
const PAGE_SIZE = 20;

// কার্ট পেজ
const CART_PAGE_URL = "/cart";

// Product detail page
const PRODUCT_PAGE_URL = "https://seraproduct.com/product";

// LocalStorage key — কার্ট পেজেও একই key ব্যবহার করবেন
const CART_STORAGE_KEY = "seraProductCart";

/* ==========================================
   FIREBASE CONFIGURATION
   ========================================== */
const firebaseConfig = {
  apiKey: "AIzaSyBRSt2aoSJ-lumYAWGAXE6ncui7__TqJ4E",
  authDomain: "sera-product.firebaseapp.com",
  projectId: "sera-product",
  storageBucket: "sera-product.firebasestorage.app",
  messagingSenderId: "516762224598",
  appId: "1:516762224598:web:b6a571f355a8a4a97c0677",
  measurementId: "G-RLMWH43FXX"
};

/* ==========================================
   INITIALIZE FIREBASE
   ========================================== */
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* ==========================================
   GLOBAL STATE
   ========================================== */
let currentCategoryDoc = null;
let lastVisibleProductDoc = null;
let isPageLoading = false;
let activeSliderIntervals = [];

/* ==========================================
   DOM ELEMENTS
   ========================================== */
const cartIconButton = document.getElementById("cartIconButton");

const categoryBannerSection =
  document.getElementById("categoryBannerSection");

const categoryBannerImgWrap =
  document.getElementById("categoryBannerImgWrap");

const categoryTitleText =
  document.getElementById("categoryTitleText");

const mainLoading =
  document.getElementById("mainLoading");

const stateMessageCard =
  document.getElementById("stateMessageCard");

const stateTitleText =
  document.getElementById("stateTitleText");

const stateSubtitleText =
  document.getElementById("stateSubtitleText");

const productsGrid =
  document.getElementById("productsGrid");

const loadMoreContainer =
  document.getElementById("loadMoreContainer");

const btnLoadMore =
  document.getElementById("btnLoadMore");

const btnLoadSpinner =
  document.getElementById("btnLoadSpinner");

const loadMoreText =
  document.getElementById("loadMoreText");

const noMoreProductsText =
  document.getElementById("noMoreProductsText");

/* ==========================================
   MODAL ELEMENTS
   ========================================== */
const customModalOverlay =
  document.getElementById("customModalOverlay");

const modalTitle =
  document.getElementById("modalTitle");

const modalBody =
  document.getElementById("modalBody");

const modalCloseBtn =
  document.getElementById("modalCloseBtn");

const modalFooter =
  document.getElementById("modalFooter");

/* ==========================================
   HELPER: BENGALI NUMERALS
   ========================================== */
function toBengaliNumerals(num) {
  if (num === null || num === undefined) {
    return "";
  }

  const bnDigits = [
    "০", "১", "২", "৩", "৪",
    "৫", "৬", "৭", "৮", "৯"
  ];

  return String(num).replace(/\d/g, digit => {
    return bnDigits[Number(digit)];
  });
}

/* ==========================================
   HELPER: FORMAT TAKA
   ========================================== */
function formatTaka(amount) {
  const formatted = Number(amount || 0).toLocaleString("en-IN");

  return `৳ ${toBengaliNumerals(formatted)}`;
}

/* ==========================================
   LOCAL STORAGE CART HELPER
   Firebase কার্টের জন্য ব্যবহার হবে না
   ========================================== */

// LocalStorage থেকে কার্টের তথ্য পড়ুন
function getLocalCart() {
  try {
    const savedCart = localStorage.getItem(CART_STORAGE_KEY);

    if (!savedCart) {
      return [];
    }

    const parsedCart = JSON.parse(savedCart);

    return Array.isArray(parsedCart) ? parsedCart : [];
  } catch (error) {
    console.error("LocalStorage cart read error:", error);
    return [];
  }
}

// LocalStorage-এ কার্ট সংরক্ষণ করুন
function saveLocalCart(cartItems) {
  try {
    localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify(cartItems)
    );

    return true;
  } catch (error) {
    console.error("LocalStorage cart save error:", error);
    return false;
  }
}

/* ==========================================
   CART ICON NAVIGATION
   কোনো Firebase login/cart listener নেই
   ========================================== */
if (cartIconButton) {
  cartIconButton.addEventListener("click", () => {
    window.location.href = CART_PAGE_URL;
  });
}

/* ==========================================
   MODAL SYSTEM
   ========================================== */
function openCustomModal({
  title,
  bodyHTML,
  primaryBtnText = "ঠিক আছে"
}) {
  if (
    !customModalOverlay ||
    !modalTitle ||
    !modalBody ||
    !modalFooter
  ) {
    alert(title || "বিজ্ঞপ্তি");
    return;
  }

  modalTitle.textContent = title || "বিজ্ঞপ্তি";
  modalBody.innerHTML = bodyHTML || "";
  modalFooter.innerHTML = "";

  const primaryBtn = document.createElement("button");

  primaryBtn.type = "button";
  primaryBtn.className = "btn-primary-modal";
  primaryBtn.textContent = primaryBtnText;

  primaryBtn.addEventListener("click", closeCustomModal);

  modalFooter.appendChild(primaryBtn);
  customModalOverlay.classList.remove("hidden");
}

function closeCustomModal() {
  if (customModalOverlay) {
    customModalOverlay.classList.add("hidden");
  }
}

if (modalCloseBtn) {
  modalCloseBtn.addEventListener("click", closeCustomModal);
}

if (customModalOverlay) {
  customModalOverlay.addEventListener("click", event => {
    if (event.target === customModalOverlay) {
      closeCustomModal();
    }
  });
}

/* ==========================================
   GET CATEGORY SLUG FROM URL
   ========================================== */
function getCategorySlugFromURL() {
  const search = window.location.search;

  if (!search || search.length <= 1) {
    return null;
  }

  const rawQuery = search.substring(1);
  const firstParam = rawQuery.split("&")[0];
  const paramKey = firstParam.split("=")[0];

  if (!paramKey) {
    return null;
  }

  let decodedKey;

  try {
    decodedKey = decodeURIComponent(paramKey);
  } catch {
    return null;
  }

  const ignoreParams = [
    "fbclid",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "gclid"
  ];

  if (ignoreParams.includes(decodedKey.toLowerCase())) {
    return null;
  }

  return decodedKey;
}

/* ==========================================
   INITIALIZATION
   ========================================== */
document.addEventListener("DOMContentLoaded", () => {
  loadFooter();
  initCategoryPage();
});

/* ==========================================
   LOAD EXTERNAL FOOTER
   ========================================== */
function loadFooter() {
  fetch("https://seraproduct.com/footer")
    .then(response => {
      if (!response.ok) {
        throw new Error("Footer load failed");
      }

      return response.text();
    })
    .then(html => {
      const container = document.getElementById("footer-container");

      if (container) {
        container.innerHTML = html;
      }
    })
    .catch(() => {
      // Footer load failure will not block the page.
    });
}

/* ==========================================
   CATEGORY PAGE MAIN LOGIC
   ========================================== */
async function initCategoryPage() {
  const categorySlug = getCategorySlugFromURL();

  if (!categorySlug) {
    showStateMessage(
      "ক্যাটাগরি পাওয়া যায়নি!",
      "ইউআরএল-এ সঠিক ক্যাটাগরি উল্লেখ নেই।"
    );
    return;
  }

  try {
    const catQuery = query(
      collection(db, "categories"),
      where("categorySlug", "==", categorySlug),
      limit(1)
    );

    const catSnap = await getDocs(catQuery);

    if (catSnap.empty) {
      showStateMessage(
        "ক্যাটাগরিটি পাওয়া যায়নি!",
        "আপনার অনুসন্ধানকৃত ক্যাটাগরিটি খুঁজে পাওয়া যায়নি।"
      );
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

    showStateMessage(
      "ত্রুটি ঘটেছে!",
      "তথ্য লোড করতে সমস্যা হয়েছে। অনুগ্রহ করে রিফ্রেশ করুন।"
    );
  }
}

/* ==========================================
   CATEGORY HEADER
   ========================================== */
function renderCategoryHeader(catData) {
  const catName = catData.categoryName || "পণ্যসমূহ";

  if (categoryTitleText) {
    categoryTitleText.textContent = `${catName} এর পণ্যসমূহ`;
  }

  if (categoryBannerImgWrap) {
    if (catData.image) {
      categoryBannerImgWrap.style.display = "";

      const img = document.createElement("img");
      img.src = catData.image;
      img.alt = catName;
      img.loading = "lazy";

      img.onerror = () => {
        img.style.display = "none";
      };

      categoryBannerImgWrap.replaceChildren(img);
    } else {
      categoryBannerImgWrap.style.display = "none";
    }
  }

  if (categoryBannerSection) {
    categoryBannerSection.classList.remove("hidden");
  }
}

/* ==========================================
   STATE MESSAGE
   ========================================== */
function showStateMessage(title, subtitle = "") {
  if (mainLoading) {
    mainLoading.classList.add("hidden");
  }

  if (stateTitleText) {
    stateTitleText.textContent = title;
  }

  if (stateSubtitleText) {
    stateSubtitleText.textContent = subtitle;
  }

  if (stateMessageCard) {
    stateMessageCard.classList.remove("hidden");
  }
}

/* ==========================================
   LOAD INITIAL PRODUCTS
   ========================================== */
async function loadInitialProducts(categoryId) {
  if (mainLoading) {
    mainLoading.classList.remove("hidden");
  }

  try {
    const prodQuery = query(
      collection(db, "products"),
      where("categoryId", "==", categoryId),
      where("active", "==", true),
      orderBy("createdAt", "desc"),
      limit(PAGE_SIZE)
    );

    const snap = await getDocs(prodQuery);

    if (mainLoading) {
      mainLoading.classList.add("hidden");
    }

    if (snap.empty) {
      showStateMessage(
        "এই ক্যাটাগরিতে বর্তমানে কোনো পণ্য নেই।",
        ""
      );

      return;
    }

    lastVisibleProductDoc = snap.docs[snap.docs.length - 1];

    if (productsGrid) {
      productsGrid.innerHTML = "";
      productsGrid.classList.remove("hidden");
    }

    // একবারে DOM-এ যুক্ত করা হচ্ছে
    const fragment = document.createDocumentFragment();

    snap.docs.forEach(docSnap => {
      const card = createProductCard(
        docSnap.id,
        docSnap.data()
      );

      if (card) {
        fragment.appendChild(card);
      }
    });

    if (productsGrid) {
      productsGrid.appendChild(fragment);
    }

    if (snap.docs.length === PAGE_SIZE) {
      if (loadMoreContainer) {
        loadMoreContainer.classList.remove("hidden");
      }

      if (btnLoadMore) {
        btnLoadMore.classList.remove("hidden");
        btnLoadMore.onclick = () => loadMoreProducts(categoryId);
      }

      if (noMoreProductsText) {
        noMoreProductsText.classList.add("hidden");
      }
    } else {
      if (loadMoreContainer) {
        loadMoreContainer.classList.remove("hidden");
      }

      if (btnLoadMore) {
        btnLoadMore.classList.add("hidden");
      }

      if (noMoreProductsText) {
        noMoreProductsText.classList.remove("hidden");
      }
    }

  } catch (error) {
    console.error("Error fetching products:", error);

    showStateMessage(
      "পণ্য লোড করা সম্ভব হয়নি",
      "ফায়ারস্টোর ইনডেক্স বা নেটওয়ার্ক সমস্যা হতে পারে।"
    );
  }
}

/* ==========================================
   LOAD MORE PRODUCTS
   ========================================== */
async function loadMoreProducts(categoryId) {
  if (isPageLoading || !lastVisibleProductDoc) {
    return;
  }

  isPageLoading = true;

  if (btnLoadMore) {
    btnLoadMore.disabled = true;
  }

  if (btnLoadSpinner) {
    btnLoadSpinner.classList.remove("hidden");
  }

  if (loadMoreText) {
    loadMoreText.textContent = "লোড হচ্ছে...";
  }

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

    if (snap.empty) {
      if (btnLoadMore) {
        btnLoadMore.classList.add("hidden");
      }

      if (noMoreProductsText) {
        noMoreProductsText.classList.remove("hidden");
      }

      return;
    }

    lastVisibleProductDoc = snap.docs[snap.docs.length - 1];

    const fragment = document.createDocumentFragment();

    snap.docs.forEach(docSnap => {
      const card = createProductCard(
        docSnap.id,
        docSnap.data()
      );

      if (card) {
        fragment.appendChild(card);
      }
    });

    if (productsGrid) {
      productsGrid.appendChild(fragment);
    }

    if (snap.docs.length < PAGE_SIZE) {
      if (btnLoadMore) {
        btnLoadMore.classList.add("hidden");
      }

      if (noMoreProductsText) {
        noMoreProductsText.classList.remove("hidden");
      }
    }

  } catch (error) {
    console.error("Error loading more products:", error);

    openCustomModal({
      title: "ত্রুটি",
      bodyHTML: "আরও পণ্য লোড করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।"
    });

  } finally {
    isPageLoading = false;

    if (btnLoadSpinner) {
      btnLoadSpinner.classList.add("hidden");
    }

    if (loadMoreText) {
      loadMoreText.textContent = "আরও দেখুন";
    }

    if (btnLoadMore && !btnLoadMore.classList.contains("hidden")) {
      btnLoadMore.disabled = false;
    }
  }
}

/* ==========================================
   CREATE PRODUCT CARD
   এখানে কোনো Add to Cart / Order / Login বাটন নেই
   ========================================== */
function createProductCard(docId, productData) {
  const actualId = productData.id || docId;
  const productName = productData.productName || "নামহীন পণ্য";

  const customerPrice = Number(productData.customerPrice || 0);
  const customerOldPrice = Number(productData.customerOldPrice || 0);

  const isFreeDelivery = productData.freeDelivery === true;
  const productSlug = productData.productSlug || actualId;

  const images = Array.isArray(productData.image)
    ? productData.image.filter(
        url => typeof url === "string" && url.trim() !== ""
      )
    : [];

  const card = document.createElement("div");

  card.className = "product-card";
  card.dataset.productId = actualId;
  card.style.cursor = "pointer";
  card.setAttribute("role", "link");
  card.setAttribute("tabindex", "0");
  card.setAttribute(
    "aria-label",
    `${productName} — বিস্তারিত দেখুন`
  );

  /* Discount calculation */
  const hasDiscount = customerOldPrice > customerPrice;

  const discountAmount = hasDiscount
    ? customerOldPrice - customerPrice
    : 0;

  const discountPercent = hasDiscount
    ? Math.round((discountAmount / customerOldPrice) * 100)
    : 0;

  /* Image slider */
  const slider = document.createElement("div");
  slider.className = "slider-container";

  images.forEach((imgUrl, index) => {
    const slide = document.createElement("div");

    slide.className =
      `slider-slide${index === 0 ? " active" : ""}`;

    const img = document.createElement("img");

    img.src = imgUrl;
    img.alt = productName;
    img.className = "product-image";
    img.loading = "lazy";

    img.onerror = () => {
      img.style.display = "none";

      const fallback = document.createElement("div");
      fallback.className = "image-fallback-svg";
      fallback.textContent = "ছবি নেই";

      slide.appendChild(fallback);
    };

    slide.appendChild(img);
    slider.appendChild(slide);
  });

  if (images.length === 0) {
    const slide = document.createElement("div");

    slide.className = "slider-slide active";

    const fallback = document.createElement("div");
    fallback.className = "image-fallback-svg";
    fallback.textContent = "ছবি নেই";

    slide.appendChild(fallback);
    slider.appendChild(slide);
  }

  /* Product card top */
  const cardTop = document.createElement("div");
  cardTop.className = "product-card-top";
  cardTop.appendChild(slider);

  const badgeStack = document.createElement("div");
  badgeStack.className = "badge-stack";

  if (isFreeDelivery) {
    const freeBadge = document.createElement("span");

    freeBadge.className = "badge-free-delivery";
    freeBadge.textContent = "ডেলিভারি ফ্রি!";

    badgeStack.appendChild(freeBadge);
  }

  if (hasDiscount) {
    const discountBadge = document.createElement("span");

    discountBadge.className = "badge-discount-percent";
    discountBadge.textContent =
      `${toBengaliNumerals(discountPercent)}% ছাড়`;

    badgeStack.appendChild(discountBadge);
  }

  cardTop.appendChild(badgeStack);

  /* Product card body */
  const cardBody = document.createElement("div");
  cardBody.className = "product-card-body";

  const title = document.createElement("h3");
  title.className = "product-title";
  title.textContent = productName;

  const priceContainer = document.createElement("div");
  priceContainer.className = "price-container";

  const currentPrice = document.createElement("div");
  currentPrice.className = "current-price";
  currentPrice.textContent = formatTaka(customerPrice);

  priceContainer.appendChild(currentPrice);

  if (hasDiscount) {
    const oldPriceRow = document.createElement("div");
    oldPriceRow.className = "old-price-row";

    const oldPrice = document.createElement("span");
    oldPrice.className = "old-price";
    oldPrice.textContent = formatTaka(customerOldPrice);

    const savedAmount = document.createElement("span");
    savedAmount.className = "discount-amount";
    savedAmount.textContent =
      `সাশ্রয় ${formatTaka(discountAmount)}`;

    oldPriceRow.append(oldPrice, savedAmount);
    priceContainer.appendChild(oldPriceRow);
  }

  cardBody.append(title, priceContainer);

  // কোনো Add to Cart, Order Now বা Login বাটন নেই
  card.append(cardTop, cardBody);

  /* ==========================================
     CLICK PRODUCT -> PRODUCT DETAIL PAGE
     ========================================== */
  function openProductPage() {
    const productUrl =
      `${PRODUCT_PAGE_URL}?${encodeURIComponent(productSlug)}`;

    window.location.href = productUrl;
  }

  card.addEventListener("click", openProductPage);

  card.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openProductPage();
    }
  });

  /* Automatic image slider */
  if (images.length > 1) {
    setupCardImageSlider(card, actualId, images.length);
  }

  return card;
}

/* ==========================================
   AUTOMATIC INDEPENDENT IMAGE SLIDER
   ========================================== */
function setupCardImageSlider(cardElement, productId, totalImages) {
  let currentIndex = 0;

  const slides = cardElement.querySelectorAll(".slider-slide");

  if (slides.length <= 1) {
    return;
  }

  const intervalId = setInterval(() => {
    if (!cardElement.isConnected) {
      clearInterval(intervalId);
      return;
    }

    slides[currentIndex].classList.remove("active");

    currentIndex = (currentIndex + 1) % totalImages;

    slides[currentIndex].classList.add("active");
  }, 3500);

  activeSliderIntervals.push(intervalId);
}

/* ==========================================
   OPTIONAL: LOCAL CART DATA ACCESS
   অন্য JS থেকে প্রয়োজন হলে ব্যবহার করতে পারবেন
   ========================================== */

// LocalStorage cart read/write functions global করে দেওয়া
window.SeraProductCart = {
  getItems: getLocalCart,
  saveItems: saveLocalCart,
  storageKey: CART_STORAGE_KEY
};
