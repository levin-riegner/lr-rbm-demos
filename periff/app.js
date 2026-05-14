/* ═══════════════════════════════════════════════════════════
   PERIFF · Speech-to-text idea capture for Meta Ray-Ban Display
   ═══════════════════════════════════════════════════════════ */

const STORAGE_KEY = 'periff.riffs.v1';
const WT_SEEN_KEY = 'periff.walkthrough.seen';

const state = {
  riffs: loadRiffs(),
  walkthroughStep: 0,
  recording: false,
  finalText: '',
  interimText: '',
  recStartTs: 0,
  recTimerId: null,
  vizTimerId: null,
  currentRiffId: null,
  recognition: null,
  recognitionSupported: false,
  pendingConfirm: null,
  focusedEl: null,
};

/* ─────────── Storage ─────────── */
function loadRiffs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedRiffs();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : seedRiffs();
  } catch {
    return seedRiffs();
  }
}
function saveRiffs() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.riffs)); } catch {}
}
function seedRiffs() {
  const now = Date.now();
  return [
    {
      id: 'r-' + (now - 86400000),
      ts: now - 86400000,
      text: "App idea: a calendar that quietly hides events you keep snoozing — surfaces them only when free time appears nearby. Less guilt, more flow."
    },
    {
      id: 'r-' + (now - 3600000),
      ts: now - 3600000,
      text: "Walking through Soho — every shopfront uses the same off-white. The block reads as one continuous gallery. Steal that for the studio site."
    }
  ];
}

/* ─────────── Speech Recognition ─────────── */
function initRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    state.recognitionSupported = false;
    return;
  }
  state.recognitionSupported = true;
  const rec = new SR();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = 'en-US';

  rec.onresult = (e) => {
    let interim = '';
    let finalAdd = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) finalAdd += r[0].transcript;
      else interim += r[0].transcript;
    }
    if (finalAdd) {
      state.finalText += (state.finalText ? ' ' : '') + finalAdd.trim();
    }
    state.interimText = interim;
    renderTranscript();
  };

  rec.onerror = (e) => {
    if (e.error === 'no-speech' || e.error === 'aborted') return;
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      stopRecording();
      setRecState('MIC PERMISSION DENIED');
      toast('MIC ACCESS DENIED');
    }
  };

  rec.onend = () => {
    if (state.recording) {
      try { rec.start(); } catch {}
    }
  };

  state.recognition = rec;
}

function startRecording() {
  state.finalText = '';
  state.interimText = '';
  state.recording = true;
  state.recStartTs = Date.now();
  $('#mic-btn').classList.add('recording');
  $('#record').classList.add('recording');
  $('#save-btn').disabled = true;
  setRecState('LISTENING…');
  renderTranscript();
  startTimer();
  startVisualizer();

  if (state.recognitionSupported) {
    try { state.recognition.start(); } catch {}
  } else {
    setRecState('SPEECH NOT SUPPORTED · TYPING ENABLED');
    enableTypingFallback();
  }
}

function stopRecording() {
  state.recording = false;
  $('#mic-btn').classList.remove('recording');
  $('#record').classList.remove('recording');
  stopTimer();
  stopVisualizer();
  if (state.recognitionSupported) {
    try { state.recognition.stop(); } catch {}
  }
  state.interimText = '';
  if (state.finalText.trim()) {
    setRecState('READY TO SAVE');
    $('#save-btn').disabled = false;
    setFocus($('#save-btn'));
  } else {
    setRecState('TAP MIC TO START');
  }
  renderTranscript();
}

function enableTypingFallback() {
  const t = $('#rec-transcript');
  t.contentEditable = 'true';
  t.focus();
  t.addEventListener('input', () => {
    state.finalText = t.innerText.trim();
    $('#save-btn').disabled = !state.finalText;
  });
}

/* ─────────── Timer ─────────── */
function startTimer() {
  stopTimer();
  state.recTimerId = setInterval(() => {
    const sec = Math.floor((Date.now() - state.recStartTs) / 1000);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    $('#rec-timer').textContent = `${m}:${String(s).padStart(2, '0')}`;
  }, 250);
}
function stopTimer() {
  if (state.recTimerId) clearInterval(state.recTimerId);
  state.recTimerId = null;
}

