// app.js - Thư viện số (giao diện kiểu Studocu, không có yêu thích)

const $ = id => document.getElementById(id);
const bookListEl = $('bookList'), recentListEl = $('recentList'), recentSection = $('recentSection');
const searchInput = $('searchInput'), filterSubject = $('filterSubject'),
      filterYear = $('filterYear'), filterType = $('filterType');
const themeToggle = $('themeToggle'), pdfModal = $('pdfModal'),
      pdfClose = $('pdfClose'), pdfCanvas = $('pdfCanvas'), mainTitle = $('mainTitle');

let books = [];
let view = 'home';
let cat = null;            // id danh mục đang chọn (null = tất cả)
let catTree = [];
const catMap = {};
const filterAudience = $('filterAudience'), filterFormat = $('filterFormat');

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

// ---------- PDF Cover Lazy Loader ----------
const coverCache = {};          // pdfUrl -> dataURL
const coverObserver = new IntersectionObserver(entries => {
  entries.forEach(en => {
    if (!en.isIntersecting) return;
    coverObserver.unobserve(en.target);
    const cv = en.target;
    const url = cv.dataset.pdf;
    if (!url) return;
    if (coverCache[url]) { drawCoverFromDataURL(cv, coverCache[url]); return; }
    renderCoverPage(cv, url);
  });
}, { rootMargin: '400px 0px' });

async function renderCoverPage(cv, url) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
    const pdf = await pdfjsLib.getDocument(url).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    const W = cv.clientWidth || 180;
    const scale = W / viewport.width;
    const vp = page.getViewport({ scale });
    cv.width = vp.width;
    cv.height = vp.height;
    cv.style.width = '100%';
    cv.style.height = '100%';
    cv.style.objectFit = 'cover';
    cv.classList.remove('cover-loading');
    await page.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
    coverCache[url] = cv.toDataURL();
  } catch (e) {
    cv.classList.remove('cover-loading');
    cv.classList.add('cover-error');
    // Draw fallback book icon
    const ctx = cv.getContext('2d');
    cv.width = 180; cv.height = 240;
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--soft') || '#f0f0f0';
    ctx.fillRect(0, 0, 180, 240);
    ctx.font = '64px serif';
    ctx.textAlign = 'center';
    ctx.fillText('📘', 90, 140);
  }
}

function drawCoverFromDataURL(cv, dataURL) {
  const img = new Image();
  img.onload = () => {
    cv.width = img.width; cv.height = img.height;
    cv.style.width = '100%'; cv.style.height = '100%';
    cv.classList.remove('cover-loading');
    cv.getContext('2d').drawImage(img, 0, 0);
  };
  img.src = dataURL;
}

// ---------- Render ----------
function cardHTML(b) {
  return `
    <article class="card" data-id="${esc(b.id)}">
      <div class="thumb">
        <canvas class="cover-canvas cover-loading" data-pdf="${esc(b.file)}"></canvas>
        <span class="badge">${esc(b.year)}</span>
      </div>
      <h3>${esc(b.title)}</h3>
      <span class="tag">${esc(b.subject)}</span>
    </article>`;
}
function renderInto(el, list, groupBySubject = false) {
  if (list.length === 0) {
    el.innerHTML = '<p class="empty">Không tìm thấy tài liệu.</p>';
    return;
  }
  
  if (groupBySubject) {
    const groups = {};
    list.forEach(b => {
      groups[b.subject] = groups[b.subject] || [];
      groups[b.subject].push(b);
    });
    
    let html = '';
    for (const [subj, items] of Object.entries(groups)) {
      html += `<div class="group-section"><h3 class="group-title">${esc(subj)}</h3><div class="card-row">`;
      html += items.map(cardHTML).join('');
      html += `</div></div>`;
    }
    el.innerHTML = html;
  } else {
    el.innerHTML = list.map(cardHTML).join('');
  }

  // Observe all cover canvases for lazy PDF rendering
  el.querySelectorAll('.cover-canvas').forEach(cv => coverObserver.observe(cv));
  
  el.querySelectorAll('.card').forEach(c =>
    c.addEventListener('click', () => {
      const b = books.find(x => x.id === c.dataset.id);
      if (b) openPDF(b);
    }));
}

