// ==========================================================================
// SERA PRODUCT — LOCAL STORAGE CART
// No Firebase | No Authentication | No Login Redirect | No Database
// Shared Storage Key: sera_product_cart
// ==========================================================================

// --------------------------------------------------------------------------
// Configuration
// --------------------------------------------------------------------------

const CART_STORAGE_KEY = "sera_product_cart";
const FOOTER_API_URL = "https://seraproduct.com/footer";

// --------------------------------------------------------------------------
// Application State
// --------------------------------------------------------------------------

let cartItems = [];
let itemIndexToRemove = null;
let pendingRemoveCallback = null;

// --------------------------------------------------------------------------
// DOM Helpers
// --------------------------------------------------------------------------

function getElement(id) {
    return document.getElementById(id);
}

function hideLoader() {
    getElement("full-screen-loader")?.classList.add("hidden");
}

// --------------------------------------------------------------------------
// Bengali Number Formatting
// --------------------------------------------------------------------------

function toBengaliNumerals(num) {
    const bnDigits = [
        "০", "১", "২", "৩", "৪",
        "৫", "৬", "৭", "৮", "৯"
    ];

    return String(num).replace(
        /\d/g,
        digit => bnDigits[Number(digit)]
    );
}

function formatPrice(amount) {
    const number = Number(amount);

    if (!Number.isFinite(number)) return "০";

    return toBengaliNumerals(
        Math.round(number).toLocaleString("en-US")
    );
}

// --------------------------------------------------------------------------
// LOCAL STORAGE — Read Cart
// Compatible with the product page:
// { productItem: [...] }
// --------------------------------------------------------------------------

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

        return {
            productItem: data.productItem.filter(
                item =>
                    item &&
                    typeof item === "object" &&
                    !Array.isArray(item)
            )
        };

    } catch (error) {
        console.error("Cart read error:", error);

        return { productItem: [] };
    }
}

// --------------------------------------------------------------------------
// LOCAL STORAGE — Save Cart
// --------------------------------------------------------------------------

function saveCartData() {
    try {
        localStorage.setItem(
            CART_STORAGE_KEY,
            JSON.stringify({
                productItem: cartItems
            })
        );

        // Notify other same-origin tabs.
        window.dispatchEvent(
            new CustomEvent("sera-cart-updated")
        );

        return true;

    } catch (error) {
        console.error("Cart save error:", error);

        showCustomModal(
            "কার্ট সেভ করা যায়নি। ব্রাউজারের স্টোরেজ খালি করে আবার চেষ্টা করুন।",
            false
        );

        return false;
    }
}

// --------------------------------------------------------------------------
// Custom Modal
// --------------------------------------------------------------------------

function showCustomModal(
    message,
    isConfirm = true,
    onConfirm = null
) {
    const modal = getElement("custom-modal");
    const modalMessage = getElement("modal-message");
    const cancelBtn = getElement("modal-cancel-btn");
    const confirmBtn = getElement("modal-confirm-btn");

    if (!modal || !modalMessage || !confirmBtn) {
        if (!isConfirm) {
            alert(message);
        } else if (window.confirm(message) && onConfirm) {
            onConfirm();
        }

        return;
    }

    modalMessage.textContent = message;
    modal.classList.remove("hidden");

    // Replace old handlers to avoid duplicate actions.
    cancelBtn?.classList.toggle("hidden", !isConfirm);

    confirmBtn.textContent = isConfirm
        ? "সরিয়ে দিন"
        : "ঠিক আছে";

    confirmBtn.onclick = async () => {
        modal.classList.add("hidden");

        if (!isConfirm) {
            itemIndexToRemove = null;
            pendingRemoveCallback = null;
            return;
        }

        const callback = onConfirm;

        itemIndexToRemove = null;
        pendingRemoveCallback = null;

        if (callback) {
            await callback();
        }
    };

    if (cancelBtn) {
        cancelBtn.onclick = () => {
            modal.classList.add("hidden");
            itemIndexToRemove = null;
            pendingRemoveCallback = null;
        };
    }
}

// --------------------------------------------------------------------------
// Footer
// --------------------------------------------------------------------------

async function loadFooter() {
    const footerContainer = getElement("footer-container");

    if (!footerContainer) return;

    try {
        const response = await fetch(FOOTER_API_URL);

        if (!response.ok) return;

        footerContainer.innerHTML = await response.text();

    } catch (error) {
        console.warn("Footer loading failed:", error);
    }
}

// --------------------------------------------------------------------------
// Update Quantity
// productPrice becomes the total price for the selected quantity.
// --------------------------------------------------------------------------

