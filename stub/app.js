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
    screen:    'home',     // 'home-empty' | 'home' | 'aim' | 'scanning' | 'confirm' | 'detail' | 'delete'
    stubs:     [],         // most-recent first
    carIdx:    0,          // home carousel index (0..stubs.length, where stubs.length === "+ NEW")
    detailId:  null,
    pending:   null,       // freshly-scanned stub awaiting confirm
    poolIdx:   3,          // start past the seeded stubs so the first demo capture is fresh content
  };

  var SCREENS = ['home-empty', 'home', 'aim', 'scanning', 'confirm', 'detail', 'delete'];

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
    state.screen = name;
    SCREENS.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.classList.toggle('hidden', id !== name);
    });
    if (name === 'home-empty') renderEmpty();
    if (name === 'home')       renderHome();
    if (name === 'aim')        renderAim();
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
  //  RENDER — aim
  // ===========================================================
  function renderAim() { /* static markup, nothing dynamic */ }

  // ===========================================================
  //  RENDER — scanning (auto-advances to confirm)
  // ===========================================================
  var scanTimer = null;
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

    // cycle the status label so the OCR feels stepwise
    var statusEl = document.getElementById('scan-status');
    var steps = ['CAPTURING…', 'READING TEXT…', 'PARSING TAG…'];
    var s = 0;
    if (statusEl) statusEl.textContent = steps[s];
    var statusTick = setInterval(function () {
      s = (s + 1) % steps.length;
      if (statusEl) statusEl.textContent = steps[s];
    }, 380);

    clearTimeout(scanTimer);
    scanTimer = setTimeout(function () {
      clearInterval(statusTick);
      if (state.screen === 'scanning') showScreen('confirm');
    }, CONFIG.scanDurationMs);
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
    showScreen('aim');
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

    if (state.screen === 'aim') {
      if (k === 'Enter' || k === ' ') {
        showScreen('scanning');
        e.preventDefault();
      } else if (k === 'ArrowLeft') {
        goHome();
        e.preventDefault();
      }
      return;
    }

    if (state.screen === 'scanning') {
      // No input — auto-advances. Allow ◀ to bail out.
      if (k === 'ArrowLeft') {
        clearTimeout(scanTimer);
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
        showScreen('aim');
        e.preventDefault();
      } else if (k === 'ArrowLeft') {
        state.pending = null;
        goHome();
        e.preventDefault();
      }
      return;
    }

    if (state.screen === 'detail') {
      if (k === 'ArrowLeft' || k === 'Enter' || k === ' ') {
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
      } else if (k === 'ArrowLeft') {
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
      case 'aim':
        showScreen('aim');
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
    tickClock();
    setInterval(tickClock, 1000);
    if (!applyUrlState()) goHome();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
