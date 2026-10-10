# Trivia Live — Meta Display Glasses WebApp

Live trivia quiz powered by the free **Open Trivia DB** API (no API key).

## How to run (Chrome)

```bash
cd examples/trivia-live
python3 -m http.server 8080
```

Open [http://localhost:8080](http://localhost:8080) in Chrome, press **Cmd+Shift+M** to toggle device toolbar, set a custom **600×600** viewport, and refresh.

## Controls

- **Arrow keys** — move focus (D-pad)
- **Enter** — activate focused element (EMG pinch)
- **Back gesture (thumb + middle finger)** — back to Start screen (also cancels a question fetch)
- **Voice (Meta AI)** — start a quiz, hear the question, answer by letter or text (see below)

## Voice (Meta AI)

With WebMCP enabled on the glasses the app registers tools on `document.modelContext`, so Meta AI can run a round hands-free. Example utterances:

- "Start a science quiz on hard"
- "Read me the question"
- "The answer is B"
- "It's Paris"
- "Play again"

Tools: `trivia_get_state` (read-only, never exposes the answer of an open question), `trivia_start` (category and difficulty optional), `trivia_answer` (letter or option text — the page scores it, Meta AI only relays the result). Each one calls the same functions the D-pad uses, so the screen updates as Meta AI acts.

> WebMCP must be enabled on the device (Developer Mode or rollout) and the app relaunched after enabling it. Without it the app works exactly as before, D-pad only.

## Gameplay

- Pick a **Category** (General, Science, History, Geography, Film, Sports) and **Difficulty** (Easy, Medium, Hard) on the Start screen.
- 10 questions per round, 4 multiple-choice answers each.
- **15-second** countdown per question. Timer turns amber under 5s. Running out counts as wrong and reveals the correct answer.
- Correct/incorrect feedback banner shows briefly after each answer, then auto-advances.
- Results screen shows final score, a review of every question with your answer vs. correct, and a NEW BEST badge if you beat the stored high score.
- High scores stored in `localStorage` under `mdg_trivia_live`, keyed by `"<categoryId>_<difficulty>"`.

## API

`https://opentdb.com/api.php?amount=10&category=<id>&difficulty=<easy|medium|hard>&type=multiple`

HTML entities in question text and answers are decoded via a `<textarea>.innerHTML` round-trip. Answer order is shuffled with Fisher–Yates; the correct index is remembered after shuffle.

## Files

```
trivia-live/
  index.html   # Start · Quiz · Feedback · Results · Loading · Error
  styles.css   # Chips, answer buttons, timer bar, feedback, review
  app.js       # State machine, fetch, decode, shuffle, timer, scoring
  vercel.json  # Static rewrites
```
