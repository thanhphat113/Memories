// js/config.js
const CONFIG = {
    startDate: "2023-12-25T00:00:00",
    maleName: "Thanh Phát",
    femaleName: "Ngọc Quyên",
    pinCode: "1234",
    
    firebase: {
        apiKey: window.ENV?.FIREBASE_API_KEY || "YOUR_API_KEY",
        authDomain: window.ENV?.FIREBASE_AUTH_DOMAIN || "",
        projectId: window.ENV?.FIREBASE_PROJECT_ID || "",
        storageBucket: window.ENV?.FIREBASE_STORAGE_BUCKET || "",
        messagingSenderId: window.ENV?.FIREBASE_MESSAGING_SENDER_ID || "",
        appId: window.ENV?.FIREBASE_APP_ID || ""
    }
};

let db = null;
let storage = null;

try {
    if (CONFIG.firebase.apiKey && CONFIG.firebase.apiKey !== "YOUR_API_KEY") {
        firebase.initializeApp(CONFIG.firebase);
        db = firebase.firestore();
        storage = firebase.storage();
    }
} catch(e) { 
    console.error("Firebase err:", e); 
}

// Chuyển tab giao diện
function switchTab(tab) {
    ['home', 'memories', 'letters'].forEach(t => {
        document.getElementById(`page-${t}`).classList.add('hidden');
        document.getElementById(`tab-${t}`).classList.remove('bg-pink-100', 'text-pink-600');
    });
    document.getElementById(`page-${tab}`).classList.remove('hidden');
    document.getElementById(`tab-${tab}`).classList.add('bg-pink-100', 'text-pink-600');
}

// Nén ảnh client-side
const compressImage = (file, maxWidth = 800, quality = 0.7) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = event => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = error => reject(error);
        };
        reader.onerror = error => reject(error);
    });
};

// Escape HTML chống XSS
function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[char]);
}