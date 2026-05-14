// IP Info — Meta Display Glasses webapp
// Data: ipapi.co/json/ (no API key)

(function () {
  'use strict';

  var CONFIG = {
    appName: 'IP Info',
    storageKey: 'mdg_ip_info',
    api: {
      url: 'https://ipapi.co/json/',
      cacheDuration: 30 * 60 * 1000, // 30 minutes
    },
  };

  var state = {
    currentScreen: 'home',
    isLoading: false,
    error: null,
    data: null,
    fetchedAt: 0,
  };

  var screens = {};
  var tickerId = null;

  // ==================== SCREEN SETUP ====================
  function collectScreens() {
    document.querySelectorAll('.screen').forEach(function (s) {
      if (s.id) screens[s.id] = s;
    });
  }

  // ==================== FOCUS ====================
  function focusFirst(container) {
    var el = container.querySelector('.focusable:not([disabled]):not(.hidden)');
    if (el) el.focus();
  }

  function getFocusables() {
    var container = screens[state.currentScreen];
    if (!container) return [];
    // exclude hidden ancestors: the loading and error containers hide their children
    return Array.from(container.querySelectorAll('.focusable:not([disabled])'))
      .filter(function (el) {
        // skip elements inside hidden containers
        var parent = el.parentElement;
        while (parent && parent !== container) {
          if (parent.classList && parent.classList.contains('hidden')) return false;
          parent = parent.parentElement;
        }
        return true;
      });
  }

  function moveFocus(direction) {
    var focusables = getFocusables();
    if (focusables.length === 0) return;

    var current = document.activeElement;
    var idx = focusables.indexOf(current);
    if (idx === -1) { focusables[0].focus(); return; }

    // 2-column grid nav: up/down moves by 2, left/right by 1
    var nextIdx = idx;
    if (direction === 'left') {
      nextIdx = idx > 0 ? idx - 1 : focusables.length - 1;
    } else if (direction === 'right') {
      nextIdx = idx < focusables.length - 1 ? idx + 1 : 0;
    } else if (direction === 'up') {
      nextIdx = idx - 2;
      if (nextIdx < 0) nextIdx = Math.max(0, focusables.length + nextIdx);
    } else if (direction === 'down') {
      nextIdx = idx + 2;
      if (nextIdx >= focusables.length) nextIdx = nextIdx % focusables.length;
    }

    if (focusables[nextIdx]) {
      focusables[nextIdx].focus();
      focusables[nextIdx].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  // ==================== CACHE ====================
  function loadCache() {
    try {
      var saved = localStorage.getItem(CONFIG.storageKey);
      if (saved) {
        var parsed = JSON.parse(saved);
        if (parsed && parsed.data && parsed.fetchedAt) {
          state.data = parsed.data;
          state.fetchedAt = parsed.fetchedAt;
          return true;
        }
      }
    } catch (e) { /* ignore */ }
    return false;
  }

  function saveCache() {
    try {
      localStorage.setItem(CONFIG.storageKey, JSON.stringify({
        data: state.data,
        fetchedAt: state.fetchedAt,
      }));
    } catch (e) { /* ignore */ }
  }

  function cacheIsFresh() {
    return state.data && state.fetchedAt &&
      (Date.now() - state.fetchedAt < CONFIG.api.cacheDuration);
  }

  // ==================== API ====================
  function fetchIpInfo() {
    setLoading(true);
    clearError();

    return fetch(CONFIG.api.url)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        if (data && data.error) {
          throw new Error(data.reason || 'API error');
        }
        state.data = data;
        state.fetchedAt = Date.now();
        saveCache();
        setLoading(false);
        return data;
      })
      .catch(function (err) {
        setLoading(false);
        setError(err.message || 'Network error');
        throw err;
      });
  }

  // ==================== UI STATE ====================
  function setLoading(isLoading) {
    state.isLoading = isLoading;
    var spinner = document.getElementById('loading');
    var grid = document.getElementById('card-grid');
    if (spinner) spinner.classList.toggle('hidden', !isLoading);
    if (grid && isLoading && !state.data) grid.classList.add('hidden');
    else if (grid) grid.classList.remove('hidden');
  }

  function setError(message) {
    state.error = message;
    var errorEl = document.getElementById('error');
    var grid = document.getElementById('card-grid');
    if (errorEl) {
      errorEl.classList.remove('hidden');
      var msgEl = document.getElementById('error-message');
      if (msgEl) msgEl.textContent = 'Could not load IP info: ' + message;
    }
    if (grid && !state.data) grid.classList.add('hidden');
  }

  function clearError() {
    state.error = null;
    var errorEl = document.getElementById('error');
    if (errorEl) errorEl.classList.add('hidden');
    var grid = document.getElementById('card-grid');
    if (grid) grid.classList.remove('hidden');
  }

  // ==================== HELPERS ====================
  function flagEmoji(code) {
    if (!code || code.length !== 2) return '';
    try {
      var cc = code.toUpperCase();
      return String.fromCodePoint.apply(String, [].map.call(cc, function (c) {
        return 0x1F1E6 + c.charCodeAt(0) - 65;
      }));
    } catch (e) {
      return '';
    }
  }

  function formatCoords(lat, lon) {
    if (lat == null || lon == null) return '—';
    var fmt = function (n) {
      if (typeof n !== 'number') n = parseFloat(n);
      return isNaN(n) ? '—' : n.toFixed(3);
    };
    return fmt(lat) + ', ' + fmt(lon);
  }

  function relativeTime(ms) {
    if (!ms) return '—';
    var diff = Math.floor((Date.now() - ms) / 1000);
    if (diff < 5) return 'Updated just now';
    if (diff < 60) return 'Updated ' + diff + 's ago';
    var mins = Math.floor(diff / 60);
    if (mins < 60) return 'Updated ' + mins + 'm ago';
    var hrs = Math.floor(mins / 60);
    return 'Updated ' + hrs + 'h ago';
  }

  function updateRelativeLabel() {
    var label = document.getElementById('updated-label');
    if (!label) return;
    if (!state.fetchedAt) {
      label.textContent = '';
    } else {
      label.textContent = relativeTime(state.fetchedAt);
    }
  }

  // ==================== RENDER ====================
  function render() {
    if (!state.data) return;
    var d = state.data;

    document.getElementById('val-ip').textContent = d.ip || '—';
    document.getElementById('val-city').textContent = d.city || '—';
    document.getElementById('val-region').textContent = d.region || '—';

    var flag = flagEmoji(d.country_code || d.country);
    var country = d.country_name || d.country || '—';
    document.getElementById('val-country').textContent =
      (flag ? flag + ' ' : '') + country;

    document.getElementById('val-timezone').textContent = d.timezone || '—';
    document.getElementById('val-org').textContent = d.org || d.asn || '—';
    document.getElementById('val-coords').textContent =
      formatCoords(d.latitude, d.longitude);

    updateRelativeLabel();
  }

  // ==================== ACTIONS ====================
  function showToast(text) {
    var toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = text;
    toast.classList.remove('hidden');
    setTimeout(function () {
      toast.classList.add('hidden');
    }, 1500);
  }

  function copyIp() {
    if (!state.data || !state.data.ip) return;
    var ip = state.data.ip;

    var fallback = function () {
      try {
        var ta = document.createElement('textarea');
        ta.value = ip;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast('Copied');
      } catch (e) {
        showToast('Copy failed');
      }
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(ip).then(function () {
        showToast('Copied');
      }).catch(fallback);
    } else {
      fallback();
    }
  }

  function refresh() {
    clearError();
    fetchIpInfo().then(render).catch(function () {
      updateRelativeLabel();
    });
  }

  function loadInitial() {
    if (loadCache() && cacheIsFresh()) {
      render();
    } else {
      refresh();
    }
  }

  function handleAction(action, element) {
    switch (action) {
      case 'refresh':
        refresh();
        break;
      case 'copy-ip':
        copyIp();
        break;
      default:
        break;
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
      }
    });
  }

  // ==================== INIT ====================
  function init() {
    collectScreens();
    setupEvents();
    loadInitial();

    // Auto-update relative timestamp every 10s
    tickerId = setInterval(updateRelativeLabel, 10000);

    setTimeout(function () {
      focusFirst(screens.home);
    }, 50);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
