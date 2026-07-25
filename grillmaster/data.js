/* ─────────────────────────────────────────────────────────────
   GRILLMASTER — cook library
   ---------------------------------------------------------------
   Three modes, two engines:

   • GRILL  — direct high heat, fast. Sear/flip, minutes, TIME-driven.
              Coached by a flip-countdown ("FLIP THE RIBEYE"). You can
              stack several items and cook them together.

   • SMOKE  — low & slow over wood, ~225°F, hours, TEMP-driven to
              probe-tender (~203°F). Coached by a PIT MONITOR: pit temp
              and meat temp side by side, the stall called out, wrap and
              pull at temperature, a self-correcting ETA.

   • BBQ    — indirect medium heat, ~275-325°F, a couple hours. The
              backyard-cookout cuts: ribs, chicken, wings, tri-tip.
              Same pit monitor, tuned hotter, saucing/glazing, done by a
              mix of time and a lower target temp.

   The app asks three questions before any food shows up:
     1. MODE   — grill, smoke, or bbq                  (see MODES)
     2. FIRE   — charcoal, gas, wood, pellet, electric (see FUELS)
     3. HELP   — how much hand-holding you want        (see ASSIST_LEVELS)
   All three change what the coach says, not just what it looks like.

   GRILL cooks expose  plan(doneness?) → [STEP]         (time engine)
   SMOKE/BBQ cooks expose  phases[] + pit config        (pit engine)

   STEP (grill):
     { action, cue, sub, sec, atEndF?, tag, rest? }

   PHASE (smoke / bbq):
     { tag, cue, sub, trigger:{atF}|{afterMin}|null, pull? }
     - phase[0] has no trigger; it is active the moment you light it.
     - trigger.atF     advances when the MEAT probe crosses that temp.
     - trigger.afterMin advances after that many minutes on the pit.
     - pull:true marks the final beat (pull it, then rest).

   Internal temp on the grill is ESTIMATED. On the pit it is what YOU
   dial in by hand from your own thermometer (hands-free ± bump), and
   the monitor projects the ETA from how fast it is actually climbing.
   ───────────────────────────────────────────────────────────── */

/* ═══════════════════ STEP 1 — THE MODE ═══════════════════ */
const MODES = [
  /* sub is set in ~175px of tile width — keep it to two short lines */
  { id: 'grill', glyph: '🔥', name: 'GRILL', tag: 'HOT & FAST',
    sub: 'Direct flame, minutes', q: 'CHOOSE A COOK', unit: 'CUTS' },
  { id: 'smoke', glyph: '🪵', name: 'SMOKE', tag: 'LOW & SLOW',
    sub: 'Wood at 225°F, hours', q: 'CHOOSE A CUT', unit: 'CUTS' },
  { id: 'bbq',   glyph: '🍖', name: 'BBQ',   tag: 'INDIRECT',
    sub: '275–325°F, a while', q: 'CHOOSE A CUT', unit: 'CUTS' },
];

/* ═══════════════════ STEP 2 — THE FIRE ═══════════════════
   The fuel is not decoration. It decides:
     lever    — the thing you physically turn to change the heat
     ready    — how you know the fire is actually ready
     steps    — the light-it walkthrough
     preheatMin — how long this fuel needs before food touches it
     lowFix   — pit-monitor alarm copy when the pit drops
     highFix  — ...and when it runs away
     spritz   — what the mid-cook nudge should say
     hint     — the one-line in-cook reminder for this fuel
   ─────────────────────────────────────────────────────────── */
