# pong — Two-player real-time Pong for Meta Display Glasses

Two players each on their own glasses (or browser tab) connect through a 4-digit room code and play classic Pong. A Node WebSocket server runs **server-authoritative** physics; clients send paddle intent and render interpolated snapshots.

This is the canonical "two-device interactive" example for the Meta wearables web app toolkit. It's a sibling of [`../pair-hud`](../pair-hud) — same shape, same helpers, same hosting story.

---

## What's different about this example

Like `pair-hud`, this is one of the few examples in `/examples` that:

- ships a `server.js` + `package.json` with a real Node dependency (`ws`)
- holds a **persistent WebSocket** for the entire match
- requires **same-origin** hosting for both the static files and the WS endpoint (so mixed-content, CORS, and cert trust all vanish)

Unlike `pair-hud`, both clients are interactive game peers — no phone control surface, both ends are the glasses webapp. The protocol carries paddle intent in and authoritative snapshots out.

Vercel's serverless tier **cannot** host a persistent WebSocket. Use local Node + an ngrok tunnel for the demo. Production paths are noted at the bottom of this file.

---

## Files

```
pong/
├── index.html      glasses webapp: 8-screen state machine
├── app.js          glasses client: WS lifecycle, combo-lock join, render loop, paddle input
├── styles.css      glasses theme: 600×600, #0a0a0f bg, 88 px tap targets, combo lock
├── server.js       Node http + ws: static files + WS rooms + 60 Hz physics
├── package.json    single dep: ws@^8
├── Dockerfile      container image for Fly.io (or any Docker host)
├── .dockerignore   excludes node_modules, README, deploy config, etc.
├── fly.toml        Fly.io app config — `flyctl launch` + `flyctl deploy`
├── netlify.toml    Netlify build/publish config for the static side
├── vercel.json     kept for parity — see note in Production hosting
└── README.md       this file
```

---

## Architecture

```
┌─────────────┐                                     ┌─────────────┐
│ glasses #1  │ ── input {intent}     ──────────►  │             │
│  (left)     │ ◄── state {ball, paddles, score} ──│   server    │
└─────────────┘                                     │  (Node ws)  │
                                                    │             │
┌─────────────┐                                     │  60 Hz tick │
│ glasses #2  │ ── input {intent}     ──────────►  │  20 Hz snap │
│  (right)    │ ◄── state {…}                ──────│             │
└─────────────┘                                     └─────────────┘
```

The server holds all room state (ball, paddles, scores, phase). It runs a 60 Hz physics tick per active room, applies each side's last received `intent`, simulates ball + paddle physics, and broadcasts a 20 Hz state snapshot to both peers. Clients render each frame by lerping between the two latest snapshots — they never simulate physics themselves, so two clients on different networks can never drift apart.

---

## Run locally

```bash
cd examples/pong
npm install
npm start
```

The server binds `0.0.0.0:3000` and prints the URL it's reachable at, e.g.:

```
pong running:
  HTTP    http://localhost:3000/
  WS      ws://localhost:3000/ws
  Health  http://localhost:3000/health

Share with another computer on the same Wi-Fi:
  http://192.168.1.62:3000/
  http://Gautiers-MacBook-Pro.local:3000/  (Bonjour)
```

### Same-machine smoke test (two browser tabs)

1. **Tab A** — `http://localhost:3000/` → press *Enter* on **Create room** → note the 4-digit code.
2. **Tab B** — `http://localhost:3000/` → focus **Join room** → press Enter → spin the combo lock to the code → *Enter* to submit.

Both tabs flip to the game screen. Tab A's paddle is cyan (left); Tab B's paddle is cyan (right). Each tab uses ↑ / ↓ to move *its* paddle. First to 5 wins.

### Two different computers on the same Wi-Fi

No tunnel, no config. The server already binds `0.0.0.0`, so any machine on the same network can reach it.

1. On the **host** computer: `npm start`, look at the boot banner for the LAN URL (e.g. `http://192.168.1.62:3000/`). Open it locally to **Create room** and read the 4-digit code.
2. On the **other** computer (any OS, any browser, same Wi-Fi): open that same `http://192.168.1.62:3000/` URL, **Join room**, enter the code.

The client derives its WebSocket URL from `location.host`, so the second machine automatically uses `ws://192.168.1.62:3000/ws` — no override needed.

