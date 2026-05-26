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
      playPct: 2,                // just started
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
      playPct: 94,               // almost over — triggers END alert
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
  var PITCH_RAMP_SECONDS = 15;

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

    // ENDING alert: any deck whose track is past 90% gets a red
    // blinking END tag + red progress bar so the DJ sees they need
    // to transition off it.
    var isEnding = d.status === 'PLAYING' && d.playPct >= 90;

    var tagEl = $(key + '-tag');
    if (tagEl) {
      tagEl.classList.remove('sync', 'hidden-tag', 'ending');
      if (isEnding) {
        tagEl.textContent = 'END';
        tagEl.classList.add('ending');
      } else if (!d.tag) {
        tagEl.classList.add('hidden-tag');
      } else {
        tagEl.textContent = d.tag;
        if (d.tag === 'SYNC') tagEl.classList.add('sync');
      }
    }

    var deckEl = $('deck-' + key);
    if (deckEl) {
      var bar = deckEl.querySelector('.deck-bar');
      bar.style.setProperty('--play-pct', d.playPct + '%');
      bar.classList.toggle('ending', isEnding);
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
  //  BEAT / PHASE STATE
  //
  //  beatPhase[key] is the integral of BPM/60 since startMs — i.e.
  //  total beats elapsed. We integrate per-frame so the count
  //  tracks the pitch ramp smoothly instead of jumping when BPM
  //  changes.
  //
  //  Deck B starts ~0.5 beats ahead of Deck A so they're visibly
  //  out of sync at boot. A few seconds after Deck A's pitch ramp
  //  reaches 138 BPM, the simulation applies a one-shot phase
  //  nudge (the DJ "pushing the platter") so beat 1 of Deck A
  //  lands on the same tick as beat 1 of Deck B from then on.
  // ===========================================================
  var startMs      = performance.now();
  var beatPhase    = { a: 0, b: 0.5 };
  var lastFrameMs  = null;
  var lastBeatIdx  = { a: -1, b: -1 };

  var NUDGE_WAIT_SECONDS     = 3;
  var NUDGE_DURATION_SECONDS = 4;
  var nudgeStartT = null;
  var nudgeRate   = 0;

  function maybeStartNudge(t) {
    if (nudgeStartT != null) return;
    if (t < PITCH_RAMP_SECONDS + NUDGE_WAIT_SECONDS) return;
    // shortest signed delta in (-2, 2], in beats
    var diff = (beatPhase.b - beatPhase.a) % 4;
    if (diff <= -2) diff += 4;
    if (diff  >  2) diff -= 4;
    nudgeRate   = diff / NUDGE_DURATION_SECONDS;
    nudgeStartT = t;
  }

  function nudgeContribution(dt, t) {
    if (nudgeStartT == null) return 0;
    if (t - nudgeStartT >= NUDGE_DURATION_SECONDS) return 0;
    return nudgeRate * dt;
  }

  function animateBeats(now) {
    var t  = (now - startMs) / 1000;
    var dt = lastFrameMs == null ? 0 : (now - lastFrameMs) / 1000;
    lastFrameMs = now;

    maybeStartNudge(t);

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
      beatPhase[key] += dt * bps;
      if (key === 'a') beatPhase.a += nudgeContribution(dt, t);

      var idx       = (Math.floor(beatPhase[key]) % 4 + 4) % 4;
      var phaseFrac = beatPhase[key] - Math.floor(beatPhase[key]);
      var lit       = phaseFrac < 0.38;

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

      d.playPct += dt * bps * 0.06;
      if (d.playPct > 99.5) d.playPct = 99.5;
      var deckEl = $('deck-' + key);
      if (deckEl) deckEl.querySelector('.deck-bar').style.setProperty('--play-pct', d.playPct.toFixed(1) + '%');
    });

    requestAnimationFrame(animateBeats);
  }

  // ===========================================================
  //  LIVE TELEMETRY — stands in for the real DJM + Pro DJ Link
  //  feed. The user never drives anything from the glasses.
  //
  //  Scripted timeline:
  //   0  → 15 s : Deck A's pitch ramps 132 → 138 BPM
  //   18 → 22 s : platter-nudge aligns Deck A's beat 1 with Deck B's
  //   23 → 28 s : crossfader cosine-eases from full B (+1.0) to
  //               full A (−1.0) — the DJ swapping the live track
  //   28 s →    : Deck A is now playing out; locked at full A
  //
  //  CH1 / CH2 keep breathing slightly throughout to feel live.
  // ===========================================================
  var BEATLOCK_T            = PITCH_RAMP_SECONDS + NUDGE_WAIT_SECONDS + NUDGE_DURATION_SECONDS; // 22
  var XFADE_HOLD_SECONDS    = 1.5;
  var XFADE_DURATION_SECONDS = 5;
  var XFADE_START_T         = BEATLOCK_T + XFADE_HOLD_SECONDS;                                    // 23.5

  function tickTelemetry() {
    if (frozen) return;
    var t = (performance.now() - startMs) / 1000;

    if (t < XFADE_START_T) {
      MIXER.xfade = 1.0;
    } else if (t < XFADE_START_T + XFADE_DURATION_SECONDS) {
      var p = (t - XFADE_START_T) / XFADE_DURATION_SECONDS;
      var eased = 0.5 - 0.5 * Math.cos(p * Math.PI);   // ease in / out
      MIXER.xfade = 1.0 - 2.0 * eased;
    } else {
      MIXER.xfade = -1.0;
    }

    MIXER.channels[0] = 78 + Math.sin(t / 11 * 2 * Math.PI) * 1.5;
    MIXER.channels[1] = 82 + Math.sin(t / 13 * 2 * Math.PI) * 1.5;

    var ramp = Math.min(t / PITCH_RAMP_SECONDS, 1);
    DECKS.a.pitch = PITCH_TARGET * ramp;

    renderDeck('a');
    renderDeck('b');
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
