const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use('/admin', express.static(path.join(__dirname, 'admin')));
app.use('/glasses', express.static(path.join(__dirname, 'glasses')));
app.get('/', (_req, res) => res.redirect('/admin'));

let lastMessage = { text: '', ts: 0 };

io.on('connection', (socket) => {
  const role = socket.handshake.query.role || 'unknown';
  console.log(`[connect] ${socket.id} role=${role}`);

  if (role === 'glasses' && lastMessage.ts) {
    socket.emit('message', lastMessage);
  }

  socket.on('send', (payload) => {
    const text = typeof payload?.text === 'string' ? payload.text : '';
    lastMessage = { text, ts: Date.now() };
    io.emit('message', lastMessage);
  });

  socket.on('clear', () => {
    lastMessage = { text: '', ts: Date.now() };
    io.emit('message', lastMessage);
  });

  // --- WebRTC signaling relay (admin <-> glasses) ---
  socket.on('rtc:request-stream', () => {
    socket.broadcast.emit('rtc:request-stream', { from: role });
  });
  socket.on('rtc:stop-stream', () => {
    socket.broadcast.emit('rtc:stop-stream', { from: role });
  });
  socket.on('rtc:offer', (payload) => {
    socket.broadcast.emit('rtc:offer', { from: role, sdp: payload?.sdp });
  });
  socket.on('rtc:answer', (payload) => {
    socket.broadcast.emit('rtc:answer', { from: role, sdp: payload?.sdp });
  });
  socket.on('rtc:ice', (payload) => {
    socket.broadcast.emit('rtc:ice', { from: role, candidate: payload?.candidate });
  });

  socket.on('disconnect', () => {
    console.log(`[disconnect] ${socket.id}`);
    socket.broadcast.emit('rtc:peer-left', { role });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Teleprompter server running:`);
  console.log(`  Admin:   http://localhost:${PORT}/admin`);
  console.log(`  Glasses: http://localhost:${PORT}/glasses`);
});
