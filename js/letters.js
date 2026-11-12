let currentMailboxTarget = 'male';
let lettersCache = new Map();

function openMailbox(target) {
    currentMailboxTarget = target;
    const modal = document.getElementById('modal-letters');

    modal.classList.remove('theme-male', 'theme-female');
    modal.classList.add(target === 'male' ? 'theme-male' : 'theme-female');

    const name = target === 'male' ? CONFIG.maleName : CONFIG.femaleName;
    document.getElementById('letters-modal-title').innerText = `Hòm Thư Của ${name}`;

    modal.classList.remove('hidden');
    modal.classList.add('flex');

    hideCreateLetterForm();
    fetchLetters();
}

function closeLettersModal() {
    document.getElementById('modal-letters').classList.add('hidden');
    document.getElementById('modal-letters').classList.remove('flex');
}

async function fetchLetters() {
    const listContainer = document.getElementById('letters-list');
    if (!listContainer || !db) return;

    listContainer.innerHTML = `<p class="text-center text-gray-400 py-6"><i class="fas fa-spinner fa-spin mr-2"></i>Đang tải thư...</p>`;

    try {
        const snapshot = await db.collection("letters")
            .where("target", "==", currentMailboxTarget)
            .orderBy("timestamp", "desc")
            .get();

        lettersCache.clear();

        if (snapshot.empty) {
            listContainer.innerHTML = `
                <div class="text-center py-10 text-gray-400">
                    <i class="fas fa-envelope-open text-4xl mb-3"></i>
                    <p>Chưa có bức thư nào trong hòm thư này.</p>
                </div>`;
            return;
        }

        snapshot.forEach(doc => lettersCache.set(doc.id, doc.data()));

        listContainer.innerHTML = snapshot.docs.map(doc => {
            const data = doc.data();
            return `
                <div class="letter-card" data-letter-id="${escapeHtml(doc.id)}">
                    <div class="letter-card-header">
                        <div style="min-width:0; flex:1;" onclick="openLetterReader('${escapeHtml(doc.id)}')">
                            <div class="letter-card-title">${escapeHtml(data.title || 'Một lá thư')}</div>
                            <div class="letter-card-subtitle">${escapeHtml(data.subtitle || '')}</div>
                        </div>
                        <button class="letter-delete-btn" type="button" title="Xóa thư" aria-label="Xóa thư" onclick="deleteLetter(event, '${escapeHtml(doc.id)}')">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                    <div class="letter-card-preview" onclick="openLetterReader('${escapeHtml(doc.id)}')">
                        ${escapeHtml(data.content || '')}
                    </div>
                    <div class="letter-card-footer" onclick="openLetterReader('${escapeHtml(doc.id)}')">
                        <span><i class="far fa-calendar-alt mr-1"></i>${escapeHtml(data.dateStr || '')}</span>
                        <span>Đọc thư <i class="fas fa-arrow-right ml-1"></i></span>
                    </div>
                </div>`;
        }).join('');
    } catch (error) {
        console.error('Fetch letters error:', error);
        let message = 'Không thể tải thư. Vui lòng thử lại.';
        if (error.code === 'failed-precondition') message = 'Firestore Index chưa sẵn sàng.';
        else if (error.code === 'permission-denied') message = 'Bạn không có quyền truy cập thư.';
        listContainer.innerHTML = `<p class="text-center text-red-400 py-6">${escapeHtml(message)}</p>`;
    }
}

function openLetterReader(letterId) {
    const data = lettersCache.get(letterId);
    if (!data) return;

    const modal = document.getElementById('modal-letter-reader');
    const readerBook = modal.querySelector('.letter-reader-book');

    readerBook.classList.remove('theme-male', 'theme-female');
    readerBook.classList.add(currentMailboxTarget === 'male' ? 'theme-male' : 'theme-female');

    document.getElementById('reader-letter-title').textContent = data.title || 'Một lá thư';
    document.getElementById('reader-letter-subtitle').textContent = data.subtitle || '';
    document.getElementById('reader-letter-content').textContent = data.content || '';
    document.getElementById('reader-letter-date').textContent = data.dateStr || '';

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeLetterReader() {
    document.getElementById('modal-letter-reader').classList.remove('active');
    document.body.style.overflow = '';
}

function handleLetterReaderBackdrop(event) {
    if (event.target.id === 'modal-letter-reader') closeLetterReader();
}

async function deleteLetter(event, letterId) {
    event.stopPropagation();
    const data = lettersCache.get(letterId);
    if (!data) return;

    // ĐÃ ĐỔI PROMPT THÀNH POPUP MINI GIỮA MÀN HÌNH
    const pin = await showPinPrompt("Xác Nhận Xóa Thư", "Nhập mã PIN để xóa lá thư này:");
    if (pin === null) return;
    if (pin !== CONFIG.pinCode) {
        alert("Mã PIN không chính xác!");
        return;
    }

    const confirmed = confirm(`Bạn có chắc muốn xóa lá thư "${data.title || 'Một lá thư'}" không?\n\nHành động này không thể hoàn tác.`);
    if (!confirmed) return;

    try {
        await db.collection('letters').doc(letterId).delete();
        lettersCache.delete(letterId);

        const readerTitle = document.getElementById('reader-letter-title');
        if (readerTitle && readerTitle.textContent === (data.title || 'Một lá thư')) {
            closeLetterReader();
        }
        await fetchLetters();
    } catch (error) {
        console.error('Delete letter error:', error);
        alert('Không thể xóa thư. Vui lòng kiểm tra quyền Firestore và thử lại.');
    }
}

async function showCreateLetterForm() {
    // ĐÃ ĐỔI PROMPT THÀNH POPUP MINI GIỮA MÀN HÌNH
    const pin = await showPinPrompt("Viết Thư Mới", "Nhập mã PIN bảo mật để viết thư:");
    if (pin !== CONFIG.pinCode) {
        if (pin !== null) alert("Mã PIN không chính xác!");
        return;
    }

    const modal = document.getElementById('modal-create-letter');
    modal.classList.remove('theme-male', 'theme-female');
    modal.classList.add(currentMailboxTarget === 'male' ? 'theme-male' : 'theme-female');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden';
}

function hideCreateLetterForm() {
    const modal = document.getElementById('modal-create-letter');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.body.style.overflow = '';
}

function handleCreateLetterBackdrop(event) {
    if (event.target.id === 'modal-create-letter') hideCreateLetterForm();
}

function handleSaveLetter(e) {
    e.preventDefault();
    if(!db) return;

    const title = document.getElementById('letter-title').value;
    const subtitle = document.getElementById('letter-subtitle').value;
    const content = document.getElementById('letter-content').value;
    const pattern = document.getElementById('letter-pattern').value;
    const today = new Date();
    const dateStr = `${today.getDate()}/${today.getMonth()+1}/${today.getFullYear()}`;

    db.collection("letters").add({
        target: currentMailboxTarget,
        title, subtitle, content, pattern, dateStr,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        hideCreateLetterForm();
        document.getElementById('form-create-letter').reset();
        fetchLetters();
    });
}

document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') closeLetterReader();
});