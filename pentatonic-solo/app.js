/* =========================================================
   PENTATONIC SOLO — B MINOR (Comfortably Numb)
   5 notes of the B minor pentatonic scale mapped to the d-pad:
     ↓  = B  (root,   degree 1)
     ←  = D  (minor 3rd,  b3)
     ↑  = E  (4th,        4)
     →  = F# (5th,        5)
     ⏎  = A  (minor 7th,  b7) — highest
   Each note rings out (~3.5s natural decay) until another
   note is played, which quick-fades the previous one.
   ========================================================= */

const SCALE = [
  { name: 'B',  midi: 47, deg: '1'  }, // B2
  { name: 'D',  midi: 50, deg: 'b3' }, // D3
  { name: 'E',  midi: 52, deg: '4'  }, // E3
  { name: 'F#', midi: 54, deg: '5'  }, // F#3
  { name: 'A',  midi: 57, deg: 'b7' }, // A3
];

const SLOT_INDEX = {
  down:  0, // B  (root, lowest)
  left:  1, // D  (b3)
  up:    2, // E  (4)
  right: 3, // F# (5)
  enter: 4, // A  (b7, highest)
};

const SLOT_KEYCODE = {
  ArrowDown:  'down',
  ArrowLeft:  'left',
  ArrowUp:    'up',
  ArrowRight: 'right',
  Enter:      'enter',
};

const RING_DURATION = 3.5;  // seconds a note rings out naturally
const QUICK_RELEASE = 0.08; // seconds to fade an interrupted note

// rainbow spectrum (Dark Side prism)
const PRISM = [
  [255,  74,  91],  // red
  [255, 130,  60],  // orange
  [255, 210,  70],  // yellow
  [120, 230, 130],  // green
  [ 80, 200, 255],  // cyan
  [ 90, 120, 255],  // blue
  [180, 100, 255],  // violet
];

// ---------------------------------------------------------
// state
// ---------------------------------------------------------
let currentVoice = null; // single mono voice

// ---------------------------------------------------------
// audio
// ---------------------------------------------------------
let actx = null;
let masterGain = null;
let masterFilter = null;
let analyser = null;
let analyserData = null;

function makeSaturationCurve(amount) {
  // mild soft-clip — adds harmonics without being heavy fuzz
  const n = 1024;
  const curve = new Float32Array(n);
  const k = amount;
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return curve;
}

function ensureAudio() {
  if (actx) return;
  actx = new (window.AudioContext || window.webkitAudioContext)();

  masterFilter = actx.createBiquadFilter();
  masterFilter.type = 'lowpass';
  masterFilter.frequency.value = 2200;
  masterFilter.Q.value = 0.7;

  // soft saturation — Big-Muff-light warmth
  const saturator = actx.createWaveShaper();
  saturator.curve = makeSaturationCurve(1.6);
  saturator.oversample = '4x';

  // tape-delay for Gilmour space (~430ms with feedback)
  const delay = actx.createDelay(1.5);
  delay.delayTime.value = 0.43;
  const delayFb = actx.createGain();
  delayFb.gain.value = 0.34;
  const delayHi = actx.createBiquadFilter();
  delayHi.type = 'highpass';
  delayHi.frequency.value = 250;
  const delayLo = actx.createBiquadFilter();
  delayLo.type = 'lowpass';
  delayLo.frequency.value = 2600;
  const delayWet = actx.createGain();
  delayWet.gain.value = 0.32;

  masterGain = actx.createGain();
  masterGain.gain.value = 0.30;

  analyser = actx.createAnalyser();
  analyser.fftSize = 1024;
  analyserData = new Uint8Array(analyser.frequencyBinCount);

  // routing:
  //   masterFilter -> saturator -> [dry -> masterGain, wet -> delay loop -> delayWet -> masterGain]
  masterFilter.connect(saturator);
  saturator.connect(masterGain);                       // dry
  saturator.connect(delayHi);
  delayHi.connect(delayLo);
  delayLo.connect(delay);
  delay.connect(delayFb);
  delayFb.connect(delayHi);                            // feedback loop
  delay.connect(delayWet);
  delayWet.connect(masterGain);                        // wet

  masterGain.connect(analyser);
  analyser.connect(actx.destination);

  startScope();
}

