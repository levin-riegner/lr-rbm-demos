/* ─────────────────────────────────────────────────────────────
   GRILLMASTER, the coach engine
   ---------------------------------------------------------------
   Built for the Ray-Ban Display: 600×600, D-pad + Enter, no typing,
   hands busy. The whole app is one idea, "tell me the ONE thing to
   do right now, count me down to the next one, and never make me
   touch a screen with greasy tongs in my hand."

   ONE QUESTION PER SCREEN. Nothing asks two things at once:

     1. MODE     grill / smoke / bbq        → which engine coaches you
     2. FIRE     charcoal / gas / wood / …  → what you turn to change
                                              the heat, how to light it,
                                              what the alarms should say
     3. HELP     first time / coach / pro   → how much the HUD explains
     4. FOOD     which cut
     5. TASTE    doneness, for cuts with a ladder (skipped otherwise)
     6. PLAN     the numbers, and stack another item if you want
     7. FIRE     light it, preheat on a real clock, THEN food goes on

   Step 7 is not optional at any assist level: the cook timer measures
   food on the grate, so it cannot start while the grate is cold. What
   assist level changes is how much of the lighting is spelled out.

   Every answer is carried into the live cook, so "PIT LOW" becomes
   "PIT LOW · FEED IT COALS" on a kettle and "PIT LOW · TURN THE
   BURNER UP" on gas.

   A COOK SESSION holds one or more ITEMS. Each item walks its own
   timeline of STEPS (see data.js). The coach always shows the item
   whose next cue is soonest, and rails the rest.
   ───────────────────────────────────────────────────────────── */

const SESSION_KEY = 'grillmaster.session.v4';
const SAFETY_KEY  = 'grillmaster.safety.v1';

const state = {
  screen: 'mode',
  focusIdx: 0,
  // the three answers
  mode: null,       // 'grill' | 'smoke' | 'bbq'
  fuel: null,       // FUELS[mode] entry
  assist: null,     // ASSIST_LEVELS entry
  // question scratch
  selCook: null,
  selDon: null,
  // the fire stage's preheat clock, deliberately kept across screens so
  // it ticks down while you answer the remaining questions
  preheat: { endTs: 0, dur: 0, rang: false },
  firePhase: 'go',      // 'light' up front, 'go' at the ready gate
  fireStepsOpen: false, // the walkthrough, only ever opened on purpose
  // the cook runs on its own clock so it can be stopped mid-cook. Every
  // deadline the engines set is stamped in clock() time, not wall time.
  pausedMs: 0,          // total time spent paused
  pauseStart: 0,        // when the current pause began, 0 while running
  // live cook
  items: [],        // exactly one: [{ uid, cookId, glyph, name, doneness, steps, stepIndex, endTs, done, hasTemp, targetF, scaleMin, scaleMax, tipIndex }]
  active: false,
  alertUid: null,   // item currently popped in the cue alert
  endAsk: false,    // the "end this cook?" confirm is up
  seen: {},         // uid -> highest due stepIndex we've already alerted on
  returnTo: 'mode', // where guide/help/safety should go back to
  safetyFirst: false,
};

let uidSeq = 1;

/* ─────────── tiny helpers ─────────── */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp  = (a, b, t) => a + (b - a) * t;
const cookById = (id) => COOKS.find(c => c.id === id);
function now() { return Date.now(); }

/* The cook's own clock. It stops while paused, so every countdown, every
   elapsed reading and every temperature projection freezes together
   instead of drifting apart. Wall time (now()) is still used for things
   outside the cook: the preheat and the alert dismiss timers. */
function clock() { return (state.pauseStart || now()) - state.pausedMs; }
const isPaused = () => !!state.pauseStart;

function togglePause() {
  if (state.pauseStart) {
    state.pausedMs += now() - state.pauseStart;
    state.pauseStart = 0;
    toast('Timers running again');
  } else {
    state.pauseStart = now();
    toast('Timers paused — nothing is counting down');
  }
  audio.tick();
  saveSession();
  if (state.screen === 'monitor') renderMonitor(); else renderCoach();
}

const modeById   = (id) => MODES.find(m => m.id === id);
const fuelsFor   = (mode) => FUELS[mode] || [];
const fuelById   = (mode, id) => fuelsFor(mode).find(f => f.id === id);
const assistById = (id) => ASSIST_LEVELS.find(a => a.id === id);

/* a "pit" cook is smoke or bbq — coached by the temp monitor, not the flip timer */
const isPit = (c) => c && (c.mode === 'smoke' || c.mode === 'bbq');
const heatLabel = (c) => c.mode === 'grill' ? c.grate : c.pitF + '°F';

/* everything downstream assumes all three answers exist; URL-state and
   restored sessions can land mid-flow, so fill the blanks with sane picks */
function ensureContext(mode) {
  if (mode) state.mode = mode;
  if (!state.mode) state.mode = 'grill';
  if (!state.fuel || !fuelById(state.mode, state.fuel.id)) state.fuel = fuelsFor(state.mode)[0];
  if (!state.assist) state.assist = assistById('coach');
  applyAssist();
}
function applyAssist() {
  $('#app').dataset.assist = state.assist ? state.assist.id : 'coach';
}

function formatClock(sec, signed) {
  const neg = sec < 0;
  sec = Math.abs(Math.round(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  let out = h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
  if (signed && neg) out = '+' + out;
  return out;
}

/* ─────────── micro-motion helpers ───────────
   Every animation in the app goes through one of these two, because both
   of them only fire when something actually changed. The coach and the pit
   monitor re-render five times a second; anything keyed to a render rather
   than a change would strobe on the lens. */
function restartAnim(el, cls) {
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth;            // reflow, so the animation can replay
  el.classList.add(cls);
}
/* set text and animate ONLY if it is different from what is already there */
function setText(el, txt, cls) {
  if (!el || el.textContent === String(txt)) return false;
  el.textContent = txt;
  if (cls) restartAnim(el, cls);
  return true;
}

/* ─────────── audio (short WebAudio blips, no assets) ─────────── */
const audio = {
  ctx: null,
  ensure() { if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch {} } },
  blip(freq = 440, dur = 0.12, type = 'sine', gain = 0.14) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(t); o.stop(t + dur + 0.02);
  },
  cue()  { this.ensure(); this.blip(880, 0.14, 'triangle', 0.16); setTimeout(() => this.blip(1180, 0.16, 'triangle', 0.16), 130); },
  tick() { this.ensure(); this.blip(660, 0.07, 'square', 0.06); },
  done() { this.ensure(); this.blip(523, 0.14, 'sine', 0.14); setTimeout(() => this.blip(784, 0.2, 'sine', 0.14), 130); },
};

/* ─────────── toast ─────────── */
let toastTimer = null;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg; el.classList.remove('hidden'); el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.classList.remove('show'); }, 1900);
}

/* ═════════════════ SPLASH ═════════════════
   Canvas, cold boot only. A bed of coals breathing at the bottom, sparks
   lifting off it, and GRILLMASTER heating through the colours steel
   actually goes through — dull brown, coal red, ember orange, white.

   Everything is drawn on cleared (pure black) canvas, which is exactly
   what the waveguide wants: the black is transparent and only the hot
   pixels reach your eye. No filled background, ever. */
function heatColor(p) {
  const stops = [[0, 74, 36, 16], [0.40, 255, 75, 38], [0.72, 255, 180, 87], [1, 255, 251, 244]];
  for (let i = 1; i < stops.length; i++) {
    if (p <= stops[i][0]) {
      const a = stops[i - 1], b = stops[i], t = (p - a[0]) / (b[0] - a[0]);
      return `rgb(${lerp(a[1], b[1], t) | 0},${lerp(a[2], b[2], t) | 0},${lerp(a[3], b[3], t) | 0})`;
    }
  }
  return 'rgb(255,251,244)';
}

