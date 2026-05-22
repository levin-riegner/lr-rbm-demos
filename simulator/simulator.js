/* ==========================================================================
   Meta Display Glasses — Simulator (logic)
   ========================================================================== */

(function () {
  'use strict';

  /* ── DOM refs ──────────────────────────────────────────────────── */
  const simViewport   = document.getElementById('sim-viewport');
  const scene         = document.getElementById('scene');
  const wrap          = document.getElementById('display-wrap');
  const iframe        = document.getElementById('app-iframe');
  const placeholder   = document.getElementById('wg-placeholder');
  const bgImg         = document.getElementById('bg-img');
  const bgVid         = document.getElementById('bg-vid');
  const urlInput      = document.getElementById('url-input');
  const slOpacity     = document.getElementById('sl-opacity');
  const lblOpacity    = document.getElementById('lbl-opacity');
  const slBgBright    = document.getElementById('sl-bg-brightness');
  const lblBgBright   = document.getElementById('lbl-bg-brightness');
  const loadError     = document.getElementById('load-error');
  const fileInput     = document.getElementById('file-input');
  const appChips      = document.getElementById('app-chips');
  const bgStrip       = document.getElementById('bg-strip');
  const positionSeg   = document.getElementById('position-seg');
  const sizeSeg       = document.getElementById('size-seg');
  const exitFsBtn     = document.getElementById('exit-fullscreen-btn');

  /* ── Config ────────────────────────────────────────────────────── */
  const HUD_MARGIN = 24;

  const APP_PRESETS = [
    { name: 'Calculator',             url: 'https://rbm-demos.lnr.io/calculator/' },
    { name: 'Crypto Tracker',         url: 'https://rbm-demos.lnr.io/crypto-tracker/' },
    { name: 'Pong',                   url: 'https://rbm-demos.lnr.io/pong/' },
    { name: 'Pomodoro',               url: 'https://rbm-demos.lnr.io/pomodoro/' },
    { name: 'Weather',      url: 'https://rbm-demos.lnr.io/weather-dashboard/' },
    { name: 'Flight Status',          url: 'https://rbm-demos.lnr.io/flight-status/' },
    { name: 'Snake',                  url: 'https://rbm-demos.lnr.io/snake/' },
    { name: 'Metronome',              url: 'https://rbm-demos.lnr.io/metronome/' },
    { name: 'IP Info',                url: 'https://rbm-demos.lnr.io/ip-info/' },
    { name: 'Key Logger',             url: 'https://rbm-demos.lnr.io/key-logger/' },
    { name: 'Chores',                 url: 'https://rbm-demos.lnr.io/chores/' },
    { name: 'Cooking HUD',            url: 'https://rbm-demos.lnr.io/cooking-hud/' },
    { name: 'Dad Jokes',              url: 'https://rbm-demos.lnr.io/dad-jokes/' },
    { name: 'Deep Link Launcher',     url: 'https://rbm-demos.lnr.io/deep-link-launcher/' },
    { name: 'Deep Link Target',       url: 'https://rbm-demos.lnr.io/deep-link-target/' },
    { name: 'Brusher',                url: 'https://rbm-demos.lnr.io/brusher/' },
    { name: 'Find My Car',            url: 'https://rbm-demos.lnr.io/find-my-car/' },
    { name: 'Flashcards (Serbian)',   url: 'https://rbm-demos.lnr.io/flashcards-serbian/' },
    { name: 'Glasses API Test',       url: 'https://rbm-demos.lnr.io/glasses-api-test/' },
    { name: 'Head Gesture Prototype', url: 'https://rbm-demos.lnr.io/head-gesture-prototype/' },
    { name: 'Headprint',              url: 'https://rbm-demos.lnr.io/headprint/' },
    { name: 'Kairos Calendar HUD',    url: 'https://rbm-demos.lnr.io/kairos-calendar-hud/' },
    { name: 'Levin Riegner',          url: 'https://rbm-demos.lnr.io/levinriegner/' },
    { name: 'LR Glimmer',             url: 'https://rbm-demos.lnr.io/lr-glimmer/' },
    { name: 'Meditation',             url: 'https://rbm-demos.lnr.io/meditation/' },
    { name: 'Origami Sensei',         url: 'https://rbm-demos.lnr.io/origami-sensei/' },
    { name: 'Pair HUD',               url: 'https://rbm-demos.lnr.io/pair-hud/' },
    { name: 'Pentatonic Solo',        url: 'https://rbm-demos.lnr.io/pentatonic-solo/' },
    { name: 'Periff',                 url: 'https://rbm-demos.lnr.io/periff/' },
    { name: 'Pinout HUD',             url: 'https://rbm-demos.lnr.io/pinout-hud/' },
    { name: 'Plane Spotter',          url: 'https://rbm-demos.lnr.io/plane-spotter/' },
    { name: 'Presto',                 url: 'https://rbm-demos.lnr.io/presto/' },
    { name: 'Recipe Stepper',         url: 'https://rbm-demos.lnr.io/recipe-stepper/' },
    { name: 'Speedometer',            url: 'https://rbm-demos.lnr.io/speedometer/' },
    { name: 'Spireworks',             url: 'https://rbm-demos.lnr.io/spireworks/' },
    { name: 'Tally Counter',          url: 'https://rbm-demos.lnr.io/tally-counter/' },
    { name: 'Teleprompter (admin)',   url: 'https://rbm-demos.lnr.io/teleprompter/admin/' },
    { name: 'Teleprompter (glasses)', url: 'https://rbm-demos.lnr.io/teleprompter/glasses/' },
    { name: 'Tiltscroll Tales',       url: 'https://rbm-demos.lnr.io/tiltscroll-tales/' },
    { name: 'Trivia Live',            url: 'https://rbm-demos.lnr.io/trivia-live/' },
    { name: 'Zork Terminal',          url: 'https://rbm-demos.lnr.io/zork-terminal/' },
  ];

  // How many app chips to render before the "Show more" toggle.
  const APP_CHIPS_INITIAL = 10;

  const BG_PRESETS = [
    { name: 'Office',  file: 'background/office.png' },
    { name: 'Garden',  file: 'background/garden.jpg' },
    { name: 'Sky',     file: 'background/sky.jpeg'   },
    { name: 'Car',     file: 'background/car.png'    },
    { name: 'Parking', file: 'background/parkin.png' },
  ];

  /* ── State ─────────────────────────────────────────────────────── */
  let displayPx  = 300;
  let scaleRatio = 0.5;
  let hudAnchor  = 'top'; // 'top' | 'middle' (all right-aligned)

  /* ── HUD position — always right-aligned, vertical anchor only ─── */
  function setHudPosition(anchor) {
    hudAnchor = anchor;

    // Right edge is fixed; only the vertical anchor changes.
    wrap.style.left  = 'auto';
    wrap.style.right = HUD_MARGIN + 'px';

    if (anchor === 'top') {
      wrap.style.top       = HUD_MARGIN + 'px';
      wrap.style.bottom    = 'auto';
      wrap.style.transform = '';
    } else if (anchor === 'middle') {
      wrap.style.top       = '50%';
      wrap.style.bottom    = 'auto';
      wrap.style.transform = 'translateY(-50%)';
    } else { // bottom
      wrap.style.top       = 'auto';
      wrap.style.bottom    = HUD_MARGIN + 'px';
      wrap.style.transform = '';
    }

    positionSeg.querySelectorAll('button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.pos === anchor);
    });
  }

  /* ── HUD size — three discrete presets ────────────────────────── */
  function applyScale(pct) {
    scaleRatio = pct / 100;
    displayPx  = Math.round(600 * scaleRatio);
    wrap.style.width  = displayPx + 'px';
    wrap.style.height = displayPx + 'px';
    iframe.style.transform = `scale(${scaleRatio})`;
    sizeSeg.querySelectorAll('button').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.size, 10) === pct);
    });
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

  positionSeg.addEventListener('click', e => {
    const btn = e.target.closest('button[data-pos]');
    if (!btn) return;
    setHudPosition(btn.dataset.pos);
  });

  sizeSeg.addEventListener('click', e => {
    const btn = e.target.closest('button[data-size]');
    if (!btn) return;
    applyScale(parseInt(btn.dataset.size, 10));
  });

  /* ── App preset chips ──────────────────────────────────────────── */
  function buildAppChips() {
    appChips.innerHTML = '';
    APP_PRESETS.forEach((p, i) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'app-chip';
      if (i >= APP_CHIPS_INITIAL) chip.classList.add('chip-extra');
      chip.textContent = p.name;
      chip.dataset.appUrl = p.url;
      chip.title = p.url;
      chip.addEventListener('click', () => loadURL(p.url));
      appChips.appendChild(chip);
    });

    if (APP_PRESETS.length > APP_CHIPS_INITIAL) {
      const hiddenCount = APP_PRESETS.length - APP_CHIPS_INITIAL;
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'app-chip chip-toggle';
      toggle.textContent = `Show ${hiddenCount} more`;
      toggle.addEventListener('click', () => {
        const expanded = appChips.classList.toggle('expanded');
        toggle.textContent = expanded ? 'Show less' : `Show ${hiddenCount} more`;
      });
      appChips.appendChild(toggle);
    }
  }

  function markActiveApp(url) {
    appChips.querySelectorAll('.app-chip').forEach(c => {
      const u = c.dataset.appUrl;
      const match = url && (u === url || url.startsWith(u));
      c.classList.toggle('active', !!match);
    });
  }

  /* ── Background pan ────────────────────────────────────────────── */
  let bgOffset = { x: 50, y: 50 };

  function applyBgPosition() {
    const pos = `${bgOffset.x}% ${bgOffset.y}%`;
    bgImg.style.objectPosition = pos;
    bgVid.style.objectPosition = pos;
  }

  function resetBgPosition() {
    bgOffset = { x: 50, y: 50 };
    applyBgPosition();
  }

  /* ── Background presets ────────────────────────────────────────── */
  function setBackgroundFromUrl(url) {
    bgImg.src = url;
    bgImg.style.display = 'block';
    bgVid.style.display = 'none';
    bgVid.removeAttribute('src');
    resetBgPosition();
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

  /* ── Drag-and-drop background ──────────────────────────────────── */
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
    resetBgPosition();
    markActiveBg(null);
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

  /* ── Background drag-to-pan (within sim viewport) ─────────────── */
  let bgDragging = false;
  let bgDragStart = {};

  scene.addEventListener('mousedown', e => {
    if (e.target === bgImg || e.target === bgVid || e.target === scene) {
      bgDragging = true;
      bgDragStart = { mx: e.clientX, my: e.clientY, ox: bgOffset.x, oy: bgOffset.y };
      scene.style.cursor = 'grabbing';
      e.preventDefault();
    }
  });

  document.addEventListener('mousemove', e => {
    if (!bgDragging) return;
    const rect = simViewport.getBoundingClientRect();
    const dx = (bgDragStart.mx - e.clientX) / rect.width  * 100;
    const dy = (bgDragStart.my - e.clientY) / rect.height * 100;
    bgOffset.x = Math.max(0, Math.min(100, bgDragStart.ox + dx));
    bgOffset.y = Math.max(0, Math.min(100, bgDragStart.oy + dy));
    applyBgPosition();
  });

  document.addEventListener('mouseup', () => {
    if (bgDragging) {
      bgDragging = false;
      scene.style.cursor = '';
    }
  });

  /* ── Sliders ───────────────────────────────────────────────────── */
  slOpacity.addEventListener('input', function () {
    wrap.style.opacity = this.value / 100;
    lblOpacity.textContent = this.value + '%';
  });
  slBgBright.addEventListener('input', function () {
    scene.style.opacity = this.value / 100;
    lblBgBright.textContent = this.value + '%';
  });

  /* ── Init ──────────────────────────────────────────────────────── */
  buildAppChips();
  buildBgStrip();
  applyScale(50);         // Medium
  setHudPosition('top'); // default to top-right

  setBackgroundFromUrl(BG_PRESETS[0].file);
  markActiveBg(BG_PRESETS[0].file);

  /* ── Fullscreen sim mode (sidebar hidden, HUD focused) ─────────
        Once focus is inside the (likely cross-origin) iframe, the parent
        can't capture key events anymore — so 'H' alone can't reopen the
        sidebar. The floating #exit-fullscreen-btn is the escape hatch.
        It fades out when idle so it stays out of screen recordings, and
        re-appears on any mouse activity in the sim viewport. ──────── */
  let exitBtnHideTimer = null;
  function pingExitBtn() {
    if (!document.body.classList.contains('fullscreen-sim')) return;
    document.body.classList.add('show-exit-btn');
    clearTimeout(exitBtnHideTimer);
    exitBtnHideTimer = setTimeout(() => {
      document.body.classList.remove('show-exit-btn');
    }, 2500);
  }

  function setFullscreenSim(on) {
    document.body.classList.toggle('fullscreen-sim', on);
    if (on) {
      pingExitBtn();
      // Defer one tick — the iframe is briefly inert mid-toggle on some browsers.
      setTimeout(() => iframe.focus(), 0);
    } else {
      document.body.classList.remove('show-exit-btn');
      clearTimeout(exitBtnHideTimer);
      iframe.blur();
    }
  }

  document.addEventListener('keydown', e => {
    if (document.activeElement === urlInput) return;
    if (e.key === 'h' || e.key === 'H') {
      setFullscreenSim(!document.body.classList.contains('fullscreen-sim'));
    }
  }, true);

  exitFsBtn.addEventListener('click', () => setFullscreenSim(false));
  simViewport.addEventListener('mousemove', pingExitBtn);

  // Iframe steals focus on click; reclaim it on outside clicks so "h" still works.
  document.addEventListener('click', e => {
    if (e.target !== iframe) iframe.blur();
  }, true);

})();
