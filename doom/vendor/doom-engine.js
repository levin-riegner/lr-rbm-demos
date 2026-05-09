(function () {
  'use strict';

  const JSDOS_JS = 'https://v8.js-dos.com/latest/js-dos.js';
  const JSDOS_CSS = 'https://v8.js-dos.com/latest/js-dos.css';
  const BUNDLE_URLS = ['./assets/doom.jsdos', './assets/doom.zip'];
  const READY_TIMEOUT_MS = 30000;

  let scriptLoaded = false;
  let cssLoaded = false;

  function loadScript(url) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = url;
      s.async = true;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Failed to load ' + url));
      document.head.appendChild(s);
    });
  }

  function loadCss(url) {
    return new Promise((resolve) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = url;
      link.onload = resolve;
      link.onerror = resolve;
      document.head.appendChild(link);
    });
  }

  async function findBundle() {
    for (const url of BUNDLE_URLS) {
      try {
        const r = await fetch(url, { method: 'HEAD' });
        if (r.ok) return url;
      } catch (_) {}
    }
    return null;
  }

  window.startDoom = async function startDoom(opts) {
    const container = opts && opts.container;
    if (!container) throw new Error('startDoom: container missing.');

    if (!cssLoaded) { await loadCss(JSDOS_CSS); cssLoaded = true; }
    if (!scriptLoaded) { await loadScript(JSDOS_JS); scriptLoaded = true; }

    const bundleUrl = await findBundle();
    if (!bundleUrl) {
      throw new Error('No DOOM bundle found at ./assets/doom.jsdos or ./assets/doom.zip. See README.');
    }

    if (typeof window.Dos !== 'function') {
      throw new Error('js-dos loaded but window.Dos is not a function.');
    }

    return new Promise((resolve, reject) => {
      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) reject(new Error('js-dos did not initialise within ' + (READY_TIMEOUT_MS / 1000) + 's.'));
      }, READY_TIMEOUT_MS);

      const props = {
        url: bundleUrl,
        theme: 'dark',
        autoStart: true,
        noCloud: true,
        noNetworking: true,
        backend: 'dosboxX',
        backendLocked: true,
        mouseCapture: false,
        mobileControls: false,
        noMobileControls: true,
        softKeyboardLayout: [],
        softKeyboardSymbols: [],
        kiosk: true,
        noTopBar: true,
        noSidebar: true,
        onEvent: function (event, arg) {
          if (event === 'ci-ready' || event === 'emu-ready' || event === 'BackendReady') {
            if (resolved) return;
            resolved = true;
            clearTimeout(timeout);
            resolve(arg || null);
          }
        },
      };

      try {
        window.Dos(container, props);
      } catch (e) {
        clearTimeout(timeout);
        reject(new Error('Dos() threw: ' + (e && e.message ? e.message : String(e))));
      }
    });
  };
})();
