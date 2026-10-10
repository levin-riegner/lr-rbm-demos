# Pomodoro

A pomodoro focus timer for the Meta Ray-Ban Display glasses: 25-min work / 5-min break cycles, with a 15-min long break after every 4 work sessions. A stats screen tracks completed sessions and total focus time, and Meta AI can start, pause, skip and reset the timer by voice.

> ▶ [Try it in the simulator](https://displayglasses.dev/?url=https%3A%2F%2Frbm-demos.lnr.io%2Fpomodoro%2F&pos=center&size=60&bright=100&bg=hiking&bg-dark=10) · 👓 [Add it to your glasses](#add-to-your-glasses)

---

## What it does

- **Home.** Phase badge (WORK / BREAK / LONG BREAK), a large MM:SS countdown, cycle dots for the four work sessions, and Start / Pause, Skip and Stats buttons. The header reads "Session N of 4", "Break after N/4" or "Long Break".
- **Auto-advancing cycle.** When a phase reaches zero a short "ding" plays (via `AudioContext`, no audio file) and the next phase starts automatically. Phase accent colors: WORK = cyan, BREAK = green, LONG BREAK = magenta.
- **Skip.** Jumps to the next phase, paused. A skipped work session is not counted as completed.
- **Stats.** Total sessions, sessions today and total focus time, plus Reset Stats. A session only counts when a full work phase finishes on its own.
- **Drift-free countdown.** Remaining time is computed from a `Date.now()` target each 250 ms tick, and the display only repaints when the MM:SS text changes. While the page is hidden the tick stops; on return it re-syncs to the wall clock and fires the phase transition if it elapsed meanwhile.
- **Persistence.** Stats live in `localStorage` under `mdg_pomodoro`.
- **Voice via Meta AI.** Five WebMCP tools (`pomodoro_*`) drive the same functions the buttons call.

---

## Controls

| Where | Input | Result |
| --- | --- | --- |
| Home | ▲ ▼ ◀ ▶ | Move focus between Start / Pause, Skip and Stats (wrapping) |
| Home | Enter (on Start / Pause) | Start, or pause, the countdown |
| Home | Enter (on Skip) | Move to the next phase, paused |
| Home | Enter (on Stats) | Open the Statistics screen |
| Stats | ▲ ▼ ◀ ▶ | Move focus between the back arrow and Reset Stats |
| Stats | Enter (on ←) | Return to Home |
| Stats | Enter (on Reset Stats) | Clear all statistics |
| Stats | Back gesture (thumb + middle finger) | Return to Home; focus lands on the Stats button that opened it |
| Anywhere | Voice (Meta AI) | See **Voice (Meta AI)** below |

The countdown keeps running while you are on the Stats screen.

---

## Voice (Meta AI)

The app registers five WebMCP tools on `document.modelContext` (`pomodoro_get_state`, `pomodoro_start`, `pomodoro_pause`, `pomodoro_reset`, `pomodoro_skip`) so the wearer can drive it by talking to Meta AI. Things you can say:

- "Start a focus session" / "Start a short break" / "Start a long break"
- "Pause the timer" / "Resume"
- "How much time is left?"
- "Skip this break"
- "Reset the timer"

Every tool goes through the same functions the buttons call, so the countdown, phase colour and stats stay in sync. The app runs unchanged where `document.modelContext` is absent (desktop Chrome, the simulator, older firmware).

> WebMCP must be enabled on the device (Developer Mode or rollout), and the app relaunched after enabling it — eligibility is decided once at launch.

---

## Screenshots

No screenshots yet. The app has no `?state=` routing; a plain capture of the Home screen is the only deterministic state.

---

## Add to your glasses

Scan this with your phone to open the Meta AI app and add the demo to your Ray-Ban Meta Display glasses:

<img src="qr-glasses.png" width="160" alt="QR code that adds Pomodoro to your glasses">

Or add it by hand in the Meta AI app: **Devices → Display Glasses settings → App connections → Web apps → Add a web app**, with the name `Pomodoro` and this URL:

```
https://rbm-demos.lnr.io/pomodoro/
```

## Running locally

The app is a single static HTML/CSS/JS bundle — no build step.

```bash
npx serve -l 3104 pomodoro
# then open http://localhost:3104
```

### Regenerating screenshots

> 🛠️ **Developer tooling only.** The app itself has zero Chrome dependency — it's vanilla HTML/CSS/JS that runs in the Ray-Ban Meta Display's built-in browser. The block below is just the local recipe used on a Mac to refresh the PNGs in `screenshots/`.

```bash
npx serve -l 3104 pomodoro &
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
mkdir -p pomodoro/screenshots
"$CHROME" --headless --disable-gpu --hide-scrollbars \
  --window-size=600,600 --virtual-time-budget=2000 \
  --screenshot="pomodoro/screenshots/home.png" \
  "http://localhost:3104/"
```

---

## Notes

### Phase cycle

```
work(25) -> break(5) -> work(25) -> break(5) -> work(25) -> break(5) -> work(25) -> long(15) -> repeat
```

A completed session is only counted after a full work phase finishes on its own (manual Skip does not count).

### Persistence

Stats are stored in `localStorage` under `mdg_pomodoro`:

```json
{ "totalSessions": 0, "totalFocusMs": 0, "perDay": { "YYYY-MM-DD": 0 } }
```

### Implementation

- Countdown uses `setInterval` with drift correction: remaining time is computed from a `Date.now()` target each tick so it stays accurate if the tab is throttled.
- The display is only repainted when the displayed MM:SS actually changes.
- A short "ding" plays at phase transitions via `AudioContext` — no audio file needed.
- Phase accent colors: WORK = cyan, BREAK = green, LONG BREAK = magenta. Background is dark.

---

## Files

```
pomodoro/
├── index.html      # home + stats screens, service-worker registration
├── styles.css      # dark theme + pomodoro-specific layout
├── app.js          # phase machine, countdown, stats, D-pad, audio beep, WebMCP tools
├── sw.js           # network-first service worker
├── favicon.png     # app icon
└── vercel.json     # static rewrites
```

---

<sub>Made by L+R at [L+R](https://www.levinriegner.com).</sub>
