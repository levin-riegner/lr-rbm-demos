'use strict';

// ── Navigation ────────────────────────────────────────────────
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

// ── Screen enter handlers ─────────────────────────────────────
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

// ── Helpers ───────────────────────────────────────────────────
function row(label, value, cls = '', stacked = false) {
  const v = value === undefined || value === null || value === '' ? '—' : String(value);
  if (stacked) {
    return `<div class="info-row stacked"><span class="info-label">${label}</span><span class="info-value">${v}</span></div>`;
  }
  return `<div class="info-row"><span class="info-label">${label}</span><span class="info-value ${cls}">${v}</span></div>`;
}

function section(title) {
  return `<div class="section-title">${title}</div>`;
}

function yesno(v) {
  return v ? '<span class="good">Yes</span>' : '<span class="bad">No</span>';
}

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
    { name: 'Chrome',  re: /Chrome\/([\d.]+)/ },
    { name: 'Firefox', re: /Firefox\/([\d.]+)/ },
    { name: 'Safari',  re: /Version\/([\d.]+).*Safari/ },
    { name: 'Edge',    re: /Edg\/([\d.]+)/ },
    { name: 'Opera',   re: /OPR\/([\d.]+)/ },
    { name: 'WebView', re: /wv.*Chrome\/([\d.]+)/ },
  ];
  for (const p of patterns) {
    const m = ua.match(p.re);
    if (m) return { name: p.name, version: m[1] };
  }
  return { name: 'Unknown', version: '—' };
}

function getEngine(ua) {
  if (/Gecko\/\d/.test(ua) && !/like Gecko/.test(ua)) return { name: 'Gecko', version: (ua.match(/rv:([\d.]+)/) || [])[1] || '—' };
  if (/AppleWebKit\/([\d.]+)/.test(ua)) return { name: 'WebKit/Blink', version: (ua.match(/AppleWebKit\/([\d.]+)/) || [])[1] };
  return { name: 'Unknown', version: '—' };
}

// ── Renderers ─────────────────────────────────────────────────
function renderHomeTime() {
  const el = document.getElementById('home-time');
  if (el) el.textContent = new Date().toLocaleTimeString();
}

function renderBrowser() {
  const nav = navigator;
  const ua = nav.userAgent;
  const browser = parseUA(ua);
  const engine = getEngine(ua);

  let html = section('Browser Identity');
  html += row('Browser', browser.name);
  html += row('Version', browser.version);
  html += row('Engine', engine.name);
  html += row('Engine Version', engine.version);

  html += section('Navigator');
  html += row('App Name', nav.appName);
  html += row('App Version', nav.appVersion ? nav.appVersion.substring(0, 60) + '…' : '—');
  html += row('Product', nav.product);
  html += row('Product Sub', nav.productSub || '—');
  html += row('Vendor', nav.vendor || '—');
  html += row('Vendor Sub', nav.vendorSub || '(none)');
  html += row('Platform', nav.platform || '—');
  html += row('Language', nav.language);
  html += row('Languages', (nav.languages || []).join(', '));
  html += row('Do Not Track', nav.doNotTrack || '—');
  html += row('Cookie Enabled', yesno(nav.cookieEnabled));
  html += row('Java Enabled', typeof nav.javaEnabled === 'function' ? yesno(nav.javaEnabled()) : '—');
  html += row('Online', yesno(nav.onLine));
  html += row('PDF Viewer', nav.pdfViewerEnabled !== undefined ? yesno(nav.pdfViewerEnabled) : '—');

  html += section('Window');
  html += row('Inner Size', `${window.innerWidth} × ${window.innerHeight}`);
  html += row('Outer Size', `${window.outerWidth} × ${window.outerHeight}`);
  html += row('Device Pixel Ratio', window.devicePixelRatio);
  html += row('Scroll X/Y', `${window.scrollX} / ${window.scrollY}`);

  document.getElementById('browser-content').innerHTML = html;
}

