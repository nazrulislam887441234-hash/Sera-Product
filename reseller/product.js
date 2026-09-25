// Global Application State
let currentUser = null;
let currentResellerData = null;
let currentProductData = null;
let selectedImageIndex = 0;
let selectedVariantsState = {};
let currentQuantity = 1;
let isFavorite = false;
let favoriteDocId = null;

document.addEventListener("DOMContentLoaded", () => {
    initApp();
});

function initApp() {
    // Wait for Firebase modules from HTML
    const checkFirebaseLoaded = setInterval(() => {
        if (window.firebaseAppModules) {
            clearInterval(checkFirebaseLoaded);
            setupAppLogic();
        }
    }, 100);
}

function setupAppLogic() {
    const { auth, onAuthStateChanged, signOut } = window.firebaseAppModules;

    // Load Footer dynamically
    loadFooter();

    // Setup Auth Listener
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = "https://seraproduct.com/reseller/login";
        } else {
            currentUser = user;
            document.getElementById("logoutBtn").style.display = "flex";
            await loadResellerAndProduct();
        }
    });

    // Logout Handler
    document.getElementById("logoutBtn").addEventListener("click", async () => {
        try {
            await signOut(auth);
            window.location.href = "https://seraproduct.com/reseller/login";
        } catch (error) {
            showToast("লগআউট করতে সমস্যা হয়েছে।");
        }
    });

    // Quantity Handlers
    document.getElementById("qtyPlus").addEventListener("click", () => {
        currentQuantity++;
        updateQuantityUI();
    });

    document.getElementById("qtyMinus").addEventListener("click", () => {
        if (currentQuantity > 1) {
            currentQuantity--;
            updateQuantityUI();
        }
    });

    // Delivery Site & Advance Charge Listeners
    document.querySelectorAll("input[name='deliverySite']").forEach(el => {
        el.addEventListener("change", calculateOrderPrice);
    });

    document.querySelectorAll("input[name='deliveryChargeStatus']").forEach(el => {
        el.addEventListener("change", (e) => {
            const advanceBox = document.getElementById("advancePaymentBox");
            if (e.target.value === "yes") {
                advanceBox.style.display = "block";
            } else {
                advanceBox.style.display = "none";
            }
            calculateOrderPrice();
        });
    });

    // Order Submit Form
    document.getElementById("orderForm").addEventListener("submit", handleOrderSubmit);

    // Modal Events
    document.getElementById("downloadModalBtn").addEventListener("click", () => {
        document.getElementById("downloadModal").style.display = "flex";
    });
    document.getElementById("closeDownloadModal").addEventListener("click", () => {
        document.getElementById("downloadModal").style.display = "none";
    });
    document.getElementById("downloadSelectedModalBtn").addEventListener("click", () => {
        downloadSelectedImage();
        document.getElementById("downloadModal").style.display = "none";
    });
    document.getElementById("downloadAllModalBtn").addEventListener("click", () => {
        downloadAllImages();
        document.getElementById("downloadModal").style.display = "none";
    });

    // Copy Description Event
    document.getElementById("copyDescBtn").addEventListener("click", copyDescription);
}

// 1. Get Product Slug from URL
function getProductSlugFromURL() {
    const searchString = window.location.search;
    if (!searchString) return "";
    
    // Remove leading '?'
    let cleanQuery = searchString.startsWith('?') ? searchString.substring(1) : searchString;
    
    // Split by '&' to get parameters
    let params = cleanQuery.split('&');
    if (params.length === 0) return "";
    
    let firstParam = params[0];
    // Handle cases like ?tenda-router= or ?tenda-router
    let slugPart = firstParam.split('=')[0];
    
    return decodeURIComponent(slugPart).trim();
}

