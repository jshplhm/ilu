/* ─────────────────────────────────────────
   ilü — main.js
───────────────────────────────────────── */

// ── CONFIG ─────────────────────────────
const FIREBASE_URL = 'https://ilu-site-default-rtdb.firebaseio.com';
const USE_FIREBASE = FIREBASE_URL !== 'YOUR_FIREBASE_URL_HERE';

const YEARS = ['2026', '2025', '2024', '2023', '2022', '2021'];
const ALL_PHOTOS = 'all';

let photoManifest = {};
let currentYear   = null;
let currentPhotos = [];
let resortTimer   = null;
let lastHearted   = null;
let isAnimating   = false;
let hiddenMode    = false;
let buildGeneration = 0;
let shuffleOrder = {};
let allPhotosShuffleOrder = null;
let isSorting   = false;

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
  if (!shuffleOrder[year]) {
    const unhearted = arr.filter(f => getCount(year, f) === 0);
    for (let i = unhearted.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [unhearted[i], unhearted[j]] = [unhearted[j], unhearted[i]];
    }
    shuffleOrder[year] = unhearted;
  }

  const hearted = arr.filter(f => getCount(year, f) > 0);
  const unhearted = shuffleOrder[year].filter(f => arr.includes(f) && getCount(year, f) === 0);

  return [
    ...hearted.sort((a, b) => getCount(year, b) - getCount(year, a)),
    ...unhearted
  ];
}

