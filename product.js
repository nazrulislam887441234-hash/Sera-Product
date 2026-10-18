// ==========================================================================
// SERA PRODUCT — PRODUCT DETAILS + LOCAL STORAGE CART
// Firebase: Product fetching only
// LocalStorage: Cart data
// Removed: Login, Signup, Firebase Authentication
// ==========================================================================

import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

import {
    getFirestore,
    collection,
    query,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ==========================================================================
// CONFIGURATION
// ==========================================================================

const firebaseConfig = {
    apiKey: "AIzaSyBRSt2aoSJ-lumYAWGAXE6ncui7__TqJ4E",
    authDomain: "sera-product.firebaseapp.com",
    projectId: "sera-product",
    storageBucket: "sera-product.firebasestorage.app",
    messagingSenderId: "516762224598",
    appId: "1:516762224598:web:b6a571f355a8a4a97c0677",
    measurementId: "G-RLMWH43FXX"
};

const CHECKOUT_PAGE_URL = "/checkout";
const CART_PAGE_URL = "/cart";
const FOOTER_API_URL = "https://seraproduct.com/footer";

// Shared cart key: checkout/cart pages must use this same key.
const CART_STORAGE_KEY = "sera_product_cart";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ==========================================================================
// APPLICATION STATE
// ==========================================================================

let currentProduct = null;
let selectedVariantsState = {};
let isAlreadyInCart = false;
let countdownInterval = null;
let toastTimeout = null;

// ==========================================================================
// URL PARSING
// Supports:
// /product?productSlug
// /product?slug=productSlug
// /product?Id=productSlug
// /product?productSlug=productSlug
// ==========================================================================

function getProductSlugFromURL() {
    const params = new URLSearchParams(window.location.search);

    for (const key of ["slug", "Id", "productSlug"]) {
        const value = params.get(key);

        if (value && value.trim()) {
            return value.trim();
        }
    }

    // Backward compatibility with URLs such as ?abc123
    for (const key of params.keys()) {
        if (key && key.trim()) {
            return key.trim();
        }
    }

    return null;
}

const productSlug = getProductSlugFromURL();

// ==========================================================================
// DOM ELEMENTS
// ==========================================================================

const loadingState = document.getElementById("loading-state");
const errorState = document.getElementById("error-state");
const errorMessage = document.getElementById("error-message");
const productWrapper = document.getElementById("product-wrapper");

const mainImage = document.getElementById("main-product-image");
const thumbnailContainer = document.getElementById("thumbnail-container");

const productTitle = document.getElementById("product-title");
const currentPriceEl = document.getElementById("current-price");
const oldPriceEl = document.getElementById("old-price");
const discountBadge = document.getElementById("discount-badge");
const badgesContainer = document.getElementById("badges-container");

const variantsContainer = document.getElementById("variants-container");
const productDescription = document.getElementById("product-description");

const offerBanner = document.getElementById("offer-banner");
const countdownTimer = document.getElementById("countdown-timer");

const addToCartBtn = document.getElementById("add-to-cart-btn");
const alreadyInCartMsg = document.getElementById("already-in-cart-msg");
const buyNowBtn = document.getElementById("buy-now-btn");
const cartBadge = document.getElementById("cart-badge");

const customToast = document.getElementById("custom-toast");
const toastMessage = document.getElementById("toast-message");
const toastCloseBtn = document.getElementById("toast-close-btn");

// ==========================================================================
// TOAST NOTIFICATION
// ==========================================================================

function showToast(message) {
    if (!customToast || !toastMessage) {
        console.log(message);
        return;
    }

    toastMessage.textContent = message;
    customToast.classList.remove("hidden");

    clearTimeout(toastTimeout);

    toastTimeout = setTimeout(() => {
        customToast.classList.add("hidden");
    }, 3500);
}

toastCloseBtn?.addEventListener("click", () => {
    customToast?.classList.add("hidden");
    clearTimeout(toastTimeout);
});

// ==========================================================================
// LOCAL STORAGE CART HELPERS
// Cart structure remains compatible with the previous productItem schema.
// ==========================================================================

function getCartData() {
    try {
        const raw = localStorage.getItem(CART_STORAGE_KEY);

        if (!raw) {
            return { productItem: [] };
        }

        const data = JSON.parse(raw);

        if (!data || !Array.isArray(data.productItem)) {
            return { productItem: [] };
        }

        return data;
    } catch (error) {
        console.error("Unable to read local cart:", error);
        return { productItem: [] };
    }
}

function saveCartData(cartData) {
    try {
        localStorage.setItem(
            CART_STORAGE_KEY,
            JSON.stringify({
                productItem: cartData.productItem
            })
        );

        updateCartBadge();
        updateCurrentProductCartStatus();

        // Notify other same-origin pages/tabs.
        window.dispatchEvent(
            new CustomEvent("sera-cart-updated", {
                detail: getCartData()
            })
        );

        return true;
    } catch (error) {
        console.error("Unable to save local cart:", error);

        showToast(
            "কার্ট সেভ করা যায়নি। ব্রাউজারের স্টোরেজ খালি করে আবার চেষ্টা করুন।"
        );

        return false;
    }
}

function getCartItems() {
    return getCartData().productItem;
}

function updateCartBadge() {
    if (!cartBadge) return;

    const items = getCartItems();

    // Counts cart entries, matching the old productItem.length behaviour.
    cartBadge.textContent = String(items.length);
    cartBadge.classList.toggle("hidden", items.length === 0);
}

// Match product ID and selected variants.
// Different variants are treated as different cart entries.
function sameCartSelection(itemA, itemB) {
    if (itemA.productId !== itemB.productId) {
        return false;
    }

    const variantsA = Array.isArray(itemA.variants)
        ? itemA.variants
        : [];

    const variantsB = Array.isArray(itemB.variants)
        ? itemB.variants
        : [];

    if (variantsA.length !== variantsB.length) {
        return false;
    }

    return variantsA.every((variantA) => {
        return variantsB.some((variantB) =>
            variantA.name === variantB.name &&
            variantA.value === variantB.value &&
            Number(variantA.extraPrice || 0) ===
                Number(variantB.extraPrice || 0)
        );
    });
}

function isProductInCart(productId) {
    return getCartItems().some(
        item => item.productId === productId
    );
}

function updateCurrentProductCartStatus() {
    if (!currentProduct) return;

    isAlreadyInCart = isProductInCart(currentProduct.id);

    addToCartBtn?.classList.toggle("hidden", isAlreadyInCart);
    alreadyInCartMsg?.classList.toggle("hidden", !isAlreadyInCart);
}

function resetCartUIState() {
    isAlreadyInCart = false;
    addToCartBtn?.classList.remove("hidden");
    alreadyInCartMsg?.classList.add("hidden");
}

function showAlreadyInCartUI() {
    isAlreadyInCart = true;
    addToCartBtn?.classList.add("hidden");
    alreadyInCartMsg?.classList.remove("hidden");
}

// Listen for cart changes made by other pages in the same browser.
window.addEventListener("storage", (event) => {
    if (event.key === CART_STORAGE_KEY) {
        updateCartBadge();
        updateCurrentProductCartStatus();
    }
});

window.addEventListener("sera-cart-updated", () => {
    updateCartBadge();
    updateCurrentProductCartStatus();
});

// ==========================================================================
// INITIALIZATION
// ==========================================================================

function initProductPage() {
    updateCartBadge();
    loadFooter();

    if (!productSlug) {
        showError("প্রোডাক্ট খুঁজে পাওয়া যায়নি।");
        return;
    }

    fetchAndRenderProduct(productSlug);
}

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        initProductPage,
        { once: true }
    );
} else {
    initProductPage();
}

