/* ═══════════════════════════════════════════════════════════
   COOKING HUD · Hands-free recipe companion for Meta Ray-Ban
   ═══════════════════════════════════════════════════════════ */

const PROGRESS_KEY = 'cooking.progress.v1';   // checkbox state per recipe
const TIMERS_KEY   = 'cooking.timers.v1';     // active timers (persist across reloads)
const LAST_KEY     = 'cooking.last.v1';       // most recent recipe id

const PHASES = ['shop', 'prep', 'cook'];
const PHASE_LABEL = { shop: 'SHOP', prep: 'PREP', cook: 'COOK' };

const state = {
  progress: loadProgress(),  // { [recipeId]: { [itemId]: true } }
  currentRecipe: null,
  currentPhase: 'shop',
  timers: loadTimers(),       // [{ id, recipeId, stepId, label, recipeName, endTs, expired }]
  pendingConfirm: null,
  focusedEl: null,
  uiTickId: null,
};

/* ─────────── Storage ─────────── */
function loadProgress() {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}
function saveProgress() {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(state.progress)); } catch {}
}
function loadTimers() {
  try {
    const raw = localStorage.getItem(TIMERS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter(t => t && t.endTs) : [];
  } catch { return []; }
}
function saveTimers() {
  try { localStorage.setItem(TIMERS_KEY, JSON.stringify(state.timers)); } catch {}
}
function saveLastRecipe(id) {
  try { localStorage.setItem(LAST_KEY, id); } catch {}
}
function loadLastRecipe() {
  try { return localStorage.getItem(LAST_KEY); } catch { return null; }
}

/* ─────────── Progress helpers ─────────── */
function isChecked(recipeId, itemId) {
  return !!(state.progress[recipeId] && state.progress[recipeId][itemId]);
}
function setChecked(recipeId, itemId, value) {
  if (!state.progress[recipeId]) state.progress[recipeId] = {};
  if (value) state.progress[recipeId][itemId] = true;
  else delete state.progress[recipeId][itemId];
  saveProgress();
}
function phaseProgress(recipe, phase) {
  const items = recipe[phase] || [];
  const done = items.filter(it => isChecked(recipe.id, it.id)).length;
  return { done, total: items.length };
}
function recipeStats(r) {
  const total = r.shop.length + r.prep.length + r.cook.length;
  const done = PHASES.reduce((sum, p) => sum + phaseProgress(r, p).done, 0);
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}
function isInProgress(r) {
  const { done, total } = recipeStats(r);
  return done > 0 && done < total;
}
function isAllDone(r) {
  const { done, total } = recipeStats(r);
  return total > 0 && done === total;
}
function findResumableRecipe() {
  const lastId = loadLastRecipe();
  if (lastId) {
    const r = RECIPES.find(x => x.id === lastId);
    if (r && isInProgress(r)) return r;
  }
  return RECIPES.find(r => isInProgress(r)) || null;
}

/* ─────────── HOME ─────────── */
function renderHome() {
  $('#home-recipe-count').textContent = String(RECIPES.length).padStart(2, '0');

  // sort: in-progress recipes first, then untouched, then complete
  const ordered = RECIPES.slice().sort((a, b) => {
    return rank(a) - rank(b);
  });
  function rank(r) {
    if (isInProgress(r)) return 0;
    if (isAllDone(r))    return 2;
    return 1;
  }

  const wrap = $('#home-list');
  wrap.innerHTML = ordered.map(r => recipeCardHTML(r)).join('');
  wrap.querySelectorAll('.recipe-card').forEach(el => {
    el.addEventListener('click', () => openRecipe(el.dataset.id));
  });

  renderHomeActions();
}
function renderHomeActions() {
  const wrap = $('#home-actions');
  const resume = findResumableRecipe();
  if (resume) {
    wrap.innerHTML = `
      <button class="btn ghost focusable" data-action="show-help">HOW TO</button>
      <button class="btn primary focusable" data-action="resume" data-id="${resume.id}">
        RESUME &#8594;
      </button>
    `;
  } else {
    wrap.innerHTML = `
      <button class="btn primary focusable" data-action="show-help">HOW TO</button>
    `;
  }
}
function recipeCardHTML(r) {
  const { done, total, pct } = recipeStats(r);
  const inProg = isInProgress(r);
  const allDone = isAllDone(r);
  const tag = allDone ? '<span class="rc-badge done">DONE</span>'
            : inProg ? '<span class="rc-badge inprog">IN PROGRESS</span>'
            : '';
  return `
    <button class="recipe-card focusable ${inProg ? 'is-inprog' : ''} ${allDone ? 'is-done' : ''}" data-id="${r.id}">
      <div class="rc-meta">
        <span>${escapeHTML(r.eyebrow)}</span>
        <span>${r.totalMin} MIN</span>
      </div>
      <div class="rc-name">${escapeHTML(r.name)}</div>
      <div class="rc-tail">
        <span class="rc-prog">
          <span class="rc-bar"><span style="width:${pct}%"></span></span>
          <span>${done}/${total}</span>
        </span>
        <span class="rc-tail-right">
          ${tag}
          <span class="rc-arrow">&#8594;</span>
        </span>
      </div>
    </button>
  `;
}

/* ─────────── RECIPE ─────────── */
function openRecipe(recipeId) {
  const r = RECIPES.find(x => x.id === recipeId);
  if (!r) return;
  state.currentRecipe = r;
  state.currentPhase = decideStartingPhase(r);
  saveLastRecipe(r.id);
  showScreen('recipe');
  renderRecipe();
}
function decideStartingPhase(r) {
  for (const p of PHASES) {
    const { done, total } = phaseProgress(r, p);
    if (done < total) return p;
  }
  return 'shop';
}
function renderRecipe() {
  const r = state.currentRecipe;
  if (!r) return;
  $('#rh-eyebrow').textContent  = r.eyebrow;
  $('#rh-title').textContent    = r.name;
  $('#rh-time').textContent     = r.totalMin + ' MIN';
  $('#rh-servings').textContent = String(r.servings);

  // tabs
  PHASES.forEach(p => {
    const tab = document.querySelector(`.ph-tab[data-phase="${p}"]`);
    const { done, total } = phaseProgress(r, p);
    tab.classList.toggle('active', p === state.currentPhase);
    tab.classList.toggle('complete', total > 0 && done === total);
    $(`#pt-prog-${p}`).textContent = `${done}/${total}`;
  });

  // hide all phases, show current
  PHASES.forEach(p => {
    document.getElementById(`phase-${p}`).classList.toggle('hidden', p !== state.currentPhase);
  });

  // render the current phase content
  renderPhase(state.currentPhase);
  updatePhaseFooter();

  // wire tab clicks (mouse only — d-pad uses left/right)
  document.querySelectorAll('.ph-tab').forEach(tab => {
    tab.onclick = () => switchPhase(tab.dataset.phase);
  });

  requestAnimationFrame(() => focusFirstInPhase());
}

function renderPhase(phase) {
  const r = state.currentRecipe;
  const wrap = document.getElementById(`phase-${phase}`);
  if (!r) return;
  const items = r[phase] || [];
  if (!items.length) {
    wrap.innerHTML = `<div class="phase-empty">NO ITEMS IN THIS PHASE</div>`;
    return;
  }
  if (phase === 'shop') {
    wrap.innerHTML = items.map(it => shopItemHTML(r, it)).join('');
  } else if (phase === 'prep') {
    wrap.innerHTML = items.map((it, i) => prepItemHTML(r, it, i)).join('');
  } else if (phase === 'cook') {
    wrap.innerHTML = items.map((it, i) => cookItemHTML(r, it, i)).join('');
  }

  wrap.querySelectorAll('.phase-item').forEach(el => {
    el.addEventListener('click', (e) => {
      const target = e.target.closest('[data-action]');
      if (target && target.dataset.action === 'timer-toggle') {
        e.stopPropagation();
        toggleStepTimer(el.dataset.itemId);
        return;
      }
      togglePhaseItem(el.dataset.itemId);
    });
  });
}

function shopItemHTML(r, it) {
  const checked = isChecked(r.id, it.id);
  return `
    <button class="phase-item focusable ${checked ? 'checked' : ''}" data-item-id="${it.id}">
      <div class="checkbox"></div>
      <div class="pi-body">
        <div class="pi-qty">${escapeHTML(it.qty)}</div>
        <div class="pi-text">${escapeHTML(it.item)}</div>
      </div>
      <div></div>
    </button>
  `;
}
function prepItemHTML(r, it, i) {
  const checked = isChecked(r.id, it.id);
  return `
    <button class="phase-item focusable ${checked ? 'checked' : ''}" data-item-id="${it.id}">
      <div class="checkbox"></div>
      <div class="pi-body">
        <div class="pi-step-num">STEP ${String(i + 1).padStart(2, '0')}</div>
        <div class="pi-text">${escapeHTML(it.text)}</div>
      </div>
      <div></div>
    </button>
  `;
}
function cookItemHTML(r, it, i) {
  const checked = isChecked(r.id, it.id);
  const timer = findActiveTimer(r.id, it.id);
  let timerHTML = '';
  if (it.timerSec) {
    if (timer) {
      const remain = Math.max(0, Math.ceil((timer.endTs - Date.now()) / 1000));
      timerHTML = `
        <span class="pi-timer" data-action="timer-toggle" role="button">
          <span class="pt-icon"></span>
          ${formatMMSS(remain)}
        </span>`;
    } else {
      timerHTML = `
        <span class="pi-timer" data-action="timer-toggle" role="button">
          <span class="pt-icon"></span>
          ${formatMMSS(it.timerSec)}
        </span>`;
    }
  }
  return `
    <button class="phase-item focusable ${checked ? 'checked' : ''} ${timer ? 'timer-running' : ''}" data-item-id="${it.id}">
      <div class="checkbox"></div>
      <div class="pi-body">
        <div class="pi-step-num">STEP ${String(i + 1).padStart(2, '0')}</div>
        <div class="pi-text">${escapeHTML(it.text)}</div>
      </div>
      ${timerHTML || '<div></div>'}
    </button>
  `;
}

function togglePhaseItem(itemId) {
  const r = state.currentRecipe;
  if (!r) return;
  const wasChecked = isChecked(r.id, itemId);
  setChecked(r.id, itemId, !wasChecked);
  // soft re-render: just toggle classes/progress without losing focus
  const el = document.querySelector(`.phase-item[data-item-id="${itemId}"]`);
  if (el) el.classList.toggle('checked', !wasChecked);
  // refresh phase tab counts
  PHASES.forEach(p => {
    const tab = document.querySelector(`.ph-tab[data-phase="${p}"]`);
    if (!tab) return;
    const { done, total } = phaseProgress(r, p);
    tab.classList.toggle('complete', total > 0 && done === total);
    $(`#pt-prog-${p}`).textContent = `${done}/${total}`;
  });
  updatePhaseFooter();

  if (!wasChecked) {
    if (allPhaseDone(r, state.currentPhase)) {
      const nextIdx = PHASES.indexOf(state.currentPhase) + 1;
      if (nextIdx < PHASES.length) {
        toast(`${PHASE_LABEL[state.currentPhase]} COMPLETE`);
      } else if (isAllDone(r)) {
        toast('READY TO EAT');
      }
    }
  }
}
function allPhaseDone(r, phase) {
  const { done, total } = phaseProgress(r, phase);
  return total > 0 && done === total;
}

/* show NEXT PHASE button + completion banner only when current phase is done */
function updatePhaseFooter() {
  const r = state.currentRecipe;
  if (!r) return;
  const phase = state.currentPhase;
  const idx = PHASES.indexOf(phase);
  const phaseDone = allPhaseDone(r, phase);
  const recipeDone = isAllDone(r);
  const banner = $('#phase-banner');
  const nextBtn = $('#next-phase-btn');
  const hint = $('#phase-hint');

  if (phaseDone) {
    banner.classList.remove('hidden');
    if (recipeDone) {
      $('#pb-text').textContent = 'READY TO EAT';
    } else if (idx === PHASES.length - 1) {
      $('#pb-text').textContent = 'ALL PHASES COMPLETE';
    } else {
      $('#pb-text').textContent = `${PHASE_LABEL[phase]} COMPLETE`;
    }
  } else {
    banner.classList.add('hidden');
  }

  if (phaseDone && idx < PHASES.length - 1) {
    nextBtn.classList.remove('hidden');
    nextBtn.textContent = `NEXT · ${PHASE_LABEL[PHASES[idx + 1]]} →`;
    hint.classList.add('hidden');
  } else {
    nextBtn.classList.add('hidden');
    hint.classList.remove('hidden');
  }
}

/* ─────────── PHASE NAVIGATION ─────────── */
function switchPhase(phase) {
  if (!PHASES.includes(phase)) return;
  if (phase === state.currentPhase) return;
  state.currentPhase = phase;
  renderRecipe();
}
function nextPhase()  {
  const i = PHASES.indexOf(state.currentPhase);
  if (i < PHASES.length - 1) switchPhase(PHASES[i + 1]);
}
function prevPhase()  {
  const i = PHASES.indexOf(state.currentPhase);
  if (i > 0) switchPhase(PHASES[i - 1]);
}

function focusFirstInPhase() {
  const wrap = document.getElementById(`phase-${state.currentPhase}`);
  if (!wrap) return;
  const items = Array.from(wrap.querySelectorAll('.phase-item'));
  // prefer the first un-checked item
  const next = items.find(it => !it.classList.contains('checked')) || items[0];
  if (next) setFocus(next);
  else autoFocus();
}

/* ─────────── TIMERS ─────────── */
function findActiveTimer(recipeId, stepId) {
  return state.timers.find(t => t.recipeId === recipeId && t.stepId === stepId);
}
function toggleStepTimer(stepId) {
  const r = state.currentRecipe;
  if (!r) return;
  const step = (r.cook || []).find(s => s.id === stepId);
  if (!step || !step.timerSec) return;
  const existing = findActiveTimer(r.id, stepId);
  if (existing) {
    state.timers = state.timers.filter(t => t !== existing);
    saveTimers();
    toast('TIMER STOPPED');
  } else {
    state.timers.push({
      id: 't-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      recipeId: r.id,
      stepId: stepId,
      label: step.text,
      recipeName: r.name,
      endTs: Date.now() + step.timerSec * 1000,
      expired: false,
    });
    saveTimers();
    toast('TIMER STARTED · ' + formatMMSS(step.timerSec));
  }
  renderRecipe();
}
function startUiTick() {
  if (state.uiTickId) return;
  state.uiTickId = setInterval(uiTick, 250);
  uiTick();
}
function uiTick() {
  let didChange = false;
  state.timers.forEach(t => {
    const remain = t.endTs - Date.now();
    if (!t.expired && remain <= 0) {
      t.expired = true;
      didChange = true;
      onTimerExpired(t);
    }
  });
  if (didChange) saveTimers();
  renderTimerRail();

  // update inline cook timers, if visible
  if (state.currentRecipe && !$('#recipe').classList.contains('hidden') && state.currentPhase === 'cook') {
    state.timers.forEach(t => {
      if (t.recipeId !== state.currentRecipe.id) return;
      const el = document.querySelector(`.phase-item[data-item-id="${t.stepId}"] .pi-timer`);
      if (!el) return;
      const remain = Math.max(0, Math.ceil((t.endTs - Date.now()) / 1000));
      el.innerHTML = `<span class="pt-icon"></span>${formatMMSS(remain)}`;
    });
  }
}
function onTimerExpired(t) {
  if ($('#timer-alert').classList.contains('hidden')) {
    $('#ta-step').textContent = t.label;
    $('#ta-recipe').textContent = t.recipeName;
    $('#timer-alert').classList.remove('hidden');
    state.pendingConfirm = () => dismissExpiredTimer(t.id);
    requestAnimationFrame(() => autoFocus());
  }
  beep();
}
function dismissExpiredTimer(id) {
  state.timers = state.timers.filter(t => t.id !== id);
  saveTimers();
  $('#timer-alert').classList.add('hidden');
  state.pendingConfirm = null;
  renderTimerRail();
  if (state.currentRecipe && state.currentPhase === 'cook') {
    renderPhase('cook');
  }
  requestAnimationFrame(() => autoFocus());
}
function renderTimerRail() {
  const rail = $('#timer-rail');
  if (!state.timers.length) {
    rail.classList.add('hidden');
    rail.innerHTML = '';
    document.body.classList.remove('has-timers');
    return;
  }
  rail.classList.remove('hidden');
  document.body.classList.add('has-timers');
  rail.innerHTML = state.timers.map(t => {
    const remain = Math.max(0, Math.ceil((t.endTs - Date.now()) / 1000));
    const expired = remain <= 0;
    const tag = recipeShort(t.recipeName);
    return `
      <button class="tr-chip focusable ${expired ? 'expired' : ''}" data-timer-id="${t.id}">
        <span class="tr-dot"></span>
        ${expired ? 'DONE' : formatMMSS(remain)}
        <span class="tr-tag">${escapeHTML(tag)}</span>
      </button>
    `;
  }).join('');
  rail.querySelectorAll('.tr-chip').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.timerId;
      const t = state.timers.find(x => x.id === id);
      if (!t) return;
      if (t.expired) {
        dismissExpiredTimer(id);
      } else {
        askConfirm('STOP TIMER?', t.label, () => {
          state.timers = state.timers.filter(x => x.id !== id);
          saveTimers();
          renderTimerRail();
          if (state.currentRecipe && state.currentPhase === 'cook') {
            renderPhase('cook');
          }
        });
      }
    });
  });
}
function recipeShort(name) {
  if (!name) return '';
  const t = name.split(/\s+/)[0];
  return t.slice(0, 8);
}

