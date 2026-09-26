// Firebase Modular SDK imports (CDN-based)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, query, where, orderBy, limit, startAfter, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
const firebaseConfig = {
  apiKey: "AIzaSyBRSt2aoSJ-lumYAWGAXE6ncui7__TqJ4E",
  authDomain: "sera-product.firebaseapp.com",
  projectId: "sera-product",
  storageBucket: "sera-product.firebasestorage.app",
  messagingSenderId: "516762224598",
  appId: "1:516762224598:web:b6a571f355a8a4a97c0677",
  measurementId: "G-RLMWH43FXX"
};
// Firebase Initialize
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// State Variables
let currentUser = null;
let lastVisibleDoc = null;
let isLoading = false;
const TRANSACTIONS_PER_PAGE = 20;

// DOM Elements
const transactionContainer = document.getElementById("transaction-container");
const emptyState = document.getElementById("empty-state");
const errorState = document.getElementById("error-state");
const errorMessage = document.getElementById("error-message");
const loadMoreContainer = document.getElementById("load-more-container");
const loadMoreBtn = document.getElementById("load-more-btn");
const retryBtn = document.getElementById("retry-btn");
const logoutBtn = document.getElementById("logout-btn");
const resellerNameEl = document.getElementById("reseller-name");
const toast = document.getElementById("toast");

// App Initialization
document.addEventListener("DOMContentLoaded", () => {
    initApp();
});

function initApp() {
    handleAuthState();
    loadFooter();

    if (retryBtn) {
        retryBtn.addEventListener("click", () => {
            if (currentUser) {
                hideError();
                loadTransactions(currentUser);
            }
        });
    }

    if (loadMoreBtn) {
        loadMoreBtn.addEventListener("click", () => {
            if (currentUser && !isLoading) {
                loadMoreTransactions(currentUser);
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener("click", logoutUser);
    }
}

// 1. Authentication State Handler
function handleAuthState() {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            resellerNameEl.textContent = user.displayName || user.email || "রিসেলার";
            loadTransactions(user);
        } else {
            window.location.href = "https://seraproduct.com/reseller/login";
        }
    }, (error) => {
        console.error("Auth state error:", error);
        showError("লগইন স্ট্যাটাস যাচাই করতে সমস্যা হয়েছে।");
    });
}

// 2. Load Transactions (Initial)
async function loadTransactions(user) {
    showLoading();
    hideError();
    hideEmptyState();

    try {
        // Query with uid and descending sort by createdAt
        const q = query(
            collection(db, "transection"),
            where("uid", "==", user.uid),
            orderBy("createdAt", "desc"),
            limit(TRANSACTIONS_PER_PAGE)
        );

        const querySnapshot = await getDocs(q);
        
        transactionContainer.innerHTML = "";

        if (querySnapshot.empty) {
            showEmptyState();
            loadMoreContainer.classList.add("hidden");
            return;
        }

        lastVisibleDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
        
        let htmlContent = "";
        querySnapshot.forEach((doc) => {
            htmlContent += renderTransactionCard(doc.data(), doc.id);
        });

        transactionContainer.innerHTML = htmlContent;
        attachCopyListeners();

        // Check if more docs might exist
        if (querySnapshot.docs.length < TRANSACTIONS_PER_PAGE) {
            loadMoreContainer.classList.add("hidden");
        } else {
            loadMoreContainer.classList.remove("hidden");
        }

    } catch (error) {
        console.error("Error loading transactions:", error);
        // Fallback query without orderBy if index is missing
        if (error.code === 'failed-precondition' || error.message.includes('index')) {
            fallbackLoadWithoutOrder(user);
        } else {
            showError("ট্রাঞ্জেকশন লোড করতে সমস্যা হয়েছে। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।");
        }
    }
}

// Fallback query if composite index is not yet built
async function fallbackLoadWithoutOrder(user) {
    try {
        const q = query(
            collection(db, "transection"),
            where("uid", "==", user.uid),
            limit(TRANSACTIONS_PER_PAGE)
        );
        const querySnapshot = await getDocs(q);
        
        transactionContainer.innerHTML = "";
        if (querySnapshot.empty) {
            showEmptyState();
            loadMoreContainer.classList.add("hidden");
            return;
        }

        // Sort manually client-side by createdAt if available
        const docs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        docs.sort((a, b) => {
            const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (new Date(a.createdAt || 0)).getTime();
            const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (new Date(b.createdAt || 0)).getTime();
            return timeB - timeA;
        });

        lastVisibleDoc = querySnapshot.docs[querySnapshot.docs.length - 1];

        let htmlContent = "";
        docs.forEach((data) => {
            htmlContent += renderTransactionCard(data, data.id);
        });

        transactionContainer.innerHTML = htmlContent;
        attachCopyListeners();
        loadMoreContainer.classList.add("hidden"); // simplified for fallback

    } catch (err) {
        console.error("Fallback error:", err);
        showError("ট্রাঞ্জেকশন লোড করতে সমস্যা হয়েছে। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।");
    }
}

// 3. Load More Transactions (Pagination)
async function loadMoreTransactions(user) {
    if (!lastVisibleDoc || isLoading) return;
    isLoading = true;

    try {
        const q = query(
            collection(db, "transection"),
            where("uid", "==", user.uid),
            orderBy("createdAt", "desc"),
            startAfter(lastVisibleDoc),
            limit(TRANSACTIONS_PER_PAGE)
        );

        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            loadMoreContainer.classList.add("hidden");
            isLoading = false;
            return;
        }

        lastVisibleDoc = querySnapshot.docs[querySnapshot.docs.length - 1];

        let additionalHtml = "";
        querySnapshot.forEach((doc) => {
            additionalHtml += renderTransactionCard(doc.data(), doc.id);
        });

        transactionContainer.insertAdjacentHTML('beforeend', additionalHtml);
        attachCopyListeners();

        if (querySnapshot.docs.length < TRANSACTIONS_PER_PAGE) {
            loadMoreContainer.classList.add("hidden");
        }

    } catch (error) {
        console.error("Error loading more transactions:", error);
        showToast("আরও ট্রাঞ্জেকশন লোড করা যায়নি।");
    } finally {
        isLoading = false;
    }
}

