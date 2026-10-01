document.addEventListener('DOMContentLoaded', () => {

    // 1. Loading Screen Controller
    const loadingScreen = document.getElementById('loading-screen');
    const hideLoading = () => {
        if (loadingScreen) {
            loadingScreen.classList.add('fade-out');
            setTimeout(() => {
                loadingScreen.style.display = 'none';
                loadingScreen.setAttribute('aria-hidden', 'true');
            }, 500);
        }
    };

    // Hide loader when window loads completely, with fallback timeout
    if (document.readyState === 'complete') {
        hideLoading();
    } else {
        window.addEventListener('load', hideLoading);
        // Fallback safety timeout (3s)
        setTimeout(hideLoading, 3000);
    }

    // 2. Dynamic Footer Fetch
    const footerContainer = document.getElementById('dynamic-footer');
    if (footerContainer) {
        fetch("https://seraproduct.com/footer")
            .then(response => {
                if (!response.ok) {
                    throw new Error('Footer fetch response not ok');
                }
                return response.text();
            })
            .then(htmlData => {
                footerContainer.innerHTML = htmlData;
            })
            .catch(error => {
                console.warn('Footer fetch failed, using fallback footer.', error);
                // Fallback remains visible
            });
    }

    // 3. Expandable Section Cards System
    const toggleButtons = document.querySelectorAll('.toggle-btn');

    toggleButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const isExpanded = btn.getAttribute('aria-expanded') === 'true';
            const targetId = btn.getAttribute('aria-controls');
            const targetContent = document.getElementById(targetId);
            const btnText = btn.querySelector('.btn-text');

            if (!targetContent) return;

            if (isExpanded) {
                // Close Content
                btn.setAttribute('aria-expanded', 'false');
                targetContent.classList.remove('open');
                setTimeout(() => {
                    targetContent.setAttribute('hidden', '');
                }, 400); // match transition length
                if (btnText) btnText.textContent = 'বিস্তারিত দেখুন';
            } else {
                // Open Content
                targetContent.removeAttribute('hidden');
                // Force reflow for CSS grid transition
                void targetContent.offsetHeight;
                targetContent.classList.add('open');
                btn.setAttribute('aria-expanded', 'true');
                if (btnText) btnText.textContent = 'বিস্তারিত বন্ধ করুন';
            }
        });
    });

    // 4. FAQ Accordion System
    const faqTriggers = document.querySelectorAll('.faq-trigger');

    faqTriggers.forEach(trigger => {
        trigger.addEventListener('click', () => {
            const isExpanded = trigger.getAttribute('aria-expanded') === 'true';
            const targetId = trigger.getAttribute('aria-controls');
            const targetAnswer = document.getElementById(targetId);

            if (!targetAnswer) return;

            if (isExpanded) {
                trigger.setAttribute('aria-expanded', 'false');
                targetAnswer.classList.remove('open');
                setTimeout(() => {
                    targetAnswer.setAttribute('hidden', '');
                }, 400);
            } else {
                targetAnswer.removeAttribute('hidden');
                void targetAnswer.offsetHeight;
                targetAnswer.classList.add('open');
                trigger.setAttribute('aria-expanded', 'true');
            }
        });
    });

    // 5. Scroll Reveal Animations via IntersectionObserver
    const revealElements = document.querySelectorAll('.reveal-section');

    if ('IntersectionObserver' in window) {
        const observerOptions = {
            root: null,
            rootMargin: '0px 0px -50px 0px',
            threshold: 0.05
        };

        const observer = new IntersectionObserver((entries, obs) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    obs.unobserve(entry.target); // Animates once
                }
            });
        }, observerOptions);

        revealElements.forEach(el => observer.observe(el));
    } else {
        // Fallback for old browsers
        revealElements.forEach(el => el.classList.add('visible'));
    }

    // 6. Smooth Scroll with offsetting header height
    document.querySelectorAll('.toc-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);

            if (targetElement) {
                const headerOffset = 80;
                const elementPosition = targetElement.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
});
