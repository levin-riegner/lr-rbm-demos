# Presto · Pocket Prestidigitator

A card-magic coach for the Meta Ray-Ban Display glasses. It walks a beginner through a seven-beat Key Card routine: each beat shows the line to say out loud, the secret move to make while saying it, and a cue gesture. Because the cue is a natural performer's gesture that doubles as the pinch to advance, the audience sees a flourish while the next beat quietly appears on the lens.

> ▶ [Try it in the simulator](https://displayglasses.dev/?url=https%3A%2F%2Frbm-demos.lnr.io%2Fpresto%2F&pos=center&size=60&bright=100&bg=hiking&bg-dark=10) · 👓 [Add it to your glasses](#add-to-your-glasses)

---

## What it does

- **Title → routine picker → beats → reveal.** The title card explains the premise; the picker lists three routines; the step screen shows one beat at a time; the reveal card tells you which card is theirs and offers an encore.
- **One playable routine.** *The Spectator's Card* (Key-Card, 7 beats, beginner): SETUP, SHUFFLE, SELECTION, MEMORIZE, RETURN, CONTROL, REVEAL. The other two rows (*The Ambitious Card*, *The Lying Spectator*) are shown as LOCKED and cannot be opened.
- **Patter, secret, cue.** Each beat has a quoted line of patter, a SECRET block describing the hidden move, and a cue line (`STRAIGHTEN THE DECK`, `SNAP THE DECK SHUT`, …) that flashes when performed. The header suit rotates with each beat.
- **Stage chimes.** Short Web Audio tones mark menu moves, beat changes, opening a routine, a locked row, and a five-note flourish before the reveal.
- **Offline and self-hosted.** Network-first service worker, pure `#000` background, Cinzel + Cormorant Garamond + Share Tech Mono fonts shipped as WOFF2.

---

## Controls

| Where | Input | Result |
| --- | --- | --- |
| Title | Enter or ▶ | Open the routine picker |
| Picker | ▲ ▼ | Move between unlocked routines (locked rows are skipped) |
| Picker | Enter or ▶ | Open the focused routine at beat 1 (a locked row plays a dud tone) |
| Picker | ◀ | Back to the title |
| Picker | Back gesture (thumb + middle finger) | Back to the title |
| Beat | Enter or ▶ | Perform the cue: next beat; after beat 7, the reveal card |
| Beat | ◀ | Previous beat; from beat 1, back to the picker |
| Beat | Back gesture (thumb + middle finger) | Same as ◀ |
| Reveal | Enter or ▶ | Encore: back to the picker |
| Reveal | ◀ | Back to the picker |
| Reveal | Back gesture (thumb + middle finger) | Back to the picker |

On the title screen the Back gesture is left to the system.

---

## Screenshots

| Preview |
| --- |
| <img src="screenshots/preview.png" width="300" alt="Presto beat screen"> |

---

## Add to your glasses

Scan this with your phone to open the Meta AI app and add the demo to your Ray-Ban Meta Display glasses:

<img src="qr-glasses.png" width="160" alt="QR code that adds Presto · Pocket Prestidigitator to your glasses">

Or add it by hand in the Meta AI app: **Devices → Display Glasses settings → App connections → Web apps → Add a web app**, with the name `Presto · Pocket Prestidigitator` and this URL:

```
https://rbm-demos.lnr.io/presto/
```

---

## Running locally

The app is a single static HTML/CSS/JS bundle — no build step.

```bash
npx serve -l 3053 presto
# then open http://localhost:3053
```

Use ←→↑↓ + Enter to drive it.

### Regenerating screenshots

> 🛠️ **Developer tooling only.** The app itself has zero Chrome dependency — it's vanilla HTML/CSS/JS that runs in the Ray-Ban Meta Display's built-in browser. The block below is just the local recipe used on a Mac to refresh the PNGs in `screenshots/`.

The app has no `?state=` routing, so the preview is a single capture of the title card:

```bash
npx serve -l 3053 presto &
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless --disable-gpu --hide-scrollbars \
  --window-size=600,600 --virtual-time-budget=2000 \
  --screenshot="presto/screenshots/preview.png" \
  "http://localhost:3053/"
```

---

## Files

```
presto/
├── index.html      # Title, picker, beat and reveal screens, service-worker registration
├── styles.css      # 600×600, pure #000, gold / crimson / ivory palette
├── app.js          # Key Card routine data, screen state, Web Audio chimes, key handling
├── sw.js           # network-first service worker (precaches app + fonts)
├── fonts/          # self-hosted Cinzel + Cormorant Garamond + Share Tech Mono (WOFF2) + fonts.css
├── favicon.png     # black "PT" on gold
└── screenshots/    # preview.png
```

---

<sub>Made by L+R at [L+R](https://www.levinriegner.com).</sub>
