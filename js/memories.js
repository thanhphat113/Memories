let pageFlipInstance = null;
let memoriesData = [];
let allPhotoItems = [];
let currentFullImageList = [];
let currentOpenBookIndex = null;
let currentMobilePageIndex = 0;

// Chia mảng ảnh thành các lô nhỏ (mỗi lô tối đa ~750KB) để không bao giờ vượt giới hạn 1MB của Firestore
function chunkImagesByByteSize(images, maxBytesPerChunk = 750000) {
    const chunks = [];
    let currentChunk = [];
    let currentSize = 0;

    for (const img of images) {
        const imgSize = new Blob([img]).size + 10;
        if (currentChunk.length > 0 && (currentSize + imgSize) > maxBytesPerChunk) {
            chunks.push(currentChunk);
            currentChunk = [img];
            currentSize = imgSize;
        } else {
            currentChunk.push(img);
            currentSize += imgSize;
        }
    }
    if (currentChunk.length > 0) {
        chunks.push(currentChunk);
    }
    return chunks;
}

async function fetchMemoriesFromFirebase() {
    const grid = document.getElementById('books-grid');
    if (!db) {
        grid.innerHTML = '<div class="col-span-full text-center text-yellow-600 py-8">Vui lòng cấu hình <b>CONFIG.firebase</b> để xem albums.</div>';
        return;
    }

    try {
        const [albumsSnap, photosSnap] = await Promise.all([
            db.collection("albums").orderBy("timestamp", "desc").get(),
            db.collection("album_photos").orderBy("timestamp", "asc").get()
        ]);

        if (albumsSnap.empty) {
            memoriesData = [];
            grid.innerHTML = '<p class="col-span-full text-center text-gray-400 py-8">Chưa có album kỷ niệm nào. Bấm "Tạo Album Mới" nhé!</p>';
            return;
        }

        const photosByAlbumId = {};
        photosSnap.docs.forEach(doc => {
            const data = doc.data();
            if (!data.albumId) return;
            if (!photosByAlbumId[data.albumId]) {
                photosByAlbumId[data.albumId] = [];
            }
            if (Array.isArray(data.images)) {
                photosByAlbumId[data.albumId].push(...data.images);
            }
        });

        memoriesData = albumsSnap.docs.map(doc => {
            const data = doc.data();
            const legacyImages = Array.isArray(data.images) ? data.images : [];
            const chunkedImages = photosByAlbumId[doc.id] || [];
            const combinedImages = [...legacyImages, ...chunkedImages];

            return {
                id: doc.id,
                title: data.title || 'Kỷ niệm',
                coverImage: data.coverImage || combinedImages[0] || '',
                images: combinedImages,
                timestamp: data.timestamp
            };
        });

        grid.innerHTML = memoriesData.map((book, idx) => `
            <div onclick="openBook(${idx})"
                class="glass-card bg-white p-5 rounded-2xl shadow-md cursor-pointer hover:shadow-xl transition transform hover:-translate-y-1 text-center relative group">

                <div class="book-card-actions">
                    <button class="book-action-btn add-photo-btn" title="Thêm ảnh vào album" onclick="event.stopPropagation(); showAddPhotosModal(${idx})">
                        <i class="fa-solid fa-plus"></i>
                    </button>
                    <button class="book-action-btn delete-book-btn" title="Xóa album" onclick="event.stopPropagation(); deleteBook('${book.id}')">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>

                <div class="w-full h-48 bg-pink-50 rounded-xl mb-3 flex items-center justify-center overflow-hidden border border-pink-100">
                    ${book.coverImage
                        ? `<img src="${book.coverImage}" class="w-full h-full object-cover">`
                        : '<i class="fa-solid fa-book-bookmark text-4xl text-pink-300"></i>'
                    }
                </div>

                <h4 class="font-sweet text-2xl font-bold text-gray-700">${escapeHtml(book.title)}</h4>
                <span class="text-xs text-pink-400 font-semibold">${book.images ? book.images.length : 0} khoảnh khắc</span>
            </div>
        `).join('');
    } catch (error) {
        console.error("Fetch memories error:", error);
        grid.innerHTML = `<div class="col-span-full text-center text-red-500 py-8">Lỗi tải albums: ${escapeHtml(error.message)}</div>`;
    }
}

