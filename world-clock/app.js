/* ============================================================
   WORLD CLOCK — app logic
   - Home shows favorite cities with live, DST-correct times.
   - Picker lets you toggle cities in/out of favorites.
   - D-pad only: ▲▼ move, Enter select/toggle, ◀ back.
   ============================================================ */

// Built-in catalog. IANA tz names keep times DST-correct automatically.
const CITIES = [
  { name: "Auckland",      tz: "Pacific/Auckland" },
  { name: "Bangkok",       tz: "Asia/Bangkok" },
  { name: "Berlin",        tz: "Europe/Berlin" },
  { name: "Buenos Aires",  tz: "America/Argentina/Buenos_Aires" },
  { name: "Cairo",         tz: "Africa/Cairo" },
  { name: "Chicago",       tz: "America/Chicago" },
  { name: "Dubai",         tz: "Asia/Dubai" },
  { name: "Hong Kong",     tz: "Asia/Hong_Kong" },
  { name: "Honolulu",      tz: "Pacific/Honolulu" },
  { name: "Istanbul",      tz: "Europe/Istanbul" },
  { name: "London",        tz: "Europe/London" },
  { name: "Los Angeles",   tz: "America/Los_Angeles" },
  { name: "Mexico City",   tz: "America/Mexico_City" },
  { name: "Mumbai",        tz: "Asia/Kolkata" },
  { name: "New York",      tz: "America/New_York" },
  { name: "Paris",         tz: "Europe/Paris" },
  { name: "São Paulo",     tz: "America/Sao_Paulo" },
  { name: "Singapore",     tz: "Asia/Singapore" },
  { name: "Sydney",        tz: "Australia/Sydney" },
  { name: "Tokyo",         tz: "Asia/Tokyo" },
];

const STORE_KEY = "world-clock.favorites";
const LOCAL_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

// ---------------- state ----------------
function loadFavorites() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY));
    if (Array.isArray(raw) && raw.length) {
      return raw.filter((tz) => CITIES.some((c) => c.tz === tz));
    }
  } catch (e) { /* fall through to default */ }
  return ["America/New_York"]; // New York by default
}

let favorites = loadFavorites();
let screen = "home";       // "home" | "picker"
let homeIdx = 0;           // index into home rows (favorites + Add City)
let pickerIdx = CITIES.findIndex((c) => c.tz === "America/New_York");

function saveFavorites() {
  localStorage.setItem(STORE_KEY, JSON.stringify(favorites));
}

// ---------------- time helpers ----------------
// Returns {h, m, s, ampm} for a tz, plus offset hours vs. local.
function partsFor(tz, now) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour: "2-digit", minute: "2-digit",
    second: "2-digit", hour12: true,
  });
  const map = {};
  for (const p of fmt.formatToParts(now)) map[p.type] = p.value;
  return { h: map.hour, m: map.minute, s: map.second, ampm: (map.dayPeriod || "").toUpperCase() };
}

// Offset of tz relative to local time, in whole/half hours.
function offsetLabel(tz, now) {
  const tzMs = zonedMs(tz, now);
  const localMs = zonedMs(LOCAL_TZ, now);
  const diff = Math.round((tzMs - localMs) / 60000); // minutes
  if (diff === 0) return "SAME AS YOU";
  const sign = diff > 0 ? "+" : "−";
  const abs = Math.abs(diff);
  const hh = Math.floor(abs / 60);
  const mm = abs % 60;
  return `${sign}${hh}${mm ? ":" + String(mm).padStart(2, "0") : ""}H`;
}

// Wall-clock time of a tz expressed as a UTC-epoch, for offset math.
function zonedMs(tz, now) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
  const m = {};
  for (const p of f.formatToParts(now)) m[p.type] = p.value;
  let hour = m.hour === "24" ? "00" : m.hour;
  return Date.UTC(+m.year, +m.month - 1, +m.day, +hour, +m.minute, +m.second);
}

