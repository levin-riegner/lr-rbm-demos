(function () {
  'use strict';

  const messageEl = document.getElementById('message');
  const socket = io({ query: { role: 'glasses' } });

  socket.on('message', (msg) => {
    messageEl.textContent = (msg && typeof msg.text === 'string') ? msg.text : '';
  });

  // Read-only: block any input that could scroll/interact.
  window.addEventListener('keydown', (e) => e.preventDefault());
  window.addEventListener('contextmenu', (e) => e.preventDefault());

  // ---- WebRTC sender: capture glasses camera+mic and stream to admin ----
  const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];
  let pc = null;
  let localStream = null;

  async function ensureStream() {
    if (localStream) return localStream;
    localStream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'environment' },
      audio: true
    });
    return localStream;
  }

  function stopEverything() {
    if (pc) { try { pc.close(); } catch (_) {} pc = null; }
    if (localStream) {
      localStream.getTracks().forEach(t => t.stop());
      localStream = null;
    }
  }

  async function startStream() {
    try {
      stopEverything();
      const stream = await ensureStream();
      pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
      pc.onicecandidate = (e) => {
        if (e.candidate) socket.emit('rtc:ice', { candidate: e.candidate });
      };
      pc.onconnectionstatechange = () => {
        if (pc && (pc.connectionState === 'failed' || pc.connectionState === 'closed')) {
          stopEverything();
        }
      };
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('rtc:offer', { sdp: pc.localDescription });
    } catch (err) {
      console.error('[glasses] startStream failed', err);
      stopEverything();
    }
  }

  socket.on('rtc:request-stream', () => { startStream(); });
  socket.on('rtc:stop-stream', () => { stopEverything(); });
  socket.on('rtc:peer-left', ({ role }) => { if (role === 'admin') stopEverything(); });

  socket.on('rtc:answer', async ({ sdp }) => {
    if (!pc || !sdp) return;
    try { await pc.setRemoteDescription(sdp); }
    catch (err) { console.error('[glasses] setRemoteDescription failed', err); }
  });

  socket.on('rtc:ice', async ({ candidate }) => {
    if (!pc || !candidate) return;
    try { await pc.addIceCandidate(candidate); }
    catch (err) { console.error('[glasses] addIceCandidate failed', err); }
  });
})();
