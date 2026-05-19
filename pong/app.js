// Copyright (c) Meta Platforms, Inc. and affiliates.
// All rights reserved.
//
// This source code is licensed under the license found in the
// LICENSE file in the root directory of this source tree.

/*
 * pong — Glasses client (8-bit modern revamp).
 *
 * State machine (unchanged from v1):
 *   connecting → home → waiting → game → gameover
 *                    ↘ join ↗
 *   disconnected / error (terminal-ish)
 *
 * New in this revision:
 *   - playful loading-fragment cycle on the Connecting screen
 *   - combo-lock left/right on the edge digit drops focus to the
 *     bottom row (Connect / Back) so the d-pad never gets stuck
 *   - rapid-tap arrow boost (1×/2×/3×/4× paddle speed)
 *   - Web-Audio chiptune SFX (paddle hit, score, focus, click, win/lose,
 *     fragment ticks during connect)
 *
 * Server is authoritative for physics. Client just renders snapshots
 * and forwards intent ∈ [-4, 4].
 */

(function () {
  'use strict';

  // ============================================================
  // 1. WebSocket URL resolution
  // ============================================================

  var WS_PROD = 'wss://spry-polka-splurge.ngrok-free.dev/ws';
  function isLocalHostname(host) {
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return true;
    if (/^10\./.test(host)) return true;
    if (/^192\.168\./.test(host)) return true;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
    if (/\.local$/.test(host)) return true;
    return false;
  }
  function resolveWsUrl() {
    try {
      var override = new URLSearchParams(location.search).get('ws');
      if (override) return override;
    } catch (e) { /* fall through */ }
    if (WS_PROD && !isLocalHostname(location.hostname)) return WS_PROD;
    var proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return proto + '//' + location.host + '/ws';
  }
  var WS_URL = resolveWsUrl();

  // ============================================================
  // 2. connectWebSocket helper
  // ============================================================

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
        if (ws) { try { ws.close(); } catch (e) { /* ignore */ } }
        manualClose = false;
        reconnectDelay = 1000;
        connect();
      },
    };
  }

  // ============================================================
  // 3. Audio — tiny Web-Audio chiptune SFX engine
  // ============================================================
  //
  // Lazy-init: AudioContext can't start until the user gesture, so we
  // resume() on the first keydown / click. Each SFX is a short envelope
  // on a square / triangle oscillator — pure 8-bit blip stuff, no
  // samples loaded over the network.

  var audioCtx = null;
  var masterGain = null;
  var audioReady = false;

  function ensureAudio() {
    if (audioReady) return audioCtx;
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audioCtx = new Ctx();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = 0.32;
      masterGain.connect(audioCtx.destination);
      audioReady = true;
    } catch (e) {
      return null;
    }
    return audioCtx;
  }

  function blip(freq, dur, type, gain) {
    var ctx = ensureAudio();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      try { ctx.resume(); } catch (e) { /* ignore */ }
    }
    var t0 = ctx.currentTime;
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain || 0.5, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(masterGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function sweep(fromHz, toHz, dur, type, gain) {
    var ctx = ensureAudio();
    if (!ctx) return;
    if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
    var t0 = ctx.currentTime;
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(fromHz, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, toHz), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain || 0.5, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(masterGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function arpeggio(freqs, step, type, gain) {
    var ctx = ensureAudio();
    if (!ctx) return;
    var i = 0;
    freqs.forEach(function (f) {
      setTimeout(function () { blip(f, step * 1.4, type || 'square', gain || 0.45); }, i * step * 1000);
      i++;
    });
  }

  var sfx = {
    focus:       function () { blip(660, 0.06, 'square', 0.18); },
    click:       function () { blip(880, 0.08, 'square', 0.32); },
    boost:       function () { blip(1320, 0.05, 'square', 0.22); },
    paddleHit:   function () { blip(420, 0.09, 'square', 0.5); },
    wallHit:     function () { blip(220, 0.06, 'square', 0.35); },
    score:       function () { arpeggio([523.25, 659.25, 783.99], 0.07, 'square', 0.4); },
    win:         function () { arpeggio([523, 659, 784, 1046], 0.09, 'square', 0.5); },
    lose:        function () { sweep(440, 90, 0.55, 'sawtooth', 0.42); },
    fragmentTick:function () { blip(990, 0.04, 'triangle', 0.14); },
    join:        function () { arpeggio([392, 523, 659], 0.06, 'square', 0.36); },
    error:       function () { blip(140, 0.18, 'sawtooth', 0.4); },
  };

  // First user gesture unlocks audio.
  function unlockAudioOnFirstGesture() {
    var fn = function () {
      ensureAudio();
      var ctx = audioCtx;
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(function () { /* ignore */ });
      }
      window.removeEventListener('keydown', fn);
      window.removeEventListener('pointerdown', fn);
      window.removeEventListener('touchstart', fn);
    };
    window.addEventListener('keydown', fn);
    window.addEventListener('pointerdown', fn);
    window.addEventListener('touchstart', fn);
  }
  unlockAudioOnFirstGesture();

  // ============================================================
  // 4. Screen state machine
  // ============================================================

  var SCREENS = ['connecting','home','waiting','join','game','gameover','disconnected','error'];
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
    setTimeout(function () { focusFirst(screenEls[name]); }, 0);
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
    if (name === 'connecting') startFragmentCycle();
    if (name === 'game') startRenderLoop();
    if (name === 'join') {
      joinDigits = [0, 0, 0, 0];
      activeCol = 0;
      joinFocusZone = 'lock';
      renderJoinAll();
      setJoinStatus('');
      // The lock owns the d-pad on entry; no button is "focused" yet.
      blurAllInJoin();
    }
    if (name === 'gameover') {
      readyStatusEl.textContent = '';
    }
  }

  function onScreenExit(name) {
    if (name === 'game') stopRenderLoop();
    if (name === 'connecting') stopFragmentCycle();
  }

  // ============================================================
  // 5. DOM refs
  // ============================================================

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
  var fragmentEl = document.getElementById('connecting-fragment');
  var lockBodyEl = document.getElementById('lock-body');
  var joinColumns = Array.prototype.slice.call(
    document.querySelectorAll('#screen-join .combo-column')
  );
  var joinDots = Array.prototype.slice.call(
    document.querySelectorAll('#screen-join .column-indicator .dot')
  );

  // ============================================================
  // 6. Connecting — playful fragment cycle
  // ============================================================

  var FRAGMENTS = [
    'connecting the dots',
    'bouncing them off panels',
    'lining up the paddles',
    'polishing the pixel ball',
    'calibrating the net',
    'warming up the d-pad',
    'tuning the chiptune',
    'rendering nostalgia',
    'reticulating splines',
    'sharpening corners',
    'waking the goalies',
    'spinning up the court',
  ];

  var fragmentTimer = null;
  var fragmentIdx = 0;

  function setFragmentText(text) {
    if (!fragmentEl) return;
    // Rebuild content so the blinking caret stays attached.
    fragmentEl.innerHTML = '';
    var span = document.createElement('span');
    span.textContent = text;
    var caret = document.createElement('span');
    caret.className = 'blinker';
    caret.setAttribute('aria-hidden', 'true');
    fragmentEl.appendChild(span);
    fragmentEl.appendChild(caret);
  }

  function startFragmentCycle() {
    stopFragmentCycle();
    // Shuffle a bit so two reconnects don't show the same first line.
    fragmentIdx = Math.floor(Math.random() * FRAGMENTS.length);
    setFragmentText(FRAGMENTS[fragmentIdx]);
    fragmentTimer = setInterval(function () {
      fragmentIdx = (fragmentIdx + 1) % FRAGMENTS.length;
      setFragmentText(FRAGMENTS[fragmentIdx]);
      sfx.fragmentTick();
    }, 1500);
  }

  function stopFragmentCycle() {
    if (fragmentTimer) clearInterval(fragmentTimer);
    fragmentTimer = null;
  }

  // ============================================================
  // 7. Game / room state
  // ============================================================

  var COURT_W = 600;
  var COURT_H = 400;
  var PADDLE_W = 14;
  var PADDLE_H = 84;
  var PADDLE_MARGIN = 18;
  var BALL_R = 9;
  var SNAPSHOT_INTERVAL_MS = 50; // 20 Hz

  var mySide = null;       // 'left' | 'right' | null
  var roomCode = null;
  var prevSnapshot = null;
  var latestSnapshot = null;
  var latestRecvAt = 0;
  var myIntent = 0;        // -4..4

  // Join screen state.
  var joinDigits = [0, 0, 0, 0];
  var activeCol = 0;
  var joinFocusZone = 'lock'; // 'lock' | 'buttons'
  var joinShakeTimer = null;

  // Code TTL timer for waiting screen.
  var codeTtlTimer = null;

  // Rapid-tap booster state.
  var BOOST_WINDOW_MS = 260;
  var BOOST_DECAY_MS = 320;
  var tapDirection = 0;
  var tapCount = 0;
  var tapLastAt = 0;
  var boostDecayTimer = null;

  // Practice mode (solo vs the right-side wall).
  var isPractice = false;
  var practice = null;
  var PRACTICE_PADDLE_SPEED = 320;     // px/s, matches server's PADDLE_SPEED
  var PRACTICE_BALL_INIT_SPEED = 260;  // px/s
  var PRACTICE_BALL_MAX_SPEED = 520;
  var PRACTICE_BALL_GAIN = 1.04;
  var PRACTICE_MAX_VYVX = 3;

  // ============================================================
  // 8. WebSocket lifecycle
  // ============================================================

  var conn = null;
  function send(obj) { if (conn) conn.send(obj); }

  function startConnection() {
    navigateTo('connecting');
    conn = connectWebSocket(WS_URL, {
      onOpen: function () { navigateTo('home'); },
      onMessage: handleMessage,
      onClose: function () {
        stopCodeTtlCountdown();
        if (currentScreen === 'game' || currentScreen === 'gameover' ||
            currentScreen === 'waiting' || currentScreen === 'join') {
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
        sfx.click();
        break;
      case 'paired':
        mySide = msg.side === 'right' ? 'right' : 'left';
        stopCodeTtlCountdown();
        scoreLeftEl.textContent = '0';
        scoreRightEl.textContent = '0';
        prevSnapshot = null;
        latestSnapshot = null;
        updateLegendForSide();
        navigateTo('game');
        sfx.join();
        break;
      case 'state':
        onSnapshot(msg);
        break;
      case 'phase':
        if (msg.phase === 'won') {
          renderGameover(msg);
          navigateTo('gameover');
          var iWon = msg.winner === mySide;
          if (iWon) sfx.win(); else sfx.lose();
        } else if (msg.phase === 'playing') {
          scoreLeftEl.textContent = '0';
          scoreRightEl.textContent = '0';
          prevSnapshot = null;
          latestSnapshot = null;
          navigateTo('game');
          sfx.join();
        }
        break;
      case 'opponent-disconnected':
        stopCodeTtlCountdown();
        disconnectedDetailEl.textContent =
          msg.reason === 'idle-timeout'
            ? 'Match was idle for too long.'
            : 'Opponent left.';
        navigateTo('disconnected');
        sfx.error();
        break;
      case 'join-fail':
        showJoinFail(msg.reason);
        sfx.error();
        break;
      case 'error':
        if (msg.reason === 'code-expired') {
          disconnectedDetailEl.textContent =
            'Room code expired before anyone joined.';
          navigateTo('disconnected');
          sfx.error();
        } else {
          errorDetailEl.textContent = formatServerError(msg);
          navigateTo('error');
          sfx.error();
        }
        break;
      default:
        // Unknown — ignore.
    }
  }

  function formatServerError(msg) {
    switch (msg.reason) {
      case 'server-full':      return 'Server is full. Try again in a minute.';
      case 'rate-limited':     return 'Too many attempts. Wait a minute and retry.';
      case 'payload-too-large':return 'Payload too large.';
      default:                 return (msg.reason || 'Unknown error') + '.';
    }
  }

  // ============================================================
  // 9. Waiting — code & TTL
  // ============================================================

  function renderRoomCode(code) { roomCodeEl.textContent = code; }

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

  // ============================================================
  // 10. Join screen — combo lock with edge-escape navigation
  // ============================================================

  function modN(n, m) { return ((n % m) + m) % m; }

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
    for (var i = 0; i < cells.length; i++) cells[i].textContent = nums[i];
    joinColumns.forEach(function (c, i) {
      c.classList.toggle('active', i === activeCol && joinFocusZone === 'lock');
    });
    joinDots.forEach(function (d, i) {
      d.classList.toggle('active', i === activeCol && joinFocusZone === 'lock');
    });
    if (lockBodyEl) {
      lockBodyEl.classList.toggle('lock-focused', joinFocusZone === 'lock');
    }
  }
  function renderJoinAll() {
    for (var i = 0; i < 4; i++) renderJoinColumn(i);
  }

  function blurAllInJoin() {
    var act = document.activeElement;
    if (act && act.blur && screenEls.join.contains(act)) act.blur();
  }

  function focusZoneLock() {
    joinFocusZone = 'lock';
    blurAllInJoin();
    renderJoinAll();
  }

  function focusZoneButtons(which) {
    joinFocusZone = 'buttons';
    renderJoinAll();
    var btns = focusableIn(screenEls.join);
    if (!btns.length) return;
    var target = which === 'last' ? btns[btns.length - 1] : btns[0];
    target.focus();
  }

  function joinRotateUp() {
    joinDigits[activeCol] = modN(joinDigits[activeCol] - 1, 10);
    renderJoinColumn(activeCol);
    sfx.focus();
  }
  function joinRotateDown() {
    joinDigits[activeCol] = modN(joinDigits[activeCol] + 1, 10);
    renderJoinColumn(activeCol);
    sfx.focus();
  }

  // Edge-escape: at col 0 left, drop into the button row (left = Back side
  // intuitively; but use 'first' for the row's first button = Connect).
  // At col 3 right, also drop into the button row (last = Back).
  function joinPrevCol() {
    if (activeCol === 0) {
      focusZoneButtons('first');
      sfx.click();
      return;
    }
    activeCol -= 1;
    renderJoinAll();
    sfx.focus();
  }
  function joinNextCol() {
    if (activeCol === 3) {
      focusZoneButtons('last');
      sfx.click();
      return;
    }
    activeCol += 1;
    renderJoinAll();
    sfx.focus();
  }

  function submitJoinCode() {
    var code = joinDigits.join('');
    setJoinStatus('Connecting to ' + code + '…');
    send({ type: 'join', code: code });
  }
  function setJoinStatus(text) { joinStatusEl.textContent = text || ''; }

  function showJoinFail(reason) {
    var msg;
    switch (reason) {
      case 'unknown-code':   msg = 'No room with that code.'; break;
      case 'already-paired': msg = 'That room is already full.'; break;
      case 'rate-limited':   msg = 'Too many attempts. Wait a minute.'; break;
      case 'bad-format':     msg = 'Code must be 4 digits.'; break;
      case 'already-in-room':msg = 'You are already in a room.'; break;
      default:               msg = reason || 'Could not join.';
    }
    setJoinStatus(msg);
    if (lockBodyEl) {
      lockBodyEl.classList.remove('shake');
      void lockBodyEl.offsetWidth;
      lockBodyEl.classList.add('shake');
      if (joinShakeTimer) clearTimeout(joinShakeTimer);
      joinShakeTimer = setTimeout(function () {
        lockBodyEl.classList.remove('shake');
      }, 500);
    }
  }

  // ============================================================
  // 11. Game render loop
  // ============================================================

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
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
  }
  function lerp(a, b, t) { return a + (b - a) * t; }

  // 8-bit collision SFX heuristics — detect paddle / wall hits between
  // snapshots so we can blip without server-side events.
  var prevBallVxSign = 0;
  var prevBallVySign = 0;
  function detectBallEvents() {
    if (!latestSnapshot || !prevSnapshot) return;
    var prev = prevSnapshot.ball, cur = latestSnapshot.ball;
    var dx = cur.x - prev.x;
    var dy = cur.y - prev.y;
    var vxSign = dx >= 0 ? 1 : -1;
    var vySign = dy >= 0 ? 1 : -1;
    if (latestSnapshot.phase === 'playing' && prevSnapshot.phase === 'playing') {
      if (prevBallVxSign && prevBallVxSign !== vxSign) sfx.paddleHit();
      if (prevBallVySign && prevBallVySign !== vySign) sfx.wallHit();
    }
    prevBallVxSign = vxSign;
    prevBallVySign = vySign;
  }

  function renderFrame() {
    // Pure black background (transparent on lens).
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, COURT_W, COURT_H);

    // 8-bit dashed center net — chunky squares for the pixel vibe.
    ctx.fillStyle = '#2a2a3a';
    var netW = 6, netH = 14, gap = 10;
    var netX = (COURT_W - netW) / 2;
    for (var y = 4; y < COURT_H - 4; y += netH + gap) {
      ctx.fillRect(netX, y, netW, netH);
    }

    if (isPractice) {
      practiceTickAndRender();
      return;
    }

    if (!latestSnapshot) return;

    var t = 1;
    if (prevSnapshot) {
      t = (performance.now() - latestRecvAt) / SNAPSHOT_INTERVAL_MS;
      if (t < 0) t = 0;
      if (t > 1) t = 1;
    }

    var leftY, rightY, ballX, ballY;
    if (prevSnapshot) {
      leftY = lerp(prevSnapshot.paddles.l, latestSnapshot.paddles.l, t);
      rightY = lerp(prevSnapshot.paddles.r, latestSnapshot.paddles.r, t);
      var ldx = Math.abs(latestSnapshot.ball.x - prevSnapshot.ball.x);
      var ldy = Math.abs(latestSnapshot.ball.y - prevSnapshot.ball.y);
      if (latestSnapshot.phase === 'serving' || prevSnapshot.phase === 'serving' || ldx > 120 || ldy > 120) {
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

    // Left paddle.
    var leftColor = mySide === 'left' ? '#00ff88' : '#ffffff';
    drawPaddle(PADDLE_MARGIN, leftY, leftColor);

    // Right paddle.
    var rightColor = mySide === 'right' ? '#00ff88' : '#ffffff';
    drawPaddle(COURT_W - PADDLE_MARGIN - PADDLE_W, rightY, rightColor);

    // Ball — square, not circle (true 8-bit pong).
    drawBall(ballX, ballY);
  }

  function drawPaddle(x, y, color) {
    ctx.save();
    ctx.shadowColor = color === '#00ff88' ? 'rgba(0,255,136,0.55)' : 'rgba(255,255,255,0.45)';
    ctx.shadowBlur = 14;
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), PADDLE_W, PADDLE_H);
    ctx.restore();
  }

  function drawBall(x, y) {
    ctx.save();
    ctx.shadowColor = 'rgba(255,255,255,0.7)';
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#ffffff';
    var s = BALL_R * 2;
    ctx.fillRect(Math.round(x - BALL_R), Math.round(y - BALL_R), s, s);
    ctx.restore();
  }

  // ---------- Practice mode — local physics + render ---------------------

  function startPractice() {
    if (currentScreen === 'game' && isPractice) return;
    isPractice = true;
    mySide = 'left';
    myIntent = 0;
    tapCount = 0;
    tapDirection = 0;
    clearBoostDecay();

    var best = 0;
    try { best = parseInt(localStorage.getItem('pong-practice-best') || '0', 10) || 0; }
    catch (e) { best = 0; }

    practice = {
      paddleY: (COURT_H - PADDLE_H) / 2,
      intent: 0,
      hits: 0,
      best: best,
      lastT: performance.now(),
    };
    practiceServe(-1);

    scoreLeftEl.textContent = '0';
    scoreRightEl.textContent = String(best);
    gameMetaEl.textContent = '↑ / ↓ paddle · tap fast = boost · WALL →';
    navigateTo('game');
    sfx.join();
  }

  function practiceServe(towardX) {
    if (!practice) return;
    var angle = ((Math.random() * 70) - 35) * Math.PI / 180;
    var dir = towardX >= 0 ? 1 : -1;
    practice.ballX = COURT_W / 2;
    practice.ballY = COURT_H / 2;
    practice.vx = dir * PRACTICE_BALL_INIT_SPEED * Math.cos(angle);
    practice.vy = PRACTICE_BALL_INIT_SPEED * Math.sin(angle);
  }

  function endPractice() {
    isPractice = false;
    practice = null;
    sendIntent(0);
  }

  function practiceTickAndRender() {
    if (!practice) return;
    var now = performance.now();
    var dt = Math.min(0.05, (now - practice.lastT) / 1000);
    practice.lastT = now;

    // Paddle move.
    practice.paddleY += practice.intent * PRACTICE_PADDLE_SPEED * dt;
    if (practice.paddleY < 0) practice.paddleY = 0;
    if (practice.paddleY > COURT_H - PADDLE_H) practice.paddleY = COURT_H - PADDLE_H;

    // Ball move.
    practice.ballX += practice.vx * dt;
    practice.ballY += practice.vy * dt;

    // Top / bottom.
    if (practice.ballY - BALL_R < 0) {
      practice.ballY = BALL_R;
      practice.vy = Math.abs(practice.vy);
      sfx.wallHit();
    } else if (practice.ballY + BALL_R > COURT_H) {
      practice.ballY = COURT_H - BALL_R;
      practice.vy = -Math.abs(practice.vy);
      sfx.wallHit();
    }

    // Right wall (the opponent).
    if (practice.ballX + BALL_R > COURT_W) {
      practice.ballX = COURT_W - BALL_R;
      practice.vx = -Math.abs(practice.vx);
      sfx.wallHit();
    }

    // Left paddle collision.
    var leftFace = PADDLE_MARGIN + PADDLE_W;
    if (
      practice.vx < 0 &&
      practice.ballX - BALL_R <= leftFace &&
      practice.ballX - BALL_R >= PADDLE_MARGIN - 4 &&
      practice.ballY >= practice.paddleY - BALL_R &&
      practice.ballY <= practice.paddleY + PADDLE_H + BALL_R
    ) {
      practice.ballX = PADDLE_MARGIN + PADDLE_W + BALL_R;
      practice.vx = Math.abs(practice.vx);
      var hitPos = ((practice.ballY - practice.paddleY) / PADDLE_H) - 0.5;
      var s = Math.sqrt(practice.vx * practice.vx + practice.vy * practice.vy);
      var nextSpeed = Math.min(PRACTICE_BALL_MAX_SPEED, s * PRACTICE_BALL_GAIN);
      var influence = hitPos * 1.2;
      practice.vy = nextSpeed * influence;
      var ang = Math.atan2(practice.vy, practice.vx) +
                ((Math.random() * 10) - 5) * Math.PI / 180;
      practice.vx = Math.cos(ang) * nextSpeed;
      practice.vy = Math.sin(ang) * nextSpeed;
      if (Math.abs(practice.vx) > 1e-3) {
        var ratio = Math.abs(practice.vy / practice.vx);
        if (ratio > PRACTICE_MAX_VYVX) {
          var sign = practice.vy >= 0 ? 1 : -1;
          practice.vy = sign * Math.abs(practice.vx) * PRACTICE_MAX_VYVX;
        }
      }
      practice.hits += 1;
      scoreLeftEl.textContent = String(practice.hits);
      sfx.paddleHit();
    }

    // Miss — ball got past the paddle.
    if (practice.ballX + BALL_R < 0) {
      if (practice.hits > practice.best) {
        practice.best = practice.hits;
        try { localStorage.setItem('pong-practice-best', String(practice.best)); } catch (e) {}
        scoreRightEl.textContent = String(practice.best);
      }
      sfx.lose();
      practice.hits = 0;
      scoreLeftEl.textContent = '0';
      practiceServe(-1);
    }

    // Render.
    drawPaddle(PADDLE_MARGIN, practice.paddleY, '#00ff88');
    drawPracticeWall();
    drawBall(practice.ballX, practice.ballY);
  }

  function drawPracticeWall() {
    ctx.save();
    ctx.fillStyle = '#3a3a44';
    ctx.shadowColor = 'rgba(255,255,255,0.18)';
    ctx.shadowBlur = 6;
    // Solid right-edge wall.
    ctx.fillRect(COURT_W - 6, 0, 6, COURT_H);
    ctx.restore();
  }

  function onSnapshot(snap) {
    if (latestSnapshot && typeof snap.seq === 'number' && snap.seq < latestSnapshot.seq) {
      return;
    }
    prevSnapshot = latestSnapshot;
    latestSnapshot = snap;
    latestRecvAt = performance.now();

    // Score change → score SFX.
    if (prevSnapshot && (prevSnapshot.score.l !== snap.score.l || prevSnapshot.score.r !== snap.score.r)) {
      sfx.score();
    }
    detectBallEvents();

    scoreLeftEl.textContent = String(snap.score.l);
    scoreRightEl.textContent = String(snap.score.r);
  }

  function updateLegendForSide() {
    if (mySide === 'left') {
      gameMetaEl.textContent = '↑ / ↓ LEFT paddle · tap fast = boost';
    } else if (mySide === 'right') {
      gameMetaEl.textContent = '↑ / ↓ RIGHT paddle · tap fast = boost';
    }
  }

  function renderGameover(msg) {
    var winner = msg.winner;
    var iWon = winner === mySide;
    gameoverHeadlineEl.textContent = iWon ? 'YOU WON' : 'YOU LOST';
    gameoverHeadlineEl.classList.toggle('lose', !iWon);
    if (msg.score) {
      var l = msg.score.l;
      var r = msg.score.r;
      gameoverDetailEl.textContent = l + ' – ' + r;
    }
  }

  // ============================================================
  // 12. Input — rapid-tap booster on game; menu/lock nav otherwise
  // ============================================================

  function sendIntent(v) {
    // Clamp to protocol range to be safe.
    if (v > 4) v = 4;
    if (v < -4) v = -4;
    if (v === myIntent) return;
    myIntent = v;
    if (isPractice) {
      if (practice) practice.intent = v;
      return;
    }
    send({ type: 'input', intent: v });
  }

  function clearBoostDecay() {
    if (boostDecayTimer) { clearTimeout(boostDecayTimer); boostDecayTimer = null; }
  }

  function scheduleBoostDecay() {
    clearBoostDecay();
    boostDecayTimer = setTimeout(function () {
      // Streak ended — clamp back to a single press.
      tapCount = 0;
      tapDirection = 0;
      // Don't force intent to 0 here; the user may still be holding.
      // If still pressing the same key, normal keydown auto-repeat will
      // re-send intent 1. If released, keyup already set it to 0.
      if (myIntent !== 0 && (myIntent === 4 || myIntent === -4 || myIntent === 3 || myIntent === -3 || myIntent === 2 || myIntent === -2)) {
        var sign = myIntent > 0 ? 1 : -1;
        sendIntent(sign); // step back down to 1×
      }
    }, BOOST_DECAY_MS);
  }

  function registerArrowTap(direction) {
    // direction: -1 (up) or 1 (down)
    var now = performance.now();
    if (direction === tapDirection && (now - tapLastAt) < BOOST_WINDOW_MS) {
      tapCount = Math.min(4, tapCount + 1);
    } else {
      tapDirection = direction;
      tapCount = 1;
    }
    tapLastAt = now;
    var magnitude = tapCount; // 1..4
    sendIntent(direction * magnitude);
    if (magnitude > 1) sfx.boost();
    scheduleBoostDecay();
  }

  function moveMenuFocus(direction) {
    var container = screenEls[currentScreen];
    if (!container) return;
    var list = focusableIn(container);
    if (!list.length) return;
    var active = document.activeElement;
    var idx = list.indexOf(active);
    if (idx < 0) { list[0].focus(); sfx.focus(); return; }
    if (direction === 'next') idx = (idx + 1) % list.length;
    else if (direction === 'prev') idx = (idx - 1 + list.length) % list.length;
    list[idx].focus();
    sfx.focus();
  }

  document.addEventListener('keydown', function (ev) {
    // -------------------- Game screen --------------------
    if (currentScreen === 'game') {
      switch (ev.key) {
        case 'ArrowUp':
          ev.preventDefault();
          if (!ev.repeat) registerArrowTap(-1);
          break;
        case 'ArrowDown':
          ev.preventDefault();
          if (!ev.repeat) registerArrowTap(1);
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

    // -------------------- Join screen --------------------
    if (currentScreen === 'join') {
      // If buttons own focus, behave like a normal menu row except the
      // ◀ ▶ keys return into the lock from the edges.
      if (joinFocusZone === 'buttons') {
        switch (ev.key) {
          case 'ArrowLeft': {
            var list = focusableIn(screenEls.join);
            var idx = list.indexOf(document.activeElement);
            if (idx > 0) {
              moveMenuFocus('prev');
            } else {
              // Already on first button → jump back into lock at col 0.
              activeCol = 0;
              focusZoneLock();
              sfx.click();
            }
            ev.preventDefault();
            return;
          }
          case 'ArrowRight': {
            var list2 = focusableIn(screenEls.join);
            var idx2 = list2.indexOf(document.activeElement);
            if (idx2 < list2.length - 1) {
              moveMenuFocus('next');
            } else {
              // Already on last button → jump back into lock at col 3.
              activeCol = 3;
              focusZoneLock();
              sfx.click();
            }
            ev.preventDefault();
            return;
          }
          case 'ArrowUp':
            // ▲ from buttons → re-enter the lock at the current column.
            focusZoneLock();
            ev.preventDefault();
            sfx.click();
            return;
          case 'Enter':
          case ' ':
            if (document.activeElement && document.activeElement.click) {
              document.activeElement.click();
              sfx.click();
            }
            ev.preventDefault();
            return;
          case 'Escape':
          case 'Backspace':
            handleAction('leave');
            ev.preventDefault();
            return;
          default:
            return;
        }
      }
      // joinFocusZone === 'lock'
      switch (ev.key) {
        case 'ArrowUp':    joinRotateUp();   ev.preventDefault(); return;
        case 'ArrowDown':  joinRotateDown(); ev.preventDefault(); return;
        case 'ArrowLeft':  joinPrevCol();    ev.preventDefault(); return;
        case 'ArrowRight': joinNextCol();    ev.preventDefault(); return;
        case 'Enter':
        case ' ':
          submitJoinCode();
          sfx.click();
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
      return;
    }

    // -------------------- Other menu screens --------------------
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
          sfx.click();
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
      sendIntent(0);
      tapCount = 0;
      tapDirection = 0;
      clearBoostDecay();
      ev.preventDefault();
    }
  });

  window.addEventListener('blur', function () {
    if (currentScreen === 'game') sendIntent(0);
  });

  // ============================================================
  // 13. Click → action dispatch
  // ============================================================

  function handleAction(action) {
    switch (action) {
      case 'create':
        send({ type: 'create' });
        sfx.click();
        break;
      case 'show-join':
        navigateTo('join');
        sfx.click();
        break;
      case 'practice':
        startPractice();
        break;
      case 'submit-code':
        submitJoinCode();
        sfx.click();
        break;
      case 'ready':
        send({ type: 'ready' });
        readyStatusEl.textContent = 'Waiting for opponent…';
        sfx.click();
        break;
      case 'leave':
        if (isPractice) {
          endPractice();
        } else {
          send({ type: 'leave' });
        }
        leaveToHome();
        sfx.click();
        break;
      case 'home':
        leaveToHome();
        sfx.click();
        break;
      case 'retry':
        if (conn) conn.retry();
        else startConnection();
        sfx.click();
        break;
      default:
        break;
    }
  }

  function leaveToHome() {
    if (isPractice) endPractice();
    mySide = null;
    roomCode = null;
    prevSnapshot = null;
    latestSnapshot = null;
    myIntent = 0;
    tapCount = 0;
    tapDirection = 0;
    clearBoostDecay();
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

  // ============================================================
  // 14. Boot
  // ============================================================

  renderJoinAll();
  startConnection();
})();
