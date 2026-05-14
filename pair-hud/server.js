// Copyright (c) Meta Platforms, Inc. and affiliates.
// All rights reserved.
//
// This source code is licensed under the license found in the
// LICENSE file in the root directory of this source tree.

/*
 * pair-hud — WebSocket PIN-pairing server.
 *
 * One HTTP server serves the static webapp AND accepts WebSocket upgrades
 * at /ws. Two client roles connect:
 *
 *   - "glasses": the Meta Display Glasses webapp. Sends `register`; gets a
 *     4-digit PIN back. Receives `paired` + `message` events.
 *   - "mobile":  the phone browser. Sends `join` with the PIN; on success
 *     gets `join-ok`, then may `push` payloads that the server forwards
 *     to the paired glasses as `message`.
 *
 * State lives in memory. No DB, no persistence, no auth beyond the PIN.
 * Physical co-presence (you must see the HUD to read the PIN) is the
 * authentication. See README.md for the full protocol + research notes.
 */

'use strict';

var http = require('http');
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var WebSocketServer = require('ws').WebSocketServer;

// ---------- Constants ---------------------------------------------------------

var PORT = parseInt(process.env.PORT, 10) || 3000;
var HOST = process.env.HOST || '0.0.0.0';

var PIN_TTL_MS = 5 * 60 * 1000;               // 5 min before an unpaired PIN expires.
var KEEPALIVE_MS = 30 * 1000;                 // WS ping cadence (defeats ngrok ~60s idle).
var MSG_MAX_BYTES = 4 * 1024;                 // Hard cap on any incoming WS frame.
var PUSH_PAYLOAD_MAX_CHARS = 200;             // Soft cap on user-visible HUD text.
var JOIN_RATE_PER_MIN = 10;                   // Per-IP PIN-guess budget.
var REGISTER_RATE_PER_MIN = 20;               // Per-IP PIN-allocation budget.
var PIN_ALLOC_MAX_RETRIES = 20;               // Collision retries before server-full.
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

/** @type {Map<string, Room>} pin -> room */
var rooms = new Map();
/** @type {WeakMap<WebSocket, string>} socket -> pin */
var pinByGlassesSocket = new WeakMap();
/** @type {WeakMap<WebSocket, string>} socket -> pin */
var pinByMobileSocket = new WeakMap();
/** @type {Map<string, {count:number, resetAt:number}>} ip -> bucket (join) */
var joinBuckets = new Map();
/** @type {Map<string, {count:number, resetAt:number}>} ip -> bucket (register) */
var registerBuckets = new Map();

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

// Periodically sweep stale rate-limit buckets.
setInterval(function () {
  var now = Date.now();
  [joinBuckets, registerBuckets].forEach(function (m) {
    m.forEach(function (v, k) {
      if (v.resetAt < now) m.delete(k);
    });
  });
}, 60 * 1000).unref();

// ---------- PIN generation ----------------------------------------------------

function makePin() {
  for (var i = 0; i < PIN_ALLOC_MAX_RETRIES; i++) {
    var n = crypto.randomInt(0, 10000);
    var pin = String(n).padStart(4, '0');
    if (!rooms.has(pin)) return pin;
  }
  return null;
}

// ---------- Room lifecycle ----------------------------------------------------

/**
 * @typedef {Object} Room
 * @property {string} pin
 * @property {WebSocket} glasses
 * @property {WebSocket|null} mobile
 * @property {number} createdAt
 * @property {number|null} pairedAt
 * @property {NodeJS.Timeout|null} expireTimer
 */

function createRoom(glassesSocket) {
  var pin = makePin();
  if (!pin) return null;

  var room = {
    pin: pin,
    glasses: glassesSocket,
    mobile: null,
    createdAt: Date.now(),
    pairedAt: null,
    expireTimer: null,
  };
  room.expireTimer = setTimeout(function () {
    onPinExpired(pin);
  }, PIN_TTL_MS);

  rooms.set(pin, room);
  pinByGlassesSocket.set(glassesSocket, pin);
  return room;
}

function destroyRoom(pin, reason) {
  var room = rooms.get(pin);
  if (!room) return;
  if (room.expireTimer) clearTimeout(room.expireTimer);
  rooms.delete(pin);
  log('info', 'room.destroyed', { pin: pin, reason: reason });
}

function onPinExpired(pin) {
  var room = rooms.get(pin);
  if (!room || room.pairedAt) return; // Paired before expiry — let it live.
  send(room.glasses, { type: 'pin-expired' });
  // Reissue a new PIN so the glasses are never left without one.
  reissueForGlasses(room.glasses, 'pin-expired');
}

function reissueForGlasses(glassesSocket, reason) {
  var oldPin = pinByGlassesSocket.get(glassesSocket);
  if (oldPin) destroyRoom(oldPin, reason);
  var newRoom = createRoom(glassesSocket);
  if (!newRoom) {
    send(glassesSocket, { type: 'error', reason: 'server-full' });
    try {
      glassesSocket.close(1013, 'server-full');
    } catch (e) {
      /* ignore */
    }
    return;
  }
  send(glassesSocket, {
    type: 'registered',
    pin: newRoom.pin,
    pinTtlMs: PIN_TTL_MS,
  });
  log('info', 'pin.reissued', { pin: newRoom.pin, reason: reason });
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
    // Socket likely half-closed; swallow. onclose will clean up.
  }
}

function ipOf(req) {
  // Trust x-forwarded-for when present (ngrok, render, fly).
  var fwd = req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : 'unknown';
}