/* ─────────── Visualizer ─────────── */
function buildVisualizerBars() {
  const wrap = $('#viz-bars');
  if (!wrap) return;
  wrap.innerHTML = '';
  for (let i = 0; i < 18; i++) {
    const b = document.createElement('div');
    b.className = 'bar';
    wrap.appendChild(b);
  }
}
function startVisualizer() {
  const bars = $$('#viz-bars .bar');
  stopVisualizer();
  state.vizTimerId = setInterval(() => {
    bars.forEach((b, i) => {
      const base = state.recording ? 8 : 4;
      const swing = state.recording ? Math.random() * 50 : 0;
      const mid = 1 - Math.abs(i - bars.length / 2) / (bars.length / 2);
      b.style.height = (base + swing * (0.4 + mid * 0.7)) + 'px';
    });
  }, 90);
}
function stopVisualizer() {
  if (state.vizTimerId) clearInterval(state.vizTimerId);
  state.vizTimerId = null;
  $$('#viz-bars .bar').forEach(b => b.style.height = '6px');
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

  const nextBtn = $('[data-action="wt-next"]');
  nextBtn.textContent = state.walkthroughStep === steps.length - 1 ? 'GET STARTED' : 'NEXT →';
  setFocus(nextBtn);
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
  showScreen('home');
  renderHome();
}

/* ─────────── Navigation ─────────── */
function showScreen(id) {
  $$('.screen').forEach(s => s.classList.add('hidden'));
  const target = document.getElementById(id);
  if (target) target.classList.remove('hidden');
  // schedule auto-focus after layout
  requestAnimationFrame(() => autoFocus());
}

/* ─────────── Home ─────────── */
function renderHome() {
  const n = state.riffs.length;
  $('#home-count').textContent = String(n).padStart(2, '0');
  $('#home-last').textContent = n ? relTime(state.riffs[0].ts) : '—';
  const sub = $('#bb-list-sub');
  if (sub) sub.textContent = n ? `${n} SAVED` : 'NONE YET';
}

/* ─────────── Record ─────────── */
function setRecState(t) { $('#rec-state').textContent = t; }

function renderTranscript() {
  const el = $('#rec-transcript');
  if (!state.finalText && !state.interimText) {
    el.innerHTML = '<span class="rec-placeholder">Your idea will appear<br>here as you speak…</span>';
    return;
  }
  const finalSpan  = state.finalText
    ? `<span class="final">${escapeHTML(state.finalText)}</span>`
    : '';
  const interimSpan = state.interimText
    ? ` <span class="interim">${escapeHTML(state.interimText)}</span>`
    : '';
  el.innerHTML = finalSpan + interimSpan;
  el.scrollTop = el.scrollHeight;
}

function openRecord() {
  state.finalText = '';
  state.interimText = '';
  $('#mic-btn').classList.remove('recording');
  $('#save-btn').disabled = true;
  $('#rec-timer').textContent = '0:00';
  setRecState(state.recognitionSupported ? 'TAP MIC TO START' : 'SPEECH UNAVAILABLE · TAP TO TYPE');
  renderTranscript();
  showScreen('record');
  const t = $('#rec-transcript');
  t.contentEditable = 'false';
  // override autofocus to land on the mic button
  requestAnimationFrame(() => setFocus($('#mic-btn')));
}

function saveRiff() {
  const text = state.finalText.trim();
  if (!text) return;
  const id = 'r-' + Date.now();
  state.riffs.unshift({ id, ts: Date.now(), text });
  saveRiffs();
  toast('RIFF SAVED');
  goHome();
}

function cancelRecord() {
  if (state.recording) stopRecording();
  if (state.finalText.trim().length > 8) {
    askConfirm('DISCARD?', 'Your unsaved Riff will be lost.', () => goHome());
  } else {
    goHome();
  }
}

function goHome() {
  if (state.recording) stopRecording();
  showScreen('home');
  renderHome();
}

