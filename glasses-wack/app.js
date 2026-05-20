(() => {
  const rows = Array.from(document.querySelectorAll('.row'));
  const counter = document.getElementById('counter');
  let focused = 0;

  const setFocus = (i) => {
    focused = (i + rows.length) % rows.length;
    rows.forEach((r, idx) => r.classList.toggle('focused', idx === focused));
    rows[focused].scrollIntoView({ block: 'nearest' });
    counter.textContent = `${String(focused + 1).padStart(2, '0')} / ${String(rows.length).padStart(2, '0')}`;
  };

  const setStatus = (row, state, text) => {
    const s = row.querySelector('.status');
    s.dataset.state = state;
    s.textContent = text || state;
  };

  const setData = (row, html) => {
    row.querySelector('.data').innerHTML = html;
  };

  const fmt = (obj) =>
    Object.entries(obj)
      .map(([k, v]) => `<span class="k">${k}</span> <span class="v">${v}</span>`)
      .join('  ');

  const showPreview = (row, on) => {
    const p = row.querySelector('.preview');
    if (p) p.classList.toggle('show', on);
  };

  // ─── 01 VIBRATE ──────────────────────────────────────────────────
  const vibRow = rows.find(r => r.dataset.id === 'vibrate');
  const runVibrate = () => {
    if (!('vibrate' in navigator)) {
      setStatus(vibRow, 'N/A');
      setData(vibRow, fmt({ support: 'navigator.vibrate missing' }));
      return;
    }
    const pattern = [100, 50, 100, 50, 200];
    const ok = navigator.vibrate(pattern);
    setStatus(vibRow, ok ? 'PASS' : 'FAIL');
    setData(vibRow, fmt({
      pattern: `[${pattern.join(',')}]`,
      total: `${pattern.reduce((a, b) => a + b, 0)}ms`,
      result: ok ? 'queued' : 'rejected'
    }));
  };
  const stopVibrate = () => { if ('vibrate' in navigator) navigator.vibrate(0); };

  // ─── 02 WEBGL2 ───────────────────────────────────────────────────
  const glRow = rows.find(r => r.dataset.id === 'webgl2');
  const glCv = document.getElementById('glcv');
  let glState = { raf: null, gl: null };

  const stopWebGL = () => {
    if (glState.raf) cancelAnimationFrame(glState.raf);
    glState.raf = null;
    if (glState.gl) {
      const ext = glState.gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
    }
    glState.gl = null;
    showPreview(glRow, false);
  };

  const runWebGL = () => {
    stopWebGL();
    const gl = glCv.getContext('webgl2', { antialias: true, alpha: false });
    if (!gl) {
      setStatus(glRow, 'N/A');
      setData(glRow, fmt({ support: 'webgl2 context unavailable' }));
      return;
    }
    glState.gl = gl;
    showPreview(glRow, true);
    setStatus(glRow, 'LIVE');

    const vs = `#version 300 es
      in vec3 a_pos;
      in vec3 a_col;
      uniform mat4 u_mvp;
      out vec3 v_col;
      void main() {
        gl_Position = u_mvp * vec4(a_pos, 1.0);
        v_col = a_col;
      }`;
    const fs = `#version 300 es
      precision highp float;
      in vec3 v_col;
      out vec4 outColor;
      void main() { outColor = vec4(v_col, 1.0); }`;

    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    let prog;
    try {
      const v = compile(gl.VERTEX_SHADER, vs);
      const f = compile(gl.FRAGMENT_SHADER, fs);
      prog = gl.createProgram();
      gl.attachShader(prog, v); gl.attachShader(prog, f); gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    } catch (err) {
      setStatus(glRow, 'FAIL');
      setData(glRow, fmt({ error: err.message.slice(0, 40) }));
      return;
    }

    // Cube positions + per-vertex colors
    const positions = new Float32Array([
      -1,-1, 1,  1,-1, 1,  1, 1, 1, -1, 1, 1,
      -1,-1,-1, -1, 1,-1,  1, 1,-1,  1,-1,-1,
      -1, 1,-1, -1, 1, 1,  1, 1, 1,  1, 1,-1,
      -1,-1,-1,  1,-1,-1,  1,-1, 1, -1,-1, 1,
       1,-1,-1,  1, 1,-1,  1, 1, 1,  1,-1, 1,
      -1,-1,-1, -1,-1, 1, -1, 1, 1, -1, 1,-1,
    ]);
    const colors = new Float32Array([
      1,0.2,0.4, 1,0.2,0.4, 1,0.2,0.4, 1,0.2,0.4,
      1,0.82,0.25, 1,0.82,0.25, 1,0.82,0.25, 1,0.82,0.25,
      0.31,0.63,1, 0.31,0.63,1, 0.31,0.63,1, 0.31,0.63,1,
      0.29,0.87,0.5, 0.29,0.87,0.5, 0.29,0.87,0.5, 0.29,0.87,0.5,
      1,0.4,0.7, 1,0.4,0.7, 1,0.4,0.7, 1,0.4,0.7,
      0.7,0.5,1, 0.7,0.5,1, 0.7,0.5,1, 0.7,0.5,1,
    ]);
    const idx = new Uint16Array([
       0, 1, 2,  0, 2, 3,    4, 5, 6,  4, 6, 7,
       8, 9,10,  8,10,11,   12,13,14, 12,14,15,
      16,17,18, 16,18,19,   20,21,22, 20,22,23,
    ]);

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    const buf = (data, loc, size) => {
      const b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    };
    buf(positions, gl.getAttribLocation(prog, 'a_pos'), 3);
    buf(colors,    gl.getAttribLocation(prog, 'a_col'), 3);

    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);

    gl.useProgram(prog);
    const uMVP = gl.getUniformLocation(prog, 'u_mvp');
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);

    const aspect = glCv.width / glCv.height;
    const proj = (() => {
      const f = 1 / Math.tan(Math.PI / 6);
      const near = 0.1, far = 50;
      return [
        f / aspect, 0, 0, 0,
        0, f, 0, 0,
        0, 0, (far + near) / (near - far), -1,
        0, 0, (2 * far * near) / (near - far), 0,
      ];
    })();
    const mul = (a, b) => {
      const r = new Array(16).fill(0);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++)
        for (let k = 0; k < 4; k++) r[i * 4 + j] += a[i * 4 + k] * b[k * 4 + j];
      return r;
    };

    let info = null;
    try {
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      info = {
        vendor: dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
        renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
        glsl: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
      };
    } catch {}

    const t0 = performance.now();
    let frames = 0;
    const draw = () => {
      const t = (performance.now() - t0) / 1000;
      frames++;
      gl.viewport(0, 0, glCv.width, glCv.height);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      const cx = Math.cos(t * 0.9), sx = Math.sin(t * 0.9);
      const cy = Math.cos(t * 1.3), sy = Math.sin(t * 1.3);
      const rotY = [cy,0,sy,0, 0,1,0,0, -sy,0,cy,0, 0,0,0,1];
      const rotX = [1,0,0,0, 0,cx,-sx,0, 0,sx,cx,0, 0,0,0,1];
      const trans = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,-5,1];
      const mvp = mul(mul(trans, mul(rotX, rotY)), proj);
      gl.uniformMatrix4fv(uMVP, false, new Float32Array(mvp));
      gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_SHORT, 0);

      if (frames === 30 && info) {
        setData(glRow, fmt({
          renderer: (info.renderer || 'unknown').toString().slice(0, 32),
          fps: `~${Math.round(frames / ((performance.now() - t0) / 1000))}`,
        }));
      }
      glState.raf = requestAnimationFrame(draw);
    };
    draw();
    setData(glRow, fmt({ context: 'webgl2', tris: '12' }));
  };

  // ─── 03 CANVAS 2D ────────────────────────────────────────────────
  const c2dRow = rows.find(r => r.dataset.id === 'canvas2d');
  const c2dCv = document.getElementById('c2dcv');
  let c2dState = { raf: null };

  const stopCanvas2D = () => {
    if (c2dState.raf) cancelAnimationFrame(c2dState.raf);
    c2dState.raf = null;
    showPreview(c2dRow, false);
  };

  const runCanvas2D = () => {
    stopCanvas2D();
    const ctx = c2dCv.getContext('2d');
    if (!ctx) {
      setStatus(c2dRow, 'N/A');
      setData(c2dRow, fmt({ support: '2d context unavailable' }));
      return;
    }
    showPreview(c2dRow, true);
    setStatus(c2dRow, 'LIVE');

    const W = c2dCv.width, H = c2dCv.height;
    const particles = Array.from({ length: 36 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.6, vy: (Math.random() - 0.5) * 0.6,
      r: 0.8 + Math.random() * 1.6,
    }));
    const t0 = performance.now();
    let frames = 0;

    const draw = () => {
      const t = (performance.now() - t0) / 1000;
      frames++;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(0, 0, W, H);

      // Lissajous curve
      ctx.strokeStyle = '#ff3366';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let i = 0; i <= 240; i++) {
        const u = (i / 240) * Math.PI * 2;
        const x = W / 2 + Math.sin(u * 3 + t) * (W / 2 - 6);
        const y = H / 2 + Math.sin(u * 2 + t * 1.2) * (H / 2 - 6);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Particle field
      for (const p of particles) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > W) p.vx *= -1;
        if (p.y < 0 || p.y > H) p.vy *= -1;
        ctx.fillStyle = '#ffd23f';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      if (frames === 30) {
        setData(c2dRow, fmt({
          dpr: window.devicePixelRatio.toFixed(2),
          fps: `~${Math.round(frames / ((performance.now() - t0) / 1000))}`,
        }));
      }
      c2dState.raf = requestAnimationFrame(draw);
    };
    draw();
    setData(c2dRow, fmt({ size: `${W}×${H}`, particles: particles.length }));
  };

  // ─── 04 WEBNFC ───────────────────────────────────────────────────
  const nfcRow = rows.find(r => r.dataset.id === 'webnfc');
  let nfcState = { ctrl: null };

  const stopNFC = () => {
    if (nfcState.ctrl) { try { nfcState.ctrl.abort(); } catch {} }
    nfcState.ctrl = null;
  };

  const runNFC = async () => {
    stopNFC();
    if (!('NDEFReader' in window)) {
      setStatus(nfcRow, 'N/A');
      setData(nfcRow, fmt({ support: 'NDEFReader missing' }));
      return;
    }
    setStatus(nfcRow, 'RUN', 'SCANNING');
    setData(nfcRow, fmt({ scanning: '5s...' }));
    try {
      const reader = new NDEFReader();
      const ctrl = new AbortController();
      nfcState.ctrl = ctrl;
      let got = false;
      reader.onreading = (e) => {
        got = true;
        const recs = e.message.records || [];
        const first = recs[0];
        let payload = '';
        try {
          if (first) {
            const decoder = new TextDecoder(first.encoding || 'utf-8');
            payload = decoder.decode(first.data).slice(0, 40);
          }
        } catch {}
        setStatus(nfcRow, 'PASS');
        setData(nfcRow, fmt({
          serial: (e.serialNumber || 'n/a').slice(0, 20),
          records: recs.length,
          first: payload || '—'
        }));
        ctrl.abort();
      };
      reader.onreadingerror = () => {
        setStatus(nfcRow, 'FAIL');
        setData(nfcRow, fmt({ error: 'reading error' }));
      };
      await reader.scan({ signal: ctrl.signal });
      setTimeout(() => {
        if (!got) {
          ctrl.abort();
          setStatus(nfcRow, 'FAIL');
          setData(nfcRow, fmt({ result: 'no tag in 5s' }));
        }
      }, 5000);
    } catch (err) {
      setStatus(nfcRow, 'FAIL');
      setData(nfcRow, fmt({ error: err.name || 'Error', msg: (err.message || '').slice(0, 32) }));
    }
  };

  // ─── 05 BATTERY ──────────────────────────────────────────────────
  const batRow = rows.find(r => r.dataset.id === 'battery');
  const batFill = document.getElementById('batfill');
  let batState = { battery: null, listeners: [] };

  const renderBattery = (b) => {
    const pct = Math.round((b.level || 0) * 100);
    batFill.style.right = `${100 - pct}%`;
    showPreview(batRow, true);
    setData(batRow, fmt({
      level: `${pct}%`,
      charging: b.charging ? 'yes' : 'no',
      tFull: b.chargingTime === Infinity ? '∞' : `${Math.round(b.chargingTime / 60)}m`,
      tEmpty: b.dischargingTime === Infinity ? '∞' : `${Math.round(b.dischargingTime / 60)}m`,
    }));
  };

  const stopBattery = () => {
    if (batState.battery) {
      for (const [ev, fn] of batState.listeners) batState.battery.removeEventListener(ev, fn);
    }
    batState = { battery: null, listeners: [] };
    showPreview(batRow, false);
    batFill.style.right = '100%';
  };

  const runBattery = async () => {
    stopBattery();
    if (!navigator.getBattery) {
      setStatus(batRow, 'N/A');
      setData(batRow, fmt({ support: 'getBattery missing' }));
      return;
    }
    setStatus(batRow, 'RUN');
    try {
      const b = await navigator.getBattery();
      batState.battery = b;
      const update = () => renderBattery(b);
      for (const ev of ['levelchange', 'chargingchange', 'chargingtimechange', 'dischargingtimechange']) {
        b.addEventListener(ev, update);
        batState.listeners.push([ev, update]);
      }
      setStatus(batRow, 'LIVE');
      update();
    } catch (err) {
      setStatus(batRow, 'FAIL');
      setData(batRow, fmt({ error: err.message || String(err) }));
    }
  };

  // ─── 06 WAKE LOCK ────────────────────────────────────────────────
  const wlRow = rows.find(r => r.dataset.id === 'wakelock');
  let wlState = { sentinel: null };

  const stopWakeLock = async () => {
    if (wlState.sentinel) {
      try { await wlState.sentinel.release(); } catch {}
    }
    wlState.sentinel = null;
  };

  const runWakeLock = async () => {
    if (!('wakeLock' in navigator)) {
      setStatus(wlRow, 'N/A');
      setData(wlRow, fmt({ support: 'wakeLock missing' }));
      return;
    }
    if (wlState.sentinel) {
      await stopWakeLock();
      setStatus(wlRow, 'IDLE');
      setData(wlRow, fmt({ state: 'released' }));
      return;
    }
    setStatus(wlRow, 'RUN');
    try {
      const s = await navigator.wakeLock.request('screen');
      wlState.sentinel = s;
      s.addEventListener('release', () => {
        if (wlState.sentinel === s) {
          wlState.sentinel = null;
          setStatus(wlRow, 'IDLE');
          setData(wlRow, fmt({ state: 'released externally' }));
        }
      });
      setStatus(wlRow, 'LIVE');
      setData(wlRow, fmt({ type: 'screen', state: 'held' }));
    } catch (err) {
      setStatus(wlRow, 'FAIL');
      setData(wlRow, fmt({ error: err.name || 'Error', msg: (err.message || '').slice(0, 28) }));
    }
  };

  // ─── 07 NETWORK ──────────────────────────────────────────────────
  const netRow = rows.find(r => r.dataset.id === 'network');
  const runNetwork = () => {
    const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!c) {
      setStatus(netRow, 'N/A');
      setData(netRow, fmt({ online: navigator.onLine ? 'yes' : 'no', api: 'no NetworkInformation' }));
      return;
    }
    setStatus(netRow, 'PASS');
    setData(netRow, fmt({
      type: c.effectiveType || 'unknown',
      down: c.downlink != null ? `${c.downlink} Mbps` : 'n/a',
      rtt: c.rtt != null ? `${c.rtt}ms` : 'n/a',
      saveData: c.saveData ? 'on' : 'off',
    }));
  };

  // ─── 08 SPEAK ────────────────────────────────────────────────────
  const spkRow = rows.find(r => r.dataset.id === 'speak');
  const stopSpeak = () => { if (window.speechSynthesis) speechSynthesis.cancel(); };

  const runSpeak = () => {
    if (!('speechSynthesis' in window)) {
      setStatus(spkRow, 'N/A');
      setData(spkRow, fmt({ support: 'speechSynthesis missing' }));
      return;
    }
    stopSpeak();
    setStatus(spkRow, 'RUN');
    const u = new SpeechSynthesisUtterance('Hello from the lens.');
    u.rate = 1.0; u.pitch = 1.0;
    u.onend = () => { setStatus(spkRow, 'PASS'); };
    u.onerror = (e) => {
      setStatus(spkRow, 'FAIL');
      setData(spkRow, fmt({ error: e.error || 'speech error' }));
    };
    const voices = speechSynthesis.getVoices();
    setData(spkRow, fmt({ voices: voices.length, default: (voices.find(v => v.default)?.name || 'none').slice(0, 18) }));
    speechSynthesis.speak(u);
  };

  // ─── 09 GAMEPAD ──────────────────────────────────────────────────
  const gpRow = rows.find(r => r.dataset.id === 'gamepad');
  let gpState = { raf: null };

  const stopGamepad = () => {
    if (gpState.raf) cancelAnimationFrame(gpState.raf);
    gpState.raf = null;
  };

  const runGamepad = () => {
    stopGamepad();
    if (!navigator.getGamepads) {
      setStatus(gpRow, 'N/A');
      setData(gpRow, fmt({ support: 'getGamepads missing' }));
      return;
    }
    setStatus(gpRow, 'LIVE');
    const t0 = performance.now();
    const tick = () => {
      const pads = Array.from(navigator.getGamepads()).filter(Boolean);
      if (pads.length) {
        const p = pads[0];
        setStatus(gpRow, 'PASS');
        setData(gpRow, fmt({
          id: (p.id || 'pad').slice(0, 20),
          axes: p.axes.length,
          btns: p.buttons.length,
        }));
        return;
      }
      if (performance.now() - t0 > 5000) {
        setStatus(gpRow, 'FAIL');
        setData(gpRow, fmt({ result: 'none connected' }));
        return;
      }
      gpState.raf = requestAnimationFrame(tick);
    };
    setData(gpRow, fmt({ polling: '5s' }));
    tick();
  };

  // ─── 10 STORAGE ──────────────────────────────────────────────────
  const stRow = rows.find(r => r.dataset.id === 'storage');
  const runStorage = async () => {
    if (!navigator.storage || !navigator.storage.estimate) {
      setStatus(stRow, 'N/A');
      setData(stRow, fmt({ support: 'StorageManager missing' }));
      return;
    }
    setStatus(stRow, 'RUN');
    try {
      const est = await navigator.storage.estimate();
      const persisted = navigator.storage.persisted ? await navigator.storage.persisted() : false;
      const fmtB = (n) => {
        if (n == null) return 'n/a';
        if (n > 1e9) return `${(n / 1e9).toFixed(2)} GB`;
        if (n > 1e6) return `${(n / 1e6).toFixed(1)} MB`;
        if (n > 1e3) return `${(n / 1e3).toFixed(1)} KB`;
        return `${n} B`;
      };
      setStatus(stRow, 'PASS');
      setData(stRow, fmt({
        used: fmtB(est.usage),
        quota: fmtB(est.quota),
        persisted: persisted ? 'yes' : 'no',
      }));
    } catch (err) {
      setStatus(stRow, 'FAIL');
      setData(stRow, fmt({ error: err.message || String(err) }));
    }
  };

  // ─── 11 SHARE ────────────────────────────────────────────────────
  const shRow = rows.find(r => r.dataset.id === 'share');
  const runShare = () => {
    if (!navigator.share) {
      setStatus(shRow, 'N/A');
      setData(shRow, fmt({ support: 'navigator.share missing' }));
      return;
    }
    const data = { title: 'Glasses Wack', text: 'API test sheet', url: location.href };
    const canShare = navigator.canShare ? navigator.canShare(data) : true;
    setStatus(shRow, canShare ? 'PASS' : 'FAIL');
    setData(shRow, fmt({
      api: 'present',
      canShare: canShare ? 'yes' : 'no',
      files: navigator.canShare && navigator.canShare({ files: [] }) ? 'yes' : 'no',
    }));
  };

  // ─── 12 HARDWARE ─────────────────────────────────────────────────
  const hwRow = rows.find(r => r.dataset.id === 'hwconc');
  const runHW = () => {
    setStatus(hwRow, 'PASS');
    setData(hwRow, fmt({
      cores: navigator.hardwareConcurrency || 'n/a',
      mem: navigator.deviceMemory ? `${navigator.deviceMemory}GB` : 'n/a',
      dpr: window.devicePixelRatio.toFixed(2),
      touch: ('ontouchstart' in window) ? 'yes' : 'no',
    }));
  };

  // ─── DISPATCH ────────────────────────────────────────────────────
  const runners = {
    vibrate: runVibrate, webgl2: runWebGL, canvas2d: runCanvas2D, webnfc: runNFC,
    battery: runBattery, wakelock: runWakeLock, network: runNetwork, speak: runSpeak,
    gamepad: runGamepad, storage: runStorage, share: runShare, hwconc: runHW,
  };
  const stoppers = {
    vibrate: stopVibrate, webgl2: stopWebGL, canvas2d: stopCanvas2D, webnfc: stopNFC,
    battery: stopBattery, wakelock: stopWakeLock, speak: stopSpeak, gamepad: stopGamepad,
  };

  const stopCurrent = () => {
    const id = rows[focused].dataset.id;
    if (stoppers[id]) {
      stoppers[id]();
      setStatus(rows[focused], 'IDLE');
      setData(rows[focused], fmt({ state: 'stopped' }));
    }
  };

  const runAll = async () => {
    for (const r of rows) {
      const id = r.dataset.id;
      if (runners[id]) {
        try { await runners[id](); } catch {}
        await new Promise(res => setTimeout(res, 250));
      }
    }
  };

  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setFocus(focused + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setFocus(focused - 1); }
    else if (e.key === 'ArrowRight') {
      e.preventDefault();
      const id = rows[focused].dataset.id;
      runners[id] && runners[id]();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      stopCurrent();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      runAll();
    }
  });

  setFocus(0);

  // Prime SpeechSynthesis voices (Chromium loads asynchronously)
  if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => {};
  }
})();
