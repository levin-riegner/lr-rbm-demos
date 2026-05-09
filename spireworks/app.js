(function () {
  'use strict';

  // ==================== CONFIG ====================
  var CONFIG = {
    appName: 'Spireworks',
    storageKey: 'mdg_spireworks',
    sessionDuration: 120, // seconds
    api: {
      baseUrl: 'https://spireworks.org/api',
    },
  };

  var BUILDINGS = {
    owtc: {
      id: 'owtc',
      name: 'One World Trade',
      shortName: '1 WTC',
      location: 'Lower Manhattan',
      height: '1,776 ft',
      lat: 40.7127,
      lon: -74.0134,
    },
    obp: {
      id: 'obp',
      name: 'One Bryant Park',
      shortName: '1 Bryant',
      location: 'Midtown',
      height: '1,200 ft',
      lat: 40.7553,
      lon: -73.9844,
    },
    ofo: {
      id: 'ofo',
      name: 'One Five One W 42nd',
      shortName: '151 W 42nd',
      location: 'Times Square',
      height: '750 ft',
      lat: 40.7548,
      lon: -73.9869,
    },
    sven: {
      id: 'sven',
      name: 'Sven',
      shortName: 'Sven',
      location: 'Midtown West',
      height: '680 ft',
      lat: 40.7497,
      lon: -73.9978,
    },
    hp: {
      id: 'hp',
      name: 'Halletts Point',
      shortName: 'Halletts Pt',
      location: 'Astoria, Queens',
      height: '430 ft',
      lat: 40.7738,
      lon: -73.9264,
    },
  };

  // Rainbow — 12 colors for a 3×4 grid
  var COLORS = [
    { name: 'Red',    hex: '#FF0000' },
    { name: 'Orange', hex: '#FF6600' },
    { name: 'Yellow', hex: '#FFD700' },
    { name: 'Green',  hex: '#00CC44' },
    { name: 'Teal',   hex: '#00CC99' },
    { name: 'Cyan',   hex: '#00DDFF' },
    { name: 'Sky',    hex: '#00AAFF' },
    { name: 'Blue',   hex: '#0044FF' },
    { name: 'Violet', hex: '#8800FF' },
    { name: 'Purple', hex: '#CC00CC' },
    { name: 'Pink',   hex: '#FF44AA' },
    { name: 'White',  hex: '#FFFFFF' },
  ];

  // ==================== STATE ====================
  var state = {
    currentScreen: 'home',
    screenHistory: [],
    selectedBuilding: null,
    selectedAmount: 10,
    activeColor: null,
    timerSecondsLeft: CONFIG.sessionDuration,
    timerInterval: null,
    sessionActive: false,
    // compass
    userLat: null,
    userLon: null,
    deviceHeading: null, // degrees, 0=north
    compassWatchId: null,
    orientationHandler: null,
    // color grid focus
    colorFocusIdx: 0,
  };

  // ==================== DOM ====================
  var screens = {};

  function collectScreens() {
    document.querySelectorAll('.screen').forEach(function (s) {
      if (s.id) screens[s.id] = s;
    });
  }

  function $(id) { return document.getElementById(id); }

  // ==================== NAVIGATION ====================
  function navigateTo(screenId, opts) {
    opts = opts || {};
    var addToHistory = opts.addToHistory !== false;
    if (addToHistory && state.currentScreen) {
      state.screenHistory.push(state.currentScreen);
    }
    Object.values(screens).forEach(function (s) { s.classList.add('hidden'); });
    if (screens[screenId]) {
      screens[screenId].classList.remove('hidden');
      state.currentScreen = screenId;
      onScreenEnter(screenId);
      focusFirst(screens[screenId]);
    }
  }

  function navigateBack() {
    if (state.screenHistory.length > 0) {
      navigateTo(state.screenHistory.pop(), { addToHistory: false });
    }
  }

  // ==================== FOCUS ====================
  function focusFirst(container) {
    var el = container.querySelector('.focusable:not([disabled]):not(.hidden)');
    if (el) el.focus();
  }

  function moveFocus(direction) {
    if (state.currentScreen === 'colors') {
      moveColorFocus(direction);
      return;
    }
    var container = screens[state.currentScreen];
    if (!container) return;
    var focusables = Array.from(container.querySelectorAll('.focusable:not([disabled]):not(.hidden)'));
    if (!focusables.length) return;
    var current = document.activeElement;
    var idx = focusables.indexOf(current);
    if (idx === -1) { focusFirst(container); return; }
    var nextIdx;
    if (direction === 'up' || direction === 'left') {
      nextIdx = idx > 0 ? idx - 1 : focusables.length - 1;
    } else {
      nextIdx = idx < focusables.length - 1 ? idx + 1 : 0;
    }
    focusables[nextIdx].focus();
    var scrollParent = focusables[nextIdx].closest('.content, .list-container');
    if (scrollParent) {
      focusables[nextIdx].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  function moveColorFocus(direction) {
    var cols = 4;
    var total = COLORS.length;
    var idx = state.colorFocusIdx;
    var row = Math.floor(idx / cols);
    var col = idx % cols;
    var rows = Math.ceil(total / cols);

    if (direction === 'right') { col = (col + 1) % cols; }
    else if (direction === 'left') { col = (col - 1 + cols) % cols; }
    else if (direction === 'down') { row = (row + 1) % rows; }
    else if (direction === 'up') { row = (row - 1 + rows) % rows; }

    var newIdx = row * cols + col;
    if (newIdx >= total) newIdx = total - 1;
    state.colorFocusIdx = newIdx;

    var cells = document.querySelectorAll('.color-cell');
    if (cells[newIdx]) cells[newIdx].focus();
  }

  // ==================== ACTIONS ====================
  function handleAction(action, element) {
    switch (action) {
      case 'back': navigateBack(); break;
      default: handleAppAction(action, element); break;
    }
  }

  function handleAppAction(action, element) {
    switch (action) {
      case 'go-buildings':
        navigateTo('buildings');
        break;

      case 'go-about':
        navigateTo('about');
        break;

      case 'go-home':
        stopTimer();
        stopCompass();
        state.sessionActive = false;
        navigateTo('home', { addToHistory: false });
        state.screenHistory = [];
        break;

      case 'select-building':
        var bId = element.dataset.building;
        state.selectedBuilding = BUILDINGS[bId];
        navigateTo('donate');
        break;

      case 'set-amount':
        state.selectedAmount = parseInt(element.dataset.amount, 10);
        document.querySelectorAll('.amount-btn').forEach(function (b) {
          b.classList.toggle('selected', parseInt(b.dataset.amount, 10) === state.selectedAmount);
        });
        $('selected-amount-display').textContent = '$' + state.selectedAmount;
        break;

      case 'confirm-donate':
        processDonation();
        break;

      case 'go-colors':
        stopCompass();
        startSession();
        break;

      case 'pick-color':
        var idx = parseInt(element.dataset.colorIdx, 10);
        setActiveColor(idx);
        break;
    }
  }

  // ==================== SCREEN ENTER ====================
  function onScreenEnter(screenId) {
    switch (screenId) {
      case 'home':
        animateHomeSpire();
        break;

      case 'donate':
        if (state.selectedBuilding) {
          $('donate-building-name').textContent = state.selectedBuilding.name;
        }
        // Highlight default amount
        document.querySelectorAll('.amount-btn').forEach(function (b) {
          b.classList.toggle('selected', parseInt(b.dataset.amount, 10) === state.selectedAmount);
        });
        $('selected-amount-display').textContent = '$' + state.selectedAmount;
        break;

      case 'compass':
        if (state.selectedBuilding) {
          $('compass-building-name').textContent = state.selectedBuilding.name;
        }
        startCompass();
        break;

      case 'colors':
        if (state.selectedBuilding) {
          $('colors-building-name').textContent = state.selectedBuilding.shortName;
        }
        buildColorGrid();
        state.colorFocusIdx = 0;
        break;

      case 'expired':
        stopTimer();
        break;
    }
  }

  // ==================== HOME SPIRE ANIMATION ====================
  function animateHomeSpire() {
    var spire = $('home-spire-light');
    if (!spire) return;
    var hue = 0;
    function cycle() {
      if (state.currentScreen !== 'home') return;
      spire.style.color = 'hsl(' + hue + ', 100%, 60%)';
      hue = (hue + 2) % 360;
      requestAnimationFrame(cycle);
    }
    cycle();
  }

  // ==================== DONATION ====================
  function processDonation() {
    var btn = $('donate-btn');
    if (btn) {
      btn.textContent = 'Processing...';
      btn.disabled = true;
    }
    // Simulate payment processing
    setTimeout(function () {
      if (btn) {
        btn.textContent = 'Donate & Get Access';
        btn.disabled = false;
      }
      showToast('Donation confirmed! Thank you!', 'success');
      setTimeout(function () {
        navigateTo('compass');
      }, 800);
    }, 1200);
  }

  // ==================== COMPASS ====================
  function startCompass() {
    $('compass-status').textContent = 'Locating...';
    $('compass-bearing-text').textContent = '';

    // Get GPS position
    if (navigator.geolocation) {
      state.compassWatchId = navigator.geolocation.watchPosition(
        function (pos) {
          state.userLat = pos.coords.latitude;
          state.userLon = pos.coords.longitude;
          $('compass-status').textContent = 'GPS locked';
          updateCompassDisplay();
        },
        function () {
          // Demo fallback: place user in midtown
          state.userLat = 40.7580;
          state.userLon = -73.9855;
          $('compass-status').textContent = 'Demo location (Midtown)';
          updateCompassDisplay();
        },
        { enableHighAccuracy: true, maximumAge: 3000 }
      );
    } else {
      state.userLat = 40.7580;
      state.userLon = -73.9855;
      $('compass-status').textContent = 'Demo location';
      updateCompassDisplay();
    }

    // Device orientation for compass heading
    function onOrientation(e) {
      var heading = null;
      // iOS: webkitCompassHeading is true north
      if (typeof e.webkitCompassHeading === 'number') {
        heading = e.webkitCompassHeading;
      } else if (e.alpha !== null) {
        // Android: alpha is relative to arbitrary reference; approximate
        heading = (360 - e.alpha) % 360;
      }
      if (heading !== null) {
        state.deviceHeading = heading;
        updateCompassDisplay();
      }
    }

    if (window.DeviceOrientationEvent) {
      // iOS 13+ requires permission
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
          .then(function (perm) {
            if (perm === 'granted') {
              window.addEventListener('deviceorientation', onOrientation, true);
              state.orientationHandler = onOrientation;
            }
          })
          .catch(function () {
            useDemoHeading();
          });
      } else {
        window.addEventListener('deviceorientation', onOrientation, true);
        state.orientationHandler = onOrientation;
      }
    } else {
      useDemoHeading();
    }
  }

  function useDemoHeading() {
    // Slowly rotate demo compass
    var demoHeading = 0;
    function tick() {
      if (state.currentScreen !== 'compass') return;
      demoHeading = (demoHeading + 1) % 360;
      state.deviceHeading = demoHeading;
      updateCompassDisplay();
      setTimeout(tick, 50);
    }
    tick();
  }

  function stopCompass() {
    if (state.compassWatchId !== null) {
      navigator.geolocation.clearWatch(state.compassWatchId);
      state.compassWatchId = null;
    }
    if (state.orientationHandler) {
      window.removeEventListener('deviceorientation', state.orientationHandler, true);
      state.orientationHandler = null;
    }
  }

  function bearingTo(lat1, lon1, lat2, lon2) {
    var toRad = Math.PI / 180;
    var dLon = (lon2 - lon1) * toRad;
    var y = Math.sin(dLon) * Math.cos(lat2 * toRad);
    var x = Math.cos(lat1 * toRad) * Math.sin(lat2 * toRad)
          - Math.sin(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.cos(dLon);
    var bearing = Math.atan2(y, x) * 180 / Math.PI;
    return (bearing + 360) % 360;
  }

  function distanceKm(lat1, lon1, lat2, lon2) {
    var R = 6371;
    var toRad = Math.PI / 180;
    var dLat = (lat2 - lat1) * toRad;
    var dLon = (lon2 - lon1) * toRad;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
          + Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad)
          * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function bearingToCardinal(deg) {
    var dirs = ['N','NE','E','SE','S','SW','W','NW'];
    return dirs[Math.round(deg / 45) % 8];
  }

  function updateCompassDisplay() {
    if (!state.selectedBuilding || state.userLat === null) return;

    var b = state.selectedBuilding;
    var toBearing = bearingTo(state.userLat, state.userLon, b.lat, b.lon);
    var dist = distanceKm(state.userLat, state.userLon, b.lat, b.lon);
    var distStr = dist < 1
      ? Math.round(dist * 1000) + 'm away'
      : dist.toFixed(1) + 'km away';

    $('compass-bearing-text').textContent =
      bearingToCardinal(toBearing) + ' · ' + distStr;

    // Arrow rotation: arrow should point at building relative to device heading
    var relBearing = 0;
    if (state.deviceHeading !== null) {
      relBearing = (toBearing - state.deviceHeading + 360) % 360;
    } else {
      relBearing = toBearing; // absolute north-up
    }

    var wrap = $('compass-arrow-wrap');
    var arrow = $('compass-arrow');
    if (wrap) {
      wrap.style.transform = 'rotate(' + relBearing + 'deg)';
    }

    var onTarget = relBearing < 15 || relBearing > 345;
    if (arrow) {
      arrow.classList.toggle('on-target', onTarget);
    }

    if (onTarget) {
      $('compass-instruction').textContent = 'You\'re pointing at it!';
    } else {
      var side = relBearing < 180 ? 'right' : 'left';
      $('compass-instruction').textContent = 'Turn ' + side + ' to face the spire';
    }
  }

  // ==================== COLOR GRID ====================
  function buildColorGrid() {
    var grid = $('color-grid');
    if (!grid) return;
    grid.innerHTML = '';
    COLORS.forEach(function (color, idx) {
      var cell = document.createElement('button');
      cell.className = 'color-cell focusable';
      cell.dataset.action = 'pick-color';
      cell.dataset.colorIdx = idx;
      cell.style.background = color.hex;
      cell.setAttribute('aria-label', color.name);
      cell.innerHTML = '<span class="color-cell-check">&#10003;</span>';
      grid.appendChild(cell);
    });
  }

  function setActiveColor(idx) {
    var color = COLORS[idx];
    if (!color) return;
    state.activeColor = color;
    state.colorFocusIdx = idx;

    var swatch = $('active-color-swatch');
    var nameEl = $('active-color-name');
    if (swatch) {
      swatch.style.background = color.hex;
      swatch.style.boxShadow = '0 0 20px ' + color.hex + '66';
    }
    if (nameEl) { nameEl.textContent = color.name; nameEl.style.color = color.hex; }

    // Mark active cell
    document.querySelectorAll('.color-cell').forEach(function (c, i) {
      c.classList.toggle('active', i === idx);
    });

    // Animate the home spire dot on any screen that's showing
    var spire = $('home-spire-light');
    if (spire) spire.style.color = color.hex;

    // In a real integration you'd POST to spireworks.org API here
    sendColorToApi(color);
  }

  function sendColorToApi(color) {
    if (!state.selectedBuilding) return;
    // Stub — real implementation would POST to spireworks.org
    console.log('[Spireworks] Set ' + state.selectedBuilding.id + ' → ' + color.hex);
  }

  // ==================== SESSION TIMER ====================
  function startSession() {
    state.sessionActive = true;
    state.timerSecondsLeft = CONFIG.sessionDuration;
    navigateTo('colors');
    updateTimerDisplay();

    state.timerInterval = setInterval(function () {
      state.timerSecondsLeft -= 1;
      updateTimerDisplay();

      if (state.timerSecondsLeft <= 0) {
        stopTimer();
        navigateTo('expired', { addToHistory: false });
      }
    }, 1000);
  }

  function stopTimer() {
    if (state.timerInterval) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }
    state.sessionActive = false;
  }

  function updateTimerDisplay() {
    var el = $('timer-display');
    if (!el) return;
    var s = state.timerSecondsLeft;
    var mins = Math.floor(s / 60);
    var secs = s % 60;
    el.textContent = mins + ':' + (secs < 10 ? '0' : '') + secs;
    el.classList.toggle('urgent', s <= 20);
  }

  // ==================== TOAST ====================
  function showToast(message, type) {
    var toast = $('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = 'toast' + (type ? ' ' + type : '');
    toast.offsetHeight; // force reflow
    toast.classList.add('visible');
    var delay = 3500 + Math.max(0, message.split(' ').length - 2) * 300;
    setTimeout(function () { toast.classList.remove('visible'); }, Math.min(delay, 8000));
  }

  // ==================== EVENTS ====================
  function setupEvents() {
    document.addEventListener('click', function (e) {
      var el = e.target.closest('[data-action]');
      if (el) handleAction(el.dataset.action, el);
    });

    document.addEventListener('keydown', function (e) {
      switch (e.key) {
        case 'ArrowUp':    moveFocus('up');    e.preventDefault(); break;
        case 'ArrowDown':  moveFocus('down');  e.preventDefault(); break;
        case 'ArrowLeft':  moveFocus('left');  e.preventDefault(); break;
        case 'ArrowRight': moveFocus('right'); e.preventDefault(); break;
        case 'Enter':
          if (document.activeElement && document.activeElement.classList.contains('focusable')) {
            document.activeElement.click();
          }
          e.preventDefault();
          break;
        case 'Escape': navigateBack(); e.preventDefault(); break;
      }
    });
  }

  // ==================== INIT ====================
  function init() {
    collectScreens();
    setupEvents();
    navigateTo('home', { addToHistory: false });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
