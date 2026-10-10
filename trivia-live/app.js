// Trivia Live — Meta Display Glasses webapp
// Data: Open Trivia DB (no API key). D-pad + Enter navigation.

(function () {
  'use strict';

  // ==================== CONFIG ====================
  var CONFIG = {
    appName: 'Trivia Live',
    storageKey: 'mdg_trivia_live',
    api: {
      baseUrl: 'https://opentdb.com/api.php',
    },
    quiz: {
      amount: 10,
      perQuestionSeconds: 15,
      feedbackMs: 1500,
    },
  };

  var CATEGORIES = [
    { id: 9,  name: 'General' },
    { id: 17, name: 'Science' },
    { id: 23, name: 'History' },
    { id: 22, name: 'Geography' },
    { id: 11, name: 'Film' },
    { id: 21, name: 'Sports' },
  ];

  var DIFFICULTIES = [
    { id: 'easy',   name: 'Easy'   },
    { id: 'medium', name: 'Medium' },
    { id: 'hard',   name: 'Hard'   },
  ];

  // ==================== STATE ====================
  var state = {
    currentScreen: 'start',
    screenHistory: [],
    selection: {
      categoryId: 9,
      difficulty: 'easy',
    },
    quiz: {
      questions: [],        // normalized: { question, correct, answers: [4], correctIdx, category, difficulty }
      index: 0,
      score: 0,
      selectedIdx: -1,      // user's choice for current q (-1 if timeout)
      answered: false,
      timer: null,          // 1 s UI interval (stopped while the page is hidden)
      deadline: null,       // wall-clock ms when the current question times out
      advanceTimer: null,   // feedback → next question one-shot
      loader: null,         // AbortController for the in-flight question fetch
      remaining: 0,
      results: [],          // per-question result: { question, yourIdx, correctIdx, answers, isCorrect }
    },
    highScores: {}, // { "9_easy": 8, ... }
  };

  var screens = {};

  function collectScreens() {
    document.querySelectorAll('.screen').forEach(function (s) {
      if (s.id) screens[s.id] = s;
    });
  }

  // ==================== NAVIGATION ====================
  function navigateTo(screenId, options) {
    options = options || {};
    var addToHistory = options.addToHistory !== false;
    if (addToHistory && state.currentScreen && state.currentScreen !== screenId) {
      state.screenHistory.push(state.currentScreen);
    }
    Object.values(screens).forEach(function (s) { s.classList.add('hidden'); });
    if (screens[screenId]) {
      screens[screenId].classList.remove('hidden');
      state.currentScreen = screenId;
      onScreenEnter(screenId);
      focusFirst(screens[screenId]);
    }
  }

  function navigateBack() {
    // In this app, the back gesture always goes back to Start (reset)
    stopTimer();
    clearFeedback();
    abortLoad();
    state.screenHistory = [];
    navigateTo('start', { addToHistory: false });
  }

  function abortLoad() {
    if (state.quiz.loader) {
      try { state.quiz.loader.abort(); } catch (e) { /* ignore */ }
      state.quiz.loader = null;
    }
  }

  // ==================== FOCUS ====================
  function focusFirst(container) {
    // Prefer the currently-selected chip when on the start screen
    var selected = container.querySelector('.focusable.selected');
    if (selected) { selected.focus(); return; }
    var el = container.querySelector('.focusable:not([disabled]):not(.hidden)');
    if (el) el.focus();
  }

  function moveFocus(direction) {
    var container = screens[state.currentScreen];
    if (!container) return;
    var focusables = Array.from(
      container.querySelectorAll('.focusable:not([disabled]):not(.hidden)')
    );
    if (focusables.length === 0) return;

    var current = document.activeElement;
    var idx = focusables.indexOf(current);
    if (idx === -1) { focusFirst(container); return; }

    var nextIdx;
    if (direction === 'up' || direction === 'left') {
      nextIdx = idx > 0 ? idx - 1 : focusables.length - 1;
    } else {
      nextIdx = idx < focusables.length - 1 ? idx + 1 : 0;
    }
    focusables[nextIdx].focus();
    focusables[nextIdx].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  // ==================== HELPERS ====================
  function decodeHtml(s) {
    if (s == null) return '';
    var ta = document.createElement('textarea');
    ta.innerHTML = s;
    return ta.value;
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function hsKey(catId, diff) { return catId + '_' + diff; }

  function loadData() {
    try {
      var saved = localStorage.getItem(CONFIG.storageKey);
      if (saved) {
        var data = JSON.parse(saved);
        if (data && typeof data === 'object') {
          state.highScores = data.highScores || {};
          if (data.selection) {
            if (typeof data.selection.categoryId === 'number') {
              state.selection.categoryId = data.selection.categoryId;
            }
            if (typeof data.selection.difficulty === 'string') {
              state.selection.difficulty = data.selection.difficulty;
            }
          }
        }
      }
    } catch (e) { /* ignore */ }
  }

  function saveData() {
    try {
      localStorage.setItem(CONFIG.storageKey, JSON.stringify({
        highScores: state.highScores,
        selection: state.selection,
      }));
    } catch (e) { /* ignore */ }
  }

  // ==================== API ====================
  function fetchQuestions(signal) {
    var url = CONFIG.api.baseUrl
      + '?amount=' + CONFIG.quiz.amount
      + '&category=' + state.selection.categoryId
      + '&difficulty=' + encodeURIComponent(state.selection.difficulty)
      + '&type=multiple';

    navigateTo('loading', { addToHistory: false });

    return fetch(url, signal ? { signal: signal } : undefined)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        if (!data || data.response_code !== 0 || !Array.isArray(data.results) || data.results.length === 0) {
          var codes = {
            1: 'Not enough questions for this combo',
            2: 'Invalid parameter',
            3: 'Token not found',
            4: 'Token empty',
            5: 'Rate limit — try again in a few seconds',
          };
          throw new Error((data && codes[data.response_code]) || 'No questions returned');
        }
        return data.results.map(function (q) {
          var correct = decodeHtml(q.correct_answer);
          var incorrect = (q.incorrect_answers || []).map(decodeHtml);
          var all = shuffle(incorrect.concat([correct]));
          var correctIdx = all.indexOf(correct);
          return {
            question: decodeHtml(q.question),
            correct: correct,
            answers: all,
            correctIdx: correctIdx,
            category: decodeHtml(q.category || ''),
            difficulty: q.difficulty || state.selection.difficulty,
          };
        });
      });
  }

  // ==================== START SCREEN ====================
  function renderStartScreen() {
    // Categories
    var catRow = document.getElementById('category-row');
    catRow.innerHTML = '';
    CATEGORIES.forEach(function (c) {
      var btn = document.createElement('button');
      btn.className = 'chip focusable' + (c.id === state.selection.categoryId ? ' selected' : '');
      btn.dataset.action = 'select-category';
      btn.dataset.categoryId = String(c.id);
      btn.textContent = c.name;
      catRow.appendChild(btn);
    });

    // Difficulty
    var diffRow = document.getElementById('difficulty-row');
    diffRow.innerHTML = '';
    DIFFICULTIES.forEach(function (d) {
      var btn = document.createElement('button');
      btn.className = 'chip focusable' + (d.id === state.selection.difficulty ? ' selected' : '');
      btn.dataset.action = 'select-difficulty';
      btn.dataset.difficulty = d.id;
      btn.textContent = d.name;
      diffRow.appendChild(btn);
    });

    // Best score for current combo
    var best = state.highScores[hsKey(state.selection.categoryId, state.selection.difficulty)];
    var bestMeta = document.getElementById('best-meta');
    bestMeta.textContent = (best != null) ? ('Best: ' + best + '/10') : 'Best: —';
  }

  // ==================== QUIZ ====================
  // Returns a promise that settles once the quiz screen (or error screen) is
  // showing. `signal` (optional) aborts the fetch, e.g. a WebMCP deadline.
  function startQuiz(signal) {
    abortLoad();
    var ctrl = (typeof AbortController === 'function') ? new AbortController() : null;
    state.quiz.loader = ctrl;
    if (ctrl && signal) {
      if (signal.aborted) ctrl.abort();
      else signal.addEventListener('abort', function () { ctrl.abort(); });
    }
    return fetchQuestions(ctrl ? ctrl.signal : undefined)
      .then(function (questions) {
        if (ctrl && state.quiz.loader !== ctrl) return; // superseded or aborted
        state.quiz.loader = null;
        state.quiz.questions = questions;
        state.quiz.index = 0;
        state.quiz.score = 0;
        state.quiz.results = [];
        navigateTo('quiz', { addToHistory: false });
      })
      .catch(function (err) {
        if (ctrl && state.quiz.loader !== ctrl) return; // superseded or aborted
        state.quiz.loader = null;
        if (err && err.name === 'AbortError') {
          if (state.currentScreen === 'loading') navigateTo('start', { addToHistory: false });
          return;
        }
        showError(err && err.message ? err.message : 'Failed to load questions');
      });
  }

  function showError(message) {
    var el = document.getElementById('error-message');
    if (el) el.textContent = 'Could not load questions: ' + message;
    navigateTo('error', { addToHistory: false });
  }

  function renderCurrentQuestion() {
    var q = state.quiz.questions[state.quiz.index];
    if (!q) { finishQuiz(); return; }

    state.quiz.selectedIdx = -1;
    state.quiz.answered = false;

    document.getElementById('q-count').textContent =
      'Q ' + (state.quiz.index + 1) + '/' + state.quiz.questions.length;

    var chipText = q.category + ' · ' +
      (q.difficulty ? q.difficulty.charAt(0).toUpperCase() + q.difficulty.slice(1) : '');
    var chip = document.getElementById('q-chip');
    chip.textContent = chipText;
    chip.title = chipText;

    document.getElementById('q-score').textContent = String(state.quiz.score);
    document.getElementById('question-text').textContent = q.question;

    var letters = ['A', 'B', 'C', 'D'];
    var answersEl = document.getElementById('answers');
    answersEl.innerHTML = '';
    q.answers.forEach(function (ans, i) {
      var btn = document.createElement('button');
      btn.className = 'answer-btn focusable';
      btn.dataset.action = 'answer';
      btn.dataset.answerIdx = String(i);
      btn.innerHTML =
        '<span class="answer-letter">' + letters[i] + '</span>' +
        '<span class="answer-text"></span>';
      btn.querySelector('.answer-text').textContent = ans;
      answersEl.appendChild(btn);
    });

    startTimer(CONFIG.quiz.perQuestionSeconds);

    // Focus first answer after render
    var first = answersEl.querySelector('.focusable');
    if (first) first.focus();
  }

  // The countdown is wall-clock based (deadline timestamp); the 1 s interval
  // only refreshes the UI, so it can be paused while the page is hidden and
  // reconciled on resume without drifting.
  function startTimer(seconds) {
    stopTimer();
    state.quiz.remaining = seconds;
    state.quiz.deadline = Date.now() + seconds * 1000;
    updateTimerUI();
    resumeTimer();
  }

  function timerTick() {
    if (state.quiz.deadline == null) return;
    state.quiz.remaining = Math.max(0, Math.ceil((state.quiz.deadline - Date.now()) / 1000));
    updateTimerUI();
    if (state.quiz.remaining <= 0) {
      stopTimer();
      handleTimeout();
    }
  }

  function resumeTimer() {
    if (state.quiz.timer || state.quiz.deadline == null || document.hidden) return;
    state.quiz.timer = setInterval(timerTick, 1000);
  }

  function pauseTimer() {
    if (state.quiz.timer) {
      clearInterval(state.quiz.timer);
      state.quiz.timer = null;
    }
  }

  function stopTimer() {
    pauseTimer();
    state.quiz.deadline = null;
    if (state.quiz.advanceTimer) {
      clearTimeout(state.quiz.advanceTimer);
      state.quiz.advanceTimer = null;
    }
  }

  // Lifecycle: freeze the UI interval while hidden; on return, reconcile the
  // countdown against the wall clock (timing out if the deadline passed).
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      pauseTimer();
    } else if (state.quiz.deadline != null && !state.quiz.answered) {
      timerTick();
      resumeTimer();
    }
  });

  function updateTimerUI() {
    var total = CONFIG.quiz.perQuestionSeconds;
    var r = Math.max(0, state.quiz.remaining);
    var pct = Math.max(0, Math.min(100, (r / total) * 100));
    var fill = document.getElementById('timer-fill');
    var num = document.getElementById('timer-num');
    if (fill) {
      fill.style.width = pct + '%';
      fill.classList.toggle('warn', r <= 5);
    }
    if (num) {
      num.textContent = String(r);
      num.classList.toggle('warn', r <= 5);
    }
  }

  function handleAnswer(idx) {
    if (state.quiz.answered) return;
    state.quiz.answered = true;
    stopTimer();
    state.quiz.selectedIdx = idx;

    var q = state.quiz.questions[state.quiz.index];
    var isCorrect = idx === q.correctIdx;
    if (isCorrect) state.quiz.score += 1;

    highlightAnswers(q, idx);
    document.getElementById('q-score').textContent = String(state.quiz.score);

    state.quiz.results.push({
      question: q.question,
      answers: q.answers,
      yourIdx: idx,
      correctIdx: q.correctIdx,
      isCorrect: isCorrect,
    });

    showFeedback(isCorrect ? 'correct' : 'wrong');
    state.quiz.advanceTimer = setTimeout(advance, CONFIG.quiz.feedbackMs);
  }

  function handleTimeout() {
    if (state.quiz.answered) return;
    state.quiz.answered = true;
    var q = state.quiz.questions[state.quiz.index];
    highlightAnswers(q, -1);

    state.quiz.results.push({
      question: q.question,
      answers: q.answers,
      yourIdx: -1,
      correctIdx: q.correctIdx,
      isCorrect: false,
    });

    showFeedback('timeout');
    state.quiz.advanceTimer = setTimeout(advance, CONFIG.quiz.feedbackMs);
  }

  function highlightAnswers(q, chosenIdx) {
    var btns = document.querySelectorAll('#answers .answer-btn');
    btns.forEach(function (b, i) {
      b.disabled = true;
      b.classList.remove('correct', 'wrong');
      if (i === q.correctIdx) b.classList.add('correct');
      if (chosenIdx !== -1 && i === chosenIdx && chosenIdx !== q.correctIdx) {
        b.classList.add('wrong');
      }
    });
  }

  function showFeedback(kind) {
    clearFeedback();
    var el = document.createElement('div');
    el.className = 'feedback-banner ' + kind;
    el.id = 'feedback-banner';
    if (kind === 'correct') el.textContent = 'Correct!';
    else if (kind === 'wrong') el.textContent = 'Incorrect';
    else el.textContent = 'Time\'s up!';
    screens.quiz.appendChild(el);
  }

  function clearFeedback() {
    var el = document.getElementById('feedback-banner');
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function advance() {
    state.quiz.advanceTimer = null;
    clearFeedback();
    state.quiz.index += 1;
    if (state.quiz.index >= state.quiz.questions.length) {
      finishQuiz();
    } else {
      renderCurrentQuestion();
    }
  }

  function finishQuiz() {
    stopTimer();
    clearFeedback();

    // Update high score
    var key = hsKey(state.selection.categoryId, state.selection.difficulty);
    var prev = state.highScores[key];
    var newBest = (prev == null) || state.quiz.score > prev;
    if (newBest) state.highScores[key] = state.quiz.score;
    saveData();

    renderResults(newBest && prev != null);
    navigateTo('results', { addToHistory: false });
  }

  // ==================== RESULTS ====================
  function renderResults(isNewBest) {
    var total = state.quiz.questions.length;
    document.getElementById('score-big').textContent = state.quiz.score + '/' + total;

    var key = hsKey(state.selection.categoryId, state.selection.difficulty);
    var best = state.highScores[key];
    var cat = CATEGORIES.find(function (c) { return c.id === state.selection.categoryId; });
    var diff = state.selection.difficulty;
    var catName = cat ? cat.name : '';
    var diffName = diff ? diff.charAt(0).toUpperCase() + diff.slice(1) : '';

    var sub = document.getElementById('score-sub');
    sub.innerHTML = '';
    var line = document.createElement('span');
    line.textContent = catName + ' · ' + diffName + ' · Best ' + (best != null ? best : '—') + '/' + total;
    sub.appendChild(line);
    if (isNewBest) {
      var badge = document.createElement('span');
      badge.className = 'best-badge';
      badge.textContent = 'NEW BEST';
      sub.appendChild(badge);
    }
    document.getElementById('results-best').textContent = 'Best ' + (best != null ? best : '—') + '/' + total;

    var list = document.getElementById('review-list');
    list.innerHTML = '';
    state.quiz.results.forEach(function (r, i) {
      var item = document.createElement('div');
      item.className = 'review-item ' + (r.isCorrect ? 'correct' : 'wrong');
      var q = document.createElement('div');
      q.className = 'review-q';
      q.textContent = (i + 1) + '. ' + r.question;
      var a = document.createElement('div');
      a.className = 'review-a';
      var yourText = (r.yourIdx === -1) ? '(no answer)' : r.answers[r.yourIdx];
      var correctText = r.answers[r.correctIdx];
      if (r.isCorrect) {
        a.innerHTML = '';
        var ok = document.createElement('span'); ok.className = 'ans'; ok.textContent = '✓ ' + correctText;
        a.appendChild(ok);
      } else {
        var youSpan = document.createElement('span'); youSpan.className = 'you'; youSpan.textContent = '✗ ' + yourText;
        var ansSpan = document.createElement('span'); ansSpan.className = 'ans'; ansSpan.textContent = ' · ' + correctText;
        a.appendChild(youSpan);
        a.appendChild(ansSpan);
      }
      item.appendChild(q);
      item.appendChild(a);
      list.appendChild(item);
    });
  }

  // ==================== ACTIONS ====================
  function handleAction(action, element) {
    switch (action) {
      case 'select-category': {
        var cid = parseInt(element.dataset.categoryId, 10);
        if (!isNaN(cid)) {
          state.selection.categoryId = cid;
          saveData();
          renderStartScreen();
          // Refocus the just-chosen chip
          setTimeout(function () {
            var sel = document.querySelector('#category-row .chip.selected');
            if (sel) sel.focus();
          }, 0);
        }
        break;
      }
      case 'select-difficulty': {
        var d = element.dataset.difficulty;
        if (d) {
          state.selection.difficulty = d;
          saveData();
          renderStartScreen();
          setTimeout(function () {
            var sel = document.querySelector('#difficulty-row .chip.selected');
            if (sel) sel.focus();
          }, 0);
        }
        break;
      }
      case 'start-quiz':
        startQuiz();
        break;
      case 'answer': {
        var ai = parseInt(element.dataset.answerIdx, 10);
        if (!isNaN(ai)) handleAnswer(ai);
        break;
      }
      case 'play-again':
        startQuiz();
        break;
      case 'go-start':
        stopTimer();
        clearFeedback();
        state.screenHistory = [];
        navigateTo('start', { addToHistory: false });
        break;
      case 'retry':
        startQuiz();
        break;
      default:
        break;
    }
  }

  function onScreenEnter(screenId) {
    if (screenId === 'start') {
      stopTimer();
      clearFeedback();
      renderStartScreen();
    } else if (screenId === 'quiz') {
      renderCurrentQuestion();
    }
  }

  // ==================== EVENTS ====================
  function setupEvents() {
    document.addEventListener('click', function (e) {
      var actionEl = e.target.closest('[data-action]');
      if (actionEl && !actionEl.disabled) handleAction(actionEl.dataset.action, actionEl);
    });

    document.addEventListener('keydown', function (e) {
      switch (e.key) {
        case 'ArrowUp':    moveFocus('up');    e.preventDefault(); break;
        case 'ArrowDown':  moveFocus('down');  e.preventDefault(); break;
        case 'ArrowLeft':  moveFocus('left');  e.preventDefault(); break;
        case 'ArrowRight': moveFocus('right'); e.preventDefault(); break;
        case 'Enter':
          if (document.activeElement &&
              document.activeElement.classList.contains('focusable') &&
              !document.activeElement.disabled) {
            document.activeElement.click();
          }
          e.preventDefault();
          break;
        case 'Escape':
          // Back gesture: return to Start. On Start itself there is nothing
          // to go back to, so leave the event to the system.
          if (state.currentScreen === 'start') break;
          navigateBack();
          e.preventDefault();
          break;
      }
    });
  }

  // ==================== INIT ====================
  function init() {
    collectScreens();
    setupEvents();
    loadData();
    setTimeout(function () {
      navigateTo('start', { addToHistory: false });
    }, 50);
    registerWebMcp();
  }

  // ==================== WebMCP (Meta AI voice control) ====================
  // Additive: the app works identically when document.modelContext is absent.
  // Utterances: "start a science quiz on hard", "read me the question",
  // "the answer is B", "it's Paris", "play again".
  var LETTERS = ['A', 'B', 'C', 'D'];

  function categoryNames() {
    return CATEGORIES.map(function (c) { return c.name.toLowerCase(); }).join(', ');
  }

  function resolveCategory(name) {
    var q = String(name || '').toLowerCase().replace(/[^a-z]/g, '');
    if (!q) return null;
    for (var i = 0; i < CATEGORIES.length; i++) {
      var n = CATEGORIES[i].name.toLowerCase();
      if (n === q || n.indexOf(q) === 0 || q.indexOf(n) !== -1) return CATEGORIES[i];
    }
    return null;
  }

  function resolveDifficulty(name) {
    var q = String(name || '').toLowerCase().replace(/[^a-z]/g, '');
    if (!q) return null;
    for (var i = 0; i < DIFFICULTIES.length; i++) {
      if (DIFFICULTIES[i].id === q || q.indexOf(DIFFICULTIES[i].id) !== -1) return DIFFICULTIES[i];
    }
    return null;
  }

  // Current state as Meta AI should see it. Never includes the correct answer
  // of an unanswered question — the page scores, the model only relays.
  function triviaSnapshot(nextAction) {
    var cat = CATEGORIES.find(function (c) { return c.id === state.selection.categoryId; });
    var out = {
      screen: state.currentScreen,
      category: cat ? cat.name : '',
      difficulty: state.selection.difficulty,
    };
    var best = state.highScores[hsKey(state.selection.categoryId, state.selection.difficulty)];
    out.best_score = (best != null) ? best + '/' + CONFIG.quiz.amount : null;
    if (state.currentScreen === 'quiz') {
      var q = state.quiz.questions[state.quiz.index];
      if (q) {
        out.question_number = state.quiz.index + 1;
        out.total_questions = state.quiz.questions.length;
        out.question = q.question;
        out.options = q.answers.map(function (a, i) { return LETTERS[i] + ': ' + a; }).join(' | ');
        out.seconds_left = state.quiz.deadline != null
          ? Math.max(0, Math.ceil((state.quiz.deadline - Date.now()) / 1000)) : 0;
        out.answered = state.quiz.answered;
        out.score = state.quiz.score;
      }
    } else if (state.currentScreen === 'results') {
      out.final_score = state.quiz.score + '/' + state.quiz.questions.length;
      out.review = state.quiz.results.map(function (r, i) {
        return (i + 1) + '. ' + (r.isCorrect ? 'correct' : 'wrong (' + r.answers[r.correctIdx] + ')');
      }).join('; ');
    } else if (state.currentScreen === 'error') {
      var errEl = document.getElementById('error-message');
      out.error_message = errEl ? errEl.textContent : 'Could not load questions';
    } else if (state.currentScreen === 'loading') {
      out.loading = true;
    } else {
      out.categories = categoryNames();
      out.difficulties = DIFFICULTIES.map(function (d) { return d.id; }).join(', ');
    }
    out.next_action = nextAction;
    return out;
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

    safeRegister({
      name: 'trivia_get_state',
      description: 'Report the current screen and, during a quiz, the current question with its four options (A-D), seconds left and score. Never reveals the answer of an open question.',
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true },
      execute: function () {
        var next = state.currentScreen === 'quiz'
          ? 'Read the question and the four options aloud once, then stop and wait for the wearer to answer.'
          : 'Summarise the state in one short sentence, then stop.';
        return triviaSnapshot(next);
      }
    });

    safeRegister({
      name: 'trivia_start',
      description: 'Start a new 10-question quiz. Optional category (general, science, history, geography, film, sports) and difficulty (easy, medium, hard); omitted values keep the current selection. Returns the first question.',
      inputSchema: {
        type: 'object',
        properties: {
          category: { type: 'string', description: 'One of: general, science, history, geography, film, sports. Optional.' },
          difficulty: { type: 'string', description: 'One of: easy, medium, hard. Optional.' }
        }
      },
      execute: function (args, opts) {
        var signal = opts && opts.signal;
        var catArg = args && args.category;
        var diffArg = args && args.difficulty;
        if (catArg) {
          var cat = resolveCategory(catArg);
          if (!cat) {
            return { error: true, message: 'Unknown category.', categories: categoryNames(), next_action: 'Offer these categories and call trivia_start again.' };
          }
          state.selection.categoryId = cat.id;
        }
        if (diffArg) {
          var diff = resolveDifficulty(diffArg);
          if (!diff) {
            return { error: true, message: 'Unknown difficulty.', difficulties: 'easy, medium, hard', next_action: 'Offer these difficulties and call trivia_start again.' };
          }
          state.selection.difficulty = diff.id;
        }
        saveData();
        stopTimer();
        clearFeedback();
        state.screenHistory = [];
        return startQuiz(signal).then(function () {
          if (state.currentScreen === 'quiz') {
            return triviaSnapshot('Read the question and the four options aloud once, then stop and wait for the wearer to answer.');
          }
          var snap = triviaSnapshot('Tell the wearer the questions could not load, then stop.');
          snap.error = true;
          snap.message = snap.error_message || 'Could not load questions';
          return snap;
        });
      }
    });

    safeRegister({
      name: 'trivia_answer',
      description: 'Answer the current question with an option letter (A, B, C or D) or the option text. The page scores it and returns whether it was correct.',
      inputSchema: {
        type: 'object',
        properties: {
          answer: { type: 'string', description: 'Option letter A-D, or the option text as spoken.' }
        },
        required: ['answer']
      },
      execute: function (args) {
        if (state.currentScreen !== 'quiz') {
          return { error: true, message: 'No question is open.', next_action: 'Call trivia_start to begin a quiz, or trivia_get_state.' };
        }
        if (state.quiz.answered) {
          return { error: true, message: 'This question is already answered; the next one appears shortly.', next_action: 'Call trivia_get_state for the next question.' };
        }
        var q = state.quiz.questions[state.quiz.index];
        var raw = String((args && args.answer) || '').trim();
        var idx = -1;
        var letter = raw.toUpperCase().replace(/[^A-D]/g, '');
        if (raw.length <= 2 && letter.length === 1) idx = LETTERS.indexOf(letter);
        if (idx < 0) {
          var norm = raw.toLowerCase();
          for (var i = 0; i < q.answers.length; i++) {
            var a = q.answers[i].toLowerCase();
            if (a === norm) { idx = i; break; }
          }
          if (idx < 0) {
            for (var j = 0; j < q.answers.length; j++) {
              var b = q.answers[j].toLowerCase();
              if (b.indexOf(norm) !== -1 || norm.indexOf(b) !== -1) { idx = j; break; }
            }
          }
        }
        if (idx < 0) {
          return { error: true, message: 'That did not match an option.', options: q.answers.map(function (a, k) { return LETTERS[k] + ': ' + a; }).join(' | '), next_action: 'Ask the wearer to pick A, B, C or D, then call trivia_answer again.' };
        }
        handleAnswer(idx); // same path as Enter on a focused answer; the page scores it
        var r = state.quiz.results[state.quiz.results.length - 1];
        return {
          chosen: LETTERS[idx] + ': ' + q.answers[idx],
          correct: !!(r && r.isCorrect),
          correct_answer: q.answers[q.correctIdx],
          score: state.quiz.score,
          question_number: state.quiz.index + 1,
          total_questions: state.quiz.questions.length,
          next_action: 'Tell the wearer whether they were right in one short sentence, then stop. The next question appears automatically; call trivia_get_state to read it.'
        };
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
