
/* ==========================================
   FIREBASE CONFIGURATION & INITIALIZATION
   ========================================== */
const firebaseConfig = {
    apiKey: "AIzaSyBRSt2aoSJ-lumYAWGAXE6ncui7__TqJ4E",
    authDomain: "sera-product.firebaseapp.com",
    projectId: "sera-product",
    storageBucket: "sera-product.firebasestorage.app",
    messagingSenderId: "516762224598",
    appId: "1:516762224598:web:b6a571f355a8a4a97c0677",
    measurementId: "G-RLMWH43FXX"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();

/* ==========================================
   DOM ELEMENTS & STATE
   ========================================== */
const mobileMenuToggle = document.getElementById('mobileMenuToggle');
const mobileDrawer = document.getElementById('mobileDrawer');
const drawerOverlay = document.getElementById('drawerOverlay');
const drawerClose = document.getElementById('drawerClose');

const bannerTrack = document.getElementById('bannerTrack');
const bannerDots = document.getElementById('bannerDots');

const categoryGrid = document.getElementById('categoryGrid');
const loadMoreCategoryContainer =
    document.getElementById('loadMoreCategoryContainer');
const loadMoreCategoryBtn =
    document.getElementById('loadMoreCategoryBtn');

const productGrid = document.getElementById('productGrid');
const infiniteLoader = document.getElementById('infiniteLoader');

const ytVideosGrid = document.getElementById('ytVideosGrid');
const loadMoreYtContainer =
    document.getElementById('loadMoreYtContainer');
const loadMoreYtBtn = document.getElementById('loadMoreYtBtn');

let ytLastVisible = null;
let categoryLastVisible = null;
let productLastVisible = null;

let isProductFetching = false;
let hasMoreProducts = true;
let productLoadFailed = false;

let isCategoryFetching = false;
let hasMoreCategories = true;

let isYtFetching = false;
let hasMoreYtVideos = true;

let bannerSlidesCount = 0;
let currentBannerIndex = 0;
let bannerInterval = null;
let bannerEventsInitialized = false;
let appInitialized = false;

/* ==========================================
   COMMON HELPERS
   ========================================== */
function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[char]);
}

