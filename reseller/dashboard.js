import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

let isBalanceHidden = false;
let currentBalanceValue = 0;

document.addEventListener("DOMContentLoaded", () => {
    initApp();
});

function initApp() {
    setupNavigation();
    setupBalanceToggle();
    handleAuthState();
}

function handleAuthState() {
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = "https://seraproduct.com/reseller/login";
            return;
        }

        try {
            const resellerRef = doc(db, "reseller", user.uid);
            const resellerSnap = await getDoc(resellerRef);

            if (!resellerSnap.exists()) {
                hideLoading();
                showMissingUserModal();
                return;
            }

            const resellerData = resellerSnap.data();
            renderDashboard(resellerData);
            await loadBanners();
            await loadFooter();
            hideLoading();

        } catch (error) {
            console.error("Error loading reseller data:", error);
            showError("তথ্য লোড করতে সমস্যা হয়েছে। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।");
        }
    });
}

function renderDashboard(data) {
    currentBalanceValue = data.balance || 0;
    renderBalance();
    renderAccountStatus(data.verified, data.active);
    renderResellerInfo(data);
}

function renderBalance() {
    const balanceElement = document.getElementById("balanceAmount");
    const withdrawContainer = document.getElementById("withdrawBtnContainer");

    if (isBalanceHidden) {
        balanceElement.textContent = "••••••";
    } else {
        const formattedAmount = new Intl.NumberFormat('bn-BD').format(currentBalanceValue);
        balanceElement.textContent = `৳ ${formattedAmount}`;
    }

    withdrawContainer.innerHTML = "";
    if (currentBalanceValue > 100) {
        const btn = document.createElement("button");
        btn.className = "withdraw-btn";
        btn.textContent = "Withdraw";
        btn.onclick = () => { window.location.href = "/withdraw"; };
        withdrawContainer.appendChild(btn);
    }
}

function renderAccountStatus(isVerified, isActive) {
    // Verification Status
    const vIcon = document.getElementById("verificationIcon");
    const vDesc = document.getElementById("verificationDesc");
    const vCard = document.getElementById("verificationStatusCard");

    vCard.className = `status-card ${isVerified ? 'success-card' : 'danger-card'}`;
    vIcon.className = `status-icon ${isVerified ? 'success' : 'danger'}`;
    
    if (isVerified) {
        vIcon.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.5" fill="none"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
        vDesc.textContent = "আপনার একাউন্ট ভেরিফাইড করা আছে!";
    } else {
        vIcon.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.5" fill="none"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
        vDesc.textContent = "আপনার একাউন্ট verified করা হয়নি!";
    }

    // Active Status
    const aIcon = document.getElementById("activeIcon");
    const aDesc = document.getElementById("activeDesc");
    const aCard = document.getElementById("activeStatusCard");

    aCard.className = `status-card ${isActive ? 'success-card' : 'danger-card'}`;
    aIcon.className = `status-icon ${isActive ? 'success' : 'danger'}`;

    if (isActive) {
        aIcon.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.5" fill="none"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
        aDesc.textContent = "আপনার একাউন্ট এক্টিভ করা আছে!";
    } else {
        aIcon.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.5" fill="none"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
        aDesc.textContent = "আপনার একাউন্ট এক্টিভ করা নেই";
    }
}

function renderResellerInfo(data) {
    document.getElementById("infoName").textContent = data.name || "-";
    document.getElementById("infoPhone").textContent = data.phone || "-";
    document.getElementById("infoEmail").textContent = data.email || "-";
    document.getElementById("infoWhatsapp").textContent = data.whatsApp || "-";
}

async function loadBanners() {
    try {
        const bannerQuery = query(collection(db, "reseller_banner"), orderBy("createdAt", "desc"), limit(10));
        const snapshot = await getDocs(bannerQuery);
        
        let banners = [];
        snapshot.forEach((doc) => {
            banners.push(doc.data());
        });

        // Fallback dummy banner if collection is empty for smooth preview
        if (banners.length === 0) {
            banners = [
                { bannerLink: "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=800&auto=format&fit=crop&q=60", clickLink: "/all-product" },
                { bannerLink: "https://images.unsplash.com/photo-1555529771-835f59fc5efe?w=800&auto=format&fit=crop&q=60", clickLink: "/categories" }
            ];
        }

        setupBannerSlider(banners);
    } catch (error) {
        console.error("Banner load error:", error);
    }
}

