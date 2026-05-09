// ──────────────────────────────────────────────────────────────────
// ZORK I — engine, parser, CRT terminal UI, typewriter, chip input
// ──────────────────────────────────────────────────────────────────

const $ = (sel) => document.querySelector(sel);
const outputEl    = $("#output");
const statusLoc   = $("#status-loc");
const statusMeta  = $("#status-meta");
const chipBar     = $("#chipbar");
const primaryRow  = $("#primary-row");
const secondaryRow= $("#secondary-row");
const morePanel   = $("#more-panel");
const moreList    = $("#mp-list");
const mpClose     = $("#mp-close");

let state = makeInitialState();
let lastCommand = "";


// ── audio context (synthesized SFX, no audio files) ──────────

let audioCtx = null;
let masterGain = null;
let audioMuted = false;
let lastTickAt = 0;

function ensureAudio() {
  if (audioCtx) {
    if (audioCtx.state === "suspended") audioCtx.resume();
    return;
  }
  try {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    audioCtx = new C();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.30;
    masterGain.connect(audioCtx.destination);
  } catch (e) { audioCtx = null; }
}

function setMute(m) {
  audioMuted = m;
  const btn = document.getElementById("mute-btn");
  if (btn) {
    btn.innerHTML = m ? "&#128263;" : "&#128266;"; // 🔇 / 🔊
    btn.classList.toggle("muted", m);
  }
}