// 2 & 3. Load Reseller & Product Data
async function loadResellerAndProduct() {
    const { db, doc, getDoc, collection, query, where, limit, getDocs } = window.firebaseAppModules;
    
    try {
        // Load Reseller Document
        const resellerRef = doc(db, "reseller", currentUser.uid);
        const resellerSnap = await getDoc(resellerRef);

        if (!resellerSnap.exists()) {
            showError("আপনার তথ্য পাওয়া যায়নি!");
            return;
        }

        currentResellerData = resellerSnap.data();

        if (currentResellerData.active !== true) {
            showError("আপনার একাউন্ট এক্টিভ করা নেই!");
            return;
        }

        if (currentResellerData.verified !== true) {
            showError("আপনার একাউন্ট Verified করা হয়নি!");
            return;
        }

        // Get Product Slug
        const productSlug = getProductSlugFromURL();
        if (!productSlug) {
            showError("এই পণ্যটি পাওয়া যায়নি!");
            return;
        }

        // Query Product
        const productsQuery = query(collection(db, "products"), where("productSlug", "==", productSlug), limit(1));
        const querySnapshot = await getDocs(productsQuery);

        if (querySnapshot.empty) {
            showError("এই পণ্যটি পাওয়া যায়নি!");
            return;
        }

        querySnapshot.forEach((docSnap) => {
            currentProductData = { id: docSnap.id, ...docSnap.data() };
        });

        renderProduct();
        loadFavoriteState();

    } catch (error) {
        showError("তথ্য লোড করতে সমস্যা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।");
    }
}

// Render Product UI
function renderProduct() {
    document.getElementById("loadingState").style.display = "none";
    document.getElementById("productContent.style")?.remove();
    document.getElementById("productContent").style.display = "grid";

    // Name, Description, Warranty
    document.getElementById("productName").innerText = currentProductData.productName || "";
    document.getElementById("productDescriptionText").innerText = currentProductData.productDescription || "";
    document.getElementById("warrantyDisplay").innerText = `ওয়ারেন্টি: ${currentProductData.warranty || "প্রযোজ্য নয়"}`;
    document.getElementById("customerMaxPriceDisplay").innerText = `এই প্রোডাক্ট সর্বোচ্চ ৳${currentProductData.customerPrice || 0} দামে বিক্রি করতে পারবেন!`;

    // Pricing & Discount
    const resellerPrice = currentProductData.resellerPrice || 0;
    const resellerOldPrice = currentProductData.resellerOldPrice;
    
    document.getElementById("currentPriceDisplay").innerText = `৳${resellerPrice}`;
    
    if (resellerOldPrice && resellerOldPrice > resellerPrice) {
        const discountAmount = resellerOldPrice - resellerPrice;
        const discountPercentage = Math.round(((resellerOldPrice - resellerPrice) / resellerOldPrice) * 100);
        document.getElementById("oldPriceDisplay").innerHTML = `আগের দাম <span style="text-decoration: line-through;">৳${resellerOldPrice}</span> ছাড় ৳${discountAmount} প্রায় ${discountPercentage}% ছাড়`;
    } else {
        document.getElementById("oldPriceDisplay").innerHTML = "";
    }

    renderGallery();
    renderVariants();
    calculateOrderPrice();
}

// 4. Product Image Gallery
function renderGallery() {
    const images = currentProductData.image || [];
    const mainImageEl = document.getElementById("mainImage");
    const thumbContainer = document.getElementById("thumbnailContainer");
    thumbContainer.innerHTML = "";

    if (images.length === 0) {
        mainImageEl.src = "";
        return;
    }

    selectedImageIndex = 0;
    mainImageEl.src = images[0];

    images.forEach((imgUrl, index) => {
        const thumb = document.createElement("img");
        thumb.src = imgUrl;
        thumb.className = `thumbnail-item ${index === 0 ? 'active' : ''}`;
        thumb.alt = `Thumbnail ${index + 1}`;
        thumb.addEventListener("click", () => {
            selectedImageIndex = index;
            mainImageEl.src = imgUrl;
            document.querySelectorAll(".thumbnail-item").forEach(el => el.classList.remove("active"));
            thumb.classList.add("active");
        });
        thumbContainer.appendChild(thumb);
    });
}

// 5. Image Download System
function downloadSelectedImage() {
    const images = currentProductData.image || [];
    if (images.length === 0) {
        showToast("এই পণ্যের কোনো ছবি পাওয়া যায়নি।");
        return;
    }
    const imageUrl = images[selectedImageIndex];
    triggerDownload(imageUrl, `product-image-${selectedImageIndex + 1}.jpg`);
}