// ==========================================================================
// FETCH PRODUCT FROM FIRESTORE
// ==========================================================================

async function fetchAndRenderProduct(slug) {
    try {
        const q = query(
            collection(db, "products"),
            where("productSlug", "==", slug),
            where("active", "==", true)
        );

        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            showError(
                "এই প্রোডাক্টটি খুঁজে পাওয়া যায়নি অথবা বর্তমানে উপলভ্য নয়।"
            );
            return;
        }

        const docSnap = snapshot.docs[0];

        currentProduct = {
            id: docSnap.id,
            ...docSnap.data()
        };

        renderProductDetails(currentProduct);
        setupSEO(currentProduct);
        setupOfferCountdown(currentProduct.offerTime);

        loadingState?.classList.add("hidden");
        productWrapper?.classList.remove("hidden");

        updateCartBadge();
        updateCurrentProductCartStatus();

    } catch (error) {
        console.error("Error fetching product:", error);

        showError(
            "প্রোডাক্ট লোড করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।"
        );
    }
}

function showError(message) {
    loadingState?.classList.add("hidden");
    productWrapper?.classList.add("hidden");

    if (errorMessage) {
        errorMessage.textContent = message;
    }

    errorState?.classList.remove("hidden");
}

// ==========================================================================
// RENDER PRODUCT DETAILS
// ==========================================================================

