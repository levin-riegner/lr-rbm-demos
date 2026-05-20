// Copyright (c) Meta Platforms, Inc. and affiliates.
// All rights reserved.
//
// This source code is licensed under the license found in the
// LICENSE file in the root directory of this source tree.

/*
 * pong — Mobile phone client.
 *
 * Same WebSocket protocol as app.js (the glasses client). UI is rebuilt
 * for touch:
 *   - Home / waiting / gameover / disconnected / error: tap buttons.
 *   - Join:   12-key keypad + 4 code slots.
 *   - Game:   drag the paddle pad up/down; swipe velocity → intent boost
 *             (1× hold, up to 4× fast flick), matching app.js semantics.
 *
 * Audio: tiny chiptune SFX engine, unlocked on first touch.
 */

(function () {
  'use strict';

  // ============================================================
  // 1. WS URL (mirrors glasses client)
  // ============================================================

  var WS_PROD = 'wss://pong-demo.fly.dev/ws';
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
    } catch (e) {}
    if (WS_PROD && !isLocalHostname(location.hostname)) return WS_PROD;
    var proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return proto + '//' + location.host + '/ws';
  }
  var WS_URL = resolveWsUrl();

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
      ws.onmessage = function (e) {
        try { handlers.onMessage(JSON.parse(e.data)); }
        catch (err) { handlers.onMessage(e.data); }
      };
      ws.onclose = function () {
        if (handlers.onClose) handlers.onClose();
        if (manualClose) return;
        reconnectTimer = setTimeout(function () {
          reconnectDelay = Math.min(reconnectDelay * 2, 30000);
          connect();
        }, reconnectDelay);
      };
      ws.onerror = function () { if (handlers.onError) handlers.onError(); };
    }
    connect();
    return {
      send: function (data) {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(typeof data === 'string' ? data : JSON.stringify(data));
        }
      },
      retry: function () {
        clearTimeout(reconnectTimer);
        if (ws) { try { ws.close(); } catch (e) {} }
        manualClose = false;
        reconnectDelay = 1000;
        connect();
      },
    };
  }

  // ============================================================
  // 2. Audio (chiptune blips, same as glasses)
  // ============================================================

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
    } catch (e) { return null; }
    return audioCtx;
  }
  function blip(freq, dur, type, gain) {
    var ctx = ensureAudio(); if (!ctx) return;
    if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
    var t0 = ctx.currentTime;
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain || 0.5, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(masterGain);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }
  function sweep(fromHz, toHz, dur, type, gain) {
    var ctx = ensureAudio(); if (!ctx) return;
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
    osc.connect(g); g.connect(masterGain);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }
  function arpeggio(freqs, step, type, gain) {
    var ctx = ensureAudio(); if (!ctx) return;
    var i = 0;
    freqs.forEach(function (f) {
      setTimeout(function () { blip(f, step * 1.4, type || 'square', gain || 0.45); }, i * step * 1000);
      i++;
    });
  }
  var sfx = {
    focus:        function () { blip(660, 0.06, 'square', 0.18); },
    click:        function () { blip(880, 0.08, 'square', 0.32); },
    keypad:       function () { blip(740, 0.06, 'square', 0.24); },
    boost:        function () { blip(1320, 0.05, 'square', 0.22); },
    paddleHit:    function () { blip(420, 0.09, 'square', 0.5); },
    wallHit:      function () { blip(220, 0.06, 'square', 0.35); },
    score:        function () { arpeggio([523.25, 659.25, 783.99], 0.07, 'square', 0.4); },
    win:          function () { arpeggio([523, 659, 784, 1046], 0.09, 'square', 0.5); },
    lose:         function () { sweep(440, 90, 0.55, 'sawtooth', 0.42); },
    fragmentTick: function () { blip(990, 0.04, 'triangle', 0.14); },
    join:         function () { arpeggio([392, 523, 659], 0.06, 'square', 0.36); },
    error:        function () { blip(140, 0.18, 'sawtooth', 0.4); },
  };
  function unlockAudioOnFirstGesture() {
    var fn = function () {
      ensureAudio();
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().catch(function () {});
      }
      window.removeEventListener('touchstart', fn);
      window.removeEventListener('pointerdown', fn);
      window.removeEventListener('keydown', fn);
    };
    window.addEventListener('touchstart', fn, { passive: true });
    window.addEventListener('pointerdown', fn);
    window.addEventListener('keydown', fn);
  }
  unlockAudioOnFirstGesture();

  // ============================================================
  // 3. Screen state machine
  // ============================================================

  var SCREENS = ['connecting','home','waiting','join','game','gameover','disconnected','error'];
  var screenEls = {};
  SCREENS.forEach(function (n) { screenEls[n] = document.getElementById('screen-' + n); });
  var currentScreen = 'connecting';

  function navigateTo(name) {
    if (!screenEls[name]) return;
    SCREENS.forEach(function (k) {
      screenEls[k].classList.toggle('hidden', k !== name);
    });
    var prev = currentScreen;
    currentScreen = name;
    onScreenExit(prev);
    onScreenEnter(name);
  }

  function onScreenEnter(name) {
    if (name === 'connecting') startFragmentCycle();
    if (name === 'game') { resetGameClientState(); startRenderLoop(); }
    if (name === 'join') {
      joinTyped = [];
      if (codeFieldEl) codeFieldEl.value = '';
      renderJoinSlots();
      setJoinStatus('');
      // Pop the native numeric keyboard. iOS only honors focus() when
      // it's still inside the same gesture that opened this screen,
      // which is the case when the user taps "JOIN ROOM" or pressed
      // navigateTo from a tap handler.
      if (codeFieldEl) {
        try { codeFieldEl.focus(); } catch (e) { /* iOS may refuse */ }
      }
    }
    if (name === 'gameover') readyStatusEl.textContent = '';
  }
  function onScreenExit(name) {
    if (name === 'game') stopRenderLoop();
    if (name === 'connecting') stopFragmentCycle();
    if (name === 'join' && codeFieldEl) {
      try { codeFieldEl.blur(); } catch (e) {}
    }
  }

  // ============================================================
  // 4. DOM refs
  // ============================================================

  var roomCodeEl = document.getElementById('room-code');
  var codeTtlEl = document.getElementById('code-ttl');
  var joinStatusEl = document.getElementById('join-status');
  var scoreLeftEl = document.getElementById('score-left');
  var scoreRightEl = document.getElementById('score-right');
  var courtCanvas = document.getElementById('court');
  var ctx = courtCanvas.getContext('2d');
  var gameoverHeadlineEl = document.getElementById('gameover-headline');
  var gameoverDetailEl = document.getElementById('gameover-detail');
  var readyStatusEl = document.getElementById('ready-status');
  var disconnectedDetailEl = document.getElementById('disconnected-detail');
  var errorDetailEl = document.getElementById('error-detail');
  var fragmentEl = document.getElementById('connecting-fragment');
  var slotEls = Array.prototype.slice.call(document.querySelectorAll('.m-slot'));
  var keypadEl = document.getElementById('m-keypad');
  var codeFieldEl = document.getElementById('m-code-field');
  var paddlePadEl = document.getElementById('paddle-pad');
  var paddlePadHintEl = document.getElementById('paddle-pad-hint');
  var boostMeterEl = document.getElementById('boost-meter');
  var boostMeterCells = Array.prototype.slice.call(boostMeterEl.querySelectorAll('span'));

  // ============================================================
  // 5. Fragments
  // ============================================================

  var FRAGMENTS = [
    'connecting the dots',
    'bouncing them off panels',
    'lining up the paddles',
    'polishing the pixel ball',
    'calibrating the net',
    'warming up your thumb',
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
  // 6. Room / game state
  // ============================================================

  var COURT_W = 600;
  var COURT_H = 400;
  var PADDLE_W = 14;
  var PADDLE_H = 84;
  var PADDLE_MARGIN = 18;
  var BALL_R = 9;
  var SNAPSHOT_INTERVAL_MS = 50;

  var mySide = null;
  var roomCode = null;
  var rejoinToken = null;
  var prevSnapshot = null;
  var latestSnapshot = null;
  var latestRecvAt = 0;
  var myIntent = 0;

  var joinTyped = [];
  var codeTtlTimer = null;

  // ============================================================
  // 7. WS
  // ============================================================

  var conn = null;

  var HEARTBEAT_MS = 10 * 1000;
  var pingTimer = null;
  function startHeartbeat() {
    stopHeartbeat();
    pingTimer = setInterval(function () {
      send({ type: 'ping', t: Date.now() });
    }, HEARTBEAT_MS);
  }
  function stopHeartbeat() {
    if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
  }

  function send(obj) { if (conn) conn.send(obj); }

  function startConnection() {
    navigateTo('connecting');
    conn = connectWebSocket(WS_URL, {
      onOpen: function () {
        startHeartbeat();
        if (rejoinToken && roomCode &&
            (currentScreen === 'disconnected' || currentScreen === 'connecting' ||
             currentScreen === 'game' || currentScreen === 'gameover')) {
          disconnectedDetailEl.textContent = 'Reconnecting to your match…';
          if (currentScreen !== 'disconnected') navigateTo('disconnected');
          send({ type: 'rejoin', code: roomCode, token: rejoinToken });
          return;
        }
        navigateTo('home');
      },
      onMessage: handleMessage,
      onClose: function () {
        stopHeartbeat();
        stopCodeTtlCountdown();
        if (rejoinToken && roomCode &&
            (currentScreen === 'game' || currentScreen === 'gameover')) {
          disconnectedDetailEl.textContent = 'Connection blip — reconnecting…';
          navigateTo('disconnected');
        } else if (currentScreen === 'game' || currentScreen === 'gameover' ||
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
        roomCodeEl.textContent = msg.code;
        if (typeof msg.ttlMs === 'number') startCodeTtlCountdown(msg.ttlMs);
        navigateTo('waiting');
        sfx.click();
        break;
      case 'paired':
        mySide = msg.side === 'right' ? 'right' : 'left';
        rejoinToken = msg.token || null;
        stopCodeTtlCountdown();
        scoreLeftEl.textContent = '0';
        scoreRightEl.textContent = '0';
        prevSnapshot = null;
        latestSnapshot = null;
        navigateTo('game');
        sfx.join();
        break;
      case 'rejoined':
        mySide = msg.side === 'right' ? 'right' : 'left';
        if (msg.score) {
          scoreLeftEl.textContent = String(msg.score.l);
          scoreRightEl.textContent = String(msg.score.r);
        }
        prevSnapshot = null;
        latestSnapshot = null;
        if (currentScreen !== 'game') navigateTo('game');
        sfx.join();
        break;
      case 'rejoin-fail':
        rejoinToken = null;
        roomCode = null;
        disconnectedDetailEl.textContent = 'Could not reconnect to the match.';
        navigateTo('disconnected');
        sfx.error();
        break;
      case 'peer-paused':
        // Best-effort hint on the boost meter row — the mobile UI doesn't
        // have a dedicated status line on the game screen.
        if (paddlePadHintEl) paddlePadHintEl.textContent = 'OPPONENT RECONNECTING';
        break;
      case 'peer-resumed':
        if (paddlePadHintEl) paddlePadHintEl.textContent = 'DRAG UP / DOWN';
        break;
      case 'pong':
        break;
      case 'state':
        onSnapshot(msg);
        break;
      case 'phase':
        if (msg.phase === 'won') {
          renderGameover(msg);
          navigateTo('gameover');
          (msg.winner === mySide ? sfx.win : sfx.lose)();
        } else if (msg.phase === 'playing') {
          if (currentScreen === 'gameover') {
            scoreLeftEl.textContent = '0';
            scoreRightEl.textContent = '0';
            sfx.join();
          }
          if (paddlePadHintEl) paddlePadHintEl.textContent = 'DRAG UP / DOWN';
          prevSnapshot = null;
          latestSnapshot = null;
          if (currentScreen !== 'game') navigateTo('game');
        } else if (msg.phase === 'paused') {
          if (paddlePadHintEl) paddlePadHintEl.textContent = 'MATCH PAUSED — WAITING';
        }
        break;
      case 'opponent-disconnected':
        rejoinToken = null;
        roomCode = null;
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
    }
  }
  function formatServerError(msg) {
    switch (msg.reason) {
      case 'server-full':       return 'Server is full. Try again in a minute.';
      case 'rate-limited':      return 'Too many attempts. Wait a minute and retry.';
      case 'payload-too-large': return 'Payload too large.';
      case 'bad-intent':        return 'Connection to server was lost.';
      default:                  return (msg.reason || 'Unknown error') + '.';
    }
  }

  // ============================================================
  // 8. Code TTL
  // ============================================================

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
  // 9. Join keypad
  // ============================================================

  function renderJoinSlots() {
    for (var i = 0; i < 4; i++) {
      var slot = slotEls[i];
      if (!slot) continue;
      slot.classList.remove('filled', 'cursor');
      if (i < joinTyped.length) {
        slot.textContent = String(joinTyped[i]);
        slot.classList.add('filled');
      } else {
        slot.textContent = '·';
        if (i === joinTyped.length) slot.classList.add('cursor');
      }
    }
  }

  function syncCodeFieldFromTyped() {
    if (codeFieldEl) codeFieldEl.value = joinTyped.join('');
  }

  function keypadPress(key) {
    if (key === 'back') {
      if (joinTyped.length > 0) {
        joinTyped.pop();
        syncCodeFieldFromTyped();
        sfx.keypad();
        renderJoinSlots();
        setJoinStatus('');
      }
      return;
    }
    if (key === 'clear') {
      if (joinTyped.length > 0) {
        joinTyped = [];
        syncCodeFieldFromTyped();
        sfx.keypad();
        renderJoinSlots();
        setJoinStatus('');
      }
      return;
    }
    if (/^[0-9]$/.test(key) && joinTyped.length < 4) {
      joinTyped.push(parseInt(key, 10));
      syncCodeFieldFromTyped();
      sfx.keypad();
      renderJoinSlots();
      if (joinTyped.length === 4) {
        submitJoinCode();
      }
    }
  }

  // Native numeric keyboard: any input event on the hidden field
  // rewrites joinTyped from the field's value (digits only, max 4) and
  // auto-submits on the 4th digit.
  if (codeFieldEl) {
    codeFieldEl.addEventListener('input', function () {
      var v = (codeFieldEl.value || '').replace(/[^0-9]/g, '').slice(0, 4);
      if (v !== codeFieldEl.value) codeFieldEl.value = v;
      joinTyped = v.split('').map(function (c) { return parseInt(c, 10); });
      sfx.keypad();
      renderJoinSlots();
      setJoinStatus('');
      if (joinTyped.length === 4) submitJoinCode();
    });
  }

  function submitJoinCode() {
    if (joinTyped.length !== 4) {
      setJoinStatus('Enter all 4 digits.');
      return;
    }
    var code = joinTyped.join('');
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
    // Pulse the slot row (visual only).
    slotEls.forEach(function (s) {
      s.classList.add('filled');
      setTimeout(function () { s.classList.remove('filled'); }, 200);
    });
    // Clear immediately so the user can start typing fresh and we don't
    // sit on a stale 4-digit value that the native-keyboard input event
    // could re-trigger.
    joinTyped = [];
    if (codeFieldEl) codeFieldEl.value = '';
    renderJoinSlots();
  }

  // ============================================================
  // 10. Game render loop (same logic as app.js, responsive canvas)
  // ============================================================

  var rafId = null;
  function startRenderLoop() {
    if (rafId !== null) return;
    var loop = function () { renderFrame(); rafId = requestAnimationFrame(loop); };
    rafId = requestAnimationFrame(loop);
  }
  function stopRenderLoop() {
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
  }
  function lerp(a, b, t) { return a + (b - a) * t; }

  var prevBallVxSign = 0;
  var prevBallVySign = 0;
  function detectBallEvents() {
    if (!latestSnapshot || !prevSnapshot) return;
    var prev = prevSnapshot.ball, cur = latestSnapshot.ball;
    var vxSign = (cur.x - prev.x) >= 0 ? 1 : -1;
    var vySign = (cur.y - prev.y) >= 0 ? 1 : -1;
    if (latestSnapshot.phase === 'playing' && prevSnapshot.phase === 'playing') {
      if (prevBallVxSign && prevBallVxSign !== vxSign) sfx.paddleHit();
      if (prevBallVySign && prevBallVySign !== vySign) sfx.wallHit();
    }
    prevBallVxSign = vxSign;
    prevBallVySign = vySign;
  }

  function resetGameClientState() {
    prevBallVxSign = 0;
    prevBallVySign = 0;
    paddleDragging = false;
    paddlePadEl.classList.remove('is-active');
    setBoostMeter(0);
  }

  function renderFrame() {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, COURT_W, COURT_H);
    // Center net.
    ctx.fillStyle = '#2a2a3a';
    var netW = 6, netH = 14, gap = 10;
    var netX = (COURT_W - netW) / 2;
    for (var y = 4; y < COURT_H - 4; y += netH + gap) {
      ctx.fillRect(netX, y, netW, netH);
    }
    if (!latestSnapshot) return;
    var t = 1;
    if (prevSnapshot) {
      t = (performance.now() - latestRecvAt) / SNAPSHOT_INTERVAL_MS;
      if (t < 0) t = 0; if (t > 1) t = 1;
    }
    var leftY, rightY, ballX, ballY;
    if (prevSnapshot) {
      leftY = lerp(prevSnapshot.paddles.l, latestSnapshot.paddles.l, t);
      rightY = lerp(prevSnapshot.paddles.r, latestSnapshot.paddles.r, t);
      var ldx = Math.abs(latestSnapshot.ball.x - prevSnapshot.ball.x);
      var ldy = Math.abs(latestSnapshot.ball.y - prevSnapshot.ball.y);
      if (latestSnapshot.phase === 'serving' || prevSnapshot.phase === 'serving' || ldx > 120 || ldy > 120) {
        ballX = latestSnapshot.ball.x; ballY = latestSnapshot.ball.y;
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
    var leftColor  = mySide === 'left'  ? '#00ff88' : '#ffffff';
    var rightColor = mySide === 'right' ? '#00ff88' : '#ffffff';
    drawPaddle(PADDLE_MARGIN, leftY, leftColor);
    drawPaddle(COURT_W - PADDLE_MARGIN - PADDLE_W, rightY, rightColor);
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
  function onSnapshot(snap) {
    if (latestSnapshot && typeof snap.seq === 'number' && snap.seq < latestSnapshot.seq) return;
    prevSnapshot = latestSnapshot;
    latestSnapshot = snap;
    latestRecvAt = performance.now();
    if (prevSnapshot && (prevSnapshot.score.l !== snap.score.l || prevSnapshot.score.r !== snap.score.r)) {
      sfx.score();
    }
    detectBallEvents();
    scoreLeftEl.textContent = String(snap.score.l);
    scoreRightEl.textContent = String(snap.score.r);
  }
  function renderGameover(msg) {
    var iWon = msg.winner === mySide;
    gameoverHeadlineEl.textContent = iWon ? 'YOU WON' : 'YOU LOST';
    gameoverHeadlineEl.classList.toggle('lose', !iWon);
    if (msg.score) {
      gameoverDetailEl.textContent = msg.score.l + ' – ' + msg.score.r;
    }
  }

  // ============================================================
  // 11. Touch paddle pad — drag = direction, velocity = boost
  // ============================================================
  //
  // While the user drags up/down on the pad we send a fresh intent every
  // animation frame. The intent direction is the sign of dy, magnitude
  // is 1..4 scaled from the recent drag velocity (px/sec).

  var paddleDragging = false;
  var dragLastY = 0;
  var dragLastT = 0;
  var dragSmoothedVy = 0; // smoothed px/sec
  var dragSendTimer = null;

  function setBoostMeter(magnitude) {
    boostMeterCells.forEach(function (c, i) {
      c.classList.toggle('on', i < magnitude);
    });
  }

  function sendIntent(v) {
    if (v > 4) v = 4;
    if (v < -4) v = -4;
    if (v === myIntent) return;
    myIntent = v;
    send({ type: 'input', intent: v });
  }

  function magnitudeFromVelocity(absVy) {
    // px/sec → 1..4. Tuned for ~600 px tall pad on a phone.
    if (absVy < 80) return 1;
    if (absVy < 320) return 2;
    if (absVy < 700) return 3;
    return 4;
  }

  function onPadStart(clientY) {
    paddleDragging = true;
    paddlePadEl.classList.add('is-active');
    paddlePadHintEl.textContent = 'TRACKING';
    dragLastY = clientY;
    dragLastT = performance.now();
    dragSmoothedVy = 0;
    // Send a tiny initial intent so the paddle wakes up immediately if
    // the user taps before moving (defaults to "down" — they can flick).
    sendIntent(0);
    if (dragSendTimer) clearInterval(dragSendTimer);
    dragSendTimer = setInterval(tickDragSend, 60);
  }

  function onPadMove(clientY) {
    if (!paddleDragging) return;
    var now = performance.now();
    var dt = Math.max(8, now - dragLastT);
    var dy = clientY - dragLastY;
    // Instantaneous px/sec.
    var vy = (dy / dt) * 1000;
    // Exponential smoothing.
    dragSmoothedVy = dragSmoothedVy * 0.5 + vy * 0.5;
    dragLastY = clientY;
    dragLastT = now;
  }

  function onPadEnd() {
    paddleDragging = false;
    paddlePadEl.classList.remove('is-active');
    paddlePadHintEl.textContent = 'DRAG UP / DOWN';
    sendIntent(0);
    setBoostMeter(0);
    if (dragSendTimer) { clearInterval(dragSendTimer); dragSendTimer = null; }
  }

  function tickDragSend() {
    if (!paddleDragging) return;
    var idleMs = performance.now() - dragLastT;
    // If finger paused, decay velocity toward zero.
    if (idleMs > 80) dragSmoothedVy *= 0.7;
    var absVy = Math.abs(dragSmoothedVy);
    if (absVy < 15) {
      sendIntent(0);
      setBoostMeter(0);
      return;
    }
    var dir = dragSmoothedVy > 0 ? 1 : -1;
    var mag = magnitudeFromVelocity(absVy);
    var prevMag = Math.abs(myIntent);
    sendIntent(dir * mag);
    if (mag > 1 && mag > prevMag) sfx.boost();
    setBoostMeter(mag);
  }

  // Pointer events cover both touch and mouse (e.g. desktop dev).
  paddlePadEl.addEventListener('pointerdown', function (ev) {
    paddlePadEl.setPointerCapture(ev.pointerId);
    onPadStart(ev.clientY);
    ev.preventDefault();
  });
  paddlePadEl.addEventListener('pointermove', function (ev) {
    onPadMove(ev.clientY);
  });
  paddlePadEl.addEventListener('pointerup', function (ev) {
    onPadEnd();
    try { paddlePadEl.releasePointerCapture(ev.pointerId); } catch (e) {}
  });
  paddlePadEl.addEventListener('pointercancel', onPadEnd);

  // Belt-and-suspenders: stop intent if the page is hidden.
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && currentScreen === 'game') sendIntent(0);
  });
  window.addEventListener('blur', function () {
    if (currentScreen === 'game') sendIntent(0);
  });

  // ============================================================
  // 12. Buttons / keypad wiring
  // ============================================================

  function handleAction(action) {
    switch (action) {
      case 'create':      send({ type: 'create' }); sfx.click(); break;
      case 'show-join':   navigateTo('join'); sfx.click(); break;
      case 'submit-code': submitJoinCode(); sfx.click(); break;
      case 'ready':
        send({ type: 'ready' });
        readyStatusEl.textContent = 'Waiting for opponent…';
        sfx.click();
        break;
      case 'leave':
        send({ type: 'leave' });
        leaveToHome();
        sfx.click();
        break;
      case 'home':        leaveToHome(); sfx.click(); break;
      case 'retry':
        if (conn) conn.retry();
        else startConnection();
        sfx.click();
        break;
      default: break;
    }
  }

  function leaveToHome() {
    mySide = null;
    roomCode = null;
    rejoinToken = null;
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

  // Keypad: pointerdown for immediate response, with a pressed style.
  keypadEl.addEventListener('pointerdown', function (ev) {
    var key = ev.target && ev.target.closest('.m-key');
    if (!key) return;
    key.classList.add('is-pressed');
    setTimeout(function () { key.classList.remove('is-pressed'); }, 120);
    keypadPress(key.dataset.key);
    ev.preventDefault();
  });

  // ============================================================
  // 13. Boot
  // ============================================================

  renderJoinSlots();
  startConnection();
})();
