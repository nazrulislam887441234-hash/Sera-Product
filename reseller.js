document.addEventListener('DOMContentLoaded', () => {
    // 1. Mobile Navigation Toggle
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const mobileNavDrawer = document.getElementById('mobileNavDrawer');

    if (hamburgerBtn && mobileNavDrawer) {
        hamburgerBtn.addEventListener('click', () => {
            const isOpen = mobileNavDrawer.classList.toggle('open');
            hamburgerBtn.setAttribute('aria-expanded', isOpen);
            mobileNavDrawer.setAttribute('aria-hidden', !isOpen);
        });

        // Close drawer when clicking outside
        document.addEventListener('click', (e) => {
            if (!hamburgerBtn.contains(e.target) && !mobileNavDrawer.contains(e.target)) {
                mobileNavDrawer.classList.remove('open');
                hamburgerBtn.setAttribute('aria-expanded', 'false');
                mobileNavDrawer.setAttribute('aria-hidden', 'true');
            }
        });
    }

    // 2. FAQ Accordion
    const faqQuestions = document.querySelectorAll('.faq-question');

    faqQuestions.forEach((question) => {
        question.addEventListener('click', () => {
            const currentItem = question.parentElement;
            const isActive = currentItem.classList.contains('active');

            // Close all items
            document.querySelectorAll('.faq-item').forEach((item) => {
                item.classList.remove('active');
                const btn = item.querySelector('.faq-question');
                if (btn) btn.setAttribute('aria-expanded', 'false');
            });

            // Toggle clicked item
            if (!isActive) {
                currentItem.classList.add('active');
                question.setAttribute('aria-expanded', 'true');
            }
        });
    });

    // 3. Footer Dynamic Fetch
    const footerContainer = document.getElementById('footer-container');

    if (footerContainer) {
        fetch('https://seraproduct.com/footer')
            .then((response) => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.text();
            })
            .then((html) => {
                footerContainer.innerHTML = html;
            })
            .catch((error) => {
                console.error('Footer fetch error:', error);
                footerContainer.innerHTML = '<div class="footer-error">ফুটার লোড করা যায়নি।</div>';
            });
    }
});
