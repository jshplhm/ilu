/* ─────────────────────────────────────────
   ilü — main.js
───────────────────────────────────────── */

let photoManifest = {};
let currentYear   = null;
let currentPhotos = [];
let currentIndex  = 0;
let resortTimer   = null;

// Touch tracking
let touchStartX   = 0;
let touchStartY   = 0;
let touchCurrentX = 0;
let isDragging    = false;
let isAnimating   = false;
let isPinching    = false;
let axisLocked    = null;

const gallery   = document.getElementById('gallery');
const lightbox  = document.getElementById('lightbox');
const lbImg     = document.getElementById('lbImg');
const lbCounter = document.getElementById('lbCounter');

// ── Hearts (localStorage) ──────────────
function heartsKey(year) {
  return `ilu_hearts_${year}`;
}

function getHearts(year) {
  try {
    return JSON.parse(localStorage.getItem(heartsKey(year))) || {};
  } catch(e) { return {}; }
}

function saveHearts(year, hearts) {
  try {
    localStorage.setItem(heartsKey(year), JSON.stringify(hearts));
  } catch(e) {}
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

function src(index) {
  const i = (index + currentPhotos.length) % currentPhotos.length;
  return `photos/${currentYear}/${currentPhotos[i]}`;
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

  photos.forEach((filename, i) => {
    const item = document.createElement('div');
    item.className = 'gallery-item';
    item.dataset.filename = filename;

    const img = document.createElement('img');
    img.src = `photos/${currentYear}/${filename}`;
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.addEventListener('load',  () => img.classList.add('loaded'));
    img.addEventListener('error', () => { item.style.display = 'none'; });
    img.addEventListener('click', () => {
      const idx = currentPhotos.indexOf(filename);
      if (idx !== -1) openLightbox(idx);
    });

    // Heart button
    const heartBtn = document.createElement('button');
    heartBtn.className = 'heart-btn';
    heartBtn.setAttribute('aria-label', 'Heart this photo');
    heartBtn.innerHTML = `<span class="heart-icon">♥</span><span class="heart-count">${getCount(currentYear, filename) || ''}</span>`;

    heartBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const count = addHeart(currentYear, filename);

      // Update count display
      heartBtn.querySelector('.heart-count').textContent = count;

      // Pop animation
      heartBtn.classList.remove('heart-pop');
      void heartBtn.offsetWidth; // force reflow
      heartBtn.classList.add('heart-pop');
      heartBtn.classList.add('hearted');

      // Debounced resort — 2s after last tap
      clearTimeout(resortTimer);
      resortTimer = setTimeout(() => resortGallery(), 2000);
    });

    item.appendChild(img);
    item.appendChild(heartBtn);
    gallery.appendChild(item);
  });
}

