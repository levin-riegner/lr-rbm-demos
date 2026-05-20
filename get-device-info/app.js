'use strict';

/* ============================================================
   DEVICE INFO — vanilla D-pad app
   ============================================================ */

// ─── Navigation stack ───────────────────────────────────────
const screenStack = [];

function navigateTo(id) {
  const current = screenStack[screenStack.length - 1];
  if (current) document.getElementById(current).classList.add('hidden');
  screenStack.push(id);
  const next = document.getElementById(id);
  next.classList.remove('hidden');
  onScreenEnter(id);
  focusFirst(next);
}

function navigateBack() {
  if (screenStack.length <= 1) return;
  const current = screenStack.pop();
  document.getElementById(current).classList.add('hidden');
  const prev = screenStack[screenStack.length - 1];
  const el = document.getElementById(prev);
  el.classList.remove('hidden');
  focusFirst(el);
}

function focusFirst(screen) {
  const el = screen.querySelector('.focusable');
  if (el) el.focus();
}

function onScreenEnter(id) {
  switch (id) {
    case 'home':         renderHomeTime(); break;
    case 'browser':      renderBrowser(); break;
    case 'useragent':    renderUserAgent(); break;
    case 'screen-info':  renderScreenInfo(); break;
    case 'network':      renderNetwork(); break;
    case 'hardware':     renderHardware(); break;
    case 'performance':  renderPerformance(); break;
    case 'apis':         renderApis(); break;
    case 'location':     renderLocationPlaceholder(); break;
  }
}

// ─── HTML helpers ───────────────────────────────────────────
function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'
  }[c]));
}

function row(label, value, opts = {}) {
  const v = value === undefined || value === null || value === '' ? '—' : value;
  const cls = opts.mono ? 'info-value mono' : 'info-value';
  // value may already contain spans (good/bad/muted) — don't escape it
  const safeValue = opts.raw ? v : esc(v);
  // Every row is focusable: on glasses, scroll happens via D-pad moving focus
  // through items and scrollIntoView bringing them into view. Without this,
  // the user can't scroll past the first viewport of content.
  return `<div class="info-row focusable" tabindex="0">
    <span class="info-label">${esc(label)}</span>
    <span class="${cls}">${safeValue}</span>
  </div>`;
}

function section(title) {
  return `<div class="section-title">${esc(title)}</div>`;
}

function yes() { return '<span class="good">Yes</span>'; }
function no()  { return '<span class="bad">No</span>'; }
function yn(v) { return v ? yes() : no(); }
function muted(s) { return `<span class="muted">${esc(s)}</span>`; }

function bytes(b) {
  if (b == null) return '—';
  const gb = b / (1024 ** 3);
  if (gb >= 1) return gb.toFixed(2) + ' GB';
  const mb = b / (1024 ** 2);
  if (mb >= 1) return mb.toFixed(1) + ' MB';
  return (b / 1024).toFixed(1) + ' KB';
}

function parseUA(ua) {
  const patterns = [
    { name: 'Edge',    re: /Edg\/([\d.]+)/ },
    { name: 'Opera',   re: /OPR\/([\d.]+)/ },
    { name: 'Chrome',  re: /Chrome\/([\d.]+)/ },
    { name: 'Firefox', re: /Firefox\/([\d.]+)/ },
    { name: 'Safari',  re: /Version\/([\d.]+).*Safari/ },
  ];
  for (const p of patterns) {
    const m = ua.match(p.re);
    if (m) return { name: p.name, version: m[1] };
  }
  return { name: 'Unknown', version: '—' };
}

function getEngine(ua) {
  if (/Gecko\/\d/.test(ua) && !/like Gecko/.test(ua)) {
    return { name: 'Gecko', version: (ua.match(/rv:([\d.]+)/) || [])[1] || '—' };
  }
  if (/AppleWebKit\/([\d.]+)/.test(ua)) {
    return { name: 'WebKit', version: (ua.match(/AppleWebKit\/([\d.]+)/) || [])[1] };
  }
  return { name: 'Unknown', version: '—' };
}

