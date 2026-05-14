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

  document.addEventListener('keydown', function (event) {
    const key = event.key;

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

  start();
})();
