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
    orderBy, 
    startAfter,
    setDoc,
    deleteDoc,
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Firebase Configuration (আপনার প্রজেক্টের রিয়েল কনফিগ এখানে বসবে)
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

let currentUser = null;
let categoryId = null;
let lastVisibleProduct = null;
let favoritesMap = new Set();

document.addEventListener("DOMContentLoaded", () => {
    initApp();
});

function initApp() {
    loadFooter();
    handleAuthState();
}

function handleAuthState() {
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = "https://seraproduct.com/reseller/login";
            return;
        }
        currentUser = user;
        await validateResellerAndLoadContent(user.uid);
    });
}

async function validateResellerAndLoadContent(uid) {
    try {
        const resellerRef = doc(db, "reseller", uid);
        const resellerSnap = await getDoc(resellerRef);

        if (!resellerSnap.exists()) {
            showAccessDenied("আপনার তথ্য পাওয়া যায়নি!", "আপনার Reseller তথ্য বর্তমানে পাওয়া যাচ্ছে না। অনুগ্রহ করে পরে আবার চেষ্টা করুন।");
            return;
        }

        const resellerData = resellerSnap.data();

        if (resellerData.active !== true) {
            showAccessDenied("আপনার একাউন্ট এক্টিভ করা নেই!", "পণ্য দেখতে আপনার Reseller একাউন্টটি Active হতে হবে।");
            return;
        }

        if (resellerData.verified !== true) {
            showAccessDenied("আপনার একাউন্ট Verified করা হয়নি!", "পণ্য দেখতে আপনার Reseller একাউন্টটি Verified হতে হবে।");
            return;
        }

        // All checks passed, proceed to load category & products
        const slug = getCategorySlugFromURL();
        if (!slug) {
            showAccessDenied("ক্যাটাগরি নির্বাচন করা হয়নি", "অনুগ্রহ করে সঠিক ক্যাটাগরি নির্বাচন করুন।");
            return;
        }

        await loadCategoryAndProducts(slug);

    } catch (error) {
        console.error("Validation Error:", error);
        showAccessDenied("সমস্যা হয়েছে", "পণ্য লোড করতে সমস্যা হয়েছে। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।");
    }
}

function getCategorySlugFromURL() {
    const queryStr = window.location.search.substring(1);
    if (!queryStr) return null;
    const firstPart = queryStr.split("&")[0];
    const slug = firstPart.split("=")[0].trim();
    return slug || null;
}

async function loadCategoryAndProducts(slug) {
    try {
        const categoryQuery = query(
            collection(db, "categories"),
            where("categorySlug", "==", slug),
            limit(1)
        );
        const categorySnap = await getDocs(categoryQuery);

        if (categorySnap.empty) {
            showAccessDenied("ক্যাটাগরি পাওয়া যায়নি", "অনুগ্রহ করে সঠিক ক্যাটাগরি নির্বাচন করুন।");
            return;
        }

        const categoryDoc = categorySnap.docs[0];
        categoryId = categoryDoc.id;
        const categoryData = categoryDoc.data();

        renderCategoryHeader(categoryData);
        await loadFavorites(currentUser.uid);
        await loadProductsFirstBatch(categoryId);

    } catch (error) {
        console.error("Category Load Error:", error);
        showAccessDenied("ত্রুটি", "পণ্য লোড করতে সমস্যা হয়েছে। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।");
    }
}

function renderCategoryHeader(category) {
    document.getElementById("loading-state").style.display = "none";
    const headerEl = document.getElementById("category-header");
    headerEl.style.display = "flex";

    document.getElementById("cat-image").src = category.image || "https://seraproduct.com/photo/logo.png";
    document.getElementById("cat-name").textContent = category.categoryName || "";
    document.getElementById("product-section").style.display = "block";
}

async function loadFavorites(uid) {
    try {
        const favRef = collection(db, "whilst", uid, "products");
        const favSnap = await getDocs(favRef);
        favSnap.forEach(doc => favoritesMap.add(doc.id));
    } catch (e) {
        console.error("Error loading favorites:", e);
    }
}

async function loadProductsFirstBatch(catId) {
    try {
        const productsRef = collection(db, "products");
        const q = query(
            productsRef,
            where("categoryId", "==", catId),
            orderBy("createdAt", "desc"),
            limit(24)
        );

        const snapshot = await getDocs(q);
        const grid = document.getElementById("product-grid");
        grid.innerHTML = "";

        if (snapshot.empty) {
            document.getElementById("empty-products").style.display = "block";
            return;
        }

        lastVisibleProduct = snapshot.docs[snapshot.docs.length - 1];

        snapshot.forEach(docSnap => {
            renderProductCard(docSnap, grid);
        });

        if (snapshot.docs.length === 24) {
            document.getElementById("pagination-wrap").style.display = "flex";
            document.getElementById("load-more-btn").onclick = loadMoreProducts;
        }

    } catch (error) {
        console.error("Products Load Error:", error);
        showAccessDenied("ত্রুটি", "পণ্য লোড করতে সমস্যা হয়েছে। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।");
    }
}

