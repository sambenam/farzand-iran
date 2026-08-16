/* =====================================================================
   فرزندان ایران — یادبود جانباختگان ۱۸ و ۱۹ دی ۱۴۰۴
   نسخه ۳: نقشه‌ی دوبعدی + پنجره‌ی استان با لیست مجازی (پشتیبانی از
   هزاران نام) + پنجره‌ی جزئیات هر نام
   ===================================================================== */
(function () {
  'use strict';

  /* ---------- نام فارسی استان‌ها ---------- */
  const PROVINCES = {
    'IR-01': 'آذربایجان شرقی', 'IR-02': 'آذربایجان غربی', 'IR-03': 'اردبیل',
    'IR-04': 'اصفهان', 'IR-05': 'ایلام', 'IR-06': 'بوشهر', 'IR-07': 'تهران',
    'IR-08': 'چهارمحال و بختیاری', 'IR-10': 'خوزستان', 'IR-11': 'زنجان',
    'IR-12': 'سمنان', 'IR-13': 'سیستان و بلوچستان', 'IR-14': 'فارس',
    'IR-15': 'کرمان', 'IR-16': 'کردستان', 'IR-17': 'کرمانشاه',
    'IR-18': 'کهگیلویه و بویراحمد', 'IR-19': 'گیلان', 'IR-20': 'لرستان',
    'IR-21': 'مازندران', 'IR-22': 'مرکزی', 'IR-23': 'هرمزگان',
    'IR-24': 'همدان', 'IR-25': 'یزد', 'IR-26': 'قم', 'IR-27': 'گلستان',
    'IR-28': 'قزوین', 'IR-29': 'خراسان جنوبی', 'IR-30': 'خراسان رضوی',
    'IR-31': 'خراسان شمالی', 'IR-32': 'البرز'
  };

  /* ---------- ابزارها ---------- */
  const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
  const toFa = (s) => String(s == null ? '' : s).replace(/[0-9]/g, (d) => FA_DIGITS[d]);
  const $ = (sel) => document.querySelector(sel);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const DATA = window.VICTIMS_DATA || { victims: [], meta: {} };
  const victims = DATA.victims || [];
  const META = DATA.meta || {};

  const byProvince = {};
  victims.forEach((v) => { (byProvince[v.provinceId] = byProvince[v.provinceId] || []).push(v); });
  const countOf = (pid) => (byProvince[pid] || []).length;
  const totalCount = victims.length;

  /* ---------- پس‌زمینه‌ی ذرات نور ---------- */
  (function initBg() {
    const canvas = $('#bg');
    const ctx = canvas.getContext('2d');
    let W, H, dots = [];
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function resize() {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
      dots = [];
      const n = Math.min(140, Math.floor(W * H / 12000));
      for (let i = 0; i < n; i++) {
        dots.push({
          x: Math.random() * W, y: Math.random() * H,
          r: Math.random() * 1.6 + 0.4,
          s: Math.random() * 0.35 + 0.08,
          a: Math.random() * 0.5 + 0.15,
          tw: Math.random() * Math.PI * 2,
          warm: Math.random() < 0.28
        });
      }
    }
    function draw() {
      ctx.clearRect(0, 0, W, H);
      const t = performance.now() / 1000;
      for (const d of dots) {
        if (!reduce) {
          d.y -= d.s;
          if (d.y < -6) { d.y = H + 6; d.x = Math.random() * W; }
        }
        const tw = reduce ? 0 : Math.sin(t * 1.4 + d.tw) * 0.25;
        const alpha = Math.max(0, Math.min(1, d.a + tw));
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = d.warm
          ? 'rgba(210,150,110,' + alpha + ')'
          : 'rgba(168,188,218,' + (alpha * 0.7) + ')';
        ctx.shadowColor = d.warm ? 'rgba(210,150,110,.65)' : 'rgba(140,165,205,.55)';
        ctx.shadowBlur = 5;
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      requestAnimationFrame(draw);
    }
    window.addEventListener('resize', resize);
    resize();
    draw();
  })();

  /* ---------- عناصر DOM ---------- */
  const mapWrap = $('#mapWrap');
  const map2dWrap = $('#map2dWrap');
  const tooltipEl = $('#tooltip');
  const searchInput = $('#search');
  const searchResults = $('#searchResults');
  const modal = $('#modal');
  const modalProvince = $('#modalProvince');
  const modalSearch = $('#modalSearch');
  const modalList = $('#modalList');
  const detail = $('#detail');

  let svg2d = null;
  let provincePid = null;
  let filtered = [];

  /* ---------- شمارنده و فوتر ---------- */
  function animateCount(el, target, dur) {
    const start = performance.now();
    function step(now) {
      const p = Math.min(1, (now - start) / dur);
      el.textContent = toFa(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  animateCount($('#totalCount'), totalCount, 1400);
  $('#footerNote').innerHTML = esc(META.note || '');

  /* =====================================================================
     نقشه‌ی دوبعدی + زوم و جابه‌جایی
     ===================================================================== */
  let mapG = null;
  const labels = [];               // {g, cx, cy} برای برچسب‌های با اندازه‌ی ثابت
  const mapView = { tx: 0, ty: 0, s: 1 };
  const MIN_S = 1, MAX_S = 5;
  const dragState = { down: false, moved: false, sx: 0, sy: 0 };

  function applyMapTransform() {
    if (!mapG) return;
    mapG.setAttribute('transform', 'translate(' + mapView.tx + ',' + mapView.ty + ') scale(' + mapView.s + ')');
    labels.forEach(function (l) {
      l.g.setAttribute('transform', 'translate(' + (mapView.tx + mapView.s * l.cx) + ',' + (mapView.ty + mapView.s * l.cy) + ')');
    });
  }

  function screenToView(cx, cy) {
    const ctm = svg2d.getScreenCTM();
    if (!ctm) return null;
    const pt = svg2d.createSVGPoint();
    pt.x = cx; pt.y = cy;
    return pt.matrixTransform(ctm.inverse());
  }

  function zoomAt(cx, cy, factor) {
    const raw = screenToView(cx, cy);
    if (!raw) return;
    const vx = (raw.x - mapView.tx) / mapView.s;
    const vy = (raw.y - mapView.ty) / mapView.s;
    const ns = Math.min(MAX_S, Math.max(MIN_S, mapView.s * factor));
    if (ns === mapView.s) return;
    mapView.tx = mapView.tx + (mapView.s - ns) * vx;
    mapView.ty = mapView.ty + (mapView.s - ns) * vy;
    mapView.s = ns;
    applyMapTransform();
  }

  function panBy(sx1, sy1, sx2, sy2) {
    const a = screenToView(sx1, sy1);
    const b = screenToView(sx2, sy2);
    if (!a || !b) return;
    mapView.tx += b.x - a.x;
    mapView.ty += b.y - a.y;
    applyMapTransform();
  }

  function init2D() {
    map2dWrap.innerHTML = window.IRAN_SVG;
    svg2d = map2dWrap.querySelector('svg');
    svg2d.id = 'map2dSvg';
    svg2d.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    const NS = 'http://www.w3.org/2000/svg';

    /* همه‌ی شکل‌ها را داخل گروهِ تبدیل‌پذیر قرار بده */
    mapG = document.createElementNS(NS, 'g');
    mapG.id = 'mapTransform';
    const paths = Array.from(svg2d.querySelectorAll('path'));
    paths.forEach(function (p) { mapG.appendChild(p); });
    svg2d.appendChild(mapG);

    paths.forEach(function (p) {
      const pid = p.id;
      p.classList.add(countOf(pid) > 0 ? 'prov-lit' : 'prov-dark');
      p.addEventListener('mousemove', function (e) { showTooltip(e, pid); });
      p.addEventListener('mouseleave', hideTooltip);
      p.addEventListener('click', function () {
        if (!dragState.moved) openProvinceModal(pid);
      });
    });

    /* برچسب تعداد: اندازه‌ی ثابت، اما با حرکت نقشه جابه‌جا می‌شود */
    Object.keys(byProvince).forEach(function (pid) {
      const path = svg2d.getElementById(pid);
      if (!path) return;
      try {
        const bb = path.getBBox();
        const cx = bb.x + bb.width / 2, cy = bb.y + bb.height / 2;
        const g = document.createElementNS(NS, 'g');
        g.setAttribute('class', 'lbl2d');
        const circle = document.createElementNS(NS, 'circle');
        circle.setAttribute('r', 8);
        const txt = document.createElementNS(NS, 'text');
        txt.setAttribute('text-anchor', 'middle');
        txt.setAttribute('dominant-baseline', 'central');
        txt.setAttribute('font-size', '10');
        txt.textContent = toFa(countOf(pid));
        g.appendChild(circle); g.appendChild(txt);
        svg2d.appendChild(g);
        labels.push({ g: g, cx: cx, cy: cy - 6 });
      } catch (e) { /* getBBox */ }
    });

    applyMapTransform();

    /* ---------- تعامل: کشیدن، زوم با چرخ، دکمه‌ها ---------- */
    map2dWrap.addEventListener('pointerdown', function (e) {
      dragState.down = true;
      dragState.moved = false;
      dragState.sx = e.clientX;
      dragState.sy = e.clientY;
    });
    map2dWrap.addEventListener('pointermove', function (e) {
      if (!dragState.down) return;
      const dx = e.clientX - dragState.sx;
      const dy = e.clientY - dragState.sy;
      if (!dragState.moved && Math.hypot(dx, dy) > 5) dragState.moved = true;
      if (dragState.moved) {
        panBy(dragState.sx, dragState.sy, e.clientX, e.clientY);
        dragState.sx = e.clientX;
        dragState.sy = e.clientY;
      }
    });
    function endDrag() {
      dragState.down = false;
      window.setTimeout(function () { dragState.moved = false; }, 0);
    }
    map2dWrap.addEventListener('pointerup', endDrag);
    map2dWrap.addEventListener('pointerleave', endDrag);

    map2dWrap.addEventListener('wheel', function (e) {
      e.preventDefault();
      zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.18 : 1 / 1.18);
    }, { passive: false });

    $('#zoomIn').addEventListener('click', function () {
      const r = map2dWrap.getBoundingClientRect();
      zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1.3);
    });
    $('#zoomOut').addEventListener('click', function () {
      const r = map2dWrap.getBoundingClientRect();
      zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1 / 1.3);
    });
    $('#zoomReset').addEventListener('click', function () {
      mapView.tx = 0; mapView.ty = 0; mapView.s = 1;
      applyMapTransform();
    });

    /* ---------- منوی انتخاب استان (سفارشی) ---------- */
    const provJumpBtn = $('#provJumpBtn');
    const provJumpMenu = $('#provJumpMenu');
    const provJumpLabel = $('#provJumpLabel');
    let provMenuOpen = false;

    Object.keys(PROVINCES).forEach(function (pid) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'prov-jump-item';
      item.dataset.pid = pid;
      item.setAttribute('role', 'option');

      const nameSpan = document.createElement('span');
      nameSpan.textContent = PROVINCES[pid];

      item.appendChild(nameSpan);
      item.addEventListener('click', function () {
        closeProvMenu();
        provJumpLabel.textContent = PROVINCES[pid];
        openProvinceModal(pid);
      });
      provJumpMenu.appendChild(item);
    });

    function closeProvMenu() {
      provMenuOpen = false;
      provJumpMenu.classList.add('hidden');
      provJumpBtn.classList.remove('open');
      provJumpBtn.setAttribute('aria-expanded', 'false');
    }

    provJumpBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      provMenuOpen = !provMenuOpen;
      provJumpMenu.classList.toggle('hidden', !provMenuOpen);
      provJumpBtn.classList.toggle('open', provMenuOpen);
      provJumpBtn.setAttribute('aria-expanded', provMenuOpen ? 'true' : 'false');
    });

    document.addEventListener('click', function (e) {
      if (!e.target.closest('.prov-jump')) closeProvMenu();
    });
  }

  function showTooltip(e, pid) {
    const name = PROVINCES[pid] || pid;
    const c = countOf(pid);
    tooltipEl.innerHTML = '<div class="tt-name">' + esc(name) + '</div>' +
      '<div class="tt-count">' + (c ? toFa(c) + ' نام مستند' : 'در انتظار تکمیل') + '</div>';
    const r = mapWrap.getBoundingClientRect();
    let x = e.clientX - r.left, y = e.clientY - r.top;
    x = Math.min(x, r.width - 140);
    tooltipEl.style.left = x + 'px';
    tooltipEl.style.top = y + 'px';
    tooltipEl.classList.remove('hidden');
  }
  function hideTooltip() { tooltipEl.classList.add('hidden'); }

  function highlightProvince(pid) {
    if (svg2d) {
      svg2d.querySelectorAll('path').forEach((p) => {
        p.classList.toggle('prov-selected', p.id === pid);
      });
    }
  }
  function clearHighlight() {
    if (svg2d) {
      svg2d.querySelectorAll('path').forEach((p) => p.classList.remove('prov-selected'));
    }
  }

  /* =====================================================================
     پنجره‌ی استان — لیست مجازی
     ===================================================================== */
  const CELL_H = 108, GAP = 10, ROW_H = CELL_H + GAP;
  let firstRenderDone = false;

  /* تعداد ستون‌ها: ۳ در دسکتاپ، ۲ در تبلت، ۱ در موبایل */
  function calcCols(width) {
    if (width >= 880) return 3;
    if (width >= 520) return 2;
    return 1;
  }
  let rafPending = false;
  let contentEl = null;

  function openProvinceModal(pid, opts) {
    opts = opts || {};
    provincePid = pid;
    const list = opts.override || (byProvince[pid] || []);
    filtered = list.slice();
    modalSearch.value = '';
    modalProvince.textContent = PROVINCES[pid] || pid;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    highlightProvince(pid);
    modalList.scrollTop = 0;
    firstRenderDone = false;
    renderList();
    if (opts.focusId) {
      scrollToVictim(opts.focusId);
      openDetail(opts.focusId);
    }
  }

  function closeModal() {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    clearHighlight();
    provincePid = null;
    closeDetail();
  }

  function renderList() {
    rafPending = false;
    if (!modal.classList.contains('open')) return;

    const prevScroll = modalList.scrollTop;

    if (!filtered.length) {
      if (contentEl) { contentEl.remove(); contentEl = null; }
      if (!modalList.querySelector('.list-empty')) {
        const msg = (byProvince[provincePid] || []).length === 0
          ? 'هنوز نامی برای این استان ثبت نشده است.'
          : 'نامی یافت نشد.';
        modalList.innerHTML = '<div class="list-empty">' + msg + '</div>';
      }
      modalList.scrollTop = 0;
      return;
    }
    const empty = modalList.querySelector('.list-empty');
    if (empty) empty.remove();

    /* محتوای پایدار: با پاک‌کردن فرزندان (نه خود کانتینر)،
       موقعیت اسکرول حفظ می‌شود */
    if (!contentEl) {
      contentEl = document.createElement('div');
      contentEl.className = 'v-content';
      modalList.appendChild(contentEl);
    }
    contentEl.classList.toggle('anim', !firstRenderDone);
    contentEl.innerHTML = '';

    const innerW = contentEl.clientWidth;
    const cols = calcCols(innerW);
    const colW = (innerW - (cols - 1) * GAP) / cols;
    const totalRows = Math.ceil(filtered.length / cols);
    contentEl.style.height = (totalRows * ROW_H) + 'px';

    const scrollTop = modalList.scrollTop;
    const viewH = modalList.clientHeight || 600;
    const startRow = Math.max(0, Math.floor(scrollTop / ROW_H) - 1);
    const endRow = Math.min(totalRows, Math.ceil((scrollTop + viewH) / ROW_H) + 1);

    for (let r = startRow; r < endRow; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        if (idx >= filtered.length) break;
        const v = filtered[idx];
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'v-cell';
        cell.dataset.id = v.id;
        cell.style.left = (innerW - colW - c * (colW + GAP)) + 'px';
        cell.style.top = (r * ROW_H) + 'px';
        cell.style.width = colW + 'px';
        cell.style.height = CELL_H + 'px';
        cell.style.setProperty('--i', idx);
        cell.innerHTML =
          '<span class="v-top">' +
            '<span class="v-avatar">' + (v.photo
              ? '<img src="' + esc(v.photo) + '" alt="' + esc(v.name) + '" loading="lazy">'
              : esc((v.name || '؟').trim().charAt(0))) + '</span>' +
            '<span class="v-name">' + esc(v.name) + '</span>' +
          '</span>' +
          '<span class="v-meta">' + esc([v.age ? toFa(v.age) + ' ساله' : '', v.city].filter(Boolean).join(' · ')) + '</span>' +
          '<span class="v-note">' + esc(v.note || '') + '</span>';
        contentEl.appendChild(cell);
      }
    }

    /* بازیابی موقعیت اسکرول: مرورگر هنگام بازسازی محتوا
       ممکن است آن را صفر کند */
    modalList.scrollTop = prevScroll;
    firstRenderDone = true;
  }

  function onListScroll() {
    if (!rafPending) { rafPending = true; requestAnimationFrame(renderList); }
  }
  modalList.addEventListener('scroll', onListScroll);

  function scrollToVictim(id) {
    const idx = filtered.findIndex((v) => v.id === id);
    if (idx < 0) return;
    const innerW = contentEl ? contentEl.clientWidth : (modalList.clientWidth - 52);
    const cols = calcCols(innerW);
    const row = Math.floor(idx / cols);
    modalList.scrollTop = row * ROW_H;
    renderList();
  }

  /* جست‌وجو داخل پنجره */
  modalSearch.addEventListener('input', () => {
    const q = (modalSearch.value || '').trim().toLowerCase();
    const base = byProvince[provincePid] || [];
    filtered = q
      ? base.filter((v) =>
          (v.name || '').toLowerCase().includes(q) ||
          (v.city || '').toLowerCase().includes(q) ||
          (v.note || '').toLowerCase().includes(q))
      : base.slice();
    modalList.scrollTop = 0;
    renderList();
  });

  /* کلیک روی کارت → جزئیات */
  modalList.addEventListener('click', (e) => {
    const cell = e.target.closest('.v-cell');
    if (cell) openDetail(cell.dataset.id);
  });

  /* =====================================================================
     پنجره‌ی جزئیات یک نام
     ===================================================================== */
  function openDetail(id) {
    const v = victims.find((x) => x.id === id);
    if (!v) return;

    /* عکس در ستون کناری؛ اگر نبود، دایره‌ی حرف اول */
    const photoEl = $('#detailPhoto');
    if (v.photo) {
      photoEl.innerHTML = '<img class="detail-photo-img" src="' + esc(v.photo) + '" alt="' + esc(v.name) + '" loading="lazy">';
    } else {
      photoEl.innerHTML = '<div class="detail-avatar">' + esc((v.name || '؟').trim().charAt(0)) + '</div>';
    }

    $('#detailName').textContent = v.name;
    $('#detailMeta').textContent = [
      v.city,
      v.dateFa ? toFa(v.dateFa) : ''
    ].filter(Boolean).join(' · ');
    $('#detailNote').textContent = v.note || 'جزئیات در حال تکمیل.';
    $('#detailSrc').textContent = 'منبع: ' + (v.source || 'نامشخص');

    /* جدول اطلاعات */
    const infoRows = [];
    if (v.born) infoRows.push(['تاریخ تولد', v.born]);
    if (v.dateFa) infoRows.push(['تاریخ جانسپاری', toFa(v.dateFa)]);
    if (v.lived) infoRows.push(['محل زندگی', v.lived]);
    if (v.killedAt) infoRows.push(['محل جانسپاری', v.killedAt]);
    if (v.occupation) infoRows.push(['شغل / تحصیل', v.occupation]);
    if (v.age) infoRows.push(['سن', toFa(v.age) + ' ساله']);
    const infoEl = $('#detailInfo');
    infoEl.innerHTML = infoRows.map((r) =>
      '<span class="info-chip"><span class="info-k">' + esc(r[0]) + '</span>' +
      '<span class="info-v">' + esc(r[1]) + '</span></span>'
    ).join('');

    /* رسانه: ویدیو و صدا */
    const media = $('#detailMedia');
    let m = '';
    if (v.video) m += '<video class="media-video" controls preload="metadata" src="' + esc(v.video) + '"></video>';
    if (v.audio) m += '<audio class="media-audio" controls preload="none" src="' + esc(v.audio) + '"></audio>';
    if (m) { media.innerHTML = m; media.classList.remove('hidden'); }
    else { media.innerHTML = ''; media.classList.add('hidden'); }

    detail.classList.add('open');
    detail.setAttribute('aria-hidden', 'false');
  }
  function closeDetail() {
    detail.classList.remove('open');
    detail.setAttribute('aria-hidden', 'true');
    if (currentVoice) {
      try { currentVoice.pause(); currentVoice = null; } catch (e) {}
    }
  }

  /* =====================================================================
     جست‌وجوی سراسری
     ===================================================================== */
  function doSearch(q) {
    q = (q || '').trim();
    if (!q) { searchResults.classList.add('hidden'); return; }
    const norm = (s) => String(s || '').toLowerCase();
    const needle = norm(q);
    const hits = victims.filter((v) =>
      norm(v.name).includes(needle) ||
      norm(v.city).includes(needle) ||
      norm(PROVINCES[v.provinceId]).includes(needle)
    ).slice(0, 12);

    if (!hits.length) {
      searchResults.innerHTML = '<div class="search-empty">موردی یافت نشد.</div>';
    } else {
      searchResults.innerHTML = hits.map((v) =>
        '<div class="search-item" data-id="' + esc(v.id) + '">' +
        '<div class="si-name">' + esc(v.name) + '</div>' +
        '<div class="si-meta">' + esc(v.city || '') + ' · ' + esc(PROVINCES[v.provinceId] || '') + '</div>' +
        '</div>'
      ).join('');
      searchResults.querySelectorAll('.search-item').forEach((el) => {
        el.addEventListener('click', () => {
          const v = victims.find((x) => x.id === el.dataset.id);
          if (!v) return;
          openProvinceModal(v.provinceId, { focusId: v.id });
          searchResults.classList.add('hidden');
          searchInput.value = v.name;
        });
      });
    }
    searchResults.classList.remove('hidden');
  }
  searchInput.addEventListener('input', () => doSearch(searchInput.value));
  searchInput.addEventListener('focus', () => doSearch(searchInput.value));
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-box')) searchResults.classList.add('hidden');
  });

  /* =====================================================================
     صدای یادبود — ناقوس سوگوار (Web Audio) به‌عنوان جایگزین
     ===================================================================== */
  let audioCtx = null;

  function ensureCtx() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  /* ناقوسِ آرام و محو — چند صدای سینوسیِ کم‌فرکانس با دمی بلند و اکو */
  function playBell() {
    const ctx = ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    const master = ctx.createGain();
    master.gain.value = 0.9;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 1400;
    master.connect(lowpass);
    lowpass.connect(ctx.destination);

    /* اکوی ملایم برای حس فضا */
    const delay = ctx.createDelay(1.5);
    delay.delayTime.value = 0.27;
    const fb = ctx.createGain(); fb.gain.value = 0.35;
    const wet = ctx.createGain(); wet.gain.value = 0.55;
    delay.connect(fb); fb.connect(delay);
    delay.connect(wet); wet.connect(lowpass);
    master.connect(delay);

    const partials = [
      [98,  0.08, 4.2],   // عمق
      [196, 0.13, 3.8],   // اصلی
      [233, 0.08, 3.4],   // سوم کوچک — حسِ غم
      [294, 0.05, 3.0],   // پنجم
      [392, 0.03, 2.5]
    ];
    partials.forEach(function (p) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = p[0];
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(p[1], now + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, now + p[2]);
      osc.connect(g); g.connect(master);
      osc.start(now); osc.stop(now + p[2] + 0.05);
    });

    /* زنگ دوم، آرام‌تر و دیرتر — مثل پژواک ناقوس */
    window.setTimeout(function () {
      if (!audioCtx || audioCtx.state !== 'running') return;
      const t2 = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      osc.type = 'sine'; osc.frequency.value = 233;
      const g = audioCtx.createGain();
      g.gain.setValueAtTime(0.0001, t2);
      g.gain.exponentialRampToValueAtTime(0.05, t2 + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t2 + 2.6);
      osc.connect(g); g.connect(master);
      osc.start(t2); osc.stop(t2 + 2.7);
    }, 850);
  }

  /* موقع باز شدن یادنامه‌ی هر فرد صدا پخش می‌شود
     اولویت: صدای مراد ویسی (voice) → در نبودش، ناقوس یادبود */
  let currentVoice = null;
  function playMemorialSound(v) {
    if (currentVoice) {
      try { currentVoice.pause(); currentVoice = null; } catch (e) {}
    }
    if (v && v.voice) {
      try {
        const a = new Audio(v.voice);
        a.volume = 0.95;
        currentVoice = a;
        a.play().catch(function () { currentVoice = null; playBell(); });
        return;
      } catch (e) { currentVoice = null; /* fallback به ناقوس */ }
    }
    playBell();
  }

  /* =====================================================================
     بستن‌ها + کیبورد
     ===================================================================== */
  document.querySelectorAll('[data-close]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      if (el.getAttribute('data-close') === 'detail') closeDetail();
      else closeModal();
    });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (detail.classList.contains('open')) closeDetail();
    else if (modal.classList.contains('open')) closeModal();
    searchResults.classList.add('hidden');
  });
  window.addEventListener('resize', () => {
    if (modal.classList.contains('open')) renderList();
  });

  /* =====================================================================
     اشتراک‌گذاری
     ===================================================================== */
  $('#btnShare').addEventListener('click', () => {
    const text = 'یادبود جانباختگان ۱۸ و ۱۹ دی ۱۴۰۴ — «فرزندان ایران»';
    const url = location.href;
    const toast = $('#toast');
    function show(msg) {
      toast.textContent = msg;
      toast.classList.remove('hidden');
      setTimeout(() => toast.classList.add('hidden'), 2600);
    }
    if (navigator.share) {
      navigator.share({ title: text, url }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text + ' — ' + url)
        .then(() => show('لینک کپی شد'))
        .catch(() => show(text + ' — ' + url));
    } else {
      show(text + ' — ' + url);
    }
  });

  /* ---------- API عمومی ---------- */
  window.APP = {
    openProvinceModal, closeModal, openDetail, closeDetail,
    countOf, toFa, esc, PROVINCES, showTooltip, hideTooltip,
    sound: {
      get ctxState() { return audioCtx ? audioCtx.state : null; }
    },
    get filtered() { return filtered; }
  };

  /* ---------- شروع ---------- */
  init2D();
})();