function midiToFreq(midi)   { return 440 * Math.pow(2, (midi - 69) / 12); }
function midiToOctave(midi) { return Math.floor(midi / 12) - 1; }

function cutVoice(voice, fadeTime) {
  const now = actx.currentTime;
  voice.voiceGain.gain.cancelScheduledValues(now);
  voice.voiceGain.gain.setValueAtTime(voice.voiceGain.gain.value, now);
  voice.voiceGain.gain.linearRampToValueAtTime(0.0001, now + fadeTime);
  voice.osc1.stop(now + fadeTime + 0.02);
  voice.osc2.stop(now + fadeTime + 0.02);
  voice.cut = true; // mark so onended doesn't clobber UI for the new note
  document.querySelector(`.pad[data-key="${voice.slot}"]`)?.classList.remove('active');
}

function playNote(slot) {
  ensureAudio();
  if (actx.state === 'suspended') actx.resume();

  // fade out any current voice before starting the new one
  if (currentVoice) {
    cutVoice(currentVoice, QUICK_RELEASE);
    currentVoice = null;
  }

  const entry = SCALE[SLOT_INDEX[slot]];
  const freq = midiToFreq(entry.midi);
  const octave = midiToOctave(entry.midi);
  const now = actx.currentTime;

  const osc1 = actx.createOscillator();
  osc1.type = 'sawtooth';
  osc1.frequency.value = freq;

  const osc2 = actx.createOscillator();
  osc2.type = 'square';
  osc2.frequency.value = freq * 1.005;

  const voiceGain = actx.createGain();
  voiceGain.gain.setValueAtTime(0, now);
  voiceGain.gain.linearRampToValueAtTime(0.85, now + 0.022);   // slightly slower pluck attack
  voiceGain.gain.linearRampToValueAtTime(0.55, now + 0.22);    // settle to body
  voiceGain.gain.exponentialRampToValueAtTime(0.0001, now + RING_DURATION);
  voiceGain.gain.setValueAtTime(0, now + RING_DURATION + 0.005);

  const voiceFilter = actx.createBiquadFilter();
  voiceFilter.type = 'lowpass';
  voiceFilter.Q.value = 3.5;
  voiceFilter.frequency.setValueAtTime(700, now);
  voiceFilter.frequency.exponentialRampToValueAtTime(2400, now + 0.08);
  voiceFilter.frequency.exponentialRampToValueAtTime(1100, now + 0.6);

  const mix = actx.createGain();
  mix.gain.value = 0.55;

  osc1.connect(mix);
  osc2.connect(mix);
  mix.connect(voiceFilter);
  voiceFilter.connect(voiceGain);
  voiceGain.connect(masterFilter);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + RING_DURATION + 0.05);
  osc2.stop(now + RING_DURATION + 0.05);

  const voice = {
    osc1, osc2, voiceGain, voiceFilter,
    slot, name: entry.name, octave, deg: entry.deg, cut: false,
  };
  currentVoice = voice;

  paintActive(slot, entry.name + octave, entry.deg);
  burstParticles(slot);

  // when this voice ends naturally, clear UI (unless a newer note has taken over)
  osc1.onended = () => {
    if (currentVoice === voice && !voice.cut) {
      currentVoice = null;
      paintRingEnd(slot);
    }
  };
}

// ---------------------------------------------------------
// rainbow particles
// ---------------------------------------------------------
let pCtx, pCanvas;
const particles = [];

