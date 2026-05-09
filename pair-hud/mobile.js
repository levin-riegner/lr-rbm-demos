// Copyright (c) Meta Platforms, Inc. and affiliates.
// All rights reserved.
//
// This source code is licensed under the license found in the
// LICENSE file in the root directory of this source tree.

/*
 * pair-hud — phone client.
 *
 * Two screens: #screen-join (PIN entry) and #screen-control (push content).
 * Shares the same WebSocket protocol as the glasses client:
 *
 *   send    { type: "join", pin }       -> receive { type: "join-ok" | "join-fail" }
 *   send    { type: "push", payload }   -> server forwards to paired glasses
 *   receive { type: "peer-disconnected" | "error" }
 */

(function () {
  'use strict';

  // --------- URL + DOM lookups --------------------------------------------

  function resolveWsUrl() {
    try {
      var qs = new URLSearchParams(location.search);
      var override = qs.get('ws');
      if (override) return override;
    } catch (e) {
      /* fall through */
    }
    var proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return proto + '//' + location.host + '/ws';
  }

  var WS_URL = resolveWsUrl();

  var el = function (id) {
    return document.getElementById(id);
  };

  var screens = {
    join: el('screen-join'),
    control: el('screen-control'),
  };

  var connPill = el('conn-pill');
  var connPillControl = el('conn-pill-control');
  var pinInput = el('pin-input');
  var pinStatus = el('pin-status');
  var btnJoin = el('btn-join');
  var btnSend = el('btn-send');
  var btnDisconnect = el('btn-disconnect');
  var customInput = el('custom-input');
  var charCounter = el('char-counter');
  var pairedPinNote = el('paired-pin-note');
  var toast = el('toast');

  // --------- Prefill PIN from ?pin=XXXX (QR convenience) ------------------

  (function prefillPin() {
    try {
      var qs = new URLSearchParams(location.search);
      var pin = qs.get('pin');
      if (pin && /^\d{4}$/.test(pin)) {
        pinInput.value = pin;
        updateJoinEnabled();
      }
    } catch (e) {
      /* ignore */
    }
  })();

  // --------- Screen switching ---------------------------------------------

  function show(screenName) {
    Object.keys(screens).forEach(function (k) {
      if (k === screenName) screens[k].classList.remove('hidden');
      else screens[k].classList.add('hidden');
    });
  }

  // --------- Connection pill ----------------------------------------------

  var connState = 'connecting';
  function setConnState(state, label) {
    connState = state;
    [connPill, connPillControl].forEach(function (p) {
      if (!p) return;
      p.setAttribute('data-state', state);
      var span = p.querySelector('.label');
      if (span) span.textContent = label;
    });
  }

  // --------- Toast --------------------------------------------------------

  var toastTimer = null;
  function showToast(text, kind) {
    if (toastTimer) clearTimeout(toastTimer);
    toast.className = 'toast visible' + (kind ? ' ' + kind : '');
    toast.textContent = text;
    toastTimer = setTimeout(function () {
      toast.className = 'toast';
    }, 2200);
  }

  // --------- WebSocket ----------------------------------------------------

  // Phone-side reconnect policy is less aggressive: if the user closes the
  // app or loses network we want to land back on the join screen, not
  // silently reattach to a stale room.
  var ws = null;
  var paired = false;
  var desiredClose = false;

  function connect() {
    desiredClose = false;
    setConnState('connecting', 'Connecting…');
    try {
      ws = new WebSocket(WS_URL);
    } catch (e) {
      setConnState('closed', 'Failed');
      return;
    }
    ws.onopen = function () {
      setConnState('open', paired ? 'Connected' : 'Ready');
    };
    ws.onmessage = function (ev) {
      var data;
      try {
        data = JSON.parse(ev.data);
      } catch (e) {
        return;
      }
      handleMessage(data);
    };
    ws.onclose = function () {
      setConnState('closed', 'Disconnected');
      if (paired) {
        paired = false;
        show('join');
        pinInput.value = '';
        updateJoinEnabled();
        setStatus(
          'Connection lost. Re-enter the PIN from your glasses.',
          'error'
        );
      }
      if (!desiredClose) {
        // Light-touch single reconnect for the join screen.
        setTimeout(function () {
          if (!paired && !desiredClose) connect();
        }, 1500);
      }
    };
    ws.onerror = function () {
      setConnState('closed', 'Error');
    };
  }

  function wsSend(obj) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(obj));
      } catch (e) {
        /* ignore */
      }
    }
  }

  // --------- Protocol handling --------------------------------------------

  function handleMessage(msg) {
    if (!msg || typeof msg.type !== 'string') return;
    switch (msg.type) {
      case 'join-ok':
        paired = true;
        setConnState('open', 'Connected');
        setStatus('');
        show('control');
        pairedPinNote.textContent =
          'Paired with glasses — tap a preset or type a message.';
        updateSendEnabled();
        setTimeout(function () {
          customInput.focus();
        }, 100);
        break;

      case 'join-fail':
        setStatus(formatJoinFail(msg.reason), 'error');
        btnJoin.disabled = false;
        // Clear + refocus for re-entry
        pinInput.select();
        break;

      case 'peer-disconnected':
        paired = false;
        showToast('Glasses disconnected', 'error');
        show('join');
        pinInput.value = '';
        pinInput.focus();
        updateJoinEnabled();
        setStatus(
          'Glasses disconnected. Enter the new PIN from your glasses.',
          'error'
        );
        break;

      case 'error':
        showToast('Server: ' + (msg.reason || 'error'), 'error');
        break;

      default:
        // ignore
        break;
    }
  }

  function formatJoinFail(reason) {
    switch (reason) {
      case 'unknown-pin':
        return 'Wrong PIN. Check the number on your glasses.';
      case 'already-paired':
        return 'That PIN is already paired to another phone.';
      case 'rate-limited':
        return 'Too many attempts. Wait a minute and try again.';
      case 'bad-format':
        return 'Enter 4 digits.';
      default:
        return 'Could not pair. Try again.';
    }
  }

  function setStatus(text, kind) {
    pinStatus.textContent = text || '';
    pinStatus.className = 'pin-status' + (kind ? ' ' + kind : '');
  }

  // --------- Input wiring -------------------------------------------------

  function updateJoinEnabled() {
    var v = pinInput.value;
    btnJoin.disabled = !/^\d{4}$/.test(v);
  }

  function sanitizePinInput() {
    // Strip anything non-digit; clamp to 4 chars.
    var v = (pinInput.value || '').replace(/\D+/g, '').slice(0, 4);
    if (v !== pinInput.value) pinInput.value = v;
    updateJoinEnabled();
  }

  pinInput.addEventListener('input', function () {
    sanitizePinInput();
    // Auto-submit when the 4th digit lands — a common PIN-entry pattern.
    if (/^\d{4}$/.test(pinInput.value)) {
      btnJoin.focus();
    }
    setStatus('');
  });

  pinInput.addEventListener('keydown', function (ev) {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      attemptJoin();
    }
  });

  btnJoin.addEventListener('click', attemptJoin);

  function attemptJoin() {
    sanitizePinInput();
    if (!/^\d{4}$/.test(pinInput.value)) {
      setStatus('Enter 4 digits.', 'error');
      return;
    }
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setStatus('Connecting… try again in a second.', 'error');
      return;
    }
    btnJoin.disabled = true;
    setStatus('Pairing…');
    wsSend({ type: 'join', pin: pinInput.value });
  }

  // --------- Preset + custom send ----------------------------------------

  var CHAR_LIMIT = 200;

  function updateSendEnabled() {
    var hasText = (customInput.value || '').trim().length > 0;
    btnSend.disabled = !hasText || !paired;
    var len = (customInput.value || '').length;
    charCounter.textContent = len + ' / ' + CHAR_LIMIT;
    if (len > CHAR_LIMIT * 0.9) charCounter.classList.add('near-limit');
    else charCounter.classList.remove('near-limit');
  }

  customInput.addEventListener('input', updateSendEnabled);

  document.querySelectorAll('.preset').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var text = btn.getAttribute('data-preset');
      if (text) pushPayload(text);
    });
  });

  btnSend.addEventListener('click', function () {
    var text = (customInput.value || '').trim();
    if (!text) return;
    pushPayload(text);
    customInput.value = '';
    updateSendEnabled();
  });

  function pushPayload(text) {
    if (!paired) {
      showToast('Not connected', 'error');
      return;
    }
    if (text.length > CHAR_LIMIT) text = text.slice(0, CHAR_LIMIT);
    wsSend({ type: 'push', payload: text });
    showToast('Delivered to HUD', 'success');
  }

  // --------- Disconnect ---------------------------------------------------

  btnDisconnect.addEventListener('click', function () {
    desiredClose = true;
    paired = false;
    if (ws) {
      try {
        ws.close(1000, 'user');
      } catch (e) {
        /* ignore */
      }
    }
    show('join');
    pinInput.value = '';
    updateJoinEnabled();
    setStatus('Disconnected. Enter a PIN to reconnect.');
    setTimeout(connect, 300);
  });

  // --------- Boot ---------------------------------------------------------

  connect();
  updateJoinEnabled();
  updateSendEnabled();

  // Try to refocus the input on first paint (ignored on iOS without a tap,
  // but nice for desktop testing).
  setTimeout(function () {
    if (screens.join && !screens.join.classList.contains('hidden')) {
      pinInput.focus();
    }
  }, 50);
})();
