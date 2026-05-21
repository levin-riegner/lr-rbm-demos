/* ============================================================
   CONVERSATIONAL — live FR storytelling transcription for RBMDs
   A friend is telling the wearer a short story in French.
   The HUD streams the words live, anchored at the bottom of
   the lens. Swipe ▼ to toggle inline English subtitles on/off.
   ◀ steps back one word · ▶ steps forward · ▲ snaps to live.
   ============================================================ */

/* ---------- the story ---------- *
   A single voice — a friend telling a long, meandering story.
   Words paired with natural-English glosses. The script is
   long enough to feel continuous, and on loop the older lines
   have already scrolled off-lens so the restart is invisible.
*/
const STORY = [
  // 1. Hier soir, je marchais le long de la Seine.
  ['Hier','yesterday'],['soir','evening'],[',', ','],['je','I'],['marchais','was walking'],
  ['le',''],['long','along'],['de',''],['la','the'],['Seine','Seine'],['.','.'],

  // 2. Le ciel était orange.
  ['Le','the'],['ciel','sky'],['était','was'],['orange','orange'],['.','.'],

  // 3. J'ai vu un vieil homme qui jouait du violon sur le pont.
  ['J’ai','I have'],['vu','seen'],['un','an'],['vieil','old'],['homme','man'],
  ['qui','who'],['jouait','was playing'],['du',''],['violon','violin'],
  ['sur','on'],['le','the'],['pont','bridge'],['.','.'],

  // 4. La musique était si belle.
  ['La','the'],['musique','music'],['était','was'],['si','so'],['belle','beautiful'],['.','.'],

  // 5. Une petite fille s'est arrêtée pour écouter.
  ['Une','a'],['petite','little'],['fille','girl'],['s’est',''],['arrêtée','stopped'],
  ['pour','to'],['écouter','listen'],['.','.'],

  // 6. Elle a souri, puis elle a dansé.
  ['Elle','she'],['a',''],['souri','smiled'],[',', ','],
  ['puis','then'],['elle','she'],['a',''],['dansé','danced'],['.','.'],

  // 7. C'était un moment magique.
  ['C’était','it was'],['un','a'],['moment','moment'],['magique','magical'],['.','.'],

  // 8. Après, j'ai continué jusqu'au café près de chez moi.
  ['Après','afterwards'],[',', ','],['j’ai','I have'],['continué','continued'],
  ['jusqu’au','to the'],['café','café'],['près','near'],['de',''],['chez','to'],['moi','me'],['.','.'],

  // 9. J'ai commandé un chocolat chaud.
  ['J’ai','I have'],['commandé','ordered'],['un','a'],['chocolat','chocolate'],['chaud','hot'],['.','.'],

  // 10. La serveuse m'a reconnu.
  ['La','the'],['serveuse','waitress'],['m’a','me has'],['reconnu','recognized'],['.','.'],

  // 11. Elle m'a demandé comment allait ma mère.
  ['Elle','she'],['m’a','me has'],['demandé','asked'],['comment','how'],
  ['allait','was'],['ma','my'],['mère','mother'],['.','.'],

  // 12. Je lui ai dit que tout allait bien.
  ['Je','I'],['lui','her'],['ai','have'],['dit','said'],['que','that'],
  ['tout','everything'],['allait','was going'],['bien','well'],['.','.'],

  // 13. En rentrant, j'ai senti l'odeur du pain frais.
  ['En','while'],['rentrant','returning'],[',', ','],['j’ai','I have'],['senti','smelled'],
  ['l’odeur','the smell'],['du','of'],['pain','bread'],['frais','fresh'],['.','.'],

  // 14. La boulangerie était encore ouverte.
  ['La','the'],['boulangerie','bakery'],['était','was'],['encore','still'],['ouverte','open'],['.','.'],

  // 15. J'ai acheté une baguette toute chaude.
  ['J’ai','I have'],['acheté','bought'],['une','a'],['baguette','baguette'],
  ['toute','all'],['chaude','warm'],['.','.'],

  // 16. Tu sais, ça me rappelle quand j'étais petite.
  ['Tu','you'],['sais','know'],[',', ','],['ça','that'],['me','me'],['rappelle','reminds'],
  ['quand','when'],['j’étais','I was'],['petite','little'],['.','.'],

  // 17. Mon grand-père m'emmenait toujours au bord du fleuve.
  ['Mon','my'],['grand-père','grandfather'],['m’emmenait','took me'],['toujours','always'],
  ['au','to the'],['bord','edge'],['du','of the'],['fleuve','river'],['.','.'],

  // 18. Il chantait des vieilles chansons en marchant.
  ['Il','he'],['chantait','used to sing'],['des','some'],['vieilles','old'],
  ['chansons','songs'],['en','while'],['marchant','walking'],['.','.'],

  // 19. Il connaissait le nom de toutes les étoiles.
  ['Il','he'],['connaissait','knew'],['le','the'],['nom','name'],['de','of'],
  ['toutes','all'],['les','the'],['étoiles','stars'],['.','.'],

  // 20. Parfois on s'asseyait sur un banc, sans rien dire.
  ['Parfois','sometimes'],['on','we'],['s’asseyait','sat'],['sur','on'],['un','a'],['banc','bench'],
  [',', ','],['sans','without'],['rien','anything'],['dire','to say'],['.','.'],

  // 21. C'est drôle, je me souviens de tout.
  ['C’est','it is'],['drôle','funny'],[',', ','],['je','I'],['me','myself'],['souviens','remember'],
  ['de','of'],['tout','everything'],['.','.'],

  // 22. Du parfum des tilleuls, du bruit du fleuve.
  ['Du','of the'],['parfum','scent'],['des','of the'],['tilleuls','linden trees'],[',', ','],
  ['du','of the'],['bruit','sound'],['du','of the'],['fleuve','river'],['.','.'],

  // 23. Enfin, voilà.
  ['Enfin','anyway'],[',', ','],['voilà','there it is'],['.','.'],

  // 24. C'était une belle soirée.
  ['C’était','it was'],['une','a'],['belle','beautiful'],['soirée','evening'],['.','.'],
];

