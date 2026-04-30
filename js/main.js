/* ─────────────────────────────────────────
   ilü — main.js  (no lightbox, tap to heart)
───────────────────────────────────────── */

let photoManifest = {};
let currentYear   = null;
let currentPhotos = [];
let resortTimer   = null;

const gallery = document.getElementById('gallery');

// ── Hearts (localStorage) ──────────────
function getHearts(year) {
  try { return JSON.parse(localStorage.getItem(`ilu_hearts_${year}`)) || {}; }
  catch(e) { return {}; }
}

function saveHearts(year, hearts) {
  try { localStorage.setItem(`ilu_hearts_${year}`, JSON.stringify(hearts)); }
  catch(e) {}
}

function getCount(year, filename) {
  return getHearts(year)[filename] || 0;
}

function addHeart(year, filename) {
  const hearts = getHearts(year);
  hearts[filename] = (hearts[filename] || 0) + 1;
  saveHearts(year, hearts);
  return hearts[filename];
}

// ── Utilities ──────────────────────────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

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

// ── Build gallery ──────────────────────
function buildGallery(photos) {
  gallery.innerHTML = '';

  if (!photos.length) {
    gallery.innerHTML = '<p class="gallery-empty">photos coming soon ✦</p>';
    return;
  }

  photos.forEach(filename => {
    const item = document.createElement('div');
    item.className = 'gallery-item';
    item.dataset.filename = filename;

    // Photo
    const img = document.createElement('img');
    img.src     = `photos/${currentYear}/${filename}`;
    img.alt     = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.addEventListener('load', () => img.classList.add('loaded'));
    img.addEventListener('error', () => { item.style.display = 'none'; });

    // Big heart burst overlay (shows on tap then fades)
    const overlay = document.createElement('div');
    overlay.className = 'heart-overlay';
    overlay.innerHTML = '<span class="heart-overlay-icon">♥</span>';

    // Small badge (persistent, shows count)
    const badge = document.createElement('div');
    badge.className = 'heart-badge';
    const count = getCount(currentYear, filename);
    badge.innerHTML = `<span class="heart-badge-icon">♥</span><span class="badge-count">${count}</span>`;
    if (count > 0) badge.classList.add('visible');

    // Tap to heart
    item.addEventListener('click', () => {
      // 1. Card pop
      item.classList.remove('popping');
      void item.offsetWidth;
      item.classList.add('popping');
      item.addEventListener('animationend', () => item.classList.remove('popping'), { once: true });

      // 2. Big heart burst
      overlay.classList.remove('burst');
      void overlay.offsetWidth;
      overlay.classList.add('burst');
      overlay.addEventListener('animationend', () => overlay.classList.remove('burst'), { once: true });

      // 3. Update badge count
      const newCount = addHeart(currentYear, filename);
      badge.querySelector('.badge-count').textContent = newCount;
      badge.classList.add('visible');

      // 4. Debounced resort — 2s after last tap
      clearTimeout(resortTimer);
      resortTimer = setTimeout(() => resortGallery(), 2000);
    });

    item.appendChild(img);
    item.appendChild(overlay);
    item.appendChild(badge);
    gallery.appendChild(item);
  });
}

// ── Resort with fade ───────────────────
function resortGallery() {
  gallery.style.transition = 'opacity 0.3s ease';
  gallery.style.opacity    = '0';

  setTimeout(() => {
    currentPhotos = sortByHearts(currentPhotos, currentYear);
    buildGallery(currentPhotos);
    requestAnimationFrame(() => {
      gallery.style.opacity = '1';
      setTimeout(() => { gallery.style.transition = ''; }, 320);
    });
  }, 320);
}

// ── Show year ──────────────────────────
function showYear(year) {
  currentYear = String(year);
  document.querySelectorAll('.year-nav a').forEach(a => {
    a.classList.toggle('active', a.dataset.year === currentYear);
  });

  const raw = photoManifest[currentYear] || [];
  const hasHearts = raw.some(f => getCount(currentYear, f) > 0);
  currentPhotos = hasHearts ? sortByHearts(raw, currentYear) : shuffle(raw);
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
  await loadManifest();
  const years = ['2026', '2025', '2024', '2023', '2022'];
  const def = years.find(y => (photoManifest[y] || []).length > 0) || '2026';
  showYear(def);
})();
