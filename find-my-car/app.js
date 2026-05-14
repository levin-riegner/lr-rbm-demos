(function () {
  'use strict';

  const STORAGE_KEY = 'find-my-car.savedSpot';

  // ---- State ----
  const state = {
    mode: 'home',          // 'home' | 'nav'
    saved: null,           // { lat, lng, ts, accuracy }
    current: null,         // { lat, lng, accuracy }
    heading: null,         // degrees 0..360 from north
    watchId: null,
    orientationHandler: null
  };

  // ---- DOM ----
  const screens = {
    home: document.getElementById('home'),
    nav:  document.getElementById('nav')
  };
  const savedInfoEl   = document.getElementById('savedInfo');
  const navigateBtn   = document.getElementById('navigateBtn');
  const clearBtn      = document.getElementById('clearBtn');
  const homeBanner    = document.getElementById('homeBanner');
  const navBanner     = document.getElementById('navBanner');
  const distanceEl    = document.getElementById('distance');
  const headingEl     = document.getElementById('heading');
  const bearingEl     = document.getElementById('bearing');
  const accuracyEl    = document.getElementById('accuracy');
  const arrowEl       = document.getElementById('arrow');
  const enableCompass = document.getElementById('enableCompassBtn');

  // ---- Focus management ----
  function getFocusables() {
    const active = document.querySelector('.screen:not(.hidden)');
    if (!active) return [];
    return Array.from(active.querySelectorAll('[data-focusable]')).filter(el => !el.hidden);
  }
  function focusFirst() {
    const items = getFocusables();
    if (items.length) items[0].focus();
  }
  function moveFocus(delta) {
    const items = getFocusables();
    if (items.length === 0) return;
    const current = items.indexOf(document.activeElement);
    const next = (current < 0 ? 0 : current + delta + items.length) % items.length;
    items[next].focus();
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); moveFocus(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveFocus(-1); }
    else if (e.key === 'Enter' || e.key === ' ') {
      const el = document.activeElement;
      if (el && el.matches('[data-focusable]')) { e.preventDefault(); el.click(); }
    }
  });

  // ---- Storage ----
  function loadSaved() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      state.saved = raw ? JSON.parse(raw) : null;
    } catch (_) { state.saved = null; }
  }
  function persistSaved() {
    if (state.saved) localStorage.setItem(STORAGE_KEY, JSON.stringify(state.saved));
    else localStorage.removeItem(STORAGE_KEY);
  }

  // ---- Banners ----
  function showBanner(el, text, kind) {
    if (!text) { el.hidden = true; el.textContent = ''; return; }
    el.hidden = false;
    el.textContent = text;
    el.classList.toggle('info', kind === 'info');
  }

  // ---- Geolocation errors ----
  function describeGeoError(err) {
    if (!err) return 'Unknown location error.';
    if (err.code === 1) return 'Location permission denied. Enable location access for this site in your browser settings to use Find My Car.';
    if (err.code === 2) return 'Location unavailable. Move to a spot with a clearer GPS signal.';
    if (err.code === 3) return 'Location request timed out. Try again.';
    return err.message || 'Location error.';
  }

  // ---- Home screen ----
  function renderHome() {
    if (state.saved) {
      const when = new Date(state.saved.ts).toLocaleString();
      savedInfoEl.innerHTML =
        `Saved <strong>${state.saved.lat.toFixed(5)}, ${state.saved.lng.toFixed(5)}</strong><br>` +
        `<span style="color:#8B93A3">${when}</span>`;
      navigateBtn.hidden = false;
      clearBtn.hidden = false;
    } else {
      savedInfoEl.textContent = 'No parking location saved. Park, then tap "Park Here" to remember this spot.';
      navigateBtn.hidden = true;
      clearBtn.hidden = true;
    }
    focusFirst();
  }

  function parkHere() {
    showBanner(homeBanner, 'Getting location…', 'info');
    if (!navigator.geolocation) {
      showBanner(homeBanner, 'Geolocation is not supported by this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        state.saved = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          ts: Date.now()
        };
        persistSaved();
        showBanner(homeBanner, `Saved. Accuracy ±${Math.round(pos.coords.accuracy)} m.`, 'info');
        renderHome();
      },
      (err) => {
        showBanner(homeBanner, describeGeoError(err));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  function clearSpot() {
    state.saved = null;
    persistSaved();
    showBanner(homeBanner, 'Saved spot cleared.', 'info');
    renderHome();
  }

  // ---- Nav screen ----
  function enterNav() {
    if (!state.saved) return;
    setScreen('nav');
    startWatch();
    startCompass();
  }

  function leaveNav() {
    stopWatch();
    stopCompass();
    setScreen('home');
    renderHome();
  }

  function setScreen(mode) {
    state.mode = mode;
    Object.entries(screens).forEach(([name, el]) => {
      el.classList.toggle('hidden', name !== mode);
    });
    focusFirst();
  }

  function startWatch() {
    showBanner(navBanner, null);
    if (!navigator.geolocation) {
      showBanner(navBanner, 'Geolocation is not supported by this browser.');
      return;
    }
    state.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        state.current = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        };
        showBanner(navBanner, null);
        updateNavUI();
      },
      (err) => {
        showBanner(navBanner, describeGeoError(err));
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 }
    );
  }

  function stopWatch() {
    if (state.watchId != null) {
      navigator.geolocation.clearWatch(state.watchId);
      state.watchId = null;
    }
  }

  // ---- Compass ----
  function startCompass() {
    const needsPermission =
      typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function';

    if (needsPermission) {
      // iOS 13+ requires a user gesture via a button
      enableCompass.hidden = false;
      showBanner(navBanner, 'Tap "Enable compass" to allow heading data.', 'info');
      return;
    }

    attachOrientationListener();
  }

  function attachOrientationListener() {
    if (!('DeviceOrientationEvent' in window)) {
      showBanner(navBanner, 'Compass sensors unavailable on this device. Arrow direction may be absolute only.');
      return;
    }
    const handler = (e) => {
      // webkitCompassHeading: iOS, already relative to true north, clockwise
      // alpha: 0..360 relative to device coord frame; many browsers = 0 at north (inverted axis)
      let h = null;
      if (typeof e.webkitCompassHeading === 'number') {
        h = e.webkitCompassHeading;
      } else if (typeof e.alpha === 'number') {
        h = (360 - e.alpha) % 360;
      }
      if (h != null) {
        state.heading = h;
        updateNavUI();
      }
    };
    state.orientationHandler = handler;
    window.addEventListener('deviceorientationabsolute', handler, true);
    window.addEventListener('deviceorientation', handler, true);
    enableCompass.hidden = true;
  }

  function stopCompass() {
    if (state.orientationHandler) {
      window.removeEventListener('deviceorientationabsolute', state.orientationHandler, true);
      window.removeEventListener('deviceorientation', state.orientationHandler, true);
      state.orientationHandler = null;
    }
    state.heading = null;
  }

  async function requestOrientationPermission() {
    try {
      const res = await DeviceOrientationEvent.requestPermission();
      if (res === 'granted') {
        attachOrientationListener();
        showBanner(navBanner, null);
      } else {
        showBanner(navBanner, 'Compass permission denied. Arrow will not rotate with your facing direction.');
      }
    } catch (err) {
      showBanner(navBanner, `Could not enable compass: ${err?.message || err}`);
    }
  }

  // ---- Geometry ----
  function toRad(d) { return d * Math.PI / 180; }
  function toDeg(r) { return r * 180 / Math.PI; }

  function haversineMeters(a, b) {
    const R = 6371000;
    const φ1 = toRad(a.lat), φ2 = toRad(b.lat);
    const dφ = toRad(b.lat - a.lat);
    const dλ = toRad(b.lng - a.lng);
    const s = Math.sin(dφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(dλ/2)**2;
    return 2 * R * Math.asin(Math.sqrt(s));
  }

  function bearingDegrees(from, to) {
    const φ1 = toRad(from.lat), φ2 = toRad(to.lat);
    const λ1 = toRad(from.lng), λ2 = toRad(to.lng);
    const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
    const x = Math.cos(φ1)*Math.sin(φ2) - Math.sin(φ1)*Math.cos(φ2)*Math.cos(λ2 - λ1);
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
  }

  function formatDistance(m) {
    if (m == null || !isFinite(m)) return '— M';
    if (m < 1000) return `${Math.round(m)} M`;
    return `${(m/1000).toFixed(2)} KM`;
  }

  // ---- Render nav ----
  function updateNavUI() {
    if (!state.saved || !state.current) {
      distanceEl.textContent = '— M';
      bearingEl.textContent = '—°';
      headingEl.textContent = state.heading != null ? `${Math.round(state.heading)}°` : '—°';
      accuracyEl.textContent = state.current ? `±${Math.round(state.current.accuracy)} m` : '—';
      return;
    }
    const dist = haversineMeters(state.current, state.saved);
    const bearing = bearingDegrees(state.current, state.saved);
    const rotation = state.heading != null ? (bearing - state.heading) : bearing;

    arrowEl.style.transform = `rotate(${rotation}deg)`;
    arrowEl.classList.toggle('pointing-at-target', dist < 5);

    distanceEl.textContent = formatDistance(dist);
    bearingEl.textContent = `${Math.round(bearing)}°`;
    headingEl.textContent = state.heading != null ? `${Math.round(state.heading)}°` : '—°';
    accuracyEl.textContent = `±${Math.round(state.current.accuracy)} m`;
  }

  // ---- Actions ----
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const a = el.dataset.action;
    if (a === 'park') parkHere();
    else if (a === 'navigate') enterNav();
    else if (a === 'clear') clearSpot();
    else if (a === 'back') leaveNav();
    else if (a === 'enableCompass') requestOrientationPermission();
  });

  // ---- Init ----
  loadSaved();
  renderHome();
})();
