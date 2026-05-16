(function () {
  'use strict';

  const SUITS = ['♠', '♥', '♦', '♣', '♠', '♥', '♦'];

  // ── The Spectator's Card (Key-Card location) ────────────
  // Mechanic: KEY = bottom card. Spectator returns chosen card to TOP. A single
  // straight cut then puts KEY directly above the chosen card. Every "cue" is
  // a natural performer's gesture that doubles as a thumb-pointer pinch.
  const KEY_CARD_ROUTINE = {
    id: 'key-card',
    name: "THE SPECTATOR'S CARD",
    steps: [
      {
        phase: 'SETUP',
        phaseClass: 'setup',
        patter: 'Ever seen a deck of cards really… behave?',
        secret: 'Casually fan the deck face-up toward yourself, as if admiring it. Glimpse the BOTTOM card. That is your KEY — burn it in.',
        cue: 'STRAIGHTEN THE DECK',
      },
      {
        phase: 'SHUFFLE',
        phaseClass: 'shuffle',
        patter: 'A quick shuffle, fair and square — say STOP whenever you like.',
        secret: 'Overhand shuffle, but keep the KEY pinned on the BOTTOM. Pull packets off the top only. The KEY never moves.',
        cue: 'SNAP THE DECK SHUT',
      },
      {
        phase: 'SELECTION',
        phaseClass: 'select',
        patter: 'Take a card. Any card. Pull it free — don’t show me.',
        secret: 'Ribbon-spread the deck face-down toward the spectator. Let them slide one card cleanly out.',
        cue: 'FLOURISH THE SPREAD',
      },
      {
        phase: 'MEMORIZE',
        phaseClass: 'memorize',
        patter: 'Hold it in your mind. Picture it like you painted it.',
        secret: 'Glance away. Square the rest of the deck face-down between your hands while they memorise.',
        cue: 'LOCK IT IN',
      },
      {
        phase: 'RETURN',
        phaseClass: 'return',
        patter: 'Now place it right here — face down, on top of the deck.',
        secret: 'Their card is now on the TOP. Your KEY is still on the BOTTOM. Hold that mental picture.',
        cue: 'PRESS THE DECK FLAT',
      },
      {
        phase: 'CONTROL',
        phaseClass: 'control',
        patter: 'One clean cut — to lose your card forever.',
        secret: 'A single straight cut: lift any portion off, drop the bottom on top. This brings the KEY directly ABOVE their card. The deck looks shuffled. It isn’t.',
        cue: 'BLESS THE CUT',
      },
      {
        phase: 'REVEAL',
        phaseClass: 'reveal',
        patter: 'Let’s see if the deck remembers what you were thinking.',
        secret: 'Spread the deck face-up between your hands. Find your KEY. The card immediately to its RIGHT in the spread (the one underneath it in the deck) is theirs. Pluck it out with a flourish.',
        cue: 'PLUCK THEIR CARD',
      },
    ],
  };

  const ROUTINES = { 'key-card': KEY_CARD_ROUTINE };

  // ── state ────────────────────────────────────────────────
  let screen = 'title';
  let currentRoutine = null;
  let stepIdx = 0;
  let menuIdx = 0;

  // ── element refs ─────────────────────────────────────────
  const $ = (sel) => document.querySelector(sel);
  const screens = {
    title:  $('#screen-title'),
    menu:   $('#screen-menu'),
    step:   $('#screen-step'),
    reveal: $('#screen-reveal'),
  };
  const menuRows = Array.from(document.querySelectorAll('#menuList .menu-row'));

  // ── helpers ──────────────────────────────────────────────
  function go(name) {
    for (const k in screens) screens[k].classList.add('hidden');
    const el = screens[name];
    el.classList.remove('hidden');
    el.classList.remove('enter');
    void el.offsetWidth;
    el.classList.add('enter');
    screen = name;
  }

  function renderMenu() {
    menuRows.forEach((row, i) => row.classList.toggle('focused', i === menuIdx));
  }

  function moveMenu(delta) {
    const total = menuRows.length;
    let next = menuIdx;
    for (let tries = 0; tries < total; tries++) {
      next = (next + delta + total) % total;
      if (!menuRows[next].classList.contains('locked')) {
        menuIdx = next;
        break;
      }
    }
    renderMenu();
    audio.tick();
  }

  function openMenu() {
    const row = menuRows[menuIdx];
    if (!row || row.classList.contains('locked')) { audio.dud(); return; }
    const trickId = row.dataset.trick;
    const r = ROUTINES[trickId];
    if (!r) { audio.dud(); return; }
    currentRoutine = r;
    stepIdx = 0;
    renderStep();
    audio.chime();
    go('step');
  }

  function renderStep() {
    const r = currentRoutine;
    const s = r.steps[stepIdx];
    $('#stepCount').textContent =
      String(stepIdx + 1).padStart(2, '0') + ' / ' + String(r.steps.length).padStart(2, '0');
    const suit = SUITS[stepIdx % SUITS.length];
    $('#stepSuit').textContent = suit;
    document.querySelectorAll('.patter-corner').forEach((el) => { el.textContent = suit; });
    const phaseEl = $('#stepPhase');
    phaseEl.textContent = 'PHASE · ' + s.phase;
    phaseEl.className = 'phase-label ' + s.phaseClass;
    $('#stepPatter').textContent = s.patter;
    $('#stepSecret').textContent = s.secret;
    $('#stepCue').textContent = s.cue;
  }

  function flashCue() {
    const el = $('#cueRow');
    if (!el) return;
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
  }

  function advanceStep() {
    if (!currentRoutine) return;
    flashCue();
    if (stepIdx < currentRoutine.steps.length - 1) {
      stepIdx += 1;
      renderStep();
      const el = screens.step;
      el.classList.remove('enter');
      void el.offsetWidth;
      el.classList.add('enter');
      audio.flick();
    } else {
      audio.flourish();
      setTimeout(() => go('reveal'), 220);
    }
  }

  function backStep() {
    if (screen !== 'step') return;
    if (stepIdx > 0) {
      stepIdx -= 1;
      renderStep();
      audio.tick();
    } else {
      go('menu');
      audio.tick();
    }
  }

  // ── audio (subtle stage chimes) ──────────────────────────
  const audio = (() => {
    let ctx;
    function ensure() {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
      }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    function tone(freq, dur, type = 'sine', gain = 0.10, attack = 0.005) {
      const c = ensure();
      if (!c) return;
      const t = c.currentTime;
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(gain, t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(c.destination);
      o.start(t); o.stop(t + dur + 0.05);
    }
    return {
      tick:  () => tone(640, 0.05, 'sine', 0.05),
      flick: () => { tone(880, 0.07, 'sine', 0.08); setTimeout(() => tone(1320, 0.09, 'sine', 0.06), 55); },
      chime: () => { tone(660, 0.18, 'triangle', 0.10); setTimeout(() => tone(990, 0.22, 'triangle', 0.08), 90); },
      flourish: () => {
        const notes = [523, 659, 784, 988, 1175];
        notes.forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.10), i * 70));
      },
      dud: () => tone(180, 0.10, 'square', 0.07),
    };
  })();

  // ── input ────────────────────────────────────────────────
  function handlePinch() {
    if (screen === 'title') { audio.chime(); go('menu'); renderMenu(); }
    else if (screen === 'menu') { openMenu(); }
    else if (screen === 'step') { advanceStep(); }
    else if (screen === 'reveal') { audio.chime(); go('menu'); renderMenu(); }
  }
  function handleBack() {
    if (screen === 'menu') { audio.tick(); go('title'); }
    else if (screen === 'step') { backStep(); }
    else if (screen === 'reveal') { audio.tick(); go('menu'); renderMenu(); }
  }

  document.addEventListener('keydown', (e) => {
    const k = e.key;
    if (k === 'Enter' || k === ' ' || k === 'ArrowRight') {
      e.preventDefault();
      handlePinch();
    } else if (k === 'ArrowLeft') {
      e.preventDefault();
      handleBack();
    } else if (k === 'ArrowUp') {
      e.preventDefault();
      if (screen === 'menu') moveMenu(-1);
    } else if (k === 'ArrowDown') {
      e.preventDefault();
      if (screen === 'menu') moveMenu(1);
    }
  });

  document.addEventListener('click', (e) => {
    const row = e.target.closest('.menu-row');
    if (row && !row.classList.contains('locked')) {
      const idx = menuRows.indexOf(row);
      if (idx >= 0) {
        menuIdx = idx;
        renderMenu();
        openMenu();
        return;
      }
    }
    handlePinch();
  });

  renderMenu();
})();
