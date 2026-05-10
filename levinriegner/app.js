(function () {
  'use strict';

  /* ── state ─────────────────────────────────────────── */
  var state = {
    screen: 'home',
    history: [],
    workFilter: 'all',
    workIndex: 0,
    workFiltered: [],
    serviceIndex: 0,
    selectedWork: null,
    selectedService: null,
    studioTab: 'about',
    homeFocus: 0,
    rafHandle: null
  };

  var WORK_FILTERS = ['all', 'spatial', 'brand', 'product'];
  var STUDIO_TABS  = ['about', 'news', 'clients', 'awards'];

  var screens = {};

  var ACCENT_GLYPH = { gold: '◈', electric: '◇', rose: '◉', teal: '◎', green: '△' };

  /* ── typewriter ──────────────────────────────────────── */
  var TW_BASE = 32;
  var TW_JITTER = 0.5;
  var twTimers = [];

  function clearTW() {
    twTimers.forEach(clearTimeout);
    twTimers = [];
  }

  function typewrite(el, text, onDone, speed) {
    if (!el) return;
    speed = speed || TW_BASE;
    el.textContent = '';
    var cursor = document.createElement('span');
    cursor.className = 'tw-cursor';
    cursor.textContent = '█';
    el.appendChild(cursor);
    var i = 0;

    function next() {
      if (i >= text.length) {
        cursor.remove();
        if (onDone) onDone();
        return;
      }
      cursor.before(document.createTextNode(text[i]));
      i++;
      var jitter = speed * (1 - TW_JITTER + Math.random() * TW_JITTER * 2);
      twTimers.push(setTimeout(next, jitter));
    }
    next();
  }

  function typewriteAll(screenId) {
    var container = screens[screenId];
    if (!container) return;
    var els = container.querySelectorAll('.tw');
    var delay = 0;
    els.forEach(function (el) {
      var original = el.dataset.twText || el.textContent.trim();
      if (!original) return;
      if (!el.dataset.twText) el.dataset.twText = original;
      el.textContent = '';

      var cursor = document.createElement('span');
      cursor.className = 'tw-cursor';
      cursor.textContent = '█';
      el.appendChild(cursor);

      (function (capturedEl, capturedText, capturedCursor) {
        twTimers.push(setTimeout(function () {
          capturedEl.textContent = '';
          capturedEl.appendChild(capturedCursor);
          var i = 0;
          function next() {
            if (i >= capturedText.length) {
              capturedCursor.remove();
              return;
            }
            capturedCursor.before(document.createTextNode(capturedText[i]));
            i++;
            var jitter = TW_BASE * (1 - TW_JITTER + Math.random() * TW_JITTER * 2);
            twTimers.push(setTimeout(next, jitter));
          }
          next();
        }, delay));
      }(el, original, cursor));

      delay += original.length * TW_BASE * 0.4 + 120;
    });
  }

  /* ── canvas (home) ───────────────────────────────────── */
  var canvas, ctx, particles = [];

  function setupCanvas() {
    canvas = document.getElementById('home-canvas');
    if (!canvas) return;
    canvas.width = 600;
    canvas.height = 600;
    ctx = canvas.getContext('2d');

    for (var i = 0; i < 70; i++) {
      particles.push({
        x: Math.random() * 600,
        y: Math.random() * 600,
        r: Math.random() * 1.4 + 0.3,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
        a: Math.random() * 0.5 + 0.08,
        amber: Math.random() > 0.6,
        cyan: Math.random() > 0.88
      });
    }
    drawCanvas();
  }

  function drawCanvas() {
    if (!ctx) return;
    ctx.clearRect(0, 0, 600, 600);

    for (var i = 0; i < particles.length; i++) {
      for (var j = i + 1; j < particles.length; j++) {
        var dx = particles[i].x - particles[j].x;
        var dy = particles[i].y - particles[j].y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 80) {
          var alpha = 0.07 * (1 - dist / 80);
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(168,232,152,' + alpha + ')';
          ctx.lineWidth = 0.5;
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }

    particles.forEach(function (p) {
      var color = p.cyan ? '0,229,200' : (p.amber ? '168,232,152' : '200,221,192');
      ctx.beginPath();
      ctx.fillStyle = 'rgba(' + color + ',' + p.a + ')';
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();

      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0) p.x = 600;
      if (p.x > 600) p.x = 0;
      if (p.y < 0) p.y = 600;
      if (p.y > 600) p.y = 0;
    });

    state.rafHandle = requestAnimationFrame(drawCanvas);
  }

  /* ── routing ─────────────────────────────────────────── */
  function go(id, pushHistory) {
    clearTW();
    var goingForward = pushHistory !== false;
    if (goingForward) state.history.push(state.screen);
    var prev = screens[state.screen];
    var next = screens[id];
    if (!next) return;
    if (prev) prev.classList.add('hidden');
    next.classList.remove('hidden');
    state.screen = id;

    if (id === 'home') {
      if (!state.rafHandle) drawCanvas();
    } else {
      if (state.rafHandle) {
        cancelAnimationFrame(state.rafHandle);
        state.rafHandle = null;
      }
    }

    /* page-transition centered bloom — stays inside safe zone */
    if (FX && FX.bloom) {
      FX.bloom({ count: 110, cx: 300, cy: 300 });
      FX_AUDIO.transitionBloom();
    }

    typewriteAll(id);

    /* set initial focus per screen so arrow keys are immediately usable */
    setTimeout(function () {
      if (id === 'home')     updateHomeFocus();
      if (id === 'work')     updateWorkFocus();
      if (id === 'services') updateServiceFocus();
    }, 30);
  }

  function back() {
    var prev = state.history.pop();
    if (prev) go(prev, false);
  }

  /* ── work ────────────────────────────────────────────── */
  function filterWork(filter) {
    state.workFilter = filter;
    state.workIndex = 0;
    var filterMap = {
      all: null,
      spatial: ['spatial', 'xr', 'meta', 'meta-quest', 'apple'],
      brand: ['brand', 'identity', 'logo'],
      product: ['platform', 'e-learning', 'mobile', 'product']
    };
    var kw = filterMap[filter];
    state.workFiltered = kw
      ? LR_DATA.work.filter(function (p) {
          return p.tags.some(function (t) { return kw.indexOf(t) !== -1; }) ||
                 p.category.toLowerCase().split(' ').some(function (w) { return kw.indexOf(w) !== -1; });
        })
      : LR_DATA.work.slice();
    document.getElementById('work-meta').textContent = state.workFiltered.length + ' PROJECTS';
    renderWorkList();
  }

  function renderWorkList() {
    var list = document.getElementById('work-list');
    list.innerHTML = '';
    state.workFiltered.forEach(function (project, idx) {
      var btn = document.createElement('button');
      btn.className = 'work-item focusable' + (idx === state.workIndex ? ' focused' : '');
      btn.dataset.idx = idx;
      btn.innerHTML =
        '<div class="work-item-accent accent-' + project.accent + '">' + (ACCENT_GLYPH[project.accent] || '◈') + '</div>' +
        '<div class="work-item-content">' +
          '<div class="work-item-title">' + project.title + '</div>' +
          '<div class="work-item-cat">' + project.category + '</div>' +
        '</div>' +
        '<div class="work-item-stat">' + project.stat.toUpperCase() + '</div>';
      btn.addEventListener('click', function () {
        state.workIndex = idx;
        openProject(project);
      });
      list.appendChild(btn);
    });
  }

  function openProject(project) {
    state.selectedWork = project;
    var titleEl = document.getElementById('detail-title');
    titleEl.dataset.twText = project.title.toUpperCase();
    document.getElementById('detail-category').textContent = project.category.toUpperCase();

    /* image — show only if URL provided and load succeeds */
    var imgWrap = document.getElementById('project-image');
    var img = document.getElementById('detail-image');
    if (project.image) {
      imgWrap.classList.remove('empty');
      img.onerror = function () { imgWrap.classList.add('empty'); };
      img.src = project.image;
      img.alt = project.title;
    } else {
      imgWrap.classList.add('empty');
    }

    var statEl = document.getElementById('project-stat');
    statEl.dataset.twText = project.stat.toUpperCase();

    var descEl = document.getElementById('project-desc');
    descEl.dataset.twText = project.description;

    var hero = document.getElementById('project-hero');
    var accentBorderMap = {
      gold: 'var(--amber)', electric: 'var(--cyan)',
      rose: 'var(--red)', teal: 'var(--cyan)', green: 'var(--ink-0)'
    };
    hero.style.borderLeftColor = accentBorderMap[project.accent] || 'var(--amber)';

    var tagRow = document.getElementById('project-tags');
    tagRow.innerHTML = '';
    project.tags.forEach(function (t) {
      var span = document.createElement('span');
      span.className = 'tag';
      span.textContent = '#' + t;
      tagRow.appendChild(span);
    });

    go('work-detail');
  }

  /* ── services ────────────────────────────────────────── */
  function renderServices() {
    var grid = document.getElementById('services-grid');
    grid.innerHTML = '';
    LR_DATA.services.forEach(function (svc, idx) {
      var btn = document.createElement('button');
      btn.className = 'service-tile focusable' + (idx === state.serviceIndex ? ' focused' : '');
      btn.dataset.idx = idx;
      btn.innerHTML =
        '<div class="tile-glyph">' + svc.glyph + '</div>' +
        '<div class="tile-name">' + svc.title + '</div>' +
        '<div class="tile-short">' + svc.short + '</div>';
      btn.addEventListener('click', function () {
        state.serviceIndex = idx;
        openService(svc);
      });
      grid.appendChild(btn);
    });
  }

  function openService(svc) {
    state.selectedService = svc;
    var titleEl = document.getElementById('service-title');
    titleEl.dataset.twText = svc.title.toUpperCase();
    document.getElementById('service-glyph').textContent = svc.glyph;

    var shortEl = document.getElementById('service-short');
    shortEl.dataset.twText = svc.short;

    var capList = document.getElementById('capabilities-list');
    capList.innerHTML = '';
    svc.capabilities.forEach(function (cap) {
      var div = document.createElement('div');
      div.className = 'capability-item';
      div.textContent = cap;
      capList.appendChild(div);
    });

    var keyMap = {
      'design-brand': ['brand', 'identity'],
      'cx-design': ['cx', 'platform', 'retail'],
      'tech': ['ai', 'meta', 'meta-quest', 'apple', 'blockchain'],
      'product': ['platform', 'e-learning', 'mobile'],
      'strategy': ['startup', 'expansion', 'digital'],
      'employee-xp': ['estee-lauder', 'recognition', 'hr']
    };
    var kw = keyMap[svc.id] || [];
    var related = LR_DATA.work.filter(function (p) {
      return p.tags.some(function (t) { return kw.indexOf(t) !== -1; });
    }).slice(0, 3);

    var relList = document.getElementById('service-work');
    relList.innerHTML = '';
    if (!related.length) {
      relList.innerHTML = '<div style="font-size:12px;color:var(--ink-2);padding:10px 0;letter-spacing:0.14em">SEE FULL WORK LIST &#8594;</div>';
    } else {
      related.forEach(function (p) {
        var btn = document.createElement('button');
        btn.className = 'work-item focusable';
        btn.innerHTML =
          '<div class="work-item-accent accent-' + p.accent + '">' + (ACCENT_GLYPH[p.accent] || '◈') + '</div>' +
          '<div class="work-item-content">' +
            '<div class="work-item-title">' + p.title + '</div>' +
            '<div class="work-item-cat">' + p.category + '</div>' +
          '</div>';
        btn.addEventListener('click', function () { openProject(p); });
        relList.appendChild(btn);
      });
    }

    go('service-detail');
  }

  /* ── studio ──────────────────────────────────────────── */
  function renderStudio(tab) {
    state.studioTab = tab;
    document.querySelectorAll('.studio-tab').forEach(function (t) {
      t.classList.toggle('active', t.dataset.tab === tab);
    });

    var content = document.getElementById('studio-content');

    if (tab === 'about') {
      content.innerHTML =
        '<p class="about-lead">Founded in 2012, Levin+Riegner is a strategy and aesthetics firm. We design transformations and build technology for ambitious brands &mdash; from luxury retail platforms to spatial computing and immersive experiences.</p>' +
        '<div class="about-stat-row">' +
          '<div class="about-stat"><div class="stat-value">2012</div><div class="stat-label">FOUNDED</div></div>' +
          '<div class="about-stat"><div class="stat-value">5</div><div class="stat-label">REGIONS</div></div>' +
          '<div class="about-stat"><div class="stat-value">30+</div><div class="stat-label">ENTERPRISE</div></div>' +
          '<div class="about-stat"><div class="stat-value">25+</div><div class="stat-label">AWARDS</div></div>' +
        '</div>' +
        '<div class="section-title">PRESENCE</div>' +
        '<div class="regions-row">' +
          LR_DATA.regions.map(function (r) { return '<span class="region-pill">' + r + '</span>'; }).join('') +
        '</div>' +
        '<div class="section-title">RECOGNITION</div>' +
        '<div class="recognition-list">' +
          '<div class="recog-item">Meta Spatial SDK Partner</div>' +
          '<div class="recog-item">Apple Vision Pro Creator</div>' +
          '<div class="recog-item">Forbes 30 Under 30</div>' +
          '<div class="recog-item">Red Dot Award Winner</div>' +
        '</div>';
    }

    if (tab === 'clients') {
      content.innerHTML =
        '<div class="client-section-title">ENTERPRISE</div>' +
        '<div class="clients-wrap">' +
          LR_DATA.clients.enterprise.map(function (c) { return '<span class="client-chip">' + c + '</span>'; }).join('') +
        '</div>' +
        '<div class="client-section-title" style="margin-top:16px">STARTUPS</div>' +
        '<div class="clients-wrap">' +
          LR_DATA.clients.startups.map(function (c) { return '<span class="client-chip">' + c + '</span>'; }).join('') +
        '</div>';
    }

    if (tab === 'news') {
      content.innerHTML = '<div class="news-list">' +
        LR_DATA.news.map(function (n) {
          return '<div class="news-item">' +
            '<div class="news-head">' +
              '<span class="news-date">' + n.date + '</span>' +
              '<span class="news-cat ' + n.catClass + '">' + n.category + '</span>' +
            '</div>' +
            '<div class="news-title">' + n.title + '</div>' +
            '<div class="news-summary">' + n.summary + '</div>' +
          '</div>';
        }).join('') +
      '</div>';
    }

    if (tab === 'awards') {
      content.innerHTML = LR_DATA.awards.map(function (a) {
        return '<div class="award-item">' +
          '<div class="award-glyph">★</div>' +
          '<div class="award-content"><div class="award-name">' + a.name + '</div>' +
          '<div class="award-cat">' + a.category + '</div></div></div>';
      }).join('');
    }
  }

  /* ── binding ─────────────────────────────────────────── */
  function bindActions() {
    document.addEventListener('click', function (e) {
      var el = e.target.closest('[data-action]');
      if (el) handleAction(el.dataset.action);
    });

    document.querySelectorAll('[data-zone]').forEach(function (el) {
      el.addEventListener('click', function () {
        var zone = el.dataset.zone;
        if (zone === 'work')     { filterWork('all'); go('work'); }
        if (zone === 'services') { renderServices(); go('services'); }
        if (zone === 'clients')  { renderStudio('clients'); go('studio'); }
        if (zone === 'studio')   { renderStudio('awards'); go('studio'); }
      });
    });

    document.querySelectorAll('.filter-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        document.querySelectorAll('.filter-chip').forEach(function (c) { c.classList.remove('active'); });
        chip.classList.add('active');
        filterWork(chip.dataset.filter);
      });
    });

    document.querySelectorAll('.studio-tab').forEach(function (tab) {
      tab.addEventListener('click', function () { renderStudio(tab.dataset.tab); });
    });
  }

  function handleAction(action) {
    switch (action) {
      case 'back': back(); break;
      case 'go-work':
        filterWork('all');
        go('work');
        break;
      case 'go-services':
        renderServices();
        go('services');
        break;
      case 'go-studio':
        renderStudio('about');
        go('studio');
        break;
      case 'go-work-from-studio':
        filterWork('all');
        go('work');
        break;
      case 'open-project':
        if (state.workFiltered.length) openProject(state.workFiltered[state.workIndex]);
        break;
      case 'next-project':
        var nextIdx = (state.workIndex + 1) % state.workFiltered.length;
        state.workIndex = nextIdx;
        openProject(state.workFiltered[nextIdx]);
        break;
      case 'prev-project':
        var prevIdx = (state.workIndex - 1 + state.workFiltered.length) % state.workFiltered.length;
        state.workIndex = prevIdx;
        openProject(state.workFiltered[prevIdx]);
        break;
      case 'open-service':
        openService(LR_DATA.services[state.serviceIndex]);
        break;
      case 'contact-service':
      case 'go-contact':
        document.getElementById('contact-flash').classList.remove('hidden');
        typewriteAll('contact-flash');
        break;
      case 'flash-dismiss':
        document.getElementById('contact-flash').classList.add('hidden');
        break;
    }
  }

  /* ── keyboard ────────────────────────────────────────────
     Unified arrow-key navigation:
       Up / Down  → primary axis   (lists, button stack, scroll)
       Left/Right → secondary axis (tabs, filters, prev/next)
       Enter/Space → activate focused
       Esc/Bksp    → back (still supported)
  ──────────────────────────────────────────────────────── */
  function bindKeyboard() {
    document.addEventListener('keydown', function (e) {
      var key = e.key;
      if (key === 'Escape' || key === 'Backspace') { e.preventDefault(); back(); return; }

      /* ── HOME — Up/Down between buttons, Enter activates ── */
      if (state.screen === 'home') {
        var btns = document.querySelectorAll('.home-btn');
        if (!btns.length) return;
        if (key === 'ArrowDown') {
          e.preventDefault();
          state.homeFocus = (state.homeFocus + 1) % btns.length;
          updateHomeFocus();
        } else if (key === 'ArrowUp') {
          e.preventDefault();
          state.homeFocus = (state.homeFocus - 1 + btns.length) % btns.length;
          updateHomeFocus();
        } else if (key === 'Enter' || key === ' ') {
          e.preventDefault();
          btns[state.homeFocus].click();
        }
        return;
      }

      /* ── WORK — Up/Down items, Left/Right filters, Enter opens ── */
      if (state.screen === 'work') {
        if (key === 'ArrowDown') {
          e.preventDefault();
          state.workIndex = Math.min(state.workIndex + 1, state.workFiltered.length - 1);
          updateWorkFocus();
        } else if (key === 'ArrowUp') {
          e.preventDefault();
          state.workIndex = Math.max(state.workIndex - 1, 0);
          updateWorkFocus();
        } else if (key === 'ArrowRight') {
          e.preventDefault();
          cycleFilter(1);
        } else if (key === 'ArrowLeft') {
          e.preventDefault();
          cycleFilter(-1);
        } else if (key === 'Enter' || key === ' ') {
          e.preventDefault();
          if (state.workFiltered.length) openProject(state.workFiltered[state.workIndex]);
        }
        return;
      }

      /* ── SERVICES — 4-way grid nav, Enter opens ── */
      if (state.screen === 'services') {
        var sLast = LR_DATA.services.length - 1;
        if (key === 'ArrowRight') {
          e.preventDefault();
          state.serviceIndex = Math.min(state.serviceIndex + 1, sLast);
          updateServiceFocus();
        } else if (key === 'ArrowLeft') {
          e.preventDefault();
          state.serviceIndex = Math.max(state.serviceIndex - 1, 0);
          updateServiceFocus();
        } else if (key === 'ArrowDown') {
          e.preventDefault();
          state.serviceIndex = Math.min(state.serviceIndex + 2, sLast);
          updateServiceFocus();
        } else if (key === 'ArrowUp') {
          e.preventDefault();
          state.serviceIndex = Math.max(state.serviceIndex - 2, 0);
          updateServiceFocus();
        } else if (key === 'Enter' || key === ' ') {
          e.preventDefault();
          openService(LR_DATA.services[state.serviceIndex]);
        }
        return;
      }

      /* ── WORK DETAIL — Left/Right cycle projects, Enter = next ── */
      if (state.screen === 'work-detail') {
        if (key === 'ArrowRight' || key === 'ArrowDown') {
          e.preventDefault(); handleAction('next-project');
        } else if (key === 'ArrowLeft' || key === 'ArrowUp') {
          e.preventDefault(); handleAction('prev-project');
        } else if (key === 'Enter' || key === ' ') {
          e.preventDefault(); handleAction('next-project');
        }
        return;
      }

      /* ── SERVICE DETAIL — Enter = contact us ── */
      if (state.screen === 'service-detail') {
        if (key === 'Enter' || key === ' ') {
          e.preventDefault(); handleAction('contact-service');
        }
        return;
      }

      /* ── STUDIO (About) — Left/Right tabs, Enter = see work ── */
      if (state.screen === 'studio') {
        var cur = STUDIO_TABS.indexOf(state.studioTab);
        if (key === 'ArrowRight') {
          e.preventDefault();
          renderStudio(STUDIO_TABS[Math.min(cur + 1, STUDIO_TABS.length - 1)]);
          FX_AUDIO.tabSwitch();
        } else if (key === 'ArrowLeft') {
          e.preventDefault();
          renderStudio(STUDIO_TABS[Math.max(cur - 1, 0)]);
          FX_AUDIO.tabSwitch();
        } else if (key === 'Enter' || key === ' ') {
          e.preventDefault(); handleAction('go-work-from-studio');
        }
        return;
      }
    });
  }

  function cycleFilter(dir) {
    var cur = WORK_FILTERS.indexOf(state.workFilter);
    var next = (cur + dir + WORK_FILTERS.length) % WORK_FILTERS.length;
    var newFilter = WORK_FILTERS[next];
    document.querySelectorAll('.filter-chip').forEach(function (c) {
      c.classList.toggle('active', c.dataset.filter === newFilter);
    });
    filterWork(newFilter);
    FX_AUDIO.tick();
  }

  function updateHomeFocus() {
    document.querySelectorAll('.home-btn').forEach(function (el, i) {
      el.classList.toggle('focused', i === state.homeFocus);
    });
  }

  function updateWorkFocus() {
    document.querySelectorAll('.work-item').forEach(function (el, i) {
      el.classList.toggle('focused', i === state.workIndex);
    });
    var f = document.querySelector('.work-item.focused');
    if (f) f.scrollIntoView({ block: 'nearest' });
  }

  function updateServiceFocus() {
    document.querySelectorAll('.service-tile').forEach(function (el, i) {
      el.classList.toggle('focused', i === state.serviceIndex);
    });
  }

  /* ══════════════════════════════════════════════════
     FX_AUDIO — Web Audio synth for particles + UI
  ══════════════════════════════════════════════════ */
  var FX_AUDIO = (function () {
    var ctx = null;
    var master = null;
    var bus = null;            /* lightly-filtered bus for shimmer */
    var enabled = true;

    function init() {
      if (ctx) return;
      try {
        var Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) { enabled = false; return; }
        ctx = new Ctx();
        master = ctx.createGain();
        master.gain.value = 0.55;
        master.connect(ctx.destination);
        bus = ctx.createBiquadFilter();
        bus.type = 'highpass';
        bus.frequency.value = 80;
        bus.connect(master);
      } catch (e) { enabled = false; }
    }

    function unlock() {
      if (!ctx) init();
      if (ctx && ctx.state === 'suspended') ctx.resume();
    }

    /* primitive: pitched tone with envelope */
    function tone(freq, dur, opts) {
      if (!enabled || !ctx) return;
      opts = opts || {};
      var osc = ctx.createOscillator();
      var g = ctx.createGain();
      osc.type = opts.wave || 'sine';
      osc.frequency.value = freq;
      osc.connect(g); g.connect(bus);
      var now = ctx.currentTime + (opts.delay || 0);
      var atk = opts.attack || 0.004;
      var peak = opts.peak !== undefined ? opts.peak : 0.16;
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(peak, now + atk);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      osc.start(now);
      osc.stop(now + dur + 0.05);
      if (opts.detune) osc.detune.value = opts.detune;
    }

    /* primitive: filtered noise burst */
    function noise(dur, opts) {
      if (!enabled || !ctx) return;
      opts = opts || {};
      var size = Math.floor(ctx.sampleRate * dur);
      var buf = ctx.createBuffer(1, size, ctx.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < size; i++) d[i] = (Math.random() * 2 - 1);
      var src = ctx.createBufferSource(); src.buffer = buf;
      var f = ctx.createBiquadFilter();
      f.type = opts.filterType || 'lowpass';
      f.frequency.value = opts.cutoff || 1500;
      f.Q.value = opts.q || 1;
      var g = ctx.createGain();
      src.connect(f); f.connect(g); g.connect(bus);
      var now = ctx.currentTime + (opts.delay || 0);
      var peak = opts.peak !== undefined ? opts.peak : 0.06;
      g.gain.setValueAtTime(peak, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      src.start(now); src.stop(now + dur + 0.02);
    }

    /* primitive: pitched sweep */
    function sweep(startF, endF, dur, opts) {
      if (!enabled || !ctx) return;
      opts = opts || {};
      var osc = ctx.createOscillator();
      var g = ctx.createGain();
      osc.type = opts.wave || 'sine';
      var now = ctx.currentTime + (opts.delay || 0);
      osc.frequency.setValueAtTime(startF, now);
      osc.frequency.exponentialRampToValueAtTime(endF, now + dur);
      osc.connect(g); g.connect(bus);
      var peak = opts.peak !== undefined ? opts.peak : 0.10;
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(peak, now + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      osc.start(now); osc.stop(now + dur + 0.05);
    }

    /* ── public: button + nav sounds ──────────────── */
    function homeBtn() {
      tone(880,  0.5,  { peak: 0.16, wave: 'sine' });
      tone(1318, 0.6,  { peak: 0.10, wave: 'sine', delay: 0.04 });
      tone(1760, 0.7,  { peak: 0.06, wave: 'sine', delay: 0.10 });
    }

    function rainbowBurst() {
      var notes = [523.25, 659.25, 783.99, 987.77, 1174.66];
      notes.forEach(function (f, i) {
        tone(f, 0.55, { peak: 0.09, wave: 'sine', delay: i * 0.022 });
      });
      tone(2349.32, 0.45, { peak: 0.05, wave: 'sine', delay: 0.10 });
    }

    function tick() {
      tone(2800, 0.04, { peak: 0.12, wave: 'sine', attack: 0.001 });
      tone(4200, 0.03, { peak: 0.06, wave: 'sine', attack: 0.001, delay: 0.005 });
    }

    function backChirp() {
      sweep(1400, 520, 0.20, { peak: 0.13, wave: 'triangle' });
      tone(420, 0.18, { peak: 0.05, wave: 'sine', delay: 0.06 });
    }

    function tabSwitch() {
      tone(1760, 0.18, { peak: 0.10, wave: 'sine' });
      tone(2640, 0.14, { peak: 0.05, wave: 'sine', delay: 0.03 });
    }

    function workItem() {
      tone(1500, 0.08, { peak: 0.11, wave: 'sine' });
      tone(2500, 0.08, { peak: 0.06, wave: 'sine', delay: 0.035 });
    }

    function serviceTile() {
      tone(660, 0.18, { peak: 0.10, wave: 'sine' });
      tone(990, 0.22, { peak: 0.07, wave: 'sine', delay: 0.04 });
      tone(1320, 0.22, { peak: 0.04, wave: 'sine', delay: 0.08 });
    }

    function transitionBloom() {
      sweep(220, 1100, 0.45, { peak: 0.06, wave: 'triangle' });
      tone(2093.00, 0.55, { peak: 0.07, wave: 'sine', delay: 0.10 });
      tone(3135.96, 0.40, { peak: 0.04, wave: 'sine', delay: 0.16 });
      noise(0.18, { peak: 0.025, cutoff: 6000, filterType: 'highpass', q: 0.5 });
    }

    /* ── public: intro phases ─────────────────────── */
    function introScatter() {
      noise(1.4, { peak: 0.045, cutoff: 280, q: 1.2 });
      sweep(60, 110, 1.3, { peak: 0.04, wave: 'sine' });
    }

    function introConverge() {
      sweep(110, 440, 1.8, { peak: 0.07, wave: 'triangle' });
      sweep(220, 880, 1.8, { peak: 0.05, wave: 'sine', delay: 0.10 });
      sweep(330, 1320, 1.8, { peak: 0.03, wave: 'sine', delay: 0.20 });
    }

    function introFormation() {
      /* major bell chord — moment of letter formation */
      var chord = [523.25, 659.25, 783.99, 987.77, 1318.51];
      chord.forEach(function (f, i) {
        tone(f, 1.8, { peak: 0.11 - i * 0.012, wave: 'sine', delay: i * 0.045 });
      });
      noise(0.15, { peak: 0.04, cutoff: 8000, filterType: 'highpass' });
    }

    function introExplode() {
      sweep(800, 2400, 0.5, { peak: 0.06, wave: 'sine' });
      [659.25, 880, 1174.66, 1568, 2093].forEach(function (f, i) {
        tone(f, 0.9, { peak: 0.06, wave: 'sine', delay: i * 0.05 });
      });
      noise(0.35, { peak: 0.025, cutoff: 6500, filterType: 'highpass' });
    }

    return {
      init: init, unlock: unlock,
      homeBtn: homeBtn, rainbowBurst: rainbowBurst, tick: tick,
      backChirp: backChirp, tabSwitch: tabSwitch, workItem: workItem,
      serviceTile: serviceTile, transitionBloom: transitionBloom,
      introScatter: introScatter, introConverge: introConverge,
      introFormation: introFormation, introExplode: introExplode
    };
  })();

  /* ── intro animation (8s rainbow particle reveal) ─────── */
  function runIntro(onComplete) {
    var overlay = document.getElementById('intro');
    var canvas  = document.getElementById('intro-canvas');
    canvas.width  = 600;
    canvas.height = 600;
    var ctx = canvas.getContext('2d');

    /* sample pixel positions from rasterised L+R (sans-serif extra bold) */
    var off = document.createElement('canvas');
    off.width = 600; off.height = 340;
    var offCtx = off.getContext('2d');
    offCtx.fillStyle = '#fff';
    offCtx.font = '900 220px "Helvetica Neue", "Arial Black", "Inter", sans-serif';
    offCtx.textAlign = 'center';
    offCtx.textBaseline = 'middle';
    offCtx.fillText('L+R', 300, 170);
    var img = offCtx.getImageData(0, 0, 600, 340).data;

    var targets = [];
    var STEP = 5;
    for (var ty = 0; ty < 340; ty += STEP) {
      for (var tx = 0; tx < 600; tx += STEP) {
        if (img[(ty * 600 + tx) * 4 + 3] > 120) {
          targets.push({ x: tx, y: ty + 90 }); /* center letter ~y=260 */
        }
      }
    }
    for (var si = targets.length - 1; si > 0; si--) {
      var sj = Math.floor(Math.random() * (si + 1));
      var st = targets[si]; targets[si] = targets[sj]; targets[sj] = st;
    }
    targets = targets.slice(0, 650);

    /* timing constants (ms) — extended ~8.3s */
    var T0 = 0;
    var DUR_SCATTER  = 1300;
    var T1 = T0 + DUR_SCATTER;        /* 1300 — converge starts */
    var DUR_CONVERGE = 2400;
    var T2 = T1 + DUR_CONVERGE;       /* 3700 — hold starts */
    var DUR_HOLD     = 1700;
    var T3 = T2 + DUR_HOLD;           /* 5400 — text/explode */
    var DUR_TEXT     = 2200;
    var T4 = T3 + DUR_TEXT;           /* 7600 — fade */
    var DUR_FADE     = 700;
    var T5 = T4 + DUR_FADE;           /* 8300 — done */

    /* build letter particles with full rainbow distribution
       (kept inside ~80px safe zone for the magical "floating" feel) */
    var particles = targets.map(function (tgt, i) {
      var angle = Math.random() * Math.PI * 2;
      var dist  = 130 + Math.random() * 120; /* tighter scatter ring */
      var rng   = Math.random();
      var sx = 300 + Math.cos(angle) * dist;
      var sy = 260 + Math.sin(angle) * dist;
      /* clamp to safe zone */
      sx = Math.max(80, Math.min(520, sx));
      sy = Math.max(80, Math.min(520, sy));
      return {
        sx: sx,
        sy: sy,
        x: 0, y: 0,
        tx: tgt.x, ty: tgt.y,
        size: rng < 0.12 ? 2.5 + Math.random() * 2 : 0.7 + Math.random() * 1.6,
        hue: (i / targets.length) * 360 + Math.random() * 40,
        sat: 85 + Math.random() * 15,
        delay: Math.random() * 600,
        evx: (Math.random() - 0.5) * 2.2, /* gentler explode */
        evy: -(Math.random() * 1.8 + 0.4) + (Math.random() - 0.5) * 1.6,
        sparkle: rng > 0.78,
        sparklePhase: Math.random() * Math.PI * 2,
        sparkleSpeed: 0.005 + Math.random() * 0.012,
        leader: rng < 0.12
      };
    });
    particles.forEach(function (p) { p.x = p.sx; p.y = p.sy; });

    /* ambient rainbow drifters — confined to inner safe zone */
    var ambient = [];
    for (var ai = 0; ai < 110; ai++) {
      ambient.push({
        x: 80 + Math.random() * 440,
        y: 80 + Math.random() * 440,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: Math.random() * 1.1 + 0.2,
        a: Math.random() * 0.22 + 0.05,
        hue: Math.random() * 360,
        sat: 70 + Math.random() * 30
      });
    }

    /* edge fade — keeps everything inside a soft inner area */
    function edgeMask(x, y) {
      var EDGE_FULL = 90;
      var EDGE_ZERO = 20;
      var d = Math.min(x, 600 - x, y, 600 - y);
      if (d <= EDGE_ZERO) return 0;
      if (d >= EDGE_FULL) return 1;
      var t = (d - EDGE_ZERO) / (EDGE_FULL - EDGE_ZERO);
      return t * t * (3 - 2 * t); /* smoothstep */
    }

    function easeInOut(t) { return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2; }
    function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

    var t0 = null;
    var nameFull = 'Levin+Riegner';
    var audioFired = { scatter: false, converge: false, formation: false, explode: false };

    function frame(ts) {
      if (!t0) t0 = ts;
      var el = ts - t0;

      /* ── audio cues per intro phase ──────────────── */
      if (!audioFired.scatter && el >= 50) {
        audioFired.scatter = true;
        FX_AUDIO.introScatter();
      }
      if (!audioFired.converge && el >= T1) {
        audioFired.converge = true;
        FX_AUDIO.introConverge();
      }
      if (!audioFired.formation && el >= T2) {
        audioFired.formation = true;
        FX_AUDIO.introFormation();
      }
      if (!audioFired.explode && el >= T3) {
        audioFired.explode = true;
        FX_AUDIO.introExplode();
      }

      /* trail fade — softer during hold/text for richer accumulation */
      var trailA;
      if (el < T1) trailA = 0.10;          /* scatter */
      else if (el < T2) trailA = 0.13;     /* converge — short trails */
      else if (el < T3) trailA = 0.05;     /* hold — long trails for halo accumulation */
      else if (el < T4) trailA = 0.08;     /* explode/text — lingering rainbow trails */
      else trailA = 0.12;                  /* fade phase */
      ctx.fillStyle = 'rgba(0,0,0,' + trailA + ')';
      ctx.fillRect(0, 0, 600, 600);

      /* ambient drifters — bounce inside safe zone */
      ambient.forEach(function (p) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 80 || p.x > 520) p.vx *= -1;
        if (p.y < 80 || p.y > 520) p.vy *= -1;
        p.x = Math.max(80, Math.min(520, p.x));
        p.y = Math.max(80, Math.min(520, p.y));
        var hue = (p.hue + el * 0.03) % 360;
        var mask = edgeMask(p.x, p.y);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'hsla(' + hue + ',' + p.sat + '%,65%,' + (p.a * mask) + ')';
        ctx.fill();
      });

      /* letter particles */
      particles.forEach(function (p) {
        var px, py, alpha, sat, light, hue;

        hue = (p.hue + el * 0.04) % 360;
        sat = p.sat;
        light = 60;

        if (el < T1) {
          /* scatter — wobble in start position */
          var wobble = Math.sin(el * 0.0028 + p.delay * 0.01) * 14;
          px = p.sx + wobble;
          py = p.sy + Math.cos(el * 0.0023 + p.delay * 0.011) * 12;
          alpha = Math.min(el / T1, 1) * 0.7;

        } else if (el < T2) {
          /* converge */
          var raw = Math.max(0, el - T1 - p.delay) / (DUR_CONVERGE - 200);
          var prog = Math.min(raw, 1);
          var e = easeInOut(prog);
          px = p.sx + (p.tx - p.sx) * e;
          py = p.sy + (p.ty - p.sy) * e;
          alpha = 0.55 + e * 0.45;
          /* fade colors toward white in last 35% of convergence */
          if (prog > 0.65) {
            var whiteFade = (prog - 0.65) / 0.35;
            sat = sat * (1 - whiteFade);
            light = 60 + 40 * whiteFade;
          }
          p.x = px; p.y = py;

        } else if (el < T3) {
          /* hold — pure white core, rainbow halo, gentle pulse */
          var holdT = (el - T2) / DUR_HOLD;
          var pulse = Math.sin(holdT * Math.PI * 3) * 0.6;
          px = p.tx + (p.tx - 300) * pulse * 0.014;
          py = p.ty + (p.ty - 260) * pulse * 0.014;
          alpha = 0.85 + Math.sin(holdT * Math.PI * 5 + p.delay * 0.04) * 0.15;
          sat = 0;
          light = 100;
          p.x = px; p.y = py;

          /* rainbow halo glow */
          var haloR = p.size * (p.leader ? 5 : 3.2);
          var grad = ctx.createRadialGradient(px, py, 0, px, py, haloR);
          grad.addColorStop(0, 'hsla(' + hue + ', 95%, 60%, 0.4)');
          grad.addColorStop(0.4, 'hsla(' + hue + ', 95%, 60%, 0.15)');
          grad.addColorStop(1, 'hsla(' + hue + ', 95%, 60%, 0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(px, py, haloR, 0, Math.PI * 2);
          ctx.fill();

        } else {
          /* explode + drift — colors regain rainbow, gentler outward */
          var driftT = (el - T3) / DUR_TEXT;
          var dEase = easeOutCubic(driftT);
          px = p.x + p.evx * dEase * 90;
          py = p.y + p.evy * dEase * 90;
          alpha = Math.max(0.95 - driftT * 1.9, 0);
          /* recover from white */
          var colorBack = Math.min(driftT * 2.5, 1);
          sat = p.sat * colorBack;
          light = 100 - 40 * colorBack;
        }

        /* sparkle pulse on some particles */
        if (p.sparkle) {
          var sparkleP = (Math.sin(el * p.sparkleSpeed + p.sparklePhase) + 1) * 0.5;
          alpha *= 0.5 + sparkleP * 0.7;
          if (sparkleP > 0.85) light = Math.min(light + 25, 100);
        }

        /* edge mask keeps everything inside the safe zone */
        alpha *= edgeMask(px, py);

        if (alpha <= 0.01) return;

        var size = p.size;
        if (el >= T2 && el < T3) size *= 1.15; /* slightly bigger on hold */

        /* glow for leader particles or during hold */
        if (p.leader || (el >= T2 && el < T3)) {
          var gradOuter = ctx.createRadialGradient(px, py, 0, px, py, size * 3);
          gradOuter.addColorStop(0, 'hsla(' + hue + ',' + sat + '%,' + light + '%,' + (alpha * 0.55) + ')');
          gradOuter.addColorStop(1, 'hsla(' + hue + ',' + sat + '%,' + light + '%,0)');
          ctx.fillStyle = gradOuter;
          ctx.beginPath();
          ctx.arc(px, py, size * 3, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = 'hsla(' + hue + ',' + sat + '%,' + light + '%,' + alpha + ')';
        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fill();
      });

      /* white flash at end of hold */
      if (el >= T3 - 120 && el < T3 + 80) {
        var flashT = 1 - Math.abs(el - T3) / 120;
        ctx.fillStyle = 'rgba(255,255,255,' + (flashT * 0.65) + ')';
        ctx.fillRect(0, 0, 600, 600);
      }

      /* text reveal */
      if (el >= T3) {
        var tp = Math.min((el - T3) / DUR_TEXT, 1);
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';

        /* Levin+Riegner — sans-serif extra bold, white */
        var charsShown = Math.floor(tp * 2 * nameFull.length);
        var display = nameFull.substring(0, Math.min(charsShown, nameFull.length));
        ctx.font = '900 32px "Helvetica Neue", "Arial Black", sans-serif';
        var nameAlpha = Math.min(tp * 3, 1);
        ctx.shadowColor = 'rgba(255,255,255,' + (nameAlpha * 0.5) + ')';
        ctx.shadowBlur = 20;
        ctx.fillStyle = 'rgba(255,255,255,' + nameAlpha + ')';
        ctx.fillText(display, 300, 415);
        ctx.shadowBlur = 0;

        /* blinking cursor */
        if (charsShown < nameFull.length) {
          var tw = ctx.measureText(display).width;
          var blink = Math.floor(el * 0.008) % 2;
          if (blink === 0) {
            ctx.fillStyle = 'rgba(255,255,255,' + nameAlpha + ')';
            ctx.fillRect(300 + tw / 2 + 5, 391, 16, 32);
          }
        }

        /* strategy + aesthetics subtitle (green) */
        if (tp > 0.5) {
          var subA = Math.min((tp - 0.5) * 2.8, 0.9);
          ctx.font = '700 14px "SF Mono", "Courier New", monospace';
          ctx.fillStyle = 'rgba(184, 240, 160, ' + subA + ')';
          ctx.fillText('STRATEGY  +  AESTHETICS', 300, 452);
        }

        ctx.restore();
      }

      /* final black fade */
      if (el >= T4) {
        var fp = Math.min((el - T4) / DUR_FADE, 1);
        ctx.fillStyle = 'rgba(0,0,0,' + fp + ')';
        ctx.fillRect(0, 0, 600, 600);
      }

      if (el >= T5) {
        overlay.style.display = 'none';
        onComplete();
        return;
      }

      requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  }

  /* ══════════════════════════════════════════════════
     FX — global particle system for UI interactions
  ══════════════════════════════════════════════════ */
  var FX = (function () {
    var fxCanvas, fxCtx;
    var pool = [];
    var rafH = null;
    var lastTs = 0;

    function init() {
      fxCanvas = document.getElementById('fx-canvas');
      if (!fxCanvas) return;
      fxCanvas.width  = 600;
      fxCanvas.height = 600;
      fxCtx = fxCanvas.getContext('2d');
      requestAnimationFrame(tick);
    }

    /* edge fade — keep particles inside the magical safe zone */
    function edgeMaskFX(x, y) {
      var FULL = 70;
      var ZERO = 8;
      var d = Math.min(x, 600 - x, y, 600 - y);
      if (d <= ZERO) return 0;
      if (d >= FULL) return 1;
      var t = (d - ZERO) / (FULL - ZERO);
      return t * t * (3 - 2 * t);
    }

    function tick(ts) {
      if (!fxCtx) { rafH = requestAnimationFrame(tick); return; }
      var dt = lastTs ? Math.min(ts - lastTs, 50) : 16;
      lastTs = ts;

      fxCtx.clearRect(0, 0, 600, 600);

      var alive = [];
      for (var i = 0; i < pool.length; i++) {
        var p = pool[i];
        p.life += dt;
        if (p.life >= p.maxLife) continue;

        p.vx += p.ax || 0;
        p.vy += p.ay || 0;
        p.vx *= p.drag;
        p.vy *= p.drag;
        p.x += p.vx;
        p.y += p.vy;

        var t = p.life / p.maxLife;
        var alpha = (1 - t) * (1 - t);
        var size = p.size * (1 - t * 0.4);

        var hue = (p.hue + (p.hueShift || 0) * t * 360) % 360;

        /* edge mask keeps everything inside the visible bounds */
        alpha *= edgeMaskFX(p.x, p.y);

        if (alpha <= 0.005) { alive.push(p); continue; }

        if (p.glow) {
          var rad = size * 4.5;
          var grad = fxCtx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad);
          grad.addColorStop(0, 'hsla(' + hue + ',' + p.sat + '%,' + p.light + '%,' + (alpha * 0.5) + ')');
          grad.addColorStop(1, 'hsla(' + hue + ',' + p.sat + '%,' + p.light + '%,0)');
          fxCtx.fillStyle = grad;
          fxCtx.beginPath();
          fxCtx.arc(p.x, p.y, rad, 0, Math.PI * 2);
          fxCtx.fill();
        }

        fxCtx.fillStyle = 'hsla(' + hue + ',' + p.sat + '%,' + p.light + '%,' + alpha + ')';
        fxCtx.beginPath();
        fxCtx.arc(p.x, p.y, size, 0, Math.PI * 2);
        fxCtx.fill();

        alive.push(p);
      }
      pool = alive;
      rafH = requestAnimationFrame(tick);
    }

    function spawn(p) {
      p.life = 0;
      p.drag = p.drag === undefined ? 0.96 : p.drag;
      p.sat = p.sat === undefined ? (80 + Math.random() * 20) : p.sat;
      p.light = p.light === undefined ? (55 + Math.random() * 25) : p.light;
      pool.push(p);
    }

    /* ── effect: radial burst ────────────────────────── */
    function burst(x, y, opts) {
      opts = opts || {};
      var count = opts.count || 16;
      var hMin = opts.hueMin !== undefined ? opts.hueMin : 0;
      var hMax = opts.hueMax !== undefined ? opts.hueMax : 360;
      var speed = opts.speed || 4;
      var life = opts.life || 700;
      var glow = opts.glow !== false;
      var gravity = opts.gravity !== undefined ? opts.gravity : 0.04;

      for (var i = 0; i < count; i++) {
        var angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
        var sp = speed * (0.45 + Math.random() * 0.85);
        spawn({
          x: x, y: y,
          vx: Math.cos(angle) * sp,
          vy: Math.sin(angle) * sp,
          ay: gravity,
          maxLife: life * (0.7 + Math.random() * 0.6),
          size: 1.2 + Math.random() * 1.8,
          hue: hMin + Math.random() * (hMax - hMin),
          glow: glow && Math.random() > 0.4
        });
      }
    }

    /* ── effect: rainbow sparkle (for primary actions) ──── */
    function rainbowBurst(x, y, opts) {
      opts = opts || {};
      var count = opts.count || 28;
      var speed = opts.speed || 5;
      var life = opts.life || 900;

      for (var i = 0; i < count; i++) {
        var angle = (i / count) * Math.PI * 2 + Math.random() * 0.25;
        var sp = speed * (0.3 + Math.random() * 1);
        spawn({
          x: x, y: y,
          vx: Math.cos(angle) * sp,
          vy: Math.sin(angle) * sp,
          ay: 0.03,
          maxLife: life * (0.7 + Math.random() * 0.6),
          size: 1.4 + Math.random() * 2.2,
          hue: (i / count) * 360,
          sat: 95,
          light: 60,
          glow: true,
          hueShift: 0.3
        });
      }
      /* white core sparks */
      for (var k = 0; k < 8; k++) {
        var ang = Math.random() * Math.PI * 2;
        var sp2 = speed * (0.2 + Math.random() * 0.5);
        spawn({
          x: x, y: y,
          vx: Math.cos(ang) * sp2,
          vy: Math.sin(ang) * sp2,
          maxLife: 450,
          size: 1.8 + Math.random() * 1,
          hue: 0, sat: 0, light: 100,
          glow: true
        });
      }
    }

    /* ── effect: inward swirl (back button) ─────────── */
    function swirl(x, y, opts) {
      opts = opts || {};
      var count = opts.count || 14;
      for (var i = 0; i < count; i++) {
        var angle = (i / count) * Math.PI * 2;
        var radius = 30 + Math.random() * 25;
        var sx = x + Math.cos(angle) * radius;
        var sy = y + Math.sin(angle) * radius;
        var inAng = angle + Math.PI; /* point inward */
        spawn({
          x: sx, y: sy,
          vx: Math.cos(inAng) * 2.5,
          vy: Math.sin(inAng) * 2.5,
          drag: 0.94,
          maxLife: 600,
          size: 1.5 + Math.random() * 1.2,
          hue: 200 + Math.random() * 60, /* blue/cyan */
          sat: 80,
          light: 65,
          glow: true
        });
      }
    }

    /* ── effect: horizontal beam ────────────────────── */
    function beam(x1, y1, x2, y2, opts) {
      opts = opts || {};
      var count = opts.count || 16;
      var dx = x2 - x1, dy = y2 - y1;
      var len = Math.sqrt(dx * dx + dy * dy) || 1;
      var nx = dx / len, ny = dy / len;
      for (var i = 0; i < count; i++) {
        var sp = 3 + Math.random() * 3;
        var spread = (Math.random() - 0.5) * 0.6;
        spawn({
          x: x1, y: y1,
          vx: nx * sp + (-ny) * spread,
          vy: ny * sp + nx * spread,
          drag: 0.97,
          maxLife: 500 + Math.random() * 300,
          size: 1 + Math.random() * 1.5,
          hue: opts.hue !== undefined ? opts.hue : (Math.random() * 360),
          sat: opts.sat || 90,
          light: 65,
          glow: true
        });
      }
    }

    /* ── effect: contained bloom (page transitions) ─────
       particles bloom outward from center but fade well before edges */
    function bloom(opts) {
      opts = opts || {};
      var count = opts.count || 110;
      var hMin = opts.hueMin !== undefined ? opts.hueMin : 0;
      var hMax = opts.hueMax !== undefined ? opts.hueMax : 360;
      var cx = opts.cx !== undefined ? opts.cx : 300;
      var cy = opts.cy !== undefined ? opts.cy : 300;

      for (var i = 0; i < count; i++) {
        var angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
        var sp = 2.4 + Math.random() * 3;
        spawn({
          x: cx + Math.cos(angle) * (10 + Math.random() * 30),
          y: cy + Math.sin(angle) * (10 + Math.random() * 30),
          vx: Math.cos(angle) * sp,
          vy: Math.sin(angle) * sp,
          drag: 0.96,
          maxLife: 700 + Math.random() * 350,
          size: 0.9 + Math.random() * 1.8,
          hue: hMin + Math.random() * (hMax - hMin),
          sat: 90,
          light: 60 + Math.random() * 25,
          glow: Math.random() > 0.45
        });
      }
      /* white core sparks */
      for (var k = 0; k < 12; k++) {
        var a2 = Math.random() * Math.PI * 2;
        var sp2 = 1.5 + Math.random() * 1.5;
        spawn({
          x: cx, y: cy,
          vx: Math.cos(a2) * sp2,
          vy: Math.sin(a2) * sp2,
          drag: 0.94,
          maxLife: 500,
          size: 1.4 + Math.random() * 0.8,
          hue: 0, sat: 0, light: 100,
          glow: true
        });
      }
    }

    /* keep sweep as alias for any existing callers */
    function sweep(direction, opts) {
      opts = opts || {};
      bloom({
        count: opts.count || 110,
        hueMin: opts.hueMin,
        hueMax: opts.hueMax
      });
    }

    /* ── effect: ring expansion ─────────────────────── */
    function ring(x, y, opts) {
      opts = opts || {};
      var count = opts.count || 36;
      var speed = opts.speed || 5;
      var hueBase = opts.hue !== undefined ? opts.hue : null;
      for (var i = 0; i < count; i++) {
        var angle = (i / count) * Math.PI * 2;
        spawn({
          x: x, y: y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          drag: 0.96,
          maxLife: 800,
          size: 1.4 + Math.random() * 0.8,
          hue: hueBase !== null ? hueBase + (Math.random() - 0.5) * 30 : (i / count) * 360,
          sat: 90,
          light: 65,
          glow: true
        });
      }
    }

    return {
      init: init,
      burst: burst,
      rainbowBurst: rainbowBurst,
      swirl: swirl,
      beam: beam,
      sweep: sweep,
      bloom: bloom,
      ring: ring
    };
  })();

  /* ── wire FX into UI events ──────────────────────── */
  function bindFX() {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('button, .focusable');
      if (!btn) return;
      var hostRect = document.getElementById('app').getBoundingClientRect();
      var btnRect = btn.getBoundingClientRect();
      var x = btnRect.left - hostRect.left + btnRect.width / 2;
      var y = btnRect.top - hostRect.top + btnRect.height / 2;

      /* unlock audio on first interaction */
      FX_AUDIO.unlock();

      /* dispatch by button type — each gets unique visual + audio */
      if (btn.classList.contains('back-btn') || btn.dataset.action === 'back') {
        FX.swirl(x, y);
        FX_AUDIO.backChirp();
      } else if (btn.classList.contains('home-btn')) {
        /* track which home button is focused for return-from-screen */
        var idx = Array.prototype.indexOf.call(document.querySelectorAll('.home-btn'), btn);
        if (idx >= 0) state.homeFocus = idx;
        FX.ring(x, y, { count: 32, speed: 3.2 });
        setTimeout(function () { FX.rainbowBurst(x, y, { count: 18, speed: 2.5 }); }, 60);
        FX_AUDIO.homeBtn();
      } else if (btn.classList.contains('primary')) {
        FX.rainbowBurst(x, y);
        FX_AUDIO.rainbowBurst();
      } else if (btn.classList.contains('service-tile')) {
        FX.burst(x, y, { count: 22, hueMin: 0, hueMax: 360, speed: 3.5 });
        FX_AUDIO.serviceTile();
      } else if (btn.classList.contains('work-item')) {
        FX.beam(x - 60, y, x + 160, y, { count: 18, hue: 130 });
        FX_AUDIO.workItem();
      } else if (btn.classList.contains('filter-chip')) {
        FX.burst(x, y + 8, { count: 8, hueMin: 100, hueMax: 160, speed: 2.2, life: 500 });
        FX_AUDIO.tick();
      } else if (btn.classList.contains('studio-tab')) {
        FX.beam(x, y + 10, x, y + 30, { count: 12, hue: 130 });
        FX_AUDIO.tabSwitch();
      } else if (btn.classList.contains('nav-item')) {
        FX.burst(x, y, { count: 16, hueMin: 100, hueMax: 160, speed: 3 });
        FX_AUDIO.tick();
      } else {
        FX.burst(x, y, { count: 12, hueMin: 0, hueMax: 360, speed: 2.8 });
        FX_AUDIO.tick();
      }
    });
  }

  /* ── init ────────────────────────────────────────────── */
  function init() {
    /* hide all screens — restored selectively after intro */
    document.querySelectorAll('.screen').forEach(function (el) {
      screens[el.id] = el;
      el.classList.add('hidden');
    });
    state.workFiltered = LR_DATA.work.slice();
    bindActions();
    bindKeyboard();
    bindFX();
    FX.init();
    FX_AUDIO.init();
    /* unlock audio on first user gesture (browsers gate AudioContext) */
    var unlockOnce = function () {
      FX_AUDIO.unlock();
      document.removeEventListener('click', unlockOnce);
      document.removeEventListener('keydown', unlockOnce);
    };
    document.addEventListener('click', unlockOnce);
    document.addEventListener('keydown', unlockOnce);
    renderStudio('about');

    runIntro(function () {
      screens['home'].classList.remove('hidden');
      state.screen = 'home';
      setupCanvas();
      typewriteAll('home');
      updateHomeFocus();
    });
  }

  document.addEventListener('DOMContentLoaded', init);

}());
