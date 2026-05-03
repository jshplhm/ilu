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
let isSliding     = false;

const gallery  = document.getElementById('gallery');
const mainEl   = document.querySelector('main');

// ── Slider DOM setup ───────────────────
// We wrap gallery in a viewport, with a track that holds 3 panels:
// [prev year] [current year] [next year]
// The track sits at -100vw (showing center panel) at rest.
let sliderTrack   = null;
let prevPanel     = null;
let curPanel      = null;
let nextPanel     = null;

function setupSlider() {
  // Replace gallery with slider structure
  mainEl.innerHTML = '';

  const viewport = document.createElement('div');
  viewport.className = 'slider-viewport';

  sliderTrack = document.createElement('div');
  sliderTrack.className = 'slider-track';

  prevPanel = document.createElement('div');
  prevPanel.className = 'slider-panel';
  curPanel  = document.createElement('div');
  curPanel.className = 'slider-panel';
  nextPanel = document.createElement('div');
  nextPanel.className = 'slider-panel';

  sliderTrack.appendChild(prevPanel);
  sliderTrack.appendChild(curPanel);
  sliderTrack.appendChild(nextPanel);
  viewport.appendChild(sliderTrack);
  mainEl.appendChild(viewport);

  // Heart total lives after the viewport
  const total = document.createElement('div');
  total.id = 'heartTotal';
  total.className = 'heart-total';
  mainEl.appendChild(total);
}

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

// ── Total hearts ───────────────────────
function updateTotalHearts() {
  let total = 0;
  YEARS.forEach(year => {
    Object.values(localGet(year)).forEach(count => { total += count; });
  });
  const el = document.getElementById('heartTotal');
  if (el) el.textContent = total > 0 ? `♥ ${total.toLocaleString()}` : '';
}

// ── Load manifest ──────────────────────
async function loadManifest() {
  try {
    const res = await fetch('photos.json');
    photoManifest = await res.json();
  } catch(e) { photoManifest = {}; }
}

// ── Build a gallery panel ──────────────
function buildPanel(panel, year) {
  panel.innerHTML = '';
  panel.dataset.year = year;

  const photos = sortByHearts(photoManifest[year] || [], year);

  if (!photos.length) {
    const msg = document.createElement('p');
    msg.className = 'gallery-message';
    msg.textContent = 'photos coming soon ✦';
    panel.appendChild(msg);
    return;
  }

  const galleryDiv = document.createElement('div');
  galleryDiv.className = 'gallery';

  const n    = numCols();
  const cols = [];
  for (let i = 0; i < n; i++) {
    const col = document.createElement('div');
    col.className = 'gallery-col';
    galleryDiv.appendChild(col);
    cols.push(col);
  }

  photos.forEach((filename, i) => {
    cols[i % n].appendChild(makeItem(filename, year));
  });

  panel.appendChild(galleryDiv);
}

// ── Make a photo card ──────────────────
function makeItem(filename, year) {
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
    if (isAnimating || isSliding) return;

    item.classList.remove('popping');
    void item.offsetWidth;
    item.classList.add('popping');
    item.addEventListener('animationend', () => item.classList.remove('popping'), { once: true });

    const newCount = addHeart(year, filename);
    badge.querySelector('.badge-count').textContent = newCount;
    badge.classList.add('visible');
    updateTotalHearts();

    if (year === currentYear) {
      lastHearted = filename;
      clearTimeout(resortTimer);
      resortTimer = setTimeout(() => flipResort(), 2000);
    }
  });

  item.appendChild(img);
  item.appendChild(badge);
  return item;
}

// ── FLIP resort (current panel only) ───
function flipResort() {
  const galleryDiv = curPanel.querySelector('.gallery');
  if (!galleryDiv) return;

  const items = [...galleryDiv.querySelectorAll('.gallery-item')];
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

  // Rebuild columns
  galleryDiv.innerHTML = '';
  const n = numCols();
  const cols = [];
  for (let i = 0; i < n; i++) {
    const col = document.createElement('div');
    col.className = 'gallery-col';
    galleryDiv.appendChild(col);
    cols.push(col);
  }
  currentPhotos.forEach((filename, i) => {
    const el = items.find(el => el.dataset.filename === filename);
    if (el) cols[i % n].appendChild(el);
  });

  galleryDiv.offsetHeight;

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

// ── Load adjacent panels ───────────────
function loadAdjacentPanels(year) {
  const idx  = YEARS.indexOf(year);
  const prev = YEARS[idx - 1] || null; // newer
  const next = YEARS[idx + 1] || null; // older

  if (prev) buildPanel(prevPanel, prev);
  else prevPanel.innerHTML = '';

  if (next) buildPanel(nextPanel, next);
  else nextPanel.innerHTML = '';
}

// ── Show year ──────────────────────────
function showYear(year, pushState = true, fromSwipe = false) {
  currentYear   = String(year);
  currentPhotos = sortByHearts(photoManifest[currentYear] || [], currentYear);

  document.querySelectorAll('.year-nav a').forEach(a => {
    a.classList.toggle('active', a.dataset.year === currentYear);
  });

  if (!fromSwipe) {
    // Full rebuild — nav click or initial load
    buildPanel(curPanel, currentYear);
    sliderTrack.style.transition = 'none';
    sliderTrack.style.transform  = 'translateX(-100vw)';
  } else {
    // After swipe — panels already in place, just rotate them
    // The panel that slid into view becomes curPanel
    // No rebuild needed, no flash
    const dir = YEARS.indexOf(year) > YEARS.indexOf(currentYear === year ? year : currentYear) ? 1 : -1;
    const temp = dir > 0 ? nextPanel : prevPanel;
    if (dir > 0) {
      prevPanel = curPanel;
      curPanel  = nextPanel;
      nextPanel = temp;
    } else {
      nextPanel = curPanel;
      curPanel  = prevPanel;
      prevPanel = temp;
    }
    sliderTrack.innerHTML = '';
    sliderTrack.appendChild(prevPanel);
    sliderTrack.appendChild(curPanel);
    sliderTrack.appendChild(nextPanel);
    sliderTrack.style.transition = 'none';
    sliderTrack.style.transform  = 'translateX(-100vw)';
  }

  loadAdjacentPanels(currentYear);
  updateTotalHearts();

  if (pushState) {
    window.history.pushState({ year: currentYear }, '', '/' + currentYear);
  }
  if (!fromSwipe) window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── Year nav clicks ────────────────────
document.querySelectorAll('.year-nav a').forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    if (a.dataset.year !== currentYear) showYear(a.dataset.year);
  });
});

