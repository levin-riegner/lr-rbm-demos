# Snake — Hypernova Webapp Example

A classic Snake game built as a Hypernova webapp, designed for the 600x600 display canvas used on Meta wearables.

## How to run

Open `index.html` in any modern browser, or serve the directory with a local HTTP server:

```
npx serve .
```

## Controls

- **Arrow keys** — change direction
- **D-pad / EMG swipe gestures** — navigate menus and control the snake on-device
- **Back gesture (thumb + middle finger)** — stop a running game and return to the menu; dismiss the Game Over panel; leave High Scores

## Notes

- Fixed viewport: 600x600px, matching the wearable display resolution
- High scores are persisted via `localStorage`
- No dependencies — plain HTML, CSS, and JavaScript
