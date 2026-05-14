# Deep Link Target — Meta Display Glasses Example

One half of a two-app pair that demonstrates cross-app navigation on the glasses. This app is the **destination** — it accepts a `?screen=<name>` query param and renders the matching view. It pairs with the launcher app.

Pair: [`deep-link-launcher/`](../deep-link-launcher/)

## How to run locally

Both apps must run on different ports so the cross-origin hop is real.

```
cd examples/deep-link-launcher && python3 -m http.server 8080
cd examples/deep-link-target   && python3 -m http.server 8081
```

Open `http://localhost:8080` in Chrome with the viewport set to 600x600 and use the launcher buttons — or test the target directly via `http://localhost:8081/?screen=settings`.

## How screens are selected

- Reads `URLSearchParams.get('screen')` on load.
- Valid values: `home`, `settings`, `profile`, `about`. Anything else (or missing) falls back to `home`.
- A small "arrived" caption shows how the screen was entered (`Deep-linked`, or `Opened directly`) plus `document.referrer`, so the hop is visible during testing.
- **Back** uses `document.referrer` if present, otherwise `history.back()` — so it returns to the launcher after a deep-link hop.

## Notes

- 600x600 viewport with D-pad navigation (arrow keys, Enter)
- No dependencies — single `index.html`, vanilla JS
- No build, no server runtime — pure static hosting works (Vercel, GitHub Pages, any file server)
- The pair communicates only via URL params and `document.referrer`; no shared code