function renderProductDetails(product) {
    if (productTitle) {
        productTitle.textContent = product.productName || "";
    }

    if (productDescription) {
        productDescription.textContent =
            product.productDescription || "";
    }

    const basePrice = Number(product.customerPrice) || 0;
    const oldPrice = Number(product.customerOldPrice) || 0;

    if (currentPriceEl) {
        currentPriceEl.textContent = `৳${basePrice}`;
    }

    oldPriceEl?.classList.add("hidden");
    discountBadge?.classList.add("hidden");

    if (oldPrice > basePrice) {
        if (oldPriceEl) {
            oldPriceEl.textContent = `৳${oldPrice}`;
            oldPriceEl.classList.remove("hidden");
        }

        const discountAmount = oldPrice - basePrice;
        const discountPercent = Math.round(
            (discountAmount / oldPrice) * 100
        );

        if (discountBadge && discountPercent > 0) {
            discountBadge.textContent =
                `সাশ্রয়: ৳${discountAmount} (${discountPercent}% ছাড়)`;

            discountBadge.classList.remove("hidden");
        }
    }

    if (badgesContainer) {
        badgesContainer.replaceChildren();

        if (product.freeDelivery === true) {
            const badge = document.createElement("div");
            badge.className = "badge-item";
            badge.textContent =
                "এই প্রোডাক্টটা ফ্রিতে ডেলিভারি পাওয়া যাবে";

            badgesContainer.appendChild(badge);
        }

        if (
            product.warranty !== undefined &&
            product.warranty !== null &&
            String(product.warranty).trim() !== ""
        ) {
            const badge = document.createElement("div");
            badge.className = "badge-item";
            badge.textContent = `ওয়ারেন্টি: ${product.warranty}`;

            badgesContainer.appendChild(badge);
        }
    }

    setupGallery(product.image, product.reviewVideo);
    setupVariants(product.variants);
}

// ==========================================================================
// IMAGE & VIDEO GALLERY
// ==========================================================================

