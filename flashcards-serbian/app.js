(function () {
  'use strict';

  const VOCAB = [
    { serbian: 'Zdravo', english: 'Hello' },
    { serbian: 'Hvala',  english: 'Thank you' },
    { serbian: 'Da',     english: 'Yes' },
    { serbian: 'Ne',     english: 'No' },
    { serbian: 'Molim',  english: 'Please' }
  ];

  const state = {
    mode: 'learn',        // 'learn' | 'test' | 'result'
    index: 0,
    flipped: false,
    test: null            // { qIndex, selected, locked, correctCount, questions }
  };

  // ---- DOM ----
  const screens = {
    learn:  document.getElementById('learn'),
    test:   document.getElementById('test'),
    result: document.getElementById('result')
  };
  const wordEl      = document.getElementById('word');
  const sideLabelEl = document.getElementById('sideLabel');
  const progressEl  = document.getElementById('progress');
  const questionEl  = document.getElementById('question');
  const choicesEl   = document.getElementById('choices');
  const testProgEl  = document.getElementById('testProgress');
  const scoreEl     = document.getElementById('score');
  const resultSubEl = document.getElementById('resultSub');

  function setScreen(mode) {
    state.mode = mode;
    Object.entries(screens).forEach(([name, el]) => {
      el.classList.toggle('hidden', name !== mode);
    });
  }

  // ---- Learn ----
  function renderLearn() {
    const card = VOCAB[state.index];
    progressEl.textContent = `${state.index + 1} / ${VOCAB.length}`;
    if (state.flipped) {
      wordEl.textContent = card.english;
      wordEl.classList.add('answer');
      sideLabelEl.textContent = 'English';
    } else {
      wordEl.textContent = card.serbian;
      wordEl.classList.remove('answer');
      sideLabelEl.textContent = 'Serbian';
    }
  }

  function flipCard() {
    state.flipped = true;
    renderLearn();
  }

  function nextCard() {
    if (state.index < VOCAB.length - 1) {
      state.index += 1;
      state.flipped = false;
      renderLearn();
    } else {
      startTest();
    }
  }

  // Voice-only: the D-pad has no "previous" (◀ is NEXT), but "go back one"
  // is a natural utterance. Stays on the first card if already there.
  function prevCard() {
    if (state.index > 0) {
      state.index -= 1;
      state.flipped = false;
      renderLearn();
    }
  }

  // ---- Test ----
  function buildTest() {
    // Each question: show Serbian word, choose correct English meaning from 4 options.
    const questions = VOCAB.map((card, i) => {
      const distractors = VOCAB
        .filter((_, j) => j !== i)
        .map(c => c.english)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);
      const options = [...distractors, card.english].sort(() => Math.random() - 0.5);
      return {
        prompt: card.serbian,
        correct: card.english,
        options
      };
    }).sort(() => Math.random() - 0.5);

    return { qIndex: 0, selected: 0, locked: false, correctCount: 0, questions };
  }

  function startTest() {
    state.test = buildTest();
    setScreen('test');
    renderTest();
  }

  function renderTest() {
    const t = state.test;
    const q = t.questions[t.qIndex];
    testProgEl.textContent = `Q ${t.qIndex + 1} / ${t.questions.length}`;
    questionEl.textContent = q.prompt;
    choicesEl.innerHTML = '';
    q.options.forEach((opt, i) => {
      const li = document.createElement('li');
      li.className = 'choice';
      li.textContent = opt;
      if (i === t.selected) li.classList.add('selected');
      if (t.locked) {
        if (opt === q.correct) li.classList.add('correct');
        else if (i === t.selected) li.classList.add('wrong');
      }
      choicesEl.appendChild(li);
    });
  }

  function moveSelection(delta) {
    const t = state.test;
    if (t.locked) return;
    const n = t.questions[t.qIndex].options.length;
    t.selected = (t.selected + delta + n) % n;
    renderTest();
  }

  function submitAnswer() {
    const t = state.test;
    if (t.locked) {
      // Advance to next question or finish.
      if (t.qIndex < t.questions.length - 1) {
        t.qIndex += 1;
        t.selected = 0;
        t.locked = false;
        renderTest();
      } else {
        finishTest();
      }
      return;
    }
    const q = t.questions[t.qIndex];
    if (q.options[t.selected] === q.correct) t.correctCount += 1;
    t.locked = true;
    renderTest();
  }

  function finishTest() {
    const { correctCount, questions } = state.test;
    setScreen('result');
    scoreEl.textContent = `${correctCount} / ${questions.length}`;
    let sub;
    if (correctCount === questions.length) sub = 'Savršeno! (Perfect!)';
    else if (correctCount >= 3)            sub = 'Dobro! (Good!)';
    else                                    sub = 'Probaj ponovo. (Try again.)';
    resultSubEl.textContent = sub;
  }

  function restart() {
    state.index = 0;
    state.flipped = false;
    state.test = null;
    setScreen('learn');
    renderLearn();
  }

  // ---- Input ----
  document.addEventListener('keydown', (e) => {
    // Back gesture (Escape): test and result are sub-screens of learn.
    if (e.key === 'Escape' && state.mode !== 'learn') { e.preventDefault(); restart(); return; }

    if (state.mode === 'learn') {
      if (e.key === 'ArrowRight') { e.preventDefault(); flipCard(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); nextCard(); }
    } else if (state.mode === 'test') {
      if (e.key === 'ArrowUp')        { e.preventDefault(); moveSelection(-1); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); moveSelection(1); }
      else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); submitAnswer(); }
    } else if (state.mode === 'result') {
      if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); restart(); }
    }
  });

  // ---- WebMCP (Meta AI voice control) ----
  // Additive: the app works identically when document.modelContext is absent.
  // Utterances: "flip the card" / "next card" / "go back one" / "quiz me" /
  // "which card am I on?"
  function snapshot(next) {
    const out = { mode: state.mode, total: VOCAB.length, next_action: next };
    if (state.mode === 'learn') {
      const card = VOCAB[state.index];
      out.card = state.index + 1;
      out.serbian = card.serbian;
      out.flipped = state.flipped;
      // The English side is only reported once the wearer has flipped the
      // card, so the assistant cannot spoil the answer.
      if (state.flipped) out.english = card.english;
    } else if (state.mode === 'test' && state.test) {
      const t = state.test;
      const q = t.questions[t.qIndex];
      out.question = t.qIndex + 1;
      out.questions = t.questions.length;
      out.prompt = q.prompt;
      out.options = q.options.join(', ');
      out.answered = t.locked;
      if (t.locked) out.correct_answer = q.correct;
      out.score_so_far = t.correctCount;
    } else if (state.mode === 'result' && state.test) {
      out.score = state.test.correctCount;
      out.questions = state.test.questions.length;
    }
    return out;
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

    const CONFIRM = 'Confirm in one short sentence, then stop.';
    const LEARN_ONLY = 'Call flashcards_set_mode with "learn" first, then call again.';

    safeRegister({
      name: 'flashcards_get_state',
      description: 'Report the current mode (learn, test or result), the card or question on screen, and progress. In learn mode the English side is only included once the card is flipped.',
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true },
      execute: () => snapshot(state.mode === 'learn' && !state.flipped
        ? 'Tell the wearer the Serbian word in one short sentence; do not guess the translation. Stop.'
        : 'Tell the wearer what is on screen in one short sentence, then stop.'),
    });

    safeRegister({
      name: 'flashcards_flip',
      description: 'Learn mode: flip the current card to reveal the English translation (same as the right arrow). Returns both sides.',
      inputSchema: { type: 'object', properties: {} },
      execute: () => {
        if (state.mode !== 'learn') {
          return { error: true, message: 'Not in learn mode.', next_action: LEARN_ONLY };
        }
        flipCard();
        return snapshot('Read the Serbian word and its English meaning in one short sentence, then stop.');
      },
    });

    safeRegister({
      name: 'flashcards_next',
      description: 'Learn mode: go to the next card (after the last card this starts the test, like the left arrow). Test mode: after an answer has been revealed, move to the next question.',
      inputSchema: { type: 'object', properties: {} },
      execute: () => {
        if (state.mode === 'learn') {
          nextCard();
          return snapshot(state.mode === 'test'
            ? 'Tell the wearer the test has started and read the question and options, then stop.'
            : 'Read the new Serbian word in one short sentence; do not reveal the translation. Stop.');
        }
        if (state.mode === 'test' && state.test) {
          if (!state.test.locked) {
            return { error: true, message: 'The current question has not been answered yet. Answers are chosen with the D-pad.', next_action: 'Tell the wearer to pick an answer with the D-pad, then stop.' };
          }
          submitAnswer(); // locked -> advances
          return snapshot(state.mode === 'result'
            ? 'Tell the wearer the final score in one short sentence, then stop.'
            : 'Read the next question and options in one short sentence, then stop.');
        }
        return { error: true, message: 'Nothing to advance on the result screen.', next_action: LEARN_ONLY };
      },
    });

    safeRegister({
      name: 'flashcards_previous',
      description: 'Learn mode: go back to the previous card, face down. Stays on card 1 if already there.',
      inputSchema: { type: 'object', properties: {} },
      execute: () => {
        if (state.mode !== 'learn') {
          return { error: true, message: 'Not in learn mode.', next_action: LEARN_ONLY };
        }
        prevCard();
        return snapshot('Read the Serbian word in one short sentence; do not reveal the translation. Stop.');
      },
    });

    safeRegister({
      name: 'flashcards_set_mode',
      description: 'Switch mode: "learn" restarts the deck at card 1; "test" starts a fresh multiple-choice quiz (answers are picked with the D-pad).',
      inputSchema: {
        type: 'object',
        properties: { mode: { type: 'string', description: 'Either "learn" or "test".' } },
        required: ['mode'],
      },
      execute: (args) => {
        const mode = String(args && args.mode != null ? args.mode : '').trim().toLowerCase();
        if (mode === 'learn') { restart(); return snapshot(CONFIRM); }
        if (mode === 'test' || mode === 'quiz') {
          startTest();
          return snapshot('Tell the wearer the quiz has started and read the first question and options, then stop.');
        }
        return { error: true, message: 'Unknown mode "' + mode + '".', next_action: 'Offer "learn" or "test" and call again.' };
      },
    });
  }

  // ---- Init ----
  renderLearn();
  registerWebMcp();
})();
