(function () {
  'use strict';

  var GAMMA_THRESHOLD = 15;
  var GAMMA_RELEASE = 8;
  var WINDOW_MS = 1000;
  var REQUIRED_PATTERN = ['L', 'R', 'L'];

  var notificationEl = document.getElementById('notification');
  var dismissedEl = document.getElementById('dismissed-state');
  var resetBtn = document.getElementById('reset-btn');
  var permissionBtn = document.getElementById('permission-btn');
  var gammaValueEl = document.getElementById('gamma-value');
  var alphaValueEl = document.getElementById('alpha-value');
  var betaValueEl = document.getElementById('beta-value');
  var crossingsValueEl = document.getElementById('crossings-value');
  var statusEl = document.getElementById('status-value');

  var crossings = [];
  var currentZone = 'C';
  var dismissed = false;

  function setStatus(text) {
    statusEl.textContent = text;
  }

  function flashDebug() {
    var panel = document.querySelector('.debug-panel');
    panel.classList.remove('flash');
    void panel.offsetWidth;
    panel.classList.add('flash');
  }

  function renderCrossings() {
    var labels = crossings.map(function (c) { return c.dir; });
    crossingsValueEl.textContent = '[' + labels.join(' ') + ']';
  }

  function classifyZone(gamma) {
    if (gamma > GAMMA_THRESHOLD) return 'R';
    if (gamma < -GAMMA_THRESHOLD) return 'L';
    if (gamma > -GAMMA_RELEASE && gamma < GAMMA_RELEASE) return 'C';
    return currentZone;
  }

  function pushCrossing(dir, now) {
    if (crossings.length > 0 && crossings[crossings.length - 1].dir === dir) return;
    crossings.push({ dir: dir, t: now });
    crossings = crossings.filter(function (c) { return now - c.t <= WINDOW_MS; });
    renderCrossings();
    checkPattern(now);
  }

  function checkPattern(now) {
    if (crossings.length < REQUIRED_PATTERN.length) return;
    var tail = crossings.slice(-REQUIRED_PATTERN.length);
    var span = tail[tail.length - 1].t - tail[0].t;
    if (span > WINDOW_MS) return;
    for (var i = 0; i < REQUIRED_PATTERN.length; i++) {
      if (tail[i].dir !== REQUIRED_PATTERN[i]) return;
    }
    onShakeDetected();
  }

  function onShakeDetected() {
    if (dismissed) return;
    dismissed = true;
    setStatus('shake detected');
    flashDebug();
    notificationEl.classList.add('dismissing');
    setTimeout(function () {
      notificationEl.classList.add('hidden');
      dismissedEl.classList.remove('hidden');
      resetBtn.focus();
    }, 320);
    crossings = [];
    renderCrossings();
  }

  function onOrientation(e) {
    var gamma = e.gamma;
    var alpha = e.alpha;
    var beta = e.beta;

    if (gamma === null || gamma === undefined) {
      setStatus('no gamma data');
      return;
    }

    gammaValueEl.textContent = gamma.toFixed(1);
    alphaValueEl.textContent = (alpha === null || alpha === undefined) ? '--' : alpha.toFixed(1);
    betaValueEl.textContent = (beta === null || beta === undefined) ? '--' : beta.toFixed(1);

    var zone = classifyZone(gamma);
    if (zone !== currentZone) {
      currentZone = zone;
      if (zone === 'L' || zone === 'R') {
        pushCrossing(zone, Date.now());
      }
    }
  }

  function startListening() {
    window.addEventListener('deviceorientation', onOrientation);
    setStatus('listening');
  }

  function bootstrapPermission() {
    var Orient = window.DeviceOrientationEvent;
    if (Orient && typeof Orient.requestPermission === 'function') {
      permissionBtn.classList.remove('hidden');
      setStatus('tap Enable sensors');
      permissionBtn.addEventListener('click', function () {
        Orient.requestPermission().then(function (state) {
          if (state === 'granted') {
            permissionBtn.classList.add('hidden');
            startListening();
          } else {
            setStatus('permission denied');
          }
        }).catch(function (err) {
          setStatus('error: ' + err.message);
        });
      });
    } else {
      startListening();
    }
  }

  resetBtn.addEventListener('click', function () {
    dismissed = false;
    notificationEl.classList.remove('hidden');
    notificationEl.classList.remove('dismissing');
    dismissedEl.classList.add('hidden');
    setStatus('listening');
    crossings = [];
    renderCrossings();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && document.activeElement === resetBtn) {
      resetBtn.click();
    }
    if (e.key === 'Enter' && document.activeElement === permissionBtn) {
      permissionBtn.click();
    }
    if (e.key === 'ArrowLeft') simulateZone('L');
    if (e.key === 'ArrowRight') simulateZone('R');
    if (e.key === 'ArrowDown') simulateZone('C');
  });

  function simulateZone(zone) {
    if (zone === currentZone) return;
    currentZone = zone;
    if (zone === 'L' || zone === 'R') {
      pushCrossing(zone, Date.now());
      gammaValueEl.textContent = zone === 'L' ? '-30.0 (sim)' : '30.0 (sim)';
    } else {
      gammaValueEl.textContent = '0.0 (sim)';
    }
  }

  function fitFrame() {
    var scale = Math.min(window.innerWidth / 600, window.innerHeight / 600);
    document.documentElement.style.setProperty('--fit-scale', String(scale));
  }
  window.addEventListener('resize', fitFrame);
  fitFrame();

  bootstrapPermission();
})();
