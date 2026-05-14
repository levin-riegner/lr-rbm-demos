/* ═══════════════════════════════════════════════════════════
   PINOUT HUD · App logic
   Hands-free wiring reference for Meta Ray-Ban Display
   ───────────────────────────────────────────────────────────
   D-pad map (browser):
     ArrowUp/Down/Left/Right  → swipes
     Enter / Space            → tap
     Escape                   → back / exit
   ═══════════════════════════════════════════════════════════ */

const WT_SEEN_KEY      = 'pinout.walkthrough.seen';
const ACTIVE_BOARD_KEY = 'pinout.activeBoard.v1';

const state = {
  walkthroughStep: 0,
  pendingConfirm: null,
  focusedEl: null,

  /* Active board the user is referencing */
  activeBoard: null,        /* { name, eyebrow, pins:[{label,color}] } */

  /* Custom-flow build state */
  customCount: 8,
  customIndex: 0,           /* which pin we're configuring */
  customPins: [],           /* in-progress pin array */

  /* Reference focus mode */
  refFocusOn: false,
  refSelected: 0,
};

/* ─────────── DOM helpers ─────────── */
const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const escapeHTML = (s) => String(s).replace(/[&<>"']/g, c => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));

/* ─────────── Persistence (active board only) ─────────── */
function saveActiveBoard() {
  try {
    if (state.activeBoard) {
      localStorage.setItem(ACTIVE_BOARD_KEY, JSON.stringify(state.activeBoard));
    }
  } catch {}
}
function loadActiveBoard() {
  try {
    const raw = localStorage.getItem(ACTIVE_BOARD_KEY);
    if (!raw) return null;
    const b = JSON.parse(raw);
    if (b && Array.isArray(b.pins) && b.pins.length) return b;
  } catch {}
  return null;
}

/* ─────────── Walkthrough ─────────── */
function showWalkthrough() {
  state.walkthroughStep = 0;
  showScreen('walkthrough');
  renderWalkthroughStep();
}
function renderWalkthroughStep() {
  const steps = $$('#walkthrough .wt-step');
  const dots  = $$('#walkthrough .wt-dot');
  steps.forEach((s, i) => s.classList.toggle('hidden', i !== state.walkthroughStep));
  dots.forEach((d, i)  => d.classList.toggle('active', i <= state.walkthroughStep));
  const next = $('[data-action="wt-next"]');
  next.textContent = state.walkthroughStep === steps.length - 1 ? 'GET STARTED' : 'NEXT →';
  setFocus(next);
}
function advanceWalkthrough() {
  const steps = $$('#walkthrough .wt-step');
  if (state.walkthroughStep < steps.length - 1) {
    state.walkthroughStep++;
    renderWalkthroughStep();
  } else {
    finishWalkthrough();
  }
}
function finishWalkthrough() {
  try { localStorage.setItem(WT_SEEN_KEY, '1'); } catch {}
  goHome();
}

/* ─────────── Navigation ─────────── */
function showScreen(id) {
  $$('.screen').forEach(s => s.classList.add('hidden'));
  const t = document.getElementById(id);
  if (t) t.classList.remove('hidden');
  requestAnimationFrame(() => autoFocus());
}
function goHome() {
  showScreen('home');
  renderHome();
}

/* ─────────── Home ─────────── */
function renderHome() {
  $('#home-templates').textContent = ESP32_TEMPLATES.length;
  $('#home-last').textContent = state.activeBoard
    ? state.activeBoard.name
    : 'NO ACTIVE BOARD';
}

/* ─────────── ESP32 list ─────────── */
function openEsp32List() {
  $('#esp32-count').textContent = `${ESP32_TEMPLATES.length} BOARDS`;
  const list = $('#model-list');
  list.innerHTML = ESP32_TEMPLATES.map(t => `
    <button class="model-item focusable" data-action="select-esp32" data-id="${t.id}">
      <div class="mi-name">${escapeHTML(t.name)}</div>
      <div class="mi-sub">${escapeHTML(t.eyebrow)}</div>
    </button>
  `).join('');
  showScreen('esp32-list');
}
function selectEsp32(id) {
  const tpl = ESP32_TEMPLATES.find(t => t.id === id);
  if (!tpl) return;
  state.activeBoard = {
    name: tpl.name,
    eyebrow: tpl.eyebrow,
    pins: tpl.pins.map(p => ({ label: p.label, color: p.color }))
  };
  openColorAssign();
}

/* ─────────── Color assign (ESP32 flow) ─────────── */
function openColorAssign() {
  $('#ca-title').textContent = state.activeBoard.name.split(' ')[0];
  $('#ca-meta').textContent  = `${state.activeBoard.pins.length} PINS`;
  renderColorAssignList();
  showScreen('color-assign');
}
function renderColorAssignList() {
  const wrap = $('#ca-pin-list');
  wrap.innerHTML = state.activeBoard.pins.map((p, i) => pinRowHTML(i, p, true)).join('');
}
function cyclePinColor(i) {
  const pin = state.activeBoard.pins[i];
  const idx = WIRE_COLORS.findIndex(c => c.id === pin.color);
  pin.color = WIRE_COLORS[(idx + 1) % WIRE_COLORS.length].id;
  renderColorAssignList();
  requestAnimationFrame(() => {
    const row = $(`#ca-pin-list .pin-row[data-idx="${i}"]`);
    if (row) setFocus(row);
  });
}
function finalizeBoard() {
  saveActiveBoard();
  state.refSelected = 0;
  state.refFocusOn = false;
  openReference();
  toast('BOARD READY');
}

/* ─────────── Custom flow ─────────── */
function openCustomCount() {
  state.customCount = state.customCount || 8;
  $('#cc-num').textContent = state.customCount;
  showScreen('custom-count');
}
function adjustCount(d) {
  state.customCount = Math.max(1, Math.min(64, state.customCount + d));
  $('#cc-num').textContent = state.customCount;
}
function startCustomBuild() {
  const n = state.customCount;
  state.customPins = [];
  /* Pin 1 → GND, Pin 2 → 3V3, rest → GPIO0, GPIO1, ... */
  if (n >= 1) state.customPins.push({ label: 'GND',  color: 'black' });
  if (n >= 2) state.customPins.push({ label: '3V3',  color: 'red' });
  for (let i = 2; i < n; i++) {
    const lbl = `GPIO${i - 2}`;
    state.customPins.push({ label: lbl, color: defaultColorFor(lbl) });
  }
  state.customIndex = 0;
  openLabelStep();
}

/* ── Label step (grid picker) ── */
function openLabelStep() {
  const i = state.customIndex;
  const total = state.customPins.length;
  const pin = state.customPins[i];
  $('#cl-title').textContent    = `PIN ${i + 1}`;
  $('#cl-progress').textContent = `LABEL · ${i + 1} / ${total}`;
  renderLabelGrid(pin.label);
  showScreen('custom-label');
}
function renderLabelGrid(currentLabel) {
  const grid = $('#label-grid');
  const rows = LABEL_GRID;
  grid.innerHTML = rows.map((row, r) =>
    row.map((label, c) => `
      <button class="label-cell focusable ${label === currentLabel ? 'current' : ''}"
              data-action="pick-label"
              data-label="${label}"
              data-row="${r}" data-col="${c}">
        ${escapeHTML(label)}
      </button>
    `).join('')
  ).join('');
  /* Land focus on the current label so the user can confirm with one tap,
     or swipe to a neighbour. Falls back to top-left. */
  requestAnimationFrame(() => {
    const pos = LABEL_POS[currentLabel];
    const r = pos ? pos[0] : 0;
    const c = pos ? pos[1] : 0;
    const cell = $(`#label-grid .label-cell[data-row="${r}"][data-col="${c}"]`);
    if (cell) setFocus(cell);
    else autoFocus();
  });
}
function pickLabel(label) {
  state.customPins[state.customIndex].label = label;
  /* Re-pick a sensible default color when the label changes — saves a
     lot of taps for power/ground/bus pins where the convention is fixed.
     Only override colors on first visit; if the user already changed
     the color away from the previous label's default, keep theirs. */
  const pin = state.customPins[state.customIndex];
  if (!pin._colorTouched) pin.color = defaultColorFor(label);
  openColorStep();
}

/* ── Color step ── */
function openColorStep() {
  const i = state.customIndex;
  const total = state.customPins.length;
  const pin = state.customPins[i];
  $('#cc2-title').textContent    = `PIN ${i + 1}`;
  $('#cc2-progress').textContent = `WIRE · ${i + 1} / ${total}`;
  $('#cc2-label').textContent    = pin.label;
  renderColorGrid(pin.color);
  showScreen('custom-color');
}
function renderColorGrid(currentColor) {
  const grid = $('#cc2-color-grid');
  grid.innerHTML = WIRE_COLORS.map(c => `
    <button class="color-cell focusable ${currentColor === c.id ? 'selected' : ''}"
            data-action="pick-color"
            data-id="${c.id}"
            style="color: ${c.swatch}">
      <span class="cc-swatch"></span>
      <span class="cc-name">${c.name}</span>
    </button>
  `).join('');
  /* Auto-focus the currently selected color */
  requestAnimationFrame(() => {
    const sel = $(`#cc2-color-grid .color-cell.selected`);
    if (sel) setFocus(sel);
    else autoFocus();
  });
}
function pickColor(id) {
  const pin = state.customPins[state.customIndex];
  pin.color = id;
  pin._colorTouched = true;
  /* Auto-advance to next pin or finalize */
  if (state.customIndex < state.customPins.length - 1) {
    state.customIndex++;
    openLabelStep();
  } else {
    state.activeBoard = {
      name: 'CUSTOM BOARD',
      eyebrow: `${state.customPins.length} PINS`,
      pins: state.customPins.map(p => ({ label: p.label, color: p.color }))
    };
    finalizeBoard();
  }
}

/* ── Back navigation within custom flow ── */
function backFromLabel() {
  /* From a pin's label step → previous pin's color step (or count if first) */
  if (state.customIndex > 0) {
    state.customIndex--;
    openColorStep();
  } else {
    openCustomCount();
  }
}
function backFromColor() {
  /* From color → label of same pin */
  openLabelStep();
}
function cancelCustom() {
  askConfirm('EXIT BUILD?', 'Your custom board will be discarded.', () => {
    state.customPins = [];
    state.customIndex = 0;
    goHome();
  });
}

/* ─────────── Pin row HTML (shared) ─────────── */
function pinRowHTML(i, pin, asButton) {
  const wire = WIRE_COLORS.find(c => c.id === pin.color) || WIRE_COLORS[0];
  const tag = asButton ? 'button' : 'div';
  const action = asButton ? 'data-action="ca-cycle"' : '';
  const cls = asButton ? 'pin-row focusable' : 'pin-row';
  return `
    <${tag} class="${cls}" data-idx="${i}" ${action}>
      <span class="pr-num">${String(i + 1).padStart(2, '0')}</span>
      <span class="pr-label">${escapeHTML(pin.label)}</span>
      <span class="pr-wire">
        <span class="swatch" style="color: ${wire.swatch}"></span>
        <span class="pr-color-name">${wire.name}</span>
      </span>
    </${tag}>
  `;
}

/* ─────────── Reference (active HUD) ─────────── */
function openReference() {
  if (!state.activeBoard) { goHome(); return; }
  $('#ref-title').textContent = state.activeBoard.name;
  $('#ref-meta').textContent  = `${state.activeBoard.pins.length} PINS`;
  state.refFocusOn = false;
  state.refSelected = Math.min(state.refSelected, state.activeBoard.pins.length - 1);
  renderReferenceList();
  updateFocusOverlay();
  showScreen('reference');
}
function renderReferenceList() {
  const wrap = $('#ref-pin-list');
  wrap.innerHTML = state.activeBoard.pins
    .map((p, i) => pinRowHTML(i, p, true))
    .join('');
  highlightRefSelected();
}
function highlightRefSelected() {
  const rows = $$('#ref-pin-list .pin-row');
  rows.forEach((r, i) => r.classList.toggle('dpad-focus', i === state.refSelected));
  const sel = rows[state.refSelected];
  if (sel) {
    try { sel.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch {}
  }
}
function stepRefSelection(d) {
  const n = state.activeBoard.pins.length;
  state.refSelected = (state.refSelected + d + n) % n;
  if (state.refFocusOn) updateFocusOverlay();
  else highlightRefSelected();
}
function enterFocus() {
  state.refFocusOn = true;
  $('#reference').classList.add('focus-on');
  $('#focus-overlay').classList.remove('hidden');
  updateFocusOverlay();
}
function exitFocus() {
  state.refFocusOn = false;
  $('#reference').classList.remove('focus-on');
  $('#focus-overlay').classList.add('hidden');
  highlightRefSelected();
}
function updateFocusOverlay() {
  const i = state.refSelected;
  const pin = state.activeBoard.pins[i];
  if (!pin) return;
  const wire = WIRE_COLORS.find(c => c.id === pin.color) || WIRE_COLORS[0];
  $('#fo-eyebrow').textContent = `PIN ${i + 1} / ${state.activeBoard.pins.length}`;
  $('#fo-pinno').textContent   = String(i + 1).padStart(2, '0');
  $('#fo-label').textContent   = pin.label;
  $('#fo-color').textContent   = `${wire.name} WIRE`;
  $('#fo-swatch').style.color  = wire.swatch;
}

/* ─────────── Confirm overlay ─────────── */
function askConfirm(eyebrow, msg, onYes) {
  $('#confirm-eyebrow').textContent = eyebrow;
  $('#confirm-msg').textContent = msg;
  state.pendingConfirm = onYes;
  $('#confirm').classList.remove('hidden');
  requestAnimationFrame(() => setFocus($('#confirm-yes')));
}
function closeConfirm(run) {
  $('#confirm').classList.add('hidden');
  const fn = state.pendingConfirm;
  state.pendingConfirm = null;
  if (run && typeof fn === 'function') fn();
  requestAnimationFrame(() => autoFocus());
}

/* ─────────── Toast ─────────── */
let toastTimer = null;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  requestAnimationFrame(() => el.classList.add('show'));
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.classList.add('hidden'), 240);
  }, 1500);
}

