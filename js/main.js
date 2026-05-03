/* ─────────────────────────────────────────
   ilü — main.js
───────────────────────────────────────── */

// ── CONFIG ─────────────────────────────
const FIREBASE_URL = 'https://ilu-site-default-rtdb.firebaseio.com';
const USE_FIREBASE = FIREBASE_URL !== 'YOUR_FIREBASE_URL_HERE';

const YEARS = ['2026', '2025', '2024', '2023', '2022'];

let photoManifest = {};
let currentYear   = null;
let currentPhotos = [];
let resortTimer   = null;
let lastHearted   = null;
let isAnimating   = false;
let hiddenMode    = false;

const gallery = document.getElementById('gallery');

// ── Column count — 4 / 3 / 2 ──────────
function numCols() {
  const w = window.innerWidth;
  if (w < 540) return 2;
  if (w < 900) return 3;
  return 4;
}

// ── localStorage ───────────────────────
function localGet(year) {
  try { return JSON.parse(localStorage.getItem(`ilu_hearts_${year}`)) || {}; }
  catch(e) { return {}; }
}
function localSet(year, data) {
  try { localStorage.setItem(`ilu_hearts_${year}`, JSON.stringify(data)); }
  catch(e) {}
}

// ── Firebase ───────────────────────────
function encodeKey(filename) { return filename.replace(/\./g, '~~~'); }
function decodeKey(key)      { return key.replace(/~~~/g, '.'); }

async function firebaseLoadAll() {
  if (!USE_FIREBASE) return;
  try {
    const res  = await fetch(`${FIREBASE_URL}/hearts.json`);
    const data = await res.json();
    if (data) {
      Object.keys(data).forEach(year => {
        const decoded = {};
        Object.keys(data[year] || {}).forEach(k => {
          decoded[decodeKey(k)] = data[year][k];
        });
        localSet(year, decoded);
      });
    } else {
      YEARS.forEach(y => localSet(y, {}));
      localSet('xo', {});
    }
  } catch(e) {}
}

async function firebaseSetCount(year, filename, count) {
  if (!USE_FIREBASE) return;
  const key = encodeKey(filename);
  try {
    await fetch(`${FIREBASE_URL}/hearts/${year}.json`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: count })
    });
  } catch(e) {}
}

// ── Hearts ─────────────────────────────
function getCount(year, filename) {
  return localGet(year)[filename] || 0;
}

function addHeart(year, filename) {
  const hearts = localGet(year);
  hearts[filename] = (hearts[filename] || 0) + 1;
  localSet(year, hearts);
  firebaseSetCount(year, filename, hearts[filename]);
  return hearts[filename];
}

// ── Sort ───────────────────────────────
function sortByHearts(arr, year) {
  return [...arr].sort((a, b) => getCount(year, b) - getCount(year, a));
}

// ── Total hearts (main site only) ──────
function updateTotalHearts() {
  let total = 0;
  YEARS.forEach(year => {
    Object.values(localGet(year)).forEach(count => { total += count; });
  });
  let el = document.getElementById('heartTotal');
  if (!el) {
    el = document.createElement('div');
    el.id = 'heartTotal';
    el.className = 'heart-total';
    document.querySelector('main').appendChild(el);
  }
  el.innerHTML = total > 0 ? `<span id="heartTotalInner" style="cursor:default">\u2665 ${total.toLocaleString()}</span>` : '';
  const inner = document.getElementById('heartTotalInner');
  if (inner) inner.addEventListener('click', openHiddenPage);
}

// ── Hidden page heart counter ──────────
function updateUsHearts() {
  let total = 0;
  Object.values(localGet('xo')).forEach(count => { total += count; });
  const el = document.getElementById('usHeartTotal');
  if (el) el.textContent = total > 0 ? `♥ ${total.toLocaleString()}` : '';
}

// ── Load manifest ──────────────────────
async function loadManifest() {
  try {
    const res = await fetch('photos.json');
    photoManifest = await res.json();
  } catch(e) { photoManifest = {}; }
}

// ── Create column containers ───────────
function createCols(n, container) {
  const cols = [];
  for (let i = 0; i < n; i++) {
    const col = document.createElement('div');
    col.className = 'gallery-col';
    container.appendChild(col);
    cols.push(col);
  }
  return cols;
}

