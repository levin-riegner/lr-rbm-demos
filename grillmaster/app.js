/* ─────────────────────────────────────────────────────────────
   GRILLMASTER, the coach engine
   ---------------------------------------------------------------
   Built for the Ray-Ban Display: 600×600, D-pad + Enter, no typing,
   hands busy. The whole app is one idea, "tell me the ONE thing to
   do right now, count me down to the next one, and never make me
   touch a screen with greasy tongs in my hand."

   Before any food appears, the app asks three questions, in the
   order a person actually makes them:

     1. MODE   grill / smoke / bbq        → which engine coaches you
     2. FIRE   charcoal / gas / wood / …  → what you turn to change
                                            the heat, how to light it,
                                            what the alarms should say
     3. HELP   first time / coach / pro   → how much the HUD explains

   Only then does it show the cuts. Every answer is carried into the
   live cook, so "PIT LOW" becomes "PIT LOW · FEED IT COALS" on a
   kettle and "PIT LOW · TURN THE BURNER UP" on gas.

   A COOK SESSION holds one or more ITEMS. Each item walks its own
   timeline of STEPS (see data.js). The coach always shows the item
   whose next cue is soonest, and rails the rest.
   ───────────────────────────────────────────────────────────── */

const SESSION_KEY = 'grillmaster.session.v2';

const state = {
  screen: 'mode',
  focusIdx: 0,
  // the three answers
  mode: null,       // 'grill' | 'smoke' | 'bbq'
  fuel: null,       // FUELS[mode] entry
  assist: null,     // ASSIST_LEVELS entry
  // setup scratch
  selCook: null,
  selDon: null,
  // live cook
  items: [],        // [{ uid, cookId, glyph, name, doneness, steps, stepIndex, endTs, done, hasTemp, targetF, scaleMin, scaleMax, tipIndex }]
  active: false,
  coachFocus: 0,    // index into non-done items shown as primary
  alertUid: null,   // item currently popped in the cue alert
  seen: {},         // uid -> highest due stepIndex we've already alerted on
  returnTo: 'mode', // where guide/help should go back to
};

let uidSeq = 1;

/* ─────────── tiny helpers ─────────── */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp  = (a, b, t) => a + (b - a) * t;
const cookById = (id) => COOKS.find(c => c.id === id);
function now() { return Date.now(); }

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

/* ─────────── screen routing ─────────── */
function showScreen(name) {
  state.screen = name;
  $$('.screen').forEach(s => s.classList.toggle('hidden', s.id !== name));
  state.focusIdx = 0;
  refreshFocus();
}

/* the MODE › FIRE › HELP › FOOD breadcrumb at the top of each step */
const STEP_LABELS = ['MODE', 'FIRE', 'HELP', 'FOOD'];
function paintStepRails() {
  $$('.step-rail').forEach(el => {
    const cur = Number(el.dataset.step);
    el.innerHTML = STEP_LABELS
      .map((l, i) => {
        const n = i + 1;
        const cls = n === cur ? 'sr on' : n < cur ? 'sr done' : 'sr';
        return `<span class="${cls}">${l}</span>`;
      })
      .join('<span class="sr-sep">›</span>');
  });
}

