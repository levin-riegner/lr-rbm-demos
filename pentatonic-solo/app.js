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
  { name: 'B',  midi: 59, deg: '1'  }, // B3
  { name: 'D',  midi: 62, deg: 'b3' }, // D4
  { name: 'E',  midi: 64, deg: '4'  }, // E4
  { name: 'F#', midi: 66, deg: '5'  }, // F#4
  { name: 'A',  midi: 69, deg: 'b7' }, // A4
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
  voiceGain.gain.linearRampToValueAtTime(0.95, now + 0.012);   // fast attack
  voiceGain.gain.linearRampToValueAtTime(0.6,  now + 0.18);    // settle to body
  // long natural ring-out — exponential cannot ramp to 0, so target 0.0001 then set 0
  voiceGain.gain.exponentialRampToValueAtTime(0.0001, now + RING_DURATION);
  voiceGain.gain.setValueAtTime(0, now + RING_DURATION + 0.005);

  const voiceFilter = actx.createBiquadFilter();
  voiceFilter.type = 'lowpass';
  voiceFilter.Q.value = 4;
  voiceFilter.frequency.setValueAtTime(900, now);
  voiceFilter.frequency.exponentialRampToValueAtTime(3200, now + 0.06);
  voiceFilter.frequency.exponentialRampToValueAtTime(1400, now + 0.5);

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

  // when this voice ends naturally, clear UI (unless a newer note has taken over)
  osc1.onended = () => {
    if (currentVoice === voice && !voice.cut) {
      currentVoice = null;
      paintRingEnd(slot);
    }
  };
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
  const ring   = document.getElementById('now-ring');

  noteEl.textContent = fullNote;
  subEl.textContent = deg;
  ring.classList.remove('active');
  void ring.offsetWidth;
  ring.classList.add('active');
}

function paintRingEnd(slot) {
  const pad = document.querySelector(`.pad[data-key="${slot}"]`);
  if (pad) pad.classList.remove('active');
  document.getElementById('now-sub').textContent = 'READY';
  document.getElementById('now-ring').classList.remove('active');
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
    document.getElementById('now-sub').textContent = 'READY';
    document.getElementById('now-ring').classList.remove('active');
  }
});

// click/touch on pads (tap = trigger)
document.querySelectorAll('.pad').forEach((pad) => {
  const slot = pad.dataset.key;
  pad.addEventListener('pointerdown', (e) => { e.preventDefault(); playNote(slot); });
});