If the URL doesn't load on the other machine, three things to check:
- **Same Wi-Fi?** Run `ipconfig` / `ifconfig` and confirm both machines have addresses in the same subnet (`192.168.1.x`, etc.).
- **Firewall on the host?** macOS: System Settings → Network → Firewall. Linux: `ufw status`. Windows: Defender Firewall → allow `node` for private networks.
- **Router AP isolation?** Some guest Wi-Fi networks block client-to-client traffic. Use the main SSID, or a phone hotspot.

### Keyboard

| Screen | Up / Down | Left / Right | Enter / Space | Escape / Backspace |
|---|---|---|---|---|
| home, waiting, gameover, error, disconnected | move focus | move focus | activate | leave / back |
| join | rotate active digit | switch column | submit / activate button | back to home |
| game | move paddle | — | — | leave room |

### Config

| Env var | Default | Meaning |
|---|---|---|
| `PORT` | `3000` | HTTP + WS port |
| `HOST` | `0.0.0.0` | Bind host |

Physics constants (paddle speed, ball speed, win score, snapshot rate) live at the top of `server.js`. Tweak in place for experiments.

### Split-host mode (optional)

If you host the static files somewhere else and the WS server on another origin, the client picks the right URL automatically:

1. **Edit `app.js`** — set the `WS_PROD` constant near the top:
   ```js
   var WS_PROD = 'wss://your-ws-host.fly.dev/ws';
   ```
2. **Redeploy the static files.** That's it. Public visitors auto-route to `WS_PROD`; localhost / LAN / `*.local` keeps using same-origin so `npm start` still works.

