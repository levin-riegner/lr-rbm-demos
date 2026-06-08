# CLAUDE.md

Project instructions for Claude Code (and any other coding agent) working in this repo.

> **Keep this file short and up to date.** As the repo evolves, update the relevant sections and remove anything that no longer applies. Outdated or bloated instructions are worse than none — agents will follow them literally.

## What this repo is

A collection of **self-contained web demos for the [Meta Ray-Ban Display glasses](https://wearables.developer.meta.com/docs)**, built by [L+R](https://levinriegner.com). Each demo is a tiny vanilla HTML/CSS/JS app designed for a **600×600 lens** driven by a **D-pad** (no mouse, no on-screen keyboard).

The repo also ships a `simulator/` that overlays any URL onto a real-world background image with the waveguide's additive (plus-lighter) blend, so contrast and legibility can be judged without hardware.

## Hardware constraints — read before designing UI

- **Display:** 600×600, single eye, additive (transparent) — anything you draw will sit on top of the world. Prefer pure `#000` backgrounds; black = transparent on the lens.
- **Inputs available on the device:**
  - D-pad: `▲ ▼ ◀ ▶`
  - `Enter` (primary action)
  - Touchpad swipes (mirrored to the arrow keys in apps that support gestures)
  - Optional: head-gesture / IMU (used by `head-gesture-prototype`, `metronome` NOD)
- **Inputs that DO NOT exist on the device — never document them as controls:**
  - `Esc` key
  - Mouse / tap-to-click on UI
  - On-screen keyboard / typing
  - A "×" close button
- Pick-from-list, wheel-pickers, and digit carousels are the idiomatic replacement for typing.

## Repo layout

```
<repo-root>/
├── README.md                # top-level index — see "Top-level README" below
├── LICENSE
├── simulator/               # the on-device-preview tool, not a glasses demo
└── <app-name>/              # one folder per demo, see "Per-app layout"
    ├── index.html
    ├── styles.css
    ├── app.js
    ├── favicon.svg          # optional
    ├── README.md            # optional but encouraged, follow the template
    └── screenshots/         # optional, generated via ?state= URL routing
```

A folder at the root is **a demo** if it contains `index.html`. Anything else (`.git`, `.claude`, hidden files, this `CLAUDE.md`) is not a demo.

## Per-app conventions

- **Vanilla only.** No bundler, no framework, no build step. The app must run by pointing the glasses browser at a static URL.
- **Fonts:** load from Google Fonts. The house pair is `Space Grotesk` + `JetBrains Mono` — don't change it without a reason.
- **Background:** prefer pure `#000`. Avoid ambient gradients on the lens.
- **Run locally:** `npx serve -l <port> <app-name>` then open in Chrome at 600×600. The simulator can iframe the local URL.
- **`?state=…` URL routing** is the standard for screenshot reproducibility. If an app has more than one screen worth photographing, wire `?state=<name>` so headless Chrome can capture each state deterministically. See `flight-status/`, `lr-glimmer/`, `zork-terminal/` for the pattern.
- **Favicon:** SVG when possible, themed to the app's accent color.
- **Byline:** `<sub>Made by <name> at [L+R](https://www.levinriegner.com).</sub>` at the bottom of the per-app README.
- **Analytics:** every demo's `index.html` includes a Umami tracking tag in `<head>`. The same shared `data-website-id` is used across all demos (Umami attributes hits per URL path under `rbm-demos.lnr.io`). When adding a new demo, copy the `<script defer src="https://cloud.umami.is/script.js" data-website-id="...">` line verbatim from any existing `index.html`. The `simulator/` is intentionally excluded.

## Per-app README template

Recently standardized — match the **`flight-status/README.md`** template verbatim when adding or rewriting a per-app README:

1. `# <App Name>`
2. One-paragraph pitch
3. Optional `> 📖 **Case study:**` line linking to `levinriegner.com/work/…`
4. `## What it does` — bullet list of features
5. `## Controls` — markdown table with columns `Where | Input | Result`. Only document inputs that exist on the device (no `Esc`, no tap, no ×).
6. `## Screenshots` — grouped tables, sourced from `screenshots/*.png`
7. `## Running locally` — `npx serve -l <port> <app-name>` snippet
8. `### Regenerating screenshots` — gated by a `> 🛠️ **Developer tooling only.**` callout so readers know Chrome is a dev-time tool, not a runtime dep. Use the `?state=…` headless Chrome loop.
9. `## Files` — short tree of the app folder
10. `<sub>Made by … at [L+R](https://www.levinriegner.com).</sub>`

## Top-level `README.md` structure (preserve this)

The repo-root README is the front door. Keep its sections and order:

1. Title + one-line pitch with link to Meta docs
2. One paragraph explaining the format (600×600, D-pad, L+R)
3. `## Demos GIFs` — wall of `github.com/user-attachments/…` `<img>` tags (200×200). **Agents should not invent these URLs.** Only edit this section if a new attachment URL is explicitly provided (e.g. in a commit message or PR body).
4. `## Hosted demos` — **alphabetical** flat list of links to `https://rbm-demos.lnr.io/<app-name>/`. One entry per demo folder. `simulator` lives in its own section, not in this list.
5. `## Simulator` — short description + live link + bulleted feature list
6. `## Running an app locally` — generic `python3 -m http.server 8080` snippet
7. `## License`

When adding a new demo, the only required top-level edit is **one new line in the Hosted demos list, in alphabetical position**. Everything else is optional.

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

- Documenting `Esc` / `×` / tap inputs in any README — the hardware has none.
- Ambient gradients behind content on the lens — they bleach against the world.
- Suggesting Chrome / headless-Chrome as a runtime dependency. It's only used to regenerate screenshots on a Mac.
- Renaming demo folders without updating the top-level README's Hosted demos list and any GIF `alt` text.
- Introducing build tools or `package.json` to an app folder. Stay vanilla.

## When in doubt

Mirror an existing, recently-updated demo. The current reference implementations for layout, README, and `?state=` routing are:

- `flight-status/` — the README template source of truth
- `lr-glimmer/` — `?state=` routing pattern
- `metronome/` — head-gesture (NOD) integration
- `simulator/` — the only non-glasses app, treat as special
