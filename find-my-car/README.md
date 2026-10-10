# Find My Car

A parking-spot memory for the Meta Ray-Ban Display glasses. Pinch `Park Here` when you leave the car and the app stores your GPS position; later, `Navigate to car` shows a large arrow that rotates toward the saved spot as you turn, with the remaining distance in the corner. It is built for anyone who loses their car in big lots, and runs entirely on the browser's geolocation and compass APIs.

> ▶ [Try it in the simulator](https://displayglasses.dev/?url=https%3A%2F%2Frbm-demos.lnr.io%2Ffind-my-car%2F&pos=center&size=60&bright=100&bg=hiking&bg-dark=10) · 👓 [Add it to your glasses](#add-to-your-glasses)

---

## What it does

- **Park Here.** One high-accuracy `getCurrentPosition` call saves latitude, longitude, accuracy and timestamp to `localStorage` (`find-my-car.savedSpot`). The home screen then shows the coordinates, when they were saved, and reveals `Navigate to car` and `Clear saved spot`.
- **Compass arrow.** The navigate screen opens a `watchPosition` and listens to `deviceorientation` / `deviceorientationabsolute`. The arrow is rotated by *bearing to car − current heading*, so it points at the car relative to where you are facing; without a heading it points at the absolute bearing. Within 5 m the arrow is styled as "on target".
- **Live readout.** Distance (`M`, or `KM` past 1 km), your heading, the bearing to the car and the GPS accuracy update with every fix.
- **Permission-aware.** On platforms that require `DeviceOrientationEvent.requestPermission()` an `Enable compass` button appears and asks only when pinched. Geolocation errors (denied, unavailable, timeout) are shown as plain-language banners.
- **Lifecycle-clean.** The GPS watch and orientation listeners are released when the page is hidden or when leaving the navigate screen, and re-armed on return without asking for permission again.
- **Offline.** Network-first service worker precaches the app and its self-hosted Inter + JetBrains Mono fonts.

---

## Controls

| Where | Input | Result |
| --- | --- | --- |
| Home | ▲ ▼ | Move focus between `Park Here`, `Navigate to car` and `Clear saved spot` (the last two only once a spot is saved) |
| Home | Enter (on `Park Here`) | Read the current position and save it |
| Home | Enter (on `Navigate to car`) | Open the compass screen |
| Home | Enter (on `Clear saved spot`) | Forget the saved position |
| Navigate | ▲ ▼ | Move focus between `BACK` and `Enable compass` (when shown) |
| Navigate | Enter (on `BACK`) | Return home |
| Navigate | Enter (on `Enable compass`) | Request orientation permission and start the compass |
| Navigate | Back gesture (thumb + middle finger) | Return home; focus lands on `Navigate to car` |

---

## Screenshots

| Preview |
| --- |
| <img src="screenshots/preview.png" width="300" alt="Find My Car preview"> |

---

## Add to your glasses

Scan this with your phone to open the Meta AI app and add the demo to your Ray-Ban Meta Display glasses:

<img src="qr-glasses.png" width="160" alt="QR code that adds Find My Car to your glasses">

Or add it by hand in the Meta AI app: **Devices → Display Glasses settings → App connections → Web apps → Add a web app**, with the name `Find My Car` and this URL:

```
https://rbm-demos.lnr.io/find-my-car/
```

---

## Running locally

The app is a single static HTML/CSS/JS bundle — no build step.

```bash
npx serve -l 3050 find-my-car
# then open http://localhost:3050
```

Use ↑↓ + Enter to drive it. Geolocation needs a secure context, so use `localhost` (not a LAN IP) or an HTTPS tunnel when testing on a phone. The saved spot persists in `localStorage` under `find-my-car.savedSpot`.

### Regenerating screenshots

> 🛠️ **Developer tooling only.** The app itself has zero Chrome dependency — it's vanilla HTML/CSS/JS that runs in the Ray-Ban Meta Display's built-in browser. The block below is just the local recipe used on a Mac to refresh the PNGs in `screenshots/`.

The app has no `?state=` routing, so a single capture of the home screen is taken:

```bash
npx serve -l 3050 find-my-car &
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
mkdir -p find-my-car/screenshots
"$CHROME" --headless --disable-gpu --hide-scrollbars \
  --window-size=600,600 --virtual-time-budget=2000 \
  --screenshot="find-my-car/screenshots/preview.png" \
  "http://localhost:3050/"
```

---

## Files

```
find-my-car/
├── index.html      # home + navigate screens, compass arrow SVG, service-worker registration
├── styles.css      # 600×600 layout, teal accent, compass ring, focus rings
├── app.js          # saved spot, geolocation watch, compass heading, haversine/bearing math
├── sw.js           # network-first service worker (precaches app + fonts)
├── fonts/          # self-hosted Inter + JetBrains Mono (WOFF2) + fonts.css
├── favicon.png     # app icon (512×512 PNG)
└── screenshots/    # preview.png
```

---

<sub>Made by L+R at [L+R](https://www.levinriegner.com).</sub>
