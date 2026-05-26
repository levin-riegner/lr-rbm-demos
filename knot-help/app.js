/* ─────────────────────────────────────────────────────────────
   KNOT HELPFUL — Ray-Ban Meta Display
   Six famous knots, each with a story. d-pad nav.
   Screens: menu → learn → done
   ───────────────────────────────────────────────────────────── */
(() => {
  'use strict';

  // ── palette (mirrors styles.css for SVG strokes) ──
  const INK       = '#f5e6c4';   // primary rope cream
  const INK_SOFT  = '#c8b78a';
  const INK_FAINT = '#8a7e5e';
  const RIBBON    = '#ff7250';   // active ember
  const BRONZE    = '#a07b3e';   // post wood

  // ── SVG helpers ──
  const svg = (inner) =>
    `<svg viewBox="0 0 320 200" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">${inner}</svg>`;

  const rope = (d, color = INK, w = 14, opts = {}) => {
    const dash = opts.dim ? ` opacity="0.30"` : '';
    return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${dash}/>`;
  };

  const arrow = (x, y, dir = 'right', color = RIBBON) => {
    const m = {
      right: `${x - 8},${y - 7} ${x + 6},${y} ${x - 8},${y + 7}`,
      left:  `${x + 8},${y - 7} ${x - 6},${y} ${x + 8},${y + 7}`,
      up:    `${x - 7},${y + 8} ${x},${y - 6} ${x + 7},${y + 8}`,
      down:  `${x - 7},${y - 8} ${x},${y + 6} ${x + 7},${y - 8}`,
    }[dir];
    return `<polygon points="${m}" fill="${color}"/>`;
  };

  const post = (x1, y1, x2, y2) => `
    <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${BRONZE}" stroke-width="22" stroke-linecap="round"/>
    <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#3a2810" stroke-width="2" stroke-dasharray="5 7"/>
  `;

  const tag = (x, y, txt) =>
    `<text x="${x}" y="${y}" font-family="Inter, sans-serif" font-size="15" font-weight="800" fill="${INK_SOFT}" letter-spacing="1.2">${txt}</text>`;

  // ── KNOTS ──
  // Each: { name, tag, blurb, strength (1-5), steps: [{text, tip, diagram()}] }

  const KNOTS = {
    bowline: {
      name: 'BOWLINE',
      tag: 'KING OF KNOTS',
      blurb: 'A fixed loop that never slips and unties easily, even after heavy load.',
      strength: 4,
      steps: [
        {
          text: 'Form a small loop — the <span class="accent">rabbit hole</span>.',
          tip: 'Make sure the working end exits OVER the standing line, not under.',
          diagram: () => svg(`
            ${rope('M 30 100 C 90 100, 140 100, 170 100', INK, 14)}
            ${rope('M 170 100 C 220 100, 230 60, 195 60 C 175 60, 170 80, 195 90 L 230 105 L 290 130', RIBBON, 14)}
            ${arrow(290, 130, 'right')}
            ${tag(40, 90, 'STANDING')}
            ${tag(235, 50, 'HOLE')}
            ${tag(230, 165, 'WORKING END →')}
          `),
        },
        {
          text: 'The rabbit comes <span class="accent">UP through the hole</span>.',
          tip: '"Up through" — never down. Down gives you a slip knot, not a bowline.',
          diagram: () => svg(`
            ${rope('M 30 100 C 90 100, 140 100, 170 100', INK, 14, { dim: true })}
            ${rope('M 170 100 C 220 100, 230 60, 195 60 C 175 60, 170 80, 195 90 L 230 105', INK, 14, { dim: true })}
            ${rope('M 230 105 C 270 130, 260 170, 215 160 C 180 150, 185 90, 200 70', RIBBON, 14)}
            ${arrow(200, 70, 'up')}
            ${tag(150, 175, 'UP THROUGH')}
          `),
        },
        {
          text: 'Wrap <span class="accent">AROUND THE TREE</span> (the standing line).',
          tip: 'Wrap behind, then come back around the front.',
          diagram: () => svg(`
            ${rope('M 30 100 C 90 100, 140 100, 170 100', INK, 14, { dim: true })}
            ${rope('M 170 100 C 220 100, 230 60, 195 60 C 175 60, 170 80, 195 90 L 230 105', INK, 14, { dim: true })}
            ${rope('M 230 105 C 270 130, 260 170, 215 160 C 180 150, 185 90, 200 70', INK, 14, { dim: true })}
            ${rope('M 200 70 C 180 50, 130 45, 110 65 C 95 85, 130 100, 150 85', RIBBON, 14)}
            ${arrow(150, 85, 'right')}
            ${tag(105, 40, 'AROUND TREE')}
          `),
        },
        {
          text: 'Back <span class="accent">DOWN through the hole</span>, then pull tight.',
          tip: 'The standing line and working end exit the loop on the same side.',
          diagram: () => svg(`
            ${rope('M 30 100 C 90 100, 140 100, 170 100', INK, 14)}
            <ellipse cx="200" cy="105" rx="38" ry="26" fill="none" stroke="${INK}" stroke-width="14"/>
            ${rope('M 200 70 C 180 50, 130 45, 110 65 C 95 85, 130 100, 150 85 C 175 70, 200 80, 200 130', RIBBON, 14)}
            ${arrow(200, 130, 'down')}
            ${tag(170, 175, 'LOOP ✓')}
          `),
        },
      ],
    },

    figure8: {
      name: 'FIGURE EIGHT',
      tag: "CLIMBER'S TIE-IN",
      blurb: "Climbing's most-used knot. Strong, easy to inspect, won't jam under load.",
      strength: 5,
      steps: [
        {
          text: 'Make a <span class="accent">single bight</span> in the rope.',
          tip: 'Leave a long tail — 10× the rope diameter at least.',
          diagram: () => svg(`
            ${rope('M 30 100 C 100 100, 180 100, 230 100 C 270 100, 270 140, 230 140 C 180 140, 100 140, 30 140', RIBBON, 14)}
            ${arrow(30, 140, 'left')}
            ${tag(35, 90, 'STANDING')}
            ${tag(35, 160, 'WORKING END')}
          `),
        },
        {
          text: 'Pass the working end <span class="accent">OVER the standing line</span> to form a loop.',
          tip: 'Cross OVER, not under — under makes an overhand knot.',
          diagram: () => svg(`
            ${rope('M 30 100 L 230 100', INK, 14, { dim: true })}
            ${rope('M 230 100 C 270 100, 270 140, 230 140 L 180 140 C 130 140, 130 80, 180 80 L 230 80 C 260 80, 260 50, 230 50', RIBBON, 14)}
            ${arrow(230, 50, 'left')}
            ${tag(140, 175, 'OVER → LOOP')}
          `),
        },
        {
          text: 'Tuck the working end <span class="accent">UP through the loop</span> from behind.',
          tip: 'The shape should look like an "8" — two stacked loops.',
          diagram: () => svg(`
            ${rope('M 30 100 L 230 100', INK, 14, { dim: true })}
            <ellipse cx="180" cy="110" rx="32" ry="22" fill="none" stroke="${INK}" stroke-width="14"/>
            ${rope('M 230 80 C 200 70, 180 90, 195 110 C 215 130, 250 120, 250 90', RIBBON, 14)}
            ${arrow(250, 90, 'up')}
            ${tag(80, 175, 'FIGURE 8 ✓')}
          `),
        },
      ],
    },

    clove: {
      name: 'CLOVE HITCH',
      tag: "SAILOR'S HITCH",
      blurb: 'Quick, fast tie to a post. The classic temporary mooring knot.',
      strength: 3,
      steps: [
        {
          text: 'Pass the rope <span class="accent">over the post</span>.',
          tip: 'Working end goes UNDER the standing as it crosses.',
          diagram: () => svg(`
            ${post(160, 30, 160, 175)}
            ${rope('M 30 90 C 90 90, 130 90, 170 90 C 200 90, 220 110, 200 120 L 290 120', RIBBON, 14)}
            ${arrow(290, 120, 'right')}
            ${tag(40, 80, 'STANDING')}
            ${tag(215, 145, 'WORKING END')}
          `),
        },
        {
          text: '<span class="accent">Cross over</span> and wrap the post a second time.',
          tip: "The 2nd wrap must cross OVER the first — that's the locking X.",
          diagram: () => svg(`
            ${post(160, 30, 160, 175)}
            ${rope('M 30 90 C 90 90, 130 90, 170 90 C 200 90, 220 110, 200 120', INK, 14, { dim: true })}
            ${rope('M 200 120 L 250 120 C 280 120, 280 90, 240 80 C 200 75, 180 100, 200 110', RIBBON, 14)}
            ${arrow(200, 110, 'left')}
            ${tag(220, 60, 'CROSS OVER')}
          `),
        },
        {
          text: 'Tuck the end <span class="accent">UNDER the second wrap</span>, then tighten.',
          tip: 'Tuck through the X — don\'t skip this, or the hitch slips off.',
          diagram: () => svg(`
            ${post(160, 30, 160, 175)}
            ${rope('M 30 90 L 140 90', INK, 14)}
            ${rope('M 175 90 C 200 90, 215 110, 195 115 C 175 115, 175 135, 200 130 C 230 125, 230 95, 200 90 L 175 90', INK, 14)}
            ${rope('M 200 130 L 240 145', RIBBON, 14)}
            ${arrow(240, 145, 'right')}
            ${tag(40, 80, 'LOCKED ✓')}
          `),
        },
      ],
    },

    monkeyFist: {
      name: "MONKEY'S FIST",
      tag: 'THROWING WEIGHT',
      blurb: 'A decorative weighted ball at the end of a line. Sailors used it to throw lines across gaps.',
      strength: 3,
      steps: [
        {
          text: 'Make <span class="accent">3 vertical wraps</span> around two fingers.',
          tip: 'Keep the wraps loose — you\'ll need to weave through them.',
          diagram: () => svg(`
            <rect x="120" y="60" width="80" height="100" rx="10" fill="none" stroke="${INK_FAINT}" stroke-width="2" stroke-dasharray="4 6"/>
            ${rope('M 30 100 C 100 100, 140 100, 145 60 L 145 160 C 145 165, 150 165, 155 160 L 155 60 C 155 55, 160 55, 165 60 L 165 160 C 165 165, 170 165, 175 160 L 175 60', RIBBON, 12)}
            ${tag(135, 50, '3 VERTICAL')}
            ${tag(140, 185, 'FINGERS')}
          `),
        },
        {
          text: 'Wrap <span class="accent">3 times horizontally</span> AROUND the verticals.',
          tip: 'Perpendicular to step 1 — these horizontals trap the verticals.',
          diagram: () => svg(`
            ${rope('M 130 70 L 190 70 M 130 90 L 190 90 M 130 110 L 190 110 M 130 130 L 190 130 M 130 150 L 190 150', INK, 8, { dim: true })}
            ${rope('M 30 90 C 80 90, 120 90, 125 80 C 200 80, 210 100, 195 100 C 125 100, 120 115, 195 115 C 215 115, 215 135, 195 135 C 125 135, 125 150, 195 150', RIBBON, 10)}
            ${arrow(195, 150, 'right')}
            ${tag(75, 50, '3 HORIZONTAL → AROUND')}
          `),
        },
        {
          text: 'Pass <span class="accent">3 wraps THROUGH the horizontals</span>, perpendicular to both.',
          tip: 'Slip a marble or pebble inside before locking — it gives the fist weight.',
          diagram: () => svg(`
            ${rope('M 145 50 L 145 170 M 155 50 L 155 170 M 165 50 L 165 170', INK, 8, { dim: true })}
            ${rope('M 130 75 L 195 75 M 130 100 L 195 100 M 130 130 L 195 130', INK, 8, { dim: true })}
            <circle cx="160" cy="105" r="18" fill="#5a3a14" opacity="0.85"/>
            ${rope('M 30 105 C 80 105, 115 105, 125 90 C 130 75, 175 75, 180 90 C 185 110, 175 130, 130 130 C 100 130, 95 115, 130 105', RIBBON, 10)}
            ${arrow(130, 105, 'left')}
            ${tag(195, 50, 'CORE')}
          `),
        },
        {
          text: '<span class="accent">Work it tight</span> — each wrap pulled snug, in order.',
          tip: 'Trace the rope and tighten section by section, never all at once.',
          diagram: () => svg(`
            <defs>
              <radialGradient id="fistG" cx="40%" cy="35%" r="65%">
                <stop offset="0%" stop-color="#ffb29e"/>
                <stop offset="60%" stop-color="#ff7250"/>
                <stop offset="100%" stop-color="#7a2a18"/>
              </radialGradient>
            </defs>
            ${rope('M 30 100 L 110 100', INK, 14)}
            <circle cx="170" cy="100" r="56" fill="url(#fistG)" stroke="${RIBBON}" stroke-width="3"/>
            <path d="M 130 75 C 155 60, 185 60, 210 75 M 130 100 C 155 90, 185 90, 210 100 M 130 125 C 155 140, 185 140, 210 125 M 145 60 C 145 95, 145 105, 145 140 M 170 60 C 170 95, 170 105, 170 140 M 195 60 C 195 95, 195 105, 195 140" fill="none" stroke="#5a2818" stroke-width="2" opacity="0.7"/>
            ${tag(140, 185, 'FIST ✓')}
          `),
        },
      ],
    },

    truckers: {
      name: "TRUCKER'S HITCH",
      tag: '2:1 MECHANICAL ADVANTAGE',
      blurb: 'The classic load-tightener. Two-to-one pulley advantage from a rope alone.',
      strength: 4,
      steps: [
        {
          text: '<span class="accent">Anchor one end</span> of the rope to a fixed point.',
          tip: 'A bowline or two half hitches works for the anchor end.',
          diagram: () => svg(`
            ${post(40, 30, 40, 175)}
            ${rope('M 40 100 C 80 100, 160 100, 280 100', RIBBON, 14)}
            ${arrow(280, 100, 'right')}
            ${tag(50, 60, 'ANCHOR')}
            ${tag(200, 85, 'TO LOAD →')}
          `),
        },
        {
          text: 'Form a <span class="accent">loop in the middle</span> of the rope.',
          tip: 'Keep the loop snug — it becomes your pulley.',
          diagram: () => svg(`
            ${post(40, 30, 40, 175)}
            ${rope('M 40 100 C 80 100, 110 100, 130 100', INK, 14, { dim: true })}
            ${rope('M 130 100 C 145 90, 165 80, 180 95 C 195 110, 175 120, 160 115 C 145 110, 145 100, 160 100 L 200 100 L 280 100', RIBBON, 14)}
            ${arrow(280, 100, 'right')}
            <circle cx="170" cy="100" r="4" fill="${RIBBON}"/>
            ${tag(150, 75, 'PULLEY LOOP')}
          `),
        },
        {
          text: 'Pass the working end <span class="accent">around the load anchor</span> and back up <span class="accent">through the loop</span>.',
          tip: "This is the 2:1 advantage — pull, don't push.",
          diagram: () => svg(`
            ${post(40, 30, 40, 175)}
            ${post(280, 30, 280, 175)}
            ${rope('M 40 80 C 100 80, 140 80, 165 85', INK, 14, { dim: true })}
            <ellipse cx="170" cy="85" rx="14" ry="8" fill="none" stroke="${INK}" stroke-width="3" opacity="0.55"/>
            ${rope('M 180 85 C 220 90, 260 130, 280 150 C 295 160, 280 170, 250 160 C 200 145, 180 110, 175 95', RIBBON, 14)}
            ${arrow(175, 95, 'up')}
            ${tag(220, 175, 'LOAD ANCHOR')}
          `),
        },
        {
          text: '<span class="accent">Pull down hard</span> on the working end to tighten the line.',
          tip: 'Pull straight down — sideways binds the pulley.',
          diagram: () => svg(`
            ${post(40, 30, 40, 175)}
            ${post(280, 30, 280, 175)}
            ${rope('M 40 80 C 100 80, 140 80, 165 85', INK, 14, { dim: true })}
            <ellipse cx="170" cy="85" rx="14" ry="8" fill="none" stroke="${INK}" stroke-width="3" opacity="0.55"/>
            ${rope('M 180 85 C 220 90, 260 130, 280 140 C 290 145, 270 155, 245 150', INK, 14, { dim: true })}
            ${rope('M 170 90 L 170 175', RIBBON, 14)}
            ${arrow(170, 175, 'down')}
            ${tag(180, 175, 'PULL')}
          `),
        },
        {
          text: 'Lock the tension with <span class="accent">two half hitches</span> on the standing line.',
          tip: "Don't release tension while locking, or the load loosens.",
          diagram: () => svg(`
            ${post(40, 30, 40, 175)}
            ${post(280, 30, 280, 175)}
            ${rope('M 40 80 C 100 80, 140 80, 165 85', INK, 14, { dim: true })}
            <ellipse cx="170" cy="85" rx="14" ry="8" fill="none" stroke="${INK}" stroke-width="3" opacity="0.55"/>
            ${rope('M 180 85 C 220 90, 260 130, 280 140 C 290 145, 270 155, 245 150', INK, 14, { dim: true })}
            ${rope('M 170 90 C 170 110, 170 120, 180 130 C 195 135, 200 120, 185 115 C 175 113, 175 130, 195 140 C 215 145, 210 130, 190 125', RIBBON, 14)}
            ${tag(195, 175, 'LOCKED ✓')}
          `),
        },
      ],
    },

    constrictor: {
      name: 'CONSTRICTOR',
      tag: 'STRONGEST BINDING',
      blurb: "Grips so tight it often has to be cut off. The most secure binding knot known.",
      strength: 5,
      steps: [
        {
          text: 'Wrap the rope <span class="accent">around the bundle</span>.',
          tip: 'Snug to the bundle from the start — no slack.',
          diagram: () => svg(`
            ${post(150, 30, 170, 175)}
            ${rope('M 30 100 C 90 100, 140 100, 160 100 C 195 100, 195 130, 160 130 L 290 130', RIBBON, 14)}
            ${arrow(290, 130, 'right')}
            ${tag(35, 90, 'STANDING')}
            ${tag(220, 155, 'WORKING END')}
          `),
        },
        {
          text: 'Cross OVER and pass <span class="accent">UNDER the first wrap</span>.',
          tip: "Going OVER the first wrap gives you a clove hitch, not a constrictor.",
          diagram: () => svg(`
            ${post(150, 30, 170, 175)}
            ${rope('M 30 100 C 90 100, 140 100, 160 100 C 195 100, 195 130, 160 130', INK, 14, { dim: true })}
            ${rope('M 160 130 L 215 130 C 245 130, 250 90, 220 90 C 195 90, 180 110, 170 115', RIBBON, 14)}
            ${arrow(170, 115, 'left')}
            ${tag(195, 60, 'UNDER 1st WRAP')}
          `),
        },
        {
          text: 'Pull both ends <span class="accent">in opposite directions</span> — locks irreversibly.',
          tip: 'Don\'t plan to untie it — most users cut it off.',
          diagram: () => svg(`
            ${post(150, 30, 170, 175)}
            ${rope('M 30 100 L 130 100', RIBBON, 14)}
            ${arrow(30, 100, 'left')}
            ${rope('M 130 100 C 200 90, 210 130, 145 130 C 110 130, 110 115, 145 110 C 200 100, 215 145, 145 145 L 110 145', INK, 14)}
            ${rope('M 200 145 L 290 145', RIBBON, 14)}
            ${arrow(290, 145, 'right')}
            ${tag(110, 70, 'LOCKED ✓')}
          `),
        },
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
    screen: 'intent',  // 'intent' (= menu) | 'learn' | 'done'
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
    els.diagram.innerHTML      = step.diagram();
    els.stepText.innerHTML     = step.text;
    els.tipText.textContent    = step.tip;

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
      else if (k === 'ArrowUp') {
        state.stepIdx = 0;
        renderLearn();
      } else if (k === 'ArrowDown') {
        state.stepIdx = KNOTS[state.knotKey].steps.length - 1;
        renderLearn();
      }
    } else if (state.screen === 'done') {
      if (k === 'ArrowLeft') {
        state.stepIdx = 0;
        showScreen('learn');
        renderLearn();
      } else if (k === 'Enter' || k === 'ArrowRight') {
        showScreen('intent');
        renderMenu();
      }
    }
  }

  function handleClick() {
    if (state.screen === 'intent') goLearn();
    else if (state.screen === 'learn') advanceStep();
    else if (state.screen === 'done') {
      showScreen('intent');
      renderMenu();
    }
  }

  // ── ?state= URL routing for reproducible screenshots ──
  // Supported values:
  //   menu (default), bowline, figure8, clove, monkey-fist, truckers, constrictor
  //   <knot>-step-N (1-indexed step within a knot)
  //   <knot>-done   (the done screen for that knot)
  //   done          (alias: done screen for bowline)
  function applyStateParam() {
    const raw = new URLSearchParams(location.search).get('state');
    if (!raw) return;
    const s = raw.toLowerCase();
    const keyMap = {
      'bowline': 'bowline',
      'figure8': 'figure8',
      'figure-8': 'figure8',
      'clove': 'clove',
      'clove-hitch': 'clove',
      'monkey-fist': 'monkeyFist',
      'monkeys-fist': 'monkeyFist',
      'truckers': 'truckers',
      'truckers-hitch': 'truckers',
      'constrictor': 'constrictor',
    };
    if (s === 'menu') return;
    if (s === 'done') {
      state.knotKey = 'bowline';
      state.stepIdx = 0;
      showScreen('done');
      renderDone();
      return;
    }
    const doneMatch = s.endsWith('-done') ? s.slice(0, -'-done'.length) : null;
    if (doneMatch && keyMap[doneMatch]) {
      state.knotKey = keyMap[doneMatch];
      state.stepIdx = 0;
      showScreen('done');
      renderDone();
      return;
    }
    const stepMatch = s.match(/^([a-z0-9-]+?)(?:-step-(\d+))?$/);
    if (stepMatch && keyMap[stepMatch[1]]) {
      const key = keyMap[stepMatch[1]];
      const stepN = Math.max(1, parseInt(stepMatch[2] || '1', 10));
      state.knotKey = key;
      state.stepIdx = Math.min(stepN - 1, KNOTS[key].steps.length - 1);
      showScreen('learn');
      renderLearn();
    }
  }

  // ── boot ──
  document.addEventListener('keydown', handleKey);
  document.addEventListener('click', handleClick);
  renderMenu();
  showScreen('intent');
  applyStateParam();
})();
