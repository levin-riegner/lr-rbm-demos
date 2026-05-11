(function () {
  'use strict';

  var CONFIG = {
    apiUrl:      'https://icanhazdadjoke.com/',
    storageKey:  'mdg_dad_jokes_v1',
  };

  var state = {
    joke:        '',
    jokeId:      null,
    heard:       0,
    groans:      0,
    loading:     false,
    audioCtx:    null,
    masterGain:  null,
  };

  // ===========================================================
  //  AUDIO ENGINE
  // ===========================================================
  function initAudio() {
    if (state.audioCtx) return;
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    state.audioCtx = new Ctx();
    state.masterGain = state.audioCtx.createGain();
    state.masterGain.gain.setValueAtTime(0.55, state.audioCtx.currentTime);
    state.masterGain.connect(state.audioCtx.destination);
  }
  function resumeAudio() {
    if (state.audioCtx && state.audioCtx.state === 'suspended') state.audioCtx.resume();
  }

  // ba-dum-tss rim shot
  function playRimShot() {
    initAudio();
    if (!state.audioCtx) return;
    resumeAudio();
    var ctx = state.audioCtx;
    var now = ctx.currentTime;

    // KICK 1 — "ba"
    drumKick(now,        110, 0.30);
    // KICK 2 — "dum"
    drumKick(now + 0.13,  90, 0.32);
    // CRASH — "tss"
    drumCrash(now + 0.28, 0.30);
  }

  function drumKick(when, freq, peak) {
    var ctx = state.audioCtx;
    var osc = ctx.createOscillator();
    var g   = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 2.6, when);
    osc.frequency.exponentialRampToValueAtTime(freq, when + 0.04);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.5, when + 0.18);
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(peak, when + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0005, when + 0.20);
    osc.connect(g);
    g.connect(state.masterGain);
    osc.start(when);
    osc.stop(when + 0.22);
  }

  function drumCrash(when, peak) {
    var ctx = state.audioCtx;
    var sr  = ctx.sampleRate;
    var len = Math.ceil(0.42 * sr);
    var buf = ctx.createBuffer(1, len, sr);
    var d   = buf.getChannelData(0);
    for (var i = 0; i < len; i++) {
      var t = i / sr;
      var env = Math.exp(-t / 0.18);
      d[i] = (Math.random() * 2 - 1) * env;
    }
    var src = ctx.createBufferSource();
    src.buffer = buf;

    // bandpass for sizzle
    var hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(3500, when);

    var g = ctx.createGain();
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(peak, when + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0005, when + 0.42);

    src.connect(hp);
    hp.connect(g);
    g.connect(state.masterGain);
    src.start(when);
    src.stop(when + 0.44);
  }

  // sad trombone "wah waah" on groan
  function playGroan() {
    initAudio();
    if (!state.audioCtx) return;
    resumeAudio();
    var ctx = state.audioCtx;
    var now = ctx.currentTime;
    var steps = [
      { f0: 420, f1: 320, t: 0.00, dur: 0.22 },
      { f0: 360, f1: 270, t: 0.18, dur: 0.22 },
      { f0: 300, f1: 200, t: 0.36, dur: 0.40 },
    ];
    steps.forEach(function (s) {
      var osc = ctx.createOscillator();
      var g   = ctx.createGain();
      osc.type = 'sawtooth';
      // detuned voicing for trombone-y wobble
      var lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(1400, now + s.t);
      osc.frequency.setValueAtTime(s.f0, now + s.t);
      osc.frequency.exponentialRampToValueAtTime(s.f1, now + s.t + s.dur);
      g.gain.setValueAtTime(0, now + s.t);
      g.gain.linearRampToValueAtTime(0.20, now + s.t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0005, now + s.t + s.dur);
      osc.connect(lp);
      lp.connect(g);
      g.connect(state.masterGain);
      osc.start(now + s.t);
      osc.stop(now + s.t + s.dur + 0.02);
    });
  }

  // soft page-flip on new joke
  function playFlip() {
    initAudio();
    if (!state.audioCtx) return;
    resumeAudio();
    var ctx = state.audioCtx;
    var sr  = ctx.sampleRate;
    var dur = 0.18;
    var len = Math.ceil(dur * sr);
    var buf = ctx.createBuffer(1, len, sr);
    var d   = buf.getChannelData(0);
    for (var i = 0; i < len; i++) {
      var t = i / sr;
      var env = Math.exp(-t / 0.045) * (1 - Math.exp(-t / 0.004));
      d[i] = (Math.random() * 2 - 1) * env * 0.7;
    }
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1800, ctx.currentTime);
    bp.Q.setValueAtTime(0.8, ctx.currentTime);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.4, ctx.currentTime);
    src.connect(bp);
    bp.connect(g);
    g.connect(state.masterGain);
    src.start();
  }

  // ===========================================================
  //  JOKE FETCH
  // ===========================================================
  function fetchJoke() {
    if (state.loading) return;
    state.loading = true;
    setStatus('LOADING…', false);
    var card = document.getElementById('jokeCard');
    if (card) card.classList.add('loading');

    fetch(CONFIG.apiUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      cache: 'no-store',
    })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (d) {
        if (!d || !d.joke) throw new Error('Bad payload');
        state.jokeId = d.id || null;
        applyJoke(String(d.joke));
        state.heard += 1;
        saveData();
        renderCounters();
        playRimShot();
        setStatus('', false);
      })
      .catch(function (err) {
        console.error('joke fetch failed', err);
        applyJoke("Couldn't reach the joke vault.\nThe internet is having a moment.");
        setStatus('OFFLINE', true);
      })
      .finally(function () {
        state.loading = false;
        if (card) card.classList.remove('loading');
      });
  }

  function applyJoke(raw) {
    // Normalize line endings, collapse the blank line some jokes use
    // between setup and punch into a single newline.
    state.joke = raw
      .replace(/\r\n/g, '\n')
      .replace(/\n\s*\n+/g, '\n')
      .trim();
    renderJoke();
  }

  // ===========================================================
  //  RENDER
  // ===========================================================
  var FIT_MAX = 48;
  var FIT_MIN = 18;

  function renderJoke() {
    var el = document.getElementById('jokeText');
    if (!el) return;
    el.textContent = state.joke;
    fitJoke();
    el.classList.remove('tick');
    void el.offsetWidth;
    el.classList.add('tick');
  }

  // Shrink the joke text until it fits the card's available space.
  // Stepwise search is fine — at most ~30 iterations and the layout
  // change is invisibly fast on this scale of content.
  function fitJoke() {
    var el = document.getElementById('jokeText');
    if (!el) return;
    var parent = el.parentElement; // .card-inner
    if (!parent) return;

    var cs = getComputedStyle(parent);
    var availH = parent.clientHeight -
                 parseFloat(cs.paddingTop) -
                 parseFloat(cs.paddingBottom);
    var availW = parent.clientWidth -
                 parseFloat(cs.paddingLeft) -
                 parseFloat(cs.paddingRight);

    // start from max and step down
    var size = FIT_MAX;
    el.style.fontSize = size + 'px';
    while (size > FIT_MIN &&
           (el.scrollHeight > availH || el.scrollWidth > availW)) {
      size -= 1;
      el.style.fontSize = size + 'px';
    }
  }

  function renderCounters() {
    var s = document.getElementById('serial');
    var h = document.getElementById('heardCount');
    var g = document.getElementById('groanCount');
    if (s) s.textContent = 'N° ' + pad4(state.heard);
    if (h) h.textContent = pad3(state.heard);
    if (g) g.textContent = pad3(state.groans);
  }

  function pad4(n) {
    var s = String(Math.max(0, Math.min(9999, n|0)));
    while (s.length < 4) s = '0' + s;
    return s;
  }
  function pad3(n) {
    var s = String(Math.max(0, Math.min(999, n|0)));
    while (s.length < 3) s = '0' + s;
    return s;
  }

  function setStatus(msg, err) {
    var el = document.getElementById('status');
    if (!el) return;
    el.textContent = msg || '';
    el.classList.toggle('show', !!msg);
    el.classList.toggle('err', !!err);
  }

  // ===========================================================
  //  ACTIONS
  // ===========================================================
  function nextJoke() { fetchJoke(); }

  function doGroan() {
    state.groans += 1;
    saveData();
    renderCounters();
    playGroan();
    var stage = document.getElementById('stage');
    if (!stage) return;
    stage.classList.remove('groaned');
    void stage.offsetWidth;
    stage.classList.add('groaned');
  }

  // ===========================================================
  //  PERSISTENCE
  // ===========================================================
  function loadData() {
    try {
      var raw = localStorage.getItem(CONFIG.storageKey);
      if (!raw) return;
      var d = JSON.parse(raw);
      if (typeof d.heard  === 'number') state.heard  = Math.max(0, Math.min(9999, d.heard|0));
      if (typeof d.groans === 'number') state.groans = Math.max(0, Math.min(999,  d.groans|0));
    } catch (e) { /* ignore */ }
  }
  function saveData() {
    try {
      localStorage.setItem(CONFIG.storageKey, JSON.stringify({
        heard:  state.heard,
        groans: state.groans,
      }));
    } catch (e) { /* ignore */ }
  }

  // ===========================================================
  //  DISPATCH + EVENTS
  // ===========================================================
  function handleAction(action) {
    switch (action) {
      case 'another': nextJoke();   break;
      case 'groan':   doGroan();    break;
    }
  }

  // Bubble focus to whichever button matches the next action so the
  // focus ring is a visual hint of what Enter will do.
  function focusForState() {
    var another = document.getElementById('anotherBtn');
    if (another) another.focus();
  }

  function setupEvents() {
    document.addEventListener('click', function (e) {
      var actionEl = e.target.closest('[data-action]');
      initAudio(); resumeAudio();
      if (actionEl) { handleAction(actionEl.dataset.action); return; }
      // tap on card → next joke
      if (e.target.closest('#jokeCard')) nextJoke();
    });

    document.addEventListener('keydown', function (e) {
      switch (e.key) {
        // Next joke
        case 'Enter':
        case ' ':
        case 'ArrowRight':
        case 'ArrowLeft':
        case 'ArrowUp':
          nextJoke();
          e.preventDefault();
          break;

        // Groan
        case 'ArrowDown':
        case 'g':
        case 'G':
          doGroan();
          e.preventDefault();
          break;
      }
    });
  }

  function init() {
    loadData();
    renderCounters();
    renderJoke();
    setupEvents();
    setTimeout(focusForState, 50);
    fetchJoke();

    // Re-fit once the Caveat webfont actually loads — metrics shift
    // noticeably between the fallback and the loaded font.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(fitJoke);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
