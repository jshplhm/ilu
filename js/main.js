/* ─────────────────────────────────────────
   ilü — main.js  (carousel lightbox)
───────────────────────────────────────── */

// ── State ──────────────────────────────
let photoManifest = {};
let currentYear   = null;
let currentPhotos = [];
let currentIndex  = 0;

// ── Touch state ────────────────────────
let touchStartX   = 0;
let touchStartY   = 0;
let touchCurrentX = 0;
let isDragging    = false;
let isAnimating   = false;
let axisLocked    = null; // 'h' or 'v'

// ── DOM refs ───────────────────────────
const gallery   = document.getElementById('gallery');
const lightbox  = document.getElementById('lightbox');
const lbTrack   = document.getElementById('lbTrack');
const lbCounter = document.getElementById('lbCounter');
const imgPrev   = document.getElementById('lbImgPrev');
const imgCur    = document.getElementById('lbImgCur');
const imgNext   = document.getElementById('lbImgNext');

// ── Helpers ────────────────────────────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function photoSrc(index) {
  const i = (index + currentPhotos.length) % currentPhotos.length;
  return `photos/${currentYear}/${currentPhotos[i]}`;
}

// ── Load photos.json ───────────────────
async function loadManifest() {
  try {
    const res = await fetch('photos.json');
    photoManifest = await res.json();
  } catch (e) {
    photoManifest = {};
  }
}

// ── Show year ──────────────────────────
function showYear(year) {
  currentYear = String(year);
  document.querySelectorAll('.year-nav a').forEach(a => {
    a.classList.toggle('active', a.dataset.year === currentYear);
  });

  currentPhotos = shuffle(photoManifest[currentYear] || []);
  gallery.innerHTML = '';

  if (currentPhotos.length === 0) {
    gallery.innerHTML = '<p class="gallery-empty">photos coming soon ✦</p>';
    return;
  }

  currentPhotos.forEach((filename, i) => {
    const item = document.createElement('div');
    item.className = 'gallery-item';
    const img = document.createElement('img');
    img.src = `photos/${currentYear}/${filename}`;
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.addEventListener('load',  () => img.classList.add('loaded'));
    img.addEventListener('error', () => { item.style.display = 'none'; });
    item.addEventListener('click', () => openLightbox(i));
    item.appendChild(img);
    gallery.appendChild(item);
  });
}

// ── Carousel track position ────────────
// Track is 300% wide. Panel order: [prev][cur][next]
// Resting position shows the middle panel = translateX(-100vw)
function setTrackX(x, animate) {
  lbTrack.style.transition = animate
    ? 'transform 0.32s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
    : 'none';
  lbTrack.style.transform = `translateX(${x}px)`;
}

function resetTrack() {
  setTrackX(-window.innerWidth, false);
}

function loadPanels() {
  imgPrev.src = photoSrc(currentIndex - 1);
  imgCur.src  = photoSrc(currentIndex);
  imgNext.src = photoSrc(currentIndex + 1);
  lbCounter.textContent = `${currentIndex + 1} / ${currentPhotos.length}`;
}

// ── Lightbox open / close ──────────────
function openLightbox(index) {
  currentIndex = index;
  loadPanels();
  resetTrack();
  lightbox.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  lightbox.classList.remove('open');
  document.body.style.overflow = '';
}

// ── Navigate ───────────────────────────
function navigate(dir) {
  if (isAnimating) return;
  isAnimating = true;

  const targetX = -window.innerWidth + (-dir * window.innerWidth);
  setTrackX(targetX, true);

  lbTrack.addEventListener('transitionend', function onDone() {
    lbTrack.removeEventListener('transitionend', onDone);
    currentIndex = (currentIndex + dir + currentPhotos.length) % currentPhotos.length;
    loadPanels();
    resetTrack();
    isAnimating = false;
  }, { once: true });
}

// ── Touch — track follows finger ───────
let isPinching = false;

lightbox.addEventListener('touchstart', e => {
  if (isAnimating) return;
  // More than one finger = pinch zoom, ignore entirely
  if (e.touches.length > 1) { isPinching = true; return; }
  isPinching    = false;
  touchStartX   = e.touches[0].clientX;
  touchStartY   = e.touches[0].clientY;
  touchCurrentX = touchStartX;
  isDragging    = false;
  axisLocked    = null;
  setTrackX(-window.innerWidth, false);
}, { passive: true });

lightbox.addEventListener('touchmove', e => {
  // Always block browser zoom inside lightbox
  if (e.touches.length > 1) {
    e.preventDefault();
    isPinching = true;
    isDragging = false;
    resetTrack();
    return;
  }
  if (isAnimating || isPinching) return;
  // If browser viewport is zoomed in, don't swipe — let them pan
  if (window.visualViewport && window.visualViewport.scale > 1.05) return;
  touchCurrentX  = e.touches[0].clientX;
  const dx = touchCurrentX - touchStartX;
  const dy = e.touches[0].clientY - touchStartY;

  // Determine axis on first move
  if (!axisLocked) {
    if (Math.abs(dx) > Math.abs(dy) + 4)      axisLocked = 'h';
    else if (Math.abs(dy) > Math.abs(dx) + 4) axisLocked = 'v';
    else return;
  }

  if (axisLocked === 'v') return; // let page scroll

  isDragging = true;

  // Resistance at ends
  const atFirst = currentIndex === 0 && dx > 0;
  const atLast  = currentIndex === currentPhotos.length - 1 && dx < 0;
  const x = -window.innerWidth + (atFirst || atLast ? dx * 0.15 : dx);
  setTrackX(x, false);
}, { passive: false });

lightbox.addEventListener('touchend', e => {
  // Don't navigate if this was a pinch or if fingers still on screen
  if (isPinching || e.touches.length > 0) { isDragging = false; isPinching = false; return; }
  if (!isDragging || isAnimating) { isDragging = false; return; }
  isDragging = false;

  // Don't navigate if page is zoomed in
  if (window.visualViewport && window.visualViewport.scale > 1.05) {
    resetTrack();
    return;
  }

  const dx        = touchCurrentX - touchStartX;
  const threshold = window.innerWidth * 0.2;

  if (dx < -threshold)      navigate(1);   // swipe left  → next
  else if (dx > threshold)  navigate(-1);  // swipe right → prev
  else {
    // snap back
    setTrackX(-window.innerWidth, true);
    lbTrack.addEventListener('transitionend', () => {}, { once: true });
  }
}, { passive: true });

// ── Buttons & keyboard ─────────────────
document.getElementById('lbClose').addEventListener('click', closeLightbox);
document.getElementById('lbPrev').addEventListener('click', () => navigate(-1));
document.getElementById('lbNext').addEventListener('click', () => navigate(1));

lightbox.addEventListener('click', e => {
  if (e.target === lightbox) closeLightbox();
});

document.addEventListener('keydown', e => {
  if (!lightbox.classList.contains('open')) return;
  if (e.key === 'ArrowLeft')  navigate(-1);
  if (e.key === 'ArrowRight') navigate(1);
  if (e.key === 'Escape')     closeLightbox();
});

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
  const defaultYear = years.find(y => (photoManifest[y] || []).length > 0) || '2026';
  showYear(defaultYear);
})();
