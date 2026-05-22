(function () {
  'use strict';

  // ===========================================================
  //  CONFIG
  // ===========================================================
  var CONFIG = {
    storageKey: 'mdg_flight_status_v1',
  };

  var AIRLINES = [
    { code: 'AA', name: 'American Airlines',  hubs: ['DFW','ORD','MIA','JFK','PHL','CLT'] },
    { code: 'UA', name: 'United Airlines',    hubs: ['ORD','EWR','SFO','IAH','DEN','LAX'] },
    { code: 'DL', name: 'Delta Air Lines',    hubs: ['ATL','JFK','LAX','SLC','DTW','BOS'] },
    { code: 'B6', name: 'JetBlue Airways',    hubs: ['JFK','BOS','FLL','LAX','MCO'] },
    { code: 'AS', name: 'Alaska Airlines',    hubs: ['SEA','LAX','SFO','PDX','SAN'] },
    { code: 'WN', name: 'Southwest',          hubs: ['LAS','DAL','BWI','MDW','PHX','DEN'] },
    { code: 'BA', name: 'British Airways',    hubs: ['LHR','JFK','LAX','BOS','SFO'] },
    { code: 'LH', name: 'Lufthansa',          hubs: ['FRA','MUC','JFK','LAX','ORD'] },
    { code: 'AF', name: 'Air France',         hubs: ['CDG','JFK','LAX','MIA','BOS'] },
    { code: 'KL', name: 'KLM',                hubs: ['AMS','JFK','LAX','SFO'] },
    { code: 'EK', name: 'Emirates',           hubs: ['DXB','JFK','LHR','LAX','SFO'] },
    { code: 'QR', name: 'Qatar Airways',      hubs: ['DOH','LHR','JFK','LAX'] },
    { code: 'SQ', name: 'Singapore Airlines', hubs: ['SIN','JFK','LHR','LAX','SFO'] },
    { code: 'NH', name: 'ANA',                hubs: ['NRT','HND','LAX','JFK','SFO'] },
    { code: 'CX', name: 'Cathay Pacific',     hubs: ['HKG','LAX','JFK','SFO','BOS'] },
  ];

  var EXTRA_DESTS = ['JFK','LAX','ORD','ATL','MIA','SFO','BOS','LHR','CDG','FRA','AMS','DXB','SIN','HND','HKG','MAD','BCN','FCO','SEA','DEN'];

  // ===========================================================
  //  STATE
  // ===========================================================
  var state = {
    screen:        'home',
    airlineIdx:    0,
    flightDigits:  [0, 0, 0, 0],
    digitIdx:      0,
    dateOffset:    0,
    status:        null,
    statusView:    'main',  // 'main' | 'seat' | 'carousel'
    statusMode:    'full',  // 'full' | 'compact'
    homeFocus:     'start', // 'start' | 'last'
    refreshCount:  0,       // bumped by ENTER on status to reroll mock data
  };

  var STATUS_VIEWS = ['main', 'seat', 'carousel'];
  function nextStatusView(cur, dir) {
    var i = STATUS_VIEWS.indexOf(cur);
    if (i < 0) i = 0;
    var n = (i + (dir < 0 ? -1 : 1) + STATUS_VIEWS.length) % STATUS_VIEWS.length;
    return STATUS_VIEWS[n];
  }

  var SEAT_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
  function seatRoleFor(letter) {
    if (letter === 'A' || letter === 'F') return 'WINDOW';
    if (letter === 'C' || letter === 'D') return 'AISLE';
    return 'MIDDLE';
  }

  // ===========================================================
  //  DETERMINISTIC RNG (so the same flight gives the same status)
  // ===========================================================
  function hash32(str) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return (((t ^ (t >>> 14)) >>> 0) / 4294967296);
    };
  }

  function fmtTime(totalMin) {
    var h = ((Math.floor(totalMin / 60)) % 24 + 24) % 24;
    var m = ((totalMin % 60) + 60) % 60;
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }

  function fmtTime12(totalMin) {
    var h24 = ((Math.floor(totalMin / 60)) % 24 + 24) % 24;
    var m   = ((totalMin % 60) + 60) % 60;
    var period = h24 >= 12 ? 'PM' : 'AM';
    var h12 = h24 % 12; if (h12 === 0) h12 = 12;
    return h12 + ':' + (m < 10 ? '0' : '') + m + ' ' + period;
  }

  function fmtDate(d) {
    var dn = ['SUN','MON','TUE','WED','THU','FRI','SAT'][d.getDay()];
    var mn = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][d.getMonth()];
    return dn + ' · ' + mn + ' ' + d.getDate();
  }

  // ===========================================================
  //  BUILD STATUS
  // ===========================================================
  function buildStatus() {
    var airline  = AIRLINES[state.airlineIdx];
    var flightNo = state.flightDigits.join('');
    var date     = new Date(Date.now() + state.dateOffset * 86400000);
    var seed     = hash32(airline.code + flightNo + date.toDateString() + '#' + (state.refreshCount || 0));
    var r        = rng(seed);

    var origin = airline.hubs[Math.floor(r() * airline.hubs.length)];
    var pool   = airline.hubs.concat(EXTRA_DESTS).filter(function (a) { return a !== origin; });
    var dest   = pool[Math.floor(r() * pool.length)];

    var terminal = String(1 + Math.floor(r() * 8));
    var gateLetter = 'ABCDEF'.charAt(Math.floor(r() * 6));
    var gateNum    = 1 + Math.floor(r() * 60);
    var gate       = gateLetter + gateNum;

    var depMin   = 6 * 60 + Math.floor(r() * 16 * 60);
    var boardMin = depMin - 30;
    var durMin   = 60 + Math.floor(r() * 13 * 60);
    var arrMin   = depMin + durMin;

    var carousel = String(1 + Math.floor(r() * 14));

    var statusRoll = r();
    var statusLabel, statusClass;
    if (statusRoll < 0.15)      { statusLabel = 'DELAYED';  statusClass = 'delayed'; }
    else if (statusRoll < 0.30) { statusLabel = 'BOARDING'; statusClass = 'boarding'; }
    else                        { statusLabel = 'ON TIME';  statusClass = ''; }

    // Seat — row + letter, plus class
    var row        = 1 + Math.floor(r() * 42);
    var seatLetter = SEAT_LETTERS[Math.floor(r() * SEAT_LETTERS.length)];
    var seat       = String(row) + seatLetter;
    var classRoll  = r();
    var seatClass;
    if (classRoll < 0.04)      seatClass = 'FIRST';
    else if (classRoll < 0.12) seatClass = 'BUSINESS';
    else if (classRoll < 0.25) seatClass = 'PREMIUM ECONOMY';
    else                       seatClass = 'ECONOMY';

    return {
      airline:     airline,
      flightNo:    flightNo,
      origin:      origin,
      dest:        dest,
      terminal:    terminal,
      gate:        gate,
      board:       fmtTime12(boardMin),
      carousel:    carousel,
      dep:         fmtTime(depMin),
      arr:         fmtTime(arrMin),
      statusLabel: statusLabel,
      statusClass: statusClass,
      seat:        seat,
      seatRole:    seatRoleFor(seatLetter),
      seatClass:   seatClass,
    };
  }

  // ===========================================================
  //  SCREEN SWITCHING
  // ===========================================================
  var SCREENS = ['home', 'step-airline', 'step-number', 'step-date', 'status'];

  function showScreen(name) {
    state.screen = name;
    SCREENS.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.classList.toggle('hidden', id !== name);
    });
    if (name === 'home')         renderHome();
    if (name === 'step-airline') renderAirline();
    if (name === 'step-number')  renderNumber();
    if (name === 'step-date')    renderDate();
    if (name === 'status')       renderStatus();
  }

  // ===========================================================
  //  RENDER — HOME
  // ===========================================================
  function renderHome() {
    var last = loadLast();
    var card = document.getElementById('last-card');

    if (last && card) {
      document.getElementById('last-code').textContent  = last.code;
      document.getElementById('last-route').textContent = last.route;
      card.classList.remove('hidden');
    } else if (card) {
      card.classList.add('hidden');
      state.homeFocus = 'start';
    }
    applyHomeFocus();
  }

  function applyHomeFocus() {
    var card = document.getElementById('last-card');
    var cta  = document.getElementById('cta-start');
    if (!card || !cta) return;
    var target = (state.homeFocus === 'last' && !card.classList.contains('hidden')) ? card : cta;
    try { target.focus(); } catch (e) { /* ignore */ }
  }

  // ===========================================================
  //  RENDER — STEP 1 AIRLINE
  // ===========================================================
  function renderAirline() {
    var a    = AIRLINES[state.airlineIdx];
    var prev = AIRLINES[(state.airlineIdx - 1 + AIRLINES.length) % AIRLINES.length];
    var next = AIRLINES[(state.airlineIdx + 1) % AIRLINES.length];
    document.getElementById('airline-code').textContent  = a.code;
    document.getElementById('airline-name').textContent  = a.name;
    document.getElementById('airline-prev').textContent  = prev.code;
    document.getElementById('airline-next').textContent  = next.code;
    document.getElementById('airline-count').textContent = (state.airlineIdx + 1) + ' / ' + AIRLINES.length;
  }

  // ===========================================================
  //  RENDER — STEP 2 FLIGHT NUMBER
  // ===========================================================
  function renderNumber(changedIdx) {
    document.getElementById('number-prefix').textContent = AIRLINES[state.airlineIdx].code;
    var nodes = document.querySelectorAll('#digits .digit');
    nodes.forEach(function (n, i) {
      n.classList.toggle('active', i === state.digitIdx);
      var val = n.querySelector('.digit-val');
      val.textContent = String(state.flightDigits[i]);
      if (changedIdx === i) {
        val.classList.remove('tick');
        // restart animation
        void val.offsetWidth;
        val.classList.add('tick');
      }
    });
  }

  // ===========================================================
  //  RENDER — STEP 3 DATE
  // ===========================================================
  function renderDate() {
    var now = new Date();
    var t1  = new Date(now.getTime());
    var t2  = new Date(now.getTime() + 86400000);
    document.getElementById('date-today').textContent    = fmtDate(t1);
    document.getElementById('date-tomorrow').textContent = fmtDate(t2);
    document.querySelectorAll('#date-grid .date-tile').forEach(function (t) {
      t.classList.toggle('active', parseInt(t.dataset.value, 10) === state.dateOffset);
    });
  }

  // ===========================================================
  //  RENDER — STATUS
  // ===========================================================
  function renderStatus() {
    if (!state.status) state.status = buildStatus();
    var s = state.status;
    document.getElementById('s-flight').textContent   = s.airline.code + ' · ' + s.flightNo;
    document.getElementById('s-route').textContent    = s.origin + ' → ' + s.dest;
    var badge = document.getElementById('s-badge');
    badge.textContent = s.statusLabel;
    badge.className   = 'status-badge ' + s.statusClass;

    document.getElementById('s-terminal').textContent = s.terminal;
    document.getElementById('s-gate').textContent     = s.gate;
    document.getElementById('s-board').textContent    = s.board;
    document.getElementById('s-carousel').textContent = s.carousel;
    document.getElementById('s-dep').textContent      = s.dep;
    document.getElementById('s-arr').textContent      = s.arr;
    document.getElementById('s-seat').textContent     = s.seat;
    document.getElementById('s-seat-sub').textContent = s.seatClass + ' · ' + s.seatRole;

    setStatusView(state.statusView);

    saveLast({
      code:         s.airline.code + ' · ' + s.flightNo,
      route:        s.origin + ' → ' + s.dest,
      airlineIdx:   state.airlineIdx,
      flightDigits: state.flightDigits.slice(),
      dateOffset:   state.dateOffset,
      refreshCount: state.refreshCount || 0,
    });
  }

  function setStatusView(view) {
    state.statusView = view;
    // full mode tiles
    var main = document.getElementById('view-main');
    var seat = document.getElementById('view-seat');
    var caro = document.getElementById('view-carousel');
    var dotM = document.getElementById('dot-main');
    var dotS = document.getElementById('dot-seat');
    var dotC = document.getElementById('dot-carousel');
    if (main) main.classList.toggle('hidden', view !== 'main');
    if (seat) seat.classList.toggle('hidden', view !== 'seat');
    if (caro) caro.classList.toggle('hidden', view !== 'carousel');
    if (dotM) dotM.classList.toggle('on', view === 'main');
    if (dotS) dotS.classList.toggle('on', view === 'seat');
    if (dotC) dotC.classList.toggle('on', view === 'carousel');
    // compact strip sub-views mirror the same selection
    var csMain = document.getElementById('cs-view-main');
    var csSeat = document.getElementById('cs-view-seat');
    var csCaro = document.getElementById('cs-view-carousel');
    var csDotM = document.getElementById('cs-dot-main');
    var csDotS = document.getElementById('cs-dot-seat');
    var csDotC = document.getElementById('cs-dot-carousel');
    if (csMain) csMain.classList.toggle('hidden', view !== 'main');
    if (csSeat) csSeat.classList.toggle('hidden', view !== 'seat');
    if (csCaro) csCaro.classList.toggle('hidden', view !== 'carousel');
    if (csDotM) csDotM.classList.toggle('on', view === 'main');
    if (csDotS) csDotS.classList.toggle('on', view === 'seat');
    if (csDotC) csDotC.classList.toggle('on', view === 'carousel');
  }

  function flashRefresh() {
    var el = document.getElementById('status-views');
    if (!el) return;
    el.classList.remove('refresh-flash');
    void el.offsetWidth; // restart animation
    el.classList.add('refresh-flash');
  }

  function setStatusMode(mode) {
    state.statusMode = mode;
    var sec     = document.getElementById('status');
    var compact = document.getElementById('status-compact');
    if (!sec || !compact) return;
    if (mode === 'compact') {
      // populate both compact sub-views from current status
      var s = state.status;
      if (s) {
        document.getElementById('cs-flight').textContent   = s.airline.code + '·' + s.flightNo;
        document.getElementById('cs-terminal').textContent = s.terminal;
        document.getElementById('cs-gate').textContent     = s.gate;
        document.getElementById('cs-board').textContent    = s.board;
        document.getElementById('cs-carousel').textContent = s.carousel;
        document.getElementById('cs-seat').textContent     = s.seat;
        document.getElementById('cs-seat-sub').textContent = s.seatClass + ' · ' + s.seatRole;
      }
      compact.classList.remove('hidden');
      sec.classList.add('compact');
    } else {
      compact.classList.add('hidden');
      sec.classList.remove('compact');
    }
  }

  function restoreLast() {
    var last = loadLast();
    if (!last || typeof last.airlineIdx !== 'number' || !last.flightDigits) return false;
    state.airlineIdx   = last.airlineIdx;
    state.flightDigits = last.flightDigits.slice();
    state.dateOffset   = last.dateOffset || 0;
    state.refreshCount = last.refreshCount || 0;
    state.status       = null;       // rebuild from saved inputs (same hash → same data)
    state.statusView   = 'main';
    state.statusMode   = 'full';
    showScreen('status');
    return true;
  }

  // ===========================================================
  //  WIZARD ACTIONS
  // ===========================================================
  function startWizard() {
    state.airlineIdx   = 0;
    state.flightDigits = [0, 0, 0, 0];
    state.digitIdx     = 0;
    state.dateOffset   = 0;
    state.refreshCount = 0;
    state.status       = null;
    state.statusView   = 'main';
    state.statusMode   = 'full';
    showScreen('step-airline');
  }

  // ===========================================================
  //  KEY HANDLING — arrows + enter only
  // ===========================================================
  function onKey(e) {
    var k = e.key;
    if (state.screen === 'home') {
      var card = document.getElementById('last-card');
      var hasLast = card && !card.classList.contains('hidden');
      // Directional, idempotent at edges:
      //   ▲ moves focus UP to LAST FLIGHT (which sits above the CTA)
      //   ▼ moves focus DOWN to FIND FLIGHT
      if (k === 'ArrowUp' && hasLast) {
        state.homeFocus = 'last';
        applyHomeFocus();
        e.preventDefault();
        return;
      }
      if (k === 'ArrowDown') {
        state.homeFocus = 'start';
        applyHomeFocus();
        e.preventDefault();
        return;
      }
      if (k === 'Enter' || k === ' ') {
        if (state.homeFocus === 'last' && hasLast) {
          if (!restoreLast()) startWizard();
        } else {
          startWizard();
        }
        e.preventDefault();
      }
      return;
    }

    if (state.screen === 'step-airline') {
      if (k === 'ArrowLeft') {
        state.airlineIdx = (state.airlineIdx - 1 + AIRLINES.length) % AIRLINES.length;
        renderAirline(); e.preventDefault();
      } else if (k === 'ArrowRight') {
        state.airlineIdx = (state.airlineIdx + 1) % AIRLINES.length;
        renderAirline(); e.preventDefault();
      } else if (k === 'Enter' || k === ' ') {
        state.digitIdx = 0;
        showScreen('step-number');
        e.preventDefault();
      }
      return;
    }

    if (state.screen === 'step-number') {
      if (k === 'ArrowLeft') {
        if (state.digitIdx > 0) {
          state.digitIdx--;
          renderNumber();
        } else {
          showScreen('step-airline');
        }
        e.preventDefault();
      } else if (k === 'ArrowRight') {
        if (state.digitIdx < 3) {
          state.digitIdx++;
          renderNumber();
        } else {
          showScreen('step-date');
        }
        e.preventDefault();
      } else if (k === 'ArrowUp') {
        state.flightDigits[state.digitIdx] = (state.flightDigits[state.digitIdx] + 1) % 10;
        renderNumber(state.digitIdx);
        e.preventDefault();
      } else if (k === 'ArrowDown') {
        state.flightDigits[state.digitIdx] = (state.flightDigits[state.digitIdx] + 9) % 10;
        renderNumber(state.digitIdx);
        e.preventDefault();
      } else if (k === 'Enter' || k === ' ') {
        showScreen('step-date');
        e.preventDefault();
      }
      return;
    }

    if (state.screen === 'step-date') {
      if (k === 'ArrowLeft') {
        state.dateOffset = 0; renderDate(); e.preventDefault();
      } else if (k === 'ArrowRight') {
        state.dateOffset = 1; renderDate(); e.preventDefault();
      } else if (k === 'Enter' || k === ' ') {
        state.status = buildStatus();
        showScreen('status');
        e.preventDefault();
      } else if (k === 'ArrowUp') {
        state.digitIdx = 3;
        showScreen('step-number');
        e.preventDefault();
      }
      return;
    }

    if (state.screen === 'status') {
      if (k === 'ArrowUp') {
        // collapse — keeps current view (main/seat)
        setStatusMode('compact');
        e.preventDefault();
      } else if (k === 'ArrowDown') {
        // expand — keeps current view (main/seat)
        setStatusMode('full');
        e.preventDefault();
      } else if (k === 'ArrowLeft') {
        setStatusView(nextStatusView(state.statusView, -1));
        e.preventDefault();
      } else if (k === 'ArrowRight') {
        setStatusView(nextStatusView(state.statusView, +1));
        e.preventDefault();
      } else if (k === 'Enter' || k === ' ') {
        if (state.statusMode === 'compact') {
          // Enter in compact: expand to full of current view
          setStatusMode('full');
        } else {
          // Enter in full: refresh — reroll mock data, stay on current view
          state.refreshCount = (state.refreshCount || 0) + 1;
          state.status = buildStatus();
          renderStatus();
          flashRefresh();
        }
        e.preventDefault();
      }
      return;
    }
  }

  // ===========================================================
  //  SWIPE on status screen
  //    horizontal → toggle main / seat (when full)
  //    swipe up   → collapse to compact strip
  //    swipe down → expand back to full
  // ===========================================================
  function setupSwipe() {
    var SWIPE_MIN = 32;   // px to register a swipe
    var startX = 0, startY = 0, tracking = false, originatedOnControl = false;

    function onDown(e) {
      if (state.screen !== 'status') return;
      // Don't hijack clicks on focusable controls (e.g. last-card on home, buttons).
      var t = e.target;
      originatedOnControl = !!(t && typeof t.closest === 'function' && t.closest('button'));
      var p = e.touches ? e.touches[0] : e;
      startX = p.clientX;
      startY = p.clientY;
      tracking = true;
    }
    function onUp(e) {
      if (!tracking) return;
      tracking = false;
      if (originatedOnControl) return;
      var p = (e.changedTouches && e.changedTouches[0]) || e;
      var dx = p.clientX - startX;
      var dy = p.clientY - startY;
      var ax = Math.abs(dx), ay = Math.abs(dy);
      if (ax < SWIPE_MIN && ay < SWIPE_MIN) return;
      if (ay > ax) {
        // vertical swipe
        if (dy < 0) setStatusMode('compact');
        else        setStatusMode('full');
      } else {
        // horizontal swipe → cycle through main → seat → carousel
        setStatusView(nextStatusView(state.statusView, dx < 0 ? +1 : -1));
      }
    }
    document.addEventListener('touchstart', onDown, { passive: true });
    document.addEventListener('touchend',   onUp);
    document.addEventListener('mousedown',  onDown);
    document.addEventListener('mouseup',    onUp);
  }

  // ===========================================================
  //  CLOCK — live time at top of home & status
  // ===========================================================
  function tickClock() {
    var d = new Date();
    var t = (d.getHours() < 10 ? '0' : '') + d.getHours()
          + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
    var a = document.getElementById('clock-home');
    var b = document.getElementById('clock-status');
    if (a) a.textContent = t;
    if (b) b.textContent = 'UPDATED ' + t;
  }

  // ===========================================================
  //  STORAGE
  // ===========================================================
  function saveLast(o) {
    try { localStorage.setItem(CONFIG.storageKey, JSON.stringify(o)); } catch (e) { /* ignore */ }
  }
  function loadLast() {
    try { var raw = localStorage.getItem(CONFIG.storageKey); return raw ? JSON.parse(raw) : null; }
    catch (e) { return null; }
  }

  // ===========================================================
  //  POINTER FALLBACK (so you can also click tiles in browser)
  // ===========================================================
  function onClick(e) {
    var el = e.target.closest('[data-action]');
    if (el) {
      if (el.dataset.action === 'start')   { startWizard(); return; }
      if (el.dataset.action === 'restore') { if (!restoreLast()) startWizard(); return; }
    }
    var dateTile = e.target.closest('#date-grid .date-tile');
    if (dateTile && state.screen === 'step-date') {
      state.dateOffset = parseInt(dateTile.dataset.value, 10);
      renderDate();
    }
    // Tap on the compact strip expands back to full.
    if (state.screen === 'status' && state.statusMode === 'compact') {
      var strip = e.target.closest('#status-compact');
      if (strip) setStatusMode('full');
    }
  }

  // ===========================================================
  //  INIT
  // ===========================================================
  // Optional: pre-set a screen/view via URL — used to generate the
  // README screenshots (e.g. ?state=compact-seat). Harmless otherwise.
  function applyUrlState() {
    if (typeof URLSearchParams === 'undefined') return false;
    var p = new URLSearchParams(location.search);
    var s = p.get('state');
    if (!s) return false;
    state.airlineIdx   = 2;          // DL
    state.flightDigits = [2, 3, 2, 4];
    state.dateOffset   = 0;
    state.status       = buildStatus();
    var sampleLast = {
      code: 'DL · 2324', route: state.status.origin + ' → ' + state.status.dest,
      airlineIdx: 2, flightDigits: [2,3,2,4], dateOffset: 0,
    };
    switch (s) {
      case 'home':
      case 'home-find':
        saveLast(sampleLast);
        state.homeFocus = 'start';
        showScreen('home');
        return true;
      case 'home-last':
        saveLast(sampleLast);
        state.homeFocus = 'last';
        showScreen('home');
        return true;
      case 'airline':
        showScreen('step-airline');
        return true;
      case 'number':
        state.digitIdx = 1;
        showScreen('step-number');
        return true;
      case 'date':
        showScreen('step-date');
        return true;
      case 'status-main':
        showScreen('status'); setStatusView('main'); setStatusMode('full');
        return true;
      case 'status-seat':
        showScreen('status'); setStatusView('seat'); setStatusMode('full');
        return true;
      case 'status-carousel':
        showScreen('status'); setStatusView('carousel'); setStatusMode('full');
        return true;
      case 'compact-main':
        showScreen('status'); setStatusView('main'); setStatusMode('compact');
        return true;
      case 'compact-seat':
        showScreen('status'); setStatusView('seat'); setStatusMode('compact');
        return true;
      case 'compact-carousel':
        showScreen('status'); setStatusView('carousel'); setStatusMode('compact');
        return true;
    }
    return false;
  }

  function init() {
    document.addEventListener('keydown', onKey);
    document.addEventListener('click', onClick);
    setupSwipe();
    tickClock();
    setInterval(tickClock, 1000);
    if (!applyUrlState()) showScreen('home');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
