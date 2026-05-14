(function () {
  'use strict';

  var STORAGE_KEY = 'mrbd.speedometer.v1';
  var GRAVITY_ALPHA = 0.995;
  var STATIONARY_THRESHOLD = 0.12;
  var DECAY_RATE = 0.08;
  var MAX_DT = 0.1;
  var MAX_SPEED = 100;

  var speedValueEl = document.getElementById('speed-value');
  var topSpeedEl = document.getElementById('top-speed');
  var statusEl = document.getElementById('status');
  var toggleSensorBtn = document.getElementById('btn-toggle-sensor');
  var toggleSimBtn = document.getElementById('btn-toggle-sim');
  var levelBubbleEl = document.getElementById('level-bubble');
  var LEVEL_MAX_DEG = 25;
  var LEVEL_MAX_PX = 120;
  var LEVEL_TOLERANCE = 3;

  var state = {
    speed: 0,
    topSpeed: 0,
    gravity: { x: 0, y: 0, z: 0 },
    lastTs: 0,
    simRunning: false,
    simRafId: 0,
    simStartMs: 0,
    sensorRunning: false,
    levelRef: null,
  };

  function loadTopSpeed() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { topSpeed: 0, updatedAt: null };
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed.topSpeed === 'number' && isFinite(parsed.topSpeed)) {
        return parsed;
      }
    } catch (e) {}
    return { topSpeed: 0, updatedAt: null };
  }

  function saveTopSpeed(topSpeed) {
    var record = { topSpeed: topSpeed, updatedAt: new Date().toISOString() };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
    } catch (e) {}
  }

  function clearTopSpeed() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
  }

  function renderSpeed() {
    speedValueEl.textContent = state.speed.toFixed(1);
    topSpeedEl.textContent = state.topSpeed.toFixed(1);
  }

  function setStatus(text, live) {
    statusEl.textContent = text;
    if (live) {
      statusEl.classList.add('live');
    } else {
      statusEl.classList.remove('live');
    }
  }

  function integrateAcceleration(ax, ay, az, nowMs) {
    state.gravity.x = GRAVITY_ALPHA * state.gravity.x + (1 - GRAVITY_ALPHA) * ax;
    state.gravity.y = GRAVITY_ALPHA * state.gravity.y + (1 - GRAVITY_ALPHA) * ay;
    state.gravity.z = GRAVITY_ALPHA * state.gravity.z + (1 - GRAVITY_ALPHA) * az;

    var lx = ax - state.gravity.x;
    var ly = ay - state.gravity.y;
    var lz = az - state.gravity.z;
    var horizMag = Math.sqrt(lx * lx + ly * ly);
    var forward = lx;

    if (state.lastTs === 0) {
      state.lastTs = nowMs;
      return;
    }
    var dt = (nowMs - state.lastTs) / 1000;
    state.lastTs = nowMs;
    if (dt <= 0 || dt > MAX_DT) return;

    if (horizMag < STATIONARY_THRESHOLD) {
      state.speed *= Math.exp(-DECAY_RATE * dt);
    } else {
      state.speed += forward * dt;
    }

    if (state.speed < 0) state.speed = 0;
    if (state.speed > MAX_SPEED) state.speed = MAX_SPEED;
    if (state.speed > state.topSpeed) {
      state.topSpeed = state.speed;
      saveTopSpeed(state.topSpeed);
    }
    renderSpeed();
  }

  function onDeviceMotion(evt) {
    var a = evt.accelerationIncludingGravity;
    if (!a || a.x == null) return;
    integrateAcceleration(a.x || 0, a.y || 0, a.z || 0, performance.now());
  }

  function onDeviceOrientation(evt) {
    var gamma = evt.gamma;
    if (gamma == null) return;
    if (state.levelRef == null) state.levelRef = gamma;
    var dx = gamma - state.levelRef;
    var clamped = Math.max(-LEVEL_MAX_DEG, Math.min(LEVEL_MAX_DEG, dx));
    var tx = (clamped / LEVEL_MAX_DEG) * LEVEL_MAX_PX;
    levelBubbleEl.style.transform = 'translateX(' + tx.toFixed(1) + 'px)';
    if (Math.abs(dx) < LEVEL_TOLERANCE) levelBubbleEl.classList.add('level');
    else levelBubbleEl.classList.remove('level');
  }

  function attachMotionListener() {
    window.addEventListener('devicemotion', onDeviceMotion);
    window.addEventListener('deviceorientation', onDeviceOrientation);
    state.sensorRunning = true;
    state.lastTs = 0;
    state.gravity = { x: 0, y: 0, z: 0 };
    toggleSensorBtn.textContent = 'Stop';
    setStatus('Live', true);
  }

  function startSensor() {
    if (state.sensorRunning) return;
    if (state.simRunning) stopSim();
    if (typeof window.DeviceMotionEvent === 'undefined') {
      setStatus('No sensor', false);
      return;
    }
    if (typeof window.DeviceMotionEvent.requestPermission === 'function') {
      window.DeviceMotionEvent.requestPermission().then(function (result) {
        if (result === 'granted') attachMotionListener();
        else setStatus('Denied', false);
      }).catch(function () {
        setStatus('Error', false);
      });
    } else {
      attachMotionListener();
    }
  }

  function stopSensor() {
    if (!state.sensorRunning) return;
    window.removeEventListener('devicemotion', onDeviceMotion);
    window.removeEventListener('deviceorientation', onDeviceOrientation);
    state.sensorRunning = false;
    state.speed = 0;
    state.levelRef = null;
    levelBubbleEl.style.transform = 'translateX(0px)';
    levelBubbleEl.classList.remove('level');
    toggleSensorBtn.textContent = 'Start';
    setStatus('Idle', false);
    renderSpeed();
  }

  function toggleSensor() {
    if (state.sensorRunning) stopSensor(); else startSensor();
  }

  function simulatedAcceleration(tSec) {
    var g = 9.81;
    var cycle = tSec % 32;
    var forward;
    if (cycle < 8) forward = 1.4;
    else if (cycle < 20) forward = 0;
    else if (cycle < 27) forward = -1.6;
    else forward = 0;
    forward += (Math.random() - 0.5) * 0.12;
    return { x: forward, y: 0, z: g };
  }

  function simTick(ts) {
    if (!state.simRunning) return;
    var tSec = (ts - state.simStartMs) / 1000;
    var a = simulatedAcceleration(tSec);
    integrateAcceleration(a.x, a.y, a.z, ts);
    state.simRafId = requestAnimationFrame(simTick);
  }

  function startSim() {
    if (state.sensorRunning) stopSensor();
    state.simRunning = true;
    state.simStartMs = performance.now();
    state.lastTs = 0;
    state.gravity = { x: 0, y: 0, z: 0 };
    toggleSimBtn.textContent = 'Stop Sim';
    setStatus('Sim', true);
    state.simRafId = requestAnimationFrame(simTick);
  }

  function stopSim() {
    state.simRunning = false;
    if (state.simRafId) {
      cancelAnimationFrame(state.simRafId);
      state.simRafId = 0;
    }
    toggleSimBtn.textContent = 'Sim';
    state.speed = 0;
    renderSpeed();
    setStatus('Idle', false);
  }

  function toggleSim() {
    if (state.simRunning) stopSim(); else startSim();
  }

  function resetTop() {
    state.topSpeed = 0;
    clearTopSpeed();
    renderSpeed();
  }

  function handleAction(action) {
    if (action === 'toggle-sensor') toggleSensor();
    else if (action === 'toggle-sim') toggleSim();
    else if (action === 'reset') resetTop();
  }

  function initFocusNav() {
    var focusables = Array.prototype.slice.call(document.querySelectorAll('.focusable'));
    if (focusables.length === 0) return;
    focusables[0].focus();

    document.addEventListener('keydown', function (e) {
      var current = document.activeElement;
      var idx = focusables.indexOf(current);
      if (idx === -1) idx = 0;

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        focusables[(idx + 1) % focusables.length].focus();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        focusables[(idx - 1 + focusables.length) % focusables.length].focus();
      } else if (e.key === 'Enter' || e.key === ' ') {
        if (current && current.dataset && current.dataset.action) {
          e.preventDefault();
          handleAction(current.dataset.action);
        }
      }
    });

    focusables.forEach(function (el) {
      el.addEventListener('click', function () {
        if (el.dataset && el.dataset.action) handleAction(el.dataset.action);
      });
    });
  }

  function updateScale() {
    var s = Math.min(window.innerWidth / 600, window.innerHeight / 600);
    if (s > 1) s = 1;
    document.documentElement.style.setProperty('--app-scale', String(s));
  }

  function init() {
    var stored = loadTopSpeed();
    state.topSpeed = stored.topSpeed || 0;
    renderSpeed();
    setStatus('Idle', false);
    initFocusNav();
    updateScale();
    window.addEventListener('resize', updateScale);
    window.addEventListener('orientationchange', updateScale);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
