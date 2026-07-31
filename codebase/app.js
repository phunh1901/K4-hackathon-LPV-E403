/* VLearn prototype CP3 — UI thật + backend AI cùng origin. */
'use strict';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ---------------- state ---------------- */
const S = {
  page: 1,
  zoom: 1,
  tool: 'read',
  lang: 'vi',
  penSize: 3,
  penColor: '#e0483b',
  moreOpen: false,    // "..." trên toolbar có đang mở thanh phụ không
  pad: {},            // page -> chữ học viên tự gõ trên giấy cạnh slide
  review: {},         // page -> [{id,question,why,chose,answer,excerpt,origin}] câu còn sai
  qzSeq: 0,           // đánh số mỗi lượt quiz để id ghi chú không đụng nhau
  sideManual: false,  // người dùng đã tự bấm ẩn/hiện sidebar chưa (xem fitPanels)
  tutorManual: false, // như trên, cho panel trợ lý
  notes: [],          // {id,page,kind,quote,text,x,y}
  undo: [],           // {page,label,fn}
  chat: [],
  snap: null,         // vùng ảnh đang đính kèm
  simFail: false,     // mô phỏng lỗi mạng cho câu kế tiếp
  busy: false,
  selQuote: '',
  selPos: null,
};

/* ---------------- i18n ---------------- */
const I18N = {
  vi: {
    sideTitle: 'Học liệu môn học', sideSub: 'Chương, slide và tài liệu đã upload',
    tRead: 'Đọc', tPen: 'Bút', tHl: 'Highlight', tSnip: 'Chụp vùng',
    tCircle: 'Khoanh', tText: 'Text', tImg: 'Ảnh', tEraser: 'Tẩy', stroke: 'NÉT',
    page: 'Trang', note: 'Ghi chú', copy: 'Sao chép', cancel: 'Huỷ',
    askAI: 'Hỏi AI', confused: 'Báo bối rối', snipAsk: 'Hỏi AI vùng này',
    snipHint: 'Kéo chuột để chọn vùng cần hỏi · Esc để thoát',
    ttSub: 'Trợ lý học theo ngữ cảnh', ctxSlide: 'Trang slide',
    askPh: 'Nhập câu hỏi hoặc bôi đen tài liệu...',
    docs: 'TÀI LIỆU', pages: 'trang', notes: 'note',
    answered: 'ĐÃ TRẢ LỜI', lowconf: 'ĐỘ TIN THẤP', failed: 'LỖI', asking: 'ĐANG TRẢ LỜI',
    trust: ['Rất tin cậy', 'Tạm tin cậy', 'Chưa chắc'],
    ctx: 'Ngữ cảnh', srcOne: 'nguồn tham khảo',
    helpful: 'Phản hồi này có hữu ích không?',
    close: 'Đóng', save: 'Lưu', retry: 'Thử lại',
  },
  en: {
    sideTitle: 'Course materials', sideSub: 'Chapters, slides and uploaded files',
    tRead: 'Read', tPen: 'Pen', tHl: 'Highlight', tSnip: 'Snip',
    tCircle: 'Circle', tText: 'Text', tImg: 'Image', tEraser: 'Eraser', stroke: 'SIZE',
    page: 'Page', note: 'Note', copy: 'Copy', cancel: 'Cancel',
    askAI: 'Ask AI', confused: 'Flag confusion', snipAsk: 'Ask AI about this',
    snipHint: 'Drag to select the region · Esc to exit',
    ttSub: 'Context-aware study assistant', ctxSlide: 'Slide page',
    askPh: 'Type a question or highlight the document...',
    docs: 'FILES', pages: 'pages', notes: 'notes',
    answered: 'ANSWERED', lowconf: 'LOW CONFIDENCE', failed: 'FAILED', asking: 'ANSWERING',
    trust: ['High confidence', 'Moderate', 'Unsure'],
    ctx: 'Context', srcOne: 'source(s)',
    helpful: 'Was this helpful?',
    close: 'Close', save: 'Save', retry: 'Retry',
  },
};
const t = k => I18N[S.lang][k];

function applyLang() {
  $$('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  $$('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
  $('#btnLang').textContent = S.lang.toUpperCase();
  document.documentElement.lang = S.lang;
  // đổi nhãn "Trang N / 76" trên từng sheet mà không render lại (giữ annotation)
  $$('.page-head > span:first-child').forEach(el => {
    el.textContent = `${t('page')} ${el.closest('.page').dataset.page} / ${DOC.totalPages}`;
  });
  renderChapters();
  syncChrome();
  renderChat();
}

/* ---------------- icons ---------------- */
const ICO = {
  play: '<svg viewBox="0 0 24 24"><path d="M8 5l11 7-11 7z"/></svg>',
  caret: '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>',
  check: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8.5 12.2l2.4 2.4 4.6-4.8"/></svg>',
  book: '<svg viewBox="0 0 24 24"><path d="M4 5a2 2 0 012-2h5v18H6a2 2 0 01-2-2zM13 3h5a2 2 0 012 2v14a2 2 0 01-2 2h-5z"/></svg>',
  ext: '<svg viewBox="0 0 24 24"><path d="M14 4h6v6"/><path d="M20 4l-8 8"/><path d="M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/></svg>',
  up: '<svg viewBox="0 0 24 24"><path d="M7 14l5-5 5 5"/></svg>',
  down: '<svg viewBox="0 0 24 24"><path d="M7 10l5 5 5-5"/></svg>',
  ok: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8.5 12.2l2.4 2.4 4.6-4.8"/></svg>',
  warn: '<svg viewBox="0 0 24 24"><path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17h.01"/></svg>',
  err: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/></svg>',
  thumbUp: '<svg viewBox="0 0 24 24"><path d="M7 10v10H4V10zM7 10l4-7a2 2 0 013 2l-1 5h5a2 2 0 012 2.3l-1 6A2 2 0 0117 20H7z"/></svg>',
  thumbDown: '<svg viewBox="0 0 24 24"><path d="M17 14V4h3v10zM17 14l-4 7a2 2 0 01-3-2l1-5H6a2 2 0 01-2-2.3l1-6A2 2 0 017 4h10z"/></svg>',
};

/* =============================================================
   SIDEBAR
   ============================================================= */
function renderChapters() {
  $('#chapters').innerHTML = CHAPTERS.map(c => `
    <div class="chapter${c.open ? ' open' : ''}" data-ch="${c.id}">
      <button class="ch-head">
        <span class="ch-play">${ICO.play}</span>
        <span class="ch-txt">
          <span class="ch-name">${c.title}</span>
          <span class="ch-meta">${c.docs.length} ${t('docs')} · ${c.status}</span>
        </span>
        ${c.studying ? `<span class="badge">STUDYING</span>` : ''}
        <span class="ch-caret">${ICO.caret}</span>
      </button>
      <div class="ch-body">
        ${c.docs.map(d => `
          <button class="docitem${d.active ? ' active' : ''}" data-doc="${d.name}">
            <span class="dot">${ICO.play}</span>
            <span class="doc-t"><b>${d.name}</b><span>${d.pages} ${t('pages')}</span></span>
            <span class="doc-check${d.done ? '' : ' off'}">${ICO.check}</span>
          </button>`).join('')}
      </div>
    </div>`).join('');

  $$('#chapters .ch-head').forEach(b => b.onclick = () => {
    const c = CHAPTERS.find(x => x.id === b.closest('.chapter').dataset.ch);
    c.open = !c.open;
    b.closest('.chapter').classList.toggle('open', c.open);
  });
  $$('#chapters .docitem').forEach(b => b.onclick = () => {
    const name = b.dataset.doc;
    if (name === DOC.file) { goPage(1); toast('ok', 'Đang xem ' + name); }
    else loadDocument(name);
  });
}

/* =============================================================
   PDF RENDERING
   ============================================================= */
let pdfDoc = null;
const renderedPDFPages = new Set();
let pdfObserver = null;

async function loadDocument(docName) {
  // Tìm info của document
  let docInfo = null;
  for (const ch of CHAPTERS) {
    const d = ch.docs.find(d => d.name === docName);
    if (d) { docInfo = d; break; }
  }
  if (!docInfo || !docInfo.path) { toast('warn', 'Không tìm thấy tài liệu'); return; }

  toast('ok', 'Đang tải ' + docName + '...');
  try {
    const loadingTask = pdfjsLib.getDocument(docInfo.path);
    pdfDoc = await loadingTask.promise;
    DOC.file = docInfo.name;
    DOC.totalPages = pdfDoc.numPages;
    docInfo.pages = pdfDoc.numPages;

    // Cập nhật active state
    CHAPTERS.forEach(ch => ch.docs.forEach(d => { d.active = (d.name === docName); }));
    // Cập nhật studying badge
    CHAPTERS.forEach(ch => { ch.studying = ch.docs.some(d => d.active); });

    // Reset state cho document mới
    S.notes = [];
    S.undo = [];
    S.page = 1;
    renderedPDFPages.clear();
    if (pdfObserver) pdfObserver.disconnect();

    // Re-render UI
    renderChapters();
    renderPages();
    syncChrome();
    $('#docName').textContent = DOC.file;
    $('#docSub').textContent = DOC.course + ' · ' + DOC.code;
    $('#scroller').scrollTop = 0;

    toast('ok', 'Đã mở ' + docName + ' (' + pdfDoc.numPages + ' trang)');
  } catch (err) {
    console.error('PDF load error:', err);
    toast('err', 'Không tải được PDF. Hãy chạy local server (xem console).');
  }
}

function renderPages() {
  const container = $('#pages');
  container.innerHTML = '';

  for (let i = 1; i <= DOC.totalPages; i++) {
    const section = document.createElement('section');
    section.className = 'page';
    section.id = 'pg' + i;
    section.dataset.page = i;
    section.innerHTML = `
      <div class="page-head"><span>${t('page')} ${i} / ${DOC.totalPages}</span>
        <span class="ph-right"><span class="r">${DOC.file}</span>
          <button class="pg-quiz" data-quizpage="${i}" data-tip="Tạo câu hỏi kiểm tra cho riêng trang này">
            <svg viewBox="0 0 24 24"><path d="M13 2L4.5 13.5H11l-1 8.5L19 10h-6.5z"/></svg>
            <span>Thử thách</span>
          </button></span></div>
      <div class="page-body">
        <div class="slide pdf-loading">
          <canvas class="pdf-canvas"></canvas>
          <div class="hl-layer"></div>
          <div class="pdf-text-layer"></div>
          <svg class="ink" viewBox="0 0 1000 562" preserveAspectRatio="none"></svg>
        </div>
        <aside class="notepad" data-pad="${i}"></aside>
      </div>`;
    container.appendChild(section);
  }

  $('#pagerTotal').textContent = DOC.totalPages;
  observePages();
  setupPDFLazyRender();
}

function setupPDFLazyRender() {
  if (!pdfDoc) return;
  if (pdfObserver) pdfObserver.disconnect();

  pdfObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const num = +entry.target.dataset.page;
        if (!renderedPDFPages.has(num)) {
          renderedPDFPages.add(num);
          renderPDFPage(num);
        }
      }
    });
  }, { root: $('#scroller'), rootMargin: '400px 0px' });

  $$('.page').forEach(el => pdfObserver.observe(el));
}

