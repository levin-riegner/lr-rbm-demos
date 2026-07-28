# Skipper

A skipper's coach for three specific rental hulls — **NIKITA 470**, **BLU WATER 170**, and the **MOSTRO CORVETTE 68** — built for the case where the lens is your *only* source of information all day. No manual in the locker, no phone in a dry bag, no crew who has done this before. It walks you through the whole arc of a day on the water: the questions to ask at handover, the last look before you cast off, starting, driving, anchoring, both ways of docking, shutting down — and eleven emergency drills that are always one press away.

---

## What it does

- **Pick your hull once.** Every procedure downstream is filtered to that boat and remembered between sessions, so the auxiliary-engine step only exists on the Blu Water and the tube-pressure check only exists on the RIB. Numbers that vary from boat to boat are marked **CONFIRM** rather than guessed — see *A note on the content* below.
- **The day in nine ordered stages.** HANDOVER → BEFORE CAST OFF → START THE ENGINE → LEAVE THE BERTH → UNDERWAY → ANCHOR & SWIM → COME ALONGSIDE → MED MOOR STERN-TO → SHUT DOWN. Med mooring is its own flow because stern-to is how almost every Greek island harbour actually works.
- **One instruction per screen, auto-fitted.** The step text shrinks from 46px only as far as it has to in order to fit, so the instruction is always the largest thing on the lens. Under it sits **WHY** (people skip steps they don't understand, and the skipped one is the drain plug) and **WATCH** in amber (the mistake everybody makes).
- **Two checklists you tick with one button.** ⏎ ticks the focused item and jumps to the next outstanding one, so a twelve-item pre-departure check clears in twelve presses with no navigating. Progress persists — a checklist half-done at the dock survives the browser reloading in your pocket.
- **Typing replaced by wheels.** Three values get recorded during handover — back-at-the-dock time, lifejackets counted, fuel at pickup — set with ◀ ▶ instead of a keyboard the device does not have.
- **A live countdown to the time you promised to be back.** Set it once and the status bar counts down all day, turning red in the last half hour and switching to OVERDUE after it.
- **Time-of-day advisory on the home screen.** Morning is the calm window; the Aegean breeze usually builds through the middle of the day and peaks mid-afternoon. The header says so, because it is the one piece of local knowledge that actually changes a day's plan.
- **Emergency is one press from every content screen.** ▲ opens the eleven drills — man overboard, taking on water, fire, won't start, no telltale, died underway, fouled prop, aground, weather turned, someone hurt — and from inside a drill, ▲ goes straight to MAYDAY.
- **A MAYDAY screen you can read out loud while frightened.** Three pages: how to use the radio, the verbatim script with your boat and crew count already filled in, and what to do when nobody answers. **Live GPS** renders your position in degrees and decimal minutes — the format you read over VHF and the format a coastguard plotter expects.

### A note on the content

This is a design demo, not a substitute for training or for the operator's briefing. The hull figures come from published builder and charter listings; anything that changes between individual rental boats — engine fitted, tank size, licence threshold, CE category — is deliberately left blank and tagged **CONFIRM**, and the HANDOVER checklist exists to make you ask about exactly those things. A confidently wrong fuel capacity is worse than a blank one.

---

## Controls

Two shapes, and that is the whole app.

| Where | Input | Result |
| --- | --- | --- |
| Boat picker | ▲ ▼ | Choose hull |
| Boat picker | ⏎ or ▶ | Start the day |
| Home / Emergency list | ▲ ▼ | Move (wraps) |
| Home / Emergency list | ⏎ or ▶ | Open |
| Home | ◀ | Back to the boat picker |
| Emergency list | ◀ | Back to home |
| Step flow | ◀ ▶ | Previous / next step |
| Step flow | ⏎ | Next step (returns to the menu at the end) |
| Step flow | ▼ | Back to the menu |
| Step flow | ▲ | Emergency list — or the MAYDAY script if you are already in a drill |
| Checklist | ◀ ▶ | Move between items |
| Checklist | ⏎ | Tick, then jump to the next outstanding item |
| Checklist | ▼ | Back to home |
| Checklist | ▲ | Emergency list |
| Checklist · value row | ⏎ | Open the value for editing |
| Checklist · value row (editing) | ◀ ▶ | Change the value |
| Checklist · value row (editing) | ⏎ | Keep it and tick the item |
| Checklist · value row (editing) | ▼ | Cancel editing |
| Boat card | ◀ ▶ or ⏎ | Page between SPECS and YOUR SETTINGS |
| Boat card | ▼ | Back to the menu |
| MAYDAY | ◀ ▶ or ⏎ | Page between HOW / SAY THIS / IF NO ANSWER |
| MAYDAY | ▼ | Back to the emergency list |

Content screens move on ◀ ▶ rather than ▲ ▼ on purpose. It costs a little familiarity on the checklists and it buys the thing that matters: **▲ is wired to the emergency index from every content screen in the app**, so help is one press away instead of "back out, scroll down, open".

Touchpad swipes mirror the arrow keys throughout; a tap without travel is ⏎.

---

## Screenshots

> Not captured yet. Every screen is reachable deterministically via `?state=…`, so the block below produces the full set in one pass.

---

## Running locally

The app is a single static HTML/CSS/JS bundle — no build step.

```bash
npx serve -l 4227 skipper
# then open http://localhost:4227
```

The MAYDAY position readout asks for geolocation. Denying it is a supported path — the screen falls back to *"NO GPS — SAY WHAT YOU CAN SEE ASHORE"*, which is the right instruction anyway.

### Regenerating screenshots

> 🛠️ **Developer tooling only.** The app itself has zero Chrome dependency — it's vanilla HTML/CSS/JS that runs in the Ray-Ban Meta Display's built-in browser. The block below is just the local recipe used on a Mac to refresh the PNGs in `screenshots/`.

The app reads a `?state=…` parameter on load, plus an optional `?boat=nikita|bluwater|mostro` so a capture can show the hull-specific steps:

```bash
npx serve -l 4327 skipper &
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
for STATE in boat home handover predep start leave underway anchor \
             alongside medmoor shutdown card settings sos \
             mayday-2 mayday-3 mob water nostart telltale; do
  "$CHROME" --headless --disable-gpu --hide-scrollbars \
    --window-size=600,600 --virtual-time-budget=3000 \
    --screenshot="skipper/screenshots/$STATE.png" \
    "http://localhost:4327/?state=$STATE&boat=mostro"
done
```

Any flow or drill also takes a step number — `?state=start-step-9`, `?state=medmoor-step-6`, `?state=mob-step-3` — and checklists take an item number the same way, so a specific row can be captured focused.

Valid `state` values: `boat`, `home`, `sos`, `card`, `settings`, `mayday-1` … `mayday-3`, the checklists `handover` `predep` `shutdown`, the flows `start` `leave` `underway` `anchor` `alongside` `medmoor` `rules` `lines`, and the drills `mob` `water` `fire` `nostart` `telltale` `died` `prop` `aground` `weather` `hurt`.

---

## Files

```
skipper/
├── index.html      # seven screens: boat, home, sos, steps, check, card, mayday
├── styles.css      # 600×600 additive-lens HUD; black + aqua, amber for mistakes
├── app.js          # state machine, windowed lists, step auto-fit, GPS, ?state= routing
├── data.js         # the whole content layer — hulls, checklists, 18 flows, mayday script
├── favicon.png     # aqua helm wheel on black
└── screenshots/    # generated state captures
```

`data.js` is deliberately separate and heavily commented: it is the part of this demo you would argue with, and it should be editable without reading the state machine.

---

<sub>Made by Alex Levin at [L+R](https://www.levinriegner.com).</sub>
