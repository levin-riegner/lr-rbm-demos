// Copyright (c) Meta Platforms, Inc. and affiliates.
// All rights reserved.
//
// This source code is licensed under the license found in the
// LICENSE file in the root directory of this source tree.

/*
 * pong — Glasses client.
 *
 * A single WebSocket drives an 8-screen state machine:
 *
 *   connecting     — initial / WS retrying
 *   home           — Create or Join
 *   waiting        — created a room, displaying code, waiting for opponent
 *   join           — entering an existing room's code (combo-lock UI)
 *   game           — playing
 *   gameover       — match ended, ask for rematch or leave
 *   disconnected   — peer left or WS dropped
 *   error          — protocol error
 *
 * Server is authoritative for all physics. Client just sends paddle
 * `intent ∈ {-1, 0, 1}` on key change and renders snapshots, lerping
 * between the latest two for smoothness.
 *
 * D-pad (arrow keys + Enter) drives focus on menu screens, the combo
 * lock on the join screen, and the paddle on the game screen. Escape
 * means "leave / back".
 */

(function () {
  'use strict';

  // ---------- WebSocket URL derivation -----------------------------------

  // Production WebSocket host. Set this AFTER deploying server.js to Fly.io
  // (or Render / Railway / etc). When set, public visitors automatically use
  // it. Local dev (localhost, LAN, *.local) keeps using same-origin so
  // `npm start` keeps working unchanged.
  var WS_PROD = 'wss://pong-demo.fly.dev/ws';

  function isLocalHostname(host) {
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return true;
    // RFC-1918 private ranges.
    if (/^10\./.test(host)) return true;
    if (/^192\.168\./.test(host)) return true;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
    // mDNS / Bonjour (e.g. mymac.local).
    if (/\.local$/.test(host)) return true;
    return false;
  }

  function resolveWsUrl() {
    // 1. Explicit ?ws=… override always wins (handy for testing).
    try {
      var override = new URLSearchParams(location.search).get('ws');
      if (override) return override;
    } catch (e) {
      /* URLSearchParams unavailable — fall through */
    }
    // 2. Production WS host, if configured AND we're on a public origin
    //    (i.e. not localhost / LAN / .local). This is what lets Netlify-
    //    hosted static files talk to a Fly-hosted WS server with zero
    //    user-facing config.
    if (WS_PROD && !isLocalHostname(location.hostname)) return WS_PROD;
    // 3. Default: same-origin. Works for `npm start`, LAN play, ngrok.
    var proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return proto + '//' + location.host + '/ws';
  }

  var WS_URL = resolveWsUrl();

  // ---------- connectWebSocket helper (from toolkit template) ------------

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

  // ---------- Screen state machine ---------------------------------------

  var SCREENS = [
    'connecting',
    'home',
    'waiting',
    'join',
    'game',
    'gameover',
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
      focusFirst(screenEls[name]);
      return;
    }
    SCREENS.forEach(function (k) {
      if (k === name) screenEls[k].classList.remove('hidden');
      else screenEls[k].classList.add('hidden');
    });
    var prev = currentScreen;
    currentScreen = name;
    onScreenExit(prev);
    onScreenEnter(name);
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

  function onScreenEnter(name) {
    if (name === 'game') startRenderLoop();
    if (name === 'join') {
      // Reset the combo-lock state on (re)entry.
      joinDigits = [0, 0, 0, 0];
      activeCol = 0;
      renderJoinAll();
      setJoinStatus('');
    }
    if (name === 'gameover') {
      readyStatusEl.textContent = '';
    }
  }

  function onScreenExit(name) {
    if (name === 'game') stopRenderLoop();
  }

  // ---------- DOM refs ---------------------------------------------------

  var roomCodeEl = document.getElementById('room-code');
  var codeTtlEl = document.getElementById('code-ttl');
  var joinStatusEl = document.getElementById('join-status');
  var scoreLeftEl = document.getElementById('score-left');
  var scoreRightEl = document.getElementById('score-right');
  var gameMetaEl = document.getElementById('game-meta');
  var courtCanvas = document.getElementById('court');
  var ctx = courtCanvas.getContext('2d');
  var gameoverHeadlineEl = document.getElementById('gameover-headline');
  var gameoverDetailEl = document.getElementById('gameover-detail');
  var readyStatusEl = document.getElementById('ready-status');
  var disconnectedDetailEl = document.getElementById('disconnected-detail');
  var errorDetailEl = document.getElementById('error-detail');
  var lockBodyEl = document.getElementById('lock-body');
  var joinColumns = Array.prototype.slice.call(
    document.querySelectorAll('#screen-join .combo-column')
  );
  var joinDots = Array.prototype.slice.call(
    document.querySelectorAll('#screen-join .column-indicator .dot')
  );

  // ---------- Game / room state ------------------------------------------

  var COURT_W = 600;
  var COURT_H = 400;
  var PADDLE_W = 12;
  var PADDLE_H = 80;
  var PADDLE_MARGIN = 18;
  var BALL_R = 8;
  var SNAPSHOT_INTERVAL_MS = 50; // 20 Hz

  var mySide = null;       // 'left' | 'right' | null
  var roomCode = null;
  var prevSnapshot = null;
  var latestSnapshot = null;
  var latestRecvAt = 0;
  var myIntent = 0;        // -1 | 0 | 1

  // Join screen state.
  var joinDigits = [0, 0, 0, 0];
  var activeCol = 0;
  var joinShakeTimer = null;

  // Code TTL timer for waiting screen.
  var codeTtlTimer = null;

  // ---------- WebSocket lifecycle ----------------------------------------

  var conn = null;

  function send(obj) {
    if (conn) conn.send(obj);
  }

  function startConnection() {
    navigateTo('connecting');
    conn = connectWebSocket(WS_URL, {
      onOpen: function () {
        // Don't auto-create — let the user pick Create or Join.
        navigateTo('home');
      },
      onMessage: handleMessage,
      onClose: function () {
        stopCodeTtlCountdown();
        if (currentScreen === 'game' || currentScreen === 'gameover' || currentScreen === 'waiting' || currentScreen === 'join') {
          disconnectedDetailEl.textContent =
            'Lost connection to the server. Reconnecting…';
          navigateTo('disconnected');
        } else if (currentScreen !== 'error') {
          navigateTo('connecting');
        }
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
      case 'created':
        roomCode = msg.code;
        renderRoomCode(msg.code);
        if (typeof msg.ttlMs === 'number') startCodeTtlCountdown(msg.ttlMs);
        navigateTo('waiting');
        break;
      case 'paired':
        mySide = msg.side === 'right' ? 'right' : 'left';
        stopCodeTtlCountdown();
        // Reset score display before any state arrives.
        scoreLeftEl.textContent = '0';
        scoreRightEl.textContent = '0';
        prevSnapshot = null;
        latestSnapshot = null;
        updateLegendForSide();
        navigateTo('game');
        break;
      case 'state':
        onSnapshot(msg);
        break;
      case 'phase':
        if (msg.phase === 'won') {
          renderGameover(msg);
          navigateTo('gameover');
        } else if (msg.phase === 'playing') {
          // Rematch confirmed. Re-enter the game.
          scoreLeftEl.textContent = '0';
          scoreRightEl.textContent = '0';
          prevSnapshot = null;
          latestSnapshot = null;
          navigateTo('game');
        }
        break;
      case 'opponent-disconnected':
        stopCodeTtlCountdown();
        disconnectedDetailEl.textContent =
          msg.reason === 'idle-timeout'
            ? 'Match was idle for too long.'
            : 'Opponent left.';
        navigateTo('disconnected');
        break;
      case 'join-fail':
        showJoinFail(msg.reason);
        break;
      case 'error':
        if (msg.reason === 'code-expired') {
          disconnectedDetailEl.textContent =
            'Room code expired before anyone joined.';
          navigateTo('disconnected');
        } else {
          errorDetailEl.textContent = formatServerError(msg);
          navigateTo('error');
        }
        break;
      default:
        // Unknown — ignore silently.
    }
  }

  function formatServerError(msg) {
    switch (msg.reason) {
      case 'server-full':
        return 'Server is full. Try again in a minute.';
      case 'rate-limited':
        return 'Too many attempts. Wait a minute and retry.';
      case 'payload-too-large':
        return 'Payload too large.';
      default:
        return (msg.reason || 'Unknown error') + '.';
    }
  }

  // ---------- Waiting screen — code & TTL --------------------------------

  function renderRoomCode(code) {
    roomCodeEl.textContent = code;
  }

  function startCodeTtlCountdown(ttlMs) {
    stopCodeTtlCountdown();
    var expiresAt = Date.now() + ttlMs;
    function tick() {
      var remainMs = Math.max(0, expiresAt - Date.now());
      var m = Math.floor(remainMs / 60000);
      var s = Math.floor((remainMs % 60000) / 1000);
      codeTtlEl.textContent =
        'Expires in ' + m + ':' + String(s).padStart(2, '0');
      if (remainMs <= 0) stopCodeTtlCountdown();
    }
    tick();
    codeTtlTimer = setInterval(tick, 1000);
  }
  function stopCodeTtlCountdown() {
    if (codeTtlTimer) clearInterval(codeTtlTimer);
    codeTtlTimer = null;
    codeTtlEl.textContent = '';
  }

  // ---------- Join screen — combo lock -----------------------------------

  function modN(n, m) {
    return ((n % m) + m) % m;
  }

  function getDigitsAround(value) {
    return [
      modN(value - 2, 10),
      modN(value - 1, 10),
      value,
      modN(value + 1, 10),
      modN(value + 2, 10),
    ];
  }

  function renderJoinColumn(idx) {
    var col = joinColumns[idx];
    if (!col) return;
    var nums = getDigitsAround(joinDigits[idx]);
    var cells = col.querySelectorAll('.digit');
    for (var i = 0; i < cells.length; i++) {
      cells[i].textContent = nums[i];
    }
    joinColumns.forEach(function (c, i) {
      c.classList.toggle('active', i === activeCol);
    });
    joinDots.forEach(function (d, i) {
      d.classList.toggle('active', i === activeCol);
    });
  }

  function renderJoinAll() {
    for (var i = 0; i < 4; i++) renderJoinColumn(i);
  }

  function joinRotateUp() {
    joinDigits[activeCol] = modN(joinDigits[activeCol] - 1, 10);
    renderJoinColumn(activeCol);
  }
  function joinRotateDown() {
    joinDigits[activeCol] = modN(joinDigits[activeCol] + 1, 10);
    renderJoinColumn(activeCol);
  }
  function joinPrevCol() {
    activeCol = Math.max(0, activeCol - 1);
    renderJoinAll();
  }
  function joinNextCol() {
    activeCol = Math.min(3, activeCol + 1);
    renderJoinAll();
  }

  function submitJoinCode() {
    var code = joinDigits.join('');
    setJoinStatus('Connecting to ' + code + '…');
    send({ type: 'join', code: code });
  }

  function setJoinStatus(text) {
    joinStatusEl.textContent = text || '';
  }

  function showJoinFail(reason) {
    var msg;
    switch (reason) {
      case 'unknown-code':
        msg = 'No room with that code.';
        break;
      case 'already-paired':
        msg = 'That room is already full.';
        break;
      case 'rate-limited':
        msg = 'Too many attempts. Wait a minute.';
        break;
      case 'bad-format':
        msg = 'Code must be 4 digits.';
        break;
      case 'already-in-room':
        msg = 'You are already in a room.';
        break;
      default:
        msg = reason || 'Could not join.';
    }
    setJoinStatus(msg);
    if (lockBodyEl) {
      lockBodyEl.classList.remove('shake');
      // Force reflow so the re-applied class restarts the animation.
      void lockBodyEl.offsetWidth;
      lockBodyEl.classList.add('shake');
      if (joinShakeTimer) clearTimeout(joinShakeTimer);
      joinShakeTimer = setTimeout(function () {
        lockBodyEl.classList.remove('shake');
      }, 500);
    }
  }

  // ---------- Game — render loop -----------------------------------------

  var rafId = null;

  function startRenderLoop() {
    if (rafId !== null) return;
    var loop = function () {
      renderFrame();
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
  }

  function stopRenderLoop() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function renderFrame() {
    // Background.
    ctx.fillStyle = '#14141f';
    ctx.fillRect(0, 0, COURT_W, COURT_H);

    // Center line — dashed.
    ctx.save();
    ctx.strokeStyle = '#2a2a40';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 12]);
    ctx.beginPath();
    ctx.moveTo(COURT_W / 2, 8);
    ctx.lineTo(COURT_W / 2, COURT_H - 8);
    ctx.stroke();
    ctx.restore();

    if (!latestSnapshot) return;

    // Compute interpolation factor between prev and latest.
    var t = 1;
    if (prevSnapshot) {
      t = (performance.now() - latestRecvAt) / SNAPSHOT_INTERVAL_MS;
      if (t < 0) t = 0;
      if (t > 1) t = 1;
    }

    // Lerp paddle Ys.
    var leftY, rightY, ballX, ballY;
    if (prevSnapshot) {
      leftY = lerp(prevSnapshot.paddles.l, latestSnapshot.paddles.l, t);
      rightY = lerp(prevSnapshot.paddles.r, latestSnapshot.paddles.r, t);
      // Don't lerp ball through a serve discontinuity — if the latest phase
      // is 'serving' or the ball jumped >120 px in one frame, snap.
      var dx = Math.abs(latestSnapshot.ball.x - prevSnapshot.ball.x);
      var dy = Math.abs(latestSnapshot.ball.y - prevSnapshot.ball.y);
      if (latestSnapshot.phase === 'serving' || prevSnapshot.phase === 'serving' || dx > 120 || dy > 120) {
        ballX = latestSnapshot.ball.x;
        ballY = latestSnapshot.ball.y;
      } else {
        ballX = lerp(prevSnapshot.ball.x, latestSnapshot.ball.x, t);
        ballY = lerp(prevSnapshot.ball.y, latestSnapshot.ball.y, t);
      }
    } else {
      leftY = latestSnapshot.paddles.l;
      rightY = latestSnapshot.paddles.r;
      ballX = latestSnapshot.ball.x;
      ballY = latestSnapshot.ball.y;
    }

    // Left paddle (cyan if mine, white otherwise).
    ctx.fillStyle = mySide === 'left' ? '#00d4ff' : '#ffffff';
    ctx.fillRect(PADDLE_MARGIN, leftY, PADDLE_W, PADDLE_H);

    // Right paddle.
    ctx.fillStyle = mySide === 'right' ? '#00d4ff' : '#ffffff';
    ctx.fillRect(COURT_W - PADDLE_MARGIN - PADDLE_W, rightY, PADDLE_W, PADDLE_H);

    // Ball.
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ballX, ballY, BALL_R, 0, Math.PI * 2);
    ctx.fill();

    // Soft glow around the ball for better visibility on the additive HUD.
    ctx.save();
    ctx.shadowColor = 'rgba(255,255,255,0.6)';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(ballX, ballY, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function onSnapshot(snap) {
    if (latestSnapshot && typeof snap.seq === 'number' && snap.seq < latestSnapshot.seq) {
      return; // Drop out-of-order.
    }
    prevSnapshot = latestSnapshot;
    latestSnapshot = snap;
    latestRecvAt = performance.now();

    scoreLeftEl.textContent = String(snap.score.l);
    scoreRightEl.textContent = String(snap.score.r);
  }

  function updateLegendForSide() {
    if (mySide === 'left') {
      gameMetaEl.textContent = '↑ / ↓ moves the LEFT paddle · Esc leaves';
    } else if (mySide === 'right') {
      gameMetaEl.textContent = '↑ / ↓ moves the RIGHT paddle · Esc leaves';
    }
  }

  function renderGameover(msg) {
    var winner = msg.winner; // 'left' | 'right'
    var iWon = winner === mySide;
    gameoverHeadlineEl.textContent = iWon ? 'You won' : 'You lost';
    gameoverHeadlineEl.classList.toggle('lose', !iWon);
    if (msg.score) {
      var l = msg.score.l;
      var r = msg.score.r;
      gameoverDetailEl.textContent = l + ' – ' + r;
    }
  }

  // ---------- Input — paddle & combo-lock & menu nav --------------------

  function setIntent(v) {
    if (v === myIntent) return;
    myIntent = v;
    send({ type: 'input', intent: v });
  }

  function moveMenuFocus(direction) {
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
    // Game screen — paddle control. No focus, no menu nav.
    if (currentScreen === 'game') {
      switch (ev.key) {
        case 'ArrowUp':
          setIntent(-1);
          ev.preventDefault();
          break;
        case 'ArrowDown':
          setIntent(1);
          ev.preventDefault();
          break;
        case 'Escape':
        case 'Backspace':
          handleAction('leave');
          ev.preventDefault();
          break;
        default:
          break;
      }
      return;
    }

    // Join screen — combo lock takes priority.
    if (currentScreen === 'join') {
      switch (ev.key) {
        case 'ArrowUp':
          joinRotateUp();
          ev.preventDefault();
          return;
        case 'ArrowDown':
          joinRotateDown();
          ev.preventDefault();
          return;
        case 'ArrowLeft':
          joinPrevCol();
          ev.preventDefault();
          return;
        case 'ArrowRight':
          joinNextCol();
          ev.preventDefault();
          return;
        case 'Enter':
        case ' ':
          // Enter on the last column — submit; otherwise activate focused button if any.
          if (document.activeElement && document.activeElement.classList.contains('focusable')) {
            document.activeElement.click();
          } else {
            submitJoinCode();
          }
          ev.preventDefault();
          return;
        case 'Escape':
        case 'Backspace':
          handleAction('leave');
          ev.preventDefault();
          return;
        default:
          break;
      }
      // Fall through to default focus handling for any other key.
    }

    // All other screens — menu nav.
    switch (ev.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        moveMenuFocus('next');
        ev.preventDefault();
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
        moveMenuFocus('prev');
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
        if (currentScreen === 'waiting' || currentScreen === 'gameover') {
          handleAction('leave');
        } else if (currentScreen === 'disconnected' || currentScreen === 'error') {
          handleAction('home');
        }
        ev.preventDefault();
        break;
      default:
        break;
    }
  });

  document.addEventListener('keyup', function (ev) {
    if (currentScreen !== 'game') return;
    if (ev.key === 'ArrowUp' || ev.key === 'ArrowDown') {
      setIntent(0);
      ev.preventDefault();
    }
  });

  // Stop sending phantom input when the tab loses focus.
  window.addEventListener('blur', function () {
    if (currentScreen === 'game') setIntent(0);
  });

  // ---------- Click → action dispatch ------------------------------------

  function handleAction(action) {
    switch (action) {
      case 'create':
        send({ type: 'create' });
        break;
      case 'show-join':
        navigateTo('join');
        break;
      case 'submit-code':
        submitJoinCode();
        break;
      case 'ready':
        send({ type: 'ready' });
        readyStatusEl.textContent = 'Waiting for opponent…';
        break;
      case 'leave':
        // Leave any active room and go home.
        send({ type: 'leave' });
        leaveToHome();
        break;
      case 'home':
        leaveToHome();
        break;
      case 'retry':
        if (conn) conn.retry();
        else startConnection();
        break;
      default:
        break;
    }
  }

  function leaveToHome() {
    mySide = null;
    roomCode = null;
    prevSnapshot = null;
    latestSnapshot = null;
    myIntent = 0;
    stopCodeTtlCountdown();
    navigateTo('home');
  }

  document.addEventListener('click', function (ev) {
    var el = ev.target && ev.target.closest
      ? ev.target.closest('[data-action]')
      : null;
    if (el && el.dataset && el.dataset.action) {
      handleAction(el.dataset.action);
    }
  });

  // ---------- Boot -------------------------------------------------------

  // Initial render of the join lock so it's ready before the user navigates.
  renderJoinAll();

  startConnection();
})();