function setupGallery(images, reviewVideo) {
    const mediaToggle = document.getElementById("media-toggle");
    const imageView = document.getElementById("image-view");
    const videoView = document.getElementById("video-view");

    const validImages = Array.isArray(images)
        ? images.filter(
            url => typeof url === "string" && url.trim()
        )
        : [];

    if (thumbnailContainer) {
        thumbnailContainer.replaceChildren();
    }

    if (mainImage) {
        if (validImages.length > 0) {
            mainImage.src = validImages[0];
            mainImage.alt = currentProduct?.productName || "Product";
            mainImage.loading = "eager";
            mainImage.decoding = "async";
        } else {
            mainImage.removeAttribute("src");
            mainImage.alt = "ছবি পাওয়া যায়নি";
        }
    }

    validImages.forEach((imageUrl, index) => {
        const thumb = document.createElement("div");

        thumb.className =
            `thumbnail-item ${index === 0 ? "active" : ""}`;

        const img = document.createElement("img");
        img.src = imageUrl;
        img.alt = `Product image ${index + 1}`;
        img.loading = "lazy";
        img.decoding = "async";

        thumb.appendChild(img);

        thumb.addEventListener("click", () => {
            thumbnailContainer
                ?.querySelectorAll(".thumbnail-item")
                .forEach(element => {
                    element.classList.remove("active");
                });

            thumb.classList.add("active");

            if (mainImage) {
                mainImage.src = imageUrl;
            }

            const imageButton = mediaToggle?.querySelector(
                '[data-target="image-view"]'
            );

            imageButton?.click();
        });

        thumbnailContainer?.appendChild(thumb);
    });

    const hasVideo =
        typeof reviewVideo === "string" &&
        reviewVideo.trim() !== "";

    if (!mediaToggle || !videoView || !imageView) return;

    if (hasVideo) {
        mediaToggle.classList.remove("hidden");

        const toggleBtns =
            mediaToggle.querySelectorAll(".toggle-btn");

        // Use DOM APIs instead of inserting an arbitrary URL into HTML.
        videoView.replaceChildren();

        const iframe = document.createElement("iframe");
        iframe.src = reviewVideo.trim();
        iframe.title = "Product review video";
        iframe.loading = "lazy";
        iframe.allow =
            "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
        iframe.allowFullscreen = true;

        videoView.appendChild(iframe);

        toggleBtns.forEach((btn) => {
            // Prevent duplicate listeners if gallery is re-rendered.
            if (btn.dataset.galleryBound === "true") return;

            btn.dataset.galleryBound = "true";

            btn.addEventListener("click", () => {
                toggleBtns.forEach(button => {
                    button.classList.remove("active");
                });

                btn.classList.add("active");

                const target = btn.getAttribute("data-target");

                imageView.classList.toggle(
                    "hidden",
                    target !== "image-view"
                );

                videoView.classList.toggle(
                    "hidden",
                    target !== "video-view"
                );
            });
        });
    } else {
        mediaToggle.classList.add("hidden");
        videoView.replaceChildren();
        imageView.classList.remove("hidden");
    }
}

// ==========================================================================
// PRODUCT VARIANTS
// ==========================================================================

function setupVariants(variants) {
    if (!variantsContainer) return;

    variantsContainer.replaceChildren();
    selectedVariantsState = {};

    if (!Array.isArray(variants) || variants.length === 0) {
        updateCalculatedPrice();
        return;
    }

    variants.forEach((variant, groupIndex) => {
        const group = document.createElement("div");
        group.className = "variant-group";

        const title = document.createElement("div");
        title.className = "variant-title";
        title.textContent = variant.name || "অপশন";

        const optionsWrapper = document.createElement("div");
        optionsWrapper.className = "variant-options";

        const values = Array.isArray(variant.values)
            ? variant.values
            : [];

        values.forEach((valueObject, valueIndex) => {
            const btn = document.createElement("button");

            btn.type = "button";
            btn.className = "variant-option-btn";

            const extraPrice = Number(valueObject.extraPrice) || 0;
            const extraText = extraPrice > 0
                ? ` +৳${extraPrice}`
                : "";

            btn.textContent =
                `${valueObject.value ?? ""}${extraText}`;

            // Preserve the previous behaviour: select the first option.
            if (valueIndex === 0) {
                btn.classList.add("selected");

                selectedVariantsState[variant.name] = {
                    name: variant.name,
                    value: valueObject.value,
                    extraPrice
                };
            }

            btn.addEventListener("click", () => {
                optionsWrapper
                    .querySelectorAll(".variant-option-btn")
                    .forEach(button => {
                        button.classList.remove("selected");
                    });

                btn.classList.add("selected");

                selectedVariantsState[variant.name] = {
                    name: variant.name,
                    value: valueObject.value,
                    extraPrice
                };

                updateCalculatedPrice();
            });

            optionsWrapper.appendChild(btn);
        });

        group.append(title, optionsWrapper);
        variantsContainer.appendChild(group);
    });

    updateCalculatedPrice();
}

