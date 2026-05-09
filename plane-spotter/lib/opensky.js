var https = require('https');

var OPENSKY_URL = 'https://opensky-network.org/api/states/all';
var OPENSKY_TOKEN_HOST = 'auth.opensky-network.org';
var OPENSKY_TOKEN_PATH = '/auth/realms/opensky-network/protocol/openid-connect/token';
var CACHE_TTL_MS = 10000;
var REQUEST_TIMEOUT_MS = 8000;
var AUTH_TIMEOUT_MS = 15000;
var cache = new Map();
var tokenCache = { token: null, expiresAt: 0 };

function getAccessToken(cb) {
  var clientId = process.env.OPENSKY_CLIENT_ID;
  var clientSecret = process.env.OPENSKY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    cb(null, null);
    return;
  }
  if (tokenCache.token && Date.now() < tokenCache.expiresAt - 30000) {
    cb(null, tokenCache.token);
    return;
  }
  var body = 'grant_type=client_credentials'
    + '&client_id=' + encodeURIComponent(clientId)
    + '&client_secret=' + encodeURIComponent(clientSecret);
  var url = 'https://' + OPENSKY_TOKEN_HOST + OPENSKY_TOKEN_PATH;
  var ctrl = new AbortController();
  var killTimer = setTimeout(function () { ctrl.abort(); }, AUTH_TIMEOUT_MS);
  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: body,
    signal: ctrl.signal,
  }).then(function (res) {
    clearTimeout(killTimer);
    if (!res.ok) {
      cb(new Error('OpenSky auth HTTP ' + res.status));
      return;
    }
    return res.json().then(function (parsed) {
      tokenCache.token = parsed.access_token;
      tokenCache.expiresAt = Date.now() + ((parsed.expires_in || 1800) * 1000);
      cb(null, tokenCache.token);
    });
  }).catch(function (err) {
    clearTimeout(killTimer);
    var detail = err && err.message;
    if (err && err.cause) detail += ' / cause=' + (err.cause.code || err.cause.message || String(err.cause));
    cb(new Error(err && err.name === 'AbortError' ? 'OpenSky auth timeout' : ('OpenSky auth: ' + detail)));
  });
}

function bboxFromRadius(lat, lon, radiusKm) {
  var dLat = radiusKm / 111;
  var cosLat = Math.cos(lat * Math.PI / 180);
  var dLon = radiusKm / (111 * Math.max(0.0001, Math.abs(cosLat)));
  return [lat - dLat, lon - dLon, lat + dLat, lon + dLon];
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  var R = 6371000;
  var p1 = lat1 * Math.PI / 180;
  var p2 = lat2 * Math.PI / 180;
  var dp = (lat2 - lat1) * Math.PI / 180;
  var dl = (lon2 - lon1) * Math.PI / 180;
  var a = Math.sin(dp / 2) * Math.sin(dp / 2)
        + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function bearingDeg(lat1, lon1, lat2, lon2) {
  var p1 = lat1 * Math.PI / 180;
  var p2 = lat2 * Math.PI / 180;
  var dl = (lon2 - lon1) * Math.PI / 180;
  var y = Math.sin(dl) * Math.cos(p2);
  var x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  var b = Math.atan2(y, x) * 180 / Math.PI;
  return (b + 360) % 360;
}

function fetchOpenSky(bbox, cb) {
  var key = bbox.map(function (v) { return v.toFixed(2); }).join(',');
  var entry = cache.get(key);
  if (entry && Date.now() - entry.time < CACHE_TTL_MS) {
    cb(null, entry.data, true);
    return;
  }

  getAccessToken(function (authErr, token) {
    if (authErr) {
      cb(authErr);
      return;
    }
    var u = OPENSKY_URL
      + '?lamin=' + bbox[0]
      + '&lomin=' + bbox[1]
      + '&lamax=' + bbox[2]
      + '&lomax=' + bbox[3];
    var headers = { 'User-Agent': 'mrbd-plane-spotter/1.0' };
    if (token) headers['Authorization'] = 'Bearer ' + token;

    var req = https.get(u, { headers: headers, family: 4 }, function (res) {
      if (res.statusCode !== 200) {
        cb(new Error('OpenSky HTTP ' + res.statusCode));
        res.resume();
        return;
      }
      var chunks = [];
      res.on('data', function (c) { chunks.push(c); });
      res.on('end', function () {
        try {
          var parsed = JSON.parse(Buffer.concat(chunks).toString());
          cache.set(key, { time: Date.now(), data: parsed });
          cb(null, parsed, false);
        } catch (e) {
          cb(e);
        }
      });
    });
    req.setTimeout(REQUEST_TIMEOUT_MS, function () { req.destroy(new Error('OpenSky timeout')); });
    req.on('error', function (e) { cb(e); });
  });
}

function demoAircraft(userLat, userLon) {
  var t = Date.now() / 1000;
  var radiusKm = 4;
  var angle = (t / 30) * 2 * Math.PI;
  var dLat = (radiusKm / 111) * Math.sin(angle);
  var cosLat = Math.cos(userLat * Math.PI / 180);
  var dLon = (radiusKm / (111 * Math.max(0.0001, Math.abs(cosLat)))) * Math.cos(angle);
  return [{
    icao24: 'demo01',
    callsign: 'DEMO123',
    lat: userLat + dLat,
    lon: userLon + dLon,
    altitude: 3000 + 500 * Math.sin(t / 20),
    velocity: 220,
    heading: ((angle * 180 / Math.PI) + 90 + 360) % 360,
    onGround: false,
  }];
}

function enrich(aircraft, lat, lon) {
  return aircraft.map(function (a) {
    var d = haversineMeters(lat, lon, a.lat, a.lon);
    var b = bearingDeg(lat, lon, a.lat, a.lon);
    var alt = a.altitude || 0;
    var elev = Math.atan2(alt, Math.max(d, 1)) * 180 / Math.PI;
    return {
      icao24: a.icao24,
      callsign: a.callsign,
      lat: a.lat,
      lon: a.lon,
      altitude: alt,
      velocity: a.velocity,
      heading: a.heading,
      distance: d,
      bearing: b,
      elevation: elev,
    };
  }).sort(function (x, y) { return x.distance - y.distance; });
}

function getAircraft(opts, cb) {
  var lat = opts.lat;
  var lon = opts.lon;
  var radius = opts.radius || 50;
  var demo = !!opts.demo;

  if (demo) {
    cb(null, { source: 'demo', aircraft: enrich(demoAircraft(lat, lon), lat, lon) });
    return;
  }

  var bbox = bboxFromRadius(lat, lon, radius);
  fetchOpenSky(bbox, function (err, data, cached) {
    if (err) {
      cb(null, { source: 'demo-fallback', aircraft: enrich(demoAircraft(lat, lon), lat, lon), error: err.message });
      return;
    }
    var states = (data && data.states) || [];
    var aircraft = states
      .filter(function (s) { return s[5] != null && s[6] != null && !s[8]; })
      .map(function (s) {
        return {
          icao24: s[0],
          callsign: (s[1] || '').trim(),
          lat: s[6],
          lon: s[5],
          altitude: s[13] != null ? s[13] : (s[7] || 0),
          velocity: s[9] || 0,
          heading: s[10] || 0,
          onGround: s[8],
        };
      });
    cb(null, { source: cached ? 'opensky-cache' : 'opensky', aircraft: enrich(aircraft, lat, lon) });
  });
}

module.exports = { getAircraft: getAircraft };
