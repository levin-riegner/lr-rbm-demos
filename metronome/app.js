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
    smallMode: false,
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

  // ---- UI sound palette ----------------------------------------------------
  // Each entry: { freq, freqEnd?, dur (s), peak, decay (s), shape? }
  // freqEnd lets a tone glide (start sound, back sound).
  var UI_SOUNDS = {
    tick:    { freq:  900, dur: 0.030, peak: 0.25, decay: 0.010 },
    focus:   { freq:  620, dur: 0.025, peak: 0.18, decay: 0.008 },
    select:  { freq: 1200, dur: 0.055, peak: 0.30, decay: 0.018 },
    back:    { freq:  680, freqEnd: 420, dur: 0.090, peak: 0.28, decay: 0.030 },
    next:    { freq:  780, freqEnd: 1080, dur: 0.080, peak: 0.30, decay: 0.030 },
    // start/stop are intentionally loud + long so they read clearly
    // alongside the metronome's own click stream.
    start:   { freq:  440, freqEnd: 1320, dur: 0.260, peak: 0.70, decay: 0.130, gain: 1.2 },
    stop:    { freq:  900, freqEnd: 260,  dur: 0.260, peak: 0.65, decay: 0.130, gain: 1.2 },
  };

  function playUI(type) {
    var spec = UI_SOUNDS[type] || UI_SOUNDS.tick;
    try {
      initAudio();
      if (state.audioCtx.state === 'suspended') state.audioCtx.resume();
      var ctx = state.audioCtx;
      var sr = ctx.sampleRate;
      var bufLen = Math.ceil(spec.dur * sr);
      var buf = ctx.createBuffer(1, bufLen, sr);
      var d = buf.getChannelData(0);
      var f0 = spec.freq;
      var f1 = spec.freqEnd != null ? spec.freqEnd : f0;
      for (var i = 0; i < bufLen; i++) {
        var t = i / sr;
        var k = bufLen > 1 ? i / (bufLen - 1) : 0;
        var f = f0 + (f1 - f0) * k;
        d[i] = spec.peak * Math.sin(2 * Math.PI * f * t) * Math.exp(-t / spec.decay);
      }
      var src = ctx.createBufferSource();
      src.buffer = buf;
      // UI sounds go to destination directly so they don't ride the metronome volume.
      var g = ctx.createGain();
      g.gain.setValueAtTime(spec.gain != null ? spec.gain : 0.85, ctx.currentTime);
      src.connect(g);
      g.connect(ctx.destination);
      src.start();
    } catch (e) { /* ignore */ }
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
    // Make sure the masterGain is at full volume in case stop() ramped it down.
    if (state.masterGain) {
      state.masterGain.gain.cancelScheduledValues(state.audioCtx.currentTime);
      state.masterGain.gain.setValueAtTime(state.volume, state.audioCtx.currentTime);
    }
    state.currentBeat = 0;
    state.currentSubdiv = 0;
    // Push first tick out far enough that the 'start' UI sound (~260ms) is
    // fully audible before the metronome begins clicking.
    state.nextTickTime = state.audioCtx.currentTime + 0.28;
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
    // Silence any clicks that the scheduler already queued within its
    // lookahead window so they don't fire over the 'stop' UI sound.
    if (state.masterGain && state.audioCtx) {
      var t = state.audioCtx.currentTime;
      state.masterGain.gain.cancelScheduledValues(t);
      state.masterGain.gain.setValueAtTime(state.masterGain.gain.value, t);
      state.masterGain.gain.linearRampToValueAtTime(0.0001, t + 0.02);
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
  //  NOD TEMPO — full-cycle detection on head pitch
  //
  //  Strategy: smooth the pitch reading, track its velocity, detect
  //  every direction reversal (each is an extremum — a peak or trough).
  //  A full nod = one down-half + one up-half = TWO reversals. We emit
  //  one tick per full nod cycle: fire on the first reversal (the
  //  bottom of the down-half), skip the second (the top recovery),
  //  fire again on the next bottom, and so on.
  // ===========================================================
  var nod = {
    active: false,
    handler: null,
    smoothed: null,    // EMA-smoothed pitch
    prevSmoothed: null,
    dir: 0,            // current motion direction: -1, 0, +1
    extremum: null,    // pitch at the last detected extremum (or initial)
    extremumAt: 0,     // timestamp of last extremum
    lastTickAt: 0,
    revCount: 0,       // direction reversals since listening started
  };
  // Tuning knobs.
  var NOD_SMOOTH    = 0.55;  // EMA weight on new sample (higher = less smoothing)
  var NOD_MIN_VEL   = 0.25;  // deg/event — anything smaller is treated as still
  var NOD_MIN_AMP   = 4.0;   // deg — minimum swing between consecutive extrema
  var NOD_MIN_GAP   = 90;    // ms — debounce between ticks (allows up to ~660 BPM)

  function onOrient(e) {
    if (e == null || e.beta == null) return;
    var b = e.beta;

    // Initialize on first sample.
    if (nod.smoothed == null) {
      nod.smoothed = b;
      nod.prevSmoothed = b;
      nod.extremum = b;
      nod.extremumAt = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      return;
    }

    // Light EMA smoothing to kill sensor jitter.
    nod.smoothed = nod.smoothed + NOD_SMOOTH * (b - nod.smoothed);
    var s = nod.smoothed;
    var dv = s - nod.prevSmoothed;

    // Determine motion direction with a small dead band.
    var newDir = 0;
    if (dv >  NOD_MIN_VEL) newDir =  1;
    else if (dv < -NOD_MIN_VEL) newDir = -1;

    if (newDir !== 0) {
      if (nod.dir === 0) {
        // First real motion since rest — seed direction; the rest point
        // is implicitly the previous extremum.
        nod.dir = newDir;
      } else if (newDir !== nod.dir) {
        // Direction just reversed → the previous smoothed value is an
        // extremum. Check amplitude/time gates before counting it.
        var now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
        var amp = Math.abs(nod.prevSmoothed - nod.extremum);
        var gap = now - nod.lastTickAt;
        if (amp >= NOD_MIN_AMP && gap >= NOD_MIN_GAP) {
          // Fire on every other reversal so one full nod (down + back up)
          // counts as a single tap. revCount 0,2,4,... fire; 1,3,5,... skip.
          if (nod.revCount % 2 === 0) {
            nod.lastTickAt = now;
            registerNodTick();
          }
          nod.revCount++;
        }
        nod.extremum = nod.prevSmoothed;
        nod.extremumAt = now;
        nod.dir = newDir;
      }
    }

    nod.prevSmoothed = s;
  }

  function registerNodTick() {
    handleTap();
    var btn = document.getElementById('nod-btn');
    if (btn) {
      btn.classList.add('nodded');
      setTimeout(function () { btn.classList.remove('nodded'); }, 140);
    }
    playUI('tick');
  }

  function startNod() {
    if (nod.active) return;
    nod.active = true;
    nod.smoothed = null;
    nod.prevSmoothed = null;
    nod.dir = 0;
    nod.extremum = null;
    nod.extremumAt = 0;
    nod.lastTickAt = 0;
    nod.revCount = 0;
    nod.handler = onOrient;
    window.addEventListener('deviceorientation', nod.handler);
    // Reset the tap-tempo buffer so old taps don't get averaged with new nods.
    state.tapTimes.length = 0;
    var btn = document.getElementById('nod-btn');
    if (btn) btn.classList.add('listening');
  }

  function stopNod() {
    if (!nod.active) return;
    nod.active = false;
    if (nod.handler) window.removeEventListener('deviceorientation', nod.handler);
    nod.handler = null;
    var btn = document.getElementById('nod-btn');
    if (btn) btn.classList.remove('listening');
  }

  function toggleNod() {
    if (nod.active) { stopNod(); return; }
    // iOS Safari requires explicit permission. Other browsers grant by default.
    var DOE = window.DeviceOrientationEvent;
    if (DOE && typeof DOE.requestPermission === 'function') {
      DOE.requestPermission().then(function (p) {
        if (p === 'granted') startNod();
      }).catch(function () { /* user denied — silent */ });
    } else {
      startNod();
    }
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
    // Stop nod listening when navigating away from the tempo step.
    if (name !== 'step-tempo' && nod.active) stopNod();
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
    var bpmStr = String(state.bpm);
    var big = document.getElementById('bpm-big');
    if (big) big.textContent = bpmStr;
    var play = document.getElementById('play-bpm');
    if (play) play.textContent = bpmStr;
    var mini = document.getElementById('mini-bpm');
    if (mini) mini.textContent = bpmStr;
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
    var glyph = NOTE_VALUES[state.noteValue].glyph;
    var timeStr = state.beatsPerMeasure + (state.beatsPerMeasure >= 6 ? '/8' : '/4');
    var t = document.getElementById('play-time-tag');
    var n = document.getElementById('play-note-tag');
    if (t) t.textContent = timeStr;
    if (n) n.textContent = glyph;
    var mt = document.getElementById('mini-time');
    var mn = document.getElementById('mini-note');
    if (mt) mt.textContent = timeStr;
    if (mn) mn.textContent = glyph;
    renderBpm();
    renderBeatDots();
    applySmallMode();
  }

  function renderBeatDots() {
    [['beat-dots', ''], ['mini-dots', 'mini-']].forEach(function (cfg) {
      var c = document.getElementById(cfg[0]);
      if (!c) return;
      c.innerHTML = '';
      for (var i = 0; i < state.beatsPerMeasure; i++) {
        var d = document.createElement('span');
        d.className = 'beat-dot';
        d.dataset.beat = String(i);
        c.appendChild(d);
      }
    });
  }

  function flashBeat(beat, isAccent, isBeat) {
    // Clear all dots in both displays.
    document.querySelectorAll('.beat-dot').forEach(function (d) {
      d.classList.remove('active', 'accent');
    });
    var ring = document.getElementById('pulse-ring');
    var num = document.getElementById('play-bpm');
    var miniNum = document.getElementById('mini-bpm');
    if (beat < 0) {
      if (ring) ring.classList.remove('pulse', 'pulse-accent');
      if (num) num.classList.remove('flash-beat', 'flash-accent');
      if (miniNum) miniNum.classList.remove('flash-beat', 'flash-accent');
      return;
    }
    document.querySelectorAll('.beat-dot[data-beat="' + beat + '"]').forEach(function (d) {
      d.classList.add(isAccent ? 'accent' : 'active');
    });

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
      [num, miniNum].forEach(function (el) {
        if (!el) return;
        el.classList.add(isAccent ? 'flash-accent' : 'flash-beat');
        setTimeout(function () {
          el.classList.remove('flash-accent', 'flash-beat');
        }, 90);
      });
    }
  }

  function applySmallMode() {
    var p = document.getElementById('playing');
    if (p) p.classList.toggle('small-mode', !!state.smallMode);
  }

  function toggleSmallMode() {
    state.smallMode = !state.smallMode;
    applySmallMode();
    saveData();
    setTimeout(focusFirst, 30);
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
      if (typeof d.smallMode === 'boolean') state.smallMode = d.smallMode;
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
        smallMode: state.smallMode,
      }));
    } catch (e) { /* ignore */ }
  }

  // ===========================================================
  //  ACTION DISPATCH
  // ===========================================================
  function handleAction(action, el) {
    switch (action) {
      case 'quick-start':    playUI('start');  startMetronome();             break;
      case 'setup-begin':    playUI('next');   if (state.playing) stopMetronome(); startWizard(); break;
      case 'step-back':      playUI('back');   stepBack();                   break;
      case 'step-next':      playUI('next');   stepNext();                   break;
      case 'step-finish':    playUI('start');  startMetronome();             break;
      case 'bpm-minus-10':   playUI('tick');   adjustBpm(-10);               break;
      case 'bpm-minus-1':    playUI('tick');   adjustBpm(-1);                break;
      case 'bpm-plus-1':     playUI('tick');   adjustBpm(1);                 break;
      case 'bpm-plus-10':    playUI('tick');   adjustBpm(10);                break;
      case 'tap':            playUI('tick');   handleTap();                  break;
      case 'toggle-nod':     playUI('next');   toggleNod();                  break;
      case 'set-time':
        playUI('select');
        setTimeSig(parseInt(el.dataset.value, 10));
        stepNext();
        break;
      case 'set-note':
        playUI('select');
        setNoteValue(el.dataset.value);
        startMetronome();
        break;
      case 'toggle-play':
        if (state.playing) { playUI('stop'); stopMetronome(); }
        else               { playUI('start'); startMetronome(); }
        break;
      case 'toggle-small':
        playUI('next');
        toggleSmallMode();
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
    // Exclude focusables that aren't currently rendered (e.g. mini-mode
    // controls while in full mode, or vice versa). offsetParent is null
    // for any element whose ancestor chain has display:none.
    return Array.from(s.querySelectorAll('.focusable:not([disabled])'))
      .filter(function (el) {
        return el.offsetParent !== null || el === document.body;
      });
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
    if (next) { next.focus(); playUI('focus'); }
  }
  function focusTempoUp() {
    // From NEXT, return to the middle of the BPM control row (TAP).
    var active = document.activeElement;
    if (active && active.dataset && active.dataset.action === 'step-next') {
      var tap = document.getElementById('tap-btn');
      if (tap) { tap.focus(); playUI('focus'); return; }
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
      playUI('focus');
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
    if (idx === -1) { els[0].focus(); playUI('focus'); return; }
    var next;
    if (dir === 'up' || dir === 'left')   next = idx > 0 ? idx - 1 : els.length - 1;
    else                                  next = idx < els.length - 1 ? idx + 1 : 0;
    if (next !== idx) {
      els[next].focus();
      playUI('focus');
    }
  }

  // ===========================================================
  //  SWIPE — adjust BPM ±1 on home/playing screens
  // ===========================================================
  function setupSwipe() {
    var H_MIN = 40;          // horizontal swipe distance to nudge BPM
    var H_VERT_MAX = 50;     // vertical tolerance for a horizontal swipe
    var V_MIN = 50;          // vertical swipe distance to expand from small mode
    var V_HORIZ_MAX = 60;    // horizontal tolerance for a vertical swipe
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
      var absX = Math.abs(dx), absY = Math.abs(dy);

      // Vertical-dominant swipe: while in compact mode on the playing screen,
      // a downward swipe expands the UI back to full size.
      if (absY > absX && absX < V_HORIZ_MAX && absY >= V_MIN) {
        if (state.screen === 'playing' && state.smallMode && dy > 0) {
          playUI('next');
          toggleSmallMode();
        }
        return;
      }

      // Horizontal-dominant swipe: nudge BPM by ±1.
      if (absY <= H_VERT_MAX && absX >= H_MIN) {
        playUI('tick');
        adjustBpm(dx > 0 ? 1 : -1);
      }
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
          if (bpmScreen) { playUI('tick'); adjustBpm(-1); }
          else moveFocus('left');
          e.preventDefault(); break;
        case 'ArrowRight':
          if (bpmScreen) { playUI('tick'); adjustBpm(1); }
          else moveFocus('right');
          e.preventDefault(); break;
        case 'Enter':
        case ' ':
          if (document.activeElement && document.activeElement.classList.contains('focusable')) {
            document.activeElement.click();
          }
          e.preventDefault();
          break;
        case 'Escape':
          if (state.playing) { playUI('stop'); stopMetronome(); }
          else if (state.screen !== 'home') { playUI('back'); showScreen('home'); }
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
