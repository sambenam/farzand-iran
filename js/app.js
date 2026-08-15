/* =====================================================================
   فرزندان ایران — یادبود جانباختگان ۱۸ و ۱۹ دی ۱۴۰۴
   هسته‌ی برنامه: داده‌ها، پنل اسامی، نقشه‌ی دوبعدی، جست‌وجو، شمع یادبود
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
  const map3d = $('#map3d');
  const map2dWrap = $('#map2dWrap');
  const tooltipEl = $('#tooltip');
  const panel = $('#panel');
  const panelContent = $('#panelContent');
  const searchInput = $('#search');
  const searchResults = $('#searchResults');

  let selectedPid = null;
  let view = '3d';
  let svg2d = null;

  /* =====================================================================
     شمارنده و متن‌های اولیه
     ===================================================================== */
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
     پنل اسامی
     ===================================================================== */
  function openPanel(pid) {
    selectedPid = pid;
    if (!pid) { closePanel(); return; }
    const list = byProvince[pid] || [];
    const provName = PROVINCES[pid] || pid;
    let html =
      '<div class="panel-head">' +
      '<div class="panel-province">' + esc(provName) +
      '<span class="count-chip">' + toFa(list.length) + ' نام</span></div>' +
      '<div class="panel-sub">روی هر نام، کارت آن نمایش داده می‌شود.</div>' +
      '</div>';
    if (!list.length) {
      html += '<div class="panel-empty"><span class="pe-icon">🕊</span>هنوز نامی برای این استان ثبت نشده است.<br>فهرست در حال تکمیل است.</div>';
    } else {
      html += list.map((v) =>
        '<div class="victim-card" id="victim-' + esc(v.id) + '">' +
        '<div class="victim-avatar">' + esc((v.name || '؟').trim().charAt(0)) + '</div>' +
        '<div class="victim-body">' +
        '<div class="victim-name">' + esc(v.name) + '</div>' +
        '<div class="victim-meta">' +
          (v.age ? toFa(v.age) + ' ساله' : 'سن نامشخص') + ' · ' + esc(v.city || '') +
          (v.dateFa ? ' · ' + toFa(v.dateFa) : '') +
        '</div>' +
        '<div class="victim-note">' + esc(v.note || 'جزئیات در حال تکمیل.') + '</div>' +
        '<span class="victim-src">منبع: ' + esc(v.source || 'نامشخص') + '</span>' +
        '</div></div>'
      ).join('');
    }
    panelContent.innerHTML = html;
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    highlightProvince(pid);
  }

  function closePanel() {
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
    selectedPid = null;
    clearHighlight();
  }

  function flashCard(victimId) {
    const el = document.getElementById('victim-' + victimId);
    if (el) {
      setTimeout(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('flash');
        setTimeout(() => el.classList.remove('flash'), 1700);
      }, 420);
    }
  }

  /* ---------- برجسته‌سازی استان ---------- */
  function highlightProvince(pid) {
    if (svg2d) {
      svg2d.querySelectorAll('path').forEach((p) => {
        p.classList.toggle('prov-selected', p.id === pid);
      });
    }
    if (window.APP3D && window.APP3D.setMeshState) {
      Object.keys(window.APP3D.meshByPid || {}).forEach((k) => window.APP3D.setMeshState(k));
    }
  }
  function clearHighlight() {
    if (svg2d) {
      svg2d.querySelectorAll('path').forEach((p) => p.classList.remove('prov-selected'));
    }
    if (window.APP3D && window.APP3D.setMeshState) {
      Object.keys(window.APP3D.meshByPid || {}).forEach((k) => window.APP3D.setMeshState(k));
    }
  }

  /* =====================================================================
     نقشه‌ی دوبعدی (SVG)
     ===================================================================== */
  function init2D() {
    map2dWrap.innerHTML = window.IRAN_SVG;
    svg2d = map2dWrap.querySelector('svg');
    svg2d.id = 'map2dSvg';
    svg2d.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg2d.querySelectorAll('path').forEach((p) => {
      const pid = p.id;
      p.classList.add(countOf(pid) > 0 ? 'prov-lit' : 'prov-dark');
      p.addEventListener('mousemove', (e) => showTooltip(e, pid));
      p.addEventListener('mouseleave', hideTooltip);
      p.addEventListener('click', () => openPanel(pid));
    });
    const NS = 'http://www.w3.org/2000/svg';
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'lbl2d');
    Object.keys(byProvince).forEach((pid) => {
      const path = svg2d.getElementById(pid);
      if (!path) return;
      try {
        const bb = path.getBBox();
        const cx = bb.x + bb.width / 2, cy = bb.y + bb.height / 2;
        const circle = document.createElementNS(NS, 'circle');
        circle.setAttribute('cx', cx); circle.setAttribute('cy', cy - 6); circle.setAttribute('r', 8);
        const txt = document.createElementNS(NS, 'text');
        txt.setAttribute('x', cx); txt.setAttribute('y', cy - 6);
        txt.setAttribute('text-anchor', 'middle');
        txt.setAttribute('dominant-baseline', 'central');
        txt.setAttribute('font-size', '10');
        txt.textContent = toFa(countOf(pid));
        g.appendChild(circle); g.appendChild(txt);
      } catch (e) { /* getBBox */ }
    });
    svg2d.appendChild(g);
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

  /* =====================================================================
     جابه‌جایی بین نماها
     ===================================================================== */
  function setView(v) {
    view = v;
    $('#btn3d').classList.toggle('active', v === '3d');
    $('#btn2d').classList.toggle('active', v === '2d');
    map3d.style.display = v === '3d' ? '' : 'none';
    map2dWrap.classList.toggle('hidden', v !== '2d');
    const hint = document.getElementById('mapHint');
    if (hint) hint.classList.toggle('hidden', v !== '3d');
    if (v === '3d' && window.APP3D) window.APP3D.onShow();
    if (v === '2d' && !svg2d) init2D();
    if (v === '3d' && selectedPid) highlightProvince(selectedPid);
  }
  $('#btn3d').addEventListener('click', () => setView('3d'));
  $('#btn2d').addEventListener('click', () => setView('2d'));

  /* =====================================================================
     جست‌وجو
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
          openPanel(v.provinceId);
          flashCard(v.id);
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
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') searchResults.classList.add('hidden');
  });

  /* =====================================================================
     اشتراک‌گذاری
     ===================================================================== */
  $('#btnShare').addEventListener('click', () => {
    const text = '🕯 یادبود جانباختگان ۱۸ و ۱۹ دی ۱۴۰۴ — «فرزندان ایران»';
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

  /* =====================================================================
     بستن پنل + کیبورد
     ===================================================================== */
  $('#panelClose').addEventListener('click', closePanel);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closePanel(); searchResults.classList.add('hidden'); }
  });

  /* ---------- API عمومی برای نقشه‌ی سه‌بعدی ---------- */
  window.APP = {
    openPanel, closePanel, highlightProvince, clearHighlight,
    showTooltip, hideTooltip, flashCard,
    countOf, toFa, esc, PROVINCES,
    mapWrap,
    get selectedPid() { return selectedPid; },
    set selectedPid(v) { selectedPid = v; },
    get view() { return view; }
  };

  /* ---------- شروع ---------- */
  init2D();
  setView('3d');
  if (window.initMap3D) window.initMap3D();
})();
