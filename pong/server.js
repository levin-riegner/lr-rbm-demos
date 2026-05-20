// Copyright (c) Meta Platforms, Inc. and affiliates.
// All rights reserved.
//
// This source code is licensed under the license found in the
// LICENSE file in the root directory of this source tree.

/*
 * pong — Two-player WebSocket Pong server.
 *
 * One HTTP server serves the static webapp AND accepts WebSocket upgrades
 * at /ws. Two clients pair through a 4-digit room code:
 *
 *   - Player 1 sends `create`           → gets `{type:'created', code}`.
 *   - Player 2 sends `join {code}`      → both get `{type:'paired', side}`.
 *   - The server starts a 60 Hz physics tick + 20 Hz state broadcast.
 *   - Each client sends `input {intent: -1|0|1}` on key change.
 *   - Server runs ball + paddle physics, broadcasts `state` snapshots,
 *     announces `phase` transitions, tears down the room on disconnect.
 *
 * Server-authoritative: clients never simulate ball/paddle physics. They
 * just lerp between two latest snapshots for smoothness.
 *
 * State lives in memory. No DB, no persistence, no auth beyond the code.
 * Knowing the code (which only the creator's screen displays) is the
 * authentication. See README.md for the full protocol.
 *
 * Designed to be a sibling of examples/pair-hud — same shape, same
 * helpers, same hosting story.
 */

'use strict';

var http = require('http');
var fs = require('fs');
var os = require('os');
var path = require('path');
var crypto = require('crypto');
var WebSocketServer = require('ws').WebSocketServer;

// ---------- Constants ---------------------------------------------------------

var PORT = parseInt(process.env.PORT, 10) || 3000;
var HOST = process.env.HOST || '0.0.0.0';

// Room / pairing.
var CODE_TTL_MS = 5 * 60 * 1000;              // Unpaired room expires after 5 min.
var KEEPALIVE_MS = 15 * 1000;                 // WS ping cadence (defeats ngrok ~60s idle).
var MSG_MAX_BYTES = 4 * 1024;                 // Hard cap on any incoming WS frame.
var JOIN_RATE_PER_MIN = 10;                   // Per-IP code-guess budget.
var CREATE_RATE_PER_MIN = 20;                 // Per-IP code-allocation budget.
var CODE_ALLOC_MAX_RETRIES = 20;              // Collision retries before server-full.
var IDLE_TIMEOUT_MS = 60 * 1000;              // Tear down a room with zero input from both sides.
var INPUT_STALE_MS = 2 * 1000;                // Auto-clamp paddle intent to 0 after this.
var GRACE_MS = 10 * 1000;                     // Mid-match disconnect window — peer can rejoin within this.
var COUNTDOWN_MS = 3000;                      // Initial 3-2-1 countdown before the first serve.

// Physics / gameplay (px and px/s on the canonical 600×400 court).
var TICK_HZ = 60;
var SNAPSHOT_HZ = 20;
var COURT_W = 600;
var COURT_H = 400;
var PADDLE_W = 12;
var PADDLE_H = 80;
var PADDLE_MARGIN = 18;                       // Distance from court edge to paddle face.
var PADDLE_SPEED = 320;                       // px/s
var BALL_R = 8;
var BALL_SPEED_INIT = 260;                    // px/s
var BALL_SPEED_MAX = 520;
var BALL_SPEED_GAIN = 1.04;                   // Per-paddle-hit multiplier.
var MAX_VY_VX_RATIO = 3;                      // Avoid near-vertical loops.
var WIN_SCORE = 5;
var SERVE_DELAY_MS = 800;                     // Pause between point and next serve.

var STATIC_DIR = __dirname;

var MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

// ---------- State -------------------------------------------------------------

/** @type {Map<string, Room>} code -> room */
var rooms = new Map();
/** @type {WeakMap<WebSocket, string>} socket -> code */
var codeByLeftSocket = new WeakMap();
/** @type {WeakMap<WebSocket, string>} socket -> code */
var codeByRightSocket = new WeakMap();
/** @type {Map<string, {count:number, resetAt:number}>} */
var joinBuckets = new Map();
/** @type {Map<string, {count:number, resetAt:number}>} */
var createBuckets = new Map();

// ---------- Logging -----------------------------------------------------------

function log(level, event, extra) {
  var entry = Object.assign(
    { t: new Date().toISOString(), level: level, event: event },
    extra || {}
  );
  process.stdout.write(JSON.stringify(entry) + '\n');
}

// ---------- Rate limiting -----------------------------------------------------