function initParticles() {
  pCanvas = document.getElementById('particles');
  pCtx = pCanvas.getContext('2d');
  requestAnimationFrame(tickParticles);
}

function burstParticles(slot) {
  // emit from the pressed pad's screen center, biased outward
  const pad = document.querySelector(`.pad[data-key="${slot}"]`);
  if (!pad || !pCanvas) return;
  const rect = pad.getBoundingClientRect();
  const canvasRect = pCanvas.getBoundingClientRect();
  // map to canvas internal coords (canvas is 600x600 logical, may be scaled)
  const scaleX = pCanvas.width / canvasRect.width;
  const scaleY = pCanvas.height / canvasRect.height;
  const cx = (rect.left - canvasRect.left + rect.width / 2) * scaleX;
  const cy = (rect.top  - canvasRect.top  + rect.height / 2) * scaleY;

  const count = 36;
  for (let i = 0; i < count; i++) {
    spawnParticle(cx, cy, 1.6 + Math.random() * 3.4);
  }
}

function spawnParticle(cx, cy, speed) {
  const angle = Math.random() * Math.PI * 2;
  const life = 70 + Math.random() * 90;
  const colorIdx = Math.floor(Math.random() * PRISM.length);
  particles.push({
    x: cx + (Math.random() - 0.5) * 8,
    y: cy + (Math.random() - 0.5) * 8,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed - 0.2, // slight upward drift
    size: 1.6 + Math.random() * 2.8,
    life,
    maxLife: life,
    color: PRISM[colorIdx],
  });
}

let trickleAccum = 0;
function tickParticles(t) {
  if (!pCtx) { requestAnimationFrame(tickParticles); return; }

  // trickle while a note is ringing — sparkle emanating from active pad
  if (currentVoice) {
    trickleAccum += 1;
    if (trickleAccum >= 4) {
      trickleAccum = 0;
      const pad = document.querySelector(`.pad[data-key="${currentVoice.slot}"]`);
      if (pad) {
        const rect = pad.getBoundingClientRect();
        const canvasRect = pCanvas.getBoundingClientRect();
        const scaleX = pCanvas.width / canvasRect.width;
        const scaleY = pCanvas.height / canvasRect.height;
        const cx = (rect.left - canvasRect.left + rect.width / 2) * scaleX;
        const cy = (rect.top  - canvasRect.top  + rect.height / 2) * scaleY;
        spawnParticle(cx, cy, 0.5 + Math.random() * 1.8);
        spawnParticle(cx, cy, 0.5 + Math.random() * 1.8);
      }
    }
  }

  pCtx.clearRect(0, 0, pCanvas.width, pCanvas.height);
  pCtx.globalCompositeOperation = 'lighter';

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.985;
    p.vy *= 0.985;
    p.life--;
    if (p.life <= 0) { particles.splice(i, 1); continue; }

    const a = p.life / p.maxLife;
    const r = p.size * (0.35 + 0.65 * a);
    const halo = r * 3.2;
    const [cr, cg, cb] = p.color;

    const grad = pCtx.createRadialGradient(p.x, p.y, 0, p.x, p.y, halo);
    grad.addColorStop(0,    `rgba(${cr},${cg},${cb},${0.85 * a})`);
    grad.addColorStop(0.35, `rgba(${cr},${cg},${cb},${0.40 * a})`);
    grad.addColorStop(1,    `rgba(${cr},${cg},${cb},0)`);
    pCtx.fillStyle = grad;
    pCtx.beginPath();
    pCtx.arc(p.x, p.y, halo, 0, Math.PI * 2);
    pCtx.fill();

    // bright core
    pCtx.fillStyle = `rgba(255,255,255,${0.7 * a})`;
    pCtx.beginPath();
    pCtx.arc(p.x, p.y, Math.max(0.6, r * 0.4), 0, Math.PI * 2);
    pCtx.fill();
  }

  pCtx.globalCompositeOperation = 'source-over';
  requestAnimationFrame(tickParticles);
}

