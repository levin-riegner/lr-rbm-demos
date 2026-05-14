var http = require('http');
var fs = require('fs');
var path = require('path');
var url = require('url');

(function loadDotEnv() {
  try {
    var raw = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
    raw.split(/\r?\n/).forEach(function (line) {
      var m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (!m) return;
      var v = m[2].replace(/^['"]|['"]$/g, '');
      if (process.env[m[1]] === undefined) process.env[m[1]] = v;
    });
  } catch (e) {}
})();

var opensky = require('./lib/opensky');

var PORT = process.env.PORT || 3000;

var mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

function handleApi(req, res, parsed) {
  var q = parsed.query;
  var lat = parseFloat(q.lat);
  var lon = parseFloat(q.lon);
  var radius = parseFloat(q.radius || '50');
  var demo = q.demo === '1';

  if (!isFinite(lat) || !isFinite(lon)) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'lat and lon required' }));
    return;
  }

  opensky.getAircraft({ lat: lat, lon: lon, radius: radius, demo: demo }, function (err, result) {
    if (err) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({
      source: result.source,
      count: result.aircraft.length,
      aircraft: result.aircraft.slice(0, 20),
    }));
  });
}

var server = http.createServer(function (req, res) {
  var parsed = url.parse(req.url, true);

  if (parsed.pathname === '/api/aircraft') {
    handleApi(req, res, parsed);
    return;
  }

  var rel = parsed.pathname === '/' ? '/index.html' : parsed.pathname;
  if (rel.indexOf('..') !== -1) {
    res.writeHead(400);
    res.end('Bad request');
    return;
  }
  var filePath = path.join(__dirname, rel);
  var ext = path.extname(filePath);
  var contentType = mimeTypes[ext] || 'application/octet-stream';

  fs.readFile(filePath, function (err, content) {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end('<h1>404 Not Found</h1>');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
});

server.listen(PORT, function () {
  console.log('Plane spotter at http://localhost:' + PORT);
});
