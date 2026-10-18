import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";

import {
  getFirestore,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
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
const db = getFirestore(app);

// ==========================================
// STATE MANAGEMENT
// ==========================================
let lastVisible = null;
let hasMore = true;
let isLoading = false;

const PAGE_LIMIT = 20;

// ==========================================
// DOM ELEMENTS
// ==========================================
const categoriesGrid = document.getElementById("categoriesGrid");
const loadMoreContainer = document.getElementById("loadMoreContainer");
const loadMoreBtn = document.getElementById("loadMoreBtn");
const emptyState = document.getElementById("emptyState");
const errorState = document.getElementById("errorState");
const retryBtn = document.getElementById("retryBtn");
const endMessage = document.getElementById("endMessage");
const footerContainer = document.getElementById("footerContainer");

// ==========================================
// FALLBACK IMAGE
// ==========================================
const fallbackSvgMarkup = `
  <div class="image-fallback">
    <svg
      viewBox="0 0 24 24"
      width="32"
      height="32"
      stroke="currentColor"
      stroke-width="1.5"
      fill="none"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
      <circle cx="8.5" cy="8.5" r="1.5"></circle>
      <polyline points="21 15 16 10 5 21"></polyline>
    </svg>
  </div>
`;

// ==========================================
// INITIAL CATEGORY LOAD
// ==========================================
async function loadInitialCategories() {
  if (isLoading) return;

  isLoading = true;
  lastVisible = null;
  hasMore = true;

  if (categoriesGrid) categoriesGrid.innerHTML = "";
  if (errorState) errorState.classList.add("hidden");
  if (emptyState) emptyState.classList.add("hidden");
  if (endMessage) endMessage.classList.add("hidden");
  if (loadMoreContainer) loadMoreContainer.classList.add("hidden");

  try {
    renderSkeletons(PAGE_LIMIT);

    const q = query(
      collection(db, "categories"),
      orderBy("createdAt", "desc"),
      limit(PAGE_LIMIT)
    );

    const snapshot = await getDocs(q);

    if (categoriesGrid) categoriesGrid.innerHTML = "";

    if (snapshot.empty) {
      hasMore = false;

      if (emptyState) emptyState.classList.remove("hidden");
      return;
    }

    const docs = snapshot.docs;
    lastVisible = docs[docs.length - 1];

    renderCategories(docs);

    if (docs.length < PAGE_LIMIT) {
      hasMore = false;

      if (endMessage) endMessage.classList.remove("hidden");
    } else {
      if (loadMoreContainer) {
        loadMoreContainer.classList.remove("hidden");
      }
    }

  } catch (error) {
    console.error("Error loading categories:", error);

    if (categoriesGrid) categoriesGrid.innerHTML = "";
    if (errorState) errorState.classList.remove("hidden");

  } finally {
    isLoading = false;
  }
}

// ==========================================
// LOAD MORE CATEGORIES
// ==========================================
async function loadMoreCategories() {
  if (isLoading || !hasMore || !lastVisible) return;

  isLoading = true;

  if (loadMoreBtn) {
    loadMoreBtn.disabled = true;

    const buttonText = loadMoreBtn.querySelector("span");
    if (buttonText) buttonText.textContent = "লোড হচ্ছে...";
  }

  try {
    const q = query(
      collection(db, "categories"),
      orderBy("createdAt", "desc"),
      startAfter(lastVisible),
      limit(PAGE_LIMIT)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      hasMore = false;

      if (loadMoreContainer) {
        loadMoreContainer.classList.add("hidden");
      }

      if (endMessage) endMessage.classList.remove("hidden");
      return;
    }

    const docs = snapshot.docs;
    lastVisible = docs[docs.length - 1];

    renderCategories(docs);

    if (docs.length < PAGE_LIMIT) {
      hasMore = false;

      if (loadMoreContainer) {
        loadMoreContainer.classList.add("hidden");
      }

      if (endMessage) endMessage.classList.remove("hidden");
    }

  } catch (error) {
    console.error("Error loading more categories:", error);
    showInlineError();

  } finally {
    isLoading = false;

    if (loadMoreBtn) {
      loadMoreBtn.disabled = false;

      const buttonText = loadMoreBtn.querySelector("span");
      if (buttonText) buttonText.textContent = "আরও দেখুন";
    }
  }
}

// ==========================================
// RENDER CATEGORIES
// ==========================================
function renderCategories(docs) {
  if (!categoriesGrid) return;

  const fragment = document.createDocumentFragment();

  docs.forEach(docSnap => {
    const data = docSnap.data();
    const card = createCategoryCard(data);

    fragment.appendChild(card);
  });

  categoriesGrid.appendChild(fragment);
}

// ==========================================
// CREATE CATEGORY CARD
// শুধু ক্যাটাগরিতে ক্লিক করলে ক্যাটাগরি পেজ খুলবে
// কোনো Cart / Checkout / Login নেই
// ==========================================
function createCategoryCard(data) {
  const categoryName = data.categoryName || "ক্যাটাগরি";
  const categorySlug = data.categorySlug || "";
  const imageUrl = data.image || "";

  const card = document.createElement("a");

  card.className = "category-card";
  card.setAttribute("aria-label", categoryName);

  // URL format: /category?category-slug
  // বিদ্যমান URL format বজায় রাখা হয়েছে
  card.href = categorySlug
    ? `https://seraproduct.com/category?${encodeURIComponent(categorySlug)}`
    : "https://seraproduct.com/category";

  const imageWrap = document.createElement("div");
  imageWrap.className = "image-fallback-container image-wrap";

  if (imageUrl) {
    const img = document.createElement("img");

    img.src = imageUrl;
    img.alt = categoryName;
    img.className = "category-img";
    img.loading = "lazy";
    img.decoding = "async";

    img.onerror = () => {
      imageWrap.innerHTML = fallbackSvgMarkup;
    };

    imageWrap.appendChild(img);
  } else {
    imageWrap.innerHTML = fallbackSvgMarkup;
  }

  const nameDiv = document.createElement("div");
  nameDiv.className = "category-name";
  nameDiv.textContent = categoryName;

  card.appendChild(imageWrap);
  card.appendChild(nameDiv);

  // কোনো অতিরিক্ত click handler বা redirect নেই।
  // সাধারণ anchor link-ই নেভিগেশন করবে।

  return card;
}

// ==========================================
// SKELETON LOADERS
// ==========================================
function renderSkeletons(count) {
  if (!categoriesGrid) return;

  const fragment = document.createDocumentFragment();

  for (let i = 0; i < count; i++) {
    const skeleton = document.createElement("div");
    skeleton.className = "category-card skeleton-card";

    fragment.appendChild(skeleton);
  }

  categoriesGrid.appendChild(fragment);
}

// ==========================================
// INLINE ERROR
// ==========================================
function showInlineError() {
  if (!loadMoreBtn) return;

  const buttonText = loadMoreBtn.querySelector("span");

  if (buttonText) {
    buttonText.textContent = "আবার চেষ্টা করুন";
  }
}

// ==========================================
// DYNAMIC FOOTER
// ==========================================
async function loadFooter() {
  if (!footerContainer) return;

  try {
    const response = await fetch("https://seraproduct.com/footer");

    if (!response.ok) {
      throw new Error("Footer load failed");
    }

    footerContainer.innerHTML = await response.text();

  } catch (error) {
    console.warn("Footer could not be loaded:", error);

    footerContainer.innerHTML = `
      <div style="
        text-align:center;
        padding:20px;
        font-size:13px;
        color:#777;
      ">
        Sera Product © 2026
      </div>
    `;
  }
}

// ==========================================
// EVENT LISTENERS
// ==========================================
if (loadMoreBtn) {
  loadMoreBtn.addEventListener("click", loadMoreCategories);
}

if (retryBtn) {
  retryBtn.addEventListener("click", loadInitialCategories);
}

// ==========================================
// INITIALIZE PAGE
// ==========================================
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    loadInitialCategories();
    loadFooter();
  });
} else {
  loadInitialCategories();
  loadFooter();
}