// ── Resort with fade ───────────────────
function resortGallery() {
  // Fade out
  gallery.style.transition = 'opacity 0.3s ease';
  gallery.style.opacity    = '0';

  setTimeout(() => {
    // Re-sort and rebuild
    currentPhotos = sortByHearts(currentPhotos, currentYear);
    buildGallery(currentPhotos);

    // Fade back in
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

  // Start with hearts-sorted order (most loved on top)
  const raw = photoManifest[currentYear] || [];
  const hasHearts = raw.some(f => getCount(currentYear, f) > 0);
  currentPhotos = hasHearts ? sortByHearts(raw, currentYear) : shuffle(raw);

  buildGallery(currentPhotos);
}

// ── Lightbox ───────────────────────────
function openLightbox(index) {
  currentIndex = index;
  lbImg.style.cssText = '';
  lbImg.src = src(currentIndex);
  lbCounter.textContent = `${currentIndex + 1} / ${currentPhotos.length}`;
  lightbox.classList.add('open');
  document.body.style.overflow = 'hidden';
  preload(currentIndex + 1);
  preload(currentIndex - 1);
}

function closeLightbox() {
  lightbox.classList.remove('open');
  document.body.style.overflow = '';
  setTimeout(() => { lbImg.src = ''; }, 300);
}

function preload(index) {
  const i = (index + currentPhotos.length) % currentPhotos.length;
  new Image().src = src(i);
}

function navigate(dir) {
  if (isAnimating) return;
  isAnimating = true;

  const outX = dir > 0 ? '-60vw' : '60vw';
  const inX  = dir > 0 ?  '60vw' : '-60vw';

  lbImg.style.transition = 'transform 0.25s ease-in, opacity 0.25s ease-in';
  lbImg.style.transform  = `translateX(${outX})`;
  lbImg.style.opacity    = '0';

  setTimeout(() => {
    currentIndex = (currentIndex + dir + currentPhotos.length) % currentPhotos.length;
    lbImg.src = src(currentIndex);
    lbCounter.textContent = `${currentIndex + 1} / ${currentPhotos.length}`;
    lbImg.style.transition = 'none';
    lbImg.style.transform  = `translateX(${inX})`;
    lbImg.style.opacity    = '0';

    requestAnimationFrame(() => requestAnimationFrame(() => {
      lbImg.style.transition = 'transform 0.25s ease-out, opacity 0.25s ease-out';
      lbImg.style.transform  = 'translateX(0)';
      lbImg.style.opacity    = '1';
      setTimeout(() => {
        lbImg.style.cssText = '';
        isAnimating = false;
        preload(currentIndex + 1);
        preload(currentIndex - 1);
      }, 260);
    }));
  }, 250);
}

// ── Touch swipe in lightbox ─────────────
lightbox.addEventListener('touchstart', e => {
  if (isAnimating) return;
  if (e.touches.length > 1) { isPinching = true; return; }
  isPinching    = false;
  axisLocked    = null;
  isDragging    = false;
  touchStartX   = e.touches[0].clientX;
  touchStartY   = e.touches[0].clientY;
  touchCurrentX = touchStartX;
  lbImg.style.transition = 'none';
}, { passive: true });

lightbox.addEventListener('touchmove', e => {
  if (isPinching || isAnimating) return;
  if (e.touches.length > 1) {
    isPinching = true; isDragging = false;
    lbImg.style.cssText = '';
    return;
  }
  if (window.visualViewport && window.visualViewport.scale > 1.05) return;

  touchCurrentX = e.touches[0].clientX;
  const dx = touchCurrentX - touchStartX;
  const dy = e.touches[0].clientY - touchStartY;

  if (!axisLocked) {
    if (Math.abs(dx) > Math.abs(dy) + 5)      axisLocked = 'h';
    else if (Math.abs(dy) > Math.abs(dx) + 5) axisLocked = 'v';
    else return;
  }
  if (axisLocked === 'v') return;

  isDragging = true;
  const atEdge = (currentIndex === 0 && dx > 0) ||
                 (currentIndex === currentPhotos.length - 1 && dx < 0);
  const x = atEdge ? dx * 0.15 : dx;
  lbImg.style.transform = `translateX(${x}px)`;
  lbImg.style.opacity   = String(Math.max(0.4, 1 - Math.abs(x) / (window.innerWidth * 0.8)));
}, { passive: true });

lightbox.addEventListener('touchend', e => {
  if (isPinching || e.touches.length > 0) {
    isPinching = false; isDragging = false; return;
  }
  if (!isDragging || isAnimating) { isDragging = false; return; }
  isDragging = false;
  if (window.visualViewport && window.visualViewport.scale > 1.05) {
    lbImg.style.cssText = ''; return;
  }

  const dx = touchCurrentX - touchStartX;
  const threshold = window.innerWidth * 0.2;

  if (dx < -threshold)     navigate(1);
  else if (dx > threshold) navigate(-1);
  else {
    lbImg.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
    lbImg.style.transform  = 'translateX(0)';
    lbImg.style.opacity    = '1';
    setTimeout(() => { lbImg.style.cssText = ''; }, 310);
  }
}, { passive: true });

// ── Buttons & keyboard ─────────────────
document.getElementById('lbClose').addEventListener('click', closeLightbox);
document.getElementById('lbPrev').addEventListener('click', () => navigate(-1));
document.getElementById('lbNext').addEventListener('click', () => navigate(1));
lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });
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
  const def = years.find(y => (photoManifest[y] || []).length > 0) || '2026';
  showYear(def);
})();