function downloadAllImages() {
    const images = currentProductData.image || [];
    if (images.length === 0) {
        showToast("এই পণ্যের কোনো ছবি পাওয়া যায়নি।");
        return;
    }
    images.forEach((url, idx) => {
        triggerDownload(url, `product-image-${idx + 1}.jpg`);
    });
}

function triggerDownload(url, filename) {
    fetch(url)
        .then(response => response.blob())
        .then(blob => {
            const blobUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = blobUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(blobUrl);
            document.body.removeChild(a);
        })
        .catch(() => {
            // Fallback if CORS or fetch fails
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.target = '_blank';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        });
}

// 8. Favorite / Whilst System
async function loadFavoriteState() {
    const { db, collection, query, where, getDocs } = window.firebaseAppModules;
    try {
        const q = query(
            collection(db, "whilst"),
            where("uid", "==", currentUser.uid),
            where("productId", "==", currentProductData.id)
        );
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            isFavorite = true;
            querySnapshot.forEach(docSnap => {
                favoriteDocId = docSnap.id;
            });
            updateFavoriteUI();
        }
    } catch (error) {
        console.error("Error loading favorite state", error);
    }

    document.getElementById("favoriteBtn").addEventListener("click", (e) => {
        e.stopPropagation();
        toggleFavorite();
    });
}

async function toggleFavorite() {
    const { db, collection, addDoc, deleteDoc, doc, serverTimestamp } = window.firebaseAppModules;
    const favBtn = document.getElementById("favoriteBtn");
    favBtn.style.pointerEvents = "none";

    try {
        if (isFavorite && favoriteDocId) {
            await deleteDoc(doc(db, "whilst", favoriteDocId));
            isFavorite = false;
            favoriteDocId = null;
            showToast("পছন্দের তালিকা থেকে সরানো হয়েছে।");
        } else {
            const images = currentProductData.image || [];
            const docRef = await addDoc(collection(db, "whilst"), {
                productId: currentProductData.id,
                productName: currentProductData.productName,
                productSlug: currentProductData.productSlug,
                productImage: images.length > 0 ? images[0] : "",
                createdAt: serverTimestamp(),
                uid: currentUser.uid
            });
            isFavorite = true;
            favoriteDocId = docRef.id;
            showToast("পছন্দের তালিকায় যোগ করা হয়েছে।");
        }
        updateFavoriteUI();
    } catch (error) {
        showToast("অপারেশন সম্পন্ন করতে সমস্যা হয়েছে।");
    } finally {
        favBtn.style.pointerEvents = "auto";
    }
}

function updateFavoriteUI() {
    const svg = document.getElementById("favSvg");
    if (isFavorite) {
        svg.setAttribute("fill", "#ff6a00");
    } else {
        svg.setAttribute("fill", "none");
    }
}

// 10. Copy Description
function copyDescription() {
    const text = currentProductData.productDescription || "";
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            showToast("ডেসক্রিপশন কপি হয়েছে।");
        }).catch(() => {
            fallbackCopyText(text);
        });
    } else {
        fallbackCopyText(text);
    }
}

function fallbackCopyText(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        document.execCommand('copy');
        showToast("ডেসক্রিপশন কপি হয়েছে।");
    } catch (err) {
        showToast("কপি করা যায়নি।");
    }
    document.body.removeChild(textArea);
}

// 12 & 13. Variants System
function renderVariants() {
    const variantsSection = document.getElementById("variantsSection");
    variantsSection.innerHTML = "";
    selectedVariantsState = {};

    const variants = currentProductData.variants;
    if (!variants || !Array.isArray(variants) || variants.length === 0) return;

    variants.forEach((variantGroup) => {
        const groupDiv = document.createElement("div");
        groupDiv.className = "variant-group";

        const label = document.createElement("label");
        label.innerText = variantGroup.name;
        groupDiv.appendChild(label);

        const optionsDiv = document.createElement("div");
        optionsDiv.className = "variant-options";

        variantGroup.values.forEach((valObj) => {
            const chip = document.createElement("button");
            chip.type = "button";
            chip.className = "variant-chip";
            
            let extraPriceText = "";
            if (valObj.extraPrice && valObj.extraPrice > 0) {
                extraPriceText = ` +৳${valObj.extraPrice}`;
            }
            chip.innerText = `${valObj.value}${extraPriceText}`;

            chip.addEventListener("click", () => {
                // Clear selection in group
                optionsDiv.querySelectorAll(".variant-chip").forEach(c => c.classList.remove("selected"));
                chip.classList.add("selected");

                selectedVariantsState[variantGroup.name] = {
                    value: valObj.value,
                    extraPrice: valObj.extraPrice || 0
                };
                calculateOrderPrice();
            });

            optionsDiv.appendChild(chip);
        });

        groupDiv.appendChild(optionsDiv);
        variantsSection.appendChild(groupDiv);
    });
}