// 4. Render Individual Transaction Card HTML
function renderTransactionCard(data, docId) {
    const oldBal = Number(data.oldBalance || 0);
    const currentBal = Number(data.balance || 0);
    const diff = Math.abs(currentBal - oldBal);
    
    let themeClass = "theme-neutral";
    let diffText = "ব্যালেন্স পরিবর্তন হয়নি";
    let typeIcon = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;

    if (currentBal < oldBal) {
        themeClass = "theme-red";
        diffText = `${formatBDT(diff)} কমেছে`;
        typeIcon = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>`;
    } else if (currentBal > oldBal) {
        themeClass = "theme-orange";
        diffText = `${formatBDT(diff)} বেড়েছে`;
        typeIcon = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>`;
    }

    const txnId = data.transectionId || docId || "N/A";
    const noteText = data.note ? `নোট: ${data.note}` : "কোনো নোট দেওয়া হয়নি";
    const formattedDate = formatDate(data.createdAt);
    const resellerName = data.name || currentUser?.displayName || "রিসেলার";

    return `
        <div class="txn-card ${themeClass}">
            <div class="txn-header">
                <div class="txn-user-info">
                    <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                    <span>${escapeHtml(resellerName)}</span>
                </div>
                ${formattedDate ? `<span class="txn-date">${formattedDate}</span>` : ''}
            </div>
            
            <div class="txn-body">
                <div class="txn-balances">
                    <div class="balance-item">
                        <span>আগে ছিল</span>
                        <strong>${formatBDT(oldBal)}</strong>
                    </div>
                    <div class="balance-item">
                        <span>লেনদেন করার পর</span>
                        <strong>${formatBDT(currentBal)}</strong>
                    </div>
                </div>
                
                <div class="txn-diff-badge">
                    ${typeIcon}
                    <span>${diffText}</span>
                </div>
            </div>

            <div class="txn-footer">
                <div class="txn-id-box">
                    <span>Transaction ID:</span>
                    <code>${escapeHtml(txnId)}</code>
                    <button class="copy-btn" data-copy="${escapeHtml(txnId)}" title="কপি করুন">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                    </button>
                </div>
                <div class="txn-note">
                    ${escapeHtml(noteText)}
                </div>
            </div>
        </div>
    `;
}

// 5. Utility: Format BDT currency in Bengali numerals
function formatBDT(value) {
    const num = Number(value || 0);
    const formattedNumber = num.toLocaleString("bn-BD");
    return "৳" + formattedNumber;
}

// 6. Utility: Format Date in Bengali
function formatDate(timestamp) {
    if (!timestamp) return "";
    let date;
    if (timestamp.toDate) {
        date = timestamp.toDate();
    } else if (timestamp.seconds) {
        date = new Date(timestamp.seconds * 1000);
    } else {
        date = new Date(timestamp);
    }

    if (isNaN(date.getTime())) return "";

    const options = {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    };

    return new Intl.DateTimeFormat('bn-BD', options).format(date);
}

// 7. Clipboard Copy Functionality
function attachCopyListeners() {
    const copyButtons = document.querySelectorAll(".copy-btn");
    copyButtons.forEach(btn => {
        btn.addEventListener("click", (e) => {
            const textToCopy = e.currentTarget.getAttribute("data-copy");
            navigator.clipboard.writeText(textToCopy).then(() => {
                showToast("ট্রাঞ্জেকশন আইডি কপি হয়েছে।");
            }).catch(err => {
                console.error("Failed to copy text: ", err);
            });
        });
    });
}

function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    setTimeout(() => {
        toast.classList.remove("show");
    }, 2500);
}

// 8. Load Footer Dynamically
async function loadFooter() {
    const footerContainer = document.getElementById("footer-container");
    try {
        const response = await fetch("https://seraproduct.com/footer");
        if (response.ok) {
            const htmlText = await response.text();
            footerContainer.innerHTML = htmlText;
        }
    } catch (error) {
        console.log("Footer dynamic load skipped or failed, using fallback footer.");
    }
}

// 9. UI State Helpers
function showLoading() {
    transactionContainer.innerHTML = `
        <div class="skeleton-card"><div class="skeleton-line shimmer"></div><div class="skeleton-line shimmer short"></div></div>
        <div class="skeleton-card"><div class="skeleton-line shimmer"></div><div class="skeleton-line shimmer short"></div></div>
        <div class="skeleton-card"><div class="skeleton-line shimmer"></div><div class="skeleton-line shimmer short"></div></div>
    `;
    loadMoreContainer.classList.add("hidden");
}

function showEmptyState() {
    emptyState.classList.remove("hidden");
    transactionContainer.innerHTML = "";
}

function hideEmptyState() {
    emptyState.classList.add("hidden");
}

function showError(msg) {
    errorMessage.textContent = msg;
    errorState.classList.remove("hidden");
    transactionContainer.innerHTML = "";
    loadMoreContainer.classList.add("hidden");
}

function hideError() {
    errorState.classList.add("hidden");
}

function logoutUser() {
    signOut(auth).then(() => {
        window.location.href = "https://seraproduct.com/reseller/login";
    }).catch((error) => {
        console.error("Logout error:", error);
    });
}

function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
