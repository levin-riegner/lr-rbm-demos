/* Sing Along — local MP3 + LRC synced-lyrics prototype.
   D-pad only: ▲ ▼ ◀ ▶ + Enter. */

const $ = (id) => document.getElementById(id);
const audio = $("audio");

const NUDGE = 0.3; // seconds per ◀ ▶ press while playing
const WINDOW_BEFORE = 2; // lyric lines shown above the current one
const WINDOW_AFTER = 3; // lyric lines shown below

let songs = [];
let state = "home"; // "home" | "sing"
let homeIndex = 0;
let lines = []; // [{time, text}] for the loaded song
let lineIndex = -1;
let offset = 0; // per-song sync offset, persisted
let rafId = null;
let currentSong = null;

/* ---------- LRC parsing ---------- */

function parseLRC(text) {
  const out = [];
  const stampRe = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
  for (const raw of text.split(/\r?\n/)) {
    const stamps = [...raw.matchAll(stampRe)];
    if (!stamps.length) continue;
    const lyric = raw.replace(stampRe, "").trim();
    if (!lyric) continue;
    for (const m of stamps) {
      const frac = m[3] ? Number(("0." + m[3])) : 0;
      out.push({ time: Number(m[1]) * 60 + Number(m[2]) + frac, text: lyric });
    }
  }
  return out.sort((a, b) => a.time - b.time);
}

/* ---------- Home ---------- */

function renderHome() {
  const list = $("song-list");
  list.innerHTML = "";
  songs.forEach((song, i) => {
    const li = document.createElement("li");
    if (i === homeIndex) li.classList.add("selected");
    li.innerHTML = `<span class="title"></span><span class="artist"></span>`;
    li.querySelector(".title").textContent = song.title;
    li.querySelector(".artist").textContent = song.artist;
    list.appendChild(li);
  });
  $("song-count").textContent = `${songs.length} SONG${songs.length === 1 ? "" : "S"}`;
}

function showHome() {
  state = "home";
  stopLoop();
  audio.pause();
  audio.removeAttribute("src");
  $("sing").classList.add("hidden");
  $("home").classList.remove("hidden");
  renderHome();
}

/* ---------- Sing ---------- */

async function openSong(song, autoplay = false) {
  currentSong = song;
  state = "sing";
  $("home").classList.add("hidden");
  $("sing").classList.remove("hidden");
  $("sing-title").textContent = song.title;
  $("sing-artist").textContent = song.artist;
  offset = Number(localStorage.getItem("singalong-offset-" + song.id)) || 0;
  lines = [];
  lineIndex = -1;
  renderLyrics();
  renderOffset();

  try {
    const res = await fetch(song.lrc);
    if (!res.ok) throw new Error(res.status);
    lines = parseLRC(await res.text());
  } catch {
    lines = [];
  }
  if (!lines.length) {
    $("lyrics").innerHTML = `<div class="empty">No synced lyrics found (${song.lrc})</div>`;
  }

  audio.src = song.audio;
  audio.load();
  renderLyrics();
  setHint();
  if (autoplay) play();
}

function play() {
  audio.play().then(() => {
    startLoop();
    setHint();
  }).catch(() => setHint("Enter play"));
}

function pause() {
  audio.pause();
  stopLoop();
  setHint();
}

function setHint(text) {
  $("sing-hint").textContent =
    text ??
    (audio.paused
      ? "Enter play · ▲ ▼ line · ◀ songs"
      : "Enter pause · ▲ ▼ line · ◀ ▶ sync");
}

function currentLineFor(t) {
  let idx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].time <= t) idx = i;
    else break;
  }
  return idx;
}

function tick() {
  const t = audio.currentTime + offset;
  const idx = currentLineFor(t);
  if (idx !== lineIndex) {
    lineIndex = idx;
    renderLyrics();
  }
  renderTime();
  if (!audio.paused && !audio.ended) {
    rafId = requestAnimationFrame(tick);
  } else if (audio.ended) {
    stopLoop();
    setHint("Enter replay · ◀ songs");
  }
}

function startLoop() {
  stopLoop();
  rafId = requestAnimationFrame(tick);
}

function stopLoop() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
}

function renderLyrics() {
  if (!lines.length) return;
  const box = $("lyrics");
  box.innerHTML = "";
  const from = lineIndex - WINDOW_BEFORE;
  const to = lineIndex + WINDOW_AFTER;
  for (let i = from; i <= to; i++) {
    const div = document.createElement("div");
    div.className = "line";
    if (i === lineIndex) div.classList.add("current");
    else if (Math.abs(i - lineIndex) > 1) div.classList.add("far");
    div.textContent = lines[i] ? lines[i].text : " ";
    if (i === lineIndex && lineIndex === -1) div.textContent = "♪";
    box.appendChild(div);
  }
}

function fmt(s) {
  if (!isFinite(s)) return "0:00";
  s = Math.max(0, Math.floor(s));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function renderTime() {
  $("t-cur").textContent = fmt(audio.currentTime);
  $("t-dur").textContent = fmt(audio.duration);
  const pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
  $("progress-fill").style.width = pct + "%";
}

function renderOffset() {
  $("offset-badge").textContent =
    offset === 0 ? "" : `sync ${offset > 0 ? "+" : ""}${offset.toFixed(1)}s`;
}

function nudge(delta) {
  offset = Math.round((offset + delta) * 10) / 10;
  localStorage.setItem("singalong-offset-" + currentSong.id, String(offset));
  renderOffset();
  lineIndex = -2; // force re-render on next tick
  if (audio.paused) tick();
}

function jumpLine(delta) {
  if (!lines.length) return;
  const target = Math.min(lines.length - 1, Math.max(0, (lineIndex < 0 ? 0 : lineIndex) + delta));
  audio.currentTime = Math.max(0, lines[target].time - offset);
  lineIndex = -2;
  tick0();
}

// One synchronous catch-up frame (used while paused, when no rAF loop runs).
function tick0() {
  const idx = currentLineFor(audio.currentTime + offset);
  lineIndex = idx;
  renderLyrics();
  renderTime();
}

/* ---------- Input ---------- */

document.addEventListener("keydown", (e) => {
  const k = e.key;
  if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter"].includes(k)) return;
  e.preventDefault();

  if (state === "home") {
    if (k === "ArrowUp") homeIndex = (homeIndex - 1 + songs.length) % songs.length;
    if (k === "ArrowDown") homeIndex = (homeIndex + 1) % songs.length;
    if (k === "Enter" && songs[homeIndex]) return openSong(songs[homeIndex], true);
    renderHome();
    return;
  }

  // state === "sing"
  if (k === "Enter") {
    if (audio.ended) audio.currentTime = 0;
    audio.paused ? play() : pause();
  } else if (k === "ArrowUp") {
    jumpLine(-1);
  } else if (k === "ArrowDown") {
    jumpLine(1);
  } else if (k === "ArrowLeft") {
    if (audio.paused) showHome();
    else nudge(-NUDGE);
  } else if (k === "ArrowRight") {
    if (audio.paused) play();
    else nudge(NUDGE);
  }
});

/* ---------- Boot + ?state= routing ---------- */

async function boot() {
  try {
    songs = await (await fetch("songs.json")).json();
  } catch {
    songs = [];
  }
  const params = new URLSearchParams(location.search);
  const wanted = params.get("state");
  const songId = params.get("song");
  if (wanted === "sing") {
    const song = songs.find((s) => s.id === songId) || songs[0];
    if (song) return openSong(song, false);
  }
  showHome();
}

boot();