/* ─────────── Beep on timer end ─────────── */
let audioCtx = null;
function beep() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.connect(g); g.connect(audioCtx.destination);
    o.type = 'sine';
    o.frequency.value = 880;
    g.gain.value = 0.001;
    o.start();
    g.gain.exponentialRampToValueAtTime(0.18, audioCtx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.6);
    o.stop(audioCtx.currentTime + 0.65);
  } catch {}
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
  }, 1700);
}

/* ─────────── Navigation ─────────── */
function showScreen(id) {
  $$('.screen').forEach(s => s.classList.add('hidden'));
  const target = document.getElementById(id);
  if (target) target.classList.remove('hidden');
  requestAnimationFrame(() => autoFocus());
}
function goHome() {
  showScreen('home');
  renderHome();
}
function resumeLast() {
  const r = findResumableRecipe();
  if (r) openRecipe(r.id);
}

/* ─────────── D-pad / arrow-key navigation ─────────── */
function getActiveFocusables() {
  const overlays = ['#timer-alert', '#confirm'];
  for (const sel of overlays) {
    const ov = $(sel);
    if (ov && !ov.classList.contains('hidden')) {
      return Array.from(ov.querySelectorAll('.focusable'))
        .filter(el => !el.disabled && el.offsetParent !== null);
    }
  }
  const screen = document.querySelector('.screen:not(.hidden)');
  if (!screen) return [];
  const railFocusables = Array.from(document.querySelectorAll('#timer-rail .focusable'))
    .filter(el => !el.disabled && el.offsetParent !== null);
  const screenFocusables = Array.from(screen.querySelectorAll('.focusable'))
    .filter(el => !el.disabled && el.offsetParent !== null);
  return [...railFocusables, ...screenFocusables];
}
function setFocus(el) {
  $$('.dpad-focus').forEach(e => e.classList.remove('dpad-focus'));
  if (el) {
    el.classList.add('dpad-focus');
    try { el.focus({ preventScroll: false }); } catch { try { el.focus(); } catch {} }
    state.focusedEl = el;
    if (typeof el.scrollIntoView === 'function') {
      try { el.scrollIntoView({ block: 'nearest' }); } catch {}
    }
  } else {
    state.focusedEl = null;
  }
}
function autoFocus() {
  const f = getActiveFocusables();
  if (!f.length) { setFocus(null); return; }
  const primary = f.find(el => el.classList.contains('primary'));
  setFocus(primary || f[0]);
}

