// app.js - Thư viện số (giao diện kiểu Studocu, không có yêu thích)

const $ = id => document.getElementById(id);
const bookListEl = $('bookList'), recentListEl = $('recentList'), recentSection = $('recentSection');
const searchInput = $('searchInput'), filterSubject = $('filterSubject'),
      filterYear = $('filterYear'), filterType = $('filterType');
const themeToggle = $('themeToggle'), pdfModal = $('pdfModal'),
      pdfClose = $('pdfClose'), pdfCanvas = $('pdfCanvas'), mainTitle = $('mainTitle');

let books = [];
let view = 'home';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// ---------- Theme ----------
function setTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('theme', t);
  themeToggle.textContent = t === 'dark' ? '☀️' : '🌙';
}
setTheme(localStorage.getItem('theme') || 'light');
themeToggle.addEventListener('click', () =>
  setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'));

// ---------- Lịch sử xem ----------
const getHistory = () => JSON.parse(localStorage.getItem('history') || '[]');
function addHistory(id) {
  const h = getHistory().filter(x => x !== id);
  h.unshift(id);
  localStorage.setItem('history', JSON.stringify(h.slice(0, 12)));
}

// ---------- Render ----------
function cardHTML(b) {
  return `
    <article class="card" data-id="${esc(b.id)}">
      <div class="thumb">
        <img src="${esc(b.cover)}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'ph',textContent:'📘'}))" />
        <span class="badge">${esc(b.year)}</span>
      </div>
      <h3>${esc(b.title)}</h3>
      <p class="author">👤 ${esc(b.author)}</p>
      <span class="tag">${esc(b.subject)}</span>
    </article>`;
}
function renderInto(el, list) {
  el.innerHTML = list.length ? list.map(cardHTML).join('') : '<p class="empty">Không tìm thấy tài liệu.</p>';
  el.querySelectorAll('.card').forEach(c =>
    c.addEventListener('click', () => {
      const b = books.find(x => x.id === c.dataset.id);
      if (b) openPDF(b);
    }));
}

function applyFilters() {
  const q = searchInput.value.trim().toLowerCase();
  const list = books.filter(b =>
    (!q || b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q) ||
      (b.tags || []).some(t => t.toLowerCase().includes(q))) &&
    (!filterSubject.value || b.subject === filterSubject.value) &&
    (!filterYear.value || String(b.year) === filterYear.value) &&
    (!filterType.value || b.type === filterType.value));

  const recent = getHistory().map(id => books.find(b => b.id === id)).filter(Boolean);
  const showRecent = recent.length && (view === 'home' || view === 'recent') && !q;
  recentSection.classList.toggle('hidden', !showRecent);
  if (showRecent) renderInto(recentListEl, recent);

  if (view === 'recent') { mainTitle.textContent = 'Đã xem gần đây'; renderInto(bookListEl, recent); return; }
  mainTitle.textContent = q ? `Kết quả cho “${searchInput.value}”` : 'Tất cả tài liệu';
  renderInto(bookListEl, list);
}

function fillSelect(sel, values) {
  [...new Set(values)].sort().forEach(v => sel.insertAdjacentHTML('beforeend', `<option value="${esc(v)}">${esc(v)}</option>`));
}

// ---------- Sidebar ----------
document.querySelectorAll('.nav-link').forEach(a =>
  a.addEventListener('click', e => {
    e.preventDefault();
    document.querySelectorAll('.nav-link').forEach(x => x.classList.remove('active'));
    a.classList.add('active');
    view = a.dataset.view;
    if (['summary', 'errors', 'dup'].includes(view)) {
      alert('Công cụ này sẽ được bổ sung ở giai đoạn 2.');
      view = 'home';
    }
    applyFilters();
  }));
$('btnContribute').addEventListener('click', () =>
  alert('Bạn có thể gửi tài liệu qua Google Form hoặc Pull Request (sẽ cập nhật link sau).'));

[searchInput].forEach(el => el.addEventListener('input', applyFilters));
[filterSubject, filterYear, filterType].forEach(el => el.addEventListener('change', applyFilters));

// ---------- PDF ----------
async function openPDF(b) {
  addHistory(b.id);
  pdfModal.classList.remove('hidden');
  try {
    const pdf = await pdfjsLib.getDocument(b.file).promise;
    const page = await pdf.getPage(1);
    const vp = page.getViewport({ scale: 1.4 });
    pdfCanvas.width = vp.width; pdfCanvas.height = vp.height;
    await page.render({ canvasContext: pdfCanvas.getContext('2d'), viewport: vp }).promise;
  } catch (e) { console.error(e); alert('Không mở được file PDF này.'); pdfModal.classList.add('hidden'); }
  applyFilters();
}
pdfClose.addEventListener('click', () => pdfModal.classList.add('hidden'));
pdfModal.addEventListener('click', e => { if (e.target === pdfModal) pdfModal.classList.add('hidden'); });

// ---------- Init ----------
(async () => {
  try {
    const r = await fetch('data/books.json');
    books = await r.json();
    fillSelect(filterSubject, books.map(b => b.subject));
    fillSelect(filterYear, books.map(b => String(b.year)));
    fillSelect(filterType, books.map(b => b.type));
    applyFilters();
  } catch (e) {
    console.error(e);
    bookListEl.innerHTML = '<p class="empty">Lỗi tải dữ liệu. Hãy chạy bằng http server.</p>';
  }
})();
