// Firebase v10+ Modular SDK Imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, collection, query, where, limit, getDocs, addDoc, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Your Firebase Web App Config
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

// Application State Variables
let currentProduct = null;
let selectedVariants = {};
let currentQuantity = 1;
let currentUnitCalculatedPrice = 0;
let isSubmitting = false;
let currentImageIndex = 0;
let autoSliderInterval = null;
let lastCreatedOrderData = null;

// Helper: Bengali Number Conversion
function toBengaliNumerals(num) {
    const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return num.toString().replace(/\d/g, x => bengaliDigits[x]);
}

function formatPrice(amount) {
    return '৳' + toBengaliNumerals(Math.round(amount).toLocaleString('en-US'));
}

// 1. Extract First Meaningful Query Parameter (Product Slug)
function getProductSlugFromURL() {
    const searchStr = window.location.search.substring(1);
    if (!searchStr) return null;

    const ignoredParams = ['fbclid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content'];
    const pairs = searchStr.split('&');

    for (let pair of pairs) {
        if (!pair) continue;
        const [key] = pair.split('=');
        const cleanKey = decodeURIComponent(key).trim();
        if (cleanKey && !ignoredParams.includes(cleanKey.toLowerCase())) {
            return cleanKey;
        }
    }
    return null;
}

// Custom Modal & Toast Helpers (NO alert/confirm)
function showCustomModal(title, message, isSuccess = false, redirectUrl = null) {
    const modal = document.getElementById('custom-modal');
    const titleEl = document.getElementById('modal-title');
    const msgEl = document.getElementById('modal-message');
    const redirectEl = document.getElementById('modal-redirect-text');
    const footerEl = document.getElementById('modal-footer');

    titleEl.textContent = title;
    msgEl.textContent = message;

    if (isSuccess) {
        titleEl.style.cursor = 'pointer';
        titleEl.title = 'ক্লিক করে অর্ডারের তথ্য কপি করুন';
        titleEl.onclick = () => {
            if (lastCreatedOrderData) {
                navigator.clipboard.writeText(JSON.stringify(lastCreatedOrderData, null, 2))
                    .then(() => showToast('অর্ডারের তথ্য কপি হয়েছে!'));
            }
        };
    } else {
        titleEl.style.cursor = 'default';
        titleEl.onclick = null;
    }

    if (redirectUrl) {
        footerEl.classList.add('hidden');
        redirectEl.classList.remove('hidden');
        let secondsLeft = 5;
        redirectEl.textContent = `${toBengaliNumerals(secondsLeft)} সেকেন্ড পর হোম পেজে নিয়ে যাওয়া হবে`;

        const countdown = setInterval(() => {
            secondsLeft--;
            if (secondsLeft > 0) {
                redirectEl.textContent = `${toBengaliNumerals(secondsLeft)} সেকেন্ড পর হোম পেজে নিয়ে যাওয়া হবে`;
            } else {
                clearInterval(countdown);
                window.location.href = redirectUrl;
            }
        }, 1000);
    } else {
        footerEl.classList.remove('hidden');
        redirectEl.classList.add('hidden');
    }

    modal.classList.remove('hidden');
}

function showToast(text) {
    const toast = document.getElementById('custom-toast');
    const msg = document.getElementById('toast-message');
    msg.textContent = text;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
}

// 2. Fetch Product from Firebase
async function initProductPage() {
    const slug = getProductSlugFromURL();

    if (!slug) {
        renderNotFound();
        return;
    }

    try {
        const q = query(
            collection(db, "products"),
            where("productSlug", "==", slug),
            limit(1)
        );

        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            renderNotFound();
            return;
        }

        const docSnap = querySnapshot.docs[0];
        const data = docSnap.data();
        currentProduct = { id: docSnap.id, ...data };

        if (currentProduct.active !== true) {
            hideLoader();
            showCustomModal("পণ্য পাওয়া যায়নি", "এই পণ্যটি বর্তমানে পাওয়া যাচ্ছে না।");
            return;
        }

        renderProductUI();
        updateSEOMetadata();
        
    } catch (error) {
        console.error("Error fetching product:", error);
        renderNotFound();
    } finally {
        hideLoader();
        fetchFooter();
    }
}

