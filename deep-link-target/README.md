# Deep Link Target

One half of a two-app pair that demonstrates cross-app navigation on the Meta Ray-Ban Display glasses. This app is the **destination**: it accepts a `?screen=<name>` query param, renders the matching view, and shows how it was reached so the hop is visible during testing. It pairs with the launcher app.

Pair: [`deep-link-launcher/`](../deep-link-launcher/)

---

## What it does

- **Screen selection from the URL.** Reads `URLSearchParams.get('screen')` on load. Valid values are `home`, `settings`, `profile` and `about`; anything else, or no param at all, falls back to `home`.
- **Four stub screens.** Home, Settings, Profile and About, each with a title, a line of placeholder copy, and a `Target` badge in the header.
- **"Arrived" caption.** A small green caption on the visible screen reports `Deep-linked -> screen=<name>` plus `document.referrer`, or `Opened directly (no screen param)`, so you can confirm the deep link worked.
- **Return to the launcher.** The single `Back` button navigates to `document.referrer` when there is one, otherwise `history.back()`, so it lands back on the launcher after a deep-link hop.
- **Offline.** A network-first service worker (`sw.js`) precaches the app.
- **Vanilla and static.** A single `index.html` with inline CSS and JS. No build, no server runtime; any static host works.

---

## Controls

| Where | Input | Result |
| --- | --- | --- |
| Any screen | ▲ ▼ ◀ ▶ | Move focus between visible buttons (each screen has one, `Back`) |
| Any screen | Enter (on `Back`) | Return to the referrer, or go back in history |

The `Back` button is focused on load. The app does not handle the Back gesture itself.

---

## Screenshots

| Target (deep-linked) |
| --- |
| ![Target app screen with arrived caption](screenshots/preview.png) |

---

## Running locally

Both apps must run on different ports so the cross-origin hop is real. The ports below match the launcher's default target (`http://localhost:8081/`).

```bash
npx serve -l 8080 deep-link-launcher
npx serve -l 8081 deep-link-target
# then open http://localhost:8080 and use the launcher buttons
```

To test the target on its own, open a screen directly, for example `http://localhost:8081/?screen=settings`.

### Regenerating screenshots

> 🛠️ **Developer tooling only.** The app itself has zero Chrome dependency — it's vanilla HTML/CSS/JS that runs in the Ray-Ban Meta Display's built-in browser. The block below is just the local recipe used on a Mac to refresh the PNGs in `screenshots/`.

The app has no `?state=` routing, but `?screen=` selects the view, so one plain capture of a deep-linked screen is enough:

```bash
npx serve -l 8081 deep-link-target &
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless --disable-gpu --hide-scrollbars \
  --window-size=600,600 --virtual-time-budget=2000 \
  --screenshot="deep-link-target/screenshots/preview.png" \
  "http://localhost:8081/?screen=settings"
```

---

## Notes

- The pair communicates only via URL params and `document.referrer`; there is no shared code.
- `document.referrer` is empty when the target is opened directly, so `Back` falls back to `history.back()`.

---

## Files

```
deep-link-target/
├── index.html      # four stub screens, arrived caption, inline CSS/JS, D-pad focus, service-worker registration
├── sw.js           # network-first service worker
├── favicon.png     # app icon
└── screenshots/    # preview.png used by this README and the top-level index
```

---

<sub>Made by L+R at [L+R](https://www.levinriegner.com).</sub>
