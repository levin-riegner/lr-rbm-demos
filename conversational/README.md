# Conversational

A simulated live-transcription HUD for the Meta Ray-Ban Display glasses. A friend tells the wearer a story in French and the words stream in at the bottom of the lens, one every half second, the way a live caption would. Swipe down to add an English subtitle under each line, step back through the words to look one up, and save the ones you want to remember. It is a concept demo for language learners; the "speech" is a scripted, looping story, not real audio.

> ▶ [Try it in the simulator](https://displayglasses.dev/?url=https%3A%2F%2Frbm-demos.lnr.io%2Fconversational%2F&pos=center&size=60&bright=100&bg=hiking&bg-dark=10) · 👓 [Add it to your glasses](#add-to-your-glasses)

---

## What it does

- **Streaming French.** A 24-sentence story (a walk along the Seine, a violinist, a bakery, a grandfather) is revealed word by word every 460 ms, anchored at the bottom of the lens. Only the last two sentences are on screen; the older one is faded. When the script ends it pauses briefly and loops from the top, which is invisible because the opening lines have long scrolled off.
- **Subtitle on demand.** ▼ toggles an amber English gloss under each line. The gloss grows only as fast as the French is "spoken", so the listener never reads ahead.
- **Scrollback by word.** ◀ steps back one word at a time (punctuation is skipped) and highlights it; ▶ steps forward again. Reaching the newest word drops you back into live mode, and ▲ snaps there directly.
- **Save a word.** In scrollback, Enter stores the highlighted word and its gloss in a vocab library (`localStorage`, key `conversational.vocab.v1`). A toast reports `✓ saved · N words` (or `✓ already saved`), and saved words stay underlined in the transcript.
- **Pause.** In live mode, Enter pauses and resumes the stream.
- **Lifecycle-clean.** The stream interval is stopped while the page is hidden and resumed only if it was running before.
- **Offline.** Network-first service worker precaches the app and its self-hosted Atkinson Hyperlegible fonts.

---

## Controls

| Where | Input | Result |
| --- | --- | --- |
| Live | ▼ | Toggle the English subtitle under each line |
| Live | ◀ | Enter scrollback on the newest word, then step back one word |
| Live | Enter | Pause / resume the stream |
| Scrollback | ◀ ▶ | Step back / forward one word (reaching the newest word returns to live) |
| Scrollback | ▲ | Snap back to live |
| Scrollback | ▼ | Toggle the English subtitle |
| Scrollback | Enter | Save the highlighted word to the vocab library |

---

## Screenshots

No screenshots yet. The app reads a `?state=…` URL parameter so each screen can be captured deterministically: `live`, `translated`, `midstory`, `midstory-translated`, `scrollback`.

---

## Add to your glasses

Scan this with your phone to open the Meta AI app and add the demo to your Ray-Ban Meta Display glasses:

<img src="qr-glasses.png" width="160" alt="QR code that adds Conversational to your glasses">

Or add it by hand in the Meta AI app: **Devices → Display Glasses settings → App connections → Web apps → Add a web app**, with the name `Conversational` and this URL:

```
https://rbm-demos.lnr.io/conversational/
```

---

## Running locally

The app is a single static HTML/CSS/JS bundle — no build step.

```bash
npx serve -l 3040 conversational
# then open http://localhost:3040
```

Use ←→↑↓ + Enter to drive it. Saved words persist in `localStorage`; `window.vocab.list` and `window.vocab.clear()` are exposed in the console for inspection.

### Regenerating screenshots

> 🛠️ **Developer tooling only.** The app itself has zero Chrome dependency — it's vanilla HTML/CSS/JS that runs in the Ray-Ban Meta Display's built-in browser. The block below is just the local recipe used on a Mac to refresh the PNGs in `screenshots/`.

Screenshots come from headless Chrome against the `?state=…` URL parameter the app reads on load. A routed state freezes the stream at a fixed word so the capture is deterministic:

```bash
npx serve -l 3040 conversational &
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
mkdir -p conversational/screenshots
for STATE in live translated midstory midstory-translated scrollback; do
  "$CHROME" --headless --disable-gpu --hide-scrollbars \
    --window-size=600,600 --virtual-time-budget=2000 \
    --screenshot="conversational/screenshots/$STATE.png" \
    "http://localhost:3040/?state=$STATE"
done
```

---

## Files

```
conversational/
├── index.html      # transcript container, toast, service-worker registration
├── styles.css      # bottom-anchored transcript, amber gloss, highlight and saved styles
├── app.js          # story script, streaming loop, scrollback, vocab library, ?state= routing
├── sw.js           # network-first service worker (precaches app + fonts)
├── fonts/          # self-hosted Atkinson Hyperlegible (regular/bold, upright/italic, WOFF2) + fonts.css
└── favicon.png     # app icon (512×512 PNG)
```

---

<sub>Made by L+R at [L+R](https://www.levinriegner.com).</sub>