// ── Make a photo card ──────────────────
function makeItem(filename, year, container) {
  const item = document.createElement('div');
  item.className = 'gallery-item';
  item.dataset.filename = filename;

  const img = document.createElement('img');
  img.src      = `photos/${year}/${filename}`;
  img.alt      = '';
  img.loading  = 'lazy';
  img.decoding = 'async';
  img.setAttribute('draggable', 'false');
  img.addEventListener('load', () => {
    img.classList.add('loaded');
    item.classList.add('loaded');
  });
  img.addEventListener('error', () => { item.style.display = 'none'; });

  const badge = document.createElement('div');
  badge.className = 'heart-badge';
  const count = getCount(year, filename);
  badge.innerHTML = `<span class="heart-badge-icon">♥</span><span class="badge-count">${count}</span>`;
  if (count > 0) badge.classList.add('visible');

  item.addEventListener('click', () => {
    if (isAnimating) return;

    item.classList.remove('popping');
    void item.offsetWidth;
    item.classList.add('popping');
    item.addEventListener('animationend', () => item.classList.remove('popping'), { once: true });

    const newCount = addHeart(year, filename);
    badge.querySelector('.badge-count').textContent = newCount;
    badge.classList.add('visible');

    if (year === 'xo') {
      updateUsHearts();
    } else {
      updateTotalHearts();
      if (year === currentYear) {
        lastHearted = filename;
        clearTimeout(resortTimer);
        resortTimer = setTimeout(() => flipResort(), 2000);
      }
    }
  });

  item.appendChild(img);
  item.appendChild(badge);
  return item;
}

// ── Build gallery ──────────────────────
function buildGallery(photos) {
  gallery.innerHTML = '';

  if (!photos.length) {
    const msg = document.createElement('p');
    msg.className = 'gallery-message';
    msg.textContent = 'photos coming soon ✦';
    gallery.appendChild(msg);
    return;
  }

  const n    = numCols();
  const cols = createCols(n, gallery);
  photos.forEach((filename, i) => {
    cols[i % n].appendChild(makeItem(filename, currentYear, gallery));
  });
}

// ── FLIP resort ────────────────────────
function flipResort() {
  const items = [...gallery.querySelectorAll('.gallery-item')];
  if (items.length < 2) return;

  const newOrder = sortByHearts(currentPhotos, currentYear);
  const changed  = newOrder.some((f, i) => f !== currentPhotos[i]);
  if (!changed) return;

  isAnimating   = true;
  currentPhotos = newOrder;

  const firstRects = new Map();
  items.forEach(item => {
    firstRects.set(item.dataset.filename, item.getBoundingClientRect());
  });

  gallery.innerHTML = '';
  const n    = numCols();
  const cols = createCols(n, gallery);
  currentPhotos.forEach((filename, i) => {
    const el = items.find(el => el.dataset.filename === filename);
    if (el) cols[i % n].appendChild(el);
  });

  gallery.offsetHeight;

  const movers = [];
  items.forEach(item => {
    const f  = firstRects.get(item.dataset.filename);
    const l  = item.getBoundingClientRect();
    const dx = f.left - l.left;
    const dy = f.top  - l.top;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
    item.style.transition = 'none';
    item.style.transform  = `translate(${dx}px, ${dy}px)`;
    item.style.zIndex     = '3';
    movers.push(item);
  });

  if (movers.length === 0) { isAnimating = false; return; }

  requestAnimationFrame(() => requestAnimationFrame(() => {
    let pending = movers.length;
    movers.forEach(item => {
      const isHearted = item.dataset.filename === lastHearted;
      item.style.transition = `transform ${isHearted ? '0.55s cubic-bezier(0.34,1.38,0.64,1)' : '0.4s cubic-bezier(0.25,0.46,0.45,0.94)'}`;
      item.style.transform  = '';
      item.addEventListener('transitionend', () => {
        item.style.transition = '';
        item.style.zIndex     = '';
        pending--;
        if (pending === 0) { isAnimating = false; lastHearted = null; }
      }, { once: true });
    });
  }));
}