// --- HỆ THỐNG POPUP PIN BẤT ĐỒNG BỘ ---
let pinResolveCallback = null;

function showPinPrompt(title = "Nhập Mã PIN", desc = "Vui lòng nhập mã bảo mật để tiếp tục") {
    return new Promise((resolve) => {
        pinResolveCallback = resolve;
        document.getElementById('pin-prompt-title').innerText = title;
        document.getElementById('pin-prompt-desc').innerText = desc;
        document.getElementById('pin-input-field').value = '';
        
        const modal = document.getElementById('modal-pin-prompt');
        const box = document.getElementById('pin-prompt-box');
        
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        setTimeout(() => {
            box.classList.remove('scale-95', 'opacity-0');
            box.classList.add('scale-100', 'opacity-100');
            document.getElementById('pin-input-field').focus();
        }, 10);
    });
}

function closePinPrompt(isConfirmed) {
    const modal = document.getElementById('modal-pin-prompt');
    const box = document.getElementById('pin-prompt-box');
    
    box.classList.remove('scale-100', 'opacity-100');
    box.classList.add('scale-95', 'opacity-0');
    
    setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        if (pinResolveCallback) {
            const val = isConfirmed ? document.getElementById('pin-input-field').value : null;
            pinResolveCallback(val);
            pinResolveCallback = null;
        }
    }, 200);
}

function submitPinPrompt(e) {
    e.preventDefault();
    closePinPrompt(true);
}

async function deleteBook(bookId) {
    const pin = await showPinPrompt("Xác Nhận Xóa Album", "Nhập mã PIN để xóa vĩnh viễn album này:");
    if (pin === null) return;
    if (pin !== CONFIG.pinCode) {
        alert("Mã PIN không chính xác!");
        return;
    }

    const confirmed = confirm("Bạn có chắc chắn muốn xóa album này không?\n\nToàn bộ hình ảnh và dữ liệu sẽ bị xóa vĩnh viễn!");
    if (!confirmed) return;

    try {
        const childPhotosSnap = await db.collection("album_photos").where("albumId", "==", bookId).get();
        const deletePromises = childPhotosSnap.docs.map(doc => doc.ref.delete());
        await Promise.all(deletePromises);

        await db.collection("albums").doc(bookId).delete();
        await fetchMemoriesFromFirebase();
        alert("Đã xóa album thành công!");
    } catch (error) {
        console.error("Delete album error:", error);
        alert("Không thể xóa album: " + error.message);
    }
}

async function showCreateBookModal() {
    const pin = await showPinPrompt("Tạo Album Mới", "Nhập mã PIN để tạo album kỷ niệm mới:");
    if (pin === CONFIG.pinCode) {
        document.getElementById('modal-create-book').classList.remove('hidden');
        document.getElementById('modal-create-book').classList.add('flex');
    } else if (pin !== null) {
        alert("Mã PIN không chính xác!");
    }
}