const splash = {
  DUR: 2600, raf: 0, t0: 0, ctx: null, coals: [], sparks: [], ended: true, onDone: null,

  prepare() {
    const cv = $('#splash-canvas');
    if (!cv || !cv.getContext) return false;
    this.ctx = cv.getContext('2d');
    this.coals = [];
    for (let i = 0; i < 44; i++) {
      this.coals.push({
        x: 40 + Math.random() * 520, y: 452 + Math.random() * 58,
        r: 2 + Math.random() * 4.5, ph: Math.random() * 6.283, sp: 0.7 + Math.random() * 1.1,
      });
    }
    this.sparks = [];
    return true;
  },

  start(onDone) {
    this.onDone = onDone;
    if (!this.prepare()) { this.finish(); return; }
    this.ended = false;
    let reduced = false;
    try { reduced = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch {}
    if (reduced) {
      // one settled frame, then move on — no motion for anyone who asked for none
      for (let i = 0; i < 70; i++) this.step(1.2);
      this.draw(1.9);
      setTimeout(() => this.finish(), 900);
      return;
    }
    this.t0 = performance.now();
    this.raf = requestAnimationFrame((t) => this.frame(t));
  },

  frame(t) {
    if (this.ended) return;
    const el = (t - this.t0) / 1000;
    this.step(el);
    this.draw(el);
    if (el * 1000 >= this.DUR) { this.finish(); return; }
    this.raf = requestAnimationFrame((n) => this.frame(n));
  },

  step(el) {
    if (el < 2.1 && this.sparks.length < 140) {
      for (let i = 0; i < 2; i++) {
        const c = this.coals[(Math.random() * this.coals.length) | 0];
        this.sparks.push({
          x: c.x, y: c.y, vx: (Math.random() - 0.5) * 26, vy: -(60 + Math.random() * 130),
          age: 0, ttl: 0.9 + Math.random() * 1.3, r: 0.7 + Math.random() * 1.7,
        });
      }
    }
    const dt = 1 / 60;
    for (const s of this.sparks) {
      s.age += dt; s.x += s.vx * dt; s.y += s.vy * dt;
      s.vy += 14 * dt; s.vx *= 0.995;
    }
    this.sparks = this.sparks.filter(s => s.age < s.ttl && s.y > -20);
  },

  draw(el) {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.clearRect(0, 0, 600, 600);

    for (const c of this.coals) {
      const g = 0.35 + 0.65 * Math.pow(Math.sin(el * 1.9 * c.sp + c.ph), 2);
      ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, 6.2832);
      ctx.shadowColor = 'rgba(255,110,32,.95)'; ctx.shadowBlur = 16 * g;
      ctx.fillStyle = `rgba(255,${(80 + g * 90) | 0},${(18 + g * 40) | 0},${(0.30 + g * 0.55).toFixed(3)})`;
      ctx.fill();
    }
    for (const s of this.sparks) {
      const life = 1 - s.age / s.ttl;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r * (0.4 + life * 0.6), 0, 6.2832);
      ctx.shadowColor = 'rgba(255,150,60,.9)'; ctx.shadowBlur = 8 * life;
      ctx.fillStyle = `rgba(255,${(150 + life * 90) | 0},${(70 + life * 110) | 0},${(life * 0.85).toFixed(3)})`;
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    const word = 'GRILLMASTER', track = 2;
    ctx.font = '700 56px "Space Grotesk", system-ui, sans-serif';
    ctx.textBaseline = 'alphabetic';
    const w = [...word].map(ch => ctx.measureText(ch).width);
    const total = w.reduce((a, b) => a + b, 0) + track * (word.length - 1);
    let x = (600 - total) / 2;
    const prog = clamp(el / 1.45, 0, 1);
    [...word].forEach((ch, i) => {
      const p = clamp((prog - (i / word.length) * 0.5) / 0.45, 0, 1);
      ctx.fillStyle = heatColor(p);
      ctx.shadowColor = 'rgba(255,125,46,.9)'; ctx.shadowBlur = 26 * p;
      ctx.fillText(ch, x, 300);
      x += w[i] + track;
    });
    ctx.shadowBlur = 0;

    const late = clamp((el - 1.35) / 0.55, 0, 1);
    if (late > 0) {
      ctx.textAlign = 'center';
      ctx.font = '600 15px "Space Grotesk", system-ui, sans-serif';
      ctx.fillStyle = `rgba(221,210,193,${(late * 0.95).toFixed(2)})`;
      ctx.fillText('HOT & FAST TO LOW & SLOW · HANDS FREE', 300, 338);
      ctx.textAlign = 'left';
      const half = 152 * late;
      const grad = ctx.createLinearGradient(300 - half, 0, 300 + half, 0);
      grad.addColorStop(0, 'rgba(255,75,38,0)');
      grad.addColorStop(0.5, `rgba(255,180,87,${late.toFixed(2)})`);
      grad.addColorStop(1, 'rgba(255,75,38,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(300 - half, 358, half * 2, 2);
    }
  },

  finish() {
    if (this.ended) return;
    this.ended = true;
    cancelAnimationFrame(this.raf);
    const done = this.onDone; this.onDone = null;
    if (done) done();
  },
};

/* draw with the real wordmark if the webfont turns up quickly, but never
   hold the app hostage to a font request that is failing */
function withFont(fn) {
  let ran = false;
  const go = () => { if (!ran) { ran = true; fn(); } };
  setTimeout(go, 700);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(go, go);
  else go();
}

/* ═════════════════ SAFETY ═════════════════ */
const safetySeen = () => { try { return !!localStorage.getItem(SAFETY_KEY); } catch { return true; } };
const markSafetySeen = () => { try { localStorage.setItem(SAFETY_KEY, '1'); } catch {} };

function renderSafety() {
  const list = $('#safety-list');
  list.innerHTML = '';
  SAFETY.forEach((line, i) => {
    const row = document.createElement('div');
    row.className = 'fs-row';
    row.style.setProperty('--i', i);
    row.innerHTML = `<div class="fs-n">${i + 1}</div><div class="fs-t">${line}</div>`;
    list.appendChild(row);
  });
}
function goSafety(firstRun) {
  state.safetyFirst = !!firstRun;
  $('#safety-back').classList.toggle('hidden', !!firstRun);
  $('#safety-ok').textContent = firstRun ? 'GOT IT' : 'BACK';
  showScreen('safety');
  focusEl($('#safety-ok'));
}
function safetyOk() {
  if (state.safetyFirst) { markSafetySeen(); goMode(); }
  else goReturn();
}

/* ─────────── screen routing ─────────── */
function showScreen(name) {
  if (!$('#' + name)) {
    console.warn(`grillmaster: no screen "${name}", falling back to the first question`);
    name = 'mode';
  }
  state.screen = name;
  $$('.screen').forEach(s => s.classList.toggle('hidden', s.id !== name));
  restartAnim($('#' + name), 'm-enter');
  paintStepRails();
  state.focusIdx = 0;
  refreshFocus();
}

/* MODE › FIRE › HELP › FOOD › TASTE › PLAN across the top of each
   question. TASTE drops out for cuts with no doneness ladder, so the
   rail never shows a step you were never asked. data-step="6" means
   "the last one", whatever the count came out to be. */
function stepLabels() {
  const base = ['MODE', 'FIRE', 'HELP', 'FOOD'];
  const ladder = !state.selCook || !!state.selCook.doneness;
  return ladder ? [...base, 'TASTE', 'PLAN'] : [...base, 'PLAN'];
}
function paintStepRails() {
  const labels = stepLabels();
  $$('.step-rail').forEach(el => {
    let cur = Number(el.dataset.step);
    if (cur >= 6) cur = labels.length;
    el.innerHTML = labels
      .map((l, i) => {
        const n = i + 1;
        const cls = n === cur ? 'sr on' : n < cur ? 'sr done' : 'sr';
        return `<span class="${cls}">${l}</span>`;
      })
      .join('<span class="sr-sep">›</span>');
  });
}

/* one wide, centred row per choice, shared by all three question screens */
function pickRow({ action, key, glyph, name, tag, sub, selected, i }) {
  const b = document.createElement('button');
  b.className = 'pick focusable' + (selected ? ' sel' : '');
  if (i != null) b.style.setProperty('--i', i);
  b.dataset.action = action;
  b.dataset.key = key;
  b.innerHTML =
    `<span class="pick-head">` +
      (glyph ? `<span class="pick-g">${glyph}</span>` : '') +
      `<span class="pick-k">${name}</span>` +
    `</span>` +
    (tag ? `<span class="pick-t">${tag}</span>` : '') +
    (sub ? `<span class="pick-s">${sub}</span>` : '');
  return b;
}

/* ═════════════════ STEP 1 — MODE ═════════════════ */
function renderModePick() {
  const list = $('#mode-list');
  list.innerHTML = '';
  // three across, never a scroll — see .pick-list.side
  list.className = 'pick-list side';
  MODES.forEach((m, i) => list.appendChild(pickRow({
    action: 'pick-mode', key: m.id, glyph: m.glyph, i,
    name: m.name, tag: m.tag, sub: m.sub, selected: state.mode === m.id,
  })));
}
function goMode() {
  renderModePick();
  showScreen('mode');
  focusEl($('.pick.sel') || $('#mode-list .pick'));
}
function pickMode(id) {
  state.mode = id;
  // a fuel from another mode means nothing here — re-pick it
  if (!state.fuel || !fuelById(id, state.fuel.id)) state.fuel = null;
  goFuel();
}

/* ═════════════════ STEP 2 — THE FIRE ═════════════════ */
function renderFuelPick() {
  const m = modeById(state.mode);
  const fuels = fuelsFor(state.mode);
  $('#fuel-sub').textContent = `${m.name} · ${m.tag}`;
  const list = $('#fuel-list');
  list.innerHTML = '';
  list.classList.toggle('compact', fuels.length > 3);
  fuels.forEach((f, i) => list.appendChild(pickRow({
    action: 'pick-fuel', key: f.id, glyph: f.glyph, i,
    name: f.name, tag: f.tag, sub: null,
    selected: state.fuel && state.fuel.id === f.id,
  })));
}
function goFuel() {
  if (!state.mode) return goMode();
  renderFuelPick();
  showScreen('fuel');
  focusEl($('#fuel-list .pick.sel') || $('#fuel-list .pick'));
}
function pickFuel(id) {
  state.fuel = fuelById(state.mode, id);
  goAssist();
}

/* ═════════════════ STEP 3 — HOW MUCH HELP ═════════════════ */
function renderAssistPick() {
  const m = modeById(state.mode);
  $('#assist-sub').textContent = `${m.name} ON ${state.fuel.name}`;
  const list = $('#assist-list');
  list.innerHTML = '';
  list.classList.remove('compact');
  ASSIST_LEVELS.forEach((a, i) => list.appendChild(pickRow({
    action: 'pick-assist', key: a.id, glyph: a.glyph, i,
    name: a.name, tag: a.tag, sub: a.sub,
    selected: state.assist && state.assist.id === a.id,
  })));
}
function goAssist() {
  if (!state.fuel) return goFuel();
  renderAssistPick();
  showScreen('assist');
  focusEl($('#assist-list .pick.sel') || $('#assist-list .pick'));
}
function pickAssist(id) {
  state.assist = assistById(id);
  applyAssist();
  // asked to be walked through it? then light the fire now, not at the end
  if (state.assist.steps) goFire('light');
  else goCooks();
}

/* ═════════════════ STEP 4 — THE FOOD ═════════════════ */
/* rough "how long am I in for", shown on every cook row */
function cookQuickTime(c) {
  if (isPit(c)) return pitRoughHours(c).replace('~', '');
  const d = c.doneness ? (c.doneness.find(x => x.rec) || c.doneness[0]) : null;
  const total = c.plan(d).filter(s => !s.rest).reduce((a, s) => a + s.sec, 0);
  return Math.max(1, Math.round(total / 60)) + 'm';
}

function renderCooks() {
  const m = modeById(state.mode);
  const list = COOKS.filter(c => c.mode === state.mode);

  $('#cooks-title').textContent = `${m.q} · ${list.length} ${m.unit}`;
  $('#ctx-strip').innerHTML =
    `<span class="ctx hot">${m.glyph} ${m.name}</span>` +
    `<span class="ctx">${state.fuel.glyph} ${state.fuel.name}</span>` +
    `<span class="ctx">${state.assist.glyph} ${state.assist.name}</span>` +
    preheatChip('ctx');

  const el = $('#cook-list');
  el.innerHTML = '';
  list.forEach((c, i) => {
    const row = document.createElement('button');
    row.className = 'cook-row focusable';
    row.style.setProperty('--i', i);
    row.dataset.action = 'pick-cook';
    row.dataset.id = c.id;
    const heat = isPit(c) ? 'PIT ' + heatLabel(c) : 'GRATE ' + heatLabel(c);
    row.innerHTML =
      `<span class="cook-head">` +
        `<span class="cg">${c.glyph}</span>` +
        `<span class="cname">${c.name.toUpperCase()}</span>` +
      `</span>` +
      `<span class="cmeta">` +
        `<span class="cs-v">${cookQuickTime(c)}</span> · ${heat} · ${c.level}` +
      `</span>`;
    el.appendChild(row);
  });
}
function goCooks() {
  ensureContext();
  renderCooks();
  showScreen('cooks');
  focusEl($('#cook-list .cook-row'));
}

/* ═════════════════ Q5 — HOW DO YOU LIKE IT? ═════════════════
   Its own screen, like every other question. Cuts without a ladder
   (chicken, salmon, anything on the pit) skip straight to the plan. */
function openCook(cookId) {
  const c = cookById(cookId);
  if (!c) return;
  ensureContext(c.mode);
  state.selCook = c;
  state.selDon = c.doneness ? (c.doneness.find(d => d.rec) || c.doneness[0]) : null;
  if (c.doneness) goDoneness();
  else goPlan();
}

function renderDoneness() {
  const c = state.selCook;
  $('#doneness-sub').textContent = c.name.toUpperCase();
  const list = $('#doneness-list');
  list.innerHTML = '';
  c.doneness.forEach((d, i) => {
    list.appendChild(pickRow({
      action: 'pick-doneness', key: d.key, glyph: null, i,
      name: (d.label || '').toUpperCase(),
      tag: `PULL ${d.pullF}°F · EATS AT ${d.servF}°F` + (d.rec ? ' · OUR PICK' : ''),
      sub: null,
      selected: state.selDon && state.selDon.key === d.key,
    }));
  });
}
function goDoneness() {
  if (!state.selCook || !state.selCook.doneness) return goPlan();
  renderDoneness();
  showScreen('doneness');
  focusEl($('#doneness-list .pick.sel') || $('#doneness-list .pick'));
}
function pickDoneness(key) {
  const c = state.selCook;
  state.selDon = c.doneness.find(d => d.key === key) || state.selDon;
  goPlan();
}

/* ═════════════════ THE PLAN — the numbers, then the fire ═════════════════ */
function renderPlan() {
  const c = state.selCook, d = state.selDon;

  $('#plan-title').textContent = c.name.toUpperCase();
  $('#plan-glyph').textContent = c.glyph;
  $('#plan-cut').textContent = d ? `${d.label} · ${c.cut}` : c.cut;
  $('#plan-heat').textContent = isPit(c) ? 'PIT ' + c.pitF + '°F' : 'GRATE ' + c.grate;
  $('#plan-fuel').textContent = state.fuel.name;
  const row = $('#plan .chip-row');
  $$('.preheat-live', row).forEach(el => el.remove());
  row.insertAdjacentHTML('beforeend', preheatChip('chip'));
  $('#light-btn').textContent = isPit(c) ? 'FIRE UP THE PIT' : 'FIRE IT UP';

  renderPlanTarget();
}
function goPlan() {
  if (!state.selCook) return goCooks();
  renderPlan();
  showScreen('plan');
  focusEl($('#light-btn'));
}

const fmtRest = (sec) => {
  const m = Math.round(sec / 60);
  if (m < 60) return m + 'm';
  return (m % 60) ? Math.floor(m / 60) + 'h ' + (m % 60) + 'm' : (m / 60) + 'h';
};

/* The middle column earns its place or it goes away. Brisket and pulled
   pork have no USDA floor to quote, so they show the rest instead — the
   number beginners skip — and a hot dog, which has neither, drops to two
   columns rather than printing a dash. */
function renderMidTarget(c) {
  const col = $('#tgt-safe').closest('.tgt-col');
  const k = col.querySelector('.tgt-k');
  const grid = col.parentElement;
  if (c.safeF) {
    k.textContent = 'SAFE MIN';
    $('#tgt-safe').textContent = c.safeF + '°';
    col.classList.add('safe');
  } else if (c.restSec > 0) {
    k.textContent = 'THEN REST';
    $('#tgt-safe').textContent = fmtRest(c.restSec);
    col.classList.remove('safe');
  } else {
    col.classList.add('hidden');
    grid.style.gridTemplateColumns = '1fr 1fr';
    return;
  }
  col.classList.remove('hidden');
  grid.style.gridTemplateColumns = '1fr 1fr 1fr';
}

function renderPlanTarget() {
  const c = state.selCook, d = state.selDon;
  renderMidTarget(c);

  if (isPit(c)) {
    // pit cooks: pull temp (or "feel") and a rough total in hours
    $('#tgt-pull').textContent = c.noProbe ? 'FEEL' : (c.targetF ? c.targetF + '°' : '~203°');
    $('#tgt-time').textContent = pitRoughHours(c);
    return;
  }

  const plan = c.plan(d);
  const temps = plan.map(s => s.atEndF).filter(v => v != null);
  const total = plan.filter(s => !s.rest).reduce((a, s) => a + s.sec, 0);

  $('#tgt-pull').textContent = d ? d.pullF + '°' : (temps.length ? Math.max(...temps) + '°' : 'BY EYE');
  $('#tgt-time').textContent = Math.max(1, Math.round(total / 60)) + 'm';
}

/* very rough "how long am I in for" for a pit cook */
function pitRoughHours(c) {
  const timed = c.phases.filter(p => p.trigger && p.trigger.afterMin != null);
  if (timed.length) {
    const mins = Math.max(...timed.map(p => p.trigger.afterMin));
    return '~' + Math.round((mins + 30) / 60) + 'h';
  }
  // temp-driven: ballpark by pit temp + how far the meat has to climb
  const climb = (c.targetF || 203) - c.startF;
  const perHr = c.pitF >= 300 ? 90 : c.pitF >= 250 ? 32 : 24; // °F/hr ballpark
  return '~' + Math.max(1, Math.round(climb / perHr)) + 'h';
}

/* build a live item instance from the current setup selection */
function makeItem(c, d) {
  const steps = c.plan(d);
  const temps = steps.map(s => s.atEndF).filter(v => v != null);
  const hasTemp = temps.length > 0;
  const targetF = d ? d.pullF : (hasTemp ? Math.max(...temps) : null);
  return {
    uid: uidSeq++,
    cookId: c.id, glyph: c.glyph, name: c.name.toUpperCase(),
    doneness: d ? d.label : null,
    steps, stepIndex: 0, endTs: 0, done: false,
    hasTemp, targetF,
    scaleMin: hasTemp ? c.startF : 0,
    scaleMax: hasTemp ? Math.max(...temps) : 100,
    tipIndex: 0,
  };
}

/* ═════════════════ THE FIRE STAGE ═════════════════
   Lighting a fire is not a step you take just before the food goes on —
   it is the FIRST thing you do, and then it takes 12 to 35 minutes. So
   this screen has two jobs and shows up twice in a cook, doing something
   different each time:

     phase 'light'  Straight after the HELP question, and only for the
                    person who asked to be walked through it. The three
                    steps for THAT fuel, once. Start the preheat here and
                    it keeps counting while you pick your food.

     phase 'go'     The ready gate at the end. No walkthrough — by now
                    the fire is lit. Just the heat lever, how you know
                    it's ready, the clock if it's running, and FOOD'S ON.
                    The steps are one button away if you want them, and
                    never on screen unless you asked.

   FOOD'S ON is what starts the cook, because the cook timer measures
   food on the grate, not coals in a chimney. */
function preheatRem() {
  return state.preheat.endTs ? (state.preheat.endTs - now()) / 1000 : null;
}

function startPreheat() {
  const mins = state.fuel.preheatMin || 15;
  state.preheat = { endTs: now() + mins * 60000, dur: mins * 60, rang: false };
  audio.tick();
  toast(`Preheating ${mins} min — ${state.fuel.lever.toLowerCase()}`);
  renderFire();
}
function clearPreheat() {
  state.preheat = { endTs: 0, dur: 0, rang: false };
}
function togglePreheat() {
  if (preheatRem() == null) startPreheat();
  else { clearPreheat(); audio.tick(); renderFire(); }
}

/* chime once when the fire comes up to temp, on whatever screen */
function preheatWatch() {
  const rem = preheatRem();
  if (rem == null) return;
  updatePreheatChips(rem);
  if (rem > 0 || state.preheat.rang) return;
  state.preheat.rang = true;
  audio.cue();
  if (navigator.vibrate) { try { navigator.vibrate([90, 60, 90]); } catch {} }
  toast(`Fire's ready — ${state.fuel.ready.toLowerCase()}`);
}

/* a lit fire has to stay visible while you answer the other questions,
   or you forget it is burning — so the cook list and the plan carry it */
function updatePreheatChips(rem) {
  const txt = rem <= 0 ? '🔥 READY' : '🔥 ' + formatClock(rem);
  $$('.preheat-live').forEach(el => { el.textContent = txt; el.classList.toggle('up', rem <= 0); });
}
function preheatChip(cls) {
  const rem = preheatRem();
  if (rem == null) return '';
  const up = rem <= 0;
  return `<span class="${cls} preheat-live${up ? ' up' : ''}">${up ? '🔥 READY' : '🔥 ' + formatClock(rem)}</span>`;
}

function renderPreheat() {
  const rem = preheatRem();
  const block = $('#preheat');
  if (rem == null) { block.classList.add('hidden'); return; }
  const up = rem <= 0;
  block.classList.remove('hidden');
  block.classList.toggle('ready', up);
  $('#preheat-time').textContent = up ? 'READY' : formatClock(rem);
  // "READY" is the one moment on this screen worth announcing
  setText($('#preheat-lbl'), up ? 'THE FIRE IS READY' : 'UNTIL THE FIRE IS READY', 'm-reveal');
}

function renderFire() {
  const f = state.fuel, m = modeById(state.mode);
  const light = state.firePhase === 'light';
  const rem = preheatRem();
  const mins = f.preheatMin || 15;
  const meat = isPit(state.selCook) ? 'MEAT' : 'FOOD';

  setText($('#fire-title'), light ? 'LIGHT THE FIRE' : 'IS THE FIRE READY?');
  setText($('#fire-fuel'), `${f.name} · ${m.name}`);

  // the walkthrough: open up front, closed at the gate until asked for
  const showSteps = light || state.fireStepsOpen;
  const wrap = $('#fire-steps');
  if (wrap.dataset.fuel !== f.id) { wrap.innerHTML = ''; wrap.dataset.fuel = f.id; }
  if (showSteps && !wrap.childElementCount) {
    f.steps.forEach((s, i) => {
      const row = document.createElement('div');
      row.className = 'fs-row';
      row.style.setProperty('--i', i);
      row.innerHTML = `<div class="fs-n">${i + 1}</div><div class="fs-t">${s}</div>`;
      wrap.appendChild(row);
    });
  }
  wrap.classList.toggle('hidden', !showSteps);

  // the two summary lines say the same thing as the steps, so they step
  // aside when the steps are up rather than repeat them
  $('#fire-facts').classList.toggle('hidden', showSteps);
  $('#fire-ready').textContent = `Ready when: ${f.ready.toLowerCase()}.`;
  // lever values carry inconsistent articles ("BOTTOM VENT" vs "THE KNOBS"),
  // so strip any leading "the" and supply exactly one
  const lever = f.lever.toLowerCase().replace(/^the /, '');
  $('#fire-lever').textContent = `Change the heat with the ${lever}.`;

  // every button says what pressing it does
  const stepsBtn = $('#steps-btn');
  stepsBtn.classList.toggle('hidden', light);
  stepsBtn.textContent = state.fireStepsOpen ? 'HIDE THE STEPS' : 'SHOW ME HOW TO LIGHT IT';

  $('#preheat-btn').textContent = rem == null ? `START A ${mins} MIN TIMER`
    : rem <= 0 ? 'START THE TIMER AGAIN' : 'CANCEL THE TIMER';

  $('#fire-go-btn').textContent = light ? 'NEXT: PICK YOUR FOOD' : `PUT THE ${meat} ON`;

  renderPreheat();
}

function goFire(phase) {
  state.firePhase = phase;
  if (phase === 'light') state.fireStepsOpen = false;
  renderFire();
  showScreen('fire');
  focusEl(phase === 'light' && preheatRem() == null ? $('#preheat-btn') : $('#fire-go-btn'));
}

/* reached from the plan — the ready gate, never the walkthrough */
function lightFire() { goFire('go'); }

function toggleFireSteps() {
  state.fireStepsOpen = !state.fireStepsOpen;
  audio.tick();
  renderFire();
  focusEl($('#steps-btn'));
}

function ignite() {
  clearPreheat();
  state.pausedMs = 0; state.pauseStart = 0;
  state.items = isPit(state.selCook)
    ? [makePitItem(state.selCook)]
    : [makeItem(state.selCook, state.selDon)];
  if (isPit(state.selCook)) startPit(); else startCook();
}

/* ═════════════════ COACH, the live cook ═════════════════ */
function startCook() {
  const t = clock();
  state.items.forEach(it => {
    it.stepIndex = 0;
    it.endTs = t + it.steps[0].sec * 1000;
    it.done = false;
  });
  state.active = true;
  state.seen = {};
  saveSession();
  showScreen('coach');
  focusEl($('#advance-btn'));
  renderCoach();
}

/* one cut per cook — there is only ever one item */
function primaryItem() {
  const it = state.items[0];
  return it && !it.done ? it : null;
}

/* remaining seconds to this item's next cue (negative = overdue) */
function remainingSec(it) { return (it.endTs - clock()) / 1000; }

/* status of an item: 'cooking' | 'due' | 'serve' | 'done' */
function itemStatus(it) {
  if (it.done) return 'done';
  const last = it.stepIndex >= it.steps.length - 1;
  const overdue = remainingSec(it) <= 0;
  if (!overdue) return 'cooking';
  return last ? 'serve' : 'due';
}

/* estimated internal temp right now */
function estTemp(it) {
  if (!it.hasTemp) return null;
  const cur = it.steps[it.stepIndex];
  if (cur.atEndF == null) return null;
  const prevF = it.stepIndex === 0
    ? cookById(it.cookId).startF
    : (it.steps[it.stepIndex - 1].atEndF ?? cookById(it.cookId).startF);
  let p = 1 - remainingSec(it) / cur.sec;
  p = clamp(p, 0, 1);
  return Math.round(lerp(prevF, cur.atEndF, p));
}

/* advance the focused item one beat (called by DID IT / Enter) */
function advanceItem(it) {
  if (!it || it.done) return;
  if (state.alertUid != null) ackCue();
  const onLastStep = it.stepIndex >= it.steps.length - 1;
  if (onLastStep) {
    // pulling / serving the final beat finishes the item
    it.done = true;
    audio.done();
    toast(`${it.name}, plated ✓`);
  } else {
    it.stepIndex++;
    it.endTs = clock() + it.steps[it.stepIndex].sec * 1000;
    audio.tick();
  }
  saveSession();
  if (it.done) { finishCook(); return; }
  renderCoach();
}

function finishCook() {
  state.active = false;
  clearSession();
  $('#done-title').textContent = 'PLATED';
  $('#done-sub').textContent = 'Off the fire. Let it rest, then eat.';
  audio.done();
  showScreen('done');
  focusEl($('#done .btn.primary'));
}

/* ═════════════════ ENDING A COOK ═════════════════
   ◀ means "one question back" everywhere else in the app, so on the
   coach and the pit monitor it must not silently throw away a live
   cook — a touchpad swipe mirrors to ◀, and a brisket is nine hours
   of work. Both the END button and ◀ ask first, and the safe answer
   is the one that starts focused. */
function endDetail() {
  const pit = pitItem();
  if (pit) {
    const elapsed = fmtElapsed(clock() - pit.litAt);
    return pit.noProbe ? `${pit.name} · ${elapsed}` : `${pit.name} · ${pit.meatF}° · ${elapsed}`;
  }
  const it = primaryItem();
  if (!it) return '';
  const next = it.steps[it.stepIndex + 1];
  return `${it.name} · ${formatClock(Math.abs(remainingSec(it)))} to ${next ? next.tag : 'SERVE'}`;
}

function askEndCook() {
  if (!state.active) { quitCook(); return; }
  if (state.alertUid != null) ackCue();
  $('#end-detail').textContent = endDetail();
  $('#end-confirm').classList.remove('hidden');
  state.endAsk = true;
  focusEl($('#end-confirm .btn.primary'));   // KEEP COOKING is the default
}
function closeEndAsk() {
  state.endAsk = false;
  $('#end-confirm').classList.add('hidden');
  // hand focus back to whatever the screen had
  refreshFocus();
  if (state.screen === 'coach') focusEl($('#advance-btn'));
}

function quitCook() {
  state.endAsk = false;
  $('#end-confirm').classList.add('hidden');
  state.active = false;
  state.items = [];
  clearPreheat();
  clearSession();
  goCooks();
}

/* the fuel reminder strip — FIRST TIME keeps it up the whole cook */
function renderHint(el) {
  const on = !!(state.assist && state.assist.hints && state.fuel);
  el.classList.toggle('hidden', !on);
  if (on) el.innerHTML = `<b>${state.fuel.lever}</b><span>${state.fuel.hint}</span>`;
}

/* full re-render of the coach screen */
function renderCoach() {
  const it = primaryItem();
  if (!it) return;
  const status = itemStatus(it);
  const last = it.stepIndex >= it.steps.length - 1;
  const cur = it.steps[it.stepIndex];
  const next = it.steps[it.stepIndex + 1];

  setText($('#now-item'), it.name + (it.doneness ? ' · ' + it.doneness.toUpperCase() : ''));

  const ring = $('#clock-ring');
  const rem = remainingSec(it);

  if (status === 'due') {
    // next action is due, flip the card to show what to do NOW
    setText($('#now-phase'), next.tag);
    setText($('#now-cue'), next.cue, 'm-reveal');
    setText($('#now-sub'), next.sub);
    $('#clock-time').textContent = formatClock(rem, true);
    $('#clock-lbl').textContent = 'DO IT NOW';
    ring.classList.add('due');
    ring.style.setProperty('--pct', '100%');
  } else if (status === 'serve') {
    setText($('#now-phase'), 'SERVE');
    setText($('#now-cue'), 'READY, SERVE IT', 'm-reveal');
    setText($('#now-sub'), 'Off the fire and onto the plate.');
    $('#clock-time').textContent = formatClock(rem, true);
    $('#clock-lbl').textContent = 'RESTED';
    ring.classList.add('due');
    ring.style.setProperty('--pct', '100%');
  } else {
    // mid-step: cur.cue is the action that STARTED this step, so showing it
    // here reads as an instruction you have already carried out. Show what
    // is happening instead — you flipped it, now it is on its second side.
    setText($('#now-phase'), cur.tag);
    setText($('#now-cue'), cur.hold || cur.cue, 'm-reveal');
    setText($('#now-sub'), cur.sub);
    $('#clock-time').textContent = formatClock(rem, false);
    $('#clock-lbl').textContent = isPaused() ? 'PAUSED'
      : last ? 'TO SERVE' : ('TO ' + (next ? next.tag : 'SERVE'));
    ring.classList.remove('due');
    const pct = clamp((1 - rem / cur.sec) * 100, 0, 100);
    ring.style.setProperty('--pct', pct.toFixed(1) + '%');
  }
  ring.classList.toggle('paused', isPaused());
  $('#pause-btn').textContent = isPaused() ? 'RESUME' : 'PAUSE';
  $('#pause-btn').classList.toggle('on', isPaused());

  // temp block
  const tb = $('#temp-block');
  if (it.hasTemp) {
    tb.classList.remove('hidden');
    const est = estTemp(it);
    $('#temp-est').textContent = est + '°';
    setText($('#temp-tgt'), it.targetF + '°', 'm-bump');
    const span = Math.max(1, it.scaleMax - it.scaleMin);
    const fillPct = clamp(((est - it.scaleMin) / span) * 100, 0, 100);
    const tickPct = clamp(((it.targetF - it.scaleMin) / span) * 100, 0, 100);
    $('#temp-fill').style.width = fillPct.toFixed(1) + '%';
    $('#temp-tick').style.left = tickPct.toFixed(1) + '%';
  } else {
    tb.classList.add('hidden');
  }

  renderHint($('#coach-hint'));
  renderAdvance(status, next);
}

/* The confirm button only earns its size when there is something to
   confirm. Mid-step the cue says HANDS OFF and the countdown is doing
   the work, so a big orange DID IT sitting under it reads as "press me
   now that the food is on" — which advances the cook by a whole beat.
   So while it is cooking the button goes quiet and says what pressing
   it would actually mean; when the cue comes due it turns primary,
   grows, and pulses. */
function renderAdvance(status, next) {
  const btn = $('#advance-btn');
  const armed = status === 'due' || status === 'serve';
  btn.classList.toggle('primary', armed);
  btn.classList.toggle('big', armed);
  btn.classList.toggle('ghost', !armed);
  btn.classList.toggle('armed', armed);
  btn.textContent = status === 'serve' ? 'SERVE IT ✓'
    : armed ? 'DONE ✓'
    : 'I DID IT ALREADY';
  btn.title = armed ? '' : (next ? 'Jump ahead to ' + next.tag : '');
}

/* ═════════════════ PIT ENGINE — smoke + bbq monitor ═════════════════ */
function makePitItem(c) {
  return {
    uid: uidSeq++, kind: 'pit', mode: c.mode,
    cookId: c.id, glyph: c.glyph, name: c.name.toUpperCase(),
    pitTarget: c.pitF, pitTol: c.pitTol, pitF: c.pitF,
    meatF: c.startF, startF: c.startF,
    targetF: c.targetF != null ? c.targetF : null,
    noProbe: !!c.noProbe, stall: !!c.stall,
    phases: c.phases, phaseIndex: 0,
    litAt: 0, history: [],
    spritzMs: (c.spritzMin || 0) * 60000, lastSpritzAt: 0, spritzDue: false,
    resting: false, restEndTs: 0, restSec: c.restSec,
    pitBad: false, done: false, tipIndex: 0, sel: 0,
  };
}
function pitItem() { const i = state.items[0]; return i && i.kind === 'pit' ? i : null; }

function startPit() {
  const it = pitItem();
  const t = clock();
  it.litAt = t; it.lastSpritzAt = t;
  it.history = [{ t, f: it.meatF }];
  it.phaseIndex = 0; it.resting = false; it.done = false; it.sel = 0;
  state.active = true; state.seen = {};
  saveSession();
  showScreen('monitor');
  renderMonitor();
}

const pitPhase = (it) => it.phases[it.phaseIndex];
const pitNext  = (it) => it.phases[it.phaseIndex + 1];
const isPullPhase = (it) => !!(pitPhase(it) && pitPhase(it).pull);

function triggerMet(phase, it) {
  if (!phase || !phase.trigger) return false;
  if (phase.trigger.atF != null) return it.meatF >= phase.trigger.atF;
  if (phase.trigger.afterMin != null) return (clock() - it.litAt) >= phase.trigger.afterMin * 60000;
  return false;
}

/* meat climb rate in °F/hour, smoothed over the last ~ up-to-3 readings */
function climbRate(it) {
  const h = it.history;
  if (h.length < 2) return null;
  const last = h[h.length - 1];
  // find an earlier point at least 45s back for a stable slope
  let prev = h[0];
  for (let i = h.length - 2; i >= 0; i--) {
    if (last.t - h[i].t >= 45000) { prev = h[i]; break; }
    prev = h[i];
  }
  const hrs = (last.t - prev.t) / 3600000;
  if (hrs <= 0) return null;
  return (last.f - prev.f) / hrs;
}

function fmtDur(mins) {
  mins = Math.max(0, Math.round(mins));
  if (mins < 60) return '~' + mins + 'm';
  const h = Math.floor(mins / 60), m = mins % 60;
  return '~' + h + 'h' + (m ? ' ' + m + 'm' : '');
}
function fmtElapsed(ms) {
  const mins = Math.floor(ms / 60000);
  const h = Math.floor(mins / 60), m = mins % 60;
  return (h ? h + 'h ' : '') + m + 'm in';
}

/* returns { v, sub, stall } for the ETA line */
function pitEta(it) {
  const next = pitNext(it);
  if (!next) return { v: 'AT TEMP', sub: 'ready to pull' };
  if (next.trigger && next.trigger.afterMin != null) {
    const remMs = next.trigger.afterMin * 60000 - (clock() - it.litAt);
    return { v: fmtDur(remMs / 60000).replace('~', ''), sub: 'to ' + next.tag };
  }
  // temp-driven
  const target = next.trigger.atF;
  if (it.stall && it.meatF >= 150 && it.meatF <= 170) {
    const r = climbRate(it);
    if (r == null || r < 4) return { v: 'STALL', sub: 'holding, ride it out', stall: true };
  }
  const rate = climbRate(it);
  if (rate == null || rate <= 0) return { v: '—', sub: 'dial in a reading' };
  const mins = ((target - it.meatF) / rate) * 60;
  return { v: fmtDur(mins).replace('~', ''), sub: 'to ' + next.tag };
}

function pitTick() {
  const it = pitItem();
  if (!it) return;

  if (it.resting) {
    if (clock() >= it.restEndTs) { finishCook(); return; }
    renderMonitor();
    return;
  }

  // advance phase if the next one's trigger is met
  const next = pitNext(it);
  if (next && !isPullPhase(it) && triggerMet(next, it)) {
    it.phaseIndex++;
    popPitAlert(it, it.phases[it.phaseIndex]);
    saveSession();
  }

  // pit drift alarm (chime once on entering the bad zone)
  const bad = it.pitF < it.pitTarget - it.pitTol || it.pitF > it.pitTarget + it.pitTol;
  if (bad && !it.pitBad) { audio.cue(); if (navigator.vibrate) try { navigator.vibrate(120); } catch {} }
  it.pitBad = bad;

  // spritz nudge (chime once when it first comes due)
  if (it.spritzMs > 0) {
    const due = clock() - it.lastSpritzAt >= it.spritzMs;
    if (due && !it.spritzDue) { audio.tick(); }
    it.spritzDue = due;
  }

  renderMonitor();
}

function popPitAlert(it, phase) {
  $('#cue-eyebrow').textContent = it.name;
  $('#cue-big').textContent = phase.tag;
  $('#cue-item').textContent = phase.cue;
  $('#cue-alert').classList.remove('hidden');
  state.alertUid = it.uid;
  audio.cue();
  if (navigator.vibrate) { try { navigator.vibrate([90, 60, 90]); } catch {} }
  clearTimeout(alertTimer);
  alertTimer = setTimeout(ackCue, alertHold());
}

/* control-bar fields available right now */
function pitFields(it) {
  const f = [];
  if (!it.noProbe) f.push('meat');
  f.push('pit');
  if (isPullPhase(it) && !it.resting) f.push('pull');
  if (it.spritzMs > 0 && !it.resting) f.push('spritz');
  f.push('tip'); f.push('pause'); f.push('end');
  return f;
}

function bumpMeat(d) {
  const it = pitItem(); if (!it || it.noProbe) return;
  it.meatF = clamp(it.meatF + d, 32, 250);
  it.history.push({ t: clock(), f: it.meatF });
  audio.tick();
  renderMonitor();
}
function bumpPit(d) {
  const it = pitItem(); if (!it) return;
  it.pitF = clamp(it.pitF + d, 100, 450);
  audio.tick();
  renderMonitor();
}
function resetSpritz() {
  const it = pitItem(); if (!it) return;
  it.lastSpritzAt = clock(); it.spritzDue = false;
  toast('Spritz logged'); audio.tick();
  renderMonitor();
}
function confirmPull() {
  const it = pitItem(); if (!it) return;
  it.resting = true;
  it.restEndTs = clock() + it.restSec * 1000;
  audio.done();
  toast(`${it.name} pulled, resting`);
  saveSession();
  renderMonitor();
}
function pitTipCycle() {
  const it = pitItem(); if (!it) return;
  const c = cookById(it.cookId);
  if (!c.tips || !c.tips.length) return;
  it.tipIndex = (it.tipIndex + 1) % c.tips.length;
  toast('💡 ' + c.tips[it.tipIndex]);
}

function renderMonitor() {
  const it = pitItem();
  if (!it) return;
  const phase = pitPhase(it);
  const fields = pitFields(it);
  it.sel = clamp(it.sel, 0, fields.length - 1);
  const selField = fields[it.sel];

  setText($('#mon-item'), it.name);
  setText($('#mon-phase'), it.resting ? 'REST' : phase.tag, 'm-bump');

  if (it.resting) {
    setText($('#mon-cue'), 'RESTING', 'm-reveal');
    setText($('#mon-sub'), 'Keep it wrapped and let it relax.');
  } else {
    setText($('#mon-cue'), phase.hold || phase.cue, 'm-reveal');
    setText($('#mon-sub'), phase.sub);
  }

  // banners — the fix is written in the language of YOUR fire
  const alarm = $('#mon-alarm');
  if (it.pitBad && !it.resting) {
    alarm.classList.remove('hidden');
    const low = it.pitF < it.pitTarget;
    const fix = low ? state.fuel.lowFix : state.fuel.highFix;
    $('#mon-alarm-txt').textContent = (low ? 'PIT LOW · ' : 'PIT HIGH · ') + fix;
    $('#mon-alarm .mb-ico').textContent = low ? '▼' : '▲';
  } else alarm.classList.add('hidden');
  const spritzOn = it.spritzDue && !it.resting;
  $('#mon-spritz').classList.toggle('hidden', !spritzOn);
  if (spritzOn) $('#mon-spritz-txt').textContent = state.fuel.spritz;

  // gauges
  const gMeat = $('#g-meat'), gPit = $('#g-pit');
  const gaugesWrap = gMeat.parentElement;
  gMeat.classList.toggle('hidden', it.noProbe);
  gaugesWrap.style.gridTemplateColumns = it.noProbe ? '1fr' : '1fr 1fr';
  if (!it.noProbe) {
    // each ±5° bump is a deliberate act, so it gets acknowledged
    setText($('#mon-meat'), it.meatF + '°', 'm-bump');
    setText($('#mon-meat-tgt'), it.targetF ? '→ ' + it.targetF + '°' : 'by feel');
  }
  setText($('#mon-pit'), it.pitF + '°', 'm-bump');
  setText($('#mon-pit-tgt'), 'hold ' + it.pitTarget + '°');
  gPit.classList.toggle('pit-bad', it.pitBad);
  gMeat.classList.toggle('sel', selField === 'meat');
  gPit.classList.toggle('sel', selField === 'pit');

  // eta
  const etaEl = $('.eta');
  if (it.resting) {
    const rem = Math.max(0, (it.restEndTs - clock()) / 1000);
    $('#mon-eta').textContent = formatClock(rem);
    $('#mon-eta-sub').textContent = 'until it’s ready to serve';
    etaEl.classList.remove('stall');
  } else if (isPaused()) {
    $('#mon-eta').textContent = 'PAUSED';
    $('#mon-eta-sub').textContent = 'nothing is counting · ' + fmtElapsed(clock() - it.litAt);
    etaEl.classList.remove('stall');
  } else {
    const e = pitEta(it);
    $('#mon-eta').textContent = e.v;
    $('#mon-eta-sub').textContent = e.sub + ' · ' + fmtElapsed(clock() - it.litAt);
    etaEl.classList.toggle('stall', !!e.stall);
  }

  renderHint($('#mon-hint'));

  // control bar
  const bar = $('#mon-bar');
  const labels = { meat: 'MEAT', pit: 'PIT', pull: 'PULL ✓', spritz: 'SPRITZ ✓',
                   tip: 'TIP', pause: isPaused() ? 'RESUME' : 'PAUSE', end: 'END' };
  bar.innerHTML = '';
  fields.forEach((f, i) => {
    const b = document.createElement('button');
    b.className = 'mon-field' + (f === 'pull' ? ' pull' : '') + (i === it.sel ? ' sel' : '');
    b.dataset.action = 'mon-field'; b.dataset.field = f;
    b.textContent = labels[f];
    bar.appendChild(b);
  });
}

/* D-pad on the monitor */
function monitorKey(key) {
  const it = pitItem(); if (!it) return;
  const fields = pitFields(it);
  const selField = fields[it.sel];
  switch (key) {
    case 'ArrowLeft':  it.sel = (it.sel - 1 + fields.length) % fields.length; renderMonitor(); audio.tick(); return;
    case 'ArrowRight': it.sel = (it.sel + 1) % fields.length; renderMonitor(); audio.tick(); return;
    case 'ArrowUp':    if (selField === 'meat') bumpMeat(5); else if (selField === 'pit') bumpPit(5); return;
    case 'ArrowDown':  if (selField === 'meat') bumpMeat(-5); else if (selField === 'pit') bumpPit(-5); return;
    case 'Enter':
    case ' ':          activatePitField(selField); return;
  }
}
function activatePitField(f) {
  switch (f) {
    case 'pull':   confirmPull(); break;
    case 'spritz': resetSpritz(); break;
    case 'tip':    pitTipCycle(); break;
    case 'pause':  togglePause(); break;
    case 'end':    askEndCook(); break;
    // meat / pit are adjusted with ▲▼, Enter is a no-op on them
  }
}

/* per-frame refresh of clocks + due detection */
function tick() {
  // the preheat chimes on whatever screen you happen to be looking at
  preheatWatch();
  if (state.screen === 'fire') { renderPreheat(); return; }
  if (state.screen === 'monitor') { if (state.active) pitTick(); return; }
  if (state.screen !== 'coach' || !state.active) return;

  // fire the cue alert when an item first crosses into 'due'/'serve'
  state.items.forEach(it => {
    if (it.done) return;
    const st = itemStatus(it);
    if (st === 'due' || st === 'serve') {
      const key = st + ':' + it.stepIndex;
      if (state.seen[it.uid] !== key) {
        state.seen[it.uid] = key;
        popCueAlert(it, st);
      }
    }
  });

  renderCoach();
}

/* ═════════════════ CUE ALERT ═════════════════ */
let alertTimer = null;
/* first-timers get longer to read it, pros get it out of the way */
const alertHold = () => (state.assist ? state.assist.alertMs : 3400);

function popCueAlert(it, status) {
  const next = it.steps[it.stepIndex + 1];
  $('#cue-eyebrow').textContent = it.name;
  $('#cue-big').textContent = status === 'serve' ? 'SERVE' : next.tag;
  $('#cue-item').textContent = status === 'serve' ? 'rested & ready' : next.cue;
  $('#cue-alert').classList.remove('hidden');
  state.alertUid = it.uid;
  audio.cue();
  if (navigator.vibrate) { try { navigator.vibrate([90, 60, 90]); } catch {} }

  clearTimeout(alertTimer);
  alertTimer = setTimeout(ackCue, alertHold());
}
function ackCue() {
  clearTimeout(alertTimer);
  $('#cue-alert').classList.add('hidden');
  state.alertUid = null;
}

/* ═════════════════ TEMP GUIDE ═════════════════ */
function renderGuide() {
  const list = $('#guide-list');
  list.innerHTML = '';
  TEMP_GUIDE.forEach((g, i) => {
    const row = document.createElement('div');
    row.className = 'g-row';
    row.style.setProperty('--i', i);
    row.innerHTML =
      `<div class="g-body">` +
        `<div class="g-name">${g.name} <span class="g-note">· ${g.note}</span></div>` +
        `<div class="g-sub">${g.sub}</div>` +
      `</div>` +
      `<div class="g-temp">${g.temp}</div>`;
    list.appendChild(row);
  });
}

/* ─────────── focus engine (D-pad) ─────────── */
function focuslist() {
  if (state.endAsk) return $$('#end-confirm .focusable');
  const scr = $('#' + state.screen);
  if (!scr) return [];
  return $$('.focusable', scr).filter(el => el.offsetParent !== null && !el.disabled);
}
function refreshFocus() {
  const list = focuslist();
  state.focusIdx = clamp(state.focusIdx, 0, Math.max(0, list.length - 1));
  paintFocus(list);
}
function paintFocus(list) {
  list = list || focuslist();
  document.querySelectorAll('.focus').forEach(el => el.classList.remove('focus'));
  const el = list[state.focusIdx];
  if (!el) return;
  el.classList.add('focus');
  // long lists scroll; keep the focused row on the lens
  if (el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
}
function focusEl(el) {
  if (!el) { refreshFocus(); return; }
  const list = focuslist();
  const i = list.indexOf(el);
  if (i >= 0) state.focusIdx = i;
  paintFocus(list);
}
function moveFocus(delta) {
  const list = focuslist();
  if (!list.length) return;
  state.focusIdx = (state.focusIdx + delta + list.length) % list.length;
  paintFocus(list);
  audio.tick();
}

/* ─────────── mode screen D-pad (two rows, three across) ───────────
   The first question is laid out horizontally, so ◀ ▶ walk the tiles
   and ▲ ▼ hop between the tile row and the footer. ◀ has nothing to
   go back to here, which is exactly why it is free to steer. */
function modeKey(key) {
  const tiles = $$('#mode-list .pick');
  const foot  = $$('#mode .foot-row .btn');
  const el = focuslist()[state.focusIdx];
  const inFoot = foot.includes(el);
  const row = inFoot ? foot : tiles;
  const i = row.indexOf(el);
  if (i < 0) { focusEl(tiles[0]); return; }

  const land = (next) => { if (next) { focusEl(next); audio.tick(); } };
  switch (key) {
    case 'ArrowLeft':  land(row[(i - 1 + row.length) % row.length]); return;
    case 'ArrowRight': land(row[(i + 1) % row.length]); return;
    case 'ArrowDown':  land(inFoot ? tiles[Math.min(i, tiles.length - 1)] : foot[Math.min(i, foot.length - 1)]); return;
    case 'ArrowUp':    land(inFoot ? tiles[Math.min(i, tiles.length - 1)] : foot[Math.min(i, foot.length - 1)]); return;
  }
}

/* Put the current step's countdown back to the top. For when you got
   pulled away, or the cue fired before you were ready to act on it — the
   beat itself is right, the clock just needs another run at it. */
function resetTimer() {
  const it = primaryItem();
  if (!it) return;
  const cur = it.steps[it.stepIndex];
  it.endTs = clock() + cur.sec * 1000;
  delete state.seen[it.uid];      // let this beat's cue fire again
  audio.tick();
  saveSession();
  toast(`Timer back to ${formatClock(cur.sec)} on ${cur.tag}`);
  renderCoach();
}

function coachTip() {
  const it = primaryItem();
  if (!it) return;
  const c = cookById(it.cookId);
  if (!c.tips || !c.tips.length) return;
  it.tipIndex = (it.tipIndex + 1) % c.tips.length;
  toast('💡 ' + c.tips[it.tipIndex]);
}

/* ═════════════════ input wiring ═════════════════ */
function bindEvents() {
  const unlock = () => audio.ensure();
  document.addEventListener('click', unlock, { once: true });
  document.addEventListener('keydown', unlock, { once: true });

  // click / tap (mouse for dev, tap mirrors on device where supported)
  document.addEventListener('click', (e) => {
    if (state.screen === 'splash') { splash.finish(); return; }
    const t = e.target.closest('[data-action]');
    if (!t) return;
    restartAnim(t, 'm-press');
    handleAction(t.dataset.action, t);
  });
  document.addEventListener('mouseover', (e) => {
    const f = e.target.closest('.focusable');
    if (f) focusEl(f);
  });

  document.addEventListener('keydown', (e) => {
    // the splash is skippable with anything at all
    if (state.screen === 'splash') { e.preventDefault(); splash.finish(); return; }

    // the end confirm sits above everything and steers with any direction
    if (state.endAsk) {
      if (['ArrowLeft', 'ArrowUp'].includes(e.key))   { e.preventDefault(); moveFocus(-1); return; }
      if (['ArrowRight', 'ArrowDown'].includes(e.key)) { e.preventDefault(); moveFocus(1); return; }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const el = focuslist()[state.focusIdx];
        if (el) el.click();
      }
      return;
    }

    // cue alert intercepts the first key as an acknowledgement
    if (state.alertUid != null) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ackCue(); }
      return;
    }

    if (state.screen === 'monitor') {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', ' '].includes(e.key)) e.preventDefault();
      monitorKey(e.key);
      return;
    }

    // the first question is a horizontal row, so it steers in 2D
    if (state.screen === 'mode' && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      modeKey(e.key);
      return;
    }

    // the coach's controls are a horizontal row too: ◀ ▶ walk them, and the
    // free vertical axis cycles the pro tip. Nothing destructive on a swipe.
    if (state.screen === 'coach' && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      if (e.key === 'ArrowLeft') moveFocus(-1);
      else if (e.key === 'ArrowRight') moveFocus(1);
      else coachTip();
      return;
    }

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault(); moveFocus(-1); return;
      case 'ArrowDown':
        e.preventDefault(); moveFocus(1); return;
      case 'ArrowLeft':
        e.preventDefault();
        handleBack();
        return;
      case 'ArrowRight':
        e.preventDefault();
        return;
      case 'Enter':
      case ' ': {
        e.preventDefault();
        const el = focuslist()[state.focusIdx];
        if (el) el.click();
        return;
      }
    }
  });
}