function renderUserAgent() {
  const ua = navigator.userAgent;

  let html = section('Raw User Agent');
  html += row('User Agent', ua, '', true);

  // UA Client Hints
  const uaCH = navigator.userAgentData;
  if (uaCH) {
    html += section('UA Client Hints');
    html += row('Brands', (uaCH.brands || []).map(b => `${b.brand} ${b.version}`).join(', '));
    html += row('Mobile', yesno(uaCH.mobile));
    html += row('Platform', uaCH.platform || '—');

    if (uaCH.getHighEntropyValues) {
      uaCH.getHighEntropyValues([
        'architecture', 'bitness', 'model', 'platformVersion',
        'fullVersionList', 'uaFullVersion', 'wow64'
      ]).then(v => {
        let extra = section('High Entropy Hints');
        extra += row('Architecture', v.architecture || '—');
        extra += row('Bitness', v.bitness || '—');
        extra += row('Model', v.model || '(none)');
        extra += row('Platform Version', v.platformVersion || '—');
        extra += row('UA Full Version', v.uaFullVersion || '—');
        extra += row('WoW64', v.wow64 !== undefined ? yesno(v.wow64) : '—');
        extra += row('Full Version List', (v.fullVersionList || []).map(b => `${b.brand} ${b.version}`).join(', '));
        document.getElementById('useragent-content').insertAdjacentHTML('beforeend', extra);
      }).catch(() => {});
    }
  } else {
    html += section('UA Client Hints');
    html += row('Status', '<span class="muted">Not supported</span>');
  }

  html += section('Parsed');
  const browser = parseUA(ua);
  const engine = getEngine(ua);
  html += row('Browser', `${browser.name} ${browser.version}`);
  html += row('Engine', `${engine.name} ${engine.version}`);
  html += row('Mobile UA', yesno(/Mobi|Android|iPhone|iPad/i.test(ua)));

  document.getElementById('useragent-content').innerHTML = html;
}

function renderScreenInfo() {
  const s = screen;
  const w = window;

  let html = section('Screen');
  html += row('Resolution', `${s.width} × ${s.height}`);
  html += row('Available', `${s.availWidth} × ${s.availHeight}`);
  html += row('Color Depth', `${s.colorDepth}-bit`);
  html += row('Pixel Depth', `${s.pixelDepth}-bit`);
  html += row('Orientation', s.orientation ? `${s.orientation.type} (${s.orientation.angle}°)` : '—');
  html += row('Is Extended', s.isExtended !== undefined ? yesno(s.isExtended) : '—');

  html += section('Window');
  html += row('Inner', `${w.innerWidth} × ${w.innerHeight}`);
  html += row('Outer', `${w.outerWidth} × ${w.outerHeight}`);
  html += row('Device Pixel Ratio', w.devicePixelRatio.toFixed(2));
  html += row('Page X Offset', w.pageXOffset);
  html += row('Page Y Offset', w.pageYOffset);
  html += row('Fullscreen', document.fullscreenElement ? 'Yes' : 'No');

  html += section('Document');
  html += row('Scroll Width', document.documentElement.scrollWidth);
  html += row('Scroll Height', document.documentElement.scrollHeight);
  html += row('Client Width', document.documentElement.clientWidth);
  html += row('Client Height', document.documentElement.clientHeight);

  const mq = (q) => window.matchMedia(q).matches;
  html += section('Media Queries');
  html += row('Dark Mode', yesno(mq('(prefers-color-scheme: dark)')));
  html += row('Light Mode', yesno(mq('(prefers-color-scheme: light)')));
  html += row('Reduced Motion', yesno(mq('(prefers-reduced-motion: reduce)')));
  html += row('HDR', yesno(mq('(dynamic-range: high)')));
  html += row('Pointer: fine', yesno(mq('(pointer: fine)')));
  html += row('Pointer: coarse', yesno(mq('(pointer: coarse)')));
  html += row('Hover', yesno(mq('(hover: hover)')));
  html += row('Retina (≥2x)', yesno(mq('(-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi)')));

  document.getElementById('screen-info-content').innerHTML = html;
}