async function loadMoreProducts() {
    if (!lastVisibleProduct || !categoryId) return;

    try {
        const productsRef = collection(db, "products");
        const q = query(
            productsRef,
            where("categoryId", "==", categoryId),
            orderBy("createdAt", "desc"),
            startAfter(lastVisibleProduct),
            limit(24)
        );

        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            document.getElementById("pagination-wrap").style.display = "none";
            return;
        }

        lastVisibleProduct = snapshot.docs[snapshot.docs.length - 1];
        const grid = document.getElementById("product-grid");

        snapshot.forEach(docSnap => {
            renderProductCard(docSnap, grid);
        });

        if (snapshot.docs.length < 24) {
            document.getElementById("pagination-wrap").style.display = "none";
        }

    } catch (error) {
        console.error("Load More Error:", error);
    }
}

function renderProductCard(docSnap, gridContainer) {
    const product = docSnap.data();
    const productId = docSnap.id;
    const productSlug = product.productSlug || "";
    const images = Array.isArray(product.image) ? product.image : [product.image || ""];
    const firstImg = images[0] || "";

    const resellerPrice = Number(product.resellerPrice) || 0;
    const resellerOldPrice = Number(product.resellerOldPrice) || 0;
    
    let hasDiscount = resellerOldPrice > resellerPrice;
    let discountAmount = hasDiscount ? (resellerOldPrice - resellerPrice) : 0;
    let discountPercent = hasDiscount ? Math.round(((resellerOldPrice - resellerPrice) / resellerOldPrice) * 100) : 0;

    const isFav = favoritesMap.has(productId);

    const card = document.createElement("div");
    card.className = "product-card";
    
    // Card Click to open product page
    card.onclick = (e) => {
        if (e.target.closest('.heart-btn') || e.target.closest('.card-footer-btn')) return;
        window.open(`https://seraproduct.com/reseller/product?${encodeURIComponent(productSlug)}`, "_blank", "noopener,noreferrer");
    };

    let imagesHtml = images.map((img, idx) => `<img src="${img}" class="${idx === 0 ? 'active' : ''}" alt="${product.productName}">`).join('');

    card.innerHTML = `
        <div class="card-img-container">
            <button class="heart-btn ${isFav ? 'active' : ''}" data-id="${productId}" title="Favorite">
                <svg viewBox="0 0 24 24" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
            </button>
            ${imagesHtml}
        </div>
        <div class="card-body">
            <h3 class="product-title">${product.productName || ""}</h3>
            <div class="price-box">
                <div>
                    <span class="reseller-price">৳${resellerPrice}</span>
                    ${hasDiscount ? `<span class="reseller-old-price">৳${resellerOldPrice}</span>` : ''}
                </div>
                ${hasDiscount ? `
                <div class="discount-badges">
                    <span class="badge">৳${discountAmount} ডিসকাউন্ট</span>
                    <span class="badge">${discountPercent}% ছাড়</span>
                </div>` : ''}
            </div>
        </div>
        <button class="card-footer-btn">সব দেখুন</button>
    `;

    // Footer button click
    card.querySelector('.card-footer-btn').onclick = (e) => {
        e.stopPropagation();
        window.open(`https://seraproduct.com/reseller/product?${encodeURIComponent(productSlug)}`, "_blank", "noopener,noreferrer");
    };

    // Heart click
    const heartBtn = card.querySelector('.heart-btn');
    heartBtn.onclick = async (e) => {
        e.stopPropagation();
        await toggleFavorite(productId, product, firstImg, heartBtn);
    };

    gridContainer.appendChild(card);

    // Setup Independent Image Slider if multiple images exist
    if (images.length > 1) {
        setupProductImageSlider(card.querySelector('.card-img-container'));
    }
}

function setupProductImageSlider(container) {
    const imgs = container.querySelectorAll('img');
    if (imgs.length <= 1) return;
    let currentIndex = 0;

    setInterval(() => {
        imgs[currentIndex].classList.remove('active');
        currentIndex = (currentIndex + 1) % imgs.length;
        imgs[currentIndex].classList.add('active');
    }, 3500);
}

async function toggleFavorite(productId, product, firstImg, btnElement) {
    if (!currentUser) return;
    const favDocRef = doc(db, "whilst", currentUser.uid, "products", productId);
    
    try {
        if (favoritesMap.has(productId)) {
            await deleteDoc(favDocRef);
            favoritesMap.delete(productId);
            btnElement.classList.remove('active');
        } else {
            await setDoc(favDocRef, {
                productName: product.productName || "",
                productImage: firstImg,
                productSlug: product.productSlug || "",
                uid: currentUser.uid,
                createdAt: serverTimestamp()
            });
            favoritesMap.add(productId);
            btnElement.classList.add('active');
        }
    } catch (error) {
        console.error("Favorite Toggle Error:", error);
    }
}

function showAccessDenied(title, desc) {
    document.getElementById("loading-state").style.display = "none";
    const accessDeniedEl = document.getElementById("access-denied-state");
    accessDeniedEl.style.display = "flex";

    document.getElementById("error-title").textContent = title;
    document.getElementById("error-desc").textContent = desc;

    const actionBtn = document.getElementById("error-action-btn");
    actionBtn.textContent = "লগআউট";
    actionBtn.onclick = async () => {
        await signOut(auth);
        window.location.href = "https://seraproduct.com/reseller/login";
    };
}

async function loadFooter() {
    try {
        const response = await fetch("https://seraproduct.com/footer");
        if (response.ok) {
            const html = await response.text();
            document.getElementById("dynamic-footer").innerHTML = html;
        }
    } catch (e) {
        console.warn("Footer load failed gracefully", e);
    }
}
