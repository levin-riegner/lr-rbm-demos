# CLAUDE.md

Project instructions for Claude Code (and any other coding agent) working in this repo.

> **Keep this file short and up to date.** As the repo evolves, update the relevant sections and remove anything that no longer applies. Outdated or bloated instructions are worse than none — agents will follow them literally.

## What this repo is

A collection of **self-contained web demos for the [Meta Ray-Ban Display glasses](https://wearables.developer.meta.com/docs)**, built by [L+R](https://levinriegner.com). Each demo is a tiny vanilla HTML/CSS/JS app designed for a **600×600 lens** driven by a **D-pad** (no mouse, no on-screen keyboard; text entry goes through the glasses' built-in handwriting/voice composer).

The L+R simulator (additive waveguide blend over a real-world background) is hosted separately at [displayglasses.dev](https://displayglasses.dev) and is not part of this repo.

## Platform references

- Meta's Web Apps docs: <https://wearables.developer.meta.com/docs/develop/webapps>
- Meta's live docs MCP server is configured in `.mcp.json` (`meta-wearables-docs`, tool `search_webapps_docs`). Use it for current platform facts instead of memory.
- Meta's AI toolkit <https://github.com/facebook/meta-wearables-webapp> (skills + Chrome display simulator). Its default is a React + Vite + UI Toolkit scaffold. **This repo is an explicit custom-UI opt-out:** stay vanilla, but follow its device, lifecycle, performance and WebMCP rules, which are summarized below.

## Hardware constraints — read before designing UI

- **Display:** 600×600, single eye, additive (transparent), **30 Hz panel** — anything you draw sits on top of the world. Prefer pure `#000` backgrounds; black = transparent on the lens. Frame budget is 33 ms; never assume 60 fps.
- **Inputs available on the device:**
  - D-pad: `▲ ▼ ◀ ▶` (EMG swipes / touchpad, delivered as arrow keys)
  - `Enter` (index-finger pinch, the primary action)
  - **Back gesture** (thumb + middle-finger pinch), delivered to the page as the `Escape` key. Handle it as "go back / dismiss". Document it in READMEs as **Back gesture**, never as an `Esc` key. Do not add in-app Back buttons.
  - **Text entry:** a standard `<input>` / `<textarea>` opens the glasses' handwriting/voice composer when the wearer focuses and activates it. Read committed text from `input` / `change`. Never build a custom keyboard; keep the flow usable if composition is unavailable. Pick-from-list, wheel-pickers and digit carousels are still the idiomatic choice for constrained values.
  - **Voice via Meta AI (WebMCP):** apps can register tools on `document.modelContext` so the wearer can drive them by speaking. Additive only; see the `rbm-webmcp` skill.
  - Sensors: `devicemotion` / `deviceorientation` / `navigator.geolocation`, always behind an explicit Enable/Start action and `requestPermission()` where present.
- **Inputs that DO NOT exist on the device — never document them as controls:**
  - A physical `Esc` key (document the Back gesture instead)
  - Mouse / tap-to-click on UI, Pointer Lock
  - An on-screen keyboard
  - A "×" close button

## Repo layout

```
<repo-root>/
├── README.md                # top-level index — see "Top-level README" below
├── CLAUDE.md
├── .mcp.json                # Meta's docs MCP server
├── LICENSE
└── <app-name>/              # one folder per demo, see "Per-app layout"
    ├── index.html
    ├── styles.css
    ├── app.js
    ├── sw.js                # network-first service worker for offline use
    ├── fonts/               # self-hosted WOFF2 + fonts.css
    ├── favicon.png          # raster only (512×512), never SVG
    ├── qr-glasses.png       # QR of the Meta AI "add web app" deep link, generated (see below)
    ├── README.md            # follow the template
    └── screenshots/         # optional, generated via ?state= URL routing
```

A folder at the root is **a demo** if it contains `index.html`. Anything else (`.git`, `.claude`, hidden files, this `CLAUDE.md`) is not a demo.

## Per-app conventions

- **Vanilla only.** No bundler, no framework, no build step. The app must run by pointing the glasses browser at a static URL.
- **Fonts: self-hosted.** Each app ships the WOFF2 files it uses in `<app>/fonts/` plus a `fonts/fonts.css` with `@font-face` rules (`font-display: swap`, latin + latin-ext subsets, more only when the app renders those glyphs). No third-party font CDN, no `preconnect` to one. The house pair is `Space Grotesk` + `JetBrains Mono` — copy `stub/fonts/` for a new app. The device link is ~500 Kbps, so every KB is ~16 ms.
- **Offline: `sw.js`.** Every demo registers a network-first service worker (copy `stub/sw.js` and its registration snippet at the end of `index.html`). It precaches the app's own files, falls back to cache when offline or slow, and never caches `/api/` or cross-origin requests. Update the `PRECACHE` list when files are added.
- **Lifecycle.** Timers, `requestAnimationFrame` loops, sensor listeners, geolocation watches, polling and sockets run only while needed: stop them on `visibilitychange` → hidden, on leaving the screen that uses them, and on Stop/Pause; resume on visible. Countdown/elapsed timers compute from timestamps so pausing the render loop never drifts the clock. `watchPosition` always has a matching `clearWatch`; sensor listeners are removed with the same function reference.
- **Performance budget (Meta's device profile):** first paint < 1 s, usable < 5 s, first-load transfer < 300 KB, < 15 requests, no 60 fps loops. Keep `<head>` free of render-blocking work other than local CSS.
- **Background:** prefer pure `#000`. Avoid ambient gradients on the lens.
- **Focus:** every command is reachable by D-pad, focus is always visible, and after Back / modal dismissal focus returns to the control that opened it.
- **Run locally:** `npx serve -l <port> <app-name>` then open in Chrome at 600×600.
- **Building a new app = build + hand off a URL.** When asked to create/build a demo, just write the files, start `npx serve -l <port> <app-name>`, and reply with the `localhost` URL. Do **not** run/verify the app, drive headless Chrome, or generate screenshots — that's the developer's job. Only test or capture screenshots when explicitly asked.
- **`?state=…` URL routing** is the standard for screenshot reproducibility. If an app has more than one screen worth photographing, wire `?state=<name>` so headless Chrome can capture each state deterministically. See `flight-status/`, `lr-glimmer/`, `zork-terminal/` for the pattern.
- **Favicon:** raster PNG only (`favicon.png`, 512×512), themed to the app's accent color, referenced via `<link rel="icon" type="image/png" href="favicon.png">` right after `<title>`. Never SVG — SVG favicons are unsupported on-device. See the `rbm-demo-favicon` skill.
- **Web-app meta tags:** every demo's `<head>` includes a non-empty, app-specific `<meta name="description" content="…">` and `<meta name="mrbd-web-app-capable" content="yes">`. Meta AI reads the title and description, so put voice guardrails there when the app has WebMCP tools.
- **WebMCP (optional, encouraged):** when an app has obvious spoken commands, register tools per the `rbm-webmcp` skill. Tools call the same functions the D-pad path uses. `quicklist/` and `tally-counter/` are the reference implementations.
- **Byline:** `<sub>Made by <name> at [L+R](https://www.levinriegner.com).</sub>` at the bottom of the per-app README.
- **Analytics:** every demo's `index.html` includes a Umami tracking tag in `<head>`. The same shared `data-website-id` is used across all demos (Umami attributes hits per URL path under `rbm-demos.lnr.io`). When adding a new demo, copy the `<script defer src="https://cloud.umami.is/script.js" data-website-id="...">` line verbatim from any existing `index.html`.

## Per-app README template

Match the **`flight-status/README.md`** template when adding or rewriting a per-app README:

1. `# <App Name>`
2. One-paragraph pitch
3. Optional `> 📖 **Case study:**` line linking to `levinriegner.com/work/…`
4. The try-it line, verbatim apart from the folder name:
   `> ▶ [Try it in the simulator](https://displayglasses.dev/?url=https%3A%2F%2Frbm-demos.lnr.io%2F<app>%2F&pos=center&size=60&bright=100&bg=hiking&bg-dark=10) · 👓 [Add it to your glasses](#add-to-your-glasses)`
5. The status callout, one of (exact wording for the bold part):
   `> ✅ **Status: Working.** …` (does what it says on the glasses with no external service),
   `> 🔌 **Status: Working with live data.** …` (works, but depends on a named third-party API, server or key),
   `> 🧪 **Status: Concept.** The interface and D-pad flow are real; <what is simulated>. See [Making it real](#making-it-real).`
   Be honest: mocked data, scripted feeds, fake capture, placeholder flows or locked features make it a concept, however polished the UI.
6. `## What it does` — bullet list of features
7. `## Controls` — markdown table with columns `Where | Input | Result`. Only document inputs that exist on the device. The back gesture row reads `Back gesture` (never `Esc`); a voice row reads `Voice (Meta AI)`.
8. Optional `## Voice (Meta AI)` — example utterances, and a note that WebMCP must be enabled on the device (Developer Mode or rollout) and the app relaunched.
9. `## Screenshots` — grouped tables, sourced from `screenshots/*.png`
10. `## Making it real` — concept demos only: **What's real today**, **What's simulated** (name the mock and where it lives), **How to make it real** (the API/service/data source, the platform path such as a phone companion via Meta's Device Access Toolkit or Meta AI vision plus a WebMCP tool, and an effort hint).
11. `## Add to your glasses` — the `qr-glasses.png` image, the manual path in the Meta AI app (**Devices → Display Glasses settings → App connections → Web apps → Add a web app**), the app name and the live URL in a code block. Copy the block from `tally-counter/README.md`. The QR encodes `fb-viewapp://web_app_deep_link?appName=<title>&appUrl=<live url>` (both URL-encoded); generate it with the `qrcode` Python package, border 2, box size 8.
12. `## Running locally` — `npx serve -l <port> <app-name>` snippet
13. `### Regenerating screenshots` — gated by a `> 🛠️ **Developer tooling only.**` callout so readers know Chrome is a dev-time tool, not a runtime dep. Use the `?state=…` headless Chrome loop.
14. `## Files` — short tree of the app folder
15. `<sub>Made by … at [L+R](https://www.levinriegner.com).</sub>`

## Top-level `README.md` structure (preserve this)

The repo-root README is the front door. Keep its sections and order:

1. Title `# Ray-Ban Meta Display glasses concept applications by L+R` + the showcase pitch paragraph (links to Meta docs)
2. The DisplayGlasses.dev paragraph (simulator + getting started guide), the `Built by the team at L+R.` line, and the one-line note on fonts/offline/back gesture with the 🎙 legend. This copy is the developer's; don't reword it.
3. `## Hosted demos` — grouped tables (Primary / Secondary / Proof of concept / Testing) with columns `Demo | Source | Live | Simulator | Glasses | Case study | Preview`. One row per demo folder. The name is followed by 🎙 when the app has WebMCP tools and by its status marker (✅ working, 🔌 working with live data, 🧪 concept) taken from the app README's status callout; the legend sits above the tables. Live is `https://rbm-demos.lnr.io/<app-name>/`; Simulator is `[open](https://displayglasses.dev/?url=<live url, URL-encoded>&pos=center&size=60&bright=100&bg=hiking&bg-dark=10)`; Glasses is `[QR](https://github.com/levin-riegner/lr-rbm-demos/tree/main/<app-name>#add-to-your-glasses)` when the app README has that section, else `—`. **Agents should not invent `github.com/user-attachments/…` preview URLs.** Use a `screenshots/*.png` path or `—`.
4. `## Simulator` — short description + live link + bulleted feature list
5. `## Running an app locally` — generic `python3 -m http.server 8080` snippet
6. `## License`

When adding a new demo, the only required top-level edit is **one new row in the right Hosted demos table, in alphabetical position**. Everything else is optional.

## Top-level README sync protocol

At the end of any session that modified files in this repo, you (the main agent) **must invoke the `readme-sync` subagent exactly once** before reporting completion. The subagent is defined at `.claude/agents/readme-sync.md` and is responsible for keeping the top-level `README.md` in sync with the rest of the repo.

### When to invoke `readme-sync`

Invoke it as the **final step**, after all other work is complete, when:

- The session modified one or more files outside of `README.md`, `CLAUDE.md`, and `.claude/`.

### When NOT to invoke `readme-sync`

Skip the invocation entirely (do **not** call the subagent) when any of these is true:

- The session made no on-disk changes (read-only / Q&A / planning).
- The session only modified the top-level `README.md` — the developer is editing it directly, the subagent would fight them.
- The session only modified `CLAUDE.md` or files under `.claude/` — these don't affect the public README.
- `readme-sync` has already been invoked once in this session.

### Loop prevention — non-negotiable

These rules exist so the sync can never recurse, ping-pong, or re-evaluate itself:

1. **Invoke exactly once per session.** Once `readme-sync` has run in a session, **never** invoke it again, even if you make subsequent edits in the same session. If further edits would warrant another sync, leave them for the next session.
2. **Trust the subagent's result.** If `readme-sync` reports it edited `README.md`, do **not** re-read or re-validate the README in this session.
3. **Do not call `readme-sync` from inside `readme-sync`.** The subagent's own system prompt also forbids this — it is single-shot by design.
4. **Do not chain a second pass.** If `readme-sync` reports "no changes needed", that is the final answer. Do not retry, do not call it a second time with extra context.

### How to invoke

Use the Task tool with `subagent_type: readme-sync` and a one-line summary of what changed in the session (e.g. *"Added a new `presto` demo with index.html, styles.css, app.js."*). The subagent will inspect the working tree itself — it does not need the full session context.

A manual escape hatch also exists: the developer can run **`/sync-readme [optional summary]`** at any time (defined at `.claude/commands/sync-readme.md`). The same loop-prevention rules apply.

## Commit message style

`<scope>: <subject in lowercase, present tense>` where scope is the app folder name. Examples from the log:

- `flight-status: black bg, bigger labels, swipe-to-seat, favicon`
- `metronome: drop Esc-key row from README controls table`
- `readmes: dev-only callout above every Regenerating screenshots block`

For multi-app sweeps use `readmes:` or another umbrella scope. Keep subjects under ~80 chars.

## Things that have caused churn — avoid

- Documenting `Esc` as a key, or `×` / tap inputs, in any README. The back gesture is documented as **Back gesture**.
- Loading fonts (or anything else) from a third-party CDN at startup. Self-host in `fonts/`.
- Leaving timers, animation loops, sensors or sockets running while the page is hidden.
- Ambient gradients behind content on the lens — they bleach against the world.
- Suggesting Chrome / headless-Chrome as a runtime dependency. It's only used to regenerate screenshots on a Mac.
- Renaming demo folders without updating the top-level README's Hosted demos list and any GIF `alt` text.
- Introducing build tools or `package.json` to an app folder. Stay vanilla.
- Installing a WebMCP polyfill or a library that defines its own `modelContext`.

## When in doubt

Mirror an existing, recently-updated demo. The current reference implementations are:

- `flight-status/` — the README template source of truth
- `lr-glimmer/` — `?state=` routing pattern
- `metronome/` — head-gesture (NOD) integration
- `stub/` — fonts, `sw.js` and registration snippet to copy for a new app
- `quicklist/` — WebMCP voice tools, text entry via the composer, offline, lifecycle
- `tally-counter/` — the smallest WebMCP example
