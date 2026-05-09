var opensky = require('../lib/opensky');

module.exports = function handler(req, res) {
  var q = req.query || {};
  var lat = parseFloat(q.lat);
  var lon = parseFloat(q.lon);
  var radius = parseFloat(q.radius || '50');
  var demo = q.demo === '1';

  if (!isFinite(lat) || !isFinite(lon)) {
    res.status(400).json({ error: 'lat and lon required' });
    return;
  }

  opensky.getAircraft({ lat: lat, lon: lon, radius: radius, demo: demo }, function (err, result) {
    if (err) {
      res.status(502).json({ error: err.message });
      return;
    }
    if (result.error) console.error('opensky:', result.error);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      source: result.source,
      count: result.aircraft.length,
      aircraft: result.aircraft.slice(0, 20),
      error: result.error,
    });
  });
};
