# Pomodoro — Meta Display Glasses WebApp

A pomodoro focus timer: 25-min work / 5-min break cycles, with a 15-min long break after every 4 work sessions. Includes a stats screen tracking completed sessions and total focus time.

## How to run (Chrome)

```bash
cd examples/pomodoro
python3 -m http.server 8080
```

Open [http://localhost:8080](http://localhost:8080) in Chrome, then:

1. Press **Cmd+Shift+M** to toggle the device toolbar
2. Set a **custom viewport of 600 x 600**
3. Refresh the page

## Controls

- **Arrow keys** — move focus between buttons (D-pad)
- **Enter** — activate focused button (EMG pinch)
- **Escape** — back to previous screen

## Screens

- **Home** — phase badge (WORK / BREAK / LONG BREAK), large MM:SS countdown, cycle dots, and Start/Pause, Skip, Stats buttons
- **Stats** — total sessions, sessions today, total focus time, Reset Stats button

## Phase cycle

```
work(25) -> break(5) -> work(25) -> break(5) -> work(25) -> break(5) -> work(25) -> long(15) -> repeat
```

A completed session is only counted after a full work phase finishes on its own (manual Skip does not count).

## Persistence

Stats are stored in `localStorage` under `mdg_pomodoro`:

```json
{ "totalSessions": 0, "totalFocusMs": 0, "perDay": { "YYYY-MM-DD": 0 } }
```

## Notes

- Countdown uses `setInterval` with drift correction: remaining time is computed from a `Date.now()` target each tick so it stays accurate if the tab is throttled.
- The display is only repainted when the displayed MM:SS actually changes.
- A short "ding" plays at phase transitions via `AudioContext` — no audio file needed.
- Phase accent colors: WORK = cyan, BREAK = green, LONG BREAK = magenta. Background is dark.

## Files

```
pomodoro/
  index.html   # home + stats screens
  styles.css   # dark theme + pomodoro-specific layout
  app.js       # phase machine, countdown, stats, D-pad, audio beep
  vercel.json  # static rewrites
```
