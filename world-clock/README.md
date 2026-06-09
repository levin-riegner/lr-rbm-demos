# World Clock

A tiny world-clock for the Meta Ray-Ban Display glasses. See the live local time in any city you care about, picked from a list and pinned to a favorites home screen — no typing, no mouse, just the D-pad.

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

## Running locally

```sh
npx serve -l 5050 world-clock
```

Then open `http://localhost:5050` in Chrome at 600×600.

## Files

```
world-clock/
├── index.html
├── styles.css
├── app.js
└── favicon.svg
```

<sub>Made by Gautier de Lataillade at [L+R](https://www.levinriegner.com).</sub>