function hideLoader() {
    document.getElementById('loading-overlay').classList.add('hidden');
}

function renderNotFound() {
    hideLoader();
    document.getElementById('product-hero-title').classList.add('hidden');
    document.getElementById('product-wrapper').classList.add('hidden');
    document.getElementById('description-wrapper').classList.add('hidden');
    document.getElementById('order-form-section').classList.add('hidden');
    document.getElementById('not-found-view').classList.remove('hidden');
}

// 3. Render Product Information & UI Controls
function renderProductUI() {
    // Hero Title
    const heroTitle = document.getElementById('product-hero-title');
    heroTitle.textContent = `আপনার পছন্দের পণ্য ${currentProduct.productName} অর্ডার করুন!`;

    // Name & Price
    document.getElementById('product-name').textContent = currentProduct.productName;

    // Moving Marquee Description
    if (currentProduct.productDescription) {
        const marqueeBox = document.getElementById('marquee-container');
        const marqueeText = document.getElementById('marquee-text');
        marqueeText.textContent = currentProduct.productDescription.replace(/\n/g, " ");
        marqueeBox.classList.remove('hidden');
    }

    // Discounts
    calculateAndRenderPrices();

    // Free Delivery & Warranty
    if (currentProduct.freeDelivery === true) {
        document.getElementById('free-delivery-badge').classList.remove('hidden');
    }

    if (currentProduct.warranty && currentProduct.warranty.trim() !== "") {
        document.getElementById('warranty-text').textContent = currentProduct.warranty;
        document.getElementById('warranty-box').classList.remove('hidden');
    }

    // Countdown Timer
    setupCountdownTimer();

    // Gallery & Video Switcher
    setupGallery();

    // Variants
    setupVariants();

    // Description (Safely rendered text breaks)
    renderDescription();

    // Unhide Layout
    document.getElementById('product-wrapper').classList.remove('hidden');
    document.getElementById('description-wrapper').classList.remove('hidden');
    document.getElementById('order-form-section').classList.remove('hidden');

    // Initial Price Calculation Update
    updateCalculatedSummary();
}

// Price & Discount Engine
function calculateAndRenderPrices() {
    const basePrice = currentProduct.customerPrice || 0;
    const oldPrice = currentProduct.customerOldPrice || 0;

    document.getElementById('current-price').textContent = formatPrice(basePrice);

    if (oldPrice > basePrice) {
        const discountAmount = oldPrice - basePrice;
        const discountPercent = ((oldPrice - basePrice) / oldPrice) * 100;

        document.getElementById('old-price').textContent = formatPrice(oldPrice);
        document.getElementById('old-price').classList.remove('hidden');

        document.getElementById('discount-amount-badge').textContent = `৳${toBengaliNumerals(discountAmount)} সাশ্রয়!`;
        document.getElementById('discount-percent-badge').textContent = `${toBengaliNumerals(discountPercent.toFixed(2))}% ছাড়`;
        document.getElementById('discount-badges').classList.remove('hidden');
    }
}

