document.addEventListener("DOMContentLoaded", () => {
    // 1. Loading Screen Controller
    const loadingScreen = document.getElementById("loading-screen");
    
    // Hide loading screen smoothly when page resources are ready
    window.addEventListener("load", () => {
        setTimeout(() => {
            if (loadingScreen) {
                loadingScreen.classList.add("fade-out");
                setTimeout(() => {
                    loadingScreen.style.display = "none";
                }, 400);
            }
        }, 200);
    });

    // Fallback loading removal if 'load' event takes too long
    setTimeout(() => {
        if (loadingScreen && loadingScreen.style.display !== "none") {
            loadingScreen.classList.add("fade-out");
            setTimeout(() => {
                loadingScreen.style.display = "none";
            }, 400);
        }
    }, 3000);

    // 2. Main Accordion Logic
    const accordionCards = document.querySelectorAll(".accordion-card");

    accordionCards.forEach(card => {
        const toggleBtn = card.querySelector(".accordion-toggle");
        const toggleText = toggleBtn.querySelector(".toggle-text");
        const content = card.querySelector(".accordion-content");

        toggleBtn.addEventListener("click", () => {
            const isOpen = card.classList.contains("open");

            if (isOpen) {
                // Close
                card.classList.remove("open");
                toggleBtn.setAttribute("aria-expanded", "false");
                toggleText.textContent = "বিস্তারিত দেখুন";
                content.style.maxHeight = null;
                content.setAttribute("hidden", "true");
            } else {
                // Open
                card.classList.add("open");
                toggleBtn.setAttribute("aria-expanded", "true");
                toggleText.textContent = "বিস্তারিত বন্ধ করুন";
                content.removeAttribute("hidden");
                content.style.maxHeight = content.scrollHeight + "px";
            }
        });
    });

    // 3. FAQ Accordion Logic
    const faqCards = document.querySelectorAll(".faq-card");

    faqCards.forEach(card => {
        const toggleBtn = card.querySelector(".faq-toggle");
        const answer = card.querySelector(".faq-answer");

        toggleBtn.addEventListener("click", () => {
            const isOpen = card.classList.contains("open");

            if (isOpen) {
                card.classList.remove("open");
                toggleBtn.setAttribute("aria-expanded", "false");
                answer.style.maxHeight = null;
                answer.setAttribute("hidden", "true");
            } else {
                card.classList.add("open");
                toggleBtn.setAttribute("aria-expanded", "true");
                answer.removeAttribute("hidden");
                answer.style.maxHeight = answer.scrollHeight + "px";
            }
        });
    });

    // 4. Smooth Scroll for Table of Contents & Auto Expand Section
    const tocLinks = document.querySelectorAll(".toc-link");

    tocLinks.forEach(link => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            const targetId = link.getAttribute("href").substring(1);
            const targetElement = document.getElementById(targetId);

            if (targetElement) {
                // Smooth scroll to target
                targetElement.scrollIntoView({ behavior: "smooth", block: "start" });

                // If target is an accordion card and currently closed, open it
                if (targetElement.classList.contains("accordion-card") && !targetElement.classList.contains("open")) {
                    const toggleBtn = targetElement.querySelector(".accordion-toggle");
                    if (toggleBtn) {
                        toggleBtn.click();
                    }
                }
            }
        });
    });

    // 5. Dynamic Footer Fetching
    const footerContainer = document.getElementById("dynamic-footer");
    
    if (footerContainer) {
        fetch("https://seraproduct.com/footer")
            .then(response => {
                if (!response.ok) {
                    throw new Error("Footer load failed");
                }
                return response.text();
            })
            .then(data => {
                footerContainer.innerHTML = data;
            })
            .catch(error => {
                console.warn("Footer could not be dynamically loaded:", error);
                // Keep fallback footer intact
            });
    }

    // 6. Recalculate max-height on window resize for open accordions
    window.addEventListener("resize", () => {
        document.querySelectorAll(".accordion-card.open .accordion-content").forEach(content => {
            content.style.maxHeight = content.scrollHeight + "px";
        });
        document.querySelectorAll(".faq-card.open .faq-answer").forEach(answer => {
            answer.style.maxHeight = answer.scrollHeight + "px";
        });
    });
});
