/* ─────────────────────────────────────────
   ilü — main.js
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

// ── DOM refs ───────────────────────────
const gallery   = document.getElementById('gallery');
const lightbox  = document.getElementById('lightbox');
const lbImg     = document.getElementById('lbImg');
const lbCounter = document.getElementById('lbCounter');

// ── Utility: Fisher-Yates shuffle ──────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Load photos.json ───────────────────
async function loadManifest() {
  try {
    const res = await fetch('photos.json');
    photoManifest = await res.json();
  } catch (e) {
    console.error('Could not load photos.json', e);
    photoManifest = {};
  }
}

// ── Show photos for a year ─────────────
function showYear(year) {
  currentYear = String(year);

  document.querySelectorAll('.year-nav a').forEach(a => {
    a.classList.toggle('active', a.dataset.year === currentYear);
  });

  const raw = photoManifest[currentYear] || [];
  currentPhotos = shuffle(raw);
  gallery.innerHTML = '';

  if (currentPhotos.length === 0) {
    gallery.innerHTML = '<p class="gallery-empty">photos coming soon \u2726</p>';
    return;
  }

  currentPhotos.forEach((filename, i) => {
    const item = document.createElement('div');
    item.className = 'gallery-item';

    const img = document.createElement('img');
    img.src      = `photos/${currentYear}/${filename}`;
    img.alt      = '';
    img.loading  = 'lazy';
    img.decoding = 'async';

    img.addEventListener('load',  () => img.classList.add('loaded'));
    img.addEventListener('error', () => { item.style.display = 'none'; });

    item.addEventListener('click', () => openLightbox(i));
    item.appendChild(img);
    gallery.appendChild(item);
  });
}

// ── Lightbox open / close ──────────────
function openLightbox(index) {
  currentIndex = index;
  lbImg.style.transform  = '';
  lbImg.style.transition = '';
  lbImg.style.opacity    = '1';
  setLightboxSrc(currentIndex);
  lightbox.classList.add('open');
  document.body.style.overflow = 'hidden';
  preloadAdjacent();
}

function closeLightbox() {
  lightbox.classList.remove('open');
  document.body.style.overflow = '';
  setTimeout(() => { lbImg.src = ''; }, 300);
}

function setLightboxSrc(index) {
  lbImg.src = `photos/${currentYear}/${currentPhotos[index]}`;
  lbCounter.textContent = `${index + 1} / ${currentPhotos.length}`;
}

function preloadAdjacent() {
  const preload = (i) => {
    const idx = (i + currentPhotos.length) % currentPhotos.length;
    const pre = new Image();
    pre.src = `photos/${currentYear}/${currentPhotos[idx]}`;
  };
  preload(currentIndex + 1);
  preload(currentIndex - 1);
}

// ── Navigate with slide animation ──────
function navigate(dir) {
  if (isAnimating) return;
  isAnimating = true;

  const slideOut = dir > 0 ? -110 : 110;

  lbImg.style.transition = 'transform 0.28s cubic-bezier(0.4,0,0.2,1), opacity 0.28s ease';
  lbImg.style.transform  = `translateX(${slideOut}%)`;
  lbImg.style.opacity    = '0';

  setTimeout(() => {
    currentIndex = (currentIndex + dir + currentPhotos.length) % currentPhotos.length;
    setLightboxSrc(currentIndex);

    lbImg.style.transition = 'none';
    lbImg.style.transform  = `translateX(${-slideOut}%)`;
    lbImg.style.opacity    = '0';

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        lbImg.style.transition = 'transform 0.28s cubic-bezier(0.4,0,0.2,1), opacity 0.28s ease';
        lbImg.style.transform  = 'translateX(0)';
        lbImg.style.opacity    = '1';

        setTimeout(() => {
          lbImg.style.transition = '';
          isAnimating = false;
          preloadAdjacent();
        }, 290);
      });
    });
  }, 280);
}

// ── Touch swipe — image follows finger ─
lightbox.addEventListener('touchstart', e => {
  if (isAnimating) return;
  touchStartX   = e.touches[0].clientX;
  touchStartY   = e.touches[0].clientY;
  touchCurrentX = touchStartX;
  isDragging    = false;
  scrollLocked  = false;
  lbImg.style.transition = 'none';
}, { passive: true });

lightbox.addEventListener('touchmove', e => {
  if (isAnimating) return;
  touchCurrentX = e.touches[0].clientX;
  const dx = touchCurrentX - touchStartX;
  const dy = e.touches[0].clientY - touchStartY;

  if (!scrollLocked) {
    if (Math.abs(dx) > Math.abs(dy) + 5) {
      scrollLocked = true;
      isDragging   = true;
    } else if (Math.abs(dy) > Math.abs(dx) + 5) {
      return;
    }
  }

  if (!isDragging) return;

  const atFirst = currentIndex === 0 && dx > 0;
  const atLast  = currentIndex === currentPhotos.length - 1 && dx < 0;
  const x = (atFirst || atLast) ? dx * 0.2 : dx;

  lbImg.style.transform = `translateX(${x}px)`;
  lbImg.style.opacity   = String(1 - Math.abs(x) / (window.innerWidth * 1.2));
}, { passive: true });

lightbox.addEventListener('touchend', () => {
  if (!isDragging || isAnimating) {
    isDragging = false;
    return;
  }
  isDragging = false;

  const dx        = touchCurrentX - touchStartX;
  const threshold = window.innerWidth * 0.22;

  if (Math.abs(dx) > threshold) {
    navigate(dx > 0 ? -1 : 1);
  } else {
    lbImg.style.transition = 'transform 0.35s cubic-bezier(0.25,0.46,0.45,0.94), opacity 0.35s ease';
    lbImg.style.transform  = 'translateX(0)';
    lbImg.style.opacity    = '1';
    setTimeout(() => { lbImg.style.transition = ''; }, 360);
  }
}, { passive: true });

// ── Button & keyboard controls ─────────
document.getElementById('lbClose').addEventListener('click', closeLightbox);
document.getElementById('lbPrev').addEventListener('click', () => navigate(-1));
document.getElementById('lbNext').addEventListener('click', () => navigate(1));

lightbox.addEventListener('click', e => {
  if (e.target === lightbox) closeLightbox();
});

document.addEventListener('keydown', e => {
  if (!lightbox.classList.contains('open')) return;
  if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   navigate(-1);
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') navigate(1);
  if (e.key === 'Escape')                              closeLightbox();
});

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
  const years = ['2026', '2025', '2024', '2023', '2022'];
  const defaultYear = years.find(y => (photoManifest[y] || []).length > 0) || '2026';
  showYear(defaultYear);
})();
