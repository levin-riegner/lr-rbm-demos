# DOOM

The original id Software DOOM running on Meta Display Glasses (or any 600x600 webapp). D-pad arrows for movement, tap-to-fire, lean-to-strafe.

Engine: [js-dos](https://js-dos.com) v8 (DOSBox compiled to WebAssembly), loaded from CDN. No local build chain.

## You must supply your own DOOM game files

This repo does **not** include any DOOM `.wad` or `.jsdos` bundle. id Software released DOOM Episode 1 as freely redistributable shareware in 1993, but you have to fetch your own copy.

The webapp expects a single file at:

```
examples/doom/assets/doom.jsdos
```

A `.jsdos` is a ZIP that contains the DOS executable, the DOOM data file (`*.WAD`), and a small autoexec config telling DOSBox how to launch the game. `.gitignore` already excludes `*.jsdos`, `*.zip`, and `*.wad` so binaries cannot be committed by accident.

### Option A (fastest): use the js-dos sample bundle

```sh
curl -L -o examples/doom/assets/doom.jsdos \
  https://v8.js-dos.com/bundles/doom.jsdos
```

This is the bundle the js-dos team hosts publicly. It contains the full retail `DOOM.WAD`. About 5.3 MB.

### Option B (cleanest): build your own from shareware

This is the right option if you only want to ship freely-redistributable content.

1. Download the shareware DOOM distribution from the Internet Archive item [`DoomsharewareEpisode`](https://archive.org/details/DoomsharewareEpisode). The file `doom.ZIP` (~2.3 MB) contains `DOOM.EXE`, `DOOM1.WAD`, and supporting files.
2. Open the [js-dos Studio](https://v8.js-dos.com).
3. Upload the contents of the ZIP, set the autoexec to `DOOM`, export as `.jsdos`.
4. Save the file as `examples/doom/assets/doom.jsdos`.

The result is one shareware-only Episode (E1M1 through E1M9) and is yours to redistribute under id Software's shareware terms.

## Quick start

Once `assets/doom.jsdos` is in place:

```sh
cd examples/doom
python3 -m http.server 8080
```

Open `http://localhost:8080` in Chrome. Set DevTools viewport to 600x600 (`Cmd+Shift+M` then choose "Responsive" → 600x600).

The boot screen shows a "Tap to start" button. Click it; on iOS this also triggers the motion-permission prompt. js-dos boots from the CDN, the bundle loads, and DOOM lands on its main menu.

## Controls

| Input | Game action |
|-------|-------------|
| D-pad ▲ / ▼ (or W / S on a real keyboard) | Walk forward / backward |
| D-pad ◀ / ▶ (or ← / → on a keyboard) | Turn left / right |
| **Tilt phone or head ≥ 15° left / right** | **Strafe left / right** |
| Tap anywhere on game canvas (or Enter key) | Fire + menu select |
| Long-press canvas ≥ 250 ms (or hold Enter) | Use (open doors, hit switches) |
| ESC button (or Esc key) | DOOM menu |

You cannot finish E1M1 without **Use**: the exit room sits behind a door.

### Tunable knobs

Top of `app.js`:

| Constant | Default | Effect |
|----------|---------|--------|
| `HOLD_MS` | 250 | Tap-vs-long-press cutoff for fire vs use |
| `STRAFE_ENGAGE_DEG` | 15 | Tilt angle that triggers strafe |
| `STRAFE_RELEASE_DEG` | 8 | Tilt angle that returns to neutral (hysteresis) |
| `TAP_PULSE_MS` | 40 | Synthetic key-down to key-up gap |

Brightness lift in `styles.css` (`.dos-wrap { filter: ... }`): tune if corridors are still hard to read on the additive display.

## Deploying for device testing

```sh
cd examples/doom
vercel --yes
```

The included `package.json`, `server.js`, and `vercel.json` configure a static-site deploy. After the first deploy, the toolkit's `/test-on-device` skill walks through aliasing to a stable URL, disabling Vercel SSO so the glasses browser can reach the page, and generating a QR code that deep-links the webapp into the Meta AI app.

For incremental redeploys, bump the SW cache version (`CACHE` constant in `sw.js`) so browsers actually fetch the new files instead of serving from the previous Service Worker cache.

## Known limits and design notes

- **Bundle and load size are deliberately over the toolkit's standard limits.** First load is ~1.5 MB of js-dos runtime + ~3-5 MB of bundle. The Service Worker caches everything to zero bytes on subsequent loads. Do not use this example's footprint as a baseline for utility apps.
- **35 fps, not 60.** That's DOOM's native engine tick rate, not a regression from emulation.
- **Save games are ephemeral.** js-dos defaults to in-memory storage that's wiped on reload. Enable `noCloud: false` in `vendor/doom-engine.js` to allow js-dos cloud saves.
- **Additive display compensation.** DOOM's near-black pixels are invisible on the glasses (additive waveguides treat black as transparent). The CSS brightness filter on `.dos-wrap` lifts the floor; raise it further if needed, but it costs battery (pixel power scales with luminance).
- **iOS motion permission requires a user gesture.** The "Tap to start" button on the boot screen exists for this. Without it, lean-to-strafe is silently disabled and the game still works with arrows + tap + long-press.

## Files

| File | What it does |
|------|--------------|
| `index.html` | Boot, game, and error screens; D-pad and ESC overlays; `#dos-mount` for js-dos |
| `app.js` | Boot orchestration; input plumbing (keys, on-screen buttons, canvas taps, head roll) |
| `styles.css` | Palette, brightness filter, D-pad layout, js-dos chrome hide |
| `sw.js` | Service Worker; caches shell, engine, js-dos CDN files, bundle |
| `vendor/doom-engine.js` | Thin shim around js-dos v8; exposes `window.startDoom({container})` |
| `assets/doom.jsdos` | Your DOOM bundle, gitignored, never committed |
| `debug.html` | Standalone input dashboard for verifying device behaviour (separate page from DOOM) |
| `package.json` / `server.js` / `vercel.json` | Static-site config for local dev and Vercel deploys |

## Debug page

Open `/debug.html` instead of `/` to skip DOOM and see a live readout of every keyboard, pointer, and motion event. Useful for verifying on the actual glasses whether captouch swipes produce sustained `keydown` events (needed for held-walk) and whether EMG pinch gives a measurable hold duration (needed for tap-vs-hold fire/use).
