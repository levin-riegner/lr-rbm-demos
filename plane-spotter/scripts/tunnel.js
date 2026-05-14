#!/usr/bin/env node

var spawn = require('child_process').spawn;
var path = require('path');
var fs = require('fs');

var ROOT = path.resolve(__dirname, '..');
var REPO_ROOT = path.resolve(ROOT, '..', '..');
var QR_GENERATOR = path.join(REPO_ROOT, '.claude', 'skills', 'qr-code', 'scripts', 'qr_generator.py');
var PORT = process.env.PORT || '3000';

var children = [];

function shutdown(code) {
  children.forEach(function (c) { try { c.kill('SIGTERM'); } catch (e) {} });
  process.exit(code || 0);
}
process.on('SIGINT', function () { shutdown(0); });
process.on('SIGTERM', function () { shutdown(0); });

console.log('[plane-spotter] Starting Node server on :' + PORT + '...');
var server = spawn('node', ['server.js'], {
  cwd: ROOT,
  stdio: ['ignore', 'inherit', 'inherit'],
  env: Object.assign({}, process.env, { PORT: PORT }),
});
children.push(server);
server.on('exit', function (code) {
  console.error('[plane-spotter] server exited with code ' + code);
  shutdown(code || 0);
});

setTimeout(startTunnel, 800);

function startTunnel() {
  console.log('[plane-spotter] Starting Cloudflare quick tunnel...');
  var tunnel = spawn('cloudflared', ['tunnel', '--url', 'http://localhost:' + PORT], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.push(tunnel);

  var urlSeen = false;
  function inspect(buf) {
    var s = buf.toString();
    process.stderr.write(s);
    if (urlSeen) return;
    var m = s.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (!m) return;
    urlSeen = true;
    onTunnelUp(m[0]);
  }
  tunnel.stdout.on('data', inspect);
  tunnel.stderr.on('data', inspect);
  tunnel.on('exit', function (code) {
    console.error('[plane-spotter] cloudflared exited with code ' + code);
    shutdown(code || 0);
  });
}

function onTunnelUp(url) {
  var qrPath = path.join(ROOT, 'qr-tunnel.png');

  console.log('\n=========================================================');
  console.log('  Open on phone : ' + url);
  console.log('=========================================================');

  fs.writeFileSync(path.join(ROOT, '.tunnel-url'), url + '\n');

  if (!fs.existsSync(QR_GENERATOR)) {
    console.log('[plane-spotter] qr generator not found at ' + QR_GENERATOR + ' (skipping QR)');
    return;
  }
  var py = spawn('python3', [QR_GENERATOR, '--png', qrPath, url], { stdio: 'inherit' });
  py.on('exit', function (code) {
    if (code === 0) {
      console.log('[plane-spotter] QR saved to ' + qrPath + ' (scan with phone camera to open in Safari/Chrome)');
    } else {
      console.log('[plane-spotter] qr_generator exited with code ' + code);
    }
  });
}
