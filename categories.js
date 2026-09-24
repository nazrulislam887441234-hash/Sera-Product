import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, query, orderBy, limit, getDocs, startAfter } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Firebase Configuration (প্লাগইন কনফিগারেশন এখানে বসান)
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

// State Management Variables
let lastVisible = null;
let hasMore = true;
let isLoading = false;
const PAGE_LIMIT = 20;

// DOM Elements
const categoriesGrid = document.getElementById("categoriesGrid");
const loadMoreContainer = document.getElementById("loadMoreContainer");
const loadMoreBtn = document.getElementById("loadMoreBtn");
const emptyState = document.getElementById("emptyState");
const errorState = document.getElementById("errorState");
const retryBtn = document.getElementById("retryBtn");
const endMessage = document.getElementById("endMessage");
const footerContainer = document.getElementById("footerContainer");

// SVG Fallback Icon Markup
const fallbackSvgMarkup = `
    <div class="image-fallback">
        <svg viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" stroke-width="1.5" fill="none">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21 15 16 10 5 21"></polyline>
        </svg>
    </div>
`;

// Initial Load Function
async function loadInitialCategories() {
    try {
        isLoading = true;
        errorState.classList.add("hidden");
        categoriesGrid.innerHTML = "";
        
        // Render Skeletons initially for UX
        renderSkeletons(PAGE_LIMIT);

        const q = query(
            collection(db, "categories"),
            orderBy("createdAt", "desc"),
            limit(PAGE_LIMIT)
        );

        const querySnapshot = await getDocs(q);
        
        // Remove skeletons
        categoriesGrid.innerHTML = "";

        if (querySnapshot.empty) {
            emptyState.classList.remove("hidden");
            loadMoreContainer.classList.add("hidden");
            return;
        }

        let docs = querySnapshot.docs;
        lastVisible = docs[docs.length - 1];

        renderCategories(docs);

        // Check if more documents exist
        if (docs.length < PAGE_LIMIT) {
            hasMore = false;
            endMessage.classList.remove("hidden");
        } else {
            loadMoreContainer.classList.remove("hidden");
        }

    } catch (error) {
        console.error("Error loading initial categories:", error);
        categoriesGrid.innerHTML = "";
        errorState.classList.remove("hidden");
    } finally {
        isLoading = false;
    }
}

// Load More Categories Function (Pagination)
async function loadMoreCategories() {
    if (isLoading || !hasMore || !lastVisible) return;

    try {
        isLoading = true;
        loadMoreBtn.disabled = true;
        loadMoreBtn.querySelector("span").textContent = "লোড হচ্ছে...";

        const q = query(
            collection(db, "categories"),
            orderBy("createdAt", "desc"),
            startAfter(lastVisible),
            limit(PAGE_LIMIT)
        );

        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            hasMore = false;
            loadMoreContainer.classList.add("hidden");
            endMessage.classList.remove("hidden");
            return;
        }

        let docs = querySnapshot.docs;
        lastVisible = docs[docs.length - 1];

        renderCategories(docs);

        if (docs.length < PAGE_LIMIT) {
            hasMore = false;
            loadMoreContainer.classList.add("hidden");
            endMessage.classList.remove("hidden");
        }

    } catch (error) {
        console.error("Error loading more categories:", error);
        showInlineError();
    } finally {
        isLoading = false;
        loadMoreBtn.disabled = false;
        loadMoreBtn.querySelector("span").textContent = "আরও দেখুন";
    }
}

// Render Category Cards
function renderCategories(docs) {
    const fragment = document.createDocumentFragment();

    docs.forEach((docSnap) => {
        const data = docSnap.data();
        const card = createCategoryCard(data);
        fragment.appendChild(card);
    });

    categoriesGrid.appendChild(fragment);
}

// Create Individual Category Card Element
function createCategoryCard(data) {
    const categoryName = data.categoryName || "ক্যাটাগরি";
    const categorySlug = data.categorySlug || "#";
    const imageUrl = data.image;

    const card = document.createElement("a");
    card.href = `https://seraproduct.com/category?${categorySlug}`;
    card.className = "category-card";
    card.setAttribute("aria-label", categoryName);

    card.addEventListener("click", (e) => {
        handleCategoryClick(e, categorySlug);
    });

    // Image Container Wrap
    const imageWrap = document.createElement("div");
    imageWrap.className = "image-fallback-container image-wrap";
    
    // Check and setup image
    if (imageUrl) {
        const img = document.createElement("img");
        img.src = imageUrl;
        img.alt = categoryName;
        img.className = "category-img";
        img.loading = "lazy";
        img.decoding = "async";

        // Fallback execution on error
        img.onerror = () => {
            imageWrap.innerHTML = fallbackSvgMarkup;
        };

        imageWrap.appendChild(img);
    } else {
        imageWrap.innerHTML = fallbackSvgMarkup;
    }

    // Name Element
    const nameDiv = document.createElement("div");
    nameDiv.className = "category-name";
    nameDiv.textContent = categoryName;

    card.appendChild(imageWrap);
    card.appendChild(nameDiv);

    return card;
}

// Handle Category Click Navigation
function handleCategoryClick(e, slug) {
    // Standard link click behaviour is maintained, custom analytics/routing can be handled here if needed
}

// Render Skeleton Loaders
function renderSkeletons(count) {
    for (let i = 0; i < count; i++) {
        const skeleton = document.createElement("div");
        skeleton.className = "category-card skeleton-card";
        categoriesGrid.appendChild(skeleton);
    }
}

// Load Dynamic Footer
async function loadFooter() {
    try {
        const response = await fetch("https://seraproduct.com/footer");
        if (!response.ok) throw new Error("Footer load failed");
        const htmlText = await response.text();
        footerContainer.innerHTML = htmlText;
    } catch (error) {
        console.warn("Footer could not be loaded dynamically, using fallback view.", error);
        footerContainer.innerHTML = `<div style="text-align: center; padding: 20px; font-size: 13px; color: #777;">Sera Product © 2026</div>`;
    }
}

// Inline Error message utility
function showInlineError() {
    // Temporary notification or alert logic if required during loadMore failure
}

// Event Listeners Registration
loadMoreBtn.addEventListener("click", loadMoreCategories);
retryBtn.addEventListener("click", loadInitialCategories);

// Initialize Page Execution on DOM Content Loaded
document.addEventListener("DOMContentLoaded", () => {
    loadInitialCategories();
    loadFooter();
});