function renderNetwork() {
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

  let html = section('Connection');
  if (conn) {
    html += row('Type', conn.type || '—');
    html += row('Effective Type', conn.effectiveType || '—');
    html += row('Downlink', conn.downlink !== undefined ? `${conn.downlink} Mbps` : '—');
    html += row('Downlink Max', conn.downlinkMax !== undefined ? `${conn.downlinkMax} Mbps` : '—');
    html += row('RTT', conn.rtt !== undefined ? `${conn.rtt} ms` : '—');
    html += row('Save Data', yesno(conn.saveData));
  } else {
    html += row('Network Info API', '<span class="muted">Not available</span>');
  }

  html += section('Status');
  html += row('Online', yesno(navigator.onLine));

  html += section('URL');
  html += row('Origin', location.origin);
  html += row('Protocol', location.protocol);
  html += row('Host', location.host);
  html += row('Pathname', location.pathname);
  html += row('Hash', location.hash || '(none)');

  html += section('Referrer');
  html += row('Referrer', document.referrer || '(none)');

  document.getElementById('network-content').innerHTML = html;
}

function renderHardware() {
  const nav = navigator;

  let html = section('CPU & Memory');
  html += row('Logical Cores', nav.hardwareConcurrency || '—');
  html += row('Device Memory', nav.deviceMemory !== undefined ? `${nav.deviceMemory} GB` : '—');
  html += row('Max Touch Points', nav.maxTouchPoints !== undefined ? nav.maxTouchPoints : '—');

  html += section('Battery');
  if (nav.getBattery) {
    nav.getBattery().then(b => {
      let battHTML = row('Charging', yesno(b.charging));
      battHTML += row('Level', `${Math.round(b.level * 100)}%`);
      battHTML += row('Charging Time', b.chargingTime === Infinity ? 'N/A' : `${b.chargingTime}s`);
      battHTML += row('Discharging Time', b.dischargingTime === Infinity ? 'N/A' : `${b.dischargingTime}s`);
      const marker = document.getElementById('battery-marker');
      if (marker) marker.insertAdjacentHTML('afterend', battHTML);
    }).catch(() => {});
    html += `<span id="battery-marker"></span>`;
  } else {
    html += row('Battery API', '<span class="muted">Not supported</span>');
  }

  html += section('Storage');
  if (navigator.storage && navigator.storage.estimate) {
    navigator.storage.estimate().then(est => {
      const used = bytes(est.usage);
      const quota = bytes(est.quota);
      const pct = est.quota ? ((est.usage / est.quota) * 100).toFixed(1) + '%' : '—';
      const marker = document.getElementById('storage-marker');
      if (marker) {
        marker.insertAdjacentHTML('afterend',
          row('Used', used) + row('Quota', quota) + row('Used %', pct));
      }
    }).catch(() => {});
    html += `<span id="storage-marker"></span>`;
  } else {
    html += row('Storage Estimate', '<span class="muted">Not supported</span>');
  }

  html += section('Plugins');
  const plugins = Array.from(nav.plugins || []);
  if (plugins.length) {
    plugins.slice(0, 8).forEach(p => { html += row(p.name, p.filename || '—'); });
  } else {
    html += row('Plugins', '<span class="muted">None / not exposed</span>');
  }

  html += section('MIME Types');
  const mimes = Array.from(nav.mimeTypes || []);
  if (mimes.length) {
    mimes.slice(0, 6).forEach(m => { html += row(m.type, m.suffixes || '—'); });
  } else {
    html += row('MIME Types', '<span class="muted">None / not exposed</span>');
  }

  document.getElementById('hardware-content').innerHTML = html;
}