/* ─────────── List ─────────── */
function openList() {
  renderList();
  showScreen('list');
}
function renderList() {
  const wrap = $('#riff-list');
  const empty = $('#empty-state');
  const count = $('#list-count');

  count.textContent = String(state.riffs.length).padStart(2, '0');

  if (!state.riffs.length) {
    wrap.innerHTML = '';
    wrap.classList.add('hidden');
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  wrap.classList.remove('hidden');

  wrap.innerHTML = state.riffs.map(r => `
    <button class="riff-item focusable" data-id="${r.id}">
      <div class="ri-meta">
        <span>${escapeHTML(formatDate(r.ts))}</span>
        <span>${escapeHTML(relTime(r.ts))}</span>
      </div>
      <div class="ri-title">${escapeHTML(titleFromText(r.text))}</div>
    </button>
  `).join('');

  wrap.querySelectorAll('.riff-item').forEach(el => {
    el.addEventListener('click', () => openDetail(el.dataset.id));
  });
}

/* ─────────── Detail ─────────── */
function openDetail(id) {
  const r = state.riffs.find(x => x.id === id);
  if (!r) return;
  state.currentRiffId = id;
  $('#detail-title').textContent = titleFromText(r.text);
  $('#detail-body').textContent  = r.text;
  $('#detail-date').textContent  = formatFullDate(r.ts);
  $('#detail-time').textContent  = relTime(r.ts);
  showScreen('detail');
}
function deleteCurrentRiff() {
  if (!state.currentRiffId) return;
  askConfirm('DELETE RIFF?', 'This Riff will be permanently removed.', () => {
    state.riffs = state.riffs.filter(r => r.id !== state.currentRiffId);
    saveRiffs();
    state.currentRiffId = null;
    toast('RIFF DELETED');
    openList();
  });
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

/* ─────────── D-pad / arrow-key navigation ─────────── */
function getActiveFocusables() {
  // Confirm overlay takes priority if visible
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
    if (typeof best.scrollIntoView === 'function') {
      try { best.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch {}
    }
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
function titleFromText(t) {
  const trimmed = t.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= 70) return trimmed;
  return trimmed.slice(0, 68).replace(/\s+\S*$/, '') + '…';
}
function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
}
function formatFullDate(ts) {
  const d = new Date(ts);
  const date = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return (date + ' · ' + time).toUpperCase();
}
function relTime(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'JUST NOW';
  if (m < 60) return m + 'M AGO';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'H AGO';
  const d = Math.floor(h / 24);
  if (d < 7)  return d + 'D AGO';
  return formatDate(ts);
}

/* ─────────── Wiring ─────────── */
function bindEvents() {
  document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    handleAction(target.dataset.action);
  });

  // mouse hover updates focus too
  document.addEventListener('mouseover', (e) => {
    const f = e.target.closest('.focusable');
    if (f && !f.disabled) setFocus(f);
  });

  document.addEventListener('keydown', (e) => {
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
        if (!$('#confirm').classList.contains('hidden')) closeConfirm(false);
        else if (!$('#record').classList.contains('hidden')) cancelRecord();
        else if (!$('#detail').classList.contains('hidden')) openList();
        else if (!$('#list').classList.contains('hidden')) goHome();
        return;
    }
  });
}

function handleAction(a) {
  switch (a) {
    case 'wt-next':           advanceWalkthrough(); break;
    case 'wt-skip':           finishWalkthrough(); break;
    case 'go-record':         openRecord(); break;
    case 'go-list':           openList(); break;
    case 'go-home':           goHome(); break;
    case 'mic-toggle':
      if (state.recording) stopRecording();
      else startRecording();
      break;
    case 'record-save':       saveRiff(); break;
    case 'record-cancel':     cancelRecord(); break;
    case 'delete-riff':       deleteCurrentRiff(); break;
    case 'show-walkthrough':  showWalkthrough(); break;
    case 'confirm-yes':       closeConfirm(true); break;
    case 'confirm-no':        closeConfirm(false); break;
  }
}

/* ─────────── Boot ─────────── */
function boot() {
  initRecognition();
  buildVisualizerBars();
  bindEvents();
  const seen = (() => { try { return localStorage.getItem(WT_SEEN_KEY) === '1'; } catch { return false; } })();
  if (seen) {
    // user has seen walkthrough — switch to home
    showScreen('home');
    renderHome();
  } else {
    // walkthrough is already the visible screen by HTML default — just init it
    state.walkthroughStep = 0;
    renderWalkthroughStep();
  }
}
boot();