function getAllPhotos() {
  const all = [];
  YEARS.forEach(year => {
    (photoManifest[year] || []).forEach(filename => {
      all.push({ filename, year });
    });
  });

  const hearted   = all.filter(p => getCount(p.year, p.filename) > 0);
  const unhearted = all.filter(p => getCount(p.year, p.filename) === 0);

  if (!allPhotosShuffleOrder) {
    const toShuffle = [...unhearted];
    for (let i = toShuffle.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [toShuffle[i], toShuffle[j]] = [toShuffle[j], toShuffle[i]];
    }
    allPhotosShuffleOrder = toShuffle;
  }

  const stableUnhearted = allPhotosShuffleOrder.filter(p =>
    unhearted.some(u => u.filename === p.filename && u.year === p.year)
  );

  return [
    ...hearted.sort((a, b) => getCount(b.year, b.filename) - getCount(a.year, a.filename)),
    ...stableUnhearted
  ];
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
function updateXoHearts() {
  let total = 0;
  Object.values(localGet('xo')).forEach(count => { total += count; });
  const el = document.getElementById('xoHeartTotal');
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

// ── Shortest column (by rendered height) ──
function shortestCol(cols) {
  return cols.reduce((min, col) =>
    col.offsetHeight < min.offsetHeight ? col : min
  );
}

// ── Make a photo card ──────────────────
function makeItem(filename, year, container) {
  const item = document.createElement('div');
  item.className = 'gallery-item';
  item.dataset.filename = filename;

  const img = document.createElement('img');
  img.src      = `photos/${year}/${filename}`;
  img.alt      = '';
  img.decoding = 'async';
  img.setAttribute('draggable', 'false');
  img.addEventListener('error', () => { item.style.display = 'none'; });

  const badge = document.createElement('div');
  badge.className = 'heart-badge';
  const count = getCount(year, filename);
  badge.innerHTML = `<span class="heart-badge-icon">♥</span><span class="badge-count">${count}</span>`;
  if (count > 0) badge.classList.add('visible');

  // ── Shared heart action ───────────────
  function triggerHeart() {
    if (isAnimating) return;

    item.classList.remove('popping');
    void item.offsetWidth;
    item.classList.add('popping');
    item.addEventListener('animationend', () => item.classList.remove('popping'), { once: true });

    const newCount = addHeart(year, filename);
    badge.querySelector('.badge-count').textContent = newCount;
    badge.classList.add('visible');

    if (year === 'xo') {
      updateXoHearts();
      lastHearted = filename;
      clearTimeout(resortTimer);
      resortTimer = setTimeout(() => flipResort(photoManifest['xo'], 'xo', document.querySelector('main .gallery')), 1000);
    } else {
      updateTotalHearts();
      if (year === currentYear || currentYear === 'all') {
        lastHearted = filename;
        clearTimeout(resortTimer);
        resortTimer = setTimeout(() => {
          if (currentYear === 'all') {
            flipResort(getAllPhotos(), 'all', gallery);
          } else {
            flipResort(currentPhotos, currentYear, gallery);
          }
        }, 1000);
      }
    }
  }
   
// ── Touch handling ────────────────────
let touchStartTime = 0;
let touchStartX    = 0;
let touchStartY    = 0;
let touchHandled   = false;
let longPressTimer = null;

item.addEventListener('touchstart', e => {
  const t     = e.touches[0];
  touchStartTime = e.timeStamp;
  touchStartX    = t.clientX;
  touchStartY    = t.clientY;
  touchHandled   = false;

  // Show badge while finger is still down (all-photos view only)
  if (currentYear === 'all' && !hiddenMode) {
    longPressTimer = setTimeout(() => {
  document.title = 'LP:' + filename;
  yearBadge.classList.add('visible');
  touchHandled = true;
}, 500);
  }
}, { passive: true });

item.addEventListener('touchend', e => {
  clearTimeout(longPressTimer);

  const t     = e.changedTouches[0];
  const moved = Math.sqrt(
    Math.pow(t.clientX - touchStartX, 2) +
    Math.pow(t.clientY - touchStartY, 2)
  );

  if (moved > 10) {
    // Finger drifted — was a scroll, not a tap
    yearBadge.classList.remove('visible');
    return;
  }

  if (touchHandled) {
    // Long press already fired — auto-hide badge
    setTimeout(() => yearBadge.classList.remove('visible'), 200);
    return;
  }

  // Clean short tap — heart directly, suppress synthetic mouse events
  e.preventDefault();
  touchHandled = true;
  triggerHeart();
}, { passive: false });

item.addEventListener('touchcancel', () => {
  clearTimeout(longPressTimer);
  yearBadge.classList.remove('visible');
});

  // ── Click (desktop only) ──────────────
  item.addEventListener('click', () => {
    if (touchHandled) { touchHandled = false; return; }
    triggerHeart();
  });

  item.appendChild(img);
  item.appendChild(badge);

  const yearBadge = document.createElement('div');
  yearBadge.className = 'year-badge';
  yearBadge.textContent = year;
  item.appendChild(yearBadge);

  item.addEventListener('mouseenter', () => {
  console.log('mouseenter:', filename);
  if (isSorting) return;
  if (currentYear === 'all' && !hiddenMode) yearBadge.classList.add('visible');
});

  return item;
}

// ── Build gallery ──────────────────────
function buildGallery(photos, year, container) {
  const isAll = year === 'all';
  buildGeneration++;
  const myGen = buildGeneration;
  container.innerHTML = '';

  if (!photos.length) {
    const msg = document.createElement('p');
    msg.className = 'gallery-message';
    msg.textContent = 'photos coming soon ✦';
    container.appendChild(msg);
    return;
  }

  const n          = numCols();
  const cols       = createCols(n, container);
  const colHeights = new Array(n).fill(0);

  function shortestColIdx() {
    let idx = 0;
    for (let i = 1; i < n; i++) {
      if (colHeights[i] < colHeights[idx]) idx = i;
    }
    return idx;
  }

  const items = isAll
  ? photos.map(p => makeItem(p.filename, p.year))
  : photos.map(f => makeItem(f, year));
  const ready     = new Array(photos.length).fill(false);
  let   nextPlace = 0;
  let   lastPlaced = 0;
  const STAGGER   = 60; // ms between each card appearing

  function tryPlace() {
  if (buildGeneration !== myGen) return;
  if (nextPlace < items.length && ready[nextPlace]) {
    const item = items[nextPlace];
    const img  = item.querySelector('img');
    const idx  = shortestColIdx();
    const delay = Math.max(0, lastPlaced + STAGGER - Date.now());

    cols[idx].appendChild(item);
    const colW = cols[idx].offsetWidth;
    const ar   = img.naturalWidth > 0 ? img.naturalHeight / img.naturalWidth : 1.33;
    colHeights[idx] += colW * ar + 8;

    setTimeout(() => {
      if (buildGeneration !== myGen) return;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        item.classList.add('visible');
      }));
    }, delay);

    lastPlaced = Date.now() + delay;
    nextPlace++;

    if (nextPlace === 1) {
      if (year !== 'xo') updateTotalHearts();
    }
    if (nextPlace === items.length) {
      setTimeout(() => {
        if (buildGeneration !== myGen) return;
        const maxH = Math.max(...cols.map(c => c.offsetHeight));
        cols.forEach(col => {
          const remaining = maxH - col.offsetHeight;
          if (remaining > 0) {
            const ph = document.createElement('div');
            ph.className = 'gallery-placeholder';
            ph.style.height = (remaining - 8) + 'px';
            col.appendChild(ph);
            setTimeout(() => ph.classList.add('visible'), 50);
          }
        });
      }, 400);
    }

    setTimeout(tryPlace, 0);
  }
}

  items.forEach((item, i) => {
    const img = item.querySelector('img');
    img.loading = 'eager';

    if (img.complete && img.naturalWidth > 0) {
      ready[i] = true;
      tryPlace();
    } else {
      img.addEventListener('load',  () => { ready[i] = true; tryPlace(); }, { once: true });
      img.addEventListener('error', () => { ready[i] = true; item.style.display = 'none'; tryPlace(); }, { once: true });
    }
  });
}

