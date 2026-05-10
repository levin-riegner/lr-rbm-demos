(function () {
  'use strict';

  var CONFIG = {
    storageKey: 'mdg_metronome_v2',
    bpmMin: 30,
    bpmMax: 252,
    schedLookahead: 0.12,
    schedInterval: 25,
    tapMaxGap: 3000,
    tapKeep: 8,
  };

  var NOTE_VALUES = {
    quarter:   { subdivs: 1, secPerSubdiv: function(bpi){ return bpi;       }, glyph: '♩'   },
    eighth:    { subdivs: 2, secPerSubdiv: function(bpi){ return bpi / 2;   }, glyph: '♪♪' },
    triplet:   { subdivs: 3, secPerSubdiv: function(bpi){ return bpi / 3;   }, glyph: '♩³' },
    sixteenth: { subdivs: 4, secPerSubdiv: function(bpi){ return bpi / 4;   }, glyph: '♫♫' },
  };

  var WIZARD_STEPS = ['step-tempo', 'step-time', 'step-note'];

  var state = {
    bpm: 80,
    beatsPerMeasure: 4,
    noteValue: 'quarter',
    volume: 0.7,
    accent: true,
    playing: false,
    screen: 'home',
    wizardIdx: 0,
    currentBeat: 0,
    currentSubdiv: 0,
    nextTickTime: 0,
    schedulerTimer: null,
    audioCtx: null,
    masterGain: null,
    tapTimes: [],
  };

  // ===========================================================
  //  AUDIO ENGINE
  // ===========================================================
  function initAudio() {
    if (state.audioCtx) return;
    state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    state.masterGain = state.audioCtx.createGain();
    state.masterGain.gain.setValueAtTime(state.volume, state.audioCtx.currentTime);
    state.masterGain.connect(state.audioCtx.destination);
  }

  function scheduleClick(time, type) {
    var ctx = state.audioCtx;
    var sr = ctx.sampleRate;
    var dur = 0.028;
    var bufLen = Math.ceil(dur * sr);
    var buf = ctx.createBuffer(1, bufLen, sr);
    var d = buf.getChannelData(0);

    var freq  = type === 'accent' ? 1500 : (type === 'beat' ? 1050 : 700);
    var decay = type === 'subdiv' ? 0.006 : 0.010;
    var peak  = type === 'accent' ? 1.0   : (type === 'beat' ? 0.70 : 0.38);

    for (var i = 0; i < bufLen; i++) {
      var t = i / sr;
      d[i] = peak * Math.sin(2 * Math.PI * freq * t) * Math.exp(-t / decay);
    }
    var src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(state.masterGain);
    src.start(time);
  }

  function scheduler() {
    var nv = NOTE_VALUES[state.noteValue];
    var beatInterval = 60.0 / state.bpm;
    var subdivInterval = nv.secPerSubdiv(beatInterval);
    var horizon = state.audioCtx.currentTime + CONFIG.schedLookahead;

    while (state.nextTickTime < horizon) {
      var isDownbeat = (state.currentBeat === 0 && state.currentSubdiv === 0);
      var isBeatStart = (state.currentSubdiv === 0);

      var clickType = isDownbeat && state.accent ? 'accent'
                    : isBeatStart                ? 'beat'
                                                 : 'subdiv';

      scheduleClick(state.nextTickTime, clickType);

      var delay = (state.nextTickTime - state.audioCtx.currentTime) * 1000;
      if (delay < 0) delay = 0;

      (function (beat, isDown, isBeat) {
        setTimeout(function () {
          flashBeat(beat, isDown && state.accent, isBeat);
        }, delay);
      })(state.currentBeat, isDownbeat, isBeatStart);

      state.nextTickTime += subdivInterval;
      state.currentSubdiv += 1;
      if (state.currentSubdiv >= nv.subdivs) {
        state.currentSubdiv = 0;
        state.currentBeat += 1;
        if (state.currentBeat >= state.beatsPerMeasure) state.currentBeat = 0;
      }
    }
    state.schedulerTimer = setTimeout(scheduler, CONFIG.schedInterval);
  }

  function startMetronome() {
    initAudio();
    if (state.audioCtx.state === 'suspended') state.audioCtx.resume();
    state.currentBeat = 0;
    state.currentSubdiv = 0;
    state.nextTickTime = state.audioCtx.currentTime + 0.05;
    state.playing = true;
    showScreen('playing');
    renderPlaying();
    scheduler();
  }

  function stopMetronome() {
    state.playing = false;
    if (state.schedulerTimer !== null) {
      clearTimeout(state.schedulerTimer);
      state.schedulerTimer = null;
    }
    flashBeat(-1, false, false);
    showScreen('home');
  }

  function restartScheduler() {
    if (!state.playing) return;
    clearTimeout(state.schedulerTimer);
    state.currentBeat = 0;
    state.currentSubdiv = 0;
    state.nextTickTime = state.audioCtx.currentTime + 0.05;
    scheduler();
  }

  // ===========================================================
  //  TAP TEMPO
  // ===========================================================
  function handleTap() {
    var now = Date.now();
    var taps = state.tapTimes;
    if (taps.length > 0 && now - taps[taps.length - 1] > CONFIG.tapMaxGap) taps.length = 0;
    taps.push(now);
    if (taps.length > CONFIG.tapKeep) taps.shift();

    var btn = document.getElementById('tap-btn');
    if (btn) {
      btn.classList.add('tapping');
      setTimeout(function () { btn.classList.remove('tapping'); }, 100);
    }
    if (taps.length < 2) return;

    var sum = 0;
    for (var i = 1; i < taps.length; i++) sum += taps[i] - taps[i - 1];
    var avg = sum / (taps.length - 1);
    var newBpm = Math.round(60000 / avg);
    state.bpm = Math.max(CONFIG.bpmMin, Math.min(CONFIG.bpmMax, newBpm));
    renderBpm();
    saveData();
  }

  // ===========================================================
  //  STATE SETTERS
  // ===========================================================
  function adjustBpm(delta) {
    state.bpm = Math.max(CONFIG.bpmMin, Math.min(CONFIG.bpmMax, state.bpm + delta));
    renderBpm();
    saveData();
    restartScheduler();
  }
  function setTimeSig(beats) {
    state.beatsPerMeasure = beats;
    renderTimeSelection();
    saveData();
  }
  function setNoteValue(v) {
    state.noteValue = v;
    renderNoteSelection();
    saveData();
  }

  // ===========================================================
  //  WIZARD NAV
  // ===========================================================
  function showScreen(name) {
    state.screen = name;
    ['home', 'step-tempo', 'step-time', 'step-note', 'playing'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.classList.toggle('hidden', id !== name);
    });
    if (name === 'home') renderHome();
    if (name === 'step-tempo') renderBpm();
    if (name === 'step-time') renderTimeSelection();
    if (name === 'step-note') renderNoteSelection();
    setTimeout(focusFirst, 60);
  }

  function startWizard() {
    state.wizardIdx = 0;
    showScreen(WIZARD_STEPS[0]);
  }
  function stepNext() {
    if (state.wizardIdx < WIZARD_STEPS.length - 1) {
      state.wizardIdx++;
      showScreen(WIZARD_STEPS[state.wizardIdx]);
    } else {
      startMetronome();
    }
  }
  function stepBack() {
    if (state.wizardIdx > 0) {
      state.wizardIdx--;
      showScreen(WIZARD_STEPS[state.wizardIdx]);
    } else {
      showScreen('home');
    }
  }

  // ===========================================================
  //  RENDER
  // ===========================================================
  function renderHome() {
    var bpmEl = document.getElementById('home-bpm');
    var tEl = document.getElementById('home-time');
    var nEl = document.getElementById('home-note');
    if (bpmEl) bpmEl.textContent = String(state.bpm);
    if (tEl) tEl.textContent = state.beatsPerMeasure + (state.beatsPerMeasure >= 6 ? '/8' : '/4');
    if (nEl) nEl.textContent = NOTE_VALUES[state.noteValue].glyph;
  }

  function renderBpm() {
    var big = document.getElementById('bpm-big');
    if (big) big.textContent = String(state.bpm);
    var play = document.getElementById('play-bpm');
    if (play) play.textContent = String(state.bpm);
    renderHome();
  }

  function renderTimeSelection() {
    document.querySelectorAll('#time-grid .big-tile').forEach(function (b) {
      b.classList.toggle('active', parseInt(b.dataset.value, 10) === state.beatsPerMeasure);
    });
  }

  function renderNoteSelection() {
    document.querySelectorAll('#note-grid .note-tile').forEach(function (b) {
      b.classList.toggle('active', b.dataset.value === state.noteValue);
    });
  }

  function renderPlaying() {
    var t = document.getElementById('play-time-tag');
    var n = document.getElementById('play-note-tag');
    if (t) t.textContent = state.beatsPerMeasure + (state.beatsPerMeasure >= 6 ? '/8' : '/4');
    if (n) n.textContent = NOTE_VALUES[state.noteValue].glyph;
    renderBpm();
    renderBeatDots();
  }

  function renderBeatDots() {
    var c = document.getElementById('beat-dots');
    if (!c) return;
    c.innerHTML = '';
    for (var i = 0; i < state.beatsPerMeasure; i++) {
      var d = document.createElement('span');
      d.className = 'beat-dot';
      d.id = 'dot-' + i;
      c.appendChild(d);
    }
  }

  function flashBeat(beat, isAccent, isBeat) {
    document.querySelectorAll('.beat-dot').forEach(function (d) {
      d.classList.remove('active', 'accent');
    });
    var ring = document.getElementById('pulse-ring');
    var num = document.getElementById('play-bpm');
    if (beat < 0) {
      if (ring) ring.classList.remove('pulse', 'pulse-accent');
      if (num) num.classList.remove('flash-beat', 'flash-accent');
      return;
    }
    var dot = document.getElementById('dot-' + beat);
    if (dot) dot.classList.add(isAccent ? 'accent' : 'active');

    if (isBeat) {
      if (ring) {
        ring.classList.remove('pulse', 'pulse-accent');
        // force reflow so the transition retriggers
        void ring.offsetWidth;
        ring.classList.add(isAccent ? 'pulse-accent' : 'pulse');
        setTimeout(function () {
          ring.classList.remove('pulse', 'pulse-accent');
        }, 180);
      }
      if (num) {
        num.classList.add(isAccent ? 'flash-accent' : 'flash-beat');
        setTimeout(function () {
          num.classList.remove('flash-accent', 'flash-beat');
        }, 90);
      }
    }
  }

  // ===========================================================
  //  PERSISTENCE
  // ===========================================================
  function loadData() {
    try {
      var raw = localStorage.getItem(CONFIG.storageKey);
      if (!raw) return;
      var d = JSON.parse(raw);
      if (typeof d.bpm === 'number') state.bpm = d.bpm;
      if (typeof d.beatsPerMeasure === 'number') state.beatsPerMeasure = d.beatsPerMeasure;
      if (d.noteValue && NOTE_VALUES[d.noteValue]) state.noteValue = d.noteValue;
      if (typeof d.volume === 'number') state.volume = d.volume;
      if (typeof d.accent === 'boolean') state.accent = d.accent;
    } catch (e) { /* ignore */ }
  }
  function saveData() {
    try {
      localStorage.setItem(CONFIG.storageKey, JSON.stringify({
        bpm: state.bpm,
        beatsPerMeasure: state.beatsPerMeasure,
        noteValue: state.noteValue,
        volume: state.volume,
        accent: state.accent,
      }));
    } catch (e) { /* ignore */ }
  }

  // ===========================================================
  //  ACTION DISPATCH
  // ===========================================================
  function handleAction(action, el) {
    switch (action) {
      case 'quick-start':    startMetronome();             break;
      case 'setup-begin':    if (state.playing) stopMetronome(); startWizard(); break;
      case 'step-back':      stepBack();                   break;
      case 'step-next':      stepNext();                   break;
      case 'step-finish':    startMetronome();             break;
      case 'bpm-minus-10':   adjustBpm(-10);               break;
      case 'bpm-minus-1':    adjustBpm(-1);                break;
      case 'bpm-plus-1':     adjustBpm(1);                 break;
      case 'bpm-plus-10':    adjustBpm(10);                break;
      case 'tap':            handleTap();                  break;
      case 'set-time':
        setTimeSig(parseInt(el.dataset.value, 10));
        stepNext();
        break;
      case 'set-note':
        setNoteValue(el.dataset.value);
        startMetronome();
        break;
      case 'toggle-play':
        if (state.playing) stopMetronome();
        else startMetronome();
        break;
    }
  }

  // ===========================================================
  //  D-PAD FOCUS NAV
  // ===========================================================
  function visibleScreen() {
    return document.getElementById(state.screen);
  }
  function focusables() {
    var s = visibleScreen();
    if (!s) return [];
    return Array.from(s.querySelectorAll('.focusable:not([disabled])'));
  }
  function focusFirst() {
    var els = focusables();
    if (!els.length) return;
    // prefer .active item if present (e.g., on time/note steps)
    var active = els.find(function (e) { return e.classList.contains('active'); });
    (active || els[0]).focus();
  }
  function focusTempoDown() {
    // From the BPM control row or back arrow, jump to NEXT.
    var next = document.querySelector('#step-tempo [data-action="step-next"]');
    if (next) next.focus();
  }
  function focusTempoUp() {
    // From NEXT, return to the middle of the BPM control row (TAP).
    var active = document.activeElement;
    if (active && active.dataset && active.dataset.action === 'step-next') {
      var tap = document.getElementById('tap-btn');
      if (tap) { tap.focus(); return; }
    }
    moveFocus('up');
  }

  // Spatial grid nav for the time-sig / subdivision steps.
  // dy = +1 (down) or -1 (up). cols = grid column count.
  function focusGridVertical(gridSel, cols, dy) {
    var grid = document.querySelector(gridSel);
    if (!grid) { moveFocus(dy > 0 ? 'down' : 'up'); return; }
    var tiles = Array.from(grid.querySelectorAll('.focusable'));
    var idx = tiles.indexOf(document.activeElement);
    if (idx === -1) {
      // Not on a tile — fall back to linear nav (handles back arrow / hint).
      moveFocus(dy > 0 ? 'down' : 'up');
      return;
    }
    var target = idx + dy * cols;
    if (target >= 0 && target < tiles.length) {
      tiles[target].focus();
      return;
    }
    // Off the grid: only "up" falls back to linear (lets it reach back arrow);
    // "down" from the bottom row stays put.
    if (dy < 0) moveFocus('up');
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
  //  SWIPE — adjust BPM ±1 on home/playing screens
  // ===========================================================
  function setupSwipe() {
    var SWIPE_MIN = 40;       // px to register a swipe
    var VERT_MAX  = 50;       // tolerance for vertical drift
    var startX = 0, startY = 0, tracking = false, originatesOnButton = false;

    function onDown(e) {
      if (state.screen !== 'home' && state.screen !== 'playing') return;
      var p = e.touches ? e.touches[0] : e;
      startX = p.clientX;
      startY = p.clientY;
      tracking = true;
      // ignore swipes that originate on a button — buttons own their tap
      originatesOnButton = !!(e.target && e.target.closest('button'));
    }
    function onUp(e) {
      if (!tracking) return;
      tracking = false;
      if (originatesOnButton) return;
      var p = (e.changedTouches && e.changedTouches[0]) || e;
      var dx = p.clientX - startX;
      var dy = p.clientY - startY;
      if (Math.abs(dy) > VERT_MAX) return;
      if (Math.abs(dx) < SWIPE_MIN) return;
      adjustBpm(dx > 0 ? 1 : -1);
    }

    document.addEventListener('touchstart', onDown, { passive: true });
    document.addEventListener('touchend', onUp);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('mouseup', onUp);
  }

  // ===========================================================
  //  EVENT WIRING
  // ===========================================================
  function setupEvents() {
    document.addEventListener('click', function (e) {
      var el = e.target.closest('[data-action]');
      if (el) handleAction(el.dataset.action, el);
    });
    document.addEventListener('keydown', function (e) {
      var bpmScreen = (state.screen === 'home' || state.screen === 'playing');
      switch (e.key) {
        case 'ArrowUp':
          if (state.screen === 'step-tempo')      focusTempoUp();
          else if (state.screen === 'step-time')  focusGridVertical('#time-grid', 3, -1);
          else if (state.screen === 'step-note')  focusGridVertical('#note-grid', 2, -1);
          else moveFocus('up');
          e.preventDefault(); break;
        case 'ArrowDown':
          if (state.screen === 'step-tempo')      focusTempoDown();
          else if (state.screen === 'step-time')  focusGridVertical('#time-grid', 3, 1);
          else if (state.screen === 'step-note')  focusGridVertical('#note-grid', 2, 1);
          else moveFocus('down');
          e.preventDefault(); break;
        case 'ArrowLeft':
          if (bpmScreen) adjustBpm(-1); else moveFocus('left');
          e.preventDefault(); break;
        case 'ArrowRight':
          if (bpmScreen) adjustBpm(1); else moveFocus('right');
          e.preventDefault(); break;
        case 'Enter':
        case ' ':
          if (document.activeElement && document.activeElement.classList.contains('focusable')) {
            document.activeElement.click();
          }
          e.preventDefault();
          break;
        case 'Escape':
          if (state.playing) stopMetronome();
          else if (state.screen !== 'home') showScreen('home');
          e.preventDefault();
          break;
      }
    });
  }

  function init() {
    loadData();
    setupEvents();
    setupSwipe();
    showScreen('home');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