/* On the recipe screen, Left/Right swipe = change phase, not focus. */
function isOnRecipeScreen() {
  return !$('#recipe').classList.contains('hidden')
      && $('#confirm').classList.contains('hidden')
      && $('#timer-alert').classList.contains('hidden');
}

function moveFocusVertical(dir) {
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
    const dy = ey - cy;
    const dx = ex - cx;
    let valid = false, primary = 0;
    if (dir === 'up')   { valid = dy < -3; primary = -dy; }
    if (dir === 'down') { valid = dy >  3; primary =  dy; }
    if (!valid) continue;
    const dist = primary + Math.abs(dx) * 1.6;
    if (dist < bestDist) { bestDist = dist; best = el; }
  }
  if (best) setFocus(best);
}
function moveFocusHorizontal(dir) {
  const focusables = getActiveFocusables();
  if (!focusables.length) return;
  if (!state.focusedEl || !focusables.includes(state.focusedEl)) {
    setFocus(focusables[0]); return;
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
    let valid = false, primary = 0;
    if (dir === 'left')  { valid = dx < -3; primary = -dx; }
    if (dir === 'right') { valid = dx >  3; primary =  dx; }
    if (!valid) continue;
    const dist = primary + Math.abs(dy) * 1.6;
    if (dist < bestDist) { bestDist = dist; best = el; }
  }
  if (best) setFocus(best);
}

