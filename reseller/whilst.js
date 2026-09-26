import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    collection, 
    query, 
    where, 
    limit, 
    getDocs, 
    startAfter, 
    deleteDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Firebase Configuration Structure
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
const productGrid = document.getElementById('productGrid');
const loadingText = document.getElementById('loadingText');
const loadMoreContainer = document.getElementById('loadMoreContainer');
const loadMoreBtn = document.getElementById('loadMoreBtn');
const statusMessage = document.getElementById('statusMessage');
const menuToggle = document.getElementById('menuToggle');
const mobileNav = document.getElementById('mobileNav');
const mobileLogoutBtn = document.getElementById('mobileLogoutBtn');

// Modal Elements
const customModal = document.getElementById('customModal');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const modalCancelBtn = document.getElementById('modalCancelBtn');
const modalConfirmBtn = document.getElementById('modalConfirmBtn');

let currentUserUid = null;
let lastVisibleDoc = null;
let selectedDocIdToDelete = null;

// Mobile Menu Toggle
menuToggle.addEventListener('click', () => {
    mobileNav.classList.toggle('active');
});

// Load Footer Dynamically
async function loadFooter() {
    try {
        const response = await fetch("https://seraproduct.com/footer");
        if (response.ok) {
            const footerHtml = await response.text();
            document.getElementById('footerContainer').innerHTML = footerHtml;
        }
    } catch (error) {
        console.error("Footer load failed:", error);
    }
}
loadFooter();

// Authentication State Listener
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "https://seraproduct.com/reseller/login";
        return;
    }

    currentUserUid = user.uid;

    try {
        // Reseller Verification Check (Single Document Read)
        const resellerRef = doc(db, "reseller", user.uid);
        const resellerSnap = await getDoc(resellerRef);

        if (!resellerSnap.exists()) {
            showCustomAlert("আপনার রিসেলার তথ্য পাওয়া যায়নি!");
            await signOut(auth);
            window.location.href = "https://seraproduct.com/reseller/login";
            return;
        }

        const resellerData = resellerSnap.data();

        if (resellerData.active !== true) {
            showErrorState("আপনার রিসেলার অ্যাকাউন্ট বর্তমানে এক্টিভ নয়।");
            return;
        }

        if (resellerData.verified !== true) {
            showErrorState("আপনার রিসেলার অ্যাকাউন্ট এখনো ভেরিফাইড হয়নি।");
            return;
        }

        // Initial Data Fetch
        fetchWhilstProducts(true);

    } catch (error) {
        console.error("Verification error:", error);
        showErrorState("প্রোডাক্টগুলো লোড করা সম্ভব হয়নি। দয়া করে আবার চেষ্টা করুন।");
    }
});

// Fetch Whilst Data Function (Pagination with limit 20, no orderBy)
async function fetchWhilstProducts(isInitial = false) {
    try {
        if (isInitial) {
            productGrid.innerHTML = '';
            loadingText.style.display = 'block';
        } else {
            loadMoreBtn.textContent = "আরও প্রোডাক্ট লোড হচ্ছে...";
            loadMoreBtn.disabled = true;
        }

        let q;
        if (isInitial || !lastVisibleDoc) {
            q = query(
                collection(db, "whilst"), 
                where("uid", "==", currentUserUid), 
                limit(20)
            );
        } else {
            q = query(
                collection(db, "whilst"), 
                where("uid", "==", currentUserUid), 
                startAfter(lastVisibleDoc), 
                limit(20)
            );
        }

        const querySnapshot = await getDocs(q);
        
        if (isInitial) {
            loadingText.style.display = 'none';
        } else {
            loadMoreBtn.textContent = "আরও দেখুন";
            loadMoreBtn.disabled = false;
        }

        if (querySnapshot.empty && isInitial) {
            renderEmptyState();
            loadMoreContainer.style.display = 'none';
            return;
        }

        lastVisibleDoc = querySnapshot.docs[querySnapshot.docs.length - 1];

        querySnapshot.forEach((docSnapshot) => {
            const data = docSnapshot.data();
            const docId = docSnapshot.id;
            renderProductCard(docId, data);
        });

        // Toggle Load More visibility based on result size
        if (querySnapshot.docs.length < 20) {
            loadMoreContainer.style.display = 'none';
        } else {
            loadMoreContainer.style.display = 'block';
        }

    } catch (error) {
        console.error("Fetch whilst error:", error);
        loadingText.style.display = 'none';
        showErrorState("প্রোডাক্টগুলো লোড করা সম্ভব হয়নি। দয়া করে আবার চেষ্টা করুন।");
    }
}