async function renderPDFPage(num) {
  if (!pdfDoc) return;
  try {
    const page = await pdfDoc.getPage(num);
    const slideEl = $(`#pg${num} .slide`);
    const canvas = $(`#pg${num} .pdf-canvas`);
    const textLayerDiv = $(`#pg${num} .pdf-text-layer`);
    if (!canvas || !slideEl) return;

    // Tính viewport
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = 2; // 2x cho retina
    const viewport = page.getViewport({ scale });

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    // Cập nhật aspect-ratio slide theo PDF page thật
    slideEl.style.aspectRatio = `${baseViewport.width} / ${baseViewport.height}`;

    // Cập nhật SVG ink viewBox
    const svg = $(`#pg${num} .ink`);
    if (svg) svg.setAttribute('viewBox', `0 0 ${Math.round(baseViewport.width)} ${Math.round(baseViewport.height)}`);

    // Render canvas
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;

    // Text layer cho chọn text
    textLayerDiv.innerHTML = '';
    const textContent = await page.getTextContent();
    const textItems = textContent.items;
    for (const item of textItems) {
      if (!item.str) continue;
      const tx = pdfjsLib.Util.transform(
        pdfjsLib.Util.transform(baseViewport.transform, item.transform), [1, 0, 0, -1, 0, 0]);
      const span = document.createElement('span');
      span.textContent = item.str;
      const fontHeight = Math.sqrt(tx[2] * tx[2] + tx[3] * tx[3]);
      span.style.fontSize = fontHeight + 'px';
      span.style.fontFamily = item.fontName || 'sans-serif';
      // Vị trí: tính theo % để tỉ lệ đúng với container
      span.style.left = (tx[4] / baseViewport.width * 100) + '%';
      span.style.top = (tx[5] / baseViewport.height * 100 - fontHeight / baseViewport.height * 100) + '%';
      // Scale theo chiều ngang
      if (item.width) {
        const naturalWidth = item.str.length * fontHeight * 0.5; // ước lượng
        const targetWidth = item.width * baseViewport.scale;
        if (naturalWidth > 0) {
          span.style.transform = `scaleX(${targetWidth / naturalWidth})`;
        }
      }
      textLayerDiv.appendChild(span);
    }

    slideEl.classList.remove('pdf-loading');
  } catch (err) {
    console.error('Error rendering page ' + num, err);
    const slideEl = $(`#pg${num} .slide`);
    if (slideEl) slideEl.classList.remove('pdf-loading');
  }
}

/* ---- scroll-spy: tính thẳng từ scrollTop, KHÔNG dùng IntersectionObserver ----
   IntersectionObserver chỉ báo những entry vừa đổi trạng thái nên hay chọn nhầm sang
   trang kế tiếp (hiển thị 12 khi đang đọc 11), và nó vẫn bắn giữa lúc smooth-scroll
   làm S.page bị ghi đè → bấm chuyển trang bị nhảy 2-3 trang một lần.
   Cách dưới đây tính trang theo một "đường ngắm" cố định ngay dưới toolbar,
   và khoá hẳn việc cập nhật trong lúc đang bay tới trang đích. */
const TOP_GAP = 86;        // = padding-top của .pages-scroll (chỗ chừa cho toolbar nổi)
const AIM = TOP_GAP + 24;  // đường ngắm: trang nào vượt qua vạch này thì là trang đang đọc
let pageEls = [];
let scrollTarget = null;   // scrollTop đích khi đang smooth-scroll; null = người dùng tự cuộn
let settleTimer = 0;

function observePages() {
  pageEls = $$('.page');
  const sc = $('#scroller');
  sc.removeEventListener('scroll', onScroll);
  sc.addEventListener('scroll', onScroll, { passive: true });
}

/* trang cuối cùng có mép trên đã vượt lên trên đường ngắm */
function pageAtScroll() {
  const y = $('#scroller').scrollTop + AIM;
  let n = 1;
  for (const el of pageEls) {
    if (el.offsetTop <= y) n = +el.dataset.page;
    else break;                       // pageEls theo đúng thứ tự trang nên dừng được sớm
  }
  return n;
}

function onScroll() {
  if (scrollTarget !== null) {
    // đang bay tới đích: chỉ mở khoá khi đã tới nơi, tuyệt đối không đụng S.page giữa chừng
    if (Math.abs($('#scroller').scrollTop - scrollTarget) < 4) releaseScroll();
    return;
  }
  const n = pageAtScroll();
  if (n !== S.page) { S.page = n; syncChrome(); }
}

function releaseScroll() {
  scrollTarget = null;
  clearTimeout(settleTimer);
}

function goPage(n) {
  n = Math.min(Math.max(1, n), DOC.totalPages);
  S.page = n;
  syncChrome();                        // cập nhật số trang ngay, không đợi cuộn xong
  const sc = $('#scroller'), el = $('#pg' + n);
  const max = Math.max(0, sc.scrollHeight - sc.clientHeight);
  const top = Math.min(Math.max(0, el.offsetTop - TOP_GAP), max);
  if (Math.abs(sc.scrollTop - top) < 4) { releaseScroll(); return; }  // đã ở đúng chỗ
  scrollTarget = top;
  clearTimeout(settleTimer);
  settleTimer = setTimeout(releaseScroll, 1500);  // phòng khi người dùng cắt ngang cú cuộn
  sc.scrollTo({ top, behavior: 'smooth' });
}

/* =============================================================
   CHROME (chip, pager, nút bật/tắt)
   ============================================================= */
function syncChrome() {
  const cnt = S.notes.filter(n => n.page === S.page).length;
  $('#chipPageText').textContent = `${t('page')} ${S.page} · ${cnt} ${t('notes')}`;
  $('#pagerNow').textContent = S.page;
  $('#ctxChip').innerHTML = `${t('ctxSlide')}: <b>${S.page}</b>`;
  $('#zoomVal').textContent = Math.round(S.zoom * 100) + '%';
  $('#btnUndo').disabled = !S.undo.length;
  const pg = $('#pg' + S.page);
  const hasInk = pg && pg.querySelector('.ink > *, .hl-mark, .note-pin, .slide-text, .slide-img');
  $('#btnClear').disabled = !hasInk;
}

/* =============================================================
   TOOLS
   ============================================================= */
const SVG_NS = 'http://www.w3.org/2000/svg';
const COLORS = ['#e0483b', '#2f7fe0', '#22a06b', '#facc15', '#f97316', '#111827'];
const INK_TOOLS = ['pen', 'circle', 'text'];   // các công cụ cần bảng màu + độ dày nét

function setTool(name) {
  S.tool = name;
  $$('.tool[data-tool]').forEach(b => b.classList.toggle('active', b.dataset.tool === name));
  $$('.page').forEach(p => {
    p.classList.toggle('pen-mode', name === 'pen' || name === 'circle');
    p.classList.toggle('hl-mode', name === 'hl');
    p.classList.toggle('text-mode', name === 'text');
    p.classList.toggle('eraser-mode', name === 'eraser');
  });
  name === 'snip' ? openSnip() : closeSnip();
  updateSubbar();
}

/* ----- thanh công cụ phụ ----- */
function renderSwatches() {
  $('#swatches').innerHTML = COLORS.map(c =>
    `<button class="swatch${c === S.penColor ? ' on' : ''}" data-color="${c}" style="background:${c}" data-tip="${c}"></button>`).join('');
  $$('#swatches .swatch').forEach(b => b.onclick = () => {
    S.penColor = b.dataset.color;
    renderSwatches();
    // đổi màu cho ô chữ đang gõ dở
    const live = document.activeElement;
    if (live && live.classList?.contains('slide-text')) live.style.color = S.penColor;
  });
}

function updateSubbar() {
  const inky = INK_TOOLS.includes(S.tool);
  const show = S.moreOpen || inky;
  $('#subbar').hidden = !show;
  $('#subExtra').hidden = !S.moreOpen;
  $('#inkOpts').hidden = !inky;
  $('#subSep').hidden = !(S.moreOpen && inky);
  $('#btnMore').classList.toggle('active', S.moreOpen);
  // canh cho thanh phụ rộng bằng toolbar chính, giống bản VLearn thật
  if (show) $('#subbar').style.width = $('#toolbar').offsetWidth + 'px';
}

