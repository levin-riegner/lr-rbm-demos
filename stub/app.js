(function () {
  'use strict';

  // ===========================================================
  //  CONFIG
  // ===========================================================
  var CONFIG = {
    storageKey: 'mdg_stub_v1',
    scanDurationMs: 1200,
  };

  // Demo OCR pool — what a "scan" would yield in production once a
  // real OCR pass ran over the camera frame. The pool is cycled
  // deterministically so each new capture in the demo gives a
  // recognisably different ticket.
  var DEMO_POOL = [
    { category: 'COAT CHECK',  code: '247',      location: 'The Vintage Lounge' },
    { category: 'VALET',       code: 'A-19',     location: 'Roosevelt Hotel' },
    { category: 'RAFFLE',      code: '1042',     location: 'Annual Gala' },
    { category: 'BAG CHECK',   code: 'BC·88',    location: 'Museum of Modern Art' },
    { category: 'PARKING',     code: 'P3·412',   location: 'Westfield Garage' },
    { category: 'TABLE',       code: '17',       location: "Don's Steakhouse" },
    { category: 'LOCKER',      code: '142',      location: 'Equinox Tribeca' },
    { category: 'ROOM',        code: '#612',     location: 'Ace Hotel' },
    { category: 'PICKUP',      code: 'B-44',     location: 'Walgreens · Rx' },
    { category: 'WRISTBAND',   code: '3081',     location: 'Brooklyn Mirage' },
    { category: 'DRY CLEANER', code: '9824',     location: 'Mr. Tux · 14th St' },
    { category: 'WIFI',        code: 'rabbit-7', location: 'Cafe Reggio' },
  ];

  // Seed stubs that ship with the app on first run. Lets the demo
  // open onto a populated carousel instead of the empty hero.
  var SEED_STUBS = [
    {
      id: 'seed-1',
      category: 'COAT CHECK',
      code: '247',
      location: 'The Vintage Lounge',
      capturedAt: Date.now() - 12 * 60 * 1000,
    },
    {
      id: 'seed-2',
      category: 'VALET',
      code: 'A-19',
      location: 'Roosevelt Hotel',
      capturedAt: Date.now() - 42 * 60 * 1000,
    },
    {
      id: 'seed-3',
      category: 'RAFFLE',
      code: '1042',
      location: 'Annual Gala',
      capturedAt: Date.now() - 80 * 60 * 1000,
    },
  ];

  // ===========================================================
  //  STATE
  // ===========================================================
  var state = {
    screen:    'home',     // 'home-empty' | 'home' | 'capture' | 'scanning' | 'confirm' | 'detail' | 'delete'
    stubs:     [],         // most-recent first
    carIdx:    0,          // home carousel index (0..stubs.length, where stubs.length === "+ NEW")
    detailId:  null,
    pending:   null,       // freshly-scanned stub awaiting confirm
    poolIdx:   3,          // start past the seeded stubs so the first demo capture is fresh content
  };

  var SCREENS = ['home-empty', 'home', 'capture', 'scanning', 'confirm', 'detail', 'delete'];

  // ===========================================================
  //  STORAGE
  // ===========================================================
  function persist() {
    try {
      localStorage.setItem(CONFIG.storageKey, JSON.stringify({
        stubs:   state.stubs,
        poolIdx: state.poolIdx,
      }));
    } catch (e) { /* ignore */ }
  }
  function restore() {
    try {
      var raw = localStorage.getItem(CONFIG.storageKey);
      if (!raw) {
        state.stubs = SEED_STUBS.slice();
        return;
      }
      var data = JSON.parse(raw);
      state.stubs   = Array.isArray(data.stubs) ? data.stubs : [];
      state.poolIdx = typeof data.poolIdx === 'number' ? data.poolIdx : 0;
    } catch (e) {
      state.stubs = SEED_STUBS.slice();
    }
  }

  // ===========================================================
  //  FORMATTING
  // ===========================================================
  function fmtAgo(ts) {
    var d = Date.now() - ts;
    if (d < 30 * 1000)        return 'just now';
    if (d < 60 * 1000)        return 'moments ago';
    var m = Math.floor(d / 60000);
    if (m < 60)               return m + ' min ago';
    var h = Math.floor(m / 60);
    if (h < 24)               return h + ' hr ago';
    var days = Math.floor(h / 24);
    if (days === 1)           return 'yesterday';
    if (days < 7)             return days + ' days ago';
    return 'a while ago';
  }
  function fmtClock(d) {
    return (d.getHours() < 10 ? '0' : '') + d.getHours() + ':' +
           (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
  }
  function codeSizeClass(code) {
    if (!code) return '';
    if (code.length > 8)  return 'code-xlong';
    if (code.length > 5)  return 'code-long';
    return '';
  }

  // ===========================================================
  //  SCREEN SWITCHING
  // ===========================================================
  function showScreen(name) {
    if (state.screen === 'scanning' && name !== 'scanning') stopScanTimers();
    state.screen = name;
    SCREENS.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.classList.toggle('hidden', id !== name);
    });
    if (name === 'home-empty') renderEmpty();
    if (name === 'home')       renderHome();
    if (name === 'capture')    renderCapture();
    if (name === 'scanning')   renderScanning();
    if (name === 'confirm')    renderConfirm();
    if (name === 'detail')     renderDetail();
    if (name === 'delete')     renderDelete();
  }

  function goHome() {
    if (state.stubs.length === 0) {
      showScreen('home-empty');
    } else {
      // clamp to nearest valid index
      if (state.carIdx > state.stubs.length) state.carIdx = state.stubs.length;
      showScreen('home');
    }
  }

  // ===========================================================
  //  RENDER — empty home
  // ===========================================================
  function renderEmpty() {
    var cta = document.getElementById('cta-empty');
    if (cta) { try { cta.focus(); } catch (e) {} }
  }

  // ===========================================================
  //  RENDER — populated home (carousel of stubs + "+ NEW")
  // ===========================================================
  function renderHome() {
    var car = document.getElementById('stub-carousel');
    if (!car) return;
    var count = state.stubs.length;
    if (state.carIdx < 0)       state.carIdx = 0;
    if (state.carIdx > count)   state.carIdx = count;

    // Header counter — "3 / 4" where N is stubs+1 (the +NEW slot).
    var counter = document.getElementById('home-counter');
    if (counter) {
      counter.textContent = (state.carIdx + 1) + ' / ' + (count + 1);
    }

    car.innerHTML = '';
    if (state.carIdx < count) {
      var stub = state.stubs[state.carIdx];
      car.appendChild(renderStubCard(stub));
    } else {
      car.appendChild(renderNewCard());
    }

    // Pagination dots
    var dots = document.getElementById('carousel-dots');
    if (dots) {
      dots.innerHTML = '';
      for (var i = 0; i <= count; i++) {
        var d = document.createElement('i');
        d.className = 'dot' + (i === state.carIdx ? ' on' : '') + (i === count ? ' new' : '');
        dots.appendChild(d);
      }
    }

    // Hint bar adapts to the slot
    var hint = document.getElementById('home-hint');
    if (hint) {
      if (state.carIdx < count) {
        hint.innerHTML =
          '<span class="hint-keys"><span class="key">◀</span><span class="key">▶</span> BROWSE</span>' +
          '<span class="hint-keys"><span class="key">ENTER</span> OPEN</span>';
      } else {
        hint.innerHTML =
          '<span class="hint-keys"><span class="key">◀</span><span class="key">▶</span> BROWSE</span>' +
          '<span class="hint-keys"><span class="key">ENTER</span> CAPTURE</span>';
      }
    }
  }

  function renderStubCard(stub) {
    var el = document.createElement('div');
    el.className = 'stub-card';
    el.innerHTML =
      '<div class="stub-head">' +
        '<span class="stub-category"></span>' +
        '<span class="stub-time mono"></span>' +
      '</div>' +
      '<div class="perforation"></div>' +
      '<div class="stub-code mono"></div>' +
      '<div class="stub-location"></div>' +
      '<div class="stub-foot mono">NOT&nbsp;SAVED&nbsp;TO&nbsp;CAMERA&nbsp;ROLL</div>';

    el.querySelector('.stub-category').textContent = stub.category;
    el.querySelector('.stub-time').textContent     = fmtAgo(stub.capturedAt);
    var codeEl = el.querySelector('.stub-code');
    codeEl.textContent = stub.code;
    var sz = codeSizeClass(stub.code);
    if (sz) codeEl.classList.add(sz);
    el.querySelector('.stub-location').textContent = stub.location;
    return el;
  }

  function renderNewCard() {
    var el = document.createElement('div');
    el.className = 'new-card';
    el.innerHTML =
      '<div class="nc-plus">＋</div>' +
      '<div class="nc-label">NEW&nbsp;STUB</div>' +
      '<div class="nc-sub">SNAP · OCR · DELETE&nbsp;LATER</div>';
    return el;
  }

  // ===========================================================
  //  RENDER — capture (static markup; animations are CSS-only)
  // ===========================================================
  function renderCapture() { /* nothing dynamic */ }

  // ===========================================================
  //  RENDER — scanning (auto-advances to confirm)
  // ===========================================================
  var SCAN_STEPS = ['CAPTURING…', 'READING TEXT…', 'PARSING TAG…'];
  var scanTimer = null;       // one-shot: advance to confirm
  var scanStatusTick = null;  // interval: cycle the status label
  var scanEndsAt = 0;         // wall-clock deadline so a hidden pause stays accurate
  var scanStep = 0;

  function stopScanTimers() {
    clearTimeout(scanTimer);
    clearInterval(scanStatusTick);
    scanTimer = null;
    scanStatusTick = null;
  }

  function startScanTimers() {
    stopScanTimers();
    var statusEl = document.getElementById('scan-status');
    if (statusEl) statusEl.textContent = SCAN_STEPS[scanStep];
    // cycle the status label so the OCR feels stepwise
    scanStatusTick = setInterval(function () {
      scanStep = (scanStep + 1) % SCAN_STEPS.length;
      if (statusEl) statusEl.textContent = SCAN_STEPS[scanStep];
    }, 380);
    scanTimer = setTimeout(function () {
      stopScanTimers();
      if (state.screen === 'scanning') showScreen('confirm');
    }, Math.max(0, scanEndsAt - Date.now()));
  }

  function renderScanning() {
    // pick the next demo stub deterministically
    var idx = state.poolIdx % DEMO_POOL.length;
    var src = DEMO_POOL[idx];
    state.pending = {
      id:         'stub_' + Date.now().toString(36),
      category:   src.category,
      code:       src.code,
      location:   src.location,
      capturedAt: Date.now(),
    };
    state.poolIdx = (state.poolIdx + 1) % DEMO_POOL.length;

    scanStep = 0;
    scanEndsAt = Date.now() + CONFIG.scanDurationMs;
    startScanTimers();
  }

  // ===========================================================
  //  RENDER — confirm
  // ===========================================================
  function renderConfirm() {
    if (!state.pending) { goHome(); return; }
    document.getElementById('confirm-category').textContent = state.pending.category;
    document.getElementById('confirm-time').textContent     = 'just now';
    var codeEl = document.getElementById('confirm-code');
    codeEl.textContent = state.pending.code;
    codeEl.className = 'stub-code mono ' + codeSizeClass(state.pending.code);
    document.getElementById('confirm-location').textContent = state.pending.location;
    document.getElementById('confirm-detect').textContent   = 'DETECTED · ' + state.pending.category;
  }

  // ===========================================================
  //  RENDER — detail
  // ===========================================================
  function renderDetail() {
    var stub = state.stubs.find(function (s) { return s.id === state.detailId; });
    if (!stub) { goHome(); return; }
    document.getElementById('detail-category').textContent = stub.category;
    document.getElementById('detail-time').textContent     = fmtAgo(stub.capturedAt);
    var codeEl = document.getElementById('detail-code');
    codeEl.textContent = stub.code;
    codeEl.className = 'stub-code mono ' + codeSizeClass(stub.code);
    document.getElementById('detail-location').textContent = stub.location;
    var idxEl = document.getElementById('detail-index');
    var pos = state.stubs.findIndex(function (s) { return s.id === stub.id; });
    if (idxEl) idxEl.textContent = (pos + 1) + ' / ' + state.stubs.length;
  }

  // ===========================================================
  //  RENDER — delete confirm
  // ===========================================================
  function renderDelete() {
    var stub = state.stubs.find(function (s) { return s.id === state.detailId; });
    if (!stub) { goHome(); return; }
    document.getElementById('del-cat').textContent = stub.category;
    var codeEl = document.getElementById('del-code');
    codeEl.textContent = stub.code;
    codeEl.className = 'del-mini-code mono ' + codeSizeClass(stub.code);
  }

  // ===========================================================
  //  ACTIONS
  // ===========================================================
  function startCapture() {
    state.pending = null;
    showScreen('capture');
  }
  function saveStub() {
    if (!state.pending) return;
    state.stubs.unshift(state.pending);
    state.carIdx = 0;
    state.pending = null;
    persist();
    showScreen('home');
  }
  function deleteStub() {
    if (!state.detailId) return;
    state.stubs = state.stubs.filter(function (s) { return s.id !== state.detailId; });
    state.detailId = null;
    state.carIdx = 0;
    persist();
    goHome();
  }
  function openStub(id) {
    state.detailId = id;
    showScreen('detail');
  }

  // ===========================================================
  //  KEY HANDLING
  // ===========================================================
  function onKey(e) {
    var k = e.key;
    // Escape is the glasses' back gesture: on every sub-screen it does what
    // ◀ does there (back one level). On the home screens it is left alone.
    var back = (k === 'Escape');

    if (state.screen === 'home-empty') {
      if (k === 'Enter' || k === ' ') { startCapture(); e.preventDefault(); }
      return;
    }

    if (state.screen === 'home') {
      var count = state.stubs.length;
      if (k === 'ArrowLeft') {
        if (state.carIdx > 0) { state.carIdx--; renderHome(); }
        e.preventDefault();
      } else if (k === 'ArrowRight') {
        if (state.carIdx < count) { state.carIdx++; renderHome(); }
        e.preventDefault();
      } else if (k === 'Enter' || k === ' ') {
        if (state.carIdx >= count) {
          startCapture();
        } else {
          openStub(state.stubs[state.carIdx].id);
        }
        e.preventDefault();
      }
      return;
    }

    if (state.screen === 'capture') {
      if (k === 'Enter' || k === ' ') {
        showScreen('scanning');
        e.preventDefault();
      } else if (k === 'ArrowLeft' || back) {
        goHome();
        e.preventDefault();
      }
      return;
    }

    if (state.screen === 'scanning') {
      // No input — auto-advances. Allow ◀ to bail out.
      if (k === 'ArrowLeft' || back) {
        stopScanTimers();
        state.pending = null;
        goHome();
        e.preventDefault();
      }
      return;
    }

    if (state.screen === 'confirm') {
      if (k === 'Enter' || k === ' ') {
        saveStub();
        e.preventDefault();
      } else if (k === 'ArrowDown') {
        // retake
        showScreen('capture');
        e.preventDefault();
      } else if (k === 'ArrowLeft' || back) {
        state.pending = null;
        goHome();
        e.preventDefault();
      }
      return;
    }

    if (state.screen === 'detail') {
      if (k === 'ArrowLeft' || k === 'Enter' || k === ' ' || back) {
        goHome();
        e.preventDefault();
      } else if (k === 'ArrowDown') {
        showScreen('delete');
        e.preventDefault();
      }
      return;
    }

    if (state.screen === 'delete') {
      if (k === 'Enter' || k === ' ') {
        deleteStub();
        e.preventDefault();
      } else if (k === 'ArrowLeft' || back) {
        showScreen('detail');
        e.preventDefault();
      }
      return;
    }
  }

  // ===========================================================
  //  POINTER FALLBACK
  // ===========================================================
  function onClick(e) {
    var el = e.target.closest('[data-action]');
    if (el && el.dataset.action === 'capture') { startCapture(); return; }
    // Tap on the +NEW card from home
    if (state.screen === 'home') {
      var nc = e.target.closest('.new-card');
      if (nc) { startCapture(); return; }
      var sc = e.target.closest('.stub-card');
      if (sc && state.stubs.length > 0 && state.carIdx < state.stubs.length) {
        openStub(state.stubs[state.carIdx].id);
        return;
      }
    }
  }

  // ===========================================================
  //  CLOCK on empty home
  // ===========================================================
  function tickClock() {
    var el = document.getElementById('clock-empty');
    if (el) el.textContent = fmtClock(new Date());
  }
  var clockTimer = null;
  function startClock() {
    if (clockTimer) return;
    tickClock();
    clockTimer = setInterval(tickClock, 1000);
  }
  function stopClock() {
    clearInterval(clockTimer);
    clockTimer = null;
  }

  // ===========================================================
  //  LIFECYCLE — nothing ticks while the page is hidden
  // ===========================================================
  function pauseForHidden() {
    stopClock();
    stopScanTimers();
  }
  function resumeFromHidden() {
    startClock();
    // The scan deadline is wall-clock based, so a scan interrupted by a
    // hidden page picks up exactly where it should be (or finishes now).
    if (state.screen === 'scanning') startScanTimers();
  }

  // ===========================================================
  //  WebMCP (Meta AI voice control)
  //  Additive: the app works identically when document.modelContext
  //  is absent. Tools call the same functions the D-pad path uses.
  // ===========================================================
  function stubSummary(s) {
    return {
      category: s.category,
      code: s.code,
      location: s.location,
      captured: fmtAgo(s.capturedAt),
    };
  }

  function captureInProgress() {
    return state.screen === 'scanning' || state.screen === 'confirm';
  }

  function findStubs(query) {
    var q = String(query || '').replace(/[\s·#\-]/g, '').toLowerCase();
    if (!q) return [];
    return state.stubs.filter(function (s) {
      var cat  = String(s.category || '').replace(/[\s·#\-]/g, '').toLowerCase();
      var code = String(s.code || '').replace(/[\s·#\-]/g, '').toLowerCase();
      return cat.indexOf(q) !== -1 || code.indexOf(q) !== -1;
    });
  }

  // Move the carousel to a stub — the same path ◀ ▶ use (set index, render).
  function goToStub(id) {
    var idx = state.stubs.findIndex(function (s) { return s.id === id; });
    if (idx < 0) return false;
    state.carIdx = idx;
    showScreen('home');
    return true;
  }

  function registerWebMcp() {
    var ctx = document.modelContext;
    if (!ctx || typeof ctx.registerTool !== 'function') return;

    function safeRegister(tool) {
      try {
        var r = ctx.registerTool(tool);
        if (r && typeof r.then === 'function') {
          r.then(undefined, function (err) { console.error(tool.name + ' registration failed', err); });
        }
      } catch (err) {
        console.error(tool.name + ' registration failed', err);
      }
    }

    safeRegister({
      name: 'stub_get_state',
      description: 'List the saved stubs (coat check, valet, locker, raffle tickets and similar) with their category, code and location, newest first, plus which screen the app is on.',
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true },
      execute: function () {
        return {
          screen: state.screen,
          count: state.stubs.length,
          stubs: state.stubs.map(stubSummary),
          next_action: state.stubs.length
            ? 'Tell the wearer what is saved in one short sentence, then stop.'
            : 'Tell the wearer there are no saved stubs, then stop.',
        };
      }
    });

    safeRegister({
      name: 'stub_find',
      description: 'Find saved stubs whose category (e.g. valet, coat check, locker) or code (e.g. 247, A-19) contains the query, and show the first match on screen. Returns all matches.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Category name or code text to look for, e.g. "valet" or "247". Case-insensitive partial match.' }
        },
        required: ['query']
      },
      execute: function (args) {
        var query = args && args.query;
        if (!query || !String(query).trim()) {
          return { error: true, message: 'query is required', next_action: 'Ask the wearer what to look for.' };
        }
        if (captureInProgress()) {
          return { error: true, message: 'A capture is in progress.', next_action: 'Tell the wearer to save or cancel the capture first, then stop.' };
        }
        if (!state.stubs.length) {
          return { error: true, message: 'No stubs are saved.', next_action: 'Tell the wearer there are no saved stubs, then stop.' };
        }
        var matches = findStubs(query);
        if (!matches.length) {
          return { error: true, message: 'No stub matches "' + query + '".', count: 0, next_action: 'Tell the wearer nothing matched, then stop.' };
        }
        goToStub(matches[0].id);
        return {
          count: matches.length,
          showing: stubSummary(matches[0]),
          matches: matches.map(stubSummary),
          next_action: 'Read the shown stub\'s category and code in one short sentence, then stop.',
        };
      }
    });

    safeRegister({
      name: 'stub_delete',
      description: 'Delete a saved stub by its exact code (e.g. 247, A-19). Only call this when the wearer explicitly asked to delete it. Returns the remaining stubs.',
      inputSchema: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'The exact code printed on the stub to delete, e.g. "247" or "A-19". Case-insensitive.' }
        },
        required: ['code']
      },
      execute: function (args) {
        var code = args && args.code;
        var norm = function (c) { return String(c || '').replace(/[\s·#\-]/g, '').toLowerCase(); };
        if (!code || !norm(code)) {
          return { error: true, message: 'code is required', next_action: 'Ask the wearer which stub code to delete.' };
        }
        if (captureInProgress()) {
          return { error: true, message: 'A capture is in progress.', next_action: 'Tell the wearer to save or cancel the capture first, then stop.' };
        }
        var matches = state.stubs.filter(function (s) { return norm(s.code) === norm(code); });
        if (!matches.length) {
          return { error: true, message: 'No stub has code "' + code + '".', next_action: 'Tell the wearer nothing matched, then stop.' };
        }
        if (matches.length > 1) {
          return {
            error: true,
            message: matches.length + ' stubs share code "' + code + '".',
            matches: matches.map(stubSummary),
            next_action: 'Tell the wearer several stubs share that code and to delete it from the carousel, then stop.',
          };
        }
        var target = matches[0];
        state.detailId = target.id;
        deleteStub(); // same function the Enter key calls on the delete screen
        return {
          deleted: stubSummary(target),
          count: state.stubs.length,
          stubs: state.stubs.map(stubSummary),
          next_action: 'Confirm the deletion in one short sentence, then stop.',
        };
      }
    });
  }

  // ===========================================================
  //  URL STATE — for screenshot generation
  // ===========================================================
  function applyUrlState() {
    if (typeof URLSearchParams === 'undefined') return false;
    var p = new URLSearchParams(location.search);
    var s = p.get('state');
    if (!s) return false;
    switch (s) {
      case 'home-empty':
        state.stubs = [];
        showScreen('home-empty');
        return true;
      case 'home':
        if (state.stubs.length === 0) state.stubs = SEED_STUBS.slice();
        state.carIdx = 0;
        showScreen('home');
        return true;
      case 'home-new':
        if (state.stubs.length === 0) state.stubs = SEED_STUBS.slice();
        state.carIdx = state.stubs.length;
        showScreen('home');
        return true;
      case 'capture':
        showScreen('capture');
        return true;
      case 'scanning':
        showScreen('scanning');
        return true;
      case 'confirm':
        state.pending = {
          id:         'preview',
          category:   DEMO_POOL[3].category,
          code:       DEMO_POOL[3].code,
          location:   DEMO_POOL[3].location,
          capturedAt: Date.now(),
        };
        showScreen('confirm');
        return true;
      case 'detail':
        if (state.stubs.length === 0) state.stubs = SEED_STUBS.slice();
        state.detailId = state.stubs[0].id;
        showScreen('detail');
        return true;
      case 'delete':
        if (state.stubs.length === 0) state.stubs = SEED_STUBS.slice();
        state.detailId = state.stubs[0].id;
        showScreen('delete');
        return true;
    }
    return false;
  }

  // ===========================================================
  //  INIT
  // ===========================================================
  function init() {
    restore();
    document.addEventListener('keydown', onKey);
    document.addEventListener('click', onClick);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) pauseForHidden(); else resumeFromHidden();
    });
    startClock();
    if (!applyUrlState()) startCapture();
    registerWebMcp();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