function showMessage(container, message, color = '#777') {
    if (!container) return;

    container.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;
                    color:${color};padding:20px;">
            ${escapeHtml(message)}
        </div>
    `;
}

function setLoaderVisible(visible) {
    if (infiniteLoader) {
        infiniteLoader.style.display = visible ? 'flex' : 'none';
    }
}

/* ==========================================
   MOBILE DRAWER TOGGLE
   ========================================== */
function toggleDrawer() {
    if (!mobileDrawer || !drawerOverlay) return;

    mobileDrawer.classList.toggle('active');
    drawerOverlay.classList.toggle('active');
}

if (mobileMenuToggle) {
    mobileMenuToggle.addEventListener('click', toggleDrawer);
}

if (drawerClose) {
    drawerClose.addEventListener('click', toggleDrawer);
}

if (drawerOverlay) {
    drawerOverlay.addEventListener('click', toggleDrawer);
}

/* ==========================================
   FOOTER LOADER
   ========================================== */
async function loadFooter() {
    const footerContainer = document.getElementById('footerContainer');
    if (!footerContainer) return;

    try {
        const response = await fetch(
            'https://seraproduct.com/footer.html'
        );

        if (!response.ok) {
            throw new Error(`Footer HTTP error: ${response.status}`);
        }

        footerContainer.innerHTML = await response.text();
    } catch (error) {
        console.error('Error loading footer:', error);
    }
}

/* ==========================================
   BANNER CAROUSEL
   Banner auto-slide remains enabled
   ========================================== */
function initBannerCarousel() {
    if (!bannerTrack || !bannerDots) return;

    const slides = bannerTrack.querySelectorAll('.banner-slide');
    bannerSlidesCount = slides.length;

    bannerDots.innerHTML = '';

    if (bannerSlidesCount === 0) {
        stopBannerAutoSlide();
        return;
    }

    currentBannerIndex = Math.min(
        currentBannerIndex,
        bannerSlidesCount - 1
    );

    const fragment = document.createDocumentFragment();

    for (let i = 0; i < bannerSlidesCount; i++) {
        const dot = document.createElement('div');

        dot.className =
            `banner-dot ${i === currentBannerIndex ? 'active' : ''}`;

        dot.addEventListener('click', () => goToBanner(i));
        fragment.appendChild(dot);
    }

    bannerDots.appendChild(fragment);

    if (!bannerEventsInitialized) {
        bannerTrack.addEventListener('mouseenter', stopBannerAutoSlide);
        bannerTrack.addEventListener('mouseleave', startBannerAutoSlide);
        bannerTrack.addEventListener('touchstart', stopBannerAutoSlide);
        bannerTrack.addEventListener('touchend', startBannerAutoSlide);

        bannerEventsInitialized = true;
    }

    goToBanner(currentBannerIndex);
    startBannerAutoSlide();
}

function goToBanner(index) {
    if (!bannerTrack || bannerSlidesCount === 0) return;

    currentBannerIndex =
        ((index % bannerSlidesCount) + bannerSlidesCount)
        % bannerSlidesCount;

    bannerTrack.style.transform =
        `translateX(-${currentBannerIndex * 100}%)`;

    updateBannerDots();
}

function updateBannerDots() {
    if (!bannerDots) return;

    bannerDots.querySelectorAll('.banner-dot').forEach((dot, idx) => {
        dot.classList.toggle('active', idx === currentBannerIndex);
    });
}

function startBannerAutoSlide() {
    stopBannerAutoSlide();

    if (bannerSlidesCount <= 1) return;

    bannerInterval = setInterval(() => {
        goToBanner(currentBannerIndex + 1);
    }, 4000);
}

function stopBannerAutoSlide() {
    if (bannerInterval !== null) {
        clearInterval(bannerInterval);
        bannerInterval = null;
    }
}

async function loadFirebaseBanners() {
    if (!bannerTrack) return;

    try {
        const snapshot = await db.collection('home_banner')
            .orderBy('createdAt', 'desc')
            .limit(5)
            .get();

        const fragment = document.createDocumentFragment();

        snapshot.forEach(doc => {
            const data = doc.data();

            if (!data.bannerLink) return;

            const slide = document.createElement('div');
            slide.className = 'banner-slide';

            if (data.clickLink) {
                slide.style.cursor = 'pointer';

                slide.addEventListener('click', () => {
                    window.location.href = data.clickLink;
                });
            }

            const img = document.createElement('img');
            img.src = data.bannerLink;
            img.alt = 'Firebase Banner';
            img.loading = 'lazy';

            slide.appendChild(img);
            fragment.appendChild(slide);
        });

        bannerTrack.appendChild(fragment);
    } catch (error) {
        console.error('Error loading Firebase banners:', error);
    } finally {
        initBannerCarousel();
    }
}

/* ==========================================
   POPULAR CATEGORIES
   Pagination + DocumentFragment + Retry
   ========================================== */
async function loadCategories(isInitial = true) {
    if (isCategoryFetching) return;
    if (!isInitial && !hasMoreCategories) return;
    if (!categoryGrid) return;

    if (isInitial) {
        categoryLastVisible = null;
        hasMoreCategories = true;
    }

    isCategoryFetching = true;

    if (loadMoreCategoryBtn) {
        loadMoreCategoryBtn.disabled = true;
    }

    try {
        let query = db.collection('categories')
            .orderBy('createdAt', 'desc');

        if (!isInitial && categoryLastVisible) {
            query = query.startAfter(categoryLastVisible);
        }

        const snapshot = await query.limit(10).get();

        if (isInitial) {
            categoryGrid.innerHTML = '';
        }

        if (snapshot.empty) {
            hasMoreCategories = false;

            if (isInitial) {
                showMessage(categoryGrid, 'কোনো ক্যাটাগরি পাওয়া যায়নি।');
            }

            if (loadMoreCategoryContainer) {
                loadMoreCategoryContainer.style.display = 'none';
            }

            return;
        }

        categoryLastVisible =
            snapshot.docs[snapshot.docs.length - 1];

        // Build category cards off-DOM first.
        const fragment = document.createDocumentFragment();

        snapshot.forEach(doc => {
            const cat = doc.data();

            const categoryName = cat.categoryName || 'Category';
            const slug = cat.categorySlug ||
                categoryName.toLowerCase().replace(/\s+/g, '-');

            const card = document.createElement('div');
            card.className = 'category-card';

            card.addEventListener('click', () => {
                window.location.href =
                    `https://seraproduct.com/category?${encodeURIComponent(slug)}`;
            });

            card.innerHTML = `
                <div class="category-img-wrap">
                    <img
                        src="${escapeHtml(cat.image || 'https://via.placeholder.com/70')}"
                        alt="${escapeHtml(categoryName)}"
                        loading="lazy">
                </div>
                <div class="category-name">
                    ${escapeHtml(categoryName)}
                </div>
            `;

            fragment.appendChild(card);
        });

        // Add all category cards to the grid in one DOM operation.
        categoryGrid.appendChild(fragment);

        hasMoreCategories = snapshot.docs.length === 10;

        if (loadMoreCategoryContainer) {
            loadMoreCategoryContainer.style.display =
                hasMoreCategories ? 'block' : 'none';
        }
    } catch (error) {
        console.error('Error loading categories:', error);

        if (isInitial) {
            categoryGrid.innerHTML = '';

            const errorBox = document.createElement('div');
            errorBox.style.cssText =
                'grid-column:1/-1;text-align:center;padding:20px;';

            const message = document.createElement('p');
            message.style.color = '#e53935';
            message.textContent =
                'দুঃখিত, ক্যাটাগরি লোড হয়নি। আবার চেষ্টা করুন।';

            const retryBtn = document.createElement('button');
            retryBtn.className = 'btn-load-more';
            retryBtn.textContent = 'পুনরায় চেষ্টা করুন';

            retryBtn.addEventListener('click', () => {
                loadCategories(true);
            });

            errorBox.append(message, retryBtn);
            categoryGrid.appendChild(errorBox);
        } else {
            console.error('Could not load the next category page.');
        }
    } finally {
        isCategoryFetching = false;

        if (loadMoreCategoryBtn) {
            loadMoreCategoryBtn.disabled = false;
        }
    }
}

