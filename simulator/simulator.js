/* ==========================================================================
   Meta Display Glasses — Simulator (logic)
   ========================================================================== */

(function () {
  'use strict';

  /* ── DOM refs ──────────────────────────────────────────────────── */
  const wrap         = document.getElementById('display-wrap');
  const iframe       = document.getElementById('app-iframe');
  const placeholder  = document.getElementById('wg-placeholder');
  const bgImg        = document.getElementById('bg-img');
  const bgVid        = document.getElementById('bg-vid');
  const urlInput     = document.getElementById('url-input');
  const scaleBadge   = document.getElementById('scale-badge');
  const resizeHandle = document.getElementById('resize-handle');
  const slOpacity    = document.getElementById('sl-opacity');
  const slScale      = document.getElementById('sl-scale');
  const lblOpacity   = document.getElementById('lbl-opacity');
  const lblScale     = document.getElementById('lbl-scale');
  const loadError    = document.getElementById('load-error');
  const fileInput    = document.getElementById('file-input');
  const appChips     = document.getElementById('app-chips');
  const bgStrip      = document.getElementById('bg-strip');

  /* ── Config ────────────────────────────────────────────────────── */
  const HUD_MARGIN = 24; // px gap from window edges (matches CSS default)

  // App URL presets — clickable chips at the top.
  const APP_PRESETS = [
    { name: 'Calculator',     url: 'https://mdg-calculator.vercel.app'     },
    { name: 'Pomodoro',       url: 'https://mdg-pomodoro.vercel.app'       },
    { name: 'Meditation',     url: 'https://mdg-meditation.vercel.app'     },
    { name: 'Crypto Tracker', url: 'https://mdg-crypto-tracker.vercel.app' },
    { name: 'Trivia Live',    url: 'https://mdg-trivia-live.vercel.app'    },
    { name: 'IP Info',        url: 'https://mdg-ip-info.vercel.app'        },
  ];

  // Background presets — files in simulator/background/.
  // Note: parkin.jpeg is the on-disk filename; the displayed label is "Parking".
  const BG_PRESETS = [
    { name: 'Office',  file: 'background/office.png'  },
    { name: 'Garden',  file: 'background/garden.jpg'  },
    { name: 'Sky',     file: 'background/sky.jpeg'    },
    { name: 'Car',     file: 'background/car.png'     },
    { name: 'Parking', file: 'background/parkin.png' },
  ];

  /* ── State ─────────────────────────────────────────────────────── */
  let displayPx   = 300;
  let scaleRatio  = 0.5;

  let dragging   = false;
  let resizing   = false;
  let dragOrig   = {};
  let resizeOrig = {};

  /* ── HUD position helpers ──────────────────────────────────────── */
  // Switch the wrap from its CSS bottom/right anchor to inline left/top.
  function applyPosition(left, top) {
    wrap.style.left   = left + 'px';
    wrap.style.top    = top  + 'px';
    wrap.style.right  = 'auto';
    wrap.style.bottom = 'auto';
    wrap.style.transform = '';
  }

  // Snap back to the bottom-right corner anchor.
  function resetPosition() {
    wrap.style.left   = 'auto';
    wrap.style.top    = 'auto';
    wrap.style.right  = HUD_MARGIN + 'px';
    wrap.style.bottom = HUD_MARGIN + 'px';
    wrap.style.transform = '';
  }

  // True iff the user has dragged the HUD (positioned via inline left/top).
  function isFreePositioned() {
    const l = wrap.style.left;
    return !!l && l !== 'auto';
  }

  function applyScale(pct) {
    scaleRatio  = pct / 100;
    displayPx   = Math.round(600 * scaleRatio);
    wrap.style.width  = displayPx + 'px';
    wrap.style.height = displayPx + 'px';
    iframe.style.transform = `scale(${scaleRatio})`;
    scaleBadge.textContent = pct + '%';
    slScale.value          = pct;
    lblScale.textContent   = pct + '%';
  }

  /* ── Load URL ───────────────────────────────────────────────────── */
  function loadURL(target) {
    let url = (target || urlInput.value).trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    urlInput.value = url;

    iframe.src = url;
    placeholder.style.display = 'none';
    wrap.classList.remove('hidden');
    hideLoadError();

    iframe.onload  = hideLoadError;
    iframe.onerror = showLoadError;

    markActiveApp(url);
  }

  function showLoadError() {
    loadError.style.display = 'block';
    setTimeout(hideLoadError, 6000);
  }
  function hideLoadError() { loadError.style.display = 'none'; }

  document.getElementById('load-btn').addEventListener('click', () => loadURL());
  urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') loadURL(); });
  document.getElementById('reset-btn').addEventListener('click', resetPosition);

  /* ── App preset chips ──────────────────────────────────────────── */
  function buildAppChips() {
    appChips.innerHTML = '';
    APP_PRESETS.forEach(p => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'app-chip';
      chip.textContent = p.name;
      chip.dataset.appUrl = p.url;
      chip.title = p.url;
      chip.addEventListener('click', () => loadURL(p.url));
      appChips.appendChild(chip);
    });
  }

  function markActiveApp(url) {
    appChips.querySelectorAll('.app-chip').forEach(c => {
      const u = c.dataset.appUrl;
      const match = url && (u === url || url.startsWith(u));
      c.classList.toggle('active', !!match);
    });
  }

  /* ── Background presets ────────────────────────────────────────── */
  function setBackgroundFromUrl(url) {
    bgImg.src = url;
    bgImg.style.display = 'block';
    bgVid.style.display = 'none';
    bgVid.removeAttribute('src');
  }

  function buildBgStrip() {
    bgStrip.innerHTML = '';

    BG_PRESETS.forEach(p => {
      const tile = document.createElement('div');
      tile.className = 'bg-tile';
      tile.dataset.bgFile = p.file;
      tile.style.backgroundImage = `url('${p.file}')`;
      tile.title = p.name;

      const name = document.createElement('span');
      name.className = 'bg-name';
      name.textContent = p.name;
      tile.appendChild(name);

      tile.addEventListener('click', () => {
        setBackgroundFromUrl(p.file);
        markActiveBg(p.file);
      });
      bgStrip.appendChild(tile);
    });

    const upload = document.createElement('div');
    upload.className = 'bg-tile upload';
    upload.title = 'Upload an image or video';
    upload.innerHTML = `
      <span class="upload-glyph">⤴</span>
      <span>Upload</span>
    `;
    upload.addEventListener('click', () => fileInput.click());
    bgStrip.appendChild(upload);
  }

  function markActiveBg(file) {
    bgStrip.querySelectorAll('.bg-tile').forEach(t => {
      t.classList.toggle('active', t.dataset.bgFile === file);
    });
  }

  /* ── Background — drag-and-drop / file picker ──────────────────── */
  function loadBackgroundFile(file) {
    const url = URL.createObjectURL(file);
    if (file.type.startsWith('video/')) {
      bgVid.src = url;
      bgVid.style.display = 'block';
      bgImg.style.display = 'none';
      bgVid.play().catch(() => {});
    } else {
      bgImg.src = url;
      bgImg.style.display = 'block';
      bgVid.style.display = 'none';
    }
    markActiveBg(null); // user-supplied file → no preset highlighted
  }

  document.addEventListener('dragover', e => {
    e.preventDefault();
    document.body.classList.add('drag-active');
  });
  document.addEventListener('dragleave', e => {
    if (e.relatedTarget === null) document.body.classList.remove('drag-active');
  });
  document.addEventListener('drop', e => {
    e.preventDefault();
    document.body.classList.remove('drag-active');
    const file = e.dataTransfer.files[0];
    if (file && (file.type.startsWith('image/') || file.type.startsWith('video/'))) {
      loadBackgroundFile(file);
    }
  });

  fileInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) loadBackgroundFile(file);
    e.target.value = '';
  });

  /* ── HUD drag + resize ─────────────────────────────────────────── */
  wrap.addEventListener('mousedown', e => {
    if (resizeHandle.contains(e.target)) return;
    if (e.target === iframe) return; // let iframe capture its own events

    dragging = true;
    wrap.classList.add('dragging');
    const rect = wrap.getBoundingClientRect();
    applyPosition(rect.left, rect.top);
    dragOrig = { mx: e.clientX, my: e.clientY, elLeft: rect.left, elTop: rect.top };
    e.preventDefault();
  });

  resizeHandle.addEventListener('mousedown', e => {
    resizing = true;
    resizeOrig = { mx: e.clientX, sz: displayPx };
    e.preventDefault();
    e.stopPropagation();
  });

  document.addEventListener('mousemove', e => {
    if (dragging) {
      const dx = e.clientX - dragOrig.mx;
      const dy = e.clientY - dragOrig.my;
      applyPosition(dragOrig.elLeft + dx, dragOrig.elTop + dy);
    }
    if (resizing) {
      const dx = e.clientX - resizeOrig.mx;
      const newSz = Math.max(90, Math.min(600, resizeOrig.sz + dx));
      const pct = Math.round(newSz / 6) * 5; // snap to nearest 5%
      applyScale(pct);
    }
  });

  document.addEventListener('mouseup', () => {
    dragging = false;
    resizing = false;
    wrap.classList.remove('dragging');
  });

  /* ── Sliders ───────────────────────────────────────────────────── */
  // Brightness — under plus-lighter, alpha scales the additive contribution
  // of every pixel, so opacity is a physically correct dim.
  slOpacity.addEventListener('input', function () {
    wrap.style.opacity = this.value / 100;
    lblOpacity.textContent = this.value + '%';
  });
  slScale.addEventListener('input', function () {
    applyScale(parseInt(this.value, 10));
  });

  /* ── Init ──────────────────────────────────────────────────────── */
  buildAppChips();
  buildBgStrip();
  applyScale(50);

  // Default to the first background so the additive blend has something
  // to composite against from the moment the simulator opens.
  setBackgroundFromUrl(BG_PRESETS[0].file);
  markActiveBg(BG_PRESETS[0].file);

  window.addEventListener('resize', () => {
    if (!isFreePositioned()) return; // anchored bottom-right → CSS handles it
    const rect = wrap.getBoundingClientRect();
    let l = rect.left, t = rect.top;
    l = Math.min(l, window.innerWidth  - displayPx - 10);
    t = Math.min(t, window.innerHeight - displayPx - 10);
    applyPosition(Math.max(0, l), Math.max(0, t));
  });

  /* ── "H" key — hide/show overlay UI for clean screen recordings ─ */
  const overlayEls = [
    document.getElementById('top-controls'),
    document.getElementById('scene-controls'),
  ];
  let overlaysVisible = true;

  function toggleOverlays() {
    overlaysVisible = !overlaysVisible;
    overlayEls.forEach(el => {
      el.style.display = overlaysVisible ? '' : 'none';
    });
  }

  document.addEventListener('keydown', e => {
    console.log('[simulator] keydown:', e.key, '| activeElement:', document.activeElement.tagName, document.activeElement.id);
    if (document.activeElement === urlInput) {
      console.log('[simulator] ignoring — urlInput focused');
      return;
    }
    if (e.key === 'h' || e.key === 'H') {
      console.log('[simulator] toggling overlays, visible:', !overlaysVisible);
      toggleOverlays();
    }
  }, true);

  // When the iframe steals focus, clicks outside it should reclaim it so "h" works.
  document.addEventListener('click', e => {
    if (e.target !== iframe) iframe.blur();
  }, true);

})();