/* ◀ always walks one question back up the flow */
function handleBack() {
  switch (state.screen) {
    case 'fuel':     goMode(); break;
    case 'assist':   goFuel(); break;
    case 'cooks':    goAssist(); break;
    case 'doneness': goCooks(); break;
    case 'plan':     planBack(); break;
    case 'fire':     state.firePhase === 'light' ? goAssist() : goPlan(); break;
    case 'done':   goCooks(); break;
    case 'guide':
    case 'help':   goReturn(); break;
    case 'coach':
    case 'monitor': askEndCook(); break;
    // mode: nowhere further back
  }
}
/* the plan's back arrow rewinds to whichever question preceded it */
function planBack() {
  if (state.selCook && state.selCook.doneness) goDoneness();
  else goCooks();
}
function goReturn() {
  if (state.returnTo === 'cooks' && state.mode) goCooks();
  else goMode();
}

function handleAction(a, el) {
  switch (a) {
    case 'pick-mode':     pickMode(el.dataset.key); break;
    case 'pick-fuel':     pickFuel(el.dataset.key); break;
    case 'pick-assist':   pickAssist(el.dataset.key); break;
    case 'pick-cook':     openCook(el.dataset.id); break;
    case 'pick-doneness': pickDoneness(el.dataset.key); break;
    case 'light-fire':    lightFire(); break;
    case 'preheat':       togglePreheat(); break;
    case 'toggle-steps':  toggleFireSteps(); break;
    case 'fire-go':       state.firePhase === 'light' ? goCooks() : ignite(); break;
    case 'fire-back':     handleBack(); break;
    case 'advance':       advanceItem(primaryItem()); break;
    case 'mon-field': {
      const it = pitItem(); if (!it) break;
      const fields = pitFields(it);
      const idx = fields.indexOf(el.dataset.field);
      if (idx >= 0) { it.sel = idx; renderMonitor(); }
      activatePitField(el.dataset.field);
      break;
    }
    case 'pause':         togglePause(); break;
    case 'reset-timer':   resetTimer(); break;
    case 'ask-end':       askEndCook(); break;
    case 'end-keep':      closeEndAsk(); break;
    case 'end-yes':       quitCook(); break;
    case 'ack-cue':       ackCue(); break;
    case 'show-safety':   state.returnTo = state.screen; goSafety(false); break;
    case 'safety-ok':     safetyOk(); break;
    case 'show-guide':    state.returnTo = state.screen; renderGuide(); showScreen('guide'); focusEl($('#guide .crumb')); break;
    case 'show-help':     state.returnTo = state.screen; showScreen('help'); focusEl($('#help .btn.primary')); break;
    case 'go-mode':       goMode(); break;
    case 'go-fuel':       goFuel(); break;
    case 'go-assist':     goAssist(); break;
    case 'go-cooks':      goCooks(); break;
    case 'go-doneness':   goDoneness(); break;
    case 'go-plan':       goPlan(); break;
    case 'go-back-plan':  planBack(); break;
    case 'go-back':       goReturn(); break;
  }
}