// ---------------------------------------------------------
// scope visualization
// ---------------------------------------------------------
let scopeCtx, scopeW, scopeH;
function startScope() {
  const canvas = document.getElementById('scope');
  scopeCtx = canvas.getContext('2d');
  scopeW = canvas.width;
  scopeH = canvas.height;
  requestAnimationFrame(drawScope);
}
function drawScope() {
  if (!scopeCtx || !analyser) { requestAnimationFrame(drawScope); return; }
  analyser.getByteTimeDomainData(analyserData);

  scopeCtx.clearRect(0, 0, scopeW, scopeH);

  scopeCtx.strokeStyle = 'rgba(106, 86, 135, 0.4)';
  scopeCtx.lineWidth = 1;
  scopeCtx.beginPath();
  scopeCtx.moveTo(0, scopeH / 2);
  scopeCtx.lineTo(scopeW, scopeH / 2);
  scopeCtx.stroke();

  const ringing = !!currentVoice;
  scopeCtx.strokeStyle = ringing ? '#25f4ff' : 'rgba(106, 86, 135, 0.5)';
  scopeCtx.lineWidth = 1.6;
  scopeCtx.shadowColor = ringing ? 'rgba(37, 244, 255, 0.85)' : 'transparent';
  scopeCtx.shadowBlur = ringing ? 6 : 0;
  scopeCtx.beginPath();
  const step = scopeW / analyserData.length;
  for (let i = 0; i < analyserData.length; i++) {
    const v = analyserData[i] / 128.0 - 1;
    const x = i * step;
    const y = scopeH / 2 + v * (scopeH / 2 - 2);
    if (i === 0) scopeCtx.moveTo(x, y);
    else scopeCtx.lineTo(x, y);
  }
  scopeCtx.stroke();
  scopeCtx.shadowBlur = 0;

  requestAnimationFrame(drawScope);
}

// ---------------------------------------------------------
// ui
// ---------------------------------------------------------
function paintActive(slot, fullNote, deg) {
  document.querySelectorAll('.pad.active').forEach((p) => p.classList.remove('active'));
  const pad = document.querySelector(`.pad[data-key="${slot}"]`);
  if (pad) pad.classList.add('active');

  const noteEl = document.getElementById('now-note');
  const subEl  = document.getElementById('now-sub');

  noteEl.textContent = fullNote;
  noteEl.setAttribute('data-text', fullNote);
  subEl.textContent = deg;

  document.querySelector('.stage')?.classList.add('ringing');
}

function paintRingEnd(slot) {
  const pad = document.querySelector(`.pad[data-key="${slot}"]`);
  if (pad) pad.classList.remove('active');
  document.getElementById('now-sub').textContent = 'SILENT';
  document.querySelector('.stage')?.classList.remove('ringing');
}

// ---------------------------------------------------------
// input — press triggers; release is ignored (note rings)
// ---------------------------------------------------------
document.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const slot = SLOT_KEYCODE[e.key];
  if (!slot) return;
  e.preventDefault();
  playNote(slot);
});

document.addEventListener('keyup', (e) => {
  if (SLOT_KEYCODE[e.key]) e.preventDefault(); // swallow so it doesn't scroll
});

// safety: cut ringing note when window loses focus
window.addEventListener('blur', () => {
  if (currentVoice) {
    cutVoice(currentVoice, QUICK_RELEASE);
    currentVoice = null;
    document.getElementById('now-sub').textContent = 'SILENT';
    document.querySelector('.stage')?.classList.remove('ringing');
  }
});

// click/touch on pads (tap = trigger)
document.querySelectorAll('.pad').forEach((pad) => {
  const slot = pad.dataset.key;
  pad.addEventListener('pointerdown', (e) => { e.preventDefault(); playNote(slot); });
});

// kick off the particle canvas loop (runs always, idle until a note plays)
initParticles();
