/* ─────────────────────────────────────────────────────────────
   SKIPPER — Meta Ray-Ban Display

   A skipper's coach for three specific rental hulls, written for
   someone whose only source of information all day is this lens.

   NAVIGATION CONTRACT — two shapes, and that is the whole app.

     MENUS (boat picker, home, emergency index)
       ▲ ▼   move        ⏎ / ▶  open        ◀  back

     CONTENT (steps, checklists, boat card, mayday)
       ◀ ▶   move within    ⏎  act / next
       ▼     back to the menu        ▲  emergency

   Content screens deliberately move on ◀▶ rather than ▲▼. It
   costs a little familiarity on the checklists and it buys the
   thing that matters: ▲ is wired to the emergency index from
   every content screen in the app, so help is always exactly one
   press away instead of "back out, scroll down, open". Inside a
   drill, ▲ goes straight to the MAYDAY script — which is what
   the drill text tells you to do.

   No ESC, no ×, no tap targets, no typing: the device has none of
   those. Values are set with ◀▶ wheels.
   ───────────────────────────────────────────────────────────── */

(() => {
  'use strict';

  const D = window.SKIPPER_DATA;
  const $ = (id) => document.getElementById(id);

  /* ═══════════════════ PERSISTENCE ═══════════════════
     A rental is the same boat for a week, and a checklist half
     done at the dock must survive the browser reloading in a
     pocket. Everything the user has told the app is local. */
  const LS = {
    boat: 'skipper.boat',
    ticks: 'skipper.ticks',
    values: 'skipper.values',
  };
  const readJSON = (k, fallback) => {
    try { return JSON.parse(localStorage.getItem(k)) ?? fallback; }
    catch { return fallback; }
  };
  const writeJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };

  const state = {
    screen: 'boat',
    boatKey: null,
    boatIdx: 0,
    homeIdx: 1,          // index 0 is the THE DAY section header
    sosIdx: 0,
    origin: 'home',      // where ▼ and the end of a flow return to
    flow: null,          // active steps flow
    flowIsDrill: false,
    stepIdx: 0,
    checkKey: null,
    checkIdx: 0,
    editing: false,      // a checklist value row is open for ◀▶
    cardPage: 0,
    mdPage: 1,           // the script page is the one you want first
    ticks: readJSON(LS.ticks, {}),
    values: readJSON(LS.values, {}),
    geo: { state: 'idle', text: '' },
    geoWatch: null,
  };

  const boat = () => D.BOATS[state.boatKey];

  /* ═══════════════════ HELPERS ═══════════════════ */

  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 44);
  const tickKey = (listKey, item) => `${listKey}:${slug(item.text)}`;
  const isTicked = (listKey, item) => !!state.ticks[tickKey(listKey, item)];

  function setTick(listKey, item, on) {
    const k = tickKey(listKey, item);
    if (on) state.ticks[k] = 1; else delete state.ticks[k];
    writeJSON(LS.ticks, state.ticks);
  }

  /* only / not gate content to particular hulls — this is what
     makes the auxiliary-engine step exist on the Blu Water and
     the tube-pressure check exist only on the RIB */
  function forBoat(list) {
    return list.filter((it) => {
      if (it.only && !it.only.includes(state.boatKey)) return false;
      if (it.not && it.not.includes(state.boatKey)) return false;
      return true;
    });
  }

  function tokens(text) {
    const b = boat();
    if (!b) return text;
    return text
      .replace(/\{\{boat\}\}/g, b.name)
      .replace(/\{\{people\}\}/g, String(b.people))
      .replace(/\{\{loa\}\}/g, b.loa.replace(/\s*\(.*\)/, ''))
      .replace(/\{\{type\}\}/g, b.type)
      .replace(/\{\{hp\}\}/g, b.hp);
  }

  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  function settingValue(key) {
    const cfg = D.SETTINGS[key];
    const v = state.values[key];
    if (v && cfg.options.includes(v)) return v;
    return cfg.defaultValue;
  }
  function setSettingValue(key, v) {
    state.values[key] = v;
    writeJSON(LS.values, state.values);
  }

  /* ═══════════════════ SCREEN ROUTER ═══════════════════ */

  const SCREENS = {
    boat: $('scBoat'), home: $('scHome'), sos: $('scSos'), steps: $('scSteps'),
    check: $('scCheck'), card: $('scCard'), mayday: $('scMayday'),
  };

  function show(name) {
    state.screen = name;
    Object.entries(SCREENS).forEach(([k, el]) => {
      el.classList.toggle('hidden', k !== name);
      if (k === name) { el.classList.remove('m-enter'); void el.offsetWidth; el.classList.add('m-enter'); }
    });
    $('statusbar').classList.toggle('hidden', name === 'boat');
    // the GPS receiver only runs while the MAYDAY screen is open
    if (name === 'mayday') startGeo(); else stopGeo();
  }

  /* ═══════════════════ WINDOWED LISTS ═══════════════════
     Every list here is a track inside a fixed viewport, nudged
     just far enough to keep the focused row on the lens. It is
     what lets the type stay at 25px on a fourteen-item list
     instead of shrinking to fit everything at once. */
  function scrollTrack(track, viewport, activeEl) {
    if (!activeEl) return;
    const H = viewport.clientHeight;
    const top = activeEl.offsetTop;
    const bottom = top + activeEl.offsetHeight;
    const total = track.scrollHeight;
    let y = -parseFloat(track.dataset.y || '0');
    if (top < y) y = top;
    else if (bottom > y + H) y = bottom - H;
    y = Math.max(0, Math.min(y, Math.max(0, total - H)));
    track.dataset.y = String(-y);
    track.style.transform = `translateY(${-y}px)`;
  }

  /* ═══════════════════ BUILD vs PAINT ═══════════════════
     Every list is BUILT once, when its screen opens, and PAINTED
     on every move. Re-writing innerHTML on each keypress would
     restage the staggered entry animation on every press, which
     on an additive lens reads as a flicker rather than as
     polish — motion has to fire on real events, and "the
     selection moved" is not "the list arrived". */

  /* ═══════════════════ BOAT PICKER ═══════════════════ */

  function buildBoats() {
    $('boatList').innerHTML = D.BOAT_ORDER.map((k, i) => {
      const b = D.BOATS[k];
      return `<div class="row boat" style="--i:${i}">
        <div class="cell">
          <div class="label">${esc(b.name)}</div>
          <div class="sub">${esc(b.sub)}</div>
          <div class="spec">${esc(b.loa)} · ${b.people} PEOPLE · ${esc(b.hp)}</div>
        </div>
      </div>`;
    }).join('');
    paintBoats();
  }

  function paintBoats() {
    Array.from($('boatList').children).forEach((el, i) =>
      el.classList.toggle('on', i === state.boatIdx));
  }

  function chooseBoat() {
    state.boatKey = D.BOAT_ORDER[state.boatIdx];
    try { localStorage.setItem(LS.boat, state.boatKey); } catch { /* ignore */ }
    // the lifejacket count defaults to this hull's plate rating
    if (!state.values.jackets) setSettingValue('jackets', String(boat().people));
    state.homeIdx = 1;
    renderStatus();
    buildHome();
    show('home');
  }

  /* ═══════════════════ STATUS BAR ═══════════════════ */

  function renderStatus() {
    const b = boat();
    if (!b) return;
    $('sbBadge').textContent = b.badge;
    $('sbBoat').textContent = b.name;
  }

  function tickClock() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    $('sbClock').textContent = `${hh}:${mm}`;

    const due = settingValue('returnBy');
    const el = $('sbDue');
    if (!due || due === '—') { el.textContent = ''; el.classList.remove('late'); return; }
    const [dh, dm] = due.split(':').map(Number);
    const target = new Date(now);
    target.setHours(dh, dm, 0, 0);
    let mins = Math.round((target - now) / 60000);
    if (mins >= 0) {
      const h = Math.floor(mins / 60), m = mins % 60;
      el.textContent = `BACK IN ${h ? h + 'H ' : ''}${m}M`;
      el.classList.toggle('late', mins <= 30);
    } else {
      mins = -mins;
      const h = Math.floor(mins / 60), m = mins % 60;
      el.textContent = `OVERDUE ${h ? h + 'H ' : ''}${m}M`;
      el.classList.add('late');
    }
  }

  /* the local knowledge that actually changes a day's plan out
     here: in the Cyclades the breeze fills in through the middle
     of the day and drops again toward evening */
  function renderWx() {
    const h = new Date().getHours();
    const el = $('wxFlag');
    let msg = '';
    if (h < 11) msg = 'MORNING IS THE CALM WINDOW · GO UPWIND FIRST SO THE RIDE HOME IS DOWNWIND';
    else if (h < 18) msg = 'AFTERNOON · WIND USUALLY BUILDS NOW AND PEAKS MID-AFTERNOON · HEAD BACK EARLY';
    else msg = 'EVENING · LIGHT GOES FAST AND A SMALL OPEN BOAT HAS NO BUSINESS OUT AFTER DARK';
    el.textContent = msg;
    el.classList.remove('hidden');
  }

  /* ═══════════════════ HOME ═══════════════════ */

  const selectable = (row) => row.kind !== 'section';

  /* Home is rebuilt on every arrival rather than only once,
     because the checklist progress pills change while you are
     away from it — coming back from HANDOVER should show 9/14. */
  function buildHome() {
    const rows = D.MENU;
    $('homeList').innerHTML = rows.map((r, i) => {
      if (r.kind === 'section') return `<div class="row section" style="--i:${i}">${esc(r.label)}</div>`;
      let pill = '';
      let done = false;
      if (r.kind === 'check') {
        const items = forBoat(D.CHECKS[r.key].items);
        const n = items.filter((it) => isTicked(r.key, it)).length;
        done = n === items.length;
        pill = `<div class="tickpill">${n}/${items.length} ${done ? '✓ DONE' : 'DONE'}</div>`;
      }
      return `<div class="row${r.hot ? ' hot' : ''}${done ? ' done' : ''}" style="--i:${i}">
        <div class="num">${r.num ? esc(r.num) : '·'}</div>
        <div class="cell">
          <div class="label">${esc(r.label)}</div>
          <div class="sub">${esc(r.sub)}</div>
          ${pill}
        </div>
      </div>`;
    }).join('');
    renderWx();
    paintHome();
  }

  function paintHome() {
    const track = $('homeList');
    const kids = track.children;
    for (let i = 0; i < kids.length; i++) kids[i].classList.toggle('on', i === state.homeIdx);
    requestAnimationFrame(() => scrollTrack(track, track.parentElement, kids[state.homeIdx]));
  }

  function moveHome(dir) {
    const rows = D.MENU;
    let i = state.homeIdx;
    for (let n = 0; n < rows.length; n++) {
      i = (i + dir + rows.length) % rows.length;
      if (selectable(rows[i])) break;
    }
    state.homeIdx = i;
    paintHome();
  }

  function openHome() {
    const r = D.MENU[state.homeIdx];
    state.origin = 'home';
    if (r.kind === 'check') openCheck(r.key);
    else if (r.kind === 'steps') openFlow(D.FLOWS[r.key], false);
    else if (r.kind === 'card') { state.cardPage = 0; renderCard(); show('card'); }
    else if (r.kind === 'sos') { state.sosIdx = 0; buildSos(); show('sos'); }
  }

  /* ═══════════════════ EMERGENCY INDEX ═══════════════════ */

  function buildSos() {
    $('sosList').innerHTML = D.EMERGENCY.items.map((it, i) => `
      <div class="row${it.hot ? ' hot' : ''}" style="--i:${i}">
        <div class="num">${it.hot ? '!' : '·'}</div>
        <div class="cell">
          <div class="label">${esc(it.label)}</div>
          <div class="sub">${esc(it.sub)}</div>
        </div>
      </div>`).join('');
    paintSos();
  }

  function paintSos() {
    const track = $('sosList');
    const kids = track.children;
    $('sosCount').textContent = `${state.sosIdx + 1}/${D.EMERGENCY.items.length}`;
    for (let i = 0; i < kids.length; i++) kids[i].classList.toggle('on', i === state.sosIdx);
    requestAnimationFrame(() => scrollTrack(track, track.parentElement, kids[state.sosIdx]));
  }

  function openSosItem() {
    const it = D.EMERGENCY.items[state.sosIdx];
    state.origin = 'sos';
    if (it.kind === 'mayday') { state.mdPage = 1; renderMayday(); show('mayday'); }
    else openFlow(D.DRILLS[it.key], true);
  }

  /* ═══════════════════ STEP FLOWS ═══════════════════ */

  function openFlow(flow, isDrill) {
    state.flow = { ...flow, steps: forBoat(flow.steps) };
    state.flowIsDrill = isDrill;
    state.stepIdx = 0;
    renderStep();
    show('steps');
  }

  function renderStep() {
    const f = state.flow;
    const s = f.steps[state.stepIdx];
    $('stHead').classList.toggle('hot', state.flowIsDrill);
    $('stTitle').textContent = f.title;
    $('stCount').textContent = `${state.stepIdx + 1}/${f.steps.length}`;

    const doEl = $('stDo');
    doEl.textContent = tokens(s.do);
    doEl.style.animation = 'none'; void doEl.offsetWidth; doEl.style.animation = '';

    $('stWhy').textContent = tokens(s.why || '');
    $('stWhy').classList.toggle('hidden', !s.why);

    const w = $('stWatch');
    w.classList.toggle('hidden', !s.watch);
    if (s.watch) $('stWatchText').textContent = tokens(s.watch);

    $('stDots').innerHTML = f.steps.map((_, i) =>
      `<i class="${i < state.stepIdx ? 'done' : i === state.stepIdx ? 'now' : ''}"></i>`).join('');

    // inside a drill, ▲ jumps straight to the MAYDAY script,
    // because that is what several of the drills tell you to do
    const hint = document.querySelector('#scSteps .sos-hint');
    if (hint) hint.innerHTML = state.flowIsDrill ? '<b>▲</b> MAYDAY' : '<b>▲</b> SOS';

    fitDo();
  }

  /* The instruction is the whole screen, so it is sized to the
     space it actually has rather than to a guess: shrink from
     46px until the longest step fits its box without clipping. */
  function fitDo() {
    const el = $('stDo');
    const body = document.querySelector('#scSteps .stepbody');
    requestAnimationFrame(() => {
      const others = Array.from(body.children).filter((c) => c !== el && !c.classList.contains('hidden'));
      const gaps = 13 * Math.max(0, others.length);
      const used = others.reduce((a, c) => a + c.offsetHeight, 0) + gaps;
      const avail = Math.max(80, body.clientHeight - used);
      for (let size = 46; size >= 24; size -= 2) {
        el.style.setProperty('--do-size', `${size}px`);
        if (el.scrollHeight <= avail) break;
      }
    });
  }

  function stepNext() {
    if (state.stepIdx < state.flow.steps.length - 1) { state.stepIdx++; renderStep(); }
    else backToMenu();
  }
  function stepPrev() {
    if (state.stepIdx > 0) { state.stepIdx--; renderStep(); }
    else backToMenu();
  }

  function backToMenu() {
    if (state.origin === 'sos') { buildSos(); show('sos'); }
    else { buildHome(); show('home'); }
  }

  /* ═══════════════════ CHECKLISTS ═══════════════════ */

  function openCheck(key) {
    state.checkKey = key;
    state.editing = false;
    const items = forBoat(D.CHECKS[key].items);
    // land on the first thing still outstanding, not on item one
    const first = items.findIndex((it) => !isTicked(key, it));
    state.checkIdx = first === -1 ? 0 : first;
    buildCheck();
    show('check');
  }

  function buildCheck() {
    const c = D.CHECKS[state.checkKey];
    $('ckTitle').textContent = c.title;
    $('ckList').innerHTML = forBoat(c.items).map((it, i) => `
      <div class="ck-row" style="--i:${i}">
        <div class="ck-box"></div>
        <div>
          <div class="ck-text">${esc(tokens(it.text))}</div>
          ${it.type === 'set' ? '<div class="ck-val"></div>' : ''}
        </div>
      </div>`).join('');
    paintCheck();
  }

  /* Painted in place: the tick glyph is only inserted when the
     state actually changes, so its 220ms pop fires once per tick
     instead of on every repaint. */
  function paintCheck() {
    const c = D.CHECKS[state.checkKey];
    const items = forBoat(c.items);
    const track = $('ckList');
    const kids = track.children;
    let doneCount = 0;

    items.forEach((it, i) => {
      const row = kids[i];
      if (!row) return;
      const ticked = isTicked(state.checkKey, it);
      if (ticked) doneCount++;
      row.classList.toggle('on', i === state.checkIdx);
      row.classList.toggle('ticked', ticked);
      row.classList.toggle('editing', i === state.checkIdx && state.editing);

      const box = row.querySelector('.ck-box');
      const hasGlyph = !!box.firstChild;
      if (ticked && !hasGlyph) box.innerHTML = '<span>✓</span>';
      else if (!ticked && hasGlyph) box.innerHTML = '';

      if (it.type === 'set') {
        const v = row.querySelector('.ck-val');
        const next = settingValue(it.setting);
        if (v.textContent !== next) v.textContent = next;
      }
    });

    $('ckCount').textContent = `${doneCount}/${items.length}`;
    $('ckFill').style.width = `${(doneCount / items.length) * 100}%`;

    const active = items[state.checkIdx];
    const note = $('ckNote');
    if (state.editing) {
      note.classList.remove('intro');
      note.innerHTML = `<b style="color:var(--sun)">${esc(D.SETTINGS[active.setting].label)}</b> — ◀ ▶ to change it, ⏎ to keep it.`;
    } else if (doneCount === 0 && state.checkIdx === 0) {
      note.classList.add('intro');
      note.textContent = c.intro;
    } else {
      note.classList.remove('intro');
      note.textContent = tokens(active.note || '');
    }

    // the hint strip tells the truth about what ◀▶ do right now
    $('ckHints').innerHTML = state.editing
      ? '<span><b>◀▶</b> CHANGE</span><span class="hsep">·</span><span><b>⏎</b> KEEP</span><span class="hsep">·</span><span><b>▼</b> CANCEL</span>'
      : '<span><b>◀▶</b> MOVE</span><span class="hsep">·</span><span><b>⏎</b> TICK</span><span class="hsep">·</span><span><b>▼</b> MENU</span><span class="hsep">·</span><span class="sos-hint"><b>▲</b> SOS</span>';

    requestAnimationFrame(() => scrollTrack(track, track.parentElement, kids[state.checkIdx]));
  }

  function moveCheck(dir) {
    const items = forBoat(D.CHECKS[state.checkKey].items);
    state.checkIdx = (state.checkIdx + dir + items.length) % items.length;
    paintCheck();
  }

  /* ⏎ ticks and then jumps to the next outstanding item, so a
     dozen checks clears in a dozen presses with no navigating. */
  function actCheck() {
    const items = forBoat(D.CHECKS[state.checkKey].items);
    const it = items[state.checkIdx];

    if (it.type === 'set' && !state.editing) { state.editing = true; paintCheck(); return; }
    if (state.editing) {
      state.editing = false;
      setTick(state.checkKey, it, true);
      advanceCheck(items);
      return;
    }
    setTick(state.checkKey, it, !isTicked(state.checkKey, it));
    if (isTicked(state.checkKey, it)) advanceCheck(items); else paintCheck();
  }

  function advanceCheck(items) {
    let next = -1;
    for (let n = 1; n <= items.length; n++) {
      const i = (state.checkIdx + n) % items.length;
      if (!isTicked(state.checkKey, items[i])) { next = i; break; }
    }
    if (next !== -1) state.checkIdx = next;
    paintCheck();
  }

  function spinValue(dir) {
    const items = forBoat(D.CHECKS[state.checkKey].items);
    const it = items[state.checkIdx];
    const cfg = D.SETTINGS[it.setting];
    const cur = cfg.options.indexOf(settingValue(it.setting));
    const next = (cur + dir + cfg.options.length) % cfg.options.length;
    setSettingValue(it.setting, cfg.options[next]);
    paintCheck();
    tickClock();
  }

  /* ═══════════════════ BOAT CARD ═══════════════════ */

  function renderCard() {
    const b = boat();
    const cf = '<span class="cf">CONFIRM</span>';
    const rowsA = [
      ['HULL', esc(b.sub), false, 'big'],
      ['LENGTH', `<span class="mono">${esc(b.loa)}</span>`, false, 'big'],
      ['BEAM · DRAFT', `<span class="mono">${esc(b.beam)} · ${esc(b.draft)}</span>`, b.beamConfirm],
      ['PEOPLE', `<span class="mono">${b.people}</span> MAXIMUM · LOAD ${esc(b.maxLoad)}`],
      ['ENGINE', esc(b.hp), b.hpConfirm],
      ['FUEL', esc(b.fuel), b.fuelConfirm],
      ['CE CATEGORY', esc(b.ce), b.ceConfirm],
      ['LICENCE', esc(b.licence), b.licenceConfirm, b.traits.bigPower ? 'warn' : ''],
    ];
    const rowsB = [
      ['BACK BY', `<span class="mono">${esc(settingValue('returnBy'))}</span>`, false, 'big'],
      ['LIFEJACKETS', `<span class="mono">${esc(settingValue('jackets'))}</span> COUNTED ABOARD`, false, 'big'],
      ['FUEL AT PICKUP', `<span class="mono">${esc(settingValue('fuel'))}</span>`, false, 'big'],
      ['FUEL RULE', 'ONE THIRD OUT · ONE THIRD BACK · ONE THIRD UNTOUCHED'],
      ['ANCHOR RULE', 'ROPE OUT = FIVE TIMES THE DEPTH · MORE IF IT BLOWS'],
      ['DISTRESS', 'VHF CHANNEL 16 · 112 ANY NETWORK · 108 COAST GUARD'],
    ];
    const page = state.cardPage === 0 ? rowsA : rowsB;

    $('cdTitle').textContent = state.cardPage === 0 ? 'BOAT CARD' : 'YOUR SETTINGS';
    $('cdCount').textContent = `${state.cardPage + 1}/2`;

    const grid = page.map(([k, v, confirm, cls], i) => `
      <div class="cg" style="--i:${i}">
        <div class="cg-k">${esc(k)}</div>
        <div class="cg-v ${cls || ''}">${v}${confirm ? cf : ''}</div>
      </div>`).join('');

    const tail = state.cardPage === 0
      ? `<div class="card-note">${esc(b.character)}</div>
         <div class="card-foot">CONFIRM marks a figure that changes from boat to boat — ask at handover rather than trusting it.</div>`
      : `<div class="card-foot">Set these on the HANDOVER checklist. BACK BY drives the countdown in the top bar all day.</div>`;

    $('cardBody').innerHTML = `<div class="card-grid">${grid}</div>${tail}`;
  }

  /* ═══════════════════ MAYDAY ═══════════════════
     Live position matters more than anything else on this screen:
     a lat/long read off the lens is the difference between a
     rescue that goes straight to you and one that searches. */

  function startGeo() {
    if (state.geoWatch !== null) return;
    if (!navigator.geolocation) {
      state.geo = { state: 'off', text: '' };
      if (state.screen === 'mayday') renderMayday();
      return;
    }
    // repaint immediately so the first frame says ACQUIRING rather
    // than showing the no-GPS fallback for as long as the fix takes
    state.geo = { state: 'wait', text: '' };
    if (state.screen === 'mayday') renderMayday();
    state.geoWatch = navigator.geolocation.watchPosition(
      (p) => {
        state.geo = { state: 'ok', text: formatPos(p.coords.latitude, p.coords.longitude) };
        if (state.screen === 'mayday') renderMayday();
      },
      () => {
        state.geo = { state: 'err', text: '' };
        if (state.screen === 'mayday') renderMayday();
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 },
    );
  }

  function stopGeo() {
    if (state.geoWatch !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(state.geoWatch);
    }
    state.geoWatch = null;
  }

  /* degrees and decimal minutes — the format you read over VHF
     and the format a coastguard plotter expects */
  function formatPos(lat, lon) {
    const one = (v, pos, neg, degPad) => {
      const hemi = v >= 0 ? pos : neg;
      const a = Math.abs(v);
      const deg = Math.floor(a);
      const min = (a - deg) * 60;
      return `${String(deg).padStart(degPad, '0')}° ${min.toFixed(3).padStart(6, '0')}' ${hemi}`;
    };
    return `${one(lat, 'N', 'S', 2)}   ${one(lon, 'E', 'W', 3)}`;
  }

  function posMarkup() {
    if (state.geo.state === 'ok') return `<span class="pos">${esc(state.geo.text)}</span>`;
    if (state.geo.state === 'wait') return `<span class="pos waiting">ACQUIRING GPS…</span>`;
    return `<span class="pos waiting">NO GPS — SAY WHAT YOU CAN SEE ASHORE</span>`;
  }

  function renderMayday() {
    const pages = D.MAYDAY.pages;
    const p = pages[state.mdPage];
    $('mdCount').textContent = `${state.mdPage + 1}/${pages.length}`;
    $('mdTabs').innerHTML = pages.map((pg, i) =>
      `<div class="md-tab${i === state.mdPage ? ' on' : ''}">${esc(pg.label)}</div>`).join('');

    let body = `<div class="md-head">${esc(p.head)}</div>`;
    if (p.script) {
      body += '<div class="md-script">' + p.script.map((l, i) => {
        const cls = l.big ? 'ms big' : l.hint ? 'ms hint' : 'ms';
        const text = esc(tokens(l.t));
        return `<div class="${cls}" style="--i:${i}">${text}${l.pos ? posMarkup() : ''}</div>`;
      }).join('') + '</div>';
    } else {
      body += '<div class="md-lines">' + p.lines.map(([k, v], i) =>
        `<div class="md-line" style="--i:${i}"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div></div>`).join('') + '</div>';
    }
    body += `<div class="md-foot">${esc(p.foot)}</div>`;
    $('mdBody').innerHTML = body;
  }

  /* ═══════════════════ INPUT ═══════════════════ */

  function press(el) {
    if (!el) return;
    el.classList.remove('m-press'); void el.offsetWidth; el.classList.add('m-press');
  }

  function handle(k) {
    switch (state.screen) {

      case 'boat':
        if (k === 'up')   { state.boatIdx = (state.boatIdx - 1 + D.BOAT_ORDER.length) % D.BOAT_ORDER.length; paintBoats(); }
        if (k === 'down') { state.boatIdx = (state.boatIdx + 1) % D.BOAT_ORDER.length; paintBoats(); }
        if (k === 'ok' || k === 'right') chooseBoat();
        return;

      case 'home':
        if (k === 'up')    moveHome(-1);
        if (k === 'down')  moveHome(1);
        if (k === 'ok' || k === 'right') { press($('homeList').children[state.homeIdx]); openHome(); }
        if (k === 'left')  { buildBoats(); show('boat'); }
        return;

      case 'sos':
        if (k === 'up')    { state.sosIdx = (state.sosIdx - 1 + D.EMERGENCY.items.length) % D.EMERGENCY.items.length; paintSos(); }
        if (k === 'down')  { state.sosIdx = (state.sosIdx + 1) % D.EMERGENCY.items.length; paintSos(); }
        if (k === 'ok' || k === 'right') { press($('sosList').children[state.sosIdx]); openSosItem(); }
        if (k === 'left')  { buildHome(); show('home'); }
        return;

      case 'steps':
        if (k === 'right' || k === 'ok') stepNext();
        if (k === 'left')  stepPrev();
        if (k === 'down')  backToMenu();
        if (k === 'up') {
          // in a drill, ▲ is the MAYDAY script; elsewhere it is the index
          if (state.flowIsDrill) { state.origin = 'sos'; state.mdPage = 1; renderMayday(); show('mayday'); }
          else { state.origin = 'home'; state.sosIdx = 0; buildSos(); show('sos'); }
        }
        return;

      case 'check':
        if (state.editing) {
          if (k === 'left')  spinValue(-1);
          if (k === 'right') spinValue(1);
          if (k === 'ok')    actCheck();
          if (k === 'down')  { state.editing = false; paintCheck(); }
          // ▲ is never swallowed by a mode — help stays one press away
          if (k === 'up')    { state.editing = false; paintCheck(); state.origin = 'home'; state.sosIdx = 0; buildSos(); show('sos'); }
          return;
        }
        if (k === 'left')  moveCheck(-1);
        if (k === 'right') moveCheck(1);
        if (k === 'ok')    { press($('ckList').children[state.checkIdx]); actCheck(); }
        if (k === 'down')  { buildHome(); show('home'); }
        if (k === 'up')    { state.origin = 'home'; state.sosIdx = 0; buildSos(); show('sos'); }
        return;

      case 'card':
        if (k === 'right') { state.cardPage = 1; renderCard(); }
        if (k === 'left')  { if (state.cardPage === 1) { state.cardPage = 0; renderCard(); } else backToMenu(); }
        if (k === 'ok')    { state.cardPage = state.cardPage === 0 ? 1 : 0; renderCard(); }
        if (k === 'down')  backToMenu();
        if (k === 'up')    { state.origin = 'home'; state.sosIdx = 0; buildSos(); show('sos'); }
        return;

      case 'mayday': {
        const n = D.MAYDAY.pages.length;
        if (k === 'right' || k === 'ok') { state.mdPage = (state.mdPage + 1) % n; renderMayday(); }
        if (k === 'left') {
          if (state.mdPage > 0) { state.mdPage--; renderMayday(); }
          else { state.sosIdx = 0; buildSos(); show('sos'); }
        }
        if (k === 'down') { state.sosIdx = 0; buildSos(); show('sos'); }
        return;
      }
    }
  }

  const KEYMAP = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    Enter: 'ok', ' ': 'ok',
  };

  document.addEventListener('keydown', (e) => {
    const k = KEYMAP[e.key];
    if (!k) return;
    e.preventDefault();
    handle(k);
  });

  /* touchpad swipes mirror the D-pad, which is how the gesture
     apps in this repo behave — same contract, no new vocabulary */
  let t0 = null;
  document.addEventListener('touchstart', (e) => {
    const t = e.changedTouches[0];
    t0 = { x: t.clientX, y: t.clientY };
  }, { passive: true });
  document.addEventListener('touchend', (e) => {
    if (!t0) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - t0.x, dy = t.clientY - t0.y;
    t0 = null;
    if (Math.abs(dx) < 32 && Math.abs(dy) < 32) { handle('ok'); return; }
    if (Math.abs(dx) > Math.abs(dy)) handle(dx > 0 ? 'right' : 'left');
    else handle(dy > 0 ? 'down' : 'up');
  }, { passive: true });

  /* ═══════════════════ ?state= ROUTING ═══════════════════
     Deterministic screenshots, and a way to link straight to a
     screen. ?boat=mostro selects the hull first, so a capture
     can show the RIB-only steps. */
  function applyStateParam() {
    const q = new URLSearchParams(location.search);
    const b = (q.get('boat') || '').toLowerCase();
    if (D.BOATS[b]) {
      state.boatIdx = D.BOAT_ORDER.indexOf(b);
      state.boatKey = b;
      if (!state.values.jackets) setSettingValue('jackets', String(boat().people));
      renderStatus();
    }

    const raw = (q.get('state') || '').toLowerCase();
    if (!raw) return;

    if (raw === 'boat') { buildBoats(); show('boat'); return; }
    if (!state.boatKey) { state.boatKey = D.BOAT_ORDER[0]; renderStatus(); }

    if (raw === 'home') { buildHome(); show('home'); return; }
    if (raw === 'sos' || raw === 'emergency') { state.sosIdx = 0; buildSos(); show('sos'); return; }
    if (raw === 'card' || raw === 'card-1') { state.cardPage = 0; renderCard(); show('card'); return; }
    if (raw === 'card-2' || raw === 'settings') { state.cardPage = 1; renderCard(); show('card'); return; }

    const md = raw.match(/^mayday(?:-(\d))?$/);
    if (md) {
      state.origin = 'sos';
      state.mdPage = md[1] ? Math.min(Math.max(+md[1] - 1, 0), D.MAYDAY.pages.length - 1) : 1;
      renderMayday(); show('mayday'); return;
    }

    const m = raw.match(/^([a-z0-9]+?)(?:-step-(\d+))?$/);
    const key = m ? m[1] : raw;
    const stepN = m && m[2] ? Math.max(1, +m[2]) : 1;

    if (D.CHECKS[key]) {
      openCheck(key);
      const items = forBoat(D.CHECKS[key].items);
      state.checkIdx = Math.min(stepN - 1, items.length - 1);
      paintCheck();
      return;
    }
    if (D.FLOWS[key]) {
      state.origin = 'home';
      openFlow(D.FLOWS[key], false);
      state.stepIdx = Math.min(stepN - 1, state.flow.steps.length - 1);
      renderStep(); return;
    }
    if (D.DRILLS[key]) {
      state.origin = 'sos';
      openFlow(D.DRILLS[key], true);
      state.stepIdx = Math.min(stepN - 1, state.flow.steps.length - 1);
      renderStep(); return;
    }
  }

  /* ═══════════════════ BOOT ═══════════════════ */

  const saved = (() => { try { return localStorage.getItem(LS.boat); } catch { return null; } })();
  if (saved && D.BOATS[saved]) {
    state.boatKey = saved;
    state.boatIdx = D.BOAT_ORDER.indexOf(saved);
    renderStatus();
    buildHome();
    show('home');
  } else {
    buildBoats();
    show('boat');
  }

  tickClock();
  setInterval(tickClock, 15000);
  applyStateParam();
})();