// ── Page swipe — track follows finger ──
let swipeStartX   = 0;
let swipeStartY   = 0;
let swipeCurrentX = 0;
let swipeAxisLocked = null;
let swipeActive   = false;

document.addEventListener('touchstart', e => {
  if (e.touches.length > 1 || isAnimating) return;
  swipeStartX    = e.touches[0].clientX;
  swipeStartY    = e.touches[0].clientY;
  swipeCurrentX  = swipeStartX;
  swipeAxisLocked = null;
  swipeActive    = false;
  sliderTrack.style.transition = 'none';
}, { passive: true });

document.addEventListener('touchmove', e => {
  if (e.touches.length > 1 || isAnimating) return;
  swipeCurrentX = e.touches[0].clientX;
  const dx = swipeCurrentX - swipeStartX;
  const dy = e.touches[0].clientY - swipeStartY;

  if (!swipeAxisLocked) {
    if (Math.abs(dx) > Math.abs(dy) + 8)      swipeAxisLocked = 'h';
    else if (Math.abs(dy) > Math.abs(dx) + 8) swipeAxisLocked = 'v';
    else return;
  }

  if (swipeAxisLocked !== 'h') return;

  const idx    = YEARS.indexOf(currentYear);
  const atLeft  = idx === 0 && dx > 0;   // no newer year
  const atRight = idx === YEARS.length - 1 && dx < 0; // no older year

  const resistance = (atLeft || atRight) ? 0.15 : 1;
  const offset = -window.innerWidth + (dx * resistance);

  swipeActive = true;
  sliderTrack.style.transform = `translateX(${offset}px)`;
}, { passive: true });

document.addEventListener('touchend', () => {
  if (!swipeActive || isAnimating) { swipeActive = false; return; }
  swipeActive = false;

  const dx        = swipeCurrentX - swipeStartX;
  const threshold = window.innerWidth * 0.25;
  const idx       = YEARS.indexOf(currentYear);

  if (dx < -threshold && idx < YEARS.length - 1) {
    // Swipe left → older year (next panel)
    isSliding = true;
    sliderTrack.style.transition = 'transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    sliderTrack.style.transform  = 'translateX(-200vw)';
    sliderTrack.addEventListener('transitionend', () => {
      isSliding = false;
      showYear(YEARS[idx + 1], true, true);
    }, { once: true });

  } else if (dx > threshold && idx > 0) {
    // Swipe right → newer year (prev panel)
    isSliding = true;
    sliderTrack.style.transition = 'transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    sliderTrack.style.transform  = 'translateX(0)';
    sliderTrack.addEventListener('transitionend', () => {
      isSliding = false;
      showYear(YEARS[idx - 1], true, true);
    }, { once: true });

  } else {
    // Snap back
    sliderTrack.style.transition = 'transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    sliderTrack.style.transform  = 'translateX(-100vw)';
  }
}, { passive: true });

// ── Browser back/forward ───────────────
window.addEventListener('popstate', e => {
  const year = e.state?.year;
  if (year && YEARS.includes(year)) showYear(year, false);
});

// ── Responsive resize ──────────────────
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    showYear(currentYear, false);
  }, 150);
});

// ── Init ───────────────────────────────
(async () => {
  setupSlider();
  await Promise.all([loadManifest(), firebaseLoadAll()]);

  const def  = YEARS.find(y => (photoManifest[y] || []).length > 0) || '2026';
  const path = window.location.pathname.replace('/', '');
  const startYear = YEARS.includes(path) ? path : def;

  showYear(startYear, false);

  // Preload other years in background
  setTimeout(() => {
    YEARS.filter(y => y !== startYear).forEach(year => {
      (photoManifest[year] || []).forEach(filename => {
        new Image().src = `photos/${year}/${filename}`;
      });
    });
  }, 3000);
})();
