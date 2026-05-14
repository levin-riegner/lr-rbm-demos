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

  // ---- Init ----
  renderLearn();
})();
