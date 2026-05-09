// ──────────────────────────────────────────────────────────────────
// ZORK I — engine, parser, CRT terminal UI, voice & button input
// ──────────────────────────────────────────────────────────────────

const $ = (sel) => document.querySelector(sel);
const outputEl   = $("#output");
const statusLoc  = $("#status-loc");
const statusMeta = $("#status-meta");
const actionBtn  = $("#action-btn");
const abIcon     = $("#ab-icon");
const abLabel    = $("#ab-label");
const lmModal    = $("#listen-modal");
const lmStatus   = $("#lm-status");
const lmText     = $("#lm-text");
const lmSugsList = $("#lm-sugs-list");
const lmCancel   = $("#lm-cancel");
const lmSubmit   = $("#lm-submit");
const lmClose    = $("#lm-close");

let state = makeInitialState();
let lastCommand = "";


// ── output helpers ─────────────────────────────────────────────

function println(text = "") {
  const div = document.createElement("div");
  div.className = "line";
  div.textContent = text;
  outputEl.appendChild(div);
  scrollToBottom();
}

function printlnHTML(html) {
  const div = document.createElement("div");
  div.className = "line";
  div.innerHTML = html;
  outputEl.appendChild(div);
  scrollToBottom();
}

function printEcho(cmd) {
  const div = document.createElement("div");
  div.className = "line echo";
  div.textContent = cmd;
  outputEl.appendChild(div);
  scrollToBottom();
}

function scrollToBottom() { outputEl.scrollTop = outputEl.scrollHeight; }

function updateStatus() {
  const r = ROOMS[state.location];
  statusLoc.textContent = (r ? r.short : "—").toUpperCase();
  statusMeta.textContent = `SCORE: ${state.score}/350  MOVES: ${state.moves}`;
  updateActionButton();
}