// ---------------- rendering ----------------
const homeEl = document.getElementById("home");
const pickerEl = document.getElementById("picker");
const favListEl = document.getElementById("fav-list");
const cityListEl = document.getElementById("city-list");

function favCities() {
  return favorites
    .map((tz) => CITIES.find((c) => c.tz === tz))
    .filter(Boolean);
}

function homeRowCount() {
  return favCities().length + 1; // +1 for the Add City row
}

function renderHome() {
  const now = new Date();
  const favs = favCities();
  homeIdx = Math.min(homeIdx, homeRowCount() - 1);

  let html = "";
  if (favs.length === 0) {
    html += `<div class="empty-note">No cities yet.<br>Select <b>+ Add city</b> below.</div>`;
  }
  favs.forEach((c, i) => {
    const p = partsFor(c.tz, now);
    html += `
      <div class="fav ${homeIdx === i ? "sel" : ""}">
        <div class="fav-left">
          <span class="fav-city">${c.name}</span>
          <span class="fav-meta">${offsetLabel(c.tz, now)}</span>
        </div>
        <div class="fav-time">${p.h}:${p.m}<span class="sec">:${p.s}</span><span class="fav-ampm">${p.ampm}</span></div>
      </div>`;
  });
  const addSel = homeIdx === favs.length ? "sel" : "";
  html += `<div class="fav add ${addSel}"><span>＋</span><span>ADD CITY</span></div>`;

  favListEl.innerHTML = html;
}

function renderPicker() {
  const now = new Date();
  let html = "";
  CITIES.forEach((c, i) => {
    const p = partsFor(c.tz, now);
    const isFav = favorites.includes(c.tz);
    html += `
      <div class="city ${pickerIdx === i ? "sel" : ""} ${isFav ? "fav" : ""}">
        <span class="city-name">${c.name}</span>
        <div class="city-right">
          <span class="city-clock">${p.h}:${p.m} ${p.ampm}</span>
          <span class="star">${isFav ? "★" : "☆"}</span>
        </div>
      </div>`;
  });
  cityListEl.innerHTML = html;

  // keep the selected row in view
  const sel = cityListEl.querySelector(".city.sel");
  if (sel) sel.scrollIntoView({ block: "nearest" });
}

function render() {
  if (screen === "home") {
    homeEl.classList.remove("hidden");
    pickerEl.classList.add("hidden");
    renderHome();
  } else {
    homeEl.classList.add("hidden");
    pickerEl.classList.remove("hidden");
    renderPicker();
  }
}

// ---------------- input ----------------
function onKey(e) {
  const k = e.key;
  if (screen === "home") {
    if (k === "ArrowDown") { homeIdx = (homeIdx + 1) % homeRowCount(); render(); }
    else if (k === "ArrowUp") { homeIdx = (homeIdx - 1 + homeRowCount()) % homeRowCount(); render(); }
    else if (k === "Enter") {
      const favs = favCities();
      if (homeIdx === favs.length) {
        // Add City row → open picker
        screen = "picker";
        render();
      } else {
        // remove this favorite
        favorites = favorites.filter((tz) => tz !== favs[homeIdx].tz);
        saveFavorites();
        render();
      }
    } else { return; }
  } else {
    // picker
    if (k === "ArrowDown") { pickerIdx = (pickerIdx + 1) % CITIES.length; render(); }
    else if (k === "ArrowUp") { pickerIdx = (pickerIdx - 1 + CITIES.length) % CITIES.length; render(); }
    else if (k === "Enter") {
      const tz = CITIES[pickerIdx].tz;
      if (favorites.includes(tz)) favorites = favorites.filter((t) => t !== tz);
      else favorites.push(tz);
      saveFavorites();
      render();
    } else if (k === "ArrowLeft") {
      screen = "home";
      render();
    } else { return; }
  }
  e.preventDefault();
}

document.addEventListener("keydown", onKey);

// tick every second
render();
setInterval(render, 1000);
