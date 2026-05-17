/* ═══════════════════════════════════════════════════════════
   COOKING HUD · Hands-free recipe companion for Meta Ray-Ban
   ═══════════════════════════════════════════════════════════ */

const PROGRESS_KEY = 'cooking.progress.v1';   // checkbox state per recipe
const TIMERS_KEY   = 'cooking.timers.v1';     // active timers (persist across reloads)
const LAST_KEY     = 'cooking.last.v1';       // most recent recipe id
const ST_KEY       = 'cooking.seethrough.v1'; // see-through mode (black panel)

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
  const isSeeThrough = document.body.classList.contains('see-through');
  const seeThroughBtn = `
    <button class="btn btn-emoji focusable" data-action="toggle-seethrough"
            aria-label="Toggle see-through mode"
            title="See-through mode">${isSeeThrough ? '🌗' : '👁️'}</button>
  `;
  if (resume) {
    wrap.innerHTML = `
      ${seeThroughBtn}
      <button class="btn ghost focusable" data-action="show-help">HOW IT WORKS</button>
      <button class="btn primary focusable" data-action="resume" data-id="${resume.id}">
        RESUME &#8594;
      </button>
    `;
  } else {
    wrap.innerHTML = `
      ${seeThroughBtn}
      <button class="btn primary focusable" data-action="show-help">HOW IT WORKS</button>
    `;
  }
}

/* See-through mode — black panel + white/orange brighter text so the
   HUD looks fully transparent on the actual glasses display. */
function applySeeThrough(on) {
  document.body.classList.toggle('see-through', !!on);
  try { localStorage.setItem(ST_KEY, on ? '1' : '0'); } catch {}
}
function loadSeeThrough() {
  try { return localStorage.getItem(ST_KEY) === '1'; } catch { return false; }
}
function toggleSeeThrough() {
  applySeeThrough(!document.body.classList.contains('see-through'));
  if (!$('#home').classList.contains('hidden')) renderHomeActions();
  requestAnimationFrame(() => {
    const btn = document.querySelector('[data-action="toggle-seethrough"]');
    if (btn) setFocus(btn);
  });
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
    el.addEventListener('click', () => {
      // Cook items WITH a timer have a richer tap behavior
      if (el.classList.contains('with-timer')) {
        onCookTimerTap(el.dataset.itemId);
      } else {
        togglePhaseItem(el.dataset.itemId);
      }
    });
  });
}

/* Tap on a cook step that has a timer:
   - idle    → start the timer
   - running → confirm reset (wipes the timer back to idle)
   - done    → confirm un-do (un-checks + back to idle, no timer running) */
function onCookTimerTap(stepId) {
  const r = state.currentRecipe;
  if (!r) return;
  const step = (r.cook || []).find(s => s.id === stepId);
  if (!step || !step.timerSec) return;

  const timer = findActiveTimer(r.id, stepId);
  const done = isChecked(r.id, stepId);

  if (timer) {
    audio.resetWarn();
    askConfirm('RESET TIMER?', step.text, () => {
      state.timers = state.timers.filter(t => t !== timer);
      saveTimers();
      audio.uncheck();
      renderTimerRail();
      renderPhase('cook');
      refreshPhaseTabs();
      updatePhaseFooter();
      requestAnimationFrame(() => focusStep(stepId));
    });
    return;
  }
  if (done) {
    audio.resetWarn();
    askConfirm('RESET STEP?', step.text, () => {
      setChecked(r.id, stepId, false);
      audio.uncheck();
      renderPhase('cook');
      refreshPhaseTabs();
      updatePhaseFooter();
      requestAnimationFrame(() => focusStep(stepId));
    });
    return;
  }
  // idle — start the timer immediately
  startStepTimer(stepId);
}