function updateActionButton() {
  if (state.flags.awaitingStart) {
    abIcon.innerHTML = "&#9654;";
    abLabel.textContent = "BEGIN";
    actionBtn.dataset.mode = "begin";
    actionBtn.classList.add("primary");
    actionBtn.classList.remove("listening");
  } else if (state.flags.gameOver) {
    abIcon.innerHTML = "&#x21bb;";
    abLabel.textContent = "RESTART";
    actionBtn.dataset.mode = "restart";
    actionBtn.classList.add("primary");
    actionBtn.classList.remove("listening");
  } else {
    abIcon.innerHTML = "&#127908;"; // 🎤
    abLabel.textContent = "TAP TO SPEAK";
    actionBtn.dataset.mode = "speak";
    actionBtn.classList.remove("primary");
    actionBtn.classList.remove("listening");
  }
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
  no: "no", n: "no",
  help: "help",
  about: "about",
  xyzzy: "xyzzy", plugh: "plugh",
  hello: "hello", hi: "hello",
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
    "box": "mailbox", "mail": "mailbox",
    "letter": "leaflet", "advertisement": "leaflet", "pamphlet": "leaflet",
    "case": "trophy_case", "trophy": "trophy_case",
    "carpet": "rug",
    "trap": "trapdoor", "trapdoor": "trapdoor", "door": "trapdoor",
    "lamp": "lantern", "torch": "lantern", "light": "lantern",
    "egg": "egg", "jewel": "egg", "jewels": "egg",
    "bird": "nest", "nest": "nest",
    "leaf": "leaves", "leaves": "leaves", "pile": "leaves",
    "blade": "sword",
    "knife": "knife", "dagger": "knife",
    "rope": "rope", "coil": "rope",
    "bottle": "bottle", "glass": "bottle",
    "water": "water", "liquid": "water",
    "sack": "sack", "bag": "sack",
    "garlic": "garlic", "clove": "garlic",
    "lunch": "lunch", "sandwich": "lunch", "food": "lunch",
    "table": "table",
    "window": "window", "windows": "window",
    "axe": "axe",
    "coins": "coins", "pouch": "coins", "gold": "coins", "money": "coins",
    "painting": "painting", "art": "painting", "picture": "painting",
    "troll": "troll",
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

function doVerb(verb, args, _tokens) {
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
    case "save":   println("[Save not supported in this build.]"); return;
    case "restore":println("[Restore not supported in this build.]"); return;
    case "quit":   return cmdQuit();
    case "restart":return cmdRestart();
    case "verbose":state.flags.verbose = true; println("Maximum verbosity."); return;
    case "brief":  state.flags.verbose = false; println("Brief descriptions."); return;
    case "diagnose": return cmdDiagnose();
    case "xyzzy":  println("A hollow voice says \"Fool.\""); return;
    case "plugh":  println("A hollow voice says \"Fool.\""); return;
    case "hello":  println("Hello yourself, brave adventurer."); return;
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
    if (id === "bottle" && state.items.bottle.contains && state.items.bottle.contains.length) {
      line += "\n    The glass bottle contains:\n      A quantity of water";
    }
    if (id === "sack" && !state.items.sack.closed && state.items.sack.contains.length) {
      line += "\n    The brown sack contains:";
      for (const sub of state.items.sack.contains) line += "\n      " + capitalize(ITEMS[sub].article) + " " + ITEMS[sub].short;
    }
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
    println("Taken."); return;
  }
  if (id === "axe" && state.flags.trollDead) { state.inventory.push("axe"); removeFromRoom("troll_room", "axe"); println("Taken."); return; }
  if (id === "axe" && !state.flags.trollDead) { println("The troll spits in your face, grunts contemptuously, and turns away."); return; }
  if (id === "coins" && state.flags.coinsRevealed) {
    if (!(room().items || []).includes("coins")) { println("You can't see any coins here."); return; }
    removeFromRoom(state.location, "coins"); state.inventory.push("coins");
    if (!state.flags.a_tookCoins) award(5, "a_tookCoins");
    println("Taken."); return;
  }
  if (id === "painting") {
    if (!(room().items || []).includes("painting")) { println("You can't see any painting here."); return; }
    removeFromRoom(state.location, "painting"); state.inventory.push("painting");
    if (!state.flags.a_tookPainting) award(5, "a_tookPainting");
    println("Taken."); return;
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
    println("Taken."); return;
  }
  if (id === "lantern") {
    if (!(room().items || []).includes("lantern")) { println("You can't see any lantern here."); return; }
    removeFromRoom(state.location, "lantern"); state.inventory.push("lantern");
    if (!state.flags.a_tookLantern) award(2, "a_tookLantern");
    println("Taken."); return;
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
    if (state.items.mailbox.contains.length) println("Opening the small mailbox reveals a leaflet.");
    else println("Opened.");
    return;
  }
  if (id === "window") {
    if (state.flags.windowOpen) { println("It is already open."); return; }
    state.flags.windowOpen = true;
    println("With great effort, you open the window far enough to allow entry.");
    return;
  }
  if (id === "trapdoor") {
    if (!state.flags.rugMoved) { println("You can't see any trap door here."); return; }
    if (state.flags.trapdoorOpen) { println("It is already open."); return; }
    state.flags.trapdoorOpen = true;
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
  state = makeInitialState(); outputEl.innerHTML = "";
  // Re-add dynamic items to rooms (rooms.items is shared module state — reset trophy/etc.)
  resetRoomItems();
  bootStart();
}
function cmdDiagnose() { println("You are in perfect health."); }
function cmdHelp() {
  println("Common verbs:");
  println("  N S E W NE NW SE SW UP DOWN  — move");
  println("  LOOK  EXAMINE <obj>");
  println("  TAKE / DROP / INVENTORY");
  println("  OPEN / CLOSE / READ <obj>");
  println("  TURN ON LANTERN  /  TURN OFF LANTERN");
  println("  MOVE <obj>  CLIMB <obj>  ENTER <obj>");
  println("  ATTACK <foe> WITH <weapon>");
  println("  PUT <obj> IN <container>");
  println("  WAIT  AGAIN  SCORE  RESTART");
}
function cmdAbout() {
  println("ZORK I: The Great Underground Empire");
  println("Original (c) 1981 Infocom, Inc.");
  println("Tribute build for the Ray-Ban Meta Display.");
}

function checkVictory() {
  const c = state.items.trophy_case.contains;
  if (c.includes("egg") && c.includes("painting") && c.includes("coins")) {
    println("");
    println("As you place the last treasure in the case, the room hums with a soft golden light.");
    println("");
    println("    *** Treasure Hunt Complete ***");
    println("");
    println("Tap RESTART to play again.");
    state.flags.gameOver = true; updateStatus();
  }
}
function gameOver(_won) { state.flags.gameOver = true; }

function award(pts, flag) {
  if (flag) { if (state.flags[flag]) return; state.flags[flag] = true; }
  state.score += pts; updateStatus();
}

function escapeHTML(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }


// ── instructions / boot ───────────────────────────────────────

function intro() {
  println("ZORK I: The Great Underground Empire");
  println("Copyright (c) 1981, 1982, 1983 Infocom, Inc.");
  println("All rights reserved.");
  println("ZORK is a registered trademark of Infocom, Inc.");
  println("Revision 88 / Serial number 840726");
  println("");
}

function showInstructions() {
  printlnHTML(`<span class="title-line">ZORK I — HOW TO PLAY</span>`);
  println("");
  println("Tap the speak button. Say what you want");
  println("to do, or tap a suggested command.");
  println("");
  printlnHTML(`<span class="title-line">EXAMPLES</span>`);
  println("  \"open mailbox\"      \"take leaflet\"");
  println("  \"go north\"          \"examine sword\"");
  println("  \"attack troll with sword\"");
  println("");
  printlnHTML(`<span class="title-line">GOAL</span>`);
  println("  Find the treasures of the underground");
  println("  empire and place them in the trophy");
  println("  case in the living room.");
  println("");
  printlnHTML(`<span class="bold">Tap BEGIN to enter the world.</span>`);
  outputEl.scrollTop = 0;
}

// Original room item lists, so we can restore on restart.
const ROOM_ITEMS_ORIGINAL = {};
function snapshotRoomItems() {
  for (const id in ROOMS) {
    if (ROOMS[id].items) ROOM_ITEMS_ORIGINAL[id] = [...ROOMS[id].items];
    else ROOM_ITEMS_ORIGINAL[id] = [];
  }
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
  state.flags.awaitingStart = false;
  outputEl.innerHTML = "";
  intro();
  describeRoom();
  updateStatus();
}


// ── speech recognition + listening modal ──────────────────────

let recognition = null;
let recognitionLive = "";
let recognitionRunning = false;
let recognitionSupported = false;
try {
  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (Rec) {
    recognition = new Rec();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      let text = "";
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i][0].transcript;
      }
      recognitionLive = text;
      lmText.textContent = recognitionLive;
    };
    recognition.onend = () => {
      recognitionRunning = false;
      lmStatus.textContent = recognitionLive ? "READY" : "TAP A COMMAND OR TAP SUBMIT";
    };
    recognition.onerror = (e) => {
      recognitionRunning = false;
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        lmStatus.textContent = "MIC BLOCKED — TAP A COMMAND";
      } else if (e.error === "no-speech") {
        lmStatus.textContent = "NO SPEECH — TRY AGAIN OR TAP";
      } else {
        lmStatus.textContent = "VOICE OFF — TAP A COMMAND";
      }
    };
    recognitionSupported = true;
  }
} catch (e) { recognitionSupported = false; }