/* ═════════════════ persistence ═════════════════ */
function saveSession() {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      mode: state.mode,
      fuelId: state.fuel ? state.fuel.id : null,
      assistId: state.assist ? state.assist.id : null,
      active: state.active, items: state.items, uidSeq,
      pausedMs: state.pausedMs, pauseStart: state.pauseStart,
    }));
  } catch {}
}
function clearSession() { try { localStorage.removeItem(SESSION_KEY); } catch {} }
function restoreSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw);
    if (!s.active || !Array.isArray(s.items) || !s.items.length) return false;
    // stored items are plain data — the step timelines are baked in, good to go
    state.mode = s.mode || 'grill';
    state.fuel = fuelById(state.mode, s.fuelId);
    state.assist = assistById(s.assistId);
    ensureContext();
    state.items = s.items;
    state.pausedMs = s.pausedMs || 0;
    state.pauseStart = s.pauseStart || 0;
    state.active = true;
    uidSeq = s.uidSeq || (Math.max(...s.items.map(i => i.uid)) + 1);
    if (pitItem()) {
      if (pitItem().done) { clearSession(); return false; }
      showScreen('monitor');
      renderMonitor();
      return true;
    }
    // already finished? don't resume it
    if (!primaryItem()) { clearSession(); return false; }
    showScreen('coach');
    focusEl($('#advance-btn'));
    renderCoach();
    return true;
  } catch { return false; }
}