/* ----- bút vẽ & khoanh tròn ----- */
let draw = null;
document.addEventListener('pointerdown', e => {
  if (S.tool !== 'pen' && S.tool !== 'circle') return;
  const slide = e.target.closest('.slide');
  if (!slide) return;
  e.preventDefault();
  const svg = slide.querySelector('.ink');

  if (S.tool === 'circle') {
    const el = document.createElementNS(SVG_NS, 'ellipse');
    el.style.stroke = S.penColor;
    el.setAttribute('stroke-width', S.penSize);
    svg.appendChild(el);
    draw = { mode: 'circle', el, slide, start: slidePt(slide, e) };
  } else {
    const path = document.createElementNS(SVG_NS, 'path');
    path.style.stroke = S.penColor;
    path.setAttribute('stroke-width', S.penSize);
    svg.appendChild(path);
    draw = { mode: 'pen', el: path, pts: [], slide };
    addPoint(e);
  }
  try { slide.setPointerCapture(e.pointerId); } catch { }
});

document.addEventListener('pointermove', e => {
  if (!draw) return;
  if (draw.mode === 'pen') return addPoint(e);
  const p = slidePt(draw.slide, e), s = draw.start;
  draw.el.setAttribute('cx', (s.x + p.x) / 2);
  draw.el.setAttribute('cy', (s.y + p.y) / 2);
  draw.el.setAttribute('rx', Math.abs(p.x - s.x) / 2);
  draw.el.setAttribute('ry', Math.abs(p.y - s.y) / 2);
});

document.addEventListener('pointerup', () => {
  if (!draw) return;
  const { el, slide, mode } = draw;
  const page = +slide.closest('.page').dataset.page;
  const tooSmall = mode === 'pen'
    ? draw.pts.length < 2
    : (+el.getAttribute('rx') < 6 || +el.getAttribute('ry') < 6);
  if (tooSmall) el.remove();
  else pushUndo(page, mode === 'pen' ? 'nét bút' : 'nét khoanh', () => el.remove());
  draw = null;
  syncChrome();
});

