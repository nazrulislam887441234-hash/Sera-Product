document.addEventListener('DOMContentLoaded', () => {

    /* ==========================================================================
       1. Loading Screen Controller
       ========================================================================== */
    const loadingScreen = document.getElementById('loading-screen');

    const hideLoading = () => {
        if (loadingScreen) {
            loadingScreen.classList.add('fade-out');
            setTimeout(() => {
                loadingScreen.style.display = 'none';
                loadingScreen.setAttribute('aria-hidden', 'true');
            }, 400);
        }
    };

    // Ensure screen hides smoothly when page loads fully
    if (document.readyState === 'complete') {
        hideLoading();
    } else {
        window.addEventListener('load', hideLoading);
        // Fallback safety timeout if image taking too long
        setTimeout(hideLoading, 3000);
    }

    /* ==========================================================================
       2. Dynamic Footer Fetching
       ========================================================================== */
    const footerContainer = document.getElementById('footer-container');

    fetch('https://seraproduct.com/footer')
        .then(response => {
            if (!response.ok) {
                throw new Error('Footer endpoint response was not ok');
            }
            return response.text();
        })
        .then(htmlContent => {
            if (footerContainer) {
                footerContainer.classList.remove('footer-placeholder');
                footerContainer.innerHTML = htmlContent;
            }
        })
        .catch(error => {
            console.error('Footer loading failed:', error);
            if (footerContainer) {
                footerContainer.innerHTML = `
                    <footer style="text-align: center; padding: 20px; background: #fff; border-top: 1px solid #e2e8f0; font-size: 0.9rem; color: #555;">
                        <p>&copy; 2026 SERA PRODUCT. সর্বস্বত্ব সংরক্ষিত।</p>
                    </footer>
                `;
            }
        });

    /* ==========================================================================
       3. Accordion / Expandable Cards Behavior
       ========================================================================== */
    const accordionHeaders = document.querySelectorAll('.accordion-header');

    accordionHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const isExpanded = header.getAttribute('aria-expanded') === 'true';
            const targetContentId = header.getAttribute('aria-controls');
            const targetContent = document.getElementById(targetContentId);

            if (!targetContent) return;

            if (isExpanded) {
                // Close accordion
                header.setAttribute('aria-expanded', 'false');
                targetContent.setAttribute('aria-hidden', 'true');
            } else {
                // Open accordion
                header.setAttribute('aria-expanded', 'true');
                targetContent.setAttribute('aria-hidden', 'false');
            }
        });
    });

    /* ==========================================================================
       4. IntersectionObserver for Reveal Animations
       ========================================================================== */
    const reveals = document.querySelectorAll('.reveal');

    if ('IntersectionObserver' in window) {
        const observerOptions = {
            root: null,
            threshold: 0.1,
            rootMargin: '0px 0px -40px 0px'
        };

        const revealObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('active');
                    observer.unobserve(entry.target);
                }
            });
        }, observerOptions);

        reveals.forEach(el => revealObserver.observe(el));
    } else {
        // Fallback for older browsers
        reveals.forEach(el => el.classList.add('active'));
    }

    /* ==========================================================================
       5. Smooth Scroll Offset Fix for Sticky Header
       ========================================================================== */
    const internalLinks = document.querySelectorAll('a[href^="#"]');

    internalLinks.forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;

            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                e.preventDefault();
                const headerOffset = 80;
                const elementPosition = targetElement.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });

                // Auto open accordion if link directs inside an accordion item
                if (targetElement.classList.contains('accordion-item')) {
                    const headerBtn = targetElement.querySelector('.accordion-header');
                    const contentDiv = targetElement.querySelector('.accordion-content');
                    if (headerBtn && contentDiv) {
                        headerBtn.setAttribute('aria-expanded', 'true');
                        contentDiv.setAttribute('aria-hidden', 'false');
                    }
                }
            }
        });
    });

});
