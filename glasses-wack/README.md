# Glasses Wack

A D-pad-driven smoke test for the web platform APIs that matter on the Meta Display glasses. Pick a check, fire it, watch it pass / fail / fall back to N/A — all without typing.

> ▶ [Try it in the simulator](https://displayglasses.dev/?url=https%3A%2F%2Frbm-demos.lnr.io%2Fglasses-wack%2F&pos=center&size=60&bright=100&bg=hiking&bg-dark=10) · 👓 [Add it to your glasses](#add-to-your-glasses)

## What it does

- **VIBRATE** — fires a `[100, 50, 100, 50, 200]` pattern via `navigator.vibrate`.
- **WEBGL2** — compiles a vertex+fragment shader and renders a rotating, lit cube into an inline 120×80 preview canvas. Reports the unmasked renderer + framerate.
- **CANVAS 2D** — animates a Lissajous curve over a particle field. Reports DPR + framerate.
- **WEBNFC** — opens an `NDEFReader` scan for 5 s and decodes the first record.
- **BATTERY** — subscribes to `navigator.getBattery()` events; live meter shows charge level, charging state, and time-to-full / time-to-empty.
- **WAKE LOCK** — toggles a `screen` wake lock so the lens stays on.
- **NETWORK** — surfaces `NetworkInformation`: effective type, downlink, RTT, Save-Data.
- **SPEAK** — utters "Hello from the lens" through `speechSynthesis` and lists the available voices.
- **GAMEPAD** — polls `navigator.getGamepads()` for 5 s and reports the first controller.
- **STORAGE** — `navigator.storage.estimate()` quota + usage + persisted state.
- **SHARE** — checks `navigator.share` and `navigator.canShare` support (incl. file share).
- **HARDWARE** — `hardwareConcurrency`, `deviceMemory`, `devicePixelRatio`, touch presence.

Each row reports one of `IDLE`, `RUN`, `LIVE`, `PASS`, `FAIL`, or `N/A` so it's obvious at a glance which surfaces the headset's browser implements.

## Controls

| Where | Input | Result |
| --- | --- | --- |
| List | ▲ | Focus previous test |
| List | ▼ | Focus next test |
| List | ▶ | Run focused test |
| List | ◀ | Stop focused test (if live) |
| List | Enter | Run every test in sequence |

## Add to your glasses

Scan this with your phone to open the Meta AI app and add the demo to your Ray-Ban Meta Display glasses:

<img src="qr-glasses.png" width="160" alt="QR code that adds Glasses Wack to your glasses">

Or add it by hand in the Meta AI app: **Devices → Display Glasses settings → App connections → Web apps → Add a web app**, with the name `Glasses Wack` and this URL:

```
https://rbm-demos.lnr.io/glasses-wack/
```

## Running locally

The app is a single static HTML/CSS/JS bundle — no build step.

```bash
npx serve -l 4242 glasses-wack
# then open http://localhost:4242
```

> ⚠️ Some checks (WebNFC, Battery, Wake Lock, vibration) require a real device or a Chromium build with the relevant flag — desktop Chrome will mark them N/A or fail gracefully.

### Regenerating screenshots

> 🛠️ **Developer tooling only.** The app itself has zero Chrome dependency — it's vanilla HTML/CSS/JS that runs in the Ray-Ban Meta Display's built-in browser. The block below is just the local recipe used on a Mac to refresh the PNGs in `screenshots/`.

The app has a single screen and no `?state=` routing, so one plain capture is enough:

```bash
npx serve -l 4242 glasses-wack &
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless --disable-gpu --hide-scrollbars \
  --window-size=600,600 --virtual-time-budget=2000 \
  --screenshot="glasses-wack/screenshots/preview.png" \
  "http://localhost:4242/"
```

## Files

```
glasses-wack/
├── index.html      # the 12-row list of API checks
├── styles.css      # 600×600 black HUD; pink + amber accents
├── app.js          # per-test runners, dispatch, focus + run-all
└── favicon.png     # black "GW" on pink
```

---

<sub>Made by Claude at [L+R](https://www.levinriegner.com).</sub>
