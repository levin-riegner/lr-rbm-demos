# Grillmaster

A hands-free grilling, smoking, and BBQ coach for the [Meta Ray-Ban Display glasses](https://wearables.developer.meta.com/docs). Your hands are on the tongs, greasy and full, and your phone is useless in the sun. Grillmaster lives in the corner of your eye instead. It runs three cooks that are genuinely different jobs, and coaches each one the way it actually wants to be cooked.

> 🚀 **Live demo:** [rbm-demos.lnr.io/grillmaster](https://rbm-demos.lnr.io/grillmaster/)

## One question per screen

Nothing asks two things at once. Each screen puts one question in 34px type, takes the answer, and gets out of the way — which is exactly what buys the rest of the app its size.

1. **MODE** — grill, smoke, or bbq, as three tiles across the full width so the first screen never scrolls.
2. **FIRE** — charcoal, propane, live fire, pellet, electric, offset (the list changes per mode). Not a cosmetic choice: it decides what you turn to change the heat, how the app walks you through lighting it, and what the alarms say.
3. **HELP** — how much hand-holding. **FIRST TIME** spells out the lighting and keeps a fuel reminder on the HUD; **COACH ME** gives cues and timers, no lecture; **I GOT THIS** drops every explanatory line and spends the space on bigger numbers.
4. **FOOD** — which cut, each row carrying its rough time and heat.
5. **TASTE** — the doneness ladder, on its own screen, with the pull and eating temp on every rung. Cuts without a ladder (chicken, salmon, anything on the pit) skip this step, and the breadcrumb drops it rather than showing a step you were never asked.
6. **PLAN** — the numbers you're committing to: pull temp, safe minimum, estimated time. Stack another item here and they all come off together.
7. **FIRE** — light it. Every cook goes through this, at every assist level.

A breadcrumb across the top of each screen shows where you are in that chain.

## The fire is a stage, not a button

The cook timer measures *food on the grate*, so it cannot start while the grate is cold — which is why picking a steak never drops you straight into a running countdown. The fire gets its own screen with a real clock on it:

- **PREHEAT** starts a countdown sized to your fuel — 12 minutes for propane, 20 for charcoal, 35 for a wood fire burning down to coals — and chimes when it's up to temp, on whatever screen you happen to be looking at.
- It keeps running if you step back to browse other cuts.
- **FOOD'S ON** is the thing that actually starts the cook. Already have a hot grill? Skip the timer and go straight there.
- Assist level changes how much of the lighting is spelled out, not whether the stage exists.

## Three modes, two engines

- **GRILL** — hot & fast, direct heat, minutes. Steaks, burgers, chicken, salmon, sausages, dogs, chops, shrimp, veg. A **flip coach**: the big card shows the one next action with the countdown ring beside it, and you can stack several items into one cook so the steak, the corn, and the shrimp all come off together (the hard part of grilling).
- **SMOKE** — low & slow over wood, ~225°F, hours, driven by temperature. Brisket, pulled pork, beef short ribs. A **pit monitor**, not a countdown: pit temp and meat temp side by side, the stall called out when the climb flattens, wrap and pull *at temperature*, and a self-correcting ETA that recomputes from how fast the meat is actually climbing.
- **BBQ** — indirect medium heat, ~275–325°F, a couple hours. The backyard-cookout cuts: ribs (3-2-1), spatchcock chicken, wings, tri-tip. Same pit monitor, tuned hotter, with saucing and glazing cues and a lower target temp. Some cooks advance on temperature, some on time (ribs by the clock and the bend test).

## What it does

- **One thing at a time.** GRILL always shows the single next move ("FLIP THE RIBEYE") at 44px with the clock next to it, so a glance is enough. No menus to read mid-cook.
- **The alarms speak your fire.** A pit that drops reads `PIT LOW · FEED IT COALS` on a kettle, `PIT LOW · TURN THE BURNER UP` on gas, `PIT LOW · ADD A SPLIT` on an offset. Same for the spritz nudge and the heat-lever reminder.
- **A preheat clock, per fuel.** The fire stage counts down your fuel's real warm-up time and chimes when it's ready, wherever you are in the app. FIRST TIME also gets the three steps that actually light *that* fuel.
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
| Fire | ▲ / ▼ | Move between PREHEAT and FOOD'S ON |
| Fire | Enter | Start/cancel the preheat clock, or put the food on |

### Grill (flip coach)

| Where | Input | Result |
| --- | --- | --- |
| Coach | ▲ / ▼ | Switch which item is in the big card |
| Coach | Enter | **DID IT** — confirm the cue and advance that item |
| Coach | ▶ | Cycle the pro tip |
| Coach | ◀ or **END COOK** | Asks first — see below |
| End confirm | ◀ / ▶ | Move between KEEP COOKING and END IT |
| Cue alert | Enter | Acknowledge the heads-up |

### Smoke & BBQ (pit monitor)

| Where | Input | Result |
| --- | --- | --- |
| Monitor | ◀ / ▶ | Move across the control bar (MEAT · PIT · SPRITZ · TIP · END) |
| Monitor | ▲ / ▼ | With MEAT or PIT selected, bump that temperature ±5°F |
| Monitor | Enter | Activate the selected control (log spritz, cycle tip, confirm PULL, end) |
| End confirm | ◀ / ▶ | Move between KEEP COOKING and END IT |
| Cue alert | Enter | Acknowledge the heads-up |

On the monitor ◀ and ▶ belong to the control bar, so there is no back gesture mid-cook — the **END** field is the way out, and it asks first.

The countdown and thresholds do the work on their own; your inputs just tell the coach what the fire and the meat are actually doing.

## Screenshots

Reproducible via `?state=` URL routing (see below).

> 📸 The shots below predate the one-question-per-screen flow and the larger, brighter type — rerun the capture loop to refresh them, and to add the new `mode`, `fuel`, `assist`, `doneness`, `plan`, `fire`, `fire-preheat`, `coach-rookie` and `coach-pro` states, which already have `?state=` keys but no PNG yet. `setup` is kept as an alias for `plan`.

| Cook list · Grill | Cook list · Smoke | Cook list · BBQ |
| --- | --- | --- |
| ![Grill cook list](screenshots/home.png) | ![Smoke cook list](screenshots/home-smoke.png) | ![BBQ cook list](screenshots/home-bbq.png) |

| The plan | Grill coach (multi-item) | Cue alert |
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
for s in mode fuel fuel-smoke assist home home-smoke home-bbq \
         doneness doneness-burger plan plan-smoke plan-bbq \
         fire fire-preheat fire-pro fire-smoke \
         coach coach-rookie coach-pro cue \
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
├── index.html      # one section per screen — mode, fire, help, food, taste, plan, fire stage, coach, pit monitor, done, guide, help
├── styles.css      # ember-on-black HUD theme: big, bright, full-width, one centred axis
├── data.js         # modes, fuels (lever + lighting + preheat + alarm copy), assist levels, and the cook library
├── app.js          # the question flow, the preheat clock, two engines (grill flip coach + temp-driven pit monitor), D-pad, alerts, persistence
├── favicon.svg
├── README.md
└── screenshots/    # generated via ?state= routing
```

<sub>Made by Alex Levin at [L+R](https://www.levinriegner.com).</sub>