// Gallery & Swipe/Auto-slide logic
function setupGallery() {
    const images = currentProduct.image || [];
    const mainImg = document.getElementById('main-image');
    const thumbWrapper = document.getElementById('thumbnails-wrapper');
    const videoUrl = currentProduct.reviewVideo;

    if (images.length > 0) {
        mainImg.src = images[0];
        mainImg.alt = currentProduct.productName;
    }

    // Render Thumbnails
    if (images.length > 1) {
        images.forEach((imgSrc, idx) => {
            const imgEl = document.createElement('img');
            imgEl.src = imgSrc;
            imgEl.className = `thumb-img ${idx === 0 ? 'active' : ''}`;
            imgEl.alt = `${currentProduct.productName} thumbnail ${idx + 1}`;
            imgEl.onclick = () => switchImage(idx);
            thumbWrapper.appendChild(imgEl);
        });

        // Desktop Next/Prev Controls
        document.getElementById('prev-img').onclick = () => switchImage((currentImageIndex - 1 + images.length) % images.length);
        document.getElementById('next-img').onclick = () => switchImage((currentImageIndex + 1) % images.length);

        // Touch Swipe Logic
        let touchStartX = 0;
        const viewport = document.querySelector('.gallery-viewport');
        viewport.addEventListener('touchstart', e => touchStartX = e.changedTouches[0].screenX, { passive: true });
        viewport.addEventListener('touchend', e => {
            let touchEndX = e.changedTouches[0].screenX;
            if (touchStartX - touchEndX > 50) switchImage((currentImageIndex + 1) % images.length);
            if (touchEndX - touchStartX > 50) switchImage((currentImageIndex - 1 + images.length) % images.length);
        }, { passive: true });

        // Auto Slider
        startAutoSlider(images.length);
    }

    // Review Video Tab Logic
    if (videoUrl && videoUrl.includes("youtube.com/embed/")) {
        const mediaTabs = document.getElementById('media-tabs');
        const tabImg = document.getElementById('btn-tab-image');
        const tabVid = document.getElementById('btn-tab-video');
        const imgView = document.getElementById('image-view');
        const vidView = document.getElementById('video-view');
        const iframe = document.getElementById('video-iframe');

        mediaTabs.classList.remove('hidden');

        tabImg.onclick = () => {
            tabImg.classList.add('active');
            tabVid.classList.remove('active');
            imgView.classList.remove('hidden');
            vidView.classList.add('hidden');
            iframe.src = "";
        };

        tabVid.onclick = () => {
            tabVid.classList.add('active');
            tabImg.classList.remove('active');
            vidView.classList.remove('hidden');
            imgView.classList.add('hidden');
            iframe.src = videoUrl;
        };
    }
}

function switchImage(index) {
    const images = currentProduct.image || [];
    currentImageIndex = index;
    document.getElementById('main-image').src = images[index];

    const thumbs = document.querySelectorAll('.thumb-img');
    thumbs.forEach((t, i) => {
        if (i === index) t.classList.add('active');
        else t.classList.remove('active');
    });
}

function startAutoSlider(totalImages) {
    if (autoSliderInterval) clearInterval(autoSliderInterval);
    autoSliderInterval = setInterval(() => {
        switchImage((currentImageIndex + 1) % totalImages);
    }, 3500);
}

// Countdown Timer Engine
function setupCountdownTimer() {
    const offerTime = parseInt(currentProduct.offerTime);
    if (!offerTime || isNaN(offerTime)) return;

    const banner = document.getElementById('offer-banner');
    
    function updateTimer() {
        const now = new Date().getTime();
        const diff = offerTime - now;

        if (diff <= 0) {
            banner.innerHTML = `<div class="offer-title">অফার শেষ হয়ে গেছে</div>`;
            banner.classList.remove('hidden');
            return;
        }

        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);

        document.getElementById('days').textContent = toBengaliNumerals(String(d).padStart(2, '0'));
        document.getElementById('hours').textContent = toBengaliNumerals(String(h).padStart(2, '0'));
        document.getElementById('minutes').textContent = toBengaliNumerals(String(m).padStart(2, '0'));
        document.getElementById('seconds').textContent = toBengaliNumerals(String(s).padStart(2, '0'));

        banner.classList.remove('hidden');
    }

    updateTimer();
    setInterval(updateTimer, 1000);
}

// Variants Render
function setupVariants() {
    const container = document.getElementById('variants-container');
    container.innerHTML = "";

    if (!currentProduct.variants || currentProduct.variants.length === 0) return;

    currentProduct.variants.forEach(variantGroup => {
        const groupEl = document.createElement('div');
        groupEl.className = 'variant-group';

        const titleEl = document.createElement('div');
        titleEl.className = 'variant-title';
        titleEl.textContent = `${variantGroup.name} নির্বাচন করুন:`;
        groupEl.appendChild(titleEl);

        const optionsBox = document.createElement('div');
        optionsBox.className = 'variant-options';

        variantGroup.values.forEach(opt => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'variant-btn';
            
            let label = opt.value;
            if (opt.extraPrice && opt.extraPrice > 0) {
                label += ` +৳${toBengaliNumerals(opt.extraPrice)}`;
            }
            btn.textContent = label;

            btn.onclick = () => {
                const siblingBtns = optionsBox.querySelectorAll('.variant-btn');
                siblingBtns.forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');

                selectedVariants[variantGroup.name] = {
                    name: variantGroup.name,
                    value: opt.value,
                    extraPrice: opt.extraPrice || 0
                };

                updateCalculatedSummary();
            };

            optionsBox.appendChild(btn);
        });

        groupEl.appendChild(optionsBox);
        container.appendChild(groupEl);
    });
}

