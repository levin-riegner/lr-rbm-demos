/* ============================================================
   WORLD CLOCK — app logic
   - Home shows favorite cities with live local times.
   - Picker lets you toggle any city in/out of favorites.
   - New York is favorited by default; favorites persist locally.
   D-pad only: ▲▼ move, Enter activate, ◀ back from picker.
   ============================================================ */

// Master city list. Offset stored only for display ordering hints;
// actual time comes from Intl with the IANA time zone (DST-correct).
const CITIES = [
  { id: "los_angeles",  name: "Los Angeles",   tz: "America/Los_Angeles" },
  { id: "denver",       name: "Denver",        tz: "America/Denver" },
  { id: "chicago",      name: "Chicago",       tz: "America/Chicago" },
  { id: "new_york",     name: "New York",      tz: "America/New_York" },
  { id: "sao_paulo",    name: "São Paulo",     tz: "America/Sao_Paulo" },
  { id: "london",       name: "London",        tz: "Europe/London" },
  { id: "paris",        name: "Paris",         tz: "Europe/Paris" },
  { id: "berlin",       name: "Berlin",        tz: "Europe/Berlin" },
  { id: "cairo",        name: "Cairo",         tz: "Africa/Cairo" },
  { id: "moscow",       name: "Moscow",        tz: "Europe/Moscow" },
  { id: "dubai",        name: "Dubai",         tz: "Asia/Dubai" },
  { id: "mumbai",       name: "Mumbai",        tz: "Asia/Kolkata" },
  { id: "bangkok",      name: "Bangkok",       tz: "Asia/Bangkok" },
  { id: "singapore",    name: "Singapore",     tz: "Asia/Singapore" },
  { id: "hong_kong",    name: "Hong Kong",     tz: "Asia/Hong_Kong" },
  { id: "shanghai",     name: "Shanghai",      tz: "Asia/Shanghai" },
  { id: "tokyo",        name: "Tokyo",         tz: "Asia/Tokyo" },
  { id: "seoul",        name: "Seoul",         tz: "Asia/Seoul" },
  { id: "sydney",       name: "Sydney",        tz: "Australia/Sydney" },
  { id: "auckland",     name: "Auckland",      tz: "Pacific/Auckland" },
];

const STORE_KEY = "world-clock.favorites";
const DEFAULT_FAVS = ["new_york"];

function cityById(id) { return CITIES.find((c) => c.id === id); }

function loadFavorites() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const ids = JSON.parse(raw).filter(cityById);
      return ids;
    }
  } catch (e) { /* ignore */ }
  return [...DEFAULT_FAVS];
}

function saveFavorites() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(favorites)); }
  catch (e) { /* ignore */ }
}

let favorites = loadFavorites();

// ---------- time helpers (Intl is DST-aware) ----------
function partsFor(tz, date) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour12: false,
    weekday: "short", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const p = {};
  for (const { type, value } of fmt.formatToParts(date)) p[type] = value;
  return p; // {weekday, month, day, hour, minute, second}
}

// Offset in hours vs the wearer's local zone, e.g. "+5" / "-3" / "0".
function offsetLabel(tz, date) {
  const local = date.getTime();
  const there = new Date(date.toLocaleString("en-US", { timeZone: tz })).getTime();
  const here = new Date(date.toLocaleString("en-US")).getTime();
  const diff = Math.round((there - here) / 3.6e6);
  if (diff === 0) return "HERE";
  return (diff > 0 ? "+" : "") + diff + "h";
}

function dayLabel(p) {
  return `${p.weekday} · ${p.month} ${p.day}`;
}

// ============================================================
//  SCREENS / STATE
// ============================================================
const home = document.getElementById("home");
const picker = document.getElementById("picker");
const favListEl = document.getElementById("fav-list");
const cityListEl = document.getElementById("city-list");

let screen = "home";        // "home" | "picker"
let homeIdx = 0;            // index into home rows (favorites + add button)
let pickerIdx = 0;         // index into CITIES

// ---------- HOME render ----------
function buildHome() {
  favListEl.innerHTML = "";

  favorites.forEach((id) => {
    const c = cityById(id);
    const row = document.createElement("div");
    row.className = "fav";
    row.dataset.id = id;
    row.innerHTML = `
      <div class="fav-meta">
        <span class="fav-city">${c.name}</span>
        <span class="fav-day"></span>
      </div>
      <span class="fav-time"></span>
      <span class="fav-off"></span>`;
    favListEl.appendChild(row);
  });

  const add = document.createElement("div");
  add.className = "fav fav-add";
  add.dataset.add = "1";
  add.innerHTML = `<span class="fav-city">＋ ADD CITY</span>`;
  favListEl.appendChild(add);

  homeIdx = Math.min(homeIdx, favorites.length); // clamp (add row = favorites.length)
  paintHomeSelection();
  tickHome();
}

