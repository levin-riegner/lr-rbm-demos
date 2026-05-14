# Recipe Stepper

A standalone webapp for Meta Display Glasses that paginates a recipe one step at a time at 32px, navigated by lateral D-pad input only. Long steps are auto split across pages so nothing overflows the 600x600 viewport.

## Files

- `index.html`, `styles.css`, `app.js` - the webapp (no build step, no deps)
- `recipes.json` - curated recipes shown in the picker (each has title, source URL, time, steps)
- `api/extract.js` - Vercel serverless function that turns a recipe URL into the same JSON shape

## Run locally

```bash
cd examples/recipe-stepper
python3 -m http.server 8765
```

Then open `http://localhost:8765` in Chrome and set the DevTools viewport to 600x600.

## Input model

| Screen   | Keys                                          |
| -------- | --------------------------------------------- |
| Picker   | Up / Down (or Left / Right) cycles, Enter selects |
| Stepper  | Right advances (page, then step), Left goes back |
| Finished | Left to review, Enter to go back to the picker |

`ArrowRight` simulates a neural band tap.

## Loading recipes

The home screen is a picker over `recipes.json`. Three query params bypass it:

- `?id=<preset-id>` jumps to a curated recipe by id
- `?recipe=<JSON URL>` loads a pre-extracted recipe JSON (array of strings, or `{ title, steps[] }`)
- `?url=<recipe page URL>` runs the page through `/api/extract`

## AI extraction

`api/extract.js` accepts `POST { url }` and returns `{ title, totalTime, servings, steps[] }`.

It tries `application/ld+json` Recipe schema first (most major recipe sites publish it). If that is missing it falls back to the Anthropic Messages API (`claude-haiku-4-5`) on the stripped page text, asking for strict JSON with 80 to 200 character steps.

Setup on Vercel:

```bash
vercel env add ANTHROPIC_API_KEY
vercel deploy
```

Then point the webapp at it via `?url=...` (same origin) or `?url=...&ai=https://your-deploy.vercel.app/api/extract` from a different host.

## Pagination

`paginateStep` in `app.js` measures rendered text in a hidden node, binary searches for the largest word slice that fits the body container, and emits an array of page strings per step. The stepper walks pages first, then steps, so lateral input alone is enough.