const FUELS = {
  grill: [
    {
      id: 'charcoal', glyph: '🪨', name: 'CHARCOAL', tag: 'LUMP OR BRIQUETTE', preheatMin: 20,
      lever: 'BOTTOM VENT', ready: 'Coals ashed over grey',
      steps: [
        'Fill a chimney. One sheet of paper underneath, light it.',
        'Give it 15 minutes — the top coals go ashy grey.',
        'Dump them banked to one side, grate on, lid down 5 min.',
      ],
      lowFix: 'FEED IT COALS', highFix: 'CHOKE THE BOTTOM VENT',
      spritz: 'SPRITZ · CHECK THE COALS',
      hint: 'Two zones: hot side to sear, cool side to hide.',
    },
    {
      id: 'gas', glyph: '⛽', name: 'PROPANE', tag: 'GAS · KNOBS', preheatMin: 12,
      lever: 'THE KNOBS', ready: 'Lid thermometer settled',
      steps: [
        'Lid open, gas on, light the burners one at a time.',
        'All burners high, lid down, 10–15 min to preheat.',
        'Kill one burner — that side is now your cool zone.',
      ],
      lowFix: 'TURN THE BURNER UP', highFix: 'TURN THE BURNER DOWN',
      spritz: 'SPRITZ THE MEAT',
      hint: 'Preheat properly. A cold grate sticks to everything.',
    },
    {
      id: 'wood', glyph: '🌲', name: 'LIVE FIRE', tag: 'WOOD · COALS', preheatMin: 35,
      lever: 'THE RAKE', ready: 'Flames down, coals glowing',
      steps: [
        'Burn hardwood down hard — you cook on coals, not flames.',
        '30–40 min until the logs collapse into glowing embers.',
        'Rake a deep bed one side, thin the other, grate low.',
      ],
      lowFix: 'RAKE IN MORE COALS', highFix: 'SPREAD THE COALS OUT',
      spritz: 'SPRITZ · BURN DOWN MORE WOOD',
      hint: 'Never cook over flame. Flame is soot, coals are heat.',
    },
    {
      id: 'pellet', glyph: '🌾', name: 'PELLET', tag: 'HOPPER · DIAL', preheatMin: 15,
      lever: 'THE DIAL', ready: 'Set temp reached, smoke thinning',
      steps: [
        'Hopper full, dial to high, let it run through startup.',
        '12–15 min to come up and clear the white startup smoke.',
        'Searing? Grate direct over the firepot, or crank to max.',
      ],
      lowFix: 'BUMP THE DIAL UP', highFix: 'DIAL IT BACK',
      spritz: 'SPRITZ · CHECK THE HOPPER',
      hint: 'Pellet grills run cooler than they claim. Trust a probe.',
    },
  ],
  smoke: [
    {
      id: 'offset', glyph: '🌲', name: 'OFFSET', tag: 'STICK BURNER · SPLITS', preheatMin: 30,
      lever: 'FIREBOX & STACK', ready: 'Thin blue smoke, no white',
      steps: [
        'Coal base in the firebox, then feed dry hardwood splits.',
        'Stack wide open. Manage heat with the firebox intake only.',
        'Wait for thin blue smoke — white smoke is bitter food.',
      ],
      lowFix: 'ADD A SPLIT', highFix: 'CLOSE THE INTAKE DOWN',
      spritz: 'SPRITZ · TIME FOR ANOTHER SPLIT',
      hint: 'Small hot fires, often. A smouldering fire ruins meat.',
    },
    {
      id: 'charcoal', glyph: '🪨', name: 'CHARCOAL', tag: 'KETTLE · DRUM · KAMADO', preheatMin: 25,
      lever: 'BOTTOM VENT', ready: 'Settled at temp for 20 min',
      steps: [
        'Bank unlit coals, drop a small lit batch on one end.',
        'Add two chunks of wood, top vent wide, bottom nearly shut.',
        'Let it settle 20 min before you trust the number.',
      ],
      lowFix: 'CRACK THE BOTTOM VENT', highFix: 'CHOKE THE BOTTOM VENT',
      spritz: 'SPRITZ · CHECK THE COAL BED',
      hint: 'Chase temp with the bottom vent. Leave the top one open.',
    },
    {
      id: 'pellet', glyph: '🌾', name: 'PELLET', tag: 'SET IT & WALK AWAY', preheatMin: 15,
      lever: 'THE DIAL', ready: 'Holding the set temp',
      steps: [
        'Fill the hopper — a long cook eats more than you think.',
        'Set 225°F and let it stabilise for 15 min.',
        'Want more smoke? Run the first hours as low as it will hold.',
      ],
      lowFix: 'CHECK THE HOPPER & AUGER', highFix: 'DIAL IT BACK',
      spritz: 'SPRITZ · TOP UP THE HOPPER',
      hint: 'Steady but shy on smoke. A smoke tube fixes that.',
    },
    {
      id: 'electric', glyph: '🔌', name: 'ELECTRIC', tag: 'CABINET · THERMOSTAT', preheatMin: 30,
      lever: 'THERMOSTAT', ready: 'Chips smouldering at temp',
      steps: [
        'Set the thermostat and preheat empty for 30 min.',
        'Load the chip tray — a small handful, not a heap.',
        'Water pan full. It buffers the temp and keeps things moist.',
      ],
      lowFix: 'RAISE THE THERMOSTAT', highFix: 'LOWER THE THERMOSTAT',
      spritz: 'SPRITZ · RELOAD THE CHIPS',
      hint: 'Open the door as little as you can — it recovers slowly.',
    },
  ],
  bbq: [
    {
      id: 'charcoal', glyph: '🪨', name: 'CHARCOAL', tag: 'TWO-ZONE KETTLE', preheatMin: 20,
      lever: 'BOTTOM VENT', ready: 'Holding 275°F indirect',
      steps: [
        'Coals banked hard to one side. Food goes on the empty side.',
        'Drip pan under the meat, vents set for around 275°F.',
        'Top vent above the meat so the smoke pulls across it.',
      ],
      lowFix: 'FEED IT COALS', highFix: 'CHOKE THE BOTTOM VENT',
      spritz: 'SPRITZ · CHECK THE COALS',
      hint: 'Indirect means nothing under the meat. Nothing.',
    },
    {
      id: 'pellet', glyph: '🌾', name: 'PELLET', tag: 'HOPPER · DIAL', preheatMin: 15,
      lever: 'THE DIAL', ready: 'Holding the set temp',
      steps: [
        'Hopper full, dial to 275°F, run through startup.',
        '15 min to settle and clear the startup smoke.',
        'Grease tray lined — 275°F renders a lot of fat.',
      ],
      lowFix: 'BUMP THE DIAL UP', highFix: 'DIAL IT BACK',
      spritz: 'SPRITZ · CHECK THE HOPPER',
      hint: 'The whole chamber is indirect. Rotate racks instead.',
    },
    {
      id: 'gas', glyph: '⛽', name: 'PROPANE', tag: 'BURNERS OFF ONE SIDE', preheatMin: 12,
      lever: 'THE KNOBS', ready: 'Lid gauge steady at 275°F',
      steps: [
        'Light one side only. The food sits over the dead burners.',
        'Dial the lit side until the lid gauge holds 275°F.',
        'Smoke box or a foil pouch of chips over the live burner.',
      ],
      lowFix: 'TURN THE LIVE BURNER UP', highFix: 'TURN THE LIVE BURNER DOWN',
      spritz: 'SPRITZ · REFILL THE SMOKE BOX',
      hint: 'Gas gives you heat, not smoke. Add wood on purpose.',
    },
    {
      id: 'wood', glyph: '🌲', name: 'WOOD', tag: 'COALS RAKED ASIDE', preheatMin: 35,
      lever: 'THE RAKE', ready: 'Coal bed steady, flames gone',
      steps: [
        'Burn a good pile of hardwood down to a deep coal bed.',
        'Rake it all to one end, food at the far end, lid down.',
        'Feed one small split at a time to hold 275°F.',
      ],
      lowFix: 'ADD A SPLIT', highFix: 'PULL COALS AWAY',
      spritz: 'SPRITZ · FEED THE FIRE',
      hint: 'One split at a time. Two is a temperature spike.',
    },
  ],
};

