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
      timer: null,
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
    // In this app, Escape always goes back to Start (reset)
    stopTimer();
    clearFeedback();
    state.screenHistory = [];
    navigateTo('start', { addToHistory: false });
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
  function fetchQuestions() {
    var url = CONFIG.api.baseUrl
      + '?amount=' + CONFIG.quiz.amount
      + '&category=' + state.selection.categoryId
      + '&difficulty=' + encodeURIComponent(state.selection.difficulty)
      + '&type=multiple';

    navigateTo('loading', { addToHistory: false });

    return fetch(url)
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
  function startQuiz() {
    fetchQuestions()
      .then(function (questions) {
        state.quiz.questions = questions;
        state.quiz.index = 0;
        state.quiz.score = 0;
        state.quiz.results = [];
        navigateTo('quiz', { addToHistory: false });
      })
      .catch(function (err) {
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

  function startTimer(seconds) {
    stopTimer();
    state.quiz.remaining = seconds;
    updateTimerUI();
    state.quiz.timer = setInterval(function () {
      state.quiz.remaining -= 1;
      updateTimerUI();
      if (state.quiz.remaining <= 0) {
        stopTimer();
        handleTimeout();
      }
    }, 1000);
  }

  function stopTimer() {
    if (state.quiz.timer) {
      clearInterval(state.quiz.timer);
      state.quiz.timer = null;
    }
  }

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
    setTimeout(advance, CONFIG.quiz.feedbackMs);
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
    setTimeout(advance, CONFIG.quiz.feedbackMs);
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
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
