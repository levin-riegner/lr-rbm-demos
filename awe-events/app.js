/* ============================================================
   AWE SIDE-EVENTS GUIDE — Meta Display Glasses Edition
   Hierarchical D-pad nav: Home (days) -> List (events) -> Detail.
   Up/Down move focus, Enter (●) opens, Left (◀) goes back.
   Data mirrors awexr.events (L+R Guide, AWE USA 2026).
   ============================================================ */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  // ── Event data ────────────────────────────────────────────
  // type: 'free' (RSVP) | 'public' | 'ticket' | 'info'
  const EVENTS = [
    { day: 13, start: 'ALL', name: "Android XR Hackathon: Build for XREAL's Project Aura", time: '9:00 AM – 9:00 PM PDT', type: 'free', featured: true },

    { day: 15, start: '9:30 AM', name: 'Designed to Disappear: Why Developers Are Choosing the Even Realities G2', time: '9:30 AM – 11:30 AM PDT', type: 'free', featured: true },
    { day: 15, start: 'ALL', name: 'Mentorship Program @ AWE USA 2026', time: 'All day · see details', type: 'free' },
    { day: 15, start: 'ALL', name: 'AWE Art Festival', time: 'All day · see details', type: 'public' },
    { day: 15, start: '9:00 AM', name: 'Reality Hack at AWE 2026', time: '9:00 AM – 3:00 PM PDT', type: 'free' },
    { day: 15, start: '10:00 AM', name: 'Builder to Founder Workshop', time: '10:00 AM – 2:30 PM PDT', type: 'info' },
    { day: 15, start: '10:00 AM', name: 'XR Guild & Virtual World Society — Unconference', time: '10:00 AM – 2:30 PM PDT', type: 'free' },
    { day: 15, start: '1:00 PM', name: 'Android XR: High-Performance Development Across Engines & Form Factors', time: '1:00 PM – 2:30 PM PDT', type: 'free' },
    { day: 15, start: '3:00 PM', name: 'AWE Pride Meetup', time: '3:00 PM – 5:00 PM PDT', type: 'free' },
    { day: 15, start: '6:30 PM', name: 'AWE Mixer & Social', time: '6:30 PM – 9:30 PM PDT', type: 'free' },

    { day: 16, start: '7:00 PM', name: 'XR & Spatial Computing Meetup @ AWE — Drinks & Good Conversation', time: '7:00 PM PDT', type: 'free', featured: true },
    { day: 16, start: 'ALL', name: 'Meet the Author — Book Launch & Signing Sessions', time: 'All day · see details', type: 'public' },
    { day: 16, start: 'ALL', name: 'Abbott XR Blood Drive', time: 'All day · see details', type: 'public' },
    { day: 16, start: '2:45 PM', name: 'AWE Wellness Walk with Caitlin Krause: A Somatic & Spatial Journey', time: '2:45 PM – 3:30 PM PDT', type: 'info' },
    { day: 16, start: '5:00 PM', name: 'AWE After Hours: FREE XR Mixer', time: '5:00 PM – 11:30 PM PDT', type: 'free' },
    { day: 16, start: '6:30 PM', name: 'XR Guild Ethical Professionals Dinner', time: '6:30 PM PDT', type: 'ticket' },
    { day: 16, start: '7:00 PM', name: 'XR Creator Meetup', time: '7:00 PM – 10:00 PM PDT', type: 'free' },

    { day: 17, start: '7:45 AM', name: 'XR Health, Wellness, and Wonder Morning Meetup', time: '7:45 AM – 8:30 AM PDT', type: 'info' },
    { day: 17, start: '4:00 PM', name: 'Virtual World Society XR Artifacts Auction', time: '4:00 PM – 5:30 PM PDT', type: 'info' },
    { day: 17, start: '4:00 PM', name: 'In Living Memory of Reality — An LBE & Gaming Gathering (Jadu & Cleanbox)', time: '4:00 PM – 5:30 PM PDT', type: 'info' },
    { day: 17, start: '4:00 PM', name: 'XR Women Awards', time: '4:00 PM – 5:00 PM PDT', type: 'public' },
    { day: 17, start: '7:30 PM', name: 'WORLDS COLLIDE: Unofficial Afterparty for the 17th Annual Auggie Awards', time: '7:30 PM – 12:00 AM PDT', type: 'free', featured: true },

    { day: 18, start: '12:30 PM', name: 'UX Meetup at AWE 2026', time: '12:30 PM – 1:30 PM PDT', type: 'public' },
    { day: 18, start: '3:45 PM', name: 'Best in Show Awards', time: '3:45 PM – 4:30 PM PDT', type: 'public' },
  ];

  const WEEKDAY = { 13: 'Saturday', 15: 'Monday', 16: 'Tuesday', 17: 'Wednesday', 18: 'Thursday' };
  const DAYS = [13, 15, 16, 17, 18];

  const TAG = {
    free:   { label: 'FREE · RSVP', cls: 'tag-free' },
    public: { label: 'PUBLIC',      cls: 'tag-public' },
    ticket: { label: 'TICKETED',    cls: 'tag-ticket' },
    info:   { label: 'DETAILS',     cls: '' },
  };

  // ── State ─────────────────────────────────────────────────
  const state = {
    screen: 'home',     // 'home' | 'list' | 'detail'
    homeFocus: 0,       // index into ROWS
    listFocus: 0,       // index into current event list
    rows: [],           // home rows
    current: [],        // events in the current list view
    currentTitle: '',
    currentDayLabel: '',
  };

  // Home rows: a Featured shortcut + one per day.
  function buildRows() {
    const rows = [{ kind: 'featured' }];
    DAYS.forEach((d) => rows.push({ kind: 'day', day: d }));
    state.rows = rows;
  }

  function eventsForDay(d) { return EVENTS.filter((e) => e.day === d); }
  function featuredEvents() { return EVENTS.filter((e) => e.featured); }

  // ── Time: live clock + "starts in" / "live now" logic ─────
  // `now` is the real device clock. For demos/screenshots before the
  // conference, append ?now=2026-06-15T09:10 to simulate a moment.
  function nowDate() {
    const q = new URLSearchParams(location.search).get('now');
    if (q) { const d = new Date(q); if (!isNaN(d.getTime())) return d; }
    return new Date();
  }

  function clockOf(timeStr, day) {
    const m = String(timeStr).match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!m) return null;
    let h = (+m[1]) % 12;
    if (/PM/i.test(m[3])) h += 12;
    return new Date(2026, 5, day, h, +m[2], 0, 0); // June = month index 5
  }
  function startOf(ev) { return ev.start === 'ALL' ? null : clockOf(ev.start, ev.day); }
  function endOf(ev) {
    const all = [...String(ev.time).matchAll(/(\d{1,2}):(\d{2})\s*(AM|PM)/gi)];
    if (!all.length) return null;
    const last = all[all.length - 1];
    let h = (+last[1]) % 12;
    if (/PM/i.test(last[3])) h += 12;
    let end = new Date(2026, 5, ev.day, h, +last[2], 0, 0);
    const start = startOf(ev);
    if (start && end < start) end = new Date(end.getTime() + 864e5); // crosses midnight
    return end;
  }

  // → { kind: 'live' | 'soon' | 'none', diffMin }
  function relInfo(ev) {
    const start = startOf(ev);
    if (!start) return { kind: 'none' };
    const now = nowDate();
    const end = endOf(ev);
    if (now >= start && end && now < end) return { kind: 'live' };
    const diffMin = Math.round((start - now) / 60000);
    if (diffMin > 0 && diffMin <= 180) return { kind: 'soon', diffMin };
    return { kind: 'none' };
  }
  function shortIn(min) { return min < 60 ? min + 'm' : Math.floor(min / 60) + 'h ' + (min % 60) + 'm'; }
  function longIn(min) {
    if (min < 60) return 'Starts in ' + min + ' min';
    const h = Math.floor(min / 60), m = min % 60;
    return 'Starts in ' + h + ' hr' + (h > 1 ? 's' : '') + (m ? ' ' + m + ' min' : '');
  }

  function fmtClock(d) {
    let h = d.getHours(); const m = d.getMinutes(); const ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12; if (h === 0) h = 12;
    return h + ':' + (m < 10 ? '0' + m : m) + ' ' + ap;
  }

  // Inner HTML + class for an event's time column.
  function timeCol(ev) {
    const rel = relInfo(ev);
    if (rel.kind === 'live') {
      return { cls: 'is-live', html: '<span class="t-main">LIVE</span><span class="t-ampm">NOW</span>' };
    }
    if (rel.kind === 'soon') {
      return { cls: 'is-soon', html: '<span class="t-lead">STARTS IN</span><span class="t-main">' + shortIn(rel.diffMin) + '</span>' };
    }
    if (ev.start === 'ALL') {
      return { cls: 'is-allday', html: '<span class="t-main">ALL</span><span class="t-ampm">DAY</span>' };
    }
    const main = ev.start.replace(/\s?(AM|PM)$/i, '');
    const ampm = (ev.start.match(/AM|PM/i) || [''])[0];
    return { cls: '', html: '<span class="t-main">' + main + '</span><span class="t-ampm">' + ampm + '</span>' };
  }

  // Hero time string for the detail screen.
  function heroTime(ev) {
    const rel = relInfo(ev);
    if (rel.kind === 'live') return 'Live Now';
    if (rel.kind === 'soon') return longIn(rel.diffMin);
    return ev.start === 'ALL' ? 'All Day' : ev.start;
  }

  // ── Audio — subtle Web Audio UI cues ──────────────────────
  let _actx = null;
  function audioCtx() {
    if (!_actx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) _actx = new AC();
    }
    if (_actx && _actx.state === 'suspended') _actx.resume();
    return _actx;
  }
  function tone(freq, dur, type, peak) {
    const c = audioCtx();
    if (!c) return;
    const t = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak || 0.05, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  // C5 click on move; rising D5→A5 on open; falling A4→E4 on back.
  function sndTick() { tone(523.25, 0.055, 'triangle', 0.03); }
  function sndOpen() { tone(587.33, 0.07, 'sine', 0.05); setTimeout(function () { tone(880.0, 0.1, 'sine', 0.05); }, 45); }
  function sndBack() { tone(440.0, 0.08, 'sine', 0.045); setTimeout(function () { tone(329.63, 0.1, 'sine', 0.04); }, 45); }

  // ── Render: HOME ──────────────────────────────────────────
  function renderHome() {
    const ul = $('day-list');
    ul.innerHTML = '';
    state.rows.forEach((row) => {
      const li = document.createElement('li');
      if (row.kind === 'featured') {
        const n = featuredEvents().length;
        li.className = 'day-item is-featured';
        li.innerHTML =
          '<span class="di-num di-star">★</span>' +
          '<span class="di-main"><span class="di-label">Featured</span>' +
          '<span class="di-meta">' + n + ' highlighted events</span></span>' +
          '<span class="di-arrow">›</span>';
      } else {
        const n = eventsForDay(row.day).length;
        li.className = 'day-item';
        li.innerHTML =
          '<span class="di-num">' + row.day + '<span class="di-mon">JUN</span></span>' +
          '<span class="di-main"><span class="di-label">' + WEEKDAY[row.day] + '</span>' +
          '<span class="di-meta">' + n + (n === 1 ? ' event' : ' events') + '</span></span>' +
          '<span class="di-arrow">›</span>';
      }
      ul.appendChild(li);
    });
    updateHomeFocus(false);
  }

  function updateHomeFocus(animate) {
    const ul = $('day-list');
    for (let i = 0; i < ul.children.length; i++) {
      ul.children[i].classList.toggle('focused', i === state.homeFocus);
    }
    const el = ul.children[state.homeFocus];
    if (el) el.scrollIntoView({ block: 'nearest', behavior: animate ? 'smooth' : 'auto' });
  }

  // ── Render: LIST ──────────────────────────────────────────
  function openList(row) {
    if (row.kind === 'featured') {
      state.current = featuredEvents();
      state.currentTitle = '★ FEATURED';
      state.currentDayLabel = 'Featured';
    } else {
      state.current = eventsForDay(row.day);
      state.currentTitle = 'JUN ' + row.day;
      state.currentDayLabel = WEEKDAY[row.day] + ', Jun ' + row.day;
    }
    state.listFocus = 0;
    sndOpen();
    showScreen('list');
    renderList();
  }

  function renderList() {
    $('list-title').textContent = state.currentTitle;
    $('list-count').textContent = state.current.length;
    const ul = $('event-feed');
    ul.innerHTML = '';
    state.current.forEach((ev) => {
      const li = document.createElement('li');
      const tc = timeCol(ev);
      li.className = 'event-item' + (ev.featured ? ' is-featured' : '') + (tc.cls ? ' ' + tc.cls : '');
      const tag = TAG[ev.type];
      li.innerHTML =
        '<span class="ev-time ' + tc.cls + '">' + tc.html + '</span>' +
        '<span class="ev-body"><span class="ev-name">' + esc(ev.name) + '</span>' +
        '<span class="ev-tag ' + tag.cls + '">' + tag.label + '</span></span>' +
        '<span class="ev-star">★</span>';
      ul.appendChild(li);
    });
    updateListFocus(false);
  }

  function updateListFocus(animate) {
    const ul = $('event-feed');
    for (let i = 0; i < ul.children.length; i++) {
      ul.children[i].classList.toggle('focused', i === state.listFocus);
    }
    const el = ul.children[state.listFocus];
    if (el) el.scrollIntoView({ block: 'nearest', behavior: animate ? 'smooth' : 'auto' });
  }

  // Update the live clock + any time-sensitive labels in place,
  // without rebuilding lists (preserves focus + scroll position).
  function refreshTimes() {
    const c = $('clock');
    if (c) c.textContent = fmtClock(nowDate());

    if (state.screen === 'list') {
      const ul = $('event-feed');
      state.current.forEach((ev, i) => {
        const li = ul.children[i];
        if (!li) return;
        const tc = timeCol(ev);
        const tEl = li.querySelector('.ev-time');
        if (tEl) { tEl.className = 'ev-time ' + tc.cls; tEl.innerHTML = tc.html; }
        li.classList.remove('is-live', 'is-soon', 'is-allday');
        if (tc.cls) li.classList.add(tc.cls);
      });
    } else if (state.screen === 'detail' && state.detailEvent) {
      $('detail-time').textContent = heroTime(state.detailEvent);
    }
  }

  // ── Render: DETAIL ────────────────────────────────────────
  function openDetail(ev) {
    state.detailEvent = ev;
    $('detail-day').textContent = 'JUN ' + ev.day;
    $('detail-time').textContent = heroTime(ev);
    $('detail-name').textContent = ev.name;
    $('detail-date').textContent = (WEEKDAY[ev.day] || '') + ', Jun ' + ev.day + ', 2026';
    $('detail-full-time').textContent = ev.time;
    const tag = TAG[ev.type];
    const tagEl = $('detail-tag');
    tagEl.textContent = tag.label;
    tagEl.className = 'detail-tag ' + tag.cls;
    $('detail-star').className = 'detail-star' + (ev.featured ? '' : ' hidden-star');
    sndOpen();
    showScreen('detail');
  }

  // ── Screen switch ─────────────────────────────────────────
  function showScreen(name) {
    state.screen = name;
    ['home', 'list', 'detail'].forEach((s) => {
      $(s).classList.toggle('hidden', s !== name);
    });
  }

  // ── Input (D-pad / Neural Band) ───────────────────────────
  function onKey(e) {
    const k = e.key;

    if (state.screen === 'home') {
      if (k === 'ArrowUp')        { e.preventDefault(); moveHome(-1); }
      else if (k === 'ArrowDown') { e.preventDefault(); moveHome(+1); }
      else if (k === 'Enter' || k === ' ' || k === 'ArrowRight') {
        e.preventDefault(); openList(state.rows[state.homeFocus]);
      }
      return;
    }

    if (state.screen === 'list') {
      if (k === 'ArrowUp')        { e.preventDefault(); moveList(-1); }
      else if (k === 'ArrowDown') { e.preventDefault(); moveList(+1); }
      else if (k === 'ArrowLeft' || k === 'Escape' || k === 'Backspace') {
        e.preventDefault(); sndBack(); showScreen('home'); renderHome();
      }
      else if (k === 'Enter' || k === ' ' || k === 'ArrowRight') {
        e.preventDefault(); openDetail(state.current[state.listFocus]);
      }
      return;
    }

    if (state.screen === 'detail') {
      if (k === 'ArrowLeft' || k === 'Escape' || k === 'Backspace' ||
          k === 'Enter' || k === ' ') {
        e.preventDefault(); sndBack(); showScreen('list'); renderList();
      }
    }
  }

  function moveHome(d) {
    const n = state.rows.length;
    state.homeFocus = (state.homeFocus + d + n) % n;
    updateHomeFocus(true);
    sndTick();
  }
  function moveList(d) {
    const n = state.current.length;
    if (!n) return;
    state.listFocus = (state.listFocus + d + n) % n;
    updateListFocus(true);
    sndTick();
  }

  // ── Utils ─────────────────────────────────────────────────
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  // ── Bootstrap ─────────────────────────────────────────────
  function init() {
    buildRows();
    renderHome();
    showScreen('home');
    refreshTimes();
    setInterval(refreshTimes, 10000);
    window.addEventListener('keydown', onKey);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
