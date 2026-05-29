# Flutter Display

An experiment to see how a **Flutter Web** app behaves on the Meta Ray-Ban Display. It's the canonical Flutter starter counter, ported to a 600×600 D-pad-only HUD with a pure-black canvas so it composes correctly through the waveguide's additive blend.

Built mostly to answer one question: **can Flutter Web be a viable runtime for these glasses?** The rest of the repo is vanilla HTML/CSS/JS; this folder is the only one with a build step.

---

## What it does

- **Tally counter.** Big monospaced number in the middle of the lens, ticks up/down on the D-pad, resets on Enter.
- **Pulse + flash on input.** A subtle scale pulse on the number and a short `+1` / `-1` / `RESET` chip flash above it confirm each press without taking screen real estate.
- **Floor at zero.** Decrement at zero is a no-op — it behaves like a physical tally counter, not a signed register.
- **No on-screen affordances that don't exist on the device.** No tap, no close button, no on-screen keyboard. Footer hints reflect only the three keys the hardware actually has.

---

## Controls

| Where | Input | Result |
| --- | --- | --- |
| Counter | ▲ | +1 |
| Counter | ▼ | −1 (clamps at 0) |
| Counter | Enter | Reset to 0 |

---

## Running locally

Unlike the other demos in this repo, this one needs a build step — Flutter Web emits a JS/Wasm bundle into `build/web/`, and that bundle is what you serve.

```bash
# from this directory
flutter build web
npx serve -l 4242 build/web
# then open http://localhost:4242
```

For active development you can also use Flutter's own dev server (hot reload, source maps), at the cost of a heavier runtime:

```bash
flutter run -d chrome --web-port 4242
```

The simulator at the repo root can iframe either URL.

---

## Notes from the experiment

- **Bundle size.** A do-nothing Flutter Web app is ~1.5 MB of JS + ~5 MB of CanvasKit (or Skwasm) on first paint. Vanilla demos in this repo are kilobytes. That matters on the glasses' constrained browser.
- **Rendering.** The default renderer (CanvasKit) paints everything to a `<canvas>`, which the waveguide composites additively — pure-black pixels are transparent, light pixels show through. That part works fine; the L+R house style of "white text on `#000`" maps cleanly.
- **Input.** Arrow keys + Enter are delivered to the focused `Focus` node as `KeyEvent`s the same as on desktop Flutter — no platform-channel work needed.
- **Fonts.** Flutter's default (Roboto / system) ship with the bundle. Matching the rest of the repo's Space Grotesk + JetBrains Mono pair would mean either the `google_fonts` package (runtime fetch) or shipping `.ttf` assets. Left off for this first pass.

---

## Files

```
flutter_display/
├── lib/
│   └── main.dart        # RbmCounterApp + CounterPage, 600×600 black layout, D-pad handler
├── web/
│   ├── index.html       # locked 600×600 viewport, black body
│   ├── manifest.json    # PWA metadata, black theme color
│   └── favicon.png
├── test/
│   └── widget_test.dart # sends ▲ ▼ ↵ keys and asserts the counter responds
├── pubspec.yaml
└── README.md
```

---

<sub>Made by Gautier de Lataillade at [L+R](https://www.levinriegner.com).</sub>