// ---------- Message handlers --------------------------------------------------

function handleRegister(ws, data, ip) {
  if (!rateLimit(registerBuckets, ip, REGISTER_RATE_PER_MIN)) {
    send(ws, { type: 'error', reason: 'rate-limited', detail: 'register' });
    return;
  }
  if (pinByGlassesSocket.has(ws) || pinByMobileSocket.has(ws)) {
    send(ws, { type: 'error', reason: 'already-registered' });
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
  send(ws, { type: 'registered', pin: room.pin, pinTtlMs: PIN_TTL_MS });
  log('info', 'glasses.registered', { pin: room.pin, ip: ip });
}

function handleJoin(ws, data, ip) {
  if (!rateLimit(joinBuckets, ip, JOIN_RATE_PER_MIN)) {
    send(ws, { type: 'join-fail', reason: 'rate-limited' });
    return;
  }
  var pin = typeof data.pin === 'string' ? data.pin : '';
  if (!/^\d{4}$/.test(pin)) {
    send(ws, { type: 'join-fail', reason: 'bad-format' });
    return;
  }
  var room = rooms.get(pin);
  if (!room) {
    send(ws, { type: 'join-fail', reason: 'unknown-pin' });
    log('info', 'mobile.join.unknown', { pin: pin, ip: ip });
    return;
  }
  if (room.mobile) {
    send(ws, { type: 'join-fail', reason: 'already-paired' });
    return;
  }
  // Pair.
  if (room.expireTimer) {
    clearTimeout(room.expireTimer);
    room.expireTimer = null;
  }
  room.mobile = ws;
  room.pairedAt = Date.now();
  pinByMobileSocket.set(ws, pin);

  send(ws, { type: 'join-ok' });
  send(room.glasses, { type: 'paired' });
  log('info', 'pair.ok', { pin: pin, ip: ip });
}

function handlePush(ws, data) {
  var pin = pinByMobileSocket.get(ws);
  if (!pin) {
    send(ws, { type: 'error', reason: 'not-paired' });
    return;
  }
  var room = rooms.get(pin);
  if (!room || !room.glasses) {
    send(ws, { type: 'error', reason: 'peer-gone' });
    return;
  }
  var raw = data && data.payload != null ? data.payload : '';
  var payload = String(raw).replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  if (payload.length > PUSH_PAYLOAD_MAX_CHARS) {
    payload = payload.slice(0, PUSH_PAYLOAD_MAX_CHARS);
  }
  if (!payload) {
    send(ws, { type: 'error', reason: 'empty-payload' });
    return;
  }
  send(room.glasses, { type: 'message', payload: payload });
  log('info', 'push', { pin: pin, bytes: payload.length });
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
      case 'register':
        handleRegister(ws, data, ip);
        break;
      case 'join':
        handleJoin(ws, data, ip);
        break;
      case 'push':
        handlePush(ws, data);
        break;
      default:
        send(ws, { type: 'error', reason: 'unknown-type', detail: data.type });
    }
  });

  ws.on('close', function (code, reason) {
    onSocketClosed(ws, code, reason && reason.toString ? reason.toString() : '');
  });

  ws.on('error', function (err) {
    log('warn', 'ws.error', { ip: ip, message: err && err.message });
  });
});

function onSocketClosed(ws, code, reasonStr) {
  // Mobile disconnect? Notify glasses and reissue a new PIN.
  var mobilePin = pinByMobileSocket.get(ws);
  if (mobilePin) {
    pinByMobileSocket.delete(ws);
    var room = rooms.get(mobilePin);
    if (room) {
      var glasses = room.glasses;
      // Destroy the old room first so reissue can allocate a fresh PIN.
      destroyRoom(mobilePin, 'mobile-closed');
      if (glasses) {
        send(glasses, { type: 'peer-disconnected', reason: 'mobile-closed' });
        reissueForGlasses(glasses, 'mobile-closed');
      }
      log('info', 'mobile.closed', { pin: mobilePin, code: code });
    }
    return;
  }

  // Glasses disconnect? Tear down the room + notify the mobile peer.
  var glassesPin = pinByGlassesSocket.get(ws);
  if (glassesPin) {
    pinByGlassesSocket.delete(ws);
    var r = rooms.get(glassesPin);
    if (r) {
      if (r.mobile) {
        send(r.mobile, { type: 'peer-disconnected', reason: 'glasses-closed' });
        try {
          r.mobile.close(1000, 'glasses-closed');
        } catch (e) {
          /* ignore */
        }
      }
      destroyRoom(glassesPin, 'glasses-closed');
    }
    log('info', 'glasses.closed', { pin: glassesPin, code: code });
  }
}

// Keepalive: ping every peer on an interval, drop anything that misses a pong.
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
  // Strip query, normalize, reject traversal.
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

server.listen(PORT, HOST, function () {
  log('info', 'server.listen', {
    host: HOST,
    port: PORT,
    pinTtlMs: PIN_TTL_MS,
    keepaliveMs: KEEPALIVE_MS,
  });
  console.log(
    '\npair-hud running:\n' +
      '  HTTP   http://localhost:' +
      PORT +
      '/\n' +
      '  WS     ws://localhost:' +
      PORT +
      '/ws\n' +
      '  Mobile http://localhost:' +
      PORT +
      '/mobile.html\n' +
      '  Health http://localhost:' +
      PORT +
      '/health\n'
  );
});

// Graceful shutdown.
function shutdown() {
  log('info', 'server.shutdown', {});
  clearInterval(keepaliveTimer);
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
