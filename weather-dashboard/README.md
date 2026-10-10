# Weather Dashboard

A 5-day forecast for five preset cities on the Meta Ray-Ban Display glasses, powered by the free **Open-Meteo** API (no API key). Pick a city and a day with the D-pad, or ask Meta AI for the weather and watch the lens update.

> ▶ [Try it in the simulator](https://displayglasses.dev/?url=https%3A%2F%2Frbm-demos.lnr.io%2Fweather-dashboard%2F&pos=center&size=60&bright=100&bg=hiking&bg-dark=10) · 👓 [Add it to your glasses](#add-to-your-glasses)

> 🔌 **Status: Working with live data.** Forecasts come from the Open-Meteo public API (no key); offline the shell loads from the service worker but the panel shows `Could not load weather` and the header flips to `Offline`, since the 10-minute cache is in memory only and does not survive a reload.

---

## What it does

- **Current conditions.** City, temperature (Celsius), WMO condition label with an emoji icon, wind speed (km/h) and compass direction, plus an `Updated HH:MM` stamp in the header.
- **5-day forecast row.** Five focusable day cards (Today plus four days) with icon, high and low. Enter on a card swaps the main panel to that day's high / low and condition without a network hit.
- **Five preset cities.** New York, London, Tokyo, Sydney and Paris. The selected city persists in `localStorage` (`mdg_weather_dashboard`).
- **10-minute cache per city.** Repeat visits render from cache; the Refresh button (or the `weather_refresh` voice tool) busts it. Concurrent fetches for one city are deduplicated.
- **Error handling.** A failed fetch hides the main block, shows `Could not load weather: …` with a `Try Again` button, and flips the header stamp to `Offline`.
- **Voice via Meta AI.** Three WebMCP tools let the wearer ask for the weather, switch city, or refresh by speaking. See **Voice (Meta AI)** below.
- **Offline shell.** A network-first service worker (`sw.js`) precaches the app's own files; API requests are never cached.

---

## Controls

| Where | Input | Result |
| --- | --- | --- |
| Home | ▲ ▼ ◀ ▶ | Move focus spatially between the five day cards, `Change City` and `Refresh` (wraps when nothing lies in that direction) |
| Home | Enter (on a day card) | Show that day's high / low and condition in the main panel |
| Home | Enter (on `Change City`) | Open the city list |
| Home | Enter (on `Refresh`) | Bust the cache and re-fetch the selected city |
| Home (error) | Enter (on `Try Again`) | Retry the fetch |
| Cities | ▲ ▼ | Move focus between `←` and the city rows |
| Cities | Enter (on a city) | Select it, save it, and return home (fetches on arrival) |
| Cities | Enter (on `←`) | Return home without changing the city |
| Cities | Back gesture (thumb + middle finger) | Return home |
| Anywhere | Voice (Meta AI) | See **Voice (Meta AI)** below |

---

## Voice (Meta AI)

The app registers three WebMCP tools on `document.modelContext` (`weather_get_state`, `weather_set_city`, `weather_refresh`) so the wearer can drive it by talking to Meta AI. Things you can say:

- "What's the weather like?" / "What's the forecast for the weekend?"
- "Switch to Tokyo" / "Show me London"
- "Refresh the forecast"
- "Which cities can I pick?"

`weather_set_city` only accepts the five presets and returns the list on an unknown name. Both the city switch and the refresh await the same Open-Meteo fetch the buttons trigger (with the assistant's deadline forwarded), so the spoken summary matches the screen. The app runs unchanged where `document.modelContext` is absent (desktop Chrome, the simulator, older firmware).

> WebMCP must be enabled on the device (Developer Mode or rollout), and the app relaunched after enabling it — eligibility is decided once at launch.

---

## Screenshots

No screenshots yet. The app has no `?state=` routing.

---

## Add to your glasses

Scan this with your phone to open the Meta AI app and add the demo to your Ray-Ban Meta Display glasses:

<img src="qr-glasses.png" width="160" alt="QR code that adds Weather Dashboard to your glasses">

Or add it by hand in the Meta AI app: **Devices → Display Glasses settings → App connections → Web apps → Add a web app**, with the name `Weather Dashboard` and this URL:

```
https://rbm-demos.lnr.io/weather-dashboard/
```

## Running locally

The app is a single static HTML/CSS/JS bundle — no build step.

```bash
npx serve -l 3041 weather-dashboard
# then open http://localhost:3041
```

Open it in Chrome at 600×600 (DevTools device toolbar, custom viewport) and drive it with the arrow keys and Enter. Weather data comes live from Open-Meteo, so the machine needs a network connection on first load.

### Regenerating screenshots

> 🛠️ **Developer tooling only.** The app itself has zero Chrome dependency — it's vanilla HTML/CSS/JS that runs in the Ray-Ban Meta Display's built-in browser. The block below is just the local recipe used on a Mac to refresh the PNGs in `screenshots/`.

There is no `?state=` routing, so a single plain capture of the home screen is the recipe. Give it enough virtual time for the Open-Meteo fetch to land:

```bash
npx serve -l 3041 weather-dashboard &
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
mkdir -p weather-dashboard/screenshots
"$CHROME" --headless --disable-gpu --hide-scrollbars \
  --window-size=600,600 --virtual-time-budget=5000 \
  --screenshot="weather-dashboard/screenshots/home.png" \
  "http://localhost:3041/"
```

---

## Notes

### Screens

- **Home** — current temperature, condition, wind + 5-day forecast row
- **Cities** — New York · London · Tokyo · Sydney · Paris

Selected city persists via `localStorage`. Weather is cached for **10 minutes** per city; the Refresh button busts the cache.

### API

Uses `https://api.open-meteo.com/v1/forecast` with:

- `current_weather=true` for temperature, wind, condition code
- `daily=temperature_2m_max,temperature_2m_min,weathercode` for the 5-day row
- `timezone` set per city for correct local "today"
- `forecast_days=5`

Weather codes follow the WMO table; mapped to emoji icons (no external fonts).

---

## Files

```
weather-dashboard/
├── index.html      # home + cities screens, service-worker registration
├── styles.css      # dark theme + weather-specific layout
├── app.js          # navigation, spatial D-pad focus, fetch, render, cache, persistence, WebMCP tools
├── sw.js           # network-first service worker
├── favicon.png     # app icon
├── qr-publish.png  # QR code image
└── vercel.json     # static rewrite config for Vercel hosting
```

---

<sub>Made by L+R at [L+R](https://www.levinriegner.com).</sub>