/* ─────────── D-pad / arrow-key navigation ─────────── */
function getActiveFocusables() {
  const overlay = $('#confirm');
  if (overlay && !overlay.classList.contains('hidden')) {
    return Array.from(overlay.querySelectorAll('.focusable'))
      .filter(el => !el.disabled && el.offsetParent !== null);
  }
  const screen = document.querySelector('.screen:not(.hidden)');
  if (!screen) return [];
  return Array.from(screen.querySelectorAll('.focusable'))
    .filter(el => !el.disabled && el.offsetParent !== null);
}
function setFocus(el) {
  $$('.dpad-focus').forEach(e => e.classList.remove('dpad-focus'));
  if (el) {
    el.classList.add('dpad-focus');
    try { el.focus({ preventScroll: true }); } catch { el.focus(); }
    state.focusedEl = el;
  } else {
    state.focusedEl = null;
  }
}
function autoFocus() {
  const f = getActiveFocusables();
  if (!f.length) { setFocus(null); return; }
  /* If a renderer already explicitly focused something on the active
     screen (e.g. the selected color cell), don't clobber that choice. */
  if (state.focusedEl && f.includes(state.focusedEl)) return;
  const primary = f.find(el => el.classList.contains('primary'));
  setFocus(primary || f[0]);
}
function moveFocus(dir) {
  const focusables = getActiveFocusables();
  if (!focusables.length) return;
  if (!state.focusedEl || !focusables.includes(state.focusedEl)) {
    setFocus(focusables[0]);
    return;
  }
  const cur = state.focusedEl.getBoundingClientRect();
  const cx = cur.left + cur.width / 2;
  const cy = cur.top + cur.height / 2;
  let best = null;
  let bestDist = Infinity;
  for (const el of focusables) {
    if (el === state.focusedEl) continue;
    const r = el.getBoundingClientRect();
    const ex = r.left + r.width / 2;
    const ey = r.top + r.height / 2;
    const dx = ex - cx;
    const dy = ey - cy;
    let valid = false, primary = 0, secondary = 0;
    if (dir === 'up')    { valid = dy < -3; primary = -dy; secondary = Math.abs(dx); }
    if (dir === 'down')  { valid = dy >  3; primary =  dy; secondary = Math.abs(dx); }
    if (dir === 'left')  { valid = dx < -3; primary = -dx; secondary = Math.abs(dy); }
    if (dir === 'right') { valid = dx >  3; primary =  dx; secondary = Math.abs(dy); }
    if (!valid) continue;
    const dist = primary + secondary * 1.8;
    if (dist < bestDist) { bestDist = dist; best = el; }
  }
  if (best) {
    setFocus(best);
    try { best.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch {}
  }
}

/* ─────────── Wiring ─────────── */
function bindEvents() {
  document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    handleAction(target.dataset.action, target);
  });

  document.addEventListener('mouseover', (e) => {
    const f = e.target.closest('.focusable');
    if (f && !f.disabled) setFocus(f);
  });

  document.addEventListener('keydown', (e) => {
    /* Confirm overlay always wins */
    if (!$('#confirm').classList.contains('hidden')) {
      if (e.key === 'Escape') { e.preventDefault(); closeConfirm(false); return; }
      if (e.key === 'Enter' || e.key === ' ') {
        if (state.focusedEl) { e.preventDefault(); state.focusedEl.click(); return; }
      }
      if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        moveFocus(e.key.slice(5).toLowerCase());
      }
      return;
    }

    /* Reference screen has its own gesture semantics */
    const refOpen = !$('#reference').classList.contains('hidden');
    if (refOpen) {
      if (handleReferenceKey(e)) return;
    }

    switch (e.key) {
      case 'ArrowUp':    e.preventDefault(); moveFocus('up'); return;
      case 'ArrowDown':  e.preventDefault(); moveFocus('down'); return;
      case 'ArrowLeft':  e.preventDefault(); moveFocus('left'); return;
      case 'ArrowRight': e.preventDefault(); moveFocus('right'); return;
      case 'Enter':
      case ' ':
        if (state.focusedEl && !state.focusedEl.disabled) {
          e.preventDefault();
          state.focusedEl.click();
        }
        return;
      case 'Escape':
        e.preventDefault();
        handleEscape();
        return;
    }
  });
}