function buildSuggestions() {
  const sugs = [];
  const r = room();
  const items = r.items || [];
  const dark = r.dark && !(carrying("lantern") && state.flags.lanternOn);

  // Always-available verbs
  sugs.push("look", "inventory");

  if (!dark) {
    // Per-item suggestions in current room
    for (const id of items) {
      const def = ITEMS[id];
      if (id === "mailbox" && state.items.mailbox.closed) sugs.push("open mailbox");
      if (id === "mailbox" && !state.items.mailbox.closed && state.items.mailbox.contains.includes("leaflet")) sugs.push("take leaflet");
      if (id === "window" && !state.flags.windowOpen) sugs.push("open window");
      if (id === "window" && state.flags.windowOpen && state.location === "behind_house") sugs.push("enter window");
      if (id === "rug" && !state.flags.rugMoved) sugs.push("move rug");
      if (id === "trapdoor" && !state.flags.trapdoorOpen) sugs.push("open trapdoor");
      if (id === "trophy_case") {
        for (const inv of state.inventory) {
          if (ITEMS[inv].treasure) sugs.push(`put ${ITEMS[inv].short.split(" ").slice(-1)[0]} in case`);
        }
      }
      if (id === "troll" && !state.flags.trollDead && carrying("sword")) sugs.push("attack troll with sword");
      if (id === "nest" && state.items.nest.contains.includes("egg")) sugs.push("take egg");
      if (id === "leaves" && !state.flags.leavesMoved) sugs.push("move leaves");
      if (!def.fixed) sugs.push("take " + lastWord(def.short));
      if (def.examine) sugs.push("examine " + lastWord(def.short));
    }
    // Inventory specials
    if (carrying("leaflet")) sugs.push("read leaflet");
    if (carrying("lantern") && !state.flags.lanternOn) sugs.push("turn on lantern");
    if (carrying("lantern") && state.flags.lanternOn && !r.dark) sugs.push("turn off lantern");

    // Exit suggestions
    for (const dir in (r.exits || {})) {
      if (["in","out"].includes(dir)) continue;
      sugs.push("go " + dir);
    }
  } else {
    if (carrying("lantern") && !state.flags.lanternOn) sugs.push("turn on lantern");
    sugs.push("go back");
  }

  // Dedupe + cap
  const seen = new Set();
  const unique = [];
  for (const s of sugs) {
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k); unique.push(s);
    if (unique.length >= 14) break;
  }
  return unique;
}

