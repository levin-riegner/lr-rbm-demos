// Crypto Tracker - Meta Display Glasses webapp
// Data: CoinGecko /simple/price (no API key). D-pad + Enter navigation.

(function () {
  'use strict';

  // ==================== CONFIG ====================
  var CONFIG = {
    appName: 'Crypto Tracker',
    storageKey: 'mdg_crypto_tracker',
    favsKey: 'mdg_crypto_tracker_favs',
    api: {
      url: 'https://api.coingecko.com/api/v3/simple/price'
        + '?ids=bitcoin,ethereum,solana,cardano,polkadot,chainlink,avalanche-2,matic-network'
        + '&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true',
      cacheDuration: 30 * 1000, // 30s
      refreshInterval: 30 * 1000,
    },
  };

  var COINS = [
    { id: 'bitcoin',       symbol: 'BTC',   name: 'Bitcoin'   },
    { id: 'ethereum',      symbol: 'ETH',   name: 'Ethereum'  },
    { id: 'solana',        symbol: 'SOL',   name: 'Solana'    },
    { id: 'cardano',       symbol: 'ADA',   name: 'Cardano'   },
    { id: 'polkadot',      symbol: 'DOT',   name: 'Polkadot'  },
    { id: 'chainlink',     symbol: 'LINK',  name: 'Chainlink' },
    { id: 'avalanche-2',   symbol: 'AVAX',  name: 'Avalanche' },
    { id: 'matic-network', symbol: 'MATIC', name: 'Polygon'   },
  ];

  // ==================== STATE ====================
  var state = {
    currentScreen: 'home',
    screenHistory: [],
    activeTab: 'all', // 'all' | 'favs'
    selectedCoinId: null,
    prices: null,        // { [id]: { usd, usd_24h_change, last_updated_at } }
    lastFetched: 0,
    favorites: [],
    error: null,
  };

  var screens = {};
  var refreshTimer = null;

  function collectScreens() {
    document.querySelectorAll('.screen').forEach(function (s) {
      if (s.id) screens[s.id] = s;
    });
  }

  // ==================== PERSISTENCE ====================
  function loadCache() {
    try {
      var raw = localStorage.getItem(CONFIG.storageKey);
      if (!raw) return;
      var obj = JSON.parse(raw);
      if (obj && obj.prices) {
        state.prices = obj.prices;
        state.lastFetched = obj.timestamp || 0;
      }
    } catch (e) { /* ignore */ }
  }

  function saveCache() {
    try {
      localStorage.setItem(CONFIG.storageKey, JSON.stringify({
        prices: state.prices,
        timestamp: state.lastFetched,
      }));
    } catch (e) { /* ignore */ }
  }

  function loadFavs() {
    try {
      var raw = localStorage.getItem(CONFIG.favsKey);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) state.favorites = parsed;
      }
    } catch (e) { /* ignore */ }
  }

  function saveFavs() {
    try {
      localStorage.setItem(CONFIG.favsKey, JSON.stringify(state.favorites));
    } catch (e) { /* ignore */ }
  }

  function isFav(id) { return state.favorites.indexOf(id) !== -1; }

  function toggleFav(id) {
    var idx = state.favorites.indexOf(id);
    if (idx === -1) state.favorites.push(id);
    else state.favorites.splice(idx, 1);
    saveFavs();
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

  function moveFocus(direction) {
    var container = screens[state.currentScreen];
    if (!container) return;
    var focusables = Array.from(
      container.querySelectorAll('.focusable:not([disabled])')
    ).filter(function (el) {
      // skip elements inside hidden ancestors
      var n = el;
      while (n && n !== container) {
        if (n.classList && n.classList.contains('hidden')) return false;
        n = n.parentElement;
      }
      return true;
    });
    if (focusables.length === 0) return;

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
    focusables[nextIdx].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  // ==================== API ====================
  function fetchPrices(opts) {
    opts = opts || {};
    var fresh = (Date.now() - state.lastFetched) < CONFIG.api.cacheDuration;
    if (!opts.force && fresh && state.prices) {
      return Promise.resolve(state.prices);
    }

    setStatus('Loading...');
    showLoading(state.prices == null);
    clearError();

    return fetch(CONFIG.api.url)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        state.prices = data;
        state.lastFetched = Date.now();
        saveCache();
        showLoading(false);
        setStatus(formatTimestamp(new Date(state.lastFetched)));
        return data;
      })
      .catch(function (err) {
        showLoading(false);
        setError(err.message || 'Network error');
        setStatus('Offline');
        throw err;
      });
  }

  // ==================== UI HELPERS ====================
  function setStatus(text) {
    var el = document.getElementById('status-indicator');
    if (el) el.textContent = text;
  }

  function showLoading(show) {
    var el = document.getElementById('loading');
    var list = document.getElementById('coin-list');
    if (el) el.classList.toggle('hidden', !show);
    if (list) list.classList.toggle('hidden', show);
  }

  function setError(message) {
    state.error = message;
    var errEl = document.getElementById('error');
    var msg = document.getElementById('error-message');
    if (msg) msg.textContent = 'Could not load prices: ' + message;
    if (errEl) errEl.classList.remove('hidden');
    var list = document.getElementById('coin-list');
    if (list) list.classList.add('hidden');
  }

  function clearError() {
    state.error = null;
    var errEl = document.getElementById('error');
    if (errEl) errEl.classList.add('hidden');
  }

  function formatTimestamp(d) {
    var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
    return 'Updated ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }

  function formatPrice(n) {
    if (n == null || isNaN(n)) return '$--';
    if (n >= 1000) {
      return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
    }
    if (n >= 1) {
      return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
    }
    return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 4, minimumFractionDigits: 4 });
  }

  function formatChange(pct) {
    if (pct == null || isNaN(pct)) return '--%';
    var sign = pct > 0 ? '+' : '';
    return sign + pct.toFixed(2) + '%';
  }

  function changeClass(pct) {
    if (pct == null || isNaN(pct)) return 'neutral';
    if (pct > 0.001) return 'up';
    if (pct < -0.001) return 'down';
    return 'neutral';
  }

  function formatUpdated(unix) {
    if (!unix) return '--';
    var d = new Date(unix * 1000);
    var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
    return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }

  // ==================== RENDERING ====================
  function visibleCoins() {
    if (state.activeTab === 'favs') {
      return COINS.filter(function (c) { return isFav(c.id); });
    }
    return COINS.slice();
  }

  function renderCoinList() {
    var list = document.getElementById('coin-list');
    var empty = document.getElementById('empty-favs');
    if (!list) return;

    var coins = visibleCoins();

    if (state.activeTab === 'favs' && coins.length === 0) {
      list.innerHTML = '';
      list.classList.add('hidden');
      if (empty) empty.classList.remove('hidden');
      return;
    }
    if (empty) empty.classList.add('hidden');
    list.classList.remove('hidden');

    var prices = state.prices || {};
    list.innerHTML = '';

    coins.forEach(function (coin) {
      var p = prices[coin.id] || {};
      var pct = p.usd_24h_change;
      var cls = changeClass(pct);

      var btn = document.createElement('button');
      btn.className = 'coin-card focusable';
      btn.dataset.action = 'open-detail';
      btn.dataset.coinId = coin.id;

      var star = isFav(coin.id) ? '\u2605' : '\u2606';
      var starClass = isFav(coin.id) ? 'coin-star filled' : 'coin-star';

      btn.innerHTML =
        '<div class="coin-symbol">' + coin.symbol + '</div>' +
        '<div class="coin-main">' +
          '<div class="coin-name">' + coin.name + '</div>' +
          '<div class="coin-price">' + formatPrice(p.usd) + '</div>' +
        '</div>' +
        '<div class="change-badge ' + cls + '">' + formatChange(pct) + '</div>' +
        '<div class="' + starClass + '">' + star + '</div>';

      list.appendChild(btn);
    });
  }

  function renderDetail() {
    var id = state.selectedCoinId;
    var coin = COINS.find(function (c) { return c.id === id; });
    if (!coin) return;
    var p = (state.prices && state.prices[id]) || {};

    document.getElementById('detail-title').textContent = coin.name;
    document.getElementById('detail-symbol').textContent = coin.symbol;
    document.getElementById('detail-name').textContent = coin.name;
    document.getElementById('detail-price').textContent = formatPrice(p.usd);

    var badge = document.getElementById('detail-change');
    badge.textContent = formatChange(p.usd_24h_change);
    badge.className = 'change-badge ' + changeClass(p.usd_24h_change);

    document.getElementById('stat-price').textContent = formatPrice(p.usd);
    var sc = document.getElementById('stat-change');
    sc.textContent = formatChange(p.usd_24h_change);
    sc.className = 'stat-value ' + changeClass(p.usd_24h_change);
    document.getElementById('stat-updated').textContent = formatUpdated(p.last_updated_at);

    var favIcon = document.getElementById('detail-fav-icon');
    var favLabel = document.getElementById('detail-fav-label');
    if (isFav(id)) {
      favIcon.innerHTML = '\u2605';
      favLabel.textContent = 'Remove Favorite';
    } else {
      favIcon.innerHTML = '\u2606';
      favLabel.textContent = 'Add Favorite';
    }
  }

  function setActiveTab(tab) {
    state.activeTab = tab;
    var all = document.getElementById('tab-all');
    var favs = document.getElementById('tab-favs');
    if (all && favs) {
      all.classList.toggle('active', tab === 'all');
      favs.classList.toggle('active', tab === 'favs');
    }
    renderCoinList();
  }

  // ==================== AUTO REFRESH ====================
  function startAutoRefresh() {
    stopAutoRefresh();
    refreshTimer = setInterval(function () {
      fetchPrices({ force: true })
        .then(function () { renderCoinList(); })
        .catch(function () { /* error already shown */ });
    }, CONFIG.api.refreshInterval);
  }

  function stopAutoRefresh() {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  }

  // ==================== ACTIONS ====================
  function handleAction(action, element) {
    switch (action) {
      case 'back':
        navigateBack();
        break;
      case 'refresh':
        fetchPrices({ force: true })
          .then(function () { renderCoinList(); })
          .catch(function () { /* error shown */ });
        break;
      case 'tab-all':
        setActiveTab('all');
        break;
      case 'tab-favs':
        setActiveTab('favs');
        break;
      case 'open-detail':
        var id = element && element.dataset && element.dataset.coinId;
        if (id) {
          state.selectedCoinId = id;
          navigateTo('detail');
        }
        break;
      case 'toggle-fav-detail':
        if (state.selectedCoinId) {
          toggleFav(state.selectedCoinId);
          renderDetail();
        }
        break;
      default:
        break;
    }
  }

  function onScreenEnter(screenId) {
    if (screenId === 'home') {
      renderCoinList();
      fetchPrices()
        .then(function () { renderCoinList(); })
        .catch(function () { /* error shown */ });
      startAutoRefresh();
    } else {
      stopAutoRefresh();
      if (screenId === 'detail') renderDetail();
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

    // Pause refresh when tab is hidden to save battery
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        stopAutoRefresh();
      } else if (state.currentScreen === 'home') {
        startAutoRefresh();
      }
    });
  }

  // ==================== INIT ====================
  function init() {
    collectScreens();
    setupEvents();
    loadFavs();
    loadCache();
    setTimeout(function () {
      navigateTo('home', { addToHistory: false });
    }, 50);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
