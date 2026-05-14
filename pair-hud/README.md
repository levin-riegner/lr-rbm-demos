# pair-hud — WebSocket PIN pairing for the HUD

A **research prototype** for the Meta wearables web app toolkit. A Node WebSocket server pairs a phone browser to a Meta Display Glasses webapp with a 4-digit PIN (Netflix-style), then lets the phone push text live to the HUD.

This is **not** a production pattern — it exists to answer open questions from the Meta team about whether WebSocket push is viable, how phone ↔ glasses pairing could work without native identity, and what breaks in practice. See [Research questions](#research-questions) at the bottom.

---

## What's different about this example

Every other example in `/examples` is a flat static folder that Vercel can deploy as-is. This one is the first to:

- ship a `server.js` + `package.json` with a real Node dependency (`ws`)
- hold a **persistent WebSocket** for the entire session
- require **same-origin** hosting for both the static files and the WS endpoint (so mixed-content, CORS, and cert trust all vanish)

Vercel's serverless tier **cannot** host a persistent WebSocket. Use local Node + an ngrok tunnel for the demo. Production paths are noted at the bottom of this file.

---

## Files

```
pair-hud/
├── index.html      glasses HUD view (loaded via fb-viewapp:// deep link)
├── app.js          glasses client: WS lifecycle + D-pad + 6-screen state machine
├── styles.css      glasses theme: 600×600, #0a0a0f bg, 88 px tap targets
├── mobile.html     phone pairing + control view
├── mobile.js       phone client: PIN entry, presets, push
├── mobile.css      phone-friendly sizing (≥16 px inputs, safe-area insets)
├── server.js       Node http + ws: static files + WS rooms on one port
├── package.json    single dep: ws@^8
├── vercel.json     kept for parity — see note below
└── README.md       this file
```

---

## Run locally

```bash
cd examples/pair-hud
npm install
npm start
```

The server binds `0.0.0.0:3000`. Open two browser tabs:

1. **Glasses view** — `http://localhost:3000/` (Chrome DevTools device toolbar at 600×600)
2. **Phone view** — `http://localhost:3000/mobile.html` (normal viewport)

You'll see a PIN on the glasses view; type it on the phone view; the glasses view flips to "Connected". Tap a preset or type a message on the phone — it appears on the HUD.

### Keyboard shortcuts (glasses view)

- `ArrowDown` / `ArrowRight` — focus next element
- `ArrowUp` / `ArrowLeft` — focus previous
- `Enter` / `Space` — activate
- `Escape` / `Backspace` — "Back" (unpair / retry)

### Config

| Env var | Default | Meaning |
|---|---|---|
| `PORT` | `3000` | HTTP + WS port |
| `HOST` | `0.0.0.0` | Bind host |

The protocol, TTL, and rate-limit constants are at the top of `server.js` — tweak in place for experiments.

### Split-host mode (optional)

If you host the static files somewhere else (e.g. Vercel) and the WS server on another origin, set the WS URL via query string:

```
https://your-static-host.vercel.app/?ws=wss://your-ws-host.fly.dev/ws
https://your-static-host.vercel.app/mobile.html?ws=wss://your-ws-host.fly.dev/ws
```

Both `app.js` and `mobile.js` honor `?ws=...`.

---

## On-device demo (ngrok + QR)

### 1. Expose the local server

```bash
ngrok http 3000
# → https://xxxx.ngrok-free.app
```

ngrok serves HTTP and WSS on the same origin, so `wss://xxxx.ngrok-free.app/ws` just works.

### 2. Generate the two QR codes

The toolkit ships a QR generator at `.claude/skills/qr-code/scripts/qr_generator.py`. From the repo root:

```bash
# Glasses — adds the webapp via the MetaAI app's deep link.
python3 .claude/skills/qr-code/scripts/qr_generator.py \
  --png /tmp/pair-hud-glasses.png \
  "fb-viewapp://web_app_deep_link?appName=Pair%20HUD&appUrl=https%3A%2F%2Fxxxx.ngrok-free.app%2F"

# Phone — opens the mobile pairing page in the phone's regular browser.
python3 .claude/skills/qr-code/scripts/qr_generator.py \
  --png /tmp/pair-hud-mobile.png \
  "https://xxxx.ngrok-free.app/mobile.html"
```

(Replace `xxxx.ngrok-free.app` with your actual tunnel hostname in both.)

### 3. Pair and push

1. Scan `/tmp/pair-hud-glasses.png` with the **MetaAI app** → "Pair HUD" is added to the glasses.
2. Open it on the glasses. HUD shows **Connecting**, then **a 4-digit PIN**.
3. Scan `/tmp/pair-hud-mobile.png` with the **phone camera** → opens `mobile.html` in Safari/Chrome.
4. Type the PIN → **Connect**. HUD flips to **Connected** (target: <1 s).
5. Tap a preset or type a message → it renders on the HUD in large white text.

---

## Protocol (JSON over `/ws`)

Every frame carries `v: 1`, a monotonic `id`, and `ts`. Messages are small JSON objects with a `type`. Max frame: 4 KB.

### Client → server

| From | `type` | Fields | Meaning |
|---|---|---|---|
| glasses | `register` | — | Ask for a new PIN. Sent on WS open. |
| mobile | `join` | `pin` | Attempt to pair with that PIN. |
| mobile | `push` | `payload` | Text to render on the HUD (≤200 chars after trim). |

### Server → client

| To | `type` | Fields | Meaning |
|---|---|---|---|
| glasses | `registered` | `pin`, `pinTtlMs` | PIN allocated. Show it. |
| glasses | `paired` | — | Mobile joined. Flip to "Connected". |
| glasses | `message` | `payload` | Render on HUD. |
| glasses | `peer-disconnected` | `reason` | Mobile dropped. New `registered` follows with a fresh PIN. |
| glasses | `pin-expired` | — | Unpaired for TTL. Fresh `registered` follows. |
| mobile | `join-ok` | — | Paired. Switch to control view. |
| mobile | `join-fail` | `reason` ∈ `unknown-pin` \| `already-paired` \| `rate-limited` \| `bad-format` | Show a tailored error. |
| mobile | `peer-disconnected` | `reason` | Glasses dropped. Go back to PIN entry. |
| either | `error` | `reason`, `detail?` | Protocol-level error. |

No ACK on `push` — fire-and-forget HUD demo. No history replay — if you disconnect, you missed it.

---

## Server design notes

All state is in-memory. `server.js` holds:

```
rooms:                Map<pin, Room>
pinByGlassesSocket:   WeakMap<ws, pin>
pinByMobileSocket:    WeakMap<ws, pin>
joinBuckets:          Map<ip, {count, resetAt}>   // rate-limit buckets
registerBuckets:      Map<ip, {count, resetAt}>
```

| Concern | Behavior |
|---|---|
| PIN generation | `crypto.randomInt(10000)` zero-padded to 4 chars. Retry on collision up to 20x; if still taken, emit `error { reason:"server-full" }`. |
| PIN lifetime | 5 min if nobody joins. On expiry → `pin-expired` + fresh `registered`. |
| Mobile disconnect | Glasses get `peer-disconnected`, the **old PIN is destroyed**, and a **new PIN is issued** immediately. Prevents shoulder-surfed PIN reuse. |
| Glasses disconnect | Room is torn down. Any paired mobile is closed with code 1000. |
| Rate limits (per IP, token bucket) | `join`: 10/min · `register`: 20/min. Brute-forcing 10 000 PINs at 1 k rps without these takes ~10 s. |
| Payload cap | 200 chars after trim (control chars replaced with spaces). |
| WS frame cap | 4 KB via `ws` `maxPayload`. |
| Keepalive | WS `ping` every 30 s. Sockets that miss a pong are terminated (defeats ngrok's ~60 s idle drop). |
| Static serving | Plain `http` + `fs`. 6 MIME types. Path traversal blocked. `Cache-Control: no-store` (ngrok iteration). |
| Logs | One-line JSON to stdout. `npm start | tee run.log` during a live demo. |
| Health check | `GET /health` → `{ ok: true, rooms: N }`. |

---

## Testing

### Desktop-only dry run

```bash
npm install
npm start
```

1. Chrome tab A at 600×600 → `http://localhost:3000/` → expect **Connecting → Pairing** with a 4-digit PIN.
2. Chrome tab B (normal viewport) → `http://localhost:3000/mobile.html` → type the PIN → **Connect**. Tab A flips to **Connected**.
3. Tab B → send "hello". Tab A renders "hello".
4. Close tab B. Tab A goes briefly to **Connecting** then back to **Pairing** with a **new PIN** (the old one is now unknown).
5. In a third tab, try joining with the **old** PIN → `join-fail reason="unknown-pin"`.
6. Fire 12 rapid join attempts with random PINs → expect `rate-limited` after ~10.
7. Leave tab A idle for 6 min → PIN expires, a fresh one appears.
8. Reload tab A → `run.log` shows the old room destroyed (no leak).

### On-device dry run

Follow the [ngrok + QR](#on-device-demo-ngrok--qr) flow above. Deliberately test the edge cases:

- Lock the phone for 2 min, unlock, send another preset — does it deliver? (research item #4)
- Take off the glasses for 30 s, put them back on — does the WS survive, or reconnect cleanly? (items #1, #3)
- Flip the phone between Wi-Fi and LTE — does the glasses-side WS survive? (item #2)

---

## Hosting beyond ngrok

### A. Local + ngrok (this setup)
- ✅ Easiest. Same-origin. Free.
- ❌ Public URL rotates on every `ngrok` restart (free tier).
- ❌ Not for sustained traffic.

### B. Static on Vercel, WS elsewhere
- Deploy `index.html`, `app.js`, `styles.css`, `mobile.html`, `mobile.js`, `mobile.css` to Vercel.
- Deploy `server.js` to **Render**, **Fly.io**, or **Railway** (any host that keeps a persistent process).
- Clients override WS URL via `?ws=wss://your-ws-host/ws`.
- Needs CORS: since WS isn't bound by CORS but the browser's same-origin mixed-content rules are, both origins must be HTTPS/WSS.

### C. All-in-one on Fly.io / Render / Railway
- Single host serves both static files and WS.
- Simplest long-lived deploy. Just point a domain at it.

### D. Vercel alone
- ❌ Not supported. Vercel serverless functions time out on long-lived connections. Use B or C instead.

The `vercel.json` is kept for **parity with other examples in this repo** (so tooling that assumes every example has one doesn't error). Deploying just this folder to Vercel will serve the static files fine — but the WS connection will never succeed against a Vercel origin.

---

## Known limitations (by design)

- **No history.** Drop the WS, miss any `message` frames that fired in the meantime.
- **No auth beyond the PIN.** Physical co-presence (you must see the HUD to read the PIN) is the authentication. Anyone on the same tunnel with the same PIN in the 5-min window can take over.
- **One mobile per glasses.** A second `join` with the same PIN fails with `already-paired`.
- **Payloads are plain strings.** No images, no markup, no ACKs.
- **No persistence.** Restart the server → every room is gone.

These are deliberate scope cuts. Production would need per-glasses identity, a real auth handshake (e.g. nonce-signed token), delivery receipts, and a durable queue.

---

## Research questions

The primary deliverable of this prototype is **a testbed** for the following questions. Note whichever answers you find, good or bad, and send them to the Meta team.

1. **HUD power-state WS survival.** Does the WS hibernate, die, or survive when the wearer takes off the glasses or the display sleeps? Determines whether persistent-session UX is even feasible.
2. **Phone network handoff.** If the paired phone switches Wi-Fi ↔ LTE, does the glasses-side WS survive? (Glasses' TCP peer is the tunnel server, not the phone — but the phone's disconnection tears down the server-side half.)
3. **Reconnect latency.** How fast does `connectWebSocket`'s 1 s → 30 s backoff actually recover? Does the HUD need a "silent" grace period before showing **Reconnecting…** to avoid flicker on brief blips?
4. **Phone-lock delivery rate.** Quantify `push` success rate with the phone screen locked, on iOS and Android. If it's bad, the path forward is a PWA install or a native companion SDK.
5. **Battery impact of 30 s keepalive.** Benchmark 30 min with the keepalive vs 30 min on a static page. Report the delta.
6. **Multi-WS per glasses.** Can the glasses keep two separate webapps' WSes open simultaneously? Matters for Meta's platform story.
7. **No-SVG constraint re-test.** Docs say SVG is unsupported. A 1-line `<svg>` smoke test clarifies whether it's a silent fail or a rasterize fallback.
8. **Clipboard API availability.** Can the phone pair page call `navigator.clipboard.readText()` inside the MetaAI app's embedded browser? Enables "copy PIN → paste on phone".
9. **Deep-link caching.** Once added via `fb-viewapp://`, does the MetaAI app re-fetch `index.html` on every launch or cache it? Affects whether server code changes need re-pairing or just a re-open.
10. **TLS tolerance.** Does the glasses WebView accept `*.ngrok-free.app`, `*.fly.dev`, Cloudflare Tunnel custom subdomains equally, or is one rejected?
11. **WS frame ceiling.** Where does message size hit a hard clamp — the 4 KB we set in `ws`, or an OS-level ceiling lower or higher than that? Matters for future image-URL push features.
12. **Notification surface.** When a `message` arrives while the wearer is looking elsewhere, does any surface (HUD blink, Neural Band haptic) exist to signal it? Document what's exposed or missing.

### Secondary feedback for the toolkit

- The toolkit currently has **zero backend examples** and a Vercel-only publish story. A realtime primitive — or at least a `/connect-websocket` skill pointing at a hosted option — would close this gap.
- `.claude/skills/publish-to-vercel` assumes serverless. A parallel `publish-to-fly` or `publish-to-render` skill for WS-capable workloads would make this prototype a one-command deploy.
- A stable per-glasses device ID (even hashed) exposed to webapps would let mobile pairing persist across sessions without a PIN every time.
- The MetaAI app's embedded browser vs external Safari differ in permissions, origin, and session. Document the difference.

---

## License

Same as the parent repository.
