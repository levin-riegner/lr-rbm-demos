# IP Info — Meta Display Glasses WebApp

Shows your public IP and geolocation details from the free **ipapi.co** API (no API key).

## How to run (Chrome)

```bash
cd examples/ip-info
python3 -m http.server 8080
```

Open [http://localhost:8080](http://localhost:8080) in Chrome, then:

1. Press **Cmd+Shift+M** to toggle the device toolbar
2. Set a **custom viewport of 600 x 600**
3. Refresh the page

## Controls

- **Arrow keys** — move focus between cards / buttons (D-pad)
- **Enter** — activate focused element (EMG pinch)
- Focusing the IP card and pressing Enter copies the IP

## Display

Card grid: IP (copyable, monospace, cyan), City, Region, Country (with flag), Timezone, Org (ISP), Coords (lat, lon).
Header shows "Updated Xs ago", auto-refreshing every 10s.
Bottom toolbar: Refresh (force fetch) and Copy IP (with a brief "Copied" toast).

## API

`https://ipapi.co/json/` — returns `ip`, `city`, `region`, `country_name`, `country_code`, `timezone`, `org`, `latitude`, `longitude`, etc.

Results are cached in `localStorage` under key `mdg_ip_info` for **30 minutes**. The Refresh button bypasses the cache.

## Files

```
ip-info/
  index.html   # card grid + toolbar + loading + error
  styles.css   # grid, spinner, toast, flag sizing
  app.js       # fetch, cache, relative-time updater, copy-ip, error/retry
  vercel.json  # static rewrites
```