/* one wide, centred row per choice, shared by all three question screens */
function pickRow({ action, key, glyph, name, tag, sub, selected }) {
  const b = document.createElement('button');
  b.className = 'pick focusable' + (selected ? ' sel' : '');
  b.dataset.action = action;
  b.dataset.key = key;
  b.innerHTML =
    `<span class="pick-head">` +
      `<span class="pick-g">${glyph}</span>` +
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
  MODES.forEach(m => list.appendChild(pickRow({
    action: 'pick-mode', key: m.id, glyph: m.glyph,
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
  fuels.forEach(f => list.appendChild(pickRow({
    action: 'pick-fuel', key: f.id, glyph: f.glyph,
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
  ASSIST_LEVELS.forEach(a => list.appendChild(pickRow({
    action: 'pick-assist', key: a.id, glyph: a.glyph,
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
  goCooks();
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
    `<span class="ctx">${state.assist.glyph} ${state.assist.name}</span>`;

  const el = $('#cook-list');
  el.innerHTML = '';
  list.forEach(c => {
    const row = document.createElement('button');
    row.className = 'cook-row focusable';
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

/* ═════════════════ SETUP ═════════════════ */
function openSetup(cookId) {
  const c = cookById(cookId);
  if (!c) return;
  ensureContext(c.mode);
  state.selCook = c;
  state.selDon = c.doneness ? (c.doneness.find(d => d.rec) || c.doneness[0]) : null;

  $('#setup-title').textContent = c.name.toUpperCase();
  $('#setup-glyph').textContent = c.glyph;
  $('#setup-cut').textContent = c.cut;
  $('#setup-grate').textContent = isPit(c) ? 'PIT ' + c.pitF + '°F' : 'GRATE ' + c.grate;
  $('#setup-fuel').textContent = state.fuel.name;
  $('#light-btn').textContent = isPit(c) ? 'LIGHT THE PIT →' : 'LIGHT IT →';

  // doneness picker only for cooks that have a ladder
  const donBlock = $('#doneness-block');
  const donRow = $('#doneness-row');
  if (c.doneness) {
    donBlock.classList.remove('hidden');
    donRow.innerHTML = '';
    c.doneness.forEach(d => {
      const b = document.createElement('button');
      b.className = 'don-btn focusable' + (d === state.selDon ? ' sel' : '');
      b.dataset.action = 'pick-doneness';
      b.dataset.key = d.key;
      b.innerHTML = (d.short || d.label) + (d.rec ? '<span class="rec-dot">●</span>' : '');
      donRow.appendChild(b);
    });
  } else {
    donBlock.classList.add('hidden');
  }

  // pit cooks (smoke/bbq) are one cut, coached solo, no stacking
  $('#add-btn').classList.toggle('hidden', isPit(c));

  renderSetupTarget();
  updateTrayNote();
  showScreen('setup');
  focusEl($('#light-btn'));
}

function pickDoneness(key) {
  const c = state.selCook;
  state.selDon = c.doneness.find(d => d.key === key) || state.selDon;
  $$('.don-btn').forEach(b => b.classList.toggle('sel', b.dataset.key === key));
  renderSetupTarget();
}

function renderSetupTarget() {
  const c = state.selCook, d = state.selDon;
  const safeCol = $('#tgt-safe').closest('.tgt-col');

  if (isPit(c)) {
    // pit cooks: pull temp (or "feel"), safe floor, rough total hours
    $('#tgt-pull').textContent = c.noProbe ? 'FEEL' : (c.targetF ? c.targetF + '°' : '~203°');
    $('#tgt-safe').textContent = c.safeF ? c.safeF + '°' : '—';
    safeCol.classList.toggle('safe', !!c.safeF);
    $('#tgt-time').textContent = pitRoughHours(c);
    return;
  }

  const plan = c.plan(d);
  const temps = plan.map(s => s.atEndF).filter(v => v != null);
  const total = plan.filter(s => !s.rest).reduce((a, s) => a + s.sec, 0);

  const pull = d ? d.pullF + '°' : (temps.length ? Math.max(...temps) + '°' : '—');
  $('#tgt-pull').textContent = pull;
  $('#tgt-safe').textContent = c.safeF ? c.safeF + '°' : '—';
  safeCol.classList.toggle('safe', !!c.safeF);
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

function updateTrayNote() {
  const n = state.items.length;
  const note = $('#tray-note');
  if (n === 0) { note.textContent = ''; return; }
  note.textContent = 'ON THE GRILL: ' + state.items.map(i => i.name).join(' · ');
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

function addItem() {
  const it = makeItem(state.selCook, state.selDon);
  state.items.push(it);
  updateTrayNote();
  toast(`${it.name} added — ${state.items.length} on the grill`);
  audio.tick();
  // bounce back to the list to stack another
  goCooks();
}

/* ═════════════════ THE FIRE PRIMER (FIRST TIME only) ═════════════════ */
function renderFire() {
  const f = state.fuel, m = modeById(state.mode);
  $('#fire-fuel').textContent = `${f.name} · ${m.name}`;
  const wrap = $('#fire-steps');
  wrap.innerHTML = '';
  f.steps.forEach((s, i) => {
    const row = document.createElement('div');
    row.className = 'fs-row';
    row.innerHTML = `<div class="fs-n">${i + 1}</div><div class="fs-t">${s}</div>`;
    wrap.appendChild(row);
  });
  $('#fire-lever').textContent = f.lever;
  $('#fire-ready').textContent = f.ready;
}

function lightFire() {
  if (state.assist && state.assist.primer) {
    renderFire();
    showScreen('fire');
    focusEl($('#fire-go'));
    return;
  }
  ignite();
}

function ignite() {
  if (isPit(state.selCook)) {
    state.items = [makePitItem(state.selCook)];
    startPit();
    return;
  }
  // ensure the current selection is included
  const alreadyIn = state.items.some(i =>
    i.cookId === state.selCook.id &&
    i.doneness === (state.selDon ? state.selDon.label : null));
  if (!alreadyIn || state.items.length === 0) {
    state.items.push(makeItem(state.selCook, state.selDon));
  }
  startCook();
}

/* ═════════════════ COACH, the live cook ═════════════════ */
function startCook() {
  const t = now();
  state.items.forEach(it => {
    it.stepIndex = 0;
    it.endTs = t + it.steps[0].sec * 1000;
    it.done = false;
  });
  state.active = true;
  state.coachFocus = 0;
  state.seen = {};
  saveSession();
  showScreen('coach');
  focusEl($('#advance-btn'));
  renderCoach();
}

/* the item currently in the big card */
function primaryItem() {
  const live = liveItems();
  if (live.length === 0) return null;
  state.coachFocus = clamp(state.coachFocus, 0, live.length - 1);
  return live[state.coachFocus];
}
function liveItems() { return state.items.filter(i => !i.done); }

/* remaining seconds to this item's next cue (negative = overdue) */
function remainingSec(it) { return (it.endTs - now()) / 1000; }

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
    it.endTs = now() + it.steps[it.stepIndex].sec * 1000;
    audio.tick();
  }
  saveSession();

  if (liveItems().length === 0) { finishCook(); return; }
  // keep focus sane
  state.coachFocus = clamp(state.coachFocus, 0, liveItems().length - 1);
  renderCoach();
}

function finishCook() {
  state.active = false;
  clearSession();
  const multi = state.items.length > 1;
  $('#done-title').textContent = multi ? 'ALL PLATED' : 'PLATED';
  $('#done-sub').textContent = multi
    ? `${state.items.length} items off the fire, together.`
    : 'Off the fire. Let it rest, then eat.';
  audio.done();
  showScreen('done');
  focusEl($('#done .btn.primary'));
}

function quitCook() {
  state.active = false;
  state.items = [];
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

  $('#now-item').textContent = it.name + (it.doneness ? ' · ' + it.doneness.toUpperCase() : '');

  const ring = $('#clock-ring');
  const rem = remainingSec(it);

  if (status === 'due') {
    // next action is due, flip the card to show what to do NOW
    $('#now-phase').textContent = next.tag;
    $('#now-cue').textContent = next.cue;
    $('#now-sub').textContent = next.sub;
    $('#clock-time').textContent = formatClock(rem, true);
    $('#clock-lbl').textContent = 'DO IT NOW';
    ring.classList.add('due');
    ring.style.setProperty('--pct', '100%');
  } else if (status === 'serve') {
    $('#now-phase').textContent = 'SERVE';
    $('#now-cue').textContent = 'READY, SERVE IT';
    $('#now-sub').textContent = 'Off the fire and onto the plate.';
    $('#clock-time').textContent = formatClock(rem, true);
    $('#clock-lbl').textContent = 'RESTED';
    ring.classList.add('due');
    ring.style.setProperty('--pct', '100%');
  } else {
    $('#now-phase').textContent = cur.tag;
    $('#now-cue').textContent = cur.cue;
    $('#now-sub').textContent = cur.sub;
    $('#clock-time').textContent = formatClock(rem, false);
    $('#clock-lbl').textContent = last ? 'TO SERVE' : ('TO ' + (next ? next.tag : 'SERVE'));
    ring.classList.remove('due');
    const pct = clamp((1 - rem / cur.sec) * 100, 0, 100);
    ring.style.setProperty('--pct', pct.toFixed(1) + '%');
  }

  // temp block
  const tb = $('#temp-block');
  if (it.hasTemp) {
    tb.classList.remove('hidden');
    const est = estTemp(it);
    $('#temp-est').textContent = est + '°';
    $('#temp-tgt').textContent = it.targetF + '°';
    const span = Math.max(1, it.scaleMax - it.scaleMin);
    const fillPct = clamp(((est - it.scaleMin) / span) * 100, 0, 100);
    const tickPct = clamp(((it.targetF - it.scaleMin) / span) * 100, 0, 100);
    $('#temp-fill').style.width = fillPct.toFixed(1) + '%';
    $('#temp-tick').style.left = tickPct.toFixed(1) + '%';
  } else {
    tb.classList.add('hidden');
  }

  renderHint($('#coach-hint'));
  renderRail();
  $('#advance-btn').textContent = status === 'serve' ? 'SERVE ✓' : 'DID IT ✓';
}

function renderRail() {
  const rail = $('#rail');
  const primary = primaryItem();
  rail.innerHTML = '';
  // show every OTHER live item (and completed ones dimmed)
  state.items.forEach((it) => {
    if (it === primary) return;
    const status = itemStatus(it);
    const row = document.createElement('div');
    row.className = 'rail-item' + (status === 'due' || status === 'serve' ? ' due' : '') + (it.done ? ' done' : '');
    const cur = it.steps[it.stepIndex];
    const next = it.steps[it.stepIndex + 1];
    let timeTxt, tagTxt;
    if (it.done) { timeTxt = 'DONE'; tagTxt = '✓'; }
    else if (status === 'serve') { timeTxt = 'SERVE'; tagTxt = 'REST'; }
    else if (status === 'due') { timeTxt = formatClock(remainingSec(it), true); tagTxt = next.tag; }
    else { timeTxt = formatClock(remainingSec(it), false); tagTxt = next ? next.tag : cur.tag; }
    row.innerHTML =
      `<span class="rg">${it.glyph}</span>` +
      `<span class="rname">${it.name}</span>` +
      `<span class="rtag">${tagTxt}</span>` +
      `<span class="rtime">${timeTxt}</span>`;
    rail.appendChild(row);
  });
  rail.style.display = rail.children.length ? '' : 'none';
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
  const t = now();
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
  if (phase.trigger.afterMin != null) return (now() - it.litAt) >= phase.trigger.afterMin * 60000;
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
    const remMs = next.trigger.afterMin * 60000 - (now() - it.litAt);
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
    if (now() >= it.restEndTs) { finishCook(); return; }
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
    const due = now() - it.lastSpritzAt >= it.spritzMs;
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
  f.push('tip'); f.push('end');
  return f;
}

function bumpMeat(d) {
  const it = pitItem(); if (!it || it.noProbe) return;
  it.meatF = clamp(it.meatF + d, 32, 250);
  it.history.push({ t: now(), f: it.meatF });
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
  it.lastSpritzAt = now(); it.spritzDue = false;
  toast('Spritz logged'); audio.tick();
  renderMonitor();
}
function confirmPull() {
  const it = pitItem(); if (!it) return;
  it.resting = true;
  it.restEndTs = now() + it.restSec * 1000;
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

  $('#mon-item').textContent = it.name;
  $('#mon-phase').textContent = it.resting ? 'REST' : phase.tag;

  if (it.resting) {
    $('#mon-cue').textContent = 'RESTING';
    $('#mon-sub').textContent = 'Keep it wrapped and let it relax.';
  } else {
    $('#mon-cue').textContent = phase.cue;
    $('#mon-sub').textContent = phase.sub;
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
    $('#mon-meat').textContent = it.meatF + '°';
    $('#mon-meat-tgt').textContent = it.targetF ? '→ ' + it.targetF + '°' : 'by feel';
  }
  $('#mon-pit').textContent = it.pitF + '°';
  $('#mon-pit-tgt').textContent = 'hold ' + it.pitTarget + '°';
  gPit.classList.toggle('pit-bad', it.pitBad);
  gMeat.classList.toggle('sel', selField === 'meat');
  gPit.classList.toggle('sel', selField === 'pit');

  // eta
  const etaEl = $('.eta');
  if (it.resting) {
    const rem = Math.max(0, (it.restEndTs - now()) / 1000);
    $('#mon-eta').textContent = formatClock(rem);
    $('#mon-eta-sub').textContent = 'until it’s ready to serve';
    etaEl.classList.remove('stall');
  } else {
    const e = pitEta(it);
    $('#mon-eta').textContent = e.v;
    $('#mon-eta-sub').textContent = e.sub + ' · ' + fmtElapsed(now() - it.litAt);
    etaEl.classList.toggle('stall', !!e.stall);
  }

  renderHint($('#mon-hint'));

  // control bar
  const bar = $('#mon-bar');
  const labels = { meat: 'MEAT', pit: 'PIT', pull: 'PULL ✓', spritz: 'SPRITZ ✓', tip: 'TIP', end: 'END' };
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
    case 'end':    quitCook(); break;
    // meat / pit are adjusted with ▲▼, Enter is a no-op on them
  }
}

/* per-frame refresh of clocks + due detection */
function tick() {
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
  // pull the due item into the big card so glancing up shows the right thing
  const live = liveItems();
  const idx = live.indexOf(it);
  if (idx >= 0) state.coachFocus = idx;

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
  TEMP_GUIDE.forEach(g => {
    const row = document.createElement('div');
    row.className = 'g-row';
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

/* ─────────── coach-specific D-pad (switch items) ─────────── */
function coachCycle(delta) {
  const live = liveItems();
  if (live.length <= 1) return;
  state.coachFocus = (state.coachFocus + delta + live.length) % live.length;
  renderCoach();
  audio.tick();
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
    const t = e.target.closest('[data-action]');
    if (!t) return;
    handleAction(t.dataset.action, t);
  });
  document.addEventListener('mouseover', (e) => {
    const f = e.target.closest('.focusable');
    if (f) focusEl(f);
  });

  document.addEventListener('keydown', (e) => {
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

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        state.screen === 'coach' ? coachCycle(-1) : moveFocus(-1);
        return;
      case 'ArrowDown':
        e.preventDefault();
        state.screen === 'coach' ? coachCycle(1) : moveFocus(1);
        return;
      case 'ArrowLeft':
        e.preventDefault();
        handleBack();
        return;
      case 'ArrowRight':
        e.preventDefault();
        if (state.screen === 'coach') coachTip();
        return;
      case 'Enter':
      case ' ': {
        e.preventDefault();
        if (state.screen === 'coach') { advanceItem(primaryItem()); return; }
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
    case 'fuel':   goMode(); break;
    case 'assist': goFuel(); break;
    case 'cooks':  goAssist(); break;
    case 'setup':  goCooks(); break;
    case 'fire':   state.selCook ? openSetup(state.selCook.id) : goCooks(); break;
    case 'done':   goCooks(); break;
    case 'guide':
    case 'help':   goReturn(); break;
    case 'coach':
    case 'monitor': quitCook(); break;
    // mode: nowhere further back
  }
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
    case 'pick-cook':     openSetup(el.dataset.id); break;
    case 'pick-doneness': pickDoneness(el.dataset.key); break;
    case 'add-item':      addItem(); break;
    case 'light-fire':    lightFire(); break;
    case 'fire-ready':    ignite(); break;
    case 'advance':       advanceItem(primaryItem()); break;
    case 'mon-field': {
      const it = pitItem(); if (!it) break;
      const fields = pitFields(it);
      const idx = fields.indexOf(el.dataset.field);
      if (idx >= 0) { it.sel = idx; renderMonitor(); }
      activatePitField(el.dataset.field);
      break;
    }
    case 'quit-cook':     quitCook(); break;
    case 'ack-cue':       ackCue(); break;
    case 'show-guide':    state.returnTo = state.screen; renderGuide(); showScreen('guide'); focusEl($('#guide .crumb')); break;
    case 'show-help':     state.returnTo = state.screen; showScreen('help'); focusEl($('#help .btn.primary')); break;
    case 'go-mode':       goMode(); break;
    case 'go-fuel':       goFuel(); break;
    case 'go-assist':     goAssist(); break;
    case 'go-cooks':      goCooks(); break;
    case 'go-setup':      state.selCook ? openSetup(state.selCook.id) : goCooks(); break;
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
      active: state.active,
      items: state.items, coachFocus: state.coachFocus, uidSeq,
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
    state.coachFocus = s.coachFocus || 0;
    state.active = true;
    uidSeq = s.uidSeq || (Math.max(...s.items.map(i => i.uid)) + 1);
    if (pitItem()) {
      if (pitItem().done) { clearSession(); return false; }
      showScreen('monitor');
      renderMonitor();
      return true;
    }
    // if everything already finished, don't resume
    if (liveItems().length === 0) { clearSession(); return false; }
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
  it.endTs = now() + remSec * 1000;
  return it;
}
function applyUrlState() {
  let key;
  try { key = new URLSearchParams(location.search).get('state'); } catch { return false; }
  if (!key) return false;

  switch (key) {
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
    case 'home-smoke':
      ensureContext('smoke'); goCooks(); return true;
    case 'home-bbq':
      ensureContext('bbq'); goCooks(); return true;

    /* ── setup ── */
    case 'setup':
      ensureContext('grill'); openSetup('ribeye'); return true;
    case 'setup-smoke':
      ensureContext('smoke'); openSetup('brisket'); return true;
    case 'setup-bbq':
      ensureContext('bbq'); openSetup('ribs'); return true;

    /* ── the fire primer ── */
    case 'fire':
      ensureContext('grill'); state.assist = assistById('rookie'); applyAssist();
      openSetup('ribeye'); renderFire(); showScreen('fire'); focusEl($('#fire-go')); return true;
    case 'fire-smoke':
      ensureContext('smoke'); state.assist = assistById('rookie'); applyAssist();
      openSetup('brisket'); renderFire(); showScreen('fire'); focusEl($('#fire-go')); return true;

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
      // multi-item grill mid-cook: ribeye due to FLIP, veg cooking, shrimp cooking
      ensureContext('grill');
      state.items = [
        seedItem('ribeye', 'mr', 0, -8),   // first side done, FLIP is due
        seedItem('veg', null, 1, 92),
        seedItem('shrimp', null, 0, 41),
      ];
      state.active = true; state.coachFocus = 0; state.seen = {};
      // mark the due one as already alerted so no overlay in the shot
      state.seen[state.items[0].uid] = 'due:0';
      showScreen('coach'); focusEl($('#advance-btn')); renderCoach();
      return true;
    }
    case 'coach-rookie': {
      // same cook, but with the FIRST TIME fuel reminder showing
      ensureContext('grill');
      state.assist = assistById('rookie'); applyAssist();
      state.items = [seedItem('ribeye', 'mr', 0, 64), seedItem('veg', null, 1, 121)];
      state.active = true; state.coachFocus = 0; state.seen = {};
      showScreen('coach'); focusEl($('#advance-btn')); renderCoach();
      return true;
    }
    case 'coach-pro': {
      ensureContext('grill');
      state.assist = assistById('pro'); applyAssist();
      state.items = [seedItem('ribeye', 'mr', 1, 47), seedItem('shrimp', null, 0, 88)];
      state.active = true; state.coachFocus = 0; state.seen = {};
      showScreen('coach'); focusEl($('#advance-btn')); renderCoach();
      return true;
    }
    case 'cue': {
      ensureContext('grill');
      state.items = [seedItem('ribeye', 'mr', 0, -3), seedItem('veg', null, 1, 70)];
      state.active = true; state.coachFocus = 0; state.seen = {};
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
      state.items = [makeItem(cookById('ribeye'), STEAK_DONENESS[1]), makeItem(cookById('veg'), null)];
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

  if (applyUrlState()) { startLoop(); return; }
  if (restoreSession()) { startLoop(); return; }

  // default: the first question
  goMode();
  startLoop();
}
function startLoop() {
  setInterval(tick, 200);
}

document.addEventListener('DOMContentLoaded', boot);
