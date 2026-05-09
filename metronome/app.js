(function () {
  'use strict';

  var CONFIG = {
    storageKey: 'mdg_metronome',
    bpmMin: 30,
    bpmMax: 252,
    schedLookahead: 0.12,   // seconds ahead to schedule clicks
    schedInterval: 25,      // ms between scheduler wakeups
    tapMaxGap: 3000,        // ms — reset tap sequence after this silence
    tapKeep: 8,             // max taps to average
  };

  // Subdivision counts and beat-interval multiplier per note value.
  // intervalMult: how many of these subdivisions fit in one quarter-note beat.
  //   quarter   → 1 click/beat (standard)
  //   eighth    → 2 clicks/beat
  //   triplet   → 3 clicks/beat  (eighth-note triplets)
  //   dotted    → 1 click per 1.5 beats  (dotted quarter, compound meter)
  //   sixteenth → 4 clicks/beat
  var NOTE_VALUES = {
    quarter:   { subdivs: 1, secPerSubdiv: function(bpi) { return bpi;       }, icon: '♩',       label: '♩'         },
    eighth:    { subdivs: 2, secPerSubdiv: function(bpi) { return bpi / 2;   }, icon: '♪♪', label: '♪♪'   },
    triplet:   { subdivs: 3, secPerSubdiv: function(bpi) { return bpi / 3;   }, icon: '♩³', label: '♩3'        },
    dotted:    { subdivs: 1, secPerSubdiv: function(bpi) { return bpi * 1.5; }, icon: '♩.',      label: '♩.'        },
    sixteenth: { subdivs: 4, secPerSubdiv: function(bpi) { return bpi / 4;   }, icon: '♫♫', label: '♫♫'   },
  };

  var state = {
    bpm: 80,
    beatsPerMeasure: 4,
    noteValue: 'quarter',
    volume: 0.7,
    accent: true,
    playing: false,
    // Audio scheduler state
    currentBeat: 0,
    currentSubdiv: 0,
    nextTickTime: 0,
    schedulerTimer: null,
    audioCtx: null,
    masterGain: null,
    // Tap tempo
    tapTimes: [],
  };

  // ===========================================================
  //  AUDIO
  // ===========================================================

  function initAudio() {
    if (state.audioCtx) return;
    state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    state.masterGain = state.audioCtx.createGain();
    state.masterGain.gain.setValueAtTime(state.volume, state.audioCtx.currentTime);
    state.masterGain.connect(state.audioCtx.destination);
  }

  // Synthesise a single click using a damped sinusoid in an AudioBuffer.
  // type: 'accent' | 'beat' | 'subdiv'
  function scheduleClick(time, type) {
    var ctx = state.audioCtx;
    var sr = ctx.sampleRate;
    var dur = 0.028;                           // 28 ms sound length
    var bufLen = Math.ceil(dur * sr);
    var buf = ctx.createBuffer(1, bufLen, sr);
    var d = buf.getChannelData(0);

    var freq   = type === 'accent' ? 1500 : (type === 'beat' ? 1050 : 700);
    var decay  = type === 'subdiv' ? 0.006 : 0.010;  // time constant (s)
    var peak   = type === 'accent' ? 1.0   : (type === 'beat' ? 0.70 : 0.38);

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
    var beatInterval = 60.0 / state.bpm;          // seconds per quarter-note beat
    var subdivInterval = nv.secPerSubdiv(beatInterval);
    var horizon = state.audioCtx.currentTime + CONFIG.schedLookahead;

    while (state.nextTickTime < horizon) {
      var isDownbeat = (state.currentBeat === 0 && state.currentSubdiv === 0);
      var isBeatStart = (state.currentSubdiv === 0);

      var clickType;
      if (isDownbeat && state.accent) {
        clickType = 'accent';
      } else if (isBeatStart) {
        clickType = 'beat';
      } else {
        clickType = 'subdiv';
      }

      scheduleClick(state.nextTickTime, clickType);

      // Schedule the visual update to fire when the sound plays
      var delay = (state.nextTickTime - state.audioCtx.currentTime) * 1000;
      if (delay < 0) delay = 0;
      (function (beat, isDown, isBeat) {
        setTimeout(function () {
          flashBeat(beat, isDown && state.accent, isBeat);
        }, delay);
      })(state.currentBeat, isDownbeat, isBeatStart);

      // Advance the cursor
      state.nextTickTime += subdivInterval;
      state.currentSubdiv += 1;
      if (state.currentSubdiv >= nv.subdivs) {
        state.currentSubdiv = 0;
        state.currentBeat += 1;
        if (state.currentBeat >= state.beatsPerMeasure) {
          state.currentBeat = 0;
        }
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
    scheduler();
    renderPlayUI();
  }

  function stopMetronome() {
    state.playing = false;
    if (state.schedulerTimer !== null) {
      clearTimeout(state.schedulerTimer);
      state.schedulerTimer = null;
    }
    flashBeat(-1, false, false);   // clear dots
    renderPlayUI();
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

    // Reset if gap is too long
    if (taps.length > 0 && now - taps[taps.length - 1] > CONFIG.tapMaxGap) {
      taps.length = 0;
    }
    taps.push(now);
    if (taps.length > CONFIG.tapKeep) taps.shift();

    // Flash the TAP button
    var tapBtn = document.getElementById('tap-btn');
    if (tapBtn) {
      tapBtn.classList.add('tapping');
      setTimeout(function () { tapBtn.classList.remove('tapping'); }, 100);
    }

    if (taps.length < 2) return;

    // Average the inter-tap intervals
    var sum = 0;
    for (var i = 1; i < taps.length; i++) sum += taps[i] - taps[i - 1];
    var avgMs = sum / (taps.length - 1);
    var newBpm = Math.round(60000 / avgMs);
    newBpm = Math.max(CONFIG.bpmMin, Math.min(CONFIG.bpmMax, newBpm));

    state.bpm = newBpm;
    renderBpmDisplay();
    saveData();
    restartScheduler();
  }

  // ===========================================================
  //  STATE SETTERS
  // ===========================================================

  function adjustBpm(delta) {
    state.bpm = Math.max(CONFIG.bpmMin, Math.min(CONFIG.bpmMax, state.bpm + delta));
    renderBpmDisplay();
    saveData();
    restartScheduler();
  }

  function setTimeSig(beats) {
    state.beatsPerMeasure = beats;
    renderTimeSigUI();
    renderBeatDots();
    saveData();
    restartScheduler();
  }

  function setNoteValue(val) {
    state.noteValue = val;
    renderNoteValueUI();
    saveData();
    restartScheduler();
  }

  function adjustVolume(delta) {
    state.volume = Math.max(0.0, Math.min(1.0, Math.round((state.volume + delta) * 10) / 10));
    if (state.masterGain && state.audioCtx) {
      state.masterGain.gain.setValueAtTime(state.volume, state.audioCtx.currentTime);
    }
    renderVolumeUI();
    saveData();
  }

  function toggleAccent() {
    state.accent = !state.accent;
    renderAccentUI();
    saveData();
  }

  function togglePlay() {
    if (state.playing) {
      stopMetronome();
    } else {
      startMetronome();
    }
  }

  // ===========================================================
  //  RENDER / UI
  // ===========================================================

  function renderBeatDots() {
    var container = document.getElementById('beat-dots');
    if (!container) return;
    container.innerHTML = '';
    for (var i = 0; i < state.beatsPerMeasure; i++) {
      var dot = document.createElement('span');
      dot.className = 'beat-dot';
      dot.id = 'dot-' + i;
      container.appendChild(dot);
    }
  }

  function flashBeat(beat, isAccent, isBeat) {
    document.querySelectorAll('.beat-dot').forEach(function (dot) {
      dot.classList.remove('active', 'accent');
    });
    if (beat < 0) return;
    var activeDot = document.getElementById('dot-' + beat);
    if (!activeDot) return;
    activeDot.classList.add(isAccent ? 'accent' : 'active');

    // Flash the BPM number on the downbeat
    if (isAccent || (isBeat && beat === 0)) {
      var bpmEl = document.getElementById('bpm-number');
      if (bpmEl) {
        bpmEl.classList.add(isAccent ? 'flash-accent' : 'flash-beat');
        setTimeout(function () {
          bpmEl.classList.remove('flash-accent', 'flash-beat');
        }, 80);
      }
    }
  }

  function renderBpmDisplay() {
    var el = document.getElementById('bpm-number');
    if (el) el.textContent = String(state.bpm).padStart(3, '0');
  }

  function renderNoteValueUI() {
    var nv = NOTE_VALUES[state.noteValue];
    var icon = document.getElementById('note-icon');
    if (icon) icon.textContent = nv.icon;

    document.querySelectorAll('#note-val-group .opt-btn').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.value === state.noteValue);
    });
  }

  function renderTimeSigUI() {
    document.querySelectorAll('#time-sig-group .opt-btn').forEach(function (btn) {
      btn.classList.toggle('active', parseInt(btn.dataset.value, 10) === state.beatsPerMeasure);
    });
  }

  function renderVolumeUI() {
    var fill = document.getElementById('vol-fill');
    if (fill) fill.style.width = Math.round(state.volume * 100) + '%';
  }

  function renderAccentUI() {
    var btn = document.getElementById('accent-btn');
    if (btn) btn.classList.toggle('active', state.accent);
  }

  function renderPlayUI() {
    var btn = document.getElementById('start-btn');
    var icon = document.getElementById('play-icon');
    if (btn) btn.classList.toggle('playing', state.playing);
    if (icon) icon.textContent = state.playing ? '■ STOP' : '▶ START';
  }

  function renderAll() {
    renderBeatDots();
    renderBpmDisplay();
    renderNoteValueUI();
    renderTimeSigUI();
    renderVolumeUI();
    renderAccentUI();
    renderPlayUI();
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

  function handleAction(action) {
    switch (action) {
      case 'toggle-play':    togglePlay();              break;
      case 'bpm-minus-10':   adjustBpm(-10);            break;
      case 'bpm-minus-1':    adjustBpm(-1);             break;
      case 'bpm-plus-1':     adjustBpm(1);              break;
      case 'bpm-plus-10':    adjustBpm(10);             break;
      case 'tap':            handleTap();               break;
      case 'timesig-2':      setTimeSig(2);             break;
      case 'timesig-3':      setTimeSig(3);             break;
      case 'timesig-4':      setTimeSig(4);             break;
      case 'timesig-5':      setTimeSig(5);             break;
      case 'timesig-6':      setTimeSig(6);             break;
      case 'timesig-7':      setTimeSig(7);             break;
      case 'note-quarter':   setNoteValue('quarter');   break;
      case 'note-eighth':    setNoteValue('eighth');    break;
      case 'note-triplet':   setNoteValue('triplet');   break;
      case 'note-dotted':    setNoteValue('dotted');    break;
      case 'note-sixteenth': setNoteValue('sixteenth'); break;
      case 'vol-down':       adjustVolume(-0.1);        break;
      case 'vol-up':         adjustVolume(0.1);         break;
      case 'toggle-accent':  toggleAccent();            break;
    }
  }

  // ===========================================================
  //  FOCUS / D-PAD NAVIGATION
  // ===========================================================

  function allFocusables() {
    return Array.from(document.querySelectorAll('.focusable:not([disabled])'));
  }

  function focusFirst() {
    var els = allFocusables();
    if (els.length) els[0].focus();
  }

  function moveFocus(direction) {
    var els = allFocusables();
    if (!els.length) return;

    var idx = els.indexOf(document.activeElement);
    if (idx === -1) { els[0].focus(); return; }

    var next;
    if (direction === 'up' || direction === 'left') {
      next = idx > 0 ? idx - 1 : els.length - 1;
    } else {
      next = idx < els.length - 1 ? idx + 1 : 0;
    }
    els[next].focus();
  }

  // ===========================================================
  //  EVENT WIRING
  // ===========================================================

  function setupEvents() {
    document.addEventListener('click', function (e) {
      var el = e.target.closest('[data-action]');
      if (el) handleAction(el.dataset.action);
    });

    document.addEventListener('keydown', function (e) {
      switch (e.key) {
        case 'ArrowUp':    moveFocus('up');    e.preventDefault(); break;
        case 'ArrowDown':  moveFocus('down');  e.preventDefault(); break;
        case 'ArrowLeft':  moveFocus('left');  e.preventDefault(); break;
        case 'ArrowRight': moveFocus('right'); e.preventDefault(); break;
        case 'Enter':
        case ' ':
          if (document.activeElement && document.activeElement.classList.contains('focusable')) {
            document.activeElement.click();
          }
          e.preventDefault();
          break;
        case 'Escape':
          stopMetronome();
          e.preventDefault();
          break;
      }
    });
  }

  // ===========================================================
  //  INIT
  // ===========================================================

  function init() {
    loadData();
    setupEvents();
    renderAll();
    setTimeout(focusFirst, 80);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
