# Serbian Flashcards

A five-word Serbian vocabulary deck for the Meta Ray-Ban Display glasses. Study the cards with swipes — one to reveal the English, one to move on — then take a short multiple-choice quiz and see your score. It is a minimal pattern for hands-free study on the lens, and with WebMCP enabled the wearer can flip and advance cards by talking to Meta AI.

> ▶ [Try it in the simulator](https://displayglasses.dev/?url=https%3A%2F%2Frbm-demos.lnr.io%2Fflashcards-serbian%2F&pos=center&size=60&bright=100&bg=hiking&bg-dark=10) · 👓 [Add it to your glasses](#add-to-your-glasses)

> ✅ **Status: Working.** Everything runs on the glasses with no network: the five-word deck is bundled in `app.js`, the quiz is built and scored on-device, and the WebMCP tools drive the same functions as the D-pad.

---

## What it does

- **Learn mode.** Five cards — *Zdravo*, *Hvala*, *Da*, *Ne*, *Molim* — shown Serbian side up with a `1 / 5` counter. ▶ flips the card to its English meaning; ◀ moves to the next card face down. Moving past the last card starts the test automatically.
- **Test mode.** Five multiple-choice questions in random order. Each shows a Serbian word and four shuffled English options (the correct one plus three distractors). Submitting locks the question and colors the correct and wrong answers; submitting again moves on.
- **Result.** A `N / 5` score with a Serbian verdict: *Savršeno!* for a perfect round, *Dobro!* for 3 or more, otherwise *Probaj ponovo.* Submitting again restarts the deck.
- **Voice via Meta AI.** Five WebMCP tools (`flashcards_*`) report the card on screen, flip it, go to the next or previous card, and switch between learn and test. The English side is only reported once the card has been flipped, so Meta AI cannot spoil the answer; the page `<meta name="description">` repeats that guardrail. Quiz answers are still picked with the D-pad.
- **Offline.** Network-first service worker precaches the app and its self-hosted Inter + JetBrains Mono fonts.

---

## Controls

| Where | Input | Result |
| --- | --- | --- |
| Learn | ▶ | Flip the card to its English meaning |
| Learn | ◀ | Next card, face down (after card 5 this starts the test) |
| Test | ▲ ▼ | Move the highlight between the four options (wraps) |
| Test | ▶ or Enter | Submit the highlighted answer; press again to go to the next question |
| Result | ▶ or Enter | Restart at card 1 |
| Test / Result | Back gesture (thumb + middle finger) | Abandon the quiz and restart at card 1 |
| Anywhere | Voice (Meta AI) | See **Voice (Meta AI)** below |

---

## Voice (Meta AI)

With WebMCP enabled, the wearer can run the deck by talking to Meta AI. Each sentence resolves in one tool call:

| Say | Tool called |
| --- | --- |
| "which card am I on?" | `flashcards_get_state` (read-only) |
| "flip the card" | `flashcards_flip` |
| "next card" | `flashcards_next` (also advances a quiz question once it has been answered) |
| "go back one" | `flashcards_previous` — the only way to go backward, since ◀ on the D-pad means next |
| "quiz me" | `flashcards_set_mode(mode: "test")` |

Every result carries a `next_action` such as "Read the Serbian word in one short sentence; do not reveal the translation." Calling a learn-mode tool during the quiz returns `error: true` with a hint to switch modes first.

Voice control needs WebMCP enabled on the glasses (Developer Mode or rollout); relaunch the app after enabling it.

---

## Screenshots

| Preview |
| --- |
| <img src="screenshots/preview.png" width="300" alt="Serbian Flashcards preview"> |

---

## Add to your glasses

Scan this with your phone to open the Meta AI app and add the demo to your Ray-Ban Meta Display glasses:

<img src="qr-glasses.png" width="160" alt="QR code that adds Serbian Flashcards to your glasses">

Or add it by hand in the Meta AI app: **Devices → Display Glasses settings → App connections → Web apps → Add a web app**, with the name `Serbian Flashcards` and this URL:

```
https://rbm-demos.lnr.io/flashcards-serbian/
```

---

## Running locally

The app is a single static HTML/CSS/JS bundle — no build step.

```bash
npx serve -l 3060 flashcards-serbian
# then open http://localhost:3060
```

Use ←→↑↓ + Enter to drive it. Nothing is persisted; a reload starts at card 1.

### Regenerating screenshots

> 🛠️ **Developer tooling only.** The app itself has zero Chrome dependency — it's vanilla HTML/CSS/JS that runs in the Ray-Ban Meta Display's built-in browser. The block below is just the local recipe used on a Mac to refresh the PNGs in `screenshots/`.

The app has no `?state=` routing, so a single capture of the first card is taken:

```bash
npx serve -l 3060 flashcards-serbian &
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
mkdir -p flashcards-serbian/screenshots
"$CHROME" --headless --disable-gpu --hide-scrollbars \
  --window-size=600,600 --virtual-time-budget=2000 \
  --screenshot="flashcards-serbian/screenshots/preview.png" \
  "http://localhost:3060/"
```

---

## Files

```
flashcards-serbian/
├── index.html      # learn, test and result screens, service-worker registration
├── styles.css      # 600×600 layout, teal accent, card and choice styling
├── app.js          # vocab, learn/test/result state, D-pad handling, WebMCP tools
├── sw.js           # network-first service worker (precaches app + fonts)
├── fonts/          # self-hosted Inter + JetBrains Mono (WOFF2) + fonts.css
├── favicon.png     # app icon (512×512 PNG)
└── screenshots/    # preview.png
```

---

<sub>Made by the team at [L+R](https://www.levinriegner.com).</sub>
