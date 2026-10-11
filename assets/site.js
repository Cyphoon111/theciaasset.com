/* theciaasset.com interactions (2026-10-10). No dependencies. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ---------- a refresh (or Back) opens at the very top: no restored scroll, no leftover #section from the menu ---------- */
  const navEntry = performance.getEntriesByType ? performance.getEntriesByType('navigation')[0] : null;
  const fresh = !navEntry || navEntry.type === 'navigate';
  const toTop = () => { const h = document.documentElement, s = h.style.scrollBehavior; h.style.scrollBehavior = 'auto'; scrollTo(0, 0); h.style.scrollBehavior = s; };
  if (!fresh) {
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    toTop();
    // a browser may still restore late; undo it once loading ends unless the reader has already started scrolling
    let moved = false;
    ['touchstart', 'wheel', 'keydown', 'pointerdown'].forEach((ev) => addEventListener(ev, () => { moved = true; }, { once: true, passive: true }));
    addEventListener('load', () => { if (!moved) toTop(); }, { once: true });
  }
  addEventListener('pageshow', (e) => { if (e.persisted) toTop(); });

  /* ---------- toast ---------- */
  const toastEl = $('#toast');
  let toastT;
  const toast = (msg) => { if (!toastEl) return; toastEl.textContent = msg; toastEl.classList.add('is-on'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('is-on'), 3600); };

  /* ---------- nav ---------- */
  const nav = $('.nav');
  const onScroll = () => nav && nav.classList.toggle('is-scrolled', scrollY > 8);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  const menu = $('#navMenu'), links = $('#navLinks');
  if (menu && links) {
    menu.addEventListener('click', () => { const open = links.classList.toggle('is-open'); menu.setAttribute('aria-expanded', String(open)); menu.setAttribute('aria-label', open ? 'Close menu' : 'Open menu'); });
    links.addEventListener('click', (e) => { if (e.target.closest('a')) { links.classList.remove('is-open'); menu.setAttribute('aria-expanded', 'false'); } });
  }
  const navMap = new Map($$('.nav__links a').map((a) => [a.getAttribute('href').slice(1), a]));
  const secObs = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { navMap.forEach((a) => a.classList.remove('is-active')); const a = navMap.get(e.target.id); if (a) a.classList.add('is-active'); } }), { rootMargin: '-45% 0px -50% 0px' });
  navMap.forEach((_, id) => { const s = document.getElementById(id); if (s) secObs.observe(s); });

  /* ---------- reveal on scroll ---------- */
  const revObs = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); revObs.unobserve(e.target); } }), { threshold: 0.14, rootMargin: '0px 0px -6% 0px' });
  $$('.reveal').forEach((el) => revObs.observe(el));

  /* ---------- 3D book tilt ---------- */
  const bookWrap = $('.hero__book'), book = $('#book3d');
  if (book && bookWrap && fine && !reduce) {
    let raf = 0;
    bookWrap.addEventListener('pointermove', (e) => {
      const b = bookWrap.getBoundingClientRect();
      const dx = (e.clientX - b.left) / b.width - 0.5, dy = (e.clientY - b.top) / b.height - 0.5;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => { book.style.setProperty('--ry', `${(12 - dx * 26).toFixed(2)}deg`); book.style.setProperty('--rx', `${(3 - dy * 10).toFixed(2)}deg`); });
    });
    bookWrap.addEventListener('pointerleave', () => { book.style.removeProperty('--ry'); book.style.removeProperty('--rx'); });
  }

  /* ---------- stamp: lands right after the lens takes its first burst ---------- */
  const stamp = $('#stamp'), stage = $('.hero__stage');
  let stamped = false;
  const stampIn = () => { if (stamped || !stamp || reduce) return; stamped = true; stamp.classList.add('is-in'); setTimeout(() => stage && stage.classList.add('is-thud'), 170); };

  /* ---------- lens: the viewfinder floats over the photo, zeroes in on the author's face and fires a three-frame burst ---------- */
  const lens = $('#lens');
  if (lens) {
    const frame = $('#lensFrame'), ticks = $('#scopeTicks'), flashEl = $('#lensFlash');
    const irisG = $('#scopeIris'), irisDark = $('#irisDark'), irisSeams = $('#irisSeams');
    const tcEl = $('#hudTc'), distEl = $('#hudDist'), statusEl = $('#hudStatus'), needle = $('#hudNeedle');
    const shotEls = $$('#hudShots i'), sndBtn = $('#lensSnd'), idTyped = $('#idTyped'), idRest = $('#idRest');
    const FX = parseFloat(lens.dataset.fx) / 100, FY = parseFloat(lens.dataset.fy) / 100, FR = parseFloat(lens.dataset.fr) || 0.17;
    const NAME = (idTyped && idRest) ? idTyped.textContent + idRest.textContent : '';
    const NS = 'http://www.w3.org/2000/svg';
    const text = (el, s) => { if (el && el.textContent !== s) el.textContent = s; };
    for (let i = 0; i < 72; i++) {
      const a = (i * 5 * Math.PI) / 180, big = i % 6 === 0, r1 = 104, r2 = big ? 113 : 109;
      const l = document.createElementNS(NS, 'line');
      l.setAttribute('x1', (120 + r1 * Math.sin(a)).toFixed(2)); l.setAttribute('y1', (120 - r1 * Math.cos(a)).toFixed(2));
      l.setAttribute('x2', (120 + r2 * Math.sin(a)).toFixed(2)); l.setAttribute('y2', (120 - r2 * Math.cos(a)).toFixed(2));
      if (big) l.setAttribute('class', 'big');
      ticks.appendChild(l);
    }
    ['∞', '10', '5', '3', '2', '1.5', '1', '.7'].forEach((t, i) => {
      const a = ((-63 + i * 18) * Math.PI) / 180, r = 122;
      const tx = document.createElementNS(NS, 'text');
      tx.setAttribute('x', (120 + r * Math.sin(a)).toFixed(2)); tx.setAttribute('y', (122.5 - r * Math.cos(a)).toFixed(2)); tx.setAttribute('text-anchor', 'middle');
      tx.textContent = t; ticks.appendChild(tx);
    });

    /* shutter sound, synthesised in the browser (no audio file). Browsers allow sound only after the visitor's first tap, click or key press. */
    const AC = window.AudioContext || window.webkitAudioContext;
    const snd = { ctx: null, buf: null, bus: null, pref: null };
    try { snd.pref = localStorage.getItem('cia_sound'); } catch {}
    const soundOn = () => snd.pref !== 'off';
    const savePref = (val) => { snd.pref = val; try { localStorage.setItem('cia_sound', val); } catch {} };
    const audioLive = () => !!snd.ctx && snd.ctx.state === 'running';
    const biquad = (type, f0, q, sr) => {
      const w = (2 * Math.PI * f0) / sr, cs = Math.cos(w), al = Math.sin(w) / (2 * q), a0 = 1 + al, a1 = -2 * cs, a2 = 1 - al;
      const [b0, b1, b2] = type === 'bp' ? [al, 0, -al] : type === 'hp' ? [(1 + cs) / 2, -(1 + cs), (1 + cs) / 2] : [(1 - cs) / 2, 1 - cs, (1 - cs) / 2];
      let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
      return (xn) => { const yn = (b0 * xn + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0; x2 = x1; x1 = xn; y2 = y1; y1 = yn; return yn; };
    };
    // one frame of an SLR: mirror up + first curtain, second curtain + mirror down, then the motor re-cocking the shutter
    const shutterBuffer = (c) => {
      const sr = c.sampleRate, n = Math.round(sr * 0.15), b = c.createBuffer(1, n, sr), d = b.getChannelData(0);
      let seed = 1234567; const rnd = () => (seed = (seed * 16807) % 2147483647) / 1073741823.5 - 1;
      const hit = (t0, amp, fc, q, modes, thud) => {
        const bp = biquad('bp', fc, q, sr), s0 = Math.round(t0 * sr), s1 = Math.min(n, s0 + Math.round(0.045 * sr));
        for (let i = s0; i < s1; i++) {
          const t = (i - s0) / sr;
          let val = 2.4 * bp(rnd() * Math.exp(-t / 0.0018));
          for (const [fq, dec, a] of modes) val += a * Math.exp(-t / dec) * Math.sin(2 * Math.PI * fq * t);
          if (thud) val += thud[1] * Math.exp(-t / thud[2]) * Math.sin(2 * Math.PI * thud[0] * t);
          d[i] += amp * val;
        }
      };
      hit(0, 1, 4300, 0.9, [[3200, 0.006, 0.32], [5400, 0.004, 0.22], [7700, 0.0025, 0.14]], [118, 0.22, 0.012]);
      hit(0.0042, 0.32, 6200, 1.3, [[4800, 0.003, 0.18]], null);
      hit(0.047, 0.95, 2700, 0.8, [[1700, 0.009, 0.34], [2950, 0.006, 0.28], [4600, 0.004, 0.18]], [152, 0.48, 0.02]);
      hit(0.0555, 0.3, 3600, 1, [[2350, 0.004, 0.18]], null);
      const bp = biquad('bp', 980, 1.3, sr), lp = biquad('lp', 2600, 0.7, sr), m0 = Math.round(0.058 * sr), m1 = Math.min(n, Math.round(0.122 * sr));
      for (let i = m0; i < m1; i++) {
        const t = (i - m0) / sr, env = Math.min(1, t / 0.006) * Math.min(1, (m1 - i) / sr / 0.016);
        d[i] += 0.8 * env * lp(bp(rnd()) * (0.5 + 0.5 * Math.sign(Math.sin(2 * Math.PI * 235 * t))));
      }
      const hp = biquad('hp', 80, 0.7, sr); let pk = 1e-9;
      for (let i = 0; i < n; i++) { d[i] = hp(d[i]); pk = Math.max(pk, Math.abs(d[i])); }
      for (let i = 0; i < n; i++) d[i] *= 0.92 / pk;
      return b;
    };
    const roomBuffer = (c) => {
      const sr = c.sampleRate, n = Math.round(sr * 0.25), b = c.createBuffer(2, n, sr);
      for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sr * 0.04)); }
      return b;
    };
    // Sound is ON by default. Browsers let a page play sound only after the visitor's first tap, click or key press (or when the
    // visitor allows the site to autoplay), so the audio is tried at load and switched on by the first interaction anywhere.
    const GESTURES = ['pointerdown', 'pointerup', 'touchend', 'keydown', 'click'];
    let firstLive = false, onFirstLive = () => {};
    const paintSnd = () => {
      if (!sndBtn) return;
      const s = !soundOn() ? 'off' : audioLive() ? 'on' : 'armed';
      sndBtn.dataset.state = s;
      sndBtn.setAttribute('aria-pressed', String(s !== 'off'));
      sndBtn.setAttribute('aria-label', s === 'off' ? 'Turn on the shutter sound' : s === 'on' ? 'Turn off the shutter sound' : 'Play the shutter sound');
      text(sndBtn.querySelector('.lens__snd-l'), s === 'off' ? 'Sound off' : 'Sound on');
      text(sndBtn.querySelector('.lens__snd-s'), s === 'off' ? 'Off' : 'On');
    };
    const goneLive = () => {
      GESTURES.forEach((ev) => removeEventListener(ev, onGesture, true));
      if (!firstLive) { firstLive = true; onFirstLive(); }
    };
    const onGesture = (e) => {
      if (!soundOn() || (e.target && e.target.closest && e.target.closest('#lensSnd'))) return;
      audio(true);
    };
    const audio = (gesture) => {
      if (!AC) return null;
      if (!snd.ctx) {
        try { snd.ctx = new AC({ latencyHint: 'interactive' }); } catch { try { snd.ctx = new AC(); } catch { return null; } }
        const c = snd.ctx, master = c.createGain(), comp = c.createDynamicsCompressor(), room = c.createConvolver(), wet = c.createGain();
        master.gain.value = 0.55; wet.gain.value = 0.14;
        comp.threshold.value = -12; comp.knee.value = 6; comp.ratio.value = 4; comp.attack.value = 0.001; comp.release.value = 0.06;
        room.buffer = roomBuffer(c);
        master.connect(comp); master.connect(room); room.connect(wet); wet.connect(comp); comp.connect(c.destination);
        snd.bus = master; snd.buf = shutterBuffer(c);
        c.onstatechange = () => { paintSnd(); if (audioLive()) goneLive(); };
        if (audioLive()) { GESTURES.forEach((ev) => removeEventListener(ev, onGesture, true)); firstLive = true; }
      }
      if (snd.ctx.state !== 'running') snd.ctx.resume().catch(() => {});
      // iPhone: starting a silent sound inside the tap is what unlocks audio there
      if (gesture) { try { const s = snd.ctx.createBufferSource(); s.buffer = snd.ctx.createBuffer(1, 1, snd.ctx.sampleRate); s.connect(snd.ctx.destination); s.start(0); } catch {} }
      paintSnd();
      return snd.ctx;
    };
    const clickAt = (when) => {
      const c = snd.ctx, s = c.createBufferSource(), g = c.createGain();
      s.buffer = snd.buf; s.playbackRate.value = 0.97 + Math.random() * 0.06; g.gain.value = 0.85 + Math.random() * 0.15;
      s.connect(g); g.connect(snd.bus); s.start(Math.max(c.currentTime, when));
    };
    const whenLive = (fn) => { if (!snd.ctx) return; if (audioLive()) fn(); else snd.ctx.resume().then(() => { if (audioLive()) fn(); }).catch(() => {}); };
    if (AC) GESTURES.forEach((ev) => addEventListener(ev, onGesture, true));

    /* geometry */
    let W = 0, H = 0, R = 90, SD = 214, x = 0, y = 0;
    const set = (k, val) => frame.style.setProperty(k, val);
    const measure = () => {
      const b = frame.getBoundingClientRect(), w0 = W, h0 = H;
      W = b.width; H = b.height; R = Math.max(52, Math.round(W * FR)); SD = Math.round((240 * R) / 101);
      set('--fw', `${W}px`); set('--fh', `${H}px`); set('--d', `${R * 2}px`); set('--sd', `${SD}px`);
      if (w0 && h0) { x *= W / w0; y *= H / h0; }
    };
    const ZOOM0 = 1.04, ZOOM1 = 1.27, DIM1 = 0.32, SNAP0 = 1.34;
    const v = { blur: 0, zoom: ZOOM0, snap: SNAP0, ring: 0, dim: 0, ss: 1 };
    const shown = {};
    const put = (k, val) => { if (shown[k] !== val) { shown[k] = val; set(k, val); } };
    const apply = (px, py) => {
      put('--wx', `${(px - R).toFixed(1)}px`); put('--wy', `${(py - R).toFixed(1)}px`);
      put('--ix', `${(R - px).toFixed(1)}px`); put('--iy', `${(R - py).toFixed(1)}px`);
      put('--ox', `${px.toFixed(1)}px`); put('--oy', `${py.toFixed(1)}px`);
      put('--sx', `${(px - SD / 2).toFixed(1)}px`); put('--sy', `${(py - SD / 2).toFixed(1)}px`);
      put('--focus', `${v.blur.toFixed(2)}px`); put('--zoom', v.zoom.toFixed(4)); put('--snap', v.snap.toFixed(3));
      put('--ring', `${v.ring.toFixed(1)}deg`); put('--dim', v.dim.toFixed(3)); put('--ss', v.ss.toFixed(4));
    };
    const status = (s) => text(statusEl, s);

    /* motion helpers */
    const sm = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
    const inOut = (t) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(t, 0, 1));
    const out3 = (t) => 1 - (1 - clamp(t, 0, 1)) ** 3;
    // step response of a damped spring from 0 to 1; it overshoots when z < 1
    const spring = (t, w, z) => { if (t <= 0) return 0; const wd = w * Math.sqrt(1 - z * z); return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t)); };
    // Catmull-Rom path through points given as fractions of the frame, walked at constant speed
    const cr = (P, u) => {
      const n = P.length - 1, i = Math.min(n - 1, Math.floor(u)), s = u - i;
      const p0 = P[i - 1] || [2 * P[0][0] - P[1][0], 2 * P[0][1] - P[1][1]], p1 = P[i], p2 = P[i + 1];
      const p3 = P[i + 2] || [2 * P[n][0] - P[n - 1][0], 2 * P[n][1] - P[n - 1][1]];
      const f = (a, b, c, d) => 0.5 * (2 * b + (c - a) * s + (2 * a - 5 * b + 4 * c - d) * s * s + (3 * b - a - 3 * c + d) * s * s * s);
      return [f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])];
    };
    const mkPath = (P) => {
      const n = P.length - 1, M = 160, us = [0], ls = [0];
      let prev = cr(P, 0);
      for (let k = 1; k <= M; k++) { const u = (k / M) * n, p = cr(P, u); us.push(u); ls.push(ls[k - 1] + Math.hypot((p[0] - prev[0]) * W, (p[1] - prev[1]) * H)); prev = p; }
      return { P, us, ls, len: ls[M] };
    };
    const along = (pa, frac) => {
      const L = frac * pa.len, ls = pa.ls; let lo = 0, hi = ls.length - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ls[m] < L) lo = m; else hi = m; }
      const t = (L - ls[lo]) / Math.max(1e-6, ls[hi] - ls[lo]);
      return cr(pa.P, pa.us[lo] + (pa.us[hi] - pa.us[lo]) * t);
    };
    const ENTRY = [-0.32, 0.9];
    const PATHS = [
      [[0.28, 0.8], [0.68, 0.7], [0.79, 0.44], [0.64, 0.29]],
      [[0.74, 0.79], [0.38, 0.63], [0.18, 0.42], [0.25, 0.27]],
      [[0.5, 0.58], [0.81, 0.38], [0.76, 0.16], [0.63, 0.1]],
      [[0.4, 0.74], [0.2, 0.52], [0.52, 0.42], [0.67, 0.25]],
    ];

    /* the shutter: a seven-blade iris closes and reopens inside the lens on every frame */
    const NB = 7; let irisOn = false;
    const drawIris = (a) => {
      if (a >= 101.5) { if (irisOn) { irisG.style.display = 'none'; irisOn = false; } return; }
      if (!irisOn) { irisG.style.display = 'block'; irisOn = true; }
      const tw = 0.35 + (1 - a / 102) * 0.75, rv = a / Math.cos(Math.PI / NB);
      let poly = '', seams = '';
      for (let k = 0; k < NB; k++) {
        const th = tw + (k * 2 * Math.PI) / NB, va = th + Math.PI / NB, vx = 120 + rv * Math.cos(va), vy = 120 + rv * Math.sin(va);
        poly += `${k ? 'L' : 'M'}${vx.toFixed(2)} ${vy.toFixed(2)}`;
        seams += `M${vx.toFixed(2)} ${vy.toFixed(2)}l${(-Math.sin(th) * 170).toFixed(1)} ${(Math.cos(th) * 170).toFixed(1)}`;
      }
      irisDark.setAttribute('d', `M18 120a102 102 0 1 0 204 0a102 102 0 1 0-204 0Z${poly}Z`);
      irisSeams.setAttribute('d', seams);
    };
    const flash = () => { if (!reduce && flashEl && flashEl.animate) flashEl.animate([{ opacity: 0.22 }, { opacity: 0 }], { duration: 200, easing: 'cubic-bezier(.2,.7,.2,1)' }); };
    const setShots = (k) => shotEls.forEach((el, i) => el.classList.toggle('on', i < k));

    /* timeline: wait → float → hover → snap → locked (burst) → hold → float … */
    let T = 0, phase = 'idle', t0 = 0, cyc = 0, pathNow = null, dur = 4.4, appr = [FX, FY], lockT = 0;
    let from = [FX, FY], fromZoom = ZOOM0, fromDim = 0, fromSnap = SNAP0, fFrom = 0.6, f = 0.5, lastF = 0.5;
    let shotsAt = [], fired = 0, burstSound = false, holdUntil = 0, idT0 = -1, idN = -1;
    const blinks = [], kicks = [];
    const idShow = (now) => { idT0 = now; idN = -1; lens.classList.add('is-id'); };
    const idHide = () => { idT0 = -1; lens.classList.remove('is-id'); };
    const toFloat = () => {
      const pts = PATHS[cyc % PATHS.length], last = pts[pts.length - 1];
      const dx = (last[0] - FX) * W, dy = (last[1] - FY) * H, dl = Math.hypot(dx, dy) || 1;
      appr = [FX + ((dx / dl) * R * 0.95) / W, FY + ((dy / dl) * R * 0.95) / H];
      pathNow = mkPath([cyc === 0 ? ENTRY : [x / W, y / H], ...pts, appr]);
      fromZoom = v.zoom; fromDim = v.dim; fromSnap = v.snap; fFrom = f;
      dur = cyc === 0 ? 4.6 : 4.3; phase = 'float'; t0 = T;
      lens.classList.remove('is-locked', 'is-burst'); setShots(0); idHide(); status('SCANNING');
    };
    const toHover = () => { phase = 'hover'; t0 = T; status('FACE DETECTED'); };
    const toSnap = () => { phase = 'snap'; t0 = T; from = [x / W, y / H]; fromZoom = v.zoom; fromDim = v.dim; fromSnap = v.snap; fFrom = clamp(Math.abs(f) + 0.25, 0.55, 1); idHide(); status('FOCUSING'); };
    const soundShots = (k0) => {
      if (!audioLive() || !soundOn() || !snd.buf) return false;
      const now = snd.ctx.currentTime;
      for (let k = k0; k < 3; k++) clickAt(now + Math.max(0, shotsAt[k] - T));
      return true;
    };
    const burstAt = (at) => { shotsAt = [at, at + 0.21, at + 0.42]; fired = 0; setShots(0); lens.classList.add('is-burst'); burstSound = soundShots(0); };
    const lockOn = () => {
      phase = 'locked'; lockT = T;
      lens.classList.remove('is-locked'); void lens.offsetWidth; lens.classList.add('is-locked');
      status('SUBJECT ACQUIRED'); idShow(T); burstAt(T + 0.24);
    };
    const fire = () => { blinks.push(T); if (!reduce) kicks.push(T); fired++; setShots(fired); flash(); };
    onFirstLive = () => {
      if (phase === 'hold' && live && visRatio >= 0.5) { phase = 'locked'; burstAt(T + 0.15); }
      else if (phase === 'locked' && !burstSound && fired < 3) burstSound = soundShots(fired);
    };
    const afterUnlock = () => whenLive(() => { paintSnd(); if (phase === 'locked' && !burstSound && fired < 3) burstSound = soundShots(fired); });

    // timecode, 24 fps
    const tcBase = ((0 * 60 + 47) * 60 + 12) * 24, tStart = performance.now();
    const pad = (n) => String(n).padStart(2, '0');
    const tc = (now) => { const fr = tcBase + Math.floor(((now - tStart) / 1000) * 24); const ff = fr % 24, s = Math.floor(fr / 24); tcEl.textContent = `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}:${pad(ff)}`; };

    let live = false, started = false, lastNow = 0, raf = 0, visRatio = 0;
    const step = (now) => {
      if (!live) return;
      const dt = Math.min(0.05, (now - (lastNow || now)) / 1000); lastNow = now; T += dt;
      tc(now);
      let px = x / W, py = y / H;
      if (phase === 'wait' && T - t0 > 0.45) toFloat();
      if (phase === 'float') {
        const pt = T - t0, p = along(pathNow, inOut(pt / dur)), b = sm(pt / 0.8);
        px = p[0]; py = p[1];
        v.zoom = fromZoom + (ZOOM0 - fromZoom) * b; v.dim = fromDim * (1 - b);
        v.snap = fromSnap + (SNAP0 - fromSnap) * b + 0.03 * Math.sin(T * 2.2);
        f = fFrom + (0.34 + 0.2 * Math.sin(T * 3.6) + 0.09 * Math.sin(T * 10.7 + 1.3) - fFrom) * b;
        if (pt >= dur) toHover();
      } else if (phase === 'hover') {
        const pt = T - t0, k = inOut(pt / 0.5) * 0.14;
        px = appr[0] + (FX - appr[0]) * k; py = appr[1] + (FY - appr[1]) * k;
        f = 0.45 + 0.3 * Math.sin(pt * 18);
        v.snap = SNAP0 - 0.1 * inOut(pt / 0.5);
        if (pt >= 0.5) toSnap();
      }
      if (phase === 'snap' || phase === 'locked' || phase === 'hold') {
        const s = T - t0, k = spring(s, 11, 0.62);
        px = from[0] + (FX - from[0]) * k; py = from[1] + (FY - from[1]) * k;
        v.zoom = fromZoom + (ZOOM1 - fromZoom) * spring(s, 8.5, 0.82);
        v.dim = fromDim + (DIM1 - fromDim) * out3(s / 0.7);
        v.snap = fromSnap + (1 - fromSnap) * spring(s, 16, 0.5);
        f = fFrom * (1 - spring(s, 18, 0.36)); // swings through focus once before it bites
        if (phase === 'snap' && s >= 0.66) lockOn();
        if (phase === 'locked') {
          while (fired < 3 && T >= shotsAt[fired]) fire();
          if (fired === 3 && T >= shotsAt[2] + 0.2) { phase = 'hold'; holdUntil = T + 6; if (cyc === 0) setTimeout(stampIn, 120); }
        } else if (phase === 'hold' && T >= holdUntil && !reduce) { cyc++; toFloat(); }
      }

      // handheld drift while holding, and a kick from the mirror on every frame
      let jx = 0, jy = 0, ss = 1;
      if ((phase === 'locked' || phase === 'hold') && !reduce) {
        const a = 1.2 * sm((T - lockT) / 0.6);
        jx = a * (Math.sin(T * 1.31) + 0.6 * Math.sin(T * 2.73 + 1.1) + 0.3 * Math.sin(T * 5.2 + 2.3));
        jy = a * (Math.sin(T * 1.07 + 0.5) + 0.55 * Math.sin(T * 2.41 + 2.2) + 0.3 * Math.sin(T * 4.6 + 0.7));
      }
      for (let i = kicks.length - 1; i >= 0; i--) {
        const tau = T - kicks[i]; if (tau > 0.25) { kicks.splice(i, 1); continue; }
        const e = Math.exp(-tau / 0.05); jx += 2.4 * e * Math.sin(tau * 95 + i); jy += 1.8 * e * Math.cos(tau * 83 + i); ss -= 0.018 * e;
      }
      let ap = 102;
      for (let i = blinks.length - 1; i >= 0; i--) {
        const tau = T - blinks[i]; if (tau > 0.17) { blinks.splice(i, 1); continue; }
        ap = Math.min(ap, tau < 0.045 ? 102 * (1 - (tau / 0.045) ** 2) : tau < 0.072 ? 0 : 102 * out3((tau - 0.072) / 0.095));
      }
      drawIris(ap);

      // the ID tag types the author's name once the face is locked
      if (idT0 >= 0 && idTyped) {
        const n = clamp(Math.floor((T - idT0 - 0.3) / 0.035), 0, NAME.length);
        if (n !== idN) { idN = n; idTyped.textContent = NAME.slice(0, n); idRest.textContent = NAME.slice(n); }
      }

      v.ss = ss;
      v.blur = 6.4 * (W / 560) * Math.min(1.25, Math.abs(f));
      v.ring += (f - lastF) * 300 + (phase === 'float' ? dt * 10 : 0); lastF = f;
      x = px * W + jx; y = py * H + jy;
      apply(x, y);
      text(distEl, (3.2 + 4.4 * clamp(Math.abs(f), 0, 1)).toFixed(1));
      if (needle) needle.style.setProperty('--needle', (Math.sin(T * 0.7) * 4 + Math.sin(T * 2.3) * 1.5 + f * 10).toFixed(1));
      raf = requestAnimationFrame(step);
    };
    const run = () => { if (!live) { live = true; lastNow = 0; raf = requestAnimationFrame(step); } };
    const halt = () => { live = false; cancelAnimationFrame(raf); };

    // a click or tap on the photo (or the sound button) zeroes in and takes the burst now, with sound
    const shootNow = () => {
      if (!started) { started = true; t0 = T; run(); toFloat(); }
      if (phase === 'wait') toFloat();
      if (phase === 'float' || phase === 'hover') toSnap();
      else if (phase === 'hold') { phase = 'locked'; burstAt(T + 0.12); }
    };
    frame.addEventListener('click', (e) => {
      if (e.target.closest('.lens__snd')) return;
      if (soundOn()) audio(true);
      shootNow(); afterUnlock();
    });
    if (sndBtn && AC) {
      sndBtn.hidden = false; paintSnd();
      sndBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (soundOn() && audioLive()) { savePref('off'); paintSnd(); return; }
        savePref('on'); audio(true); paintSnd(); shootNow(); afterUnlock();
      });
    }

    // Visitors whose device asks for reduced motion get one gentle pass (no loop, no flash, no shake); everyone else gets the loop.
    measure();
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => { measure(); apply(x, y); }).observe(frame);
    x = ENTRY[0] * W; y = ENTRY[1] * H; apply(x, y);
    if (AC && soundOn()) audio(false);
    new IntersectionObserver((es) => es.forEach((e) => {
      visRatio = e.intersectionRatio;
      if (!started) { if (e.intersectionRatio >= 0.35) { started = true; phase = 'wait'; t0 = T; run(); } }
      else if (e.isIntersecting) run(); else halt();
    }), { threshold: [0, 0.35, 0.6] }).observe(lens);
  }

  /* ---------- chain thread draws as you scroll ---------- */
  const files = $('#files');
  if (files) {
    let tick = false;
    const draw = () => { tick = false; const b = files.getBoundingClientRect(); const p = clamp((innerHeight * 0.6 - b.top) / b.height, 0, 1); files.style.setProperty('--thread', `${(p * 100).toFixed(1)}%`); };
    addEventListener('scroll', () => { if (!tick) { tick = true; requestAnimationFrame(draw); } }, { passive: true });
    draw();
  }

  /* ---------- the missing minute: loop the clip from the Unleashed.news post and flag the moment the clock skips ---------- */
  const cctv = $('#cctv'), vid = $('#cctvVideo');
  if (cctv && vid) {
    // seconds in the clip: the player controls are off screen between START and END; the clock skips at JUMP
    const START = 2.05, END = 12.75, JUMP = 8.68;
    let on = false, raf = 0, gap = false;
    const tick = () => {
      if (!on) return;
      const t = vid.currentTime;
      if (t >= END || t < START - 0.3) vid.currentTime = START;
      const g = t >= JUMP && t < END;
      if (g !== gap) {
        gap = g; cctv.classList.toggle('is-gap', g);
        if (g && !reduce) { cctv.classList.add('is-glitch'); setTimeout(() => cctv.classList.remove('is-glitch'), 300); }
      }
      raf = requestAnimationFrame(tick);
    };
    const play = () => { const p = vid.play(); if (p && p.then) p.then(() => cctv.classList.remove('is-paused')).catch(() => cctv.classList.add('is-paused')); };
    new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting && !on) { on = true; vid.preload = 'auto'; play(); raf = requestAnimationFrame(tick); }
      else if (!e.isIntersecting && on) { on = false; cancelAnimationFrame(raf); vid.pause(); }
    }), { threshold: 0.3 }).observe(cctv);
    // where autoplay is refused (an iPhone in Low Power Mode), one tap plays it
    $('.cctv__screen', cctv).addEventListener('click', () => { if (vid.paused) play(); });
  }

  /* ---------- notify form: readers join the list; credentialed media request a preview copy ---------- */
  const form = $('#notifyForm');
  if (form) {
    const msg = $('#nMsg'), btn = $('#nBtn'), roleSel = $('#nRole'), pro = $('#nPro');
    const emailEl = $('#nEmail'), emailLabel = $('#nEmailLabel'), emailHint = $('#nEmailHint');
    const proInputs = $$('input, textarea', pro);
    const REQUIRED = ['nName', 'nTitle', 'nOutlet', 'nLink'];
    const ROLES = {
      journalist: { outlet: 'Outlet or publication', outletPh: 'Publication name', titlePh: 'Investigative reporter', audience: true, audiencePh: 'Monthly readers' },
      producer: { outlet: 'Network, station or show', outletPh: 'Network and show name', titlePh: 'Senior producer', audience: true, audiencePh: 'Nightly or weekly viewers' },
      podcast: { outlet: 'Podcast name', outletPh: 'Show name', titlePh: 'Host', audience: true, audiencePh: 'Downloads per episode' },
      reviewer: { outlet: 'Publication or books desk', outletPh: 'Publication name', titlePh: 'Books editor', audience: false, audiencePh: '' },
    };
    const FREE = /@(gmail|googlemail|yahoo|ymail|hotmail|outlook|live|msn|icloud|me|mac|aol|proton|protonmail|pm|gmx|mail|zoho|yandex)\./i;
    const isPro = () => roleSel.value !== 'reader';
    const label = () => (isPro() ? 'Request a preview copy' : 'Notify me');
    const setBtn = () => { btn.innerHTML = `${label()} <span aria-hidden="true">→</span>`; };
    const sync = () => {
      const r = ROLES[roleSel.value], open = !!r;
      pro.classList.toggle('is-open', open); pro.setAttribute('aria-hidden', String(!open));
      proInputs.forEach((i) => { i.tabIndex = open ? 0 : -1; });
      REQUIRED.forEach((id) => { $(`#${id}`).required = open; });
      $('#nAgree').required = open;
      emailLabel.textContent = open ? 'Work email' : 'Email address';
      if (open) {
        $('#nOutletLabel').textContent = r.outlet; $('#nOutlet').placeholder = r.outletPh; $('#nTitle').placeholder = r.titlePh;
        $('#nAudienceWrap').hidden = !r.audience; $('#nAudience').placeholder = r.audiencePh;
      }
      emailHint.hidden = !(open && FREE.test(emailEl.value));
      setBtn(); msg.textContent = ''; msg.classList.remove('is-err');
    };
    roleSel.addEventListener('change', sync);
    emailEl.addEventListener('input', () => { emailHint.hidden = !(isPro() && FREE.test(emailEl.value)); });
    $$('[data-role]').forEach((a) => a.addEventListener('click', (e) => {
      e.preventDefault(); roleSel.value = a.dataset.role; sync();
      $('#notify').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      setTimeout(() => roleSel.focus({ preventScroll: true }), reduce ? 0 : 650);
    }));
    const bad = (el, text) => { const f = el.closest('.form__field, .form__check'); if (f) f.classList.add('is-bad'); msg.textContent = text; msg.classList.add('is-err'); el.focus(); return false; };
    form.addEventListener('input', (e) => { const f = e.target.closest('.is-bad'); if (f) f.classList.remove('is-bad'); });
    form.addEventListener('change', (e) => { const f = e.target.closest('.is-bad'); if (f) f.classList.remove('is-bad'); });
    sync();

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      msg.classList.remove('is-err'); $$('.is-bad', form).forEach((f) => f.classList.remove('is-bad'));
      const email = emailEl.value.trim(), role = roleSel.value;
      if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) return bad(emailEl, 'Please enter a valid email address.');
      const body = { email, role, site: 'theciaasset.com', page: location.href };
      if (isPro()) {
        const v = (id) => $(`#${id}`).value.trim();
        if (v('nName').length < 2) return bad($('#nName'), 'Please enter your full name.');
        if (v('nTitle').length < 2) return bad($('#nTitle'), 'Please enter your title.');
        if (v('nOutlet').length < 2) return bad($('#nOutlet'), `Please enter your ${$('#nOutletLabel').textContent.toLowerCase()}.`);
        let link = v('nLink'); if (link && !/^https?:\/\//i.test(link)) link = `https://${link}`;
        let okLink = false; try { const u = new URL(link); okLink = u.hostname.includes('.'); } catch {}
        if (!okLink) return bad($('#nLink'), 'Please add a link that shows your work, such as your author page or show page.');
        if (!$('#nAgree').checked) return bad($('#nAgree'), 'Please agree to keep the advance material confidential.');
        Object.assign(body, { name: v('nName'), title: v('nTitle'), outlet: v('nOutlet'), link, audience: v('nAudience'), handle: v('nHandle'), note: $('#nNote').value.trim(), agreed: true });
      }
      btn.disabled = true; btn.textContent = 'Sending…';
      try {
        const r = await fetch('https://pitchzing-haro.pitchzing.workers.dev/public/book-site/notify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || `The sign-up service answered ${r.status}.`);
        const wasPro = isPro();
        form.reset(); sync();
        msg.textContent = wasPro ? 'Request received. Every request is verified, and approved members of the media receive secure access to the preview copy.' : 'You are on the list. Watch your inbox for launch news.';
        toast(wasPro ? 'Preview request received.' : 'You are on the list.');
      } catch (err) {
        msg.textContent = err && err.message && !/Failed to fetch|NetworkError/i.test(err.message) ? err.message : 'The request could not be sent. Check your connection and try again.';
        msg.classList.add('is-err');
      } finally { btn.disabled = false; setBtn(); }
    });
  }

  /* ---------- press kit ---------- */
  const copyBtn = $('#copyBio');
  if (copyBtn) copyBtn.addEventListener('click', async () => {
    const text = $('#shortBio').textContent.trim();
    try { await navigator.clipboard.writeText(text); toast('Short bio copied.'); }
    catch { const r = document.createRange(); r.selectNodeContents($('#shortBio')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); toast('Bio selected. Press Copy.'); }
  });

  /* ---------- links from earlier emails ---------- */
  const qp = new URLSearchParams(location.search);
  if (fresh && (qp.has('amount') || qp.has('section'))) setTimeout(() => $('#notify')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }), 600);
  if (qp.get('payment') === 'success') setTimeout(() => toast('Thank you for supporting the book.'), 800);

  const yr = $('#year'); if (yr) yr.textContent = String(new Date().getFullYear());
})();