// Load More Button Event
loadMoreBtn.addEventListener('click', () => {
    fetchWhilstProducts(false);
});

// Render Product Card
function renderProductCard(docId, data) {
    const { productId, productImage, productName, productSlug } = data;
    const productUrl = `https://seraproduct.com/reseller/product?${productSlug}`;

    const card = document.createElement('div');
    card.className = 'product-card';
    card.setAttribute('data-id', docId);

    card.innerHTML = `
        <button class="heart-delete-btn" aria-label="পছন্দের তালিকা থেকে সরান" data-id="${docId}">
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="currentColor">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
            </svg>
        </button>
        <a href="${productUrl}" target="_blank" rel="noopener noreferrer" class="card-link">
            <div class="card-img-wrapper">
                <img src="${productImage || 'https://via.placeholder.com/300'}" alt="${productName || 'Product'}" class="card-img" loading="lazy">
            </div>
            <div class="card-content">
                <h3 class="product-name">${productName || 'নামবিহীন প্রোডাক্ট'}</h3>
            </div>
        </a>
    `;

    // Heart Click Event for Delete Confirmation
    const deleteBtn = card.querySelector('.heart-delete-btn');
    deleteBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        selectedDocIdToDelete = docId;
        openModal();
    });

    productGrid.appendChild(card);
}

// Empty State View
function renderEmptyState() {
    productGrid.innerHTML = `
        <div class="empty-state">
            <h3>আপনার পছন্দের তালিকা খালি</h3>
            <p>আপনি যে প্রোডাক্টগুলো পছন্দ করেছেন সেগুলো এখানে দেখা যাবে।</p>
            <a href="https://seraproduct.com/reseller/all-product" class="btn-primary">প্রোডাক্ট দেখুন</a>
        </div>
    `;
}

// Error State View
function showErrorState(message) {
    statusMessage.textContent = message;
    statusMessage.className = "status-message error";
    statusMessage.classList.remove("hidden");
    loadingText.style.display = 'none';
}

function showCustomAlert(msg) {
    alert(msg); // Fallback for critical auth rejection popup where custom modal isn't initialized yet
}

// Modal Control Functions
function openModal() {
    customModal.classList.remove('hidden');
}

function closeModal() {
    customModal.classList.add('hidden');
    selectedDocIdToDelete = null;
}

modalCloseBtn.addEventListener('click', closeModal);
modalCancelBtn.addEventListener('click', closeModal);

// Close modal on outside click or ESC key
window.addEventListener('click', (e) => {
    if (e.target === customModal) {
        closeModal();
    }
});

window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !customModal.classList.contains('hidden')) {
        closeModal();
    }
});

// Delete Execution Logic
modalConfirmBtn.addEventListener('click', async () => {
    if (!selectedDocIdToDelete) return;

    try {
        const docRef = doc(db, "whilst", selectedDocIdToDelete);
        await deleteDoc(docRef);

        // Remove card directly from UI without refetching full list
        const cardToRemove = productGrid.querySelector(`[data-id="${selectedDocIdToDelete}"]`);
        if (cardToRemove) {
            cardToRemove.remove();
        }

        // Check if grid is now empty
        if (productGrid.children.length === 0) {
            renderEmptyState();
        }

        closeModal();
    } catch (error) {
        console.error("Delete error:", error);
        alert("প্রোডাক্টটি ডিলিট করা সম্ভব হয়নি। আবার চেষ্টা করুন।");
        closeModal();
    }
});

// Mobile Logout Button Action
if (mobileLogoutBtn) {
    mobileLogoutBtn.addEventListener('click', async () => {
        await signOut(auth);
        window.location.href = "https://seraproduct.com/reseller/login";
    });
}
