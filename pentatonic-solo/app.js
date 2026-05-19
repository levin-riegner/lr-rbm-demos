/* =========================================================
   PENTATONIC SOLO — B MINOR (Comfortably Numb)
   5 notes of the B minor pentatonic scale mapped to the d-pad:
     ↓  = B  (root,   degree 1)
     ←  = D  (minor 3rd,  b3)
     ↑  = E  (4th,        4)
     →  = F# (5th,        5)
     ⏎  = A  (minor 7th,  b7) — highest
   Hold to sustain.
   ========================================================= */

// Hard-coded B minor pentatonic — name, MIDI note, scale-degree label
const SCALE = [
  { name: 'B',  midi: 59, deg: '1'  }, // B3
  { name: 'D',  midi: 62, deg: 'b3' }, // D4
  { name: 'E',  midi: 64, deg: '4'  }, // E4
  { name: 'F#', midi: 66, deg: '5'  }, // F#4
  { name: 'A',  midi: 69, deg: 'b7' }, // A4
];

// arrow → SCALE index (0..4)
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

// ---------------------------------------------------------
// state
// ---------------------------------------------------------
const state = {
  active: new Map(), // slot -> voice
};

// ---------------------------------------------------------
// audio
// ---------------------------------------------------------
let actx = null;
let masterGain = null;
let masterFilter = null;
let analyser = null;
let analyserData = null;

function ensureAudio() {
  if (actx) return;
  actx = new (window.AudioContext || window.webkitAudioContext)();
  masterFilter = actx.createBiquadFilter();
  masterFilter.type = 'lowpass';
  masterFilter.frequency.value = 2400;
  masterFilter.Q.value = 0.7;

  masterGain = actx.createGain();
  masterGain.gain.value = 0.32;

  analyser = actx.createAnalyser();
  analyser.fftSize = 1024;
  analyserData = new Uint8Array(analyser.frequencyBinCount);

  masterFilter.connect(masterGain);
  masterGain.connect(analyser);
  analyser.connect(actx.destination);

  startScope();
}

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function midiToOctave(midi) {
  return Math.floor(midi / 12) - 1;
}

function startNote(slot) {
  if (state.active.has(slot)) return;
  ensureAudio();
  if (actx.state === 'suspended') actx.resume();

  const entry = SCALE[SLOT_INDEX[slot]];
  const freq = midiToFreq(entry.midi);
  const octave = midiToOctave(entry.midi);

  const now = actx.currentTime;

  // dual-oscillator for richer lead
  const osc1 = actx.createOscillator();
  osc1.type = 'sawtooth';
  osc1.frequency.value = freq;

  const osc2 = actx.createOscillator();
  osc2.type = 'square';
  osc2.frequency.value = freq * 1.005; // slight detune for chorus

  const voiceGain = actx.createGain();
  voiceGain.gain.value = 0;
  voiceGain.gain.linearRampToValueAtTime(0.85, now + 0.012);
  voiceGain.gain.linearRampToValueAtTime(0.55, now + 0.18); // attack→sustain

  const voiceFilter = actx.createBiquadFilter();
  voiceFilter.type = 'lowpass';
  voiceFilter.Q.value = 4;
  // wah-ish filter sweep on attack
  voiceFilter.frequency.setValueAtTime(900, now);
  voiceFilter.frequency.exponentialRampToValueAtTime(3200, now + 0.06);
  voiceFilter.frequency.exponentialRampToValueAtTime(1600, now + 0.4);

  const mix = actx.createGain();
  mix.gain.value = 0.55;

  osc1.connect(mix);
  osc2.connect(mix);
  mix.connect(voiceFilter);
  voiceFilter.connect(voiceGain);
  voiceGain.connect(masterFilter);

  osc1.start(now);
  osc2.start(now);

  state.active.set(slot, {
    osc1, osc2, voiceGain, voiceFilter,
    name: entry.name, octave, deg: entry.deg,
  });

  paintActive(slot, entry.name + octave, entry.deg);
}

function stopNote(slot) {
  const v = state.active.get(slot);
  if (!v) return;
  state.active.delete(slot);

  const now = actx.currentTime;
  v.voiceGain.gain.cancelScheduledValues(now);
  v.voiceGain.gain.setValueAtTime(v.voiceGain.gain.value, now);
  v.voiceGain.gain.linearRampToValueAtTime(0, now + 0.18);
  v.osc1.stop(now + 0.22);
  v.osc2.stop(now + 0.22);

  paintInactive(slot);
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

  scopeCtx.strokeStyle = state.active.size ? '#25f4ff' : 'rgba(106, 86, 135, 0.5)';
  scopeCtx.lineWidth = 1.6;
  scopeCtx.shadowColor = state.active.size ? 'rgba(37, 244, 255, 0.85)' : 'transparent';
  scopeCtx.shadowBlur = state.active.size ? 6 : 0;
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
  const pad = document.querySelector(`.pad[data-key="${slot}"]`);
  if (pad) pad.classList.add('active');

  const noteEl = document.getElementById('now-note');
  const subEl  = document.getElementById('now-sub');
  const ring   = document.getElementById('now-ring');

  noteEl.textContent = fullNote;
  subEl.textContent = deg;
  ring.classList.remove('active');
  void ring.offsetWidth;
  ring.classList.add('active');
}

function paintInactive(slot) {
  const pad = document.querySelector(`.pad[data-key="${slot}"]`);
  if (pad) pad.classList.remove('active');

  if (state.active.size === 0) {
    document.getElementById('now-sub').textContent = 'READY';
    document.getElementById('now-ring').classList.remove('active');
  } else {
    const last = [...state.active.entries()].pop();
    if (last) {
      const [, v] = last;
      document.getElementById('now-note').textContent = v.name + v.octave;
      document.getElementById('now-sub').textContent = v.deg;
    }
  }
}

// ---------------------------------------------------------
// input
// ---------------------------------------------------------
document.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const slot = SLOT_KEYCODE[e.key];
  if (!slot) return;
  e.preventDefault();
  startNote(slot);
});

document.addEventListener('keyup', (e) => {
  const slot = SLOT_KEYCODE[e.key];
  if (!slot) return;
  e.preventDefault();
  stopNote(slot);
});

// safety: stop everything on blur (so no stuck notes)
window.addEventListener('blur', () => {
  [...state.active.keys()].forEach(stopNote);
});

// click/touch on pads
document.querySelectorAll('.pad').forEach((pad) => {
  const slot = pad.dataset.key;
  const press = (e) => { e.preventDefault(); startNote(slot); };
  const release = (e) => { e.preventDefault(); stopNote(slot); };
  pad.addEventListener('pointerdown', press);
  pad.addEventListener('pointerup', release);
  pad.addEventListener('pointerleave', release);
  pad.addEventListener('pointercancel', release);
});
