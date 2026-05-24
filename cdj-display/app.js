(function () {
  'use strict';

  // ===========================================================
  //  PASSIVE DISPLAY — no inputs change anything here.
  //  In production this state would be hydrated from Pro DJ
  //  Link UDP packets (CDJs) and DJM mixer telemetry. For the
  //  demo it's seeded with illustrative values, with subtle
  //  motion so the HUD feels live without lying about state.
  // ===========================================================
  var DECKS = {
    a: {
      num:     '#1',
      ip:      '.77.183',
      baseBpm: 132.0,
      pitch:   0.0,            // -8.0 .. +8.0 %
      status:  'PLAYING',      // PLAYING | PAUSED | CUE
      tag:     'MASTER',       // MASTER | SYNC | null
      track:   "L'Amour Toujours · Gigi D'Agostino",
      playPct: 34,
      bpm:     132.0,
    },
    b: {
      num:     '#2',
      ip:      '.77.172',
      baseBpm: 138.0,
      pitch:   0.0,
      status:  'PLAYING',
      tag:     null,
      track:   'Boten Anna · Basshunter',
      playPct: 62,
      bpm:     138.0,
    }
  };

  var MIXER = {
    // ch1 → deck A, ch2 → deck B, ch3/ch4 unrouted
    channels: [78, 82, 0, 0],   // fader positions 0..100
    xfade:    1.0,              // locked all the way to deck B (Basshunter)
  };

  // Deck A is being beat-matched up to deck B. The DJ has cued
  // L'Amour Toujours (132 BPM) on deck A and is slowly nudging
  // its pitch up to meet Boten Anna (138 BPM) on deck B.
  var PITCH_TARGET = (138 / 132 - 1) * 100; // ≈ +4.55 %
  var PITCH_RAMP_SECONDS = 60;

  // ===========================================================
  //  ?state= ROUTING (deterministic capture for screenshots)
  //  These freeze the simulation at a particular moment.
  // ===========================================================
  var frozen = false;

  function applyStateParam() {
    var q = new URLSearchParams(window.location.search).get('state');
    if (!q) return;
    frozen = true;

    switch (q) {
      case 'home':
        frozen = false; // let the live simulation run
        break;
      case 'crossfade-a':
        MIXER.xfade = -0.85;
        MIXER.channels = [85, 35, 0, 0];
        break;
      case 'crossfade-b':
        MIXER.xfade = 0.85;
        MIXER.channels = [35, 88, 0, 0];
        break;
      case 'cue':
        DECKS.b.status = 'CUE';
        DECKS.b.tag = null;
        MIXER.channels[1] = 0;
        break;
      case 'pitched':
        DECKS.a.pitch = +2.4;
        DECKS.b.pitch = -1.8;
        break;
      default:
        frozen = false;
    }
  }

  // ===========================================================
  //  RENDER
  // ===========================================================
  var $ = function (id) { return document.getElementById(id); };

  function setText(id, t) { var el = $(id); if (el) el.textContent = t; }

  function fmtPitch(p) {
    var sign = p > 0 ? '+' : (p < 0 ? '-' : '±');
    return sign + Math.abs(p).toFixed(1) + '%';
  }

  function renderDeck(key) {
    var d = DECKS[key];

    // pitch shifts the playing BPM relative to base
    d.bpm = d.baseBpm * (1 + d.pitch / 100);

    setText(key + '-num',       d.num);
    setText(key + '-ip',        d.ip);
    setText(key + '-bpm',       d.bpm.toFixed(1));
    setText(key + '-track',     d.track);
    setText(key + '-pitch-val', fmtPitch(d.pitch));

    var pct = 50 + (d.pitch / 8) * 50;
    if (pct < 2) pct = 2; if (pct > 98) pct = 98;
    var pthumb = $(key + '-pitch-thumb');
    if (pthumb) pthumb.style.left = pct + '%';

    var statusEl = $(key + '-status');
    if (statusEl) {
      statusEl.classList.remove('playing', 'paused', 'cue');
      statusEl.classList.add(d.status.toLowerCase());
      statusEl.querySelector('.status-text').textContent = d.status;
    }

    var tagEl = $(key + '-tag');
    if (tagEl) {
      tagEl.classList.remove('sync', 'hidden-tag');
      if (!d.tag) {
        tagEl.classList.add('hidden-tag');
      } else {
        tagEl.textContent = d.tag;
        if (d.tag === 'SYNC') tagEl.classList.add('sync');
      }
    }

    var deckEl = $('deck-' + key);
    if (deckEl) {
      deckEl.querySelector('.deck-bar').style.setProperty('--play-pct', d.playPct + '%');
    }
  }

  function renderMixer() {
    // CH3/CH4 are always dim (no source); CH1/CH2 dim only when
    // their fader is essentially down.
    document.querySelectorAll('.ch').forEach(function (el, i) {
      var v = MIXER.channels[i];
      var fader = el.querySelector('.ch-fader');
      var thumb = el.querySelector('.ch-thumb');
      thumb.style.bottom = v + '%';
      fader.style.setProperty('--fader-pct', v + '%');
      if (i >= 2) {
        el.classList.add('dim');
      } else {
        el.classList.toggle('dim', v < 3);
      }
    });

    // crossfader: -1..+1 → 0..100% from left
    var xfPct = (MIXER.xfade + 1) / 2 * 100;
    var thumb = $('xfade-thumb');
    thumb.style.left = xfPct + '%';

    var stateEl = $('xfade-state');
    var lEl = $('xfade-l'), rEl = $('xfade-r');
    lEl.classList.remove('hot'); rEl.classList.remove('hot');
    thumb.classList.remove('active');
    stateEl.classList.remove('active');

    if (Math.abs(MIXER.xfade) < 0.06) {
      stateEl.textContent = 'CENTER';
    } else {
      stateEl.classList.add('active');
      thumb.classList.add('active');
      if (MIXER.xfade < 0) {
        stateEl.textContent = '◀ A ' + Math.round(-MIXER.xfade * 100) + '%';
        lEl.classList.add('hot');
      } else {
        stateEl.textContent = 'B ' + Math.round(MIXER.xfade * 100) + '% ▶';
        rEl.classList.add('hot');
      }
    }
  }

  function renderAll() {
    renderDeck('a');
    renderDeck('b');
    renderMixer();
  }

  // ===========================================================
  //  CLOCK
  // ===========================================================
  function tickClock() {
    var d = new Date();
    var hh = String(d.getHours()).padStart(2, '0');
    var mm = String(d.getMinutes()).padStart(2, '0');
    setText('clock', hh + ':' + mm);
  }

  // ===========================================================
  //  BEAT ANIMATION — 4-dot indicator pulses at BPM rate.
  //  CUE / PAUSED decks freeze.
  // ===========================================================
  var beatStartMs  = { a: performance.now(), b: performance.now() - 230 };
  var lastBeatIdx  = { a: -1, b: -1 };

  function animateBeats(now) {
    ['a', 'b'].forEach(function (key) {
      var d = DECKS[key];
      var dots = $(key + '-beats');
      if (!dots) return;
      var lis = dots.querySelectorAll('i');

      if (d.status !== 'PLAYING') {
        lis.forEach(function (el) { el.classList.remove('on', 'downbeat'); });
        setText(key + '-beat-n', '–');
        return;
      }

      var bps = d.bpm / 60;
      var beats = ((now - beatStartMs[key]) / 1000) * bps;
      var idx = (Math.floor(beats) % 4 + 4) % 4;
      var phase = beats - Math.floor(beats);
      var lit = phase < 0.38;

      lis.forEach(function (el, i) {
        el.classList.remove('on', 'downbeat');
        if (i === idx && lit) {
          el.classList.add('on');
          if (i === 0) el.classList.add('downbeat');
        }
      });

      if (idx !== lastBeatIdx[key]) {
        lastBeatIdx[key] = idx;
        setText(key + '-beat-n', String(idx + 1));
      }

      d.playPct += (bps / 60) * 0.06;
      if (d.playPct > 99) d.playPct = 6;
      var deckEl = $('deck-' + key);
      if (deckEl) deckEl.querySelector('.deck-bar').style.setProperty('--play-pct', d.playPct.toFixed(1) + '%');
    });

    requestAnimationFrame(animateBeats);
  }

  // ===========================================================
  //  LIVE TELEMETRY — stands in for the real DJM + Pro DJ Link
  //  feed. The user never drives anything from the glasses.
  //   - Crossfader stays pinned all the way to deck B.
  //   - CH1 / CH2 breathe slightly around their rest positions.
  //   - Deck A's pitch ramps up to match deck B's tempo
  //     (the DJ is beatmatching A in headphones before the swap).
  // ===========================================================
  var startMs = performance.now();

  function tickTelemetry() {
    if (frozen) return;
    var t = (performance.now() - startMs) / 1000;

    MIXER.xfade = 1.0;
    MIXER.channels[0] = 78 + Math.sin(t / 11 * 2 * Math.PI) * 1.5;
    MIXER.channels[1] = 82 + Math.sin(t / 13 * 2 * Math.PI) * 1.5;

    var ramp = Math.min(t / PITCH_RAMP_SECONDS, 1);
    DECKS.a.pitch = PITCH_TARGET * ramp;

    renderDeck('a');
    renderMixer();
  }

  // ===========================================================
  //  BOOT
  //  No keyboard / touch listeners — this is a read-only HUD.
  // ===========================================================
  function boot() {
    applyStateParam();
    renderAll();
    tickClock();
    setInterval(tickClock, 15000);
    setInterval(tickTelemetry, 200);
    requestAnimationFrame(animateBeats);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