// ---------- Danh mục ----------
function indexCats(nodes, parent) {
  nodes.forEach(n => { catMap[n.id] = { ...n, parent }; if (n.children) indexCats(n.children, n.id); });
}
function catIds(id) {
  const s = new Set();
  (function walk(n) { s.add(n.id); (n.children || []).forEach(walk); })(catMap[id]);
  return s;
}
function treeHTML(nodes, top) {
  return nodes.map(n => {
    const has = n.children && n.children.length;
    const ids = catIds(n.id);
    const count = books.filter(b => ids.has(b.category)).length;
    return `<div class="cat-node${top ? ' cat-top' : ''}" data-id="${esc(n.id)}">
      <div class="cat-row" data-id="${esc(n.id)}">
        <span class="cat-caret">${has ? '▸' : ''}</span>
        <span class="cat-name">${esc(n.name)}</span>
        <span class="cat-count">${count || ''}</span>
      </div>
      ${has ? `<div class="cat-children">${treeHTML(n.children, false)}</div>` : ''}
    </div>`;
  }).join('');
}
function markTree() {
  document.querySelectorAll('.cat-row').forEach(r => r.classList.toggle('active', r.dataset.id === cat));
  if (cat) { // mở các mục cha của mục đang chọn
    for (let p = catMap[cat].parent; p; p = catMap[p].parent)
      document.querySelector(`.cat-node[data-id="${p}"]`).classList.add('open');
  }
}
function renderTree() {
  $('catTree').innerHTML = treeHTML(catTree, true);
  markTree();
}
$('catTree').addEventListener('click', e => {
  const row = e.target.closest('.cat-row');
  if (!row) return;
  const node = row.parentElement;
  const id = row.dataset.id;
  if (node.querySelector(':scope > .cat-children')) node.classList.toggle('open');
  cat = id;
  view = 'library';
  document.querySelectorAll('.nav-link').forEach(x => x.classList.toggle('active', x.dataset.view === 'library'));
  markTree();
  applyFilters();
});

function applyFilters() {
  const q = searchInput.value.trim().toLowerCase();
  const ids = cat ? catIds(cat) : null;
  const list = books.filter(b =>
    (!q || b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q) ||
      (b.tags || []).some(t => t.toLowerCase().includes(q))) &&
    (!ids || ids.has(b.category)) &&
    (!filterSubject.value || b.subject === filterSubject.value) &&
    (!filterYear.value || String(b.year) === filterYear.value) &&
    (!filterType.value || b.type === filterType.value) &&
    (!filterAudience.value || b.audience === filterAudience.value) &&
    (!filterFormat.value || b.format === filterFormat.value));

  const recent = getHistory().map(id => books.find(b => b.id === id)).filter(Boolean);
  const showRecent = recent.length && (view === 'home' || view === 'recent') && !q && !cat;
  recentSection.classList.toggle('hidden', !showRecent);
  if (showRecent) renderInto(recentListEl, recent, false);

  if (view === 'recent') { 
    mainTitle.textContent = 'Đã xem gần đây'; 
    renderInto(bookListEl, recent, false); 
    return; 
  }
  
  const gameSection = document.getElementById('gameSection');
  const mainSection = document.getElementById('mainSection');
  const searchbar = document.querySelector('.searchbar');
  if (view === 'game') {
    if ($('recentSection')) $('recentSection').classList.add('hidden');
    if (mainSection) mainSection.classList.add('hidden');
    if (searchbar) searchbar.classList.add('hidden');
    if (gameSection) gameSection.classList.remove('hidden');
    if (window.initAIGame) window.initAIGame();
    return;
  } else {
    if (gameSection) gameSection.classList.add('hidden');
    if (searchbar) searchbar.classList.remove('hidden');
    if (mainSection) mainSection.classList.remove('hidden');
  }
  
  mainTitle.textContent = q ? `Kết quả cho “${searchInput.value}”` : cat ? catMap[cat].name : 'Tất cả tài liệu';
  const shouldGroup = !q && !cat && !filterSubject.value;
  renderInto(bookListEl, list, shouldGroup);
}

