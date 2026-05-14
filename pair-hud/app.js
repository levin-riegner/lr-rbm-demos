// Copyright (c) Meta Platforms, Inc. and affiliates.
// All rights reserved.
//
// This source code is licensed under the license found in the
// LICENSE file in the root directory of this source tree.

/*
 * pair-hud — Glasses client.
 *
 * A single WebSocket drives a small state machine with 6 screens:
 *
 *   connecting  <-- initial, also after WS close while helper retries
 *   pairing     <-- after `registered`, shows the 4-digit PIN
 *   paired      <-- after `paired`, brief before `message`
 *   content     <-- after first `message`
 *   disconnected
 *   error
 *
 * D-pad (arrow keys + Enter) moves focus between `.focusable` elements
 * and activates the one with `data-action`.
 */

(function () {
  'use strict';

  // --------- WebSocket URL derivation ------------------------------------

  // Same-origin by default. Let ?ws=... override for split-host setups
  // (static files on Vercel, WS server elsewhere).
  function resolveWsUrl() {
    try {
      var qs = new URLSearchParams(location.search);
      var override = qs.get('ws');
      if (override) return override;
    } catch (e) {
      /* URLSearchParams unavailable — fall through */
    }
    var proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return proto + '//' + location.host + '/ws';
  }

  var WS_URL = resolveWsUrl();

  // --------- connectWebSocket helper (from toolkit template) -------------

  function connectWebSocket(url, handlers) {
    var ws = null;
    var reconnectTimer = null;
    var reconnectDelay = 1000;
    var manualClose = false;

    function connect() {
      ws = new WebSocket(url);
      ws.onopen = function () {
        reconnectDelay = 1000;
        if (handlers.onOpen) handlers.onOpen();
      };
      ws.onmessage = function (event) {
        try {
          var data = JSON.parse(event.data);
          if (handlers.onMessage) handlers.onMessage(data);
        } catch (e) {
          if (handlers.onMessage) handlers.onMessage(event.data);
        }
      };
      ws.onclose = function () {
        if (handlers.onClose) handlers.onClose();
        if (manualClose) return;
        reconnectTimer = setTimeout(function () {
          reconnectDelay = Math.min(reconnectDelay * 2, 30000);
          connect();
        }, reconnectDelay);
      };
      ws.onerror = function () {
        if (handlers.onError) handlers.onError();
      };
    }

    connect();

    return {
      send: function (data) {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(typeof data === 'string' ? data : JSON.stringify(data));
        }
      },
      close: function () {
        manualClose = true;
        clearTimeout(reconnectTimer);
        if (ws) ws.close();
      },
      retry: function () {
        clearTimeout(reconnectTimer);
        if (ws) {
          try {
            ws.close();
          } catch (e) {
            /* ignore */
          }
        }
        manualClose = false;
        reconnectDelay = 1000;
        connect();
      },
    };
  }

  // --------- DOM helpers -------------------------------------------------

  var SCREENS = [
    'connecting',
    'pairing',
    'paired',
    'content',
    'disconnected',
    'error',
  ];

  var screenEls = {};
  SCREENS.forEach(function (name) {
    screenEls[name] = document.getElementById('screen-' + name);
  });

  var currentScreen = 'connecting';

  function navigateTo(name) {
    if (!screenEls[name]) return;
    if (currentScreen === name) {
      // Still re-focus the default element — e.g. screen already showing.
      focusFirst(screenEls[name]);
      return;
    }
    SCREENS.forEach(function (k) {
      if (k === name) screenEls[k].classList.remove('hidden');
      else screenEls[k].classList.add('hidden');
    });
    currentScreen = name;
    // Defer focus to after the display flip.
    setTimeout(function () {
      focusFirst(screenEls[name]);
    }, 0);
  }

  function focusableIn(container) {
    return Array.prototype.slice.call(
      container.querySelectorAll('.focusable:not([disabled])')
    );
  }

  function focusFirst(container) {
    var list = focusableIn(container);
    if (list.length) list[0].focus();
  }

  // --------- Screen-specific renderers -----------------------------------

  var pinDisplayEl = document.getElementById('pin-display');
  var pinTtlEl = document.getElementById('pin-ttl');
  var pairUrlEl = document.getElementById('pair-url');
  var contentPayloadEl = document.getElementById('content-payload');
  var contentMetaEl = document.getElementById('content-meta');
  var disconnectedDetailEl = document.getElementById('disconnected-detail');
  var errorDetailEl = document.getElementById('error-detail');

  // Derive the /mobile.html URL from the current origin.
  (function setPairUrl() {
    var url = location.origin + '/mobile.html';
    // Show a user-readable form (drop protocol for width).
    pairUrlEl.textContent = url.replace(/^https?:\/\//, '');
  })();

  var pinTtlTimer = null;
  function startPinTtlCountdown(ttlMs) {
    stopPinTtlCountdown();
    var expiresAt = Date.now() + ttlMs;
    function tick() {
      var remainMs = Math.max(0, expiresAt - Date.now());
      var m = Math.floor(remainMs / 60000);
      var s = Math.floor((remainMs % 60000) / 1000);
      pinTtlEl.textContent =
        'Expires in ' +
        m +
        ':' +
        String(s).padStart(2, '0');
      if (remainMs <= 0) stopPinTtlCountdown();
    }
    tick();
    pinTtlTimer = setInterval(tick, 1000);
  }
  function stopPinTtlCountdown() {
    if (pinTtlTimer) clearInterval(pinTtlTimer);
    pinTtlTimer = null;
    pinTtlEl.textContent = '';
  }

  function renderPin(pin) {
    pinDisplayEl.textContent = pin;
  }

  function renderPayload(payload) {
    var text = String(payload || '');
    contentPayloadEl.textContent = text;
    // Auto-shrink long payloads so they stay within 540 px.
    contentPayloadEl.classList.remove('auto-shrink-md', 'auto-shrink-sm');
    if (text.length > 80) {
      contentPayloadEl.classList.add('auto-shrink-sm');
    } else if (text.length > 40) {
      contentPayloadEl.classList.add('auto-shrink-md');
    }
    contentMetaEl.textContent = new Date().toLocaleTimeString();
  }

  // --------- WebSocket lifecycle -----------------------------------------

  var conn = null;

  function send(obj) {
    if (conn) conn.send(obj);
  }

  function startConnection() {
    navigateTo('connecting');
    conn = connectWebSocket(WS_URL, {
      onOpen: function () {
        send({ type: 'register' });
      },
      onMessage: handleMessage,
      onClose: function () {
        stopPinTtlCountdown();
        navigateTo('disconnected');
      },
      onError: function () {
        disconnectedDetailEl.textContent =
          'Network error. Retrying automatically…';
      },
    });
  }

  function handleMessage(msg) {
    if (!msg || typeof msg.type !== 'string') return;
    switch (msg.type) {
      case 'registered':
        renderPin(msg.pin);
        if (typeof msg.pinTtlMs === 'number') {
          startPinTtlCountdown(msg.pinTtlMs);
        }
        navigateTo('pairing');
        break;
      case 'paired':
        stopPinTtlCountdown();
        navigateTo('paired');
        break;
      case 'message':
        renderPayload(msg.payload);
        navigateTo('content');
        break;
      case 'peer-disconnected':
        // A fresh `registered` will follow — go back to connecting briefly.
        renderPin('····');
        navigateTo('connecting');
        break;
      case 'pin-expired':
        // Stay on pairing; server reissues PIN immediately.
        renderPin('····');
        break;
      case 'error':
        errorDetailEl.textContent = formatServerError(msg);
        navigateTo('error');
        break;
      default:
        // Unknown type — ignore silently.
    }
  }

  function formatServerError(msg) {
    switch (msg.reason) {
      case 'server-full':
        return 'Server is full. Try again in a minute.';
      case 'rate-limited':
        return 'Too many attempts. Wait a minute and retry.';
      default:
        return (msg.reason || 'Unknown error') + '.';
    }
  }

  // --------- User actions (D-pad activated) ------------------------------

  function handleAction(action) {
    switch (action) {
      case 'retry':
        if (conn) conn.retry();
        else startConnection();
        break;
      case 'new-pin':
        // Close + reconnect forces a new `register` -> new PIN.
        if (conn) {
          conn.close();
          conn = null;
        }
        startConnection();
        break;
      case 'unpair':
        // Mobile tear-down: easiest path is to tell the server we want a
        // new room. Reusing the "new-pin" code path also kicks the mobile.
        if (conn) {
          conn.close();
          conn = null;
        }
        startConnection();
        break;
      case 'clear':
        renderPayload('—');
        navigateTo('paired');
        break;
      default:
        break;
    }
  }

  document.addEventListener('click', function (ev) {
    var el = ev.target && ev.target.closest
      ? ev.target.closest('[data-action]')
      : null;
    if (el && el.dataset && el.dataset.action) {
      handleAction(el.dataset.action);
    }
  });

  // --------- D-pad focus management --------------------------------------

  function moveFocus(direction) {
    var container = screenEls[currentScreen];
    if (!container) return;
    var list = focusableIn(container);
    if (!list.length) return;
    var active = document.activeElement;
    var idx = list.indexOf(active);
    if (idx < 0) {
      list[0].focus();
      return;
    }
    if (direction === 'next') idx = (idx + 1) % list.length;
    else if (direction === 'prev') idx = (idx - 1 + list.length) % list.length;
    list[idx].focus();
  }

  document.addEventListener('keydown', function (ev) {
    switch (ev.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        moveFocus('next');
        ev.preventDefault();
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
        moveFocus('prev');
        ev.preventDefault();
        break;
      case 'Enter':
      case ' ':
        if (document.activeElement && document.activeElement.click) {
          document.activeElement.click();
          ev.preventDefault();
        }
        break;
      case 'Escape':
      case 'Backspace':
        // Back = unpair if paired, else retry connection.
        if (currentScreen === 'content' || currentScreen === 'paired') {
          handleAction('unpair');
        } else {
          handleAction('retry');
        }
        ev.preventDefault();
        break;
      default:
        break;
    }
  });

  // --------- Boot --------------------------------------------------------

  startConnection();
})();
