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
- **Escape** — back to Start screen

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