if (loadMoreCategoryBtn) {
    loadMoreCategoryBtn.addEventListener('click', () => {
        loadCategories(false);
    });
}

/* ==========================================
   POPULAR PRODUCTS
   Infinite Scroll + Pagination + Retry
   + DocumentFragment

   Product images do not auto-slide.
   Only the first product image is displayed.
   ========================================== */
async function loadProducts(isInitial = true) {
    if (isProductFetching) return;
    if (!isInitial && (!hasMoreProducts || productLoadFailed)) return;
    if (!productGrid) return;

    if (isInitial) {
        productLastVisible = null;
        hasMoreProducts = true;
        productLoadFailed = false;
    }

    isProductFetching = true;
    setLoaderVisible(true);

    try {
        let query = db.collection('products')
            .orderBy('createdAt', 'desc');

        if (!isInitial && productLastVisible) {
            query = query.startAfter(productLastVisible);
        }

        const snapshot = await query.limit(20).get();

        if (isInitial) {
            productGrid.innerHTML = '';
        }

        if (snapshot.empty) {
            hasMoreProducts = false;

            if (isInitial) {
                showMessage(productGrid, 'কোনো পণ্য পাওয়া যায়নি।');
            }

            return;
        }

        productLastVisible =
            snapshot.docs[snapshot.docs.length - 1];

        // Build all product cards off-DOM first.
        const fragment = document.createDocumentFragment();

        snapshot.forEach(doc => {
            const p = doc.data();

            const productName = p.productName || 'Product';
            const slug = p.productSlug || doc.id;

            const images = Array.isArray(p.image)
                ? p.image.filter(Boolean)
                : (p.image ? [p.image] : []);

            // Show first image only; no image auto-slide.
            const currentImg =
                images[0] || 'https://via.placeholder.com/200';

            const currentPrice = Number(p.customerPrice) || 0;
            const oldPrice = Number(
                p.customerOldPrice || p.customerPrice
            ) || 0;

            let discountPercent = 0;
            let saving = 0;

            if (oldPrice > currentPrice && oldPrice > 0) {
                discountPercent = Math.round(
                    ((oldPrice - currentPrice) / oldPrice) * 100
                );

                saving = oldPrice - currentPrice;
            }

            const productUrl =
                `https://seraproduct.com/product?${encodeURIComponent(slug)}`;

            const card = document.createElement('div');
            card.className = 'product-card';

            card.addEventListener('click', () => {
                window.location.href = productUrl;
            });

            card.innerHTML = `
                <div class="product-img-wrap">
                    ${p.freeDelivery
                        ? '<span class="badge-free-delivery">ফ্রি ডেলিভারি</span>'
                        : ''}
                    ${discountPercent > 0
                        ? `<span class="badge-discount">${discountPercent}% OFF</span>`
                        : ''}
                    <img
                        src="${escapeHtml(currentImg)}"
                        alt="${escapeHtml(productName)}"
                        loading="lazy"
                        class="prod-img">
                </div>

                <div class="product-info">
                    <div>
                        <h4 class="product-title">
                            ${escapeHtml(productName)}
                        </h4>

                        <div class="product-price-box">
                            <span class="current-price">
                                ৳${currentPrice}
                            </span>
                            ${oldPrice > currentPrice
                                ? `<span class="old-price">৳${oldPrice}</span>`
                                : ''}
                        </div>

                        ${saving > 0
                            ? `<div class="saving-text">সাশ্রয় ৳${saving}</div>`
                            : ''}
                    </div>

                    <button class="btn-order" type="button">
                        অর্ডার করুন
                    </button>
                </div>
            `;

            const orderBtn = card.querySelector('.btn-order');

            orderBtn.addEventListener('click', event => {
                event.stopPropagation();
                window.location.href = productUrl;
            });

            // Append each card to the fragment, not directly to the grid.
            fragment.appendChild(card);
        });

        // Add all product cards to the grid in one DOM operation.
        productGrid.appendChild(fragment);

        hasMoreProducts = snapshot.docs.length === 20;
        productLoadFailed = false;

    } catch (error) {
        console.error('Error loading products:', error);

        productLoadFailed = true;

        const oldError = productGrid.querySelector(
            '.product-load-error'
        );

        if (oldError) oldError.remove();

        const errorBox = document.createElement('div');
        errorBox.className = 'product-load-error';
        errorBox.style.cssText =
            'grid-column:1/-1;text-align:center;padding:20px;';

        const message = document.createElement('p');
        message.style.color = '#e53935';
        message.textContent =
            'দুঃখিত, পণ্য লোড করা সম্ভব হয়নি। আবার চেষ্টা করুন।';

        const retryBtn = document.createElement('button');
        retryBtn.className = 'btn-load-more';
        retryBtn.textContent = 'পুনরায় চেষ্টা করুন';

        retryBtn.addEventListener('click', () => {
            errorBox.remove();

            if (isInitial) {
                loadProducts(true);
            } else {
                productLoadFailed = false;
                loadProducts(false);
            }
        });

        errorBox.append(message, retryBtn);

        if (isInitial) {
            productGrid.innerHTML = '';
        }

        productGrid.appendChild(errorBox);
    } finally {
        isProductFetching = false;
        setLoaderVisible(false);
    }
}

