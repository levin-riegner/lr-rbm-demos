(function () {
  'use strict';

  // ===========================================================
  //  DEMO DATA — two CDJ-3000Xs on a Pro DJ Link subnet,
  //  plus a 4-channel mixer where only CH1/CH2 are routed
  //  to the active decks. Numbers are illustrative.
  // ===========================================================
  var DECKS = {
    a: {
      num:       '#1',
      ip:        '.77.183',
      bpm:       124.0,
      baseBpm:   124.0,        // chart-stored BPM (before pitch)
      pitch:     0.0,          // -8.0 .. +8.0 %
      status:    'PLAYING',    // PLAYING | PAUSED | CUE
      tag:       'MASTER',     // MASTER | SYNC | null
      track:     'Hannya · Tiga',
      playPct:   34,           // 0..100 — where in the track we are
    },
    b: {
      num:       '#2',
      ip:        '.77.172',
      bpm:       124.0,
      baseBpm:   124.0,
      pitch:     0.0,
      status:    'PLAYING',
      tag:       'SYNC',
      track:     'Dust · Charlotte de Witte',
      playPct:   62,
    }
  };

  var MIXER = {
    // ch1 → deck A, ch2 → deck B, ch3/ch4 unused
    channels: [78, 82, 0, 0], // fader positions 0..100
    xfade:    0,              // -1.0 (full A) .. +1.0 (full B), 0 = center
  };

  var FOCUS = 'a';

  // ===========================================================
  //  ?state= ROUTING (deterministic capture)
  // ===========================================================
  function applyStateParam() {
    var q = new URLSearchParams(window.location.search).get('state');
    if (!q) return;

    switch (q) {
      case 'home':
        // defaults
        break;
      case 'focused-a':
        FOCUS = 'a';
        break;
      case 'focused-b':
        FOCUS = 'b';
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

    // pitch thumb position: center at 50%, range +/- 8% maps to +/- 50%
    var pct = 50 + (d.pitch / 8) * 50;
    if (pct < 2) pct = 2; if (pct > 98) pct = 98;
    var pthumb = $(key + '-pitch-thumb');
    if (pthumb) pthumb.style.left = pct + '%';

    // status pill
    var statusEl = $(key + '-status');
    if (statusEl) {
      statusEl.classList.remove('playing', 'paused', 'cue');
      statusEl.classList.add(d.status.toLowerCase());
      statusEl.querySelector('.status-text').textContent = d.status;
    }

    // tag (MASTER / SYNC / hidden)
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

    // track progress bar variable
    var deckEl = $('deck-' + key);
    if (deckEl) {
      deckEl.querySelector('.deck-bar').style.setProperty('--play-pct', d.playPct + '%');
    }
  }

  function renderFocus() {
    document.querySelectorAll('.deck').forEach(function (el) {
      el.classList.toggle('focused', el.dataset.deck === FOCUS);
    });
  }

  function renderMixer() {
    // channel faders. CH3/CH4 are always dim (no source);
    // CH1/CH2 dim only when their fader is essentially down.
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

    // crossfader: -1..+1 → 0..100% left position
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
    renderFocus();
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
  //  BEAT ANIMATION — drives the 4-dot indicator at BPM rate.
  //  Paused/CUE decks do not advance.
  // ===========================================================
  var beatStartMs = { a: performance.now(), b: performance.now() - 230 };
  var lastBeatIdx = { a: -1, b: -1 };

  function animateBeats(now) {
    ['a', 'b'].forEach(function (key) {
      var d = DECKS[key];
      var dots = $(key + '-beats');
      if (!dots) return;
      var lis = dots.querySelectorAll('i');

      if (d.status !== 'PLAYING') {
        // freeze: nothing lit
        lis.forEach(function (el) { el.classList.remove('on', 'downbeat'); });
        setText(key + '-beat-n', '–');
        return;
      }

      var bps = d.bpm / 60;
      var beats = ((now - beatStartMs[key]) / 1000) * bps;
      var idx = (Math.floor(beats) % 4 + 4) % 4;          // 0..3
      var phase = beats - Math.floor(beats);              // 0..1 within current beat

      // only on first ~38% of beat is the dot bright
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

      // advance track progress slowly to feel alive
      d.playPct += (bps / 60) * 0.06;
      if (d.playPct > 99) d.playPct = 6;
      var deckEl = $('deck-' + key);
      if (deckEl) deckEl.querySelector('.deck-bar').style.setProperty('--play-pct', d.playPct.toFixed(1) + '%');
    });

    requestAnimationFrame(animateBeats);
  }

  // ===========================================================
  //  INPUT
  //   ◀ ▶  → nudge crossfader toward A / B
  //   ▲ ▼  → switch focused deck (toggle A↔B)
  //   Enter → toggle PLAY / CUE on focused deck
  //
  //  Channel faders track per-deck status: a deck in CUE drops
  //  its channel to 0; PLAYING returns it to the prior level.
  // ===========================================================
  var savedFader = { 1: 78, 2: 82 };

  function syncFadersToStatus() {
    var aIdx = 0, bIdx = 1;
    if (DECKS.a.status === 'PLAYING') {
      if (MIXER.channels[aIdx] < 3) MIXER.channels[aIdx] = savedFader[1];
    } else {
      if (MIXER.channels[aIdx] >= 3) savedFader[1] = MIXER.channels[aIdx];
      MIXER.channels[aIdx] = 0;
    }
    if (DECKS.b.status === 'PLAYING') {
      if (MIXER.channels[bIdx] < 3) MIXER.channels[bIdx] = savedFader[2];
    } else {
      if (MIXER.channels[bIdx] >= 3) savedFader[2] = MIXER.channels[bIdx];
      MIXER.channels[bIdx] = 0;
    }
  }

  function bumpXfade(delta) {
    MIXER.xfade = Math.max(-1, Math.min(1, MIXER.xfade + delta));
    if (Math.abs(MIXER.xfade) < 0.05) MIXER.xfade = 0;
  }

  function togglePlayCue(key) {
    var d = DECKS[key];
    if (d.status === 'PLAYING') {
      d.status = 'CUE';
      // when a deck is cued the MASTER tag stays — Pro DJ Link behavior
    } else {
      d.status = 'PLAYING';
    }
    syncFadersToStatus();
  }

  document.addEventListener('keydown', function (e) {
    var handled = true;
    switch (e.key) {
      case 'ArrowLeft':
        bumpXfade(-0.18);
        break;
      case 'ArrowRight':
        bumpXfade(+0.18);
        break;
      case 'ArrowUp':
      case 'ArrowDown':
        FOCUS = (FOCUS === 'a') ? 'b' : 'a';
        break;
      case 'Enter':
        togglePlayCue(FOCUS);
        break;
      default:
        handled = false;
    }
    if (handled) {
      e.preventDefault();
      renderAll();
    }
  });

  // ===========================================================
  //  BOOT
  // ===========================================================
  function boot() {
    applyStateParam();
    renderAll();
    tickClock();
    setInterval(tickClock, 15000);
    requestAnimationFrame(animateBeats);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