function lastWord(s) { const parts = s.split(/\s+/); return parts[parts.length - 1]; }

function renderSuggestions() {
  const sugs = buildSuggestions();
  lmSugsList.innerHTML = "";
  for (const s of sugs) {
    const btn = document.createElement("button");
    btn.className = "lm-chip";
    btn.textContent = s;
    btn.addEventListener("click", () => {
      stopRecognition();
      lmText.textContent = s;
      recognitionLive = s;
      submitListening();
    });
    lmSugsList.appendChild(btn);
  }
}

function openListenModal() {
  recognitionLive = "";
  lmText.textContent = "";
  lmStatus.textContent = recognitionSupported ? "LISTENING…" : "TAP A COMMAND";
  renderSuggestions();
  lmModal.classList.remove("hidden");
  actionBtn.classList.add("listening");
  if (recognitionSupported) {
    try { recognition.start(); recognitionRunning = true; }
    catch (e) { /* already running or other; ignore */ }
  }
}

function stopRecognition() {
  if (recognitionRunning) {
    try { recognition.stop(); } catch (e) {}
    recognitionRunning = false;
  }
}

function closeListenModal() {
  stopRecognition();
  lmModal.classList.add("hidden");
  actionBtn.classList.remove("listening");
}

function submitListening() {
  const text = (recognitionLive || lmText.textContent || "").trim();
  closeListenModal();
  if (text) parseAndExecute(text);
}


// ── wire up ───────────────────────────────────────────────────

actionBtn.addEventListener("click", () => {
  const mode = actionBtn.dataset.mode;
  if (mode === "begin") { startGame(); return; }
  if (mode === "restart") { cmdRestart(); return; }
  // speak
  openListenModal();
});

lmCancel.addEventListener("click", closeListenModal);
lmClose.addEventListener("click", closeListenModal);
lmSubmit.addEventListener("click", submitListening);

// Tapping anywhere in the modal background outside controls also helps focus
document.addEventListener("keydown", (e) => {
  if (lmModal.classList.contains("hidden")) {
    // Let the action button respond to Enter when at start/end states
    if (e.key === "Enter" && (state.flags.awaitingStart || state.flags.gameOver)) {
      e.preventDefault();
      actionBtn.click();
    }
    return;
  }
  if (e.key === "Escape") closeListenModal();
  if (e.key === "Enter") { e.preventDefault(); submitListening(); }
});


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
}

boot();
