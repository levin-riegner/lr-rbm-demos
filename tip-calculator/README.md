# Tip Calculator

A single-screen tip and bill-splitting calculator for the Meta Ray-Ban Display glasses. The bill, tip percentage and party size are each one D-pad axis away, the total is always the biggest thing on the lens, and with Meta AI the whole calculation fits in one spoken sentence. It is for the moment the check arrives and your phone is in your pocket.

> ▶ [Try it in the simulator](https://displayglasses.dev/?url=https%3A%2F%2Frbm-demos.lnr.io%2Ftip-calculator%2F&pos=center&size=60&bright=100&bg=hiking&bg-dark=10) · 👓 [Add it to your glasses](#add-to-your-glasses)

> ✅ **Status: Working.** Everything runs on the glasses with no network: the math is local, and the WebMCP voice tools call the same setters the D-pad uses.

---

## What it does

- **Three values, three inputs.** ▲ ▼ change the bill, ◀ ▶ change the tip, Enter cycles the party size. Each change bumps the number that moved.
- **Bill steps that scale.** The bill moves in $1 steps, $5 steps from $50 and $10 steps from $200, so large checks are not a slog. It never goes below $0.
- **Tip presets.** ◀ ▶ walk through 0, 5, 10, 12, 15, 18, 20, 22, 25 and 30 %. A value set by voice that is not a preset snaps to the next preset on the following press. The tip amount is shown next to the percentage.
- **Split up to eight ways.** Enter cycles 1 → 2 → … → 8 → 1. Above one person the header badge switches to `n people` and the footer shows the per-person share.
- **Voice via Meta AI.** Five WebMCP tools (`tip_*`) set the bill, percentage or party size, set all three at once, or read the state back. They call the same setters the D-pad uses, so the lens re-renders as Meta AI acts.
- **Offline and self-hosted.** Network-first service worker, pure `#000` background, Space Grotesk + JetBrains Mono shipped as WOFF2. Defaults on launch: $42.00 bill, 18 % tip, party of 1.

---

## Controls

| Where | Input | Result |
| --- | --- | --- |
| Main | ▲ | Bill up by $1 / $5 / $10 depending on size |
| Main | ▼ | Bill down by the same step (floor $0) |
| Main | ▶ | Next tip preset (0 → 5 → 10 → 12 → 15 → 18 → 20 → 22 → 25 → 30 %) |
| Main | ◀ | Previous tip preset |
| Main | Enter | Cycle party size 1 → 2 → … → 8 → 1 (split / un-split) |
| Anywhere | Voice (Meta AI) | See **Voice (Meta AI)** below |

The app does not handle the Back gesture; it is left to the system.

---

## Voice (Meta AI)

With WebMCP enabled, the wearer can set the whole calculation by talking to Meta AI:

| Say | Tool called |
| --- | --- |
| "the bill is 86 dollars" | `tip_set_bill(amount: 86)` |
| "make it twenty percent" | `tip_set_percent(percent: 20)` |
| "split it four ways" | `tip_set_party(size: 4)` |
| "86 dollars, 20 percent, split between 4" | `tip_calculate(bill: 86, percent: 20, party: 4)` |
| "what's the total?" | `tip_get_state` (read-only) |

Every result carries the bill, tip percent, tip amount, total, party size and per-person share, plus a `next_action` asking Meta AI to confirm the total (and per-person amount if split) in one short sentence and then stop. Out-of-range values (bill below 0, tip outside 0–100, party outside 1–8) are rejected with a message; `tip_calculate` applies the valid values and reports which one it ignored.

Voice control needs WebMCP enabled on the glasses (Developer Mode or rollout); relaunch the app after enabling it.

---

## Screenshots

No screenshots yet.

---

## Add to your glasses

Scan this with your phone to open the Meta AI app and add the demo to your Ray-Ban Meta Display glasses:

<img src="qr-glasses.png" width="160" alt="QR code that adds Tip Calculator to your glasses">

Or add it by hand in the Meta AI app: **Devices → Display Glasses settings → App connections → Web apps → Add a web app**, with the name `Tip Calculator` and this URL:

```
https://rbm-demos.lnr.io/tip-calculator/
```

---

## Running locally

The app is a single static HTML/CSS/JS bundle — no build step.

```bash
npx serve -l 3056 tip-calculator
# then open http://localhost:3056
```

Use ←→↑↓ + Enter to drive it. Values are not persisted; a reload returns to the defaults.

### Regenerating screenshots

> 🛠️ **Developer tooling only.** The app itself has zero Chrome dependency — it's vanilla HTML/CSS/JS that runs in the Ray-Ban Meta Display's built-in browser. The block below is just the local recipe used on a Mac to refresh the PNGs in `screenshots/`.

The app has no `?state=` routing, so the preview is a single capture of the default state:

```bash
npx serve -l 3056 tip-calculator &
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
mkdir -p tip-calculator/screenshots
"$CHROME" --headless --disable-gpu --hide-scrollbars \
  --window-size=600,600 --virtual-time-budget=2000 \
  --screenshot="tip-calculator/screenshots/preview.png" \
  "http://localhost:3056/"
```

---

## Files

```
tip-calculator/
├── index.html      # bill / tip / total rows, party badge, footer, service-worker registration
├── styles.css      # 600×600, pure #000, green + amber accents, bump animation
├── app.js          # D-pad logic, tip presets, party cycling, WebMCP tools
├── sw.js           # network-first service worker (precaches app + fonts)
├── fonts/          # self-hosted Space Grotesk + JetBrains Mono (WOFF2) + fonts.css
└── favicon.png     # black "TP" on amber
```

---

<sub>Made by L+R at [L+R](https://www.levinriegner.com).</sub>