function focusStep(stepId) {
  const el = document.querySelector(`.phase-item[data-item-id="${stepId}"]`);
  if (el) setFocus(el);
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
/* Cook items with a timerSec replace the checkbox cell with a state cell
   that morphs through idle → running → done.
   - idle    : outlined orange "▶ 6:00"
   - running : filled red "5:54" (pulsing)
   - done    : filled green "✓"
   Items without a timer keep the regular checkbox. */
function cookItemHTML(r, it, i) {
  const checked = isChecked(r.id, it.id);
  const timer = findActiveTimer(r.id, it.id);

  if (!it.timerSec) {
    return `
      <button class="phase-item cook-item focusable ${checked ? 'checked' : ''}" data-item-id="${it.id}">
        <div class="checkbox"></div>
        <div class="pi-body">
          <div class="pi-step-num">STEP ${String(i + 1).padStart(2, '0')}</div>
          <div class="pi-text">${escapeHTML(it.text)}</div>
        </div>
        <div></div>
      </button>
    `;
  }

  let stateCls = 'state-idle';
  let cellInner = `<span class="ci-play"></span><span class="ci-time">${formatMMSS(it.timerSec)}</span>`;
  if (timer) {
    const remain = Math.max(0, Math.ceil((timer.endTs - Date.now()) / 1000));
    stateCls = 'state-running';
    cellInner = `<span class="ci-time">${formatMMSS(remain)}</span>`;
  } else if (checked) {
    stateCls = 'state-done';
    cellInner = `<span class="ci-check">✓</span>`;
  }

  return `
    <button class="phase-item cook-item with-timer focusable ${checked ? 'checked' : ''} ${stateCls} ${timer ? 'timer-running' : ''}" data-item-id="${it.id}">
      <div class="ci-cell">${cellInner}</div>
      <div class="pi-body">
        <div class="pi-step-num">STEP ${String(i + 1).padStart(2, '0')}</div>
        <div class="pi-text">${escapeHTML(it.text)}</div>
      </div>
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
  refreshPhaseTabs();
  updatePhaseFooter();

  if (!wasChecked) {
    if (isAllDone(r)) {
      // Green banner ("READY TO EAT") is already shown by updatePhaseFooter
      audio.recipeDone();
    } else if (allPhaseDone(r, state.currentPhase)) {
      // Green banner ("SHOP/PREP COMPLETE") is already shown — no toast.
      audio.phaseDone();
      const idx = PHASES.indexOf(state.currentPhase);
      if (idx < PHASES.length - 1) {
        setTimeout(() => switchPhase(PHASES[idx + 1]), 900);
      }
    } else {
      audio.check();
      // Auto-focus the next un-checked item so the user can keep
      // checking without manually swiping down.
      advanceFocusFrom(itemId);
    }
  } else {
    audio.uncheck();
  }
}

/* After a check, jump focus to the next un-checked item in the current
   phase. Wraps to the top if necessary. Called only when the phase
   isn't fully complete — in that case the phase auto-advances. */
function advanceFocusFrom(itemId) {
  const wrap = document.querySelector('.phase:not(.hidden)');
  if (!wrap) return;
  const items = Array.from(wrap.querySelectorAll('.phase-item'));
  const idx = items.findIndex(it => it.dataset.itemId === itemId);
  if (idx === -1) return;
  for (let offset = 1; offset <= items.length; offset++) {
    const target = items[(idx + offset) % items.length];
    if (!target.classList.contains('checked')) {
      setFocus(target);
      return;
    }
  }
}
function allPhaseDone(r, phase) {
  const { done, total } = phaseProgress(r, phase);
  return total > 0 && done === total;
}

/* show NEXT PHASE button + completion banner only when current phase is done */
/* updatePhaseFooter()
   Only manages the phase-complete banner now. Phases auto-advance
   (see togglePhaseItem), so there's no NEXT button to manage. The
   "← → SWIPE PHASE" hint stays visible at all times. */
function updatePhaseFooter() {
  const r = state.currentRecipe;
  if (!r) return;
  const phase = state.currentPhase;
  const phaseDone = allPhaseDone(r, phase);
  const recipeDone = isAllDone(r);
  const banner = $('#phase-banner');

  if (phaseDone) {
    banner.classList.remove('hidden');
    if (recipeDone) {
      $('#pb-text').textContent = 'READY TO EAT';
    } else {
      $('#pb-text').textContent = `${PHASE_LABEL[phase]} COMPLETE`;
    }
  } else {
    banner.classList.add('hidden');
  }
}

/* ─────────── PHASE NAVIGATION ─────────── */
function switchPhase(phase) {
  if (!PHASES.includes(phase)) return;
  if (phase === state.currentPhase) return;
  state.currentPhase = phase;
  audio.click();
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
function startStepTimer(stepId) {
  const r = state.currentRecipe;
  if (!r) return;
  const step = (r.cook || []).find(s => s.id === stepId);
  if (!step || !step.timerSec) return;
  if (findActiveTimer(r.id, stepId)) return; // already running
  state.timers.push({
    id: 't-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    recipeId: r.id,
    stepId: stepId,
    label: step.text,
    recipeName: r.name,
    // one-word descriptor for the rail chip (BOIL, PASTA, ROAST, REST, etc.)
    tag: step.tag || recipeShort(r.name),
    endTs: Date.now() + step.timerSec * 1000,
    expired: false,
  });
  saveTimers();
  audio.timerStart();
  toast('TIMER STARTED · ' + formatMMSS(step.timerSec));
  renderPhase('cook');
  renderTimerRail();
  // Once the timer's running, advance focus to the next item so the
  // user can immediately keep working through the cook list.
  requestAnimationFrame(() => advanceFocusFrom(stepId));
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

  // update inline cook timer cells, if visible
  if (state.currentRecipe && !$('#recipe').classList.contains('hidden') && state.currentPhase === 'cook') {
    state.timers.forEach(t => {
      if (t.recipeId !== state.currentRecipe.id) return;
      const cell = document.querySelector(`.phase-item[data-item-id="${t.stepId}"] .ci-cell .ci-time`);
      if (!cell) return;
      const remain = Math.max(0, Math.ceil((t.endTs - Date.now()) / 1000));
      cell.textContent = formatMMSS(remain);
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
  audio.timerEnd();
}
/* Dismissing an expired timer auto-checks the cook step, refreshes phase
   progress, and plays a "check"/"phase done"/"recipe done" cue. */
function dismissExpiredTimer(id) {
  const t = state.timers.find(x => x.id === id);
  state.timers = state.timers.filter(x => x.id !== id);
  saveTimers();
  $('#timer-alert').classList.add('hidden');
  state.pendingConfirm = null;
  if (t) {
    setChecked(t.recipeId, t.stepId, true);
    const r = RECIPES.find(x => x.id === t.recipeId);
    if (r) {
      if (isAllDone(r)) audio.recipeDone();
      else if (allPhaseDone(r, 'cook')) audio.phaseDone();
      else audio.check();
    } else {
      audio.check();
    }
  }
  renderTimerRail();
  if (state.currentRecipe && state.currentPhase === 'cook') {
    renderPhase('cook');
    refreshPhaseTabs();
    updatePhaseFooter();
  }
  requestAnimationFrame(() => autoFocus());
}

function refreshPhaseTabs() {
  const r = state.currentRecipe;
  if (!r) return;
  PHASES.forEach(p => {
    const tab = document.querySelector(`.ph-tab[data-phase="${p}"]`);
    if (!tab) return;
    const { done, total } = phaseProgress(r, p);
    tab.classList.toggle('complete', total > 0 && done === total);
    $(`#pt-prog-${p}`).textContent = `${done}/${total}`;
  });
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
  // Rail chips are status-only — non-focusable, non-clickable.
  // To reset a timer, tap the cook step in the menu.
  rail.innerHTML = state.timers.map(t => {
    const remain = Math.max(0, Math.ceil((t.endTs - Date.now()) / 1000));
    const expired = remain <= 0;
    // Prefer the step's one-word descriptor; fall back to a legacy timer
    // that lacked one (saved before this change) or to the recipe name.
    const tag = t.tag || recipeShort(t.recipeName);
    return `
      <div class="tr-chip ${expired ? 'expired' : ''}" data-timer-id="${t.id}" aria-hidden="false">
        <span class="tr-dot"></span>
        ${expired ? 'DONE' : formatMMSS(remain)}
        <span class="tr-tag">${escapeHTML(tag)}</span>
      </div>
    `;
  }).join('');
}
function recipeShort(name) {
  if (!name) return '';
  const t = name.split(/\s+/)[0];
  return t.slice(0, 8);
}

