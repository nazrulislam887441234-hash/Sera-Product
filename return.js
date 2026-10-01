document.addEventListener('DOMContentLoaded', () => {

    /* ==========================================================================
       1. Loading Screen Controller
       ========================================================================== */
    const loadingScreen = document.getElementById('loading-screen');
    
    const hideLoading = () => {
        if (loadingScreen && !loadingScreen.classList.contains('fade-out')) {
            loadingScreen.classList.add('fade-out');
            setTimeout(() => {
                loadingScreen.style.display = 'none';
            }, 400);
        }
    };

    // Hide loader on full load or fallback timeout
    window.addEventListener('load', hideLoading);
    setTimeout(hideLoading, 1500);

    /* ==========================================================================
       2. Footer Async Fetching
       ========================================================================== */
    const footerPlaceholder = document.getElementById('footer-placeholder');

    fetch('https://seraproduct.com/footer')
        .then(response => {
            if (!response.ok) {
                throw new Error('Footer network response was not ok');
            }
            return response.text();
        })
        .then(html => {
            if (footerPlaceholder) {
                footerPlaceholder.innerHTML = html;
            }
        })
        .catch(() => {
            // Silently fail without breaking page layout
            if (footerPlaceholder) {
                footerPlaceholder.style.display = 'none';
            }
        });

    /* ==========================================================================
       3. Accordion Handler (Expand / Collapse)
       ========================================================================== */
    const accordionHeaders = document.querySelectorAll('.accordion-header');

    accordionHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const item = header.parentElement;
            const content = header.nextElementSibling;
            const triggerText = header.querySelector('.trigger-text');
            const isExpanded = header.getAttribute('aria-expanded') === 'true';

            if (isExpanded) {
                // Collapse accordion
                header.setAttribute('aria-expanded', 'false');
                item.classList.remove('is-open');
                content.style.maxHeight = null;
                
                if (triggerText) {
                    triggerText.textContent = 'বিস্তারিত দেখুন';
                }

                setTimeout(() => {
                    if (header.getAttribute('aria-expanded') === 'false') {
                        content.hidden = true;
                    }
                }, 350);

            } else {
                // Expand accordion
                content.hidden = false;
                header.setAttribute('aria-expanded', 'true');
                item.classList.add('is-open');
                content.style.maxHeight = content.scrollHeight + "px";

                if (triggerText) {
                    triggerText.textContent = 'বিস্তারিত বন্ধ করুন';
                }
            }
        });
    });

    /* ==========================================================================
       4. Scroll Reveal Animations (IntersectionObserver)
       ========================================================================== */
    const revealElements = document.querySelectorAll('.reveal-on-scroll');

    if ('IntersectionObserver' in window) {
        const observerOptions = {
            root: null,
            rootMargin: '0px 0px -40px 0px',
            threshold: 0.1
        };

        const revealObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                }
            });
        }, observerOptions);

        revealElements.forEach(el => revealObserver.observe(el));
    } else {
        // Fallback for older browsers
        revealElements.forEach(el => el.classList.add('is-visible'));
    }

});
