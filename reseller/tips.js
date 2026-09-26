// Import Firebase SDKs (Modular) from CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Firebase Configuration (Standard Sera Product Config)
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
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM Elements
const authLoader = document.getElementById('auth-loader');
const mainApp = document.getElementById('main-app');
const footerContainer = document.getElementById('footer-container');

// Custom Popup function for alerts
function showCustomPopup(message) {
    alert(message);
}

// Authentication & Verification state listener (Executed ONCE as required)
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        // User not logged in, redirect to login
        window.location.replace("https://seraproduct.com/reseller/login");
        return;
    }

    try {
        // Read ONLY the current reseller document (No collection query)
        const resellerRef = doc(db, "reseller", user.uid);
        const resellerSnap = await getDoc(resellerRef);

        if (!resellerSnap.exists()) {
            showCustomPopup("আপনার রিসেলার তথ্য পাওয়া যায়নি!");
            await auth.signOut();
            window.location.replace("https://seraproduct.com/reseller/login");
            return;
        }

        const resellerData = resellerSnap.data();

        // Active & Verified Checks
        if (resellerData.active !== true) {
            authLoader.innerHTML = `
                <div style="text-align: center; padding: 20px; max-width: 400px;">
                    <h3 style="color: #c2410c; margin-bottom: 12px; font-size: 20px;">অ্যাকাউন্ট নিষ্ক্রিয়</h3>
                    <p style="color: #4b5563; margin-bottom: 20px; font-size: 15px;">আপনার রিসেলার অ্যাকাউন্ট বর্তমানে এক্টিভ নয়।</p>
                    <a href="https://seraproduct.com/reseller/login" style="background-color: #ff6a00; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600;">লগইন পেজে যান</a>
                </div>
            `;
            return;
        }

        if (resellerData.verified !== true) {
            authLoader.innerHTML = `
                <div style="text-align: center; padding: 20px; max-width: 400px;">
                    <h3 style="color: #c2410c; margin-bottom: 12px; font-size: 20px;">অ্যাকাউন্ট ভেরিফাইড নয়</h3>
                    <p style="color: #4b5563; margin-bottom: 20px; font-size: 15px;">আপনার রিসেলার অ্যাকাউন্ট এখনো ভেরিফাইড হয়নি।</p>
                    <a href="https://seraproduct.com/reseller/dashboard" style="background-color: #ff6a00; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600;">ড্যাশবোর্ডে ফিরে যান</a>
                </div>
            `;
            return;
        }

        // Verification successful, display main app
        authLoader.style.display = 'none';
        mainApp.style.display = 'flex';

        // Load Footer dynamically from https://seraproduct.com/footer
        loadFooter();

    } catch (error) {
        console.error("Verification error:", error);
        showCustomPopup("যাচাইকরণে সমস্যা হয়েছে। পুনরায় চেষ্টা করুন।");
        window.location.replace("https://seraproduct.com/reseller/login");
    }
});

// Fetch Footer function
async function loadFooter() {
    try {
        const response = await fetch("https://seraproduct.com/footer");
        if (response.ok) {
            const footerHtml = await response.text();
            footerContainer.innerHTML = footerHtml;
        } else {
            footerContainer.innerHTML = `
                <footer style="background-color: #222; color: #fff; padding: 24px; text-align: center; font-size: 14px; margin-top: auto;">
                    <p>&copy; 2026 Sera Product. All rights reserved.</p>
                </footer>
            `;
        }
    } catch (err) {
        console.error("Failed to load footer:", err);
        footerContainer.innerHTML = `
            <footer style="background-color: #222; color: #fff; padding: 24px; text-align: center; font-size: 14px; margin-top: auto;">
                <p>&copy; 2026 Sera Product. All rights reserved.</p>
            </footer>
        `;
    }
}