// ─── Renderers ──────────────────────────────────────────────
function renderHomeTime() {
  const el = document.getElementById('home-time');
  if (el) el.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function renderBrowser() {
  const nav = navigator;
  const ua = nav.userAgent;
  const browser = parseUA(ua);
  const engine = getEngine(ua);

  let html = '';
  html += section('Identity');
  html += row('Browser', browser.name);
  html += row('Version', browser.version);
  html += row('Engine', engine.name);
  html += row('Engine version', engine.version);

  html += section('Navigator');
  html += row('App name', nav.appName);
  html += row('Product', nav.product);
  html += row('Vendor', nav.vendor || '(none)');
  html += row('Platform', nav.platform || '(none)');
  html += row('Language', nav.language);
  html += row('Languages', (nav.languages || []).join(', '));
  html += row('Do Not Track', nav.doNotTrack || '(unset)');
  html += row('Cookie enabled', yn(nav.cookieEnabled), { raw: true });
  html += row('Online', yn(nav.onLine), { raw: true });
  html += row('PDF viewer', nav.pdfViewerEnabled !== undefined ? yn(nav.pdfViewerEnabled) : muted('—'), { raw: true });

  html += section('Window');
  html += row('Inner size', `${window.innerWidth} × ${window.innerHeight}`);
  html += row('Outer size', `${window.outerWidth} × ${window.outerHeight}`);
  html += row('Device pixel ratio', window.devicePixelRatio.toFixed(2));

  document.getElementById('browser-content').innerHTML = html;
}

function renderUserAgent() {
  const ua = navigator.userAgent;

  let html = '';
  html += section('Raw user agent');
  html += row('User-Agent', ua, { mono: true });

  const uaCH = navigator.userAgentData;
  if (uaCH) {
    html += section('UA Client Hints');
    html += row('Brands', (uaCH.brands || []).map(b => `${b.brand} ${b.version}`).join(' · '));
    html += row('Mobile', yn(uaCH.mobile), { raw: true });
    html += row('Platform', uaCH.platform || '—');
  } else {
    html += section('UA Client Hints');
    html += row('Status', muted('Not supported'), { raw: true });
  }

  html += section('Parsed');
  const browser = parseUA(ua);
  const engine = getEngine(ua);
  html += row('Browser', `${browser.name} ${browser.version}`);
  html += row('Engine', `${engine.name} ${engine.version}`);
  html += row('Mobile UA pattern', yn(/Mobi|Android|iPhone|iPad/i.test(ua)), { raw: true });

  document.getElementById('useragent-content').innerHTML = html;

  // Fetch high-entropy values asynchronously and append
  if (uaCH && uaCH.getHighEntropyValues) {
    uaCH.getHighEntropyValues([
      'architecture', 'bitness', 'model', 'platformVersion',
      'fullVersionList', 'uaFullVersion', 'wow64'
    ]).then(v => {
      let extra = section('High-Entropy hints');
      extra += row('Architecture', v.architecture || '—');
      extra += row('Bitness', v.bitness || '—');
      extra += row('Model', v.model || '(none)');
      extra += row('Platform version', v.platformVersion || '—');
      extra += row('UA full version', v.uaFullVersion || '—');
      if (v.fullVersionList) {
        extra += row('Full version list', v.fullVersionList.map(b => `${b.brand} ${b.version}`).join(' · '));
      }
      document.getElementById('useragent-content').insertAdjacentHTML('beforeend', extra);
    }).catch(() => {});
  }
}

function renderScreenInfo() {
  const s = screen;
  const w = window;
  const mq = q => window.matchMedia(q).matches;

  let html = '';
  html += section('Screen');
  html += row('Resolution', `${s.width} × ${s.height}`);
  html += row('Available', `${s.availWidth} × ${s.availHeight}`);
  html += row('Color depth', `${s.colorDepth}-bit`);
  html += row('Pixel depth', `${s.pixelDepth}-bit`);
  if (s.orientation) {
    html += row('Orientation', `${s.orientation.type} (${s.orientation.angle}°)`);
  }

  html += section('Window');
  html += row('Inner', `${w.innerWidth} × ${w.innerHeight}`);
  html += row('Outer', `${w.outerWidth} × ${w.outerHeight}`);
  html += row('Device pixel ratio', w.devicePixelRatio.toFixed(2));
  html += row('Fullscreen', yn(!!document.fullscreenElement), { raw: true });

  html += section('Document');
  html += row('Scroll size', `${document.documentElement.scrollWidth} × ${document.documentElement.scrollHeight}`);
  html += row('Client size', `${document.documentElement.clientWidth} × ${document.documentElement.clientHeight}`);

  html += section('Media queries');
  html += row('Prefers dark', yn(mq('(prefers-color-scheme: dark)')), { raw: true });
  html += row('Reduced motion', yn(mq('(prefers-reduced-motion: reduce)')), { raw: true });
  html += row('HDR (high dynamic range)', yn(mq('(dynamic-range: high)')), { raw: true });
  html += row('Pointer: fine', yn(mq('(pointer: fine)')), { raw: true });
  html += row('Pointer: coarse', yn(mq('(pointer: coarse)')), { raw: true });
  html += row('Hover', yn(mq('(hover: hover)')), { raw: true });
  html += row('Retina (≥2x)', yn(mq('(-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi)')), { raw: true });

  document.getElementById('screen-info-content').innerHTML = html;
}

function renderNetwork() {
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

  let html = '';
  html += section('Status');
  html += row('Online', yn(navigator.onLine), { raw: true });

  html += section('Connection');
  if (conn) {
    html += row('Type', conn.type || '—');
    html += row('Effective type', conn.effectiveType || '—');
    if (conn.downlink !== undefined) html += row('Downlink', `${conn.downlink} Mbps`);
    if (conn.rtt !== undefined)      html += row('Round-trip time', `${conn.rtt} ms`);
    html += row('Save data', yn(!!conn.saveData), { raw: true });
  } else {
    html += row('Network Info API', muted('Not supported'), { raw: true });
  }

  html += section('Page URL');
  html += row('Origin', location.origin, { mono: true });
  html += row('Protocol', location.protocol);
  html += row('Host', location.host);
  html += row('Pathname', location.pathname, { mono: true });
  if (location.hash) html += row('Hash', location.hash, { mono: true });

  html += section('Referrer');
  html += row('Document referrer', document.referrer || '(none)', { mono: true });

  document.getElementById('network-content').innerHTML = html;
}

function renderHardware() {
  const nav = navigator;

  let html = '';
  html += section('CPU & Memory');
  html += row('Logical CPU cores', nav.hardwareConcurrency || '—');
  html += row('Device memory', nav.deviceMemory !== undefined ? `${nav.deviceMemory} GB` : '—');
  html += row('Max touch points', nav.maxTouchPoints);

  html += section('Battery');
  html += `<div class="row-group" id="battery-mount">${row('Status', muted('Loading…'), { raw: true })}</div>`;

  html += section('Storage');
  html += `<div class="row-group" id="storage-mount">${row('Status', muted('Loading…'), { raw: true })}</div>`;

  html += section('Plugins');
  const plugins = Array.from(nav.plugins || []);
  if (plugins.length) {
    plugins.slice(0, 6).forEach(p => { html += row(p.name, p.filename || '(no filename)', { mono: true }); });
  } else {
    html += row('Plugins', muted('None / not exposed'), { raw: true });
  }

  document.getElementById('hardware-content').innerHTML = html;

  // Battery (async)
  if (nav.getBattery) {
    nav.getBattery().then(b => {
      let battHTML = '';
      battHTML += row('Charging', yn(b.charging), { raw: true });
      battHTML += row('Level', `${Math.round(b.level * 100)}%`);
      if (b.chargingTime !== Infinity) battHTML += row('Time to full', `${b.chargingTime}s`);
      if (b.dischargingTime !== Infinity) battHTML += row('Time to empty', `${b.dischargingTime}s`);
      const mount = document.getElementById('battery-mount');
      if (mount) mount.innerHTML = battHTML;
    }).catch(() => {
      const mount = document.getElementById('battery-mount');
      if (mount) mount.innerHTML = row('Battery API', muted('Failed to read'), { raw: true });
    });
  } else {
    const mount = document.getElementById('battery-mount');
    if (mount) mount.innerHTML = row('Battery API', muted('Not supported'), { raw: true });
  }

  // Storage (async)
  if (navigator.storage && navigator.storage.estimate) {
    navigator.storage.estimate().then(est => {
      let storeHTML = '';
      storeHTML += row('Used', bytes(est.usage));
      storeHTML += row('Quota', bytes(est.quota));
      if (est.quota) {
        const pct = ((est.usage / est.quota) * 100).toFixed(2);
        storeHTML += row('Used %', `${pct}%`);
      }
      const mount = document.getElementById('storage-mount');
      if (mount) mount.innerHTML = storeHTML;
    }).catch(() => {
      const mount = document.getElementById('storage-mount');
      if (mount) mount.innerHTML = row('Storage estimate', muted('Failed to read'), { raw: true });
    });
  } else {
    const mount = document.getElementById('storage-mount');
    if (mount) mount.innerHTML = row('Storage estimate', muted('Not supported'), { raw: true });
  }
}

function renderPerformance() {
  const perf = window.performance;

  let html = '';
  html += section('Page timing');
  const navEntries = perf && perf.getEntriesByType ? perf.getEntriesByType('navigation') : [];
  if (navEntries.length) {
    const n = navEntries[0];
    html += row('Type', n.type);
    html += row('Redirects', n.redirectCount);
    html += row('DNS lookup', `${Math.max(0, n.domainLookupEnd - n.domainLookupStart).toFixed(1)} ms`);
    html += row('TCP connect', `${Math.max(0, n.connectEnd - n.connectStart).toFixed(1)} ms`);
    html += row('Request', `${Math.max(0, n.responseStart - n.requestStart).toFixed(1)} ms`);
    html += row('Response', `${Math.max(0, n.responseEnd - n.responseStart).toFixed(1)} ms`);
    html += row('DOM interactive', `${n.domInteractive.toFixed(1)} ms`);
    html += row('DOM complete', `${n.domComplete.toFixed(1)} ms`);
    html += row('Load event end', `${n.loadEventEnd.toFixed(1)} ms`);
    html += row('Transfer size', bytes(n.transferSize));
    html += row('Decoded body', bytes(n.decodedBodySize));
  } else {
    html += row('Navigation timing', muted('Not available'), { raw: true });
  }

  html += section('JS heap');
  if (perf && perf.memory) {
    const m = perf.memory;
    html += row('Heap limit', bytes(m.jsHeapSizeLimit));
    html += row('Total heap', bytes(m.totalJSHeapSize));
    html += row('Used heap', bytes(m.usedJSHeapSize));
  } else {
    html += row('performance.memory', muted('Not available (non-Chromium)'), { raw: true });
  }

  html += section('Clock');
  html += row('performance.now()', `${perf.now().toFixed(2)} ms`);
  html += row('Date.now()', new Date().toISOString(), { mono: true });
  html += row('Time zone', Intl.DateTimeFormat().resolvedOptions().timeZone);
  html += row('Locale', Intl.DateTimeFormat().resolvedOptions().locale);

  html += section('Resources');
  if (perf && perf.getEntriesByType) {
    const res = perf.getEntriesByType('resource');
    html += row('Resources loaded', res.length);
    if (res.length) {
      const total = res.reduce((s, r) => s + (r.transferSize || 0), 0);
      html += row('Total transfer', bytes(total));
    }
  }

  document.getElementById('performance-content').innerHTML = html;
}

function renderApis() {
  const checks = [
    ['Geolocation',         'geolocation' in navigator],
    ['Camera / Microphone', 'mediaDevices' in navigator],
    ['Service Worker',      'serviceWorker' in navigator],
    ['Web Workers',         typeof Worker !== 'undefined'],
    ['WebAssembly',         typeof WebAssembly !== 'undefined'],
    ['WebGL',               (() => { try { return !!document.createElement('canvas').getContext('webgl'); } catch { return false; } })()],
    ['WebGL2',              (() => { try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; } })()],
    ['Canvas 2D',           (() => { try { return !!document.createElement('canvas').getContext('2d'); } catch { return false; } })()],
    ['AudioContext',        'AudioContext' in window || 'webkitAudioContext' in window],
    ['Web Bluetooth',       'bluetooth' in navigator],
    ['Web USB',             'usb' in navigator],
    ['Web Serial',          'serial' in navigator],
    ['Web NFC',             'NDEFReader' in window],
    ['Gamepad',             'getGamepads' in navigator],
    ['Speech Synthesis',    'speechSynthesis' in window],
    ['Speech Recognition',  'SpeechRecognition' in window || 'webkitSpeechRecognition' in window],
    ['Vibration',           'vibrate' in navigator],
    ['Clipboard',           'clipboard' in navigator],
    ['Notifications',       'Notification' in window],
    ['Fullscreen',          'requestFullscreen' in document.documentElement],
    ['Share',               'share' in navigator],
    ['Credentials',         'credentials' in navigator],
    ['Payment Request',     'PaymentRequest' in window],
    ['IndexedDB',           'indexedDB' in window],
    ['localStorage',        (() => { try { return !!window.localStorage; } catch { return false; } })()],
    ['sessionStorage',      (() => { try { return !!window.sessionStorage; } catch { return false; } })()],
    ['Crypto subtle',       'crypto' in window && 'subtle' in window.crypto],
    ['Fetch',               'fetch' in window],
    ['WebSocket',           'WebSocket' in window],
    ['EventSource',         'EventSource' in window],
    ['BroadcastChannel',    'BroadcastChannel' in window],
    ['IntersectionObserver','IntersectionObserver' in window],
    ['ResizeObserver',      'ResizeObserver' in window],
    ['MutationObserver',    'MutationObserver' in window],
    ['AbortController',     'AbortController' in window],
    ['Pointer Events',      'PointerEvent' in window],
    ['Touch Events',        'TouchEvent' in window],
    ['Device Orientation',  'DeviceOrientationEvent' in window],
    ['Device Motion',       'DeviceMotionEvent' in window],
    ['Generic Sensor',      'Accelerometer' in window || 'Gyroscope' in window],
    ['Battery API',         'getBattery' in navigator],
    ['Network Info',        'connection' in navigator],
    ['UA Client Hints',     'userAgentData' in navigator],
    ['Storage estimate',    'storage' in navigator && 'estimate' in navigator.storage],
    ['Screen orientation',  'orientation' in screen],
    ['Picture in Picture',  'pictureInPictureEnabled' in document],
    ['WebXR',               'xr' in navigator],
    ['MIDI',                'requestMIDIAccess' in navigator],
  ];

  const ok = checks.filter(c => c[1]).length;

  let html = '';
  html += section(`Feature support — ${ok}/${checks.length}`);
  html += '<div class="feature-grid">';
  checks.forEach(([name, supported]) => {
    html += `<div class="feature-badge focusable${supported ? '' : ' disabled'}" tabindex="0">
      <div class="feature-dot ${supported ? 'yes' : 'no'}"></div>
      <span class="feature-name">${esc(name)}</span>
    </div>`;
  });
  html += '</div>';

  document.getElementById('apis-content').innerHTML = html;
}

