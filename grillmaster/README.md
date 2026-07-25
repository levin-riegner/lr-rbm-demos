# Grillmaster

A hands-free grilling, smoking, and BBQ coach for the [Meta Ray-Ban Display glasses](https://wearables.developer.meta.com/docs). Your hands are on the tongs, greasy and full, and your phone is useless in the sun. Grillmaster lives in the corner of your eye instead. It runs three cooks that are genuinely different jobs, and coaches each one the way it actually wants to be cooked.

> 🚀 **Live demo:** [rbm-demos.lnr.io/grillmaster](https://rbm-demos.lnr.io/grillmaster/)

## Three questions before any food

Nothing on the fire is generic, so the app asks the three things a person actually decides — in that order — and carries every answer into the live cook.

1. **MODE** — grill, smoke, or bbq, as three tiles across the full width so the first screen never scrolls. Picks which engine coaches you.
2. **FIRE** — charcoal, propane, live fire, pellet, electric (the list changes per mode). This is not a cosmetic choice: it decides what you turn to change the heat, how the app walks you through lighting it, and what the alarms say.
3. **HELP** — how much hand-holding you want. **FIRST TIME** lights the fire with you step by step and keeps a fuel reminder on screen; **COACH ME** gives cues and timers, no lecture; **I GOT THIS** drops every explanatory line and spends the space on bigger numbers.

Then, and only then, the cuts.

## Three modes, two engines

- **GRILL** — hot & fast, direct heat, minutes. Steaks, burgers, chicken, salmon, sausages, dogs, chops, shrimp, veg. A **flip coach**: the big card shows the one next action with the countdown ring beside it, and you can stack several items into one cook so the steak, the corn, and the shrimp all come off together (the hard part of grilling).
- **SMOKE** — low & slow over wood, ~225°F, hours, driven by temperature. Brisket, pulled pork, beef short ribs. A **pit monitor**, not a countdown: pit temp and meat temp side by side, the stall called out when the climb flattens, wrap and pull *at temperature*, and a self-correcting ETA that recomputes from how fast the meat is actually climbing.
- **BBQ** — indirect medium heat, ~275–325°F, a couple hours. The backyard-cookout cuts: ribs (3-2-1), spatchcock chicken, wings, tri-tip. Same pit monitor, tuned hotter, with saucing and glazing cues and a lower target temp. Some cooks advance on temperature, some on time (ribs by the clock and the bend test).

## What it does

- **One thing at a time.** GRILL always shows the single next move ("FLIP THE RIBEYE") at 40px with the clock next to it, so a glance is enough. No menus to read mid-cook.
- **The alarms speak your fire.** A pit that drops reads `PIT LOW · FEED IT COALS` on a kettle, `PIT LOW · TURN THE BURNER UP` on gas, `PIT LOW · ADD A SPLIT` on an offset. Same for the spritz nudge and the heat-lever reminder.
- **A fire primer for first-timers.** Pick FIRST TIME and the cook starts with the three steps that actually light *your* fuel, plus what the heat lever is and how you know it's ready.
- **Live temperature.** GRILL eases an *estimated* internal temp toward your target with a heat bar. SMOKE and BBQ take the real reading you dial in by hand and show meat and pit together, always next to the target and the USDA-safe floor.
- **Hands-free temp entry.** On the pit you glance at your own thermometer and bump the reading with the D-pad. Each bump feeds the ETA and trips the wrap/pull thresholds. No Bluetooth probe required.
- **Real smoking coaching.** The stall is detected and explained, not just waited out. Wrap fires at 165°F, pull at ~203°F, and the ETA says "STALL, ride it out" when the climb goes flat.
- **Doneness, done right.** Steaks and burgers get a doneness ladder with carryover-aware pull temps (pull 5°F early, the meat keeps climbing off the heat).
- **Cue alerts.** Every phase change fires a full-bleed heads-up with a chime and a haptic buzz, then auto-clears — held longer for first-timers, snapped away fast for pros.
- **Temp Guide** and **survives a nap**: a built-in food-safety reference, and an in-progress cook saved locally so if the glasses sleep and wake you land right back on it (a must for an overnight brisket).

## Built for the lens

- **600×600, full width.** Content spans the whole 548px column instead of a narrow centered card. Choices are wide rows, gauges sit side by side, and the coach puts the cue beside the clock — big type reads better across than stacked down, so there is far less to cram into 600px of height.
- **One centered axis.** Every title, cue, row, gauge and footer is centered on it. Back arrows and the ▲▼ bump affordance are absolutely positioned so they never pull a title off center. Mixed alignment reads as noise on a display you only ever glance at.
- **Bright, not washed.** The waveguide is additive and only ever subtracts contrast, so labels, rules and glyphs all sit above web-normal luminance. There is no ambient background gradient anywhere — a wash bleaches against the real world, so the only decoration is a single hot rule and the glow on the type itself.

## Controls

### The three questions and the cook list

| Where | Input | Result |
| --- | --- | --- |
| Mode (3 tiles across) | ◀ / ▶ | Move between GRILL, SMOKE and BBQ |
| Mode (3 tiles across) | ▲ / ▼ | Hop between the tiles and the footer |
| Fire / Help | ▲ / ▼ | Move down the list of choices |
| Any question | Enter | Choose it and go to the next question |
| Fire / Help / Cook list | ◀ | Step back one question |
| Cook list | Enter | Open that cut's setup |
| Setup | ▲ / ▼ | Move between doneness, ADD, and LIGHT IT |
| Setup | Enter | Pick a doneness, stack another item, or light the fire |

### Grill (flip coach)

| Where | Input | Result |
| --- | --- | --- |
| Coach | ▲ / ▼ | Switch which item is in the big card |
| Coach | Enter | **DID IT** — confirm the cue and advance that item |
| Coach | ▶ | Cycle the pro tip |
| Coach | ◀ | End the cook |
| Cue alert | Enter | Acknowledge the heads-up |

### Smoke & BBQ (pit monitor)

| Where | Input | Result |
| --- | --- | --- |
| Monitor | ◀ / ▶ | Move across the control bar (MEAT · PIT · SPRITZ · TIP · END) |
| Monitor | ▲ / ▼ | With MEAT or PIT selected, bump that temperature ±5°F |
| Monitor | Enter | Activate the selected control (log spritz, cycle tip, confirm PULL, end) |
| Cue alert | Enter | Acknowledge the heads-up |

The countdown and thresholds do the work on their own; your inputs just tell the coach what the fire and the meat are actually doing.

## Screenshots

Reproducible via `?state=` URL routing (see below).

> 📸 The shots below predate the three-question flow and the larger, brighter type — rerun the capture loop to refresh them, and to add the new `mode`, `fuel`, `assist`, `fire`, `coach-rookie`, and `coach-pro` states, which already have `?state=` keys but no PNG yet.

| Cook list · Grill | Cook list · Smoke | Cook list · BBQ |
| --- | --- | --- |
| ![Grill cook list](screenshots/home.png) | ![Smoke cook list](screenshots/home-smoke.png) | ![BBQ cook list](screenshots/home-bbq.png) |

| Grill setup | Grill coach (multi-item) | Cue alert |
| --- | --- | --- |
| ![Setup](screenshots/setup.png) | ![Coach](screenshots/coach.png) | ![Cue](screenshots/cue.png) |

| Smoke setup | Pit monitor · brisket | Pit alarm + spritz |
| --- | --- | --- |
| ![Smoke setup](screenshots/setup-smoke.png) | ![Monitor](screenshots/monitor.png) | ![Alarm](screenshots/monitor-alarm.png) |

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
         setup setup-smoke setup-bbq fire fire-smoke \
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
├── index.html      # screen scaffold — mode, fire, help, cook list, setup, fire primer, coach, pit monitor, done, guide, help
├── styles.css      # ember-on-black HUD theme, full-width and lens-bright
├── data.js         # modes, fuels, assist levels + the cook library (grill flip-timelines, smoke/bbq pit phases, temps, tips)
├── app.js          # the three-question flow, two engines (grill flip coach + temp-driven pit monitor), D-pad, alerts, persistence
├── favicon.svg
├── README.md
└── screenshots/    # generated via ?state= routing
```

<sub>Made by Alex Levin at [L+R](https://www.levinriegner.com).</sub>
