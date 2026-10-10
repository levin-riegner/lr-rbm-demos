# Meditation

A box-breathing meditation timer for the Meta Ray-Ban Display glasses: an animated breathing guide, a soft ambient pulse, a gentle completion screen and a session history. Pick a duration, pinch, and breathe with the circle.

> ▶ [Try it in the simulator](https://displayglasses.dev/?url=https%3A%2F%2Frbm-demos.lnr.io%2Fmeditation%2F&pos=center&size=60&bright=100&bg=hiking&bg-dark=10) · 👓 [Add it to your glasses](#add-to-your-glasses)

---

## What it does

- **Five presets.** 5 / 10 / 15 / 20 / 30 minutes on the Home screen, plus a History button.
- **Breathing guide.** Box breathing — Inhale 4 s, Hold 4 s, Exhale 4 s, Hold 4 s — with a circle that scales from 0.5× to 1.2× and a phase label (Inhale / Hold / Exhale) above a MM:SS countdown. The countdown is drift-corrected from a start timestamp.
- **Pause and End.** Pause freezes the circle and the clock; Resume restarts the breath cycle from Inhale. End returns home and saves the session if at least 30 s elapsed.
- **Completion.** A "Well done" scale-in with a soft singing-bowl tone generated via `AudioContext` (no audio files), and a line with the session length and total count.
- **History.** Past sessions with date, time and duration, newest first, stored in `localStorage` (`mdg_meditation`, capped at 50).
- **Lifecycle-clean.** A running session pauses when the page is hidden and waits for Resume; the animation loop and tick stop while nothing is visible.
- **Voice via Meta AI.** Four WebMCP tools (`meditation_*`) start, pause, resume, end and report on a session, through the same functions the D-pad uses.

---

## Controls

| Where | Input | Result |
| --- | --- | --- |
| Home | ◀ ▶ ▲ ▼ | Move focus through the 3-column duration grid; ▼ from the bottom row reaches History |
| Home | Enter (on a preset) | Start a session of that length |
| Home | Enter (on History) | Open the History screen |
| Session | ▲ ▼ ◀ ▶ | Move focus between Pause / Resume and End |
| Session | Enter (on Pause) | Pause the countdown and the breathing circle |
| Session | Enter (on Resume) | Resume; the breath cycle restarts from Inhale |
| Session | Enter (on End) | End early and return home (saved if ≥ 30 s elapsed) |
| Session | Back gesture (thumb + middle finger) | Pause a running session; when already paused, go back to Home |
| Complete | ▲ ▼ ◀ ▶ | Move focus between Home and History |
| Complete | Enter | Open the focused screen |
| History | ▲ ▼ ◀ ▶ | Move focus between the back arrow and Back |
| History | Enter | Return to the previous screen |
| History | Back gesture (thumb + middle finger) | Return to the previous screen; focus lands on the button that opened it |
| Anywhere | Voice (Meta AI) | See **Voice (Meta AI)** below |

---

## Voice (Meta AI)

With WebMCP enabled on the glasses, Meta AI can drive the timer:

- "Start a ten minute meditation."
- "How long is left?"
- "Pause." / "Resume."
- "End the session."

Voice control is additive — the D-pad path is unchanged — and it needs WebMCP enabled on the device (Developer Mode or rollout). Relaunch the app after enabling it.

---

## Screenshots

| Session |
| --- |
| <img src="screenshots/preview.png" width="300"> |

---

## Add to your glasses

Scan this with your phone to open the Meta AI app and add the demo to your Ray-Ban Meta Display glasses:

<img src="qr-glasses.png" width="160" alt="QR code that adds Meditation to your glasses">

Or add it by hand in the Meta AI app: **Devices → Display Glasses settings → App connections → Web apps → Add a web app**, with the name `Meditation` and this URL:

```
https://rbm-demos.lnr.io/meditation/
```

## Running locally

The app is a single static HTML/CSS/JS bundle — no build step.

```bash
npx serve -l 3103 meditation
# then open http://localhost:3103
```

### Regenerating screenshots

> 🛠️ **Developer tooling only.** The app itself has zero Chrome dependency — it's vanilla HTML/CSS/JS that runs in the Ray-Ban Meta Display's built-in browser. The block below is just the local recipe used on a Mac to refresh the PNGs in `screenshots/`.

The app has no `?state=` routing; a single capture of the Home screen is the deterministic state:

```bash
npx serve -l 3103 meditation &
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless --disable-gpu --hide-scrollbars \
  --window-size=600,600 --virtual-time-budget=2000 \
  --screenshot="meditation/screenshots/preview.png" \
  "http://localhost:3103/"
```

---

## Notes

### Breathing pattern

Box breathing — Inhale 4 s, Hold 4 s, Exhale 4 s, Hold 4 s, loop.
The circle scales from 0.5× to 1.2× on Inhale, stays at 1.2× on Hold, scales back to 0.5× on Exhale. Animation uses a single `transform: scale()` on one element, driven by `requestAnimationFrame` — no reflow.

### Persistence

Session history is stored in `localStorage` under the key `mdg_meditation`, newest first, capped at 50 entries. Sessions shorter than 30 seconds when ended early are not saved.

---

## Files

```
meditation/
├── index.html      # home + session + complete + history screens, service-worker registration
├── styles.css      # breathing circle + scale-in complete animation + history list
├── app.js          # navigation, breathing state machine, drift-corrected countdown, audio cue, localStorage, WebMCP tools
├── sw.js           # network-first service worker
├── favicon.png     # app icon
├── vercel.json     # static rewrites
└── screenshots/    # preview.png
```

---

<sub>Made by L+R at [L+R](https://www.levinriegner.com).</sub>
