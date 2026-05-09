(function () {
  'use strict';

  // ---- Data ----
  const CHORES = [
    {
      id: 'bathroom',
      title: 'Clean the bathroom',
      minutes: 20,
      requirements: [
        'Wipe sink and counter',
        'Scrub the toilet',
        'Mop the floor',
        'Check toilet paper stock'
      ],
      order: { label: 'Order toilet paper', item: 'Toilet paper (12-pack)' }
    },
    {
      id: 'laundry',
      title: 'Do the laundry',
      minutes: 45,
      requirements: [
        'Sort clothes by color',
        'Load washer with detergent',
        'Transfer to dryer',
        'Fold and put away'
      ],
      order: { label: 'Order detergent', item: 'Laundry detergent' }
    },
    {
      id: 'trash',
      title: 'Take out the trash',
      minutes: 5,
      requirements: [
        'Gather trash from all bins',
        'Replace bin liners',
        'Take bags to the curb'
      ],
      order: { label: 'Order trash bags', item: 'Kitchen trash bags' }
    },
    {
      id: 'vacuum',
      title: 'Vacuum the living room',
      minutes: 15,
      requirements: [
        'Pick up small items from floor',
        'Move chairs and rugs',
        'Vacuum rug and hardwood'
      ],
      order: null
    },
    {
      id: 'dishes',
      title: 'Wash the dishes',
      minutes: 20,
      requirements: [
        'Clear the table',
        'Rinse dishes',
        'Load dishwasher or hand wash',
        'Dry and put away'
      ],
      order: { label: 'Order dish soap', item: 'Dish soap' }
    }
  ];

  // ---- State ----
  const state = {
    mode: 'intro',               // 'intro' | 'chore' | 'done'
    index: 0,
    completed: new Set(),
    ordered: new Set()           // chore ids whose order was requested
  };

  // ---- DOM refs ----
  const screens = {
    intro:  document.getElementById('intro'),
    chore:  document.getElementById('chore'),
    done:   document.getElementById('done')
  };
  const progressEl    = document.getElementById('choreProgress');
  const titleEl       = document.getElementById('choreTitle');
  const timeEl        = document.getElementById('choreTime');
  const reqEl         = document.getElementById('requirements');
  const actionsEl     = document.getElementById('choreActions');
  const toastEl       = document.getElementById('toast');
  const doneSummaryEl = document.getElementById('doneSummary');

  // ---- Screen switching ----
  function setScreen(mode) {
    state.mode = mode;
    Object.entries(screens).forEach(([name, el]) => {
      el.classList.toggle('hidden', name !== mode);
    });
    focusFirst();
  }

  // ---- Focus management ----
  // ArrowUp/ArrowDown cycles through [data-focusable] on the visible screen.
  // Enter activates the currently focused element.
  function getFocusables() {
    const active = document.querySelector('.screen:not(.hidden)');
    if (!active) return [];
    return Array.from(active.querySelectorAll('[data-focusable]')).filter(el => !el.hidden);
  }

  function focusFirst() {
    const items = getFocusables();
    if (items.length) items[0].focus();
  }

  function moveFocus(delta) {
    const items = getFocusables();
    if (items.length === 0) return;
    const current = items.indexOf(document.activeElement);
    const next = (current < 0 ? 0 : current + delta + items.length) % items.length;
    items[next].focus();
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); moveFocus(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveFocus(-1); }
    else if (e.key === 'Enter' || e.key === ' ') {
      const el = document.activeElement;
      if (el && el.matches('[data-focusable]')) {
        e.preventDefault();
        el.click();
      }
    }
  });

  // ---- Toast ----
  let toastTimer = null;
  function showToast(text) {
    toastEl.textContent = text;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
  }

  // ---- Chore render ----
  function renderChore() {
    const chore = CHORES[state.index];
    progressEl.textContent = `CHORE ${state.index + 1} / ${CHORES.length}`;
    titleEl.textContent = chore.title;
    timeEl.textContent = `~ ${chore.minutes} MIN`;

    reqEl.innerHTML = '';
    chore.requirements.forEach(r => {
      const li = document.createElement('li');
      li.textContent = r;
      reqEl.appendChild(li);
    });

    actionsEl.innerHTML = '';

    const completeBtn = document.createElement('button');
    completeBtn.className = 'btn success';
    completeBtn.dataset.focusable = '';
    completeBtn.dataset.action = 'complete';
    completeBtn.textContent = state.completed.has(chore.id) ? '✓ Completed' : 'Complete!';
    actionsEl.appendChild(completeBtn);

    if (chore.order) {
      const orderBtn = document.createElement('button');
      const alreadyOrdered = state.ordered.has(chore.id);
      orderBtn.className = 'btn' + (alreadyOrdered ? ' ordered' : '');
      orderBtn.dataset.focusable = '';
      orderBtn.dataset.action = 'order';
      orderBtn.textContent = alreadyOrdered ? '✓ Ordered' : chore.order.label;
      actionsEl.appendChild(orderBtn);
    }

    // Navigation
    const nav = document.createElement('div');
    nav.style.display = 'flex';
    nav.style.gap = '10px';

    if (state.index > 0) {
      const prev = document.createElement('button');
      prev.className = 'btn ghost';
      prev.dataset.focusable = '';
      prev.dataset.action = 'prev';
      prev.textContent = '◀ Previous';
      prev.style.flex = '1';
      nav.appendChild(prev);
    }

    if (state.index < CHORES.length - 1) {
      const next = document.createElement('button');
      next.className = 'btn ghost';
      next.dataset.focusable = '';
      next.dataset.action = 'next';
      next.textContent = 'Next ▶';
      next.style.flex = '1';
      nav.appendChild(next);
    } else {
      const finish = document.createElement('button');
      finish.className = 'btn ghost';
      finish.dataset.focusable = '';
      finish.dataset.action = 'finish';
      finish.textContent = 'Finish ▶';
      finish.style.flex = '1';
      nav.appendChild(finish);
    }
    actionsEl.appendChild(nav);

    focusFirst();
  }

  // ---- Actions ----
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;

    if (action === 'start') {
      setScreen('chore');
      renderChore();
      return;
    }

    if (action === 'restart') {
      state.index = 0;
      state.completed.clear();
      state.ordered.clear();
      setScreen('intro');
      return;
    }

    if (state.mode !== 'chore') return;
    const chore = CHORES[state.index];

    if (action === 'complete') {
      state.completed.add(chore.id);
      showToast(`Nice — "${chore.title}" marked complete`);
      setTimeout(() => {
        if (state.index < CHORES.length - 1) {
          state.index += 1;
          renderChore();
        } else {
          finish();
        }
      }, 650);
    } else if (action === 'order') {
      if (!state.ordered.has(chore.id)) {
        state.ordered.add(chore.id);
        showToast(`Order placed: ${chore.order.item}`);
        renderChore();
      }
    } else if (action === 'next') {
      state.index = Math.min(state.index + 1, CHORES.length - 1);
      renderChore();
    } else if (action === 'prev') {
      state.index = Math.max(state.index - 1, 0);
      renderChore();
    } else if (action === 'finish') {
      finish();
    }
  });

  function finish() {
    const done = state.completed.size;
    const orders = state.ordered.size;
    doneSummaryEl.textContent =
      `${done} of ${CHORES.length} chores completed` +
      (orders ? ` · ${orders} supply request${orders === 1 ? '' : 's'} placed` : '');
    setScreen('done');
  }

  // ---- Init ----
  setScreen('intro');
})();
