# Device Info

A diagnostics page for the Meta Ray-Ban Display glasses' browser. Eight categories — browser identity, raw user agent, screen and display, network, hardware, performance timing, API support and geolocation — are rendered from the live `navigator`, `screen`, `performance` and media-query APIs, so developers can see exactly what the glasses report without plugging anything in. Every row is focusable, which is what makes long pages scroll on a D-pad.

> ▶ [Try it in the simulator](https://displayglasses.dev/?url=https%3A%2F%2Frbm-demos.lnr.io%2Fget-device-info%2F&pos=center&size=60&bright=100&bg=hiking&bg-dark=10) · 👓 [Add it to your glasses](#add-to-your-glasses)

> ✅ **Status: Working.** Every row is read live from the browser's own `navigator`, `screen`, `performance`, Battery, Storage and Geolocation APIs on the device; nothing is mocked and nothing leaves the glasses.

---

## What it does

- **Browser.** Parsed browser and engine name/version, `navigator` basics (platform, languages, cookies, online), and the window's inner/outer size and device pixel ratio.
- **User Agent.** The raw UA string in monospace, UA Client Hints (brands, mobile, platform) and, where supported, the high-entropy hints (architecture, bitness, model, full version list) fetched asynchronously.
- **Screen & Display.** Screen resolution and color depth, orientation, window and document sizes, and a set of media queries: dark mode, reduced motion, HDR, fine/coarse pointer, hover, Retina.
- **Network.** Online state, Network Information API (type, effective type, downlink, RTT, save-data) when present, plus the page origin, protocol, host, path and referrer.
- **Hardware.** Logical cores, device memory, max touch points, Battery API (charging, level, time to full/empty), storage estimate (used, quota, percentage) and plugins.
- **Performance.** Navigation timing broken into DNS, TCP, request, response, DOM interactive/complete and load, transfer and decoded sizes, JS heap figures (Chromium), `performance.now()`, time zone, locale and the resource count/total transfer.
- **APIs & Features.** A grid of 49 yes/no feature checks, from geolocation and service workers through WebGL, Web Bluetooth, speech, sensors and WebXR to `document.modelContext` (WebMCP).
- **Location.** Reports whether geolocation exists and, only after `Get Location` is pinched, requests one high-accuracy fix and shows coordinates, altitude, accuracy, speed, heading and timestamp (or the error code).
- **Focus returns on Back.** Leaving a category restores focus to the menu item that opened it.
- **Offline.** Network-first service worker precaches the app and its self-hosted Space Grotesk + JetBrains Mono fonts.

---

## Controls

| Where | Input | Result |
| --- | --- | --- |
| Home | ▲ ▼ (or ◀ ▶) | Move focus through the eight categories (wraps) |
| Home | Enter | Open the focused category |
| Category | ▼ or ▶ | Focus the next row, scrolling it into view |
| Category | ▲ or ◀ | Focus the previous row (from the first row this wraps to the last) |
| Category | Enter (on `←`) | Back to the menu |
| Category | Back gesture (thumb + middle finger) | Back to the menu; focus returns to the category that was opened |
| Location | Enter (on `Get Location`) | Request a position fix and show the result |

---

## Screenshots

No screenshots yet. The app reads a `?state=…` URL parameter (alias `?screen=`) so each category can be captured deterministically: `home`, `browser`, `useragent`, `screen-info`, `network`, `hardware`, `performance`, `apis`, `location`. An optional `?row=N` (or `?row=last`) focuses a given row on that screen.

---

## Add to your glasses

Scan this with your phone to open the Meta AI app and add the demo to your Ray-Ban Meta Display glasses:

<img src="qr-glasses.png" width="160" alt="QR code that adds Device Info to your glasses">

Or add it by hand in the Meta AI app: **Devices → Display Glasses settings → App connections → Web apps → Add a web app**, with the name `Device Info` and this URL:

```
https://rbm-demos.lnr.io/get-device-info/
```

---

## Running locally

The app is a single static HTML/CSS/JS bundle — no build step.

```bash
npx serve -l 3070 get-device-info
# then open http://localhost:3070
```

Use ←→↑↓ + Enter to drive it; Backspace also goes back on a desktop keyboard. Everything shown describes the browser you open it in, so the numbers on a laptop will differ from the glasses.

### Regenerating screenshots

> 🛠️ **Developer tooling only.** The app itself has zero Chrome dependency — it's vanilla HTML/CSS/JS that runs in the Ray-Ban Meta Display's built-in browser. The block below is just the local recipe used on a Mac to refresh the PNGs in `screenshots/`.

Screenshots come from headless Chrome against the `?state=…` URL parameter the app reads on load:

```bash
npx serve -l 3070 get-device-info &
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
mkdir -p get-device-info/screenshots
for STATE in home browser useragent screen-info network hardware performance apis location; do
  "$CHROME" --headless --disable-gpu --hide-scrollbars \
    --window-size=600,600 --virtual-time-budget=2000 \
    --screenshot="get-device-info/screenshots/$STATE.png" \
    "http://localhost:3070/?state=$STATE"
done
```

---

## Files

```
get-device-info/
├── index.html      # home menu + eight category screens, service-worker registration
├── styles.css      # 600×600 layout, info rows, feature grid, focus rings
├── app.js          # screen stack, D-pad focus/scroll, per-category renderers, ?state= routing
├── sw.js           # network-first service worker (precaches app + fonts)
├── fonts/          # self-hosted Space Grotesk + JetBrains Mono (WOFF2) + fonts.css
└── favicon.png     # app icon (512×512 PNG)
```

---

<sub>Made by L+R at [L+R](https://www.levinriegner.com).</sub>
