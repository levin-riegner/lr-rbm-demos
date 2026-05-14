(function () {
  'use strict';

  // ---- State ----
  const state = {
    current: '0',     // string being entered
    previous: null,   // previous value (number)
    operator: null,   // '+', '-', '*', '/'
    justEvaluated: false,
    error: false,
    pendingClear: false
  };

  // ---- DOM ----
  const resultEl = document.getElementById('result');
  const exprEl   = document.getElementById('expression');
  const pad      = document.getElementById('pad');

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
    } else {
      resultEl.classList.remove('error');
      resultEl.textContent = state.current;
    }
    if (state.previous != null && state.operator && !state.justEvaluated) {
      const head = `${formatNumber(state.previous)} ${formatOpLabel(state.operator)}`;
      // After an operator, `current` still holds the first operand until digits are entered.
      exprEl.textContent = state.pendingClear ? head : `${head} ${state.current}`;
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
    return Array.from(pad.querySelectorAll('[data-focusable]'));
  }

  function keyAt(row, col) {
    // Handle wide "0" that occupies col 0 and col 1 in row 4.
    const keys = getKeys();
    let target = keys.find(k => +k.dataset.row === row && +k.dataset.col === col);
    if (target) return target;
    if (row === 4 && col === 1) {
      return keys.find(k => +k.dataset.row === 4 && +k.dataset.col === 0) || null;
    }
    return null;
  }

  function focusedKey() {
    return document.activeElement && document.activeElement.matches('[data-key]')
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
    for (let i = 0; i < 6; i++) {
      r += dr; c += dc;
      if (r < 0) r = 4;
      if (r > 4) r = 0;
      if (c < 0) c = 3;
      if (c > 3) c = 0;
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

  // ---- Init ----
  renderDisplay();
  // Auto-focus the primary action so D-pad works immediately
  (findByKey('=') || getKeys()[0])?.focus();
})();
