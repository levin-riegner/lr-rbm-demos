(function () {
  'use strict';

  const HOLD_MS = 250;
  const ENGINE_URL = './vendor/doom-engine.js';
  const TAP_PULSE_MS = 40;
  const STRAFE_ENGAGE_DEG = 15;
  const STRAFE_RELEASE_DEG = 8;

  const els = {
    boot: document.getElementById('boot'),
    bootStatus: document.getElementById('boot-status'),
    bootProgress: document.getElementById('boot-progress-bar'),
    bootHint: document.getElementById('boot-hint'),
    startBtn: document.getElementById('start-btn'),
    game: document.getElementById('game'),
    mount: document.getElementById('dos-mount'),
    error: document.getElementById('error'),
    errorBody: document.getElementById('error-body'),
  };

  function setStatus(t) { els.bootStatus.textContent = t; }
  function setProgress(p) { els.bootProgress.style.width = (Math.max(0, Math.min(1, p)) * 100).toFixed(0) + '%'; }
  function setHint(t) { els.bootHint.textContent = t || ''; }
  function showScreen(name) {
    ['boot', 'game', 'error'].forEach((s) => els[s].classList.toggle('hidden', s !== name));
  }
  function fail(msg) {
    els.errorBody.textContent = msg;
    showScreen('error');
  }

  const KEYS = {
    forward:     { key: 'w',          code: 'KeyW',        keyCode: 87 },
    backward:    { key: 's',          code: 'KeyS',        keyCode: 83 },
    strafeLeft:  { key: 'a',          code: 'KeyA',        keyCode: 65 },
    strafeRight: { key: 'd',          code: 'KeyD',        keyCode: 68 },
    turnLeft:    { key: 'ArrowLeft',  code: 'ArrowLeft',   keyCode: 37 },
    turnRight:   { key: 'ArrowRight', code: 'ArrowRight',  keyCode: 39 },
    fire:        { key: 'Control',    code: 'ControlLeft', keyCode: 17 },
    select:      { key: 'Enter',      code: 'Enter',       keyCode: 13 },
    use:         { key: ' ',          code: 'Space',       keyCode: 32 },
    menu:        { key: 'Escape',     code: 'Escape',      keyCode: 27 },
  };

  function dispatchKey(type, spec) {
    const init = {
      key: spec.key,
      code: spec.code,
      keyCode: spec.keyCode,
      which: spec.keyCode,
      bubbles: true,
      cancelable: true,
    };
    const targets = [document, window, els.mount];
    const canvas = els.mount.querySelector('canvas');
    if (canvas) targets.push(canvas);
    for (const t of targets) {
      try { t.dispatchEvent(new KeyboardEvent(type, init)); } catch (_) {}
    }
  }

  const held = new Set();
  function press(action) {
    if (held.has(action)) return;
    held.add(action);
    dispatchKey('keydown', KEYS[action]);
  }
  function release(action) {
    if (!held.has(action)) return;
    held.delete(action);
    dispatchKey('keyup', KEYS[action]);
  }
  function tap(action) {
    dispatchKey('keydown', KEYS[action]);
    setTimeout(() => dispatchKey('keyup', KEYS[action]), TAP_PULSE_MS);
  }

  let enterHoldTimer = null;
  let enterFiredAsUse = false;

  function isOurSynthetic(e) {
    return !e.isTrusted;
  }

  function onKeyDown(e) {
    if (isOurSynthetic(e)) return;
    if (e.repeat) return;
    let handled = true;
    switch (e.key) {
      case 'ArrowUp':    press('forward'); break;
      case 'ArrowDown':  press('backward'); break;
      case 'ArrowLeft':  press('turnLeft'); break;
      case 'ArrowRight': press('turnRight'); break;
      case 'Enter':
        enterFiredAsUse = false;
        enterHoldTimer = setTimeout(() => {
          enterFiredAsUse = true;
          press('use');
        }, HOLD_MS);
        break;
      case 'Escape':     tap('menu'); break;
      default: handled = false;
    }
    if (handled) e.preventDefault();
  }

  function onKeyUp(e) {
    if (isOurSynthetic(e)) return;
    let handled = true;
    switch (e.key) {
      case 'ArrowUp':    release('forward'); break;
      case 'ArrowDown':  release('backward'); break;
      case 'ArrowLeft':  release('turnLeft'); break;
      case 'ArrowRight': release('turnRight'); break;
      case 'Enter':
        if (enterHoldTimer) { clearTimeout(enterHoldTimer); enterHoldTimer = null; }
        if (enterFiredAsUse) {
          release('use');
        } else {
          tap('fire');
          tap('select');
        }
        break;
      default: handled = false;
    }
    if (handled) e.preventDefault();
  }

  function unlockAudioContext() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const buf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
      if (ctx.state === 'suspended') ctx.resume();
    } catch (_) {}
  }

  function waitForStartTap() {
    return new Promise((resolve) => {
      els.startBtn.classList.remove('hidden');
      els.startBtn.focus();
      const handler = async function () {
        els.startBtn.removeEventListener('click', handler);
        els.startBtn.classList.add('hidden');
        unlockAudioContext();
        const orientationOK = await requestOrientationPermissionInGesture();
        resolve(orientationOK);
      };
      els.startBtn.addEventListener('click', handler);
    });
  }

  async function requestOrientationPermissionInGesture() {
    if (typeof DeviceOrientationEvent === 'undefined') return false;
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const r = await DeviceOrientationEvent.requestPermission();
        return r === 'granted';
      } catch (_) {
        return false;
      }
    }
    return true;
  }

  function bindInput() {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    bindTouchControls();
    bindCanvasGesture();
    bindStrafeOrientation();
  }

  let currentStrafe = null;

  function bindStrafeOrientation() {
    window.addEventListener('deviceorientation', onDeviceOrientation, true);
  }

  function onDeviceOrientation(e) {
    const gamma = e.gamma;
    if (gamma == null) return;
    if (gamma > STRAFE_ENGAGE_DEG && currentStrafe !== 'right') {
      if (currentStrafe === 'left') release('strafeLeft');
      press('strafeRight');
      currentStrafe = 'right';
    } else if (gamma < -STRAFE_ENGAGE_DEG && currentStrafe !== 'left') {
      if (currentStrafe === 'right') release('strafeRight');
      press('strafeLeft');
      currentStrafe = 'left';
    } else if (Math.abs(gamma) < STRAFE_RELEASE_DEG && currentStrafe !== null) {
      if (currentStrafe === 'left') release('strafeLeft');
      else release('strafeRight');
      currentStrafe = null;
    }
  }

  function bindTouchControls() {
    const dpad = {
      'touch-up': 'forward',
      'touch-down': 'backward',
      'touch-left': 'turnLeft',
      'touch-right': 'turnRight',
    };
    for (const id in dpad) {
      const btn = document.getElementById(id);
      if (!btn) continue;
      const action = dpad[id];
      const onDown = (e) => { e.preventDefault(); press(action); };
      const onUp = (e) => { e.preventDefault(); release(action); };
      btn.addEventListener('pointerdown', onDown);
      btn.addEventListener('pointerup', onUp);
      btn.addEventListener('pointercancel', onUp);
      btn.addEventListener('pointerleave', onUp);
    }

    const menuBtn = document.getElementById('touch-menu');
    if (menuBtn) {
      menuBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); tap('menu'); });
    }
  }

  let gestureLongPressTimer = null;
  let gestureLongPressActive = false;

  function bindCanvasGesture() {
    const target = document.querySelector('.dos-wrap');
    if (!target) return;
    target.addEventListener('pointerdown', onGestureDown);
    target.addEventListener('pointerup', onGestureUp);
    target.addEventListener('pointercancel', onGestureCancel);
    target.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  function onGestureDown(e) {
    e.preventDefault();
    gestureLongPressActive = false;
    gestureLongPressTimer = setTimeout(() => {
      gestureLongPressActive = true;
      press('use');
    }, HOLD_MS);
  }

  function onGestureUp(e) {
    e.preventDefault();
    if (gestureLongPressTimer) { clearTimeout(gestureLongPressTimer); gestureLongPressTimer = null; }
    if (gestureLongPressActive) {
      release('use');
    } else {
      tap('fire');
      tap('select');
    }
    gestureLongPressActive = false;
  }

  function onGestureCancel() {
    if (gestureLongPressTimer) { clearTimeout(gestureLongPressTimer); gestureLongPressTimer = null; }
    if (gestureLongPressActive) release('use');
    gestureLongPressActive = false;
  }

  function loadEngineScript() {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = ENGINE_URL;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Engine adapter not found at ' + ENGINE_URL + '.'));
      document.head.appendChild(s);
    });
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return Promise.resolve();
    return navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  async function boot() {
    showScreen('boot');
    setStatus('Registering service worker...');
    await registerServiceWorker();

    setStatus('Loading engine...');
    try {
      await loadEngineScript();
    } catch (e) {
      fail(e.message + ' See README.');
      return;
    }
    if (typeof window.startDoom !== 'function') {
      fail('Engine adapter loaded but window.startDoom is missing.');
      return;
    }

    setStatus('Tap to start');
    setProgress(0.4);
    const orientationOK = await waitForStartTap();
    if (!orientationOK) setHint('Lean-to-strafe disabled (no motion access).');

    setStatus('Starting DOSBox + DOOM...');
    showScreen('game');
    bindInput();
    setProgress(0.6);

    try {
      await window.startDoom({ container: els.mount });
    } catch (e) {
      fail('Engine failed to start: ' + (e && e.message ? e.message : String(e)));
      return;
    }

    setProgress(1);
  }

  boot();
})();