function renderPerformance() {
  const perf = window.performance;

  let html = section('Timing');
  if (perf && perf.timing) {
    const t = perf.timing;
    const navStart = t.navigationStart;
    html += row('DNS Lookup', `${t.domainLookupEnd - t.domainLookupStart} ms`);
    html += row('TCP Connect', `${t.connectEnd - t.connectStart} ms`);
    html += row('Request', `${t.responseStart - t.requestStart} ms`);
    html += row('Response', `${t.responseEnd - t.responseStart} ms`);
    html += row('DOM Interactive', `${t.domInteractive - navStart} ms`);
    html += row('DOM Complete', `${t.domComplete - navStart} ms`);
    html += row('Load Event', `${t.loadEventEnd - navStart} ms`);
  } else {
    html += row('Legacy Timing', '<span class="muted">Not available</span>');
  }

  html += section('Navigation');
  if (perf && perf.getEntriesByType) {
    const navEntries = perf.getEntriesByType('navigation');
    if (navEntries.length) {
      const n = navEntries[0];
      html += row('Type', n.type);
      html += row('Redirects', n.redirectCount);
      html += row('Start Time', `${n.startTime.toFixed(1)} ms`);
      html += row('Duration', `${n.duration.toFixed(1)} ms`);
      html += row('Transfer Size', bytes(n.transferSize));
      html += row('Encoded Body', bytes(n.encodedBodySize));
      html += row('Decoded Body', bytes(n.decodedBodySize));
    }
  }

  html += section('Memory');
  if (perf && perf.memory) {
    const m = perf.memory;
    html += row('JS Heap Limit', bytes(m.jsHeapSizeLimit));
    html += row('Total JS Heap', bytes(m.totalJSHeapSize));
    html += row('Used JS Heap', bytes(m.usedJSHeapSize));
  } else {
    html += row('Memory API', '<span class="muted">Not available</span>');
  }

  html += section('Now');
  html += row('performance.now()', `${perf.now().toFixed(2)} ms`);
  html += row('Date.now()', new Date().toISOString());
  html += row('Time Zone', Intl.DateTimeFormat().resolvedOptions().timeZone);
  html += row('Locale', Intl.DateTimeFormat().resolvedOptions().locale);

  html += section('Resource Timing');
  if (perf && perf.getEntriesByType) {
    const resources = perf.getEntriesByType('resource');
    html += row('Resources Loaded', resources.length);
    if (resources.length) {
      const total = resources.reduce((s, r) => s + (r.transferSize || 0), 0);
      html += row('Total Transfer', bytes(total));
    }
  }

  document.getElementById('performance-content').innerHTML = html;
}

function renderApis() {
  const checks = [
    ['Geolocation',        'geolocation' in navigator],
    ['Camera/Mic',         'mediaDevices' in navigator],
    ['Push API',           'PushManager' in window],
    ['Service Worker',     'serviceWorker' in navigator],
    ['Web Workers',        typeof Worker !== 'undefined'],
    ['WebAssembly',        typeof WebAssembly !== 'undefined'],
    ['WebGL',              (() => { try { return !!document.createElement('canvas').getContext('webgl'); } catch { return false; } })()],
    ['WebGL2',             (() => { try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; } })()],
    ['Canvas 2D',          (() => { try { return !!document.createElement('canvas').getContext('2d'); } catch { return false; } })()],
    ['AudioContext',       'AudioContext' in window || 'webkitAudioContext' in window],
    ['Web Bluetooth',      'bluetooth' in navigator],
    ['Web USB',            'usb' in navigator],
    ['Web Serial',         'serial' in navigator],
    ['Web NFC',            'NDEFReader' in window],
    ['Gamepad',            'getGamepads' in navigator],
    ['Speech Synthesis',   'speechSynthesis' in window],
    ['Speech Recognition', 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window],
    ['Vibration',          'vibrate' in navigator],
    ['Clipboard',          'clipboard' in navigator],
    ['Notifications',      'Notification' in window],
    ['Fullscreen',         'requestFullscreen' in document.documentElement],
    ['Pointer Lock',       'requestPointerLock' in document.documentElement],
    ['Share',              'share' in navigator],
    ['Credentials',        'credentials' in navigator],
    ['Payment Request',    'PaymentRequest' in window],
    ['IndexedDB',          'indexedDB' in window],
    ['localStorage',       (() => { try { return 'localStorage' in window && !!window.localStorage; } catch { return false; } })()],
    ['sessionStorage',     (() => { try { return 'sessionStorage' in window && !!window.sessionStorage; } catch { return false; } })()],
    ['Crypto',             'crypto' in window],
    ['SubtleCrypto',       'crypto' in window && 'subtle' in window.crypto],
    ['Fetch',              'fetch' in window],
    ['WebSocket',          'WebSocket' in window],
    ['EventSource',        'EventSource' in window],
    ['Broadcast Channel',  'BroadcastChannel' in window],
    ['IntersectionObserver','IntersectionObserver' in window],
    ['ResizeObserver',     'ResizeObserver' in window],
    ['MutationObserver',   'MutationObserver' in window],
    ['AbortController',    'AbortController' in window],
    ['CSS Houdini',        'CSS' in window && 'paintWorklet' in CSS],
    ['Pointer Events',     'PointerEvent' in window],
    ['Touch Events',       'TouchEvent' in window],
    ['Device Orientation', 'DeviceOrientationEvent' in window],
    ['Device Motion',      'DeviceMotionEvent' in window],
    ['Generic Sensor',     'Accelerometer' in window || 'Gyroscope' in window],
    ['Battery API',        'getBattery' in navigator],
    ['Network Info',       'connection' in navigator],
    ['UA Client Hints',    'userAgentData' in navigator],
    ['Storage Estimate',   'storage' in navigator && 'estimate' in navigator.storage],
    ['Screen Orientation', 'orientation' in screen],
    ['Picture-in-Picture', 'pictureInPictureEnabled' in document],
    ['WebXR',              'xr' in navigator],
    ['MIDI',               'requestMIDIAccess' in navigator],
  ];

  const yes = checks.filter(c => c[1]).length;
  const no  = checks.length - yes;

  let html = section(`Feature Support — ${yes}/${checks.length} Available`);
  html += '<div class="feature-grid">';
  checks.forEach(([name, supported]) => {
    html += `<div class="feature-badge">
      <div class="feature-dot ${supported ? 'yes' : 'no'}"></div>
      <span class="feature-name">${name}</span>
    </div>`;
  });
  html += '</div>';

  document.getElementById('apis-content').innerHTML = html;
}