function setupBannerSlider(banners) {
    const track = document.getElementById("carouselTrack");
    const indicatorsContainer = document.getElementById("carouselIndicators");
    
    track.innerHTML = "";
    indicatorsContainer.innerHTML = "";

    if (banners.length === 0) return;

    // Seamless forward carousel implementation with cloned slides
    const extendedBanners = [banners[banners.length - 1], ...banners, banners[0]];
    let currentIndex = 1;
    const totalSlides = banners.length;

    extendedBanners.forEach((banner, index) => {
        const slide = document.createElement("div");
        slide.className = "carousel-slide";
        slide.innerHTML = `<img src="${banner.bannerLink}" alt="Banner" loading="lazy">`;
        slide.onclick = () => {
            if (banner.clickLink) window.location.href = banner.clickLink;
        };
        track.appendChild(slide);
    });

    // Indicators
    for (let i = 0; i < totalSlides; i++) {
        const indicator = document.createElement("div");
        indicator.className = `indicator ${i === 0 ? 'active' : ''}`;
        indicatorsContainer.appendChild(indicator);
    }

    const slides = track.children;
    track.style.transform = `translateX(-${currentIndex * 100}%)`;

    function updateIndicators() {
        const indicators = indicatorsContainer.children;
        let activeIdx = currentIndex - 1;
        if (activeIdx >= totalSlides) activeIdx = 0;
        if (activeIdx < 0) activeIdx = totalSlides - 1;

        for (let i = 0; i < indicators.length; i++) {
            indicators[i].classList.toggle('active', i === activeIdx);
        }
    }

    function moveToNextSlide() {
        currentIndex++;
        track.style.transition = "transform 0.4s ease-in-out";
        track.style.transform = `translateX(-${currentIndex * 100}%)`;
        updateIndicators();

        if (currentIndex === totalSlides + 1) {
            setTimeout(() => {
                track.style.transition = "none";
                currentIndex = 1;
                track.style.transform = `translateX(-${currentIndex * 100}%)`;
            }, 400);
        }
    }

    // Auto slide every 4 seconds
    let slideInterval = setInterval(moveToNextSlide, 4000);

    // Touch and Mouse Swipe support (Forward direction logic)
    let startX = 0;
    let isDragging = false;

    track.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        isDragging = true;
        clearInterval(slideInterval);
    });

    track.addEventListener('touchend', (e) => {
        if (!isDragging) return;
        const endX = e.changedTouches[0].clientX;
        if (startX - endX > 50) {
            moveToNextSlide();
        }
        isDragging = false;
        slideInterval = setInterval(moveToNextSlide, 4000);
    });

    track.addEventListener('mousedown', (e) => {
        startX = e.clientX;
        isDragging = true;
        clearInterval(slideInterval);
    });

    track.addEventListener('mouseup', (e) => {
        if (!isDragging) return;
        const endX = e.clientX;
        if (startX - endX > 50) {
            moveToNextSlide();
        }
        isDragging = false;
        slideInterval = setInterval(moveToNextSlide, 4000);
    });
}

function setupBalanceToggle() {
    const toggleBtn = document.getElementById("eyeToggleBtn");
    const eyeIcon = document.getElementById("eyeIcon");

    toggleBtn.onclick = () => {
        isBalanceHidden = !isBalanceHidden;
        if (isBalanceHidden) {
            eyeIcon.innerHTML = `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>`;
        } else {
            eyeIcon.innerHTML = `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>`;
        }
        renderBalance();
    };
}

function setupNavigation() {
    const menuBtn = document.getElementById("mobileMenuBtn");
    const closeBtn = document.getElementById("closeDrawerBtn");
    const drawer = document.getElementById("mobileDrawer");
    const overlay = document.getElementById("drawerOverlay");

    menuBtn.onclick = () => {
        drawer.classList.add("active");
        overlay.classList.add("active");
    };

    const closeDrawer = () => {
        drawer.classList.remove("active");
        overlay.classList.remove("active");
    };

    closeBtn.onclick = closeDrawer;
    overlay.onclick = closeDrawer;

    // Logout handling
    const logoutBtn = document.getElementById("logoutBtn");
    logoutBtn.onclick = logoutUser;
}

async function logoutUser() {
    try {
        await signOut(auth);
        window.location.href = "https://seraproduct.com/reseller/login";
    } catch (error) {
        console.error("Logout error:", error);
    }
}

async function loadFooter() {
    const footerContainer = document.getElementById("footer-container");
    try {
        const response = await fetch("https://seraproduct.com/footer");
        const html = await response.text();
        footerContainer.innerHTML = html;
    } catch (error) {
        footerContainer.innerHTML = "";
    }
}

function hideLoading() {
    document.getElementById("loading-screen").style.display = "none";
    document.getElementById("dashboardContent").style.display = "flex";
}

function showMissingUserModal() {
    const modal = document.getElementById("missingUserModal");
    modal.style.display = "flex";
    document.getElementById("modalLogoutBtn").onclick = logoutUser;
}

function showError(msg) {
    alert(msg);
}
