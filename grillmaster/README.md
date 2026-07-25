# Grillmaster

A hands-free grilling, smoking, and BBQ coach for the [Meta Ray-Ban Display glasses](https://wearables.developer.meta.com/docs). Your hands are on the tongs, greasy and full, and your phone is useless in the sun. Grillmaster lives in the corner of your eye instead. It runs three cooks that are genuinely different jobs, and coaches each one the way it actually wants to be cooked.

> 🚀 **Live demo:** [rbm-demos.lnr.io/grillmaster](https://rbm-demos.lnr.io/grillmaster/)

## Opening it

A **canvas splash** on a cold start: a bed of coals breathing at the bottom, sparks lifting off them, and GRILLMASTER heating through the colours steel actually passes through — dull brown, coal red, ember orange, white — left to right, one letter at a time. Everything is painted on cleared canvas, so the black stays black and only the hot pixels reach your eye. Any input skips it, it honours `prefers-reduced-motion`, and it never appears for a `?state=` capture or a resumed cook.

Then, on a first launch only, **BEFORE YOU LIGHT IT** — five plain lines, in the same numbered form as the lighting steps so it reads as part of the app rather than a warning label bolted on:

1. Water nearby — but never on a grease fire.
2. Clean grate, empty grease tray.
3. Three feet of clear air. Never indoors.
4. Coals stay hot for hours. Metal can only.
5. Raw and cooked never share a plate.

Each one is there because it prevents a fire, a poisoning or a burn. The wind, the mitts and the leak check live in the per-fuel lighting steps instead, where they're actually relevant — including the one that matters most, *lid open before the gas goes on*.

It's reachable any time from **SAFETY** on the front door.

## One question per screen

Nothing asks two things at once. Each screen puts one question in 34px type, takes the answer, and gets out of the way — which is exactly what buys the rest of the app its size.

1. **MODE** — grill, smoke, or bbq, as three tiles across the full width so the first screen never scrolls.
2. **FIRE** — charcoal, propane, live fire, pellet, electric, offset (the list changes per mode). Not a cosmetic choice: it decides what you turn to change the heat, how the app walks you through lighting it, and what the alarms say.
3. **HELP** — how much hand-holding. **FIRST TIME** is walked through lighting the fire right here, before anything else, and keeps a fuel reminder on the HUD; **COACH ME** gives cues and timers, no lecture; **I GOT THIS** drops every explanatory line and spends the space on bigger numbers.
4. **FOOD** — which cut, each row carrying its rough time and heat.
5. **TASTE** — the doneness ladder, on its own screen, with the pull and eating temp on every rung. Cuts without a ladder (chicken, salmon, anything on the pit) skip this step, and the breadcrumb drops it rather than showing a step you were never asked.
6. **PLAN** — the numbers you're committing to: pull temp, safe minimum or rest, estimated time. One cut per cook.
7. **FIRE** — the ready gate: is it hot? Then the food goes on.

A breadcrumb across the top of each screen shows where you are in that chain.

## Lighting the fire comes first, because it does

You don't pick your doneness and *then* light the coals — you light them, and they take 12 to 35 minutes while you work out what you're actually cooking. So the fire screen does two different jobs at two different moments, and never repeats itself.

**Up front, once, only if you asked.** Answer FIRST TIME to the HELP question and the very next thing is the three steps that light *your* fuel — a chimney and one sheet of paper for charcoal, burn hardwood down to embers for live fire, run the startup cycle for pellets. COACH ME and I GOT THIS never see it.

**At the end, the ready gate.** `IS THE FIRE READY?`, answered by two plain sentences — *"Ready when: coals ashed over grey."* and *"Change the heat with the bottom vent."* — and nothing else. No walkthrough, because by now the fire is lit.

Every action on that screen is a **full-width row that says what pressing it does**, stacked in the order you'd actually do them:

```
IS THE FIRE READY?
CHARCOAL · GRILL

Ready when: coals ashed over grey.
Change the heat with the bottom vent.

┌──────────────────────────────────┐
│    SHOW ME HOW TO LIGHT IT       │
├──────────────────────────────────┤
│    START A 20 MIN TIMER          │
├──────────────────────────────────┤
│    PUT THE FOOD ON               │
└──────────────────────────────────┘
```

No side-by-side pair to compare before you can act, and no caption underneath explaining which button to press — if a screen needs that, its buttons are wrong.

- **The timer** counts down your fuel's real warm-up — 12 minutes for propane, 20 for charcoal, 35 for wood burning down to coals — and chimes when it's up to temp, on whatever screen you're looking at.
- **The fire keeps burning while you answer the rest.** The cook list and the plan carry a live `🔥 11:04` chip that flips green to `🔥 READY`, so you never lose track of a fire you already lit.
- **PUT THE FOOD ON** is what actually starts the cook, because the cook timer measures food on the grate. Already have a hot grill? Press it and skip the timer.

## Three modes, two engines

- **GRILL** — hot & fast, direct heat, minutes. Steaks, burgers, chicken breast, chicken skewers, salmon, sausages & brats, dogs, chops, shrimp skewers, veg. A **flip coach**: the big card shows the one next action with the countdown ring beside it, and confirms each beat as you do it.
- **SMOKE** — low & slow over wood, ~225°F, hours, driven by temperature. Brisket, pulled pork, beef short ribs. A **pit monitor**, not a countdown: pit temp and meat temp side by side, the stall called out when the climb flattens, wrap and pull *at temperature*, and a self-correcting ETA that recomputes from how fast the meat is actually climbing.
- **BBQ** — indirect medium heat, ~275–325°F, a couple hours. The backyard-cookout cuts: ribs (3-2-1), spatchcock chicken, wings, tri-tip. Same pit monitor, tuned hotter, with saucing and glazing cues and a lower target temp. Some cooks advance on temperature, some on time (ribs by the clock and the bend test).

## What it does

- **One thing at a time, and it means it.** One cut per cook, one instruction on screen, one button that matters. Nothing to switch between mid-cook.
- **The cue never tells you to do what you just did.** Every step carries two lines: the action that *starts* it and the state you're in *during* it. Press DONE on "FLIP THE RIBEYE" and the screen changes to **SECOND SIDE DOWN** — because you already flipped it, and you're now waiting. The old version left the flip instruction up for the whole side.
- **The confirm button only shouts when it's your turn.** Mid-step the countdown is doing the work, so the button goes quiet — outlined, normal size, and honest about what pressing it means: **I DID IT ALREADY**. The moment the cue comes due it turns orange, grows and pulses: **DONE ✓**. A big filled button under a "hands off" instruction is an invitation to skip a whole beat of the cook.
- **RESET TIMER puts the current beat back to full.** For when you got pulled away, or the cue fired before you were ready — the beat is right, the clock just needs another run at it. It re-arms that beat's cue too.
- **PAUSE stops the whole cook.** Beer run, flare-up, phone call. Countdowns, elapsed time, spritz intervals and the temperature projection all freeze together on one cook clock rather than drifting apart, the ring greys out so a frozen timer never looks live, and RESUME picks up exactly where it stopped.
- **The alarms speak your fire.** A pit that drops reads `PIT LOW · FEED IT COALS` on a kettle, `PIT LOW · TURN THE BURNER UP` on gas, `PIT LOW · ADD A SPLIT` on an offset. Same for the spritz nudge and the heat-lever reminder.
- **A preheat clock, per fuel.** Counts down your fuel's real warm-up time, keeps running across every screen, and chimes when it's ready wherever you are. FIRST TIME gets walked through lighting it up front; everyone else can pull the steps up on demand and is otherwise never shown them.
- **Live temperature.** GRILL eases an *estimated* internal temp toward your target with a heat bar. SMOKE and BBQ take the real reading you dial in by hand and show meat and pit together, always next to the target and the USDA-safe floor.
- **Hands-free temp entry.** On the pit you glance at your own thermometer and bump the reading with the D-pad. Each bump feeds the ETA and trips the wrap/pull thresholds. No Bluetooth probe required.
- **Real smoking coaching.** The stall is detected and explained, not just waited out. Wrap fires at 165°F, pull at ~203°F, and the ETA says "STALL, ride it out" when the climb goes flat.
- **Doneness, done right.** Steaks and burgers get a doneness ladder with carryover-aware pull temps (pull 5°F early, the meat keeps climbing off the heat).
- **Cue alerts.** Every phase change fires a full-bleed heads-up with a chime and a haptic buzz, then auto-clears — held longer for first-timers, snapped away fast for pros.
- **A live cook is not one swipe from gone.** ◀ means "one question back" everywhere else, and the touchpad mirrors swipes onto it, so mid-cook it asks instead: *END THIS COOK? — RIBEYE STEAK · 0:08 to FLIP · 3 on the fire*, with KEEP COOKING focused by default. Nine hours of brisket should take more than a stray gesture to throw away.
- **Temp Guide** and **survives a nap**: a built-in food-safety reference, and an in-progress cook saved locally so if the glasses sleep and wake you land right back on it (a must for an overnight brisket).

## Built for the lens

- **A floor of 13px.** The whole small tier is three sizes — 13 / 14 / 15 — and nothing that carries meaning goes under 13px. Tracking on small caps stays at or under .18em, because on an additive lens over-spaced small type smears long before it looks airy.
- **600×600, full width.** Content spans the whole 548px column instead of a narrow centered card. Choices are wide rows, gauges sit side by side, and the coach puts the cue beside the clock — big type reads better across than stacked down, so there is far less to cram into 600px of height.
- **One centered axis.** Every title, cue, row, gauge and footer is centered on it. Back arrows and the ▲▼ bump affordance are absolutely positioned so they never pull a title off center. Mixed alignment reads as noise on a display you only ever glance at.
- **Nothing scrolls that shouldn't.** The mode tiles, the fuel and doneness ladders, the plan, the fire stage and the temp guide are all sized to fit 600px outright. The only scroller is the 9-deep grill cut list, and D-pad focus scrolls itself into view there.
- **Bright, not washed.** The waveguide is additive and only ever subtracts contrast, so labels, rules and glyphs all sit above web-normal luminance. There is no ambient background gradient anywhere — a wash bleaches against the real world, so the only decoration is a single hot rule and the glow on the type itself.

## Controls

### The three questions and the cook list

| Where | Input | Result |
| --- | --- | --- |
| Mode (3 tiles across) | ◀ / ▶ | Move between GRILL, SMOKE and BBQ |
| Mode (3 tiles across) | ▲ / ▼ | Hop between the tiles and the footer |
| Fire · Help · Food · Taste | ▲ / ▼ | Move down the list of choices |
| Any question | Enter | Answer it and go to the next one |
| Any question | ◀ | Step back one question |
| Plan | ▲ / ▼ | Move between + ADD and FIRE IT UP |
| Fire | ▲ / ▼ | Move down the three stacked actions |
| Fire | Enter | Show the steps, start/cancel the timer, or put the food on |

### Grill (flip coach)

| Where | Input | Result |
| --- | --- | --- |
| Coach | ◀ / ▶ | Walk the control row: END COOK · PAUSE · RESET TIMER · DONE |
| Coach | ▲ / ▼ | Cycle the pro tip for what's on the fire |
| Coach | Enter | Press the focused button — **DONE ✓** when a cue is due, **I DID IT ALREADY** to jump ahead |
| End confirm | ◀ / ▶ | Move between KEEP COOKING and END IT |
| Cue alert | Enter | Acknowledge the heads-up |

The control row is horizontal, so ◀ ▶ steer it — which leaves the vertical axis free for the tip and, more importantly, means no swipe can end a cook. **END COOK** is the only way out and it asks first.

### Smoke & BBQ (pit monitor)

| Where | Input | Result |
| --- | --- | --- |
| Monitor | ◀ / ▶ | Move across the control bar (MEAT · PIT · SPRITZ · TIP · PAUSE · END) |
| Monitor | ▲ / ▼ | With MEAT or PIT selected, bump that temperature ±5°F |
| Monitor | Enter | Activate the selected control (log spritz, cycle tip, confirm PULL, end) |
| End confirm | ◀ / ▶ | Move between KEEP COOKING and END IT |
| Cue alert | Enter | Acknowledge the heads-up |

On the monitor ◀ and ▶ belong to the control bar, so there is no back gesture mid-cook — the **END** field is the way out, and it asks first.

The countdown and thresholds do the work on their own; your inputs just tell the coach what the fire and the meat are actually doing.

## Screenshots

Reproducible via `?state=` URL routing (see below).

> 📸 The shots below predate the one-question-per-screen flow and the larger, brighter type — rerun the capture loop to refresh them, and to add the new `mode`, `fuel`, `assist`, `doneness`, `plan`, `fire-light`, `fire`, `fire-steps`, `splash`, `safety`, `home-preheating`, `coach-hold`, `coach-paused`, `coach-rookie` and `coach-pro` states, which already have `?state=` keys but no PNG yet. `setup` is kept as an alias for `plan`.

| Cook list · Grill | Cook list · Smoke | Cook list · BBQ |
| --- | --- | --- |
| ![Grill cook list](screenshots/home.png) | ![Smoke cook list](screenshots/home-smoke.png) | ![BBQ cook list](screenshots/home-bbq.png) |

| The plan | Grill coach | Cue alert |
| --- | --- | --- |
| ![Plan](screenshots/setup.png) | ![Coach](screenshots/coach.png) | ![Cue](screenshots/cue.png) |

| Smoke plan | Pit monitor · brisket | Pit alarm + spritz |
| --- | --- | --- |
| ![Smoke plan](screenshots/setup-smoke.png) | ![Monitor](screenshots/monitor.png) | ![Alarm](screenshots/monitor-alarm.png) |

| BBQ monitor · ribs (time) | Plated | Temp guide |
| --- | --- | --- |
| ![Monitor BBQ](screenshots/monitor-bbq.png) | ![Done](screenshots/done.png) | ![Guide](screenshots/guide.png) |

## Running locally

```sh
npx serve -l 4225 grillmaster
```

Then open `http://localhost:4225/` in Chrome sized to 600×600, or point the simulator at the local URL.

### Regenerating screenshots

> 🛠️ **Developer tooling only.** Chrome is a dev-time capture tool, not a runtime dependency of the app.

Each screen has a deterministic `?state=` key that mirrors the screenshot filename. Loop headless Chrome over them:

```sh
for s in splash safety mode fuel fuel-smoke assist home home-smoke home-bbq \
         doneness doneness-burger plan plan-smoke plan-bbq \
         fire-light fire-light-smoke fire fire-preheat fire-steps \
         fire-pro fire-smoke home-preheating \
         coach coach-hold coach-paused coach-rookie coach-pro cue \
         monitor monitor-stall monitor-alarm monitor-bbq done guide help; do
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    --headless --disable-gpu --force-device-scale-factor=2 \
    --window-size=600,600 --hide-scrollbars \
    --screenshot="grillmaster/screenshots/$s.png" \
    "http://localhost:4225/?state=$s"
done
```

## Files

```
grillmaster/
├── index.html      # one section per screen — splash, safety, mode, fire, help, food, taste, plan, fire stage, coach, pit monitor, done, guide, help
├── styles.css      # ember-on-black HUD theme: big, bright, full-width, one centred axis
├── data.js         # modes, fuels (lever + lighting + preheat + alarm copy), assist levels, safety rules, and the cook library
├── app.js          # the canvas splash, the question flow, the cook clock, two engines (grill flip coach + temp-driven pit monitor), D-pad, alerts, persistence
├── favicon.png    # 512×512 — the device does not support SVG favicons
├── README.md
└── screenshots/    # generated via ?state= routing
```

<sub>Made by Alex Levin at [L+R](https://www.levinriegner.com).</sub>
