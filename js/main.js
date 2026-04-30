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
let lastHearted   = null; // filename of most recently tapped photo

const gallery = document.getElementById('gallery');

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
async function firebaseLoadAll() {
  if (!USE_FIREBASE) return;
  try {
    const res  = await fetch(`${FIREBASE_URL}/hearts.json`);
    const data = await res.json();
    if (data) Object.keys(data).forEach(y => localSet(y, data[y]));
  } catch(e) {}
}

async function firebaseSetCount(year, filename, count) {
  if (!USE_FIREBASE) return;
  try {
    await fetch(`${FIREBASE_URL}/hearts/${year}.json`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [filename]: count })
    });
  } catch(e) {}
}

// ── Heart counts ───────────────────────
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

// ── Build gallery (first load only) ───
function buildGallery(photos) {
  gallery.innerHTML = '';

  if (!photos.length) {
    gallery.innerHTML = '<p class="gallery-empty">photos coming soon ✦</p>';
    return;
  }

  photos.forEach(filename => {
    gallery.appendChild(makeItem(filename));
  });
}

function makeItem(filename) {
  const item = document.createElement('div');
  item.className = 'gallery-item';
  item.dataset.filename = filename;

  const img = document.createElement('img');
  img.src      = `photos/${currentYear}/${filename}`;
  img.alt      = '';
  img.loading  = 'lazy';
  img.decoding = 'async';
  img.addEventListener('load',  () => img.classList.add('loaded'));
  img.addEventListener('error', () => { item.style.display = 'none'; });

  const badge = document.createElement('div');
  badge.className = 'heart-badge';
  const count = getCount(currentYear, filename);
  badge.innerHTML = `<span class="heart-badge-icon">♥</span><span class="badge-count">${count}</span>`;
  if (count > 0) badge.classList.add('visible');

  item.addEventListener('click', () => {
    // Pop
    item.classList.remove('popping');
    void item.offsetWidth;
    item.classList.add('popping');
    item.addEventListener('animationend', () => item.classList.remove('popping'), { once: true });

    // Update badge
    const newCount = addHeart(currentYear, filename);
    badge.querySelector('.badge-count').textContent = newCount;
    badge.classList.add('visible');

    // Track which photo was last hearted for special animation
    lastHearted = filename;

    // Debounced FLIP resort
    clearTimeout(resortTimer);
    resortTimer = setTimeout(() => flipResort(), 2000);
  });

  item.appendChild(img);
  item.appendChild(badge);
  return item;
}

// ── FLIP resort ────────────────────────
function flipResort() {
  const items = [...gallery.querySelectorAll('.gallery-item')];
  if (items.length < 2) return;

  // FIRST — snapshot current screen positions
  const first = new Map();
  items.forEach(item => {
    first.set(item.dataset.filename, item.getBoundingClientRect());
  });

  // Compute new order
  const newOrder = sortByHearts(currentPhotos, currentYear);
  const orderChanged = newOrder.some((f, i) => f !== currentPhotos[i]);
  if (!orderChanged) return; // nothing to animate
  currentPhotos = newOrder;

  // Reorder DOM nodes in place (no rebuild — images stay loaded)
  currentPhotos.forEach(filename => {
    const el = gallery.querySelector(`[data-filename="${CSS.escape(filename)}"]`);
    if (el) gallery.appendChild(el);
  });

  // LAST — positions are now final; compute delta for each item
  items.forEach(item => {
    const f = first.get(item.dataset.filename);
    const l = item.getBoundingClientRect();
    const dx = f.left - l.left;
    const dy = f.top  - l.top;

    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return; // didn't move

    // Snap back to FIRST position instantly
    item.style.transition = 'none';
    item.style.transform  = `translate(${dx}px, ${dy}px)`;
  });

  // PLAY — animate everyone to their final (new) position
  requestAnimationFrame(() => requestAnimationFrame(() => {
    items.forEach(item => {
      if (!item.style.transform) return;

      // Hearted photo gets a springy overshoot; others get smooth ease
      const isHearted = item.dataset.filename === lastHearted;
      const easing = isHearted
        ? 'cubic-bezier(0.34, 1.38, 0.64, 1)'   // spring/bounce
        : 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'; // smooth ease-out
      const duration = isHearted ? '0.55s' : '0.42s';

      item.style.transition = `transform ${duration} ${easing}`;
      item.style.transform  = '';

      item.addEventListener('transitionend', () => {
        item.style.transition = '';
        item.style.transform  = '';
      }, { once: true });
    });
    lastHearted = null;
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
  const def = years.find(y => (photoManifest[y] || []).length > 0) || '2026';
  showYear(def);
})();