function rateLimit(bucketMap, key, maxPerMin) {
  var now = Date.now();
  var bucket = bucketMap.get(key);
  if (!bucket || bucket.resetAt < now) {
    bucket = { count: 0, resetAt: now + 60 * 1000 };
    bucketMap.set(key, bucket);
  }
  bucket.count += 1;
  return bucket.count <= maxPerMin;
}

setInterval(function () {
  var now = Date.now();
  [joinBuckets, createBuckets].forEach(function (m) {
    m.forEach(function (v, k) {
      if (v.resetAt < now) m.delete(k);
    });
  });
}, 60 * 1000).unref();

// ---------- Code generation ---------------------------------------------------

function makeCode() {
  for (var i = 0; i < CODE_ALLOC_MAX_RETRIES; i++) {
    var n = crypto.randomInt(0, 10000);
    var code = String(n).padStart(4, '0');
    if (!rooms.has(code)) return code;
  }
  return null;
}

// ---------- Messaging helpers -------------------------------------------------

var msgSeq = 0;
function send(ws, obj) {
  if (!ws || ws.readyState !== 1) return; // 1 = OPEN
  msgSeq += 1;
  var frame = Object.assign({ v: 1, id: msgSeq, ts: Date.now() }, obj);
  try {
    ws.send(JSON.stringify(frame));
  } catch (e) {
    /* socket likely half-closed; cleanup happens onclose */
  }
}

function ipOf(req) {
  var fwd = req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : 'unknown';
}

// ---------- Room lifecycle ----------------------------------------------------

/**
 * @typedef {Object} Side
 * @property {WebSocket} ws
 * @property {number} y                 // top-left Y of paddle in court space
 * @property {number} intent            // -1 | 0 | 1
 * @property {number} lastInputAt
 * @property {number} score
 * @property {boolean} ready
 *
 * @typedef {Object} Ball
 * @property {number} x
 * @property {number} y
 * @property {number} vx
 * @property {number} vy
 *
 * @typedef {Object} Room
 * @property {string} code
 * @property {Side} left
 * @property {Side|null} right
 * @property {Ball} ball
 * @property {'waiting'|'playing'|'serving'|'paused'|'won'} phase
 * @property {string|null} winner       // 'left' | 'right' | null
 * @property {number} lastSnapshotSeq
 * @property {NodeJS.Timeout|null} tickTimer
 * @property {NodeJS.Timeout|null} snapshotTimer
 * @property {NodeJS.Timeout|null} idleTimer
 * @property {NodeJS.Timeout|null} codeExpireTimer
 * @property {NodeJS.Timeout|null} serveTimer
 * @property {NodeJS.Timeout|null} graceTimer
 * @property {string} leftToken         // Per-match rejoin token for the left seat.
 * @property {string|null} rightToken
 * @property {number|null} pausedAt     // ms timestamp the room entered the paused-awaiting-rejoin state.
 * @property {number} createdAt
 * @property {number|null} pairedAt
 */

function createRoom(leftWs) {
  var code = makeCode();
  if (!code) return null;

  var room = {
    code: code,
    left: makeSide(leftWs),
    right: null,
    ball: { x: COURT_W / 2, y: COURT_H / 2, vx: 0, vy: 0 },
    phase: 'waiting',
    winner: null,
    lastSnapshotSeq: 0,
    tickTimer: null,
    snapshotTimer: null,
    idleTimer: null,
    codeExpireTimer: null,
    serveTimer: null,
    countdownTimer: null,
    graceTimer: null,
    leftToken: crypto.randomBytes(12).toString('hex'),
    rightToken: null,
    pausedAt: null,
    createdAt: Date.now(),
    pairedAt: null,
  };
  room.codeExpireTimer = setTimeout(function () {
    onCodeExpired(code);
  }, CODE_TTL_MS);

  rooms.set(code, room);
  codeByLeftSocket.set(leftWs, code);
  return room;
}

function makeSide(ws) {
  return {
    ws: ws,
    y: (COURT_H - PADDLE_H) / 2,
    intent: 0,
    lastInputAt: Date.now(),
    score: 0,
    ready: false,
  };
}

function onCodeExpired(code) {
  var room = rooms.get(code);
  if (!room || room.right) return; // Paired before expiry — let it live.
  if (room.left && room.left.ws) {
    send(room.left.ws, { type: 'error', reason: 'code-expired' });
    try {
      room.left.ws.close(1000, 'code-expired');
    } catch (e) {
      /* ignore */
    }
  }
  destroyRoom(code, 'code-expired');
}

