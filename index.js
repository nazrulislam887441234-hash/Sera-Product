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

// Initialize Firebase
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
const loadMoreCategoryContainer = document.getElementById('loadMoreCategoryContainer');
const loadMoreCategoryBtn = document.getElementById('loadMoreCategoryBtn');

const productGrid = document.getElementById('productGrid');
const infiniteLoader = document.getElementById('infiniteLoader');

// YouTube section variables
const ytVideosGrid = document.getElementById('ytVideosGrid');
const loadMoreYtContainer = document.getElementById('loadMoreYtContainer');
const loadMoreYtBtn = document.getElementById('loadMoreYtBtn');
let ytLastVisible = null;

let categoryLastVisible = null;
let productLastVisible = null;
let isProductFetching = false;
let hasMoreProducts = true;
let bannerSlidesCount = 2; // Default 2 banners
let currentBannerIndex = 0;
let bannerInterval = null;

/* ==========================================
   MOBILE DRAWER TOGGLE
   ========================================== */
function toggleDrawer() {
    mobileDrawer.classList.toggle('active');
    drawerOverlay.classList.toggle('active');
}

mobileMenuToggle.addEventListener('click', toggleDrawer);
drawerClose.addEventListener('click', toggleDrawer);
drawerOverlay.addEventListener('click', toggleDrawer);

/* ==========================================
   FOOTER LOADER
   ========================================== */
async function loadFooter() {
    try {
        const response = await fetch('https://seraproduct.com/footer.html');
        if (response.ok) {
            const html = await response.text();
            document.getElementById('footerContainer').innerHTML = html;
        } else {
            console.warn('Footer could not be loaded.');
        }
    } catch (error) {
        console.error('Error loading footer:', error);
    }
}

/* ==========================================
   BANNER CAROUSEL & FIREBASE BANNERS
   ========================================== */
function initBannerCarousel() {
    const slides = bannerTrack.querySelectorAll('.banner-slide');
    bannerSlidesCount = slides.length;

    // Create dots
    bannerDots.innerHTML = '';
    for (let i = 0; i < bannerSlidesCount; i++) {
        const dot = document.createElement('div');
        dot.className = `banner-dot ${i === 0 ? 'active' : ''}`;
        dot.addEventListener('click', () => goToBanner(i));
        bannerDots.appendChild(dot);
    }

    startBannerAutoSlide();

    // Pause on interaction
    bannerTrack.addEventListener('mouseenter', stopBannerAutoSlide);
    bannerTrack.addEventListener('mouseleave', startBannerAutoSlide);
    bannerTrack.addEventListener('touchstart', stopBannerAutoSlide);
    bannerTrack.addEventListener('touchend', startBannerAutoSlide);
}

function goToBanner(index) {
    currentBannerIndex = index;
    bannerTrack.style.transform = `translateX(-${currentBannerIndex * 100}%)`;
    updateBannerDots();
}

function updateBannerDots() {
    const dots = bannerDots.querySelectorAll('.banner-dot');
    dots.forEach((dot, idx) => {
        dot.classList.toggle('active', idx === currentBannerIndex);
    });
}

function startBannerAutoSlide() {
    if (bannerInterval) clearInterval(bannerInterval);
    bannerInterval = setInterval(() => {
        currentBannerIndex++;
        if (currentBannerIndex >= bannerSlidesCount) {
            currentBannerIndex = 0; // Seamlessly loop back to the first banner without reversing direction
        }
        goToBanner(currentBannerIndex);
    }, 4000);
}

function stopBannerAutoSlide() {
    if (bannerInterval) clearInterval(bannerInterval);
}

async function loadFirebaseBanners() {
    try {
        const snapshot = await db.collection('home_banner')
            .orderBy('createdAt', 'desc') // Corrected field name from createAt to createdAt
            .limit(5)
            .get();

        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.bannerLink) {
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
                bannerTrack.appendChild(slide);
            }
        });

        // Re-init carousel with new slides
        initBannerCarousel();
    } catch (error) {
        console.error('Error loading Firebase banners:', error);
    }
}

/* ==========================================
   POPULAR CATEGORIES (Pagination & Firebase)
   ========================================== */
