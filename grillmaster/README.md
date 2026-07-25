# Grillmaster

A hands-free grilling, smoking, and BBQ coach for the [Meta Ray-Ban Display glasses](https://wearables.developer.meta.com/docs). Your hands are on the tongs, greasy and full, and your phone is useless in the sun. Grillmaster lives in the corner of your eye instead. It runs three cooks that are genuinely different jobs, and coaches each one the way it actually wants to be cooked.

> 🚀 **Live demo:** [rbm-demos.lnr.io/grillmaster](https://rbm-demos.lnr.io/grillmaster/)

## Three modes, two engines

- **GRILL** — hot & fast, direct heat, minutes. Steaks, burgers, chicken, salmon, sausages, dogs, chops, shrimp, veg. A **flip coach**: the big card shows the one next action and a countdown to it, and you can stack several items into one cook so the steak, the corn, and the shrimp all come off together (the hard part of grilling).
- **SMOKE** — low & slow over wood, ~225°F, hours, driven by temperature. Brisket, pulled pork, beef short ribs. A **pit monitor**, not a countdown: pit temp and meat temp side by side, the stall called out when the climb flattens, wrap and pull *at temperature*, and a self-correcting ETA that recomputes from how fast the meat is actually climbing.
- **BBQ** — indirect medium heat, ~275–325°F, a couple hours. The backyard-cookout cuts: ribs (3-2-1), spatchcock chicken, wings, tri-tip. Same pit monitor, tuned hotter, with saucing and glazing cues and a lower target temp. Some cooks advance on temperature, some on time (ribs by the clock and the bend test).

## What it does

- **One thing at a time.** GRILL always shows the single next move ("FLIP THE RIBEYE") so a glance is enough. No menus to read mid-cook.
- **Live temperature.** GRILL eases an *estimated* internal temp toward your target with a heat bar. SMOKE and BBQ take the real reading you dial in by hand and show meat and pit together, always next to the target and the USDA-safe floor.
- **Hands-free temp entry.** On the pit you glance at your own thermometer and bump the reading with the D-pad. Each bump feeds the ETA and trips the wrap/pull thresholds. No Bluetooth probe required.
- **Real smoking coaching.** The stall is detected and explained, not just waited out. Wrap fires at 165°F, pull at ~203°F, and the ETA says "STALL, ride it out" when the climb goes flat.
- **Pit management.** Dial the pit temp too; if it drifts out of the safe band the HUD alarms ("PIT LOW, FEED THE FIRE") and a spritz/fuel nudge fires on the cook's own interval.
- **Doneness, done right.** Steaks and burgers get a doneness ladder with carryover-aware pull temps (pull 5°F early, the meat keeps climbing off the heat).
- **Cue alerts.** Every phase change fires a full-bleed heads-up with a chime and a haptic buzz, then auto-clears so it never blocks your view.
- **Temp Guide** and **survives a nap**: a built-in food-safety reference, and an in-progress cook saved locally so if the glasses sleep and wake you land right back on it (a must for an overnight brisket).

## Controls

### Grill (flip coach)

| Input | Result |
| --- | --- |
| ▲ / ▼ | Switch which item is in the big card |
| Enter | **DID IT** — confirm the cue and advance that item |
| ▶ | Cycle the pro tip |
| ◀ | End the cook |

### Smoke & BBQ (pit monitor)

| Input | Result |
| --- | --- |
| ◀ / ▶ | Move across the control bar (MEAT · PIT · SPRITZ · TIP · END) |
| ▲ / ▼ | With MEAT or PIT selected, bump that temperature ±5°F |
| Enter | Activate the selected control (log spritz, cycle tip, confirm PULL, end) |
| Enter (on alert) | Acknowledge the heads-up |

The countdown and thresholds do the work on their own; your inputs just tell the coach what the fire and the meat are actually doing.

## Screenshots

Reproducible via `?state=` URL routing (see below).

| Home · Grill | Home · Smoke | Home · BBQ |
| --- | --- | --- |
| ![Grill home](screenshots/home.png) | ![Smoke home](screenshots/home-smoke.png) | ![BBQ home](screenshots/home-bbq.png) |

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
for s in home home-smoke home-bbq setup setup-smoke coach cue \
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
├── index.html      # screen scaffold (home, setup, grill coach, pit monitor, done, guide, help)
├── styles.css      # ember-on-black HUD theme
├── data.js         # the cook library: grill flip-timelines + smoke/bbq pit phases, temps, tips
├── app.js          # two engines — grill flip coach + temp-driven pit monitor — D-pad, alerts, persistence
├── favicon.svg
├── README.md
└── screenshots/    # generated via ?state= routing
```

<sub>Made by Alex Levin at [L+R](https://www.levinriegner.com).</sub>