function tone({ freq = 880, dur = 0.08, type = "sine", vol = 0.3, slide = null, attack = 0.005 } = {}) {
  if (!audioCtx || audioMuted) return;
  const t = audioCtx.currentTime;
  const o = audioCtx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  o.connect(g).connect(masterGain);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noiseBurst({ dur = 0.12, freq = 600, q = 0.7, vol = 0.6 } = {}) {
  if (!audioCtx || audioMuted) return;
  const t = audioCtx.currentTime;
  const buf = audioCtx.createBuffer(1, Math.floor(audioCtx.sampleRate * dur), audioCtx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) {
    d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  }
  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  const filt = audioCtx.createBiquadFilter();
  filt.type = "bandpass";
  filt.frequency.value = freq;
  filt.Q.value = q;
  const g = audioCtx.createGain();
  g.gain.value = vol;
  src.connect(filt).connect(g).connect(masterGain);
  src.start(t);
}

function sfxTick() {
  // Throttle so we don't queue too many oscillators per second.
  const now = performance.now();
  if (now - lastTickAt < 18) return;
  lastTickAt = now;
  tone({ freq: 1700 + Math.random() * 240, dur: 0.012, type: "square", vol: 0.07, attack: 0.001 });
}
function sfxChip() {
  tone({ freq: 720, dur: 0.06, type: "square", vol: 0.22, slide: 540 });
}
function sfxBegin() {
  tone({ freq: 440, dur: 0.10, type: "square", vol: 0.28 });
  setTimeout(() => tone({ freq: 660, dur: 0.14, type: "square", vol: 0.28 }), 80);
}
function sfxBoot() {
  tone({ freq: 80, dur: 0.45, type: "square", vol: 0.18, slide: 2400 });
}
function sfxAward() {
  tone({ freq: 660, dur: 0.07, type: "triangle", vol: 0.28 });
  setTimeout(() => tone({ freq: 990, dur: 0.13, type: "triangle", vol: 0.28 }), 70);
}
function sfxHit() {
  noiseBurst({ dur: 0.18, freq: 380, q: 0.6, vol: 0.55 });
  tone({ freq: 120, dur: 0.12, type: "square", vol: 0.25, slide: 60 });
}
function sfxMiss() {
  noiseBurst({ dur: 0.10, freq: 1200, q: 1.2, vol: 0.18 });
}
function sfxDeath() {
  tone({ freq: 440, dur: 1.1, type: "sawtooth", vol: 0.36, slide: 40 });
  setTimeout(() => noiseBurst({ dur: 0.45, freq: 200, q: 0.5, vol: 0.4 }), 60);
}
function sfxVictory() {
  const notes = [523, 659, 784, 1047];
  notes.forEach((f, i) => setTimeout(() => tone({ freq: f, dur: 0.18, type: "triangle", vol: 0.32 }), i * 110));
}
function sfxOpen() { tone({ freq: 380, dur: 0.10, type: "triangle", vol: 0.28, slide: 540 }); }
function sfxTake() { tone({ freq: 880, dur: 0.07, type: "triangle", vol: 0.22 }); }
function sfxEnter() {
  tone({ freq: 200, dur: 0.18, type: "square", vol: 0.22, slide: 480 });
}


// ── typewriter queue ──────────────────────────────────────────

const printQueue = [];
let printing = false;
let pumpScheduled = false;
let skipRequested = false;

const TW_SPEED_FAST = 4;   // ms/char during normal output
const TW_SPEED_TITLE = 0;  // titles are instant

function println(text = "") {
  printQueue.push({ kind: "line", text: String(text) });
  schedulePump();
}

function printlnHTML(html) {
  printQueue.push({ kind: "html", html });
  schedulePump();
}

function printEcho(cmd) {
  printQueue.push({ kind: "echo", text: String(cmd) });
  schedulePump();
}

// Batch synchronous queue pushes into a single pump cycle, so renderChips
// only runs after the full burst of output has been printed.
function schedulePump() {
  if (printing || pumpScheduled) return;
  pumpScheduled = true;
  Promise.resolve().then(() => {
    pumpScheduled = false;
    pump();
  });
}

function clearOutput() {
  outputEl.innerHTML = "";
}

async function pump() {
  if (printing) return;
  printing = true;
  chipBar.classList.add("disabled");

  while (printQueue.length) {
    const item = printQueue.shift();
    if (item.kind === "html") {
      const div = document.createElement("div");
      div.className = "line";
      div.innerHTML = item.html;
      outputEl.appendChild(div);
      scrollToBottom();
    } else if (item.kind === "echo") {
      const div = document.createElement("div");
      div.className = "line echo";
      div.textContent = item.text;
      outputEl.appendChild(div);
      scrollToBottom();
    } else {
      await typewriteLine(item.text);
    }
  }

  printing = false;
  skipRequested = false;
  chipBar.classList.remove("disabled");
  renderChips();
}

// Uses MessageChannel to dodge background-tab setTimeout throttling, and
// progresses by elapsed real time rather than tick count — feels smooth at
// any frame rate.
function typewriteLine(text) {
  const div = document.createElement("div");
  div.className = "line typing";
  outputEl.appendChild(div);
  scrollToBottom();
  const charsPerSec = 220;  // quick — about 4.5ms/char
  const t0 = performance.now();
  let i = 0;
  return new Promise((resolve) => {
    const ch = new MessageChannel();
    ch.port1.onmessage = () => {
      if (skipRequested) {
        div.textContent = text;
        div.classList.remove("typing");
        scrollToBottom();
        resolve();
        return;
      }
      const elapsed = performance.now() - t0;
      const newI = Math.min(text.length, Math.floor(elapsed * charsPerSec / 1000));
      if (newI > i) sfxTick();
      i = newI;
      div.textContent = text.slice(0, i);
      scrollToBottom();
      if (i >= text.length) {
        div.classList.remove("typing");
        resolve();
        return;
      }
      ch.port2.postMessage(0);
    };
    ch.port2.postMessage(0);
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function scrollToBottom() { outputEl.scrollTop = outputEl.scrollHeight; }


// Tap-anywhere-to-skip the typewriter
document.addEventListener("click", (e) => {
  if (!printing) return;
  // Don't treat clicks on chips/buttons as skip
  if (e.target.closest(".chip") || e.target.closest(".mp-close")) return;
  skipRequested = true;
});


// ── status bar ─────────────────────────────────────────────────

function updateStatus() {
  const r = ROOMS[state.location];
  statusLoc.textContent = (r ? r.short : "—").toUpperCase();
  statusMeta.textContent = `SCORE: ${state.score}/350  MOVES: ${state.moves}`;
}


// ── world helpers ──────────────────────────────────────────────

function room() { return ROOMS[state.location]; }
function carrying(id) { return state.inventory.includes(id); }
function canSee(id) {
  if (carrying(id)) return true;
  if ((room().items || []).includes(id)) return true;
  for (const cid in state.items) {
    const it = state.items[cid];
    if (!it.contains || it.closed) continue;
    if (it.contains.includes(id) && (carrying(cid) || (room().items || []).includes(cid))) return true;
  }
  return false;
}

function describeRoom(_force = false) {
  const r = room();
  if (r.dark && !(carrying("lantern") && state.flags.lanternOn)) {
    if (state.flags.enteredCellar) {
      println("It is pitch black. You are likely to be eaten by a grue.");
      return;
    }
  }
  printlnHTML(`<span class="title-line">${escapeHTML(r.short)}</span>`);
  const desc = typeof r.desc === "function" ? r.desc(state)
             : (r.desc && r.desc.dyn ? r.desc.dyn(state) : r.desc);
  println(desc);
  const items = (r.items || []);
  for (const id of items) {
    const def = ITEMS[id];
    if (def.fixed) continue;
    if (id === "egg") continue;
    println(`There is ${def.article} ${def.short} here.`);
  }
  if (items.includes("mailbox") && !state.items.mailbox.closed && state.items.mailbox.contains.length) {
    println("The mailbox contains:");
    for (const sub of state.items.mailbox.contains) println("  " + capitalize(ITEMS[sub].article) + " " + ITEMS[sub].short);
  }
  if (items.includes("nest") && state.items.nest.contains.includes("egg")) {
    println("In the bird's nest is a large egg encrusted with precious jewels.");
  }
  if (items.includes("sack") && !state.items.sack.closed && state.items.sack.contains.length) {
    println("The brown sack contains:");
    for (const sub of state.items.sack.contains) println("  " + capitalize(ITEMS[sub].article) + " " + ITEMS[sub].short);
  }
  if (items.includes("trophy_case") && state.items.trophy_case.contains.length) {
    println("The trophy case contains:");
    for (const sub of state.items.trophy_case.contains) println("  " + capitalize(ITEMS[sub].article) + " " + ITEMS[sub].short);
  }
}


// ── parser ─────────────────────────────────────────────────────

const DIRS = {
  n: "north", s: "south", e: "east", w: "west",
  ne: "northeast", nw: "northwest", se: "southeast", sw: "southwest",
  u: "up", d: "down",
  north:"north", south:"south", east:"east", west:"west",
  northeast:"northeast", northwest:"northwest",
  southeast:"southeast", southwest:"southwest",
  up:"up", down:"down", in:"in", out:"out", enter:"in",
};

const VERB_ALIASES = {
  l: "look", look: "look",
  i: "inventory", inv: "inventory", inventory: "inventory",
  x: "examine", examine: "examine", inspect: "examine", "look-at": "examine",
  take: "take", get: "take", grab: "take", pick: "take",
  drop: "drop", put: "put",
  open: "open", close: "close",
  read: "read",
  light: "light", "turn-on": "light",
  extinguish: "extinguish", "turn-off": "extinguish",
  attack: "attack", kill: "attack", hit: "attack", fight: "attack",
  move: "move", push: "move",
  climb: "climb",
  enter: "enter",
  eat: "eat", drink: "drink",
  wait: "wait", z: "wait",
  again: "again", g: "again",
  score: "score",
  save: "save", restore: "restore", load: "restore",
  quit: "quit", q: "quit",
  restart: "restart",
  verbose: "verbose", brief: "brief",
  diagnose: "diagnose",
  yes: "yes", y: "yes",
  no: "no",
  help: "help",
  about: "about",
};

const STOP_WORDS = new Set(["the", "a", "an", "to", "at", "on", "into"]);
const PREPS = new Set(["with", "in", "into", "from", "on", "under", "using", "inside"]);

function tokenize(input) {
  let s = input.trim().toLowerCase();
  s = s.replace(/\bturn\s+on\b/g, "turn-on");
  s = s.replace(/\bturn\s+off\b/g, "turn-off");
  s = s.replace(/\bpick\s+up\b/g, "take");
  s = s.replace(/\blook\s+at\b/g, "look-at");
  s = s.replace(/\blook\s+inside\b/g, "look-at");
  s = s.replace(/\bgo\s+/g, "");
  s = s.replace(/[,;.!?]/g, " ");
  return s.split(/\s+/).filter(t => t && !STOP_WORDS.has(t));
}

function resolveItem(noun) {
  if (!noun) return null;
  if (ITEMS[noun]) return noun;
  const SYN = {
    "box":"mailbox","mail":"mailbox",
    "letter":"leaflet","advertisement":"leaflet","pamphlet":"leaflet",
    "case":"trophy_case","trophy":"trophy_case",
    "carpet":"rug",
    "trap":"trapdoor","trapdoor":"trapdoor","door":"trapdoor",
    "lamp":"lantern","torch":"lantern","light":"lantern",
    "egg":"egg","jewel":"egg","jewels":"egg",
    "bird":"nest","nest":"nest",
    "leaf":"leaves","leaves":"leaves","pile":"leaves",
    "blade":"sword",
    "knife":"knife","dagger":"knife",
    "rope":"rope","coil":"rope",
    "bottle":"bottle","glass":"bottle",
    "water":"water","liquid":"water",
    "sack":"sack","bag":"sack",
    "garlic":"garlic","clove":"garlic",
    "lunch":"lunch","sandwich":"lunch","food":"lunch",
    "table":"table",
    "window":"window","windows":"window",
    "axe":"axe",
    "coins":"coins","pouch":"coins","gold":"coins","money":"coins",
    "painting":"painting","art":"painting","picture":"painting",
    "troll":"troll",
  };
  if (SYN[noun]) return SYN[noun];
  for (const id in ITEMS) {
    const it = ITEMS[id];
    if (it.short && it.short.toLowerCase().includes(noun)) return id;
    if (it.name && it.name.toLowerCase().includes(noun)) return id;
  }
  return null;
}

function parseAndExecute(rawInput) {
  let input = rawInput.trim();
  if (!input) return;
  printEcho(input);
  if (state.flags.gameOver) {
    if (/^restart$/i.test(input)) { cmdRestart(); return; }
    println("The game is over. Tap RESTART to begin again.");
    return;
  }
  if (/^again$|^g$/i.test(input)) {
    if (!lastCommand) { println("You haven't done anything yet."); return; }
    return parseAndExecute(lastCommand);
  }
  lastCommand = input;
  state.moves++;

  const tokens = tokenize(input);
  if (tokens.length === 0) { println("I beg your pardon?"); return; }

  if (tokens.length === 1) {
    const t = tokens[0];
    if (DIRS[t] && t !== "no") return doMove(DIRS[t]);
    const v = VERB_ALIASES[t];
    if (v) return doVerb(v, [], tokens);
    println("I don't know the word \"" + t + "\".");
    return;
  }
  const v0 = VERB_ALIASES[tokens[0]] || tokens[0];
  if (DIRS[tokens[0]] && tokens.length === 1) return doMove(DIRS[tokens[0]]);
  let preposition = null, noun2 = null;
  let nounTokens = tokens.slice(1);
  for (let i = 0; i < nounTokens.length; i++) {
    if (PREPS.has(nounTokens[i])) {
      preposition = nounTokens[i];
      noun2 = nounTokens.slice(i + 1).join(" ").trim() || null;
      nounTokens = nounTokens.slice(0, i);
      break;
    }
  }
  const noun = nounTokens.join(" ").trim() || null;
  doVerb(v0, [noun, preposition, noun2].filter(x => x !== null), tokens);
}

// ── verb dispatcher ────────────────────────────────────────────

function doVerb(verb, args) {
  switch (verb) {
    case "look":   return cmdLook(args);
    case "examine":return cmdExamine(args);
    case "inventory": return cmdInventory();
    case "take":   return cmdTake(args);
    case "drop":   return cmdDrop(args);
    case "open":   return cmdOpen(args);
    case "close":  return cmdClose(args);
    case "read":   return cmdRead(args);
    case "light":  return cmdLight(args);
    case "extinguish": return cmdExtinguish(args);
    case "attack": return cmdAttack(args);
    case "move":   return cmdMove(args);
    case "climb":  return cmdClimb(args);
    case "enter":  return cmdEnter(args);
    case "eat":    return cmdEat(args);
    case "drink":  return cmdDrink(args);
    case "put":    return cmdPut(args);
    case "wait":   return cmdWait();
    case "score":  return cmdScore();
    case "quit":   return cmdQuit();
    case "restart":return cmdRestart();
    case "verbose":state.flags.verbose = true; println("Maximum verbosity."); return;
    case "brief":  state.flags.verbose = false; println("Brief descriptions."); return;
    case "diagnose": return cmdDiagnose();
    case "yes":    println("That was a rhetorical question."); return;
    case "no":     println("Suit yourself."); return;
    case "help":   return cmdHelp();
    case "about":  return cmdAbout();
    default:
      if (DIRS[verb]) return doMove(DIRS[verb]);
      println("I don't know the word \"" + verb + "\".");
  }
}

// ── movement ───────────────────────────────────────────────────

function doMove(dir) {
  const r = room();
  if (r.dark && !(carrying("lantern") && state.flags.lanternOn)) {
    state.flags.darkMoves++;
    if (state.flags.darkMoves >= 2) {
      sfxDeath();
      println("Oh, no! You have walked into the slavering fangs of a lurking grue!");
      println("");
      println("    *** You have died ***");
      println("");
      gameOver(false);
      updateStatus();
      return;
    }
    println("It is pitch black. You are likely to be eaten by a grue.");
    updateStatus();
    return;
  }
  const exit = r.exits ? r.exits[dir] : null;
  if (!exit) { println("You can't go that way."); updateStatus(); return; }
  let dest = exit;
  if (typeof exit === "object") {
    if (exit.dyn) dest = exit.dyn(state);
    if (dest && dest.msg !== undefined) { println(dest.msg); updateStatus(); return; }
  }
  if (typeof dest !== "string") { println("You can't go that way."); updateStatus(); return; }

  if (state.location === "living_room" && dest === "cellar") {
    state.location = "cellar";
    if (!state.flags.a_enteredCellar) award(10, "a_enteredCellar");
    state.flags.enteredCellar = true;
    state.flags.darkMoves = 0;
    println("You descend the staircase into the cellar.");
    if (!state.flags.visited[dest]) state.flags.visited[dest] = true;
    describeRoom(); updateStatus(); return;
  }
  state.location = dest;
  state.flags.darkMoves = 0;
  if (dest === "kitchen" && !state.flags.a_enteredHouse) award(5, "a_enteredHouse");
  const justVisited = !!state.flags.visited[dest];
  state.flags.visited[dest] = true;
  if (state.flags.verbose || !justVisited) describeRoom();
  else printlnHTML(`<span class="title-line">${escapeHTML(room().short)}</span>`);
  updateStatus();
}

// ── verb implementations ──────────────────────────────────────

function cmdLook() { describeRoom(true); }

function cmdInventory() {
  if (state.inventory.length === 0) { println("You are empty-handed."); return; }
  println("You are carrying:");
  for (const id of state.inventory) {
    const it = ITEMS[id];
    let line = "  " + capitalize(it.article) + " " + it.short;
    if (id === "lantern" && state.flags.lanternOn) line += " (providing light)";
    println(line);
  }
}

function cmdExamine(args) {
  const noun = args[0];
  if (!noun) { println("Examine what?"); return; }
  if (noun === "self" || noun === "me" || noun === "myself") { println("That's difficult unless your eyes are prehensile."); return; }
  const id = resolveItem(noun);
  if (!id || !canSee(id)) { println("You can't see any " + noun + " here."); return; }
  const def = ITEMS[id];
  if (id === "nest") {
    if (state.items.nest.contains.includes("egg")) println("In the bird's nest is a large egg encrusted with precious jewels.");
    else println("The bird's nest, made of woven twigs, is empty now that you've removed the egg.");
    return;
  }
  if (typeof def.examine === "function") println(def.examine(state));
  else println("You see nothing special about the " + def.short + ".");
}

function cmdTake(args) {
  let noun = args[0];
  if (!noun) { println("Take what?"); return; }
  if (noun === "all") return takeAll();
  const id = resolveItem(noun);
  if (!id) { println("You can't see any " + noun + " here."); return; }
  if (carrying(id)) { println("You already have that."); return; }
  if (id === "trapdoor") { println("The trap door cannot be moved."); return; }
  if (ITEMS[id].fixed) { println("That can't be taken."); return; }
  if (id === "egg" && state.items.nest.contains.includes("egg")) {
    state.items.nest.contains = state.items.nest.contains.filter(x => x !== "egg");
    state.inventory.push("egg");
    if (!state.flags.a_tookEgg) award(5, "a_tookEgg");
    sfxTake(); println("Taken."); return;
  }
  if (id === "axe" && state.flags.trollDead) { state.inventory.push("axe"); removeFromRoom("troll_room", "axe"); println("Taken."); return; }
  if (id === "axe" && !state.flags.trollDead) { println("The troll spits in your face, grunts contemptuously, and turns away."); return; }
  if (id === "coins" && state.flags.coinsRevealed) {
    if (!(room().items || []).includes("coins")) { println("You can't see any coins here."); return; }
    removeFromRoom(state.location, "coins"); state.inventory.push("coins");
    if (!state.flags.a_tookCoins) award(5, "a_tookCoins");
    sfxTake(); println("Taken."); return;
  }
  if (id === "painting") {
    if (!(room().items || []).includes("painting")) { println("You can't see any painting here."); return; }
    removeFromRoom(state.location, "painting"); state.inventory.push("painting");
    if (!state.flags.a_tookPainting) award(5, "a_tookPainting");
    sfxTake(); println("Taken."); return;
  }
  if (id === "leaflet" && state.items.mailbox.contains.includes("leaflet")) {
    state.items.mailbox.contains = state.items.mailbox.contains.filter(x => x !== "leaflet");
    state.inventory.push("leaflet"); println("Taken."); return;
  }
  if (id === "garlic" && state.items.sack.contains.includes("garlic")) {
    if (state.items.sack.closed) { println("The brown sack is closed."); return; }
    state.items.sack.contains = state.items.sack.contains.filter(x => x !== "garlic");
    state.inventory.push("garlic"); println("Taken."); return;
  }
  if (id === "lunch" && state.items.sack.contains.includes("lunch")) {
    if (state.items.sack.closed) { println("The brown sack is closed."); return; }
    state.items.sack.contains = state.items.sack.contains.filter(x => x !== "lunch");
    state.inventory.push("lunch"); println("Taken."); return;
  }
  if (id === "water") { println("The water slips through your fingers."); return; }
  if (id === "sword") {
    if (!(room().items || []).includes("sword")) { println("You can't see any sword here."); return; }
    removeFromRoom(state.location, "sword"); state.inventory.push("sword");
    if (!state.flags.a_tookSword) award(2, "a_tookSword");
    sfxTake(); println("Taken."); return;
  }
  if (id === "lantern") {
    if (!(room().items || []).includes("lantern")) { println("You can't see any lantern here."); return; }
    removeFromRoom(state.location, "lantern"); state.inventory.push("lantern");
    if (!state.flags.a_tookLantern) award(2, "a_tookLantern");
    sfxTake(); println("Taken."); return;
  }
  if ((room().items || []).includes(id)) {
    removeFromRoom(state.location, id); state.inventory.push(id); println("Taken."); return;
  }
  println("You can't see any " + noun + " here.");
}

function takeAll() {
  const targets = (room().items || []).filter(id => !ITEMS[id].fixed);
  if (targets.length === 0) { println("There is nothing here to take."); return; }
  for (const id of targets) {
    const def = ITEMS[id];
    state.inventory.push(id); removeFromRoom(state.location, id);
    println(capitalize(def.short) + ": Taken.");
    if (id === "sword" && !state.flags.a_tookSword) award(2, "a_tookSword");
    if (id === "lantern" && !state.flags.a_tookLantern) award(2, "a_tookLantern");
    if (id === "coins" && !state.flags.a_tookCoins) award(5, "a_tookCoins");
    if (id === "painting" && !state.flags.a_tookPainting) award(5, "a_tookPainting");
  }
}

function removeFromRoom(rid, iid) { const r = ROOMS[rid]; if (r && r.items) r.items = r.items.filter(x => x !== iid); }
function addToRoom(rid, iid) { const r = ROOMS[rid]; if (!r.items) r.items = []; if (!r.items.includes(iid)) r.items.push(iid); }

function cmdDrop(args) {
  const id = resolveItem(args[0]);
  if (!id || !carrying(id)) { println("You aren't carrying that."); return; }
  state.inventory = state.inventory.filter(x => x !== id);
  addToRoom(state.location, id); println("Dropped.");
}

function cmdOpen(args) {
  const id = resolveItem(args[0]);
  if (!id || !canSee(id)) { println("You don't see that here."); return; }
  if (id === "mailbox") {
    if (!state.items.mailbox.closed) { println("It is already open."); return; }
    state.items.mailbox.closed = false;
    if (!state.flags.a_openMailbox) award(1, "a_openMailbox");
    sfxOpen();
    if (state.items.mailbox.contains.length) println("Opening the small mailbox reveals a leaflet.");
    else println("Opened.");
    return;
  }
  if (id === "window") {
    if (state.flags.windowOpen) { println("It is already open."); return; }
    state.flags.windowOpen = true;
    sfxOpen();
    println("With great effort, you open the window far enough to allow entry.");
    return;
  }
  if (id === "trapdoor") {
    if (!state.flags.rugMoved) { println("You can't see any trap door here."); return; }
    if (state.flags.trapdoorOpen) { println("It is already open."); return; }
    state.flags.trapdoorOpen = true;
    sfxOpen();
    if (!state.flags.a_openedTrap) award(5, "a_openedTrap");
    println("The door reluctantly opens to reveal a rickety staircase descending into darkness.");
    return;
  }
  if (id === "sack") {
    if (!state.items.sack.closed) { println("It is already open."); return; }
    state.items.sack.closed = false;
    println("Opening the brown sack reveals a clove of garlic, and a lunch.");
    return;
  }
  if (id === "bottle") {
    if (!state.items.bottle.closed) { println("It is already open."); return; }
    state.items.bottle.closed = false; println("Opened."); return;
  }
  if (id === "egg") { println("The egg is too delicate. You'll need a more careful tool than your hands."); return; }
  if (id === "trophy_case") { println("The trophy case is open."); return; }
  println("You can't open that.");
}

function cmdClose(args) {
  const id = resolveItem(args[0]);
  if (!id || !canSee(id)) { println("You don't see that here."); return; }
  if (id === "mailbox") {
    if (state.items.mailbox.closed) { println("It is already closed."); return; }
    state.items.mailbox.closed = true; println("Closed."); return;
  }
  if (id === "window") { state.flags.windowOpen = false; println("The window closes (more easily than it opened)."); return; }
  if (id === "trapdoor") {
    if (!state.flags.trapdoorOpen) { println("It is already closed."); return; }
    state.flags.trapdoorOpen = false; println("The trap door swings shut."); return;
  }
  if (id === "sack") { state.items.sack.closed = true; println("Closed."); return; }
  if (id === "bottle") { state.items.bottle.closed = true; println("Closed."); return; }
  println("You can't close that.");
}

function cmdRead(args) {
  const id = resolveItem(args[0]);
  if (!id || !canSee(id)) { println("You don't see that here."); return; }
  if (id === "leaflet") {
    if (!state.flags.a_readLeaflet) award(1, "a_readLeaflet");
    println("  WELCOME TO ZORK!");
    println("");
    println("  ZORK is a game of adventure, danger, and low cunning. In it you will explore some of the most amazing territory ever seen by mortals. No computer should be without one!");
    return;
  }
  if (id === "painting") { println("The painting is unsigned."); return; }
  println("There's nothing written on it.");
}

function cmdLight(args) {
  const id = resolveItem(args[0]);
  if (id !== "lantern") { println("You can't light that."); return; }
  if (!carrying("lantern")) { println("You don't have the lantern."); return; }
  if (state.flags.lanternOn) { println("The lantern is already on."); return; }
  state.flags.lanternOn = true;
  if (!state.flags.a_litLantern) award(2, "a_litLantern");
  println("The brass lantern is now on.");
  if (room().dark) describeRoom();
}

function cmdExtinguish(args) {
  const id = resolveItem(args[0]);
  if (id !== "lantern") { println("You can't extinguish that."); return; }
  if (!state.flags.lanternOn) { println("The lantern is not lit."); return; }
  state.flags.lanternOn = false; println("The brass lantern is now off.");
}

function cmdAttack(args) {
  const target = resolveItem(args[0]);
  let weapon = null;
  if (args.length >= 3) weapon = resolveItem(args[2]);
  if (!target) { println("Attack what?"); return; }
  if (target !== "troll") { println("That would be a futile gesture."); return; }
  if (!(room().items || []).includes("troll") && !state.flags.trollDead) { println("There is no troll here."); return; }
  if (state.flags.trollDead) { println("The troll is already dead."); return; }
  if (!weapon) { println("Trying to attack the troll with your bare hands is suicidal."); return; }
  if (weapon !== "sword" && weapon !== "knife" && weapon !== "axe") {
    println("Trying to attack the troll with " + (ITEMS[weapon] ? ITEMS[weapon].short : "that") + " is a losing proposition."); return;
  }
  if (!carrying(weapon)) { println("You're not carrying the " + ITEMS[weapon].short + "."); return; }
  const lands = (weapon === "sword") ? true : Math.random() < 0.55;
  if (lands) {
    sfxHit();
    state.trollHp--;
    if (state.trollHp <= 0) {
      state.flags.trollDead = true;
      removeFromRoom("troll_room", "troll");
      addToRoom("troll_room", "axe");
      addToRoom("troll_room", "coins");
      state.flags.coinsRevealed = true;
      if (!state.flags.a_killedTroll) award(15, "a_killedTroll");
      println("The troll, defeated, drops his axe and a leather pouch of coins.");
      println("He dies before your eyes, fading slowly into the darkness.");
      return;
    }
    println(pick([
      "Your blade nicks the troll's hide.",
      "A good slash — the troll grunts in pain.",
      "Your sword bites deep. The troll bleeds freely now.",
      "You connect solidly. The troll staggers.",
    ]));
  } else {
    sfxMiss();
    println(pick([
      "The troll parries your blow with a deft twist of his axe.",
      "You miss; the troll roars and swings, also missing.",
      "Your stroke goes wide. The troll laughs.",
    ]));
  }
}
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function cmdMove(args) {
  const id = resolveItem(args[0]);
  if (!id || !canSee(id)) { println("You don't see that here."); return; }
  if (id === "rug") {
    if (state.flags.rugMoved) { println("Having moved the rug previously, you find it impossible to move it again."); return; }
    state.flags.rugMoved = true;
    addToRoom("living_room", "trapdoor");
    if (!state.flags.a_movedRug) award(5, "a_movedRug");
    println("With a great effort, the rug is moved to one side of the room, revealing the dusty cover of a closed trap door.");
    return;
  }
  if (id === "leaves") { state.flags.leavesMoved = true; println("In disturbing the pile of leaves, a grating is revealed."); return; }
  println("You can't move that.");
}

function cmdClimb(args) {
  const noun = args[0];
  if (!noun) return doMove("up");
  if (noun === "up") return doMove("up");
  if (noun === "down") return doMove("down");
  if (noun === "tree" && state.location === "forest_path") return doMove("up");
  if (noun === "tree") { println("There is no tree here to climb."); return; }
  if (noun === "rope") { println("The rope hangs slack — you'll need to tie it to something first."); return; }
  println("You can't climb that.");
}

function cmdEnter(args) {
  const noun = args[0];
  if (!noun) return doMove("in");
  if (noun === "house" && state.location === "behind_house") return doMove("west");
  if (noun === "window" && state.location === "behind_house") return doMove("west");
  if (noun === "kitchen" && state.location === "behind_house") return doMove("west");
  println("You can't enter that.");
}

function cmdEat(args) {
  const id = resolveItem(args[0]);
  if (!id || !carrying(id)) { println("You don't have that."); return; }
  if (id === "lunch") { state.inventory = state.inventory.filter(x => x !== "lunch"); println("Thank you very much. It really hit the spot."); return; }
  if (id === "garlic") { state.inventory = state.inventory.filter(x => x !== "garlic"); println("You eat the clove of garlic. Boy, is your breath bad."); return; }
  println("You can't eat that.");
}

function cmdDrink(args) {
  const id = resolveItem(args[0]);
  if (id === "water") {
    if (!carrying("bottle") || state.items.bottle.closed) { println("The bottle is closed."); return; }
    if (!state.items.bottle.contains.includes("water")) { println("There's no water to drink."); return; }
    state.items.bottle.contains = state.items.bottle.contains.filter(x => x !== "water");
    println("Thank you very much. I was rather thirsty (from all this talking, probably)."); return;
  }
  println("You can't drink that.");
}

function cmdPut(args) {
  const a = resolveItem(args[0]);
  const b = args.length >= 3 ? resolveItem(args[2]) : null;
  if (!a) { println("Put what?"); return; }
  if (!b) { println("Put it where?"); return; }
  if (!carrying(a)) { println("You aren't carrying that."); return; }
  if (!canSee(b)) { println("You don't see any " + args[2] + " here."); return; }
  if (b === "trophy_case") {
    state.inventory = state.inventory.filter(x => x !== a);
    state.items.trophy_case.contains.push(a);
    const def = ITEMS[a];
    if (def.deposit) {
      const flagKey = "a_deposited" + a.charAt(0).toUpperCase() + a.slice(1);
      if (!state.flags[flagKey]) {
        state.flags[flagKey] = true;
        state.score += def.deposit;
        println("Done. (" + def.deposit + " points awarded for safekeeping " + def.short + ".)");
        updateStatus(); checkVictory(); return;
      }
    }
    println("Done."); return;
  }
  if (b === "sack") {
    if (state.items.sack.closed) { println("The brown sack is closed."); return; }
    state.inventory = state.inventory.filter(x => x !== a);
    state.items.sack.contains.push(a); println("Done."); return;
  }
  if (b === "bottle") { println("There's no room for that in the bottle."); return; }
  println("You can't put that there.");
}

function cmdWait() { println("Time passes..."); updateStatus(); }
function cmdScore() {
  println(`Your score is ${state.score} (total of 350 points), in ${state.moves} moves.`);
  println(rankFor(state.score));
}
function rankFor(s) {
  if (s >= 100) return "This gives you the rank of Master Adventurer.";
  if (s >= 60)  return "This gives you the rank of Adventurer.";
  if (s >= 30)  return "This gives you the rank of Junior Adventurer.";
  if (s >= 10)  return "This gives you the rank of Novice Adventurer.";
  return "This gives you the rank of Beginner.";
}
function cmdQuit() { println("Tap RESTART to start a new game."); state.flags.gameOver = true; updateStatus(); }
function cmdRestart() {
  state = makeInitialState();
  outputEl.innerHTML = "";
  resetRoomItems();
  bootStart();
}
function cmdDiagnose() { println("You are in perfect health."); }
function cmdHelp() {
  println("Tap a chip to act. Use MORE for the full list.");
  println("Common verbs: LOOK, EXAMINE, TAKE, DROP, OPEN,");
  println("CLOSE, READ, MOVE, ATTACK, PUT, GO <DIR>.");
}
function cmdAbout() {
  println("ZORK I: The Great Underground Empire");
  println("Original (c) 1981 Infocom, Inc.");
  println("Tribute build for the Ray-Ban Meta Display.");
}

function checkVictory() {
  const c = state.items.trophy_case.contains;
  if (c.includes("egg") && c.includes("painting") && c.includes("coins")) {
    sfxVictory();
    println("");
    println("As you place the last treasure in the case, the room hums with a soft golden light.");
    println("");
    println("    *** Treasure Hunt Complete ***");
    println("");
    println("Tap RESTART to play again.");
    state.flags.gameOver = true; updateStatus();
  }
}
function gameOver() { state.flags.gameOver = true; }

function award(pts, flag) {
  if (flag) { if (state.flags[flag]) return; state.flags[flag] = true; }
  state.score += pts; updateStatus();
  sfxAward();
}

function escapeHTML(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }


// ── instructions / boot ───────────────────────────────────────

function intro() {
  println("ZORK I: The Great Underground Empire");
  println("Copyright (c) 1981, 1982, 1983 Infocom, Inc.");
  println("All rights reserved.");
  println("Revision 88 / Serial number 840726");
  println("");
}

function showInstructions() {
  printlnHTML(`<span class="title-line">ZORK I — HOW TO PLAY</span>`);
  println("Tap a chip to act. The bright chip");
  println("is the suggested next move.");
  println("");
  printlnHTML(`<span class="title-line">GOAL</span>`);
  println("Find the treasures and place them in");
  println("the trophy case. Beware the troll.");
  println("");
  printlnHTML(`<span class="bold">Tap BEGIN to enter the world.</span>`);
}

const ROOM_ITEMS_ORIGINAL = {};
function snapshotRoomItems() {
  for (const id in ROOMS) ROOM_ITEMS_ORIGINAL[id] = ROOMS[id].items ? [...ROOMS[id].items] : [];
}
function resetRoomItems() {
  for (const id in ROOM_ITEMS_ORIGINAL) ROOMS[id].items = [...ROOM_ITEMS_ORIGINAL[id]];
}

function bootStart() {
  state.flags.awaitingStart = true;
  showInstructions();
  updateStatus();
}

function startGame() {
  ensureAudio();
  sfxBegin();
  state.flags.awaitingStart = false;
  outputEl.innerHTML = "";
  intro();
  describeRoom();
  updateStatus();
}


// ── chip command bar ───────────────────────────────────────────

function execChip(cmd) {
  if (printing) return;
  ensureAudio();
  sfxChip();
  parseAndExecute(cmd);
}

function makeChip(label, onClick, opts = {}) {
  const btn = document.createElement("button");
  btn.className = "chip";
  if (opts.primary) btn.classList.add("primary");
  if (opts.full)    btn.classList.add("full");
  if (opts.big)     btn.classList.add("big");
  if (opts.compact) btn.classList.add("compact");
  btn.textContent = label;
  btn.addEventListener("click", (e) => { e.stopPropagation(); onClick(); });
  return btn;
}

function clearChips() {
  primaryRow.innerHTML = "";
  secondaryRow.innerHTML = "";
}

function renderChips() {
  clearChips();
  if (state.flags.awaitingStart) {
    primaryRow.appendChild(makeChip("▶  BEGIN", startGame, { primary: true, full: true, big: true }));
    return;
  }
  if (state.flags.gameOver) {
    primaryRow.appendChild(makeChip("↻  RESTART", cmdRestart, { primary: true, full: true, big: true }));
    return;
  }

  const ctx = computeActions();

  // Primary row: the most contextually obvious next move
  if (ctx.primary) {
    primaryRow.appendChild(makeChip(ctx.primary, () => execChip(ctx.primary), {
      primary: true, full: true, big: true,
    }));
  }

  // Secondary row: 5–6 chips: directions + look/inv + MORE
  const secondary = ctx.secondary.slice(0, 5);
  for (const s of secondary) secondaryRow.appendChild(makeChip(s, () => execChip(s), { compact: true }));
  // Always include MORE
  secondaryRow.appendChild(makeChip("MORE…", openMorePanel, { compact: true }));
}


// Compute the "smart" primary suggestion + secondary chip set.
function computeActions() {
  const r = room();
  const items = r.items || [];
  const dark = r.dark && !(carrying("lantern") && state.flags.lanternOn);

  let primary = null;
  const more = [];   // candidates for MORE panel
  const secondary = [];

  const push = (s, where = "more") => { if (!s) return; (where === "secondary" ? secondary : more).push(s); };

  // ---- pick the smart "primary" action ----
  if (dark) {
    if (carrying("lantern") && !state.flags.lanternOn) primary = "turn on lantern";
    else primary = "look";
  } else {
    if (state.location === "west_of_house" && state.items.mailbox.closed) primary = "open mailbox";
    else if (state.location === "west_of_house" && !state.items.mailbox.closed && state.items.mailbox.contains.includes("leaflet")) primary = "take leaflet";
    else if (carrying("leaflet") && !state.flags.a_readLeaflet) primary = "read leaflet";
    else if (state.location === "behind_house" && !state.flags.windowOpen) primary = "open window";
    else if (state.location === "behind_house" && state.flags.windowOpen) primary = "enter window";
    else if (state.location === "kitchen" && !state.flags.visited.attic) primary = "go up";
    else if (state.location === "attic" && !carrying("rope")) primary = "take rope";
    else if (state.location === "attic" && !carrying("knife")) primary = "take knife";
    else if (state.location === "attic") primary = "go down";
    else if (state.location === "kitchen" && !state.flags.visited.living_room) primary = "go west";
    else if (state.location === "living_room" && items.includes("sword")) primary = "take sword";
    else if (state.location === "living_room" && items.includes("lantern")) primary = "take lantern";
    else if (state.location === "living_room" && carrying("lantern") && !state.flags.lanternOn) primary = "turn on lantern";
    else if (state.location === "living_room" && !state.flags.rugMoved) primary = "move rug";
    else if (state.location === "living_room" && state.flags.rugMoved && !state.flags.trapdoorOpen) primary = "open trapdoor";
    else if (state.location === "living_room" && state.flags.trapdoorOpen && !state.flags.enteredCellar) primary = "go down";
    else if (state.location === "forest_path" && state.flags.visited.up_a_tree !== true) primary = "climb tree";
    else if (state.location === "up_a_tree" && state.items.nest.contains.includes("egg")) primary = "take egg";
    else if (state.location === "cellar" && !state.flags.visited.troll_room) primary = "go north";
    else if (state.location === "troll_room" && !state.flags.trollDead && carrying("sword")) primary = "attack troll with sword";
    else if (state.location === "troll_room" && state.flags.trollDead && (items.includes("axe") || items.includes("coins"))) primary = "take all";
    else if (state.location === "troll_room" && state.flags.trollDead) primary = "go east";
    else if (state.location === "east_west_passage") primary = "go east";
    else if (state.location === "round_room") primary = "go northeast";
    else if (state.location === "gallery" && items.includes("painting")) primary = "take painting";
    else if (state.location === "gallery") primary = "go southwest";
    else if (state.location === "living_room") {
      // Deposit phase
      const tres = state.inventory.filter(id => ITEMS[id].treasure);
      if (tres.length) primary = "put " + lastWord(ITEMS[tres[0]].short) + " in case";
    }
  }

  // ---- secondary row (the 5 most useful non-primary chips) ----
  // Always: LOOK / INV
  push("look", "secondary");
  // Available exits as "GO <dir>"
  for (const dir in (r.exits || {})) {
    if (["in","out"].includes(dir)) continue;
    if (primary === ("go " + dir)) continue;
    push("go " + dir, "secondary");
    if (secondary.length >= 4) break;
  }
  push("inventory", "secondary");

  // ---- MORE panel candidates: every plausible action ----
  if (!dark) {
    for (const id of items) {
      const def = ITEMS[id];
      if (id === "mailbox" && state.items.mailbox.closed) push("open mailbox");
      if (id === "mailbox" && !state.items.mailbox.closed && state.items.mailbox.contains.includes("leaflet")) push("take leaflet");
      if (id === "window" && !state.flags.windowOpen) push("open window");
      if (id === "window" && state.flags.windowOpen) push("close window");
      if (id === "rug" && !state.flags.rugMoved) push("move rug");
      if (id === "trapdoor" && !state.flags.trapdoorOpen) push("open trapdoor");
      if (id === "trapdoor" && state.flags.trapdoorOpen) push("close trapdoor");
      if (id === "trophy_case") {
        for (const inv of state.inventory) {
          if (ITEMS[inv].treasure) push("put " + lastWord(ITEMS[inv].short) + " in case");
        }
      }
      if (id === "troll" && !state.flags.trollDead && carrying("sword")) push("attack troll with sword");
      if (id === "nest" && state.items.nest.contains.includes("egg")) push("take egg");
      if (id === "leaves" && !state.flags.leavesMoved) push("move leaves");
      if (!def.fixed) push("take " + lastWord(def.short));
      if (def.examine) push("examine " + lastWord(def.short));
    }
    if (carrying("leaflet")) push("read leaflet");
    if (carrying("lantern") && !state.flags.lanternOn) push("turn on lantern");
    if (carrying("lantern") && state.flags.lanternOn && !r.dark) push("turn off lantern");
    for (const inv of state.inventory) push("examine " + lastWord(ITEMS[inv].short));
  } else {
    if (carrying("lantern") && !state.flags.lanternOn) push("turn on lantern");
  }
  push("score");
  push("inventory");
  push("look");
  push("help");

  // dedupe across primary/secondary/more
  const seen = new Set();
  const dedupe = (arr) => arr.filter(s => {
    const k = s.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });
  if (primary) seen.add(primary.toLowerCase());
  const secondaryDedup = dedupe(secondary);
  const moreDedup = dedupe(more);

  return { primary, secondary: secondaryDedup, more: moreDedup };
}

function lastWord(s) { const parts = s.split(/\s+/); return parts[parts.length - 1]; }


// ── MORE panel ────────────────────────────────────────────────

function openMorePanel() {
  const ctx = computeActions();
  moreList.innerHTML = "";
  const all = [];
  if (ctx.primary) all.push(ctx.primary);
  for (const s of ctx.secondary) all.push(s);
  for (const s of ctx.more) all.push(s);
  // dedupe
  const seen = new Set();
  for (const s of all) {
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    moreList.appendChild(makeChip(s, () => { closeMorePanel(); execChip(s); }));
  }
  morePanel.classList.remove("hidden");
}
function closeMorePanel() { morePanel.classList.add("hidden"); }
mpClose.addEventListener("click", closeMorePanel);


// ── boot ──────────────────────────────────────────────────────

function boot() {
  const overlay = document.createElement("div");
  overlay.id = "boot";
  overlay.innerHTML = `<div class="scanline"></div><div class="crawl">LOADING ZORK I…</div>`;
  document.getElementById("crt").appendChild(overlay);
  setTimeout(() => {
    overlay.classList.add("gone");
    setTimeout(() => overlay.remove(), 500);
  }, 900);

  snapshotRoomItems();
  bootStart();

  // Mute toggle — also acts as the first user gesture to unlock audio.
  const muteBtn = document.getElementById("mute-btn");
  muteBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    ensureAudio();
    setMute(!audioMuted);
    if (!audioMuted) sfxChip();
  });
  setMute(false);

  // Boot zap on the first user gesture (autoplay policy compliance).
  const onFirstGesture = () => {
    ensureAudio();
    sfxBoot();
    document.removeEventListener("pointerdown", onFirstGesture);
  };
  document.addEventListener("pointerdown", onFirstGesture, { once: false });
}

boot();
