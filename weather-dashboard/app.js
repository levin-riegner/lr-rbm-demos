// Weather Dashboard — Meta Display Glasses webapp
// Data: Open-Meteo (no API key). D-pad + Enter navigation.

(function () {
  'use strict';

  // ==================== CONFIG ====================
  var CONFIG = {
    appName: 'Weather Dashboard',
    storageKey: 'mdg_weather_dashboard',
    api: {
      baseUrl: 'https://api.open-meteo.com/v1/forecast',
      cacheDuration: 10 * 60 * 1000, // 10 minutes per prompt
    },
  };

  // 5 preset cities per the prompt
  var CITIES = [
    { id: 'nyc',    name: 'New York', country: 'US', lat: 40.7128,  lon: -74.0060, tz: 'America/New_York'  },
    { id: 'london', name: 'London',   country: 'UK', lat: 51.5074,  lon: -0.1278,  tz: 'Europe/London'     },
    { id: 'tokyo',  name: 'Tokyo',    country: 'JP', lat: 35.6762,  lon: 139.6503, tz: 'Asia/Tokyo'        },
    { id: 'sydney', name: 'Sydney',   country: 'AU', lat: -33.8688, lon: 151.2093, tz: 'Australia/Sydney'  },
    { id: 'paris',  name: 'Paris',    country: 'FR', lat: 48.8566,  lon: 2.3522,   tz: 'Europe/Paris'      },
  ];

  // WMO weather code → { label, icon } (emoji is fine; avoids network font downloads)
  // https://open-meteo.com/en/docs — weather_code
  var WMO = {
    0:  { label: 'Clear sky',            icon: '\u2600\uFE0F' },           // ☀️
    1:  { label: 'Mainly clear',         icon: '\uD83C\uDF24\uFE0F' },     // 🌤
    2:  { label: 'Partly cloudy',        icon: '\u26C5' },                 // ⛅
    3:  { label: 'Overcast',             icon: '\u2601\uFE0F' },           // ☁️
    45: { label: 'Fog',                  icon: '\uD83C\uDF2B\uFE0F' },     // 🌫
    48: { label: 'Rime fog',             icon: '\uD83C\uDF2B\uFE0F' },
    51: { label: 'Light drizzle',        icon: '\uD83C\uDF26\uFE0F' },     // 🌦
    53: { label: 'Drizzle',              icon: '\uD83C\uDF26\uFE0F' },
    55: { label: 'Heavy drizzle',        icon: '\uD83C\uDF27\uFE0F' },     // 🌧
    56: { label: 'Freezing drizzle',     icon: '\uD83C\uDF28\uFE0F' },     // 🌨
    57: { label: 'Freezing drizzle',     icon: '\uD83C\uDF28\uFE0F' },
    61: { label: 'Light rain',           icon: '\uD83C\uDF26\uFE0F' },
    63: { label: 'Rain',                 icon: '\uD83C\uDF27\uFE0F' },
    65: { label: 'Heavy rain',           icon: '\uD83C\uDF27\uFE0F' },
    66: { label: 'Freezing rain',        icon: '\uD83C\uDF28\uFE0F' },
    67: { label: 'Freezing rain',        icon: '\uD83C\uDF28\uFE0F' },
    71: { label: 'Light snow',           icon: '\uD83C\uDF28\uFE0F' },
    73: { label: 'Snow',                 icon: '\uD83C\uDF28\uFE0F' },
    75: { label: 'Heavy snow',           icon: '\u2744\uFE0F' },           // ❄️
    77: { label: 'Snow grains',          icon: '\u2744\uFE0F' },
    80: { label: 'Rain showers',         icon: '\uD83C\uDF26\uFE0F' },
    81: { label: 'Rain showers',         icon: '\uD83C\uDF27\uFE0F' },
    82: { label: 'Heavy showers',        icon: '\uD83C\uDF27\uFE0F' },
    85: { label: 'Snow showers',         icon: '\uD83C\uDF28\uFE0F' },
    86: { label: 'Heavy snow showers',   icon: '\u2744\uFE0F' },
    95: { label: 'Thunderstorm',         icon: '\u26C8\uFE0F' },           // ⛈
    96: { label: 'Thunderstorm + hail',  icon: '\u26C8\uFE0F' },
    99: { label: 'Severe thunderstorm',  icon: '\u26C8\uFE0F' },
  };

  function wmo(code) {
    return WMO[code] || { label: 'Unknown', icon: '\u2753' };
  }

  // ==================== STATE ====================
  var state = {
    currentScreen: 'home',
    screenHistory: [],
    isLoading: false,
    error: null,
    data: {
      selectedCityId: 'nyc',
    },
    selectedDayIdx: 0,  // 0 = today (live current_weather), 1..4 = forecast day
    cache: {}, // { [cityId]: { data, timestamp } }
    inflight: {}, // { [cityId]: Promise } — dedupes concurrent fetches for one city
  };

  var screens = {};

  function collectScreens() {
    document.querySelectorAll('.screen').forEach(function (s) {
      if (s.id) screens[s.id] = s;
    });
  }

  // ==================== NAVIGATION ====================
  function navigateTo(screenId, options) {
    options = options || {};
    var addToHistory = options.addToHistory !== false;
    if (addToHistory && state.currentScreen && state.currentScreen !== screenId) {
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

  // 2D spatial D-pad navigation: for each arrow, pick the closest focusable
  // in the requested direction using geometric centers. Falls back to wrap-around
  // (the farthest element on the opposite side) when nothing lies in-direction.
  function moveFocus(direction) {
    var container = screens[state.currentScreen];
    if (!container) return;
    var focusables = Array.from(
      container.querySelectorAll('.focusable:not([disabled]):not(.hidden)')
    ).filter(function (el) {
      var r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    if (focusables.length === 0) return;

    var current = document.activeElement;
    if (!current || focusables.indexOf(current) === -1) {
      focusables[0].focus();
      focusables[0].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      return;
    }

    var cr = current.getBoundingClientRect();
    var cx = cr.left + cr.width / 2;
    var cy = cr.top + cr.height / 2;

    // Primary pass: nearest candidate in the requested direction.
    // Score = primary-axis distance + 2x perpendicular-axis distance,
    // so off-axis candidates are penalized.
    var best = null;
    var bestScore = Infinity;

    focusables.forEach(function (el) {
      if (el === current) return;
      var r = el.getBoundingClientRect();
      var dx = (r.left + r.width / 2) - cx;
      var dy = (r.top + r.height / 2) - cy;
      var primary, secondary;
      switch (direction) {
        case 'up':    if (dy >= -1) return; primary = -dy; secondary = Math.abs(dx); break;
        case 'down':  if (dy <= 1)  return; primary = dy;  secondary = Math.abs(dx); break;
        case 'left':  if (dx >= -1) return; primary = -dx; secondary = Math.abs(dy); break;
        case 'right': if (dx <= 1)  return; primary = dx;  secondary = Math.abs(dy); break;
        default: return;
      }
      var score = primary + secondary * 2;
      if (score < bestScore) { bestScore = score; best = el; }
    });

    // Wrap-around pass: if nothing was in-direction, jump to the
    // farthest element on the opposite side so the user isn't stuck.
    if (!best) {
      var wrapBest = null;
      var wrapBestScore = Infinity;
      focusables.forEach(function (el) {
        if (el === current) return;
        var r = el.getBoundingClientRect();
        var dx = (r.left + r.width / 2) - cx;
        var dy = (r.top + r.height / 2) - cy;
        var score;
        switch (direction) {
          case 'up':    if (dy <= 1)  return; score = Math.abs(dx) * 2 + dy;   break;
          case 'down':  if (dy >= -1) return; score = Math.abs(dx) * 2 - dy;   break;
          case 'left':  if (dx <= 1)  return; score = Math.abs(dy) * 2 + dx;   break;
          case 'right': if (dx >= -1) return; score = Math.abs(dy) * 2 - dx;   break;
          default: return;
        }
        if (score < wrapBestScore) { wrapBestScore = score; wrapBest = el; }
      });
      best = wrapBest;
    }

    if (best) {
      best.focus();
      best.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  // ==================== API ====================
  function fetchWeather(city, opts) {
    opts = opts || {};
    var cacheKey = city.id;

    if (!opts.noCache && state.cache[cacheKey]) {
      var cached = state.cache[cacheKey];
      if (Date.now() - cached.timestamp < CONFIG.api.cacheDuration) {
        return Promise.resolve(cached.data);
      }
    }
    if (state.inflight[cacheKey]) return state.inflight[cacheKey];

    var url = CONFIG.api.baseUrl
      + '?latitude=' + city.lat
      + '&longitude=' + city.lon
      + '&current_weather=true'
      + '&daily=temperature_2m_max,temperature_2m_min,weathercode'
      + '&timezone=' + encodeURIComponent(city.tz)
      + '&forecast_days=5';

    setLoading(true);
    clearError();

    var p = fetch(url, opts.signal ? { signal: opts.signal } : undefined)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        state.cache[cacheKey] = { data: data, timestamp: Date.now() };
        delete state.inflight[cacheKey];
        setLoading(false);
        return data;
      })
      .catch(function (err) {
        delete state.inflight[cacheKey];
        setLoading(false);
        setError(err.message || 'Network error');
        throw err;
      });
    state.inflight[cacheKey] = p;
    return p;
  }

  // ==================== UI HELPERS ====================
  function setLoading(isLoading) {
    state.isLoading = isLoading;
    var spinner = document.getElementById('loading');
    if (spinner) spinner.classList.toggle('hidden', !isLoading);
    var indicator = document.getElementById('status-indicator');
    if (indicator && isLoading) indicator.textContent = 'Loading\u2026';
  }

  function setError(message) {
    state.error = message;
    var errorEl = document.getElementById('error');
    if (errorEl) {
      errorEl.classList.remove('hidden');
      var msgEl = errorEl.querySelector('.error-message');
      if (msgEl) msgEl.textContent = 'Could not load weather: ' + message;
    }
    // hide the main block so the error takes focus visually
    var block = document.getElementById('current-block');
    if (block) block.classList.add('hidden');
  }

  function clearError() {
    state.error = null;
    var errorEl = document.getElementById('error');
    if (errorEl) errorEl.classList.add('hidden');
    var block = document.getElementById('current-block');
    if (block) block.classList.remove('hidden');
  }

  function formatTimestamp(d) {
    var h = d.getHours();
    var m = d.getMinutes();
    var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
    return 'Updated ' + pad(h) + ':' + pad(m);
  }

  function windDirection(deg) {
    if (deg == null) return '';
    var dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    var idx = Math.round(deg / 45) % 8;
    return dirs[idx];
  }

  function dayLabel(iso, tz) {
    // iso e.g. "2025-04-17"; render as weekday short name
    try {
      var d = new Date(iso + 'T12:00:00');
      return d.toLocaleDateString(undefined, { weekday: 'short', timeZone: tz });
    } catch (e) {
      return iso.slice(5); // fallback MM-DD
    }
  }

  // ==================== RENDERING ====================
  function renderCurrent(city, data) {
    var idx = state.selectedDayIdx || 0;
    var daily = data.daily || {};
    var label = (idx === 0) ? 'Today'
      : (daily.time && daily.time[idx] ? dayLabel(daily.time[idx], city.tz) : 'Day ' + idx);

    document.getElementById('current-city').textContent = city.name + ', ' + city.country + ' \u00B7 ' + label;

    if (idx === 0) {
      // Live current-weather payload for today
      var cw = data.current_weather || {};
      var info = wmo(cw.weathercode);
      document.getElementById('current-icon').textContent = info.icon;
      document.getElementById('current-temp').textContent = Math.round(cw.temperature) + '\u00B0';
      document.getElementById('current-condition').textContent = info.label;
      var windTxt = (cw.windspeed != null)
        ? 'Wind ' + Math.round(cw.windspeed) + ' km/h'
        : 'Wind --';
      document.getElementById('current-wind').textContent = windTxt;
      document.getElementById('current-winddir').textContent = windDirection(cw.winddirection);
    } else {
      // Forecast day: show daily high/low + condition
      var info2 = wmo(daily.weathercode ? daily.weathercode[idx] : null);
      var hi = daily.temperature_2m_max ? Math.round(daily.temperature_2m_max[idx]) : null;
      var lo = daily.temperature_2m_min ? Math.round(daily.temperature_2m_min[idx]) : null;
      document.getElementById('current-icon').textContent = info2.icon;
      document.getElementById('current-temp').textContent = (hi != null ? hi : '--') + '\u00B0';
      document.getElementById('current-condition').textContent = info2.label;
      document.getElementById('current-wind').textContent = 'High ' + (hi != null ? hi : '--') + '\u00B0';
      document.getElementById('current-winddir').textContent = 'Low ' + (lo != null ? lo : '--') + '\u00B0';
    }
  }

  function renderForecast(city, data) {
    var row = document.getElementById('forecast-row');
    row.innerHTML = '';
    var daily = data.daily;
    if (!daily || !daily.time) return;

    var selected = state.selectedDayIdx || 0;

    for (var i = 0; i < daily.time.length && i < 5; i++) {
      var info = wmo(daily.weathercode[i]);
      var hi = Math.round(daily.temperature_2m_max[i]);
      var lo = Math.round(daily.temperature_2m_min[i]);
      var label = (i === 0) ? 'Today' : dayLabel(daily.time[i], city.tz);

      // Card is a focusable D-pad target; Enter = select that day for the main panel
      var card = document.createElement('div');
      card.className = 'forecast-card focusable' + (i === selected ? ' selected' : '');
      card.setAttribute('tabindex', '0');
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', label + ' forecast, high ' + hi + ', low ' + lo);
      card.dataset.action = 'select-day';
      card.dataset.dayIdx = String(i);
      card.innerHTML =
        '<div class="forecast-day">' + label + '</div>' +
        '<div class="forecast-icon">' + info.icon + '</div>' +
        '<div class="forecast-high">' + hi + '\u00B0</div>' +
        '<div class="forecast-low">' + lo + '\u00B0</div>';
      row.appendChild(card);
    }
  }

  function renderCityList() {
    var list = document.getElementById('city-list');
    list.innerHTML = '';

    CITIES.forEach(function (city) {
      var btn = document.createElement('button');
      btn.className = 'list-item focusable';
      btn.dataset.action = 'select-city';
      btn.dataset.cityId = city.id;

      var isSelected = city.id === state.data.selectedCityId;
      btn.innerHTML =
        '<div class="list-item-icon">\uD83C\uDF10</div>' +   // 🌐
        '<div class="list-item-content">' +
          '<div class="list-item-title">' + city.name + '</div>' +
          '<div class="list-item-meta">' + city.country + '</div>' +
        '</div>' +
        (isSelected ? '<div class="list-item-check">\u2713</div>' : '');
      list.appendChild(btn);
    });
  }

  function selectedCity() {
    return CITIES.find(function (c) { return c.id === state.data.selectedCityId; }) || CITIES[0];
  }

  // Returns the fetch promise (resolves with the data, rejects on network
  // error) so the voice path can await it. `opts.signal` is forwarded to fetch.
  function loadAndRenderWeather(opts) {
    var city = selectedCity();

    return fetchWeather(city, opts)
      .then(function (data) {
        renderCurrent(city, data);
        renderForecast(city, data);
        var indicator = document.getElementById('status-indicator');
        if (indicator) indicator.textContent = formatTimestamp(new Date());

        // If focus hasn't moved into a meaningful element yet (still on body, or
        // stuck on a nav button because the forecast row hadn't rendered at
        // navigateTo time), park focus on the selected forecast day so the D-pad
        // is immediately useful.
        if (state.currentScreen === 'home') {
          var active = document.activeElement;
          var isBody = !active || active === document.body;
          var isNavItem = active && active.classList && active.classList.contains('nav-item');
          if (isBody || isNavItem) {
            var row = document.getElementById('forecast-row');
            var target = row && row.children[state.selectedDayIdx || 0];
            if (target) {
              target.focus();
              target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
          }
        }
        return data;
      })
      .catch(function (err) {
        var indicator = document.getElementById('status-indicator');
        if (indicator) indicator.textContent = 'Offline';
        throw err;
      });
  }

  // Bust the cache for the current city and reload (the Refresh button).
  function refreshWeather(opts) {
    delete state.cache[state.data.selectedCityId];
    state.selectedDayIdx = 0;
    clearError();
    return loadAndRenderWeather(opts);
  }

  // ==================== ACTIONS ====================
  function handleAction(action, element) {
    switch (action) {
      case 'back':
        navigateBack();
        break;
      case 'refresh':
        refreshWeather().catch(function () { /* indicator already shows Offline */ });
        break;
      case 'open-cities':
        navigateTo('cities');
        break;
      case 'select-city':
        var id = element && element.dataset && element.dataset.cityId;
        if (id) {
          state.data.selectedCityId = id;
          state.selectedDayIdx = 0;
          saveData();
          navigateBack();
          // loadAndRenderWeather is triggered by onScreenEnter('home')
        }
        break;
      case 'select-day':
        var dayIdx = element && element.dataset && element.dataset.dayIdx;
        if (dayIdx != null) {
          state.selectedDayIdx = parseInt(dayIdx, 10) || 0;
          // Re-render from cache without a network hit
          var city = CITIES.find(function (c) { return c.id === state.data.selectedCityId; }) || CITIES[0];
          var cached = state.cache[city.id];
          if (cached && cached.data) {
            renderCurrent(city, cached.data);
            // Update the .selected marker on the forecast row without rebuilding
            var row = document.getElementById('forecast-row');
            if (row) {
              Array.from(row.children).forEach(function (el, i) {
                el.classList.toggle('selected', i === state.selectedDayIdx);
              });
            }
          }
        }
        break;
      default:
        // no-op
        break;
    }
  }

  function onScreenEnter(screenId) {
    if (screenId === 'home') {
      loadAndRenderWeather().catch(function () { /* indicator already shows Offline */ });
    } else if (screenId === 'cities') {
      renderCityList();
    }
  }

  // ==================== PERSISTENCE ====================
  function loadData() {
    try {
      var saved = localStorage.getItem(CONFIG.storageKey);
      if (saved) {
        var data = JSON.parse(saved);
        Object.assign(state.data, data);
      }
    } catch (e) {
      // ignore corrupt storage
    }
  }

  function saveData() {
    try {
      localStorage.setItem(CONFIG.storageKey, JSON.stringify(state.data));
    } catch (e) {
      // ignore quota / serialization errors
    }
  }

  // ==================== EVENTS ====================
  function setupEvents() {
    document.addEventListener('click', function (e) {
      var actionEl = e.target.closest('[data-action]');
      if (actionEl) handleAction(actionEl.dataset.action, actionEl);
    });

    document.addEventListener('keydown', function (e) {
      switch (e.key) {
        case 'ArrowUp':    moveFocus('up');    e.preventDefault(); break;
        case 'ArrowDown':  moveFocus('down');  e.preventDefault(); break;
        case 'ArrowLeft':  moveFocus('left');  e.preventDefault(); break;
        case 'ArrowRight': moveFocus('right'); e.preventDefault(); break;
        case 'Enter':
          if (document.activeElement &&
              document.activeElement.classList.contains('focusable')) {
            document.activeElement.click();
          }
          e.preventDefault();
          break;
        case 'Escape':
          navigateBack();
          e.preventDefault();
          break;
      }
    });
  }

  // ==================== WebMCP (Meta AI voice control) ====================
  // Additive: the app works identically when document.modelContext is absent.
  // Utterances: "what's the weather like?" / "switch to Tokyo" / "show me
  // London" / "refresh the forecast" / "which cities can I pick?"
  function cityNames() {
    return CITIES.map(function (c) { return c.name; }).join(', ');
  }

  function weatherSnapshot(next) {
    var city = selectedCity();
    var cached = state.cache[city.id];
    var out = {
      city: city.name + ', ' + city.country,
      cities: cityNames(),
      units: 'Celsius, km/h',
      loading: state.isLoading,
      next_action: next,
    };
    if (state.error) {
      out.error = true;
      out.message = 'Could not load weather: ' + state.error;
      return out;
    }
    if (!cached || !cached.data) {
      out.error = true;
      out.message = 'No weather data loaded yet.';
      return out;
    }
    var data = cached.data;
    var cw = data.current_weather || {};
    var info = wmo(cw.weathercode);
    out.now = {
      temperature: Math.round(cw.temperature),
      condition: info.label,
      wind_kmh: cw.windspeed != null ? Math.round(cw.windspeed) : null,
      wind_direction: windDirection(cw.winddirection),
    };
    var daily = data.daily || {};
    var days = [];
    for (var i = 0; daily.time && i < daily.time.length && i < 5; i++) {
      days.push({
        day: i === 0 ? 'Today' : dayLabel(daily.time[i], city.tz),
        condition: wmo(daily.weathercode[i]).label,
        high: Math.round(daily.temperature_2m_max[i]),
        low: Math.round(daily.temperature_2m_min[i]),
      });
    }
    out.forecast = days;
    out.selected_day = days[state.selectedDayIdx] ? days[state.selectedDayIdx].day : 'Today';
    out.updated = Math.round((Date.now() - cached.timestamp) / 60000) + ' min ago';
    return out;
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

    var SUMMARIZE = 'Summarize the current conditions for the city in one short sentence (temperature is Celsius), then stop.';
    var OFFLINE = 'Tell the wearer the weather could not be loaded, then stop.';

    safeRegister({
      name: 'weather_get_state',
      description: 'Report the selected city, current temperature (Celsius), condition, wind, the 5-day forecast, and the list of preset cities.',
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true },
      execute: function () {
        return weatherSnapshot(SUMMARIZE);
      },
    });

    safeRegister({
      name: 'weather_set_city',
      description: 'Switch the dashboard to one of the preset cities (New York, London, Tokyo, Sydney, Paris) and load its weather. Returns the new conditions, or the preset list if the name is unknown.',
      inputSchema: {
        type: 'object',
        properties: { name: { type: 'string', description: 'City name, e.g. "Tokyo". Must be one of the presets.' } },
        required: ['name'],
      },
      execute: function (args, opts) {
        var want = String(args && args.name != null ? args.name : '').trim().toLowerCase();
        var city = CITIES.find(function (c) { return c.id === want || c.name.toLowerCase() === want; })
          || CITIES.find(function (c) { return want && c.name.toLowerCase().indexOf(want) !== -1; });
        if (!city) {
          return { error: true, message: 'Unknown city "' + want + '".', cities: cityNames(), next_action: 'Offer the preset cities and call again.' };
        }
        state.data.selectedCityId = city.id;
        state.selectedDayIdx = 0;
        saveData();
        // Same path as picking the city in the list: return home (which loads it).
        if (state.currentScreen !== 'home') navigateBack();
        return loadAndRenderWeather({ signal: opts && opts.signal })
          .then(function () { return weatherSnapshot(SUMMARIZE); })
          .catch(function () { return weatherSnapshot(OFFLINE); });
      },
    });

    safeRegister({
      name: 'weather_refresh',
      description: 'Re-fetch the weather for the selected city, bypassing the 10-minute cache (same as the Refresh button). Returns the fresh conditions.',
      inputSchema: { type: 'object', properties: {} },
      execute: function (args, opts) {
        return refreshWeather({ signal: opts && opts.signal })
          .then(function () { return weatherSnapshot(SUMMARIZE); })
          .catch(function () { return weatherSnapshot(OFFLINE); });
      },
    });
  }

  // ==================== INIT ====================
  function init() {
    collectScreens();
    setupEvents();
    loadData();
    setTimeout(function () {
      navigateTo('home', { addToHistory: false });
    }, 50);
    registerWebMcp();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
