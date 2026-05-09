(function () {
  'use strict';

  // ── State ─────────────────────────────────────────────────────────────────
  var state = {
    currentScreen: 'ambient',
    history: [],
    filter: 'today',       // 'today' | 'tomorrow' | 'week' | 'day'
    filterDate: null,
    selectedEventId: null,
    selectedWeekDay: null,
    weekOffset: 0,
    clockInterval: null,
    animFrame: null,
    particles: []
  };

  var screens = {};
  var canvas, ctx;

  // ── Date helpers ──────────────────────────────────────────────────────────
  function today() {
    return fmtDate(new Date());
  }

  function fmtDate(d) {
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function fmtTimeShort(hhmm) {
    var p = hhmm.split(':'), h = parseInt(p[0], 10), m = p[1];
    return (h % 12 || 12) + ':' + m + (h >= 12 ? 'P' : 'A');
  }

  function fmtTimeLong(hhmm) {
    var p = hhmm.split(':'), h = parseInt(p[0], 10), m = p[1];
    return (h % 12 || 12) + ':' + m + ' ' + (h >= 12 ? 'PM' : 'AM');
  }

  function nowMins() {
    var d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  }

  function toMins(hhmm) {
    var p = hhmm.split(':');
    return parseInt(p[0], 10) * 60 + parseInt(p[1], 10);
  }

  function minsToHM(m) {
    if (m <= 0) return '0m';
    var h = Math.floor(m / 60), mm = m % 60;
    if (h && mm) return h + 'h ' + mm + 'm';
    return h ? h + 'h' : mm + 'm';
  }

  function durationMins(ev) {
    return toMins(ev.endTime) - toMins(ev.startTime);
  }

  function eventStatus(ev, dateStr) {
    var t = today();
    if (dateStr < t) return 'past';
    if (dateStr > t) return 'future';
    var now = nowMins(), s = toMins(ev.startTime), e = toMins(ev.endTime);
    if (now >= e)         return 'past';
    if (now >= s)         return 'now';
    if (s - now <= 30)    return 'soon';
    return 'future';
  }

  function getDateLabel(dateStr) {
    var t = today();
    if (dateStr === t) return 'Today';
    var tm = new Date(); tm.setDate(tm.getDate() + 1);
    if (dateStr === fmtDate(tm)) return 'Tomorrow';
    var d = new Date(dateStr + 'T00:00:00');
    var DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return DAYS[d.getDay()] + ' ' + MONTHS[d.getMonth()] + ' ' + d.getDate();
  }

  function getWeekDays() {
    var d = new Date();
    d.setDate(d.getDate() + state.weekOffset * 7);
    var start = new Date(d);
    start.setDate(d.getDate() - d.getDay());
    return Array.from({ length: 7 }, function (_, i) {
      var dd = new Date(start);
      dd.setDate(start.getDate() + i);
      return fmtDate(dd);
    });
  }

  function eventsForDate(dateStr) {
    return CALENDAR_DATA.events
      .filter(function (ev) { return ev.date === dateStr; })
      .sort(function (a, b) { return toMins(a.startTime) - toMins(b.startTime); });
  }

  function getNextEvent() {
    var now = nowMins();
    return eventsForDate(today()).find(function (ev) {
      return toMins(ev.startTime) > now;
    }) || null;
  }

  function getCurrentEvent() {
    var now = nowMins();
    return eventsForDate(today()).find(function (ev) {
      return now >= toMins(ev.startTime) && now < toMins(ev.endTime);
    }) || null;
  }

  function getFreeHours() {
    var busy = eventsForDate(today()).reduce(function (acc, ev) {
      return ev.type !== 'break' ? acc + durationMins(ev) : acc;
    }, 0);
    return Math.round(Math.max(0, 480 - busy) / 60 * 10) / 10;
  }

  function imminenceScore(ev, dateStr) {
    if (dateStr !== today()) return 0;
    var diff = toMins(ev.startTime) - nowMins();
    if (diff < 0 || diff > 240) return 0;
    return Math.max(0, 1 - diff / 240);
  }

  function typeColor(type) {
    return { meeting: '#6fd3ff', task: '#c89dff', personal: '#ffcf6b',
             busy: '#ff7ac0', break: '#ff9a5a' }[type] || '#6fd3ff';
  }

  // ── Navigation ────────────────────────────────────────────────────────────
  function navigateTo(screenId, opts) {
    opts = opts || {};
    if (opts.addToHistory !== false && state.currentScreen) {
      state.history.push(state.currentScreen);
    }
    Object.values(screens).forEach(function (el) { el.classList.add('hidden'); });
    screens[screenId].classList.remove('hidden');
    state.currentScreen = screenId;
    onScreenEnter(screenId);
    focusFirst(screens[screenId]);
  }

  function navigateBack() {
    if (!state.history.length) return;
    var prev = state.history.pop();
    Object.values(screens).forEach(function (el) { el.classList.add('hidden'); });
    screens[prev].classList.remove('hidden');
    state.currentScreen = prev;
    onScreenEnter(prev);
    focusFirst(screens[prev]);
  }

  function onScreenEnter(id) {
    if (id === 'ambient') renderAmbient();
    if (id === 'agenda')  renderAgenda();
    if (id === 'detail')  renderDetail();
    if (id === 'week')    renderWeek();
  }

  // ── Focus ─────────────────────────────────────────────────────────────────
  function focusables(container) {
    return Array.from(container.querySelectorAll('.focusable'));
  }

  function focusFirst(container) {
    var els = focusables(container);
    if (els.length) { els[0].classList.add('focused'); els[0].focus(); }
  }

  function moveFocus(dir) {
    var container = screens[state.currentScreen];
    var els = focusables(container);
    if (!els.length) return;
    var idx = els.findIndex(function (el) { return el.classList.contains('focused'); });
    els.forEach(function (el) { el.classList.remove('focused'); });
    var next = (dir === 'down' || dir === 'right')
      ? (idx < els.length - 1 ? idx + 1 : 0)
      : (idx > 0 ? idx - 1 : els.length - 1);
    els[next].classList.add('focused');
    els[next].focus();
    els[next].scrollIntoView({ block: 'nearest' });
  }

  function triggerFocused() {
    var el = screens[state.currentScreen].querySelector('.focusable.focused, .focusable:focus');
    if (el) { var a = el.getAttribute('data-action'); if (a) handleAction(a, el); }
  }

  // ── Actions ───────────────────────────────────────────────────────────────
  function handleAction(action, el) {
    if (action === 'back') { navigateBack(); return; }

    if (action === 'go-agenda') {
      state.filter = 'today'; navigateTo('agenda'); return;
    }
    if (action === 'go-tomorrow') {
      state.filter = 'tomorrow'; navigateTo('agenda'); return;
    }
    if (action === 'go-week') {
      state.weekOffset = 0;
      if (!state.selectedWeekDay) state.selectedWeekDay = today();
      navigateTo('week'); return;
    }
    if (action === 'go-next-event') {
      var nx = getNextEvent();
      if (nx) { state.selectedEventId = nx.id; navigateTo('detail'); }
      else    { state.filter = 'today'; navigateTo('agenda'); }
      return;
    }
    if (action === 'go-current-event') {
      var cur = getCurrentEvent() || getNextEvent();
      if (cur) { state.selectedEventId = cur.id; navigateTo('detail'); }
      return;
    }

    if (action === 'filter-today')    { state.filter = 'today';    syncFilter(); renderAgenda(); return; }
    if (action === 'filter-tomorrow') { state.filter = 'tomorrow'; syncFilter(); renderAgenda(); return; }
    if (action === 'filter-week')     { state.filter = 'week';     syncFilter(); renderAgenda(); return; }

    if (action === 'open-event') {
      var id = el.getAttribute('data-event-id');
      if (id) { state.selectedEventId = id; navigateTo('detail'); }
      return;
    }
    if (action === 'prev-event') { shiftEvent(-1); return; }
    if (action === 'next-event') { shiftEvent(+1); return; }

    if (action === 'week-prev') { state.weekOffset--; renderWeek(); return; }
    if (action === 'week-next') { state.weekOffset++; renderWeek(); return; }
    if (action === 'week-select-day') {
      state.selectedWeekDay = el.getAttribute('data-date');
      renderWeek();
      var sel = document.querySelector('.week-day.selected');
      if (sel) {
        focusables(screens.week).forEach(function (f) { f.classList.remove('focused'); });
        sel.classList.add('focused'); sel.focus();
      }
      return;
    }
    if (action === 'week-open-day') {
      if (!state.selectedWeekDay) return;
      var t = today();
      var tm = new Date(); tm.setDate(tm.getDate() + 1);
      if (state.selectedWeekDay === t)          state.filter = 'today';
      else if (state.selectedWeekDay === fmtDate(tm)) state.filter = 'tomorrow';
      else { state.filter = 'day'; state.filterDate = state.selectedWeekDay; }
      navigateTo('agenda'); return;
    }
  }

  function shiftEvent(dir) {
    var all = CALENDAR_DATA.events;
    var idx = all.findIndex(function (ev) { return ev.id === state.selectedEventId; });
    var next = idx + dir;
    if (next >= 0 && next < all.length) { state.selectedEventId = all[next].id; renderDetail(); }
  }

  function syncFilter() {
    screens.agenda.querySelectorAll('.filter-chip').forEach(function (chip) {
      var a = chip.getAttribute('data-action');
      chip.classList.toggle('active',
        (a === 'filter-today'    && state.filter === 'today')   ||
        (a === 'filter-tomorrow' && state.filter === 'tomorrow') ||
        (a === 'filter-week'     && state.filter === 'week'));
    });
  }

  // ── Render: Ambient ───────────────────────────────────────────────────────
  function renderAmbient() {
    var todayEvs  = eventsForDate(today());
    var nextEv    = getNextEvent();
    var curEv     = getCurrentEvent();

    document.getElementById('ambient-event-count').textContent = todayEvs.length;

    var trZone = screens.ambient.querySelector('.zone-tr');
    if (nextEv) {
      document.getElementById('ambient-next-time').textContent = fmtTimeShort(nextEv.startTime);
      document.getElementById('ambient-next-name').textContent = nextEv.title;
      trZone.classList.toggle('shimmer', toMins(nextEv.startTime) - nowMins() <= 15);
    } else {
      document.getElementById('ambient-next-time').textContent = '—';
      document.getElementById('ambient-next-name').textContent = 'nothing scheduled';
      trZone.classList.remove('shimmer');
    }

    document.getElementById('ambient-free-hours').textContent = getFreeHours();

    var tm = new Date(); tm.setDate(tm.getDate() + 1);
    var tmEvs = eventsForDate(fmtDate(tm));
    document.getElementById('ambient-tomorrow-count').textContent = tmEvs.length;
    document.getElementById('ambient-tomorrow-first').textContent =
      tmEvs[0] ? fmtTimeShort(tmEvs[0].startTime) + ' ' + tmEvs[0].title : 'clear';

    if (curEv) {
      document.getElementById('ambient-now-label').textContent = 'NOW';
      document.getElementById('ambient-now-title').textContent = curEv.title;
      document.getElementById('ambient-now-time').textContent =
        minsToHM(toMins(curEv.endTime) - nowMins()) + ' remaining';
    } else if (nextEv) {
      document.getElementById('ambient-now-label').textContent = 'NEXT';
      document.getElementById('ambient-now-title').textContent = nextEv.title;
      document.getElementById('ambient-now-time').textContent =
        'in ' + minsToHM(toMins(nextEv.startTime) - nowMins());
    } else {
      document.getElementById('ambient-now-label').textContent = 'FREE';
      document.getElementById('ambient-now-title').textContent = 'No more events today';
      document.getElementById('ambient-now-time').textContent = '—';
    }
  }

  function renderClock() {
    var d = new Date();
    var timeEl = document.getElementById('ambient-time');
    if (timeEl) timeEl.textContent =
      String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');

    var dateEl = document.getElementById('ambient-date');
    if (dateEl) {
      var DAYS   = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];
      var MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
      dateEl.textContent = DAYS[d.getDay()] + ' · ' + MONTHS[d.getMonth()] + ' ' + d.getDate() + ' · ' + d.getFullYear();
    }
    if (state.currentScreen === 'ambient') renderAmbient();
  }

  // ── Render: Agenda ────────────────────────────────────────────────────────
  function renderAgenda() {
    syncFilter();
    var list    = document.getElementById('agenda-list');
    var dayLabel = document.getElementById('agenda-day-label');
    var statusEl = document.getElementById('agenda-status');
    var items = [];

    if (state.filter === 'week') {
      getWeekDays().forEach(function (ds) {
        eventsForDate(ds).forEach(function (ev) { items.push({ ev: ev, ds: ds }); });
      });
      dayLabel.textContent = 'This Week';
    } else {
      var ds;
      if (state.filter === 'today') {
        ds = today(); dayLabel.textContent = 'Today';
      } else if (state.filter === 'tomorrow') {
        var tm = new Date(); tm.setDate(tm.getDate() + 1);
        ds = fmtDate(tm); dayLabel.textContent = 'Tomorrow';
      } else {
        ds = state.filterDate || today(); dayLabel.textContent = getDateLabel(ds);
      }
      eventsForDate(ds).forEach(function (ev) { items.push({ ev: ev, ds: ds }); });
    }

    statusEl.textContent = items.length + ' event' + (items.length !== 1 ? 's' : '');

    if (!items.length) {
      list.innerHTML = '<div style="padding:36px 16px;text-align:center;color:var(--text-dim);font-size:12px;letter-spacing:0.1em;">NO EVENTS</div>';
      return;
    }

    var html = '', lastDs = null;
    items.forEach(function (item) {
      var ev = item.ev, ds = item.ds;
      var status = eventStatus(ev, ds);
      var col    = typeColor(ev.type);

      if (state.filter === 'week' && ds !== lastDs) {
        html += '<div class="time-separator"><div class="time-separator-line"></div><span>' +
          getDateLabel(ds) + '</span><div class="time-separator-line"></div></div>';
        lastDs = ds;
      }

      var badge = '';
      if (status === 'now')  badge = '<div class="event-badge badge-now">NOW</div>';
      if (status === 'soon') badge = '<div class="event-badge badge-soon">SOON</div>';
      if (status === 'past') badge = '<div class="event-badge badge-done">DONE</div>';

      var meta = [];
      if (ev.location) meta.push(ev.location);
      if (ev.attendeeCount > 0) meta.push(ev.attendeeCount + (ev.attendeeCount === 1 ? ' attendee' : ' attendees'));
      meta.push(minsToHM(durationMins(ev)));

      html += '<div class="event-item focusable' + (status === 'past' ? ' past' : '') +
        '" tabindex="0" data-action="open-event" data-event-id="' + ev.id + '">' +
        '<div class="event-type-bar" style="background:' + col + '"></div>' +
        '<div class="event-time-col">' +
          '<div class="event-start">' + fmtTimeShort(ev.startTime) + '</div>' +
          '<div class="event-end">'   + fmtTimeShort(ev.endTime)   + '</div>' +
        '</div>' +
        '<div class="event-info">' +
          '<div class="event-title">' + ev.title + '</div>' +
          '<div class="event-meta">'  + meta.join(' · ')  + '</div>' +
        '</div>' +
        badge + '</div>';
    });

    list.innerHTML = html;
    list.querySelectorAll('.event-item').forEach(function (item) {
      item.addEventListener('click', function () { handleAction('open-event', item); });
    });
  }

  // ── Render: Detail ────────────────────────────────────────────────────────
  function renderDetail() {
    var ev = CALENDAR_DATA.events.find(function (e) { return e.id === state.selectedEventId; });
    if (!ev) return;

    var status = eventStatus(ev, ev.date);
    var heat   = status === 'now' ? 1 : imminenceScore(ev, ev.date);

    document.getElementById('detail-type-label').textContent = ev.type.toUpperCase();
    document.getElementById('detail-date-label').textContent = getDateLabel(ev.date);
    document.getElementById('detail-time').textContent = fmtTimeLong(ev.startTime) + ' – ' + fmtTimeLong(ev.endTime);
    document.getElementById('detail-duration').textContent = minsToHM(durationMins(ev));
    document.getElementById('detail-title').textContent = ev.title;
    document.getElementById('detail-location').textContent = ev.location ? '📍 ' + ev.location : '';

    var cd = document.getElementById('detail-countdown');
    if (status === 'now') {
      cd.textContent = '▶ In progress · ' + minsToHM(toMins(ev.endTime) - nowMins()) + ' remaining';
    } else if (status === 'soon') {
      cd.textContent = '⚡ Starting in ' + minsToHM(toMins(ev.startTime) - nowMins());
    } else if (status === 'future') {
      cd.textContent = ev.date === today()
        ? 'In ' + minsToHM(toMins(ev.startTime) - nowMins())
        : getDateLabel(ev.date);
    } else {
      cd.textContent = 'Completed';
    }

    document.getElementById('detail-heat-fill').style.width = Math.round(heat * 100) + '%';

    document.getElementById('detail-tags').innerHTML = (ev.tags || [])
      .map(function (t) { return '<span class="tag-pill">' + t + '</span>'; }).join('');

    document.getElementById('detail-description').textContent = ev.description || '';

    var attEl = document.getElementById('detail-attendees');
    if (ev.attendeeCount > 0) {
      var dots = Array.from({ length: Math.min(ev.attendeeCount, 5) })
        .map(function () { return '<span class="attendee-dot">·</span>'; }).join('');
      if (ev.attendeeCount > 5) dots += '<span class="attendee-more">+' + (ev.attendeeCount - 5) + ' more</span>';
      attEl.innerHTML = dots;
    } else {
      attEl.innerHTML = '';
    }
  }

  // ── Render: Week ──────────────────────────────────────────────────────────
  function renderWeek() {
    var days = getWeekDays();
    var t = today();
    if (!state.selectedWeekDay) state.selectedWeekDay = t;

    var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var s = new Date(days[0] + 'T00:00:00'), e = new Date(days[6] + 'T00:00:00');
    document.getElementById('week-range-label').textContent =
      MONTHS[s.getMonth()] + ' ' + s.getDate() + ' – ' + MONTHS[e.getMonth()] + ' ' + e.getDate();

    var DNAMES = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
    var html = '';
    days.forEach(function (ds, i) {
      var dayEvs  = eventsForDate(ds);
      var isToday = ds === t;
      var isSel   = ds === state.selectedWeekDay;
      var cls = 'week-day focusable' + (isToday ? ' today' : '') + (isSel ? ' selected' : '');
      var dots = dayEvs.slice(0, 4).map(function (ev) {
        return '<div class="week-dot" style="background:' + typeColor(ev.type) + '"></div>';
      }).join('');
      html += '<div class="' + cls + '" tabindex="0" data-action="week-select-day" data-date="' + ds + '">' +
        '<div class="week-day-name">' + DNAMES[i] + '</div>' +
        '<div class="week-day-num">'  + parseInt(ds.split('-')[2], 10) + '</div>' +
        '<div class="week-dots">' + dots + '</div></div>';
    });
    document.getElementById('week-grid').innerHTML = html;
    document.getElementById('week-grid').querySelectorAll('.week-day').forEach(function (el) {
      el.addEventListener('click', function () { handleAction('week-select-day', el); });
    });

    renderWeekPreview();
  }

  function renderWeekPreview() {
    var preview = document.getElementById('week-day-preview');
    if (!state.selectedWeekDay) { preview.innerHTML = ''; return; }

    var evs = eventsForDate(state.selectedWeekDay);
    var header = '<div class="week-preview-header">' +
      getDateLabel(state.selectedWeekDay).toUpperCase() + ' · ' + evs.length + ' EVENTS</div>';

    if (!evs.length) {
      preview.innerHTML = header + '<div style="padding:16px;text-align:center;color:var(--text-dim);font-size:11px;letter-spacing:0.1em;">CLEAR DAY</div>';
      return;
    }

    var items = evs.map(function (ev) {
      var status = eventStatus(ev, state.selectedWeekDay);
      return '<div class="event-item focusable' + (status === 'past' ? ' past' : '') +
        '" tabindex="0" data-action="open-event" data-event-id="' + ev.id + '">' +
        '<div class="event-type-bar" style="background:' + typeColor(ev.type) + '"></div>' +
        '<div class="event-time-col"><div class="event-start">' + fmtTimeShort(ev.startTime) + '</div></div>' +
        '<div class="event-info"><div class="event-title">' + ev.title + '</div>' +
        '<div class="event-meta">' + minsToHM(durationMins(ev)) + '</div></div></div>';
    }).join('');

    preview.innerHTML = header + items;
    preview.querySelectorAll('.event-item').forEach(function (el) {
      el.addEventListener('click', function () { handleAction('open-event', el); });
    });
  }

  // ── Canvas particles ──────────────────────────────────────────────────────
  var TYPE_RGB = {
    meeting: [111,211,255], task: [200,157,255],
    personal: [255,207,107], busy: [255,122,192], break: [255,154,90]
  };

  function initParticles() {
    var t = today();
    state.particles = eventsForDate(t).map(function (ev) {
      var col    = TYPE_RGB[ev.type] || TYPE_RGB.meeting;
      var heat   = imminenceScore(ev, t);
      var status = eventStatus(ev, t);
      return {
        x: 80 + Math.random() * 440, y: 80 + Math.random() * 440,
        vx: (Math.random() - 0.5) * 0.55, vy: (Math.random() - 0.5) * 0.55,
        r:     status === 'now' ? 5.5 : heat > 0.5 ? 3.5 : 2.5,
        col:   col,
        alpha: status === 'past' ? 0.2 : 0.65 + heat * 0.35,
        glow:  status === 'now' ? 22 : heat * 16
      };
    });
  }

  function drawParticles() {
    ctx.clearRect(0, 0, 600, 600);
    state.particles.forEach(function (p) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 20 || p.x > 580) p.vx *= -1;
      if (p.y < 20 || p.y > 580) p.vy *= -1;
      if (p.glow > 0) {
        var g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.glow);
        g.addColorStop(0, 'rgba(' + p.col + ',' + (p.alpha * 0.35) + ')');
        g.addColorStop(1, 'rgba(' + p.col + ',0)');
        ctx.beginPath(); ctx.arc(p.x, p.y, p.glow, 0, Math.PI * 2);
        ctx.fillStyle = g; ctx.fill();
      }
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(' + p.col + ',' + p.alpha + ')'; ctx.fill();
    });
    state.animFrame = requestAnimationFrame(drawParticles);
  }

  // ── Keyboard ──────────────────────────────────────────────────────────────
  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); moveFocus('down'); }
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); moveFocus('up'); }
    else if (e.key === 'Enter')  { e.preventDefault(); triggerFocused(); }
    else if (e.key === 'Escape') { e.preventDefault(); navigateBack(); }
  });

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    screens = {
      ambient: document.getElementById('screen-ambient'),
      agenda:  document.getElementById('screen-agenda'),
      detail:  document.getElementById('screen-detail'),
      week:    document.getElementById('screen-week')
    };

    canvas = document.getElementById('ambient-canvas');
    ctx    = canvas.getContext('2d');
    canvas.width = 600; canvas.height = 600;

    initParticles();
    drawParticles();
    renderClock();
    state.clockInterval = setInterval(renderClock, 10000);

    navigateTo('ambient', { addToHistory: false });

    document.addEventListener('click', function (e) {
      var el = e.target.closest('[data-action]');
      if (!el) return;
      handleAction(el.getAttribute('data-action'), el);
    });

    document.addEventListener('click', function (e) {
      var container = screens[state.currentScreen];
      if (!container) return;
      focusables(container).forEach(function (el) { el.classList.remove('focused'); });
      var clicked = e.target.closest('.focusable');
      if (clicked) { clicked.classList.add('focused'); }
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
