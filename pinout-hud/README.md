# Pinout HUD

A hands-free wiring diagram reference for the **Ray-Ban Meta Display** —
designed for electrical engineers actively soldering ESP32s and custom
microcontrollers. Glance at the schematic in your periphery instead of
putting the iron down to check a pinout.

![Home](screenshots/01-home.png)

---

## Why

Soldering is two-handed work. The instant you reach for a phone or a
datasheet PDF, the joint cools, the iron drifts, and you lose your place
on the board. Pinout HUD lives in the right side of your lens — a
schematic-style HUD that keeps each pin's label and wire colour one
swipe away.

## How to use it

The Meta Display has no keyboard. The whole app drives off **four
directional swipes plus a tap** — the same gestures the temples expose.

| Gesture | What it does |
| --- | --- |
| Swipe Up / Down | Move focus through a list, step through pins |
| Swipe Left / Right | Move focus across a grid, or enter / exit Focus Mode |
| Tap | Select the focused item |

A browser preview maps **arrow keys** to swipes and **Enter / Space** to
tap so you can rehearse a flow at your desk.

## Flows

### 1. Pick a board

Start from one of four preloaded ESP32 templates or build a custom board
pin-by-pin.

![ESP32 list](screenshots/03-esp32-list.png)

### 2. Confirm wire colours

Each pin starts with a sensible default (GND→black, 3V3→red, GPIO→blue,
TX→green, RX→yellow, SPI→purple/white). Tap any row to cycle through the
eight wire colours.

![Color assign](screenshots/04-color-assign.png)

### 3. Custom boards — label grid

The custom flow uses a **5 × 9 spatial grid** of the most common pin
labels (power, control, I²C, SPI, GPIO0–39, analog, digital). Swipe to
land on any label in ≤4 moves, tap to confirm. Picking a label
auto-suggests its conventional wire colour so the second tap is usually
just confirmation.

![Label grid](screenshots/08-label-grid.png)

![Color pick](screenshots/09-color-pick.png)

### 4. Active reference

The home HUD for the bench. Pins listed in their physical breadboard
order, each with its wire colour and a glowing schematic stub.

![Reference](screenshots/05-reference.png)

### 5. Focus Mode

Right-swipe from the reference list to enter Focus Mode. The pin under
the iron is rendered huge in your peripheral vision while everything
else dims — so you cannot solder the wrong pad by accident.

![Focus mode](screenshots/06-focus-mode.png)

Up / Down step pins. Left-swipe exits back to the full overview.

## Onboarding

A three-step walkthrough on first launch (clear
`pinout.walkthrough.seen` in `localStorage` to replay).

![Walkthrough](screenshots/02-walkthrough.png)

## Design notes

- **Schematic dark mode.** Pure black so the lens stays transparent,
  electric chrome accent (`#4ea1ff`), and eight high-contrast neon wire
  colours drawn with a glow + terminal end-cap.
- **Right-weighted.** `--pad-l: 160px` parks every screen against the
  right of the 600 × 600 lens; the left gutter is reserved for a
  vertical `PINOUT · HUD · v1` mark and a faint accent rule.
- **Canvas flourishes.** A background `<canvas>` paints five thin PCB
  polylines along the gutter and corners; a soft accent "current" pulse
  slides each trace on its own loop. Pure decoration; never overlaps
  active content.
- **Typography.** Monospace everywhere (SF Mono / JetBrains Mono) so
  `GPIO13` never gets misread as `GPIO18`.

## File layout

```
pinout-hud/
├── index.html        # 8 screens + toast + confirm
├── styles.css        # right-aligned HUD, neon wire palette
├── app.js            # state machine, focus mode, canvas init
├── data.js           # 4 ESP32 templates, label grid, default colours
└── screenshots/      # all images above
```

## Running locally

```bash
npx serve -l 4208 pinout-hud
```

Then open `http://localhost:4208` and use arrow keys + Enter to drive.

## Custom-pin count

The Custom flow opens with a `+ / −` stepper for the pin count. The pin
list is then walked one pin at a time — label step, then colour step,
then next pin.

![Custom pin count](screenshots/07-custom-count.png)

---

Case study: [levinriegner.com/work/pinout-hud](https://www.levinriegner.com/work/pinout-hud/)

<sub>By Alex Levin · [L+R](https://levinriegner.com)</sub>
