(() => {
  'use strict';

  // ─── Config ────────────────────────────────────────────────────
  const REPS_PER_TRAIN     = 3;     // reps captured during a training session
  const RECORD_MS          = 3000;  // per-gesture recording window
  const COUNTDOWN_S        = 3;     // pre-recording countdown
  const CAPTURED_MS        = 600;   // "✓ CAPTURED" chip flash before next gesture
  const STORAGE_KEY        = 'headprint_profiles_v1';

  // Each gesture defines an icon, name, instruction, and emphasized axes for
  // feature weighting at match time. The axes hint isn't strictly used in the
  // distance calc but documents the intent of each gesture.
  const GESTURES = [
    { id: 'nod',   icon: '↕',  name: 'NOD',   instruction: 'Look up. Look down. 3 times.',           axes: ['ay','beta'] },
    { id: 'shake', icon: '↔',  name: 'SHAKE', instruction: 'Turn left. Turn right. 3 times.',        axes: ['ax','alpha'] },
    { id: 'tilt',  icon: '⤡',  name: 'TILT',  instruction: 'Ear to shoulder, left then right. 3x.',  axes: ['az','gamma'] },
    { id: 'still', icon: '·',  name: 'STILL', instruction: 'Hold your head perfectly still.',         axes: ['noise'] },
  ];

  // Random-callsign word bank.
  const ADJ = [
    'STEADY','JUMPY','SWIFT','NIMBLE','BRISK','CALM','ROCKY','SHARP',
    'WILD','GENTLE','FIERCE','BOLD','SLY','QUICK','CRAFTY','ROYAL',
    'FROSTY','SUNNY','MELLOW','SPRY','KEEN','HUSHED','RAPID','COZY',
    'AMBER','JADE','VELVET','SILENT'
  ];
  const ANIMAL = [
    'FOX','OTTER','HAWK','OWL','LYNX','RAVEN','BEAR','WOLF',
    'MOTH','CRANE','BISON','NEWT','HARE','FALCON','BADGER','MARTEN',
    'STOAT','WEASEL','IBEX','BOAR','ELK','MOOSE','PUMA','ORYX',
    'KIWI','EAGLE','HERON','LARK'
  ];

  // ─── DOM ───────────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);
  const screens = {
    menu:    $('screen-menu'),
    naming:  $('screen-naming'),
    capture: $('screen-capture'),
    result:  $('screen-result'),
  };
  const phasePill   = $('phase-pill');
  const sensorPill  = $('sensor-pill');
  const hintbar     = $('hintbar');

  const menuList    = $('menu-list');
  const menuCount   = $('menu-count');
  const menuEmpty   = $('menu-empty');

  const namingName  = $('naming-name');

  const capMode     = $('capture-mode');
  const capRep      = $('capture-rep');
  const capRepsEl   = $('capture-reps');
  const gestIcon    = $('gesture-icon');
  const gestName    = $('gesture-name');
  const gestInstr   = $('gesture-instruction');
  const gestNum     = $('gesture-num');
  const gestTotal   = $('gesture-total');
  const capProgFill = $('capture-progress-fill');
  const capState    = $('capture-state');
  const capCountdownEl = $('cap-countdown');
  const capCountdownNum = $('cap-countdown-num');
  const capRecordingEl = $('cap-recording');
  const recTimer    = $('rec-timer');
  const recMeterFill= $('rec-meter-fill');
  const capCapturedEl = $('cap-captured');
  const capReadyEl  = $('cap-ready');

  const resultEyebrow = $('result-eyebrow');
  const resultHeadline= $('result-headline');
  const resultSub     = $('result-sub');
  const resultPrimary = $('result-primary');
  const rankingEl     = $('ranking');

  const profileOverlay = $('profile-overlay');
  const overlayName    = $('overlay-name');
  const overlayStat    = $('overlay-stat');
  const overlayActions = $('overlay-actions');

  const confirmOverlay = $('confirm-overlay');
  const confirmName    = $('confirm-name');
  const confirmActions = $('confirm-actions');

  const permOverlay    = $('perm-overlay');
  const permGrantBtn   = $('perm-grant');

  gestTotal.textContent = String(GESTURES.length);
  capRepsEl.textContent = String(REPS_PER_TRAIN);

  // ─── State ─────────────────────────────────────────────────────
  let phase = 'menu';            // menu | naming | capture | result
  let profiles = loadProfiles(); // [{id, name, reps:[{gestureId: features[]}, ...], createdAt}]
  let menuCursor = 0;            // index into the renderable menu items
  let menuItems  = [];           // [{type:'profile'|'action', profileId?, actionId?}]

  let pendingName = '';
  let activeProfileId = null;    // for "train more" or "menu-row enter"
  let captureMode = 'train';     // 'train' | 'identify'
  let captureGestureIdx = 0;
  let captureRepIdx = 0;
  let captureRepData = null;     // { nod: features, shake: features, ... } for current rep
  let captureSessionReps = [];   // collected reps for current training session
  let captureBuffer = null;      // raw samples for the in-flight gesture

  let overlayCursor = 0;
  let confirmCursor = 0;
  let pendingDeleteId = null;

  // ─── Audio cues ───────────────────────────────────────────────
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
    nav:        () => tone(540, 0.04, 0.03),
    pick:       () => tone(720, 0.05, 0.04, 'triangle'),
    tick:       () => tone(880, 0.04, 0.03),
    go:         () => { tone(660, 0.06); tone(990, 0.07, 0.05, 'triangle', 0.05); },
    captured:   () => { tone(880, 0.05, 0.04, 'triangle'); tone(1320, 0.08, 0.05, 'triangle', 0.06); },
    recognized: () => { tone(660, 0.06); tone(990, 0.06, 0.05, 'triangle', 0.06); tone(1320, 0.10, 0.05, 'triangle', 0.13); tone(1760, 0.12, 0.05, 'sine', 0.22); },
    unknown:    () => { tone(220, 0.10, 0.05, 'sawtooth'); tone(165, 0.16, 0.05, 'sawtooth', 0.10); },
    enrolled:   () => { tone(660, 0.05); tone(880, 0.05, 0.05, 'triangle', 0.05); tone(1320, 0.10, 0.05, 'triangle', 0.10); },
  };

  // ─── Storage ───────────────────────────────────────────────────
  function loadProfiles() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }
  function saveProfiles() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
    } catch (e) { /* quota etc — ignore for demo */ }
  }
  function profileById(id) { return profiles.find((p) => p.id === id); }
  function newId() { return 'p_' + Math.random().toString(36).slice(2, 10); }

  // ─── Sensor ────────────────────────────────────────────────────
  const needsIosPerm =
    typeof DeviceMotionEvent !== 'undefined' &&
    typeof DeviceMotionEvent.requestPermission === 'function';

  let sensorAttached = false;
  let usingSensor = false;
  let lastMotion = { ax: 0, ay: 0, az: 0 };
  let lastOrient = { alpha: 0, beta: 0, gamma: 0 };

  function setSensorPill(state, label) {
    sensorPill.classList.toggle('ok', state === 'ok');
    sensorPill.classList.toggle('warn', state === 'warn');
    sensorPill.innerHTML = `SENSOR <em>${label}</em>`;
  }
  setSensorPill('', '—');

  function onMotion(e) {
    const a = e.acceleration || e.accelerationIncludingGravity;
    if (!a) return;
    if (!usingSensor) { usingSensor = true; setSensorPill('ok', 'LIVE'); }
    lastMotion.ax = a.x || 0;
    lastMotion.ay = a.y || 0;
    lastMotion.az = a.z || 0;
  }
  function onOrient(e) {
    lastOrient.alpha = e.alpha || 0;
    lastOrient.beta  = e.beta  || 0;
    lastOrient.gamma = e.gamma || 0;
  }

  function attachSensor() {
    if (sensorAttached) return;
    sensorAttached = true;
    window.addEventListener('devicemotion', onMotion, { passive: true });
    window.addEventListener('deviceorientation', onOrient, { passive: true });
    setSensorPill('warn', 'WAIT…');
    setTimeout(() => { if (!usingSensor) setSensorPill('warn', 'KEYS'); }, 1500);
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
    // Resume whatever flow was waiting on permission.
    if (pendingAfterPerm) {
      const fn = pendingAfterPerm;
      pendingAfterPerm = null;
      fn();
    }
  }
  let pendingAfterPerm = null;
  function ensureSensorThen(cb) {
    if (sensorAttached) { cb(); return; }
    if (needsIosPerm) {
      pendingAfterPerm = cb;
      permOverlay.classList.remove('hidden');
    } else {
      attachSensor();
      cb();
    }
  }
  permGrantBtn.addEventListener('click', requestSensorPermission);

  // ─── Phase / hintbar ───────────────────────────────────────────
  function setPhase(next) {
    phase = next;
    Object.entries(screens).forEach(([k, el]) => el.classList.toggle('hidden', k !== next));
    phasePill.textContent = next.toUpperCase();
    renderHintbar();
  }
  const HINTS = {
    menu:    [['↑↓', 'select'], ['⏎', 'open']],
    naming:  [['↑↓', 'reroll'], ['←', 'cancel'], ['⏎', 'accept']],
    capture: [['⏎', 'continue']],
    result:  [['⏎', 'done']],
  };
  function renderHintbar() {
    const items = HINTS[phase] || [];
    hintbar.innerHTML = items
      .map(([key, label]) => `<span><kbd>${key}</kbd> ${label}</span>`)
      .join('');
  }

  // ─── Menu render ───────────────────────────────────────────────
  function rebuildMenu() {
    menuItems = [];
    profiles.forEach((p) => {
      menuItems.push({ type: 'profile', profileId: p.id });
    });
    menuItems.push({ type: 'action', actionId: 'add' });
    menuItems.push({ type: 'action', actionId: 'identify', disabled: profiles.filter((p) => p.reps && p.reps.length > 0).length < 1 });

    if (menuCursor >= menuItems.length) menuCursor = menuItems.length - 1;
    if (menuCursor < 0) menuCursor = 0;

    menuCount.textContent = String(profiles.length);

    if (profiles.length === 0) {
      menuEmpty.classList.remove('hidden');
    } else {
      menuEmpty.classList.add('hidden');
    }

    menuList.innerHTML = '';
    menuItems.forEach((it, idx) => {
      const row = document.createElement('div');
      row.className = 'menu-row';
      if (idx === menuCursor) row.classList.add('focused');
      if (it.type === 'action') row.classList.add('action');
      if (it.actionId === 'identify') row.classList.add('identify');
      if (it.disabled) row.classList.add('disabled');

      if (it.type === 'profile') {
        const p = profileById(it.profileId);
        const trained = (p.reps || []).length > 0;
        row.innerHTML = `
          <span class="menu-cursor">▶</span>
          <span class="menu-row-name">${p.name}</span>
          <span class="menu-row-stat ${trained ? 'trained' : 'untrained'}">
            <span class="dot"></span>${(p.reps || []).length} REP${(p.reps || []).length === 1 ? '' : 'S'}
          </span>
        `;
      } else if (it.actionId === 'add') {
        row.innerHTML = `
          <span class="menu-cursor">▶</span>
          <span class="menu-row-name">+ ADD PROFILE</span>
          <span class="menu-row-stat"></span>
        `;
      } else if (it.actionId === 'identify') {
        row.innerHTML = `
          <span class="menu-cursor">▶</span>
          <span class="menu-row-name">⌖ IDENTIFY WEARER</span>
          <span class="menu-row-stat">${it.disabled ? 'NEED 1+ TRAINED' : ''}</span>
        `;
      }
      menuList.appendChild(row);
    });
  }
  function menuMove(delta) {
    if (!menuItems.length) return;
    const n = menuItems.length;
    let i = menuCursor;
    for (let step = 0; step < n; step++) {
      i = (i + delta + n) % n;
      if (!menuItems[i].disabled) { menuCursor = i; break; }
    }
    rebuildMenu();
    beeps.nav();
  }
  function menuActivate() {
    const it = menuItems[menuCursor];
    if (!it || it.disabled) return;
    if (it.type === 'profile') {
      openProfileOverlay(it.profileId);
    } else if (it.actionId === 'add') {
      beginNaming();
    } else if (it.actionId === 'identify') {
      beginIdentify();
    }
  }

  // ─── Naming ────────────────────────────────────────────────────
  function randomName() {
    const a = ADJ[Math.floor(Math.random() * ADJ.length)];
    const b = ANIMAL[Math.floor(Math.random() * ANIMAL.length)];
    const n = Math.floor(Math.random() * 90) + 10;
    return `${a}-${b}-${n}`;
  }
  function rerollName() {
    pendingName = randomName();
    namingName.textContent = pendingName;
    namingName.classList.remove('flash');
    void namingName.offsetWidth; // restart anim
    namingName.classList.add('flash');
    beeps.tick();
  }
  function beginNaming() {
    pendingName = randomName();
    namingName.textContent = pendingName;
    setPhase('naming');
    beeps.pick();
  }
  function acceptName() {
    const id = newId();
    const profile = { id, name: pendingName, reps: [], createdAt: Date.now() };
    profiles.push(profile);
    saveProfiles();
    activeProfileId = id;
    captureMode = 'train';
    beeps.pick();
    beginCaptureSession();
  }

  // ─── Capture session (training or identifying) ─────────────────
  function beginCaptureSession() {
    captureGestureIdx = 0;
    captureRepIdx = 0;
    captureRepData = {};
    captureSessionReps = [];
    capMode.textContent = captureMode === 'train' ? 'TRAINING' : 'IDENTIFYING';
    // Identify mode only does ONE rep, no need to display "rep N/M"
    if (captureMode === 'identify') {
      capRep.parentElement.style.visibility = 'hidden';
    } else {
      capRep.parentElement.style.visibility = '';
    }
    setPhase('capture');
    renderCurrentGesture();
    showState('ready');
  }

  function renderCurrentGesture() {
    const g = GESTURES[captureGestureIdx];
    gestIcon.textContent = g.icon;
    gestName.textContent = g.name;
    gestInstr.textContent = g.instruction;
    gestNum.textContent = String(captureGestureIdx + 1);
    capRep.textContent = String(captureRepIdx + 1);
    const pct = (captureGestureIdx) / GESTURES.length * 100;
    capProgFill.style.width = `${pct}%`;
  }

  function showState(s) {
    [capCountdownEl, capRecordingEl, capCapturedEl, capReadyEl].forEach((el) => el.classList.add('hidden'));
    gestIcon.classList.toggle('recording', s === 'recording');
    if (s === 'countdown')  capCountdownEl.classList.remove('hidden');
    if (s === 'recording')  capRecordingEl.classList.remove('hidden');
    if (s === 'captured')   capCapturedEl.classList.remove('hidden');
    if (s === 'ready')      capReadyEl.classList.remove('hidden');
  }

  function startGesture() {
    ensureSensorThen(() => runCountdownThenRecord());
  }

  function runCountdownThenRecord() {
    showState('countdown');
    let n = COUNTDOWN_S;
    capCountdownNum.textContent = String(n);
    beeps.tick();
    const tickInt = setInterval(() => {
      n -= 1;
      if (n <= 0) {
        clearInterval(tickInt);
        beeps.go();
        recordGesture();
      } else {
        capCountdownNum.textContent = String(n);
        beeps.tick();
      }
    }, 700);
  }

  function recordGesture() {
    showState('recording');
    captureBuffer = { ax: [], ay: [], az: [], alpha: [], beta: [], gamma: [], t: [] };

    const start = performance.now();
    const interval = setInterval(() => {
      const t = performance.now();
      const elapsed = t - start;
      if (elapsed >= RECORD_MS) {
        clearInterval(interval);
        finishGesture();
        return;
      }
      captureBuffer.t.push(elapsed);
      captureBuffer.ax.push(lastMotion.ax);
      captureBuffer.ay.push(lastMotion.ay);
      captureBuffer.az.push(lastMotion.az);
      captureBuffer.alpha.push(lastOrient.alpha);
      captureBuffer.beta.push(lastOrient.beta);
      captureBuffer.gamma.push(lastOrient.gamma);
      const remain = (RECORD_MS - elapsed) / 1000;
      recTimer.textContent = remain.toFixed(1) + 's';
      recMeterFill.style.width = `${(elapsed / RECORD_MS) * 100}%`;
    }, 30);
  }

  function finishGesture() {
    const g = GESTURES[captureGestureIdx];
    const features = extractFeatures(captureBuffer);
    captureRepData[g.id] = features;
    showState('captured');
    beeps.captured();

    setTimeout(() => {
      captureGestureIdx += 1;
      if (captureGestureIdx >= GESTURES.length) {
        finishRep();
      } else {
        renderCurrentGesture();
        startGesture(); // chain through gestures without manual confirms
      }
    }, CAPTURED_MS);
  }

  function finishRep() {
    captureSessionReps.push(captureRepData);
    captureRepData = {};
    captureGestureIdx = 0;
    captureRepIdx += 1;

    capProgFill.style.width = '100%';

    if (captureMode === 'identify') {
      runIdentify(captureSessionReps[0]);
      return;
    }

    if (captureRepIdx >= REPS_PER_TRAIN) {
      finishTrainingSession();
      return;
    }

    // More reps to capture: brief pause + auto-continue
    renderCurrentGesture();
    setTimeout(() => startGesture(), 400);
  }

  function finishTrainingSession() {
    const p = profileById(activeProfileId);
    if (p) {
      p.reps = (p.reps || []).concat(captureSessionReps);
      saveProfiles();
    }
    captureSessionReps = [];
    beeps.enrolled();
    showResultEnrolled(p);
  }

  // ─── Feature extraction ────────────────────────────────────────
  // Per gesture window we compute a small descriptor vector capturing how
  // much / how fast / how variably the head moved on each axis. Acceleration
  // signal is high-passed (mean-subtracted), then summarized; orientation is
  // mean-subtracted then summarized. We only use scale/spread of orientation
  // (not absolute angle), because absolute heading depends on where the user
  // happens to be facing.
  function extractFeatures(buf) {
    const out = {};
    ['ax','ay','az'].forEach((k) => {
      const v = buf[k];
      const m = mean(v);
      const c = v.map((x) => x - m);
      out[k + '_std']     = std(c);
      out[k + '_range']   = range(c);
      out[k + '_meanabs'] = meanAbs(c);
    });
    ['alpha','beta','gamma'].forEach((k) => {
      const v = buf[k];
      const m = mean(v);
      const c = v.map((x) => x - m);
      out[k + '_std']   = std(c);
      out[k + '_range'] = range(c);
    });
    // Composite energy + frequency proxy across all accel.
    const energy = (out.ax_std + out.ay_std + out.az_std);
    out['energy'] = energy;
    out['axis_ratio'] = energy > 1e-6
      ? out.ax_std / energy
      : 0;
    out['axis_ratio_y'] = energy > 1e-6
      ? out.ay_std / energy
      : 0;
    return out;
  }
  function mean(arr) { if (!arr.length) return 0; let s = 0; for (const x of arr) s += x; return s / arr.length; }
  function std(arr) {
    if (arr.length < 2) return 0;
    const m = mean(arr);
    let s = 0;
    for (const x of arr) { const d = x - m; s += d * d; }
    return Math.sqrt(s / arr.length);
  }
  function range(arr) {
    if (!arr.length) return 0;
    let lo = arr[0], hi = arr[0];
    for (const x of arr) { if (x < lo) lo = x; if (x > hi) hi = x; }
    return hi - lo;
  }
  function meanAbs(arr) { if (!arr.length) return 0; let s = 0; for (const x of arr) s += Math.abs(x); return s / arr.length; }

  // The 8 keys per accel axis + 6 keys per orient axis + 3 composites
  // are flattened in a stable order for distance math.
  const FEATURE_KEYS = [
    'ax_std','ax_range','ax_meanabs',
    'ay_std','ay_range','ay_meanabs',
    'az_std','az_range','az_meanabs',
    'alpha_std','alpha_range',
    'beta_std','beta_range',
    'gamma_std','gamma_range',
    'energy','axis_ratio','axis_ratio_y',
  ];
  function gestureToVec(g) {
    return FEATURE_KEYS.map((k) => g[k] || 0);
  }
  // Per-feature normalizer = mean across all reps × all gestures × all
  // profiles. Distances are computed in normalized space so a 4 m/s² range
  // and a 90° range don't dominate each other.
  function buildNormalizer(profilesArg, testRep) {
    const sums = new Array(FEATURE_KEYS.length).fill(0);
    const counts = new Array(FEATURE_KEYS.length).fill(0);
    function add(rep) {
      GESTURES.forEach((g) => {
        const obj = rep[g.id];
        if (!obj) return;
        const v = gestureToVec(obj);
        for (let i = 0; i < v.length; i++) {
          sums[i] += Math.abs(v[i]);
          counts[i] += 1;
        }
      });
    }
    profilesArg.forEach((p) => (p.reps || []).forEach(add));
    if (testRep) add(testRep);
    return sums.map((s, i) => (counts[i] > 0 ? Math.max(s / counts[i], 1e-3) : 1));
  }
  function distance(repA, repB, norms) {
    let sum = 0;
    let n   = 0;
    GESTURES.forEach((g) => {
      const a = repA[g.id], b = repB[g.id];
      if (!a || !b) return;
      const va = gestureToVec(a), vb = gestureToVec(b);
      for (let i = 0; i < va.length; i++) {
        const d = (va[i] - vb[i]) / norms[i];
        sum += d * d;
        n += 1;
      }
    });
    if (!n) return Infinity;
    return Math.sqrt(sum / n);
  }

  // ─── Identification ───────────────────────────────────────────
  function beginIdentify() {
    const trained = profiles.filter((p) => (p.reps || []).length > 0);
    if (!trained.length) { beeps.unknown(); return; }
    captureMode = 'identify';
    activeProfileId = null;
    beeps.pick();
    beginCaptureSession();
  }

  function runIdentify(testRep) {
    const trained = profiles.filter((p) => (p.reps || []).length > 0);
    const norms = buildNormalizer(trained, testRep);
    const scored = trained.map((p) => {
      const dists = p.reps.map((rep) => distance(rep, testRep, norms));
      // Use min distance to the closest rep (k-NN with k=1).
      const minD = Math.min(...dists);
      return { profile: p, dist: minD };
    });
    scored.sort((a, b) => a.dist - b.dist);

    // Convert distances → confidence percentages via softmax with a
    // temperature tuned for typical distance scales (~0.4–2.5).
    const TEMP = 0.55;
    const logits = scored.map((s) => -s.dist / TEMP);
    const mx = Math.max(...logits);
    const exps = logits.map((l) => Math.exp(l - mx));
    const sumE = exps.reduce((a, b) => a + b, 0);
    scored.forEach((s, i) => { s.conf = exps[i] / sumE; });

    // Threshold for "RECOGNIZED" — top must be both > 50% and lead by
    // ≥ 12% over runner-up. Otherwise → UNKNOWN.
    const top = scored[0];
    const second = scored[1];
    const lead = second ? (top.conf - second.conf) : top.conf;
    const recognized = top.conf > 0.50 && lead > 0.12;

    showResultIdentify(scored, recognized);
  }

  // ─── Result screen ─────────────────────────────────────────────
  function showResultEnrolled(p) {
    rankingEl.classList.add('hidden');
    rankingEl.innerHTML = '';
    resultEyebrow.textContent = 'TRAINING COMPLETE';
    resultEyebrow.classList.remove('identify', 'unknown');
    resultHeadline.textContent = p ? p.name : 'PROFILE';
    resultHeadline.classList.remove('identify', 'unknown');
    const repCount = p ? (p.reps || []).length : 0;
    resultSub.textContent = `${repCount} REP${repCount === 1 ? '' : 'S'} · ${GESTURES.length} GESTURES`;
    resultPrimary.textContent = 'DONE  ⏎';
    resultPrimary.dataset.next = 'menu';
    setPhase('result');
  }

  function showResultIdentify(scored, recognized) {
    resultEyebrow.classList.add('identify');
    resultEyebrow.classList.toggle('unknown', !recognized);
    resultHeadline.classList.add('identify');
    resultHeadline.classList.toggle('unknown', !recognized);

    if (recognized) {
      resultEyebrow.textContent = 'RECOGNIZED';
      resultHeadline.textContent = scored[0].profile.name;
      const c = (scored[0].conf * 100).toFixed(1);
      resultSub.textContent = `${c}% CONFIDENCE`;
      beeps.recognized();
    } else {
      resultEyebrow.textContent = 'UNCERTAIN';
      resultHeadline.textContent = 'UNKNOWN WEARER';
      resultSub.textContent = 'NO CLEAR MATCH';
      beeps.unknown();
    }

    rankingEl.innerHTML = '';
    rankingEl.classList.remove('hidden');
    scored.slice(0, 4).forEach((s, i) => {
      const row = document.createElement('div');
      row.className = 'rank-row' + (i === 0 && recognized ? ' top' : '');
      const pct = (s.conf * 100).toFixed(1) + '%';
      row.innerHTML = `
        <span class="rank-num">${i + 1}</span>
        <span class="rank-name">${s.profile.name}</span>
        <span class="rank-conf">${pct}</span>
      `;
      rankingEl.appendChild(row);
    });

    resultPrimary.textContent = 'DONE  ⏎';
    resultPrimary.dataset.next = 'menu';
    setPhase('result');
  }

  function resultPrimaryAction() {
    rebuildMenu();
    setPhase('menu');
    beeps.nav();
  }

  // ─── Profile overlay (TRAIN MORE / DELETE / CLOSE) ─────────────
  function openProfileOverlay(id) {
    activeProfileId = id;
    const p = profileById(id);
    overlayName.textContent = p.name;
    const reps = (p.reps || []).length;
    overlayStat.textContent = reps > 0
      ? `${reps} REP${reps === 1 ? '' : 'S'} · TRAINED`
      : 'NOT TRAINED';
    overlayCursor = 0;
    paintOverlayCursor();
    profileOverlay.classList.remove('hidden');
    beeps.pick();
  }
  function paintOverlayCursor() {
    const btns = overlayActions.querySelectorAll('button');
    btns.forEach((b, i) => b.classList.toggle('focused', i === overlayCursor));
  }
  function moveOverlay(delta) {
    const btns = overlayActions.querySelectorAll('button');
    overlayCursor = (overlayCursor + delta + btns.length) % btns.length;
    paintOverlayCursor();
    beeps.nav();
  }
  function activateOverlay() {
    const btns = overlayActions.querySelectorAll('button');
    const action = btns[overlayCursor].dataset.overlayAction;
    closeProfileOverlay();
    if (action === 'train') {
      captureMode = 'train';
      beginCaptureSession();
    } else if (action === 'delete') {
      openConfirmDelete(activeProfileId);
    } else if (action === 'close') {
      beeps.nav();
    }
  }
  function closeProfileOverlay() {
    profileOverlay.classList.add('hidden');
  }

  // ─── Confirm-delete overlay ────────────────────────────────────
  function openConfirmDelete(id) {
    pendingDeleteId = id;
    const p = profileById(id);
    confirmName.textContent = p ? p.name : '';
    confirmCursor = 0;
    paintConfirmCursor();
    confirmOverlay.classList.remove('hidden');
    beeps.pick();
  }
  function paintConfirmCursor() {
    const btns = confirmActions.querySelectorAll('button');
    btns.forEach((b, i) => b.classList.toggle('focused', i === confirmCursor));
  }
  function moveConfirm(delta) {
    const btns = confirmActions.querySelectorAll('button');
    confirmCursor = (confirmCursor + delta + btns.length) % btns.length;
    paintConfirmCursor();
    beeps.nav();
  }
  function activateConfirm() {
    const btns = confirmActions.querySelectorAll('button');
    const action = btns[confirmCursor].dataset.confirmAction;
    confirmOverlay.classList.add('hidden');
    if (action === 'delete') {
      profiles = profiles.filter((p) => p.id !== pendingDeleteId);
      saveProfiles();
      pendingDeleteId = null;
      rebuildMenu();
      beeps.captured();
    } else {
      beeps.nav();
    }
  }

  // ─── Click delegation ──────────────────────────────────────────
  document.addEventListener('click', (e) => {
    const ov = e.target.closest('[data-overlay-action]');
    if (ov) {
      const action = ov.dataset.overlayAction;
      const btns = overlayActions.querySelectorAll('button');
      const idx = Array.from(btns).indexOf(ov);
      if (idx >= 0) overlayCursor = idx;
      paintOverlayCursor();
      activateOverlay();
      return;
    }
    const cf = e.target.closest('[data-confirm-action]');
    if (cf) {
      const btns = confirmActions.querySelectorAll('button');
      const idx = Array.from(btns).indexOf(cf);
      if (idx >= 0) confirmCursor = idx;
      paintConfirmCursor();
      activateConfirm();
      return;
    }
    if (e.target.id === 'result-primary') {
      resultPrimaryAction();
      return;
    }
  });

  // ─── Key dispatch (↑ ↓ ← → ⏎ ONLY) ─────────────────────────────
  document.addEventListener('keydown', (e) => {
    const permOpen = !permOverlay.classList.contains('hidden');
    if (permOpen) {
      if (e.key === 'Enter') { e.preventDefault(); requestSensorPermission(); }
      return;
    }

    if (!profileOverlay.classList.contains('hidden')) {
      if (e.key === 'ArrowUp')      { e.preventDefault(); moveOverlay(-1); }
      else if (e.key === 'ArrowDown'){ e.preventDefault(); moveOverlay(+1); }
      else if (e.key === 'Enter')   { e.preventDefault(); activateOverlay(); }
      else if (e.key === 'ArrowLeft'){ e.preventDefault(); closeProfileOverlay(); beeps.nav(); }
      return;
    }
    if (!confirmOverlay.classList.contains('hidden')) {
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft')   { e.preventDefault(); moveConfirm(-1); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowRight'){ e.preventDefault(); moveConfirm(+1); }
      else if (e.key === 'Enter') { e.preventDefault(); activateConfirm(); }
      return;
    }

    if (phase === 'menu') {
      if (e.key === 'ArrowUp')        { e.preventDefault(); menuMove(-1); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); menuMove(+1); }
      else if (e.key === 'Enter')     { e.preventDefault(); ensureAudio(); menuActivate(); }
    } else if (phase === 'naming') {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); ensureAudio(); rerollName(); }
      else if (e.key === 'Enter') { e.preventDefault(); ensureAudio(); acceptName(); }
      else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        beeps.nav();
        rebuildMenu();
        setPhase('menu');
      }
    } else if (phase === 'capture') {
      if (e.key === 'Enter') {
        e.preventDefault(); ensureAudio();
        // Only start when in the 'ready' state. Otherwise ignore.
        if (!capReadyEl.classList.contains('hidden')) {
          startGesture();
        }
      }
    } else if (phase === 'result') {
      if (e.key === 'Enter') { e.preventDefault(); resultPrimaryAction(); }
    }
  });

  // ─── Init ──────────────────────────────────────────────────────
  rebuildMenu();
  setPhase('menu');
  if (!needsIosPerm) attachSensor();

})();
