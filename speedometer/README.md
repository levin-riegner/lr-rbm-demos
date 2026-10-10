# Speedometer

A motion-sensor speed readout for the Meta Ray-Ban Display glasses. Press Start, and the app integrates the accelerometer's forward acceleration into a speed estimate in m/s, keeps a persistent top speed, and shows a bubble level so you can hold your head square. A built-in simulator plays an accelerate–cruise–brake cycle for trying the display without moving. It is a sensor spike, not a navigation instrument.

> ▶ [Try it in the simulator](https://displayglasses.dev/?url=https%3A%2F%2Frbm-demos.lnr.io%2Fspeedometer%2F&pos=center&size=60&bright=100&bg=hiking&bg-dark=10) · 👓 [Add it to your glasses](#add-to-your-glasses)

> ✅ **Status: Working.** Everything runs on the glasses with no network: `Start` reads the device's real `devicemotion` / `deviceorientation` sensors and the top speed persists in `localStorage`; `Sim` is an explicit, labeled test mode, not a reading.

---

## What it does

- **Speed from `devicemotion`.** Gravity is removed with a slow low-pass filter (α = 0.995); the remaining forward component is integrated over time. Below a stationary threshold the estimate decays toward zero, and it is clamped to 0–100 m/s. The readout updates to one decimal.
- **Top speed, remembered.** The highest reading is written to `localStorage` (`mrbd.speedometer.v1`) with a timestamp and restored on the next launch. `Reset Top` clears it.
- **Bubble level.** `deviceorientation` gamma is captured on Start as the reference; the bubble slides up to ±25° and turns "level" within 3°.
- **Sim mode.** A `requestAnimationFrame` loop feeds synthetic acceleration (8 s accelerate, 12 s cruise, 7 s brake, 5 s rest, with noise) through the same integrator. Starting Sim stops the sensor and vice versa.
- **Explicit start and permission.** Sensors attach only after `Start`, calling `DeviceMotionEvent.requestPermission()` where it exists; the status pill shows Idle / Live / Sim / No sensor / Denied / Error.
- **Lifecycle.** Hiding the page removes the sensor listeners and cancels the sim loop; showing it re-arms whichever was active. Speed and top speed are kept.
- **Offline.** Network-first service worker, pure `#000` background, system fonts. The 600×600 layout scales down to fit smaller viewports.

---

## Controls

| Where | Input | Result |
| --- | --- | --- |
| Main | ▶ or ▼ | Move focus to the next button (`Start` → `Sim` → `Reset Top`, wraps) |
| Main | ◀ or ▲ | Move focus to the previous button (wraps) |
| Main | Enter (on `Start` / `Stop`) | Start or stop the motion and orientation sensors |
| Main | Enter (on `Sim` / `Stop Sim`) | Start or stop the simulated drive |
| Main | Enter (on `Reset Top`) | Clear the stored top speed |
| Main | Head motion | While Live: forward acceleration drives the speed; sideways tilt moves the level bubble |

The app does not handle the Back gesture; it is left to the system.

---

## Screenshots

| Preview |
| --- |
| <img src="screenshots/preview.png" width="300" alt="Speedometer readout"> |

---

## Add to your glasses

Scan this with your phone to open the Meta AI app and add the demo to your Ray-Ban Meta Display glasses:

<img src="qr-glasses.png" width="160" alt="QR code that adds Speedometer to your glasses">

Or add it by hand in the Meta AI app: **Devices → Display Glasses settings → App connections → Web apps → Add a web app**, with the name `Speedometer` and this URL:

```
https://rbm-demos.lnr.io/speedometer/
```

---

## Running locally

The folder ships a tiny Node static server (`server.js`) and a `package.json` with a `start` script. There is no build step and no dependencies to install.

```bash
cd speedometer
npm start
# → Server running at http://localhost:3000
```

`server.js` reads the `PORT` environment variable, so `PORT=3054 npm start` serves on another port. It resolves files relative to the current working directory, so run it from inside `speedometer/`. The folder also carries a `vercel.json` for static deployment on Vercel (`.vercel` is git-ignored).

Real sensor input needs a device with `devicemotion`; on a desktop use `Sim`.

### Regenerating screenshots

> 🛠️ **Developer tooling only.** The app itself has zero Chrome dependency — it's vanilla HTML/CSS/JS that runs in the Ray-Ban Meta Display's built-in browser. The block below is just the local recipe used on a Mac to refresh the PNGs in `screenshots/`.

The app has no `?state=` routing, so the preview is a single capture of the idle readout:

```bash
(cd speedometer && PORT=3054 npm start) &
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless --disable-gpu --hide-scrollbars \
  --window-size=600,600 --virtual-time-budget=2000 \
  --screenshot="speedometer/screenshots/preview.png" \
  "http://localhost:3054/"
```

---

## Files

```
speedometer/
├── index.html      # readout, level bubble, top speed, Start / Sim / Reset Top bar
├── styles.css      # 600×600, pure #000, scales to fit the viewport
├── app.js          # motion integration, level, sim loop, localStorage, focus nav, lifecycle
├── sw.js           # network-first service worker
├── server.js       # minimal Node static server (PORT env, default 3000)
├── package.json    # `npm start` → node server.js
├── vercel.json     # static deployment config
├── .gitignore      # .vercel
├── favicon.png     # app icon
└── screenshots/    # preview.png
```

---

<sub>Made by the team at [L+R](https://www.levinriegner.com).</sub>
