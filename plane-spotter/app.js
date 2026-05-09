(function () {
  'use strict';

  var POLL_INTERVAL_MS = 15000;
  var SEARCH_RADIUS_KM = 50;
  var ON_TARGET_DEG = 8;
  var FOV_DEG = 60;
  var SCOPE_RADIUS_PX = 150;
  var DEMO_LAT = 37.7749;
  var DEMO_LON = -122.4194;

  var scopeEl = document.getElementById('scope');
  var horizonEl = document.getElementById('scope-horizon');
  var markerEl = document.getElementById('scope-marker');
  var markerGlyphEl = document.getElementById('scope-marker-glyph');
  var callsignEl = document.getElementById('callsign');
  var distEl = document.getElementById('dist');
  var altEl = document.getElementById('alt');
  var spdEl = document.getElementById('spd');
  var brgEl = document.getElementById('brg');
  var statusEl = document.getElementById('status');
  var toggleBtn = document.getElementById('btn-toggle');
  var demoBtn = document.getElementById('btn-demo');

  var state = {
    running: false,
    demo: false,
    userLat: null,
    userLon: null,
    geoWatchId: null,
    yaw: null,
    pitch: null,
    roll: null,
    yawOffset: 0,
    pitchOffset: 0,
    aircraft: null,
    pollTimer: 0,
  };

  function setStatus(text, live) {
    statusEl.textContent = text;
    if (live) statusEl.classList.add('live');
    else statusEl.classList.remove('live');
  }

  function fmtDist(m) {
    if (m == null || !isFinite(m)) return '--';
    if (m < 1000) return Math.round(m) + 'm';
    return (m / 1000).toFixed(1) + 'km';
  }

  function normalize180(deg) {
    return ((deg + 180) % 360 + 360) % 360 - 180;
  }

  function readYaw(e) {
    if (typeof e.webkitCompassHeading === 'number') return e.webkitCompassHeading;
    if (e.alpha == null) return null;
    return (360 - e.alpha + 360) % 360;
  }

  function onOrientation(e) {
    var yaw = readYaw(e);
    if (yaw == null) return;
    state.yaw = yaw;
    state.pitch = e.beta || 0;
    state.roll = e.gamma || 0;
    render();
  }

  function render() {
    var a = state.aircraft;

    if (state.roll != null) {
      horizonEl.style.transform = 'translateY(-50%) rotate(' + (-state.roll).toFixed(1) + 'deg)';
    }

    if (!a) {
      markerEl.classList.add('idle');
      markerEl.classList.remove('on-target');
      scopeEl.classList.remove('on-target', 'off-screen');
      markerGlyphEl.textContent = '▲';
      markerGlyphEl.style.transform = 'translate(-50%, -50%)';
      markerEl.style.transform = 'translate(0px, 0px)';
      callsignEl.textContent = '--------';
      distEl.textContent = '--';
      altEl.textContent = '--';
      spdEl.textContent = '--';
      brgEl.textContent = '--';
      return;
    }

    callsignEl.textContent = (a.callsign || a.icao24 || 'UNKNOWN').toString().trim() || a.icao24;
    distEl.textContent = fmtDist(a.distance);
    altEl.textContent = a.altitude != null ? Math.round(a.altitude) + 'm' : '--';
    spdEl.textContent = a.velocity != null ? Math.round(a.velocity) + 'm/s' : '--';
    brgEl.textContent = Math.round(a.bearing) + '°';

    if (state.yaw == null) {
      markerEl.classList.add('idle');
      markerEl.classList.remove('on-target');
      scopeEl.classList.remove('on-target', 'off-screen');
      markerEl.style.transform = 'translate(0px, 0px)';
      return;
    }

    var yaw = (state.yaw - state.yawOffset + 360) % 360;
    var pitch = state.pitch - state.pitchOffset;

    var yawDiff = normalize180(a.bearing - yaw);
    var pitchDiff = a.elevation - pitch;
    var mag = Math.sqrt(yawDiff * yawDiff + pitchDiff * pitchDiff);

    var x = (yawDiff / FOV_DEG) * SCOPE_RADIUS_PX;
    var y = (-pitchDiff / FOV_DEG) * SCOPE_RADIUS_PX;
    var radial = Math.sqrt(x * x + y * y);
    var offScreen = radial > SCOPE_RADIUS_PX - 18;

    var glyphRotateDeg = 0;
    if (offScreen) {
      var clampScale = (SCOPE_RADIUS_PX - 18) / radial;
      x *= clampScale;
      y *= clampScale;
      glyphRotateDeg = Math.atan2(yawDiff, pitchDiff) * 180 / Math.PI;
      markerGlyphEl.textContent = '➤';
    } else {
      markerGlyphEl.textContent = '▲';
    }

    markerEl.classList.remove('idle');
    markerEl.style.transform = 'translate(' + x.toFixed(1) + 'px, ' + y.toFixed(1) + 'px)';
    markerGlyphEl.style.transform = 'translate(-50%, -50%) rotate(' + glyphRotateDeg.toFixed(1) + 'deg)';

    scopeEl.classList.toggle('off-screen', offScreen);

    if (mag < ON_TARGET_DEG) {
      markerEl.classList.add('on-target');
      scopeEl.classList.add('on-target');
    } else {
      markerEl.classList.remove('on-target');
      scopeEl.classList.remove('on-target');
    }
  }

  function fetchAircraft() {
    if (state.userLat == null || state.userLon == null) return;
    var url = '/api/aircraft?lat=' + state.userLat
      + '&lon=' + state.userLon
      + '&radius=' + SEARCH_RADIUS_KM
      + (state.demo ? '&demo=1' : '');
    fetch(url).then(function (r) { return r.json(); }).then(function (data) {
      var picked = (data.aircraft && data.aircraft[0]) || null;
      state.aircraft = picked;
      if (!picked) {
        setStatus('No planes', false);
      } else if (data.source === 'demo' || data.source === 'demo-fallback') {
        setStatus(data.source === 'demo' ? 'Demo' : 'Demo*', true);
      } else {
        setStatus('Live', true);
      }
      render();
    }).catch(function () {
      setStatus('Net err', false);
    });
  }

  function ensurePolling() {
    if (state.pollTimer) return;
    fetchAircraft();
    state.pollTimer = setInterval(fetchAircraft, POLL_INTERVAL_MS);
  }

  function startGeo() {
    if (!navigator.geolocation) {
      setStatus('No GPS', false);
      return false;
    }
    state.geoWatchId = navigator.geolocation.watchPosition(function (pos) {
      state.userLat = pos.coords.latitude;
      state.userLon = pos.coords.longitude;
      ensurePolling();
    }, function () {
      setStatus('GPS err', false);
    }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 });
    return true;
  }

  function stopGeo() {
    if (state.geoWatchId != null) {
      navigator.geolocation.clearWatch(state.geoWatchId);
      state.geoWatchId = null;
    }
    if (state.pollTimer) {
      clearInterval(state.pollTimer);
      state.pollTimer = 0;
    }
  }

  function attachOrientation() {
    window.addEventListener('deviceorientation', onOrientation);
  }

  function detachOrientation() {
    window.removeEventListener('deviceorientation', onOrientation);
  }

  function beginRunning() {
    state.running = true;
    toggleBtn.textContent = 'Stop';
    setStatus('Locating', false);
    if (state.demo && state.userLat == null) {
      state.userLat = DEMO_LAT;
      state.userLon = DEMO_LON;
      ensurePolling();
    } else {
      startGeo();
    }
    attachOrientation();
  }

  function start() {
    if (state.running) return;
    if (typeof DeviceOrientationEvent !== 'undefined'
        && typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission().then(function (result) {
        if (result === 'granted') beginRunning();
        else setStatus('Denied', false);
      }).catch(function () { setStatus('Error', false); });
    } else {
      beginRunning();
    }
  }

  function stop() {
    if (!state.running) return;
    state.running = false;
    toggleBtn.textContent = 'Start';
    detachOrientation();
    stopGeo();
    state.aircraft = null;
    setStatus('Idle', false);
    render();
  }

  function calibrate() {
    if (state.yaw != null) state.yawOffset = state.yaw;
    if (state.pitch != null) state.pitchOffset = state.pitch;
    render();
  }

  function toggleDemo() {
    state.demo = !state.demo;
    demoBtn.textContent = state.demo ? 'Demo On' : 'Demo';
    if (!state.running) return;
    if (state.demo && state.userLat == null) {
      state.userLat = DEMO_LAT;
      state.userLon = DEMO_LON;
    }
    fetchAircraft();
  }

  function handleAction(action) {
    if (action === 'toggle') {
      if (state.running) stop(); else start();
    } else if (action === 'demo') {
      toggleDemo();
    } else if (action === 'calibrate') {
      calibrate();
    }
  }

  function initFocusNav() {
    var focusables = Array.prototype.slice.call(document.querySelectorAll('.focusable'));
    if (!focusables.length) return;
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
      } else if (e.key === 'Escape') {
        if (state.running) {
          e.preventDefault();
          stop();
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
    setStatus('Idle', false);
    render();
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
