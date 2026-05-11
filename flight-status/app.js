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
  };

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
    var seed     = hash32(airline.code + flightNo + date.toDateString());
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

    return {
      airline:     airline,
      flightNo:    flightNo,
      origin:      origin,
      dest:        dest,
      terminal:    terminal,
      gate:        gate,
      board:       fmtTime(boardMin),
      carousel:    carousel,
      dep:         fmtTime(depMin),
      arr:         fmtTime(arrMin),
      statusLabel: statusLabel,
      statusClass: statusClass,
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
    }
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

    saveLast({
      code:  s.airline.code + ' · ' + s.flightNo,
      route: s.origin + ' → ' + s.dest,
    });
  }

  // ===========================================================
  //  WIZARD ACTIONS
  // ===========================================================
  function startWizard() {
    state.airlineIdx   = 0;
    state.flightDigits = [0, 0, 0, 0];
    state.digitIdx     = 0;
    state.dateOffset   = 0;
    state.status       = null;
    showScreen('step-airline');
  }

  // ===========================================================
  //  KEY HANDLING — arrows + enter only
  // ===========================================================
  function onKey(e) {
    var k = e.key;
    if (state.screen === 'home') {
      if (k === 'Enter' || k === ' ') { startWizard(); e.preventDefault(); }
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
      if (k === 'Enter' || k === ' ') {
        state.status = null;
        startWizard();
        e.preventDefault();
      }
      return;
    }
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
    if (el && el.dataset.action === 'start') { startWizard(); return; }
    var dateTile = e.target.closest('#date-grid .date-tile');
    if (dateTile && state.screen === 'step-date') {
      state.dateOffset = parseInt(dateTile.dataset.value, 10);
      renderDate();
    }
  }

  // ===========================================================
  //  INIT
  // ===========================================================
  function init() {
    document.addEventListener('keydown', onKey);
    document.addEventListener('click', onClick);
    tickClock();
    setInterval(tickClock, 1000);
    showScreen('home');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
