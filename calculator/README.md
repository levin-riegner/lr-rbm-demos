# Calculator

A four-function calculator for the Meta Ray-Ban Display glasses, driven entirely by the D-pad. The keypad is a 5×4 grid you steer with ▲ ▼ ◀ ▶ and press with a pinch, with synthesized key clicks and three skins — a Braun-style default, a Casio that shows a clock while idle, and a TI-83 look. With WebMCP enabled, Meta AI can type an expression for you and read the result back.

> ▶ [Try it in the simulator](https://displayglasses.dev/?url=https%3A%2F%2Frbm-demos.lnr.io%2Fcalculator%2F&pos=center&size=60&bright=100&bg=hiking&bg-dark=10) · 👓 [Add it to your glasses](#add-to-your-glasses)

---

## What it does

- **D-pad keypad.** Digits 0–9, decimal point, `+ − × ÷`, `=`, `AC`, `+/−` and `%` laid out as a 5×4 grid. Focus wraps at every edge, skips the empty cell beside the wide `0`, and starts on `=` so the first pinch is useful.
- **Simple chained arithmetic.** Expressions evaluate strictly left to right (no operator precedence, no parentheses). Pressing a second operator before entering a number swaps the operator instead of recomputing. Entry is capped at 12 characters; division by zero or an overflow shows `ERR` until `AC`.
- **Expression line.** The top-right tag shows the pending `previous operator current` while an operation is open.
- **Three themes.** `Change Theme` at the top cycles Braun → Casio → TI-83. The choice persists in `localStorage` (`calc-theme`). The Casio skin shows the time and weekday/date in the display while the calculator is idle, driven by a 1 s tick that stops while the page is hidden.
- **Key clicks.** Short synthesized tones (Web Audio) for digits, operators, functions, clear and equals; silent where `AudioContext` is unavailable.
- **Voice via Meta AI.** Four WebMCP tools (`calc_*`) evaluate an expression on screen, report the display, clear it, or switch themes. The voice path replays the expression key by key through the same code the D-pad uses, so the display always matches what Meta AI says.
- **Offline.** Network-first service worker precaches the app and its self-hosted Inter + JetBrains Mono fonts.

---

## Controls

| Where | Input | Result |
| --- | --- | --- |
| Keypad | ▲ ▼ ◀ ▶ | Move focus across the keys (wraps at the edges; ▲ from the top row reaches `Change Theme`) |
| Keypad | Enter | Press the focused key |
| `Change Theme` | Enter | Cycle Braun → Casio → TI-83 |
| Anywhere | Back gesture (thumb + middle finger) | `AC` — clear the display and any pending operation |
| Anywhere | Voice (Meta AI) | See **Voice (Meta AI)** below |

---

## Voice (Meta AI)

With WebMCP enabled, the wearer can hand the arithmetic to Meta AI. Each sentence resolves in one tool call:

| Say | Tool called |
| --- | --- |
| "what's 12 times 4 plus 3?" | `calc_evaluate(expression: "12 * 4 + 3")` |
| "divide 250 by 8" | `calc_evaluate(expression: "250 / 8")` |
| "what's on the display?" | `calc_get_state` (read-only) |
| "clear it" | `calc_clear` |
| "switch to the Casio theme" | `calc_set_theme(name: "casio")` |

Expressions are evaluated left to right exactly like the on-screen calculator. An unreadable expression or a math error comes back with `error: true` and a `next_action` telling Meta AI to ask for a rephrase or report the error instead of guessing.

Voice control needs WebMCP enabled on the glasses (Developer Mode or rollout); relaunch the app after enabling it.

---

## Screenshots

No screenshots yet.

---

## Add to your glasses

Scan this with your phone to open the Meta AI app and add the demo to your Ray-Ban Meta Display glasses:

<img src="qr-glasses.png" width="160" alt="QR code that adds Calculator to your glasses">

Or add it by hand in the Meta AI app: **Devices → Display Glasses settings → App connections → Web apps → Add a web app**, with the name `Calculator` and this URL:

```
https://rbm-demos.lnr.io/calculator/
```

---

## Running locally

The app is a single static HTML/CSS/JS bundle — no build step.

```bash
npx serve -l 3010 calculator
# then open http://localhost:3010
```

Use ←→↑↓ + Enter to drive it. The chosen theme persists in `localStorage` under `calc-theme`.

### Regenerating screenshots

> 🛠️ **Developer tooling only.** The app itself has zero Chrome dependency — it's vanilla HTML/CSS/JS that runs in the Ray-Ban Meta Display's built-in browser. The block below is just the local recipe used on a Mac to refresh the PNGs in `screenshots/`.

The app has no `?state=` routing, so a single capture of the default screen is taken:

```bash
npx serve -l 3010 calculator &
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
mkdir -p calculator/screenshots
"$CHROME" --headless --disable-gpu --hide-scrollbars \
  --window-size=600,600 --virtual-time-budget=2000 \
  --screenshot="calculator/screenshots/preview.png" \
  "http://localhost:3010/"
```

---

## Files

```
calculator/
├── index.html      # keypad grid, theme tag, display, service-worker registration
├── styles.css      # 600×600 layout; Braun / Casio / TI-83 themes via body[data-theme]
├── app.js          # calculator state, 2D D-pad focus, key clicks, Casio clock, WebMCP tools
├── sw.js           # network-first service worker (precaches app + fonts)
├── fonts/          # self-hosted Inter + JetBrains Mono (WOFF2) + fonts.css
└── favicon.png     # app icon (512×512 PNG)
```

---

<sub>Made by L+R at [L+R](https://www.levinriegner.com).</sub>
