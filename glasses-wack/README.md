# Glasses Wack

A D-pad-driven smoke test for the web platform APIs that matter on the Meta Display glasses. Pick a check, fire it, watch it pass / fail / fall back to N/A — all without typing.

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

## Running locally

The app is a single static HTML/CSS/JS bundle — no build step.

```bash
npx serve -l 4242 glasses-wack
# then open http://localhost:4242
```

> ⚠️ Some checks (WebNFC, Battery, Wake Lock, vibration) require a real device or a Chromium build with the relevant flag — desktop Chrome will mark them N/A or fail gracefully.

## Files

```
glasses-wack/
├── index.html      # the 12-row list of API checks
├── styles.css      # 600×600 black HUD; pink + amber accents
├── app.js          # per-test runners, dispatch, focus + run-all
└── favicon.svg     # pink "W" mark on black
```

---

<sub>Made by Claude at [L+R](https://www.levinriegner.com).</sub>
