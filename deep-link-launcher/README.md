# Deep Link Launcher — Meta Display Glasses Example

One half of a two-app pair that demonstrates cross-app navigation on the glasses. This app is the **source** — it launches into a separately hosted **target** app by navigating to `<target>?screen=<name>`.

Pair: [`deep-link-target/`](../deep-link-target/)

## How to run locally

Both apps must run on different ports so the cross-origin hop is real.

```
cd examples/deep-link-launcher && python3 -m http.server 8080
cd examples/deep-link-target   && python3 -m http.server 8081
```

Open `http://localhost:8080` in Chrome with the viewport set to 600x600. Use arrow keys and Enter.

## How the deep link works

- Default target URL is `http://localhost:8081/`, stored in `localStorage['deeplink:target']`.
- Override the target via query string on first load: `http://localhost:8080/?target=https://my-target.vercel.app/`. The override is persisted and the query is stripped from the URL.
- Each button navigates to `<target>?screen=<home|settings|profile|about>`. The target reads the `screen` param to render the matching view.

## Notes

- 600x600 viewport with D-pad navigation (arrow keys, Enter)
- No dependencies — single `index.html`, vanilla JS
- No build, no server runtime — pure static hosting works (Vercel, GitHub Pages, any file server)
- The pair communicates only via URL params and `document.referrer`; no shared code
