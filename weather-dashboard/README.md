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
- **Back gesture (thumb + middle finger)** — back to previous screen
- **Voice (Meta AI)** — "What's the weather like?", "Switch to Tokyo", "Refresh the forecast" — see below

## Voice (Meta AI)

The app registers three WebMCP tools on `document.modelContext` (`weather_get_state`, `weather_set_city`, `weather_refresh`) so the wearer can drive it by talking to Meta AI. Things you can say:

- "What's the weather like?" / "What's the forecast for the weekend?"
- "Switch to Tokyo" / "Show me London"
- "Refresh the forecast"
- "Which cities can I pick?"

`weather_set_city` only accepts the five presets and returns the list on an unknown name. Both the city switch and the refresh await the same Open-Meteo fetch the buttons trigger (with the assistant's deadline forwarded), so the spoken summary matches the screen. The app runs unchanged where `document.modelContext` is absent (desktop Chrome, the simulator, older firmware).

> WebMCP must be enabled on the device (Developer Mode or rollout), and the app relaunched after enabling it — eligibility is decided once at launch.

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
