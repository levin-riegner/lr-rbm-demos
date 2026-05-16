(() => {
  'use strict';

  // ─── Config ────────────────────────────────────────────────────
  const PX_PER_DEG       = 8;         // tape scale (≈ ±33° fits in window)
  const TAPE_RANGE_DEG   = 70;        // how far to either side of needle to render ticks
  const CENTER_TOL_DEG   = 1.0;       // |offset| ≤ this → "centered"
  const LEVEL_TOL_DEG    = 0.8;       // |gamma| ≤ this → "level"
  const KEY_NUDGE_DEG    = 0.6;       // keyboard fallback step
  const MIN_SPAN_DEG     = 0.5;       // refuse to lock B if span ≈ 0

  // ─── DOM ───────────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);
  const screens = {
    intro:   $('screen-intro'),
    measure: $('screen-measure'),
    center:  $('screen-center'),
    level:   $('screen-level'),
    done:    $('screen-done'),
  };
  const phasePill   = $('phase-pill');
  const sensorPill  = $('sensor-pill');
  const permOverlay = $('perm-overlay');
  const hintbar     = $('hintbar');

  // Measure
  const promptEyebrow = $('prompt-eyebrow');
  const promptTitle   = $('prompt-title');
  const promptSub     = $('prompt-sub');
  const readoutSpan   = $('readout-span');
  const tapeFrame     = document.querySelector('#screen-measure .tape-frame');
  const tapeWindow    = $('tape-window');
  const tapeTicks     = $('tape-ticks');
  const tapeSpan      = $('tape-span');
  const markerA       = $('tape-marker-a');
  const markerB       = $('tape-marker-b');
  const markerC       = $('tape-marker-c');

  // Center
  const arrowL        = $('center-arrow-left');
  const arrowR        = $('center-arrow-right');
  const reticle       = $('center-reticle');
  const devValue      = $('dev-value');
  const tapeTicksMini = $('tape-ticks-mini');
  const miniA         = $('mini-marker-a');
  const miniB         = $('mini-marker-b');
  const miniC         = $('mini-marker-c');

  // Level
  const levelWrap     = $('level-line-wrap');
  const levelBubble   = $('level-bubble');
  const tiltValue     = $('tilt-value');
  const levelStatus   = $('level-status');

  // Done
  const doneSpan      = $('done-span');
  const doneCenter    = $('done-center');
  const doneTilt      = $('done-tilt');

  // ─── State ─────────────────────────────────────────────────────
  let phase = 'intro';
  // Sensor
  let alpha = 0;       // 0..360, horizontal heading
  let gamma = 0;       // -90..90, roll
  let sensorAttached = false;
  let usingSensor = false;
  // Keyboard-only virtual orientation (used when no sensor)
  let kbAlpha = 180, kbGamma = 0;
  // Measured points
  let alphaA = null;
  let alphaB = null;
  let alphaCenter = null;
  // Computed offsets (cached for done screen)
  let finalSpan = null;
  let finalTilt = null;

  // ─── Helpers ───────────────────────────────────────────────────
  const fmtDeg = (n, signed = false) => {
    if (n == null || !isFinite(n)) return '—';
    // Normalize -0 → 0
    if (Math.abs(n) < 0.05) n = 0;
    const s = (signed && n >= 0) ? '+' : '';
    return s + n.toFixed(1);
  };
  // Signed shortest delta b - a in degrees, range [-180, 180]
  const angDelta = (a, b) => {
    let d = (b - a) % 360;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return d;
  };
  // Midpoint of two headings (handles wrap)
  const angMid = (a, b) => {
    const d = angDelta(a, b);
    return (a + d / 2 + 360) % 360;
  };

  function getAlpha() { return usingSensor ? alpha : kbAlpha; }
  function getGamma() { return usingSensor ? gamma : kbGamma; }

  function setPhase(p) {
    phase = p;
    Object.values(screens).forEach(s => s.classList.add('hidden'));
    screens[p].classList.remove('hidden');
    const phaseLabels = { intro: 'START', measure: 'MEASURE', center: 'CENTER', level: 'LEVEL', done: 'DONE' };
    phasePill.textContent = phaseLabels[p];
    setHints(p);
  }

  function setHints(p) {
    const map = {
      intro:   ['⏎ BEGIN'],
      measure: ['⏎ LOCK', '←/→ NUDGE (KB)'],
      center:  ['⏎ CONFIRM CENTER', '←/→ NUDGE (KB)'],
      level:   ['⏎ MARK LEVEL', '↑/↓ NUDGE (KB)'],
      done:    ['⏎ RESTART'],
    };
    hintbar.innerHTML = (map[p] || []).map(h => `<span>${h}</span>`).join('');
  }

  // ─── Tape rendering ────────────────────────────────────────────
  function buildTicks(container, range, withLabels) {
    container.innerHTML = '';
    for (let d = -range; d <= range; d++) {
      const t = document.createElement('div');
      const isBig   = (d % 10 === 0);
      const isMajor = !isBig && (d % 5 === 0);
      t.className = 'tick ' + (isBig ? 'big' : isMajor ? 'major' : 'minor');
      container.appendChild(t);
      if (withLabels && isBig && d !== 0) {
        const lbl = document.createElement('div');
        lbl.className = 'tick-label';
        lbl.textContent = (d > 0 ? '+' : '') + d;
        lbl.dataset.deg = d;
        container.appendChild(lbl);
      }
    }
  }

  function renderTicks(container, centerDeg, range) {
    // Ticks are positioned absolute; their "logical offset" is index - range.
    // Map degree d to pixel offset from window center: (d - centerDeg) * PX_PER_DEG.
    const winW = container.parentElement.clientWidth;
    const cx = winW / 2;
    const ticks = container.children;
    let ti = 0;
    for (let d = -range; d <= range; d++) {
      const tick = ticks[ti++];
      if (!tick) break;
      const px = cx + (d - centerDeg) * PX_PER_DEG;
      if (px < -8 || px > winW + 8) {
        tick.style.display = 'none';
      } else {
        tick.style.display = '';
        tick.style.left = px + 'px';
      }
      // labels follow big ticks; check if next child is a label for this d
      const next = ticks[ti];
      if (next && next.classList && next.classList.contains('tick-label')) {
        const ld = parseFloat(next.dataset.deg);
        if (Math.abs(ld - d) < 0.001) {
          if (px < -16 || px > winW + 16) next.style.display = 'none';
          else { next.style.display = ''; next.style.left = px + 'px'; }
          ti++;
        }
      }
    }
  }

  function placeMarker(el, headingDeg, currentDeg, container) {
    if (headingDeg == null) { el.classList.add('hidden'); return; }
    const winW = container.clientWidth;
    const cx = winW / 2;
    const off = angDelta(currentDeg, headingDeg); // signed deg from current to marker
    const px = cx + off * PX_PER_DEG;
    if (px < -20 || px > winW + 20) {
      el.classList.add('hidden');
    } else {
      el.classList.remove('hidden');
      el.style.left = px + 'px';
    }
  }

  function renderMeasure() {
    const a = getAlpha();
    // Center the tape on user-relative degrees: tick centerDeg = signed angle from A (if locked) else 0
    // Easier: treat current heading as 0° on the tape. Ticks show degrees relative to current.
    renderTicks(tapeTicks, 0, TAPE_RANGE_DEG);

    // Place A marker (if locked)
    placeMarker(markerA, alphaA, a, tapeWindow);
    // Place B marker only after locked
    placeMarker(markerB, alphaB, a, tapeWindow);
    // Center marker
    placeMarker(markerC, alphaCenter, a, tapeWindow);

    // Span bar: from A to current (during point-b) or A to B (after locked)
    const winW = tapeWindow.clientWidth;
    const cx = winW / 2;
    if (alphaA != null) {
      const aPx = cx + angDelta(a, alphaA) * PX_PER_DEG;
      let bPx;
      if (alphaB != null) {
        bPx = cx + angDelta(a, alphaB) * PX_PER_DEG;
      } else {
        bPx = cx; // up to current needle position
      }
      const lo = Math.min(aPx, bPx);
      const hi = Math.max(aPx, bPx);
      tapeSpan.style.display = '';
      tapeSpan.style.left = lo + 'px';
      tapeSpan.style.width = Math.max(0, hi - lo) + 'px';
    } else {
      tapeSpan.style.display = 'none';
    }

    // Readout: live span
    let span = null;
    if (alphaA != null && alphaB != null) span = Math.abs(angDelta(alphaA, alphaB));
    else if (alphaA != null) span = Math.abs(angDelta(alphaA, a));
    readoutSpan.textContent = span == null ? '—' : span.toFixed(1);
  }

  function renderCenter() {
    const a = getAlpha();
    const off = angDelta(a, alphaCenter); // + = center is to the right of user → turn right
    devValue.textContent = fmtDeg(off, true);

    const onTarget = Math.abs(off) <= CENTER_TOL_DEG;
    reticle.classList.toggle('on', onTarget);
    devValue.classList.toggle('on', onTarget);
    arrowL.classList.toggle('active', !onTarget && off < 0); // center to the left
    arrowR.classList.toggle('active', !onTarget && off > 0);

    // Mini tape
    renderTicks(tapeTicksMini, 0, TAPE_RANGE_DEG);
    const winW = tapeTicksMini.parentElement.clientWidth;
    const cx = winW / 2;
    function place(el, h) {
      if (h == null) { el.style.display = 'none'; return; }
      const px = cx + angDelta(a, h) * PX_PER_DEG;
      if (px < -10 || px > winW + 10) el.style.display = 'none';
      else { el.style.display = ''; el.style.left = px + 'px'; }
    }
    place(miniA, alphaA);
    place(miniB, alphaB);
    place(miniC, alphaCenter);
  }

  function renderLevel() {
    const g = getGamma();
    // Counter-rotate the line to keep it world-horizontal
    levelWrap.style.transform = `rotate(${-g}deg)`;
    tiltValue.textContent = fmtDeg(g, true);
    const isLevel = Math.abs(g) <= LEVEL_TOL_DEG;
    levelWrap.classList.toggle('is-level', isLevel);
    levelStatus.textContent = isLevel ? 'LEVEL' : 'TILTED';
    levelStatus.classList.toggle('on', isLevel);
    tiltValue.classList.toggle('on', isLevel);

    // Bubble: maps gamma to position in 260px-wide track. Clamp ±10°.
    const clamped = Math.max(-10, Math.min(10, g));
    const trackHalf = 260 / 2 - 10; // bubble half-size
    const px = (clamped / 10) * trackHalf;
    levelBubble.style.left = `calc(50% + ${px}px)`;
    levelBubble.classList.toggle('on', isLevel);
  }

  // ─── Main render loop ─────────────────────────────────────────
  // Use setInterval (not requestAnimationFrame) so the loop keeps ticking when
  // the tab is hidden (rAF is throttled to ~0 fps in background tabs).
  function tick() {
    if (phase === 'measure') renderMeasure();
    else if (phase === 'center') renderCenter();
    else if (phase === 'level') renderLevel();
  }

  // ─── Phase advance ────────────────────────────────────────────
  function onEnter() {
    if (phase === 'intro') {
      // First-touch iOS gate: request perm before measure starts
      if (needsIosPerm && !sensorAttached) {
        permOverlay.classList.remove('hidden');
        return;
      }
      startMeasure();
    } else if (phase === 'measure') {
      const a = getAlpha();
      if (alphaA == null) {
        alphaA = a;
        markerA.classList.remove('hidden');
        promptEyebrow.textContent = 'POINT · B';
        promptTitle.textContent   = 'Look at the RIGHT edge';
        flashEl(markerA);
      } else if (alphaB == null) {
        const span = Math.abs(angDelta(alphaA, a));
        if (span < MIN_SPAN_DEG) {
          // Refuse — visually nudge
          tapeFrame.classList.add('flash');
          setTimeout(() => tapeFrame.classList.remove('flash'), 220);
          return;
        }
        alphaB = a;
        alphaCenter = angMid(alphaA, alphaB);
        finalSpan = span;
        markerB.classList.remove('hidden');
        markerC.classList.remove('hidden');
        // Advance to center phase
        setTimeout(() => goToCenter(), 380);
      }
    } else if (phase === 'center') {
      const a = getAlpha();
      const off = Math.abs(angDelta(a, alphaCenter));
      if (off > CENTER_TOL_DEG * 4) {
        // Allow skipping with a small flash — but encourage centering
        reticle.classList.add('flash');
        setTimeout(() => reticle.classList.remove('flash'), 220);
      }
      goToLevel();
    } else if (phase === 'level') {
      finalTilt = getGamma();
      goToDone();
    } else if (phase === 'done') {
      resetAll();
      setPhase('intro');
    }
  }

  function flashEl(el) {
    el.classList.add('flash');
    setTimeout(() => el.classList.remove('flash'), 250);
  }

  function startMeasure() {
    alphaA = null; alphaB = null; alphaCenter = null;
    markerA.classList.add('hidden');
    markerB.classList.add('hidden');
    markerC.classList.add('hidden');
    tapeFrame.classList.remove('locked-on');
    promptEyebrow.textContent = 'POINT · A';
    promptTitle.textContent   = 'Look at the LEFT edge';
    promptSub.innerHTML       = 'Press <kbd>⏎</kbd> to lock';
    readoutSpan.textContent   = '—';
    buildTicks(tapeTicks, TAPE_RANGE_DEG, true);
    setPhase('measure');
  }

  function goToCenter() {
    buildTicks(tapeTicksMini, TAPE_RANGE_DEG, false);
    setPhase('center');
  }

  function goToLevel() {
    setPhase('level');
  }

  function goToDone() {
    doneSpan.textContent   = (finalSpan != null ? finalSpan.toFixed(1) : '—') + '°';
    doneCenter.textContent = (finalSpan != null ? (finalSpan / 2).toFixed(1) : '—') + '°';
    doneTilt.textContent   = fmtDeg(finalTilt, true) + '°';
    setPhase('done');
  }

  function resetAll() {
    alphaA = null; alphaB = null; alphaCenter = null;
    finalSpan = null; finalTilt = null;
  }

  // ─── Sensor setup ─────────────────────────────────────────────
  const needsIosPerm =
    typeof DeviceOrientationEvent !== 'undefined' &&
    typeof DeviceOrientationEvent.requestPermission === 'function';

  function setSensorPill(state, label) {
    sensorPill.classList.toggle('ok', state === 'ok');
    sensorPill.classList.toggle('warn', state === 'warn');
    sensorPill.innerHTML = `SENSOR <em>${label}</em>`;
  }
  setSensorPill('', '—');

  function onOrient(e) {
    // alpha: 0..360 (compass), beta: -180..180 (front-back), gamma: -90..90 (roll)
    if (e.alpha == null && e.beta == null && e.gamma == null) return;
    alpha = (typeof e.alpha === 'number') ? e.alpha : alpha;
    gamma = (typeof e.gamma === 'number') ? e.gamma : gamma;
    if (!usingSensor) {
      usingSensor = true;
      setSensorPill('ok', 'LIVE');
    }
  }

  function attachSensor() {
    if (sensorAttached) return;
    sensorAttached = true;
    window.addEventListener('deviceorientation', onOrient, { passive: true });
    setSensorPill('warn', 'WAIT…');
    setTimeout(() => {
      if (!usingSensor) setSensorPill('warn', 'KEYS');
    }, 1500);
  }

  async function requestSensorPermission() {
    permOverlay.classList.add('hidden');
    if (needsIosPerm) {
      try {
        const r = await DeviceOrientationEvent.requestPermission();
        if (r === 'granted') {
          attachSensor();
          // Best-effort motion too (some devices report orientation only via motion stack)
          if (typeof DeviceMotionEvent !== 'undefined' &&
              typeof DeviceMotionEvent.requestPermission === 'function') {
            DeviceMotionEvent.requestPermission().catch(() => {});
          }
        } else {
          setSensorPill('warn', 'DENIED · KEYS');
          sensorAttached = true; // don't ask again
        }
      } catch (err) {
        setSensorPill('warn', 'ERR · KEYS');
        sensorAttached = true;
      }
    } else {
      attachSensor();
    }
    // Whether granted or not, proceed to measure
    startMeasure();
  }

  // ─── Input ────────────────────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // If perm overlay is up, Enter = grant
      if (!permOverlay.classList.contains('hidden')) {
        requestSensorPermission();
        return;
      }
      onEnter();
      return;
    }
    // Arrow nudges (keyboard-only mode)
    if (!usingSensor) {
      if (e.key === 'ArrowLeft')  { kbAlpha = (kbAlpha - KEY_NUDGE_DEG + 360) % 360; e.preventDefault(); }
      else if (e.key === 'ArrowRight') { kbAlpha = (kbAlpha + KEY_NUDGE_DEG + 360) % 360; e.preventDefault(); }
      else if (e.key === 'ArrowUp')    { kbGamma = Math.max(-30, kbGamma - KEY_NUDGE_DEG); e.preventDefault(); }
      else if (e.key === 'ArrowDown')  { kbGamma = Math.min( 30, kbGamma + KEY_NUDGE_DEG); e.preventDefault(); }
    }
  });

  // Permission overlay button (click fallback)
  $('perm-grant').addEventListener('click', requestSensorPermission);

  // ─── Init ─────────────────────────────────────────────────────
  setPhase('intro');
  buildTicks(tapeTicks, TAPE_RANGE_DEG, true);
  buildTicks(tapeTicksMini, TAPE_RANGE_DEG, false);
  // If no iOS gate needed, attach immediately so KEYS pill shows quickly when sensors absent
  if (!needsIosPerm) {
    attachSensor();
  }
  setInterval(tick, 33);  // ~30 fps render
})();