window.openGameView = function() {
  document.querySelectorAll('.nav-link').forEach(x => x.classList.remove('active'));
  const link = document.querySelector('.nav-link[data-view="game"]');
  if (link) link.classList.add('active');
  view = 'game';
  cat = null;
  markTree();
  applyFilters();
  closeMobileSidebar();
};

function fillSelect(sel, values) {
  [...new Set(values)].sort().forEach(v => sel.insertAdjacentHTML('beforeend', `<option value="${esc(v)}">${esc(v)}</option>`));
}

// ---------- Mobile Drawer Menu ----------
const menuToggle = $('menuToggle');
const sidebar = $('sidebar');
const sidebarClose = $('sidebarClose');
const sidebarBackdrop = $('sidebarBackdrop');

function closeMobileSidebar() {
  if (sidebar) sidebar.classList.remove('open');
  if (sidebarBackdrop) sidebarBackdrop.classList.add('hidden');
}
function openMobileSidebar() {
  if (sidebar) sidebar.classList.add('open');
  if (sidebarBackdrop) sidebarBackdrop.classList.remove('hidden');
}

if (menuToggle) menuToggle.addEventListener('click', openMobileSidebar);
if (sidebarClose) sidebarClose.addEventListener('click', closeMobileSidebar);
if (sidebarBackdrop) sidebarBackdrop.addEventListener('click', closeMobileSidebar);

// ---------- Sidebar ----------
document.querySelectorAll('.nav-link').forEach(a =>
  a.addEventListener('click', e => {
    e.preventDefault();
    document.querySelectorAll('.nav-link').forEach(x => x.classList.remove('active'));
    a.classList.add('active');
    view = a.dataset.view;
    if (['home', 'library', 'recent', 'game'].includes(view)) { cat = null; markTree(); }

    applyFilters();
    closeMobileSidebar();
  }));
$('btnContribute').addEventListener('click', () =>
  alert('Bạn có thể gửi tài liệu qua Google Form hoặc Pull Request (sẽ cập nhật link sau).'));

[searchInput].forEach(el => el.addEventListener('input', applyFilters));
[filterSubject, filterYear, filterType, filterAudience, filterFormat].forEach(el => el.addEventListener('change', applyFilters));