function renderLocationPlaceholder() {
  const available = 'geolocation' in navigator;
  let html = row('API', available ? '<span class="good">Available</span>' : '<span class="bad">Not supported</span>');
  html += row('Status', '<span class="muted">Press Get Location below</span>');
  document.getElementById('location-content').innerHTML = html;
}

function fetchLocation() {
  if (!navigator.geolocation) {
    document.getElementById('location-content').innerHTML =
      row('Error', '<span class="bad">Geolocation not supported</span>');
    return;
  }
  document.getElementById('location-content').innerHTML =
    row('Status', '<span class="warn">Requesting…</span>');

  navigator.geolocation.getCurrentPosition(
    pos => {
      const c = pos.coords;
      let html = section('Position');
      html += row('Latitude',  c.latitude.toFixed(6));
      html += row('Longitude', c.longitude.toFixed(6));
      html += row('Altitude',  c.altitude !== null ? `${c.altitude.toFixed(1)} m` : '—');
      html += section('Accuracy');
      html += row('Horizontal', `±${c.accuracy.toFixed(1)} m`);
      html += row('Vertical',   c.altitudeAccuracy !== null ? `±${c.altitudeAccuracy.toFixed(1)} m` : '—');
      html += section('Motion');
      html += row('Speed',   c.speed !== null ? `${(c.speed * 3.6).toFixed(1)} km/h` : '—');
      html += row('Heading', c.heading !== null ? `${c.heading.toFixed(1)}°` : '—');
      html += section('Metadata');
      html += row('Timestamp', new Date(pos.timestamp).toISOString());
      document.getElementById('location-content').innerHTML = html;
    },
    err => {
      const msgs = { 1: 'Permission denied', 2: 'Position unavailable', 3: 'Timeout' };
      document.getElementById('location-content').innerHTML =
        row('Error', `<span class="bad">${msgs[err.code] || err.message}</span>`);
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

// ── Event Delegation ──────────────────────────────────────────
document.addEventListener('click', e => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;

  if (action === 'back') { navigateBack(); return; }
  if (action === 'go-screen') { navigateTo(btn.dataset.target); return; }
  if (action === 'fetch-location') { fetchLocation(); return; }
});

// ── D-pad Keyboard Navigation ─────────────────────────────────
document.addEventListener('keydown', e => {
  const screen = document.querySelector('.screen:not(.hidden)');
  const focusables = Array.from(screen.querySelectorAll('.focusable'));
  const current = document.activeElement;
  const idx = focusables.indexOf(current);

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    const next = focusables[(idx + 1) % focusables.length];
    next.focus();
    next.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    const prev = focusables[(idx - 1 + focusables.length) % focusables.length];
    prev.focus();
    prev.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  } else if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    current.click();
  } else if (e.key === 'Escape' || e.key === 'Backspace') {
    e.preventDefault();
    navigateBack();
  }
});

// ── Boot ──────────────────────────────────────────────────────
navigateTo('home');
