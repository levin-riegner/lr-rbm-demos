/* ─────────────────────────────────────────────────────────────
   KNOT HELPFUL — Ray-Ban Meta Display
   Six famous knots taught with real Wikimedia Commons diagrams.
   d-pad nav. Screens: menu → learn → done.
   ───────────────────────────────────────────────────────────── */
(() => {
  'use strict';

  // ── KNOTS ──
  // Each: { name, tag, blurb, strength (1-5),
  //         image (string | string[]), imageCredit,
  //         steps: [{text, tip}] }
  //
  // The image (or images) are shown across every step of that knot —
  // the composite already shows the whole tying process; the text
  // walks the user through it. Images sourced from Wikimedia Commons.

  const KNOTS = {
    bowline: {
      name: 'BOWLINE',
      tag: 'KING OF KNOTS',
      blurb: 'A fixed loop that never slips and unties easily, even after heavy load.',
      strength: 4,
      image: 'images/bowline.png',
      imageCredit: 'Rolo Tomassi · CC BY-SA 3.0 · Wikimedia',
      steps: [
        { text: '<span class="accent">Panel 1:</span> Form a small overhand loop in the standing line — the "rabbit hole".',
          tip: 'Green = standing line, red = working end. Working end exits OVER the standing.' },
        { text: '<span class="accent">Panel 2–3:</span> Pass the working end UP through the loop, from behind.',
          tip: '"Rabbit comes out of the hole." Up through — never down (that\'s a slip knot).' },
        { text: '<span class="accent">Panel 4:</span> Wrap it AROUND BEHIND the standing line.',
          tip: '"Around the tree." Wrap the standing, don\'t just cross over it.' },
        { text: '<span class="accent">Panel 5:</span> Tuck the working end BACK DOWN through the original loop, then dress and tighten.',
          tip: 'Working end and standing line exit the loop on the same side — check before loading.' },
      ],
    },

    figure8: {
      name: 'FIGURE EIGHT',
      tag: "CLIMBER'S TIE-IN",
      blurb: "Climbing's most-used knot. Strong, easy to inspect, won't jam under load.",
      strength: 5,
      image: 'images/figure8.svg',
      imageCredit: 'Wikimedia Commons · CC BY-SA',
      steps: [
        { text: 'Form a <span class="accent">single bight</span> — fold the rope back on itself.',
          tip: 'Leave a long tail — at least 10× the rope diameter.' },
        { text: '<span class="accent">Pass the doubled end</span> OVER the standing part to form a loop.',
          tip: 'Cross OVER, not under — under makes an overhand knot.' },
        { text: 'Tuck the doubled end <span class="accent">UP through the loop</span> from behind, then dress.',
          tip: 'Finished shape should read as an "8" — two stacked loops of rope.' },
      ],
    },

    clove: {
      name: 'CLOVE HITCH',
      tag: "SAILOR'S HITCH",
      blurb: 'Quick, fast tie to a post. The classic temporary mooring knot.',
      strength: 3,
      image: ['images/clove-1.svg', 'images/clove-2.svg', 'images/clove-3.svg'],
      imageCredit: 'Wikimedia Commons · CC BY-SA',
      steps: [
        { text: '<span class="accent">Diagram 1:</span> Wrap the working end once around the post.',
          tip: 'Working end passes UNDER the standing where they cross.' },
        { text: '<span class="accent">Diagram 2:</span> Cross OVER the first wrap and take a second turn around the post.',
          tip: "The 2nd wrap must cross OVER the first — that's the locking X.",
        },
        { text: '<span class="accent">Diagram 3:</span> Tuck the working end UNDER the second wrap, then tighten.',
          tip: 'Skip this tuck and the hitch will roll off the post.' },
      ],
    },

    monkeyFist: {
      name: "MONKEY'S FIST",
      tag: 'THROWING WEIGHT',
      blurb: 'A decorative weighted ball at the end of a line. Sailors used it to throw lines across gaps.',
      strength: 3,
      image: 'images/monkey-fist.jpg',
      imageCredit: 'Wikimedia Commons · CC BY-SA 3.0',
      steps: [
        { text: '<span class="accent">Panel 1:</span> Make 3 loose vertical wraps around two fingers.',
          tip: 'Keep the wraps loose — the working end has to weave through them.' },
        { text: '<span class="accent">Panel 2:</span> Wrap 3 more times HORIZONTALLY around the verticals, perpendicular.',
          tip: 'These horizontals trap the vertical wraps in place.' },
        { text: '<span class="accent">Panel 3:</span> Pass 3 more wraps THROUGH the horizontals, on the third axis.',
          tip: 'Slip a marble or stone inside before locking — gives the fist its throwing weight.' },
        { text: '<span class="accent">Panel 4:</span> Work each wrap tight in order, following the rope from start to end.',
          tip: 'Tighten section by section. Yanking all at once locks the wraps crossed.' },
      ],
    },

    truckers: {
      name: "TRUCKER'S HITCH",
      tag: '2:1 MECHANICAL ADVANTAGE',
      blurb: 'The classic load-tightener. Two-to-one pulley advantage from a rope alone.',
      strength: 4,
      image: 'images/truckers.jpg',
      imageCredit: 'Wikimedia Commons · CC BY-SA 3.0',
      steps: [
        { text: '<span class="accent">Anchor one end</span> of the rope to a fixed point (top of frame).',
          tip: 'A bowline or two half hitches works for the anchor end.' },
        { text: 'Form a <span class="accent">loop in the middle</span> — an alpine butterfly is shown; a slip knot also works.',
          tip: 'The mid-loop is your improvised pulley. Snug it tight before loading.' },
        { text: 'Pass the working end <span class="accent">around the load anchor</span> (bottom D-ring) and BACK UP through the loop.',
          tip: "This creates the 2:1 mechanical advantage — pull, don't push.",
        },
        { text: '<span class="accent">Pull down hard</span> on the working end, then lock with two half hitches around the standing line.',
          tip: "Don't release tension while locking, or the load loosens." },
      ],
    },

    constrictor: {
      name: 'CONSTRICTOR',
      tag: 'STRONGEST BINDING',
      blurb: 'Grips so tight it often has to be cut off. The most secure binding knot known.',
      strength: 5,
      image: 'images/constrictor.jpg',
      imageCredit: 'Wikimedia Commons · CC BY-SA 3.0',
      steps: [
        { text: '<span class="accent">Panel 1:</span> Wrap the thin cord once around the bar and cross the working end back over the standing line.',
          tip: 'Snug to the bar from the start — no slack under the crossing.' },
        { text: '<span class="accent">Panel 2:</span> Wrap the bar a second time, taking the working end OVER the first turn.',
          tip: 'The second turn goes on the OPPOSITE side of the crossing from the first.' },
        { text: '<span class="accent">Panel 3:</span> Feed the working end UNDER the first wrap (through the X).',
          tip: "OVER the first wrap gives you a clove hitch, not a constrictor.",
        },
        { text: '<span class="accent">Panel 4:</span> Pull both ends in opposite directions — locks irreversibly.',
          tip: "Don't plan to untie it. Most users cut it off." },
      ],
    },
  };

  // ── menu order ──
  const KNOT_MENU = [
    { key: 'bowline'     },
    { key: 'figure8'     },
    { key: 'clove'       },
    { key: 'monkeyFist'  },
    { key: 'truckers'    },
    { key: 'constrictor' },
  ];

  // ── state ──
  const state = {
    screen: 'intent',
    menuIdx: 0,
    knotKey: null,
    stepIdx: 0,
  };

  // ── DOM refs ──
  const $ = (id) => document.getElementById(id);
  const els = {
    screens: {
      intent: $('intentScreen'),
      learn:  $('learnScreen'),
      done:   $('doneScreen'),
    },
    intentList:   $('intentList'),
    learnTitle:   $('learnTitle'),
    stepCount:    $('stepCount'),
    forChip:      $('forChip'),
    diffPips:     $('diffPips'),
    diagram:      $('diagram'),
    imgCredit:    $('imgCredit'),
    stepText:     $('stepText'),
    tipText:      $('tipText'),
    progressDots: $('progressDots'),
    doneKnotName: $('doneKnotName'),
    doneKnotUse:  $('doneKnotUse'),
  };

  // ── rendering ──
  function showScreen(name) {
    state.screen = name;
    Object.entries(els.screens).forEach(([k, el]) => {
      el.classList.toggle('hidden', k !== name);
    });
  }

  function renderMenu() {
    els.intentList.innerHTML = KNOT_MENU.map((it, i) => {
      const k = KNOTS[it.key];
      const pips = '●'.repeat(k.strength) + '○'.repeat(5 - k.strength);
      return `
        <div class="intent-row${i === state.menuIdx ? ' active' : ''}" data-i="${i}">
          <span class="chev">${i === state.menuIdx ? '▶' : '·'}</span>
          <div class="knot-cell">
            <div class="label">${k.name}</div>
            <div class="sub">${k.tag}</div>
          </div>
          <span class="pips" title="strength">${pips}</span>
        </div>
      `;
    }).join('');
  }

  function renderLearn() {
    const knot = KNOTS[state.knotKey];
    const step = knot.steps[state.stepIdx];
    els.learnTitle.textContent = knot.name;
    els.stepCount.textContent  = `${state.stepIdx + 1}/${knot.steps.length}`;
    els.forChip.textContent    = knot.tag;
    els.diffPips.textContent   = '●'.repeat(knot.strength) + '○'.repeat(5 - knot.strength);

    // image(s): single string or array
    const srcs = Array.isArray(knot.image) ? knot.image : [knot.image];
    els.diagram.innerHTML = srcs.map((src) =>
      `<img src="${src}" alt="" class="knot-img" />`
    ).join('');
    els.imgCredit.textContent = `IMG · ${knot.imageCredit}`;

    els.stepText.innerHTML  = step.text;
    els.tipText.textContent = step.tip;

    els.progressDots.innerHTML = knot.steps.map((_, i) => {
      let cls = '';
      if (i < state.stepIdx) cls = 'done';
      else if (i === state.stepIdx) cls = 'current';
      return `<div class="dot ${cls}"></div>`;
    }).join('');
  }

  function renderDone() {
    const knot = KNOTS[state.knotKey];
    els.doneKnotName.textContent = knot.name;
    els.doneKnotUse.textContent  = knot.blurb;
  }

  // ── navigation ──
  function goLearn() {
    state.knotKey = KNOT_MENU[state.menuIdx].key;
    state.stepIdx = 0;
    showScreen('learn');
    renderLearn();
  }

  function advanceStep() {
    const knot = KNOTS[state.knotKey];
    if (state.stepIdx < knot.steps.length - 1) {
      state.stepIdx++;
      renderLearn();
    } else {
      showScreen('done');
      renderDone();
    }
  }

  function backStep() {
    if (state.stepIdx > 0) {
      state.stepIdx--;
      renderLearn();
    } else {
      showScreen('intent');
      renderMenu();
    }
  }

  // ── input ──
  function handleKey(e) {
    const k = e.key;
    if (state.screen === 'intent') {
      if (k === 'ArrowUp') {
        state.menuIdx = (state.menuIdx - 1 + KNOT_MENU.length) % KNOT_MENU.length;
        renderMenu();
      } else if (k === 'ArrowDown') {
        state.menuIdx = (state.menuIdx + 1) % KNOT_MENU.length;
        renderMenu();
      } else if (k === 'Enter' || k === 'ArrowRight') {
        goLearn();
      }
    } else if (state.screen === 'learn') {
      if (k === 'ArrowRight' || k === 'Enter') advanceStep();
      else if (k === 'ArrowLeft') backStep();
      else if (k === 'ArrowUp') { state.stepIdx = 0; renderLearn(); }
      else if (k === 'ArrowDown') { state.stepIdx = KNOTS[state.knotKey].steps.length - 1; renderLearn(); }
    } else if (state.screen === 'done') {
      if (k === 'ArrowLeft') { state.stepIdx = 0; showScreen('learn'); renderLearn(); }
      else if (k === 'Enter' || k === 'ArrowRight') { showScreen('intent'); renderMenu(); }
    }
  }

  function handleClick() {
    if (state.screen === 'intent') goLearn();
    else if (state.screen === 'learn') advanceStep();
    else if (state.screen === 'done') { showScreen('intent'); renderMenu(); }
  }

  // ── ?state= URL routing for screenshots ──
  function applyStateParam() {
    const raw = new URLSearchParams(location.search).get('state');
    if (!raw) return;
    const s = raw.toLowerCase();
    const keyMap = {
      'bowline': 'bowline',
      'figure8': 'figure8', 'figure-8': 'figure8',
      'clove': 'clove', 'clove-hitch': 'clove',
      'monkey-fist': 'monkeyFist', 'monkeys-fist': 'monkeyFist',
      'truckers': 'truckers', 'truckers-hitch': 'truckers',
      'constrictor': 'constrictor',
    };
    if (s === 'menu') return;
    if (s === 'done') { state.knotKey = 'bowline'; state.stepIdx = 0; showScreen('done'); renderDone(); return; }
    const doneMatch = s.endsWith('-done') ? s.slice(0, -'-done'.length) : null;
    if (doneMatch && keyMap[doneMatch]) {
      state.knotKey = keyMap[doneMatch]; state.stepIdx = 0;
      showScreen('done'); renderDone(); return;
    }
    const stepMatch = s.match(/^([a-z0-9-]+?)(?:-step-(\d+))?$/);
    if (stepMatch && keyMap[stepMatch[1]]) {
      const key = keyMap[stepMatch[1]];
      const stepN = Math.max(1, parseInt(stepMatch[2] || '1', 10));
      state.knotKey = key;
      state.stepIdx = Math.min(stepN - 1, KNOTS[key].steps.length - 1);
      showScreen('learn'); renderLearn();
    }
  }

  // ── boot ──
  document.addEventListener('keydown', handleKey);
  document.addEventListener('click', handleClick);
  renderMenu();
  showScreen('intent');
  applyStateParam();
})();