/* ==========================================
   YOUTUBE VIDEOS
   Pagination + Retry
   ========================================== */
async function loadYtVideos(isInitial = true) {
    if (isYtFetching) return;
    if (!isInitial && !hasMoreYtVideos) return;
    if (!ytVideosGrid) return;

    if (isInitial) {
        ytLastVisible = null;
        hasMoreYtVideos = true;
    }

    isYtFetching = true;

    if (loadMoreYtBtn) {
        loadMoreYtBtn.disabled = true;
    }

    try {
        let query = db.collection('videos')
            .orderBy('createdAt', 'desc');

        if (!isInitial && ytLastVisible) {
            query = query.startAfter(ytLastVisible);
        }

        const snapshot = await query.limit(10).get();

        if (isInitial) {
            ytVideosGrid.innerHTML = '';
        }

        if (snapshot.empty) {
            hasMoreYtVideos = false;

            if (isInitial) {
                showMessage(ytVideosGrid, 'কোনো ভিডিও পাওয়া যায়নি।');
            }

            if (loadMoreYtContainer) {
                loadMoreYtContainer.style.display = 'none';
            }

            return;
        }

        ytLastVisible = snapshot.docs[snapshot.docs.length - 1];

        const fragment = document.createDocumentFragment();

        snapshot.forEach(doc => {
            const v = doc.data();

            const card = document.createElement('div');
            card.className = 'yt-video-card';

            const embedWrap = document.createElement('div');
            embedWrap.className = 'yt-video-embed-wrap';

            const thumbnail = document.createElement('img');
            thumbnail.src =
                v.thumbnail || 'https://via.placeholder.com/300x169';
            thumbnail.alt = v.title || 'VIDEO';
            thumbnail.className = 'yt-thumb';
            thumbnail.loading = 'lazy';

            const playButton = document.createElement('div');
            playButton.className = 'yt-play-btn';
            playButton.innerHTML = `
                <svg width="48" height="48" viewBox="0 0 24 24"
                     fill="#ff6a00">
                    <path d="M8 5v14l11-7z"></path>
                </svg>
            `;

            embedWrap.append(thumbnail, playButton);

            embedWrap.addEventListener('click', () => {
                playYtVideo(embedWrap, v.videoLink);
            });

            const info = document.createElement('div');
            info.className = 'yt-video-info';

            const title = document.createElement('h4');
            title.className = 'yt-video-title';
            title.textContent = v.title || 'VIDEO';

            info.appendChild(title);
            card.append(embedWrap, info);

            fragment.appendChild(card);
        });

        ytVideosGrid.appendChild(fragment);

        hasMoreYtVideos = snapshot.docs.length === 10;

        if (loadMoreYtContainer) {
            loadMoreYtContainer.style.display =
                hasMoreYtVideos ? 'block' : 'none';
        }

    } catch (error) {
        console.error('Error loading YouTube videos:', error);

        if (isInitial) {
            showMessage(
                ytVideosGrid,
                'ভিডিও লোড করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।',
                '#e53935'
            );
        }
    } finally {
        isYtFetching = false;

        if (loadMoreYtBtn) {
            loadMoreYtBtn.disabled = false;
        }
    }
}