function attachRight(room, rightWs) {
  if (room.codeExpireTimer) {
    clearTimeout(room.codeExpireTimer);
    room.codeExpireTimer = null;
  }
  room.right = makeSide(rightWs);
  room.rightToken = crypto.randomBytes(12).toString('hex');
  room.pairedAt = Date.now();
  codeByRightSocket.set(rightWs, room.code);

  // Tell both peers their assigned side + a per-match rejoin token. If the
  // socket drops mid-match, the client can present this token within
  // GRACE_MS to slip back into the same seat.
  send(room.left.ws, { type: 'paired', side: 'left',  token: room.leftToken });
  send(rightWs,      { type: 'paired', side: 'right', token: room.rightToken });

  // Hold the ball at center during the 3-second countdown; both clients
  // render a 3-2-1 overlay locally and the server serves when it expires.
  startCountdown(room);

  startRoomLoops(room);
  resetIdleTimer(room);
  log('info', 'room.paired', { code: room.code });
}

function startRoomLoops(room) {
  stopRoomLoops(room);
  var lastTick = Date.now();
  room.tickTimer = setInterval(function () {
    var now = Date.now();
    var dt = Math.min(0.05, (now - lastTick) / 1000); // clamp to 50 ms to absorb stalls
    lastTick = now;
    tickRoom(room, dt);
  }, Math.round(1000 / TICK_HZ));
  room.tickTimer.unref();

  room.snapshotTimer = setInterval(function () {
    broadcastSnapshot(room);
  }, Math.round(1000 / SNAPSHOT_HZ));
  room.snapshotTimer.unref();
}

function stopRoomLoops(room) {
  if (room.tickTimer) {
    clearInterval(room.tickTimer);
    room.tickTimer = null;
  }
  if (room.snapshotTimer) {
    clearInterval(room.snapshotTimer);
    room.snapshotTimer = null;
  }
  if (room.serveTimer) {
    clearTimeout(room.serveTimer);
    room.serveTimer = null;
  }
}

function resetIdleTimer(room) {
  if (room.idleTimer) clearTimeout(room.idleTimer);
  room.idleTimer = setTimeout(function () {
    log('info', 'room.idle-timeout', { code: room.code });
    notifyAndDestroy(room, 'idle-timeout');
  }, IDLE_TIMEOUT_MS);
  room.idleTimer.unref();
}

function destroyRoom(code, reason) {
  var room = rooms.get(code);
  if (!room) return;
  stopRoomLoops(room);
  if (room.idleTimer) {
    clearTimeout(room.idleTimer);
    room.idleTimer = null;
  }
  if (room.codeExpireTimer) {
    clearTimeout(room.codeExpireTimer);
    room.codeExpireTimer = null;
  }
  if (room.countdownTimer) {
    clearTimeout(room.countdownTimer);
    room.countdownTimer = null;
  }
  if (room.graceTimer) {
    clearTimeout(room.graceTimer);
    room.graceTimer = null;
  }
  rooms.delete(code);
  log('info', 'room.destroyed', { code: code, reason: reason });
}

function notifyAndDestroy(room, reason) {
  // Inform whoever's still on the line, then tear the room down.
  if (room.left && room.left.ws) {
    send(room.left.ws, { type: 'opponent-disconnected', reason: reason });
    try {
      if (reason === 'idle-timeout') room.left.ws.close(1000, reason);
    } catch (e) {
      /* ignore */
    }
  }
  if (room.right && room.right.ws) {
    send(room.right.ws, { type: 'opponent-disconnected', reason: reason });
    try {
      if (reason === 'idle-timeout') room.right.ws.close(1000, reason);
    } catch (e) {
      /* ignore */
    }
  }
  destroyRoom(room.code, reason);
}

// ---------- Countdown ---------------------------------------------------------

function startCountdown(room) {
  // Hold ball still at center; tickRoom skips physics when phase isn't
  // 'playing' so this is enough to freeze the court.
  room.ball.x = COURT_W / 2;
  room.ball.y = COURT_H / 2;
  room.ball.vx = 0;
  room.ball.vy = 0;
  room.phase = 'countdown';
  if (room.countdownTimer) clearTimeout(room.countdownTimer);
  room.countdownTimer = setTimeout(function () {
    if (rooms.get(room.code) !== room) return;
    if (room.phase !== 'countdown') return;
    var serveTo = Math.random() < 0.5 ? 'left' : 'right';
    resetBall(room, serveTo);
    room.phase = 'playing';
  }, COUNTDOWN_MS);
  room.countdownTimer.unref();
}

