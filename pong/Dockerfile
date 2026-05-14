# Pong WebSocket server — Fly.io / any Docker host.
#
# Build:  docker build -t pong .
# Run:    docker run --rm -p 8080:8080 pong
# Health: curl http://localhost:8080/health  → {"ok":true,"rooms":0}

FROM node:20-alpine

WORKDIR /app

# Install production deps first (cache layer survives source edits).
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --no-audit --no-fund

# The server statically serves the client files from the same origin, so
# include them in the image too. Lets Fly handle the entire app — Netlify
# is only needed if you want a separate static host.
COPY server.js index.html app.js styles.css ./

# Fly's HTTP service expects port 8080 by default. server.js reads PORT.
ENV PORT=8080
EXPOSE 8080

# Run as the non-root user shipped in the base image.
USER node

CMD ["node", "server.js"]