function playYtVideo(element, embedLink) {
    if (!element || !embedLink) return;

    try {
        const videoUrl = new URL(embedLink);

        const allowedHosts = [
            'www.youtube.com',
            'youtube.com',
            'www.youtube-nocookie.com',
            'youtube-nocookie.com'
        ];

        if (
            !allowedHosts.includes(videoUrl.hostname) ||
            !videoUrl.pathname.startsWith('/embed/')
        ) {
            console.error('Invalid YouTube embed URL:', embedLink);
            return;
        }

        videoUrl.searchParams.set('autoplay', '1');

        const iframe = document.createElement('iframe');
        iframe.src = videoUrl.toString();
        iframe.title = 'YouTube video player';
        iframe.setAttribute('frameborder', '0');
        iframe.setAttribute(
            'allow',
            'accelerometer; autoplay; clipboard-write; ' +
            'encrypted-media; gyroscope; picture-in-picture; web-share'
        );
        iframe.setAttribute('allowfullscreen', 'true');

        iframe.style.cssText =
            'width:100%;height:100%;position:absolute;top:0;left:0;';

        element.innerHTML = '';
        element.appendChild(iframe);

    } catch (error) {
        console.error('Could not play YouTube video:', error);
    }
}

if (loadMoreYtBtn) {
    loadMoreYtBtn.addEventListener('click', () => {
        loadYtVideos(false);
    });
}

/* ==========================================
   INFINITE SCROLL OBSERVER
   ========================================== */
function initInfiniteScroll() {
    if (!infiniteLoader || !('IntersectionObserver' in window)) {
        console.warn(
            'IntersectionObserver unavailable; using scroll fallback.'
        );

        window.addEventListener('scroll', () => {
            if (
                window.innerHeight + window.scrollY >=
                document.documentElement.scrollHeight - 300
            ) {
                loadProducts(false);
            }
        }, { passive: true });

        return;
    }

    const observer = new IntersectionObserver(entries => {
        if (
            entries.some(entry => entry.isIntersecting) &&
            !isProductFetching &&
            hasMoreProducts &&
            !productLoadFailed
        ) {
            loadProducts(false);
        }
    }, {
        rootMargin: '200px'
    });

    observer.observe(infiniteLoader);
}

/* ==========================================
   INITIALIZE APP
   ========================================== */
function initializeAppPage() {
    if (appInitialized) return;
    appInitialized = true;

    initBannerCarousel();

    loadFirebaseBanners();
    loadCategories(true);
    loadProducts(true);
    loadYtVideos(true);
    initInfiniteScroll();
    loadFooter();
}

if (document.readyState === 'loading') {
    document.addEventListener(
        'DOMContentLoaded',
        initializeAppPage,
        { once: true }
    );
} else {
    initializeAppPage();
}