/* ═══════════════════ STEP 3 — HOW MUCH HELP ═══════════════════
   The answer rewires the coach:
     steps   — spell out how to light this fuel on the fire stage.
               NOT a gate on the stage itself: every cook goes through
               it, because the timer must start when food touches the
               grate, not when you light the coals.
     subs    — keep the explanatory line under every cue
     hints   — show the fuel's heat lever + reminder during the cook
     alertMs — how long a heads-up holds before it clears itself
     safety  — surface the safe-temp floor everywhere it applies
   ───────────────────────────────────────────────────────────── */
const ASSIST_LEVELS = [
  { id: 'rookie', glyph: '🙋', name: 'FIRST TIME', tag: 'WALK ME THROUGH IT',
    sub: 'Light the fire together, every step explained',
    steps: true, subs: true, hints: true, alertMs: 5200, safety: true },
  { id: 'coach', glyph: '👊', name: 'COACH ME', tag: 'CUES & TIMERS',
    sub: 'Tell me the next move, skip the lecture',
    steps: true, subs: true, hints: false, alertMs: 3400, safety: true },
  { id: 'pro', glyph: '🤘', name: 'I GOT THIS', tag: 'NUMBERS ONLY',
    sub: 'Big clock, big temps, out of my way',
    steps: false, subs: false, hints: false, alertMs: 2400, safety: false },
];

/* Doneness ladders. pullF = pull here; the meat coasts up ~5°F
   resting (carryover), landing at servF. `short` keeps the picker
   on one line at HUD type sizes. */
const STEAK_DONENESS = [
  { key: 'rare',   label: 'Rare',        short: 'RARE',     pullF: 120, servF: 125 },
  { key: 'mr',     label: 'Medium Rare', short: 'MED RARE', pullF: 128, servF: 133, rec: true },
  { key: 'med',    label: 'Medium',      short: 'MEDIUM',   pullF: 138, servF: 143 },
  { key: 'mw',     label: 'Medium Well', short: 'MED WELL', pullF: 148, servF: 153 },
  { key: 'well',   label: 'Well Done',   short: 'WELL',     pullF: 158, servF: 160 },
];

