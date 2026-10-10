# Chore Orderer

A step-by-step chore checklist for the Meta Ray-Ban Display glasses. Five household chores are shown one at a time with their tasks and a short list of supplies; the wearer ticks tasks off with a pinch and "reorders" a supply through a mocked Amazon flow without leaving the lens. It is a concept demo of commerce-from-the-glasses: the loader, product page and purchase are all simulated, nothing is bought.

> ▶ [Try it in the simulator](https://displayglasses.dev/?url=https%3A%2F%2Frbm-demos.lnr.io%2Fchores%2F&pos=center&size=60&bright=100&bg=hiking&bg-dark=10) · 👓 [Add it to your glasses](#add-to-your-glasses)

> 🧪 **Status: Concept.** The interface and D-pad flow are real; the Amazon search, product card and `Buy Now` purchase are a scripted loader and hard-coded product data in `app.js`, and nothing is ever bought. See [Making it real](#making-it-real).

---

## What it does

- **Five chores, one screen each.** Clean the bathroom, do the laundry, take out the trash, vacuum the living room, wash the dishes. The header shows `Chore N of 5` and an estimated time that flips to `Complete` once every task is ticked.
- **Tick tasks with a pinch.** Each task row is focusable; Enter toggles it between a numbered marker and a `✓`.
- **Reorder supplies.** Each chore lists two or three products. Pinching one plays a 3.6 s "Searching Amazon…" loader, then opens a product card (emoji, name, blurb, price) with a `Buy Now` button. Buying shows a `Purchased` confirmation that closes itself after 1.8 s; the supply row is then marked `✓`.
- **Back out at any level.** ◀ or the back gesture cancels the loader or closes the product card, and focus returns to the supply row that opened it.
- **Done screen.** `Finish` on the last chore shows how many chores were completed and how many reorders were made, with a `Start over` button that resets everything.
- **Voice via Meta AI.** Four WebMCP tools (`chores_*`) report what is left, tick or un-tick tasks or whole chores by name, and reset the day. They go through the same functions as the D-pad, and the screen jumps to the chore that changed.
- **Lifecycle-clean.** The loader is the only recurring timer; it is stopped when the page is hidden and replayed for the same item when the page returns.
- **Offline.** Network-first service worker precaches the app and its self-hosted Space Grotesk + JetBrains Mono fonts.

---

## Controls

| Where | Input | Result |
| --- | --- | --- |
| Intro | Enter | `Begin` — open chore 1 |
| Chore | ▲ ▼ | Move focus through tasks, supplies and the buttons at the bottom (wraps) |
| Chore | Enter (on a task) | Toggle it done / not done |
| Chore | Enter (on a supply) | Start the Amazon loader, then open the product card |
| Chore | Enter (on `Next chore` / `Previous chore`) | Move between chores |
| Chore | Enter (on `Finish`, last chore only) | Open the Done screen |
| Chore | ◀ ▶ | Previous / next chore |
| Loader | ◀ or Back gesture (thumb + middle finger) | Cancel the search; focus returns to the supply row |
| Product card | Enter (on `Buy Now`) | Show `Purchased`; the card closes itself after 1.8 s |
| Product card | ◀ or Back gesture (thumb + middle finger) | Close the card; focus returns to the supply row |
| Done | Enter | `Start over` — clear every tick and reorder, back to the intro |
| Intro / Chore / Done | Back gesture (thumb + middle finger) | Nothing — only the overlays respond to it |
| Anywhere | Voice (Meta AI) | See **Voice (Meta AI)** below |

---

## Voice (Meta AI)

With WebMCP enabled, the wearer can keep their hands on the mop and talk to Meta AI instead. Each sentence resolves in one tool call:

| Say | Tool called |
| --- | --- |
| "what's left on my chores?" | `chores_get_state` (read-only) |
| "mark scrub the toilet done" | `chores_complete(items: "scrub the toilet")` |
| "I finished the laundry" | `chores_complete(items: "laundry")` — ticks every task of that chore |
| "uncheck mop the floor" | `chores_uncomplete(items: "mop the floor")` |
| "reset today's chores" | `chores_reset_today` |

Task names match case-insensitively, and tasks of the chore currently on screen win over the same words elsewhere. Names that match nothing come back in `unknown_items` so Meta AI can say so rather than guess. The page `<meta name="description">` asks Meta AI to confirm changes in one short sentence instead of reading the list back.

Voice control needs WebMCP enabled on the glasses (Developer Mode or rollout); relaunch the app after enabling it.

---

## Screenshots

| Preview |
| --- |
| <img src="screenshots/preview.png" width="300" alt="Chore Orderer preview"> |

---

## Making it real

**What's real today:**

- The five chores, their task lists and the `Chore N of 5` flow. Ticking tasks, moving between chores and the Done summary all work.
- The overlay plumbing: the loader can be cancelled, the product card opens and closes, and focus returns to the supply row that opened it.
- The four `chores_*` WebMCP tools. Meta AI ticks and un-ticks tasks through the same functions as the D-pad.
- Offline loading through the service worker.
- Note that state lives in memory only. Reloading the page starts the day over.

**What's simulated:**

- `LOAD_MSGS` and `LOAD_MS` in `app.js`: the 3.6 s "Searching Amazon…" loader is a timer cycling through six canned messages. No request is made.
- The `supplies` entries inside `CHORES` in `app.js`: emoji, blurb and price are hand-written. Each entry carries an Amazon `url`, but the app never opens or fetches it.
- `Buy Now`: `pdpBuyEl` just shows a `Purchased` badge for 1.8 s and marks the row `✓`. There is no account, cart, payment or order.
- The chore list itself is hard-coded. There is no household or calendar data behind it.

**How to make it real:**

- Live product data: Amazon's Product Advertising API (PA-API 5) needs an Associates account and signed requests, so put a small backend (for example a Vercel function) in front of it that returns name, image, price and availability for each ASIN in the `url` fields. The page fetches that endpoint, caches the result in `localStorage` and keeps the current card as its offline fallback. Effort: medium.
- Real reorders: Amazon has no public checkout API for third-party apps, so a true one-pinch purchase needs a merchant with one (for example a Shopify Storefront API checkout, or a retailer's own ordering API) plus a saved payment method and address on the backend. The glasses only confirm; the server places the order. Alternatively hand the purchase off to the phone: the lens queues the item and a companion app (built with Meta's Device Access Toolkit, or a plain mobile web app on the same account) completes checkout. The glasses browser has no keyboard for card forms beyond the text composer, so checkout should never happen on the lens. Effort: large.
- Persistent chores: store ticks and orders in `localStorage` so the day survives a reload, or sync them through a small backend so the household shares one list. Effort: small.
- Voice reorders: add a `chores_reorder(item)` WebMCP tool that calls the same function the supply row does, so "reorder the toilet paper" works once the purchase path is real. Effort: small.

---

## Add to your glasses

Scan this with your phone to open the Meta AI app and add the demo to your Ray-Ban Meta Display glasses:

<img src="qr-glasses.png" width="160" alt="QR code that adds Chore Orderer to your glasses">

Or add it by hand in the Meta AI app: **Devices → Display Glasses settings → App connections → Web apps → Add a web app**, with the name `Chore Orderer` and this URL:

```
https://rbm-demos.lnr.io/chores/
```

---

## Running locally

The app is a single static HTML/CSS/JS bundle — no build step.

```bash
npx serve -l 3020 chores
# then open http://localhost:3020
```

Use ←→↑↓ + Enter to drive it. State lives in memory only; reloading the page starts the day over.

### Regenerating screenshots

> 🛠️ **Developer tooling only.** The app itself has zero Chrome dependency — it's vanilla HTML/CSS/JS that runs in the Ray-Ban Meta Display's built-in browser. The block below is just the local recipe used on a Mac to refresh the PNGs in `screenshots/`.

The app has no `?state=` routing, so a single capture of the intro screen is taken:

```bash
npx serve -l 3020 chores &
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
mkdir -p chores/screenshots
"$CHROME" --headless --disable-gpu --hide-scrollbars \
  --window-size=600,600 --virtual-time-budget=2000 \
  --screenshot="chores/screenshots/preview.png" \
  "http://localhost:3020/"
```

---

## Files

```
chores/
├── index.html      # intro, chore, done screens + loader and product overlays
├── styles.css      # 600×600 layout, coral accent, focus rings, overlay styling
├── app.js          # chore data, state, D-pad focus, mock Amazon flow, WebMCP tools
├── sw.js           # network-first service worker (precaches app + fonts)
├── fonts/          # self-hosted Space Grotesk + JetBrains Mono (WOFF2) + fonts.css
├── favicon.png     # app icon (512×512 PNG)
└── screenshots/    # preview.png
```

---

<sub>Made by the team at [L+R](https://www.levinriegner.com).</sub>
