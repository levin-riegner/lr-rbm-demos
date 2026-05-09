# Weather Dashboard — Meta Display Glasses WebApp

5-day forecast for 5 preset cities, powered by the free **Open-Meteo** API (no API key).

## How to run (Chrome)

```bash
cd examples/weather-dashboard
python3 -m http.server 8080
```

Open [http://localhost:8080](http://localhost:8080) in Chrome, then:

1. Press **Cmd+Shift+M** to toggle the device toolbar
2. Set a **custom viewport of 600 × 600**
3. Refresh the page

## Controls

- **Arrow keys** — move focus between elements (D-pad)
- **Enter** — activate focused element (EMG pinch)
- **Escape** — back to previous screen

## Screens

- **Home** — current temperature, condition, wind + 5-day forecast row
- **Cities** — New York · London · Tokyo · Sydney · Paris

Selected city persists via `localStorage`. Weather is cached for **10 minutes** per city; the Refresh button busts the cache.

## API

Uses `https://api.open-meteo.com/v1/forecast` with:
- `current_weather=true` for temperature, wind, condition code
- `daily=temperature_2m_max,temperature_2m_min,weathercode` for the 5-day row
- `timezone` set per city for correct local "today"

Weather codes follow the WMO table; mapped to emoji icons (no external fonts).

## Files

```
weather-dashboard/
  index.html   # home + cities screens
  styles.css   # dark theme + weather-specific layout
  app.js       # navigation, D-pad, fetch, render, cache, persistence
```