// ---------- Physics -----------------------------------------------------------

function resetBall(room, serveTo) {
  // Place ball at center; serve toward `serveTo` ('left' or 'right').
  var dir = serveTo === 'left' ? -1 : 1;
  // Random launch angle in ±35°.
  var angle = ((Math.random() * 70) - 35) * Math.PI / 180;
  room.ball.x = COURT_W / 2;
  room.ball.y = COURT_H / 2;
  room.ball.vx = dir * BALL_SPEED_INIT * Math.cos(angle);
  room.ball.vy = BALL_SPEED_INIT * Math.sin(angle);
}

function clampVyVxRatio(ball) {
  if (Math.abs(ball.vx) < 1e-3) return; // nothing to clamp against
  var ratio = Math.abs(ball.vy / ball.vx);
  if (ratio > MAX_VY_VX_RATIO) {
    var sign = ball.vy >= 0 ? 1 : -1;
    ball.vy = sign * Math.abs(ball.vx) * MAX_VY_VX_RATIO;
  }
}

function speedOf(ball) {
  return Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
}

function tickRoom(room, dt) {
  if (room.phase !== 'playing') return;

  var now = Date.now();

  // Update each side's paddle position from intent.
  ['left', 'right'].forEach(function (key) {
    var side = room[key];
    if (!side) return;
    if (now - side.lastInputAt > INPUT_STALE_MS) side.intent = 0;
    side.y += side.intent * PADDLE_SPEED * dt;
    if (side.y < 0) side.y = 0;
    if (side.y > COURT_H - PADDLE_H) side.y = COURT_H - PADDLE_H;
  });

  // Move the ball.
  var ball = room.ball;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  // Top / bottom walls.
  if (ball.y - BALL_R < 0) {
    ball.y = BALL_R;
    ball.vy = Math.abs(ball.vy);
  } else if (ball.y + BALL_R > COURT_H) {
    ball.y = COURT_H - BALL_R;
    ball.vy = -Math.abs(ball.vy);
  }

  // Left paddle collision.
  var leftFace = PADDLE_MARGIN + PADDLE_W;
  if (
    ball.vx < 0 &&
    ball.x - BALL_R <= leftFace &&
    ball.x - BALL_R >= PADDLE_MARGIN - 4 &&
    ball.y >= room.left.y - BALL_R &&
    ball.y <= room.left.y + PADDLE_H + BALL_R
  ) {
    handlePaddleHit(ball, room.left, 1);
  }

  // Right paddle collision.
  var rightFace = COURT_W - PADDLE_MARGIN - PADDLE_W;
  if (
    room.right &&
    ball.vx > 0 &&
    ball.x + BALL_R >= rightFace &&
    ball.x + BALL_R <= COURT_W - PADDLE_MARGIN + 4 &&
    ball.y >= room.right.y - BALL_R &&
    ball.y <= room.right.y + PADDLE_H + BALL_R
  ) {
    handlePaddleHit(ball, room.right, -1);
  }

  // Goal detection.
  if (ball.x + BALL_R < 0) {
    onGoal(room, 'right');
  } else if (ball.x - BALL_R > COURT_W) {
    onGoal(room, 'left');
  }
}

function handlePaddleHit(ball, side, dirSign) {
  // Place ball at paddle face to avoid burying.
  if (dirSign === 1) {
    ball.x = PADDLE_MARGIN + PADDLE_W + BALL_R;
  } else {
    ball.x = COURT_W - PADDLE_MARGIN - PADDLE_W - BALL_R;
  }

  // Reflect X.
  ball.vx = dirSign * Math.abs(ball.vx);

  // Add Y based on hit-point along paddle (corners give steeper angle).
  var hitPos = ((ball.y - side.y) / PADDLE_H) - 0.5; // -0.5 .. +0.5
  var s = speedOf(ball);
  var nextSpeed = Math.min(BALL_SPEED_MAX, s * BALL_SPEED_GAIN);
  // 60° max influence.
  var influence = hitPos * 1.2;
  ball.vy = nextSpeed * influence;

  // Random ±5° angle perturbation to dodge predictable corner-stuck loops.
  var perturb = ((Math.random() * 10) - 5) * Math.PI / 180;
  var cur = Math.atan2(ball.vy, ball.vx) + perturb;
  ball.vx = Math.cos(cur) * nextSpeed;
  ball.vy = Math.sin(cur) * nextSpeed;

  clampVyVxRatio(ball);
}