function updateCalculatedPrice() {
    if (!currentProduct || !currentPriceEl) return;

    let finalPrice =
        Number(currentProduct.customerPrice) || 0;

    Object.values(selectedVariantsState).forEach(variant => {
        finalPrice += Number(variant.extraPrice) || 0;
    });

    currentPriceEl.textContent = `৳${finalPrice}`;
}

function validateVariantsSelection() {
    const variants = currentProduct?.variants;

    if (!Array.isArray(variants) || variants.length === 0) {
        return true;
    }

    return variants.every(variant => {
        const selected = selectedVariantsState[variant.name];

        if (!selected) return false;

        return (variant.values || []).some(option =>
            option.value === selected.value
        );
    });
}

// ==========================================================================
// OFFER COUNTDOWN
// ==========================================================================

function setupOfferCountdown(offerTimeStr) {
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }

    if (!offerBanner || !countdownTimer) return;

    offerBanner.classList.add("hidden");

    if (
        offerTimeStr === undefined ||
        offerTimeStr === null ||
        offerTimeStr === ""
    ) {
        return;
    }

    const endTime = Number(offerTimeStr);

    if (!Number.isFinite(endTime)) return;

    offerBanner.classList.remove("hidden");

    function updateCountdown() {
        const distance = endTime - Date.now();

        if (distance <= 0) {
            countdownTimer.textContent =
                "এই প্রোডাক্টের অফার শেষ হয়েছে।";

            clearInterval(countdownInterval);
            countdownInterval = null;
            return;
        }

        const days = Math.floor(
            distance / (1000 * 60 * 60 * 24)
        );

        const hours = Math.floor(
            (distance % (1000 * 60 * 60 * 24)) /
            (1000 * 60 * 60)
        );

        const minutes = Math.floor(
            (distance % (1000 * 60 * 60)) /
            (1000 * 60)
        );

        const seconds = Math.floor(
            (distance % (1000 * 60)) / 1000
        );

        countdownTimer.textContent =
            `${days} দিন ${hours} ঘণ্টা ${minutes} মিনিট ${seconds} সেকেন্ড`;
    }

    updateCountdown();

    if (endTime > Date.now()) {
        countdownInterval = setInterval(updateCountdown, 1000);
    }
}

// ==========================================================================
// DYNAMIC SEO
// ==========================================================================

function setupSEO(product) {
    const title =
        `${product.productName || "Product"} | Sera Product`;

    const description = product.productDescription
        ? String(product.productDescription).substring(0, 150)
        : "Sera Product Details";

    const imageUrl =
        Array.isArray(product.image) && product.image.length > 0
            ? product.image[0]
            : "";

    const canonicalUrl =
        `https://seraproduct.com/product?${encodeURIComponent(
            product.productSlug || ""
        )}`;

    const setText = (id, value) => {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    };

    const setAttribute = (id, attribute, value) => {
        const element = document.getElementById(id);
        if (element) element.setAttribute(attribute, value);
    };

    setText("meta-title", title);

    setAttribute("meta-description", "content", description);
    setAttribute("meta-canonical", "href", canonicalUrl);

    setAttribute("og-title", "content", title);
    setAttribute("og-description", "content", description);
    setAttribute("og-image", "content", imageUrl);
    setAttribute("og-url", "content", canonicalUrl);

    setAttribute("twitter-title", "content", title);
    setAttribute("twitter-description", "content", description);
    setAttribute("twitter-image", "content", imageUrl);

    const schemaData = {
        "@context": "https://schema.org/",
        "@type": "Product",
        name: product.productName || "",
        image: Array.isArray(product.image) ? product.image : [],
        description: product.productDescription || "",
        sku: product.sku || "",
        offers: {
            "@type": "Offer",
            priceCurrency: "BDT",
            price: Number(product.customerPrice) || 0,
            availability: product.active
                ? "https://schema.org/InStock"
                : "https://schema.org/OutOfStock",
            url: canonicalUrl
        }
    };

    const schemaElement =
        document.getElementById("structured-data");

    if (schemaElement) {
        schemaElement.textContent = JSON.stringify(schemaData);
    }
}

