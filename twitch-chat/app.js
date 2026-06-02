// ──────────────────────────────────────────────────────────────────
// TWITCH CHAT HUD — Meta Display glasses
// 600×600. D-pad navigation. Anonymous Twitch IRC over WebSocket.
//
//   wss://irc-ws.chat.twitch.tv:443
//   NICK justinfan<random>           ← anonymous read-only login
//   CAP REQ :twitch.tv/tags          ← request color + display-name tags
//   JOIN #<channel>
//   PRIVMSG #<channel> :<message>    ← inbound chat
//
// No OAuth, no API key. Hosted demo URL accepts ?channel=<name> so a
// streamer can bookmark their own chat (e.g. ?channel=mytwitchname).
// ──────────────────────────────────────────────────────────────────

(function () {
  'use strict';

  const STORAGE_LAST = 'lr.twitch-chat.last-channel.v1';
  const STORAGE_SIZE = 'lr.twitch-chat.size.v1';
  const MAX_MESSAGES = 60;
  const RECONNECT_MS = 3000;

  // Curated preset channels — large, active, family-friendly enough to
  // demo with. The user can also pass ?channel=anything to override.
  const PRESET_CHANNELS = [
    'xqc',
    'kai_cenat',
    'pokimane',
    'shroud',
    'summit1g',
    'asmongold',
    'jynxzi',
    'caseoh_',
  ];

  const $ = (id) => document.getElementById(id);

  // ── State ─────────────────────────────────────────────────
  const state = {
    screen: 'home',          // 'home' | 'chat'
    list: [],                // [{name, tag}]
    focus: 0,
    channel: null,
    socket: null,
    reconnectTimer: null,
    messages: [],            // [{user, color, body, action, mention}]
    size: 2,                 // 1..3
    paused: false,           // user scrolled away from bottom
    demoMode: false,         // true if ?demo=1 or ?state=...
    demoTimer: null,
    theme: null,             // active demo theme (defaults to THEMES.demo)
  };

  // ── localStorage helpers ──────────────────────────────────
  function loadLast() {
    try { return localStorage.getItem(STORAGE_LAST) || null; }
    catch (_) { return null; }
  }
  function saveLast(name) {
    try { localStorage.setItem(STORAGE_LAST, name); } catch (_) {}
  }
  function loadSize() {
    try {
      const n = parseInt(localStorage.getItem(STORAGE_SIZE), 10);
      return (n === 1 || n === 2 || n === 3) ? n : 2;
    } catch (_) { return 2; }
  }
  function saveSize(n) {
    try { localStorage.setItem(STORAGE_SIZE, String(n)); } catch (_) {}
  }

  // ── URL params ────────────────────────────────────────────
  const params = new URLSearchParams(location.search);
  const urlChannel = (params.get('channel') || '').toLowerCase().replace(/[^a-z0-9_]/g, '');
  const urlState = params.get('state');
  const urlDemo = params.get('demo') === '1' || !!urlState;

  // ── Channel list assembly ─────────────────────────────────
  // The DEMO entry is always first — picking it runs a fake live feed
  // (no real WebSocket) so the UI can be exercised without a Twitch
  // connection. Real channels live below it.
  const DEMO_ENTRY = { name: 'demo', label: 'DEMO', tag: 'FAKE FEED', demo: true };
  // Aria — busker streaming herself making music out on the street. A
  // curated, always-works simulated feed (no real socket) themed around
  // street performance: song requests, tips, the crowd, the location.
  const ARIA_ENTRY = { name: 'ariathome', label: 'ARIATHOME', tag: 'STREET · LIVE', demo: true };

  function buildChannelList() {
    const out = [DEMO_ENTRY, ARIA_ENTRY];
    const seen = new Set();
    const last = loadLast();

    if (urlChannel) {
      out.push({ name: urlChannel, tag: 'FROM URL' });
      seen.add(urlChannel);
    }
    if (last && last !== DEMO_ENTRY.name && !seen.has(last)) {
      out.push({ name: last, tag: 'RECENT' });
      seen.add(last);
    }
    PRESET_CHANNELS.forEach((c) => {
      if (!seen.has(c)) { out.push({ name: c, tag: '' }); seen.add(c); }
    });
    state.list = out;
    state.focus = 0;
  }

  function renderChannelList() {
    const ul = $('channel-list');
    ul.innerHTML = '';
    state.list.forEach((c, i) => {
      const li = document.createElement('li');
      const isDemo = !!c.demo;
      li.className = 'channel-item' + (i === state.focus ? ' focused' : '') + (isDemo ? ' is-demo' : '');
      li.innerHTML =
        '<span class="ci-hash">' + (isDemo ? '▶' : '#') + '</span>' +
        '<span class="ci-name">' + escapeHtml(isDemo ? c.label : c.name) + '</span>' +
        (c.tag ? '<span class="ci-tag">' + c.tag + '</span>' : '');
      ul.appendChild(li);
    });
    const el = ul.children[state.focus];
    if (el) el.scrollIntoView({ block: 'nearest' });
  }

  function moveFocus(delta) {
    const n = state.list.length;
    if (!n) return;
    state.focus = (state.focus + delta + n) % n;
    renderChannelList();
  }

  // ── Screen routing ────────────────────────────────────────
  function showScreen(name) {
    state.screen = name;
    $('home').classList.toggle('hidden', name !== 'home');
    $('chat').classList.toggle('hidden', name !== 'chat');
  }

  // ── Username color (fallback when no tag color) ───────────
  // Twitch's default palette of 15 colors — we hash the username
  // into one so each user is visually distinct even without OAuth.
  const FALLBACK_COLORS = [
    '#FF4A80', '#FF7F50', '#FFB84D', '#F7E26B',
    '#5CF28A', '#2EE6A8', '#4DD8FF', '#5AC8FA',
    '#7A8CFF', '#A371FF', '#C77DFF', '#FF6FD8',
    '#FF8A65', '#FFD580', '#FFB1F0',
  ];
  function colorFor(name) {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return FALLBACK_COLORS[h % FALLBACK_COLORS.length];
  }

  // ── IRC parsing ───────────────────────────────────────────
  // Twitch IRC line shape with tags:
  //   @badge-info=...;color=#FF7F50;display-name=Alex :alex!alex@alex.tmi.twitch.tv PRIVMSG #channel :hello world
  function parseTags(s) {
    const t = {};
    s.slice(1).split(';').forEach((pair) => {
      const eq = pair.indexOf('=');
      if (eq < 0) return;
      t[pair.slice(0, eq)] = pair.slice(eq + 1);
    });
    return t;
  }

  function parseLine(line) {
    let i = 0;
    let tags = {};
    if (line[0] === '@') {
      const sp = line.indexOf(' ');
      tags = parseTags(line.slice(0, sp));
      i = sp + 1;
    }
    let prefix = '';
    if (line[i] === ':') {
      const sp = line.indexOf(' ', i);
      prefix = line.slice(i + 1, sp);
      i = sp + 1;
    }
    const rest = line.slice(i);
    const colon = rest.indexOf(' :');
    let head, trailing;
    if (colon === -1) {
      head = rest;
      trailing = '';
    } else {
      head = rest.slice(0, colon);
      trailing = rest.slice(colon + 2);
    }
    const parts = head.split(' ').filter(Boolean);
    return { tags, prefix, cmd: parts[0] || '', params: parts.slice(1), trailing };
  }

  // ── Connection ────────────────────────────────────────────
  function setStatus(state_, text) {
    const dot = $('status-dot');
    dot.className = 'status-dot ' + state_;
    $('status-text').textContent = text;
  }

  function connect(channel) {
    state.channel = channel;
    if (!state.demoMode) saveLast(channel);
    $('chat-channel').textContent = '#' + channel;
    setStatus('', 'CONNECTING');
    state.messages = [];
    renderFeed();

    if (state.demoMode) {
      // Pretend-connected demo: don't open a real socket. Pick the
      // themed content pool that matches this channel (falls back to
      // the generic DEMO feed for the plain demo entry / ?demo=1).
      state.theme = THEMES[channel] || THEMES.demo;
      setStatus('live', 'LIVE · DEMO');
      $('feed-empty').classList.add('hidden');
      seedDemoMessages();
      startDemoStream();
      return;
    }

    closeSocket();

    let ws;
    try {
      ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');
    } catch (e) {
      setStatus('error', 'CONNECT FAILED');
      scheduleReconnect();
      return;
    }
    state.socket = ws;

    ws.addEventListener('open', () => {
      const nick = 'justinfan' + Math.floor(10000 + Math.random() * 80000);
      ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
      ws.send('PASS SCHMOOPIIE');           // anonymous; any token works
      ws.send('NICK ' + nick);
      ws.send('JOIN #' + channel);
    });

    ws.addEventListener('message', (ev) => {
      const chunks = ev.data.split('\r\n');
      for (const line of chunks) {
        if (!line) continue;
        handleLine(line);
      }
    });

    ws.addEventListener('close', () => {
      if (state.channel) {
        setStatus('error', 'DISCONNECTED');
        scheduleReconnect();
      } else {
        setStatus('closed', 'CLOSED');
      }
    });

    ws.addEventListener('error', () => {
      setStatus('error', 'CONNECTION ERROR');
    });
  }

  function closeSocket() {
    if (state.reconnectTimer) { clearTimeout(state.reconnectTimer); state.reconnectTimer = null; }
    if (state.socket) {
      try { state.socket.close(); } catch (_) {}
      state.socket = null;
    }
    stopDemoStream();
  }

  function scheduleReconnect() {
    if (state.reconnectTimer || !state.channel) return;
    state.reconnectTimer = setTimeout(() => {
      state.reconnectTimer = null;
      if (state.channel) connect(state.channel);
    }, RECONNECT_MS);
  }

  function handleLine(line) {
    const m = parseLine(line);
    if (m.cmd === 'PING') {
      try { state.socket.send('PONG :' + m.trailing); } catch (_) {}
      return;
    }
    if (m.cmd === '001') {
      // welcome — JOIN confirmation will follow
      return;
    }
    if (m.cmd === 'JOIN') {
      setStatus('live', 'LIVE');
      $('feed-empty').classList.remove('hidden');
      return;
    }
    if (m.cmd === 'PRIVMSG') {
      appendMessage({
        user: m.tags['display-name'] || (m.prefix.split('!')[0]),
        color: m.tags['color'] || '',
        body: m.trailing,
        action: false,
      });
      return;
    }
    if (m.cmd === 'CLEARCHAT' || m.cmd === 'CLEARMSG') {
      // moderation events — we ignore for simplicity
      return;
    }
    if (m.cmd === 'NOTICE') {
      // server notice (e.g. msg_room_not_found). Surface to status.
      const id = m.tags['msg-id'] || '';
      if (id === 'msg_channel_suspended' || id === 'no_such_channel') {
        setStatus('error', 'CHANNEL NOT FOUND');
        state.channel = null;
        closeSocket();
      }
      return;
    }
  }

  // ── Messages ──────────────────────────────────────────────
  function appendMessage(msg) {
    // ACTION (/me) is wrapped in ACTION ...
    if (msg.body && msg.body.charCodeAt(0) === 0x01) {
      msg.body = msg.body.replace(/^ACTION\s?/, '').replace(/$/, '');
      msg.action = true;
    }
    msg.mention = !!(state.channel && msg.body.toLowerCase().includes('@' + state.channel.toLowerCase()));

    state.messages.push(msg);
    if (state.messages.length > MAX_MESSAGES) state.messages.shift();
    renderFeed(true);
  }

  function renderFeed(appendOnly) {
    const ol = $('chat-feed');
    const empty = $('feed-empty');
    empty.classList.toggle('hidden', state.messages.length > 0);

    if (!appendOnly) {
      ol.innerHTML = '';
      state.messages.forEach((m) => ol.appendChild(buildMsgEl(m)));
    } else {
      // Append only the new last message + trim if we're over cap
      const drop = ol.children.length - state.messages.length + 1;
      for (let i = 0; i < drop; i++) ol.removeChild(ol.firstElementChild);
      const m = state.messages[state.messages.length - 1];
      if (m) ol.appendChild(buildMsgEl(m));
    }

    $('foot-count').textContent = state.messages.length + ' MSG' + (state.messages.length === 1 ? '' : 'S');

    if (!state.paused) scrollToBottom();
  }

  function buildMsgEl(m) {
    const li = document.createElement('li');
    li.className = 'msg' + (m.action ? ' is-action' : '') + (m.mention ? ' is-mention' : '');
    const user = document.createElement('div');
    user.className = 'msg-user';
    user.style.color = m.color || colorFor(m.user || '');
    user.textContent = m.user || 'anon';
    const body = document.createElement('div');
    body.className = 'msg-body';
    body.textContent = m.body || '';
    li.appendChild(user);
    li.appendChild(body);
    return li;
  }

  function scrollToBottom() {
    const ol = $('chat-feed');
    ol.scrollTop = ol.scrollHeight;
    updateOverflowState();
  }

  function updateOverflowState() {
    const ol = $('chat-feed');
    const wrap = ol.parentElement;
    wrap.classList.toggle('has-overflow', ol.scrollHeight > ol.clientHeight + 2);
  }

  function isAtBottom() {
    const ol = $('chat-feed');
    return ol.scrollHeight - ol.clientHeight - ol.scrollTop < 8;
  }

  // ── Size cycling ──────────────────────────────────────────
  function applySize() {
    const c = $('chat');
    c.classList.remove('size-1', 'size-2', 'size-3');
    c.classList.add('size-' + state.size);
    $('foot-size').textContent = 'SIZE ' + state.size + '/3';
    if (!state.paused) scrollToBottom();
  }
  function cycleSize() {
    state.size = state.size === 3 ? 1 : state.size + 1;
    saveSize(state.size);
    applySize();
  }

  // ── Pause / resume ────────────────────────────────────────
  function setPaused(p) {
    if (state.paused === p) return;
    state.paused = p;
    $('paused-pill').classList.toggle('hidden', !p);
  }

  function scrollBy(delta) {
    const ol = $('chat-feed');
    ol.scrollTop += delta;
    setPaused(!isAtBottom());
  }

  function resumeLive() {
    setPaused(false);
    scrollToBottom();
  }

  // ── Demo / screenshot mode ────────────────────────────────
  const DEMO_NAMES = [
    ['StreamerFan42',   ''],
    ['Pixelwhisker',    '#5CF28A'],
    ['NebulaNomad',     '#4DD8FF'],
    ['Caffeine_Engine', '#FFB84D'],
    ['LowKeyHype',      '#FF6FD8'],
    ['arcadewarlock',   ''],
    ['oat_milk_admin',  '#A371FF'],
    ['neon_taxi',       '#7A8CFF'],
    ['Gigatron-9000',   '#FF7F50'],
    ['quiet_observer',  ''],
  ];
  const DEMO_MESSAGES = [
    'first!',
    'POG that was insane',
    'KEKW',
    'cracked',
    'GG WP',
    'W stream',
    'L take honestly',
    'bro fell off',
    'one tap diff',
    'lemme cook',
    'real',
    'PauseChamp',
    'no shot',
    'how is your aim this clean today',
    'rotate to A site',
    'someone tell him about the buff in patch notes',
    'I missed the start, what happened?',
    'turn up the music a bit',
    'subbed for 6 months let’s gooo',
    'this stream is goated frfr',
    'try the new map',
    'streamer when??',
    'we love you alex',
    'lol the loadout',
    // Longer ones to exercise wrapping at all three sizes
    'wait wait wait — go back, that play was actually unreal, can you show the replay one more time please',
    'I have been watching since the very beginning and I am telling you this is the best stream of the year so far',
    'okay but who is going to tell the new viewers that the chat is on a 30 second delay',
  ];
  const DEMO_ACTIONS = [
    'tips a hat',
    'shakes head in disbelief',
    'leaves the room',
    'starts the slow clap',
  ];
  const DEMO_MENTIONS = [
    'hey @demo can you read this on stream',
    '@demo big fan, thanks for the content',
    '@demo what mouse are you using',
  ];

  // ── ariathome theme — busking / street music ──────────────
  const ARIA_NAMES = [
    ['sidewalk_sam',     ''],
    ['MelodyMaria',      '#FF6FD8'],
    ['busker_bea',       '#5CF28A'],
    ['corner_cassette',  '#FFB84D'],
    ['lo_fi_logan',      '#4DD8FF'],
    ['nightbus_nadia',   '#A371FF'],
    ['rainyday_reed',    ''],
    ['open_case_otis',   '#7A8CFF'],
    ['hummingbird_hana', '#FF7F50'],
    ['quiet_passerby',   ''],
  ];
  const ARIA_MESSAGES = [
    'this sounds SO good',
    'ari your voice is unreal',
    'best singer on twitch no cap',
    'that beat is absolutely fire 🔥',
    'how do you sing this good live??',
    'the beat ari is making goes so hard',
    'goosebumps, your voice is incredible',
    'this beat slaps so hard',
    'ari really is the whole band by herself',
    'the vocals are PERFECT',
    'such a clean beat omg',
    'you have the best voice i have ever heard',
    'this groove is insane, keep it going',
    'ari cooking up an actual hit right now',
    'the harmonies sound amazing',
    'that beat drop gave me chills',
    'singing AND making the beat?? talented',
    'turn it up this sounds too good',
    'ari is so so good at this',
    'flawless vocals as always',
    'the rhythm on this beat is perfect',
    'how is she this good live with no studio',
    'this is the best thing on twitch rn',
    'ari your sound is one of a kind',
    // longer ones to exercise wrapping at all three sizes
    'i cannot get over how good your voice sounds, this is genuinely better than anything on the radio right now',
    'the beat ari is building layer by layer is absolutely incredible, you can tell she is a real musician',
    'everyone needs to hear this — the singing is perfect and the beat she made from scratch is a certified banger',
  ];
  const ARIA_ACTIONS = [
    'is blown away by the vocals',
    'vibes hard to the beat',
    'replays that last note three times',
    'tells everyone ari is the best singer here',
  ];
  const ARIA_MENTIONS = [
    'hey @ariathome your voice sounds amazing today',
    '@ariathome that beat you made is a banger',
    '@ariathome best singer on the platform fr',
  ];

  // Each demo-backed channel maps to a themed content pool. The active
  // theme is chosen in connect(); pickDemo() reads from it.
  const THEMES = {
    demo: {
      names: DEMO_NAMES, messages: DEMO_MESSAGES,
      actions: DEMO_ACTIONS, mentions: DEMO_MENTIONS,
    },
    ariathome: {
      names: ARIA_NAMES, messages: ARIA_MESSAGES,
      actions: ARIA_ACTIONS, mentions: ARIA_MENTIONS,
    },
  };

  function activeTheme() {
    return state.theme || THEMES.demo;
  }

  function pickDemo() {
    const t = activeTheme();
    const u = t.names[Math.floor(Math.random() * t.names.length)];
    // 10% chance of a /me action, 8% of an @-mention, otherwise normal
    const r = Math.random();
    if (r < 0.10) {
      const a = t.actions[Math.floor(Math.random() * t.actions.length)];
      return { user: u[0], color: u[1], body: a, action: true };
    }
    if (r < 0.18) {
      const m = t.mentions[Math.floor(Math.random() * t.mentions.length)];
      return { user: u[0], color: u[1], body: m };
    }
    const body = t.messages[Math.floor(Math.random() * t.messages.length)];
    return { user: u[0], color: u[1], body };
  }

  function seedDemoMessages() {
    state.messages = [];
    for (let i = 0; i < 5; i++) appendMessage(pickDemo());
  }

  function startDemoStream() {
    stopDemoStream();
    const tick = () => {
      appendMessage(pickDemo());
      state.demoTimer = setTimeout(tick, 700 + Math.random() * 1800);
    };
    state.demoTimer = setTimeout(tick, 900);
  }
  function stopDemoStream() {
    if (state.demoTimer) { clearTimeout(state.demoTimer); state.demoTimer = null; }
  }

  // ── ?state=… URL routing (for headless-Chrome screenshots) ─
  // Each named state pre-seeds the UI and freezes it (no live stream)
  // so a screenshot captures a deterministic frame.
  function applyUrlState() {
    if (!urlState) return false;
    state.demoMode = true;
    state.size = loadSize();

    if (urlState === 'home') {
      buildChannelList();
      renderChannelList();
      showScreen('home');
      return true;
    }

    // Chat-screen states share a fixed message set so screenshots are stable.
    const FIXED = [
      { user: 'StreamerFan42',  color: '#FF6FD8', body: 'first!' },
      { user: 'NebulaNomad',    color: '#4DD8FF', body: 'POG that was insane' },
      { user: 'Caffeine_Engine',color: '#FFB84D', body: 'how is your aim this clean today' },
      { user: 'Pixelwhisker',   color: '#5CF28A', body: 'rotate to A site' },
      { user: 'oat_milk_admin', color: '#A371FF', body: 'subbed for 6 months let’s gooo' },
      { user: 'arcadewarlock',  color: '',        body: 'one tap diff' },
    ];

    state.channel = 'yourname';
    $('chat-channel').textContent = '#yourname';
    setStatus('live', 'LIVE · DEMO');
    state.messages = FIXED.slice();

    // For paused / mention states we want more scroll-back so the screenshot
    // shows what an actual session looks like with history.
    if (urlState === 'paused') {
      const extra = [
        { user: 'quiet_observer',color: '',        body: 'gg' },
        { user: 'neon_taxi',     color: '#7A8CFF', body: 'who is on rotation' },
        { user: 'LowKeyHype',    color: '#FF6FD8', body: 'biggest brain play this week' },
        { user: 'Gigatron-9000', color: '#FF7F50', body: 'turn up the music a bit' },
        { user: 'arcadewarlock', color: '',        body: 'lemme cook' },
        { user: 'Pixelwhisker',  color: '#5CF28A', body: 'W stream' },
      ];
      state.messages = state.messages.concat(extra);
    }

    renderFeed();
    showScreen('chat');

    if (urlState === 'chatting-small') { state.size = 1; }
    else if (urlState === 'chatting-big') { state.size = 3; }
    else { state.size = 2; }
    applySize();

    if (urlState === 'paused') {
      // Scroll back up so older messages show and the pause pill is meaningful.
      const ol = $('chat-feed');
      ol.scrollTop = 0;
      setPaused(true);
    } else if (urlState === 'mention') {
      state.messages.push({
        user: 'modface', color: '#FFB84D',
        body: 'hey @yourname check your DMs', mention: true,
      });
      renderFeed();
    }
    return true;
  }

  // ── Input handling ────────────────────────────────────────
  function onKey(e) {
    const k = e.key;

    if (state.screen === 'home') {
      if (k === 'ArrowUp')   { e.preventDefault(); moveFocus(-1); }
      else if (k === 'ArrowDown') { e.preventDefault(); moveFocus(+1); }
      else if (k === 'Enter' || k === ' ') {
        e.preventDefault();
        const c = state.list[state.focus];
        if (c) {
          // Demo-backed entries (DEMO, ariathome) flip into fake-feed
          // mode; any real channel forces it back off (unless the page
          // was loaded with ?demo=1 or ?state=… which lock demo mode on
          // for the session).
          if (!urlDemo) state.demoMode = !!c.demo;
          showScreen('chat');
          applySize();
          connect(c.name);
        }
      }
      return;
    }

    if (state.screen === 'chat') {
      if (k === 'ArrowUp')        { e.preventDefault(); scrollBy(-80); }
      else if (k === 'ArrowDown') { e.preventDefault(); scrollBy(+80); }
      else if (k === 'ArrowLeft') { e.preventDefault(); leaveChat(); }
      else if (k === 'ArrowRight'){ e.preventDefault(); cycleSize(); }
      else if (k === 'Enter' || k === ' ') { e.preventDefault(); resumeLive(); }
    }
  }

  function leaveChat() {
    state.channel = null;
    closeSocket();
    setPaused(false);
    showScreen('home');
    renderChannelList();
  }

  // Track auto-pause when the user scrolls via wheel/touch too.
  function attachFeedScrollWatcher() {
    const ol = $('chat-feed');
    ol.addEventListener('scroll', () => {
      // If we're at the bottom again, resume.
      if (isAtBottom() && state.paused) setPaused(false);
    });
  }

  // ── Utils ─────────────────────────────────────────────────
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  // ── Bootstrap ─────────────────────────────────────────────
  function init() {
    state.size = loadSize();
    state.demoMode = urlDemo;

    buildChannelList();
    renderChannelList();
    attachFeedScrollWatcher();
    applySize();

    window.addEventListener('keydown', onKey);

    if (applyUrlState()) return;

    // Auto-connect path: if a channel was passed in the URL, jump
    // straight to chat. Otherwise stay on the picker.
    if (urlChannel) {
      showScreen('chat');
      connect(urlChannel);
    } else {
      showScreen('home');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