function onGoal(room, scorer) {
  room[scorer].score += 1;

  // Win check.
  if (room[scorer].score >= WIN_SCORE) {
    room.phase = 'won';
    room.winner = scorer;
    stopRoomLoops(room);
    // Force one final snapshot so clients render the closing score.
    broadcastSnapshot(room);
    sendBoth(room, { type: 'phase', phase: 'won', winner: scorer, score: { l: room.left.score, r: room.right ? room.right.score : 0 } });
    log('info', 'room.won', { code: room.code, winner: scorer });
    return;
  }

  // Otherwise serve the next point. Briefly pause so clients can read the score.
  room.phase = 'serving';
  // Freeze the ball at center while paused.
  room.ball.x = COURT_W / 2;
  room.ball.y = COURT_H / 2;
  room.ball.vx = 0;
  room.ball.vy = 0;
  // Serve toward the loser (i.e. the side that didn't score) — classic Pong.
  var serveTo = scorer === 'left' ? 'right' : 'left';
  if (room.serveTimer) clearTimeout(room.serveTimer);
  room.serveTimer = setTimeout(function () {
    if (rooms.get(room.code) !== room) return;
    if (room.phase !== 'serving') return;
    resetBall(room, serveTo);
    room.phase = 'playing';
  }, SERVE_DELAY_MS);
  room.serveTimer.unref();
}

// ---------- Snapshot broadcast ------------------------------------------------

function broadcastSnapshot(room) {
  if (!room.left || !room.right) return;
  room.lastSnapshotSeq += 1;
  var snap = {
    type: 'state',
    seq: room.lastSnapshotSeq,
    t: Date.now(),
    ball: { x: room.ball.x, y: room.ball.y },
    paddles: { l: room.left.y, r: room.right.y },
    score: { l: room.left.score, r: room.right.score },
    phase: room.phase,
  };
  send(room.left.ws, snap);
  send(room.right.ws, snap);
}

function sendBoth(room, obj) {
  if (room.left && room.left.ws) send(room.left.ws, obj);
  if (room.right && room.right.ws) send(room.right.ws, obj);
}

// ---------- Message handlers --------------------------------------------------

function handleCreate(ws, ip) {
  if (!rateLimit(createBuckets, ip, CREATE_RATE_PER_MIN)) {
    send(ws, { type: 'error', reason: 'rate-limited', detail: 'create' });
    return;
  }
  if (codeByLeftSocket.has(ws) || codeByRightSocket.has(ws)) {
    send(ws, { type: 'error', reason: 'already-in-room' });
    return;
  }
  var room = createRoom(ws);
  if (!room) {
    send(ws, { type: 'error', reason: 'server-full' });
    try {
      ws.close(1013, 'server-full');
    } catch (e) {
      /* ignore */
    }
    return;
  }
  send(ws, { type: 'created', code: room.code, ttlMs: CODE_TTL_MS });
  log('info', 'room.created', { code: room.code, ip: ip });
}

function handleJoin(ws, data, ip) {
  if (!rateLimit(joinBuckets, ip, JOIN_RATE_PER_MIN)) {
    send(ws, { type: 'join-fail', reason: 'rate-limited' });
    return;
  }
  if (codeByLeftSocket.has(ws) || codeByRightSocket.has(ws)) {
    send(ws, { type: 'join-fail', reason: 'already-in-room' });
    return;
  }
  var code = typeof data.code === 'string' ? data.code : '';
  if (!/^\d{4}$/.test(code)) {
    send(ws, { type: 'join-fail', reason: 'bad-format' });
    return;
  }
  var room = rooms.get(code);
  if (!room) {
    send(ws, { type: 'join-fail', reason: 'unknown-code' });
    log('info', 'join.unknown', { code: code, ip: ip });
    return;
  }
  if (room.right) {
    send(ws, { type: 'join-fail', reason: 'already-paired' });
    return;
  }
  attachRight(room, ws);
}

function handleInput(ws, data) {
  var side = sideForSocket(ws);
  if (!side) {
    send(ws, { type: 'error', reason: 'not-in-room' });
    return;
  }
  var intent = Number(data && data.intent);
  // Clients can boost paddle speed by rapid-tapping (or via the mobile swipe
  // surface). Anything in [-4, 4] is fair game; the physics tick multiplies
  // by PADDLE_SPEED, so |intent|=2 is 2× speed, etc.
  if (!Number.isFinite(intent) || intent < -4 || intent > 4) {
    send(ws, { type: 'error', reason: 'bad-intent' });
    return;
  }
  side.side.intent = intent;
  side.side.lastInputAt = Date.now();
  resetIdleTimer(side.room);
}