async function loadCategories(isInitial = true) {
    try {
        let query = db.collection('categories').orderBy('createdAt', 'desc').limit(10);
        if (!isInitial && categoryLastVisible) {
            query = query.startAfter(categoryLastVisible);
        }

        const snapshot = await query.get();
        if (isInitial) {
            categoryGrid.innerHTML = '';
        }

        if (snapshot.empty && isInitial) {
            categoryGrid.innerHTML = '<div style="grid-column: span 3; text-align: center; color: #777; padding: 20px;">কোনো ক্যাটাগরি পাওয়া যায়নি।</div>';
            loadMoreCategoryContainer.style.display = 'none';
            return;
        }

        categoryLastVisible = snapshot.docs[snapshot.docs.length - 1];

        snapshot.forEach(doc => {
            const cat = doc.data();
            const slug = cat.categorySlug || cat.categoryName.toLowerCase().replace(/\s+/g, '-');
            
            const card = document.createElement('div');
            card.className = 'category-card';
            card.addEventListener('click', () => {
                window.location.href = `https://seraproduct.com/category?${encodeURIComponent(slug)}`;
            });

            card.innerHTML = `
                <div class="category-img-wrap">
                    <img src="${cat.image || 'https://via.placeholder.com/70'}" alt="${cat.categoryName}" loading="lazy">
                </div>
                <div class="category-name">${cat.categoryName}</div>
            `;
            categoryGrid.appendChild(card);
        });

        if (snapshot.docs.length < 10) {
            loadMoreCategoryContainer.style.display = 'none';
        } else {
            loadMoreCategoryContainer.style.display = 'block';
        }
    } catch (error) {
        console.error('Error loading categories:', error);
        if (isInitial) {
            categoryGrid.innerHTML = `
                <div style="grid-column: span 3; text-align: center; padding: 20px;">
                    <p style="color: #e53935; margin-bottom: 10px;">দুঃখিত, তথ্য লোড করা সম্ভব হয়নি। আবার চেষ্টা করুন</p>
                    <button class="btn-load-more" onclick="loadCategories(true)">পুনরায় চেষ্টা করুন</button>
                </div>
            `;
        }
    }
}

loadMoreCategoryBtn.addEventListener('click', () => loadCategories(false));

/* ==========================================
   POPULAR PRODUCTS (Infinite Scroll & Firebase)
   ========================================== */
async function loadProducts(isInitial = true) {
    if (isProductFetching || !hasMoreProducts) return;
    isProductFetching = true;
    infiniteLoader.style.display = 'flex';

    try {
        let query = db.collection('products').orderBy('createdAt', 'desc').limit(20);
        if (!isInitial && productLastVisible) {
            query = query.startAfter(productLastVisible);
        }

        const snapshot = await query.get();
        if (isInitial) {
            productGrid.innerHTML = '';
        }

        if (snapshot.empty && isInitial) {
            productGrid.innerHTML = '<div style="grid-column: span 3; text-align: center; color: #777; padding: 20px;">কোনো পণ্য পাওয়া যায়নি।</div>';
            infiniteLoader.style.display = 'none';
            isProductFetching = false;
            return;
        }

        if (snapshot.empty) {
            hasMoreProducts = false;
            infiniteLoader.style.display = 'none';
            isProductFetching = false;
            return;
        }

        productLastVisible = snapshot.docs[snapshot.docs.length - 1];

        snapshot.forEach(doc => {
            const p = doc.data();
            const slug = p.productSlug || doc.id;
            const images = Array.isArray(p.image) ? p.image : [p.image];
            const currentImg = images[0] || 'https://via.placeholder.com/200';

            const oldPrice = p.customerOldPrice || p.customerPrice;
            const currentPrice = p.customerPrice || 0;
            let discountPercent = 0;
            let saving = 0;

            if (oldPrice > currentPrice) {
                discountPercent = Math.round(((oldPrice - currentPrice) / oldPrice) * 100);
                saving = oldPrice - currentPrice;
            }

            const card = document.createElement('div');
            card.className = 'product-card';
            card.addEventListener('click', () => {
                window.location.href = `https://seraproduct.com/product?${encodeURIComponent(slug)}`;
            });

            card.innerHTML = `
                <div class="product-img-wrap">
                    ${p.freeDelivery ? '<span class="badge-free-delivery">ফ্রি ডেলিভারি</span>' : ''}
                    ${discountPercent > 0 ? `<span class="badge-discount">${discountPercent}% OFF</span>` : ''}
                    <img src="${currentImg}" alt="${p.productName}" loading="lazy" class="prod-img">
                </div>
                <div class="product-info">
                    <div>
                        <h4 class="product-title">${p.productName}</h4>
                        <div class="product-price-box">
                            <span class="current-price">৳${currentPrice}</span>
                            ${oldPrice > currentPrice ? `<span class="old-price">৳${oldPrice}</span>` : ''}
                        </div>
                        ${saving > 0 ? `<div class="saving-text">সাশ্রয় ৳${saving}</div>` : ''}
                    </div>
                    <button class="btn-order" onclick="event.stopPropagation(); window.location.href='https://seraproduct.com/product?${encodeURIComponent(slug)}'">অর্ডার করুন</button>
                </div>
            `;

            productGrid.appendChild(card);

            // Auto image slider if multiple images
            if (images.length > 1) {
                let imgIdx = 0;
                const imgEl = card.querySelector('.prod-img');
                setInterval(() => {
                    imgIdx = (imgIdx + 1) % images.length;
                    imgEl.src = images[imgIdx];
                }, 3000);
            }
        });

        isProductFetching = false;
        infiniteLoader.style.display = 'none';

        if (snapshot.docs.length < 20) {
            hasMoreProducts = false;
        }
    } catch (error) {
        console.error('Error loading products:', error);
        isProductFetching = false;
        infiniteLoader.style.display = 'none';
        if (isInitial) {
            productGrid.innerHTML = `
                <div style="grid-column: span 3; text-align: center; padding: 20px;">
                    <p style="color: #e53935; margin-bottom: 10px;">দুঃখিত, তথ্য লোড করা সম্ভব হয়নি। আবার চেষ্টা করুন</p>
                    <button class="btn-load-more" onclick="loadProducts(true)">পুনরায় চেষ্টা করুন</button>
                </div>
            `;
        }
    }
}