// XSS Safe Text Renderer for Product Description
function renderDescription() {
    const rawDesc = currentProduct.productDescription || "";
    const container = document.getElementById('product-description');
    container.innerHTML = "";

    const lines = rawDesc.split('\n');
    lines.forEach(line => {
        const p = document.createElement('p');
        p.textContent = line;
        container.appendChild(p);
    });
}

// Price Calculations
function updateCalculatedSummary() {
    let basePrice = currentProduct.customerPrice || 0;
    let totalExtra = 0;

    Object.values(selectedVariants).forEach(v => {
        totalExtra += (v.extraPrice || 0);
    });

    currentUnitCalculatedPrice = basePrice + totalExtra;
    const subtotal = currentUnitCalculatedPrice * currentQuantity;

    // Delivery site choice
    const deliverySiteVal = document.querySelector('input[name="deliverySite"]:checked').value;
    let deliveryCharge = 0;

    if (currentProduct.freeDelivery !== true) {
        deliveryCharge = (deliverySiteVal === 'outside_dhaka') ? 120 : 60;
    }

    const total = subtotal + deliveryCharge;

    document.getElementById('summary-product-price').textContent = formatPrice(subtotal);
    document.getElementById('summary-delivery-charge').textContent = formatPrice(deliveryCharge);
    document.getElementById('summary-total-price').textContent = formatPrice(total);
}

// Event Listeners for Controls
document.getElementById('btn-buy-now').onclick = () => {
    document.getElementById('order-form-section').scrollIntoView({ behavior: 'smooth' });
};

document.getElementById('btn-qty-minus').onclick = () => {
    if (currentQuantity > 1) {
        currentQuantity--;
        document.getElementById('qty-display').textContent = toBengaliNumerals(currentQuantity);
        updateCalculatedSummary();
    }
};

document.getElementById('btn-qty-plus').onclick = () => {
    currentQuantity++;
    document.getElementById('qty-display').textContent = toBengaliNumerals(currentQuantity);
    updateCalculatedSummary();
};

document.querySelectorAll('input[name="deliverySite"]').forEach(radio => {
    radio.addEventListener('change', updateCalculatedSummary);
});

// Modal Close Listener
document.getElementById('btn-modal-close').onclick = () => {
    document.getElementById('custom-modal').classList.add('hidden');
};

