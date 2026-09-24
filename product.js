import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs, doc, setDoc, getDoc, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// State Management
let currentProduct = null;
let selectedVariantsState = {};
let pendingAction = null; // 'cart' or 'order'

// 1. URL Parsing & Slug Extraction
function getProductSlugFromURL() {
    const searchParams = new URLSearchParams(window.location.search);
    for (const key of searchParams.keys()) {
        if (key && key.trim() !== "") {
            return key.trim();
        }
    }
    return null;
}

const productSlug = getProductSlugFromURL();

// DOM Elements
const loadingState = document.getElementById('loading-state');
const errorState = document.getElementById('error-state');
const errorMessage = document.getElementById('error-message');
const productWrapper = document.getElementById('product-wrapper');
const mainImage = document.getElementById('main-product-image');
const thumbnailContainer = document.getElementById('thumbnail-container');
const productTitle = document.getElementById('product-title');
const currentPriceEl = document.getElementById('current-price');
const oldPriceEl = document.getElementById('old-price');
const discountBadge = document.getElementById('discount-badge');
const badgesContainer = document.getElementById('badges-container');
const variantsContainer = document.getElementById('variants-container');
const productDescription = document.getElementById('product-description');
const offerBanner = document.getElementById('offer-banner');
const countdownTimer = document.getElementById('countdown-timer');
const addToCartBtn = document.getElementById('add-to-cart-btn');
const buyNowBtn = document.getElementById('buy-now-btn');

// Auth Modal Elements
const authModal = document.getElementById('auth-modal');
const closeModal = document.getElementById('close-modal');
const tabBtns = document.querySelectorAll('.tab-btn');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const loginError = document.getElementById('login-error');
const signupError = document.getElementById('signup-error');

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
    loadFooter();
    if (!productSlug) {
        showError("প্রোডাক্ট খুঁজে পাওয়া যায়নি।");
        return;
    }
    await fetchAndRenderProduct(productSlug);
});

// 2. Fetch Product from Firestore
async function fetchAndRenderProduct(slug) {
    try {
        const q = query(
            collection(db, "products"),
            where("productSlug", "==", slug),
            where("active", "==", true)
        );
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            showError("এই প্রোডাক্টটি খুঁজে পাওয়া যায়নি অথবা বর্তমানে উপলভ্য নয়।");
            return;
        }

        // Get first valid active product
        const docSnap = querySnapshot.docs[0];
        currentProduct = { id: docSnap.id, ...docSnap.data() };

        renderProductDetails(currentProduct);
        setupSEO(currentProduct);
        setupOfferCountdown(currentProduct.offerTime);

        loadingState.classList.add('hidden');
        productWrapper.classList.remove('hidden');
    } catch (error) {
        console.error("Error fetching product:", error);
        showError("প্রোডাক্ট লোড করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।");
    }
}

function showError(msg) {
    loadingState.classList.add('hidden');
    productWrapper.classList.add('hidden');
    errorMessage.textContent = msg;
    errorState.classList.remove('hidden');
}

// 3. Render Product Data
function renderProductDetails(product) {
    productTitle.textContent = product.productName || "";
    productDescription.textContent = product.productDescription || "";

    // Pricing & Discounts
    const basePrice = Number(product.customerPrice) || 0;
    const oldPrice = Number(product.customerOldPrice) || 0;

    currentPriceEl.textContent = `৳${basePrice}`;

    if (oldPrice > basePrice) {
        oldPriceEl.textContent = `৳${oldPrice}`;
        oldPriceEl.classList.remove('hidden');

        const discountAmt = oldPrice - basePrice;
        const discountPct = Math.round((discountAmt / oldPrice) * 100);
        if (discountPct > 0) {
            discountBadge.textContent = `সাশ্রয়: ৳${discountAmt} (${discountPct}% ছাড়)`;
            discountBadge.classList.remove('hidden');
        }
    }

    // Badges (Free Delivery & Warranty)
    badgesContainer.innerHTML = "";
    if (product.freeDelivery) {
        const deliveryBadge = document.createElement('div');
        deliveryBadge.className = 'badge-item';
        deliveryBadge.textContent = "এই প্রোডাক্টটা ফ্রিতে ডেলিভারি পাওয়া যাবে";
        badgesContainer.appendChild(deliveryBadge);
    }
    if (product.warranty) {
        const warrantyBadge = document.createElement('div');
        warrantyBadge.className = 'badge-item';
        warrantyBadge.textContent = `ওয়ারেন্টি: ${product.warranty}`;
        badgesContainer.appendChild(warrantyBadge);
    }

    // Gallery Setup
    setupGallery(product.image, product.reviewVideo);

    // Variants Setup
    setupVariants(product.variants);
}

