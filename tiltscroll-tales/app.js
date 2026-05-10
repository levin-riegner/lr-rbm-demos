(() => {
  'use strict';

  // ─── DOM ────────────────────────────────────────────────────────
  const book = document.getElementById('book');
  const railThumb = document.getElementById('rail-thumb');
  const railReadout = document.getElementById('rail-readout');
  const status = document.getElementById('status');
  const pageNumEl = document.getElementById('page-num');
  const pageTotalEl = document.getElementById('page-total');
  const pages = Array.from(document.querySelectorAll('.page'));
  const startOverlay = document.getElementById('start-overlay');
  const startBtn = document.getElementById('start-btn');
  const sizePill = document.getElementById('size-pill');
  const sizeNum = document.getElementById('size-num');

  pageTotalEl.textContent = String(pages.length);

  // ─── Text size ─────────────────────────────────────────────────
  // 5 levels: 0..4. Index 2 = 1.0x. Each step = +20%.
  const SIZE_LEVELS = [0.8, 0.92, 1.0, 1.18, 1.4, 1.65];
  const SIZE_KEY = 'tiltscroll_size';
  let sizeIdx = clampInt(parseInt(localStorage.getItem(SIZE_KEY) ?? '3', 10), 0, SIZE_LEVELS.length - 1);
  applySize();
  function applySize() {
    document.documentElement.style.setProperty('--text-scale', String(SIZE_LEVELS[sizeIdx]));
    sizeNum.textContent = String(sizeIdx + 1);
    localStorage.setItem(SIZE_KEY, String(sizeIdx));
  }
  function flashSize() {
    sizePill.classList.add('flash');
    clearTimeout(flashSize._t);
    flashSize._t = setTimeout(() => sizePill.classList.remove('flash'), 500);
  }
  function clampInt(n, lo, hi) {
    if (Number.isNaN(n)) return lo;
    return Math.max(lo, Math.min(hi, n));
  }

  // ─── Tilt state ────────────────────────────────────────────────
  // beta: device front-back tilt in degrees (0..180, neutral ~90 when worn).
  // Calibrate: first reading after BEGIN becomes neutral. Then (beta - neutral)
  // is mapped over [-RANGE, +RANGE] to scroll fraction [0, 1] — INVERTED:
  //   head UP   (beta decreases) → fraction → 1 (bottom of page)
  //   head DOWN (beta increases) → fraction → 0 (top of page)
  const RANGE_DEG = 22;   // ±22° from neutral spans full scroll
  const SMOOTH = 0.18;    // EMA factor (higher = snappier, lower = calmer)

  let neutralBeta = null;
  let targetFrac = 0;      // 0..1 from sensor
  let smoothedFrac = 0;    // 0..1 smoothed
  let lastBeta = null;
  let tiltActive = false;
  let armedTimer = null;

  // Keyboard fallback: arrow keys nudge an internal frac instead of tilt.
  let kbFrac = null; // when non-null, kb takes over

  // ─── Sensor permission flow ────────────────────────────────────
  const needsIosPerm =
    typeof DeviceOrientationEvent !== 'undefined' &&
    typeof DeviceOrientationEvent.requestPermission === 'function';

  const attachOrientation = () => {
    window.addEventListener('deviceorientation', onOrientation, { passive: true });
    status.textContent = 'CALIBRATING…';
  };

  const requestSensor = async () => {
    if (!needsIosPerm) {
      attachOrientation();
      startOverlay.classList.add('hidden');
      return;
    }
    try {
      const r = await DeviceOrientationEvent.requestPermission();
      if (r === 'granted') {
        attachOrientation();
        if (typeof DeviceMotionEvent !== 'undefined' &&
            typeof DeviceMotionEvent.requestPermission === 'function') {
          DeviceMotionEvent.requestPermission().catch(() => {});
        }
        startOverlay.classList.add('hidden');
      } else {
        status.textContent = 'SENSOR DENIED · KEYS ONLY';
        startOverlay.classList.add('hidden');
      }
    } catch (e) {
      status.textContent = 'SENSOR ERR · KEYS ONLY';
      startOverlay.classList.add('hidden');
    }
  };

  // Show start overlay only if iOS-style permission gate is required.
  if (needsIosPerm) {
    startOverlay.classList.remove('hidden');
    startBtn.addEventListener('click', requestSensor);
  } else {
    attachOrientation();
  }

  function onOrientation(e) {
    const beta = e.beta;
    if (beta == null || Number.isNaN(beta)) return;
    lastBeta = beta;
    if (neutralBeta == null) {
      neutralBeta = beta;
      status.textContent = `NEUTRAL ${beta.toFixed(1)}°`;
    }
    const off = beta - neutralBeta;
    // Flipped mapping: head DOWN (beta increases) → frac → 0 (top of page).
    //                  head UP   (beta decreases) → frac → 1 (bottom).
    let f = (RANGE_DEG - off) / (RANGE_DEG * 2);
    if (f < 0) f = 0; else if (f > 1) f = 1;
    targetFrac = f;
    tiltActive = true;
    kbFrac = null; // sensor takes back over once it ticks
  }

  // ─── Recalibrate (C key, or after page change) ────────────────
  const recalibrate = () => {
    if (lastBeta != null) {
      neutralBeta = lastBeta;
      status.textContent = `RECAL ${lastBeta.toFixed(1)}°`;
      flashStatus();
    } else {
      neutralBeta = null;
      status.textContent = 'CALIBRATING…';
    }
  };

  let flashTimer = null;
  function flashStatus() {
    status.style.color = '#fff';
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => { status.style.color = ''; }, 600);
  }

  // ─── RAF loop ──────────────────────────────────────────────────
  const animate = () => {
    const desired = (kbFrac != null) ? kbFrac : targetFrac;
    smoothedFrac += (desired - smoothedFrac) * SMOOTH;

    const activePage = pages.find(p => p.classList.contains('active'));
    if (activePage) {
      const max = book.scrollHeight - book.clientHeight;
      if (max > 0) {
        // Always reflect frac → scroll, even on initial frame; if neither
        // sensor nor key has fired, smoothedFrac stays 0 → top of page.
        book.scrollTop = smoothedFrac * max;
      }

      // Arm the next-button when reader is near the bottom
      const nextBtn = activePage.querySelector('.next-btn');
      if (nextBtn) {
        const armed = smoothedFrac > 0.92;
        nextBtn.classList.toggle('armed', armed);
        if (armed && document.activeElement !== nextBtn) {
          // give it focus so Enter advances
          nextBtn.focus({ preventScroll: true });
        }
      }
    }

    // HUD
    const pct = Math.round(smoothedFrac * 100);
    railThumb.style.top = `${pct}%`;
    railReadout.textContent = String(pct).padStart(3, '0');

    // Live status while tilting
    if (tiltActive && lastBeta != null && neutralBeta != null) {
      const off = (lastBeta - neutralBeta).toFixed(1);
      if (!flashTimer) status.textContent = `Δ ${off}°`;
    }

    requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);

  // ─── Page navigation ───────────────────────────────────────────
  const goToPage = (i) => {
    if (i < 0 || i >= pages.length) return;
    pages.forEach((p, idx) => p.classList.toggle('active', idx === i));
    pageNumEl.textContent = String(i + 1);
    // Reset scroll position to top of new page
    smoothedFrac = 0;
    targetFrac = 0;
    kbFrac = 0;            // hold at top until sensor next fires
    book.scrollTop = 0;
    // Recalibrate so user must tilt down again from here
    if (lastBeta != null) neutralBeta = lastBeta;
  };

  const restart = () => goToPage(0);

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const idx = pages.findIndex(p => p.classList.contains('active'));
    if (action === 'next') goToPage(idx + 1);
    else if (action === 'restart') restart();
  });

  // ─── Keyboard ──────────────────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      // If end-overlay or button is armed, advance. Otherwise treat as click on focused.
      const active = document.activeElement;
      const idx = pages.findIndex(p => p.classList.contains('active'));
      const btn = pages[idx]?.querySelector('.next-btn');
      if (btn && (btn === active || btn.classList.contains('armed'))) {
        e.preventDefault();
        if (btn.dataset.action === 'restart') restart();
        else goToPage(idx + 1);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      kbFrac = Math.min(1, (kbFrac ?? smoothedFrac) + 0.08);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      kbFrac = Math.max(0, (kbFrac ?? smoothedFrac) - 0.08);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (sizeIdx < SIZE_LEVELS.length - 1) { sizeIdx++; applySize(); flashSize(); }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (sizeIdx > 0) { sizeIdx--; applySize(); flashSize(); }
    } else if (e.key === 'c' || e.key === 'C') {
      recalibrate();
    } else if (e.key === 'Escape') {
      kbFrac = 0;
    }
  });

  // ─── Mouse fallback for desktop testing ────────────────────────
  // Drag vertically anywhere on the book to scroll, like tilt.
  let dragStartY = null;
  let dragStartFrac = 0;
  book.addEventListener('mousedown', (e) => {
    dragStartY = e.clientY;
    dragStartFrac = smoothedFrac;
  });
  window.addEventListener('mousemove', (e) => {
    if (dragStartY == null) return;
    const dy = e.clientY - dragStartY;
    const max = book.scrollHeight - book.clientHeight;
    if (max <= 0) return;
    const dFrac = dy / max;
    kbFrac = Math.max(0, Math.min(1, dragStartFrac + dFrac));
  });
  window.addEventListener('mouseup', () => { dragStartY = null; });

  // Wheel falls through to native scroll: also keep state in sync
  book.addEventListener('scroll', () => {
    // If user wheels manually, sync our frac so HUD tracks
    const max = book.scrollHeight - book.clientHeight;
    if (max <= 0) return;
    const f = book.scrollTop / max;
    // Only adopt wheel when neither tilt nor kb is currently driving
    if (!tiltActive && kbFrac == null) {
      smoothedFrac = f;
      targetFrac = f;
    }
  });

})();
