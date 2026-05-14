// Pomodoro — Meta Display Glasses webapp
// 25-min work / 5-min break cycles, 15-min long break every 4 sessions.
// D-pad + Enter navigation.

(function () {
  'use strict';

  // ==================== CONFIG ====================
  var CONFIG = {
    appName: 'Pomodoro',
    storageKey: 'mdg_pomodoro',
    durations: {
      work: 25 * 60 * 1000,
      break: 5 * 60 * 1000,
      long: 15 * 60 * 1000,
    },
    sessionsPerCycle: 4, // work sessions before a long break
  };

  // ==================== STATE ====================
  var state = {
    currentScreen: 'home',
    screenHistory: [],
    phase: 'work',            // 'work' | 'break' | 'long'
    sessionIndex: 0,          // 0..3 — work sessions completed in the current cycle
    running: false,
    targetEndAt: 0,           // Date.now() target for current phase
    remainingMs: CONFIG.durations.work,
    lastDisplayed: '',        // last rendered MM:SS (repaint guard)
    tickInterval: null,
    audioCtx: null,
    stats: {
      totalSessions: 0,
      totalFocusMs: 0,
      perDay: {},             // { "YYYY-MM-DD": count }
    },
  };

  var screens = {};

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
    if (state.screenHistory.length > 0) {
      navigateTo(state.screenHistory.pop(), { addToHistory: false });
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

    var nextIdx;
    if (direction === 'up' || direction === 'left') {
      nextIdx = idx > 0 ? idx - 1 : focusables.length - 1;
    } else {
      nextIdx = idx < focusables.length - 1 ? idx + 1 : 0;
    }
    focusables[nextIdx].focus();
  }

  // ==================== PHASE MACHINE ====================
  function phaseDurationMs(phase) {
    return CONFIG.durations[phase];
  }

  function phaseLabel(phase) {
    if (phase === 'work') return 'WORK';
    if (phase === 'break') return 'BREAK';
    return 'LONG BREAK';
  }

  function applyPhaseTheme(phase) {
    document.body.classList.remove('phase-work', 'phase-break', 'phase-long');
    document.body.classList.add('phase-' + phase);
  }

  function setPhase(phase) {
    state.phase = phase;
    state.remainingMs = phaseDurationMs(phase);
    applyPhaseTheme(phase);
    renderPhase();
    renderTimer(true);
    renderSessionCounter();
    renderCycleDots();
  }

  function nextPhase() {
    // Called when the current phase reaches 0.
    if (state.phase === 'work') {
      // A work session completed — record stats.
      recordSessionComplete();
      state.sessionIndex += 1;
      if (state.sessionIndex >= CONFIG.sessionsPerCycle) {
        setPhase('long');
      } else {
        setPhase('break');
      }
    } else if (state.phase === 'break') {
      setPhase('work');
    } else if (state.phase === 'long') {
      // Cycle done — reset and start fresh work block.
      state.sessionIndex = 0;
      setPhase('work');
    }
  }

  // ==================== COUNTDOWN ====================
  function startTimer() {
    if (state.running) return;
    state.running = true;
    state.targetEndAt = Date.now() + state.remainingMs;
    // Drift-corrected tick: recompute remaining from Date.now() each tick.
    state.tickInterval = setInterval(tick, 250);
    updateStartPauseLabel();
    tick();
  }

  function pauseTimer() {
    if (!state.running) return;
    state.running = false;
    if (state.tickInterval) {
      clearInterval(state.tickInterval);
      state.tickInterval = null;
    }
    state.remainingMs = Math.max(0, state.targetEndAt - Date.now());
    updateStartPauseLabel();
    renderTimer(true);
  }

  function toggleTimer() {
    if (state.running) pauseTimer();
    else startTimer();
  }

  function skipPhase() {
    // Cancel current phase (no stats credited if in the middle of work).
    if (state.running) {
      clearInterval(state.tickInterval);
      state.tickInterval = null;
      state.running = false;
    }
    if (state.phase === 'work') {
      // Manual skip: do not count as a completed session, but advance like
      // a natural transition.
      state.sessionIndex += 1;
      if (state.sessionIndex >= CONFIG.sessionsPerCycle) {
        setPhase('long');
      } else {
        setPhase('break');
      }
    } else if (state.phase === 'break') {
      setPhase('work');
    } else {
      state.sessionIndex = 0;
      setPhase('work');
    }
    updateStartPauseLabel();
  }

  function tick() {
    var remaining = Math.max(0, state.targetEndAt - Date.now());
    state.remainingMs = remaining;
    renderTimer(false);
    if (remaining <= 0) {
      // Phase completed.
      clearInterval(state.tickInterval);
      state.tickInterval = null;
      state.running = false;
      beep();
      nextPhase();
      // Auto-start the next phase for a smooth flow.
      state.remainingMs = phaseDurationMs(state.phase);
      startTimer();
    }
  }

  // ==================== AUDIO (short ding) ====================
  function beep() {
    try {
      if (!state.audioCtx) {
        var Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        state.audioCtx = new Ctx();
      }
      var ctx = state.audioCtx;
      if (ctx.state === 'suspended') { ctx.resume(); }
      var now = ctx.currentTime;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.35);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.35, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.65);
    } catch (e) {
      // ignore audio errors
    }
  }

  // ==================== RENDERING ====================
  function formatMMSS(ms) {
    var totalSec = Math.ceil(ms / 1000);
    var m = Math.floor(totalSec / 60);
    var s = totalSec % 60;
    var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
    return pad(m) + ':' + pad(s);
  }

  function renderTimer(force) {
    var text = formatMMSS(state.remainingMs);
    if (!force && text === state.lastDisplayed) return;
    state.lastDisplayed = text;
    var el = document.getElementById('timer-display');
    if (el) el.textContent = text;
  }

  function renderPhase() {
    var badge = document.getElementById('phase-badge');
    if (badge) badge.textContent = phaseLabel(state.phase);
  }

  function renderSessionCounter() {
    var el = document.getElementById('session-counter');
    if (!el) return;
    if (state.phase === 'long') {
      el.textContent = 'Long Break';
    } else if (state.phase === 'break') {
      el.textContent = 'Break after ' + state.sessionIndex + '/' + CONFIG.sessionsPerCycle;
    } else {
      el.textContent = 'Session ' + (state.sessionIndex + 1) + ' of ' + CONFIG.sessionsPerCycle;
    }
  }

  function renderCycleDots() {
    var row = document.getElementById('cycle-dots');
    if (!row) return;
    row.innerHTML = '';
    for (var i = 0; i < CONFIG.sessionsPerCycle; i++) {
      var dot = document.createElement('div');
      dot.className = 'cycle-dot';
      if (i < state.sessionIndex) dot.classList.add('complete');
      row.appendChild(dot);
    }
  }

  function updateStartPauseLabel() {
    var btn = document.getElementById('start-pause-btn');
    if (btn) btn.textContent = state.running ? 'Pause' : 'Start';
  }

  function todayKey() {
    var d = new Date();
    var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function renderStats() {
    var s = state.stats;
    document.getElementById('stat-total').textContent = String(s.totalSessions);
    document.getElementById('stat-today').textContent = String(s.perDay[todayKey()] || 0);
    var totalMin = Math.floor(s.totalFocusMs / 60000);
    var hours = Math.floor(totalMin / 60);
    var mins = totalMin % 60;
    document.getElementById('stat-focus').textContent = hours + 'h ' + mins + 'm';
  }

  // ==================== STATS PERSISTENCE ====================
  function recordSessionComplete() {
    state.stats.totalSessions += 1;
    state.stats.totalFocusMs += CONFIG.durations.work;
    var k = todayKey();
    state.stats.perDay[k] = (state.stats.perDay[k] || 0) + 1;
    saveData();
  }

  function resetStats() {
    state.stats = { totalSessions: 0, totalFocusMs: 0, perDay: {} };
    saveData();
    renderStats();
  }

  function loadData() {
    try {
      var saved = localStorage.getItem(CONFIG.storageKey);
      if (saved) {
        var data = JSON.parse(saved);
        if (data && typeof data === 'object') {
          state.stats.totalSessions = data.totalSessions || 0;
          state.stats.totalFocusMs = data.totalFocusMs || 0;
          state.stats.perDay = data.perDay || {};
        }
      }
    } catch (e) {
      // ignore corrupt storage
    }
  }

  function saveData() {
    try {
      localStorage.setItem(CONFIG.storageKey, JSON.stringify(state.stats));
    } catch (e) {
      // ignore quota errors
    }
  }

  // ==================== ACTIONS ====================
  function handleAction(action, element) {
    switch (action) {
      case 'toggle':
        toggleTimer();
        break;
      case 'skip':
        skipPhase();
        break;
      case 'stats':
        navigateTo('stats');
        break;
      case 'back':
        navigateBack();
        break;
      case 'reset-stats':
        resetStats();
        break;
      default:
        break;
    }
  }

  function onScreenEnter(screenId) {
    if (screenId === 'home') {
      renderPhase();
      renderTimer(true);
      renderSessionCounter();
      renderCycleDots();
      updateStartPauseLabel();
    } else if (screenId === 'stats') {
      renderStats();
    }
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
  }

  // ==================== INIT ====================
  function init() {
    collectScreens();
    setupEvents();
    loadData();
    applyPhaseTheme(state.phase);
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