/* ==========================================
   YOUTUBE CHANNEL VIDEOS (FROM 'videos' COLLECTION)
   ========================================== */
async function loadYtVideos(isInitial = true) {
    try {
        let query = db.collection('videos').orderBy('createdAt', 'desc').limit(10);
        if (!isInitial && ytLastVisible) {
            query = query.startAfter(ytLastVisible);
        }

        const snapshot = await query.get();
        if (isInitial) {
            ytVideosGrid.innerHTML = '';
        }

        if (snapshot.empty && isInitial) {
            ytVideosGrid.innerHTML = '<div style="grid-column: span 3; text-align: center; color: #777; padding: 20px;">কোনো ভিডিও পাওয়া যায়নি।</div>';
            loadMoreYtContainer.style.display = 'none';
            return;
        }

        if (snapshot.empty) {
            loadMoreYtContainer.style.display = 'none';
            return;
        }

        ytLastVisible = snapshot.docs[snapshot.docs.length - 1];

        snapshot.forEach(doc => {
            const v = doc.data();
            const card = document.createElement('div');
            card.className = 'yt-video-card';

            card.innerHTML = `
                <div class="yt-video-embed-wrap" onclick="playYtVideo(this, '${v.videoLink}')">
                    <img src="${v.thumbnail || 'https://via.placeholder.com/300x169'}" alt="${v.title || 'VIDEO'}" class="yt-thumb" loading="lazy">
                    <div class="yt-play-btn">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="#ff6a00"><path d="M8 5v14l11-7z"/></svg>
                    </div>
                </div>
                <div class="yt-video-info">
                    <h4 class="yt-video-title">${v.title || 'VIDEO'}</h4>
                </div>
            `;
            ytVideosGrid.appendChild(card);
        });

        if (snapshot.docs.length < 10) {
            loadMoreYtContainer.style.display = 'none';
        } else {
            loadMoreYtContainer.style.display = 'block';
        }
    } catch (error) {
        console.error('Error loading YouTube videos:', error);
        if (isInitial) {
            ytVideosGrid.innerHTML = '<div style="grid-column: span 3; text-align: center; color: #e53935; padding: 20px;">ভিডিও লোড করতে সমস্যা হয়েছে।</div>';
        }
    }
}

function playYtVideo(element, embedLink) {
    if (!embedLink) return;
    const iframe = document.createElement('iframe');
    iframe.setAttribute('src', `${embedLink}?autoplay=1`);
    iframe.setAttribute('title', 'YouTube video player');
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
    iframe.setAttribute('allowfullscreen', 'true');
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.position = 'absolute';
    iframe.style.top = '0';
    iframe.style.left = '0';
    
    element.innerHTML = '';
    element.appendChild(iframe);
}

loadMoreYtBtn.addEventListener('click', () => loadYtVideos(false));

/* ==========================================
   INFINITE SCROLL OBSERVER
   ========================================== */
function initInfiniteScroll() {
    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !isProductFetching && hasMoreProducts) {
            loadProducts(false);
        }
    }, { rootMargin: '200px' });

    observer.observe(infiniteLoader);
}

/* ==========================================
   INITIALIZE APP ON DOM LOAD
   ========================================== */
document.addEventListener('DOMContentLoaded', () => {
    initBannerCarousel();
    loadFirebaseBanners();
    loadCategories(true);
    loadProducts(true);
    loadYtVideos(true);
    initInfiniteScroll();
    loadFooter();
});