function handleReady(ws) {
  var assoc = sideForSocket(ws);
  if (!assoc) return;
  var room = assoc.room;
  assoc.side.ready = true;
  // Both ready and in `won`? Reset and play another match.
  if (
    room.phase === 'won' &&
    room.left && room.left.ready &&
    room.right && room.right.ready
  ) {
    room.left.score = 0;
    room.right.score = 0;
    room.left.ready = false;
    room.right.ready = false;
    room.left.y = (COURT_H - PADDLE_H) / 2;
    room.right.y = (COURT_H - PADDLE_H) / 2;
    room.winner = null;
    // Tell clients to switch to the game screen, then run the same 3-2-1
    // countdown the initial pairing uses.
    sendBoth(room, { type: 'phase', phase: 'playing' });
    startCountdown(room);
    startRoomLoops(room);
    resetIdleTimer(room);
    log('info', 'room.rematch', { code: room.code });
  }
}

function handleLeave(ws) {
  var assoc = sideForSocket(ws);
  if (!assoc) return;
  var room = assoc.room;
  notifyAndDestroy(room, 'peer-left');
}

function handleRejoin(ws, data) {
  if (typeof data.code !== 'string' || typeof data.token !== 'string') {
    send(ws, { type: 'rejoin-fail', reason: 'bad-format' });
    return;
  }
  if (codeByLeftSocket.has(ws) || codeByRightSocket.has(ws)) {
    send(ws, { type: 'rejoin-fail', reason: 'already-in-room' });
    return;
  }
  var room = rooms.get(data.code);
  if (!room) {
    send(ws, { type: 'rejoin-fail', reason: 'unknown-code' });
    return;
  }
  var seatKey =
    room.leftToken  === data.token ? 'left'  :
    room.rightToken === data.token ? 'right' : null;
  if (!seatKey) {
    send(ws, { type: 'rejoin-fail', reason: 'bad-token' });
    return;
  }
  var seat = room[seatKey];
  if (seat.ws && seat.ws.readyState === 1) {
    // Old socket somehow still open — close it before re-binding.
    try { seat.ws.close(1000, 'replaced'); } catch (e) { /* ignore */ }
  }
  seat.ws = ws;
  seat.intent = 0;
  seat.lastInputAt = Date.now();
  if (seatKey === 'left') codeByLeftSocket.set(ws, room.code);
  else                    codeByRightSocket.set(ws, room.code);

  if (room.graceTimer) {
    clearTimeout(room.graceTimer);
    room.graceTimer = null;
  }
  room.pausedAt = null;

  // Resume from the paused phase. A mid-serve pause restarts with a fresh
  // serve so the ball isn't stuck at center with zero velocity.
  if (room.phase === 'paused') {
    var resumePhase = room.pausedFromPhase || 'playing';
    room.pausedFromPhase = null;
    if (resumePhase === 'serving') {
      resetBall(room, Math.random() < 0.5 ? 'left' : 'right');
    }
    room.phase = 'playing';
    sendBoth(room, { type: 'phase', phase: 'playing' });
  }

  send(ws, {
    type: 'rejoined',
    side: seatKey,
    score: { l: room.left.score, r: room.right ? room.right.score : 0 },
  });
  var peer = seatKey === 'left' ? room.right : room.left;
  if (peer && peer.ws) send(peer.ws, { type: 'peer-resumed', side: seatKey });
  resetIdleTimer(room);
  log('info', 'room.rejoined', { code: room.code, side: seatKey });
}

function handlePing(ws, data) {
  send(ws, { type: 'pong', t: data && data.t });
  var assoc = sideForSocket(ws);
  if (assoc) resetIdleTimer(assoc.room);
}

function sideForSocket(ws) {
  var leftCode = codeByLeftSocket.get(ws);
  if (leftCode) {
    var lroom = rooms.get(leftCode);
    if (lroom) return { room: lroom, side: lroom.left, key: 'left' };
  }
  var rightCode = codeByRightSocket.get(ws);
  if (rightCode) {
    var rroom = rooms.get(rightCode);
    if (rroom && rroom.right) return { room: rroom, side: rroom.right, key: 'right' };
  }
  return null;
}

// ---------- WebSocket server --------------------------------------------------

var wss = new WebSocketServer({
  noServer: true,
  maxPayload: MSG_MAX_BYTES,
});

