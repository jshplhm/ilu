/* ─────────────────────────────────────────
   ilü — main.js
───────────────────────────────────────── */

// ── State ──────────────────────────────
let photoManifest = {};     // all data from photos.json
let currentYear   = null;   // active year string e.g. "2024"
let currentPhotos = [];     // shuffled array of filenames for current year
let currentIndex  = 0;      // index in currentPhotos shown in lightbox
let touchStartX   = 0;      // for swipe detection

// ── DOM refs ───────────────────────────
const gallery     = document.getElementById('gallery');
const lightbox    = document.getElementById('lightbox');
const lbImg       = document.getElementById('lbImg');
const lbCounter   = document.getElementById('lbCounter');

// ── Utility: Fisher-Yates shuffle ──────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Load the photos.json manifest ──────
async function loadManifest() {
  try {
    const res = await fetch('photos.json');
    photoManifest = await res.json();
  } catch (e) {
    console.error('Could not load photos.json', e);
    photoManifest = {};
  }
}

// ── Show photos for a given year ───────
function showYear(year) {
  currentYear = String(year);

  // Update nav active state
  document.querySelectorAll('.year-nav a').forEach(a => {
    a.classList.toggle('active', a.dataset.year === currentYear);
  });

  const raw = photoManifest[currentYear] || [];
  currentPhotos = shuffle(raw);

  // Clear gallery
  gallery.innerHTML = '';

  if (currentPhotos.length === 0) {
    gallery.innerHTML = '<p class="gallery-empty">photos coming soon ✦</p>';
    return;
  }

  // Render items
  currentPhotos.forEach((filename, i) => {
    const item = document.createElement('div');
    item.className = 'gallery-item';

    const img = document.createElement('img');
    img.src = `photos/${currentYear}/${filename}`;
    img.alt  = '';
    img.loading = 'lazy';
    img.decoding = 'async';

    // Fade in once loaded
    img.addEventListener('load', () => img.classList.add('loaded'));
    img.addEventListener('error', () => { item.style.display = 'none'; });

    item.addEventListener('click', () => openLightbox(i));
    item.appendChild(img);
    gallery.appendChild(item);
  });
}

// ── Lightbox ───────────────────────────
function openLightbox(index) {
  currentIndex = index;
  updateLightboxImage();
  lightbox.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  lightbox.classList.remove('open');
  document.body.style.overflow = '';
  lbImg.src = '';
}

function updateLightboxImage() {
  const filename = currentPhotos[currentIndex];
  lbImg.src = `photos/${currentYear}/${filename}`;
  lbCounter.textContent = `${currentIndex + 1} / ${currentPhotos.length}`;
}

function navigate(dir) {
  currentIndex = (currentIndex + dir + currentPhotos.length) % currentPhotos.length;
  updateLightboxImage();
}

// ── Lightbox event listeners ────────────
document.getElementById('lbClose').addEventListener('click', closeLightbox);
document.getElementById('lbPrev').addEventListener('click', () => navigate(-1));
document.getElementById('lbNext').addEventListener('click', () => navigate(1));

// Close on backdrop click
lightbox.addEventListener('click', e => {
  if (e.target === lightbox) closeLightbox();
});

// Keyboard navigation
document.addEventListener('keydown', e => {
  if (!lightbox.classList.contains('open')) return;
  if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   navigate(-1);
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown')  navigate(1);
  if (e.key === 'Escape')                               closeLightbox();
});

// Touch / swipe support
lightbox.addEventListener('touchstart', e => {
  touchStartX = e.touches[0].clientX;
}, { passive: true });

lightbox.addEventListener('touchend', e => {
  const diff = touchStartX - e.changedTouches[0].clientX;
  if (Math.abs(diff) > 40) navigate(diff > 0 ? 1 : -1);
}, { passive: true });

// ── Year nav clicks ────────────────────
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

  // Default to most recent year that has photos, falling back to 2026
  const years = ['2026', '2025', '2024', '2023', '2022'];
  const defaultYear = years.find(y => (photoManifest[y] || []).length > 0) || '2026';
  showYear(defaultYear);
})();