// ==========================================================================
// ADD TO LOCAL CART
// Same fields as the former Firestore cart item.
// ==========================================================================

function buildCartItem() {
    const basePrice =
        Number(currentProduct.customerPrice) || 0;

    const formattedVariants =
        Object.values(selectedVariantsState).map(variant => ({
            name: variant.name,
            value: variant.value,
            extraPrice: Number(variant.extraPrice) || 0
        }));

    const extraSum = formattedVariants.reduce(
        (sum, variant) => sum + variant.extraPrice,
        0
    );

    const firstImage =
        Array.isArray(currentProduct.image) &&
        currentProduct.image.length > 0
            ? currentProduct.image[0]
            : "";

    // Keep the previous cart object's fields and value types.
    const cartItem = {
        productId: currentProduct.id,
        productName: currentProduct.productName || "",
        productImage: firstImage,
        productPrice: basePrice + extraSum,
        freeDelivery: currentProduct.freeDelivery === true,
        variants: formattedVariants,
        quantity: 1
    };

    // Keep warranty optional, just like the previous implementation.
    if (
        currentProduct.warranty !== undefined &&
        currentProduct.warranty !== null &&
        String(currentProduct.warranty).trim() !== ""
    ) {
        cartItem.warranty = String(currentProduct.warranty);
    }

    return cartItem;
}

function addItemToLocalCart(cartItem) {
    const cartData = getCartData();
    const items = cartData.productItem;

    // Similar to Firestore arrayUnion: do not add an identical entry twice.
    const alreadyExists = items.some(item =>
        sameCartSelection(item, cartItem) &&
        item.productName === cartItem.productName &&
        item.productImage === cartItem.productImage &&
        Number(item.productPrice) ===
            Number(cartItem.productPrice) &&
        item.freeDelivery === cartItem.freeDelivery &&
        String(item.warranty || "") ===
            String(cartItem.warranty || "") &&
        Number(item.quantity || 1) ===
            Number(cartItem.quantity || 1)
    );

    if (!alreadyExists) {
        items.push(cartItem);
    }

    return saveCartData(cartData);
}

// ==========================================================================
// CART AND BUY NOW ACTIONS
// No login, signup, authentication or Firestore cart writes.
// ==========================================================================

function handleAction(actionType) {
    if (!currentProduct) {
        showToast("প্রোডাক্ট লোড হওয়া পর্যন্ত অপেক্ষা করুন।");
        return;
    }

    if (!validateVariantsSelection()) {
        showToast("দয়া করে সব অপশন নির্বাচন করুন।");
        return;
    }

    const cartItem = buildCartItem();
    const saved = addItemToLocalCart(cartItem);

    if (!saved) return;

    if (actionType === "cart") {
        showToast("প্রোডাক্টটি কার্টে সেভ করা হয়েছে!");
        return;
    }

    if (actionType === "order") {
        // Save to localStorage first, then navigate to checkout.
        window.location.href = CHECKOUT_PAGE_URL;
    }
}

addToCartBtn?.addEventListener("click", () => {
    handleAction("cart");
});

buyNowBtn?.addEventListener("click", () => {
    handleAction("order");
});

// ==========================================================================
// FOOTER
// ==========================================================================

async function loadFooter() {
    const footerContainer =
        document.getElementById("footer-container");

    if (!footerContainer) return;

    try {
        const response = await fetch(FOOTER_API_URL);

        if (!response.ok) return;

        footerContainer.innerHTML = await response.text();

    } catch (error) {
        console.warn("Footer could not be loaded:", error);
    }
}

// ==========================================================================
// END
// ==========================================================================
