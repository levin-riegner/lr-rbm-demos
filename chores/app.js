(function () {
  'use strict';

  // ─────────── Data ───────────
  const amazon = (q) => `https://www.amazon.com/s?k=${encodeURIComponent(q)}`;

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
        { label: 'Toilet paper',     url: amazon('toilet paper 12 pack') },
        { label: 'Bathroom cleaner', url: amazon('bathroom cleaner spray') },
        { label: 'Sponges',          url: amazon('cleaning sponges pack') }
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
        { label: 'Laundry detergent', url: amazon('laundry detergent') },
        { label: 'Dryer sheets',      url: amazon('dryer sheets') },
        { label: 'Stain remover',     url: amazon('stain remover spray') }
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
        { label: 'Kitchen trash bags', url: amazon('kitchen trash bags 13 gallon') },
        { label: 'Outdoor trash bags', url: amazon('outdoor trash bags heavy duty') }
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
        { label: 'Vacuum bags', url: amazon('vacuum bags universal') },
        { label: 'Lint roller', url: amazon('lint roller pack') }
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
        { label: 'Dish soap',       url: amazon('dish soap') },
        { label: 'Dishwasher pods', url: amazon('dishwasher pods') },
        { label: 'Dish sponges',    url: amazon('dish sponges') }
      ]
    }
  ];

  // ─────────── State ───────────
  const state = {
    mode: 'intro',       // 'intro' | 'chore' | 'done'
    index: 0,
    completed: new Set(),
    ordered: new Set(),  // composite keys: `${choreId}::${label}`
    checked: {}          // choreId → Set of task indices
  };
  CHORES.forEach(c => { state.checked[c.id] = new Set(); });

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
  function renderChore() {
    const chore = CHORES[state.index];
    stepEl.textContent  = `Chore ${state.index + 1} of ${CHORES.length}`;
    timeEl.textContent  = `~ ${chore.minutes} min`;
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
        renderChore();
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
          window.open(item.url, '_blank', 'noopener');
          state.ordered.add(key);
          toast(`Opened: ${item.label}`);
          renderChore();
        });
        ordersEl.appendChild(li);
      });
    }

    // Actions
    actionsEl.innerHTML = '';

    const isComplete = state.completed.has(chore.id);
    const completeBtn = mkBtn(
      isComplete ? 'Completed' : 'Mark complete',
      isComplete ? '✓' : '●',
      'complete'
    );
    completeBtn.classList.add('complete');
    if (isComplete) completeBtn.classList.add('done');
    completeBtn.dataset.action = 'complete';
    actionsEl.appendChild(completeBtn);

    const navRow = document.createElement('div');
    navRow.className = 'nav-row';

    if (state.index > 0) {
      const prev = mkBtn('Prev', '←', 'secondary');
      prev.dataset.action = 'prev';
      navRow.appendChild(prev);
    }
    if (state.index < CHORES.length - 1) {
      const next = mkBtn('Next', '→', 'secondary');
      next.dataset.action = 'next';
      navRow.appendChild(next);
    } else {
      const finish = mkBtn('Finish', '→', 'secondary');
      finish.dataset.action = 'finish';
      navRow.appendChild(finish);
    }
    actionsEl.appendChild(navRow);

    focusFirst();
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
      state.completed.clear();
      state.ordered.clear();
      CHORES.forEach(c => { state.checked[c.id] = new Set(); });
      setScreen('intro');
      return;
    }

    if (state.mode !== 'chore') return;
    const chore = CHORES[state.index];

    if (action === 'complete') {
      if (state.completed.has(chore.id)) return;
      state.completed.add(chore.id);
      toast(`Completed: ${chore.title}`);
      setTimeout(() => {
        if (state.index < CHORES.length - 1) {
          state.index += 1;
          renderChore();
        } else {
          finish();
        }
      }, 600);
    } else if (action === 'next')   { gotoNext(); }
    else if (action === 'prev')     { gotoPrev(); }
    else if (action === 'finish')   { finish(); }
  });

  function finish() {
    const done   = state.completed.size;
    const orders = state.ordered.size;
    let summary = `<span class="accent">${done}</span> of ${CHORES.length} chores done`;
    if (orders) summary += ` · <span class="accent">${orders}</span> reorder${orders === 1 ? '' : 's'}`;
    doneSummary.innerHTML = summary;
    setScreen('done');
  }

  // ─────────── Init ───────────
  setScreen('intro');
})();