// ---------- PDF ----------
let readerToken = 0, pageObserver = null, thumbObserver = null, readerUrl = '';
let readerZoom = Number(localStorage.getItem('readerZoom')) || 1;
function buildThumbs(pdf, base, token) {
  const box = $('thumbs');
  box.innerHTML = '';
  if (thumbObserver) thumbObserver.disconnect();
  const W = 110, dpr = window.devicePixelRatio || 1;
  thumbObserver = new IntersectionObserver(entries => entries.forEach(async en => {
    if (!en.isIntersecting) return;
    thumbObserver.unobserve(en.target);
    const page = await pdf.getPage(Number(en.target.dataset.page));
    if (token !== readerToken) return;
    const b = page.getViewport({ scale: 1 });
    const vp = page.getViewport({ scale: (W * dpr) / b.width });
    const cv = en.target.querySelector('canvas');
    cv.width = vp.width; cv.height = vp.height;
    await page.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
  }), { root: box, rootMargin: '400px 0px' });
  for (let i = 1; i <= pdf.numPages; i++) {
    const item = document.createElement('div');
    item.className = 'thumb-item';
    item.dataset.page = i;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = Math.round(W * base.height / base.width);
    cv.style.width = W + 'px'; cv.style.height = cv.height + 'px';
    const label = document.createElement('span');
    label.textContent = i;
    item.append(cv, label);
    item.addEventListener('click', () => {
      const target = $('pdfPages').querySelector(`canvas[data-page="${i}"]`);
      if (target) $('pdfPages').scrollTo({ top: target.offsetTop - 12, behavior: 'smooth' });
    });
    box.appendChild(item);
    thumbObserver.observe(item);
  }
}
let scrollTick = false;
function updateActiveThumb() {
  const box = $('pdfPages'), pages = box.querySelectorAll('canvas');
  if (!pages.length) return;
  const y = box.scrollTop + box.clientHeight / 3;
  let cur = 1;
  for (const cv of pages) { if (cv.offsetTop <= y) cur = Number(cv.dataset.page); else break; }
  const th = $('thumbs');
  th.querySelectorAll('.thumb-item.active').forEach(x => x.classList.remove('active'));
  const item = th.querySelector(`.thumb-item[data-page="${cur}"]`);
  if (item) {
    item.classList.add('active');
    if (item.offsetTop < th.scrollTop || item.offsetTop + item.offsetHeight > th.scrollTop + th.clientHeight)
      th.scrollTop = item.offsetTop - th.clientHeight / 2;
  }
}
$('pdfPages').addEventListener('scroll', () => {
  if (scrollTick) return;
  scrollTick = true;
  requestAnimationFrame(() => { scrollTick = false; updateActiveThumb(); });
});
function fillSummary(b) {
  const row = (k, v) => `<div class="meta-row"><span>${k}</span><span>${esc(v)}</span></div>`;
  $('summaryPanel').innerHTML = `
    <h3>${esc(b.title)}</h3>
    <h4>Bản tóm tắt</h4>
    ${b.summary ? `<p>${esc(b.summary)}</p>` : '<p class="no-summary">Chưa có bản tóm tắt cho tài liệu này.</p>'}
    <h4>Thông tin</h4>
    ${row('Tác giả', b.author)}${row('Môn', b.subject)}${row('Năm', b.year)}${row('Loại', b.type)}${row('Giấy phép', b.license)}
    ${(b.tags || []).length ? `<h4>Từ khóa</h4><div class="tags">${b.tags.map(t => `<span>${esc(t)}</span>`).join('')}</div>` : ''}`;
}
async function renderPDF(url, keepRatio) {
  const token = ++readerToken;
  readerUrl = url;
  const box = $('pdfPages');
  const ratio = keepRatio && box.scrollHeight ? box.scrollTop / box.scrollHeight : 0;
  box.innerHTML = '<p class="pdf-msg">Đang tải tài liệu…</p>';
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
    const pdf = await pdfjsLib.getDocument(url).promise;
    if (token !== readerToken) return;
    box.innerHTML = '';
    if (pageObserver) pageObserver.disconnect();
    const dpr = window.devicePixelRatio || 1;
    const cssW = Math.min(box.clientWidth * 0.92, 1100) * readerZoom;
    const first = await pdf.getPage(1);
    const base = first.getViewport({ scale: 1 });
    const scale = cssW / base.width;
    pageObserver = new IntersectionObserver(entries => entries.forEach(async en => {
      if (!en.isIntersecting) return;
      const cv = en.target;
      pageObserver.unobserve(cv);
      const page = await pdf.getPage(Number(cv.dataset.page));
      if (token !== readerToken) return;
      const vp = page.getViewport({ scale: scale * dpr });
      cv.width = vp.width; cv.height = vp.height;
      cv.style.width = (vp.width / dpr) + 'px';
      await page.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
    }), { root: box, rootMargin: '4000px 0px' });
    for (let i = 1; i <= pdf.numPages; i++) {
      const cv = document.createElement('canvas');
      cv.dataset.page = i;
      cv.width = Math.round(base.width * scale); cv.height = Math.round(base.height * scale);
      cv.style.width = cssW + 'px';
      box.appendChild(cv);
      pageObserver.observe(cv);
    }
    box.scrollTop = ratio * box.scrollHeight;
    if (!keepRatio) buildThumbs(pdf, base, token);
    updateActiveThumb();
    $('zoomLevel').textContent = Math.round(readerZoom * 100) + '%';
  } catch (err) {
    console.error(err);
    if (token === readerToken)
      box.innerHTML = '<p class="pdf-msg">Không mở được tài liệu. Hãy thử nút “Mở tab mới ↗”.</p>';
  }
}
function setZoom(z) {
  readerZoom = Math.max(0.5, Math.min(3, z));
  localStorage.setItem('readerZoom', readerZoom);
  if (readerUrl) renderPDF(readerUrl, true);
}
$('zoomIn').addEventListener('click', () => setZoom(readerZoom + 0.25));
$('zoomOut').addEventListener('click', () => setZoom(readerZoom - 0.25));
let currentBook = null, toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 2200);
}
$('readerShare').addEventListener('click', async () => {
  if (!currentBook) return;
  const url = new URL(currentBook.file, location.href).href;
  const data = { title: currentBook.title, text: currentBook.title, url };
  try {
    if (navigator.share) { await navigator.share(data); return; }
    await navigator.clipboard.writeText(url);
    toast('Đã sao chép liên kết');
  } catch (e) {
    if (e.name === 'AbortError') return;
    window.prompt('Sao chép liên kết này:', url);
  }
});
function showReader(b) {
  $('readerTitle').textContent = b.title;
  $('readerMeta').textContent = `${b.author} · ${b.subject} · ${b.year}`;
  $('readerOpen').href = b.file;
  const dl = $('readerDownload');
  dl.href = b.file;
  dl.setAttribute('download', b.file.split('/').pop());
  currentBook = b;
  pdfModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  fillSummary(b);
  $('thumbs').innerHTML = '';
  renderPDF(b.file);
}
function hideReader() {
  readerToken++;
  if (pageObserver) pageObserver.disconnect();
  if (thumbObserver) thumbObserver.disconnect();
  pdfModal.classList.add('hidden');
  document.body.style.overflow = '';
  $('pdfPages').innerHTML = '';
}
function openPDF(b) {
  if (!b) return;
  addHistory(b.id);
  showReader(b);
  history.pushState({ reader: b.id }, '');
  applyFilters();
}
function closePDF() {
  if (pdfModal.classList.contains('hidden')) return;
  if (history.state && history.state.reader) history.back(); else hideReader();
}
window.addEventListener('popstate', hideReader);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closePDF(); });
pdfClose.addEventListener('click', closePDF);

// ---------- Init ----------
(async () => {
  try {
    const r = await fetch('data/books.json', { cache: 'no-store' });
    books = await r.json();
    try {
      catTree = await (await fetch('data/categories.json', { cache: 'no-store' })).json();
      indexCats(catTree, null);
    } catch (e) { console.warn('Kh\u00f4ng t\u1ea3i \u0111\u01b0\u1ee3c danh m\u1ee5c', e); }
    fillSelect(filterAudience, books.map(b => b.audience).filter(Boolean));
    fillSelect(filterFormat, books.map(b => b.format).filter(Boolean));
    renderTree();
    fillSelect(filterSubject, books.map(b => b.subject));
    fillSelect(filterYear, books.map(b => String(b.year)));
    fillSelect(filterType, books.map(b => b.type));
    applyFilters();
  } catch (e) {
    console.error(e);
    bookListEl.innerHTML = '<p class="empty">Lỗi tải dữ liệu. Hãy chạy bằng http server.</p>';
  }
})();