function updateQuantity(index, change) {
    const item = cartItems[index];

    if (!item) return;

    const currentQty = Math.max(
        1,
        Number(item.quantity) || 1
    );

    const currentTotalPrice =
        Number(item.productPrice) || 0;

    const newQty = currentQty + change;

    if (newQty < 1) return;

    // Recover unit price from the existing total.
    const unitPrice = currentTotalPrice / currentQty;
    const newTotalPrice = unitPrice * newQty;

    cartItems[index] = {
        ...item,
        quantity: newQty,
        productPrice: Number(newTotalPrice.toFixed(2))
    };

    if (saveCartData()) {
        renderCartUI();
    }
}

// --------------------------------------------------------------------------
// Create Product Card Safely
// --------------------------------------------------------------------------

function createProductCard(product, index) {
    const card = document.createElement("div");
    card.className = "product-card";

    const content = document.createElement("div");

    // Product image
    const imageContainer = document.createElement("div");
    imageContainer.className = "image-container";

    const image = document.createElement("img");

    image.className = "product-image";
    image.alt = product.productName || "পণ্য";
    image.loading = "lazy";
    image.decoding = "async";

    const fallbackImage =
        "https://seraproduct.com/photo/logo.png";

    image.src = product.productImage || fallbackImage;

    image.onerror = () => {
        image.onerror = null;
        image.src = fallbackImage;
    };

    imageContainer.appendChild(image);
    content.appendChild(imageContainer);

    // Free delivery badge
    if (product.freeDelivery === true) {
        const badge = document.createElement("div");

        badge.className = "badge-free-delivery";
        badge.textContent = "ফ্রি ডেলিভারি";

        content.appendChild(badge);
    }

    // Product name
    const name = document.createElement("h3");

    name.className = "product-name";
    name.textContent = product.productName || "অজ্ঞাত পণ্য";

    content.appendChild(name);

    // Product price
    const price = document.createElement("div");

    price.className = "product-price";
    price.textContent =
        `৳ ${formatPrice(product.productPrice)}`;

    content.appendChild(price);

    // Quantity controls
    const quantity = Math.max(
        1,
        Number(product.quantity) || 1
    );

    const quantityController = document.createElement("div");
    quantityController.className = "quantity-controller";

    const minusBtn = document.createElement("button");

    minusBtn.type = "button";
    minusBtn.className = "btn-qty btn-minus";
    minusBtn.textContent = "−";
    minusBtn.disabled = quantity <= 1;
    minusBtn.setAttribute("aria-label", "পরিমাণ কমান");

    minusBtn.addEventListener("click", () => {
        updateQuantity(index, -1);
    });

    const quantityText = document.createElement("span");

    quantityText.className = "qty-value";
    quantityText.textContent = toBengaliNumerals(quantity);

    const plusBtn = document.createElement("button");

    plusBtn.type = "button";
    plusBtn.className = "btn-qty btn-plus";
    plusBtn.textContent = "+";
    plusBtn.setAttribute("aria-label", "পরিমাণ বাড়ান");

    plusBtn.addEventListener("click", () => {
        updateQuantity(index, 1);
    });

    quantityController.append(
        minusBtn,
        quantityText,
        plusBtn
    );

    content.appendChild(quantityController);

    // Variant details
    const metaDetails = document.createElement("div");
    metaDetails.className = "meta-details";

    if (
        Array.isArray(product.variants) &&
        product.variants.length > 0
    ) {
        product.variants.forEach(variant => {
            const meta = document.createElement("div");

            meta.className = "meta-item";

            const variantName = variant.name || "ভ্যারিয়েন্ট";
            const variantValue = variant.value || "";
            const extraPrice = Number(variant.extraPrice) || 0;

            meta.textContent =
                `${variantName}: ${variantValue}` +
                (
                    extraPrice
                        ? ` (অতিরিক্ত মূল্য: ৳${formatPrice(extraPrice)})`
                        : ""
                );

            metaDetails.appendChild(meta);
        });
    }

    if (
        product.warranty !== undefined &&
        product.warranty !== null &&
        String(product.warranty).trim() !== ""
    ) {
        const warranty = document.createElement("div");

        warranty.className = "meta-item";
        warranty.textContent = `ওয়ারেন্টি: ${product.warranty}`;

        metaDetails.appendChild(warranty);
    }

    if (metaDetails.childElementCount > 0) {
        content.appendChild(metaDetails);
    }

    // Remove button
    const removeBtn = document.createElement("button");

    removeBtn.type = "button";
    removeBtn.className = "btn-remove";
    removeBtn.setAttribute("aria-label", "পণ্য সরিয়ে দিন");

    removeBtn.innerHTML = `
        <svg width="18" height="18"
             viewBox="0 0 24 24"
             fill="none"
             stroke="currentColor"
             stroke-width="2"
             stroke-linecap="round"
             stroke-linejoin="round"
             aria-hidden="true">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
        <span>সরিয়ে দিন</span>
    `;

    removeBtn.addEventListener("click", () => {
        initiateRemoveProduct(index);
    });

    card.append(content, removeBtn);

    return card;
}