function handleReferenceKey(e) {
  const k = e.key;
  if (state.refFocusOn) {
    if (k === 'ArrowUp')    { e.preventDefault(); stepRefSelection(-1); return true; }
    if (k === 'ArrowDown')  { e.preventDefault(); stepRefSelection(1);  return true; }
    if (k === 'ArrowLeft')  { e.preventDefault(); exitFocus();          return true; }
    if (k === 'Escape')     { e.preventDefault(); exitFocus();          return true; }
    if (k === 'ArrowRight') { e.preventDefault();                       return true; }
    return false;
  }
  /* Overview mode */
  if (k === 'ArrowUp')    { e.preventDefault(); stepRefSelection(-1); return true; }
  if (k === 'ArrowDown')  { e.preventDefault(); stepRefSelection(1);  return true; }
  if (k === 'ArrowRight') { e.preventDefault(); enterFocus();         return true; }
  if (k === 'ArrowLeft')  {
    e.preventDefault();
    const homeBtn = $('#reference [data-action="ref-exit"]');
    if (homeBtn) setFocus(homeBtn);
    return true;
  }
  if (k === 'Enter' || k === ' ') {
    if (state.focusedEl && state.focusedEl.dataset.action === 'ref-exit') return false;
    e.preventDefault();
    enterFocus();
    return true;
  }
  return false;
}

