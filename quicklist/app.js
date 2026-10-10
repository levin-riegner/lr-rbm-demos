(function () {
  'use strict';

  // ===========================================================
  //  CONFIG
  // ===========================================================
  var CONFIG = {
    storageKey:   'quicklist_v1',
    undoMs:       1500,   // how long the "removed · ▶ undo" affordance stays
    maxVisible:   5,      // item rows shown at once (the rest scroll)
    maxItemChars: 60
  };

  // Seed list for first run so the demo opens populated.
  var SEED_ITEMS = ['coffee', 'oat milk', 'batteries', 'dog food', 'lightbulbs'];

  // ===========================================================
  //  STATE
  // ===========================================================
  var state = {
    screen:    'list',    // 'list' | 'add'
    items:     [],        // [{ id, text, done }]
    focusKey:  'add',     // 'item:<id>' | 'ghost' | 'add' | 'clear'
    lastFocusIdx: 0,      // position of focusKey in focusOrder() at the last render
    undo:      null,      // { item, index, timer } while the undo affordance is showing
    clearNote: false,     // inline "nothing done yet" notice on the CLEAR DONE row
    ephemeral: false,     // true when ?state= routing is driving the list (never persisted)
    nextId:    1
  };

  var SCREENS = ['list', 'add'];

  // ===========================================================
  //  STORAGE
  // ===========================================================
  function persist() {
    if (state.ephemeral) return;
    try {
      localStorage.setItem(CONFIG.storageKey, JSON.stringify({
        items:  state.items,
        nextId: state.nextId
      }));
    } catch (e) { /* ignore */ }
  }

  function restore() {
    var raw = null;
    try { raw = localStorage.getItem(CONFIG.storageKey); } catch (e) { /* ignore */ }
    if (!raw) { seed(); persist(); return; }
    try {
      var data = JSON.parse(raw);
      state.items = Array.isArray(data.items) ? data.items.filter(isValidItem) : [];
      state.nextId = typeof data.nextId === 'number' ? data.nextId : state.items.length + 1;
    } catch (e) {
      seed();
    }
  }

  function seed() {
    state.items = [];
    state.nextId = 1;
    SEED_ITEMS.forEach(function (t) { state.items.push(makeItem(t)); });
  }

  function isValidItem(it) {
    return it && typeof it.text === 'string' && typeof it.id === 'number';
  }

  function makeItem(text) {
    return { id: state.nextId++, text: text, done: false };
  }

  // ===========================================================
  //  TEXT HELPERS
  // ===========================================================
  function cleanText(s) {
    return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, CONFIG.maxItemChars);
  }

  function normalize(s) {
    return cleanText(s).toLowerCase().replace(/[.!?,;:]+$/, '').trim();
  }

  function singular(s) {
    if (s.length > 3 && /ies$/.test(s)) return s.slice(0, -3) + 'y';
    if (s.length > 3 && /(s|x|z|ch|sh)es$/.test(s)) return s.slice(0, -2);
    if (s.length > 2 && /s$/.test(s) && !/ss$/.test(s)) return s.slice(0, -1);
    return s;
  }

  // Hosts flatten a spoken list differently: JSON array, newline- or
  // comma-separated. Accept all three.
  function splitList(input) {
    var value = input;
    if (typeof value === 'string' && value.trim().charAt(0) === '[') {
      try {
        var parsed = JSON.parse(value.trim());
        if (Object.prototype.toString.call(parsed) === '[object Array]') value = parsed;
      } catch (e) { /* fall through to separators */ }
    }
    var chunks;
    if (Object.prototype.toString.call(value) === '[object Array]') {
      chunks = value.map(function (p) { return String(p == null ? '' : p); });
    } else {
      var text = String(value == null ? '' : value);
      chunks = text.indexOf('\n') !== -1 ? text.split('\n') : text.split(',');
    }
    var out = [];
    chunks.forEach(function (c) {
      var t = cleanText(c);
      if (t) out.push(t);
    });
    return out;
  }

  // Case-insensitive, trim-tolerant, plural-tolerant lookup.
  // Returns the matching item or null.
  function findItem(name) {
    var q = normalize(name);
    if (!q) return null;
    var qs = singular(q);
    var i, it, n;
    for (i = 0; i < state.items.length; i++) {
      it = state.items[i];
      if (normalize(it.text) === q) return it;
    }
    for (i = 0; i < state.items.length; i++) {
      it = state.items[i];
      if (singular(normalize(it.text)) === qs) return it;
    }
    // Last resort: a unique substring match ("milk" → "oat milk").
    var hits = [];
    for (i = 0; i < state.items.length; i++) {
      it = state.items[i];
      n = normalize(it.text);
      if (n.indexOf(q) !== -1 || q.indexOf(n) !== -1) hits.push(it);
    }
    return hits.length === 1 ? hits[0] : null;
  }

  function openItems() { return state.items.filter(function (it) { return !it.done; }); }
  function doneItems() { return state.items.filter(function (it) { return it.done; }); }

  // ===========================================================
  //  MUTATIONS — the single path used by both the D-pad and WebMCP.
  //  Each one re-renders, so a voice command updates the screen.
  // ===========================================================
  function addItems(texts) {
    commitUndo();
    var added = [], reopened = [], already = [];
    texts.forEach(function (t) {
      var text = cleanText(t);
      if (!text) return;
      var existing = findExact(text);
      if (existing && !existing.done) { already.push(existing.text); return; }
      if (existing && existing.done)  { existing.done = false; reopened.push(existing.text); return; }
      var it = makeItem(text);
      state.items.push(it);
      added.push(it.text);
    });
    persist();
    render();
    return { added: added, reopened: reopened, already_on_list: already };
  }

  function findExact(text) {
    var q = normalize(text);
    for (var i = 0; i < state.items.length; i++) {
      if (normalize(state.items[i].text) === q) return state.items[i];
    }
    return null;
  }

  function setDone(items, done) {
    commitUndo();
    items.forEach(function (it) { it.done = done; });
    persist();
    render();
  }

  function toggleItem(it) {
    setDone([it], !it.done);
  }

  function removeItems(items) {
    commitUndo();
    var ids = items.map(function (it) { return it.id; });
    state.items = state.items.filter(function (it) { return ids.indexOf(it.id) === -1; });
    persist();
    render();
  }

  function clearItems(doneOnly) {
    commitUndo();
    var removed = (doneOnly ? doneItems() : state.items.slice()).map(function (it) { return it.text; });
    state.items = doneOnly ? openItems() : [];
    persist();
    render();
    return removed;
  }

  // ---- Undo (D-pad ◀ on a row) --------------------------------
  // The item leaves the list immediately; a ghost row holds its place
  // for CONFIG.undoMs. ▶ puts it back. This is the app's only timer.
  function removeWithUndo(it, displayIndex) {
    commitUndo();
    state.items = state.items.filter(function (x) { return x.id !== it.id; });
    state.undo = {
      item: it,
      index: displayIndex,
      timer: setTimeout(function () {
        state.undo = null;
        render();
      }, CONFIG.undoMs)
    };
    state.focusKey = 'ghost';
    persist();
    render();
  }

  function undoRemove() {
    if (!state.undo) return;
    var u = state.undo;
    clearTimeout(u.timer);
    state.undo = null;
    // Put it back among its peers (display order = order within state.items,
    // filtered by done-ness). Insert before the peer that took its slot, or
    // append when it was the last of its kind.
    var peers = u.item.done ? doneItems() : openItems();
    var offset = u.item.done ? openItems().length : 0;
    var pos = Math.max(0, Math.min(peers.length, u.index - offset));
    var target = peers[pos];
    var insertAt = target ? state.items.indexOf(target) : state.items.length;
    state.items.splice(insertAt, 0, u.item);
    state.focusKey = 'item:' + u.item.id;
    persist();
    render();
  }

  // Finalise a pending removal (used before any other mutation and on hide).
  function commitUndo() {
    if (!state.undo) return;
    clearTimeout(state.undo.timer);
    state.undo = null;
  }

  // ===========================================================
  //  RENDER
  // ===========================================================
  function displayedItems() {
    return openItems().concat(doneItems());
  }

  // Focusable rows on the List screen, in visual order.
  function focusOrder() {
    var keys = displayedItems().map(function (it) { return 'item:' + it.id; });
    if (state.undo) keys.splice(Math.min(state.undo.index, keys.length), 0, 'ghost');
    keys.push('add');
    if (state.items.length) keys.push('clear');
    return keys;
  }

  function render() {
    if (state.screen === 'list') renderList();
    if (state.screen === 'add')  renderAdd();
  }

  function renderList() {
    var rowsEl   = document.getElementById('list-rows');
    var pitchEl  = document.getElementById('empty-pitch');
    var counter  = document.getElementById('list-counter');
    var clearBtn = document.getElementById('act-clear');
    var noteEl   = document.getElementById('clear-note');

    var open = openItems(), done = doneItems();
    counter.textContent = done.length + ' / ' + state.items.length + ' done';

    var order = focusOrder();
    if (order.indexOf(state.focusKey) === -1) {
      // The focused row went away: land on the nearest remaining one.
      var idx = state.lastFocusIdx || 0;
      state.focusKey = order[Math.min(idx, order.length - 1)];
    }
    var focusIdx = order.indexOf(state.focusKey);
    state.lastFocusIdx = focusIdx;

    var isEmpty = state.items.length === 0 && !state.undo;
    pitchEl.classList.toggle('hidden', !isEmpty);
    clearBtn.classList.toggle('hidden', state.items.length === 0);
    noteEl.classList.toggle('hidden', !state.clearNote);

    // Build the item rows (plus the undo ghost) in display order.
    var rows = order.filter(function (k) { return k !== 'add' && k !== 'clear'; });
    var items = displayedItems();
    var itemIdx = 0;

    // Scroll window so the focused row is always visible.
    var winStart = 0;
    if (rows.length > CONFIG.maxVisible && focusIdx < rows.length) {
      winStart = Math.max(0, Math.min(focusIdx - Math.floor(CONFIG.maxVisible / 2), rows.length - CONFIG.maxVisible));
    }
    var winEnd = Math.min(rows.length, winStart + CONFIG.maxVisible);

    rowsEl.innerHTML = '';
    if (winStart > 0) rowsEl.appendChild(moreEl('more-above', '▲ ' + winStart + ' more'));

    rows.forEach(function (key, i) {
      var el;
      if (key === 'ghost') {
        el = buildRow('ghost', '—', 'removed', state.undo.item.text, '▶ undo');
        el.className += ' pending-remove';
      } else {
        var it = items[itemIdx++];
        el = buildRow(key, it.done ? '☑' : '☐', it.text, null, null);
        if (it.done) el.className += ' done';
      }
      if (i < winStart || i >= winEnd) el.className += ' offscreen';
      rowsEl.appendChild(el);
    });

    if (winEnd < rows.length) rowsEl.appendChild(moreEl('more-below', '▼ ' + (rows.length - winEnd) + ' more'));

    focusKey(state.focusKey);
  }

  function buildRow(key, glyph, label, strike, note) {
    var el = document.createElement('button');
    el.type = 'button';
    el.className = 'row row-item focusable';
    el.setAttribute('data-key', key);
    el.setAttribute('role', 'listitem');

    var g = document.createElement('span');
    g.className = 'row-glyph';
    g.textContent = glyph;
    el.appendChild(g);

    var l = document.createElement('span');
    l.className = 'row-label';
    l.textContent = strike ? label + ' · ' + strike : label;
    el.appendChild(l);

    if (note) {
      var n = document.createElement('span');
      n.className = 'row-note mono';
      n.textContent = note;
      el.appendChild(n);
    }
    return el;
  }

  function moreEl(cls, text) {
    var el = document.createElement('div');
    el.className = cls + ' mono';
    el.textContent = text;
    return el;
  }

  function focusKey(key) {
    var el = null;
    if (key === 'add')        el = document.getElementById('act-add');
    else if (key === 'clear') el = document.getElementById('act-clear');
    else                      el = document.querySelector('#list-rows [data-key="' + key + '"]');
    if (el) el.focus();
  }

  function renderAdd() {
    var input = document.getElementById('add-input');
    input.focus();
  }

  // ===========================================================
  //  SCREEN SWITCHING
  // ===========================================================
  function showScreen(name) {
    state.screen = name;
    SCREENS.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.classList.toggle('hidden', id !== name);
    });
    render();
  }

  function openAdd() {
    commitUndo();
    state.clearNote = false;
    document.getElementById('add-input').value = '';
    showScreen('add');
  }

  function closeAdd() {
    document.getElementById('add-input').value = '';
    state.focusKey = 'add';
    showScreen('list');
  }

  // Commit whatever is in the input (typed on desktop, or returned by the
  // glasses' handwriting/voice composer). Comma-separated → several rows.
  function commitAddInput() {
    var input = document.getElementById('add-input');
    var texts = splitList(input.value);
    input.value = '';
    if (!texts.length) return false;
    var result = addItems(texts);
    var last = result.added.length ? result.added[result.added.length - 1] : null;
    var focusItem = last ? findExact(last) : null;
    state.focusKey = focusItem ? 'item:' + focusItem.id : 'add';
    showScreen('list');
    return true;
  }

  // ===========================================================
  //  INPUT · D-pad
  // ===========================================================
  function onKey(e) {
    if (e.isComposing) return;
    var k = e.key;
    if (state.screen === 'add') return onKeyAdd(e, k);
    return onKeyList(e, k);
  }

  function onKeyList(e, k) {
    var order = focusOrder();
    var idx = order.indexOf(state.focusKey);
    if (idx === -1) idx = 0;
    var key = order[idx];

    if (k === 'Escape') return; // Back gesture does nothing on the home screen

    if (state.clearNote && k !== 'Enter') { state.clearNote = false; render(); }

    if (k === 'ArrowDown') {
      e.preventDefault();
      state.focusKey = order[Math.min(order.length - 1, idx + 1)];
      renderList();
      return;
    }
    if (k === 'ArrowUp') {
      e.preventDefault();
      state.focusKey = order[Math.max(0, idx - 1)];
      renderList();
      return;
    }
    if (k === 'Enter') {
      e.preventDefault();
      if (key === 'add')   return openAdd();
      if (key === 'clear') return onClearDone();
      if (key === 'ghost') return undoRemove();
      var it = itemForKey(key);
      if (it) toggleItem(it);
      return;
    }
    if (k === 'ArrowLeft') {
      e.preventDefault();
      var target = itemForKey(key);
      if (target) removeWithUndo(target, idx);
      return;
    }
    if (k === 'ArrowRight') {
      e.preventDefault();
      if (state.undo) undoRemove();
      return;
    }
  }

  function onKeyAdd(e, k) {
    if (k === 'Escape') {
      e.preventDefault();
      closeAdd();
      return;
    }
    if (k === 'Enter') {
      e.preventDefault();
      if (!commitAddInput()) closeAdd();
      return;
    }
    // Arrow keys stay with the input (caret movement) — the input is the
    // only focusable element on this screen.
  }

  function itemForKey(key) {
    if (!key || key.indexOf('item:') !== 0) return null;
    var id = parseInt(key.slice(5), 10);
    for (var i = 0; i < state.items.length; i++) {
      if (state.items[i].id === id) return state.items[i];
    }
    return null;
  }

  function onClearDone() {
    if (!doneItems().length) {
      state.clearNote = true;   // inline notice; dismissed on the next key press
      renderList();
      return;
    }
    state.clearNote = false;
    state.focusKey = 'clear';
    clearItems(true);
  }

  // The composer on the glasses commits text through input/change;
  // desktop fires change on Enter/blur. commitAddInput() is idempotent
  // (it empties the field), so overlapping events are harmless.
  function bindAddInput() {
    var input = document.getElementById('add-input');
    var form  = document.getElementById('add-form');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!commitAddInput()) closeAdd();
    });
    input.addEventListener('change', function () {
      if (state.screen !== 'add') return;
      commitAddInput();
    });
    input.addEventListener('input', function () {
      if (state.screen !== 'add') return;
      // A newline can only come from the composer: treat it as "done".
      if (input.value.indexOf('\n') !== -1) commitAddInput();
    });
  }

  // ===========================================================
  //  LIFECYCLE
  // ===========================================================
  // The undo affordance is the only timer. Never let it run while hidden.
  function onVisibility() {
    if (document.visibilityState === 'hidden') {
      if (state.undo) { commitUndo(); render(); }
    }
  }

  // ===========================================================
  //  ?state= URL routing (for README screenshot generation)
  //  ?state=empty | list | add | done — never persisted.
  // ===========================================================
  function applyUrlState() {
    var urlState = null;
    try { urlState = new URLSearchParams(location.search).get('state'); } catch (e) { /* ignore */ }
    if (!urlState) return false;

    state.ephemeral = true;
    state.undo = null;

    if (urlState === 'empty') {
      state.items = [];
      state.focusKey = 'add';
      showScreen('list');
      return true;
    }
    if (urlState === 'list') {
      seed();
      state.items[1].done = true;   // a mix of open + done so the counter reads 1 / 5
      state.focusKey = 'item:' + state.items[0].id;
      showScreen('list');
      return true;
    }
    if (urlState === 'add') {
      seed();
      showScreen('add');
      return true;
    }
    if (urlState === 'done') {
      seed();
      state.items.forEach(function (it) { it.done = true; });
      state.focusKey = 'clear';
      showScreen('list');
      return true;
    }
    return false;
  }

  // ===========================================================
  //  WebMCP (Meta AI voice control)
  //  Additive: the app works identically when document.modelContext
  //  is absent. Every tool mutates through the functions above.
  // ===========================================================
  var STOP = 'Confirm in one short sentence, then stop.';

  function snapshot(extra) {
    var out = extra || {};
    out.open = openItems().map(function (it) { return it.text; });
    out.done = doneItems().map(function (it) { return it.text; });
    out.open_count = out.open.length;
    out.done_count = out.done.length;
    out.total = state.items.length;
    if (!out.next_action) out.next_action = STOP;
    return out;
  }

  function problem(message, nextAction) {
    return { error: true, message: message, next_action: nextAction };
  }

  function listNames() {
    return state.items.map(function (it) { return it.text; });
  }

  // Resolve spoken names to items. All-or-nothing: any unknown name returns
  // a problem that names what exists, so Meta AI can retry.
  function resolveNames(args) {
    var names = splitList(args && args.items);
    if (!names.length) {
      return { error: problem('No item names were given.', 'Ask the wearer which items, then call again with a comma-separated list.') };
    }
    var found = [], unknown = [];
    names.forEach(function (n) {
      var it = findItem(n);
      if (it && found.indexOf(it) === -1) found.push(it);
      else if (!it) unknown.push(n);
    });
    if (unknown.length) {
      var have = listNames();
      return { error: problem(
        'Not on the list: ' + unknown.join(', ') + '.',
        have.length
          ? 'The list has: ' + have.join(', ') + '. Call again with the matching names, or tell the wearer in one short sentence.'
          : 'The list is empty. Tell the wearer in one short sentence.'
      ) };
    }
    return { items: found };
  }

  function registerWebMcp() {
    var ctx = document.modelContext;
    if (!ctx || typeof ctx.registerTool !== 'function') return;

    function safeRegister(tool) {
      try {
        var r = ctx.registerTool(tool);
        if (r && typeof r.then === 'function') {
          r.then(undefined, function (err) { console.error(tool.name + ' registration failed', err); });
        }
      } catch (err) {
        console.error(tool.name + ' registration failed', err);
      }
    }

    var itemsParam = {
      type: 'string',
      description: 'Comma-separated item names, e.g. "coffee, sugar, cream". Pass every item the wearer named in one call.'
    };

    safeRegister({
      name: 'quicklist_get_state',
      description: 'Report what is on the list: open (unchecked) items, done (checked) items and counts. Read-only.',
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true },
      execute: function () {
        return snapshot({ next_action: 'Answer the wearer\'s question in one short sentence, then stop. Only read the whole list back if asked for it.' });
      }
    });

    safeRegister({
      name: 'quicklist_add_items',
      description: 'Add one or more items to the list. Pass every item named in a single call. Items already on the list are not duplicated; a done item with the same name is reopened. Returns the new list.',
      inputSchema: { type: 'object', properties: { items: itemsParam }, required: ['items'] },
      execute: function (args) {
        var names = splitList(args && args.items);
        if (!names.length) return problem('No item names were given.', 'Ask the wearer what to add, then call again with a comma-separated list.');
        var r = addItems(names);
        return snapshot({ added: r.added, reopened: r.reopened, already_on_list: r.already_on_list });
      }
    });

    safeRegister({
      name: 'quicklist_check_items',
      description: 'Check off (mark done) one or more items that are on the list. Pass every item named in a single call. Returns the new list.',
      inputSchema: { type: 'object', properties: { items: itemsParam }, required: ['items'] },
      execute: function (args) {
        var r = resolveNames(args);
        if (r.error) return r.error;
        setDone(r.items, true);
        return snapshot({ checked: r.items.map(function (it) { return it.text; }) });
      }
    });

    safeRegister({
      name: 'quicklist_uncheck_items',
      description: 'Uncheck (mark not done) one or more items that are on the list. Pass every item named in a single call. Returns the new list.',
      inputSchema: { type: 'object', properties: { items: itemsParam }, required: ['items'] },
      execute: function (args) {
        var r = resolveNames(args);
        if (r.error) return r.error;
        setDone(r.items, false);
        return snapshot({ unchecked: r.items.map(function (it) { return it.text; }) });
      }
    });

    safeRegister({
      name: 'quicklist_remove_items',
      description: 'Remove one or more items from the list entirely, whether open or done. Pass every item named in a single call. Returns the new list.',
      inputSchema: { type: 'object', properties: { items: itemsParam }, required: ['items'] },
      execute: function (args) {
        var r = resolveNames(args);
        if (r.error) return r.error;
        var names = r.items.map(function (it) { return it.text; });
        removeItems(r.items);
        return snapshot({ removed: names });
      }
    });

    safeRegister({
      name: 'quicklist_clear',
      description: 'Clear the list. By default removes only the done (checked) items; set done_only to false to wipe the whole list. Returns the new list.',
      inputSchema: {
        type: 'object',
        properties: {
          done_only: { type: 'boolean', description: 'true (default) removes only checked items; false removes everything.' }
        }
      },
      execute: function (args) {
        var doneOnly = !(args && (args.done_only === false || args.done_only === 'false'));
        if (doneOnly && !doneItems().length) {
          return problem('Nothing is checked off yet.', 'Tell the wearer in one short sentence, then stop.');
        }
        if (!doneOnly && !state.items.length) {
          return problem('The list is already empty.', 'Tell the wearer in one short sentence, then stop.');
        }
        var removed = clearItems(doneOnly);
        return snapshot({ removed: removed, cleared: doneOnly ? 'done' : 'all' });
      }
    });
  }

  // ===========================================================
  //  INIT
  // ===========================================================
  function init() {
    restore();
    document.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onVisibility);
    bindAddInput();
    if (!applyUrlState()) {
      state.focusKey = state.items.length ? 'item:' + displayedItems()[0].id : 'add';
      showScreen('list');
    }
    registerWebMcp();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
