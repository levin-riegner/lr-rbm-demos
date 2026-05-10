(() => {
  'use strict';

  // ─── Config ────────────────────────────────────────────────────
  const TRAIN_STROKES   = 10;   // user brushes this many times during calibration
  const ZONE_STROKES    = 18;   // target strokes per brushing zone (mid of 15–20)
  const REFRACTORY_MS   = 180;  // min ms between counted strokes
  const HP_ALPHA        = 0.04; // low-EMA rate for high-pass (smaller = slower baseline)
  const SMOOTH_ALPHA    = 0.45; // EMA on |hp| to reject single-sample spikes
  const SAFETY_THR_MIN  = 0.20; // floor for detection threshold (m/s²)
  const SAFETY_THR_MAX  = 6.0;  // ceiling
  const DEFAULT_THR     = 0.85; // used if calibration fails or keyboard-only

  // Zones, clockwise around the mouth.
  // Each row: id (matches mouth SVG path id), big label, sub label.
  const ZONES = [
    { id: 'z-u-r-out', label: 'UPPER · BACK RIGHT', sub: 'OUTER SURFACE'   },
    { id: 'z-u-f-out', label: 'UPPER · FRONT',      sub: 'OUTER SURFACE'   },
    { id: 'z-u-l-out', label: 'UPPER · BACK LEFT',  sub: 'OUTER SURFACE'   },
    { id: 'z-u-in',    label: 'UPPER · INNER',      sub: 'INSIDE + CHEWING'},
    { id: 'z-l-l-out', label: 'LOWER · BACK LEFT',  sub: 'OUTER SURFACE'   },
    { id: 'z-l-f-out', label: 'LOWER · FRONT',      sub: 'OUTER SURFACE'   },
    { id: 'z-l-r-out', label: 'LOWER · BACK RIGHT', sub: 'OUTER SURFACE'   },
    { id: 'z-l-in',    label: 'LOWER · INNER',      sub: 'INSIDE + CHEWING'},
  ];

  // ─── DOM ───────────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);
  const screens = {
    intro: $('screen-intro'),
    train: $('screen-train'),
    ready: $('screen-ready'),
    brush: $('screen-brush'),
    done:  $('screen-done'),
  };
  const phasePill = $('phase-pill');
  const sensorPill = $('sensor-pill');
  const permOverlay = $('perm-overlay');
  const permGrant = $('perm-grant');
  const hintbar = $('hintbar');

  const trainCount = $('train-count');
  const trainFill  = $('train-fill');
  const signalFill = $('signal-fill');

  const thrReadout = $('thr-readout');
  const axisReadout = $('axis-readout');
  const readyZones = $('ready-zones');
  const readyTarget = $('ready-target');

  const zoneNum   = $('zone-num');
  const zoneTotal = $('zone-total');
  const zoneLabel = $('zone-label');
  const zoneSub   = $('zone-sub');
  const brushCount = $('brush-count');
  const brushTarget = $('brush-target');
  const brushFill = $('brush-fill');
  const brushTime = $('brush-time');
  const brushTotal = $('brush-total');
  const brushPace = $('brush-pace');
  const brushHint = $('brush-hint');

  const doneStrokes = $('done-strokes');
  const doneTime    = $('done-time');
  const donePace    = $('done-pace');

  readyZones.textContent = String(ZONES.length);
  readyTarget.textContent = String(ZONE_STROKES);
  zoneTotal.textContent = String(ZONES.length);
  brushTarget.textContent = String(ZONE_STROKES);

  // ─── State ─────────────────────────────────────────────────────
  let phase = 'intro';        // intro | train | ready | brush | done
  let strokeCount = 0;        // current zone count (or training count)
  let totalStrokes = 0;       // session total during brushing
  let zoneIdx = 0;
  let sessionStartedAt = 0;
  let lastStrokeAt = 0;       // for refractory

  // Calibration outputs:
  let dominantAxis = 'x';     // 'x' | 'y' | 'z'
  let detectionThr = DEFAULT_THR;

  // Sensor working state:
  const ema = { x: 0, y: 0, z: 0 };          // low-EMA baseline (gravity)
  const lvl = { x: 0, y: 0, z: 0 };          // |hp| smoothed (peak meter)
  const prevAbove = { x: false, y: false, z: false };
  const trainPeaks = { x: [], y: [], z: [] }; // collected during training

  let sensorAttached = false;
  let usingSensor = false;

  // ─── Audio beeps ───────────────────────────────────────────────
  let audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }
  function tone(freq, dur = 0.05, gain = 0.04, type = 'square', when = 0) {
    const ctx = ensureAudio();
    if (!ctx) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }
  const beeps = {
    stroke:    () => tone(880, 0.035, 0.03),
    zoneDone:  () => { tone(1175, 0.07, 0.05, 'triangle'); tone(1568, 0.09, 0.05, 'triangle', 0.07); },
    calibrated:() => { tone(660, 0.05); tone(990, 0.06, 0.05, 'square', 0.05); tone(1320, 0.08, 0.05, 'triangle', 0.10); },
    nav:       () => tone(540, 0.04, 0.03),
    done:      () => { tone(880, 0.08); tone(1175, 0.08, 0.06, 'triangle', 0.09); tone(1568, 0.12, 0.06, 'triangle', 0.18); },
  };

  // ─── Phase / screen switching ──────────────────────────────────
  function setPhase(next) {
    phase = next;
    Object.entries(screens).forEach(([k, el]) => el.classList.toggle('hidden', k !== next));
    phasePill.textContent = next.toUpperCase();
    renderHintbar();
    if (next === 'done') {
      doneFocusIdx = 0;
      const btns = getDoneButtons();
      btns.forEach((b, i) => b.classList.toggle('focused', i === 0));
    }
  }

  // ─── Hintbar (per-phase) ───────────────────────────────────────
  const HINTS = {
    intro: [['⏎', 'begin']],
    train: [['↑', 'reset'], ['↓', 'stroke (test)']],
    ready: [['⏎', 'start'], ['↑', 'recalibrate']],
    brush: [['←', 'prev zone'], ['→', 'next zone'], ['↓', 'stroke (test)'], ['↑', 'recalibrate']],
    done:  [['← →', 'choose'], ['⏎', 'confirm']],
  };
  function renderHintbar() {
    const items = HINTS[phase] || [];
    hintbar.innerHTML = items
      .map(([key, label]) => `<span><kbd>${key}</kbd> ${label}</span>`)
      .join('');
  }

  // ─── Done-screen focus toggle ──────────────────────────────────
  let doneFocusIdx = 0;
  function getDoneButtons() {
    return Array.from(document.querySelectorAll('#done-cta button'));
  }
  function focusDoneOption(delta) {
    const btns = getDoneButtons();
    if (!btns.length) return;
    doneFocusIdx = (doneFocusIdx + delta + btns.length) % btns.length;
    btns.forEach((b, i) => b.classList.toggle('focused', i === doneFocusIdx));
    beeps.nav();
  }
  function confirmDoneOption() {
    const btns = getDoneButtons();
    const btn = btns[doneFocusIdx];
    if (btn) handleAction(btn.dataset.action);
  }

  // ─── Previous zone (← during brushing) ─────────────────────────
  function prevZone() {
    if (phase !== 'brush') return;
    if (zoneIdx === 0) return;
    zoneIdx -= 1;
    strokeCount = 0;
    brushCount.textContent = '0';
    brushFill.style.width = '0%';
    renderZone();
    beeps.nav();
  }

  // ─── Sensor setup ──────────────────────────────────────────────
  const needsIosPerm =
    typeof DeviceMotionEvent !== 'undefined' &&
    typeof DeviceMotionEvent.requestPermission === 'function';

  function setSensorPill(state, label) {
    sensorPill.classList.toggle('ok', state === 'ok');
    sensorPill.classList.toggle('warn', state === 'warn');
    sensorPill.innerHTML = `SENSOR <em>${label}</em>`;
  }
  setSensorPill('', '—');

  function onMotion(e) {
    const a = e.acceleration || e.accelerationIncludingGravity;
    if (!a) return;
    const x = a.x || 0, y = a.y || 0, z = a.z || 0;

    if (!usingSensor) {
      usingSensor = true;
      setSensorPill('ok', 'LIVE');
    }

    // High-pass each axis by subtracting slow EMA (removes gravity / slow head pose).
    ema.x += (x - ema.x) * HP_ALPHA;
    ema.y += (y - ema.y) * HP_ALPHA;
    ema.z += (z - ema.z) * HP_ALPHA;
    const hx = x - ema.x, hy = y - ema.y, hz = z - ema.z;

    // Smooth |hp| for the signal meter (so we visualise envelope, not raw samples).
    lvl.x = lvl.x * (1 - SMOOTH_ALPHA) + Math.abs(hx) * SMOOTH_ALPHA;
    lvl.y = lvl.y * (1 - SMOOTH_ALPHA) + Math.abs(hy) * SMOOTH_ALPHA;
    lvl.z = lvl.z * (1 - SMOOTH_ALPHA) + Math.abs(hz) * SMOOTH_ALPHA;

    if (phase === 'train') {
      // Show the strongest axis as the signal meter (until we've picked one).
      const peak = Math.max(lvl.x, lvl.y, lvl.z);
      signalFill.style.width = `${Math.min(100, (peak / 2.5) * 100)}%`;
      handleTrainSample({ hx, hy, hz });
    } else if (phase === 'brush') {
      const axis = { x: hx, y: hy, z: hz }[dominantAxis];
      handleBrushSample(axis);
    }
  }

  function attachSensor() {
    if (sensorAttached) return;
    sensorAttached = true;
    window.addEventListener('devicemotion', onMotion, { passive: true });
    if (typeof DeviceOrientationEvent !== 'undefined') {
      // Best-effort orient permission for any future use; we only rely on motion.
      window.addEventListener('deviceorientation', () => {}, { passive: true });
    }
    setSensorPill('warn', 'WAIT…');
    // If after 1.5s no motion event arrived, assume keyboard-only.
    setTimeout(() => {
      if (!usingSensor) setSensorPill('warn', 'KEYS');
    }, 1500);
  }

  async function requestSensorPermission() {
    permOverlay.classList.add('hidden');
    if (needsIosPerm) {
      try {
        const r = await DeviceMotionEvent.requestPermission();
        if (r === 'granted') {
          attachSensor();
          if (typeof DeviceOrientationEvent !== 'undefined' &&
              typeof DeviceOrientationEvent.requestPermission === 'function') {
            DeviceOrientationEvent.requestPermission().catch(() => {});
          }
        } else {
          setSensorPill('warn', 'DENIED · KEYS');
        }
      } catch (err) {
        setSensorPill('warn', 'ERR · KEYS');
      }
    } else {
      attachSensor();
    }
  }

  // ─── Training ──────────────────────────────────────────────────
  // We don't know which axis the head moves on yet, so during training we
  // run peak detection independently on each axis. Each axis-peak above a
  // very loose floor counts as a candidate. The visible stroke count uses
  // the axis with the most peaks so far, so the user sees increments on the
  // axis that actually fires for their motion.
  function handleTrainSample({ hx, hy, hz }) {
    const samples = { x: hx, y: hy, z: hz };
    const now = performance.now();
    for (const ax of ['x','y','z']) {
      const v = Math.abs(samples[ax]);
      const above = v > 0.20; // loose floor during training
      if (above && !prevAbove[ax]) {
        // Rising edge: start tracking this peak.
        prevAbove[ax] = true;
        ema._peakStart = ema._peakStart || {};
        ema._peakStart[ax] = { t: now, max: v };
      } else if (above && prevAbove[ax]) {
        if (ema._peakStart && ema._peakStart[ax]) {
          ema._peakStart[ax].max = Math.max(ema._peakStart[ax].max, v);
        }
      } else if (!above && prevAbove[ax]) {
        // Falling edge: commit the peak.
        prevAbove[ax] = false;
        if (ema._peakStart && ema._peakStart[ax]) {
          const peak = ema._peakStart[ax].max;
          if (peak >= 0.30) trainPeaks[ax].push(peak);
          ema._peakStart[ax] = null;
        }
      }
    }

    // Choose the leading axis: whichever has the most peaks so far.
    let lead = 'x';
    if (trainPeaks.y.length > trainPeaks[lead].length) lead = 'y';
    if (trainPeaks.z.length > trainPeaks[lead].length) lead = 'z';
    const c = Math.min(TRAIN_STROKES, trainPeaks[lead].length);
    setTrainCount(c, /*fromSensor=*/true);
    if (trainPeaks[lead].length >= TRAIN_STROKES) {
      finishTraining(lead);
    }
  }

  function setTrainCount(c, fromSensor) {
    if (c === strokeCount) return;
    strokeCount = c;
    trainCount.textContent = String(c);
    trainFill.style.width = `${(c / TRAIN_STROKES) * 100}%`;
    if (fromSensor) beeps.stroke();
  }

  function finishTraining(axis) {
    dominantAxis = axis;
    const peaks = trainPeaks[axis].slice().sort((a, b) => a - b);
    // Threshold = 50% of the median peak amplitude, clamped to safe range.
    const median = peaks[Math.floor(peaks.length / 2)] || DEFAULT_THR * 2;
    let thr = median * 0.5;
    if (thr < SAFETY_THR_MIN) thr = SAFETY_THR_MIN;
    if (thr > SAFETY_THR_MAX) thr = SAFETY_THR_MAX;
    detectionThr = thr;
    thrReadout.textContent = thr.toFixed(2);
    axisReadout.textContent = axis.toUpperCase();
    beeps.calibrated();
    setPhase('ready');
  }

  // Keyboard fallback fake-stroke during training
  function manualTrainStroke() {
    if (phase !== 'train') return;
    setTrainCount(strokeCount + 1, /*fromSensor=*/false);
    beeps.stroke();
    if (strokeCount >= TRAIN_STROKES) {
      // Without sensor data we can't pick an axis; use default.
      detectionThr = DEFAULT_THR;
      dominantAxis = 'x';
      thrReadout.textContent = detectionThr.toFixed(2);
      axisReadout.textContent = 'KEYS';
      beeps.calibrated();
      setPhase('ready');
    }
  }

  function resetTrainState() {
    strokeCount = 0;
    trainPeaks.x.length = 0;
    trainPeaks.y.length = 0;
    trainPeaks.z.length = 0;
    prevAbove.x = prevAbove.y = prevAbove.z = false;
    ema._peakStart = null;
    trainCount.textContent = '0';
    trainFill.style.width = '0%';
    signalFill.style.width = '0%';
  }

  // ─── Brushing ──────────────────────────────────────────────────
  function startBrushing() {
    zoneIdx = 0;
    strokeCount = 0;
    totalStrokes = 0;
    lastStrokeAt = 0;
    sessionStartedAt = performance.now();
    prevAbove.x = prevAbove.y = prevAbove.z = false;
    renderZone();
    renderBrushMetrics();
    setPhase('brush');
  }

  function renderZone() {
    const z = ZONES[zoneIdx];
    zoneNum.textContent = String(zoneIdx + 1);
    zoneLabel.textContent = z.label;
    zoneSub.textContent = z.sub;
    document.querySelectorAll('#mouth-svg .arch').forEach((p) => p.classList.remove('active'));
    const target = document.getElementById(z.id);
    if (target) target.classList.add('active');
    brushHint.innerHTML = `Brush this zone. I'll bump you over at <b>${ZONE_STROKES}</b>.`;
  }

  function handleBrushSample(axisVal) {
    const v = Math.abs(axisVal);
    const ax = dominantAxis;
    const now = performance.now();
    const above = v > detectionThr;

    if (above && !prevAbove[ax]) {
      // Rising edge above threshold → count one stroke, respecting refractory.
      if (now - lastStrokeAt >= REFRACTORY_MS) {
        lastStrokeAt = now;
        registerStroke();
      }
      prevAbove[ax] = true;
    } else if (!above && prevAbove[ax]) {
      prevAbove[ax] = false;
    }
  }

  function registerStroke() {
    strokeCount += 1;
    totalStrokes += 1;
    bumpCount();
    beeps.stroke();
    if (strokeCount >= ZONE_STROKES) advanceZone();
  }

  function manualBrushStroke() {
    if (phase !== 'brush') return;
    const now = performance.now();
    if (now - lastStrokeAt < REFRACTORY_MS) return;
    lastStrokeAt = now;
    registerStroke();
  }

  function bumpCount() {
    brushCount.textContent = String(strokeCount);
    brushFill.style.width = `${Math.min(100, (strokeCount / ZONE_STROKES) * 100)}%`;
    brushCount.classList.add('bump');
    clearTimeout(bumpCount._t);
    bumpCount._t = setTimeout(() => brushCount.classList.remove('bump'), 120);
  }

  function advanceZone(manual = false) {
    if (phase !== 'brush') return;
    if (!manual) beeps.zoneDone();
    if (zoneIdx + 1 >= ZONES.length) {
      finishBrushing();
      return;
    }
    zoneIdx += 1;
    strokeCount = 0;
    brushCount.textContent = '0';
    brushFill.style.width = '0%';
    renderZone();
  }

  function finishBrushing() {
    const elapsed = (performance.now() - sessionStartedAt) / 1000;
    doneStrokes.textContent = String(totalStrokes);
    doneTime.textContent = fmtTime(elapsed);
    donePace.textContent = elapsed > 0 ? `${(totalStrokes / elapsed).toFixed(2)} /s` : '— /s';
    beeps.done();
    setPhase('done');
  }

  function fmtTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function renderBrushMetrics() {
    if (phase !== 'brush') return;
    const elapsed = (performance.now() - sessionStartedAt) / 1000;
    brushTime.textContent = fmtTime(elapsed);
    brushTotal.textContent = String(totalStrokes);
    brushPace.textContent = elapsed > 1 ? `${(totalStrokes / elapsed).toFixed(2)} /s` : '— /s';
  }
  setInterval(() => { if (phase === 'brush') renderBrushMetrics(); }, 250);

  // ─── Button & key wiring ───────────────────────────────────────
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    handleAction(btn.dataset.action);
  });

  function handleAction(action) {
    ensureAudio();
    beeps.nav();
    if (action === 'begin') {
      if (needsIosPerm && !sensorAttached) {
        permOverlay.classList.remove('hidden');
      } else {
        attachSensor();
      }
      resetTrainState();
      setPhase('train');
    } else if (action === 'start') {
      startBrushing();
    } else if (action === 'restart') {
      startBrushing();
    } else if (action === 'recalibrate') {
      resetTrainState();
      setPhase('train');
    }
  }

  permGrant.addEventListener('click', requestSensorPermission);

  // Five-key navigation: ↑ ↓ ← → ⏎. No other inputs (matches glasses remote).
  document.addEventListener('keydown', (e) => {
    const permOpen = !permOverlay.classList.contains('hidden');

    if (e.key === 'Enter') {
      e.preventDefault();
      ensureAudio();
      if (permOpen) { requestSensorPermission(); return; }
      if (phase === 'intro')      handleAction('begin');
      else if (phase === 'ready') handleAction('start');
      else if (phase === 'brush') advanceZone(/*manual=*/true);
      else if (phase === 'done')  confirmDoneOption();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      ensureAudio();
      if (phase === 'train')      manualTrainStroke();
      else if (phase === 'brush') manualBrushStroke();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      ensureAudio();
      if (phase === 'train') { resetTrainState(); beeps.nav(); }
      else if (phase === 'ready' || phase === 'brush') {
        resetTrainState();
        setPhase('train');
      }
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      ensureAudio();
      if (phase === 'brush')      advanceZone(/*manual=*/true);
      else if (phase === 'done')  focusDoneOption(+1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      ensureAudio();
      if (phase === 'brush')      prevZone();
      else if (phase === 'done')  focusDoneOption(-1);
    }
  });

  // ─── Init ──────────────────────────────────────────────────────
  setPhase('intro');
  // Best-effort: hook up the sensor immediately on non-iOS so the meter is
  // live before the user even hits BEGIN — they'll see SENSOR LIVE up top.
  if (!needsIosPerm) attachSensor();

})();