// ── FLIP resort ────────────────────────
function flipResort(photos, year, container) {
  const items = [...container.querySelectorAll('.gallery-item')];
  if (items.length < 2) return;

  const newOrder = year === 'all'
  ? getAllPhotos()
  : sortByHearts(photos, year);
const changed = newOrder.some((f, i) => {
  const fname = year === 'all' ? f.filename : f;
  return fname !== items[i]?.dataset.filename;
});
  if (!changed) return;

  isAnimating = true;
  isSorting   = true;
  if (year !== 'xo') currentPhotos = newOrder;

  const firstRects = new Map();
  items.forEach(item => {
    firstRects.set(item.dataset.filename, item.getBoundingClientRect());
  });

  const scrollY = window.scrollY;

  items.forEach(item => {
  item.querySelector('.year-badge')?.classList.remove('visible');
});
container.innerHTML = '';
  const n    = numCols();
  const cols = createCols(n, container);
  newOrder.forEach(f => {
  const fname = year === 'all' ? f.filename : f;
  const el = items.find(el => el.dataset.filename === fname);
  if (el) {
    el.querySelector('.year-badge')?.classList.remove('visible');
    shortestCol(cols).appendChild(el);
  }
});

  window.scrollTo({ top: scrollY, behavior: 'instant' });
  container.offsetHeight;

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

  if (movers.length === 0) {
  isAnimating = false;
  isSorting   = false;
  const allCols = [...container.querySelectorAll('.gallery-col')];
  const maxH = Math.max(...allCols.map(c => c.offsetHeight));
  allCols.forEach(col => {
    const remaining = maxH - col.offsetHeight;
    if (remaining > 0) {
      const ph = document.createElement('div');
      ph.className = 'gallery-placeholder';
      ph.style.height = (remaining - 8) + 'px';
      col.appendChild(ph);
      setTimeout(() => ph.classList.add('visible'), 50);
    }
  });
  return;
}

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
        if (pending === 0) {
        isAnimating = false;
        isSorting   = false;
          lastHearted = null;
          const allCols = [...container.querySelectorAll('.gallery-col')];
          const maxH = Math.max(...allCols.map(c => c.offsetHeight));
          allCols.forEach(col => {
            const remaining = maxH - col.offsetHeight;
            if (remaining > 0) {
              const ph = document.createElement('div');
              ph.className = 'gallery-placeholder';
              ph.style.height = (remaining - 8) + 'px';
              col.appendChild(ph);
              setTimeout(() => ph.classList.add('visible'), 50);
            }
          });
        }
      }, { once: true });
    });
  }));
setTimeout(() => {
  isAnimating = false;
  isSorting   = false;
  lastHearted = null;
  const allCols = [...container.querySelectorAll('.gallery-col')];
  if (allCols.length) {
    const maxH = Math.max(...allCols.map(c => c.offsetHeight));
    allCols.forEach(col => {
      if (!col.querySelector('.gallery-placeholder')) {
        const remaining = maxH - col.offsetHeight;
        if (remaining > 0) {
          const ph = document.createElement('div');
          ph.className = 'gallery-placeholder';
          ph.style.height = (remaining - 8) + 'px';
          col.appendChild(ph);
          setTimeout(() => ph.classList.add('visible'), 50);
        }
      }
    });
  }
}, 1000);
}

// ── Hidden page ────────────────────────
function openHiddenPage() {
  hiddenMode = true;
  document.querySelectorAll('.year-nav a').forEach(a => a.classList.remove('active'));
  document.body.classList.add('hidden-mode');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  window.history.pushState({ hidden: true }, '', '/');

  // Build hidden page content
  const main = document.querySelector('main');
  main.innerHTML = '';

  // Message
  const msg = document.createElement('p');
  msg.className = 'hidden-message';
  msg.textContent = 'where it all began.';
  main.appendChild(msg);

  // Gallery
  const xoGallery = document.createElement('div');
  xoGallery.className = 'gallery';
  main.appendChild(xoGallery);

  const xoPhotos = sortByHearts(photoManifest['xo'] || [], 'xo');

  buildGallery(xoPhotos, 'xo', xoGallery);

  // Hidden heart counter
  const counter = document.createElement('div');
  counter.id = 'xoHeartTotal';
  counter.className = 'heart-total xo-heart-total';
  main.appendChild(counter);
  updateXoHearts();
}