wss.on('connection', function (ws, req) {
  var ip = ipOf(req);
  ws.isAlive = true;
  ws.on('pong', function () {
    ws.isAlive = true;
  });

  ws.on('message', function (raw) {
    if (raw && raw.length > MSG_MAX_BYTES) {
      send(ws, { type: 'error', reason: 'payload-too-large' });
      return;
    }
    var data;
    try {
      data = JSON.parse(String(raw));
    } catch (e) {
      send(ws, { type: 'error', reason: 'bad-json' });
      return;
    }
    if (!data || typeof data.type !== 'string') {
      send(ws, { type: 'error', reason: 'bad-format' });
      return;
    }
    switch (data.type) {
      case 'create':
        handleCreate(ws, ip);
        break;
      case 'join':
        handleJoin(ws, data, ip);
        break;
      case 'rejoin':
        handleRejoin(ws, data);
        break;
      case 'input':
        handleInput(ws, data);
        break;
      case 'ready':
        handleReady(ws);
        break;
      case 'leave':
        handleLeave(ws);
        break;
      case 'ping':
        handlePing(ws, data);
        break;
      default:
        send(ws, { type: 'error', reason: 'unknown-type', detail: data.type });
    }
  });

  ws.on('close', function (closeCode, reason) {
    var reasonStr = '';
    if (reason) {
      try { reasonStr = Buffer.isBuffer(reason) ? reason.toString('utf8') : String(reason); }
      catch (e) { reasonStr = ''; }
    }
    onSocketClosed(ws, closeCode, reasonStr);
  });

  ws.on('error', function (err) {
    log('warn', 'ws.error', { ip: ip, message: err && err.message });
  });
});

function onSocketClosed(ws, code, reason) {
  // Locate the seat by walking both index maps. We can't use sideForSocket
  // here because the room may still have the closed socket bound to the
  // seat (we haven't unhooked it yet).
  var leftCode = codeByLeftSocket.get(ws);
  var rightCode = codeByRightSocket.get(ws);
  var seatKey = leftCode ? 'left' : (rightCode ? 'right' : null);
  if (!seatKey) return;
  var roomCode = leftCode || rightCode;
  var room = rooms.get(roomCode);

  if (seatKey === 'left') codeByLeftSocket.delete(ws);
  else                    codeByRightSocket.delete(ws);

  if (!room) {
    log('info', seatKey + '.closed', { code: roomCode, wsCode: code, wsReason: reason });
    return;
  }

  log('info', seatKey + '.closed', {
    code: room.code,
    wsCode: code,
    wsReason: reason,
    phase: room.phase,
    elapsedMs: Date.now() - (room.pairedAt || room.createdAt),
  });

  // Unpaired room (left disconnects before anyone joined): nothing to
  // preserve — fall back to the old destroy behavior.
  if (!room.right) {
    destroyRoom(room.code, 'left-closed-pre-pair');
    return;
  }

  // Detach the dead socket from the seat but keep the seat reserved.
  var seat = room[seatKey];
  seat.ws = null;
  seat.intent = 0;

  var peer = seatKey === 'left' ? room.right : room.left;

  // If a grace window is already running (shouldn't normally happen, but
  // could after a server-replaced socket), don't restart it.
  if (room.graceTimer) return;

  if (peer && peer.ws) {
    send(peer.ws, { type: 'peer-paused', side: seatKey, graceMs: GRACE_MS });
  }

  // Freeze the ball during the grace window so the surviving client
  // doesn't watch it run away through the empty seat. Carry the original
  // phase through `pausedFromPhase` so a mid-serve disconnect resumes with
  // a fresh serve instead of an unresponsive frozen-at-center ball.
  if (room.phase === 'playing' || room.phase === 'serving') {
    if (room.serveTimer) {
      clearTimeout(room.serveTimer);
      room.serveTimer = null;
    }
    room.pausedFromPhase = room.phase;
    room.phase = 'paused';
    sendBoth(room, { type: 'phase', phase: 'paused' });
  }
  room.pausedAt = Date.now();

  room.graceTimer = setTimeout(function () {
    if (rooms.get(room.code) !== room) return;
    if (room[seatKey].ws) return; // peer made it back in time
    log('info', 'room.grace-expired', { code: room.code, side: seatKey });
    notifyAndDestroy(room, 'peer-closed');
  }, GRACE_MS);
  room.graceTimer.unref();
}