You can also force any URL with `?ws=wss://…/ws` — handy for testing different backends without redeploying. Override always wins over `WS_PROD`. See **[Production hosting](#production-hosting-netlify--flyio)** below for a full recipe.

---

## On-device demo (ngrok + QR)

### 1. Expose the local server

```bash
ngrok http 3000
# → https://xxxx.ngrok-free.app
```

ngrok serves HTTP and WSS on the same origin, so `wss://xxxx.ngrok-free.app/ws` just works. The server's 15 s WebSocket keepalive plus a 10 s app-level JSON heartbeat defeat ngrok's ~60 s idle disconnect. If a WS still blips, the client auto-rejoins with the per-match token within a 10 s grace window so the game survives transient cross-continent drops.

### 2. Add the webapp to two pairs of glasses

Use the toolkit's QR generator to produce a `fb-viewapp://` deep link, then scan it on each phone (paired to its glasses):

```bash
python3 .claude/skills/qr-code/scripts/qr_generator.py \
  --png /tmp/pong.png \
  "fb-viewapp://web_app_deep_link?appName=Pong&appUrl=https%3A%2F%2Fxxxx.ngrok-free.app%2F"
```

(Replace `xxxx.ngrok-free.app` with your actual tunnel hostname.)

Scan the PNG with the **MetaAI app's** QR scanner on each phone. *Pong* shows up in the glasses' web app grid.

### 3. Pair and play

1. Player 1 opens **Pong** on their glasses → **Create room** → reads the 4-digit code aloud.
2. Player 2 opens **Pong** on their glasses → **Join room** → spins the combo lock to the code → submits.
3. Both glasses flip to the court. The cyan paddle is yours; white is your opponent. ↑ / ↓ moves it. First to 5 wins.
4. After **You won** / **You lost**, both press **Play again** to rematch in the same room.

You can also point Player 2 at their phone's regular browser instead of glasses — the page is glasses-shaped (600×600) but the input model (arrow keys + Enter) works fine on a desktop or phone keyboard for testing.

---

## Protocol (JSON over `/ws`)

Every frame carries `v: 1`, a monotonic `id`, and `ts`. Messages are small JSON objects with a `type`. Max frame: 4 KB.

### Client → server

| `type` | Fields | Meaning |
|---|---|---|
| `create` | — | Allocate a new 4-digit code, become the left paddle. |
| `join` | `code` (4-digit string) | Try to pair into an existing room as the right paddle. |
| `rejoin` | `code`, `token` | After a mid-match WS drop, present the per-match token to slip back into the same seat (within `GRACE_MS` ≈ 10 s). |
| `input` | `intent ∈ [-4, 4]` | Paddle direction: −1 up, 0 idle, 1 down. Magnitudes 2–4 boost paddle speed (rapid-tap / fast swipe). |
| `ping` | `t` | App-level heartbeat. Server echoes a `pong` and bumps the idle timer. |
| `ready` | — | After `phase: 'won'`, request a rematch. Both players must send. |
| `leave` | — | Graceful leave. Server tears down the room. |

### Server → client

| `type` | Fields | Meaning |
|---|---|---|
| `created` | `code`, `ttlMs` | Room created. Show the code; expires in `ttlMs` if no one joins. |
| `paired` | `side ∈ {'left','right'}`, `token` | Both peers connected. Stash the `token` — you'll need it to rejoin after a drop. |
| `rejoined` | `side`, `score` | Server matched your `rejoin` and reseated you. Resume the game UI; scores echoed in case you missed snapshots. |
| `rejoin-fail` | `reason ∈ 'unknown-code' \| 'bad-token' \| 'bad-format' \| 'already-in-room'` | Token / room couldn't be matched (or grace already expired). Drop the token and treat the match as ended. |
| `peer-paused` | `side`, `graceMs` | Your opponent's WS dropped; physics is frozen until they rejoin or `graceMs` elapses. |
| `peer-resumed` | `side` | Opponent rejoined inside the grace window. |
| `state` | `seq`, `t`, `ball:{x,y}`, `paddles:{l,r}`, `score:{l,r}`, `phase` | 20 Hz snapshot. Drop if `seq < lastSeq`. |
| `phase` | `phase`, `winner?`, `score?` | Match-level transitions: `'paused'` (peer dropped), `'playing'` (resumed / rematch), `'won'` (with `winner`). |
| `pong` | `t` | Echo of the client's `ping` heartbeat. |
| `opponent-disconnected` | `reason` | Peer left, idle-timed-out, or failed to rejoin within the grace window. |
| `join-fail` | `reason ∈ 'unknown-code' \| 'already-paired' \| 'rate-limited' \| 'bad-format' \| 'already-in-room'` | Show a tailored error. |
| `error` | `reason`, `detail?` | Protocol-level error. |

No ACK on `input`; fire-and-forget. The server auto-clamps any side's `intent` to 0 if it hasn't received an `input` from that side in 2 s — protects against stuck paddles when a `keyup` is dropped or the tab is killed mid-press.

---

## Server design notes

All state is in-memory. `server.js` holds:

```
rooms:               Map<code, Room>
codeByLeftSocket:    WeakMap<ws, code>
codeByRightSocket:   WeakMap<ws, code>
joinBuckets:         Map<ip, {count, resetAt}>   // rate-limit buckets
createBuckets:       Map<ip, {count, resetAt}>
```

A `Room` carries `{ left, right, ball, phase, winner, lastSnapshotSeq, tickTimer, snapshotTimer, idleTimer, codeExpireTimer, serveTimer }`. Each side carries `{ ws, y, intent, lastInputAt, score, ready }`.

| Concern | Behavior |
|---|---|
| Code generation | `crypto.randomInt(10000)` zero-padded to 4 chars. Retry on collision up to 20×; if still taken, emit `error { reason:"server-full" }`. |
| Code lifetime | 5 min if nobody joins. On expiry → `error { reason:"code-expired" }` and the room is torn down. |
| Authority | Server runs the only physics tick. Clients never simulate the ball. |
| Tick rate | 60 Hz physics. 20 Hz `state` broadcast (50 ms snapshot interval). |
| Paddle physics | Linear by `PADDLE_SPEED * intent * dt`, clamped to court. |
| Ball physics | Bounces off top/bottom walls. Paddle hits reflect X, set Y from hit-point on paddle (corners give steeper angle), multiply speed by 1.04 capped at 520 px/s, perturb angle ±5°, clamp \|vy/vx\| ≤ 3 to dodge near-vertical loops. |
| Goal & serve | Score increments, ball freezes 800 ms, then re-serves toward the loser. First to 5 wins. |
| Stuck-paddle guard | Server clamps each side's `intent` to 0 if `now - lastInputAt > 2 s`. |
| Idle GC | Room destroyed after 60 s with no `input` from either side. |
| Rate limits (per IP, token bucket) | `join`: 10/min · `create`: 20/min. |
| WS frame cap | 4 KB via `ws` `maxPayload`. |
| Keepalive | WS `ping` every 15 s; app-level `ping`/`pong` JSON every 10 s from the client. Sockets that miss a pong are terminated (defeats ngrok's ~60 s idle drop and intermediaries that swallow WS control frames). |
| Reconnect | Each `paired` ships a 96-bit per-match `token`. A dropped peer can `rejoin` the same seat within `GRACE_MS` (10 s) — physics freezes, then resumes; score is preserved. |
| Static serving | Plain `http` + `fs`. 6 MIME types. Path traversal blocked. `Cache-Control: no-store`. |
| Logs | One-line JSON to stdout. |
| Health check | `GET /health` → `{ ok: true, rooms: N }`. |

---

## Testing

### Two-tab smoke test (local)

```bash
npm install
npm start
```

1. Tab A at 600×600 → `http://localhost:3000/` → **Create room** → expect a 4-digit code on **Waiting**.
2. Tab B → `http://localhost:3000/` → **Join room** → spin the combo lock to that code → **Connect**. Both tabs flip to the court within ~1 s.
3. Each tab: ↑ / ↓ moves its paddle. Play to 5; both tabs land on **You won** / **You lost** with the right headline.
4. Both press **Play again** → scores reset and a new match starts in the same room.
5. Press **Esc** in either tab mid-rally → that tab leaves; the other lands on **Disconnected** within ~1 s.
6. `curl http://localhost:3000/health` → `{ ok: true, rooms: 0 }` (no leak).

### Edge cases worth poking

- **Wrong code**: spin the join lock to a code that doesn't exist → `join-fail/unknown-code`, lock body shakes.
- **Code occupied**: open three tabs, have A create, B join, C try to join the same code → `join-fail/already-paired`.
- **Rate limit**: hammer >10 join attempts from one IP in 60 s → `join-fail/rate-limited`.
- **Stuck paddle**: hold ↓, kill the tab → server auto-clamps that side's intent to 0 within 2 s; the other tab sees the orphan paddle stop.
- **Idle GC**: open the game, both go idle (no key presses) for >60 s → both clients drop to **Disconnected** (idle timeout).
- **Code expiry**: open the home, **Create room**, leave it for >5 min without anyone joining → server emits `code-expired`, client lands on **Disconnected**.
- **Big junk frame**: send a 5 KB blob over the WS → server closes with `payload-too-large`.
- **Brief mid-match drop**: open two tabs, start a game, toggle the Network panel to Offline for one tab for ~2 s, then back online → that tab shows "Connection blip — reconnecting…", the other tab shows "Match paused — waiting for opponent…", both resume with scores preserved.
- **Drop longer than the grace window**: same setup but stay offline > 10 s → both tabs land on the Disconnected screen; server logs `room.grace-expired`.

### On-device dry run

Follow the [ngrok + QR](#on-device-demo-ngrok--qr) flow above. Things to test specifically on glasses:

- Can both wearers see and read the cyan paddle clearly against a bright background? (Additive-display rule: the paddle is bright-colored, the ball glows, the bg is dark.)
- At ngrok-grade RTT (~100–200 ms), does the lerp interpolation hide the snapshot stair-stepping? Should *feel* smooth.
- After a goal + 800 ms serve pause, does the new ball appear cleanly without lerp-induced "ghost" trails? (The renderer snaps through serve discontinuities by design.)
- Does removing the glasses (display sleeps) cleanly result in `opponent-disconnected` on the peer side, or does the WS hang? Log what you observe.

---

## Production hosting (Netlify + Fly.io)

A persistent WebSocket server cannot run on Netlify or Vercel — their function runtimes terminate long-lived connections. The recommended production setup splits the deploy:

- **Static files (index.html, app.js, styles.css)** → **Netlify** (free, instant CDN, HTTPS).
- **WebSocket server (server.js)** → **Fly.io** (free tier, persistent Node process, WSS).

The `app.js` config knows about this split automatically once you set `WS_PROD`.

```
                  ┌──────────────────────────┐
                  │        Netlify           │
   Players ───►   │  pong.netlify.app        │  serves index.html, app.js, styles.css
                  └────────────┬─────────────┘
                               │  (browser opens WSS to …)
                               ▼
                  ┌──────────────────────────┐
                  │         Fly.io           │
                  │  pong-ws.fly.dev/ws      │  Node + ws (your server.js verbatim)
                  └──────────────────────────┘
```

This directory already ships everything you need: a `Dockerfile`, `fly.toml`, `netlify.toml`, and a `.dockerignore`.

### 1. Deploy the server to Fly.io

```bash
# One-time setup.
curl -L https://fly.io/install.sh | sh
flyctl auth login

cd examples/pong
flyctl launch --copy-config --no-deploy
#   Prompts for an app name (e.g. "pong-ws"). Writes it back to fly.toml.
flyctl deploy
```

After `flyctl deploy` succeeds, copy the public hostname it prints — e.g. `https://pong-ws.fly.dev`. Smoke-test it:

```bash
curl https://pong-ws.fly.dev/health   # → {"ok":true,"rooms":0}
```

### 2. Point the client at the Fly server

Open `app.js` and set `WS_PROD` near the top:

```js
var WS_PROD = 'wss://pong-ws.fly.dev/ws';
```

(Use `wss://` — secure WebSocket — to match Netlify's HTTPS. Mixed-content rules will block a plain `ws://` from an HTTPS page.)

### 3. Deploy the static files to Netlify

Easiest path — drag-and-drop:

1. Open <https://app.netlify.com/drop>.
2. Drop the `examples/pong/` folder onto the page.
3. Netlify prints a public URL like `https://random-name.netlify.app`. Done.

Alternative — CLI:

```bash
npm i -g netlify-cli
netlify deploy --prod --dir=examples/pong
```

Alternative — Git: connect this repo in the Netlify dashboard and set the **base directory** to `examples/pong`. `netlify.toml` skips the build step entirely (pure static).

### 4. Play

Share the Netlify URL with the other player. Both of you click **Create room** / **Join room** as before — the client transparently uses `WS_PROD` for the WebSocket because the page is on a public origin. Same UX, anywhere on the internet, at any time.

### Updating

- **Client change** (any file in `app.js`, `index.html`, `styles.css`): redeploy to Netlify only. Drag-and-drop again, or `netlify deploy --prod`, or push to the connected branch.
- **Server change** (`server.js`): `flyctl deploy` from `examples/pong/`. The Netlify side doesn't need to know.
- **Both:** deploy server first, client second — the client should never be ahead of a protocol the server doesn't yet speak.

### Other options

| Option | Trade-off |
|---|---|
| **All-in-one on Fly.io** | The Dockerfile already includes the static files (`index.html`, `app.js`, `styles.css`), so a single `flyctl deploy` actually serves both. Skip Netlify entirely and use the Fly URL. Simplest setup; only downside is the Fly free tier has fewer edge POPs than Netlify's CDN. |
| **Render** | Free Web Service tier (750 h/mo). Same shape as Fly but free instances spin down after 15 min idle and take ~30–60 s to wake. Painful for an interactive game. |
| **Railway** | Pay-as-you-go ($5 free credit/month). Best DX, no cold starts. Use if Fly free tier becomes a constraint. |
| **Self-host on a VPS** (Hetzner / DO / Linode, $4–6/mo) | Full control, always-on, no cold starts. Manual setup (systemd + Caddy for TLS). |
| **Cloudflare Workers + Durable Objects** | Would work via hibernating WebSockets, but requires rewriting `server.js` to the DO model. Overkill for Pong. |
| **Vercel / Netlify Functions** | ❌ Not supported. Their function runtimes terminate persistent WebSockets. Same constraint as `pair-hud`. |

The included `vercel.json` is kept for **parity with other examples in this repo** (so tooling that assumes every example has one doesn't error). It will serve the static files fine — but the WebSocket will never connect against a Vercel origin.

---

## Limitations (by design)

- **10-second mid-match reconnect window.** If a peer's WS drops, the room is paused and held for ~10 s. The client auto-reconnects with the per-match `rejoin` token and resumes; longer drops still tear the room down.
- **No AI / single-player.** Strict 2-player only. To smoke-test alone, open two tabs.
- **One match per room.** Game over → both press **Play again** to rematch with reset scores. No best-of-N.
- **No spectators, chat, replay.** Just the game.
- **No persistence.** Restart the server → every room gone.
- **No authentication beyond knowing the code.** Anyone on the same WS host with the code in the 5 min window can take the right-paddle slot.

These are deliberate scope cuts. Production multiplayer would need a real auth handshake, durable match history, reconnect tokens, and a matchmaking layer.

---

## License

Same as the parent repository.