const BURGER_DONENESS = [
  { key: 'med',  label: 'Medium',      short: 'MEDIUM',   pullF: 150, servF: 155 },
  { key: 'mw',   label: 'Medium Well', short: 'MED WELL', pullF: 155, servF: 160, rec: true },
  { key: 'well', label: 'Well Done',   short: 'WELL',     pullF: 160, servF: 165 },
];

/* Per-side sear seconds scale with how far you're cooking it.
   Keyed by doneness. Tuned for a ~1-inch cut on a hot grate. */
const STEAK_SIDE_SEC = { rare: 80, mr: 105, med: 140, mw: 175, well: 215 };
const BURGER_SIDE_SEC = { med: 150, mw: 180, well: 220 };

const COOKS = [
  /* ═══════════════════ GRILL — HOT & FAST ═══════════════════ */
  {
    id: 'ribeye', mode: 'grill', name: 'Ribeye Steak', glyph: '🥩',
    level: 'THE CLASSIC', cut: '1-inch cut · direct heat',
    grate: 'HIGH', safeF: 145, restSec: 300, startF: 52,
    doneness: STEAK_DONENESS,
    tips: [
      'Dry the surface & salt it. A dry steak sears, a wet steak steams.',
      'One flip is plenty. Chasing it around the grate just cools the sear.',
      'Thick cut (1½"+)? Reverse-sear: pull 15° below target, then blast both sides.',
    ],
    plan(d) {
      const s = STEAK_SIDE_SEC[d.key];
      const mid = Math.round(d.pullF - (d.pullF - this.startF) * 0.45);
      return [
        { action: 'SEAR', tag: 'SEAR', cue: 'SEAR, HANDS OFF',
          sub: 'Lay it down, lid open, and leave it to build a crust.',
          sec: s, atEndF: mid },
        { action: 'FLIP', tag: 'FLIP', cue: 'FLIP THE RIBEYE',
          sub: 'One clean flip. Crust side up now.',
          sec: s, atEndF: d.pullF },
        { action: 'PULL', tag: 'PULL', cue: `PULL AT ${d.pullF}°F`,
          sub: `Rest 5 min. It climbs to ~${d.servF}°F off the heat.`,
          sec: 300, atEndF: d.servF, rest: true },
      ];
    },
  },
  {
    id: 'burger', mode: 'grill', name: 'Burgers', glyph: '🍔',
    level: 'CROWD PLEASER', cut: '⅓-lb patties · direct heat',
    grate: 'MED-HIGH', safeF: 160, restSec: 120, startF: 48,
    doneness: BURGER_DONENESS,
    tips: [
      'Never press the patty. You are squeezing the juice into the fire.',
      'Thumb-dent the center so it stays flat instead of doming.',
      'Ground beef is safe only at 160°F. Don’t serve burgers rare.',
    ],
    plan(d) {
      const s = BURGER_SIDE_SEC[d.key];
      const mid = Math.round(d.pullF - (d.pullF - this.startF) * 0.5);
      return [
        { action: 'SEAR', tag: 'SIDE 1', cue: 'FIRST SIDE DOWN',
          sub: 'Set it and leave it. No pressing.',
          sec: s, atEndF: mid },
        { action: 'FLIP', tag: 'FLIP', cue: 'FLIP THE PATTIES',
          sub: 'One flip. Add cheese now if you want it molten.',
          sec: Math.round(s * 0.75), atEndF: Math.round((mid + d.pullF) / 2) },
        { action: 'MOVE', tag: 'MELT', cue: 'LID DOWN, MELT',
          sub: 'Cover to melt cheese and finish the center.',
          sec: Math.round(s * 0.35), atEndF: d.pullF },
        { action: 'PULL', tag: 'BUILD', cue: 'PULL & BUILD',
          sub: 'Rest 2 min, then dress the bun.',
          sec: 120, atEndF: d.servF, rest: true },
      ];
    },
  },
  {
    id: 'chicken-breast', mode: 'grill', name: 'Chicken Breast', glyph: '🍗',
    level: 'WEEKNIGHT', cut: 'Boneless · direct → indirect',
    grate: 'MED', safeF: 165, restSec: 300, startF: 46,
    tips: [
      'Pound it to an even thickness so it cooks edge-to-edge, not raw in the middle.',
      'Move it to a cooler zone once it’s marked. Direct heat dries it out.',
      '165°F, no exceptions. Pull at 162°F and let carryover finish it juicy.',
    ],
    plan() {
      return [
        { action: 'SEAR', tag: 'MARK', cue: 'MARK SIDE ONE',
          sub: 'Grate lines first. Don’t move it early.',
          sec: 210, atEndF: 95 },
        { action: 'FLIP', tag: 'FLIP', cue: 'FLIP THE CHICKEN',
          sub: 'Mark the second side.',
          sec: 210, atEndF: 130 },
        { action: 'MOVE', tag: 'INDIRECT', cue: 'SLIDE TO COOL ZONE',
          sub: 'Lid down, finish gently to temp.',
          sec: 300, atEndF: 162 },
        { action: 'PULL', tag: 'PULL', cue: 'PULL AT 162°F',
          sub: 'Rest 5 min. Carryover carries it past 165°F safe.',
          sec: 300, atEndF: 166, rest: true },
      ];
    },
  },
  {
    id: 'salmon', mode: 'grill', name: 'Salmon Fillet', glyph: '🐟',
    level: 'FAST & FANCY', cut: 'Skin-on · direct heat',
    grate: 'MED-HIGH', safeF: 145, restSec: 120, startF: 44,
    tips: [
      'Oil the FISH, not the grate, and start skin-side down.',
      'Cook ~80% of the way on the skin. It protects the flesh and crisps up.',
      'It’s done when it flakes and hits ~130°F. The FDA-safe number is 145°F.',
    ],
    plan() {
      return [
        { action: 'SEAR', tag: 'SKIN', cue: 'SKIN SIDE DOWN',
          sub: 'Let the skin crisp and release on its own.',
          sec: 300, atEndF: 105 },
        { action: 'FLIP', tag: 'FLIP', cue: 'GENTLE FLIP',
          sub: 'One spatula, quick turn. It’s delicate.',
          sec: 150, atEndF: 128 },
        { action: 'PULL', tag: 'PLATE', cue: 'PULL & PLATE',
          sub: 'Flakes easily at the thick end = done.',
          sec: 120, atEndF: 132, rest: true },
      ];
    },
  },
  {
    id: 'sausage', mode: 'grill', name: 'Sausages / Brats', glyph: '🌭',
    level: 'EASY', cut: 'Fresh links · med heat',
    grate: 'MED', safeF: 160, restSec: 60, startF: 46,
    tips: [
      'Low and steady. High heat splits the casing and dumps the juice.',
      'Roll a quarter-turn every couple minutes for even color.',
      'A beer + onion bath after grilling keeps them hot and juicy for a crowd.',
    ],
    plan() {
      return [
        { action: 'ROLL', tag: 'ROLL 1', cue: 'ROLL, QUARTER TURN',
          sub: 'Even color, no splitting.',
          sec: 180, atEndF: 110 },
        { action: 'ROLL', tag: 'ROLL 2', cue: 'ROLL AGAIN',
          sub: 'Next quarter turn.',
          sec: 180, atEndF: 140 },
        { action: 'ROLL', tag: 'ROLL 3', cue: 'LAST QUARTER TURN',
          sub: 'Bring it home to 160°F.',
          sec: 180, atEndF: 160 },
        { action: 'PULL', tag: 'BUN', cue: 'INTO THE BUN',
          sub: 'Rest a minute so the juice sets.',
          sec: 60, atEndF: 162, rest: true },
      ];
    },
  },
  {
    id: 'hotdog', mode: 'grill', name: 'Hot Dogs', glyph: '🌭',
    level: 'BEGINNER', cut: 'Pre-cooked · med heat',
    grate: 'MED', safeF: null, restSec: 0, startF: 50,
    tips: [
      'They’re already cooked. You’re only chasing char and heat.',
      'A shallow spiral score crisps the edges and holds toppings.',
      'Roll them so every side gets a little color.',
    ],
    plan() {
      return [
        { action: 'ROLL', tag: 'CHAR', cue: 'ROLL FOR CHAR',
          sub: 'Turn every side to the fire.',
          sec: 120 },
        { action: 'ROLL', tag: 'FINISH', cue: 'FINISH THE CHAR',
          sub: 'Blistered and hot through.',
          sec: 120 },
        { action: 'PULL', tag: 'DRESS', cue: 'DRESS & SERVE',
          sub: 'Toast the bun on the grate while you’re at it.',
          sec: 30, rest: true },
      ];
    },
  },
  {
    id: 'pork-chops', mode: 'grill', name: 'Pork Chops', glyph: '🥩',
    level: 'CORE', cut: '1-inch bone-in · direct heat',
    grate: 'MED-HIGH', safeF: 145, restSec: 180, startF: 48,
    tips: [
      'Pink is fine now. Pork is safe at 145°F with a 3-minute rest.',
      'Sear the fat edge too: stand chops on their side for a minute.',
      'A quick brine is the difference between juicy and shoe leather.',
    ],
    plan() {
      return [
        { action: 'SEAR', tag: 'SEAR', cue: 'SEAR SIDE ONE',
          sub: 'Build a crust before you touch it.',
          sec: 240, atEndF: 100 },
        { action: 'FLIP', tag: 'FLIP', cue: 'FLIP THE CHOP',
          sub: 'Second side down, then stand it on the fat edge.',
          sec: 240, atEndF: 140 },
        { action: 'PULL', tag: 'PULL', cue: 'PULL AT 142°F',
          sub: 'Rest 3 min → 145°F safe, still juicy.',
          sec: 180, atEndF: 146, rest: true },
      ];
    },
  },
  {
    id: 'shrimp', mode: 'grill', name: 'Shrimp Skewers', glyph: '🍤',
    level: 'FAST', cut: 'Peeled · skewered · direct heat',
    grate: 'HIGH', safeF: 120, restSec: 0, startF: 44,
    tips: [
      'They cook in a blink. Set a skewer down and stay put.',
      'A tight “C” is perfect; a tight “O” is overcooked and rubbery.',
      'Skewer two parallel sticks so they don’t spin when you flip.',
    ],
    plan() {
      return [
        { action: 'SEAR', tag: 'SIDE 1', cue: 'LAY THE SKEWERS',
          sub: 'First side, until edges turn opaque.',
          sec: 120, atEndF: 90 },
        { action: 'FLIP', tag: 'FLIP', cue: 'FLIP THE SKEWERS',
          sub: 'They curl into a loose “C” when ready.',
          sec: 90, atEndF: 120 },
        { action: 'PULL', tag: 'PLATE', cue: 'OFF NOW, DON’T WAIT',
          sub: 'Carryover finishes them on the plate.',
          sec: 20, atEndF: 122, rest: true },
      ];
    },
  },
  {
    id: 'veg', mode: 'grill', name: 'Veg & Corn', glyph: '🌽',
    level: 'SIDES', cut: 'Mixed veg · med-high heat',
    grate: 'MED-HIGH', safeF: null, restSec: 0, startF: 55,
    tips: [
      'Oil and salt right before they hit the grate so nothing sticks.',
      'Corn wants a quarter-turn every couple minutes for even char.',
      'Pull peppers & zucchini soft-with-bite; they keep cooking off the heat.',
    ],
    plan() {
      return [
        { action: 'ROLL', tag: 'CHAR 1', cue: 'CHAR & TURN',
          sub: 'Get color on the first faces.',
          sec: 180 },
        { action: 'ROLL', tag: 'CHAR 2', cue: 'TURN AGAIN',
          sub: 'Rotate to the next side.',
          sec: 180 },
        { action: 'ROLL', tag: 'CHAR 3', cue: 'LAST TURN',
          sub: 'Even char all around.',
          sec: 180 },
        { action: 'PULL', tag: 'PLATTER', cue: 'TO THE PLATTER',
          sub: 'Soft with a little bite is the sweet spot.',
          sec: 20, rest: true },
      ];
    },
  },

  /* ═══════════════════ SMOKE — LOW & SLOW ═══════════════════
     Pit monitor. Temp-driven. Ride the stall, wrap, pull at ~203°F. */
  {
    id: 'brisket', mode: 'smoke', name: 'Beef Brisket', glyph: '🔥',
    level: 'BOSS LEVEL', cut: 'Whole packer', pitF: 225, pitTol: 25,
    spritzMin: 45, startF: 40, stall: true, targetF: 203, safeF: null, restSec: 3600,
    tips: [
      'The stall is normal. Near 160°F it parks for hours as moisture cools the bark. Ride it out or wrap through it.',
      'Butcher paper over foil: it beats the stall while keeping the bark from going soft.',
      'Done is a feel, not a number. The probe should slide in like it’s warm butter, usually ~203°F.',
      'Rest an hour-plus, wrapped, in a dry cooler. This is not optional.',
    ],
    phases: [
      { tag: 'SMOKE', cue: 'ON THE SMOKE', sub: 'Fat-side up, lid down. Settle in around 225°F.' },
      { tag: 'STALL', cue: 'STALL INCOMING', sub: 'The climb flattens near 160°F. It’s moisture, not trouble.', trigger: { atF: 150 } },
      { tag: 'WRAP',  cue: 'WRAP AT 165°F',  sub: 'Butcher paper, tight. Powers you through the stall.', trigger: { atF: 165 } },
      { tag: 'PROBE', cue: 'START PROBING',  sub: 'Check for butter-tender every couple degrees now.', trigger: { atF: 198 } },
      { tag: 'PULL',  cue: 'PULL IT NOW',    sub: 'Probe slides with zero resistance. Rest it long.', trigger: { atF: 203 }, pull: true },
    ],
  },
  {
    id: 'pulled-pork', mode: 'smoke', name: 'Pulled Pork', glyph: '🐷',
    level: 'PITMASTER', cut: 'Boston butt', pitF: 250, pitTol: 25,
    spritzMin: 60, startF: 40, stall: true, targetF: 203, safeF: null, restSec: 2700,
    tips: [
      'Fat-cap up so it bastes the meat as it renders down.',
      'Expect the same stall as brisket near 160°F. Wrap to push through it.',
      'Pull it at ~203°F, when the blade bone wiggles free clean.',
    ],
    phases: [
      { tag: 'SMOKE', cue: 'FAT-CAP UP',    sub: 'Onto the smoke, lid down, around 250°F.' },
      { tag: 'STALL', cue: 'STALL INCOMING', sub: 'Same stall as brisket. Wrap to beat it.', trigger: { atF: 150 } },
      { tag: 'WRAP',  cue: 'WRAP AT 165°F',  sub: 'Foil or paper. Drive it to 203°F.', trigger: { atF: 165 } },
      { tag: 'PULL',  cue: 'PULL & SHRED',   sub: 'Blade bone wiggles free clean. Rest 45 min, then shred.', trigger: { atF: 203 }, pull: true },
    ],
  },
  {
    id: 'beef-short-ribs', mode: 'smoke', name: 'Beef Short Ribs', glyph: '🍖',
    level: 'PITMASTER', cut: 'Plate ribs', pitF: 250, pitTol: 25,
    spritzMin: 45, startF: 40, stall: true, targetF: 203, safeF: null, restSec: 1800,
    tips: [
      'These are big and beefy. Treat them like little briskets.',
      'Bark before wrap: let it set for hours so it survives the foil.',
      'Probe between the bones. Jiggly and tender beats any exact number.',
    ],
    phases: [
      { tag: 'SMOKE', cue: 'BONE-DOWN', sub: 'Onto the smoke, ~250°F, lid down.' },
      { tag: 'STALL', cue: 'STALL INCOMING', sub: 'They stall like brisket. Ride it.', trigger: { atF: 160 } },
      { tag: 'PROBE', cue: 'PROBE THE MEAT', sub: 'Feel between the bones for total give.', trigger: { atF: 198 } },
      { tag: 'PULL',  cue: 'PULL IT NOW',    sub: 'Jiggly and probe-tender. Rest 30 min.', trigger: { atF: 203 }, pull: true },
    ],
  },

  /* ═══════════════════ BBQ — INDIRECT & MEDIUM ═══════════════════
     Pit monitor, tuned hotter (~275-325°F). Sauce & glaze. A couple
     hours, done by time or a lower target temp. */
  {
    id: 'ribs', mode: 'bbq', name: 'Pork Ribs (3-2-1)', glyph: '🍖',
    level: 'CROWD FAVORITE', cut: 'Spare ribs', pitF: 275, pitTol: 25,
    spritzMin: 45, startF: 44, stall: false, noProbe: true, safeF: null, restSec: 600,
    tips: [
      'Peel the silverskin off the bone side or the rub never gets in.',
      '3-2-1: 3 hrs bare smoke, 2 hrs wrapped with liquid, 1 hr saucing open.',
      'The bend test beats any thermometer: lift a rack and it should crack, not snap.',
    ],
    phases: [
      { tag: 'SMOKE', cue: 'BONE-DOWN, BARE', sub: 'Phase 1: 3 hrs of open smoke at 275°F.' },
      { tag: 'WRAP',  cue: 'WRAP WITH LIQUID', sub: 'Phase 2: foil + butter/juice, 2 hrs to tenderize.', trigger: { afterMin: 180 } },
      { tag: 'SAUCE', cue: 'UNWRAP & SAUCE',  sub: 'Phase 3: 1 hr open to set the glaze and firm the bark.', trigger: { afterMin: 300 } },
      { tag: 'BEND',  cue: 'BEND TEST',       sub: 'Lift a rack, the surface should crack. Rest 10 min.', trigger: { afterMin: 360 }, pull: true },
    ],
  },
  {
    id: 'spatchcock-chicken', mode: 'bbq', name: 'Spatchcock Chicken', glyph: '🍗',
    level: 'ACCESSIBLE', cut: 'Whole, flattened', pitF: 325, pitTol: 25,
    spritzMin: 0, startF: 45, stall: false, targetF: 175, safeF: 165, restSec: 600,
    tips: [
      'Spatchcock (backbone out, press flat) so it cooks evenly and fast.',
      'Run it hotter, ~325°F, or you get rubbery bite-through skin.',
      'Breast 165°F, thigh 175°F. The thigh is the one that lags.',
    ],
    phases: [
      { tag: 'ROAST', cue: 'SKIN-UP, FLAT', sub: 'Onto the grill, indirect, around 325°F.' },
      { tag: 'CRISP', cue: 'CRISP THE SKIN', sub: 'Skin drying? Nudge the heat up to set it.', trigger: { atF: 150 } },
      { tag: 'GLAZE', cue: 'BRUSH THE GLAZE', sub: 'Sauce it now so it sets in the last stretch.', trigger: { atF: 160 } },
      { tag: 'PULL',  cue: 'PULL AT 175°F',  sub: 'Thigh 175°F, breast 165°F. Rest 10 min before carving.', trigger: { atF: 175 }, pull: true },
    ],
  },
  {
    id: 'wings', mode: 'bbq', name: 'BBQ Wings', glyph: '🍗',
    level: 'GAME DAY', cut: 'Whole wings', pitF: 300, pitTol: 25,
    spritzMin: 0, startF: 46, stall: false, targetF: 175, safeF: 165, restSec: 120,
    tips: [
      'Render low, crisp hot. That two-step is the whole trick.',
      'A little baking powder in the rub dries the skin for extra crunch.',
      'Wings taste best pulled hotter than safe, ~175°F, which renders the connective tissue.',
    ],
    phases: [
      { tag: 'ROAST', cue: 'INDIRECT TO RENDER', sub: 'Around 300°F to melt the fat out of the skin.' },
      { tag: 'CRISP', cue: 'CRANK & CRISP', sub: 'Slide over direct heat to blister the skin.', trigger: { atF: 150 } },
      { tag: 'SAUCE', cue: 'TOSS IN SAUCE', sub: 'Off the heat, into the bowl, coat every wing.', trigger: { atF: 175 }, pull: true },
    ],
  },
  {
    id: 'tri-tip', mode: 'bbq', name: 'Tri-Tip', glyph: '🥩',
    level: 'REVERSE SEAR', cut: 'Whole roast', pitF: 300, pitTol: 25,
    spritzMin: 0, startF: 42, stall: false, targetF: 128, safeF: 145, restSec: 480,
    tips: [
      'Reverse sear: roast it gently, then blast it hot at the end.',
      'It’s a big steak, not a roast. Med-rare (~130°F) is the target.',
      'Always slice across the grain, and the grain changes direction, so watch it.',
    ],
    phases: [
      { tag: 'ROAST', cue: 'FAT-CAP UP', sub: 'Indirect at 300°F, building a salt-and-pepper bark.' },
      { tag: 'WATCH', cue: 'WATCH THE CLIMB', sub: 'Getting close. Have the hot side ready to sear.', trigger: { atF: 105 } },
      { tag: 'SEAR',  cue: 'SEAR ALL SIDES', sub: 'Pull to direct heat, ~60s a side for the crust.', trigger: { atF: 118 } },
      { tag: 'PULL',  cue: 'PULL AT 128°F',  sub: 'Med-rare. Rest 8 min, slice across the grain.', trigger: { atF: 128 }, pull: true },
    ],
  },
];

/* Doneness reference for the TEMP GUIDE screen (beginner safety net). */
const TEMP_GUIDE = [
  { name: 'Beef / Lamb steak', note: 'whole cut', temp: '145°F', sub: 'med-rare eats at 130–135°F' },
  { name: 'Ground beef / Burger', note: 'always', temp: '160°F', sub: 'no rare burgers' },
  { name: 'Pork', note: 'chops & roasts', temp: '145°F', sub: '+ 3 min rest, pink is OK' },
  { name: 'Chicken / Turkey', note: 'all cuts', temp: '165°F', sub: 'thighs shine at 175°F' },
  { name: 'Fish', note: 'flaky', temp: '145°F', sub: 'salmon eats great at ~130°F' },
  { name: 'Brisket / Pulled pork', note: 'low & slow', temp: '~203°F', sub: 'done by feel, probe-tender' },
];