function homeRows() { return [...favListEl.children]; }

function paintHomeSelection() {
  homeRows().forEach((el, i) => el.classList.toggle("selected", i === homeIdx));
}

function tickHome() {
  if (screen !== "home") return;
  const now = new Date();
  favorites.forEach((id, i) => {
    const c = cityById(id);
    const p = partsFor(c.tz, now);
    const row = favListEl.children[i];
    if (!row) return;
    row.querySelector(".fav-time").innerHTML =
      `${p.hour}:${p.minute}<span class="sec">:${p.second}</span>`;
    row.querySelector(".fav-day").textContent = dayLabel(p);
    row.querySelector(".fav-off").textContent = offsetLabel(c.tz, now);
  });
}

// ---------- PICKER render ----------
function buildPicker() {
  cityListEl.innerHTML = "";
  CITIES.forEach((c, i) => {
    const row = document.createElement("div");
    row.className = "city";
    row.dataset.id = c.id;
    row.innerHTML = `
      <span class="city-star">★</span>
      <div>
        <div class="city-name">${c.name}</div>
        <div class="city-zone">${c.tz.replace(/_/g, " ")}</div>
      </div>
      <span class="city-time mono"></span>`;
    cityListEl.appendChild(row);
  });
  paintPicker();
  tickPicker();
}

function paintPicker() {
  [...cityListEl.children].forEach((el, i) => {
    el.classList.toggle("selected", i === pickerIdx);
    el.classList.toggle("fav-on", favorites.includes(CITIES[i].id));
  });
  // keep the selected row in view
  cityListEl.children[pickerIdx]?.scrollIntoView({ block: "nearest" });
}

function tickPicker() {
  if (screen !== "picker") return;
  const now = new Date();
  CITIES.forEach((c, i) => {
    const p = partsFor(c.tz, now);
    cityListEl.children[i].querySelector(".city-time").textContent =
      `${p.hour}:${p.minute}`;
  });
}

// ============================================================
//  NAVIGATION
// ============================================================
function showHome() {
  screen = "home";
  picker.classList.add("hidden");
  home.classList.remove("hidden");
  buildHome();
}

function showPicker() {
  screen = "picker";
  home.classList.add("hidden");
  picker.classList.remove("hidden");
  buildPicker();
}

function moveHome(delta) {
  const max = favorites.length; // last index = add row
  homeIdx = Math.max(0, Math.min(max, homeIdx + delta));
  paintHomeSelection();
}

function activateHome() {
  if (homeIdx === favorites.length) { showPicker(); return; }
  // Enter on a favorite removes it (only one left? keep at least the row gone).
  const id = favorites[homeIdx];
  favorites.splice(homeIdx, 1);
  saveFavorites();
  buildHome();
}

function movePicker(delta) {
  pickerIdx = Math.max(0, Math.min(CITIES.length - 1, pickerIdx + delta));
  paintPicker();
}

function toggleFavorite() {
  const id = CITIES[pickerIdx].id;
  const at = favorites.indexOf(id);
  if (at >= 0) favorites.splice(at, 1);
  else favorites.push(id);
  saveFavorites();
  paintPicker();
}

// ============================================================
//  INPUT — D-pad + Enter
// ============================================================
document.addEventListener("keydown", (e) => {
  const k = e.key;
  if (screen === "home") {
    if (k === "ArrowUp")    { moveHome(-1); e.preventDefault(); }
    else if (k === "ArrowDown") { moveHome(1); e.preventDefault(); }
    else if (k === "Enter") { activateHome(); e.preventDefault(); }
  } else {
    if (k === "ArrowUp")    { movePicker(-1); e.preventDefault(); }
    else if (k === "ArrowDown") { movePicker(1); e.preventDefault(); }
    else if (k === "Enter") { toggleFavorite(); e.preventDefault(); }
    else if (k === "ArrowLeft") { showHome(); e.preventDefault(); }
  }
});

// ============================================================
//  BOOT
// ============================================================
showHome();
setInterval(() => {
  if (screen === "home") tickHome();
  else tickPicker();
}, 1000);
