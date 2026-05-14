# Meditation — Meta Display Glasses WebApp

A box-breathing meditation timer with animated breathing guide, ambient visual pulse, gentle completion screen, and session history.

## How to run (Chrome)

```bash
cd examples/meditation
python3 -m http.server 8080
```

Open [http://localhost:8080](http://localhost:8080) in Chrome, then:

1. Press **Cmd+Shift+M** to toggle the device toolbar
2. Set a **custom viewport of 600 x 600**
3. Refresh the page

## Controls

- **Arrow keys** — move focus (D-pad)
- **Enter** — activate focused element (EMG pinch)
- **Escape** — back / pause during session

## Screens

- **Home** — 5 duration preset buttons (5 / 10 / 15 / 20 / 30 min) + History button
- **Session** — animated breathing circle, MM:SS countdown, phase label (Inhale / Hold / Exhale), Pause and End controls
- **Complete** — gentle "Well done" scale-in with a soft bowl tone (generated via AudioContext, no files)
- **History** — list of past sessions with date, time, duration

## Breathing pattern

Box breathing — Inhale 4s, Hold 4s, Exhale 4s, Hold 4s, loop.
The circle scales from 0.5x to 1.2x on Inhale, stays at 1.2x on Hold, scales back to 0.5x on Exhale. Animation uses a single `transform: scale()` on one element, driven by `requestAnimationFrame` — no reflow.

## Persistence

Session history is stored in `localStorage` under the key `mdg_meditation`, newest first, capped at 50 entries. Sessions shorter than 30 seconds when ended early are not saved.

## Files

```
meditation/
  index.html    # home + session + complete + history screens
  styles.css    # breathing circle + scale-in complete animation + history list
  app.js        # navigation, breathing state machine, drift-corrected countdown, audio cue, localStorage
  vercel.json   # static rewrites
```
