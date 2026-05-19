# GLIMMER · A Peripheral Companion

> A Tamagotchi-inspired creature that lives at the edge of your sight — built for Meta Display Glasses.

---

## Overview

GLIMMER is a virtual companion designed for the Meta Ray-Ban glasses display. It lives in your peripheral vision as a small pixel-art creature, requiring real-time care and attention throughout your day. Inspired by the Tamagotchi, it rewards consistent check-ins with growth and evolution through five distinct life stages.

---

## Screenshots

| Welcome | Egg Selection | Game | Menu |
|---|---|---|---|
| ![Welcome](screenshots/01-welcome.png) | ![Egg Select](screenshots/02-egg-select.png) | ![Game](screenshots/03-game.png) | ![Menu](screenshots/04-menu.png) |

---

## How It Works

Your companion has four stats that decay passively over real time:

| Stat | Label | Action to restore |
|---|---|---|
| **FUEL** | Hunger | FEED |
| **MOOD** | Happiness | PLAY |
| **CHARGE** | Energy | REST |
| **CLEAN** | Hygiene | WASH |

A hidden **HEALTH** stat degrades if FUEL or CLEAN bottom out. Let health reach zero and your companion dies.

Six action buttons — `FEED`, `PLAY`, `REST`, `WASH`, `HEAL`, `MENU` — let you tend to your companion at any time.

---

## Evolution Stages

Your companion evolves automatically as it ages, provided it stays alive. Higher stages decay faster.

```
◇ EGG  →  ◯ SPRITE  →  ▣ DRONE  →  ✦ ORACLE  →  ♛ ARCHON
```

---

## Features

- **Passive stat decay** — stats drain on a 4-second tick, scaled by evolution stage
- **Random events** — poop, mood shifts, and illness occur unpredictably
- **Sleep state** — energy recharges faster while sleeping, other stats drain slower
- **Naming** — give your companion a custom name or roll a random one
- **Egg variants** — choose from Amethyst, Jade, or Ember at the start
- **Generation tracking** — GEN counter increments each time a new companion is adopted after death
- **Offline catch-up** — stats update on re-open, capped at 2 hours to prevent instant death
- **Persistent state** — saved to `localStorage`, survives app restarts

---

## Tech

Pure vanilla JS + Canvas 2D. No frameworks, no AI — all deterministic logic states. Designed for a 600×600 display.

---

## Case Study

Full case study and design process: [levinriegner.com/work/glimmer](https://www.levinriegner.com/work/glimmer/)

---

<sub>By [Alex Levin](https://www.levinriegner.com), L+R · [levinriegner.com](https://www.levinriegner.com)</sub>