// 15, 16, 19. Quantity & Price Calculation
function updateQuantityUI() {
    document.getElementById("quantityDisplay").innerText = currentQuantity;
    calculateOrderPrice();
}

function calculateOrderPrice() {
    let basePrice = currentProductData.resellerPrice || 0;
    
    // Add variant extra prices
    Object.keys(selectedVariantsState).forEach(groupName => {
        basePrice += selectedVariantsState[groupName].extraPrice;
    });

    const fullProducePrice = basePrice * currentQuantity;
    const subtotal = fullProducePrice;

    const deliverySite = document.querySelector("input[name='deliverySite']:checked").value;
    const deliveryChargeValue = deliverySite === "inside_dhaka" ? 60 : 120;

    const chargeStatus = document.querySelector("input[name='deliveryChargeStatus']:checked").value;
    
    let total = subtotal;
    let effectiveDeliveryCharge = deliveryChargeValue;

    if (chargeStatus === "no") {
        total = subtotal + deliveryChargeValue;
    } else {
        effectiveDeliveryCharge = deliveryChargeValue;
    }

    document.getElementById("summaryProdPrice").innerText = `৳${fullProducePrice}`;
    document.getElementById("summaryDelivCharge").innerText = `৳${effectiveDeliveryCharge}${chargeStatus === "yes" ? " (অগ্রিম দেওয়া)" : ""}`;
    document.getElementById("summaryTotalPrice").innerText = `৳${total}`;
}