// Form Validation & Submission
document.getElementById('order-form').onsubmit = async function(e) {
    e.preventDefault();

    if (isSubmitting) return;

    // 1. Variant Mandatory Selection Check
    if (currentProduct.variants && currentProduct.variants.length > 0) {
        const selectedCount = Object.keys(selectedVariants).length;
        if (selectedCount < currentProduct.variants.length) {
            showCustomModal("তথ্য অসম্পূর্ণ", "অনুগ্রহ করে সকল variant নির্বাচন করুন।");
            return;
        }
    }

    // 2. Input Fields Extraction
    const name = document.getElementById('input-name').value.trim();
    const phone = document.getElementById('input-phone').value.trim();
    const vibag = document.getElementById('input-vibag').value.trim();
    const jela = document.getElementById('input-jela').value.trim();
    const upojela = document.getElementById('input-upojela').value.trim();
    const noteRaw = document.getElementById('input-note').value.trim();
    const deliverySite = document.querySelector('input[name="deliverySite"]:checked').value;

    if (!name || !vibag || !jela || !upojela) {
        showCustomModal("তথ্য অসম্পূর্ণ", "অনুগ্রহ করে সকল আবশ্যকীয় ঘর পূরণ করুন।");
        return;
    }

    // 3. Phone Validation (Must be 11 digits & start with 01)
    const phoneRegex = /^01\d{9}$/;
    if (!phoneRegex.test(phone)) {
        showCustomModal("ভুল ফোন নম্বর", "সঠিক ১১ সংখ্যার মোবাইল নম্বর দিন।");
        return;
    }

    // Lock Submit Button
    isSubmitting = true;
    const submitBtn = document.getElementById('btn-submit-order');
    submitBtn.disabled = true;
    submitBtn.textContent = "অর্ডার প্রসেস হচ্ছে...";

    // Final Math Verification
    let totalExtra = 0;
    const variantsList = Object.values(selectedVariants);
    variantsList.forEach(v => totalExtra += (v.extraPrice || 0));

    const unitPrice = currentProduct.customerPrice + totalExtra;
    const subtotal = unitPrice * currentQuantity;
    const freeDelivery = currentProduct.freeDelivery === true;
    const deliveryCharge = freeDelivery ? 0 : (deliverySite === 'outside_dhaka' ? 120 : 60);
    const total = subtotal + deliveryCharge;

    const orderObject = {
        name,
        phone,
        vibag,
        jela,
        upojela,
        deliverySite,
        note: noteRaw !== "" ? noteRaw : null,
        quantity: currentQuantity,
        freeDelivery,
        subtotal,
        total,
        deliveryCharge,
        createdAt: serverTimestamp(),
        status: "pending",
        productId: currentProduct.id,
        productName: currentProduct.productName,
        productImage: (currentProduct.image && currentProduct.image[0]) ? currentProduct.image[0] : "",
        productPrice: currentProduct.customerPrice,
        variants: variantsList,
        warranty: currentProduct.warranty || ""
    };

    lastCreatedOrderData = orderObject;

    try {
        await addDoc(collection(db, "landing_orders"), orderObject);
        showCustomModal("অর্ডার সফল হয়েছে!", "আপনার অর্ডার সফলভাবে গ্রহণ করা হয়েছে। ধন্যবাদ।", true, "https://seraproduct.com");
    } catch (error) {
        console.error("Order submission failed:", error);
        showCustomModal("ত্রুটি", "অর্ডার করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।");
        isSubmitting = false;
        submitBtn.disabled = false;
        submitBtn.textContent = "অর্ডার কনফার্ম করুন";
    }
};

// 4. Fetch External Footer
async function fetchFooter() {
    try {
        const response = await fetch("https://seraproduct.com/footer");
        if (response.ok) {
            const html = await response.text();
            document.getElementById('site-footer').innerHTML = html;
        } else {
            document.getElementById('footer-loader').classList.add('hidden');
        }
    } catch (err) {
        document.getElementById('footer-loader').classList.add('hidden');
    }
}

// 5. Dynamic SEO & JSON-LD Update
function updateSEOMetadata() {
    if (!currentProduct) return;

    const pageTitle = `${currentProduct.productName} | SERA PRODUCT`;
    const cleanDesc = (currentProduct.productDescription || "").replace(/\n/g, " ").substring(0, 160);
    const imgUrl = (currentProduct.image && currentProduct.image[0]) ? currentProduct.image[0] : "https://seraproduct.com/photo/facebook-preview.png";
    const currentCanonical = window.location.href;

    document.title = pageTitle;
    document.querySelector('meta[name="description"]').setAttribute("content", cleanDesc);
    document.getElementById('canonical-url').setAttribute("href", currentCanonical);

    // Open Graph
    document.getElementById('og-title').setAttribute("content", pageTitle);
    document.getElementById('og-desc').setAttribute("content", cleanDesc);
    document.getElementById('og-image').setAttribute("content", imgUrl);
    document.getElementById('og-url').setAttribute("content", currentCanonical);

    // Twitter
    document.getElementById('tw-title').setAttribute("content", pageTitle);
    document.getElementById('tw-desc').setAttribute("content", cleanDesc);
    document.getElementById('tw-image').setAttribute("content", imgUrl);

    // Structured JSON-LD
    const jsonLd = {
        "@context": "https://schema.org/",
        "@type": "Product",
        "name": currentProduct.productName,
        "image": currentProduct.image || [],
        "description": cleanDesc,
        "sku": currentProduct.sku || "N/A",
        "offers": {
            "@type": "Offer",
            "priceCurrency": "BDT",
            "price": currentProduct.customerPrice,
            "availability": currentProduct.active ? "https://schema.org/InStock" : "https://schema.org/OutOfStock"
        }
    };
    document.getElementById('product-json-ld').textContent = JSON.stringify(jsonLd);
}

// Global Initialization
window.addEventListener('DOMContentLoaded', initProductPage);