// Keepalive: ping every peer; drop anything that misses a pong.
var keepaliveTimer = setInterval(function () {
  wss.clients.forEach(function (ws) {
    if (ws.isAlive === false) {
      try {
        ws.terminate();
      } catch (e) {
        /* ignore */
      }
      return;
    }
    ws.isAlive = false;
    try {
      ws.ping();
    } catch (e) {
      /* ignore */
    }
  });
}, KEEPALIVE_MS);
keepaliveTimer.unref();

// ---------- Static file server ------------------------------------------------

function safeJoin(root, reqPath) {
  var clean = decodeURIComponent(reqPath.split('?')[0]);
  if (clean === '/' || clean === '') clean = '/index.html';
  var resolved = path.normalize(path.join(root, clean));
  if (resolved.indexOf(root) !== 0) return null;
  return resolved;
}

function serveStatic(req, res) {
  var filePath = safeJoin(STATIC_DIR, req.url);
  if (!filePath) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  fs.stat(filePath, function (err, stat) {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
      return;
    }
    var ext = path.extname(filePath).toLowerCase();
    var type = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': type,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

// ---------- HTTP server + upgrade handshake -----------------------------------

var server = http.createServer(function (req, res) {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, rooms: rooms.size }));
    return;
  }
  serveStatic(req, res);
});

server.on('upgrade', function (req, socket, head) {
  var url = req.url || '';
  if (url !== '/ws' && url.indexOf('/ws?') !== 0) {
    socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, function (ws) {
    wss.emit('connection', ws, req);
  });
});

function lanIPv4s() {
  // Non-internal IPv4 addresses — what other machines on the LAN can reach.
  var out = [];
  var ifaces = os.networkInterfaces();
  Object.keys(ifaces).forEach(function (name) {
    (ifaces[name] || []).forEach(function (info) {
      if (info && info.family === 'IPv4' && !info.internal) {
        out.push(info.address);
      }
    });
  });
  return out;
}

server.listen(PORT, HOST, function () {
  var lanAddrs = lanIPv4s();
  var hostName = (function () {
    try { return os.hostname(); } catch (e) { return null; }
  })();
  log('info', 'server.listen', {
    host: HOST,
    port: PORT,
    codeTtlMs: CODE_TTL_MS,
    keepaliveMs: KEEPALIVE_MS,
    tickHz: TICK_HZ,
    snapshotHz: SNAPSHOT_HZ,
    winScore: WIN_SCORE,
    lan: lanAddrs,
  });
  var lines = [
    '',
    'pong running:',
    '  HTTP    http://localhost:' + PORT + '/',
    '  WS      ws://localhost:' + PORT + '/ws',
    '  Health  http://localhost:' + PORT + '/health',
  ];
  if (lanAddrs.length || hostName) {
    lines.push('');
    lines.push('Share with another computer on the same Wi-Fi:');
    lanAddrs.forEach(function (addr) {
      lines.push('  http://' + addr + ':' + PORT + '/');
    });
    // Only print Bonjour if the hostname looks like a real name — on some macs
    // os.hostname() returns a MAC-address-shaped string (e.g. A6:C9:…), which
    // does not resolve and would just confuse the user.
    if (hostName && /^[A-Za-z][A-Za-z0-9-]{1,62}$/.test(hostName.split('.')[0])) {
      var dotted = /\.local$/i.test(hostName) ? hostName : hostName + '.local';
      lines.push('  http://' + dotted + ':' + PORT + '/  (Bonjour)');
    }
  }
  lines.push('');
  console.log(lines.join('\n'));
});

// Don't let a single thrown error take down the entire game server. The
// demo has no DB, no persistence — a process crash kicks every active
// room. We'd rather log and keep serving the rest of the matches than
// be strictly idiomatic about "fail fast" here.
process.on('uncaughtException', function (err) {
  log('error', 'uncaughtException', {
    message: err && err.message,
    stack: err && err.stack,
  });
});
process.on('unhandledRejection', function (reason) {
  log('error', 'unhandledRejection', {
    reason: reason && (reason.stack || String(reason)),
  });
});

// Graceful shutdown.
function shutdown() {
  log('info', 'server.shutdown', {});
  clearInterval(keepaliveTimer);
  rooms.forEach(function (room, code) {
    stopRoomLoops(room);
    if (room.idleTimer) clearTimeout(room.idleTimer);
    if (room.codeExpireTimer) clearTimeout(room.codeExpireTimer);
    rooms.delete(code);
  });
  wss.clients.forEach(function (ws) {
    try {
      ws.close(1001, 'server-shutdown');
    } catch (e) {
      /* ignore */
    }
  });
  server.close(function () {
    process.exit(0);
  });
  setTimeout(function () {
    process.exit(0);
  }, 3000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
