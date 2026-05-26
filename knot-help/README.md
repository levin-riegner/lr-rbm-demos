# Knot Helpful

A heads-up display for Meta Display glasses that teaches **six famous knots** — bowline, figure-8, clove hitch, monkey's fist, trucker's hitch, and constrictor. Each knot has its own iconic tagline (KING OF KNOTS, STRONGEST BINDING, …), a strength rating, and a step-by-step walkthrough with a schematic rope diagram and a per-step common-mistake tip.

---

## What it does

- **Pick a famous knot.** The main menu lists six well-known knots, each with a one-line identity (e.g. *Bowline — King of Knots*, *Figure Eight — Climber's Tie-in*) and a 1–5 dot strength rating.
- **Step-by-step walkthrough.** Each knot has a sequence of steps — usually 3–5 — each with a big serif/sans instruction, an SVG rope diagram showing the current move in ember orange against the already-tied sections in dim cream, and a **TIP** call-out warning about the most common mistake at that step.
- **Bowline rabbit story.** The bowline uses the classic mnemonic — *rabbit hole → up through → around the tree → back down* — with diagrams labelled to match.
- **Monkey's Fist renders the ball.** The final step of the monkey's fist shows a real gradient-shaded sphere with the woven cross-pattern hatched on top, so you can see what "tight" looks like.
- **Glasses-friendly typography.** Bold Inter throughout, sized for the 600×600 lens. Pure black background so the rope diagrams sit cleanly on the world.
- **"Knot a problem!" success card.** Finishing the last step stamps a rotated *TIED WELL* seal and the knot name in heavy weight, plus a one-line description of where the knot shines.

---

## Controls

| Where | Input | Result |
| --- | --- | --- |
| Menu | ▲ ▼ | Move focus between the six knots |
| Menu | Enter or ▶ | Open the focused knot at step 1 |
| Learn | ▶ or Enter | Next step (last step → success card) |
| Learn | ◀ | Previous step (step 1 → back to menu) |
| Learn | ▲ | Jump to first step |
| Learn | ▼ | Jump to last step |
| Success | ◀ | Restart the same knot |
| Success | Enter or ▶ | Back to the menu |

---

## Screenshots

### Menu

| Six famous knots, each with a tagline + strength rating |
| --- |
| ![Menu](screenshots/menu.png) |

### Bowline — the rabbit story (four steps)

| 1. Rabbit hole | 2. Up through | 3. Around the tree | 4. Back down |
| --- | --- | --- | --- |
| ![Bowline step 1](screenshots/bowline.png) | ![Bowline step 2](screenshots/bowline-step-2.png) | ![Bowline step 3](screenshots/bowline-step-3.png) | ![Bowline step 4](screenshots/bowline-step-4.png) |

### Other knots (step 1)

| Figure Eight | Clove Hitch | Monkey's Fist |
| --- | --- | --- |
| ![Figure 8](screenshots/figure8.png) | ![Clove Hitch](screenshots/clove.png) | ![Monkey's Fist](screenshots/monkey-fist.png) |

| Trucker's Hitch | Constrictor | Monkey's Fist — finished sphere |
| --- | --- | --- |
| ![Trucker's Hitch](screenshots/truckers.png) | ![Constrictor](screenshots/constrictor.png) | ![Monkey's Fist final](screenshots/monkey-fist-step-4.png) |

### Success card

| TIED WELL stamp on completion |
| --- |
| ![Done](screenshots/done.png) |

---

## Running locally

The app is a single static HTML/CSS/JS bundle — no build step.

```bash
npx serve -l 4223 knot-help
# then open http://localhost:4223
```

For development inside the `meta-display-glasses-webapps` workspace it's also wired into `.claude/launch.json` as the `knot-help` preview target on port **4223**.

### Regenerating screenshots

> 🛠️ **Developer tooling only.** The app itself has zero Chrome dependency — it's vanilla HTML/CSS/JS that runs in the Ray-Ban Meta Display's built-in browser. The block below is just the local recipe used on a Mac to refresh the PNGs in `screenshots/`.

The screenshots above are produced from headless Chrome against the `?state=…` URL parameter the app reads on load:

```bash
npx serve -l 4323 knot-help &
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
for STATE in menu bowline bowline-step-2 bowline-step-3 bowline-step-4 \
             figure8 clove monkey-fist monkey-fist-step-4 \
             truckers constrictor done; do
  "$CHROME" --headless --disable-gpu --hide-scrollbars \
    --window-size=600,600 --virtual-time-budget=5000 \
    --screenshot="knot-help/screenshots/$STATE.png" \
    "http://localhost:4323/?state=$STATE"
done
cp knot-help/screenshots/menu.png knot-help/screenshots/preview.png
```

The state grammar is `<knot>[-step-N]` or `<knot>-done`, plus the literal `menu` and `done`.

---

## Files

```
knot-help/
├── index.html      # menu / learn / done screens + TIED WELL stamp
├── styles.css      # 600×600 dark HUD; bold Inter sans-serif, ember accent
├── app.js          # state machine, six knot definitions, SVG diagrams, ?state= router
├── favicon.svg     # ember rope curl on black
└── screenshots/    # generated state captures used by this README
```

---

<sub>Made by Alex Levin at [L+R](https://www.levinriegner.com).</sub>
