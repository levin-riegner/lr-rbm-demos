# Periff

A speech-to-text idea catcher for the Meta Ray-Ban Display glasses. Start a take, talk, watch the transcript fill in on the lens, and save it as a "Riff" you can scroll through later. It is for anyone who has ideas while walking and wants to capture them without taking out a phone. Riffs live in the browser's `localStorage`; nothing leaves the device.

> ▶ [Try it in the simulator](https://displayglasses.dev/?url=https%3A%2F%2Frbm-demos.lnr.io%2Fperiff%2F&pos=center&size=60&bright=100&bg=hiking&bg-dark=10) · 👓 [Add it to your glasses](#add-to-your-glasses)

---

## What it does

- **Four-step walkthrough on first run.** WELCOME → SPEAK → SAVE → REVISIT, with `SKIP` and `NEXT` buttons. Once finished (or skipped) it is remembered under `periff.walkthrough.seen` and the app opens on Home; `REPLAY TUTORIAL` on Home brings it back.
- **Home.** Riff count, when the last one was saved, and two big actions: `+ NEW RIFF` and `MY RIFFS`.
- **Record.** A mic button toggles continuous, interim-result speech recognition (`SpeechRecognition`, `en-US`). Final text accumulates in white, interim text in a dimmer style, a `0:00` timer runs, and an 18-bar visualizer animates while listening. Stopping with text present enables `SAVE RIFF` and moves focus to it. Where speech recognition is unavailable the transcript box becomes editable instead.
- **List and detail.** `MY RIFFS` shows newest first with date, relative time and a 70-character title; opening one shows the full text with `← BACK`, `DELETE` and `+ NEW`.
- **Confirm overlay.** Deleting a Riff, or cancelling a take with more than 8 characters transcribed, asks first. Cancelling the overlay returns focus to the button that opened it.
- **Spatial D-pad focus.** Arrows move the focus ring to the nearest control in that direction; a primary button is focused by default on each screen.
- **Lifecycle.** The timer and visualizer are `setInterval`s that stop when a take ends; when the page is hidden mid-take the take is stopped cleanly and the transcript stays on screen as `READY TO SAVE`.
- **Offline.** Network-first service worker; system fonts only. Two sample Riffs are seeded on first launch.

---

## Controls

| Where | Input | Result |
| --- | --- | --- |
| Walkthrough | ◀ ▶ | Move between `SKIP` and `NEXT` |
| Walkthrough | Enter | Activate; `NEXT` advances, `GET STARTED` on the last step opens Home |
| Home | ▲ ▼ ◀ ▶ | Move focus between `+ NEW RIFF`, `MY RIFFS` and `REPLAY TUTORIAL` |
| Home | Enter | Open the focused screen |
| Record | Enter (on the mic) | Start listening / stop listening |
| Record | ▲ ▼ ◀ ▶ | Move focus between the mic, `CANCEL` and `SAVE RIFF` |
| Record | Enter (on `SAVE RIFF`) | Save the transcript as a Riff and return Home |
| Record | Enter (on `CANCEL`) | Discard the take (asks first if more than 8 characters were transcribed) |
| Record | Back gesture (thumb + middle finger) | Same as `CANCEL` |
| My Riffs | ▲ ▼ | Move through Riffs, then `HOME` and `+ NEW RIFF` |
| My Riffs | Enter | Open the focused Riff |
| My Riffs | Back gesture (thumb + middle finger) | Back to Home |
| Riff detail | ◀ ▶ | Move between `← BACK`, `DELETE` and `+ NEW` |
| Riff detail | Enter | Activate the focused button |
| Riff detail | Back gesture (thumb + middle finger) | Back to My Riffs with the same Riff focused |
| Confirm | ◀ ▶ | Move between `CANCEL` and `CONFIRM` |
| Confirm | Enter | Activate the focused button |
| Confirm | Back gesture (thumb + middle finger) | Cancel and return focus to the button that opened it |

On the walkthrough and Home screens the Back gesture does nothing.

---

## Screenshots

| Preview |
| --- |
| <img src="screenshots/preview.png" width="300" alt="Periff record screen"> |

---

## Add to your glasses

Scan this with your phone to open the Meta AI app and add the demo to your Ray-Ban Meta Display glasses:

<img src="qr-glasses.png" width="160" alt="QR code that adds Periff to your glasses">

Or add it by hand in the Meta AI app: **Devices → Display Glasses settings → App connections → Web apps → Add a web app**, with the name `Periff` and this URL:

```
https://rbm-demos.lnr.io/periff/
```

---

## Running locally

The app is a single static HTML/CSS/JS bundle — no build step.

```bash
npx serve -l 3052 periff
# then open http://localhost:3052
```

Use ←→↑↓ + Enter to drive it. Speech recognition needs a browser that exposes `SpeechRecognition` / `webkitSpeechRecognition` and a granted microphone permission. Clear the `periff.riffs.v1` and `periff.walkthrough.seen` keys in `localStorage` to reset to first-run state. The folder also carries a `.claude/launch.json` preview target on port **4300**.

### Regenerating screenshots

> 🛠️ **Developer tooling only.** The app itself has zero Chrome dependency — it's vanilla HTML/CSS/JS that runs in the Ray-Ban Meta Display's built-in browser. The block below is just the local recipe used on a Mac to refresh the PNGs in `screenshots/`.

The app has no `?state=` routing, so the preview is a single capture (the walkthrough on a fresh profile):

```bash
npx serve -l 3052 periff &
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless --disable-gpu --hide-scrollbars \
  --window-size=600,600 --virtual-time-budget=2000 \
  --screenshot="periff/screenshots/preview.png" \
  "http://localhost:3052/"
```

---

## Files

```
periff/
├── index.html         # Walkthrough, Home, Record, List, Detail screens, confirm overlay, SW registration
├── styles.css         # 600×600, pure #000, amber accent, focus ring, visualizer bars
├── app.js             # speech recognition, storage, spatial D-pad focus, confirm flow, lifecycle
├── sw.js              # network-first service worker
├── favicon.png        # app icon
├── screenshots/       # preview.png
└── .claude/
    └── launch.json    # local preview target (port 4300)
```

---

<sub>Made by L+R at [L+R](https://www.levinriegner.com).</sub>