/* assign each token a sentence index so we can group lines for rendering */
const TOKENS = (() => {
  let sentence = 0;
  return STORY.map(([fr, en]) => {
    const punct = /^[.,!?;:…]$/.test(fr);
    const tok = { fr, en, punct, sentence };
    if (fr === '.' || fr === '?' || fr === '!' || fr === '…') sentence++;
    return tok;
  });
})();

/* the natural-English sentence (subtitle) for each sentence index — */
/* joining the non-empty glosses with spaces gives an acceptable subtitle, */
/* but a hand-tuned one reads better. */
const SUBTITLES = [
  'Yesterday evening, I was walking along the Seine.',
  'The sky was orange.',
  'I saw an old man playing violin on the bridge.',
  'The music was so beautiful.',
  'A little girl stopped to listen.',
  'She smiled, then she danced.',
  'It was a magical moment.',
];

/* ---------- vocab library (localStorage) ----------
   Saved as an object keyed by French headword, value { fr, en, addedAt }.
*/
const VOCAB_KEY = 'conversational.vocab.v1';
function loadVocab() {
  try {
    const raw = localStorage.getItem(VOCAB_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}
function saveVocab(v) {
  try { localStorage.setItem(VOCAB_KEY, JSON.stringify(v)); } catch {}
}

/* ---------- state ---------- */
const state = {
  cursor: 0,            // latest revealed token
  selected: 0,          // scrollback focus
  mode: 'live',         // 'live' | 'scrollback'
  showGloss: false,     // persistent toggle, flipped by ▼
  paused: false,
  timer: null,
  vocab: loadVocab(),
  justSavedKey: null,   // briefly animates the most recent save
  toastTimer: null,
};

const $transcript = document.getElementById('transcript');
const $toast = document.getElementById('toast');

/* ---------- render ---------- */
function render() {
  // group revealed tokens by sentence; render the last 2 sentences
  const sentMap = new Map();
  for (let i = 0; i <= state.cursor; i++) {
    const t = TOKENS[i];
    if (!sentMap.has(t.sentence)) sentMap.set(t.sentence, []);
    sentMap.get(t.sentence).push({ ...t, globalIndex: i });
  }
  const ids = [...sentMap.keys()];
  const visible = ids.slice(-2);

  $transcript.innerHTML = '';
  visible.forEach((si, idx) => {
    const isOldest = idx === 0 && visible.length > 1;

    const lineEl = document.createElement('div');
    lineEl.className = 'line' + (isOldest ? ' fade' : '');

    const wordsEl = document.createElement('div');
    wordsEl.className = 'line-words';

    sentMap.get(si).forEach((tok) => {
      const span = document.createElement('span');
      span.className = 'w';
      const isLatest = tok.globalIndex === state.cursor;
      const isSelected = tok.globalIndex === state.selected;
      const key = vocabKey(tok.fr);
      if (state.mode === 'live' && isLatest && !tok.punct) span.classList.add('current');
      if (state.mode === 'scrollback' && isSelected && !tok.punct) span.classList.add('selected');
      if (!tok.punct && state.vocab[key]) span.classList.add('saved');
      if (state.justSavedKey && key === state.justSavedKey) span.classList.add('just-saved');
      span.textContent = (tok.punct ? '' : ' ') + tok.fr;
      wordsEl.appendChild(span);
    });

    lineEl.appendChild(wordsEl);

    // English subtitle under the line when ▼ is toggled on.
    // It only grows as fast as the French is "spoken" — each revealed
    // token contributes its gloss, so the listener never sees ahead.
    if (state.showGloss) {
      const parts = sentMap.get(si)
        .filter(t => !t.punct && t.en)
        .map(t => t.en);
      if (parts.length > 0) {
        const gloss = document.createElement('div');
        gloss.className = 'gloss-line' + (isOldest ? ' fade' : '');
        gloss.textContent = parts.join(' ');
        lineEl.appendChild(gloss);
      }
    }

    $transcript.appendChild(lineEl);
  });
}

/* ---------- streaming ---------- *
   The script loops continuously. By the time we reach the end of TOKENS,
   the early lines have already scrolled off-lens, so resetting the cursor
   to 0 is invisible to the wearer — it just feels like the friend keeps
   talking. A short half-beat pause separates loops so the rhythm doesn't
   feel mechanical.
*/
function advanceStream() {
  if (state.paused || state.mode !== 'live') return;
  if (state.cursor < TOKENS.length - 1) {
    state.cursor++;
    state.selected = state.cursor;
    render();
  } else {
    // brief breath, then seamlessly restart from the top
    setTimeout(() => {
      if (state.mode !== 'live' || state.paused) return;
      state.cursor = 0;
      state.selected = 0;
      render();
    }, 600);
  }
}

function startStream() {
  stopStream();
  state.timer = setInterval(advanceStream, 460);
}
function stopStream() {
  if (state.timer) { clearInterval(state.timer); state.timer = null; }
}

/* ---------- controls ---------- */
function onLeft() {
  if (state.mode === 'live') {
    state.mode = 'scrollback';
    state.selected = state.cursor;
  }
  let i = state.selected - 1;
  while (i > 0 && TOKENS[i] && TOKENS[i].punct) i--;
  if (i < 0) i = 0;
  state.selected = i;
  render();
}

function onRight() {
  if (state.mode === 'live') return;
  let i = state.selected + 1;
  while (i < state.cursor && TOKENS[i] && TOKENS[i].punct) i++;
  if (i > state.cursor) i = state.cursor;
  state.selected = i;
  if (state.selected === state.cursor) state.mode = 'live';
  render();
}

function onDown() {
  // toggle persistent subtitle overlay
  state.showGloss = !state.showGloss;
  render();
}

function onUp() {
  state.mode = 'live';
  state.selected = state.cursor;
  render();
}

function vocabKey(fr) {
  // canonical key — lowercase, strip surrounding punct, normalize fancy quotes
  return (fr || '')
    .replace(/[’']/g, "'")
    .toLowerCase()
    .trim();
}

function showToast(msg) {
  if (!$toast) return;
  $toast.textContent = msg;
  $toast.classList.add('show');
  if (state.toastTimer) clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => {
    $toast.classList.remove('show');
  }, 1400);
}

function saveCurrentSelection() {
  const tok = TOKENS[state.selected];
  if (!tok || tok.punct) return;
  const key = vocabKey(tok.fr);
  if (!key) return;
  if (state.vocab[key]) {
    showToast('✓ already saved');
    state.justSavedKey = key;
  } else {
    state.vocab[key] = {
      fr: tok.fr,
      en: tok.en || '',
      addedAt: Date.now(),
    };
    saveVocab(state.vocab);
    showToast('✓ saved · ' + Object.keys(state.vocab).length + ' words');
    state.justSavedKey = key;
  }
  render();
  // clear the just-saved animation marker after the anim completes
  setTimeout(() => {
    if (state.justSavedKey === key) {
      state.justSavedKey = null;
      render();
    }
  }, 950);
}

function onEnter() {
  // In scrollback mode, Enter saves the selected word to the vocab library.
  // In live mode, Enter still toggles pause.
  if (state.mode === 'scrollback') {
    saveCurrentSelection();
  } else {
    state.paused = !state.paused;
    render();
  }
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft')       { e.preventDefault(); onLeft(); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); onRight(); }
  else if (e.key === 'ArrowDown')  { e.preventDefault(); onDown(); }
  else if (e.key === 'ArrowUp')    { e.preventDefault(); onUp(); }
  else if (e.key === 'Enter')      { e.preventDefault(); onEnter(); }
});

/* touch swipes mirror arrows; a tap acts as Enter */
(() => {
  let sx = 0, sy = 0;
  document.addEventListener('touchstart', (e) => {
    const t = e.changedTouches[0];
    sx = t.clientX; sy = t.clientY;
  }, { passive: true });
  document.addEventListener('touchend', (e) => {
    const t = e.changedTouches[0];
    const dx = t.clientX - sx, dy = t.clientY - sy;
    if (Math.abs(dx) < 24 && Math.abs(dy) < 24) { onEnter(); return; }
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) onRight(); else onLeft();
    } else {
      if (dy > 0) onDown(); else onUp();
    }
  }, { passive: true });
})();

