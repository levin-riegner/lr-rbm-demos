# CDJ Display

A glanceable booth telemetry HUD for DJs running two CDJ-3000Xs on a Pro DJ Link network. The display sits in the **top half** of the lens — 600 × 300 px — so it floats above the mixer without ever covering the dancefloor or the gear.

## What it does

- **Two-deck overview at a glance.** For each CDJ-3000X it shows the unit number, IP on the Pro DJ Link subnet, PLAYING / CUE / PAUSED status, live BPM, downbeat-aware 4-step beat indicator (1/4 · 2/4 · 3/4 · 4/4), current track, and pitch fader position with sign and percentage.
- **MASTER / SYNC tags.** Knows which deck is currently driving the tempo and which is following.
- **Live mixer state.** Four channel faders rendered as tiny vertical strips — CH1 is wired to Deck A, CH2 to Deck B, CH3 / CH4 stay dim when nothing is routed there. You can see at a glance which channels are *up* and which are *down*.
- **Crossfader telemetry.** A wide ribbon shows the crossfader's exact position with five tick marks; the indicator turns amber and labels `◀ A 85%` or `B 85% ▶` the moment it leaves center, so the DJ knows the room is being fed by one deck only.
- **Half-lens layout.** The bottom 300 px of the lens stays pure `#000`, which is transparent on the waveguide — so the dancefloor stays visible below the HUD.

The data is illustrative — Deck A starts at 124.0 BPM as MASTER, Deck B is sync'd to it. In a production build the same view could be driven straight from Pioneer's Pro DJ Link UDP packets or [`prolink-connect`](https://github.com/EvanPurkhiser/prolink-connect) and become a real booth display.

## Controls

**None.** This is a passive read-only HUD — the DJ drives the gear, the glasses just report what the CDJs and mixer are doing. No D-pad input, no swipes, no Enter binding.

## Screenshots

| Default — both decks playing, crossfader centered | Crossfader pushed toward Deck A | Crossfader pushed toward Deck B |
| --- | --- | --- |
| ![Home](screenshots/home.png) | ![Crossfade A](screenshots/crossfade-a.png) | ![Crossfade B](screenshots/crossfade-b.png) |

| Deck B cued (channel dropped) | Pitched (Deck A +2.4%, Deck B −1.8%) |
| --- | --- |
| ![Cue](screenshots/cue.png) | ![Pitched](screenshots/pitched.png) |

## Running locally

The app is a single static HTML/CSS/JS bundle — no build step.

```bash
npx serve -l 4220 cdj-display
# then open http://localhost:4220
```

### Regenerating screenshots

> 🛠️ **Developer tooling only.** The app itself has zero Chrome dependency — it's vanilla HTML/CSS/JS that runs in the Ray-Ban Meta Display's built-in browser. The block below is just the local recipe used on a Mac to refresh the PNGs in `screenshots/`.

The screenshots above are produced from headless Chrome against the `?state=…` URL parameter the app reads on load:

```bash
npx serve -l 4320 cdj-display &
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
for STATE in home crossfade-a crossfade-b cue pitched; do
  "$CHROME" --headless --disable-gpu --hide-scrollbars \
    --window-size=600,600 --virtual-time-budget=3000 \
    --screenshot="cdj-display/screenshots/$STATE.png" \
    "http://localhost:4320/?state=$STATE"
done
```

## Files

```
cdj-display/
├── index.html      # top-half HUD: 2 decks + 4-ch mixer + crossfader
├── styles.css      # 600×300 black booth telemetry; cyan + jade + amber
├── app.js          # demo state, beat clock, pitch math, ?state= routing
├── favicon.svg     # cyan jog-wheel mark
└── screenshots/    # generated state captures used by this README
```

<sub>Made by Alex Levin at [L+R](https://www.levinriegner.com).</sub>
