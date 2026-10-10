# IP Info

Shows your public IP and geolocation details on the Meta Ray-Ban Display glasses, from the free **ipapi.co** API (no API key). One screen, seven cards, and a Copy IP action for when you need the address somewhere else.

---

## What it does

- **Card grid.** IP (monospace, cyan), City, Region, Country (with flag), Timezone, Org (ISP) and Coords (lat, lon).
- **Relative timestamp.** The header shows "Updated Xs ago"; the label refreshes every 10 s while the page is visible and is computed from the fetch time, so it is exact after a pause.
- **30-minute cache.** The response is stored in `localStorage` under `mdg_ip_info`; the app renders from cache on load and only re-fetches when it is older than 30 minutes. Refresh bypasses the cache.
- **Copy IP.** Enter on the IP card or on the Copy IP button writes the address to the clipboard and shows a brief "Copied" toast.
- **Error state.** If the lookup fails, an inline message and a Retry button replace the grid.
- **Offline-friendly.** A network-first service worker caches the app shell.

---

## Controls

| Where | Input | Result |
| --- | --- | --- |
| Home | ◀ ▶ | Move focus to the previous / next card or button |
| Home | ▲ ▼ | Move focus one row up / down in the two-column grid |
| Home | Enter (on the IP card) | Copy the IP address (shows "Copied") |
| Home | Enter (on Refresh) | Fetch fresh data now, bypassing the cache |
| Home | Enter (on Copy IP) | Copy the IP address |
| Error | Enter (on Retry) | Retry the lookup |

The app is a single screen with nothing to go back to, so the Back gesture is left to the system.

---

## Screenshots

| Home |
| --- |
| <img src="screenshots/preview.png" width="300"> |

---

## Running locally

The app is a single static HTML/CSS/JS bundle — no build step.

```bash
npx serve -l 3102 ip-info
# then open http://localhost:3102
```

### Regenerating screenshots

> 🛠️ **Developer tooling only.** The app itself has zero Chrome dependency — it's vanilla HTML/CSS/JS that runs in the Ray-Ban Meta Display's built-in browser. The block below is just the local recipe used on a Mac to refresh the PNGs in `screenshots/`.

The app has no `?state=` routing; a single capture of the loaded Home screen is enough:

```bash
npx serve -l 3102 ip-info &
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless --disable-gpu --hide-scrollbars \
  --window-size=600,600 --virtual-time-budget=4000 \
  --screenshot="ip-info/screenshots/preview.png" \
  "http://localhost:3102/"
```

---

## Notes

### API

`https://ipapi.co/json/` — returns `ip`, `city`, `region`, `country_name`, `country_code`, `timezone`, `org`, `latitude`, `longitude`, etc.

Results are cached in `localStorage` under key `mdg_ip_info` for **30 minutes**. The Refresh button bypasses the cache.

---

## Files

```
ip-info/
├── index.html      # card grid + toolbar + loading + error, service-worker registration
├── styles.css      # grid, spinner, toast, flag sizing
├── app.js          # fetch, cache, relative-time updater, copy-ip, error/retry
├── sw.js           # network-first service worker
├── favicon.png     # app icon
├── vercel.json     # static rewrites
└── screenshots/    # preview.png
```

---

<sub>Made by L+R at [L+R](https://www.levinriegner.com).</sub>