function closeHiddenPage() {
  hiddenMode = false;
  document.body.classList.remove('hidden-mode');
  showYear(currentYear || YEARS[0], false);
}

// ── Show year ──────────────────────────
function showYear(year, pushState = true, showHeader = false) {
  hiddenMode = false;
  document.body.classList.remove('hidden-mode');
  document.querySelector('header').classList.add('hidden');
  document.getElementById('logoLink').classList.remove('active');
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
  buildGallery(currentPhotos, currentYear, gallery);

  if (pushState) {
    window.history.pushState({ year: currentYear }, '', '/' + currentYear);
  }

  window.scrollTo({ top: 0, behavior: 'instant' });
}

function showAll(pushState = true) {
  hiddenMode = false;
  document.body.classList.remove('hidden-mode');
  currentYear = 'all';

  if (!gallery.isConnected) {
    const main = document.querySelector('main');
    main.innerHTML = '';
    main.appendChild(gallery);
  }

  document.querySelector('header').classList.remove('hidden');
  document.getElementById('logoLink').classList.add('active');
  document.querySelectorAll('.year-nav a').forEach(a => a.classList.remove('active'));

  const allPhotos = getAllPhotos();
  buildGallery(allPhotos, 'all', gallery);
  updateTotalHearts();

  if (pushState) {
    window.history.pushState({ all: true }, '', '/');
  }

  window.scrollTo({ top: 0, behavior: 'instant' });
}

// ── Year nav clicks ────────────────────
document.querySelectorAll('.year-nav a').forEach(a => {
  let touched = false;

  a.addEventListener('touchstart', e => {
    e.preventDefault();
    touched = true;
    if (hiddenMode || a.dataset.year !== currentYear) {
      showYear(a.dataset.year);
    } else {
      const navHeight  = document.querySelector('nav').offsetHeight;
      const galleryTop = gallery.getBoundingClientRect().top + window.scrollY - navHeight;
      window.scrollTo({ top: galleryTop, behavior: 'smooth' });
    }
  }, { passive: false });

  a.addEventListener('click', e => {
    e.preventDefault();
    if (touched) { touched = false; return; }
    if (hiddenMode || a.dataset.year !== currentYear) {
      showYear(a.dataset.year);
    } else {
      const navHeight  = document.querySelector('nav').offsetHeight;
      const galleryTop = gallery.getBoundingClientRect().top + window.scrollY - navHeight;
      window.scrollTo({ top: galleryTop, behavior: 'smooth' });
    }
  });
});

// ── Logo click ─────────────────────────
let logoTouched = false;

document.getElementById('logoLink').addEventListener('touchstart', e => {
  e.preventDefault();
  logoTouched = true;
  hiddenMode = false;
  document.body.classList.remove('hidden-mode');
  showAll(true);
  window.history.pushState({ all: true }, '', '/');
}, { passive: false });

document.getElementById('logoLink').addEventListener('click', () => {
  if (logoTouched) { logoTouched = false; return; }
  hiddenMode = false;
  document.body.classList.remove('hidden-mode');
  showAll(true);
  window.history.pushState({ all: true }, '', '/');
});

// ── Browser back/forward ───────────────
window.addEventListener('popstate', e => {
  if (e.state?.hidden) {
    openHiddenPage();
  } else if (e.state?.all) {
    showAll(false);
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
    if (newN !== currentN) {
  if (currentYear === 'all') {
    buildGallery(getAllPhotos(), 'all', gallery);
  } else {
    buildGallery(currentPhotos, currentYear, gallery);
  }
}
  }, 150);
});

// ── Init ───────────────────────────────
(async () => {
  await Promise.all([loadManifest(), firebaseLoadAll()]);
  const def  = YEARS.find(y => (photoManifest[y] || []).length > 0) || '2026';
  const path = window.location.pathname.replace('/', '');

  const startYear = YEARS.includes(path) ? path : def;
const isRoot = !YEARS.includes(path);
if (isRoot) {
  showAll(false);
} else {
  showYear(startYear, false, false);
}

  // Preload other years in background
  setTimeout(() => {
    YEARS.filter(y => y !== currentYear).forEach(year => {
      (photoManifest[year] || []).forEach(filename => {
        new Image().src = `photos/${year}/${filename}`;
      });
    });
  }, 3000);
})();
