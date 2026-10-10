# Snake

Classic Snake for the Meta Ray-Ban Display glasses, drawn on a canvas sized for the 600×600 lens and steered with the D-pad. Eat, grow, wrap around the edges, and chase the local high-score table.

---

## What it does

- **Classic rules.** A 22×18 grid, one tick every 144 ms, +10 points per food, edges wrap around, and the game ends when the snake runs into itself.
- **Menu.** The home screen shows an idle preview on the board with New Game and High Scores buttons.
- **Game Over overlay.** Final score, "New High Score!" or "Best: N", then Play Again or See High Scores.
- **High scores.** The top 10 scores with dates, persisted in `localStorage` (`snake_high_scores`), with a Clear Scores button.
- **Lifecycle-clean.** The game loop pauses while the page is hidden and resumes on return.
- **Offline-friendly.** A network-first service worker caches the app shell.

---

## Controls

| Where | Input | Result |
| --- | --- | --- |
| Menu | ▲ ▼ ◀ ▶ | Move focus between New Game and High Scores |
| Menu | Enter | Activate the focused button |
| Playing | ▲ ▼ ◀ ▶ | Change direction (reversing into the body is ignored) |
| Playing | Back gesture (thumb + middle finger) | Stop the game and return to the menu |
| Game Over | ▲ ▼ ◀ ▶ | Move focus between Play Again and See High Scores |
| Game Over | Enter | Activate the focused button |
| Game Over | Back gesture (thumb + middle finger) | Dismiss the panel and return to the menu |
| High Scores | ▲ ▼ ▶ | Move focus between the back arrow, the score rows and Clear Scores |
| High Scores | ◀ | Return to the menu |
| High Scores | Enter (on ←) | Return to the menu |
| High Scores | Enter (on Clear Scores) | Empty the high-score table |
| High Scores | Back gesture (thumb + middle finger) | Return to the menu |

---

## Screenshots

| Playing |
| --- |
| <img src="screenshots/preview.png" width="300"> |

---

## Running locally

The app is a single static HTML/CSS/JS bundle — no build step.

```bash
npx serve -l 3106 snake
# then open http://localhost:3106
```

### Regenerating screenshots

> 🛠️ **Developer tooling only.** The app itself has zero Chrome dependency — it's vanilla HTML/CSS/JS that runs in the Ray-Ban Meta Display's built-in browser. The block below is just the local recipe used on a Mac to refresh the PNGs in `screenshots/`.

The app has no `?state=` routing; a plain load captures the menu with the idle board:

```bash
npx serve -l 3106 snake &
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless --disable-gpu --hide-scrollbars \
  --window-size=600,600 --virtual-time-budget=1500 \
  --screenshot="snake/screenshots/preview.png" \
  "http://localhost:3106/"
```

---

## Notes

- Fixed viewport: 600×600px, matching the wearable display resolution
- High scores are persisted via `localStorage`
- No dependencies — plain HTML, CSS, and JavaScript

---

## Files

```
snake/
├── index.html      # game screen, Game Over overlay, High Scores screen, service-worker registration
├── styles.css      # 600×600 layout, nav bar, overlay, score list
├── app.js          # canvas rendering, game loop, high scores, D-pad focus, lifecycle
├── sw.js           # network-first service worker
├── favicon.png     # app icon
└── screenshots/    # preview.png
```

---

<sub>Made by L+R at [L+R](https://www.levinriegner.com).</sub>
