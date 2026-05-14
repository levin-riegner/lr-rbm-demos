# Teleprompter

One-way remote teleprompter: a desktop React admin types messages that appear instantly on a Meta Display Glasses client via Socket.io.

## Run

```bash
cd teleprompter
npm install
npm start
```

- **Admin dashboard:** http://localhost:3000/admin
- **Glasses client:** http://localhost:3000/glasses

Type in the admin textarea, press **Send** (or ⌘/Ctrl + Enter). The glasses client renders the text immediately on a pure black background in 24px light blue, read-only.

## Architecture

- `server.js` — Express + Socket.io. Broadcasts `message` events to all clients. Replays the last message to newly connected glasses so the wearer always sees current state.
- `admin/index.html` — React (CDN + Babel standalone) dashboard with textarea, send, clear, connection status, and live "currently on glasses" preview.
- `glasses/` — 600×600 MRBD client. `#000000` background, `#8EC5FF` 24px text, read-only (no focusable elements, key/context input blocked).

## Deploying

**This app is not deployed to Vercel** — Vercel's serverless model doesn't
support persistent WebSocket connections, which Socket.io requires for the live
WebRTC signaling and real-time message broadcasting.

Recommended hosts (all support long-running Node + WebSockets):

- **Railway** — https://railway.app — `railway init && railway up` from this folder. Free starter tier.
- **Render** — https://render.com — connect the repo, choose "Web Service", build `npm install`, start `npm start`. Free tier available.
- **Fly.io** — `fly launch` from this folder. Generous free allowances.

For quick on-device testing without a host, use a tunnel:

```bash
# Terminal 1
npm start

# Terminal 2 — exposes localhost:3000 over HTTPS
npx cloudflared tunnel --url http://localhost:3000
# or:  ngrok http 3000
```

Open the resulting HTTPS URL + `/admin` on your desktop and `/glasses` on the
glasses browser. HTTPS is required for `getUserMedia` (camera/mic) to work.
