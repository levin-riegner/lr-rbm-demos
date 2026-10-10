(function () {
  'use strict';

  var CONFIG = {
    storageKey: 'mdg_tally_v1',
    countMin:   0,
    countMax:   9999,
  };

  var state = {
    count: 0,
    sinceTs: null,    // ms epoch when last reset (or first count)
    audioCtx: null,
    masterGain: null,
    confirmOpen: false,
    lastFocus: null,
    sinceTimer: null, // 30 s "since" refresh; stopped while the page is hidden
  };

  // ===========================================================
  //  AUDIO ENGINE — light mechanical click on +1 / -1, soft chime on reset
  // ===========================================================
  function initAudio() {
    if (state.audioCtx) return;
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    state.audioCtx = new Ctx();
    state.masterGain = state.audioCtx.createGain();
    state.masterGain.gain.setValueAtTime(0.55, state.audioCtx.currentTime);
    state.masterGain.connect(state.audioCtx.destination);
  }

  function resumeAudio() {
    if (!state.audioCtx) return;
    if (state.audioCtx.state === 'suspended') state.audioCtx.resume();
  }

  // Builds a short damped click: a sharp transient (white noise burst) +
  // a tonal body that decays quickly. Subtle, mechanical-feeling.
  function playClick(opts) {
    initAudio();
    if (!state.audioCtx) return;
    resumeAudio();

    opts = opts || {};
    var ctx       = state.audioCtx;
    var freq      = opts.freq      || 1180;  // tonal body freq
    var dur       = opts.dur       || 0.038; // total length
    var noiseAmt  = opts.noise     || 0.35;  // noise transient peak
    var toneAmt   = opts.tone      || 0.28;  // tone peak
    var decay     = opts.decay     || 0.014; // exponential decay constant

    var sr     = ctx.sampleRate;
    var bufLen = Math.ceil(dur * sr);
    var buf    = ctx.createBuffer(1, bufLen, sr);
    var d      = buf.getChannelData(0);

    for (var i = 0; i < bufLen; i++) {
      var t   = i / sr;
      var env = Math.exp(-t / decay);
      // sharp noise transient at the very start (~3 ms)
      var transientEnv = Math.exp(-t / 0.003);
      var noise = (Math.random() * 2 - 1) * noiseAmt * transientEnv;
      // tonal body — slight pitch drop for "tick" character
      var f = freq * (1 - t * 4);
      if (f < 200) f = 200;
      var tone = Math.sin(2 * Math.PI * f * t) * toneAmt * env;
      d[i] = noise + tone;
    }

    var src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(state.masterGain);
    src.start();
  }

  function playUpClick()    { playClick({ freq: 1180, tone: 0.30, noise: 0.32 }); }
  function playDownClick()  { playClick({ freq:  720, tone: 0.26, noise: 0.22, decay: 0.012 }); }

  function playResetChime() {
    initAudio();
    if (!state.audioCtx) return;
    resumeAudio();
    var ctx = state.audioCtx;
    var now = ctx.currentTime;
    // two-tone descending ping
    [880, 587].forEach(function (f, i) {
      var osc = ctx.createOscillator();
      var g   = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now + i * 0.06);
      g.gain.setValueAtTime(0, now + i * 0.06);
      g.gain.linearRampToValueAtTime(0.18, now + i * 0.06 + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0005, now + i * 0.06 + 0.18);
      osc.connect(g);
      g.connect(state.masterGain);
      osc.start(now + i * 0.06);
      osc.stop(now + i * 0.06 + 0.2);
    });
  }

  // ===========================================================
  //  STATE MUTATIONS
  // ===========================================================
  // Single mutation path shared by the D-pad (±1) and voice (any amount).
  function add(n) {
    n = n | 0;
    if (n === 0) return;
    if (n > 0) {
      if (state.count >= CONFIG.countMax) {
        flashWrap();
        return;
      }
      state.count = Math.min(CONFIG.countMax, state.count + n);
      var firstSince = !state.sinceTs;
      if (firstSince) state.sinceTs = Date.now();
      playUpClick();
      renderDigits(true, false);
      if (firstSince) renderSince();
      saveData();
      flashBump();
    } else {
      if (state.count <= CONFIG.countMin) return;
      state.count = Math.max(CONFIG.countMin, state.count + n);
      playDownClick();
      renderDigits(false, true);
      saveData();
    }
  }

  function inc() { add(1); }
  function dec() { add(-1); }

  function reset() {
    state.count = 0;
    state.sinceTs = null;
    playResetChime();
    renderDigits(false, false);
    renderSince();
    saveData();
  }

  // ===========================================================
  //  RENDER
  // ===========================================================
  function pad(n) {
    var s = String(Math.max(0, Math.min(9999, n)));
    while (s.length < 4) s = '0' + s;
    return s;
  }

  function renderDigits(tickUp, tickDown) {
    var el = document.getElementById('digits');
    if (!el) return;
    el.textContent = pad(state.count);
    el.classList.remove('tick', 'tick-down');
    // force reflow so animation retriggers
    void el.offsetWidth;
    if (tickUp)   el.classList.add('tick');
    if (tickDown) el.classList.add('tick-down');
  }

  function renderSince() {
    var el = document.getElementById('sinceTime');
    if (!el) return;
    if (!state.sinceTs) { el.textContent = '—'; return; }
    var d = new Date(state.sinceTs);
    var hh = String(d.getHours()).padStart(2, '0');
    var mm = String(d.getMinutes()).padStart(2, '0');
    el.textContent = hh + ':' + mm;
  }

  function flashBump() {
    var btn = document.getElementById('bumpBtn');
    if (!btn) return;
    btn.classList.remove('flash', 'pressed');
    void btn.offsetWidth;
    btn.classList.add('flash', 'pressed');
    setTimeout(function () {
      btn.classList.remove('pressed');
    }, 90);
    setTimeout(function () {
      btn.classList.remove('flash');
    }, 240);
  }

  function flashWrap() {
    var el = document.getElementById('digits');
    if (!el) return;
    el.animate(
      [
        { color: '#ff4848', textShadow: '0 0 10px rgba(255,72,72,0.7), 0 0 22px rgba(255,72,72,0.5)' },
        { color: 'var(--amber)' },
      ],
      { duration: 280, easing: 'ease-out' }
    );
  }

  // ===========================================================
  //  RESET CONFIRMATION OVERLAY
  // ===========================================================
  function openConfirm() {
    state.confirmOpen = true;
    state.lastFocus = document.activeElement;
    var n = document.getElementById('confirmNum');
    if (n) n.textContent = pad(state.count);
    var ov = document.getElementById('confirm');
    if (ov) ov.classList.remove('hidden');
    // focus cancel by default (less destructive)
    setTimeout(function () {
      var cancel = document.querySelector('[data-action="reset-cancel"]');
      if (cancel) cancel.focus();
    }, 30);
  }
  function closeConfirm() {
    state.confirmOpen = false;
    var ov = document.getElementById('confirm');
    if (ov) ov.classList.add('hidden');
    if (state.lastFocus && state.lastFocus.focus) state.lastFocus.focus();
  }

  // ===========================================================
  //  PERSISTENCE
  // ===========================================================
  function loadData() {
    try {
      var raw = localStorage.getItem(CONFIG.storageKey);
      if (!raw) return;
      var d = JSON.parse(raw);
      if (typeof d.count === 'number') state.count = Math.max(0, Math.min(9999, d.count|0));
      if (typeof d.sinceTs === 'number') state.sinceTs = d.sinceTs;
    } catch (e) { /* ignore */ }
  }
  function saveData() {
    try {
      localStorage.setItem(CONFIG.storageKey, JSON.stringify({
        count: state.count,
        sinceTs: state.sinceTs,
      }));
    } catch (e) { /* ignore */ }
  }

  // ===========================================================
  //  ACTION DISPATCH
  // ===========================================================
  function handleAction(action) {
    switch (action) {
      case 'inc':            inc();         break;
      case 'dec':            dec();         break;
      case 'reset':          openConfirm(); break;
      case 'reset-confirm':  closeConfirm(); reset(); break;
      case 'reset-cancel':   closeConfirm(); break;
    }
  }

  // ===========================================================
  //  D-PAD FOCUS NAV
  // ===========================================================
  function focusables() {
    var scope = state.confirmOpen
      ? document.getElementById('confirm')
      : document.getElementById('counter');
    if (!scope) return [];
    return Array.from(scope.querySelectorAll('.focusable:not([disabled])'));
  }
  function moveFocus(dir) {
    var els = focusables();
    if (!els.length) return;
    var idx = els.indexOf(document.activeElement);
    if (idx === -1) { els[0].focus(); return; }
    var next;
    if (dir === 'up' || dir === 'left')   next = idx > 0 ? idx - 1 : els.length - 1;
    else                                  next = idx < els.length - 1 ? idx + 1 : 0;
    els[next].focus();
  }

  // ===========================================================
  //  EVENT WIRING
  // ===========================================================
  function setupEvents() {
    document.addEventListener('click', function (e) {
      var el = e.target.closest('[data-action]');
      if (!el) return;
      // first interaction also unlocks audio in browsers w/ autoplay policies
      initAudio();
      resumeAudio();
      handleAction(el.dataset.action);
    });

    document.addEventListener('keydown', function (e) {
      if (state.confirmOpen) {
        switch (e.key) {
          case 'ArrowLeft':
          case 'ArrowRight':
          case 'ArrowUp':
          case 'ArrowDown':
            moveFocus(e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? 'left' : 'right');
            e.preventDefault();
            break;
          case 'Enter':
          case ' ':
            if (document.activeElement && document.activeElement.classList.contains('focusable')) {
              document.activeElement.click();
            }
            e.preventDefault();
            break;
          case 'Escape':
            closeConfirm();
            e.preventDefault();
            break;
        }
        return;
      }

      switch (e.key) {
        case 'ArrowRight':
        case '+':
          inc();
          e.preventDefault();
          break;
        case 'ArrowLeft':
        case '-':
          dec();
          e.preventDefault();
          break;
        case 'ArrowUp':
          moveFocus('up');
          e.preventDefault();
          break;
        case 'ArrowDown':
          moveFocus('down');
          e.preventDefault();
          break;
        case 'Enter':
        case ' ':
          if (document.activeElement && document.activeElement.classList.contains('focusable')) {
            document.activeElement.click();
          } else {
            inc();
          }
          e.preventDefault();
          break;
        case 'r':
        case 'R':
          openConfirm();
          e.preventDefault();
          break;
      }
    });
  }

  // ===========================================================
  //  URL STATE — for screenshot/demo overrides (e.g. ?state=counted)
  //  Recognized states: idle | counted | confirm
  // ===========================================================
  function applyUrlState() {
    var p = new URLSearchParams(location.search);
    var s = p.get('state');
    if (!s) return false;
    if (s === 'counted') {
      state.count = 137;
      state.sinceTs = Date.now() - 23 * 60 * 1000;
      renderDigits(false, false);
      renderSince();
      return true;
    }
    if (s === 'confirm') {
      state.count = 42;
      state.sinceTs = Date.now() - 14 * 60 * 1000;
      renderDigits(false, false);
      renderSince();
      openConfirm();
      return true;
    }
    // 'idle' (or any other) — leave defaults
    return true;
  }

  // ===========================================================
  //  LIFECYCLE — the only recurring work is the 30 s "since" refresh.
  //  Stop it while the page is hidden; re-render + restart on return.
  // ===========================================================
  function startSinceTimer() {
    if (state.sinceTimer) return;
    state.sinceTimer = setInterval(renderSince, 30000);
  }
  function stopSinceTimer() {
    if (!state.sinceTimer) return;
    clearInterval(state.sinceTimer);
    state.sinceTimer = null;
  }
  function pauseForHidden() {
    stopSinceTimer();
  }
  function resumeFromHidden() {
    renderSince();
    startSinceTimer();
  }

  // ===========================================================
  //  WebMCP (Meta AI voice control)
  //  Additive: the app works identically when document.modelContext is absent.
  //  Utterances: "add one" / "add five" / "take one off" / "what's my count?"
  //  / "reset the counter".
  // ===========================================================
  function registerWebMcp() {
    var ctx = document.modelContext;
    if (!ctx || typeof ctx.registerTool !== 'function') return;

    function safeRegister(tool) {
      try {
        var r = ctx.registerTool(tool);
        if (r && typeof r.then === 'function') {
          r.then(undefined, function (err) { console.error(tool.name + ' registration failed', err); });
        }
      } catch (err) {
        console.error(tool.name + ' registration failed', err);
      }
    }

    function sinceLabel() {
      var el = document.getElementById('sinceTime');
      return el && state.sinceTs ? el.textContent : null;
    }

    safeRegister({
      name: 'tally_get_state',
      description: 'Report the current tally count and the HH:MM time counting started (null if nothing counted yet).',
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true },
      execute: function () {
        return {
          count: state.count,
          since: sinceLabel(),
          next_action: 'Tell the wearer the count in one short sentence, then stop.'
        };
      }
    });

    safeRegister({
      name: 'tally_add',
      description: 'Add a number to the tally (default 1). Use a negative number to subtract. Count stays within 0-9999. Returns the new count.',
      inputSchema: {
        type: 'object',
        properties: {
          amount: { type: 'integer', description: 'How much to add. Defaults to 1. Negative subtracts.' }
        }
      },
      execute: function (args) {
        var n = parseInt(args && args.amount, 10);
        if (isNaN(n)) n = 1;
        add(n); // same function the D-pad calls, so the screen updates
        return {
          count: state.count,
          since: sinceLabel(),
          next_action: 'Confirm the new count in one short sentence, then stop.'
        };
      }
    });

    safeRegister({
      name: 'tally_reset',
      description: 'Reset the tally to 0 and clear the start time. Only call when the wearer explicitly asks to reset or start over.',
      inputSchema: { type: 'object', properties: {} },
      execute: function () {
        if (state.confirmOpen) closeConfirm();
        reset();
        return { count: 0, since: null, next_action: 'Confirm the reset in one short sentence, then stop.' };
      }
    });
  }

  function init() {
    loadData();
    renderDigits(false, false);
    renderSince();
    setupEvents();
    applyUrlState();
    // focus the bump so spacebar/enter immediately counts
    setTimeout(function () {
      var b = document.getElementById('bumpBtn');
      if (b) b.focus();
    }, 50);
    // refresh "since" minute every 30s (paused while hidden)
    startSinceTimer();
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) pauseForHidden(); else resumeFromHidden();
    });
    registerWebMcp();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