// 4. Image & Video Gallery
function setupGallery(images, reviewVideo) {
    const mediaToggle = document.getElementById('media-toggle');
    const imageView = document.getElementById('image-view');
    const videoView = document.getElementById('video-view');

    if (images && images.length > 0) {
        mainImage.src = images[0];
        thumbnailContainer.innerHTML = "";

        images.forEach((imgUrl, index) => {
            const thumb = document.createElement('div');
            thumb.className = `thumbnail-item ${index === 0 ? 'active' : ''}`;
            thumb.innerHTML = `<img src="${imgUrl}" alt="Thumbnail" loading="lazy" decoding="async">`;
            
            thumb.addEventListener('click', () => {
                document.querySelectorAll('.thumbnail-item').forEach(el => el.classList.remove('active'));
                thumb.classList.add('active');
                mainImage.src = imgUrl;
                
                // Switch back to image view if video was active
                mediaToggle.querySelector('[data-target="image-view"]').click();
            });

            thumbnailContainer.appendChild(thumb);
        });
    }

    // Video Toggle Handling
    if (reviewVideo && reviewVideo.includes("youtube.com/embed")) {
        mediaToggle.classList.remove('hidden');
        const toggleBtns = mediaToggle.querySelectorAll('.toggle-btn');

        toggleBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                toggleBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const target = btn.getAttribute('data-target');
                if (target === 'image-view') {
                    imageView.classList.remove('hidden');
                    videoView.classList.add('hidden');
                } else {
                    imageView.classList.add('hidden');
                    videoView.classList.remove('hidden');
                    if (!videoView.innerHTML.trim()) {
                        videoView.innerHTML = `<iframe src="${reviewVideo}" allowfullscreen loading="lazy"></iframe>`;
                    }
                }
            });
        });
    }
}

// 5. Variants Logic & Price Calculation
function setupVariants(variants) {
    variantsContainer.innerHTML = "";
    selectedVariantsState = {};

    if (!variants || variants.length === 0) return;

    variants.forEach(variant => {
        const group = document.createElement('div');
        group.className = 'variant-group';

        const title = document.createElement('div');
        title.className = 'variant-title';
        title.textContent = variant.name;
        group.appendChild(title);

        const optionsWrapper = document.createElement('div');
        optionsWrapper.className = 'variant-options';

        variant.values.forEach(valObj => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'variant-option-btn';
            const extraText = valObj.extraPrice > 0 ? ` +৳${valObj.extraPrice}` : '';
            btn.textContent = `${valObj.value}${extraText}`;

            btn.addEventListener('click', () => {
                optionsWrapper.querySelectorAll('.variant-option-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');

                selectedVariantsState[variant.name] = {
                    name: variant.name,
                    value: valObj.value,
                    extraPrice: Number(valObj.extraPrice) || 0
                };

                updateCalculatedPrice();
            });

            optionsWrapper.appendChild(btn);
        });

        group.appendChild(optionsWrapper);
        variantsContainer.appendChild(group);
    });
}

function updateCalculatedPrice() {
    let finalPrice = Number(currentProduct.customerPrice) || 0;
    Object.values(selectedVariantsState).forEach(v => {
        finalPrice += v.extraPrice;
    });
    currentPriceEl.textContent = `৳${finalPrice}`;
}

// 6. Offer Countdown
function setupOfferCountdown(offerTimeStr) {
    if (!offerTimeStr) return;
    const endTime = Number(offerTimeStr);
    if (isNaN(endTime)) return;

    offerBanner.classList.remove('hidden');

    const timerInterval = setInterval(() => {
        const now = new Date().getTime();
        const distance = endTime - now;

        if (distance < 0) {
            clearInterval(timerInterval);
            countdownTimer.textContent = "এই প্রোডাক্টের অফার শেষ হয়েছে।";
            return;
        }

        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        countdownTimer.textContent = `${days} দিন ${hours} ঘণ্টা ${minutes} মিনিট ${seconds} সেকেন্ড`;
    }, 1000);
}

// 7. Dynamic SEO & JSON-LD
function setupSEO(product) {
    const title = `${product.productName} | Sera Product`;
    const description = product.productDescription ? product.productDescription.substring(0, 150) : "Sera Product Details";
    const imageUrl = product.image && product.image.length > 0 ? product.image[0] : "";
    const canonicalUrl = `https://seraproduct.com/product?${product.productSlug}`;

    document.getElementById('meta-title').textContent = title;
    document.getElementById('meta-description').setAttribute('content', description);
    document.getElementById('meta-canonical').setAttribute('href', canonicalUrl);

    document.getElementById('og-title').setAttribute('content', title);
    document.getElementById('og-description').setAttribute('content', description);
    document.getElementById('og-image').setAttribute('content', imageUrl);
    document.getElementById('og-url').setAttribute('content', canonicalUrl);

    document.getElementById('twitter-title').setAttribute('content', title);
    document.getElementById('twitter-description').setAttribute('content', description);
    document.getElementById('twitter-image').setAttribute('content', imageUrl);

    // JSON-LD Schema
    const schemaData = {
        "@context": "https://schema.org/",
        "@type": "Product",
        "name": product.productName,
        "image": product.image || [],
        "description": product.productDescription || "",
        "sku": product.sku || "",
        "offers": {
            "@type": "Offer",
            "priceCurrency": "BDT",
            "price": product.customerPrice,
            "availability": product.active ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            "url": canonicalUrl
        }
    };
    document.getElementById('structured-data').textContent = JSON.stringify(schemaData);
}