/* ═════════════════ URL state (README screenshots) ═════════════════
   ?state=<key> pre-seeds the app for deterministic captures. Keys
   mirror the screenshot filenames. */
function seedItem(cookId, donKey, stepIndex, remSec) {
  const c = cookById(cookId);
  const d = donKey && c.doneness ? c.doneness.find(x => x.key === donKey) : null;
  const it = makeItem(c, d);
  it.stepIndex = stepIndex;
  it.endTs = clock() + remSec * 1000;
  return it;
}
function applyUrlState() {
  let key;
  try { key = new URLSearchParams(location.search).get('state'); } catch { return false; }
  if (!key) return false;

  switch (key) {
    /* ── the front door ── */
    case 'splash':
      showScreen('splash');
      withFont(() => {
        if (!splash.prepare()) return;
        for (let i = 0; i < 80; i++) splash.step(1.0);  // a live-looking spark field
        splash.draw(2.2);                                // the settled frame
      });
      return true;
    case 'safety':
      ensureContext('grill'); state.returnTo = 'mode'; goSafety(false); return true;
    case 'safety-first':
      ensureContext('grill'); goSafety(true); return true;

    /* ── the four questions ── */
    case 'mode':
      goMode(); return true;
    case 'fuel':
      ensureContext('grill'); state.fuel = null; goFuel(); return true;
    case 'fuel-smoke':
      ensureContext('smoke'); state.fuel = null; goFuel(); return true;
    case 'assist':
      ensureContext('grill'); goAssist(); return true;
    case 'assist-smoke':
      ensureContext('smoke'); goAssist(); return true;

    /* ── the cook list (legacy "home" keys) ── */
    case 'home':
    case 'cooks':
      ensureContext('grill'); goCooks(); return true;
    case 'home-preheating':
      // the fire lit up front, still coming up while you pick your food
      ensureContext('grill');
      state.preheat = { endTs: now() + 11 * 60000, dur: 20 * 60, rang: false };
      goCooks(); return true;
    case 'home-smoke':
      ensureContext('smoke'); goCooks(); return true;
    case 'home-bbq':
      ensureContext('bbq'); goCooks(); return true;

    /* ── the doneness ladder ── */
    case 'doneness':
      ensureContext('grill'); openCook('ribeye'); return true;
    case 'doneness-burger':
      ensureContext('grill'); openCook('burger'); return true;

    /* ── the plan ("setup" is the legacy key for this screen) ── */
    case 'setup':
    case 'plan':
      ensureContext('grill'); openCook('ribeye'); goPlan(); return true;
    case 'setup-smoke':
    case 'plan-smoke':
      ensureContext('smoke'); openCook('brisket'); return true;
    case 'setup-bbq':
    case 'plan-bbq':
      ensureContext('bbq'); openCook('ribs'); return true;

    /* ── the fire, up front: the walkthrough, once, for FIRST TIME ── */
    case 'fire-light':
      ensureContext('grill'); state.assist = assistById('rookie'); applyAssist();
      goFire('light'); return true;
    case 'fire-light-smoke':
      ensureContext('smoke'); state.fuel = fuelById('smoke', 'offset');
      state.assist = assistById('rookie'); applyAssist();
      goFire('light'); return true;

    /* ── the fire, at the end: the ready gate, no lecture ── */
    case 'fire':
      ensureContext('grill'); openCook('ribeye'); goPlan(); lightFire(); return true;
    case 'fire-preheat':
      ensureContext('grill'); openCook('ribeye'); goPlan(); lightFire();
      state.preheat = { endTs: now() + 8.5 * 60000, dur: 20 * 60, rang: false };
      renderFire(); return true;
    case 'fire-steps':
      // the gate with the walkthrough pulled up on purpose
      ensureContext('grill'); openCook('ribeye'); goPlan(); lightFire();
      state.fireStepsOpen = true; renderFire(); return true;
    case 'fire-pro':
      ensureContext('grill'); state.assist = assistById('pro'); applyAssist();
      openCook('ribeye'); goPlan(); lightFire(); return true;
    case 'fire-smoke':
      ensureContext('smoke'); openCook('brisket'); goPlan(); lightFire(); return true;

    /* ── the pit monitor ── */
    case 'monitor': {
      // brisket deep in the cook: wrapped, climbing out of the stall
      ensureContext('smoke');
      state.items = [makePitItem(cookById('brisket'))];
      const it = pitItem();
      const t = now();
      it.litAt = t - 5.5 * 3600000;        // 5.5 h in
      it.meatF = 171; it.pitF = 228; it.phaseIndex = 2; // WRAP phase
      it.lastSpritzAt = t - 20 * 60000;
      it.history = [
        { t: t - 40 * 60000, f: 158 },
        { t: t - 20 * 60000, f: 164 },
        { t, f: 171 },
      ];
      it.sel = 0;
      state.active = true; state.seen = {};
      showScreen('monitor'); renderMonitor();
      return true;
    }
    case 'monitor-stall': {
      ensureContext('smoke');
      state.items = [makePitItem(cookById('brisket'))];
      const it = pitItem();
      const t = now();
      it.litAt = t - 4 * 3600000; it.meatF = 158; it.pitF = 224; it.phaseIndex = 1;
      it.history = [{ t: t - 30 * 60000, f: 156 }, { t: t - 15 * 60000, f: 157 }, { t, f: 158 }];
      state.active = true; state.seen = {};
      showScreen('monitor'); renderMonitor();
      return true;
    }
    case 'monitor-alarm': {
      // pit dropped on a charcoal smoker — the fix is fuel-specific
      ensureContext('smoke');
      state.fuel = fuelById('smoke', 'charcoal');
      state.items = [makePitItem(cookById('pulled-pork'))];
      const it = pitItem();
      const t = now();
      it.litAt = t - 3 * 3600000; it.meatF = 156; it.pitF = 198; it.phaseIndex = 1;
      it.pitBad = true; it.sel = 1;
      it.history = [{ t: t - 30 * 60000, f: 148 }, { t, f: 156 }];
      state.active = true; state.seen = {};
      showScreen('monitor'); renderMonitor();
      return true;
    }
    case 'monitor-bbq': {
      // ribs, time-driven, in the sauce phase
      ensureContext('bbq');
      state.items = [makePitItem(cookById('ribs'))];
      const it = pitItem();
      const t = now();
      it.litAt = t - 320 * 60000; it.pitF = 274; it.phaseIndex = 2; // SAUCE
      it.lastSpritzAt = t - 10 * 60000;
      state.active = true; state.seen = {};
      showScreen('monitor'); renderMonitor();
      return true;
    }

    /* ── the grill coach ── */
    case 'coach': {
      // a cue has come due: first side is seared, the flip is overdue
      ensureContext('grill');
      state.items = [seedItem('ribeye', 'mr', 0, -8)];
      state.active = true; state.seen = {};
      // mark it already alerted so no overlay lands in the shot
      state.seen[state.items[0].uid] = 'due:0';
      showScreen('coach'); focusEl($('#advance-btn')); renderCoach();
      return true;
    }
    case 'coach-hold': {
      // mid-step, nothing due — the confirm button stands down
      ensureContext('grill');
      state.items = [seedItem('ribeye', 'mr', 1, 64)];
      state.active = true; state.seen = {};
      showScreen('coach'); focusEl($('#advance-btn')); renderCoach();
      return true;
    }
    case 'coach-paused': {
      ensureContext('grill');
      state.items = [seedItem('ribeye', 'mr', 1, 64)];
      state.active = true; state.seen = {};
      state.pauseStart = now();
      showScreen('coach'); focusEl($('#pause-btn')); renderCoach();
      return true;
    }
    case 'coach-rookie': {
      // with the FIRST TIME fuel reminder showing
      ensureContext('grill');
      state.assist = assistById('rookie'); applyAssist();
      state.items = [seedItem('ribeye', 'mr', 0, 64)];
      state.active = true; state.seen = {};
      showScreen('coach'); focusEl($('#advance-btn')); renderCoach();
      return true;
    }
    case 'coach-pro': {
      ensureContext('grill');
      state.assist = assistById('pro'); applyAssist();
      state.items = [seedItem('ribeye', 'mr', 1, 47)];
      state.active = true; state.seen = {};
      showScreen('coach'); focusEl($('#advance-btn')); renderCoach();
      return true;
    }
    case 'cue': {
      ensureContext('grill');
      state.items = [seedItem('ribeye', 'mr', 0, -3)];
      state.active = true; state.seen = {};
      showScreen('coach'); renderCoach();
      popCueAlert(state.items[0], 'due');
      // mark seen + kill the auto-dismiss so the overlay holds for the capture
      state.seen[state.items[0].uid] = 'due:0';
      clearTimeout(alertTimer);
      return true;
    }

    /* ── the rest ── */
    case 'done':
      ensureContext('grill');
      state.items = [makeItem(cookById('ribeye'), STEAK_DONENESS[1])];
      finishCook(); return true;
    case 'guide':
      ensureContext('grill'); state.returnTo = 'mode'; renderGuide(); showScreen('guide'); return true;
    case 'help':
      ensureContext('grill'); state.returnTo = 'mode'; showScreen('help'); return true;
  }
  return false;
}

/* ═════════════════ boot ═════════════════ */
function boot() {
  bindEvents();
  paintStepRails();
  renderModePick();
  renderSafety();

  // a ?state= capture or a resumed cook both skip the splash outright
  if (applyUrlState()) { startLoop(); return; }
  if (restoreSession()) { startLoop(); return; }

  startLoop();
  // state.screen has to actually say 'splash', or the skip-on-any-input
  // guard in bindEvents never matches and the splash can't be dismissed
  showScreen('splash');
  withFont(() => splash.start(() => {
    if (safetySeen()) goMode();
    else goSafety(true);
  }));
}
function startLoop() {
  setInterval(tick, 200);
}

document.addEventListener('DOMContentLoaded', boot);
