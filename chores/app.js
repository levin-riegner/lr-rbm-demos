(function () {
  'use strict';

  // ─────────── Data ───────────
  const CHORES = [
    {
      id: 'bathroom',
      title: 'Clean the bathroom',
      minutes: 20,
      tasks: [
        'Wipe sink and counter',
        'Scrub the toilet',
        'Mop the floor',
        'Restock toilet paper'
      ],
      supplies: [
        { label: 'Charmin Toilet Paper',   emoji: '🧻', price: '$22.99', desc: 'Strong, family-sized, 18 rolls',    url: 'https://www.amazon.com/Charmin-Strong-Toilet-Family-Regular/dp/B09YKYV9N9/' },
        { label: 'Lysol Bathroom Cleaner', emoji: '🧴', price: '$4.99',  desc: 'Disinfecting & deodorizing spray', url: 'https://www.amazon.com/gp/aw/d/B0F3LRCMP9/' },
        { label: 'Scotch-Brite Sponges',   emoji: '🧽', price: '$9.49',  desc: 'Heavy duty scrub, 6-pack',         url: 'https://www.amazon.com/Scotch-Brite-Sponges-Washing-Dishes-Kitchen/dp/B0917DL2QG/' }
      ]
    },
    {
      id: 'laundry',
      title: 'Do the laundry',
      minutes: 45,
      tasks: [
        'Sort by color',
        'Load with detergent',
        'Move to dryer',
        'Fold and put away'
      ],
      supplies: [
        { label: 'Tide',                   emoji: '🫧', price: '$14.99', desc: 'Original scent, 64 oz liquid',      url: 'https://www.amazon.com/Askshy-Laundry-Detergent-Compatible-Pre-Treater/dp/B0B1PGR1LZ' },
        { label: 'Bounce Dryer Sheets',    emoji: '💨', price: '$13.99', desc: 'Outdoor Fresh, 240-count',          url: 'http://amazon.com/Bounce-Outdoor-Softener-Reduces-Wrinkles/dp/B0FG9GRFYT' },
        { label: 'OxiClean Stain Remover', emoji: '✨', price: '$15.99', desc: 'Max Force spray, 3-pack',           url: 'https://www.amazon.com/OxiClean-Force-Laundry-Remover-3-Pack/dp/B0BVY2XKJX' }
      ]
    },
    {
      id: 'trash',
      title: 'Take out the trash',
      minutes: 5,
      tasks: [
        'Gather bins',
        'Replace liners',
        'Bring bags to the curb'
      ],
      supplies: [
        { label: 'Glad ForceFlex 13-gal', emoji: '🗑️', price: '$16.99', desc: 'OdorShield, drawstring, 40-count',  url: 'https://www.amazon.com/Glad-OdorShield-Kitchen-Drawstring-Trash/dp/B00D5YS4HE' },
        { label: 'Hefty Ultra Strong',    emoji: '💪', price: '$22.99', desc: 'Large, 30-gallon, 50-count bags',   url: 'https://www.amazon.com/Hefty-Strong-Kitchen-Gallon-Garbage/' }
      ]
    },
    {
      id: 'vacuum',
      title: 'Vacuum the living room',
      minutes: 15,
      tasks: [
        'Pick up small items',
        'Move chairs and rugs',
        'Vacuum rug and floor'
      ],
      supplies: [
        { label: 'Vacuum Bags',              emoji: '🌀', price: '$14.99', desc: 'Universal fit, 10-pack',            url: 'https://www.amazon.com/Type-Compatible-Platinum-Canister-Cleaner/dp/B0DMW2LZTQ' },
        { label: 'Scotch-Brite Lint Roller', emoji: '🪄', price: '$9.99',  desc: '3 rollers, 100 sheets each',       url: 'https://www.amazon.com/Scotch-Brite-Roller-3-Rollers-100-Sheets-Sheets/dp/B07CQ2PQW4' }
      ]
    },
    {
      id: 'dishes',
      title: 'Wash the dishes',
      minutes: 20,
      tasks: [
        'Clear the table',
        'Rinse plates',
        'Load dishwasher',
        'Dry and put away'
      ],
      supplies: [
        { label: 'Dawn',                     emoji: '🍋', price: '$12.99', desc: 'Platinum Powerwash, 16 oz',         url: 'https://www.amazon.com/Dawn-Platinum-Powerwash-Bundle-Starter/dp/B07YD3KQ5S' },
        { label: 'Cascade Complete Pods',    emoji: '💧', price: '$19.99', desc: 'All-in-1 ActionPacs, 78-count',     url: 'https://www.amazon.com/Cascade-Complete-All-Dishwasher-Detergent/dp/B00MB3JW44' },
        { label: 'Scotch-Brite Non-Scratch', emoji: '🧽', price: '$11.99', desc: 'Dishwashing sponge, 9-pack',        url: 'https://www.amazon.com/Scotch-Brite-Non-Scratch-Sponge-Without-Scratching/dp/B0043P0GRA' }
      ]
    }
  ];

  // ─────────── State ───────────
  const state = {
    mode: 'intro',       // 'intro' | 'chore' | 'done'
    index: 0,
    ordered: new Set(),  // composite keys: `${choreId}::${label}`
    checked: {}          // choreId → Set of task indices
  };
  CHORES.forEach(c => { state.checked[c.id] = new Set(); });

  function isChoreComplete(chore) {
    return state.checked[chore.id].size === chore.tasks.length;
  }

  // one path for ticking a task, shared by the D-pad and voice
  function setTaskChecked(chore, i, on) {
    const set = state.checked[chore.id];
    if (on) set.add(i); else set.delete(i);
  }

  function resetToday() {
    state.index = 0;
    state.ordered.clear();
    CHORES.forEach(c => { state.checked[c.id] = new Set(); });
    setScreen('intro');
  }

  // ─────────── DOM refs ───────────
  const screens = {
    intro: document.getElementById('intro'),
    chore: document.getElementById('chore'),
    done:  document.getElementById('done')
  };
  const stepEl      = document.getElementById('choreStep');
  const timeEl      = document.getElementById('choreTime');
  const titleEl     = document.getElementById('choreTitle');
  const tasksEl     = document.getElementById('tasksList');
  const ordersEl    = document.getElementById('ordersList');
  const ordersLabel = document.getElementById('ordersLabel');
  const actionsEl   = document.getElementById('choreActions');
  const toastEl     = document.getElementById('toast');
  const doneSummary = document.getElementById('doneSummary');

  // ─────────── Screen switching ───────────
  function setScreen(mode) {
    state.mode = mode;
    Object.entries(screens).forEach(([name, el]) => {
      el.classList.toggle('hidden', name !== mode);
    });
    requestAnimationFrame(() => focusFirst());
  }

  // ─────────── Focus / nav ───────────
  function getFocusables() {
    const scope = document.querySelector('.screen:not(.hidden)');
    if (!scope) return [];
    return Array.from(scope.querySelectorAll('[data-focusable]'))
      .filter(el => !el.hidden && el.offsetParent !== null);
  }

  function focusFirst() {
    const items = getFocusables();
    if (items.length) items[0].focus();
  }

  function moveFocus(delta) {
    const items = getFocusables();
    if (!items.length) return;
    const cur = items.indexOf(document.activeElement);
    const next = (cur < 0 ? 0 : cur + delta + items.length) % items.length;
    items[next].focus();
  }

  document.addEventListener('keydown', (e) => {
    // ◀ and the back gesture (Escape) both close the overlay one level
    if ((e.key === 'ArrowLeft' || e.key === 'Escape') && !pdpEl.classList.contains('hidden')) {
      e.preventDefault(); dismissPDP(); return;
    }
    if ((e.key === 'ArrowLeft' || e.key === 'Escape') && !loaderEl.classList.contains('hidden')) {
      e.preventDefault(); cancelLoader(); return;
    }
    if (e.key === 'Escape') return;
    if (e.key === 'ArrowDown')    { e.preventDefault(); moveFocus(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveFocus(-1); }
    else if (e.key === 'ArrowLeft' && state.mode === 'chore') {
      e.preventDefault(); gotoPrev();
    }
    else if (e.key === 'ArrowRight' && state.mode === 'chore') {
      e.preventDefault(); gotoNext();
    }
    else if (e.key === 'Enter' || e.key === ' ') {
      const el = document.activeElement;
      if (el && el.matches('[data-focusable]')) {
        e.preventDefault();
        el.click();
      }
    }
  });

  // ─────────── Toast ───────────
  let toastTimer = null;
  function toast(text) {
    toastEl.textContent = text;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
  }

  // ─────────── Chore render ───────────
  function renderChore(focusIndex) {
    const chore = CHORES[state.index];
    const complete = isChoreComplete(chore);
    stepEl.textContent  = `Chore ${state.index + 1} of ${CHORES.length}`;
    timeEl.textContent  = complete ? 'Complete' : `~ ${chore.minutes} min`;
    timeEl.classList.toggle('good', complete);
    document.querySelector('#chore .head .dot').classList.toggle('good', complete);
    titleEl.textContent = chore.title;

    // Tasks
    tasksEl.innerHTML = '';
    const checkedSet = state.checked[chore.id];
    chore.tasks.forEach((t, i) => {
      const li = document.createElement('li');
      li.dataset.focusable = '';
      li.tabIndex = 0;
      const isChecked = checkedSet.has(i);
      if (isChecked) li.classList.add('checked');
      li.innerHTML =
        `<span class="text">${escapeHtml(t)}</span>` +
        `<span class="mark">${isChecked ? '✓' : `0${i + 1}`}</span>`;
      li.addEventListener('click', (e) => {
        e.preventDefault();
        setTaskChecked(chore, i, !checkedSet.has(i));
        renderChore(i);
      });
      tasksEl.appendChild(li);
    });

    // Supplies
    ordersEl.innerHTML = '';
    if (chore.supplies.length === 0) {
      ordersLabel.style.display = 'none';
    } else {
      ordersLabel.style.display = '';
      chore.supplies.forEach((item, si) => {
        const li = document.createElement('li');
        li.dataset.focusable = '';
        li.tabIndex = 0;
        const key = `${chore.id}::${item.label}`;
        const isOrdered = state.ordered.has(key);
        if (isOrdered) li.classList.add('done');
        li.innerHTML =
          `<span class="text">${escapeHtml(item.label)}</span>` +
          `<span class="arrow">${isOrdered ? '✓' : '↗'}</span>`;
        li.addEventListener('click', (e) => {
          e.preventDefault();
          state.ordered.add(key);
          renderChore();
          overlayOpener = si; // so dismissing the overlay lands focus back here
          openWithLoader(item.label, item.emoji, item.price, item.desc);
        });
        ordersEl.appendChild(li);
      });
    }

    // Actions
    actionsEl.innerHTML = '';
    const isLast = state.index === CHORES.length - 1;
    const primary = mkBtn(isLast ? 'Finish' : 'Next chore', '→', 'complete');
    primary.classList.add('complete');
    primary.dataset.action = isLast ? 'finish' : 'next';
    actionsEl.appendChild(primary);

    if (state.index > 0) {
      const prev = mkBtn('Previous chore', '←', 'secondary');
      prev.dataset.action = 'prev';
      actionsEl.appendChild(prev);
    }

    if (focusIndex !== undefined) {
      const taskItems = tasksEl.querySelectorAll('li[data-focusable]');
      const target = taskItems[focusIndex];
      if (target) target.focus();
    } else {
      focusFirst();
    }
  }

  function mkBtn(label, glyph, kind) {
    const b = document.createElement('button');
    b.className = 'btn ' + (kind || '');
    b.dataset.focusable = '';
    b.innerHTML = `${escapeHtml(label)}<span class="glyph">${glyph}</span>`;
    return b;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    })[c]);
  }

  // ─────────── Amazon loader ───────────
  const LOAD_MSGS = [
    'Searching Amazon…',
    'Finding the best product…',
    'Checking availability…',
    'Comparing options…',
    'Almost there…',
    'Loading product…'
  ];
  const LOAD_MS = 3600;

  const loaderEl   = document.getElementById('loader');
  const loadItemEl = document.getElementById('loaderItem');
  const loadMsgEl  = document.getElementById('loaderMsg');
  const loadBarEl  = document.getElementById('loaderBar');

  let loaderTicker  = null;
  let loaderTimeout = null;
  let pendingLoad   = null; // the item the loader is working on, so a hidden page can restart it
  let overlayOpener = null; // supply index that opened the loader / PDP

  function dismissLoader() {
    clearInterval(loaderTicker);
    clearTimeout(loaderTimeout);
    loaderTicker = loaderTimeout = null;
    loaderEl.classList.add('hidden');
    loadBarEl.style.transition = 'none';
    loadBarEl.style.width = '0%';
  }

  // back out of the loader (◀ / back gesture): forget the item, refocus its row
  function cancelLoader() {
    dismissLoader();
    pendingLoad = null;
    refocusOpener();
  }

  function refocusOpener() {
    if (overlayOpener === null) { focusFirst(); return; }
    const target = ordersEl.querySelectorAll('li[data-focusable]')[overlayOpener];
    overlayOpener = null;
    if (target) target.focus(); else focusFirst();
  }

  function openWithLoader(label, emoji, price, desc) {
    pendingLoad = { label, emoji, price, desc };
    loadItemEl.textContent  = label;
    loadMsgEl.textContent   = LOAD_MSGS[0];
    loadMsgEl.style.opacity = '1';
    loadBarEl.style.transition = 'none';
    loadBarEl.style.width = '0%';

    loaderEl.classList.remove('hidden');

    requestAnimationFrame(() => requestAnimationFrame(() => {
      loadBarEl.style.transition = `width ${LOAD_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`;
      loadBarEl.style.width = '100%';
    }));

    let step = 0;
    const stepMs = LOAD_MS / LOAD_MSGS.length;
    loaderTicker = setInterval(() => {
      step++;
      if (step >= LOAD_MSGS.length) { clearInterval(loaderTicker); return; }
      loadMsgEl.style.opacity = '0';
      setTimeout(() => {
        loadMsgEl.textContent   = LOAD_MSGS[step];
        loadMsgEl.style.opacity = '1';
      }, 180);
    }, stepMs);

    loaderTimeout = setTimeout(() => {
      dismissLoader();
      pendingLoad = null;
      openPDP(label, emoji, price, desc);
    }, LOAD_MS);
  }

  // ─────────── Lifecycle (hidden page) ───────────
  // The loader is the only recurring timer: stop it while hidden and
  // replay it for the same item when the page comes back.
  function pauseForHidden() {
    if (pendingLoad) dismissLoader();
  }
  function resumeFromHidden() {
    if (pendingLoad) {
      const p = pendingLoad;
      openWithLoader(p.label, p.emoji, p.price, p.desc);
    }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseForHidden(); else resumeFromHidden();
  });

  // ─────────── Product detail overlay ───────────
  const pdpEl        = document.getElementById('pdp');
  const pdpEmojiEl   = document.getElementById('pdpEmoji');
  const pdpTitleEl   = document.getElementById('pdpTitle');
  const pdpDescEl    = document.getElementById('pdpDesc');
  const pdpPriceEl   = document.getElementById('pdpPrice');
  const pdpBuyEl     = document.getElementById('pdpBuy');
  const pdpConfirmEl = document.getElementById('pdpConfirm');

  function openPDP(label, emoji, price, desc) {
    pdpEmojiEl.textContent = emoji;
    pdpTitleEl.textContent = label;
    pdpDescEl.textContent  = desc;
    pdpPriceEl.textContent = price;
    pdpConfirmEl.classList.remove('show');
    pdpEl.classList.remove('hidden');
    requestAnimationFrame(() => pdpBuyEl.focus());
  }

  function dismissPDP() {
    pdpEl.classList.add('hidden');
    pdpConfirmEl.classList.remove('show');
    refocusOpener();
  }

  pdpBuyEl.addEventListener('click', () => {
    pdpConfirmEl.classList.add('show');
    setTimeout(() => dismissPDP(), 1800);
  });

  // ─────────── Navigation ───────────
  function gotoNext() {
    if (state.index < CHORES.length - 1) {
      state.index += 1;
      renderChore();
    }
  }
  function gotoPrev() {
    if (state.index > 0) {
      state.index -= 1;
      renderChore();
    }
  }

  // ─────────── Actions ───────────
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;

    if (action === 'start')   { setScreen('chore'); renderChore(); return; }
    if (action === 'restart') { resetToday(); return; }

    if (state.mode !== 'chore') return;

    if (action === 'next')        { gotoNext(); }
    else if (action === 'prev')   { gotoPrev(); }
    else if (action === 'finish') { finish(); }
  });

  function finish() {
    const done = CHORES.filter(isChoreComplete).length;
    const orders = state.ordered.size;
    let summary = `<span class="accent">${done}</span> of ${CHORES.length} chores done`;
    if (orders) summary += ` · <span class="accent">${orders}</span> reorder${orders === 1 ? '' : 's'}`;
    doneSummary.innerHTML = summary;
    setScreen('done');
  }

  // ---- WebMCP (Meta AI voice control) --------------------------------------
  // Additive: the app works identically when document.modelContext is absent.
  // Utterances: "what's left on my chores?", "mark scrub the toilet done",
  // "I finished the laundry", "uncheck mop the floor", "reset today's chores".
  function registerWebMcp() {
    const ctx = document.modelContext;
    if (!ctx || typeof ctx.registerTool !== 'function') return;

    function safeRegister(tool) {
      try {
        const r = ctx.registerTool(tool);
        if (r && typeof r.then === 'function') {
          r.then(undefined, (err) => { console.error(tool.name + ' registration failed', err); });
        }
      } catch (err) {
        console.error(tool.name + ' registration failed', err);
      }
    }

    function snapshot() {
      const current = CHORES[state.index];
      return {
        screen: state.mode,
        current_chore: state.mode === 'chore' ? current.title : null,
        chores: CHORES.map(c => ({
          title: c.title,
          complete: isChoreComplete(c),
          tasks: c.tasks.map((t, i) => ({ name: t, done: state.checked[c.id].has(i) }))
        }))
      };
    }

    // "scrub the toilet" → one task; "laundry" → every task of that chore.
    // Tasks of the chore on screen win over the same words elsewhere.
    function resolveItem(raw) {
      const q = String(raw).trim().toLowerCase();
      if (!q) return [];
      const hits = [];
      const order = [CHORES[state.index]].concat(CHORES.filter((_, i) => i !== state.index));
      for (const c of order) {
        c.tasks.forEach((t, i) => {
          if (t.toLowerCase().includes(q) || q.includes(t.toLowerCase())) hits.push({ chore: c, i });
        });
        if (hits.length) return hits;
      }
      for (const c of CHORES) {
        if (c.id === q || c.title.toLowerCase().includes(q)) {
          return c.tasks.map((_, i) => ({ chore: c, i }));
        }
      }
      return [];
    }

    function applyItems(args, on) {
      const list = String(args && args.items || '').split(',').map(s => s.trim()).filter(Boolean);
      if (!list.length) {
        return { error: true, message: 'Say which task or chore, e.g. "scrub the toilet" or "laundry".', next_action: 'Ask the wearer which task, then call again.' };
      }
      const unknown = [];
      let last = null;
      list.forEach((raw) => {
        const hits = resolveItem(raw);
        if (!hits.length) { unknown.push(raw); return; }
        hits.forEach(h => { setTaskChecked(h.chore, h.i, on); last = h; });
      });
      if (last) {
        // show the chore that changed, the same way the D-pad would get there
        state.index = CHORES.indexOf(last.chore);
        if (state.mode !== 'chore') setScreen('chore');
        renderChore(last.i);
      }
      const out = snapshot();
      out.unknown_items = unknown;
      out.next_action = last
        ? 'Confirm what changed in one short sentence, then stop.'
        : 'Tell the wearer nothing matched, in one short sentence.';
      if (!last) out.error = true;
      return out;
    }

    safeRegister({
      name: 'chores_get_state',
      description: 'Report today\'s chores: which chore is on screen and which tasks are done or still open. Read-only.',
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true },
      execute: () => {
        const out = snapshot();
        out.next_action = 'Summarise what is left in one short sentence; do not read every task back.';
        return out;
      }
    });

    safeRegister({
      name: 'chores_complete',
      description: 'Tick off tasks or whole chores. items is a comma-separated list of task names (e.g. "scrub the toilet") or chore names (e.g. "laundry", which ticks all its tasks). Returns the new state.',
      inputSchema: {
        type: 'object',
        properties: { items: { type: 'string', description: 'Comma-separated task or chore names to mark done.' } },
        required: ['items']
      },
      execute: (args) => applyItems(args, true)
    });

    safeRegister({
      name: 'chores_uncomplete',
      description: 'Un-tick tasks or whole chores that were marked done by mistake. items is a comma-separated list of task or chore names. Returns the new state.',
      inputSchema: {
        type: 'object',
        properties: { items: { type: 'string', description: 'Comma-separated task or chore names to mark not done.' } },
        required: ['items']
      },
      execute: (args) => applyItems(args, false)
    });

    safeRegister({
      name: 'chores_reset_today',
      description: 'Clear every tick and reorder and go back to the start screen, the same as the Start over button.',
      inputSchema: { type: 'object', properties: {} },
      execute: () => {
        resetToday();
        const out = snapshot();
        out.next_action = 'Confirm the reset in one short sentence, then stop.';
        return out;
      }
    });
  }

  // ─────────── Init ───────────
  setScreen('intro');
  registerWebMcp();
})();
