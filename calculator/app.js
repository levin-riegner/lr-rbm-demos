(function () {
  'use strict';

  // ---- State ----
  const state = {
    current: '0',     // string being entered
    previous: null,   // previous value (number)
    operator: null,   // '+', '-', '*', '/'
    justEvaluated: false,
    error: false,
    pendingClear: false,
    userTouched: false  // true once user has pressed any input key this session
  };

  // ---- DOM ----
  const resultEl = document.getElementById('result');
  const exprEl   = document.getElementById('expression');
  const pad      = document.getElementById('pad');
  const themeTag = document.getElementById('theme-tag');

  // ---- Themes ----
  const THEMES = [
    { id: 'braun', clock: false },
    { id: 'casio', clock: true  },
    { id: 'ti83',  clock: false },
  ];
  let themeIndex = 0;
  try {
    const saved = localStorage.getItem('calc-theme');
    const idx = THEMES.findIndex(t => t.id === saved);
    if (idx >= 0) themeIndex = idx;
  } catch (_) {}

  function applyTheme() {
    const t = THEMES[themeIndex];
    document.body.dataset.theme = t.id;
    try { localStorage.setItem('calc-theme', t.id); } catch (_) {}
    renderDisplay();
  }

  function cycleTheme() {
    themeIndex = (themeIndex + 1) % THEMES.length;
    applyTheme();
  }

  // ---- Casio clock ----
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function currentTimeStr() {
    const d = new Date();
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
  }
  function currentDateStr() {
    const d = new Date();
    const days = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
    return days[d.getDay()] + ' ' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function isIdle() {
    return !state.error
      && state.current === '0'
      && state.previous === null
      && state.operator === null
      && !state.justEvaluated
      && !state.userTouched;
  }
  function showingClock() {
    return THEMES[themeIndex].clock && isIdle();
  }
  let clockTimer = null;
  function ensureClockTimer() {
    if (clockTimer) return;
    clockTimer = setInterval(() => {
      if (showingClock()) renderDisplay();
    }, 1000);
  }

  // ---- Audio (Braun-style synthesized clicks) ----
  let audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return;
      try { audioCtx = new Ctor(); } catch (_) { return; }
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
  }

  function tone(freq, dur, vol, when, type) {
    const ctx = audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, when);
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(vol, when + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.start(when);
    osc.stop(when + dur + 0.02);
  }

  function click(kind) {
    ensureAudio();
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    switch (kind) {
      case 'digit':
        tone(1100, 0.05, 0.07, t, 'sine');
        tone(2400, 0.02, 0.025, t, 'square');
        break;
      case 'op':
        tone(720,  0.06, 0.08, t, 'sine');
        break;
      case 'fn':
        tone(560,  0.05, 0.07, t, 'triangle');
        break;
      case 'clear':
        tone(260,  0.10, 0.10, t, 'sine');
        break;
      case 'eq':
        tone(880,  0.09, 0.09, t,          'sine');
        tone(1318, 0.11, 0.09, t + 0.055,  'sine');
        break;
    }
  }

  function soundFor(key) {
    if (key === '=') return 'eq';
    if (key === 'ac') return 'clear';
    if (key === 'sign' || key === 'percent') return 'fn';
    if (key === '+' || key === '-' || key === '*' || key === '/') return 'op';
    return 'digit';
  }

  // ---- Formatting ----
  function formatNumber(n) {
    if (!isFinite(n)) return 'ERR';
    // Strip trailing zeros, keep up to 10 significant digits.
    const abs = Math.abs(n);
    let out;
    if (abs !== 0 && (abs < 1e-6 || abs >= 1e12)) {
      out = n.toExponential(6).replace(/\.?0+e/, 'e');
    } else {
      out = parseFloat(n.toPrecision(12)).toString();
    }
    return out;
  }

  function formatOpLabel(op) {
    if (op === '*') return '×';
    if (op === '/') return '÷';
    if (op === '-') return '−';
    return op || '';
  }

  function renderDisplay() {
    if (state.error) {
      resultEl.classList.add('error');
      resultEl.textContent = 'ERR';
    } else if (showingClock()) {
      resultEl.classList.remove('error');
      resultEl.textContent = currentTimeStr();
    } else {
      resultEl.classList.remove('error');
      resultEl.textContent = state.current;
    }
    if (state.previous != null && state.operator && !state.justEvaluated) {
      const head = `${formatNumber(state.previous)} ${formatOpLabel(state.operator)}`;
      // After an operator, `current` still holds the first operand until digits are entered.
      exprEl.textContent = state.pendingClear ? head : `${head} ${state.current}`;
    } else if (showingClock()) {
      exprEl.textContent = currentDateStr();
    } else {
      exprEl.textContent = '—';
    }
  }

  // ---- Core ops ----
  function compute(a, op, b) {
    switch (op) {
      case '+': return a + b;
      case '-': return a - b;
      case '*': return a * b;
      case '/': return b === 0 ? NaN : a / b;
    }
    return b;
  }

  function inputDigit(d) {
    if (state.error) reset();
    if (state.justEvaluated) {
      state.current = d;
      state.previous = null;
      state.operator = null;
      state.justEvaluated = false;
      return;
    }
    if (state.current === '0') state.current = d;
    else if (state.current.length < 12) state.current += d;
  }

  function inputDot() {
    if (state.error) reset();
    if (state.justEvaluated) {
      state.current = '0.';
      state.previous = null;
      state.operator = null;
      state.justEvaluated = false;
      return;
    }
    if (!state.current.includes('.')) state.current += '.';
  }

  function setOperator(op) {
    if (state.error) return;
    // If the previous keypress was an operator (no second operand entered yet),
    // just swap to the new operator instead of recomputing with the same value.
    if (state.pendingClear) {
      state.operator = op;
      return;
    }
    const currentNum = parseFloat(state.current);
    if (state.operator && state.previous != null && !state.justEvaluated) {
      const result = compute(state.previous, state.operator, currentNum);
      if (!isFinite(result)) { state.error = true; return; }
      state.previous = result;
      state.current = formatNumber(result);
    } else {
      state.previous = currentNum;
    }
    state.operator = op;
    state.justEvaluated = false;
    // Start fresh entry on next digit
    state.pendingClear = true;
  }

  function evaluate() {
    if (state.error) return;
    if (state.operator == null || state.previous == null) return;
    const currentNum = parseFloat(state.current);
    const result = compute(state.previous, state.operator, currentNum);
    if (!isFinite(result)) { state.error = true; return; }
    state.current = formatNumber(result);
    state.previous = null;
    state.operator = null;
    state.justEvaluated = true;
  }

  function toggleSign() {
    if (state.error) return;
    if (state.current === '0') return;
    state.current = state.current.startsWith('-')
      ? state.current.slice(1)
      : '-' + state.current;
  }

  function percent() {
    if (state.error) return;
    const n = parseFloat(state.current) / 100;
    state.current = formatNumber(n);
  }

  function reset() {
    state.current = '0';
    state.previous = null;
    state.operator = null;
    state.justEvaluated = false;
    state.error = false;
    state.pendingClear = false;
    state.userTouched = false;
  }

  // Entry continuation after operator
  function consumePendingClear() {
    if (state.pendingClear) {
      state.current = '0';
      state.pendingClear = false;
    }
  }

  // ---- Dispatch ----
  function press(key) {
    click(soundFor(key));
    if (key !== 'ac' && key !== 'theme') state.userTouched = true;
    if (/^[0-9]$/.test(key)) {
      consumePendingClear();
      inputDigit(key);
    } else if (key === '.') {
      consumePendingClear();
      inputDot();
    } else if (key === '+' || key === '-' || key === '*' || key === '/') {
      setOperator(key);
    } else if (key === '=') {
      evaluate();
    } else if (key === 'ac') {
      reset();
    } else if (key === 'sign') {
      toggleSign();
    } else if (key === 'percent') {
      percent();
    } else if (key === 'theme') {
      cycleTheme();
      return;
    }
    renderDisplay();
  }

  // ---- Pulse animation on press ----
  function pulse(btn) {
    if (!btn) return;
    btn.classList.add('pressed');
    setTimeout(() => btn.classList.remove('pressed'), 90);
  }

  // ---- Click ----
  pad.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-key]');
    if (!btn) return;
    pulse(btn);
    press(btn.dataset.key);
  });

  // ---- 2D D-pad navigation over a sparse 5x4 grid ----
  function getKeys() {
    return Array.from(document.querySelectorAll('[data-focusable]'));
  }

  function keyAt(row, col) {
    // Theme tag occupies row -1 and spans the full top — match any col.
    if (row === -1) return themeTag;
    const keys = getKeys();
    let target = keys.find(k => +k.dataset.row === row && +k.dataset.col === col);
    if (target) return target;
    // Wide "0" occupies col 0 and col 1 in row 4.
    if (row === 4 && col === 1) {
      return keys.find(k => +k.dataset.row === 4 && +k.dataset.col === 0) || null;
    }
    return null;
  }

  function focusedKey() {
    return document.activeElement && document.activeElement.matches('[data-focusable]')
      ? document.activeElement : null;
  }

  function moveFocus(dr, dc) {
    let btn = focusedKey();
    if (!btn) {
      const first = getKeys()[0];
      if (first) first.focus();
      return;
    }
    let r = +btn.dataset.row;
    let c = +btn.dataset.col;
    // Search step-by-step so we can skip empty grid cells (row 4 col 1).
    for (let i = 0; i < 7; i++) {
      r += dr; c += dc;
      if (r < -1) r = 4;
      if (r > 4)  r = -1;
      if (c < 0)  c = 3;
      if (c > 3)  c = 0;
      const next = keyAt(r, c);
      if (next && next !== btn) { next.focus(); return; }
    }
  }

  document.addEventListener('keydown', (e) => {
    // Physical keyboard shortcuts (for desktop testing) + D-pad focus nav
    const k = e.key;

    if (k === 'ArrowUp')    { e.preventDefault(); moveFocus(-1, 0); return; }
    if (k === 'ArrowDown')  { e.preventDefault(); moveFocus( 1, 0); return; }
    if (k === 'ArrowLeft')  { e.preventDefault(); moveFocus( 0,-1); return; }
    if (k === 'ArrowRight') { e.preventDefault(); moveFocus( 0, 1); return; }

    if (k === 'Enter' || k === ' ') {
      const btn = focusedKey();
      if (btn) { e.preventDefault(); pulse(btn); press(btn.dataset.key); }
      return;
    }

    // Direct keyboard input for desktop convenience
    if (/^[0-9]$/.test(k)) { press(k); pulse(findByKey(k)); return; }
    if (k === '.') { press('.'); pulse(findByKey('.')); return; }
    if (k === '+' || k === '-' || k === '*' || k === '/') { press(k); pulse(findByKey(k)); return; }
    if (k === '=') { press('='); pulse(findByKey('=')); return; }
    if (k === 'Backspace' || k === 'Escape') { press('ac'); pulse(findByKey('ac')); return; }
    if (k === '%') { press('percent'); pulse(findByKey('percent')); return; }
  });

  function findByKey(key) {
    return pad.querySelector(`[data-key="${CSS.escape(key)}"]`);
  }

  // ---- Theme tag click ----
  themeTag.addEventListener('click', (e) => {
    e.preventDefault();
    pulse(themeTag);
    press('theme');
  });
  themeTag.addEventListener('focus', () => themeTag.classList.add('is-focused'));
  themeTag.addEventListener('blur',  () => themeTag.classList.remove('is-focused'));

  // ---- Init ----
  applyTheme();
  ensureClockTimer();
  renderDisplay();
  // Auto-focus the primary action so D-pad works immediately
  (findByKey('=') || getKeys()[0])?.focus();
})();