function handleEscape() {
  if (!$('#confirm').classList.contains('hidden')) { closeConfirm(false); return; }
  if (!$('#focus-overlay').classList.contains('hidden')) { exitFocus(); return; }
  if (!$('#reference').classList.contains('hidden')) { goHome(); return; }
  if (!$('#color-assign').classList.contains('hidden')) { openEsp32List(); return; }
  if (!$('#custom-color').classList.contains('hidden')) { backFromColor(); return; }
  if (!$('#custom-label').classList.contains('hidden')) { backFromLabel(); return; }
  if (!$('#custom-count').classList.contains('hidden')) { goHome(); return; }
  if (!$('#esp32-list').classList.contains('hidden')) { goHome(); return; }
}

function handleAction(action, el) {
  switch (action) {
    /* Walkthrough */
    case 'wt-next':           advanceWalkthrough(); break;
    case 'wt-skip':           finishWalkthrough(); break;
    case 'show-walkthrough':  showWalkthrough(); break;

    /* Home */
    case 'go-home':           goHome(); break;
    case 'go-esp32':          openEsp32List(); break;
    case 'go-custom':         openCustomCount(); break;

    /* ESP32 list */
    case 'select-esp32':      selectEsp32(el.dataset.id); break;

    /* Color assign */
    case 'ca-cycle':          cyclePinColor(parseInt(el.dataset.idx, 10)); break;
    case 'ca-back':           openEsp32List(); break;
    case 'ca-finalize':       finalizeBoard(); break;

    /* Custom count */
    case 'cc-inc':            adjustCount(1); break;
    case 'cc-dec':            adjustCount(-1); break;
    case 'cc-confirm':        startCustomBuild(); break;

    /* Custom label step */
    case 'pick-label':        pickLabel(el.dataset.label); break;
    case 'cl-back':           backFromLabel(); break;

    /* Custom color step */
    case 'pick-color':        pickColor(el.dataset.id); break;
    case 'cc2-back':          backFromColor(); break;

    /* Custom shared */
    case 'cp-cancel':         cancelCustom(); break;

    /* Reference */
    case 'ref-exit':          goHome(); break;

    /* Confirm */
    case 'confirm-yes':       closeConfirm(true); break;
    case 'confirm-no':        closeConfirm(false); break;
  }
}