function renderLocationPlaceholder() {
  const available = 'geolocation' in navigator;
  let html = '';
  html += section('Geolocation');
  html += row('API status', available ? yes() : no(), { raw: true });
  html += row('Position', muted('Press Get Location to fetch'), { raw: true });
  document.getElementById('location-content').innerHTML = html;
}

function fetchLocation() {
  if (!navigator.geolocation) return;
  let html = '';
  html += section('Geolocation');
  html += row('Status', '<span class="warn">Requesting…</span>', { raw: true });
  document.getElementById('location-content').innerHTML = html;

  navigator.geolocation.getCurrentPosition(
    pos => {
      const c = pos.coords;
      let out = '';
      out += section('Position');
      out += row('Latitude', c.latitude.toFixed(6), { mono: true });
      out += row('Longitude', c.longitude.toFixed(6), { mono: true });
      out += row('Altitude', c.altitude !== null ? `${c.altitude.toFixed(1)} m` : '—');

      out += section('Accuracy');
      out += row('Horizontal', `±${c.accuracy.toFixed(1)} m`);
      out += row('Vertical', c.altitudeAccuracy !== null ? `±${c.altitudeAccuracy.toFixed(1)} m` : '—');

      out += section('Motion');
      out += row('Speed', c.speed !== null ? `${(c.speed * 3.6).toFixed(1)} km/h` : '—');
      out += row('Heading', c.heading !== null ? `${c.heading.toFixed(1)}°` : '—');

      out += section('Metadata');
      out += row('Timestamp', new Date(pos.timestamp).toISOString(), { mono: true });

      document.getElementById('location-content').innerHTML = out;
    },
    err => {
      const msgs = { 1: 'Permission denied', 2: 'Position unavailable', 3: 'Timeout' };
      let out = '';
      out += section('Error');
      out += row('Code', err.code);
      out += row('Message', `<span class="bad">${esc(msgs[err.code] || err.message)}</span>`, { raw: true });
      document.getElementById('location-content').innerHTML = out;
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

// ─── Event delegation for clicks ────────────────────────────
document.addEventListener('click', e => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;

  if (action === 'back')           { navigateBack(); return; }
  if (action === 'go-screen')      { navigateTo(btn.dataset.target); return; }
  if (action === 'fetch-location') { fetchLocation(); return; }
});

// ─── D-pad keyboard navigation ──────────────────────────────
document.addEventListener('keydown', e => {
  const screen = document.querySelector('.screen:not(.hidden)');
  if (!screen) return;

  const focusables = Array.from(screen.querySelectorAll('.focusable'));
  if (!focusables.length) return;

  const current = document.activeElement;
  let idx = focusables.indexOf(current);
  if (idx < 0) idx = 0;

  if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
    e.preventDefault();
    const next = focusables[(idx + 1) % focusables.length];
    next.focus();
    next.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
    e.preventDefault();
    const prev = focusables[(idx - 1 + focusables.length) % focusables.length];
    prev.focus();
    prev.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  } else if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    if (current && current.click) current.click();
  } else if (e.key === 'Backspace' || e.key === 'Escape') {
    // Backspace is the documented back input; Escape kept for desktop testing.
    e.preventDefault();
    navigateBack();
  }
});

// ─── Boot ───────────────────────────────────────────────────
const VALID_SCREENS = ['home','browser','useragent','screen-info','network','hardware','performance','apis','location'];
const params = new URLSearchParams(location.search);
const startScreen = params.get('state') || params.get('screen') || 'home';
// Hide every screen up front so direct-link starts (?screen=useragent) don't
// leave the default home screen visible behind the target.
document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
navigateTo(VALID_SCREENS.includes(startScreen) ? startScreen : 'home');

// Dev/screenshot helper: ?row=N focuses the Nth focusable on the current
// screen (or ?row=last). Used to verify scroll-by-focus works deterministically.
const focusParam = params.get('row');
if (focusParam) {
  // Wait a tick so any async rendering settles before we focus.
  setTimeout(() => {
    const current = document.querySelector('.screen:not(.hidden)');
    if (!current) return;
    const focusables = current.querySelectorAll('.focusable');
    const idx = focusParam === 'last'
      ? focusables.length - 1
      : Math.min(focusables.length - 1, Math.max(0, parseInt(focusParam, 10) || 0));
    const target = focusables[idx];
    if (target) {
      target.focus();
      target.scrollIntoView({ block: 'nearest' });
    }
  }, 100);
}
