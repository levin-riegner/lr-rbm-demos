(function () {
  'use strict';

  const els = {
    picker: document.getElementById('picker'),
    pickerList: document.getElementById('picker-list'),
    loading: document.getElementById('loading'),
    loadingText: document.getElementById('loading-text'),
    loadingSub: document.getElementById('loading-sub'),
    error: document.getElementById('error'),
    errorMessage: document.getElementById('error-message'),
    errorHint: document.getElementById('error-hint'),
    stepper: document.getElementById('stepper'),
    finished: document.getElementById('finished'),
    counter: document.getElementById('step-counter'),
    title: document.getElementById('recipe-title'),
    text: document.getElementById('step-text'),
    dots: document.getElementById('progress-dots'),
    pagePips: document.getElementById('page-pips'),
    hintPrev: document.getElementById('hint-prev'),
    hintNext: document.getElementById('hint-next'),
    finishedRecipe: document.getElementById('finished-recipe'),
    measure: document.getElementById('step-measure'),
  };

  const state = {
    title: '',
    pages: [],
    pageMap: [],
    stepCount: 0,
    cursor: 0,
    pickerIndex: 0,
    pickerItems: [],
    lastError: null,
  };

  const SCREENS = ['picker', 'loading', 'error', 'stepper', 'finished'];

  function showScreen(name) {
    SCREENS.forEach(function (key) {
      els[key].classList.toggle('hidden', key !== name);
    });
  }

  function setLoading(text, sub) {
    els.loadingText.textContent = text || 'Loading';
    els.loadingSub.textContent = sub || '';
    showScreen('loading');
  }

  function showError(message, hint) {
    state.lastError = message || 'Unable to load recipe';
    els.errorMessage.textContent = state.lastError;
    els.errorHint.textContent = hint || 'Press Enter to retry';
    showScreen('error');
  }

  function normalizeRecipe(payload) {
    if (Array.isArray(payload)) {
      return { title: 'Recipe', steps: payload.map(stepToString).filter(Boolean) };
    }
    if (payload && typeof payload === 'object' && Array.isArray(payload.steps)) {
      return {
        title: typeof payload.title === 'string' ? payload.title : 'Recipe',
        steps: payload.steps.map(stepToString).filter(Boolean),
      };
    }
    throw new Error('Recipe JSON must be an array or have a "steps" array.');
  }

  function stepToString(step) {
    if (typeof step === 'string') return step.trim();
    if (step && typeof step === 'object') {
      if (typeof step.instruction === 'string') return step.instruction.trim();
      if (typeof step.text === 'string') return step.text.trim();
    }
    return '';
  }

  function paginateStep(rawText) {
    const measure = els.measure;
    const body = els.text.parentElement;
    const cs = getComputedStyle(body);
    const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const maxW = body.clientWidth - padX;
    const maxH = body.clientHeight - padY;

    measure.style.width = maxW + 'px';
    measure.style.maxHeight = 'none';
    measure.textContent = rawText;
    if (measure.scrollHeight <= maxH) {
      return [rawText];
    }

    const words = rawText.split(/\s+/);
    const pages = [];
    let start = 0;
    while (start < words.length) {
      let lo = start + 1;
      let hi = words.length;
      let best = lo;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        measure.textContent = words.slice(start, mid).join(' ');
        if (measure.scrollHeight <= maxH) {
          best = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      pages.push(words.slice(start, best).join(' '));
      start = best;
    }
    return pages;
  }

  function buildPagination(steps) {
    const pages = [];
    const map = [];
    steps.forEach(function (step, stepIndex) {
      const stepPages = paginateStep(step);
      stepPages.forEach(function (text, pageIndex) {
        map.push({ stepIndex: stepIndex, pageIndex: pageIndex, totalPages: stepPages.length });
        pages.push(text);
      });
    });
    return { pages: pages, map: map };
  }

  function renderDots() {
    els.dots.innerHTML = '';
    const total = state.stepCount;
    if (total === 0) return;
    if (total > 14) {
      const span = document.createElement('span');
      span.className = 'progress-numeric';
      const current = state.pageMap[state.cursor].stepIndex + 1;
      span.textContent = current + ' / ' + total;
      els.dots.appendChild(span);
      return;
    }
    const currentStep = state.pageMap[state.cursor].stepIndex;
    for (let i = 0; i < total; i += 1) {
      const dot = document.createElement('span');
      dot.className = 'progress-dot';
      if (i < currentStep) dot.classList.add('completed');
      if (i === currentStep) dot.classList.add('active');
      els.dots.appendChild(dot);
    }
  }

  function renderPagePips() {
    els.pagePips.innerHTML = '';
    const entry = state.pageMap[state.cursor];
    if (!entry || entry.totalPages <= 1) return;
    for (let i = 0; i < entry.totalPages; i += 1) {
      const pip = document.createElement('span');
      pip.className = 'page-pip';
      if (i === entry.pageIndex) pip.classList.add('active');
      els.pagePips.appendChild(pip);
    }
  }

  function renderCurrent() {
    if (state.cursor >= state.pages.length) {
      els.finishedRecipe.textContent = state.title;
      showScreen('finished');
      return;
    }
    showScreen('stepper');
    const entry = state.pageMap[state.cursor];
    els.title.textContent = state.title;
    els.counter.textContent = 'Step ' + (entry.stepIndex + 1) + ' of ' + state.stepCount;
    els.text.textContent = state.pages[state.cursor];
    els.hintPrev.classList.toggle('disabled', state.cursor === 0);
    els.hintNext.classList.toggle('disabled', false);
    renderDots();
    renderPagePips();
  }

  function next() {
    if (state.cursor < state.pages.length) {
      state.cursor += 1;
      renderCurrent();
    }
  }

  function prev() {
    if (state.cursor > 0) {
      state.cursor -= 1;
      renderCurrent();
    }
  }

  async function fetchJson(url) {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error('Request failed (' + response.status + ')');
    return response.json();
  }

  async function extractFromUrl(pageUrl, endpoint) {
    const target = endpoint || '/api/extract';
    const response = await fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: pageUrl }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(function () { return ''; });
      throw new Error('Extractor returned ' + response.status + (detail ? ': ' + detail.slice(0, 80) : ''));
    }
    return response.json();
  }

  function startWithRecipe(recipe) {
    const normalized = normalizeRecipe(recipe);
    if (normalized.steps.length === 0) {
      throw new Error('Recipe has no steps.');
    }
    state.title = normalized.title;
    state.stepCount = normalized.steps.length;
    showScreen('stepper');
    const built = buildPagination(normalized.steps);
    state.pages = built.pages;
    state.pageMap = built.map;
    state.cursor = 0;
    renderCurrent();
  }

  async function runFromQuery() {
    const params = new URLSearchParams(window.location.search);
    const jsonUrl = params.get('recipe');
    const pageUrl = params.get('url');
    const aiEndpoint = params.get('ai') || window.AI_ENDPOINT || null;
    const presetId = params.get('id');

    if (presetId) {
      setLoading('Loading recipe', presetId);
      try {
        const data = await fetchJson('recipes.json');
        const match = (data.recipes || []).find(function (r) { return r.id === presetId; });
        if (!match) throw new Error('No recipe with id "' + presetId + '"');
        startWithRecipe(match);
      } catch (err) { showError(err.message); }
      return true;
    }

    if (jsonUrl) {
      setLoading('Loading recipe JSON', jsonUrl);
      try {
        const payload = await fetchJson(jsonUrl);
        startWithRecipe(payload);
      } catch (err) { showError(err.message); }
      return true;
    }

    if (pageUrl) {
      setLoading('Extracting recipe', pageUrl);
      try {
        const payload = await extractFromUrl(pageUrl, aiEndpoint);
        startWithRecipe(payload);
      } catch (err) { showError(err.message, 'Press Enter to try again'); }
      return true;
    }

    return false;
  }

  function renderPicker() {
    els.pickerList.innerHTML = '';
    state.pickerItems.forEach(function (item, idx) {
      const li = document.createElement('li');
      li.className = 'picker-item' + (idx === state.pickerIndex ? ' focused' : '');
      li.dataset.index = String(idx);
      const titleEl = document.createElement('div');
      titleEl.className = 'picker-item-title';
      titleEl.textContent = item.title;
      const metaEl = document.createElement('div');
      metaEl.className = 'picker-item-meta';
      const metaParts = [];
      if (item.totalTime) metaParts.push(item.totalTime);
      if (item.source) metaParts.push(new URL(item.source).host.replace(/^www\./, ''));
      metaEl.textContent = metaParts.join(' · ');
      li.appendChild(titleEl);
      li.appendChild(metaEl);
      els.pickerList.appendChild(li);
    });
    const focused = els.pickerList.querySelector('.picker-item.focused');
    if (focused && typeof focused.scrollIntoView === 'function') {
      focused.scrollIntoView({ block: 'nearest' });
    }
  }

  async function showPicker() {
    setLoading('Loading recipes');
    try {
      const data = await fetchJson('recipes.json');
      state.pickerItems = data.recipes || [];
      if (state.pickerItems.length === 0) throw new Error('No recipes available');
      state.pickerIndex = 0;
      renderPicker();
      showScreen('picker');
    } catch (err) {
      showError(err.message, 'Press Enter to retry');
    }
  }

  function pickerSelect() {
    const item = state.pickerItems[state.pickerIndex];
    if (!item) return;
    try { startWithRecipe(item); }
    catch (err) { showError(err.message); }
  }

  function pickerMove(delta) {
    const total = state.pickerItems.length;
    if (total === 0) return;
    state.pickerIndex = (state.pickerIndex + delta + total) % total;
    renderPicker();
  }

  // Back gesture from the stepper / finished / error screens: return to the
  // picker with the recipe that was open still highlighted.
  async function backToPicker() {
    const title = state.title;
    await showPicker();
    const idx = state.pickerItems.findIndex(function (r) { return r.title === title; });
    if (idx >= 0) {
      state.pickerIndex = idx;
      renderPicker();
    }
  }

  document.addEventListener('keydown', function (event) {
    const key = event.key;

    if (key === 'Escape') {
      if (els.picker.classList.contains('hidden') && els.loading.classList.contains('hidden')) {
        event.preventDefault();
        backToPicker();
      }
      return;
    }

    if (!els.picker.classList.contains('hidden')) {
      if (key === 'ArrowDown' || key === 'ArrowRight') { event.preventDefault(); pickerMove(1); return; }
      if (key === 'ArrowUp' || key === 'ArrowLeft') { event.preventDefault(); pickerMove(-1); return; }
      if (key === 'Enter') { event.preventDefault(); pickerSelect(); return; }
      return;
    }

    if (!els.stepper.classList.contains('hidden')) {
      if (key === 'ArrowRight') { event.preventDefault(); next(); return; }
      if (key === 'ArrowLeft') { event.preventDefault(); prev(); return; }
      return;
    }

    if (!els.finished.classList.contains('hidden')) {
      if (key === 'ArrowLeft') { event.preventDefault(); prev(); return; }
      if (key === 'Enter') { event.preventDefault(); showPicker(); return; }
      return;
    }

    if (!els.error.classList.contains('hidden')) {
      if (key === 'Enter') { event.preventDefault(); start(); }
    }
  });

  els.pickerList.addEventListener('click', function (event) {
    const item = event.target.closest('.picker-item');
    if (!item) return;
    state.pickerIndex = parseInt(item.dataset.index, 10) || 0;
    renderPicker();
    pickerSelect();
  });

  async function start() {
    const handled = await runFromQuery();
    if (!handled) await showPicker();
  }

  // ---- WebMCP (Meta AI voice control) ----
  // Additive: the app works identically when document.modelContext is absent.
  // Utterances: "open the pancakes recipe" / "next step" / "go back a step" /
  // "jump to step 6" / "what's the current step?"

  function currentScreen() {
    return SCREENS.find(function (key) { return !els[key].classList.contains('hidden'); }) || 'loading';
  }

  // Full text of a step (all of its pages joined), by 0-based step index.
  function stepText(stepIndex) {
    const parts = [];
    state.pageMap.forEach(function (entry, i) {
      if (entry.stepIndex === stepIndex) parts.push(state.pages[i]);
    });
    return parts.join(' ');
  }

  // Jump to the first page of a 0-based step; stepCount means "finished".
  function goToStep(stepIndex) {
    if (stepIndex >= state.stepCount) {
      state.cursor = state.pages.length;
    } else {
      const first = state.pageMap.findIndex(function (entry) { return entry.stepIndex === stepIndex; });
      state.cursor = first >= 0 ? first : 0;
    }
    renderCurrent();
  }

  function currentStepIndex() {
    if (state.cursor >= state.pages.length) return state.stepCount; // finished
    return state.pageMap[state.cursor].stepIndex;
  }

  function recipeNames() {
    return state.pickerItems.map(function (r, i) { return (i + 1) + ': ' + r.title; }).join('; ');
  }

  function snapshot(next) {
    const screen = currentScreen();
    const out = { screen: screen, next_action: next };
    if (screen === 'picker') {
      out.recipes = recipeNames();
      out.highlighted = state.pickerItems[state.pickerIndex] ? state.pickerItems[state.pickerIndex].title : null;
    } else if (screen === 'stepper' || screen === 'finished') {
      out.recipe = state.title;
      out.total_steps = state.stepCount;
      if (screen === 'finished') {
        out.finished = true;
      } else {
        const stepIndex = currentStepIndex();
        out.step = stepIndex + 1;
        out.step_text = stepText(stepIndex);
        out.is_last_step = stepIndex === state.stepCount - 1;
      }
    } else if (screen === 'error') {
      out.error = true;
      out.message = state.lastError;
    }
    return out;
  }

  async function ensurePickerItems(signal) {
    if (state.pickerItems.length) return state.pickerItems;
    const response = await fetch('recipes.json', { cache: 'no-store', signal: signal });
    if (!response.ok) throw new Error('Request failed (' + response.status + ')');
    const data = await response.json();
    state.pickerItems = data.recipes || [];
    return state.pickerItems;
  }

  function registerWebMcp() {
    const ctx = document.modelContext;
    if (!ctx || typeof ctx.registerTool !== 'function') return;

    function safeRegister(tool) {
      try {
        const r = ctx.registerTool(tool);
        if (r && typeof r.then === 'function') {
          r.then(undefined, (err) => console.error(tool.name + ' registration failed', err));
        }
      } catch (err) {
        console.error(tool.name + ' registration failed', err);
      }
    }

    const READ_STEP = 'Read only the current step aloud, then stop.';
    const NO_RECIPE = 'Call recipe_open with a recipe name first.';

    function requireStepper() {
      const screen = currentScreen();
      if (screen === 'stepper' || screen === 'finished') return null;
      return { error: true, message: 'No recipe is open.', screen: screen, recipes: recipeNames(), next_action: NO_RECIPE };
    }

    safeRegister({
      name: 'recipe_get_state',
      description: 'Report which screen is showing, the open recipe, the current step number and its full text, or the list of available recipes on the picker.',
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true },
      execute: () => snapshot(currentScreen() === 'stepper'
        ? READ_STEP
        : 'Tell the wearer what is on screen in one short sentence, then stop.'),
    });

    safeRegister({
      name: 'recipe_open',
      description: 'Open one of the bundled recipes by name (partial, case-insensitive match on the title) or by its 1-based number in the list, and show step 1. Returns the recipe title, step count and first step.',
      inputSchema: {
        type: 'object',
        properties: { recipe: { type: 'string', description: 'Recipe name (e.g. "pancakes") or list number (e.g. "2").' } },
        required: ['recipe'],
      },
      execute: async (args, opts) => {
        const want = String(args && args.recipe != null ? args.recipe : '').trim().toLowerCase();
        let items;
        try { items = await ensurePickerItems(opts && opts.signal); }
        catch (err) { return { error: true, message: 'Could not load the recipe list: ' + err.message, next_action: 'Tell the wearer the recipes could not be loaded, then stop.' }; }
        let item = null;
        if (/^\d+$/.test(want)) item = items[parseInt(want, 10) - 1] || null;
        if (!item && want) {
          item = items.find(function (r) { return r.id === want || r.title.toLowerCase() === want; })
              || items.find(function (r) { return r.title.toLowerCase().indexOf(want) !== -1; })
              || null;
        }
        if (!item) {
          return { error: true, message: 'No recipe matches "' + want + '".', recipes: recipeNames(), next_action: 'Offer the recipe names and call again.' };
        }
        try { startWithRecipe(item); }
        catch (err) { showError(err.message); return { error: true, message: err.message, next_action: 'Tell the wearer the recipe could not be opened, then stop.' }; }
        return snapshot('Say the recipe name and step count, read step 1, then stop.');
      },
    });

    safeRegister({
      name: 'recipe_next_step',
      description: 'Advance to the next step of the open recipe (after the last step, shows the "all steps complete" screen). Returns the new step text.',
      inputSchema: { type: 'object', properties: {} },
      execute: () => {
        const blocked = requireStepper();
        if (blocked) return blocked;
        if (currentScreen() === 'finished') {
          return snapshot('Tell the wearer the recipe is already complete, then stop.');
        }
        goToStep(currentStepIndex() + 1);
        return snapshot(currentScreen() === 'finished'
          ? 'Tell the wearer all steps are complete, then stop.'
          : READ_STEP);
      },
    });

    safeRegister({
      name: 'recipe_previous_step',
      description: 'Go back to the previous step of the open recipe (from the finished screen, back to the last step). Returns the step text.',
      inputSchema: { type: 'object', properties: {} },
      execute: () => {
        const blocked = requireStepper();
        if (blocked) return blocked;
        goToStep(Math.max(0, currentStepIndex() - 1));
        return snapshot(READ_STEP);
      },
    });

    safeRegister({
      name: 'recipe_go_to_step',
      description: 'Jump to a specific step of the open recipe by its 1-based number. Returns that step text.',
      inputSchema: {
        type: 'object',
        properties: { number: { type: 'integer', description: 'Step number, from 1 to the total number of steps.' } },
        required: ['number'],
      },
      execute: (args) => {
        const blocked = requireStepper();
        if (blocked) return blocked;
        const n = parseInt(args && args.number, 10);
        if (isNaN(n) || n < 1 || n > state.stepCount) {
          return { error: true, message: 'Step must be between 1 and ' + state.stepCount + '.', total_steps: state.stepCount, next_action: 'Ask which step and call again.' };
        }
        goToStep(n - 1);
        return snapshot(READ_STEP);
      },
    });
  }

  start();
  registerWebMcp();
})();
