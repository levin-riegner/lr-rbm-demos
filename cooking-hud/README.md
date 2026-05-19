# Cooking HUD

A hands-free cooking companion for the Ray-Ban Meta Display — 10 recipes split into Shop → Prep → Cook phases, a multi-timer engine that tells you what's timing in one word, AudioContext cues for every check / start / complete, and a see-through mode that goes pure black so the panel reads as transparent on the glasses.

> 📖 **Case study:** [levinriegner.com/work/cooking-hud](https://www.levinriegner.com/work/cooking-hud/)

---

## What it does

- **10 recipes**, sorted with in-progress ones pinned to the top — Pasta Carbonara, Sheet Pan Salmon, Chicken Stir Fry, Overnight Oats, Tomato Soup, Greek Salad, Beef Tacos, Banana Pancakes, Chocolate Chip Cookies, Sesame Radish Slaw.
- **Three-phase flow** — `SHOP` (grocery list), `PREP` (mise-en-place), `COOK` (timed steps). Each phase has its own progress, and the screen auto-advances ~900ms after the last item ticks off.
- **Multi-timer rail** — concurrent timers pin to the top with a one-word descriptor of what they're timing (`BOIL`, `PASTA`, `ROAST`, `BAKE`, `REST`, `BROWN`, `SIMMER`, etc.). The rail follows the user across screens; the cook step's checkbox cell morphs through `▶ 6:00` (idle) → red `5:54` (running) → green `✓` (done) when the timer expires.
- **Auto-check on timer end** — when a timer expires it pops a red `TIME'S UP — STEP DONE` alert with the step text and a 4-beep AudioContext alarm; dismissing auto-ticks the step.
- **Reset confirms** — tapping a running timer or an already-completed step opens a `RESET TIMER?` / `RESET STEP?` confirm with the step text on top, CANCEL pre-focused so a destructive tap is never one click away.
- **See-through mode** — small 👁️ button on home flips the panel from cream to pure black. On the Ray-Ban Display, black renders transparent, leaving bright white + lifted-orange (`#ff7a3a`) text floating in the user's periphery.
- **AudioContext cues** — focus-move click, item check/uncheck, timer start/end, phase-complete triad, recipe-complete arpeggio, reset warning.
- **Resume + progress persistence** — `cooking.progress.v1`, `cooking.timers.v1`, `cooking.last.v1`, and `cooking.seethrough.v1` in localStorage so a recipe and its timers survive reloads; an in-progress recipe surfaces a `RESUME →` button on home.

---

## Controls

| Where        | Input              | Result                                                |
| ------------ | ------------------ | ----------------------------------------------------- |
| Home         | ▲ ▼                | Move focus through recipe list / `HOW IT WORKS` / 👁️ |
| Home         | Tap                | Open the focused recipe (or toggle see-through / open help) |
| Recipe       | ▲ ▼                | Scroll items within the current phase                 |
| Recipe       | ◀ ▶                | Swipe between phases (Shop / Prep / Cook)             |
| Shop / Prep  | Tap                | Check / uncheck the focused item; advance to next     |
| Cook (idle)  | Tap on timer cell  | **Start the timer** for that step                     |
| Cook (run)   | Tap on timer cell  | Open `RESET TIMER?` confirm                           |
| Cook (done)  | Tap on timer cell  | Open `RESET STEP?` confirm                            |
| Timer alert  | Tap `GOT IT`       | Dismiss + auto-check the step                         |

Arrow keys + Enter mirror the swipe gestures for desktop preview.

---

## Screenshots

### Home

|                  Home                  |             See-through mode             |
| :------------------------------------: | :--------------------------------------: |
| ![Home — recipe list](screenshots/home.png) | ![Black-panel see-through home](screenshots/home-seethrough.png) |

### Recipe flow

|         Shop phase          |         Prep phase          |  Cook phase — two timers running   |
| :-------------------------: | :-------------------------: | :--------------------------------: |
| ![Shop list](screenshots/shop.png) | ![Prep steps](screenshots/prep.png) | ![Cook with timer rail + cell](screenshots/cook.png) |

---

## Running locally

Single static HTML / CSS / JS bundle — no build step.

```bash
npx serve -l 4205 cooking-hud
# then open http://localhost:4205
```

A preview entry is wired up in `.claude/launch.json` on port **4205**.

### Regenerating screenshots

The screenshots above are produced by walking Chrome headless across every `?state=` value the app supports. Run from anywhere:

```bash
mkdir -p cooking-hud/screenshots
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
APP="file://$PWD/cooking-hud/index.html"
for s in home home-seethrough shop prep cook; do
  "$CHROME" --headless --disable-gpu --hide-scrollbars \
    --window-size=600,600 \
    --screenshot="cooking-hud/screenshots/$s.png" \
    "$APP?state=$s&t=$(date +%s)"
done
```

(Locally the actual capture uses Puppeteer + the same Chrome binary at 2× DPR — see `applyUrlState()` in `app.js` for the states.)

---

## Files

```
cooking-hud/
├── index.html        # 600×600 layout: home, recipe (3 phases), help, overlays
├── styles.css        # cream panel, ink+orange palette, see-through overrides
├── app.js            # phase nav, timers, audio cues, ?state= routing
├── data.js           # 10 recipes (shop / prep / cook with timerSec + tag)
├── README.md         # this file
└── screenshots/      # PNGs regenerated from ?state= URLs
```

---

<sub>Made by Alex Levin at [L+R](https://www.levinriegner.com).</sub>
