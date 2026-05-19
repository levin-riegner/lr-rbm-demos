# GLIMMER

A Tamagotchi-inspired virtual companion for Meta Display glasses that lives at the edge of your sight. Feed it, play with it, let it rest — care for it and it grows through five distinct life stages. Neglect it and it dies.

> 📖 **Case study:** [levinriegner.com/work/glimmer](https://www.levinriegner.com/work/glimmer/)

---

## What it does

- **Living companion.** A pixel-art creature with four passively-decaying stats — FUEL (hunger), MOOD (happiness), CHARGE (energy), CLEAN (hygiene) — plus a hidden HEALTH stat that degrades if FUEL or CLEAN bottom out. Stats drain on a 4-second tick.
- **Six actions.** FEED, PLAY, REST, WASH, HEAL, and MENU. Each action refills the corresponding stat. MENU opens a pause overlay with RESUME, RENAME COMPANION, and NEW COMPANION.
- **Five evolution stages.** EGG → SPRITE → DRONE → ORACLE → ARCHON. The companion evolves automatically as it ages — provided it stays alive. Higher stages decay faster.
- **Random events.** Poop appears unpredictably (hygiene penalty until washed), mood shifts, and illness occur — keeping you on your toes.
- **Naming & egg selection.** On first launch (or after adopting a new companion) you choose a name — type it directly, or roll a random generated one — then pick an egg colour: Amethyst, Jade, or Ember.
- **Generation tracking.** A GEN counter in the footer increments each time a companion dies and a new one is adopted, preserving your lineage across generations.
- **Offline catch-up.** Stats update on re-open based on elapsed real time, capped at 2 hours to prevent instant death from being away too long.
- **Persistent state.** Everything is saved to `localStorage` and restored on the next visit.

---

## Controls

| Where | Input | Result |
| --- | --- | --- |
| Anywhere | Tab / D-pad | Move focus between buttons |
| Anywhere | Enter / Space | Activate focused button |
| Main screen | FEED | Fill FUEL stat |
| Main screen | PLAY | Fill MOOD stat |
| Main screen | REST | Fill CHARGE stat (companion sleeps) |
| Main screen | WASH | Fill CLEAN stat |
| Main screen | HEAL | Restore HEALTH |
| Main screen | MENU | Open pause menu |
| Menu | RESUME | Close menu, return to companion |
| Menu | RENAME COMPANION | Edit companion name |
| Menu | NEW COMPANION | Abandon current, start adoption flow |
| Naming screen | Type | Edit name directly (max 14 chars, auto-uppercase) |
| Naming screen | RANDOM | Roll a random generated name |
| Dead screen | ADOPT NEW COMPANION | Begin new companion flow |

---

## Screenshots

### Onboarding

| Welcome | Name your companion | Pick your egg |
| --- | --- | --- |
| ![Welcome screen](screenshots/01-welcome.png) | ![Naming screen](screenshots/02-naming.png) | ![Egg selection](screenshots/03-egg-select.png) |

### Main game

| Healthy companion (SPRITE stage) | Pause menu |
| --- | --- |
| ![Main game view](screenshots/04-game.png) | ![Pause menu](screenshots/05-menu.png) |

### Death & adoption

| Companion death | New companion flow |
| --- | --- |
| ![RIP screen](screenshots/06-dead.png) | ![Adoption — egg select](screenshots/07-adopt.png) |

---

## Running locally

The app is a single static HTML/CSS/JS bundle — no build step.

```bash
npx serve -l 4201 lr-glimmer
# then open http://localhost:4201
```

For development inside the meta-display-glasses-webapps workspace it's also wired into `.claude/launch.json` as the `lr-glimmer` preview target on port **4201**.

### Regenerating screenshots

```bash
npx serve -l 4301 lr-glimmer &
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
mkdir -p lr-glimmer/screenshots

# Welcome (walkthrough step 0 — shown after the 3.6s splash)
"$CHROME" --headless --disable-gpu --hide-scrollbars \
  --window-size=600,600 --virtual-time-budget=5000 \
  --screenshot="lr-glimmer/screenshots/01-welcome.png" \
  "http://localhost:4301"

# For subsequent screens, clear localStorage and use browser automation
# or capture manually from the running preview.
```

---

## Files

```
lr-glimmer/
├── index.html      # walkthrough, game HUD, menus, dead overlay
├── styles.css      # 600×600 CRT aesthetic; lavender + amber + teal
├── app.js          # state machine, tick loop, Canvas 2D creature drawing
└── screenshots/    # screen captures used by this README
```

---

<sub>Made by Alex Levin at [L+R](https://www.levinriegner.com).</sub>
