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
        { label: 'Charmin Strong Toilet Paper',  url: 'https://www.amazon.com/Charmin-Strong-Toilet-Family-Regular/dp/B09YKYV9N9/' },
        { label: 'Lysol Bathroom Cleaner',       url: 'https://www.amazon.com/dp/B01N6KBXK9' },
        { label: 'Scotch-Brite Sponges',         url: 'https://www.amazon.com/Scotch-Brite-Sponges-Washing-Dishes-Kitchen/dp/B0917DL2QG/' }
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
        { label: 'Laundry Detergent',      url: 'https://www.amazon.com/Askshy-Laundry-Detergent-Compatible-Pre-Treater/dp/B0B1PGR1LZ' },
        { label: 'Bounce Dryer Sheets',    url: 'https://www.amazon.com/Bounce-Outdoor-Softener-Reduces-Wrinkles/dp/B0FG9GRFYT' },
        { label: 'OxiClean Stain Remover', url: 'https://www.amazon.com/s?k=oxiclean+max+force+stain+remover+spray' }
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
        { label: 'Glad ForceFlex 13-gal', url: 'https://www.amazon.com/dp/B00Z0WXKOW' },
        { label: 'Hefty Ultra Strong',    url: 'https://www.amazon.com/s?k=hefty+ultra+strong+large+trash+bags+33+gallon' }
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
        { label: 'Vacuum Bags',              url: 'https://www.amazon.com/Type-Compatible-Platinum-Canister-Cleaner/dp/B0DMW2LZTQ' },
        { label: 'Scotch-Brite Lint Roller', url: 'https://www.amazon.com/Scotch-Brite-Roller-3-Rollers-100-Sheets-Sheets/dp/B07CQ2PQW4' }
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
        { label: 'Dawn Platinum Powerwash',  url: 'https://www.amazon.com/Dawn-Platinum-Powerwash-Bundle-Starter/dp/B07YD3KQ5S' },
        { label: 'Cascade Complete Pods',    url: 'https://www.amazon.com/Cascade-Complete-All-Dishwasher-Detergent/dp/B00MB3JW44' },
        { label: 'Scotch-Brite Non-Scratch', url: 'https://www.amazon.com/dp/B001BKZR5S' }
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

  // ─────────── DOM refs ───────────
  const screens = {
    intro: document.getElementById('intro'),
    chore: document.getElementById('chore'),
    done:  document.getElementById('done')
  };
  const stepEl       = document.getElementById('choreStep');
  const timeEl       = document.getElementById('choreTime');
  const titleEl      = document.getElementById('choreTitle');
  const tasksEl      = document.getElementById('tasksList');
  const ordersEl     = document.getElementById('ordersList');
  const ordersLabel  = document.getElementById('ordersLabel');
  const actionsEl    = document.getElementById('choreActions');
  const toastEl      = document.getElementById('toast');
  const doneSummary  = document.getElementById('doneSummary');

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
    // Left arrow always dismisses the loader if it's open
    if (e.key === 'ArrowLeft' && !loaderEl.classList.contains('hidden')) {
      e.preventDefault(); dismissLoader(); return;
    }
    if (e.key === 'ArrowDown')      { e.preventDefault(); moveFocus(1); }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); moveFocus(-1); }
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

    // Tasks (checkable)
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
        if (checkedSet.has(i)) checkedSet.delete(i);
        else checkedSet.add(i);
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
      chore.supplies.forEach((item) => {
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
          openWithLoader(item.label, item.url);
        });
        ordersEl.appendChild(li);
      });
    }

    // Actions
    actionsEl.innerHTML = '';

    const isLast = state.index === CHORES.length - 1;
    const primary = mkBtn(
      isLast ? 'Finish' : 'Next chore',
      '→',
      'complete'
    );
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
    'Opening now…'
  ];
  const LOAD_MS = 3600;

  const loaderEl   = document.getElementById('loader');
  const loadItemEl = document.getElementById('loaderItem');
  const loadMsgEl  = document.getElementById('loaderMsg');
  const loadBarEl  = document.getElementById('loaderBar');

  let loaderTicker  = null;
  let loaderTimeout = null;

  function dismissLoader() {
    clearInterval(loaderTicker);
    clearTimeout(loaderTimeout);
    loaderTicker = loaderTimeout = null;
    loaderEl.classList.add('hidden');
    loadBarEl.style.transition = 'none';
    loadBarEl.style.width = '0%';
  }

  function openWithLoader(label, url) {
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
      window.open(url, '_blank', 'noopener');
    }, LOAD_MS);
  }

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
    if (action === 'restart') {
      state.index = 0;
      state.ordered.clear();
      CHORES.forEach(c => { state.checked[c.id] = new Set(); });
      setScreen('intro');
      return;
    }

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

  // ─────────── Init ───────────
  setScreen('intro');
})();