// 8. Authentication & Cart / Order Actions
addToCartBtn.addEventListener('click', () => handleAction('cart'));
buyNowBtn.addEventListener('click', () => handleAction('order'));

function validateVariantsSelection() {
    if (!currentProduct.variants || currentProduct.variants.length === 0) return true;
    const totalVariants = currentProduct.variants.length;
    const selectedCount = Object.keys(selectedVariantsState).length;
    return selectedCount === totalVariants;
}

function handleAction(actionType) {
    if (!validateVariantsSelection()) {
        alert("দয়া করে সব অপশন নির্বাচন করুন।");
        return;
    }

    pendingAction = actionType;
    const user = auth.currentUser;

    if (user) {
        executePendingAction(user);
    } else {
        authModal.classList.remove('hidden');
    }
}

// Auth Modal Controls
closeModal.addEventListener('click', () => authModal.classList.add('hidden'));
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const targetTab = btn.getAttribute('data-tab');
        if (targetTab === 'login-tab') {
            loginForm.classList.remove('hidden');
            signupForm.classList.add('hidden');
        } else {
            loginForm.classList.add('hidden');
            signupForm.classList.remove('hidden');
        }
    });
});

// Login Execution
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.textContent = "";
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        authModal.classList.add('hidden');
        executePendingAction(userCredential.user);
    } catch (error) {
        loginError.textContent = "ইমেইল অথবা পাসওয়ার্ড সঠিক নয়।";
    }
});

// Signup Execution & Buyer Document Creation
signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    signupError.textContent = "";
    const name = document.getElementById('signup-name').value;
    const phone = document.getElementById('signup-phone').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('signup-confirm-password').value;

    if (password !== confirmPassword) {
        signupError.textContent = "পাসওয়ার্ড মিলছে না।";
        return;
    }

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Save Buyer Document in buyers/{uid}
        await setDoc(doc(db, "buyers", user.uid), {
            name: name,
            phone: phone,
            email: email,
            uid: user.uid
        });

        authModal.classList.add('hidden');
        executePendingAction(user);
    } catch (error) {
        if (error.code === 'auth/email-already-in-use') {
            signupError.textContent = "এই ইমেইল দিয়ে ইতিমধ্যে অ্যাকাউন্ট তৈরি করা হয়েছে।";
        } else {
            signupError.textContent = "সাইনআপ সম্পন্ন করা যায়নি। আবার চেষ্টা করুন।";
        }
    }
});

// 9. Cart Integration & Management
async function executePendingAction(user) {
    if (!pendingAction) return;

    let finalPrice = Number(currentProduct.customerPrice) || 0;
    const formattedVariants = Object.values(selectedVariantsState).map(v => {
        finalPrice += v.extraPrice;
        return { name: v.name, value: v.value, extraPrice: v.extraPrice };
    });

    const cartItem = {
        productName: currentProduct.productName,
        productImage: currentProduct.image && currentProduct.image.length > 0 ? currentProduct.image[0] : "",
        productPrice: finalPrice,
        freeDelivery: !!currentProduct.freeDelivery,
        warranty: currentProduct.warranty || "",
        variants: formattedVariants
    };

    try {
        if (pendingAction === 'cart') {
            addToCartBtn.disabled = true;
            addToCartBtn.textContent = "কার্টে যোগ হচ্ছে...";

            const cartRef = doc(db, "carts", user.uid);
            const cartSnap = await getDoc(cartRef);

            if (cartSnap.exists()) {
                await updateDoc(cartRef, {
                    productItem: arrayUnion(cartItem)
                });
            } else {
                await setDoc(cartRef, {
                    productItem: [cartItem]
                });
            }

            alert("প্রোডাক্টটি কার্টে যোগ হয়েছে।");
            addToCartBtn.disabled = false;
            addToCartBtn.textContent = "কার্টে যোগ করুন";
        } else if (pendingAction === 'order') {
            const cartRef = doc(db, "carts", user.uid);
            const cartSnap = await getDoc(cartRef);

            if (cartSnap.exists()) {
                await updateDoc(cartRef, {
                    productItem: arrayUnion(cartItem)
                });
            } else {
                await setDoc(cartRef, {
                    productItem: [cartItem]
                });
            }

            window.location.href = "/checkout";
        }
    } catch (error) {
        console.error("Cart action error:", error);
        alert("কার্টে প্রোডাক্ট যোগ করা যায়নি। আবার চেষ্টা করুন।");
        if (pendingAction === 'cart') {
            addToCartBtn.disabled = false;
            addToCartBtn.textContent = "কার্টে যোগ করুন";
        }
    }
    pendingAction = null;
}

// 10. Footer Loading
async function loadFooter() {
    try {
        const response = await fetch("https://seraproduct.com/footer");
        if (response.ok) {
            const htmlText = await response.text();
            document.getElementById('footer-container').innerHTML = htmlText;
        }
    } catch (e) {
        // Footer fail safe - does not block product page
        console.warn("Footer could not be loaded.");
    }
}