// --------------------------------------------------------------------------
// Render Cart UI
// --------------------------------------------------------------------------

function renderCartUI() {
    const productContainer =
        getElement("product-list-container");

    const emptyCartContainer =
        getElement("empty-cart-container");

    const checkoutSection =
        getElement("checkout-section");

    const cartCountText =
        getElement("cart-count-text");

    if (
        !productContainer ||
        !emptyCartContainer ||
        !checkoutSection
    ) {
        hideLoader();
        return;
    }

    // Remove invalid entries from the current in-memory view.
    cartItems = Array.isArray(cartItems)
        ? cartItems.filter(
            item =>
                item &&
                typeof item === "object" &&
                !Array.isArray(item)
        )
        : [];

    productContainer.replaceChildren();

    // Empty cart
    if (cartItems.length === 0) {
        if (cartCountText) {
            cartCountText.textContent = "";
        }

        emptyCartContainer.classList.remove("hidden");
        checkoutSection.classList.add("hidden");

        hideLoader();
        return;
    }

    emptyCartContainer.classList.add("hidden");
    checkoutSection.classList.remove("hidden");

    if (cartCountText) {
        cartCountText.textContent =
            `আপনার কার্টে ${toBengaliNumerals(cartItems.length)}টি পণ্য রয়েছে`;
    }

    // Batch DOM insertion
    const fragment = document.createDocumentFragment();

    cartItems.forEach((product, index) => {
        fragment.appendChild(
            createProductCard(product, index)
        );
    });

    productContainer.appendChild(fragment);

    hideLoader();
}

// --------------------------------------------------------------------------
// Remove Product
// --------------------------------------------------------------------------

function initiateRemoveProduct(index) {
    if (!cartItems[index]) return;

    itemIndexToRemove = index;

    pendingRemoveCallback = () => {
        return executeRemoveProduct(index);
    };

    showCustomModal(
        "আপনি কি এই পণ্যটি কার্ট থেকে সরিয়ে দিতে চান?",
        true,
        pendingRemoveCallback
    );
}

function executeRemoveProduct(index) {
    if (
        !Number.isInteger(index) ||
        index < 0 ||
        index >= cartItems.length
    ) {
        return;
    }

    const updatedItems = cartItems.filter(
        (_, itemIndex) => itemIndex !== index
    );

    cartItems = updatedItems;

    if (saveCartData()) {
        renderCartUI();
        return;
    }

    showCustomModal(
        "পণ্যটি সরানো যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।",
        false
    );
}

// --------------------------------------------------------------------------
// Load Cart From LocalStorage Only
// --------------------------------------------------------------------------

function loadCart() {
    try {
        const data = getCartData();

        cartItems = data.productItem;

        renderCartUI();

    } catch (error) {
        console.error("Cart loading failed:", error);

        cartItems = [];
        renderCartUI();

        showCustomModal(
            "কার্টের তথ্য লোড করা যায়নি।",
            false
        );

    } finally {
        hideLoader();
    }
}

// --------------------------------------------------------------------------
// Sync When Cart Changes in Another Tab
// --------------------------------------------------------------------------

window.addEventListener("storage", event => {
    if (event.key === CART_STORAGE_KEY) {
        loadCart();
    }
});

window.addEventListener("sera-cart-updated", () => {
    // This page itself already updates the UI after its own actions.
    // Reload only if the stored cart differs from the current view.
    const latestItems = getCartData().productItem;

    if (JSON.stringify(latestItems) !== JSON.stringify(cartItems)) {
        cartItems = latestItems;
        renderCartUI();
    }
});

// --------------------------------------------------------------------------
// Application Initialization
// --------------------------------------------------------------------------

function initCartPage() {
    loadFooter();
    loadCart();
}

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        initCartPage,
        { once: true }
    );
} else {
    initCartPage();
}

// ==========================================================================
// END — LOCAL STORAGE CART
// ==========================================================================
