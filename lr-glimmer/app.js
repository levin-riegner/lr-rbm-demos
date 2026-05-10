// GLIMMER — A Peripheral Companion for Meta Display Glasses
// Designed for the L+R display app suite. 600x600. D-pad + tap interaction model.
// Original retro-future virtual pet. No third-party IP.

(function () {
  'use strict';

  const SPLASH_MS = 3600;
  const TICK_MS = 4000;
  const FRAME_MS = 33;
  const SAVE_KEY = 'lr.glimmer.save.v1';
  const WALK_KEY = 'lr.glimmer.walked.v1';

  const STAGE_NAMES = ['EGG', 'SPRITE', 'DRONE', 'ORACLE', 'ARCHON'];
  const STAGE_HOURS = [0, 0.05, 0.5, 2.5, 8];
  const WALK_STEPS = 4;
  const NAMING_STEP = 2;

  // Curated retro-future name pool
  const NAME_PREFIX = ['ECHO','NOVA','LUMEN','MOTE','AURA','NIMBUS','PIXIE','ZEPHYR','KESTREL','SOLAR','PULSE','EMBER','COMET','VESPER','HALO','ORACLE','CINDER','ATLAS','WREN','CIRRUS','TENDR','GLIMMER','SAGE','ONYX','RUNE'];
  const NAME_SUFFIX = ['7','3','01','9','Q','V','ZX','II','IV','X','42','77','-A','-K','-M'];

  const $ = (id) => document.getElementById(id);

  // ───────── State ─────────
  const defaultState = () => ({
    name: 'ORB-7',
    eggVariant: 'amethyst',
    born: Date.now(),
    lastTick: Date.now(),
    hunger: 100, happy: 100, energy: 100, hygiene: 100, health: 100,
    age: 0,
    stageIdx: 0,
    sleeping: false,
    pooped: false,
    sick: false,
    dead: false,
    generation: 1,
  });

  let state = load() || defaultState();
  if (!state.eggVariant) state.eggVariant = 'amethyst';
  if (!state.name) state.name = 'ORB-7';
  if (!state.generation) state.generation = 1;
  let walkStep = 0;
  let menuOpen = false;
  let pendingName = state.name;
  let pendingEgg = null;
  let recognizer = null;
  let listening = false;

  function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) {} }
  function load() { try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return null; } }
  const seenWalk = () => { try { return localStorage.getItem(WALK_KEY) === '1'; } catch (e) { return false; } };
  const markWalked = () => { try { localStorage.setItem(WALK_KEY, '1'); } catch (e) {} };

  // ───────── Splash → Walk or Game ─────────
  setTimeout(() => {
    $('splash').classList.add('hidden');
    if (seenWalk()) startGame();
    else startWalkthrough();
  }, SPLASH_MS);

  // ───────── Walkthrough ─────────
  function startWalkthrough() {
    walkStep = 0;
    pendingName = state.name;
    syncNamingScreen();
    const walk = $('walk');
    walk.classList.remove('hidden');
    walk.dataset.step = '0';
    bindWalkButtons();
    startWalkAnimations();
    focusFirstInWalk();
  }
  function bindWalkButtons() {
    document.querySelectorAll('#walk [data-walk]').forEach(btn => {
      if (btn._bound) return;
      btn._bound = true;
      btn.addEventListener('click', () => doWalkAction(btn.dataset.walk));
    });
  }
  function doWalkAction(action) {
    if (action === 'next') return walkAdvance();
    if (action === 'back') return walkBack();
    if (action === 'start') return finishWalk();
    if (action === 'dice') return rollName();
    if (action === 'mic')  return startListening();
    if (action && action.startsWith('egg-')) return pickEgg(action.slice(4));
  }
  function pickEgg(variant) {
    pendingEgg = variant;
    document.querySelectorAll('.egg-card').forEach(c => {
      c.classList.toggle('selected', c.dataset.variant === variant);
    });
    const hatch = document.getElementById('hatchBtn');
    if (hatch) { hatch.removeAttribute('disabled'); hatch.focus(); }
  }
  function walkAdvance() {
    if (walkStep < WALK_STEPS - 1) {
      walkStep++;
      $('walk').dataset.step = String(walkStep);
      focusFirstInWalk();
    }
  }
  function walkBack() {
    if (walkStep > 0) {
      walkStep--;
      $('walk').dataset.step = String(walkStep);
      stopListening();
      focusFirstInWalk();
    }
  }
  function finishWalk() {
    stopListening();
    state.name = (pendingName || 'ORB-7').toUpperCase().slice(0, 14);
    if (pendingEgg) state.eggVariant = pendingEgg;
    refreshPalette();
    save();
    markWalked();
    stopWalkAnimations();
    $('walk').classList.add('hidden');
    startGame();
  }
  // ───── Walk canvas animations (welcome creature + egg cards) ─────
  let walkAnimTimer = null;
  let walkFrame = 0;
  function startWalkAnimations() {
    if (walkAnimTimer) return;
    walkFrame = 0;
    paintWalkScene();
    walkAnimTimer = setInterval(() => { walkFrame++; paintWalkScene(); }, 220);
  }
  function stopWalkAnimations() {
    if (walkAnimTimer) { clearInterval(walkAnimTimer); walkAnimTimer = null; }
  }
  function paintWalkScene() {
    const welcome = document.getElementById('welcomeCanvas');
    if (welcome) paintSpriteOnCanvas(welcome, paletteFor(pendingEgg || state.eggVariant || 'amethyst'), walkFrame);
    document.querySelectorAll('.egg-card').forEach(card => {
      const cv = card.querySelector('.egg-canvas');
      if (!cv) return;
      paintEggOnCanvas(cv, paletteFor(card.dataset.variant), walkFrame);
    });
  }
  function paintEggOnCanvas(canvas, P, frame) {
    const c = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    c.clearRect(0, 0, W, H);
    const PXL = 6;
    const wob = Math.sin(frame / 8) * 1.2;
    // egg occupies x=-3..3 (7 wide), y=-5..4 (10 tall)
    const ox = (W - 7 * PXL) / 2 + 3 * PXL;
    const oy = (H - 10 * PXL) / 2 + 5 * PXL;
    function p(x, y, color) {
      c.fillStyle = color;
      c.fillRect(ox + x * PXL, oy + y * PXL + wob, PXL, PXL);
    }
    for (let y = -5; y <= 4; y++) {
      const w = y < -3 ? 1 : y < -1 ? 2 : y < 2 ? 3 : y < 4 ? 2 : 1;
      for (let x = -w; x <= w; x++) p(x, y, P.shell);
    }
    for (let i = -2; i <= 2; i++) p(i, -1 + (i % 2 === 0 ? 0 : 1), P.body);
    p(-1, -3, '#ffffff');
  }
  function paintSpriteOnCanvas(canvas, P, frame) {
    const c = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    c.clearRect(0, 0, W, H);
    const PXL = 7;
    const wob = Math.round(Math.sin(frame / 10) * 0.6) * PXL;
    // sprite occupies x=-4..4 (9 wide), y=-3..4 (8 tall)
    const ox = W / 2;
    const oy = H / 2;
    function p(x, y, color) {
      c.fillStyle = color;
      c.fillRect(ox + x * PXL - PXL / 2, oy + y * PXL + wob - PXL / 2, PXL, PXL);
    }
    // body
    for (let y = -3; y <= 4; y++) {
      const w = y === -3 ? 3 : y === 4 ? 3 : 4;
      for (let x = -w; x <= w; x++) p(x, y, P.body);
    }
    // shading
    for (let x = -3; x <= 3; x++) p(x, 4, P.bodyDk);
    p(4, 3, P.bodyDk);
    // eyes (with blink)
    const blink = frame % 30 < 3;
    if (blink) {
      p(-2, 0, P.eye); p(-1, 0, P.eye);
      p(1, 0, P.eye); p(2, 0, P.eye);
    } else {
      p(-2, -1, P.eye); p(-2, 0, P.eye);
      p(2, -1, P.eye); p(2, 0, P.eye);
      p(-2, -1, '#ffffff');
      p(2, -1, '#ffffff');
    }
    // mouth
    p(-1, 2, P.eye); p(0, 2, P.eye); p(1, 2, P.eye);
    // blush
    p(-4, 1, P.blush);
    p(4, 1, P.blush);
  }

  function focusFirstInWalk() {
    const focusables = currentWalkFocusables();
    // Prefer the primary action when present
    const primary = focusables.find(b => b.classList.contains('wbtn-primary'));
    (primary || focusables[0])?.focus();
  }
  function currentWalkFocusables() {
    const screen = document.querySelector(`.walk-screen[data-step="${walkStep}"]`);
    return screen ? Array.from(screen.querySelectorAll('.focusable')) : [];
  }

  // ───────── Naming ─────────
  function syncNamingScreen() {
    const el = $('nameDisplay');
    if (el) el.textContent = pendingName || 'ORB-7';
  }
  function syncEggSelection() {
    document.querySelectorAll('.egg-card').forEach(c => {
      c.classList.toggle('selected', c.dataset.variant === pendingEgg);
    });
    const hatch = document.getElementById('hatchBtn');
    if (hatch) {
      if (pendingEgg) hatch.removeAttribute('disabled');
      else hatch.setAttribute('disabled', 'disabled');
    }
  }
  function setNameStatus(msg) {
    const el = $('nameStatus');
    if (el) el.textContent = msg;
  }
  function rollName() {
    const p = NAME_PREFIX[Math.floor(Math.random() * NAME_PREFIX.length)];
    const s = NAME_SUFFIX[Math.floor(Math.random() * NAME_SUFFIX.length)];
    pendingName = p + (s.startsWith('-') ? s : '-' + s);
    syncNamingScreen();
    setNameStatus('suggestion · keep or roll again');
  }
  function startListening() {
    if (listening) return stopListening();
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setNameStatus('voice unavailable · use random');
      return;
    }
    try {
      recognizer = new SR();
      recognizer.lang = 'en-US';
      recognizer.maxAlternatives = 1;
      recognizer.interimResults = false;
      recognizer.continuous = false;
      recognizer.onstart = () => {
        listening = true;
        $('nameDisplay').classList.add('listening');
        setNameStatus('listening · speak a name');
      };
      recognizer.onresult = (e) => {
        const text = (e.results[0][0].transcript || '').trim();
        const cleaned = text.replace(/[^A-Za-z0-9 \-]/g, '').toUpperCase().slice(0, 14);
        if (cleaned) {
          pendingName = cleaned;
          syncNamingScreen();
          setNameStatus('captured · keep or try again');
        } else {
          setNameStatus('didn\'t catch that');
        }
      };
      recognizer.onerror = (e) => {
        setNameStatus(e.error === 'not-allowed' ? 'mic blocked' : 'voice error');
      };
      recognizer.onend = () => {
        listening = false;
        $('nameDisplay').classList.remove('listening');
        recognizer = null;
      };
      recognizer.start();
    } catch (err) {
      setNameStatus('voice unavailable');
    }
  }
  function stopListening() {
    if (recognizer && listening) try { recognizer.stop(); } catch (e) {}
    listening = false;
    $('nameDisplay')?.classList.remove('listening');
  }

  // ───────── Game start ─────────
  let started = false;
  function startGame() {
    if (started) { $('game').classList.remove('hidden'); focusFirstAction(); render(); return; }
    started = true;
    $('game').classList.remove('hidden');

    document.querySelectorAll('.act').forEach(btn => {
      if (btn._bound) return;
      btn._bound = true;
      btn.addEventListener('click', () => {
        if (btn.dataset.action === 'menu') return openMenu();
        doAction(btn.dataset.action, btn);
      });
    });
    document.querySelectorAll('.menu-item').forEach(btn => {
      if (btn._bound) return;
      btn._bound = true;
      btn.addEventListener('click', () => doMenu(btn.dataset.menu));
    });
    const aboutBtn = document.querySelector('.about-close');
    if (aboutBtn && !aboutBtn._bound) {
      aboutBtn._bound = true;
      aboutBtn.addEventListener('click', () => {
        doMenu('resume');
      });
    }
    const deadBtn = document.querySelector('.dead-btn');
    if (deadBtn && !deadBtn._bound) {
      deadBtn._bound = true;
      deadBtn.addEventListener('click', () => {
        doMenu('reset');
      });
    }

    refreshPalette();
    catchUpOffline();
    tick();
    setInterval(tick, TICK_MS);
    setInterval(animate, FRAME_MS);
    setInterval(emoteCheck, 6000);
    setInterval(maybeRandomEvent, 14000);

    render();
    say('SYSTEM ONLINE');
    focusFirstAction();
  }

  function focusFirstAction() {
    const first = document.querySelector('.act.focusable');
    if (first) first.focus();
  }

  // ───────── Keyboard / D-pad routing ─────────
  document.addEventListener('keydown', (e) => {
    // WALK
    if (!$('walk').classList.contains('hidden')) {
      const focusables = currentWalkFocusables();
      const cur = document.activeElement;
      let i = focusables.indexOf(cur);
      if (i < 0) i = 0;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault(); focusables[(i + 1) % focusables.length]?.focus(); return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault(); focusables[(i - 1 + focusables.length) % focusables.length]?.focus(); return;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        focusables[i]?.click();
        return;
      }
      return;
    }

    // PAUSE MENU
    if (menuOpen) {
      const items = Array.from(document.querySelectorAll('.menu-item'));
      const cur = document.activeElement;
      let i = items.indexOf(cur);
      if (i < 0) i = 0;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); items[(i + 1) % items.length].focus(); return; }
      if (e.key === 'ArrowUp'   || e.key === 'ArrowLeft')  { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); return; }
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); items[i]?.click(); return; }
      return;
    }

    // GAME
    const acts = Array.from(document.querySelectorAll('.act.focusable'));
    const cur = document.activeElement;
    let i = acts.indexOf(cur);
    if (i < 0) i = 0;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault(); acts[(i + 1) % acts.length].focus(); return;
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault(); acts[(i - 1 + acts.length) % acts.length].focus(); return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      acts[i]?.click();
      return;
    }
  });

  // ───────── Pause menu ─────────
  function openMenu() {
    menuOpen = true;
    $('menu').classList.remove('hidden');
    document.querySelectorAll('.menu-item')[0].focus();
  }
  function closeMenu() {
    menuOpen = false;
    $('menu').classList.add('hidden');
    focusFirstAction();
  }
  function closeAbout() {
    $('about').classList.add('hidden');
    openMenu();
  }
  function doMenu(action) {
    if (action === 'resume') {
      if ($('about').classList.contains('hidden')) return closeMenu();
      return closeAbout();
    }
    if (action === 'about') {
      closeMenu();
      $('about').classList.remove('hidden');
      document.querySelector('.about-close').focus();
      return;
    }
    if (action === 'rename') {
      closeMenu();
      $('game').classList.add('hidden');
      pendingName = state.name;
      pendingEgg = state.eggVariant;
      syncNamingScreen();
      syncEggSelection();
      walkStep = NAMING_STEP;
      $('walk').dataset.step = String(NAMING_STEP);
      $('walk').classList.remove('hidden');
      bindWalkButtons();
      startWalkAnimations();
      focusFirstInWalk();
      return;
    }
    if (action === 'help') {
      closeMenu();
      $('game').classList.add('hidden');
      walkStep = 0;
      $('walk').dataset.step = '0';
      $('walk').classList.remove('hidden');
      // Hide naming and egg selection screens (steps 2-3) when viewing from menu
      document.querySelectorAll('.walk-screen').forEach((s, i) => {
        s.classList.toggle('hidden', i > 1);
      });
      // Hide the next button on the about screen
      const aboutScreen = document.querySelector('.walk-screen[data-step="1"]');
      if (aboutScreen) {
        const nextBtn = aboutScreen.querySelector('button[data-walk="next"]');
        if (nextBtn) nextBtn.classList.add('hidden');
      }
      bindWalkButtons();
      startWalkAnimations();
      focusFirstInWalk();
      return;
    }
    if (action === 'reset') {
      const oldName = state.name;
      const oldVariant = state.eggVariant;
      const nextGen = (state.generation || 1) + 1;

      // Reset state but keep generation
      state = defaultState();
      state.name = oldName;
      state.eggVariant = oldVariant;
      state.generation = nextGen;

      // Show egg selection walkthrough
      $('game').classList.add('hidden');
      pendingName = oldName;
      pendingEgg = oldVariant;
      syncNamingScreen();
      syncEggSelection();
      walkStep = NAMING_STEP;
      $('walk').dataset.step = String(NAMING_STEP);
      $('walk').classList.remove('hidden');
      // Show naming and egg screens (hide welcome/about)
      document.querySelectorAll('.walk-screen').forEach((s, i) => {
        s.classList.toggle('hidden', i < NAMING_STEP);
      });
      bindWalkButtons();
      startWalkAnimations();
      focusFirstInWalk();
    }
  }

  // ───────── Tick ─────────
  function catchUpOffline() {
    const now = Date.now();
    const elapsed = now - state.lastTick;
    const maxOfflineMs = 2 * 60 * 60 * 1000; // 2 hour max offline catch-up
    const cappedElapsed = Math.min(elapsed, maxOfflineMs);
    const ticks = Math.min(Math.floor(cappedElapsed / TICK_MS), 60 * 6);
    for (let i = 0; i < ticks; i++) advance();
    state.lastTick = now;
  }
  function tick() {
    advance();
    state.lastTick = Date.now();
    save();
    render();
  }
  function advance() {
    if (state.dead) return;
    state.age += TICK_MS / (1000 * 60 * 4);

    let s = 0;
    for (let i = 0; i < STAGE_HOURS.length; i++) if (state.age >= STAGE_HOURS[i]) s = i;
    if (s !== state.stageIdx) {
      state.stageIdx = s;
      flashEmote(s === 0 ? '◇' : '✦');
      say(`EVOLUTION · ${STAGE_NAMES[s]}`);
      if (s > 0) flashEvolution();
    }

    if (state.stageIdx === 0) {
      state.hunger = clamp(state.hunger - 0.2);
      return;
    }

    const decay = 0.6 + state.stageIdx * 0.15;

    if (state.sleeping) {
      state.energy = clamp(state.energy + 4);
      state.hunger = clamp(state.hunger - decay * 0.3);
      if (state.energy >= 100) {
        state.sleeping = false;
        flashEmote('☀');
        say('REST CYCLE COMPLETE');
      }
    } else {
      state.hunger = clamp(state.hunger - decay);
      state.happy = clamp(state.happy - decay * 0.7);
      state.energy = clamp(state.energy - decay * 0.5);
      state.hygiene = clamp(state.hygiene - decay * 0.6);
    }

    if (!state.pooped && state.stageIdx > 0 && Math.random() < 0.06) {
      state.pooped = true;
      state.hygiene = clamp(state.hygiene - 18);
      say('WASTE DETECTED');
    }

    const neglect = (100 - state.hunger) + (100 - state.hygiene) + (100 - state.happy);
    if (!state.sick && neglect > 200 && Math.random() < 0.12) {
      state.sick = true;
      flashEmote('!');
      say('ANOMALY · NEEDS HEAL');
    }

    if (state.sick) state.health = clamp(state.health - 1.2);
    if (state.hunger <= 0 || state.hygiene <= 0) state.health = clamp(state.health - 0.6);
    if (!state.sick && state.health < 100 && state.hunger > 50 && state.hygiene > 50)
      state.health = clamp(state.health + 0.2);

    if (state.health <= 0) {
      state.dead = true;
      say('SIGNAL TERMINATED');
    }
  }
  function clamp(v) { return Math.max(0, Math.min(100, v)); }

  // ───────── Actions ─────────
  function doAction(name, btn) {
    if (state.dead) {
      say('UNRESPONSIVE · OPEN MENU');
      return;
    }
    switch (name) {
      case 'feed':
        if (state.stageIdx === 0) { say('EGG NOT YET HATCHED'); return; }
        if (state.hunger >= 95) { flashEmote('×'); say('REFUSING · ALREADY FED'); return; }
        showProp('food', '◉', 1200);
        state.hunger = clamp(state.hunger + 30);
        state.happy = clamp(state.happy + 4);
        flashEmote('♥');
        spawnBurst('heart', 6);
        say('FUEL +30');
        break;
      case 'play':
        if (state.stageIdx === 0) { say('EGG NEEDS WARMTH'); return; }
        if (state.energy < 20) { flashEmote('z'); say('TOO TIRED'); return; }
        showProp('ball', '●', 1600);
        state.happy = clamp(state.happy + 30);
        state.energy = clamp(state.energy - 12);
        state.hunger = clamp(state.hunger - 6);
        flashEmote('★');
        spawnBurst('star', 8);
        say('MOOD +30');
        break;
      case 'sleep':
        if (state.sleeping) { state.sleeping = false; flashEmote('☀'); say('AWOKEN'); }
        else { state.sleeping = true; flashEmote('z'); say('REST CYCLE'); }
        break;
      case 'clean':
        showProp('bubbles', '', 1400);
        state.pooped = false;
        $('poop').classList.remove('show');
        state.hygiene = 100;
        flashEmote('~');
        spawnBurst('bubble', 8);
        say('CLEAN +100');
        break;
      case 'heal':
        if (!state.sick && state.health >= 100) { flashEmote('×'); say('NO ANOMALY'); return; }
        showProp('bandage', '+', 1600);
        state.sick = false;
        state.health = clamp(state.health + 40);
        flashEmote('+');
        spawnBurst('plus', 6);
        say('TREATED');
        break;
    }
    save();
    render();
  }

  function showProp(id, glyph, ms) {
    const el = $(id);
    if (glyph) el.textContent = glyph;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), ms);
  }
  function flashEmote(glyph) {
    const el = $('emote');
    el.textContent = glyph;
    el.classList.add('show');
    clearTimeout(flashEmote._t);
    flashEmote._t = setTimeout(() => el.classList.remove('show'), 1400);
  }
  function emoteCheck() {
    if (state.dead || state.sleeping || state.stageIdx === 0) return;
    if (state.hunger < 25) return flashEmote('◇');
    if (state.happy < 25) return flashEmote('☂');
    if (state.energy < 20) return flashEmote('z');
    if (state.hygiene < 25) return flashEmote('~');
    if (state.sick) return flashEmote('!');
    if (Math.random() < 0.3) flashEmote('♪');
  }
  function maybeRandomEvent() {
    if (state.dead || state.sleeping) return;
    if (Math.random() < 0.18) {
      const events = [
        'TELEMETRY · NOMINAL',
        'SOLAR FLUX · STABLE',
        'HUMS A FAINT TUNE',
        'UPLINK · OK',
        'DREAM FRAGMENT INDEXED',
        'CURIOSITY ROUTINE',
      ];
      say(events[Math.floor(Math.random() * events.length)]);
    }
  }

  function say(msg) {
    const t = $('ticker');
    t.style.opacity = '0';
    setTimeout(() => {
      const ts = new Date().toTimeString().slice(0, 5);
      t.innerHTML = `${ts} · ${msg} <span class="caret">▍</span>`;
      t.style.opacity = '1';
    }, 180);
  }

  // ───────── Render ─────────
  function render() {
    setStat('hunger');
    setStat('happy');
    setStat('energy');
    setStat('hygiene');
    $('petName').textContent = state.dead ? '— — —' : (state.name || 'ORB-7');
    const tag = $('modelTag'); if (tag) tag.textContent = `${state.name || 'ORB-7'} / v1.0`;
    const gen = $('genTag'); if (gen) gen.textContent = `GEN ${String(state.generation || 1).padStart(2, '0')}`;
    $('stageLabel').textContent = STAGE_NAMES[state.stageIdx];
    const days = Math.max(1, Math.floor(state.age / 24) + 1);
    $('ageLabel').textContent = `DAY ${days}`;
    $('poop').classList.toggle('show', state.pooped);
    $('zzz').classList.toggle('show', state.sleeping);
    document.body.classList.toggle('dead', state.dead);
    updateTimeGlyph();
  }
  function setStat(key) {
    const v = Math.round(state[key]);
    $(`${key}Val`).textContent = v;
    $(`${key}Bar`).style.width = `${v}%`;
    const stat = document.querySelector(`.stat[data-key="${key}"]`);
    stat.classList.toggle('low', v < 40);
    stat.classList.toggle('crit', v < 20);
  }

  // ───────── Sprite (canvas, original pixel art) ─────────
  const cv = $('petCanvas');
  const ctx = cv.getContext('2d');
  let frame = 0;

  function paletteFor(variant) {
    const base = {
      eye: '#07090c',
      blush: '#ff7a9c',
      teal: '#5fe2c4',
      amber: '#ffb547',
      rose: '#ff7a9c',
    };
    if (variant === 'jade')
      return { ...base, body: '#7af0d2', bodyDk: '#3aaf95', shell: '#e6f0ec', shellDk: '#9cbab2', glow: 'rgba(95,226,196,0.5)' };
    if (variant === 'ember')
      return { ...base, body: '#ffae8a', bodyDk: '#cc6f44', shell: '#f5e0c8', shellDk: '#c89884', glow: 'rgba(255,122,156,0.5)' };
    return { ...base, body: '#d8c8ff', bodyDk: '#9a8acc', shell: '#e8e2d2', shellDk: '#a89e88', glow: 'rgba(216,200,255,0.5)' };
  }
  let PAL = paletteFor(state.eggVariant);
  function refreshPalette() {
    PAL = paletteFor(state.eggVariant);
    if (cv) cv.style.filter = `drop-shadow(0 0 10px ${PAL.glow})`;
  }

  // ───────── Ambient + FX canvases ─────────
  const acv = $('ambientCanvas');
  const actx = acv ? acv.getContext('2d') : null;
  const fxv = $('fxCanvas');
  const fxctx = fxv ? fxv.getContext('2d') : null;
  const ambient = Array.from({length: 22}, () => ({
    x: Math.random() * 544,
    y: Math.random() * 190,
    vy: 0.05 + Math.random() * 0.18,
    vx: (Math.random() - 0.5) * 0.06,
    r: 0.6 + Math.random() * 1.6,
    a: 0.18 + Math.random() * 0.32,
  }));
  function drawAmbient() {
    if (!actx) return;
    actx.clearRect(0, 0, acv.width, acv.height);
    for (const p of ambient) {
      p.y -= p.vy;
      p.x += p.vx;
      if (p.y < -4) { p.y = acv.height + 4; p.x = Math.random() * acv.width; }
      if (p.x < -4) p.x = acv.width + 4;
      if (p.x > acv.width + 4) p.x = -4;
      const glow = isNight() ? 'rgba(239,228,255,' : 'rgba(122,240,210,';
      actx.fillStyle = `${glow}${p.a})`;
      actx.beginPath();
      actx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      actx.fill();
    }
  }

  // Burst particles (hearts/stars/sparks/etc.) drawn on FX canvas
  const fxParticles = [];
  function spawnBurst(kind, count = 6) {
    if (!fxctx) return;
    const cx = fxv.width / 2 + petX * (PX / 7);
    const cy = fxv.height / 2 - 20;
    for (let i = 0; i < count; i++) {
      fxParticles.push({
        kind,
        x: cx + (Math.random() - 0.5) * 60,
        y: cy + (Math.random() - 0.5) * 14,
        vx: (Math.random() - 0.5) * 1.4,
        vy: -0.8 - Math.random() * 1.4,
        life: 60,
        maxLife: 60,
      });
    }
  }
  const FX_GLYPH = { heart: '♥', star: '★', spark: '✦', plus: '+', bubble: '○' };
  const FX_COLOR = { heart: '#ff8fae', star: '#ffc566', spark: '#efe4ff', plus: '#7af0d2', bubble: '#7af0d2' };
  function drawFx() {
    if (!fxctx) return;
    fxctx.clearRect(0, 0, fxv.width, fxv.height);
    for (let i = fxParticles.length - 1; i >= 0; i--) {
      const p = fxParticles[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.life--;
      if (p.life <= 0) { fxParticles.splice(i, 1); continue; }
      const a = Math.max(0, p.life / p.maxLife);
      fxctx.globalAlpha = a;
      fxctx.fillStyle = FX_COLOR[p.kind] || '#ffffff';
      fxctx.font = '600 16px "SF Mono", monospace';
      fxctx.textAlign = 'center';
      fxctx.shadowColor = FX_COLOR[p.kind] || '#ffffff';
      fxctx.shadowBlur = 8;
      fxctx.fillText(FX_GLYPH[p.kind] || '·', p.x, p.y);
    }
    fxctx.globalAlpha = 1;
    fxctx.shadowBlur = 0;
  }

  // Wandering offset (in unit pixels)
  let petX = 0;
  let petTargetX = 0;
  let petWanderTimer = 0;
  function updateWander() {
    if (state.dead || state.sleeping || state.stageIdx === 0) {
      petTargetX = 0;
    } else {
      petWanderTimer++;
      if (petWanderTimer > 22 + Math.random() * 30) {
        petTargetX = (Math.random() - 0.5) * 16; // grid units
        petWanderTimer = 0;
      }
    }
    petX += (petTargetX - petX) * 0.08;
  }

  function isNight() {
    const h = new Date().getHours();
    return h < 6 || h >= 19;
  }
  function updateTimeGlyph() {
    const el = $('timeGlyph');
    if (!el) return;
    const night = isNight();
    el.textContent = night ? '☾' : '☀';
    el.classList.toggle('night', night);
  }

  function flashEvolution() {
    const el = $('evoFlash');
    if (!el) return;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    spawnBurst('spark', 18);
  }

  function animate() {
    frame++;
    updateWander();
    drawAmbient();
    draw();
    drawFx();
  }
  function draw() {
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (state.dead) { drawDead(); return; }
    ctx.save();
    ctx.translate(petX * PX, 0);
    switch (state.stageIdx) {
      case 0: drawEgg(); break;
      case 1: drawSprite(); break;
      case 2: drawDrone(); break;
      case 3: drawOracle(); break;
      case 4: drawArchon(); break;
    }
    ctx.restore();
  }

  const PX = 7;
  function px(x, y, color, s = 1) {
    ctx.fillStyle = color;
    ctx.fillRect(x * PX, y * PX, PX * s, PX * s);
  }
  function bobOffset(amp = 1, speed = 6) {
    return Math.round(Math.sin(frame / speed) * amp) * PX;
  }

  function drawEgg() {
    ctx.save();
    const wob = Math.sin(frame / 8) * 1.5;
    ctx.translate(0, wob);
    const cx = 19, cy = 12;
    for (let y = -5; y <= 4; y++) {
      const w = y < -3 ? 1 : y < -1 ? 2 : y < 2 ? 3 : y < 4 ? 2 : 1;
      for (let x = -w; x <= w; x++) px(cx + x, cy + y, PAL.shell);
    }
    for (let i = -2; i <= 2; i++) {
      px(cx + i, cy - 1 + (i % 2 === 0 ? 0 : 1), PAL.body);
    }
    px(cx - 1, cy - 3, '#ffffff');
    ctx.restore();
  }

  function drawSprite() {
    ctx.save();
    ctx.translate(0, state.sleeping ? 4 : bobOffset(0.5, 10));
    const cx = 19, cy = 12;
    for (let y = -3; y <= 4; y++) {
      const w = y === -3 ? 3 : y === 4 ? 3 : 4;
      for (let x = -w; x <= w; x++) px(cx + x, cy + y, PAL.body);
    }
    for (let x = -3; x <= 3; x++) px(cx + x, cy + 4, PAL.bodyDk);
    px(cx + 4, cy + 3, PAL.bodyDk);

    const blink = state.sleeping || frame % 30 < 3;
    if (blink) {
      px(cx - 2, cy, PAL.eye); px(cx - 1, cy, PAL.eye);
      px(cx + 1, cy, PAL.eye); px(cx + 2, cy, PAL.eye);
    } else {
      px(cx - 2, cy - 1, PAL.eye); px(cx - 2, cy, PAL.eye);
      px(cx + 2, cy - 1, PAL.eye); px(cx + 2, cy, PAL.eye);
      px(cx - 2, cy - 1, '#ffffff');
      px(cx + 2, cy - 1, '#ffffff');
    }
    if (state.happy < 30 || state.sick) {
      px(cx - 1, cy + 2, PAL.eye); px(cx + 1, cy + 2, PAL.eye);
      px(cx, cy + 1, PAL.eye);
    } else {
      px(cx - 1, cy + 2, PAL.eye); px(cx, cy + 2, PAL.eye); px(cx + 1, cy + 2, PAL.eye);
    }
    if (!state.sleeping && state.happy > 60) {
      px(cx - 4, cy + 1, PAL.blush);
      px(cx + 4, cy + 1, PAL.blush);
    }
    ctx.restore();
  }

  function drawDrone() {
    ctx.save();
    ctx.translate(0, state.sleeping ? 4 : bobOffset(1, 8));
    const cx = 19, cy = 11;

    px(cx + 1, cy - 6, PAL.amber);
    px(cx + 1, cy - 5, PAL.bodyDk);

    for (let y = -3; y <= 4; y++)
      for (let x = -4; x <= 5; x++)
        px(cx + x, cy + y, PAL.body);
    for (let x = -4; x <= 5; x++) { px(cx + x, cy - 4, PAL.bodyDk); px(cx + x, cy + 5, PAL.bodyDk); }
    for (let y = -3; y <= 4; y++) { px(cx - 5, cy + y, PAL.bodyDk); px(cx + 6, cy + y, PAL.bodyDk); }

    for (let x = -3; x <= 4; x++) px(cx + x, cy - 1, PAL.eye);

    if (state.sleeping || frame % 35 < 3) {
      for (let x = -2; x <= -1; x++) px(cx + x, cy - 1, PAL.amber);
      for (let x = 2; x <= 3; x++) px(cx + x, cy - 1, PAL.amber);
    } else {
      px(cx - 2, cy - 1, PAL.teal); px(cx - 1, cy - 1, PAL.teal);
      px(cx + 2, cy - 1, PAL.teal); px(cx + 3, cy - 1, PAL.teal);
    }

    if (state.happy < 30) {
      px(cx, cy + 3, PAL.eye); px(cx + 2, cy + 3, PAL.eye);
      px(cx + 1, cy + 2, PAL.eye);
    } else {
      px(cx, cy + 3, PAL.eye); px(cx + 1, cy + 3, PAL.eye); px(cx + 2, cy + 3, PAL.eye);
    }
    ctx.restore();
  }

  function drawOracle() {
    ctx.save();
    ctx.translate(0, state.sleeping ? 4 : bobOffset(1.5, 8));
    const cx = 19, cy = 13;

    for (let a = 0; a < 8; a++) {
      const ang = (a / 8) * Math.PI * 2 + frame / 10;
      const x = Math.round(Math.cos(ang) * 4);
      const y = Math.round(Math.sin(ang) * 1.2) - 8;
      px(cx + x, cy + y, PAL.amber);
    }

    for (let y = -4; y <= 5; y++) {
      const w = y < -2 ? 3 : y > 3 ? 3 : 5;
      for (let x = -w; x <= w; x++) px(cx + x, cy + y, PAL.body);
    }
    for (let y = -4; y <= 5; y++) {
      const w = y < -2 ? 3 : y > 3 ? 3 : 5;
      px(cx + w, cy + y, PAL.bodyDk);
    }

    const blink = state.sleeping || frame % 40 < 3;
    if (blink) {
      for (let x = -2; x <= -1; x++) px(cx + x, cy - 1, PAL.eye);
      for (let x = 2; x <= 3; x++) px(cx + x, cy - 1, PAL.eye);
    } else {
      for (let y = -2; y <= 0; y++) {
        px(cx - 2, cy + y, PAL.eye); px(cx - 1, cy + y, PAL.eye);
        px(cx + 2, cy + y, PAL.eye); px(cx + 3, cy + y, PAL.eye);
      }
      px(cx - 1, cy - 2, '#ffffff');
      px(cx + 3, cy - 2, '#ffffff');
    }
    px(cx, cy + 2, PAL.eye); px(cx + 1, cy + 2, PAL.eye); px(cx + 2, cy + 2, PAL.eye);
    if (state.happy < 30) {
      px(cx, cy + 3, PAL.eye); px(cx + 2, cy + 3, PAL.eye);
    }
    if (!state.sleeping && state.happy > 60) {
      px(cx - 3, cy + 1, PAL.blush);
      px(cx + 4, cy + 1, PAL.blush);
    }
    ctx.restore();
  }

  function drawArchon() {
    ctx.save();
    ctx.translate(0, state.sleeping ? 4 : bobOffset(1, 7));
    const cx = 19, cy = 14;

    px(cx - 3, cy - 7, PAL.amber);
    px(cx, cy - 8, PAL.amber);
    px(cx + 3, cy - 7, PAL.amber);
    for (let x = -3; x <= 3; x++) px(cx + x, cy - 6, PAL.amber);
    px(cx - 2, cy - 7, PAL.bodyDk);
    px(cx + 2, cy - 7, PAL.bodyDk);

    for (let y = -5; y <= 5; y++) {
      const w = y < -3 ? 4 : y > 3 ? 4 : 6;
      for (let x = -w; x <= w; x++) px(cx + x, cy + y, PAL.body);
    }
    for (let y = -5; y <= 5; y++) {
      const w = y < -3 ? 4 : y > 3 ? 4 : 6;
      px(cx + w, cy + y, PAL.bodyDk);
      px(cx - w, cy + y, PAL.bodyDk);
    }

    px(cx, cy + 1, PAL.teal);
    px(cx + 1, cy + 1, PAL.teal);
    px(cx, cy + 2, PAL.amber);
    px(cx + 1, cy + 2, PAL.amber);

    if (state.sleeping || frame % 50 < 3) {
      for (let x = -3; x <= -1; x++) px(cx + x, cy - 2, PAL.eye);
      for (let x = 2; x <= 4; x++) px(cx + x, cy - 2, PAL.eye);
    } else {
      for (let y = -3; y <= -1; y++) {
        px(cx - 3, cy + y, PAL.eye); px(cx - 2, cy + y, PAL.eye);
        px(cx + 2, cy + y, PAL.eye); px(cx + 3, cy + y, PAL.eye);
      }
      px(cx - 2, cy - 3, '#ffffff');
      px(cx + 3, cy - 3, '#ffffff');
    }
    if (state.happy < 30) {
      px(cx - 1, cy + 4, PAL.eye); px(cx + 2, cy + 4, PAL.eye);
      px(cx, cy + 3, PAL.eye); px(cx + 1, cy + 3, PAL.eye);
    } else {
      for (let x = -1; x <= 2; x++) px(cx + x, cy + 3, PAL.eye);
    }
    ctx.restore();
  }

  function drawDead() {
    const cx = 19, cy = 12;
    const w = Math.sin(frame / 6) * 1;
    ctx.save();
    ctx.translate(w * PX, 0);
    for (let y = -3; y <= 3; y++)
      for (let x = -3; x <= 3; x++)
        px(cx + x, cy + y, 'rgba(216,200,255,0.25)');
    px(cx - 1, cy, PAL.eye);
    px(cx + 1, cy, PAL.eye);
    px(cx, cy + 1, PAL.eye);
    ctx.restore();
  }

})();
