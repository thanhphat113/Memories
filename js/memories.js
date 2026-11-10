let pageFlipInstance = null;
let memoriesData = [];
let allPhotoItems = [];
let currentFullImageList = [];

function fetchMemoriesFromFirebase() {
    const grid = document.getElementById('books-grid');
    if(!db) {
        grid.innerHTML = '<div class="col-span-full text-center text-yellow-600 py-8">Vui lòng cấu hình <b>CONFIG.firebase</b> để xem sách kỷ niệm.</div>';
        return;
    }

    db.collection("albums").orderBy("timestamp", "desc").get().then(snapshot => {
        if(snapshot.empty) {
            grid.innerHTML = '<p class="col-span-full text-center text-gray-400 py-8">Chưa có cuốn sách kỷ niệm nào. Bấm "Tạo Sách Mới" nhé!</p>';
            return;
        }
        memoriesData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        grid.innerHTML = memoriesData.map((book, idx) => `
            <div onclick="openBook(${idx})"
                class="glass-card bg-white p-5 rounded-2xl shadow-md cursor-pointer hover:shadow-xl transition transform hover:-translate-y-1 text-center relative">

                <button class="delete-book-btn" title="Xóa sách" onclick="event.stopPropagation(); deleteBook('${book.id}')">
                    <i class="fa-solid fa-trash"></i>
                </button>

                <div class="w-full h-48 bg-pink-50 rounded-xl mb-3 flex items-center justify-center overflow-hidden border border-pink-100">
                    ${book.images && book.images[0]
                        ? `<img src="${book.images[0]}" class="w-full h-full object-cover">`
                        : '<i class="fa-solid fa-book-bookmark text-4xl text-pink-300"></i>'
                    }
                </div>

                <h4 class="font-sweet text-2xl font-bold text-gray-700">${book.title}</h4>
                <span class="text-xs text-pink-400 font-semibold">${book.images ? book.images.length : 0} khoảnh khắc</span>
            </div>
        `).join('');
    });
}

async function deleteBook(bookId) {
    const pin = prompt("Nhập mã PIN để xóa sách:");
    if (pin === null) return;
    if (pin !== CONFIG.pinCode) {
        alert("Mã PIN không chính xác!");
        return;
    }

    const confirmed = confirm("Bạn có chắc chắn muốn xóa cuốn sách này không?\n\nToàn bộ hình ảnh và dữ liệu của sách sẽ bị xóa vĩnh viễn!");
    if (!confirmed) return;

    try {
        await db.collection("albums").doc(bookId).delete();
        await fetchMemoriesFromFirebase();
        alert("Đã xóa sách thành công!");
    } catch (error) {
        console.error("Delete book error:", error);
        alert("Không thể xóa sách: " + error.message);
    }
}

function showCreateBookModal() {
    const pin = prompt("Nhập mã PIN để tạo sách mới:");
    if(pin === CONFIG.pinCode) {
        document.getElementById('modal-create-book').classList.remove('hidden');
        document.getElementById('modal-create-book').classList.add('flex');
    } else if(pin !== null) {
        alert("Mã PIN không chính xác!");
    }
}

function closeCreateBookModal() {
    document.getElementById('modal-create-book').classList.add('hidden');
    document.getElementById('modal-create-book').classList.remove('flex');
}

async function handleCreateBook(e) {
    e.preventDefault();
    if(!db) return;

    const title = document.getElementById('book-title-input').value;
    const files = document.getElementById('book-images-input').files;
    const status = document.getElementById('upload-status');
    const btn = document.getElementById('btn-submit-book');

    if(files.length === 0) return;
    status.classList.remove('hidden');
    btn.disabled = true;

    const imageUrls = [];

    try {
        for (let i = 0; i < files.length; i++) {
            status.innerText = `Đang nén và xử lý ảnh ${i+1}/${files.length}...`;
            const compressedBase64 = await compressImage(files[i]);
            imageUrls.push(compressedBase64);
        }

        await db.collection("albums").add({
            title,
            images: imageUrls,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        closeCreateBookModal();
        document.getElementById('book-title-input').value = '';
        document.getElementById('book-images-input').value = '';
        fetchMemoriesFromFirebase();
    } catch (err) {
        alert("Lỗi: " + err.message);
    } finally {
        status.classList.add('hidden');
        btn.disabled = false;
    }
}

function openBook(index) {
    const book = memoriesData[index];
    if (!book || !book.images?.length) return;

    closeFlipbook();
    document.getElementById('book-modal-title').innerText = book.title;

    const bookContainer = document.getElementById('book-container');
    if (!bookContainer) return;

    const container = document.createElement('div');
    container.id = 'flipbook';
    bookContainer.appendChild(container);

    let images = [...book.images];
    if (images.length % 2 !== 0) images.push(null);

    container.innerHTML = images.map(img => {
        if (!img) return `<div class="page blank-page"></div>`;
        return `<div class="page"><img src="${img}" alt="Memory"></div>`;
    }).join('');

    const modal = document.getElementById('modal-flipbook');
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            try {
                if (!window.St || !St.PageFlip) throw new Error('Không tải được thư viện PageFlip!');

                pageFlipInstance = new St.PageFlip(container, {
                    width: 400,
                    height: 520,
                    size: "fixed",
                    minWidth: 300,
                    maxWidth: 600,
                    minHeight: 390,
                    maxHeight: 700,
                    maxShadowOpacity: 0.4,
                    flippingTime: 800,
                    showCover: false,
                    usePortrait: false,
                    mobileScrollSupport: false,
                    startPage: 0
                });

                pageFlipInstance.loadFromHTML(container.querySelectorAll('.page'));
            } catch (err) {
                console.error('Lỗi khởi tạo sách:', err);
                alert('Không thể mở sách: ' + err.message);
            }
        });
    });
}

function flipBookPrev() { if (pageFlipInstance) pageFlipInstance.flipPrev(); }
function flipBookNext() { if (pageFlipInstance) pageFlipInstance.flipNext(); }

function closeFlipbook() {
    const modal = document.getElementById('modal-flipbook');
    const bookContainer = document.getElementById('book-container');

    if (pageFlipInstance) {
        try { pageFlipInstance.destroy(); } catch (err) { console.warn('PageFlip destroy warning:', err); }
        pageFlipInstance = null;
    }

    if (bookContainer) bookContainer.innerHTML = '';
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

function openAllPhotos() {
    const grid = document.getElementById('all-photos-grid');
    allPhotoItems = memoriesData.flatMap(book =>
        (book.images || []).map(img => ({ url: img, title: book.title }))
    );

    currentFullImageList = allPhotoItems.map(item => item.url);
    document.getElementById('all-photos-count').innerText = `${allPhotoItems.length} khoảnh khắc`;

    if (allPhotoItems.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full text-center text-gray-400 py-20">
                <i class="fa-solid fa-images text-5xl mb-4"></i>
                <p>Chưa có ảnh kỷ niệm nào.</p>
            </div>`;
    } else {
        grid.innerHTML = allPhotoItems.map((item, index) => `
            <div class="photo-item" onclick="openFullImage(${index})">
                <img src="${item.url}" loading="lazy" alt="Memory">
                <div class="photo-overlay">
                    <p class="font-semibold truncate">${escapeHtml(item.title)}</p>
                    <p class="opacity-70">Ảnh ${index + 1}</p>
                </div>
            </div>`).join('');
    }

    const modal = document.getElementById('modal-all-photos');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeAllPhotos() {
    const modal = document.getElementById('modal-all-photos');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}