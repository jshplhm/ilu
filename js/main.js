/* ─────────────────────────────────────────
   ilü — main.js
───────────────────────────────────────── */

// ── CONFIG ─────────────────────────────
const FIREBASE_URL = 'https://ilu-site-default-rtdb.firebaseio.com';
const USE_FIREBASE = FIREBASE_URL !== 'YOUR_FIREBASE_URL_HERE';

let photoManifest = {};
let currentYear   = null;
let currentPhotos = [];
let resortTimer   = null;
let lastHearted   = null;
let isAnimating   = false;

const gallery = document.getElementById('gallery');

// ── Column count ───────────────────────
function numCols() {
  return window.innerWidth < 640 ? 2 : 4;
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
// Firebase keys can't contain dots — encode with ~~~ and decode on read
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
        // Firebase completely replaces localStorage — it's always source of truth
        localSet(year, decoded);
      });
    } else {
      // Firebase is empty (e.g. after reset) — clear all local counts too
      ['2022','2023','2024','2025','2026'].forEach(y => localSet(y, {}));
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

// ── Load manifest ──────────────────────
async function loadManifest() {
  try {
    const res = await fetch('photos.json');
    photoManifest = await res.json();
  } catch(e) { photoManifest = {}; }
}

// ── Create column containers ───────────
function createCols(n) {
  const cols = [];
  for (let i = 0; i < n; i++) {
    const col = document.createElement('div');
    col.className = 'gallery-col';
    gallery.appendChild(col);
    cols.push(col);
  }
  return cols;
}

// ── Make a photo card ──────────────────
function makeItem(filename) {
  const item = document.createElement('div');
  item.className = 'gallery-item';
  item.dataset.filename = filename;

  const img = document.createElement('img');
  img.src      = `photos/${currentYear}/${filename}`;
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
  const count = getCount(currentYear, filename);
  badge.innerHTML = `<span class="heart-badge-icon">♥</span><span class="badge-count">${count}</span>`;
  if (count > 0) badge.classList.add('visible');

  item.addEventListener('click', () => {
    if (isAnimating) return;

    item.classList.remove('popping');
    void item.offsetWidth;
    item.classList.add('popping');
    item.addEventListener('animationend', () => item.classList.remove('popping'), { once: true });

    const newCount = addHeart(currentYear, filename);
    badge.querySelector('.badge-count').textContent = newCount;
    badge.classList.add('visible');

    lastHearted = filename;
    clearTimeout(resortTimer);
    resortTimer = setTimeout(() => flipResort(), 2000);
  });

  item.appendChild(img);
  item.appendChild(badge);
  return item;
}

// ── Build gallery (first load) ─────────
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
  const cols = createCols(n);
  photos.forEach((filename, i) => {
    cols[i % n].appendChild(makeItem(filename));
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

  // FIRST — snapshot positions
  const firstRects = new Map();
  items.forEach(item => {
    firstRects.set(item.dataset.filename, item.getBoundingClientRect());
  });

  // Rebuild columns reusing existing DOM nodes
  gallery.innerHTML = '';
  const n    = numCols();
  const cols = createCols(n);
  currentPhotos.forEach((filename, i) => {
    const el = items.find(el => el.dataset.filename === filename);
    if (el) cols[i % n].appendChild(el);
  });

  // Force layout recalc
  gallery.offsetHeight;

  // INVERT — snap each item back to its old visual position
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

  // PLAY — animate to final positions
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

// ── Show year ──────────────────────────
function showYear(year) {
  currentYear = String(year);
  document.querySelectorAll('.year-nav a').forEach(a => {
    a.classList.toggle('active', a.dataset.year === currentYear);
  });
  currentPhotos = sortByHearts(photoManifest[currentYear] || [], currentYear);
  buildGallery(currentPhotos);
}

// ── Year nav ───────────────────────────
document.querySelectorAll('.year-nav a').forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    showYear(a.dataset.year);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
});

// ── Init ───────────────────────────────
(async () => {
  await Promise.all([loadManifest(), firebaseLoadAll()]);
  const years = ['2026', '2025', '2024', '2023', '2022'];
  const def   = years.find(y => (photoManifest[y] || []).length > 0) || '2026';
  showYear(def);
})();