/* ─────────── Audio (AudioContext) ─────────────────────────
   Sound design:
   - check      : up-blip when ticking off an item
   - uncheck    : down-blip when un-checking
   - timerStart : two-note rise when a cook timer starts
   - timerEnd   : 4-beep alarm (loud-ish) when a timer expires
   - resetWarn  : warning down-tone when entering reset confirm
   - phaseDone  : ascending triad when a phase finishes
   - recipeDone : longer arpeggio when the whole recipe is done
   AudioContext is created lazily on first user gesture.
   ──────────────────────────────────────────────────────── */
const audio = {
  ctx: null,
  ensure() {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch { this.ctx = null; }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(()=>{});
    }
    return this.ctx;
  },
  tone({ freq=880, type='sine', vol=0.14, attack=0.008, decay=0.14, delay=0 }) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
    o.start(t0);
    o.stop(t0 + attack + decay + 0.02);
  },
  click()      { this.tone({ freq: 1100, vol: 0.05, decay: 0.04 }); },
  check()      {
    this.tone({ freq: 720, vol: 0.10, decay: 0.10 });
    this.tone({ freq: 1080, vol: 0.10, decay: 0.10, delay: 0.07 });
  },
  uncheck()    {
    this.tone({ freq: 720, vol: 0.10, decay: 0.10 });
    this.tone({ freq: 440, vol: 0.10, decay: 0.10, delay: 0.07 });
  },
  timerStart() {
    this.tone({ freq: 660, vol: 0.12, decay: 0.10 });
    this.tone({ freq: 990, vol: 0.12, decay: 0.10, delay: 0.08 });
  },
  timerEnd() {
    // urgent 4-beep alarm
    for (let i = 0; i < 4; i++) {
      this.tone({ freq: 1100, type: 'square', vol: 0.18, attack: 0.005, decay: 0.16, delay: i * 0.22 });
    }
  },
  resetWarn() {
    this.tone({ freq: 520, vol: 0.10, decay: 0.16 });
    this.tone({ freq: 330, vol: 0.10, decay: 0.20, delay: 0.10 });
  },
  phaseDone() {
    [523, 659, 784].forEach((f, i) =>
      this.tone({ freq: f, vol: 0.14, decay: 0.22, delay: i * 0.10 }));
  },
  recipeDone() {
    [523, 659, 784, 1047].forEach((f, i) =>
      this.tone({ freq: f, vol: 0.16, decay: 0.30, delay: i * 0.13 }));
  },
};