/* expose the vocab on window for inspection / debugging */
window.vocab = {
  get list() { return Object.values(state.vocab); },
  clear() { state.vocab = {}; saveVocab(state.vocab); render(); },
};

/* ---------- ?state= URL routing (for headless screenshots) ---------- */
function applyState(name) {
  function prime(idx) {
    state.cursor = Math.min(idx, TOKENS.length - 1);
    state.selected = state.cursor;
  }
  switch (name) {
    case 'live':
      prime(9); // ...la Seine
      state.mode = 'live';
      state.showGloss = false;
      stopStream();
      break;
    case 'translated':
      prime(9); // same line with English subtitle on
      state.mode = 'live';
      state.showGloss = true;
      stopStream();
      break;
    case 'midstory':
      prime(27); // ...sur le pont
      state.mode = 'live';
      state.showGloss = false;
      stopStream();
      break;
    case 'midstory-translated':
      prime(27);
      state.mode = 'live';
      state.showGloss = true;
      stopStream();
      break;
    case 'scrollback':
      prime(27);
      state.mode = 'scrollback';
      state.selected = 22; // "jouait"
      state.showGloss = false;
      stopStream();
      break;
    default:
      return false;
  }
  render();
  return true;
}

/* ---------- boot ---------- */
function boot() {
  const params = new URLSearchParams(location.search);
  const requested = params.get('state');
  if (requested && applyState(requested)) return;
  state.cursor = 0;
  state.selected = 0;
  render();
  startStream();
}

boot();