/* ─────────── Utils ─────────── */
function $(sel)  { return document.querySelector(sel); }
function $$(sel) { return Array.from(document.querySelectorAll(sel)); }
function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
function formatMMSS(sec) {
  sec = Math.max(0, Math.floor(sec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
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
    if (e.key === 'Escape') {
      if (!$('#timer-alert').classList.contains('hidden')) {
        const expired = state.timers.find(t => t.expired);
        if (expired) dismissExpiredTimer(expired.id);
        return;
      }
      if (!$('#confirm').classList.contains('hidden')) { closeConfirm(false); return; }
      if (!$('#recipe').classList.contains('hidden')) { goHome(); return; }
      if (!$('#help').classList.contains('hidden'))   { goHome(); return; }
      return;
    }

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        moveFocusVertical('up');
        return;
      case 'ArrowDown':
        e.preventDefault();
        moveFocusVertical('down');
        return;
      case 'ArrowLeft':
        e.preventDefault();
        if (isOnRecipeScreen()) prevPhase();
        else moveFocusHorizontal('left');
        return;
      case 'ArrowRight':
        e.preventDefault();
        if (isOnRecipeScreen()) nextPhase();
        else moveFocusHorizontal('right');
        return;
      case 'Enter':
      case ' ':
        if (state.focusedEl && !state.focusedEl.disabled) {
          e.preventDefault();
          state.focusedEl.click();
        }
        return;
    }
  });
}

function handleAction(a, target) {
  switch (a) {
    case 'go-home':       goHome(); break;
    case 'show-help':     showScreen('help'); break;
    case 'resume':        resumeLast(); break;
    case 'next-phase':    nextPhase(); break;
    case 'confirm-yes':   closeConfirm(true); break;
    case 'confirm-no':    closeConfirm(false); break;
    case 'ta-dismiss': {
      const t = state.timers.find(x => x.expired);
      if (t) dismissExpiredTimer(t.id);
      break;
    }
  }
}

/* ─────────── Boot ─────────── */
function boot() {
  bindEvents();
  renderHome();
  renderTimerRail();
  startUiTick();

  if (state.timers.length) {
    const r = RECIPES.find(x => x.id === state.timers[0].recipeId);
    if (r) state.currentRecipe = r;
  }
}
boot();
