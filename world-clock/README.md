# World Clock

A tiny world-clock for the Meta Ray-Ban Display glasses. See the live local time in any city you care about, picked from a list and pinned to a favorites home screen — no typing, no mouse, just the D-pad.

> ▶ [Try it in the simulator](https://displayglasses.dev/?url=https%3A%2F%2Frbm-demos.lnr.io%2Fworld-clock%2F&pos=center&size=60&bright=100&bg=hiking&bg-dark=10) · 👓 [Add it to your glasses](#add-to-your-glasses)

> ✅ **Status: Working.** Everything runs on the glasses with no network: times come from the browser's built-in `Intl` time-zone data and favorites persist in localStorage.

## What it does

- Home screen lists your favorite cities with **live, DST-correct** local times (updated every second) and their offset from your own time zone.
- New York is favorited by default.
- Browse a built-in list of 20 major world cities and toggle any of them in or out of your favorites.
- Favorites persist locally between sessions.

## Controls

| Where  | Input   | Result                                   |
| ------ | ------- | ---------------------------------------- |
| Home   | `▲` `▼` | Move between favorites and **Add City**  |
| Home   | `Enter` | On **Add City** → open the picker; on a favorite → remove it |
| Picker | `▲` `▼` | Scroll the city list                     |
| Picker | `Enter` | Toggle the highlighted city as a favorite |
| Picker | `◀`     | Back to home                             |
| Picker | Back gesture (thumb + middle finger) | Back to home |
| Anywhere | Voice (Meta AI) | Ask for the time in a city, or add / remove a favorite — see below |

## Voice (Meta AI)

With WebMCP enabled, Meta AI can drive the clock by voice. Try:

- "What time is it in my cities?"
- "Add Tokyo to my world clock."
- "Add London and remove New York."
- "Take Sydney off the list."

City names must match one of the 20 built-in cities (case doesn't matter); if a name isn't in the list, Meta AI will tell you which cities are available.

> Voice control requires WebMCP to be enabled on the device (Developer Mode or rollout). Relaunch the app after enabling it. Without it the app behaves exactly as before — D-pad only.

## Add to your glasses

Scan this with your phone to open the Meta AI app and add the demo to your Ray-Ban Meta Display glasses:

<img src="qr-glasses.png" width="160" alt="QR code that adds World Clock to your glasses">

Or add it by hand in the Meta AI app: **Devices → Display Glasses settings → App connections → Web apps → Add a web app**, with the name `World Clock` and this URL:

```
https://rbm-demos.lnr.io/world-clock/
```

## Running locally

```sh
npx serve -l 5050 world-clock
```

Then open `http://localhost:5050` in Chrome at 600×600.

### Regenerating screenshots

> 🛠️ **Developer tooling only.** The app itself has zero Chrome dependency — it's vanilla HTML/CSS/JS that runs in the Ray-Ban Meta Display's built-in browser. The block below is just the local recipe used on a Mac to refresh the PNGs in `screenshots/`.

The app has no `?state=` routing, so a single plain capture of the home screen is the recipe:

```bash
npx serve -l 5050 world-clock &
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
mkdir -p world-clock/screenshots
"$CHROME" --headless --disable-gpu --hide-scrollbars \
  --window-size=600,600 --virtual-time-budget=2000 \
  --screenshot="world-clock/screenshots/preview.png" \
  "http://localhost:5050/"
```

## Files

```
world-clock/
├── index.html
├── styles.css
├── app.js
└── favicon.png     # black "WC" on teal
```

<sub>Made by Gautier de Lataillade at [L+R](https://www.levinriegner.com).</sub>
