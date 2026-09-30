document.addEventListener('DOMContentLoaded', () => {

  // ------------------------------------------------------------------
  // 1. Custom Loading Screen Fade-out
  // ------------------------------------------------------------------
  window.addEventListener('load', () => {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
      loadingScreen.classList.add('fade-out');
      setTimeout(() => {
        loadingScreen.style.display = 'none';
      }, 500);
    }
  });

  // ------------------------------------------------------------------
  // 2. Expandable Sections (Accordions for Information Cards)
  // ------------------------------------------------------------------
  const expandButtons = document.querySelectorAll('.expand-btn');

  expandButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('aria-controls');
      const targetContent = document.getElementById(targetId);
      const btnText = btn.querySelector('.btn-text');
      const isExpanded = btn.getAttribute('aria-expanded') === 'true';

      if (isExpanded) {
        // Collapse content
        targetContent.style.maxHeight = '0px';
        targetContent.classList.remove('expanded');
        btn.setAttribute('aria-expanded', 'false');
        targetContent.setAttribute('aria-hidden', 'true');

        // Restore original label text
        if (targetId === 'content-sera') btnText.textContent = 'আরও জানুন';
        else if (targetId === 'content-location') btnText.textContent = 'লোকেশন সম্পর্কে জানুন';
        else if (targetId === 'content-about') btnText.textContent = 'সম্পূর্ণ তথ্য দেখুন';
        else if (targetId === 'content-website') btnText.textContent = 'ওয়েবসাইট সম্পর্কে আরও জানুন';
        else if (targetId === 'content-dont-want') btnText.textContent = 'বিস্তারিত দেখুন';
        else if (targetId === 'content-updates') btnText.textContent = 'আপডেট নীতি দেখুন';
      } else {
        // Expand content
        targetContent.style.maxHeight = targetContent.scrollHeight + 'px';
        targetContent.classList.add('expanded');
        btn.setAttribute('aria-expanded', 'true');
        targetContent.setAttribute('aria-hidden', 'false');
        btnText.textContent = 'সংক্ষেপে দেখুন';
      }
    });
  });

  // ------------------------------------------------------------------
  // 3. FAQ Accordion Logic
  // ------------------------------------------------------------------
  const faqToggles = document.querySelectorAll('.faq-toggle');

  faqToggles.forEach(toggle => {
    toggle.addEventListener('click', () => {
      const answer = toggle.nextElementSibling;
      const isExpanded = toggle.getAttribute('aria-expanded') === 'true';

      if (isExpanded) {
        answer.style.maxHeight = '0px';
        toggle.setAttribute('aria-expanded', 'false');
      } else {
        answer.style.maxHeight = answer.scrollHeight + 'px';
        toggle.setAttribute('aria-expanded', 'true');
      }
    });
  });

  // ------------------------------------------------------------------
  // 4. Scroll Reveal Effect (IntersectionObserver)
  // ------------------------------------------------------------------
  const revealElements = document.querySelectorAll('.scroll-reveal');

  if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -40px 0px'
    });

    revealElements.forEach(el => revealObserver.observe(el));
  } else {
    // Fallback if IntersectionObserver is not supported
    revealElements.forEach(el => el.classList.add('visible'));
  }

  // ------------------------------------------------------------------
  // 5. Fetch and Render Footer from External Endpoint
  // ------------------------------------------------------------------
  const footerContainer = document.getElementById('footer-container');

  if (footerContainer) {
    fetch('https://seraproduct.com/footer')
      .then(response => {
        if (!response.ok) {
          throw new Error('Footer load failed');
        }
        return response.text();
      })
      .then(html => {
        footerContainer.innerHTML = html;
      })
      .catch(error => {
        console.error('Error fetching footer:', error);
        footerContainer.innerHTML = `
          <footer style="text-align:center; padding:20px; background:#ffffff; color:#6c757d; border-top:1px solid #e9ecef;">
            <p>&copy; ${new Date().getFullYear()} SERA PRODUCT. সর্বস্বত্ব সংরক্ষিত।</p>
          </footer>
        `;
      });
  }

});
