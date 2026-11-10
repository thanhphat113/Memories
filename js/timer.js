function startLoveTimer() {
    const start = new Date(CONFIG.startDate).getTime();
    setInterval(() => {
        const now = new Date().getTime();
        const diff = now - start;
        document.getElementById('counter-days').innerText = String(Math.floor(diff / (1000 * 60 * 60 * 24))).padStart(2, '0');
        document.getElementById('counter-hours').innerText = String(Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))).padStart(2, '0');
        document.getElementById('counter-minutes').innerText = String(Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))).padStart(2, '0');
        document.getElementById('counter-seconds').innerText = String(Math.floor((diff % (1000 * 60)) / 1000)).padStart(2, '0');
    }, 1000);
}

function loadSettings() {
    if(!db) {
        document.getElementById('img-male').src = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80";
        document.getElementById('img-female').src = "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80";
        return;
    }

    db.collection("settings").doc("avatars").get().then(doc => {
        if(doc.exists) {
            const data = doc.data();
            document.getElementById('img-male').src = data.maleImg || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80";
            document.getElementById('img-female').src = data.femaleImg || "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80";
        } else {
            document.getElementById('img-male').src = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80";
            document.getElementById('img-female').src = "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80";
        }
    });
}

function promptChangeAvatar(target) {
    const pin = prompt("Nhập mã PIN bảo mật để đổi ảnh đại diện:");
    if(pin !== CONFIG.pinCode) {
        if(pin !== null) alert("Mã PIN không chính xác!");
        return;
    }

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.onchange = async e => {
        const file = e.target.files[0];
        if(!file || !db) return;

        alert("Đang xử lý và tối ưu ảnh đại diện...");
        try {
            const compressedBase64 = await compressImage(file, 400, 0.8);
            const docRef = db.collection("settings").doc("avatars");
            const updateData = {};
            updateData[target + 'Img'] = compressedBase64;
            await docRef.set(updateData, { merge: true });

            document.getElementById(`img-${target}`).src = compressedBase64;
            confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
            alert("Đổi ảnh đại diện thành công!");
        } catch(err) {
            alert("Lỗi: " + err.message);
        }
    };
    fileInput.click();
}