async function showAddPhotosModal(index = currentOpenBookIndex) {
    if (index === null || index === undefined || !memoriesData[index]) return;

    const pin = await showPinPrompt("Thêm Ảnh Vào Album", "Nhập mã PIN để tiếp tục thêm khoảnh khắc:");
    if (pin !== CONFIG.pinCode) {
        if (pin !== null) alert("Mã PIN không chính xác!");
        return;
    }

    currentOpenBookIndex = index;
    const book = memoriesData[index];
    const currentImages = book.images || [];

    document.getElementById('add-photos-book-name').innerText = `Album: "${book.title}" (Hiện có ${currentImages.length} ảnh)`;
    document.getElementById('add-photos-capacity-note').innerText = `Hệ thống hỗ trợ thêm số lượng ảnh không giới hạn.`;
    document.getElementById('add-book-images-input').value = '';

    const modal = document.getElementById('modal-add-photos');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeCreateBookModal() {
    document.getElementById('modal-create-book').classList.add('hidden');
    document.getElementById('modal-create-book').classList.remove('flex');
}

async function handleCreateBook(e) {
    e.preventDefault();
    if (!db) return;

    const title = document.getElementById('book-title-input').value;
    const files = document.getElementById('book-images-input').files;
    const status = document.getElementById('upload-status');
    const btn = document.getElementById('btn-submit-book');

    if (files.length === 0) return;
    status.classList.remove('hidden');
    btn.disabled = true;

    const imageUrls = [];

    try {
        for (let i = 0; i < files.length; i++) {
            status.innerText = `Đang nén và xử lý ảnh ${i + 1}/${files.length}...`;
            const compressedBase64 = await compressImage(files[i]);
            imageUrls.push(compressedBase64);
        }

        status.innerText = "Đang khởi tạo album...";
        const albumRef = await db.collection("albums").add({
            title,
            coverImage: imageUrls[0] || '',
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        const chunks = chunkImagesByByteSize(imageUrls);
        for (let c = 0; c < chunks.length; c++) {
            status.innerText = `Đang lưu phần ${c + 1}/${chunks.length} lên Firebase...`;
            await db.collection("album_photos").add({
                albumId: albumRef.id,
                images: chunks[c],
                batchIndex: c,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
        }

        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        closeCreateBookModal();
        document.getElementById('book-title-input').value = '';
        document.getElementById('book-images-input').value = '';
        await fetchMemoriesFromFirebase();
    } catch (err) {
        alert("Lỗi: " + err.message);
    } finally {
        status.classList.add('hidden');
        btn.disabled = false;
    }
}

function closeAddPhotosModal() {
    const modal = document.getElementById('modal-add-photos');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

async function handleAddPhotosToBook(e) {
    e.preventDefault();
    if (!db || currentOpenBookIndex === null || !memoriesData[currentOpenBookIndex]) return;

    const book = memoriesData[currentOpenBookIndex];
    const files = document.getElementById('add-book-images-input').files;
    const status = document.getElementById('add-upload-status');
    const btn = document.getElementById('btn-submit-add-photos');

    if (files.length === 0) return;
    status.classList.remove('hidden');
    btn.disabled = true;

    const newImages = [];

    try {
        for (let i = 0; i < files.length; i++) {
            status.innerText = `Đang nén và xử lý ảnh ${i + 1}/${files.length}...`;
            const compressedBase64 = await compressImage(files[i]);
            newImages.push(compressedBase64);
        }

        const chunks = chunkImagesByByteSize(newImages);
        for (let c = 0; c < chunks.length; c++) {
            status.innerText = `Đang lưu phần ${c + 1}/${chunks.length} vào album...`;
            await db.collection("album_photos").add({
                albumId: book.id,
                images: chunks[c],
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
        }

        if (!book.coverImage && newImages[0]) {
            await db.collection("albums").doc(book.id).update({
                coverImage: newImages[0]
            });
        }

        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        closeAddPhotosModal();
        document.getElementById('add-book-images-input').value = '';

        await fetchMemoriesFromFirebase();

        const flipbookModal = document.getElementById('modal-flipbook');
        if (flipbookModal && !flipbookModal.classList.contains('hidden')) {
            const targetIdx = memoriesData.findIndex(b => b.id === book.id);
            if (targetIdx !== -1) {
                openBook(targetIdx);
            }
        }
    } catch (err) {
        console.error("Add photos error:", err);
        alert("Lỗi khi thêm ảnh: " + err.message);
    } finally {
        status.classList.add('hidden');
        btn.disabled = false;
    }
}

// MỞ ALBUM: TỰ ĐỘNG THÊM/XÓA CLASS SINGLE-MODE TUỲ THEO 1 HAY 2 TRANG
function openBook(index) {
    const book = memoriesData[index];
    if (!book || !book.images?.length) return;

    closeFlipbook();
    currentOpenBookIndex = index;
    currentMobilePageIndex = 0;
    document.getElementById('book-modal-title').innerText = book.title;

    const bookContainer = document.getElementById('book-container');
    if (!bookContainer) return;

    const container = document.createElement('div');
    container.id = 'flipbook';
    bookContainer.appendChild(container);

    const isSmallScreen = window.innerWidth < 950;

    const modal = document.getElementById('modal-flipbook');
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    if (isSmallScreen) {
        bookContainer.classList.add('single-mode'); // Chế độ 1 trang: Ẩn gáy sách
        renderMobileSlider(book.images);
    } else {
        bookContainer.classList.remove('single-mode'); // Chế độ 2 trang: Giữ gáy sách
        let images = [...book.images];
        if (images.length % 2 !== 0) images.push(null);

        container.innerHTML = images.map(img => {
            if (!img) return `<div class="page blank-page"></div>`;
            return `<div class="page"><img src="${img}" alt="Memory"></div>`;
        }).join('');

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                try {
                    if (!window.St || !St.PageFlip) throw new Error('Không tải được thư viện PageFlip!');

                    pageFlipInstance = new St.PageFlip(container, {
                        width: 450,
                        height: 620,
                        size: "stretch",
                        minWidth: 250,
                        maxWidth: 600,
                        minHeight: 350,
                        maxHeight: 850,
                        maxShadowOpacity: 0.4,
                        flippingTime: 700,
                        showCover: false,
                        usePortrait: false,
                        mobileScrollSupport: false,
                        startPage: 0
                    });

                    pageFlipInstance.loadFromHTML(container.querySelectorAll('.page'));
                } catch (err) {
                    console.error('Lỗi khởi tạo album:', err);
                    alert('Không thể mở album: ' + err.message);
                }
            });
        });
    }
}

// Render slider từng tấm ảnh đơn
function renderMobileSlider(images) {
    const container = document.getElementById('flipbook');
    if (!container) return;
    
    container.className = "mobile-single-slider";
    container.innerHTML = `
        <div class="mobile-slide-card">
            <img id="mobile-current-img" src="${images[currentMobilePageIndex]}" alt="Memory">
            <span class="mobile-slide-counter">${currentMobilePageIndex + 1} / ${images.length}</span>
        </div>
    `;
}

function flipBookPrev() { 
    const isSmallScreen = window.innerWidth < 950;
    if (isSmallScreen) {
        if (!memoriesData[currentOpenBookIndex]) return;
        const images = memoriesData[currentOpenBookIndex].images;
        if (currentMobilePageIndex > 0) {
            currentMobilePageIndex--;
            renderMobileSlider(images);
        }
    } else {
        if (pageFlipInstance) pageFlipInstance.flipPrev(); 
    }
}

function flipBookNext() { 
    const isSmallScreen = window.innerWidth < 950;
    if (isSmallScreen) {
        if (!memoriesData[currentOpenBookIndex]) return;
        const images = memoriesData[currentOpenBookIndex].images;
        if (currentMobilePageIndex < images.length - 1) {
            currentMobilePageIndex++;
            renderMobileSlider(images);
        }
    } else {
        if (pageFlipInstance) pageFlipInstance.flipNext(); 
    }
}

function closeFlipbook() {
    const modal = document.getElementById('modal-flipbook');
    const bookContainer = document.getElementById('book-container');

    if (pageFlipInstance) {
        try { pageFlipInstance.destroy(); } catch (err) {}
        pageFlipInstance = null;
    }

    if (bookContainer) {
        bookContainer.innerHTML = '';
        bookContainer.classList.remove('single-mode');
    }
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

let lastWidth = window.innerWidth;
window.addEventListener('resize', () => {
    const currentWidth = window.innerWidth;
    // Chỉ kích hoạt khi thực sự vượt mốc 950px (chuyển đổi trạng thái 1 trang <-> 2 trang)
    if ((lastWidth >= 950 && currentWidth < 950) || (lastWidth < 950 && currentWidth >= 950)) {
        lastWidth = currentWidth;
        const modal = document.getElementById('modal-flipbook');
        if (modal && !modal.classList.contains('hidden') && currentOpenBookIndex !== null) {
            // Xóa sạch instance cũ để vẽ lại chế độ mới ngay lập tức
            if (pageFlipInstance) {
                try { pageFlipInstance.destroy(); } catch (err) {}
                pageFlipInstance = null;
            }
            const bookContainer = document.getElementById('book-container');
            if (bookContainer) bookContainer.innerHTML = '';
            
            openBook(currentOpenBookIndex);
        }
    }
});