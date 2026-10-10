// Meditation — Meta Display Glasses webapp
// Box breathing timer with session history. Vanilla JS, no deps.

(function () {
  'use strict';

  // ==================== CONFIG ====================
  var CONFIG = {
    appName: 'Meditation',
    storageKey: 'mdg_meditation',
    historyCap: 50,
    minSaveSec: 30,
    // Box breathing phases, in ms
    phases: [
      { name: 'Inhale', dur: 4000, from: 0.5, to: 1.2 },
      { name: 'Hold',   dur: 4000, from: 1.2, to: 1.2 },
      { name: 'Exhale', dur: 4000, from: 1.2, to: 0.5 },
      { name: 'Hold',   dur: 4000, from: 0.5, to: 0.5 },
    ],
  };

  // ==================== STATE ====================
  var state = {
    currentScreen: 'home',
    screenHistory: [],
    data: {
      history: [], // [{ date: ISO, durationMin }]
    },
    session: {
      active: false,
      paused: false,
      durationMin: 0,
      totalSec: 0,       // target total seconds
      remainingSec: 0,   // live countdown
      startedAt: 0,      // ms timestamp when (re)started
      startRemaining: 0, // remainingSec at last (re)start — for drift correction
      phaseStart: 0,     // ms timestamp of current phase start
      phaseIdx: 0,
      rafId: null,
      tickId: null,
    },
  };

  var screens = {};
  var audioCtx = null;
  var returnFocus = {}; // screen id -> the control that was focused when we left it

  function collectScreens() {
    document.querySelectorAll('.screen').forEach(function (s) {
      if (s.id) screens[s.id] = s;
    });
  }

  // ==================== NAVIGATION ====================
  function navigateTo(screenId, options) {
    options = options || {};
    var addToHistory = options.addToHistory !== false;
    if (addToHistory && state.currentScreen && state.currentScreen !== screenId) {
      state.screenHistory.push(state.currentScreen);
      var ae = document.activeElement;
      returnFocus[state.currentScreen] =
        ae && ae.classList && ae.classList.contains('focusable') ? ae : null;
    }
    Object.values(screens).forEach(function (s) { s.classList.add('hidden'); });
    if (screens[screenId]) {
      screens[screenId].classList.remove('hidden');
      state.currentScreen = screenId;
      onScreenEnter(screenId);
      focusFirst(screens[screenId]);
    }
  }

  function navigateBack() {
    // If active session, Escape pauses rather than navigating away
    if (state.currentScreen === 'session' && state.session.active && !state.session.paused) {
      pauseSession();
      return;
    }
    if (state.screenHistory.length > 0) {
      var prev = state.screenHistory.pop();
      navigateTo(prev, { addToHistory: false });
      // back lands on the control that opened the screen we just left
      var el = returnFocus[prev];
      returnFocus[prev] = null;
      if (el && screens[prev] && screens[prev].contains(el) && !el.disabled) el.focus();
    } else {
      navigateTo('home', { addToHistory: false });
    }
  }

  // ==================== FOCUS ====================
  function focusFirst(container) {
    var el = container.querySelector('.focusable:not([disabled]):not(.hidden)');
    if (el) el.focus();
  }

  function moveFocus(direction) {
    var container = screens[state.currentScreen];
    if (!container) return;
    var focusables = Array.from(
      container.querySelectorAll('.focusable:not([disabled]):not(.hidden)')
    );
    if (focusables.length === 0) return;

    var current = document.activeElement;
    var idx = focusables.indexOf(current);
    if (idx === -1) { focusFirst(container); return; }

    // 2D grid-aware focus for home screen (3-col grid)
    if (state.currentScreen === 'home') {
      var grid = container.querySelector('#duration-grid');
      if (grid && grid.contains(current)) {
        var gridBtns = Array.from(grid.querySelectorAll('.focusable'));
        var gi = gridBtns.indexOf(current);
        var cols = 3;
        var nextGi = gi;
        if (direction === 'left')       nextGi = gi - 1;
        else if (direction === 'right') nextGi = gi + 1;
        else if (direction === 'up')    nextGi = gi - cols;
        else if (direction === 'down')  nextGi = gi + cols;
        if (nextGi >= 0 && nextGi < gridBtns.length) {
          gridBtns[nextGi].focus();
          return;
        }
        if (direction === 'down') {
          // Fall out to nav bar
          var nav = container.querySelector('.nav-bar .focusable');
          if (nav) { nav.focus(); return; }
        }
        if (direction === 'up' && gi < cols) {
          // Already on top row — no-op
          return;
        }
      }
    }

    var nextIdx;
    if (direction === 'up' || direction === 'left') {
      nextIdx = idx > 0 ? idx - 1 : focusables.length - 1;
    } else {
      nextIdx = idx < focusables.length - 1 ? idx + 1 : 0;
    }
    focusables[nextIdx].focus();
    focusables[nextIdx].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  // ==================== PERSISTENCE ====================
  function loadData() {
    try {
      var saved = localStorage.getItem(CONFIG.storageKey);
      if (saved) {
        var data = JSON.parse(saved);
        if (data && Array.isArray(data.history)) {
          state.data.history = data.history.slice(0, CONFIG.historyCap);
        }
      }
    } catch (e) { /* ignore */ }
  }

  function saveData() {
    try {
      localStorage.setItem(CONFIG.storageKey, JSON.stringify(state.data));
    } catch (e) { /* ignore */ }
  }

  function addHistoryEntry(durationMin) {
    state.data.history.unshift({
      date: new Date().toISOString(),
      durationMin: durationMin,
    });
    if (state.data.history.length > CONFIG.historyCap) {
      state.data.history.length = CONFIG.historyCap;
    }
    saveData();
  }

  // ==================== AUDIO ====================
  function ensureAudioCtx() {
    if (audioCtx) return audioCtx;
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audioCtx = new Ctx();
    } catch (e) { audioCtx = null; }
    return audioCtx;
  }

  // Soft singing-bowl-like tone: layered sines with slow decay
  function playBowlTone() {
    var ctx = ensureAudioCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }

    var now = ctx.currentTime;
    var master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.35, now + 0.08);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 3.2);
    master.connect(ctx.destination);

    // Fundamentals — low, warm, with a perfect fifth + octave harmonic
    var freqs = [220, 330, 440];
    var gains = [0.9, 0.35, 0.25];
    freqs.forEach(function (f, i) {
      var osc = ctx.createOscillator();
      var g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now);
      g.gain.setValueAtTime(gains[i], now);
      osc.connect(g);
      g.connect(master);
      osc.start(now);
      osc.stop(now + 3.3);
    });
  }

  // ==================== SESSION — BREATHING ANIMATION ====================
  function setCircleScale(scale) {
    var c = document.getElementById('breath-circle');
    var a = document.getElementById('ambient');
    if (c) c.style.transform = 'scale(' + scale.toFixed(4) + ')';
    // Ambient pulses gently with the breath — smaller amplitude
    if (a) {
      // map scale 0.5..1.2 -> 0.9..1.08
      var t = (scale - 0.5) / 0.7;
      var aScale = 0.9 + t * 0.18;
      var aOpacity = 0.6 + t * 0.4;
      a.style.transform = 'scale(' + aScale.toFixed(4) + ')';
      a.style.opacity = aOpacity.toFixed(3);
    }
  }

  function setPhaseLabel(text) {
    var el = document.getElementById('phase-label');
    if (el && el.textContent !== text) el.textContent = text;
  }

  function breathingFrame() {
    if (!state.session.active || state.session.paused) return;
    var now = performance.now();
    var phase = CONFIG.phases[state.session.phaseIdx];
    var elapsed = now - state.session.phaseStart;

    if (elapsed >= phase.dur) {
      // Advance
      state.session.phaseIdx = (state.session.phaseIdx + 1) % CONFIG.phases.length;
      state.session.phaseStart = now;
      phase = CONFIG.phases[state.session.phaseIdx];
      elapsed = 0;
      setPhaseLabel(phase.name);
    }

    var t = Math.min(1, elapsed / phase.dur);
    // Smooth easing for inhale/exhale; linear for holds (they're flat anyway)
    var eased = phase.from === phase.to ? 1 : 0.5 - 0.5 * Math.cos(Math.PI * t);
    var scale = phase.from + (phase.to - phase.from) * eased;
    setCircleScale(scale);

    state.session.rafId = requestAnimationFrame(breathingFrame);
  }

  // ==================== SESSION — COUNTDOWN ====================
  function updateCountdownDisplay() {
    var el = document.getElementById('countdown');
    if (!el) return;
    var s = Math.max(0, state.session.remainingSec);
    var m = Math.floor(s / 60);
    var r = s % 60;
    var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
    el.textContent = pad(m) + ':' + pad(r);
  }

  function tickCountdown() {
    if (!state.session.active || state.session.paused) return;
    // Drift correction — compute remaining from anchor time
    var elapsedMs = performance.now() - state.session.startedAt;
    var newRemaining = state.session.startRemaining - Math.floor(elapsedMs / 1000);
    if (newRemaining <= 0) {
      state.session.remainingSec = 0;
      updateCountdownDisplay();
      completeSession(/*natural=*/true);
      return;
    }
    if (newRemaining !== state.session.remainingSec) {
      state.session.remainingSec = newRemaining;
      updateCountdownDisplay();
    }
  }

  // ==================== SESSION — LIFECYCLE ====================
  function startSession(durationMin) {
    state.session.active = true;
    state.session.paused = false;
    state.session.durationMin = durationMin;
    state.session.totalSec = durationMin * 60;
    state.session.remainingSec = state.session.totalSec;
    state.session.startRemaining = state.session.totalSec;
    state.session.startedAt = performance.now();
    state.session.phaseIdx = 0;
    state.session.phaseStart = performance.now();

    // Prime audio on user gesture (start is triggered by Enter/click)
    ensureAudioCtx();

    var stage = document.querySelector('#session .session-stage');
    if (stage) stage.classList.remove('paused');

    setPhaseLabel(CONFIG.phases[0].name);
    setCircleScale(CONFIG.phases[0].from);
    updateCountdownDisplay();
    navigateTo('session');

    var pauseBtn = document.getElementById('pause-btn');
    if (pauseBtn) pauseBtn.textContent = 'Pause';

    if (state.session.rafId) cancelAnimationFrame(state.session.rafId);
    state.session.rafId = requestAnimationFrame(breathingFrame);
    if (state.session.tickId) clearInterval(state.session.tickId);
    state.session.tickId = setInterval(tickCountdown, 250);
  }

  function pauseSession() {
    if (!state.session.active || state.session.paused) return;
    state.session.paused = true;
    // Lock remainingSec
    var elapsedMs = performance.now() - state.session.startedAt;
    state.session.remainingSec = Math.max(0, state.session.startRemaining - Math.floor(elapsedMs / 1000));
    if (state.session.rafId) cancelAnimationFrame(state.session.rafId);
    state.session.rafId = null;
    // nothing to count while paused — the tick restarts on resume
    if (state.session.tickId) clearInterval(state.session.tickId);
    state.session.tickId = null;
    var stage = document.querySelector('#session .session-stage');
    if (stage) stage.classList.add('paused');
    var pauseBtn = document.getElementById('pause-btn');
    if (pauseBtn) { pauseBtn.textContent = 'Resume'; pauseBtn.dataset.action = 'resume'; }
    updateCountdownDisplay();
  }

  function resumeSession() {
    if (!state.session.active || !state.session.paused) return;
    state.session.paused = false;
    state.session.startedAt = performance.now();
    state.session.startRemaining = state.session.remainingSec;
    state.session.phaseStart = performance.now();
    state.session.phaseIdx = 0;
    setPhaseLabel(CONFIG.phases[0].name);
    setCircleScale(CONFIG.phases[0].from);
    var stage = document.querySelector('#session .session-stage');
    if (stage) stage.classList.remove('paused');
    var pauseBtn = document.getElementById('pause-btn');
    if (pauseBtn) { pauseBtn.textContent = 'Pause'; pauseBtn.dataset.action = 'pause'; }
    state.session.rafId = requestAnimationFrame(breathingFrame);
    if (state.session.tickId) clearInterval(state.session.tickId);
    state.session.tickId = setInterval(tickCountdown, 250);
  }

  function stopTimers() {
    if (state.session.rafId) cancelAnimationFrame(state.session.rafId);
    state.session.rafId = null;
    if (state.session.tickId) clearInterval(state.session.tickId);
    state.session.tickId = null;
  }

  function endSession() {
    // User-initiated end. Save only if at least 30s elapsed.
    if (!state.session.active) return;
    var elapsedSec = state.session.totalSec - state.session.remainingSec;
    // If paused, remainingSec is already correct; otherwise recompute
    if (!state.session.paused) {
      var elapsedMs = performance.now() - state.session.startedAt;
      elapsedSec = (state.session.totalSec - state.session.startRemaining) + Math.floor(elapsedMs / 1000);
    }
    stopTimers();
    state.session.active = false;
    state.session.paused = false;
    if (elapsedSec >= CONFIG.minSaveSec) {
      var mins = Math.max(1, Math.round(elapsedSec / 60));
      addHistoryEntry(mins);
    }
    navigateTo('home', { addToHistory: false });
    state.screenHistory = [];
  }

  function completeSession() {
    stopTimers();
    state.session.active = false;
    state.session.paused = false;
    addHistoryEntry(state.session.durationMin);
    playBowlTone();
    renderCompleteScreen(state.session.durationMin);
    navigateTo('complete', { addToHistory: false });
    state.screenHistory = [];
  }

  // ==================== RENDER ====================
  function renderCompleteScreen(durationMin) {
    var sub = document.getElementById('complete-sub');
    var stats = document.getElementById('complete-stats');
    if (sub) sub.textContent = 'Session complete';
    if (stats) {
      var total = state.data.history.length;
      stats.textContent = durationMin + ' min \u00B7 ' + total + ' session' + (total === 1 ? '' : 's') + ' total';
    }
    // Re-trigger the CSS animation by cloning
    var c = document.getElementById('complete-circle');
    if (c) {
      c.style.animation = 'none';
      // force reflow
      void c.offsetWidth;
      c.style.animation = '';
    }
  }

  function formatHistoryDate(iso) {
    try {
      var d = new Date(iso);
      var date = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      var time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      return { date: date, time: time };
    } catch (e) {
      return { date: iso.slice(0, 10), time: '' };
    }
  }

  function renderHistory() {
    var list = document.getElementById('history-list');
    var empty = document.getElementById('history-empty');
    var meta = document.getElementById('history-meta');
    if (!list) return;
    list.innerHTML = '';

    if (state.data.history.length === 0) {
      if (empty) empty.classList.remove('hidden');
      list.classList.add('hidden');
      if (meta) meta.textContent = '0 sessions';
      return;
    }
    if (empty) empty.classList.add('hidden');
    list.classList.remove('hidden');
    if (meta) {
      var n = state.data.history.length;
      meta.textContent = n + ' session' + (n === 1 ? '' : 's');
    }

    state.data.history.forEach(function (entry) {
      var d = formatHistoryDate(entry.date);
      var row = document.createElement('div');
      row.className = 'history-item';
      row.innerHTML =
        '<div class="history-dot"></div>' +
        '<div class="history-main">' +
          '<div class="history-date">' + d.date + '</div>' +
          '<div class="history-time">' + d.time + '</div>' +
        '</div>' +
        '<div class="history-dur">' + entry.durationMin +
          '<span class="history-dur-unit">min</span>' +
        '</div>';
      list.appendChild(row);
    });
  }

  // ==================== ACTIONS ====================
  function handleAction(action, element) {
    switch (action) {
      case 'start':
        var min = parseInt(element && element.dataset && element.dataset.min, 10);
        if (!isNaN(min) && min > 0) startSession(min);
        break;
      case 'pause':
        pauseSession();
        break;
      case 'resume':
        resumeSession();
        break;
      case 'end':
        endSession();
        break;
      case 'open-history':
        navigateTo('history');
        break;
      case 'go-home':
        navigateTo('home', { addToHistory: false });
        state.screenHistory = [];
        break;
      case 'back':
        navigateBack();
        break;
      default:
        break;
    }
  }

  function onScreenEnter(screenId) {
    if (screenId === 'history') renderHistory();
  }

  // ==================== EVENTS ====================
  function setupEvents() {
    document.addEventListener('click', function (e) {
      var actionEl = e.target.closest('[data-action]');
      if (actionEl) handleAction(actionEl.dataset.action, actionEl);
    });

    document.addEventListener('keydown', function (e) {
      switch (e.key) {
        case 'ArrowUp':    moveFocus('up');    e.preventDefault(); break;
        case 'ArrowDown':  moveFocus('down');  e.preventDefault(); break;
        case 'ArrowLeft':  moveFocus('left');  e.preventDefault(); break;
        case 'ArrowRight': moveFocus('right'); e.preventDefault(); break;
        case 'Enter':
          if (document.activeElement &&
              document.activeElement.classList.contains('focusable')) {
            document.activeElement.click();
          }
          e.preventDefault();
          break;
        case 'Escape':
          navigateBack();
          e.preventDefault();
          break;
      }
    });

    // Hidden page: a running session pauses (animation, countdown and tick
    // all stop) and waits for the wearer to press Resume — by design, a
    // breathing guide should not run while nobody is looking at it.
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) pauseForHidden();
    });
  }

  function pauseForHidden() {
    if (state.session.active && !state.session.paused) pauseSession();
  }

  // ==================== WebMCP (Meta AI voice control) ====================
  // Additive: the app works identically when document.modelContext is absent.
  // Utterances: "start a ten minute meditation", "how long is left?",
  // "pause", "resume", "end the session".
  function liveRemainingSec() {
    var s = state.session;
    if (!s.active) return 0;
    if (s.paused) return s.remainingSec;
    return Math.max(0, s.startRemaining - Math.floor((performance.now() - s.startedAt) / 1000));
  }
  function voiceSnapshot() {
    var s = state.session;
    return {
      screen: state.currentScreen,
      pattern: 'box breathing (inhale 4s, hold 4s, exhale 4s, hold 4s)',
      presets_min: [5, 10, 15, 20, 30],
      session: s.active ? {
        duration_min: s.durationMin,
        remaining_sec: liveRemainingSec(),
        paused: s.paused,
        phase: CONFIG.phases[s.phaseIdx].name
      } : null,
      sessions_logged: state.data.history.length
    };
  }
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

    safeRegister({
      name: 'meditation_get_state',
      description: 'Report whether a breathing session is running, its length, time remaining, current breath phase and pause state. Read-only.',
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true },
      execute: function () {
        var out = voiceSnapshot();
        out.next_action = 'Answer in one short, calm sentence, then stop.';
        return out;
      }
    });

    safeRegister({
      name: 'meditation_start',
      description: 'Start a box-breathing session of the given length in minutes (the on-screen presets are 5, 10, 15, 20 and 30; any whole number from 1 to 120 works). The only pattern is box breathing. Fails if a session is already running.',
      inputSchema: {
        type: 'object',
        properties: { minutes: { type: 'integer', description: 'Session length in minutes, 1 to 120. Presets: 5, 10, 15, 20, 30.' } },
        required: ['minutes']
      },
      execute: function (args) {
        if (state.session.active) {
          var busy = voiceSnapshot(); busy.error = true;
          busy.message = 'A session is already running. End it first.';
          busy.next_action = 'Say a session is already running, then stop.';
          return busy;
        }
        var min = parseInt(args && args.minutes, 10);
        if (isNaN(min) || min < 1 || min > 120) {
          return { error: true, message: 'minutes must be a whole number from 1 to 120.', next_action: 'Ask how long the session should be, then call again.' };
        }
        startSession(min);
        var out = voiceSnapshot();
        out.next_action = 'Confirm the session has started in one short, calm sentence, then stop.';
        return out;
      }
    });

    safeRegister({
      name: 'meditation_set_paused',
      description: 'Pause or resume the running session. paused true pauses, false resumes (resuming restarts the breath cycle from Inhale, as the on-screen Resume does).',
      inputSchema: {
        type: 'object',
        properties: { paused: { type: 'boolean', description: 'true to pause, false to resume.' } },
        required: ['paused']
      },
      execute: function (args) {
        if (!state.session.active) {
          return { error: true, message: 'No session is running.', next_action: 'Say no session is running, then stop.' };
        }
        if (args && args.paused) pauseSession(); else resumeSession();
        var out = voiceSnapshot();
        out.next_action = 'Confirm in one short, calm sentence, then stop.';
        return out;
      }
    });

    safeRegister({
      name: 'meditation_stop',
      description: 'End the running session early and return home, the same as the End button. Sessions of 30 seconds or more are saved to history.',
      inputSchema: { type: 'object', properties: {} },
      execute: function () {
        if (!state.session.active) {
          return { error: true, message: 'No session is running.', next_action: 'Say no session is running, then stop.' };
        }
        endSession();
        var out = voiceSnapshot();
        out.next_action = 'Confirm the session has ended in one short, calm sentence, then stop.';
        return out;
      }
    });
  }

  // ==================== INIT ====================
  function init() {
    collectScreens();
    setupEvents();
    loadData();
    registerWebMcp();
    setTimeout(function () {
      navigateTo('home', { addToHistory: false });
    }, 50);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