// 21 & 25. Order Submit Validation & Processing
async function handleOrderSubmit(e) {
    e.preventDefault();

    // Validate Variants
    const variants = currentProductData.variants;
    if (variants && Array.isArray(variants) && variants.length > 0) {
        for (let group of variants) {
            if (!selectedVariantsState[group.name]) {
                showToast("অর্ডার করার আগে সব ভ্যারিয়েন্ট নির্বাচন করুন।");
                return;
            }
        }
    }

    // Form Field values
    const customerName = document.getElementById("customerNameInput").value.trim();
    const customerPhone = document.getElementById("customerPhoneInput").value.trim();
    const customerVibag = document.getElementById("customerVibagInput").value.trim();
    const customerJela = document.getElementById("customerJelaInput").value.trim();
    const upojelaThana = document.getElementById("upojelaThanaInput").value.trim();
    const customerNote = document.getElementById("customerNoteInput").value.trim() || null;
    
    const deliverySite = document.querySelector("input[name='deliverySite']:checked").value;
    const deliveryChargeStatus = document.querySelector("input[name='deliveryChargeStatus']:checked").value === "yes";

    let transectionId = null;
    let sendMoneyNumber = null;
    let SendDeliveryCharge = null;

    if (deliveryChargeStatus) {
        transectionId = document.getElementById("transectionIdInput").value.trim();
        sendMoneyNumber = document.getElementById("sendMoneyNumberInput").value.trim();
        SendDeliveryCharge = parseFloat(document.getElementById("sendDeliveryChargeInput").value);

        if (!transectionId || !sendMoneyNumber || isNaN(SendDeliveryCharge)) {
            showToast("ডেলিভারি চার্জ অগ্রিম দেওয়ার জন্য Transaction ID, প্রেরকের নম্বর এবং টাকার পরিমাণ পূরণ করুন।");
            return;
        }
    }

    if (!customerName || !customerPhone || !customerVibag || !customerJela || !upojelaThana) {
        showToast("অনুগ্রহ করে কাস্টমারের প্রয়োজনীয় সব তথ্য পূরণ করুন।");
        return;
    }

    // Calculations for order payload
    let basePrice = currentProductData.resellerPrice || 0;
    let formattedVariants = null;

    if (variants && variants.length > 0) {
        formattedVariants = {};
        Object.keys(selectedVariantsState).forEach(key => {
            const item = selectedVariantsState[key];
            formattedVariants[key] = `${item.value}${item.extraPrice > 0 ? '+৳' + item.extraPrice : ''}`;
            basePrice += item.extraPrice;
        });
    }

    const fullProducePrice = basePrice * currentQuantity;
    const subtotal = fullProducePrice;
    const deliveryChargeValue = deliverySite === "inside_dhaka" ? 60 : 120;

    let deliveryCharge = deliveryChargeStatus ? null : deliveryChargeValue;
    let productDeliveryCharge = deliveryChargeStatus ? null : deliveryChargeValue;
    let total = deliveryChargeStatus ? subtotal : subtotal + deliveryChargeValue;

    const images = currentProductData.image || [];
    const productImage = images.length > 0 ? images[0] : "";

    const orderData = {
        customerName: customerName,
        customerPhone: customerPhone,
        customerVibag: customerVibag,
        customerJela: customerJela,
        "upojela/thana": upojelaThana,
        customerNote: customerNote,
        quantity: currentQuantity,
        warranty: currentProductData.warranty || null,
        orderStatus: "pending",
        variants: formattedVariants,
        productName: currentProductData.productName,
        productImage: productImage,
        productPrice: currentProductData.resellerPrice,
        uid: currentUser.uid,
        email: currentUser.email || "",
        deliveryChargeStatus: deliveryChargeStatus,
        transectionId: transectionId,
        sendMoneyNumber: sendMoneyNumber,
        SendDeliveryCharge: SendDeliveryCharge,
        deliverySite: deliverySite,
        deliveryCharge: deliveryCharge,
        fullProducePrice: fullProducePrice,
        ProductdeliveryCharge: productDeliveryCharge,
        subtotal: subtotal,
        total: total,
        createdAt: window.firebaseAppModules.serverTimestamp()
    };

    const submitBtn = document.getElementById("submitOrderBtn");
    submitBtn.disabled = true;
    submitBtn.innerText = "অর্ডার তৈরি হচ্ছে...";

    const { db, collection, addDoc } = window.firebaseAppModules;
    try {
        await addDoc(collection(db, "reseller_orders"), orderData);
        showOrderSuccessPopup(orderData);
    } catch (error) {
        showToast("অর্ডার সম্পন্ন করতে ব্যর্থ হয়েছে। আবার চেষ্টা করুন।");
        submitBtn.disabled = false;
        submitBtn.innerText = "অর্ডার কনফার্ম করুন";
    }
}

// 27. Order Success Popup & JSON Copy
function showOrderSuccessPopup(orderData) {
    document.getElementById("successModal").style.display = "flex";
    
    document.getElementById("copyJsonBtn").onclick = () => {
        // Convert serverTimestamp placeholder for JSON preview
        const jsonString = JSON.stringify({ ...orderData, createdAt: "Server Timestamp" }, null, 2);
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(jsonString).then(() => {
                showToast("অর্ডার JSON কপি হয়েছে।");
            });
        }
    };
}

// 31. Load Footer
async function loadFooter() {
    try {
        const response = await fetch("https://seraproduct.com/footer");
        if (response.ok) {
            const html = await response.text();
            document.getElementById("footerContainer").innerHTML = html;
        }
    } catch (e) {
        // Fallback footer
        document.getElementById("footerContainer").innerHTML = `
            <footer style="text-align: center; padding: 20px; color: #6c757d; font-size: 14px; border-top: 1px solid #dee2e6; margin-top: 40px;">
                &copy; 2026 Sera Product. All Rights Reserved.
            `;
    }
}

// UI Notification Helpers
function showToast(message) {
    const toast = document.getElementById("toastNotification");
    toast.innerText = message;
    toast.classList.add("show");
    setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);
}

function showError(msg) {
    document.getElementById("loadingState").style.display = "none";
    document.getElementById("productContent").style.display = "none";
    document.getElementById("errorState").style.display = "block";
    document.getElementById("errorMessage").innerText = msg;
}
