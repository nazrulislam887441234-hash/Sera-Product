import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, query, orderBy, limit, getDocs, startAfter } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Firebase Configuration (Replace with your actual project config)
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

// DOM Elements
const categoriesGrid = document.getElementById('categoriesGrid');
const emptyState = document.getElementById('emptyState');
const errorState = document.getElementById('errorState');
const retryBtn = document.getElementById('retryBtn');
const loadMoreContainer = document.getElementById('loadMoreContainer');
const loadMoreBtn = document.getElementById('loadMoreBtn');
const categorySearch = document.getElementById('categorySearch');

// Pagination & Data States
let allCategories = [];
let lastVisible = null;
const PAGE_LIMIT = 20;
let isFetching = false;
let hasMoreData = true;

// Initialize Application
function initApp() {
    handleAuthState();
    setupSearch();
    retryBtn.addEventListener('click', () => loadCategories(false));
    loadMoreBtn.addEventListener('click', () => loadCategories(true));
}

// Handle Authentication State
function handleAuthState() {
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = "https://seraproduct.com/reseller/login";
        } else {
            await loadCategories(false);
            loadFooter();
        }
    });
}

// Load Categories from Firestore with Cursor Pagination
async function loadCategories(isLoadMore = false) {
    if (isFetching || (!hasMoreData && isLoadMore)) return;
    isFetching = true;

    try {
        if (!isLoadMore) {
            showLoadingSkeleton();
            hideStates();
        } else {
            loadMoreBtn.textContent = "লোড হচ্ছে...";
            loadMoreBtn.disabled = true;
        }

        let q;
        if (isLoadMore && lastVisible) {
            q = query(
                collection(db, "categories"),
                orderBy("createdAt", "desc"),
                startAfter(lastVisible),
                limit(PAGE_LIMIT)
            );
        } else {
            q = query(
                collection(db, "categories"),
                orderBy("createdAt", "desc"),
                limit(PAGE_LIMIT)
            );
        }

        const querySnapshot = await getDocs(q);
        
        if (!isLoadMore) {
            allCategories = [];
        }

        if (querySnapshot.empty && !isLoadMore) {
            showEmptyState();
            isFetching = false;
            return;
        }

        if (querySnapshot.docs.length < PAGE_LIMIT) {
            hasMoreData = false;
            loadMoreContainer.classList.add('hidden');
        } else {
            hasMoreData = true;
            loadMoreContainer.classList.remove('hidden');
        }

        lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            allCategories.push({
                id: docSnap.id,
                categoryName: data.categoryName || "ক্যাটাগরি",
                categorySlug: data.categorySlug || "",
                image: data.image || "https://via.placeholder.com/150"
            });
        });

        renderCategories(allCategories);

    } catch (error) {
        console.error("Error loading categories:", error);
        if (!isLoadMore) {
            showError();
        } else {
            loadMoreBtn.textContent = "আরও দেখুন";
            loadMoreBtn.disabled = false;
        }
    } finally {
        isFetching = false;
        if (isLoadMore) {
            loadMoreBtn.textContent = "আরও দেখুন";
            loadMoreBtn.disabled = false;
        }
    }
}

// Render Categories Grid
function renderCategories(categoriesToRender) {
    hideStates();
    if (categoriesToRender.length === 0) {
        showEmptyState();
        return;
    }

    categoriesGrid.innerHTML = "";
    categoriesToRender.forEach(category => {
        const card = renderCategoryCard(category);
        categoriesGrid.appendChild(card);
    });
}

// Generate Individual Category Card Element
function renderCategoryCard(category) {
    const a = document.createElement('a');
    a.href = `https://seraproduct.com/reseller/category?${encodeURIComponent(category.categorySlug)}`;
    a.className = 'category-card';
    a.setAttribute('aria-label', category.categoryName);
    
    a.addEventListener('click', (e) => {
        e.preventDefault();
        handleCategoryClick(category.categorySlug);
    });

    a.innerHTML = `
        <div class="category-image-wrap">
            <img src="${escapeHTML(category.image)}" alt="${escapeHTML(category.categoryName)}" loading="lazy" onerror="this.src='https://via.placeholder.com/150'">
        </div>
        <span class="category-name">${escapeHTML(category.categoryName)}</span>
    `;

    return a;
}

// Handle Category Click Navigation
function handleCategoryClick(categorySlug) {
    if (!categorySlug) return;
    window.location.href = `https://seraproduct.com/reseller/category?${encodeURIComponent(categorySlug)}`;
}

// Setup Client-side Search Filtering
function setupSearch() {
    let debounceTimer;
    categorySearch.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        const queryText = e.target.value.toLowerCase().trim();
        
        debounceTimer = setTimeout(() => {
            if (!queryText) {
                renderCategories(allCategories);
                if (hasMoreData) loadMoreContainer.classList.remove('hidden');
                return;
            }

            loadMoreContainer.classList.add('hidden');
            const filtered = allCategories.filter(cat => 
                cat.categoryName.toLowerCase().includes(queryText) ||
                cat.categorySlug.toLowerCase().includes(queryText)
            );
            renderCategories(filtered);
        }, 300);
    });
}

// UI State Management Functions
function showLoadingSkeleton() {
    categoriesGrid.innerHTML = `
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
    `;
    emptyState.classList.add('hidden');
    errorState.classList.add('hidden');
    loadMoreContainer.classList.add('hidden');
}

function showEmptyState() {
    categoriesGrid.innerHTML = "";
    emptyState.classList.remove('hidden');
    errorState.classList.add('hidden');
    loadMoreContainer.classList.add('hidden');
}

function showError() {
    categoriesGrid.innerHTML = "";
    errorState.classList.remove('hidden');
    emptyState.classList.add('hidden');
    loadMoreContainer.classList.add('hidden');
}

function hideStates() {
    emptyState.classList.add('hidden');
    errorState.classList.add('hidden');
}

// Fetch and Load Official Footer Safely
async function loadFooter() {
    try {
        const response = await fetch('https://seraproduct.com/footer');
        if (response.ok) {
            const footerHtml = await response.text();
            document.getElementById('footer-container').innerHTML = footerHtml;
        }
    } catch (err) {
        console.warn("Footer load failed silently:", err);
    }
}

// Utility: Prevent XSS
function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}

// Run App on Load
document.addEventListener('DOMContentLoaded', initApp);