/* toạ độ con trỏ quy về hệ toạ độ SVG viewBox của lớp mực */
function slidePt(slide, e) {
  const r = slide.getBoundingClientRect();
  const svg = slide.querySelector('.ink');
  const vb = svg ? svg.viewBox.baseVal : null;
  const vw = (vb && vb.width) || 1000;
  const vh = (vb && vb.height) || 562;
  return { x: ((e.clientX - r.left) / r.width) * vw, y: ((e.clientY - r.top) / r.height) * vh };
}
function addPoint(e) {
  const p = slidePt(draw.slide, e);
  draw.pts.push([p.x, p.y]);
  draw.el.setAttribute('d', draw.pts.map((q, i) => (i ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join(' '));
}

/* ----- công cụ Text ----- */
document.addEventListener('pointerdown', e => {
  if (S.tool !== 'text') return;
  const slide = e.target.closest('.slide');
  if (!slide || e.target.closest('.slide-text')) return;
  const r = slide.getBoundingClientRect();
  addTextBox(slide, ((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100);
});

function addTextBox(slide, xPct, yPct) {
  const page = +slide.closest('.page').dataset.page;
  const box = document.createElement('div');
  box.className = 'slide-text';
  box.contentEditable = 'true';
  box.style.left = xPct + '%';
  box.style.top = yPct + '%';
  box.style.color = S.penColor;
  box.style.fontSize = (1.3 + S.penSize * 0.22).toFixed(2) + 'cqw';
  slide.appendChild(box);
  box.focus();
  let counted = false;
  box.addEventListener('blur', () => {
    if (!box.textContent.trim()) { box.remove(); syncChrome(); return; }
    if (!counted) { counted = true; pushUndo(page, 'ô chữ', () => box.remove()); }
    syncChrome();
  });
}

/* ----- công cụ Ảnh ----- */
$('#btnImg').onclick = () => $('#imgPicker').click();
$('#imgPicker').onchange = e => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  const rd = new FileReader();
  rd.onload = () => {
    const slide = $('#pg' + S.page + ' .slide');
    if (!slide) return;
    const img = document.createElement('img');
    img.className = 'slide-img';
    img.src = rd.result;
    img.style.left = '50%';
    img.style.top = '50%';
    slide.appendChild(img);
    pushUndo(S.page, 'ảnh chèn', () => img.remove());
    toast('ok', 'Đã chèn ảnh vào trang ' + S.page);
  };
  rd.readAsDataURL(f);
};

/* ----- công cụ Tẩy ----- */
document.addEventListener('pointerdown', e => {
  if (S.tool !== 'eraser') return;
  const slide = e.target.closest('.slide');
  if (!slide) return;
  e.preventDefault();
  if (!eraseAt(slide, e.clientX, e.clientY)) toast('warn', 'Không có nét nào ở chỗ vừa bấm');
});

function eraseAt(slide, cx, cy) {
  const page = +slide.closest('.page').dataset.page;

  // 1) chữ, ảnh, ghim, highlight — bắt theo khung bao, phần tử mới nhất được ưu tiên
  const plain = [...slide.querySelectorAll('.slide-text,.slide-img,.note-pin,.hl-mark')].reverse();
  for (const el of plain) {
    const r = el.getBoundingClientRect();
    if (cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom) { removeAnn(el, page); return true; }
  }

  // 2) nét bút / khoanh — dùng isPointInStroke, nới tạm bề rộng nét cho dễ trúng
  const svg = slide.querySelector('.ink');
  const p = slidePt(slide, { clientX: cx, clientY: cy });
  const pt = svg.createSVGPoint ? svg.createSVGPoint() : new DOMPoint();
  pt.x = p.x; pt.y = p.y;
  for (const el of [...svg.children].reverse()) {
    if (!el.isPointInStroke) continue;
    const w = +el.getAttribute('stroke-width') || 3;
    el.setAttribute('stroke-width', w + 14);
    const hit = el.isPointInStroke(pt);
    el.setAttribute('stroke-width', w);
    if (hit) { removeAnn(el, page); return true; }
  }
  return false;
}

function removeAnn(el, page) {
  // Mọi annotation giờ đều là phần tử độc lập (nét bút, hình khoanh, ô chữ, ảnh,
  // ghim, vệt highlight) nên xoá và hoàn tác chỉ là gỡ ra rồi cắm lại đúng chỗ.
  const parent = el.parentNode, next = el.nextSibling;
  if (el.classList?.contains('note-pin')) {
    S.notes = S.notes.filter(n => (n.text || n.quote) !== el.title);
  }
  el.remove();
  pushUndo(page, 'tẩy', () => parent.insertBefore(el, next));
  syncChrome();
}

function pushUndo(page, label, fn) {
  S.undo.push({ page, label, fn });
  syncChrome();
}

/* ----- highlight ----- */
/* Highlight vẽ lên lớp phủ riêng, KHÔNG đụng vào DOM của text layer.
   Text layer của pdf.js là các <span> định vị tuyệt đối từng mẩu một; cách cũ
   dùng extractContents() rồi bọc <mark> làm chữ bị bứt khỏi span định vị của nó
   nên vệt vàng nhảy về góc trên-trái và chữ hiện lại ở cỡ mặc định.
   Ở đây chỉ đọc hình chữ nhật của vùng chọn rồi vẽ đè lên, quy về % của slide
   để zoom hay đổi kích thước cửa sổ vẫn nằm đúng chỗ. */
function highlightSelection() {
  const sel = window.getSelection();
  if (!sel.rangeCount || sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  const slide = slideOf(range.commonAncestorContainer);
  if (!slide) return null;
  const layer = slide.querySelector('.hl-layer');
  if (!layer) return null;

  const sr = slide.getBoundingClientRect();
  const rects = [...range.getClientRects()].filter(r => r.width > 1 && r.height > 1);
  if (!rects.length) return null;

  const marks = rects.map(r => {
    const el = document.createElement('div');
    el.className = 'hl-mark';
    el.style.left = ((r.left - sr.left) / sr.width * 100) + '%';
    el.style.top = ((r.top - sr.top) / sr.height * 100) + '%';
    el.style.width = (r.width / sr.width * 100) + '%';
    el.style.height = (r.height / sr.height * 100) + '%';
    layer.appendChild(el);
    return el;
  });

  sel.removeAllRanges();
  const page = +slide.closest('.page').dataset.page;
  pushUndo(page, 'highlight', () => marks.forEach(el => el.remove()));
  return { page, marks };
}

/* ----- ghim ghi chú lên slide ----- */
function addPin(note) {
  const slide = $('#pg' + note.page + ' .slide');
  if (!slide) return;
  const pin = document.createElement('div');
  pin.className = 'note-pin' + (note.kind === 'confused' ? ' confused' : '');
  pin.style.left = note.x + '%';
  pin.style.top = note.y + '%';
  pin.textContent = note.kind === 'confused' ? '?' : 'N';
  pin.title = note.text || note.quote;
  pin.onclick = ev => { ev.stopPropagation(); openNotesModal(note.page); };
  slide.appendChild(pin);
  pushUndo(note.page, 'ghi chú', () => {
    pin.remove();
    S.notes = S.notes.filter(n => n.id !== note.id);
    syncChrome();
  });
}

function addNote({ page, kind, quote, text, x = 88, y = 12 }) {
  const note = { id: 'n' + Date.now() + Math.random().toString(36).slice(2, 5), page, kind, quote, text, x, y };
  S.notes.push(note);
  addPin(note);
  syncChrome();
  return note;
}

/* =============================================================
   ★ CÔNG CỤ CHỤP VÙNG (snip)
   ============================================================= */
const snipLayer = $('#snipLayer'), snipBox = $('#snipBox'), snipBar = $('#snipBar');
let snip = null;   // {x,y,w,h} theo toạ độ của viewer
let dragMode = null;

function openSnip() {
  snipLayer.hidden = false;
  snipLayer.classList.add('dim');
  $('#snipHint').hidden = false;
  snipBox.hidden = true;
  snipBar.hidden = true;
  snip = null;
}
function closeSnip() {
  snipLayer.hidden = true;
  snipLayer.classList.remove('dim');
  snipBox.hidden = true;
  snip = null;
  if (S.tool === 'snip') { S.tool = 'read'; $$('.tool[data-tool]').forEach(b => b.classList.toggle('active', b.dataset.tool === 'read')); }
}
function paintSnip() {
  snipBox.style.left = snip.x + 'px';
  snipBox.style.top = snip.y + 'px';
  snipBox.style.width = snip.w + 'px';
  snipBox.style.height = snip.h + 'px';
  $('#snipSize').textContent = Math.round(snip.w) + ' × ' + Math.round(snip.h);
  // thanh nút lật lên trên nếu vùng chọn nằm sát đáy
  const bottomRoom = snipLayer.clientHeight - (snip.y + snip.h);
  snipBar.style.top = bottomRoom < 90 ? 'auto' : 'calc(100% + 12px)';
  snipBar.style.bottom = bottomRoom < 90 ? 'calc(100% + 12px)' : 'auto';
}

snipLayer.addEventListener('pointerdown', e => {
  const r = snipLayer.getBoundingClientRect();
  const handle = e.target.closest('.h');
  const inBar = e.target.closest('.snip-bar');
  if (inBar) return;

  if (handle) {
    dragMode = { type: 'resize', dir: [...handle.classList].find(c => c !== 'h'), start: { ...snip }, px: e.clientX, py: e.clientY };
  } else if (snip && e.target.closest('.snip-box')) {
    dragMode = { type: 'move', start: { ...snip }, px: e.clientX, py: e.clientY };
  } else {
    snip = { x: e.clientX - r.left, y: e.clientY - r.top, w: 0, h: 0 };
    dragMode = { type: 'new', ox: snip.x, oy: snip.y };
    snipBox.hidden = false;
    snipBar.hidden = true;
    $('#snipHint').hidden = true;
    paintSnip();
  }
  try { snipLayer.setPointerCapture(e.pointerId); } catch { }
  e.preventDefault();
});

snipLayer.addEventListener('pointermove', e => {
  if (!dragMode) return;
  const r = snipLayer.getBoundingClientRect();
  if (dragMode.type === 'new') {
    const cx = e.clientX - r.left, cy = e.clientY - r.top;
    snip.x = Math.min(cx, dragMode.ox); snip.y = Math.min(cy, dragMode.oy);
    snip.w = Math.abs(cx - dragMode.ox); snip.h = Math.abs(cy - dragMode.oy);
  } else if (dragMode.type === 'move') {
    const dx = e.clientX - dragMode.px, dy = e.clientY - dragMode.py;
    snip.x = clamp(dragMode.start.x + dx, 0, r.width - snip.w);
    snip.y = clamp(dragMode.start.y + dy, 0, r.height - snip.h);
  } else {
    const dx = e.clientX - dragMode.px, dy = e.clientY - dragMode.py, s = dragMode.start, d = dragMode.dir;
    let { x, y, w, h } = s;
    if (d.includes('w')) { x = s.x + dx; w = s.w - dx; }
    if (d.includes('e')) { w = s.w + dx; }
    if (d.includes('n')) { y = s.y + dy; h = s.h - dy; }
    if (d.includes('s')) { h = s.h + dy; }
    if (w > 24 && h > 24) snip = { x, y, w, h };
  }
  paintSnip();
});

snipLayer.addEventListener('pointerup', () => {
  if (!dragMode) return;
  dragMode = null;
  if (!snip || snip.w < 20 || snip.h < 20) { snipBox.hidden = true; $('#snipHint').hidden = false; snip = null; return; }
  snipBar.hidden = false;
  paintSnip();
});

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* trang nào nằm dưới tâm vùng chọn (tạm tắt lớp phủ để elementFromPoint xuyên qua) */
function pageUnderSnip() {
  if (!snip) return S.page;
  const r = snipLayer.getBoundingClientRect();
  snipLayer.style.pointerEvents = 'none';
  const el = document.elementFromPoint(r.left + snip.x + snip.w / 2, r.top + snip.y + snip.h / 2);
  snipLayer.style.pointerEvents = '';
  const pg = el && el.closest ? el.closest('.page') : null;
  return pg ? +pg.dataset.page : S.page;
}

$('#snipAsk').onclick = async () => {
  const p = pageUnderSnip();
  const w = Math.round(snip.w);
  const h = Math.round(snip.h);
  const relX = Math.round(snip.x);
  const relY = Math.round(snip.y);

  const pageEl = document.getElementById('pg' + p);
  const textLayer = pageEl && pageEl.querySelector('.pdf-text-layer');
  const slideTextContent = textLayer ? (textLayer.textContent || '').trim() : '';
  const imageDataUrl = captureSnipImage(p);

  S.snap = { page: p, w, h, imageDataUrl };
  closeSnip();
  openTutor(true);
  renderAttach();

  // Gửi pixel crop thật + text layer của đúng trang cho backend.
  send(`Giải thích giúp mình vùng vừa chọn ở trang ${p}`, {
    page: p,
    region: true,
    w,
    h,
    x: relX,
    y: relY,
    slideText: slideTextContent.slice(0, 5000),
    imageDataUrl,
  });
};

function captureSnipImage(page) {
  const layerRect = snipLayer.getBoundingClientRect();
  const slide = $(`#pg${page} .slide`);
  const source = slide && slide.querySelector('.pdf-canvas');
  if (!source || !source.width || !snip) return null;
  const slideRect = slide.getBoundingClientRect();
  const selected = {
    left: layerRect.left + snip.x,
    top: layerRect.top + snip.y,
    right: layerRect.left + snip.x + snip.w,
    bottom: layerRect.top + snip.y + snip.h,
  };
  const left = Math.max(selected.left, slideRect.left);
  const top = Math.max(selected.top, slideRect.top);
  const right = Math.min(selected.right, slideRect.right);
  const bottom = Math.min(selected.bottom, slideRect.bottom);
  if (right <= left || bottom <= top) return null;

  const sx = (left - slideRect.left) * source.width / slideRect.width;
  const sy = (top - slideRect.top) * source.height / slideRect.height;
  const sw = (right - left) * source.width / slideRect.width;
  const sh = (bottom - top) * source.height / slideRect.height;
  const scale = Math.min(1, 1200 / Math.max(sw, sh));
  const output = document.createElement('canvas');
  output.width = Math.max(1, Math.round(sw * scale));
  output.height = Math.max(1, Math.round(sh * scale));
  output.getContext('2d').drawImage(source, sx, sy, sw, sh, 0, 0, output.width, output.height);
  return output.toDataURL('image/jpeg', .86);
}
$('#snipNote').onclick = () => {
  const p = pageUnderSnip();
  const box = { ...snip };
  closeSnip();
  openNoteEditor({ page: p, quote: `Vùng ảnh ${Math.round(box.w)}×${Math.round(box.h)}px trên slide`, x: 88, y: 12 });
};
$('#snipCopy').onclick = () => {
  toast('ok', `Đã sao chép vùng ${Math.round(snip.w)}×${Math.round(snip.h)}px (mock — chưa render ảnh thật)`);
  closeSnip();
};
$('#snipCancel').onclick = () => closeSnip();

/* =============================================================
   POPUP KHI BÔI ĐEN
   ============================================================= */
const selPopup = $('#selPopup');
const slideOf = node => {
  const el = node && (node.nodeType === 1 ? node : node.parentElement);
  return el ? el.closest('.slide') : null;
};
document.addEventListener('mouseup', e => {
  if (S.tool === 'pen' || S.tool === 'snip') return;
  if (e.target.closest('.sel-popup')) return;
  setTimeout(() => {
    const sel = window.getSelection();
    const txt = sel.toString().trim();
    const slide = sel.rangeCount ? slideOf(sel.getRangeAt(0).startContainer) : null;
    if (!txt || !slide) { selPopup.hidden = true; return; }

    if (S.tool === 'hl') { const r = highlightSelection(); if (r) toast('ok', 'Đã highlight'); selPopup.hidden = true; return; }

    const rect = sel.getRangeAt(0).getBoundingClientRect();
    const sr = slide.getBoundingClientRect();
    S.selQuote = txt;
    S.selPos = {
      page: +slide.closest('.page').dataset.page,
      x: clamp(((rect.left + rect.width / 2 - sr.left) / sr.width) * 100, 4, 96),
      y: clamp(((rect.top - sr.top) / sr.height) * 100, 6, 94),
    };
    selPopup.hidden = false;
    const pw = selPopup.offsetWidth, ph = selPopup.offsetHeight;
    selPopup.style.left = clamp(rect.left + rect.width / 2 - pw / 2, 10, innerWidth - pw - 10) + 'px';
    selPopup.style.top = (rect.top - ph - 10 > 84 ? rect.top - ph - 10 : rect.bottom + 10) + 'px';
  }, 0);
});
document.addEventListener('mousedown', e => {
  if (!e.target.closest('.sel-popup')) selPopup.hidden = true;
  if (!e.target.closest('#moreMenu') && !e.target.closest('#btnDocMenu')) $('#moreMenu').hidden = true;
  if (!e.target.closest('.ask-popup') && !e.target.closest('.sel-popup') && !e.target.closest('.snip-bar')) closeAskPopup();
});

$('#spAsk').onclick = () => {
  const rect = selPopup.getBoundingClientRect();
  selPopup.hidden = true;
  openAskPopup(`Giải thích đoạn bôi đen ở Trang ${S.selPos.page}...`, { page: S.selPos.page, quote: S.selQuote },
    rect.left + rect.width / 2, rect.top);
  window.getSelection().removeAllRanges();
};
$('#spConfused').onclick = () => {
  selPopup.hidden = true;
  const n = addNote({ page: S.selPos.page, kind: 'confused', quote: S.selQuote, text: 'Đã báo bối rối', x: S.selPos.x, y: S.selPos.y });
  toast('warn', `Đã gửi tín hiệu bối rối ở trang ${n.page} cho giảng viên`);
  window.getSelection().removeAllRanges();
};
$('#spNote').onclick = () => {
  selPopup.hidden = true;
  openNoteEditor({ page: S.selPos.page, quote: S.selQuote, x: S.selPos.x, y: S.selPos.y });
  window.getSelection().removeAllRanges();
};

/* =============================================================
   ASK POPUP — cho sửa query trước khi gửi
   ============================================================= */
const askPopup = $('#askPopup');
let askOpts = {};

function openAskPopup(defaultQuery, opts, cx, cy) {
  askOpts = opts;
  $('#askPageLabel').textContent = `TRANG ${opts.page || S.page}`;
  $('#askInput').value = defaultQuery;
  askPopup.hidden = false;
  // vị trí popup: canh giữa ngang, trên vùng bấm
  const pw = askPopup.offsetWidth, ph = askPopup.offsetHeight;
  askPopup.style.left = clamp(cx - pw / 2, 10, innerWidth - pw - 10) + 'px';
  askPopup.style.top = (cy - ph - 12 > 84 ? cy - ph - 12 : cy + 12) + 'px';
  setTimeout(() => $('#askInput').focus(), 30);
}
function closeAskPopup() {
  askPopup.hidden = true;
}
function submitAskPopup() {
  const q = $('#askInput').value.trim();
  if (!q) return;
  closeAskPopup();
  openTutor(true);
  if (S.snap) renderAttach();
  send(q, askOpts);
}
$('#askSend').onclick = submitAskPopup;
$('#askClose').onclick = closeAskPopup;
$('#askInput').addEventListener('keydown', e => { if (e.key === 'Enter') submitAskPopup(); });

/* =============================================================
   TUTOR CHAT
   ============================================================= */
/* ---- AI_CALL: DeepSeek Agent với 6 Tool Calls ---- */

// Fallback mock khi không có API key
function mockAnswer(q, opts = {}) {
  const s = q.toLowerCase();
  if (opts.region) return withPage(ANSWERS.region, opts.page);
  if (/deadline|hạn nộp|nộp bài|điểm số|bao nhiêu điểm|link nộp/.test(s)) return ANSWERS.outofscope;
  if (s.replace(/[^a-zà-ỹ0-9]/gi, '').length < 12) return ANSWERS.clarify;
  if (/yếu tố|framework|6\+3|actor|boundary|trang 67/.test(s)) return ANSWERS.framework;
  if (/rule|workflow|agent|cấp độ/.test(s)) return ANSWERS.levels;
  if (/problem statement|lát cắt|một câu|viết bài toán/.test(s)) return ANSWERS.statement;
  if (/lịch sử|nguồn gốc|ai phát minh|năm nào|tác giả gốc/.test(s)) return ANSWERS.lowconf;
  return withPage(ANSWERS.generic, opts.page || S.page);
}

function withPage(a, p) {
  return {
    ...a,
    body: a.body.map(x => x.replaceAll('{p}', p)),
    sources: (a.sources || []).map(s => ({ ...s, page: s.page || p })),
  };
}

// Production path: browser talks only to the same-origin backend.
const MOCK_MODE = new URLSearchParams(location.search).get('mock') === '1';

async function callBackendAgent(question, opts = {}) {
  const response = await fetch('/api/agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question,
      document: DOC.file,
      page: opts.page || S.page,
      selected_text: opts.quote || '',
      slide_text: opts.slideText || '',
      image_data_url: opts.imageDataUrl || null,
      region: opts.region ? { x: opts.x, y: opts.y, w: opts.w, h: opts.h } : null,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Backend trả lỗi ${response.status}`);
  return data;
}

// UNUSED LEGACY DIRECT-API IMPLEMENTATION.
// Kept temporarily for diff archaeology; send() never calls this block.
// The only supported production path is callBackendAgent() above.

async function send(text, opts = {}) {
  if (S.busy || !text.trim()) return;
  const page = opts.page || S.page;
  S.chat.push({ role: 'user', text, ctxPage: page, snap: S.snap });
  S.snap = null; renderAttach();
  renderChat();

  const failing = S.simFail;
  S.simFail = false;
  S.busy = true;
  S.chat.push({ role: 'typing' });
  renderChat();

  // Dùng setTimeout để render typing bubble trước khi thực thi async
  await new Promise(r => setTimeout(r, 50));

  try {
    if (failing) throw new Error('simulated network error');

    let a;
    if (MOCK_MODE) {
      await new Promise(r => setTimeout(r, 900 + Math.random() * 500));
      a = mockAnswer(text, { ...opts, page });
    } else {
      a = await callBackendAgent(text, { ...opts, page });
    }

    // Xóa typing bubble và hiển thị kết quả
    S.chat.pop();
    S.chat.push({ role: 'ai', data: a, ctxPage: page });
  } catch (err) {
    console.error('Agent error:', err);
    // Xóa typing bubble và hiển lỗi thực sự (không chỉ "mô phỏng")
    S.chat.pop();
    S.chat.push({ role: 'ai', error: true, errMsg: err.message, retry: { text, opts } });
  } finally {
    S.busy = false;
    renderChat();
  }
}

function confLabel(c) {
  const L = t('trust');
  return c >= 75 ? L[0] : c >= 50 ? L[1] : L[2];
}

/* =============================================================
   THỬ THÁCH TRANG NÀY (quiz)
   ============================================================= */

async function requestQuiz(forPage) {
  if (S.busy) return;
  const page = forPage || S.page;
  // Nút nằm trên đầu trang nên panel trợ lý có thể đang đóng — mở ra để học viên
  // thấy được thẻ quiz vừa sinh, nếu không thì bấm xong tưởng như không có gì xảy ra.
  openTutor(true);
  S.chat.push({ role: 'user', text: `⚡ Thử thách trang ${page}`, ctxPage: page });
  S.busy = true;
  S.chat.push({ role: 'typing' });
  renderChat();
  await new Promise(r => setTimeout(r, 50));
  try {
    const res = await fetch('/api/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ document: DOC.file, page, mode: 'quiz', question: '' }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Backend trả lỗi ${res.status}`);
    S.chat.pop();
    // picked giữ lựa chọn của học viên để render lại không mất; flagged giữ câu đã báo sai đề.
    S.chat.push({ role: 'ai', data, ctxPage: page, picked: {}, flagged: {}, qzId: ++S.qzSeq });
  } catch (err) {
    S.chat.pop();
    S.chat.push({ role: 'ai', error: true, errMsg: err.message, retry: { quiz: true } });
  } finally {
    S.busy = false;
    renderChat();
  }
}

function quizCard(a, m, i) {
  const qs = a.questions || [];
  if (!qs.length) {
    return `<div class="msg-ai">
      <div class="ai-meta"><span class="state warn">CHƯA RA ĐƯỢC ĐỀ</span></div>
      <div class="bubble"><p>${esc(a.note || 'Trang này chưa đủ nội dung để ra đề.')}</p></div></div>`;
  }
  const picked = m.picked || (m.picked = {});
  const answered = qs.filter((q, k) => picked[k] !== undefined).length;
  const right = qs.filter((q, k) => picked[k] === q.correct).length;
  const nDrop = (a.dropped || []).length;

  const blocks = qs.map((q, k) => {
    const p = picked[k];
    const done = p !== undefined;
    const opts = q.options.map((o, j) => {
      let cls = '';
      if (done) {
        if (j === q.correct) cls = ' right';
        else if (j === p) cls = ' wrong';
        else cls = ' dim';
      }
      return `<button class="qz-opt${cls}" ${done ? 'disabled' : ''} data-qpick="${i}:${k}:${j}">
        <span class="qz-ltr">${String.fromCharCode(65 + j)}</span><span>${esc(o)}</span></button>`;
    }).join('');

    let fb = '';
    if (done) {
      const ok = p === q.correct;
      // why_wrong xếp theo 3 phương án SAI, đã bỏ qua phương án đúng.
      const why = ok ? '' : (q.why_wrong || [])[p > q.correct ? p - 1 : p] || '';
      const fromSlide = q.origin === 'slide';
      fb = `<div class="qz-fb ${ok ? 'ok' : 'no'}">
        <div class="qz-verdict">${ok ? '✓ Chính xác' : '✗ Chưa đúng'}${why ? ' — ' + esc(why) : ''}</div>
        <div class="qz-src${fromSlide ? ' clickable' : ''}" ${fromSlide ? `data-qgoto="${q.page}" data-qquote="${esc(q.excerpt)}"` : ''}>
          <span class="qz-src-tag">${fromSlide ? `slide · trang ${q.page}` : 'lời giảng của thầy'}</span>
          <span class="qz-src-q">${esc(q.excerpt)}</span>
          ${fromSlide ? '<span class="qz-src-go">xem trên slide →</span>' : ''}
        </div></div>`;
    }
    const flagged = (m.flagged || {})[k];
    return `<div class="qz-q">
      <div class="qz-head"><b>Câu ${k + 1}</b>
        <button class="qz-flag${flagged ? ' on' : ''}" data-qflag="${i}:${k}">${flagged ? 'đã báo' : 'câu này sai đề'}</button>
      </div>
      <div class="qz-text">${esc(q.q)}</div>
      <div class="qz-opts">${opts}</div>${fb}</div>`;
  }).join('');

  return `<div class="msg-ai">
    <div class="ai-meta">
      <span class="state">THỬ THÁCH · TRANG ${a.page}</span>
      <span class="qz-score">${right}/${qs.length} đúng</span>
    </div>
    <div class="bubble qz">
      <div class="qz-bar"><i style="width:${Math.round(100 * answered / qs.length)}%"></i></div>
      <div class="qz-note">Ra được ${qs.length} câu${nDrop ? ` · ${nDrop} câu bị loại vì không đối chiếu được với học liệu` : ''}</div>
      ${blocks}
    </div></div>`;
}

/* Dựng Range cho một đoạn chữ bất kỳ trong text layer của pdf.js.
   Text layer là hàng trăm <span> rời nhau nên phải ghép phẳng lại kèm bảng ánh xạ
   ngược về (node, offset) thì mới đặt được Range. Khoảng trắng bị gộp về 1 dấu cách
   vì chữ do pypdf lấy ở backend và chữ pdf.js dựng ở frontend chỉ khác nhau chỗ đó. */
function rangeForText(pageEl, needle) {
  const layer = pageEl && pageEl.querySelector('.pdf-text-layer');
  if (!layer || !needle) return null;
  let flat = '';
  const map = [];
  const push = (ch, node, off) => {
    if (/\s/.test(ch)) {
      if (flat.endsWith(' ')) return;
      ch = ' ';
    }
    flat += ch; map.push({ node, off });
  };
  for (const span of layer.querySelectorAll('span')) {
    const tn = span.firstChild;
    if (!tn || tn.nodeType !== 3) continue;
    for (let k = 0; k < tn.nodeValue.length; k++) push(tn.nodeValue[k], tn, k);
    push(' ', tn, tn.nodeValue.length);
  }
  const hay = flat.toLowerCase();
  const norm = needle.replace(/\s+/g, ' ').trim().toLowerCase();
  let at = hay.indexOf(norm), len = norm.length;
  if (at < 0) {
    // Không khớp trọn thì bám 8 từ đầu — đủ để chỉ đúng chỗ cho học viên nhìn.
    const head = norm.split(' ').slice(0, 8).join(' ');
    at = hay.indexOf(head); len = head.length;
  }
  if (at < 0 || !map[at] || !map[at + len - 1]) return null;
  const range = document.createRange();
  range.setStart(map[at].node, map[at].off);
  range.setEnd(map[at + len - 1].node, map[at + len - 1].off + 1);
  return range;
}

/* Che mờ slide khi còn câu chưa trả lời — thấy slide thì bài thử thách thành bài
   đọc hiểu. Có nút xin xem để học viên tự quyết, không khoá cứng. */
function updateQuizFocus() {
  const veil = $('#quizVeil');
  if (!veil) return;
  let active = null;
  for (let k = S.chat.length - 1; k >= 0; k--) {
    const m = S.chat[k];
    if (m.role === 'ai' && m.data && m.data.kind === 'quiz' && (m.data.questions || []).length) {
      active = m; break;
    }
  }
  const left = active
    ? active.data.questions.filter((q, k) => (active.picked || {})[k] === undefined).length
    : 0;
  const on = !!active && left > 0 && !active.peeked;
  veil.hidden = !on;
  if (on) $('#quizVeilLeft').textContent = left;
  S.quizVeilFor = on ? active : null;
}

/* Vẽ vệt tô sáng cho một đoạn chữ trên trang. Trả về mảng phần tử đã vẽ (rỗng nếu
   không định vị được). reviewId dùng để sau này gỡ đúng vệt của một ghi chú. */
function paintQuote(page, quote, cls, reviewId) {
  const pageEl = $('#pg' + page);
  const slide = pageEl && pageEl.querySelector('.slide');
  const layer = slide && slide.querySelector('.hl-layer');
  const range = rangeForText(pageEl, quote);
  if (!range || !layer) return [];
  const sr = slide.getBoundingClientRect();
  return [...range.getClientRects()]
    .filter(r => r.width > 1 && r.height > 1)
    .map(r => {
      const el = document.createElement('div');
      el.className = 'hl-mark ' + cls;
      if (reviewId) el.dataset.review = reviewId;
      el.style.left = ((r.left - sr.left) / sr.width * 100) + '%';
      el.style.top = ((r.top - sr.top) / sr.height * 100) + '%';
      el.style.width = (r.width / sr.width * 100) + '%';
      el.style.height = (r.height / sr.height * 100) + '%';
      layer.appendChild(el);
      return el;
    });
}

function flashQuoteOnPage(page, quote) {
  goPage(page);
  setTimeout(() => {
    const marks = paintQuote(page, quote, 'flash');
    if (!marks.length) return toast('warn', 'Không định vị được câu này trên trang');
    setTimeout(() => marks.forEach(el => el.remove()), 4200);
  }, 620);
}

/* ---- Ôn lỗi sai sau khi làm xong cả bộ ----
   Cố ý KHÔNG hiện ngay lúc chọn sai: thấy đáp án giữa chừng thì mấy câu sau không
   còn là kiểm tra nữa. Chỉ khi trả lời hết mới gom các câu sai ra giấy bên cạnh. */
function showQuizReview(msg) {
  const qs = msg.data.questions || [];
  const wrong = qs.map((q, k) => ({ q, k })).filter(({ q, k }) => msg.picked[k] !== q.correct);
  if (!wrong.length) return toast('ok', `Đúng cả ${qs.length} câu — không có gì phải ôn lại`);

  const pages = new Set();
  wrong.forEach(({ q, k }) => {
    const p = q.page || msg.ctxPage;
    const id = `rv${msg.qzId}_${k}`;
    if ((S.review[p] || []).some(it => it.id === id)) return;
    const picked = msg.picked[k];
    (S.review[p] = S.review[p] || []).push({
      id,
      question: q.q,
      why: (q.why_wrong || [])[picked > q.correct ? picked - 1 : picked] || '',
      chose: q.options[picked],
      answer: q.options[q.correct],
      excerpt: q.excerpt,
      origin: q.origin,
    });
    pages.add(p);
  });

  const first = Math.min(...pages);
  goPage(first);
  setTimeout(() => {
    pages.forEach(p => {
      renderPad(p);
      (S.review[p] || []).forEach(it => {
        if (it.origin === 'slide') paintQuote(p, it.excerpt, 'miss', it.id);
      });
    });
  }, 640);
  toast('warn', `${wrong.length} câu sai — ghi chú đã dán vào giấy cạnh slide`);
}

function renderPad(page) {
  const pad = document.querySelector(`.notepad[data-pad="${page}"]`);
  if (!pad) return;
  const items = S.review[page] || [];
  pad.innerHTML = `
    ${items.map(it => `
      <div class="pad-note" data-note="${it.id}">
        <div class="pad-tag">Chỗ này bạn còn nhầm</div>
        <div class="pad-q">${esc(it.question)}</div>
        <div class="pad-row"><s>${esc(it.chose)}</s></div>
        <div class="pad-row"><b>${esc(it.answer)}</b></div>
        ${it.why ? `<div class="pad-why">${esc(it.why)}</div>` : ''}
        <div class="pad-quote">${esc(it.excerpt)}</div>
        <button class="pad-ok" data-noteok="${it.id}">Tôi đã hiểu lỗi sai rồi</button>
      </div>`).join('')}
    <textarea class="pad-write" data-write="${page}"
      placeholder="Ghi chú của bạn cho trang ${page}...">${esc(S.pad[page] || '')}</textarea>`;
}

function dismissReview(id) {
  for (const p of Object.keys(S.review)) {
    const before = S.review[p].length;
    S.review[p] = S.review[p].filter(it => it.id !== id);
    if (S.review[p].length !== before) {
      $$(`#pg${p} .hl-mark[data-review="${id}"]`).forEach(el => el.remove());
      renderPad(+p);
    }
  }
}

function renderChat() {
  const box = $('#chat');
  box.innerHTML = S.chat.map((m, i) => {
    if (m.role === 'user') {
      const att = m.snap ? `<div class="snap-att"><span class="thumb"></span>Vùng ảnh ${m.snap.w}×${m.snap.h}px · trang ${m.snap.page}</div>` : '';
      return `<div style="align-self:flex-end;max-width:88%">${att}<div class="msg-user">${esc(m.text)}</div></div>`;
    }
    if (m.role === 'typing') {
      return `<div class="msg-ai">
        <div class="ai-meta"><span class="state warn">${t('asking')}</span></div>
        <div class="bubble"><div class="typing"><i></i><i></i><i></i></div></div></div>`;
    }
    if (m.error) {
      const isCors = (m.errMsg || '').toLowerCase().includes('failed to fetch') || (m.errMsg || '').toLowerCase().includes('network');
      const isSimulated = (m.errMsg || '').includes('simulated');
      let hint = '';
      if (isCors) hint = `<p style="font-size:11px;color:var(--fg2);margin:4px 0 0">Hãy chạy ứng dụng bằng <code>python3 codebase/server.py</code>, không mở file HTML trực tiếp.</p>`;
      else if (m.errMsg && !isSimulated) hint = `<p style="font-size:11px;color:var(--fg2);margin:4px 0 0">Chi tiết: ${esc(m.errMsg)}</p>`;
      const label = isSimulated ? 'Mô phỏng lỗi mạng' : isCors ? 'Lỗi kết nối' : 'Lỗi Agent';
      return `<div class="msg-ai">
        <div class="ai-meta"><span class="state err">${label}</span></div>
        <div class="bubble"><p>Không gọi được trợ lý. Câu hỏi của bạn vẫn được giữ nguyên.</p>${hint}
        <div class="chips"><button class="qchip" data-retry="${i}">${t('retry')}</button><button class="qchip" data-ai-status>Kiểm tra cấu hình AI</button></div></div></div>`;
    }
    const a = m.data;
    if (a.kind === 'quiz') return quizCard(a, m, i);
    const isClarify = a.kind === 'clarify', isRefuse = a.kind === 'refuse', low = a.conf > 0 && a.conf < 60;
    const meta = isClarify || isRefuse
      ? `<div class="ai-meta"><span class="state warn">${isRefuse ? 'NGOÀI PHẠM VI' : 'CẦN LÀM RÕ'}</span></div>`
      : `<div class="ai-meta">
          <div class="conf${low ? ' low' : ''}"><div class="conf-bar"><i style="width:${a.conf}%"></i></div>
          <span class="conf-txt">${a.conf}% · ${confLabel(a.conf)}</span></div>
          <span class="state${low ? ' warn' : ''}">${low ? t('lowconf') : t('answered')}</span>
        </div>`;

    // Nguồn nào đối chiếu được với text thật của trang thì hiện bình thường;
    // nguồn chưa đối chiếu được phải nhìn ra ngay là chưa kiểm chứng, không
    // được để nó trông giống hệt nguồn đã xác minh.
    const nUnver = (a.sources || []).filter(s => s.verified === false).length;
    const srcs = (a.sources || []).length ? `
      <div class="sources open">
        <button class="src-head" data-src>${ICO.ext}<span>${a.sources.length} ${t('srcOne')}</span>
          ${nUnver ? `<span class="src-warn">${nUnver} chưa đối chiếu</span>` : ''}
          <span class="car">${ICO.caret}</span></button>
        <div class="src-body">${a.sources.map((s, k) => `
          <div class="src-card${s.verified === false ? ' unverified' : ''}" data-goto="${s.page}">
            <div class="src-top"><span class="src-n">${k + 1}</span>
            <span class="src-pg">${ICO.book} Tr.${s.page}${s.verified === false
              ? ' · <b>chưa đối chiếu được</b>' : ' · đã đối chiếu'}</span></div>
            <div class="src-q">${esc(s.text)}</div>
          </div>`).join('')}</div>
      </div>` : '';

    const chips = a.chips ? `<div class="chips">${a.chips.map(c => `<button class="qchip" data-ask="${esc(c)}">${c}</button>`).join('')}</div>` : '';
    const acts = a.actions ? `<div class="chips">${a.actions.map(c => `<button class="qchip" data-act2="${esc(c)}">${c}</button>`).join('')}</div>` : '';

    const fb = (isClarify || isRefuse) ? '' : `
      <div class="feedback"><span>${t('helpful')}</span>
        <button class="fb up" data-fb="${i}:up">${ICO.thumbUp}</button>
        <button class="fb down" data-fb="${i}:down">${ICO.thumbDown}</button>
      </div>`;

    return `<div class="msg-ai">
      ${meta}
      ${m.ctxPage ? `<div class="ctx-line">${t('ctx')}: Slide trang ${m.ctxPage}</div>` : ''}
      <div class="bubble">${a.body.map(p => `<p>${linkCites(p)}</p>`).join('')}${chips}${acts}${srcs}${fb}</div>
    </div>`;
  }).join('');

  box.scrollTop = box.scrollHeight;
  wireChat();
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const linkCites = s => s.replace(/\[trang (\d+)\]/g, (_, n) => `<span class="cite" data-goto="${n}">[trang ${n}]</span>`);

function wireChat() {
  $$('#chat [data-goto]').forEach(el => el.onclick = () => {
    goPage(+el.dataset.goto);
    toast('ok', 'Đã nhảy tới trang ' + el.dataset.goto);
  });
  $$('#chat [data-src]').forEach(b => b.onclick = () => b.closest('.sources').classList.toggle('open'));
  $$('#chat [data-ask]').forEach(b => b.onclick = () => send(b.dataset.ask));
  $$('#chat [data-act2]').forEach(b => b.onclick = () => toast('ok', `"${b.dataset.act2}" — luồng này chưa nối ở CP2`));
  $$('#chat [data-retry]').forEach(b => b.onclick = () => {
    const m = S.chat[+b.dataset.retry];
    S.chat.splice(+b.dataset.retry, 1);
    renderChat();
    if (m.retry && m.retry.quiz) requestQuiz();
    else send(m.retry.text, m.retry.opts);
  });
  $$('#chat [data-fb]').forEach(b => b.onclick = () => {
    const [, dir] = b.dataset.fb.split(':');
    const row = b.closest('.feedback');
    $$('.fb', row).forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    toast(dir === 'up' ? 'ok' : 'warn', dir === 'up' ? 'Cảm ơn phản hồi!' : 'Đã ghi nhận — câu này sẽ được TA rà lại');
  });
  $$('#chat [data-ai-status]').forEach(b => b.onclick = showAiStatus);

  $$('#chat [data-qpick]').forEach(b => b.onclick = () => {
    const [mi, qi, oi] = b.dataset.qpick.split(':').map(Number);
    const msg = S.chat[mi];
    if (!msg || (msg.picked || {})[qi] !== undefined) return;
    (msg.picked = msg.picked || {})[qi] = oi;
    renderChat();
    const qs = msg.data.questions || [];
    if (qs.every((q, k) => msg.picked[k] !== undefined)) showQuizReview(msg);
  });
  $$('#chat [data-qflag]').forEach(b => b.onclick = () => {
    const [mi, qi] = b.dataset.qflag.split(':').map(Number);
    const msg = S.chat[mi];
    if (!msg) return;
    (msg.flagged = msg.flagged || {})[qi] = true;
    renderChat();
    toast('warn', 'Đã ghi nhận — câu này sẽ được rà lại');
  });
  $$('#chat [data-qgoto]').forEach(el => el.onclick = () =>
    flashQuoteOnPage(+el.dataset.qgoto, el.dataset.qquote));

  updateQuizFocus();
}

function renderAttach() {
  const row = $('#attachRow');
  if (!S.snap) { row.hidden = true; row.innerHTML = ''; return; }
  row.hidden = false;
  row.innerHTML = `<div class="snap-att"><span class="thumb"></span>
    Vùng ảnh ${S.snap.w}×${S.snap.h}px · trang ${S.snap.page}
    <button id="dropSnap"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>`;
  $('#dropSnap').onclick = () => { S.snap = null; renderAttach(); };
}

function openTutor(force) {
  const w = $('#workspace');
  if (force) w.classList.remove('tutor-off');
  else w.classList.toggle('tutor-off');
}

/* =============================================================
   MODAL / TOAST
   ============================================================= */
function openModal(title, bodyHTML, footHTML) {
  $('#modalTitle').textContent = title;
  $('#modalBody').innerHTML = bodyHTML;
  $('#modalFoot').innerHTML = footHTML || `<button class="btn" data-close>${t('close')}</button>`;
  $('#backdrop').hidden = false;
  $$('#modal [data-close]').forEach(b => b.onclick = closeModal);
}
const closeModal = () => { $('#backdrop').hidden = true; };
$('#modalClose').onclick = closeModal;
$('#backdrop').onclick = e => { if (e.target.id === 'backdrop') closeModal(); };

function openNoteEditor(base) {
  openModal('Ghi chú · trang ' + base.page,
    `<div class="note-row"><span class="pg">Tr.${base.page}</span>
      <div class="bd"><div class="qt">“${esc(base.quote)}”</div></div></div>
     <textarea class="note-input" id="noteText" placeholder="Viết ghi chú của bạn..."></textarea>`,
    `<button class="btn" data-close>${t('cancel')}</button>
     <button class="btn primary" id="noteSave">${t('save')}</button>`);
  setTimeout(() => $('#noteText').focus(), 30);
  $('#noteSave').onclick = () => {
    const txt = $('#noteText').value.trim();
    addNote({ ...base, kind: 'note', text: txt || '(không có nội dung)' });
    closeModal();
    toast('ok', 'Đã lưu ghi chú ở trang ' + base.page);
  };
}

function openNotesModal(page) {
  const list = page ? S.notes.filter(n => n.page === page) : S.notes;
  const body = list.length ? list.map(n => `
    <div class="note-row"><span class="pg">Tr.${n.page}</span>
      <div class="bd"><div class="qt">“${esc(n.quote)}”</div><div>${esc(n.text)}</div></div>
    </div>`).join('')
    : `<div class="note-empty">Chưa có ghi chú nào. Bôi đen một đoạn trên slide rồi bấm <b>Ghi chú</b>.</div>`;
  openModal(`Ghi chú của bạn (${S.notes.length})`, body,
    `<button class="btn" data-close>${t('close')}</button>
     <button class="btn primary" id="expNotes">Xuất .md</button>`);
  $('#expNotes').onclick = () => { closeModal(); exportNotes(); };
}

function exportNotes() {
  if (!S.notes.length) return toast('warn', 'Chưa có ghi chú nào để xuất');
  const md = `# Ghi chú · ${DOC.file}\n\n` + S.notes
    .sort((a, b) => a.page - b.page)
    .map(n => `## Trang ${n.page}${n.kind === 'confused' ? ' · BỐI RỐI' : ''}\n> ${n.quote}\n\n${n.text}\n`).join('\n');
  const url = URL.createObjectURL(new Blob([md], { type: 'text/markdown' }));
  const a = document.createElement('a');
  a.href = url; a.download = 'vlearn-notes.md'; a.click();
  URL.revokeObjectURL(url);
  toast('ok', 'Đã xuất ' + S.notes.length + ' ghi chú ra file .md');
}

function toast(kind, msg) {
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.innerHTML = (ICO[kind] || ICO.ok) + '<span>' + esc(msg) + '</span>';
  $('#toasts').appendChild(el);
  setTimeout(() => { el.style.opacity = 0; el.style.transition = '.3s'; }, 2400);
  setTimeout(() => el.remove(), 2750);
}

/* =============================================================
   WIRING
   ============================================================= */
$$('.tool[data-tool]').forEach(b => b.onclick = () => setTool(b.dataset.tool));

/* "..." trên toolbar = bật/tắt thanh công cụ phụ (Khoanh · Text · Ảnh · Tẩy) */
$('#btnMore').onclick = () => { S.moreOpen = !S.moreOpen; updateSubbar(); };

/* các tuỳ chọn của tài liệu chuyển lên nút ⋮ ở thanh trên cùng */
$('#btnDocMenu').onclick = e => {
  const m = $('#moreMenu');
  const r = e.currentTarget.getBoundingClientRect();
  m.hidden = !m.hidden;
  m.style.left = Math.min(r.left, innerWidth - 270) + 'px';
  m.style.top = (r.bottom + 8) + 'px';
};
$$('#moreMenu button').forEach(b => b.onclick = () => {
  $('#moreMenu').hidden = true;
  const a = b.dataset.act;
  if (a === 'fit') { S.zoom = 1; applyZoom(); toast('ok', 'Đã đưa về 100%'); }
  else if (a === 'fs') { document.documentElement.requestFullscreen?.().catch(() => { }); }
  else if (a === 'print') window.print();
  else if (a === 'info') openModal('Thông tin tài liệu',
    `<p><b>Tên file:</b> ${DOC.file}<br><b>Môn:</b> ${DOC.course}<br><b>Mã tài liệu:</b> ${DOC.code}<br>
     <b>Số trang:</b> ${DOC.totalPages}<br><b>Giảng viên:</b> ${DOC.instructor}</p>
     <p><b>Mức prototype:</b> CP3 — PDF thật, backend AI thật; chỉ dùng mock khi URL có <code>?mock=1</code>.</p>`);
  else if (a === 'report') openModal('Báo lỗi tài liệu',
    `<textarea class="note-input" placeholder="Mô tả lỗi bạn gặp ở trang ${S.page}..."></textarea>`,
    `<button class="btn" data-close>${t('cancel')}</button><button class="btn primary" data-close>Gửi</button>`);
  else if (a === 'simfail') { S.simFail = true; toast('warn', 'Câu hỏi kế tiếp sẽ mô phỏng lỗi mạng'); }
});

function applyZoom() {
  document.documentElement.style.setProperty('--zoom', S.zoom);
  syncChrome();
}
$('#zoomIn').onclick = () => { S.zoom = Math.min(2, +(S.zoom + .09).toFixed(2)); applyZoom(); };
$('#zoomOut').onclick = () => { S.zoom = Math.max(.5, +(S.zoom - .09).toFixed(2)); applyZoom(); };

function setPenSize(v, quiet) {
  S.penSize = Math.min(12, Math.max(1, v));
  $('#penRange').value = S.penSize;
  if (!quiet) toast('ok', 'Cỡ bút: ' + S.penSize + 'px');
}
$('#penUp').onclick = () => setPenSize(S.penSize + 1);
$('#penDown').onclick = () => setPenSize(S.penSize - 1);
$('#penRange').oninput = e => setPenSize(+e.target.value, true);
$('#btnDownload').onclick = () => toast('ok', 'Đang tải ' + DOC.file + ' (mock)');
$('#btnExport').onclick = exportNotes;
$('#btnUndo').onclick = () => {
  const u = S.undo.pop();
  if (!u) return;
  u.fn(); syncChrome();
  toast('ok', 'Đã hoàn tác: ' + u.label);
};
$('#btnClear').onclick = () => {
  const pg = $('#pg' + S.page);
  openModal('Xoá annotation trang ' + S.page + '?',
    `<p>Toàn bộ nét bút, highlight và ghim ghi chú trên trang ${S.page} sẽ bị xoá. Không hoàn tác được.</p>`,
    `<button class="btn" data-close>${t('cancel')}</button><button class="btn primary" id="doClear">Xoá</button>`);
  $('#doClear').onclick = () => {
    $$('.ink > *', pg).forEach(p => p.remove());
    $$('.note-pin, .slide-text, .slide-img, .hl-mark', pg).forEach(p => p.remove());
    S.notes = S.notes.filter(n => n.page !== S.page);
    S.undo = S.undo.filter(u => u.page !== S.page);
    closeModal(); syncChrome();
    toast('ok', 'Đã xoá annotation trang ' + S.page);
  };
};



$('#tglSidebar').onclick = () => { S.sideManual = true; $('#workspace').classList.toggle('side-off'); };
$('#tglTutor').onclick = () => { S.tutorManual = true; openTutor(false); };

/* Dưới một bề rộng nhất định thì hai panel ăn hết chỗ của khung xem, nên tự thu gọn.
   Chỉ tự động khi người dùng CHƯA tự bấm nút ẩn/hiện — bấm rồi thì tôn trọng lựa chọn
   của họ, không tự bật lại khi resize. */
function fitPanels() {
  const w = $('#workspace'), vw = window.innerWidth;
  if (!S.sideManual) w.classList.toggle('side-off', vw < 1080);
  if (!S.tutorManual) w.classList.toggle('tutor-off', vw < 860);
}
fitPanels();
addEventListener('resize', fitPanels);

async function updateAiBadge() {
  const badge = document.getElementById('aiModeBadge');
  if (!badge) return;
  if (MOCK_MODE) {
    badge.textContent = '🔵 MOCK CÓ CHỦ ĐÍCH';
    badge.style.background = 'var(--border)';
    badge.style.color = 'var(--fg2)';
    return;
  }
  try {
    const response = await fetch('/api/health', { cache: 'no-store' });
    const state = await response.json();
    badge.textContent = state.ai_configured ? '🤖 AI THẬT' : '⚠ CHƯA CÓ KEY';
    badge.style.background = state.ai_configured ? 'var(--accent)' : 'var(--warn)';
    badge.style.color = '#fff';
    badge.dataset.health = JSON.stringify(state);
  } catch (_) {
    badge.textContent = '⚠ BACKEND OFFLINE';
    badge.style.background = 'var(--danger)';
    badge.style.color = '#fff';
  }
}

async function showAiStatus() {
  await updateAiBadge();
  const badge = $('#aiModeBadge');
  const state = badge.dataset.health ? JSON.parse(badge.dataset.health) : null;
  openModal('Trạng thái AI', state
    ? `<p><b>Text AI:</b> ${state.ai_configured ? 'đã cấu hình' : 'chưa cấu hình'}<br><b>Vision AI:</b> ${state.vision_configured ? 'đã cấu hình' : 'chưa cấu hình'}<br><b>Model:</b> ${esc(state.model)}</p><p>API key chỉ nằm trong biến môi trường phía server.</p>`
    : '<p>Không kết nối được backend. Chạy <code>python3 codebase/server.py</code>.</p>');
}
$('#aiModeBadge').onclick = showAiStatus;

// Ba handler này từng có ở nhánh 2 (f86dd28) nhưng bị commit "sync codebase with p2"
// ghi đè mất, khiến pager dưới cùng và chip số trang bấm không ăn.
$('#chipPage').onclick = () => openNotesModal();
$('#prevPage').onclick = () => goPage(S.page - 1);
$('#nextPage').onclick = () => goPage(S.page + 1);

$('#btnTheme').onclick = () => {
  const dark = document.documentElement.dataset.theme === 'dark';
  document.documentElement.dataset.theme = dark ? 'light' : 'dark';
  toast('ok', dark ? 'Chế độ sáng' : 'Chế độ tối');
};
$('#btnLang').onclick = () => { S.lang = S.lang === 'vi' ? 'en' : 'vi'; applyLang(); };
$('#btnBack').onclick = () => toast('warn', 'Quay lại danh sách môn — màn hình này chưa có trong prototype CP2');
$('#brand').onclick = e => { e.preventDefault(); goPage(1); };

$('#btnNewChat').onclick = () => {
  S.chat = []; S.snap = null; renderAttach(); renderChat();
  toast('ok', 'Đã mở hội thoại mới');
};
$('#btnHistory').onclick = () => openModal('Lịch sử hội thoại',
  `<div class="note-row"><span class="pg">Hôm nay</span><div class="bd"><b>Day 02 · trang 67</b><div class="qt">“trang 67 nói về cái gì vậy”</div></div></div>
   <div class="note-row"><span class="pg">Hôm qua</span><div class="bd"><b>Day 01 · trang 12</b><div class="qt">“JTBD khác persona chỗ nào”</div></div></div>
   <div class="note-row"><span class="pg">2 ngày trước</span><div class="bd"><b>Day 01 · trang 40</b><div class="qt">“cho ví dụ về cost of error”</div></div></div>`);

$('#btnSend').onclick = () => {
  const i = $('#ask');
  if (!i.value.trim()) return toast('warn', 'Nhập câu hỏi trước đã');
  send(i.value.trim(), { page: S.page });
  i.value = '';
};
$('#ask').addEventListener('keydown', e => { if (e.key === 'Enter') $('#btnSend').click(); });
$('#btnSummary').onclick = () => send('Tóm tắt toàn bộ tài liệu này thành 5 gạch đầu dòng, ưu tiên các ý cần nhớ để ôn tập.', { page: S.page });
// Nút "Thử thách" nằm trong từng trang, mà các trang được dựng lại mỗi lần đổi tài
// liệu — nên bắt sự kiện nổi bọt ở #pages thay vì gắn trực tiếp vào từng nút.
$('#pages').addEventListener('click', e => {
  const btn = e.target.closest('[data-quizpage]');
  if (btn) { e.stopPropagation(); requestQuiz(+btn.dataset.quizpage); return; }
  const ok = e.target.closest('[data-noteok]');
  if (ok) { e.stopPropagation(); dismissReview(ok.dataset.noteok); }
});
$('#pages').addEventListener('input', e => {
  const ta = e.target.closest('[data-write]');
  if (ta) S.pad[+ta.dataset.write] = ta.value;
});
$('#quizPeek').onclick = () => {
  if (S.quizVeilFor) S.quizVeilFor.peeked = true;
  updateQuizFocus();
};

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeSnip(); selPopup.hidden = true; $('#moreMenu').hidden = true; closeModal(); closeAskPopup();
    S.moreOpen = false; updateSubbar();
  }
  if (e.target.matches('input,textarea') || e.target.isContentEditable) return;
  if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); goPage(S.page + 1); }
  if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); goPage(S.page - 1); }
  if (e.key === 's' && !e.ctrlKey) setTool('snip');
  if (e.key === 'r') setTool('read');
  if (e.key === 'b') setTool('pen');
  if (e.key === 'h') setTool('hl');
});

/* ---------------- boot ---------------- */
renderChapters();
renderSwatches();
setPenSize(S.penSize, true);
S.chat = [];
renderChat();
applyLang();
applyZoom();
updateAiBadge();
loadDocument(DOC.file);