/* ─────────── Confirm overlay ─────────── */
function askConfirm(eyebrow, msg, onYes) {
  $('#confirm-eyebrow').textContent = eyebrow;
  $('#confirm-msg').textContent = msg;
  state.pendingConfirm = onYes;
  $('#confirm').classList.remove('hidden');
  // Default selection lands on CANCEL — destructive actions are safer
  // with the no-op highlighted.
  requestAnimationFrame(() => setFocus($('#confirm-no')));
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
  // Timer rail is purely informational — never reachable via d-pad.
  return Array.from(screen.querySelectorAll('.focusable'))
    .filter(el => !el.disabled && el.offsetParent !== null);
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
    audio.click();
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
  if (best) {
    setFocus(best);
    audio.click();
  }
}
function moveFocusHorizontal(dir) {
  const focusables = getActiveFocusables();
  if (!focusables.length) return;
  if (!state.focusedEl || !focusables.includes(state.focusedEl)) {
    setFocus(focusables[0]);
    audio.click();
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
    let valid = false, primary = 0;
    if (dir === 'left')  { valid = dx < -3; primary = -dx; }
    if (dir === 'right') { valid = dx >  3; primary =  dx; }
    if (!valid) continue;
    const dist = primary + Math.abs(dy) * 1.6;
    if (dist < bestDist) { bestDist = dist; best = el; }
  }
  if (best) {
    setFocus(best);
    audio.click();
  }
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
  // Lazily unlock AudioContext on the first interaction (autoplay policy)
  const unlock = () => { audio.ensure(); };
  document.addEventListener('click',  unlock, { once: true });
  document.addEventListener('keydown', unlock, { once: true });

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
    case 'toggle-seethrough': toggleSeeThrough(); break;
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
  // Restore see-through preference before first paint
  applySeeThrough(loadSeeThrough());
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