// ── Hidden page ────────────────────────
function openHiddenPage() {
  hiddenMode = true;
  document.querySelectorAll('.year-nav a').forEach(a => a.classList.remove('active'));
  document.body.classList.add('hidden-mode');
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Build hidden page content
  const main = document.querySelector('main');
  main.innerHTML = '';

  // Message
  const msg = document.createElement('p');
  msg.className = 'hidden-message';
  msg.textContent = 'where it all began.';
  main.appendChild(msg);

  // Gallery
  const usGallery = document.createElement('div');
  usGallery.className = 'gallery';
  main.appendChild(usGallery);

  const usPhotos = sortByHearts(photoManifest['us'] || [], 'xo');

  if (!usPhotos.length) {
    usGallery.innerHTML = '<p class="gallery-message">photos coming soon ✦</p>';
  } else {
    const n    = numCols();
    const cols = createCols(n, usGallery);
    usPhotos.forEach((filename, i) => {
      cols[i % n].appendChild(makeItem(filename, 'xo', usGallery));
    });
  }

  // Hidden heart counter
  const counter = document.createElement('div');
  counter.id = 'usHeartTotal';
  counter.className = 'heart-total us-heart-total';
  main.appendChild(counter);
  updateUsHearts();
}

function closeHiddenPage() {
  hiddenMode = false;
  document.body.classList.remove('hidden-mode');
  showYear(currentYear || YEARS[0], false);
}

// ── Show year ──────────────────────────
function showYear(year, pushState = true) {
  hiddenMode  = false;
  document.body.classList.remove('hidden-mode');
  currentYear = String(year);

  // Restore main structure if hidden page wiped it
  if (!gallery.isConnected) {
    const main = document.querySelector('main');
    main.innerHTML = '';
    main.appendChild(gallery);
  }

  document.querySelectorAll('.year-nav a').forEach(a => {
    a.classList.toggle('active', a.dataset.year === currentYear);
  });
  currentPhotos = sortByHearts(photoManifest[currentYear] || [], currentYear);
  buildGallery(currentPhotos);
  updateTotalHearts();

  if (pushState) {
    window.history.pushState({ year: currentYear }, '', '/' + currentYear);
  }

  const navHeight  = document.querySelector('nav').offsetHeight;
  const galleryTop = gallery.getBoundingClientRect().top + window.scrollY - navHeight;
  if (pushState) {
    window.scrollTo({ top: galleryTop, behavior: 'smooth' });
  } else {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

// ── Year nav clicks ────────────────────
document.querySelectorAll('.year-nav a').forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    if (hiddenMode || a.dataset.year !== currentYear) {
      showYear(a.dataset.year);
    } else {
      // Same year — scroll to gallery top
      const navHeight  = document.querySelector('nav').offsetHeight;
      const galleryTop = gallery.getBoundingClientRect().top + window.scrollY - navHeight;
      window.scrollTo({ top: galleryTop, behavior: 'smooth' });
    }
  });
});

// ── Logo click ─────────────────────────
document.getElementById('logoLink').addEventListener('click', () => {
  hiddenMode = false;
  document.body.classList.remove('hidden-mode');
  showYear(YEARS[0], false);
  window.history.pushState({ year: YEARS[0] }, '', '/');
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ── Browser back/forward ───────────────
window.addEventListener('popstate', e => {
  if (e.state?.hidden) {
    openHiddenPage();
  } else {
    const year = e.state?.year;
    if (year && YEARS.includes(year)) showYear(year, false);
  }
});

// ── Responsive resize ──────────────────
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (hiddenMode) return;
    const newN     = numCols();
    const currentN = gallery.querySelectorAll('.gallery-col').length;
    if (newN !== currentN) buildGallery(currentPhotos);
  }, 150);
});

// ── Init ───────────────────────────────
(async () => {
  await Promise.all([loadManifest(), firebaseLoadAll()]);
  const def  = YEARS.find(y => (photoManifest[y] || []).length > 0) || '2026';
  const path = window.location.pathname.replace('/', '');

  const startYear = YEARS.includes(path) ? path : def;
  showYear(startYear, false);

  // Preload other years in background
  setTimeout(() => {
    YEARS.filter(y => y !== currentYear).forEach(year => {
      (photoManifest[year] || []).forEach(filename => {
        new Image().src = `photos/${year}/${filename}`;
      });
    });
  }, 3000);
})();
