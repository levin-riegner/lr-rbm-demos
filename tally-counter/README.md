# Tally Counter

A heads-up hand-tally-counter for Meta Display glasses. One **big +1 target**, a **glanceable 4-digit LED**, and a **light click** every time you count up — so you can keep your eyes on whatever you're counting (knitting rows, push-ups, foot traffic, kids on a field trip) instead of on a clicker.

> 📖 **Case study:** [levinriegner.com/work/tally-counter](https://www.levinriegner.com/work/tally-counter/)

> ▶ [Try it in the simulator](https://displayglasses.dev/?url=https%3A%2F%2Frbm-demos.lnr.io%2Ftally-counter%2F&pos=center&size=60&bright=100&bg=hiking&bg-dark=10) · 👓 [Add it to your glasses](#add-to-your-glasses)

---

## What it does

- **One-button counting.** The big **+1** button fills most of the lens; press Enter/Space/▶ to increment. A short Web-Audio click confirms each count without you having to look down.
- **0000–9999 LED display.** Tabular amber digits with a ghost-`8888` back-layer, just like a 7-segment LCD. Tick flash on +1, dim flash on −1, red pulse if you hit the 9999 ceiling.
- **−1 to correct miscounts.** Sits directly below +1 in the stack; a slightly lower-pitched click distinguishes it from +1 by ear.
- **RESET with confirmation.** Destructive, so it's gated by a red-bordered "0042 → 0000" overlay with Cancel focused by default. A descending two-tone chime plays on confirm.
- **Since-timestamp.** Captures `HH:MM` of the first count after each reset so you can see how long the current run has been going.
- **Persisted.** Count + since-timestamp survive reloads via `localStorage` (`mdg_tally_v1`).

All audio is synthesised at runtime through the Web Audio API — no asset files, no autoplay-policy traps (the first user interaction unlocks the context).

---

## Controls

| Where | Input | Result |
| --- | --- | --- |
| Anywhere | ▶ Right | +1 |
| Anywhere | ◀ Left | −1 |
| Anywhere | ▲ ▼ Up / Down | Move focus through +1 → −1 → RESET |
| Anywhere | Enter / Space / ● | Activate the focused button |
| Anywhere | R | Open the reset confirmation |
| Anywhere | Voice (Meta AI) | "Add five", "What's my count?", "Reset the counter" — see below |
| Reset confirm | ◀ ▶ / ▲ ▼ | Toggle CANCEL ↔ RESET |
| Reset confirm | Enter / Space | Activate focused option |
| Reset confirm | Back gesture (thumb + middle finger) | Close the overlay and return focus to RESET |

Every action has a focused button and a key shortcut. There are no swipe gestures.

---

## Voice (Meta AI)

The app registers three WebMCP tools (`tally_get_state`, `tally_add`, `tally_reset`) on `document.modelContext`, so the wearer can drive it by talking to Meta AI. This is the repo's smallest WebMCP example — one read-only state tool, one mutation with a single integer, one destructive action.

Things you can say:

- "Add one" / "Count that"
- "Add five to the tally"
- "Take two off"
- "What's my count?"
- "Reset the counter"

Voice is additive: every action goes through the same functions the D-pad calls, so the LED display, click sounds and `localStorage` stay in sync. The app runs unchanged where `document.modelContext` is absent (desktop Chrome, the simulator, older firmware).

> WebMCP must be enabled on the device (Developer Mode or rollout), and the app relaunched after enabling it — eligibility is decided once at launch.

---

## Screenshots

### Counting

| Idle — 0000 | Mid-run — 0137, SINCE 22:30 |
| --- | --- |
| ![Idle counter](screenshots/idle.png) | ![Counted state](screenshots/counted.png) |

### Reset confirmation

| 0042 → 0000 |
| --- |
| ![Reset confirmation overlay](screenshots/confirm.png) |

---

## Add to your glasses

Scan this with your phone to open the Meta AI app and add the demo to your Ray-Ban Meta Display glasses:

<img src="qr-glasses.png" width="160" alt="QR code that adds Tally Counter to your glasses">

Or add it by hand in the Meta AI app: **Devices → Display Glasses settings → App connections → Web apps → Add a web app**, with the name `Tally Counter` and this URL:

```
https://rbm-demos.lnr.io/tally-counter/
```

## Running locally

The app is a single static HTML/CSS/JS bundle — no build step.

```bash
npx serve -l 4211 tally-counter
# then open http://localhost:4211
```

For development inside the meta-display-glasses-webapps workspace it's also wired into `.claude/launch.json` as the `tally-counter` preview target on port **4211**.

### Regenerating screenshots

> 🛠️ **Developer tooling only.** The app itself has zero Chrome dependency — it's vanilla HTML/CSS/JS that runs in the Ray-Ban Meta Display's built-in browser. The block below is just the local recipe used on a Mac to refresh the PNGs in `screenshots/`.

The screenshots above are produced from headless Chrome against the `?state=…` URL parameter the app reads on load (`idle`, `counted`, `confirm`):

```bash
npx serve -l 4211 tally-counter &
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
for STATE in idle counted confirm; do
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars \
    --window-size=600,600 --virtual-time-budget=2500 \
    --screenshot="tally-counter/screenshots/$STATE.png" \
    "http://localhost:4211/?state=$STATE"
done
```

---

## Files

```
tally-counter/
├── index.html      # single screen + reset-confirm overlay
├── styles.css      # 600×600 right-aligned HUD; black bg, amber LED, chrome-rimmed buttons
├── app.js          # state, Web Audio click engine, keyboard nav, persistence, URL-state overrides
└── screenshots/    # generated state captures used by this README
```

---

<sub>Made by Alex Levin at [L+R](https://www.levinriegner.com).</sub>
