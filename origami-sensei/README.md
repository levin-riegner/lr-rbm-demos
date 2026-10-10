# Origami Sensei

A step-by-step paper-folding teacher for the Meta Ray-Ban Display glasses. Pick one of six classic models, and each fold appears on the lens as a small diagram with the crease line, an arrow, and a one-line instruction, so your hands stay on the paper instead of on a phone. It is meant for anyone learning origami with a square of paper in front of them, and it can be driven by voice through Meta AI as well as by the D-pad.

> ▶ [Try it in the simulator](https://displayglasses.dev/?url=https%3A%2F%2Frbm-demos.lnr.io%2Forigami-sensei%2F&pos=center&size=60&bright=100&bg=hiking&bg-dark=10) · 👓 [Add it to your glasses](#add-to-your-glasses)

> ✅ **Status: Working.** Everything runs on the glasses with no network: the six models and their fold diagrams are bundled in `app.js` as inline SVG by design, and the sound cues are synthesized with Web Audio.

---

## What it does

- **Six models, rated by difficulty.** Paper Cup, Paper Hat and Paper Plane (★☆☆, 6 steps each), Heart (★★☆, 6 steps), Fortune Teller (★★☆, 8 steps) and Crane (★★★, 11 steps). The menu shows each model's kanji, name, stars and step count.
- **One fold per screen.** Every step has a fold-type chip (START, VALLEY, MOUNTAIN, UNFOLD, SQUASH, PETAL, REVERSE, SHAPE), a 200×200 inline SVG diagram of the paper *before* the fold with the crease and arrow drawn on it, a short instruction, and a row of progress dots.
- **Completion card.** After the last fold a 完 stamp appears with the model name and a `FOLD AGAIN` / `MENU` choice.
- **Sound cues.** A synthesized paper-crinkle plays on each fold, a short tick on menu moves and backward steps, and a three-tone bell when a model is complete. Audio is generated with the Web Audio API; nothing is downloaded.
- **Voice via Meta AI.** Four WebMCP tools (`origami_*`) open a model, step forward or back, and report the current step. They call the same functions the D-pad uses, so the lens re-renders as Meta AI acts.
- **Offline and self-hosted.** A network-first service worker precaches the app and its WOFF2 fonts (Shippori Mincho, Cormorant Garamond, Share Tech Mono). Pure `#000` background.

---

## Controls

| Where | Input | Result |
| --- | --- | --- |
| Menu | ▲ ▼ | Move between the six models (wraps) |
| Menu | Enter or ▶ | Begin the focused model at step 1 |
| Fold | Enter, ▶ or ▼ | Next fold; after the last fold, show the completion card |
| Fold | ◀ | Previous fold; from step 1, back to the menu |
| Fold | ▲ | Back to the menu |
| Fold | Back gesture (thumb + middle finger) | Back to the menu |
| Done | ◀ ▲ / ▶ ▼ | Move between `FOLD AGAIN` and `MENU` |
| Done | Enter | Activate the focused button |
| Done | Back gesture (thumb + middle finger) | Back to the menu |
| Anywhere | Voice (Meta AI) | See **Voice (Meta AI)** below |

---

## Voice (Meta AI)

With WebMCP enabled, the wearer can be talked through a model without touching the D-pad:

| Say | Tool called |
| --- | --- |
| "teach me the crane" | `origami_open(name: "crane")` |
| "open the paper plane" | `origami_open(name: "paper plane")` |
| "next step" | `origami_next_step` |
| "go back a step" | `origami_previous_step` |
| "what step am I on?" | `origami_get_state` (read-only) |

Every result carries the model, step number, fold type and instruction plus a `next_action` asking Meta AI to read one fold aloud in a short sentence and then stop. An unknown model name returns the list of available models so Meta AI can offer them instead of guessing.

Voice control needs WebMCP enabled on the glasses (Developer Mode or rollout); relaunch the app after enabling it.

---

## Screenshots

| Preview |
| --- |
| <img src="screenshots/preview.png" width="300" alt="Origami Sensei fold screen"> |

---

## Add to your glasses

Scan this with your phone to open the Meta AI app and add the demo to your Ray-Ban Meta Display glasses:

<img src="qr-glasses.png" width="160" alt="QR code that adds Origami Sensei to your glasses">

Or add it by hand in the Meta AI app: **Devices → Display Glasses settings → App connections → Web apps → Add a web app**, with the name `Origami Sensei` and this URL:

```
https://rbm-demos.lnr.io/origami-sensei/
```

---

## Running locally

The app is a single static HTML/CSS/JS bundle — no build step.

```bash
npx serve -l 3051 origami-sensei
# then open http://localhost:3051
```

Use ←→↑↓ + Enter to drive it.

### Regenerating screenshots

> 🛠️ **Developer tooling only.** The app itself has zero Chrome dependency — it's vanilla HTML/CSS/JS that runs in the Ray-Ban Meta Display's built-in browser. The block below is just the local recipe used on a Mac to refresh the PNGs in `screenshots/`.

The app has no `?state=` routing, so the preview is a single capture of the menu:

```bash
npx serve -l 3051 origami-sensei &
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless --disable-gpu --hide-scrollbars \
  --window-size=600,600 --virtual-time-budget=2000 \
  --screenshot="origami-sensei/screenshots/preview.png" \
  "http://localhost:3051/"
```

---

## Files

```
origami-sensei/
├── index.html      # Menu, Fold and Done screens, service-worker registration
├── styles.css      # 600×600, pure #000, washi/vermilion palette, diagram styles
├── app.js          # model data (SVG steps), state machine, Web Audio cues, WebMCP tools
├── sw.js           # network-first service worker (precaches app + fonts)
├── fonts/          # self-hosted Shippori Mincho + Cormorant Garamond + Share Tech Mono (WOFF2) + fonts.css
├── favicon.png     # black "OS" on vermilion
└── screenshots/    # preview.png
```

---

<sub>Made by the team at [L+R](https://www.levinriegner.com).</sub>