/* ─────────── Background canvas (PCB trace flourishes) ─────────────
   Sparse decorative layer that paints behind every screen:
   • 5 thin PCB-style polylines anchored to the lens edges
   • Tiny "via" dots at each polyline endpoint
   • One slow glowing "current" pulse travels each trace on its own loop
   The traces sit only in regions the HUD content doesn't occupy
   (mostly the left ~140px gutter and screen corners) so they never
   compete with the active content for attention. */
function initBgCanvas() {
  const c = document.getElementById('bg-canvas');
  if (!c) return;
  const ctx = c.getContext('2d');
  const W = 600, H = 600;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  c.width  = W * dpr;
  c.height = H * dpr;
  c.style.width  = W + 'px';
  c.style.height = H + 'px';
  ctx.scale(dpr, dpr);

  /* Polylines kept along the left gutter (left of pad-l = 160px) and the
     four corners so they read as schematic chrome, not screen junk. */
  const traces = [
    { pts: [[0,  82], [50,  82], [50, 132]],            dur: 11000 },
    { pts: [[0, 240], [108, 240], [108, 296]],          dur: 13000 },
    { pts: [[0, 478], [94,  478], [94, 396], [148, 396]], dur: 15000 },
    { pts: [[600, 56], [556, 56], [556, 118], [600, 118]], dur: 12000 },
    { pts: [[600, 548], [560, 548], [560, 478]],        dur: 14000 }
  ];

  /* Pre-compute segment lengths and total length for each trace so we
     can interpolate the pulse position cheaply each frame. */
  for (const t of traces) {
    t.segs = [];
    t.total = 0;
    for (let i = 1; i < t.pts.length; i++) {
      const dx = t.pts[i][0] - t.pts[i-1][0];
      const dy = t.pts[i][1] - t.pts[i-1][1];
      const len = Math.hypot(dx, dy);
      t.segs.push(len);
      t.total += len;
    }
    /* Random phase so the pulses don't all start synchronized */
    t.phase = Math.random() * t.dur;
  }

  function pointAt(t, frac) {
    let target = frac * t.total;
    for (let i = 0; i < t.segs.length; i++) {
      if (target <= t.segs[i]) {
        const f = t.segs[i] === 0 ? 0 : target / t.segs[i];
        return [
          t.pts[i][0] + (t.pts[i+1][0] - t.pts[i][0]) * f,
          t.pts[i][1] + (t.pts[i+1][1] - t.pts[i][1]) * f
        ];
      }
      target -= t.segs[i];
    }
    return t.pts[t.pts.length - 1];
  }

  /* Faint accent colour — pulled from CSS so theme tweaks stay in one place */
  const accent = getComputedStyle(document.documentElement)
    .getPropertyValue('--accent').trim() || '#4ea1ff';

  function paintStatic() {
    /* Static layer changes only on resize, so cache it offscreen */
    const off = document.createElement('canvas');
    off.width  = W * dpr;
    off.height = H * dpr;
    const o = off.getContext('2d');
    o.scale(dpr, dpr);
    o.strokeStyle = hexToRgba(accent, 0.10);
    o.lineWidth = 1;
    o.lineCap = 'square';
    for (const t of traces) {
      o.beginPath();
      o.moveTo(t.pts[0][0], t.pts[0][1]);
      for (let i = 1; i < t.pts.length; i++) o.lineTo(t.pts[i][0], t.pts[i][1]);
      o.stroke();
      /* Via dots at endpoints and corners */
      o.fillStyle = hexToRgba(accent, 0.22);
      for (const p of t.pts) {
        o.beginPath();
        o.arc(p[0], p[1], 2.5, 0, Math.PI * 2);
        o.fill();
      }
    }
    return off;
  }
  const staticLayer = paintStatic();

  function frame(now) {
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(staticLayer, 0, 0, W, H);

    for (const t of traces) {
      const elapsed = ((now + t.phase) % t.dur) / t.dur;
      const [px, py] = pointAt(t, elapsed);
      /* Soft radial glow — the "current" travelling the trace */
      const grd = ctx.createRadialGradient(px, py, 0, px, py, 14);
      grd.addColorStop(0, hexToRgba(accent, 0.55));
      grd.addColorStop(0.5, hexToRgba(accent, 0.18));
      grd.addColorStop(1, hexToRgba(accent, 0));
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(px, py, 14, 0, Math.PI * 2);
      ctx.fill();
      /* Tight bright core */
      ctx.fillStyle = hexToRgba(accent, 0.85);
      ctx.beginPath();
      ctx.arc(px, py, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function hexToRgba(hex, a) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3
    ? h.split('').map(c => c + c).join('')
    : h, 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/* ─────────── Boot ─────────── */
function boot() {
  initBgCanvas();
  bindEvents();

  const saved = loadActiveBoard();
  if (saved) state.activeBoard = saved;

  const seen = (() => {
    try { return localStorage.getItem(WT_SEEN_KEY) === '1'; } catch { return false; }
  })();
  if (seen) {
    goHome();
  } else {
    state.walkthroughStep = 0;
    renderWalkthroughStep();
  }
}
boot();
