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

  window.__ciaReady = true;

  /* ---------- human check: Cloudflare Turnstile, invisible to most visitors; it shows one box to tick only when it is unsure.
     The site key lives in <meta name="turnstile-sitekey">; empty turns the check off. A sign-up whose check cannot run
     (a blocked script) is still sent, and the list stores it marked for review. ---------- */
  const TS_KEY = ($('meta[name="turnstile-sitekey"]') || {}).content || '';
  const human = (() => {
    const boxes = new Map();
    let lib = null;
    const load = () => lib || (lib = new Promise((res, rej) => {
      if (!TS_KEY) return rej(new Error('off'));
      window.__tsReady = () => res(window.turnstile);
      const sc = document.createElement('script');
      sc.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=__tsReady';
      sc.async = true; sc.onerror = () => rej(new Error('blocked'));
      document.head.appendChild(sc);
      setTimeout(() => rej(new Error('slow')), 12000);
    }));
    const settle = (st, t) => st.waiters.splice(0).forEach((fn) => fn(t));
    const mount = (el, onAsk) => {
      if (!el || boxes.has(el)) return boxes.get(el);
      const st = { id: null, token: '', waiters: [], asking: false, dead: !TS_KEY, onAsk };
      boxes.set(el, st);
      load().then((ts) => {
        st.id = ts.render(el, {
          sitekey: TS_KEY, appearance: 'interaction-only', theme: 'dark', action: 'signup', size: el.clientWidth && el.clientWidth < 310 ? 'compact' : 'normal',
          callback: (t) => { st.token = t; st.asking = false; el.classList.remove('is-asking'); settle(st, t); },
          'expired-callback': () => { st.token = ''; },
          'before-interactive-callback': () => { st.asking = true; el.classList.add('is-asking'); if (st.onAsk) st.onAsk(); },
          'error-callback': () => { st.dead = !st.asking; settle(st, ''); },
        });
      }).catch(() => { st.dead = true; settle(st, ''); });
      return st;
    };
    // one token per send (each is single-use): waits while the visitor is asked to tick the box, otherwise up to `ms`
    const token = (el, ms = 6000, onAsk) => new Promise((res) => {
      const st = mount(el, onAsk); if (onAsk) st.onAsk = onAsk;
      const take = (t) => { res(t || ''); if (t && st.id !== null && window.turnstile) { st.token = ''; try { window.turnstile.reset(st.id); } catch {} } };
      if (st.token) return take(st.token);
      if (st.dead) return res('');
      let done = false;
      const fin = (t) => { if (!done) { done = true; take(t); } };
      st.waiters.push(fin);
      const wait = () => setTimeout(() => { if (st.asking) wait(); else fin(''); }, ms);
      wait();
      if (st.asking && onAsk) onAsk();
    });
    return { mount, token };
  })();

  /* ---------- sign-ups are never dropped: one that cannot be sent (no signal, a busy moment) is kept on this device and
     sent again a few seconds, then minutes later, and on the next visit, until the list confirms it ---------- */
  const SIGNUP_URL = 'https://pitchzing-haro.pitchzing.workers.dev/public/book-site/notify', QKEY = 'cia_signup_queue';
  const KNOWN_URL = 'https://pitchzing-haro.pitchzing.workers.dev/public/book-site/known';
  const readQ = () => { try { const q = JSON.parse(localStorage.getItem(QKEY) || '[]'); return Array.isArray(q) ? q : []; } catch { return []; } };
  const writeQ = (q) => { try { if (q.length) localStorage.setItem(QKEY, JSON.stringify(q.slice(-20))); else localStorage.removeItem(QKEY); } catch {} };
  let mem = [], qTimer = 0, qTry = 0, qBusy = false;
  const flushQ = async () => {
    if (qBusy) return; qBusy = true; clearTimeout(qTimer);
    let q = readQ(); if (!q.length) q = mem;
    const done = new Set();
    for (const body of q) {
      try {
        const r = await fetch(SIGNUP_URL, { method: 'POST', keepalive: true, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
        if (r.ok || r.status === 400) done.add(body.email.toLowerCase()); // 400 is a bad address: retrying cannot help
      } catch {}
    }
    // re-read, so an address added while these were sending is kept
    let left = readQ(); if (!left.length) left = mem;
    left = left.filter((b) => !done.has(b.email.toLowerCase()));
    mem = left; writeQ(left); qBusy = false;
    if (left.length) { const waits = [4, 15, 45, 120, 300]; qTimer = setTimeout(flushQ, waits[Math.min(qTry++, waits.length - 1)] * 1000); }
  };
  const queueSignup = (body) => {
    const q = readQ().filter((b) => b.email.toLowerCase() !== body.email.toLowerCase());
    q.push(body); mem = q; writeQ(q); qTry = 0;
    if (qBusy) { clearTimeout(qTimer); qTimer = setTimeout(flushQ, 1000); } else flushQ();
  };
  if (readQ().length) setTimeout(flushQ, 1500);
  addEventListener('online', () => { if (readQ().length || mem.length) { qTry = 0; flushQ(); } });

  /* ---------- opening screen: the visitor enters an email to open the file; that tap or key press also lets the browser play the shutter sound ---------- */
  const gate = $('#gate');
  let gateOpen = !gate || !document.documentElement.classList.contains('gate-on');
  const onGateOpen = [];
  if (!gateOpen) {
    const gateForm = $('#gateForm'), gateEmail = $('#gateEmail'), gateBtn = $('#gateBtn'), gateErr = $('#gateErr');
    const behind = [$('.skip'), $('.nav'), $('#main'), $('.foot')].filter(Boolean);
    behind.forEach((el) => { el.inert = true; });
    // a returning visitor's email is filled in, so one tap opens the file
    let known = '';
    try { known = localStorage.getItem('cia_email') || ''; } catch {}
    const isBack = () => document.documentElement.classList.contains('gate-back');   // a returning visitor: one tap, no email
    const focusGate = () => { if (!fine || gateOpen) return; if (isBack()) { if (gateBtn) gateBtn.focus({ preventScroll: true }); } else if (gateEmail) gateEmail.focus({ preventScroll: true }); };
    if (gateEmail) { if (known) gateEmail.value = known; if (!document.documentElement.classList.contains('gate-ask')) focusGate(); }
    const gateHuman = $('#gateHuman');
    const askTick = () => { gateErr.textContent = 'Please tick the box to confirm you are human.'; };
    if (!known && !isBack() && !document.documentElement.classList.contains('gate-ask')) human.mount(gateHuman);
    // The site opens at the very top (Jason, 2026-10-15): typing in the email box can scroll the page underneath (a phone's
    // keyboard does), and a link may carry a #section; neither survives the opening.
    const openGate = () => {
      if (gateOpen) return;
      gateOpen = true;
      behind.forEach((el) => { el.inert = false; });
      if (gateBtn) { const r = gateBtn.getBoundingClientRect(); gate.style.setProperty('--gx', `${Math.round(r.left + r.width / 2)}px`); gate.style.setProperty('--gy', `${Math.round(r.top + r.height / 2)}px`); }
      if (document.activeElement && gate.contains(document.activeElement)) document.activeElement.blur();
      if (location.hash) history.replaceState(null, '', location.pathname + location.search);
      toTop();
      gate.classList.add('is-opening');
      setTimeout(() => { document.documentElement.classList.remove('gate-on'); gate.remove(); toTop(); }, reduce ? 30 : 860);
      onGateOpen.splice(0).forEach((fn) => fn());
    };
    // a returning visitor this browser has forgotten (cleared data, or Safari after a week away) may still be known to
    // PitchZing by network and browser together (Jason, 2026-10-17): then the site opens without the screen. It waits at
    // most 1.5 s for the answer before showing the screen's form.
    if (document.documentElement.classList.contains('gate-ask')) {
      const show = () => { document.documentElement.classList.remove('gate-ask'); if (!isBack() && !known) human.mount(gateHuman); focusGate(); };
      const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 1500);
      fetch(KNOWN_URL, { signal: ctl.signal, cache: 'no-store' }).then((r) => r.json())
        .then((j) => { if (j && j.known) { try { localStorage.setItem('cia_in', '1'); } catch {} document.documentElement.classList.add('gate-back'); } show(); })
        .catch(show).finally(() => clearTimeout(tm));
    }
    if (gateEmail) gateEmail.addEventListener('input', () => { gateForm.classList.remove('is-bad'); gateErr.textContent = ''; human.mount(gateHuman); });
    let checking = false;
    if (gateForm) gateForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (checking) return;
      if (isBack()) { openGate(); return; }   // the tap itself opens the file and lets the shutter sound play
      const email = gateEmail.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) {
        gateForm.classList.add('is-bad');
        gateErr.textContent = email ? 'Please check your email address.' : 'Please enter your email address to open the file.';
        gateEmail.focus();
        return;
      }
      // the file opens at once (inside the tap, so the sound can play); the sign-up is sent alongside it
      if (email.toLowerCase() !== known.toLowerCase()) {
        checking = true; gateBtn.disabled = true;
        const label = $('#gateBtnLabel'), was = label.textContent; label.textContent = 'Checking…';
        const t = await human.token(gateHuman, 6000, askTick);
        label.textContent = was; gateBtn.disabled = false; checking = false;
        try { localStorage.setItem('cia_email', email); } catch {}
        queueSignup({ email, role: 'reader', site: 'theciaasset.com', page: location.href, via: 'gate', human: t, website: (gateForm.elements.website || {}).value || '' });
      }
      try { localStorage.setItem('cia_in', '1'); } catch {}   // the next visit opens straight into the site
      openGate();
    });
  }
  const whenGateOpen = (fn) => { if (gateOpen) fn(); else onGateOpen.push(fn); };

  /* ---------- toast ---------- */
  const toastEl = $('#toast');
  let toastT;
  const toast = (msg) => { if (!toastEl) return; toastEl.textContent = msg; toastEl.classList.add('is-on'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('is-on'), 3600); };

  /* ---------- nav ---------- */
  const nav = $('.nav');
  const onScroll = () => nav && nav.classList.toggle('is-scrolled', scrollY > 8);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  // The logo (header and footer, href="#top") goes to the very top. #top is the sticky header itself, which a browser treats
  // as already in view, so the jump is made here; the address keeps no #top.
  $$('a[href="#top"]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  }));
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
  // every 3D book (the page's and, since 2026-10-17, the opening screen's) turns to face the pointer and eases back when it leaves
  if (fine && !reduce) $$('.hero__book').forEach((bookWrap) => {
    const book = $('.book', bookWrap); if (!book) return;
    let raf = 0;
    bookWrap.addEventListener('pointermove', (e) => {
      const b = bookWrap.getBoundingClientRect();
      const dx = (e.clientX - b.left) / b.width - 0.5, dy = (e.clientY - b.top) / b.height - 0.5;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => { book.style.setProperty('--ry', `${(12 - dx * 26).toFixed(2)}deg`); book.style.setProperty('--rx', `${(3 - dy * 10).toFixed(2)}deg`); });
    });
    bookWrap.addEventListener('pointerleave', () => { book.style.removeProperty('--ry'); book.style.removeProperty('--rx'); });
  });

  /* ---------- stamp: CLASSIFIED until the lens's first three-frame burst; on that burst's first frame it is stamped again,
     DECLASSIFIED, and stays so (Jason, 2026-10-17: "show the word: "CLASSIFIED" until the moment that the first triple clicks
     of the camera and the moment the triple clicks execute, I want the word to change from CLASSIFIED to DECLASSIFIED") ---------- */
  const stamp = $('#stamp'), stage = $('.hero__stage');
  let declassified = false;
  const declassify = () => {
    if (declassified || !stamp) return; declassified = true;
    stamp.firstElementChild.textContent = 'DECLASSIFIED';
    if (reduce) return;
    stamp.classList.remove('is-in'); void stamp.offsetWidth; stamp.classList.add('is-in');
    setTimeout(() => stage && stage.classList.add('is-thud'), 170);
  };

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

    /* Some browsers switch Web Audio off (Safari in Lockdown Mode). There the shutter plays from a recording of the same
       synthesised three-frame burst (assets/burst.*, frames 0.2 s apart = SHOT_GAP), through <audio> elements behind a small
       stand-in with the few AudioContext calls this code uses. One recording keeps the rhythm exact; the page measures how
       long the browser takes to start it and starts it that much early, so the first frame lands on the first flash.
       Each element is unlocked inside the visitor's tap or key press with a silent clip. The recording comes as AAC (.m4a)
       and WAV: Safari in Lockdown Mode refuses WAV ("NotSupportedError"), so AAC goes first wherever the browser says it can
       play it, and a refused format hands over to the next one at the visitor's next tap.
       Add ?sound=debug to the address to see on screen what the browser allows. */
    const sndDebug = /[?&]sound=debug\b/.test(location.search);
    const sndLog = (() => {
      if (!sndDebug) return () => {};
      const box = document.createElement('pre');
      box.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:9999;max-width:calc(100vw - 16px);max-height:40vh;overflow:auto;margin:0;padding:8px 10px;background:rgba(0,0,0,.85);color:#7CFC9A;font:11px/1.35 monospace;white-space:pre-wrap;border-radius:6px;pointer-events:none';
      document.addEventListener('DOMContentLoaded', () => document.body.appendChild(box));
      if (document.body) document.body.appendChild(box);
      return (m) => { box.textContent = `${new Date().toLocaleTimeString()} ${m}\n${box.textContent}`.slice(0, 4000); };
    })();
    const SND_FORMATS = [['m4a', 'audio/mp4; codecs="mp4a.40.2"'], ['wav', 'audio/wav']];
    sndLog(`AudioContext: ${window.AudioContext ? 'yes' : 'no'} · webkitAudioContext: ${window.webkitAudioContext ? 'yes' : 'no'} · Audio element: ${typeof Audio === 'function' ? 'yes' : 'no'}${typeof Audio === 'function' ? ' · can play ' + SND_FORMATS.map(([x, t]) => `${x}: ${new Audio().canPlayType(t) || 'no'}`).join(', ') : ''}`);
    function MediaCtx() {
      const ctx = this, sr = 44100, t0 = performance.now(), pool = [];
      const probe = new Audio(), fmts = SND_FORMATS.filter(([, t]) => probe.canPlayType(t)).concat(SND_FORMATS.filter(([, t]) => !probe.canPlayType(t)));
      let fi = 0, SHUTTER = '', SILENT = '';
      const useFormat = (i) => { fi = i; SHUTTER = new URL(`assets/burst.${fmts[i][0]}`, location.href).href; SILENT = new URL(`assets/silence.${fmts[i][0]}`, location.href).href; sndLog(`sound file format: ${fmts[i][0]}`); };
      useFormat(0);
      let at = 0, unlocking = null, lag = 40, burstT = 0; // lag: ms from play() to sound, measured on every burst
      const param = () => ({ value: 0 });
      const node = () => ({ connect() {}, gain: param(), threshold: param(), knee: param(), ratio: param(), attack: param(), release: param(), buffer: null });
      const setState = (s) => { if (ctx.state !== s) { ctx.state = s; sndLog(`sound state: ${s}`); if (ctx.onstatechange) ctx.onstatechange(); } };
      ctx.sampleRate = sr; ctx.state = 'suspended'; ctx.onstatechange = null; ctx.destination = node();
      Object.defineProperty(ctx, 'currentTime', { get: () => (performance.now() - t0) / 1000 });
      ctx.createGain = node; ctx.createDynamicsCompressor = node; ctx.createConvolver = node;
      ctx.createBuffer = (ch, n) => { const d = Array.from({ length: ch }, () => new Float32Array(n)); return { length: n, sampleRate: sr, getChannelData: (i) => d[i] }; };
      for (let i = 0; i < 2; i++) { const el = new Audio(); el.preload = 'auto'; el.src = SHUTTER; el.ok = false; pool.push(el); }
      // the burst's first frame is due in `dueMs`; from frame k0 on (the visitor may unlock the sound mid-burst)
      const playAt = (dueMs, k0) => {
        if (ctx.state !== 'running' || document.hidden) return;
        const live = pool.filter((el) => el.ok); if (!live.length) return;
        const el = live[at++ % live.length];
        if (el.src !== SHUTTER) { el.src = SHUTTER; el.load(); }
        const late = Math.max(0, lag - dueMs); // already too late to start early enough: skip into the recording instead
        try { el.currentTime = k0 * 0.2 + late / 1000; } catch {}
        el.volume = 0.75;
        const asked = performance.now(), from = el.currentTime;
        el.play().then(() => {
          // measure when the recording really started moving and keep a running average of the browser's delay
          const t = () => {
            if (el.paused) return;
            if (el.currentTime > from + 0.001) { const d = Math.max(0, performance.now() - (el.currentTime - from) * 1000 - asked); if (d < 400) lag = lag * 0.5 + d * 0.5; sndLog(`burst played · start delay ${Math.round(d)} ms · now leading by ${Math.round(lag)} ms`); }
            else requestAnimationFrame(t);
          };
          requestAnimationFrame(t);
        }).catch((e) => sndLog(`burst refused: ${e && e.name}`));
      };
      ctx.playBurst = (dueMs, k0) => {
        clearTimeout(burstT);
        if (k0 >= 3) return;
        const wait = dueMs - lag;
        if (wait <= 4) playAt(dueMs, k0); else burstT = setTimeout(() => playAt(lag, k0), wait);
      };
      ctx.createBufferSource = () => ({ buffer: null, playbackRate: param(), onended: null, connect() {}, start() {}, stop() {} });
      // play() has to start inside the tap; an element the browser refuses waits for the next tap. One allowed element is enough.
      ctx.resume = () => {
        if (pool.every((el) => el.ok)) { setState('running'); return Promise.resolve(); }
        if (unlocking) return unlocking;
        unlocking = Promise.allSettled(pool.filter((el) => !el.ok).map((el) => {
          el.src = SILENT;
          return el.play().then(() => { el.pause(); el.ok = true; el.src = SHUTTER; el.load(); })
            .catch((e) => { sndLog(`unlock refused (${fmts[fi][0]}): ${e && e.name} ${e && e.message ? '· ' + e.message : ''}`); if (e && e.name === 'NotSupportedError') el.unsupported = true; el.src = SHUTTER; throw e; });
        })).then(() => {
          unlocking = null;
          if (pool.some((el) => el.ok)) { setState('running'); return; }
          // this browser cannot decode the format: switch every element to the next one, ready for the next tap
          if (pool.some((el) => el.unsupported) && fi + 1 < fmts.length) { useFormat(fi + 1); pool.forEach((el) => { el.unsupported = false; el.src = SHUTTER; }); }
        });
        return unlocking;
      };
      ctx.suspend = () => { clearTimeout(burstT); pool.forEach((el) => el.pause()); setState('suspended'); return Promise.resolve(); };
    }

    /* shutter sound, synthesised in the browser (no audio file). Browsers allow sound only after the visitor's first tap, click or key press. */
    const AC = window.AudioContext || window.webkitAudioContext || (typeof Audio === 'function' ? MediaCtx : null);
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
      text(sndBtn.querySelector('.lens__snd-l'), s === 'off' ? 'Sound off' : s === 'on' ? 'Sound on' : fine ? 'Click to hear' : 'Tap to hear');
      text(sndBtn.querySelector('.lens__snd-s'), s === 'off' ? 'Off' : s === 'on' ? 'On' : fine ? 'Click' : 'Tap');
    };
    let armed = false;
    const arm = () => { if (armed || !AC) return; armed = true; GESTURES.forEach((ev) => addEventListener(ev, onGesture, true)); };
    const disarm = () => { if (!armed) return; armed = false; GESTURES.forEach((ev) => removeEventListener(ev, onGesture, true)); };
    const goneLive = () => { disarm(); if (!firstLive) { firstLive = true; onFirstLive(); } };
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
        // a phone can pause the audio later (another app, a call, a locked screen): re-arm so the next tap brings it back
        c.onstatechange = () => { paintSnd(); if (audioLive()) goneLive(); else if (soundOn()) arm(); };
        if (audioLive()) { disarm(); firstLive = true; }
      }
      if (snd.ctx.state !== 'running') snd.ctx.resume().catch(() => {});
      // iPhone: starting a silent sound inside the tap is what unlocks audio there
      if (gesture) { try { const s = snd.ctx.createBufferSource(); s.buffer = snd.ctx.createBuffer(1, 1, snd.ctx.sampleRate); s.connect(snd.ctx.destination); s.start(0); } catch {} }
      paintSnd();
      return snd.ctx;
    };
    const pending = new Set();
    const clickAt = (when) => {
      if (document.hidden) return;
      const c = snd.ctx, s = c.createBufferSource(), g = c.createGain();
      s.buffer = snd.buf; s.playbackRate.value = 0.97 + Math.random() * 0.06; g.gain.value = 0.85 + Math.random() * 0.15;
      s.connect(g); g.connect(snd.bus); s.onended = () => pending.delete(s); pending.add(s); s.start(Math.max(c.currentTime, when));
    };
    const silence = () => {
      pending.forEach((s) => { try { s.stop(); } catch {} }); pending.clear();
      if (snd.ctx && snd.ctx.state === 'running') snd.ctx.suspend().catch(() => {});
    };
    const whenLive = (fn) => { if (!snd.ctx) return; if (audioLive()) fn(); else snd.ctx.resume().then(() => { if (audioLive()) fn(); }).catch(() => {}); };
    if (AC) arm();
    // leaving the tab silences everything at once; coming back asks the browser to resume (allowed once the visitor has interacted)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) silence();
      else if (snd.ctx && soundOn() && !audioLive()) snd.ctx.resume().catch(() => {});
    });
    addEventListener('pagehide', silence);

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
    // the sharp circle, the photo inside it and the scope are moved on their own elements in the same frame, so they cannot drift apart
    const winEl = $('.lens__win', frame), sharpEl = $('.lens__sharp', frame), scopeEl = $('#scopePos');
    const st = (el, k, val) => { if (el && el.style[k] !== val) el.style[k] = val; };
    const apply = (px, py) => {
      const wx = (px - R).toFixed(1), wy = (py - R).toFixed(1), ox = px.toFixed(1), oy = py.toFixed(1);
      st(winEl, 'transform', `translate3d(${wx}px, ${wy}px, 0)`);
      st(sharpEl, 'transformOrigin', `${ox}px ${oy}px`);
      st(sharpEl, 'transform', `translate3d(${(R - px).toFixed(1)}px, ${(R - py).toFixed(1)}px, 0) scale(${v.zoom.toFixed(4)})`);
      st(sharpEl, 'filter', `grayscale(1) contrast(1.42) brightness(1.02) blur(${v.blur.toFixed(2)}px)`);
      st(scopeEl, 'transform', `translate3d(${(px - SD / 2).toFixed(1)}px, ${(py - SD / 2).toFixed(1)}px, 0) scale(${v.ss.toFixed(4)})`);
      put('--ox', `${ox}px`); put('--oy', `${oy}px`);
      put('--snap', v.snap.toFixed(3)); put('--ring', `${v.ring.toFixed(1)}deg`); put('--dim', v.dim.toFixed(3));
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
    const flash = () => { if (flashEl && flashEl.animate) flashEl.animate([{ opacity: 0.22 }, { opacity: 0 }], { duration: 200, easing: 'cubic-bezier(.2,.7,.2,1)' }); };
    const setShots = (k) => shotEls.forEach((el, i) => el.classList.toggle('on', i < k));

    // where each pass zeroes in and fires its burst (Jason, 2026-10-17): his face, then his pocket square, then his hand
    // holding the cup of coffee, and round again. Fractions of the photo; the ID tag comes up on the face only.
    const TARGETS = [
      { x: FX, y: FY, face: true, found: 'FACE DETECTED' },
      { x: 0.599, y: 0.405, face: false, found: 'OBJECT DETECTED' },   // the pocket square
      { x: 0.464, y: 0.649, face: false, found: 'OBJECT DETECTED' },   // the hand holding the coffee
    ];
    let tgt = TARGETS[0];
    /* timeline: wait → float → hover → snap → locked (burst) → hold → float … */
    let T = 0, phase = 'idle', t0 = 0, cyc = 0, pathNow = null, dur = 4.4, appr = [FX, FY], lockT = 0;
    let from = [FX, FY], fromZoom = ZOOM0, fromDim = 0, fromSnap = SNAP0, fFrom = 0.6, f = 0.5, lastF = 0.5;
    let shotsAt = [], fired = 0, burstSound = false, holdUntil = 0, idT0 = -1, idN = -1;
    const blinks = [], kicks = [];
    const idShow = (now) => { idT0 = now; idN = -1; lens.classList.add('is-id'); };
    const idHide = () => { idT0 = -1; lens.classList.remove('is-id'); };
    const toFloat = () => {
      tgt = TARGETS[cyc % TARGETS.length];
      const pts = PATHS[cyc % PATHS.length], last = pts[pts.length - 1];
      const dx = (last[0] - tgt.x) * W, dy = (last[1] - tgt.y) * H, dl = Math.hypot(dx, dy) || 1;
      appr = [tgt.x + ((dx / dl) * R * 0.95) / W, tgt.y + ((dy / dl) * R * 0.95) / H];
      pathNow = mkPath([cyc === 0 ? ENTRY : [x / W, y / H], ...pts, appr]);
      fromZoom = v.zoom; fromDim = v.dim; fromSnap = v.snap; fFrom = f;
      dur = cyc === 0 ? 3.2 : 4.3; phase = 'float'; t0 = T;
      lens.classList.remove('is-locked', 'is-burst'); setShots(0); idHide(); status('SCANNING');
    };
    const toHover = () => { phase = 'hover'; t0 = T; status(tgt.found); };
    // the focus bites, the brackets lock red and the first frame is taken at the same instant, LOCK_AT into the zero-in
    const LOCK_AT = 0.45, SHOT_GAP = 0.2;
    let shotWall = [];
    const soundShots = (k0) => {
      if (!audioLive() || !soundOn() || !snd.buf) return false;
      // scheduled ahead, minus the output device's delay beyond the screen's own ~25 ms (Bluetooth speakers and AirPods add up to a quarter second)
      if (snd.ctx.playBurst) { snd.ctx.playBurst(shotWall[k0] - performance.now(), k0); return true; } // no Web Audio: one recorded burst
      const now = snd.ctx.currentTime, lat = Math.max(0, (snd.ctx.outputLatency || 0) + (snd.ctx.baseLatency || 0) - 0.025), p = performance.now();
      for (let k = k0; k < 3; k++) clickAt(now + Math.max(0, (shotWall[k] - p) / 1000 - lat));
      return true;
    };
    let burstNo = 0;
    const planShots = (at) => {
      const p = performance.now();
      shotsAt = [at, at + SHOT_GAP, at + 2 * SHOT_GAP]; shotWall = shotsAt.map((t) => p + (t - T) * 1000); fired = 0; burstNo++; setShots(0);
      burstSound = soundShots(0);
      if (!burstSound && snd.ctx && soundOn()) {
        const n = burstNo;
        snd.ctx.resume().then(() => { if (audioLive() && n === burstNo && (phase === 'snap' || phase === 'locked') && !burstSound && fired < 3) burstSound = soundShots(fired); }).catch(() => {});
      }
    };
    const burstAt = (at) => { planShots(at); lens.classList.add('is-burst'); };
    const toSnap = () => {
      phase = 'snap'; t0 = T; from = [x / W, y / H]; fromZoom = v.zoom; fromDim = v.dim; fromSnap = v.snap; fFrom = clamp(Math.abs(f) + 0.25, 0.55, 1);
      idHide(); status('FOCUSING'); planShots(T + LOCK_AT);
    };
    const lockOn = () => {
      phase = 'locked'; lockT = T;
      lens.classList.remove('is-locked'); void lens.offsetWidth; lens.classList.add('is-locked', 'is-burst');
      status('SUBJECT ACQUIRED'); if (tgt.face) idShow(T);
    };
    const nudge = () => { if (!sndBtn || !soundOn() || audioLive()) return; sndBtn.classList.remove('is-nudge'); void sndBtn.offsetWidth; sndBtn.classList.add('is-nudge'); clearTimeout(nudge.t); nudge.t = setTimeout(() => sndBtn.classList.remove('is-nudge'), 1800); };
    const fire = () => { blinks.push(T); if (!reduce) kicks.push(T); fired++; setShots(fired); flash(); if (fired === 1) { nudge(); declassify(); } };
    onFirstLive = () => {
      if ((phase === 'snap' || phase === 'locked') && !burstSound && fired < 3) { burstSound = soundShots(fired); return; }
      if (!live || visRatio < 0.5) return;
      if (phase === 'hold') { phase = 'locked'; burstAt(T + 0.2); } // during a glide the burst comes at the end of it, with sound
    };
    const afterUnlock = () => whenLive(() => { paintSnd(); if ((phase === 'snap' || phase === 'locked') && !burstSound && fired < 3) burstSound = soundShots(fired); });

    // timecode, 24 fps
    const tcBase = ((0 * 60 + 47) * 60 + 12) * 24, tStart = performance.now();
    const pad = (n) => String(n).padStart(2, '0');
    const tc = (now) => { const fr = tcBase + Math.floor(((now - tStart) / 1000) * 24); const ff = fr % 24, s = Math.floor(fr / 24); tcEl.textContent = `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}:${pad(ff)}`; };

    let live = false, started = false, lastNow = 0, raf = 0, visRatio = 0;
    document.addEventListener('visibilitychange', () => { if (document.hidden) halt(); else if (started && visRatio > 0) run(); });
    const step = (now) => {
      if (!live) return;
      const dt = Math.min(0.1, (now - (lastNow || now)) / 1000); lastNow = now; T += dt;
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
        px = appr[0] + (tgt.x - appr[0]) * k; py = appr[1] + (tgt.y - appr[1]) * k;
        f = 0.45 + 0.3 * Math.sin(pt * 18);
        v.snap = SNAP0 - 0.1 * inOut(pt / 0.5);
        if (pt >= 0.5) toSnap();
      }
      if (phase === 'snap' || phase === 'locked' || phase === 'hold') {
        const s = T - t0, k = spring(s, 12, 0.62), u = clamp((s - 0.1) / (LOCK_AT - 0.1), 0, 1);
        px = from[0] + (tgt.x - from[0]) * k; py = from[1] + (tgt.y - from[1]) * k;
        v.zoom = fromZoom + (ZOOM1 - fromZoom) * spring(s, 10, 0.85);
        v.dim = fromDim + (DIM1 - fromDim) * out3(s / 0.6);
        v.snap = s < LOCK_AT ? fromSnap + (1.12 - fromSnap) * out3(s / LOCK_AT) : 1 + 0.12 * Math.exp(-(s - LOCK_AT) * 14) * Math.cos((s - LOCK_AT) * 30);
        f = s >= LOCK_AT ? 0 : fFrom * ((1 - u) ** 2.2 - 0.3 * Math.sin(Math.PI * u) ** 2 * u); // one small hunt, then it bites
        if (phase === 'snap' && (s >= LOCK_AT || now >= shotWall[0])) { if (s < LOCK_AT) T = t0 + LOCK_AT; lockOn(); }
        if (phase === 'locked') {
          while (fired < 3 && now >= shotWall[fired]) fire();
          if (fired === 3 && now >= shotWall[2] + 200) { phase = 'hold'; holdUntil = T + 6; }
        } else if (phase === 'hold' && T >= holdUntil) { cyc++; toFloat(); }
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
    const startLens = () => { if (started || visRatio < 0.35) return; started = true; phase = 'wait'; t0 = T; if (!document.hidden) run(); };
    const halt = () => { live = false; cancelAnimationFrame(raf); };

    // a click or tap on the photo (or the sound button) zeroes in and takes the burst now, with sound
    const shootNow = () => {
      if (!started) { started = true; t0 = T; run(); toFloat(); }
      if (phase === 'wait') toFloat();
      if (phase === 'float' || phase === 'hover') toSnap();
      else if (phase === 'hold') { phase = 'locked'; burstAt(T + 0.2); }
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

    // Every visitor gets the loop; when the device asks for reduced motion there is no flash, mirror kick or handheld drift.
    measure();
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => { measure(); apply(x, y); }).observe(frame);
    x = ENTRY[0] * W; y = ENTRY[1] * H; apply(x, y);
    if (AC && soundOn()) audio(false);
    new IntersectionObserver((es) => es.forEach((e) => {
      visRatio = e.intersectionRatio;
      if (!started) { if (e.intersectionRatio >= 0.35) whenGateOpen(startLens); }
      else if (e.isIntersecting && !document.hidden) run(); else halt();
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

  /* ---------- chain of custody photo pop-up (Jason, 2026-10-23: "All images located on the cards within The chain of custody
     should expand in a pop-up when clicked"). Every card photo and the poster open large in #zoom. The cards show small crops
     (assets/chain/X.png or .jpg); the pop-up shows the whole photo from assets/chain/full/X.jpg, the small one standing in
     until it has loaded. Click/tap or Enter/Space opens; the ×, Esc, or a click anywhere (photo or backdrop) closes. ---------- */
  const zoom = $('#zoom');
  if (files && zoom && typeof zoom.showModal === 'function') {
    const zImg = $('.zoom__img', zoom), zCap = $('.zoom__cap', zoom);
    let want = '';
    const fullOf = (src) => src.replace(/assets\/chain\/([^/?#]+)\.(png|jpe?g)(?=$|[?#])/, 'assets/chain/full/$1.jpg');
    const open = (img) => {
      const small = img.currentSrc || img.src, full = fullOf(small);
      zImg.src = small; zImg.alt = img.alt;
      zCap.innerHTML = img.closest('figure')?.querySelector('figcaption')?.innerHTML || '';
      want = full;
      if (full !== small) {   // swap once the big one is loaded and decoded (so the frame never flashes empty), waiting at most 0.4 s on the decode
        const pre = new Image();
        pre.onload = () => {
          const swap = () => { if (want === full && zoom.open) zImg.src = full; };
          Promise.race([pre.decode ? pre.decode() : 0, new Promise((r) => setTimeout(r, 400))]).then(swap, swap);
        };
        pre.src = full;
      }
      zoom.showModal();
    };
    $$('#files .file__pic img, #files .poster__pic img').forEach((img) => {
      const fig = img.closest('figure');
      fig.tabIndex = 0; fig.setAttribute('role', 'button'); fig.setAttribute('aria-label', `Enlarge photo: ${img.alt}`);
      fig.addEventListener('click', () => open(img));
      fig.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(img); } });
    });
    zoom.addEventListener('click', () => zoom.close());   // the ×, the photo and the dark backdrop all close it
  }

  /* ---------- the missing minute: loop the clip from the Unleashed.news post and flag the moment the clock skips ---------- */
  const cctv = $('#cctv'), vid = $('#cctvVideo');
  if (cctv && vid) {
    // seconds in the clip: it starts on the first frame reading 11:58:55 PM, the player controls are off screen until END,
    // and the clock skips at JUMP
    const START = 4.92, END = 12.75, JUMP = 8.68;
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
  const form = $('#notifyForm'), nHuman = $('#nHuman');
  if (form) form.addEventListener('focusin', () => human.mount(nHuman), { once: true });
  if (form) {
    const msg = $('#nMsg'), btn = $('#nBtn'), roleSel = $('#nRole'), pro = $('#nPro');
    const emailEl = $('#nEmail'), emailLabel = $('#nEmailLabel'), emailHint = $('#nEmailHint');
    const proInputs = $$('input, textarea', pro);
    const REQUIRED = ['nName', 'nTitle', 'nOutlet'];
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
        // the link that shows the work is optional (2026-10-15), but one that is given must be a real address
        let link = v('nLink'); if (link && !/^https?:\/\//i.test(link)) link = `https://${link}`;
        let okLink = !link; try { if (link) okLink = new URL(link).hostname.includes('.'); } catch {}
        if (!okLink) return bad($('#nLink'), 'Please check the link to your work, or leave it blank.');
        if (!$('#nAgree').checked) return bad($('#nAgree'), 'Please agree to keep the advance material confidential.');
        Object.assign(body, { name: v('nName'), title: v('nTitle'), outlet: v('nOutlet'), link, audience: v('nAudience'), handle: v('nHandle'), note: $('#nNote').value.trim(), agreed: true });
      }
      btn.disabled = true; btn.textContent = 'Checking…';
      try {
        body.human = await human.token(nHuman, 6000, () => { msg.textContent = 'Please tick the box to confirm you are human.'; });
        body.website = (form.elements.website || {}).value || '';
        btn.textContent = 'Sending…'; msg.textContent = '';
        const r = await fetch(SIGNUP_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
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

  /* ---------- press kit: one tap shows the short or the full bio in the card and copies it. The full bio is the author
     section's own text ("The operator behind the curtain"), so the two never drift apart. ---------- */
  const bioCard = $('#bioCard');
  if (bioCard) {
    const short = $('#shortBio'), full = $('#fullBio'), title = $('#bioTitle');
    const fullParas = $$('.author__bio .prose p').map((p) => {
      const c = p.cloneNode(true);
      c.querySelectorAll('[aria-hidden="true"]').forEach((e) => e.remove());
      return c.textContent.replace(/\s+/g, ' ').trim();
    }).filter(Boolean);
    full.replaceChildren(...fullParas.map((t) => Object.assign(document.createElement('p'), { textContent: t })));
    // copies plain text during the tap itself, which browsers allow even where the newer clipboard API is refused (that API
    // is the fallback); readonly keeps an iPhone's keyboard from opening
    const copyNow = (text) => {
      const ta = Object.assign(document.createElement('textarea'), { value: text });
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px';
      document.body.append(ta); ta.select(); ta.setSelectionRange(0, text.length);
      let ok = false; try { ok = document.execCommand('copy'); } catch {}
      ta.remove(); getSelection().removeAllRanges();
      return ok;
    };
    $$('[data-bio]', bioCard).forEach((btn) => btn.addEventListener('click', async () => {
      const isFull = btn.dataset.bio === 'full';
      const text = isFull ? fullParas.join('\n\n') : short.textContent.trim();
      const copying = copyNow(text) ? Promise.resolve() : navigator.clipboard?.writeText(text);
      const at = bioCard.getBoundingClientRect().top + scrollY;   // the card's place on the page (nothing above it changes)
      short.hidden = isFull; full.hidden = !isFull; title.textContent = isFull ? 'Full bio' : 'Short bio';
      // the browser keeps the buttons where they were, so the new text can start above the screen: bring its heading back
      requestAnimationFrame(() => { const navH = $('.nav')?.offsetHeight || 0; if (at - scrollY < navH) scrollTo({ top: at - navH - 12, behavior: 'smooth' }); });
      try { if (!copying) throw 0; await copying; toast(isFull ? 'Full bio copied.' : 'Short bio copied.'); }
      catch { const r = document.createRange(); r.selectNodeContents(isFull ? full : short); const s = getSelection(); s.removeAllRanges(); s.addRange(r); toast('Bio selected. Press Copy.'); }
    }));
  }

  /* ---------- press kit: on an iPhone or iPad the cover and author-photo buttons save to Photos (Jason, 2026-10-17). A web
     page cannot write to Photos itself, so the tap opens the share sheet with the picture, and its Save Image puts it
     there. The share sheet opens only during the tap, so each picture is read ahead as the press kit comes near. A browser
     without a share sheet shows the picture in a pop-up, to press and hold (Save to Photos). Android keeps the download,
     which Gallery and Google Photos show. ---------- */
  const IOS = !/Android/i.test(navigator.userAgent)   // an iPad reports itself as a Mac with a touch screen
    && (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
  if (IOS) $$('[data-photos]').forEach((a) => {
    a.textContent = 'Save to Photos';
    let file = null, asked = false;
    const load = () => { if (asked) return; asked = true; fetch(a.href).then((r) => (r.ok ? r.blob() : null)).then((b) => {
      if (b) file = new File([b], a.getAttribute('download') || 'photo.jpg', { type: 'image/jpeg' });
    }).catch(() => { asked = false; }); };
    if ('IntersectionObserver' in window) new IntersectionObserver((es, io) => { if (es.some((x) => x.isIntersecting)) { io.disconnect(); load(); } }, { rootMargin: '1200px 0px' }).observe(a);
    else load();
    const pressAndHold = () => {
      const d = $('#photo-save');
      if (!d || typeof d.showModal !== 'function') { location.href = a.href; return; }
      $('#photo-save-title').textContent = a.dataset.saveTitle || 'Save the picture';
      $('.coverd__img', d).src = a.href;
      d.showModal();
    };
    a.addEventListener('click', (e) => {
      e.preventDefault();
      if (file && navigator.canShare?.({ files: [file] })) navigator.share({ files: [file] }).catch((err) => { if (err?.name !== 'AbortError') pressAndHold(); });
      else pressAndHold();
    });
  });

  /* ---------- the next day: Pam Bondi at the Cabinet meeting (a portrait clip under the missing minute). A centred play button
     starts it with sound, a tap on the picture pauses or resumes, and the button at the lower right goes full screen
     (the native controls show there; on an iPhone the system player takes over). ---------- */
  const bondi = $('#bondi');
  if (bondi) {
    const v = $('video', bondi), playBtn = $('.bondi__play', bondi), fullBtn = $('.bondi__full', bondi);
    const sync = () => {
      bondi.classList.toggle('is-playing', !v.paused && !v.ended);
      playBtn.setAttribute('aria-label', v.ended ? 'Play again' : 'Play video');
    };
    const play = () => { v.muted = false; v.play().catch(() => {}); };
    playBtn.addEventListener('click', play);
    v.addEventListener('click', () => { if (v.paused) play(); else v.pause(); });
    ['play', 'pause', 'ended'].forEach((ev) => v.addEventListener(ev, sync));
    fullBtn.addEventListener('click', () => {
      const enter = v.requestFullscreen || v.webkitRequestFullscreen;
      if (enter) { const p = enter.call(v); if (p && p.catch) p.catch(() => {}); } else if (v.webkitEnterFullscreen) v.webkitEnterFullscreen();
      if (v.paused) play();
    });
    const onFs = () => { v.controls = (document.fullscreenElement || document.webkitFullscreenElement) === v; };
    document.addEventListener('fullscreenchange', onFs);
    document.addEventListener('webkitfullscreenchange', onFs);
  }
  // "Read the transcript" opens her answer about the missing minute in a pop-up (closed like the press pop-ups, below);
  // without this script the link still goes to the full Roll Call transcript
  $$('[data-transcript]').forEach((a) => a.addEventListener('click', (e) => {
    const d = document.getElementById(a.dataset.transcript);
    if (!d) return;
    e.preventDefault();
    if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
  }));

  /* ---------- press requests: the "Interviews & bookings" and "Representation & rights" cards open their own pop-up form.
     Answers go to PitchZing (POST /public/book-site/request), which stores them and emails each one on, Reply-To the
     requester. The cards keep their mailto links for a browser without this script. ---------- */
  const REQUEST_URL = 'https://pitchzing-haro.pitchzing.workers.dev/public/book-site/request';
  const reqOpen = (kind) => {
    const d = $(`#req-${kind}`);
    if (!d) return;
    const f = $('form', d), msg = $('.reqd__msg', d);
    const em = f.elements.email;
    if (!em.value) { try { em.value = localStorage.getItem('cia_email') || ''; } catch {} }   // the address from the opening screen
    msg.textContent = ''; msg.classList.remove('is-err');
    human.mount($('.human', d));
    if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
    setTimeout(() => f.elements.name.focus(), 50);
  };
  $$('[data-request]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); reqOpen(a.dataset.request); }));
  $$('a[href="#rights"]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); reqOpen('rights'); }));
  $$('.reqd').forEach((d) => {
    $$('[data-close]', d).forEach((b) => b.addEventListener('click', () => d.close()));
    // a click on the dimmed backdrop, outside the box: on an iPhone the keyboard closing as a button is tapped moves the box,
    // and the tap can land on its own padding (target is the dialog too), which must not close it (Jason, 2026-10-17)
    d.addEventListener('click', (e) => {
      if (e.target !== d) return;
      const r = d.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close();
    });
  });
  $$('.reqd__form').forEach((f) => {
    const msg = $('.reqd__msg', f), btn = $('.reqd__send', f), box = $('.human', f);
    const checks = {
      name: (v) => v.length >= 2,
      org_type: (v) => !!v,
      org_name: (v) => v.length >= 2,
      email: (v) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v),
      phone: (v) => { const d = v.replace(/\D/g, ''); return d.length >= 7 && d.length <= 15 && !/[^\d\s()+.\-]/.test(v); },
      website: (v) => /^(https?:\/\/)?[^\s/]+\.[^\s]{2,}/i.test(v),
    };
    f.addEventListener('input', (e) => { const fld = e.target.closest('.reqd__field'); if (fld) fld.classList.remove('is-bad'); });
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const v = (n) => String(f.elements[n].value || '').trim();
      // a field without `required` (the website on an interview request) may be left blank, but one that is filled in must be valid
      const bad = Object.keys(checks).filter((n) => (v(n) || f.elements[n].required) && !checks[n](v(n)));
      $$('.reqd__field', f).forEach((fld) => fld.classList.toggle('is-bad', bad.includes(($('input, select', fld) || {}).name)));
      msg.classList.remove('is-err');
      if (bad.length) {
        msg.textContent = bad.some((n) => f.elements[n].required) ? 'Please fill in every field marked *.' : 'Please check the website address, or leave it blank.';
        msg.classList.add('is-err'); f.elements[bad[0]].focus(); return;
      }
      const label = btn.innerHTML;
      btn.disabled = true; btn.textContent = 'Sending…'; msg.textContent = '';
      try {
        const token = await human.token(box, 6000, () => { msg.textContent = 'Tick the box to confirm you are human.'; });
        const body = { kind: f.dataset.kind, name: v('name'), org_type: v('org_type'), org_name: v('org_name'), email: v('email'), phone: v('phone'), website: v('website'), hp: v('hp'), human: token, site: 'theciaasset.com', page: location.href };
        const r = await fetch(REQUEST_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || `The request could not be sent (${r.status}). Please try again.`);
        const first = v('name').split(/\s+/)[0];
        f.outerHTML = `<p class="reqd__done"><strong>Thank you${first ? `, ${first.replace(/[<>&"]/g, '')}` : ''}.</strong> Your ${f.dataset.kind === 'rights' ? 'inquiry' : 'request'} has been sent, and you will hear back by email or phone.</p><button class="btn btn--ghost btn--sm" type="button" data-close>Close</button>`;
        $$('[data-close]', $(`#req-${body.kind}`)).forEach((b) => b.addEventListener('click', () => $(`#req-${body.kind}`).close()));
      } catch (err) {
        msg.textContent = err && err.message && !/Failed to fetch|NetworkError|Load failed/i.test(err.message) ? err.message : 'The request could not be sent. Check your connection and try again.';
        msg.classList.add('is-err');
        btn.disabled = false; btn.innerHTML = label;
      }
    });
  });

  /* ---------- pre-order: the early-reader price ends with Election Day (midnight Eastern, November 4, 2026), then the full price shows.
     Square charges the item's own price, so raise it to $14.99 in the Square item library the same day. ---------- */
  if (Date.now() >= Date.parse('2026-11-04T05:00:00Z')) {
    $$('[data-early]').forEach((el) => el.remove());
    $$('[data-price]').forEach((el) => { el.textContent = el.dataset.price; });
  }

  /* ---------- donations until midnight Eastern after Election Day (November 4, 05:00 UTC): each package has one button,
     "Donate & get …", to its Square donation link (any amount from $1; the donor's checkout email is where the book goes).
     Then the donation buttons ([data-giveaway]) give way to the paid packages ([data-paid]); a page left open switches
     on the minute. ---------- */
  const FULL_AT = Date.parse('2026-11-04T05:00:00Z');
  const toPaid = () => {
    $$('[data-giveaway]').forEach((el) => { el.hidden = true; });
    $$('[data-paid]').forEach((el) => { el.hidden = false; });
  };
  const untilFull = FULL_AT - Date.now();
  if (untilFull <= 0) toPaid(); else if (untilFull < 2 ** 31 - 1) setTimeout(toPaid, untilFull);

  // One-time / Monthly switch (Monthly on every visit; Jason, 2026-10-17): swaps each donation button's link and wording, and "From $1" → "/mo".
  const freqOpts = $$('.freq__opt');
  const monthlyBits = $$('[data-monthly-text]');
  monthlyBits.forEach((el) => {
    const t = [...el.childNodes].find((n) => n.nodeType === 3 && n.nodeValue.trim());
    el.dataset.onceText = t ? t.nodeValue.trim() : '';
    if (el.href) el.dataset.onceHref = el.getAttribute('href');
  });
  const setFreq = (freq) => {
    freqOpts.forEach((o) => o.setAttribute('aria-checked', String(o.dataset.freq === freq)));
    monthlyBits.forEach((el) => {
      const monthly = freq === 'monthly';
      const t = [...el.childNodes].find((n) => n.nodeType === 3 && n.nodeValue.trim());
      if (t) t.nodeValue = (monthly ? el.dataset.monthlyText : el.dataset.onceText) + (el.matches('a, button') ? ' ' : '');
      if (el.dataset.onceHref) el.setAttribute('href', monthly ? el.dataset.monthlyHref : el.dataset.onceHref);
    });
  };
  freqOpts.forEach((o) => {
    o.addEventListener('click', () => setFreq(o.dataset.freq));
    o.addEventListener('keydown', (e) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
      e.preventDefault();
      const next = freqOpts.find((x) => x !== o);
      setFreq(next.dataset.freq); next.focus();
    });
  });
  if (freqOpts.length) setFreq('monthly');

  /* ---------- the ebook plus the entire Master Claims document: its amount is chosen here, from $10, one-time or monthly
     (Jason, 2026-10-16/17: "It must NEVER allow anyone to donate less than $10 in order to obtain The Book + The Master
     Claims Document!"; "Make this the case for both Monthly AND One time"). A Square donation link takes any amount from $1,
     so PitchZing opens a Square checkout for exactly the amount chosen (POST /public/book-store/checkout): a payment, or a
     monthly subscription at that amount. Below $10 there is no checkout. ---------- */
  const CHECKOUT_URL = 'https://pitchzing-haro.pitchzing.workers.dev/public/book-store/checkout';
  const amt = $('#amt');
  if (amt) {
    // the same window for both (Jason, 2026-10-17: the ebook's button opens it too, with the ebook's agreed amounts, $10 first;
    // the amounts are those its Square donation links suggested). min: the least that gets that package.
    const KINDS = {
      ebook: { name: 'The ebook', what: 'the ebook', min: 100, start: 1000, amounts: [1000, 2000, 5000, 10000, 30000, 50000, 100000] },
      bundle: { name: 'The ebook plus the entire Master Claims document', what: 'the ebook plus the entire Master Claims document', min: 1000, start: 2000, amounts: [1000, 2000, 5000, 10000, 30000, 50000, 100000] },   // $1,000 too (Jason, 2026-10-17)
      audiobook: { name: 'The audiobook', what: 'the audiobook', min: 1000, start: 2000, amounts: [1000, 2000, 5000, 10000, 30000, 50000, 100000] },   // from $10 (Jason, 2026-10-20), with the ebook
    };
    const MAX = 500000;
    const grid = $('.amt__grid', amt), other = $('#amtOther'), go = $('#amtGo'), msg = $('#amtMsg');
    let product = 'bundle', K = KINDS.bundle, monthly = false, cents = 0, busy = false, raisedAt = 0;
    const usd = (c) => '$' + (c / 100).toLocaleString('en-US', { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 });
    const say = (t, bad) => { msg.textContent = t; msg.classList.toggle('is-err', !!bad); };
    const under = () => `${usd(K.min)}${monthly ? ' a month' : ''} is the minimum for ${K.what}.`;
    // the button can only be pressed from the minimum to $5,000: below it, it reads "$10 minimum" (or $1) and is greyed out
    const paint = () => {
      $$('.amt__opt', grid).forEach((o) => o.setAttribute('aria-checked', String(!other.value.trim() && Number(o.dataset.cents) === cents)));
      const ok = cents >= K.min && cents <= MAX;
      go.disabled = !ok || busy;
      go.firstChild.nodeValue = ok ? `Donate ${usd(cents)}${monthly ? ' a month' : ''} ` : cents > MAX ? `${usd(MAX)} at most ` : `${usd(K.min)} minimum `;
      if (other.value.trim() && cents < K.min) say(under(), true); else if (cents > MAX) say(`Please choose ${usd(MAX)} or less here.`, true); else if (msg.classList.contains('is-err')) say('');
    };
    const fromOther = () => { const v = parseFloat(other.value.replace(/[$,\s]/g, '')); return Number.isFinite(v) ? Math.round(v * 100) : 0; };
    grid.addEventListener('click', (e) => { const o = e.target.closest('.amt__opt'); if (!o) return; other.value = ''; cents = Number(o.dataset.cents); say(''); paint(); });
    // digits and one decimal point only; nothing under the minimum survives leaving the box: it becomes the minimum
    other.addEventListener('input', () => {
      const clean = other.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1').replace(/^(\d*\.\d{0,2}).*$/, '$1');
      if (clean !== other.value) other.value = clean;
      cents = fromOther(); paint();
    });
    other.addEventListener('blur', () => {
      if (!other.value.trim()) return;
      if (cents < K.min) { cents = K.min; other.value = String(K.min / 100); raisedAt = Date.now(); paint(); say(`Raised to the ${usd(K.min)}${monthly ? ' a month' : ''} minimum. Tap Donate to continue.`); }
    });
    $$('[data-amount]').forEach((b) => b.addEventListener('click', () => {
      product = KINDS[b.dataset.amount] ? b.dataset.amount : 'bundle'; K = KINDS[product];
      monthly = $('.freq__opt[data-freq="monthly"]')?.getAttribute('aria-checked') === 'true';
      $('#amtKicker').textContent = K.name;
      $('#amtTitle').textContent = monthly ? 'Choose your monthly donation' : 'Choose your donation';
      $('#amtSub').textContent = monthly ? `From ${usd(K.min)} a month. Square’s secure checkout opens next for exactly this amount, each month until you cancel.` : `From ${usd(K.min)}. Square’s secure checkout opens next for exactly this amount.`;
      $('#amtFine').innerHTML = monthly ? 'Cancel anytime at <a href="/cancel/">theciaasset.com/cancel</a>. All donations are final: no refunds.' : 'All donations are final: no refunds.';
      grid.innerHTML = K.amounts.map((c) => `<button type="button" class="amt__opt" role="radio" data-cents="${c}">${usd(c)}</button>`).join('');
      other.placeholder = `${usd(K.min)} or more`;
      cents = K.start; other.value = ''; say(''); busy = false; paint();
      if (typeof amt.showModal === 'function') amt.showModal(); else amt.setAttribute('open', '');
    }));
    $('#amtForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (busy) return;
      if (Date.now() - raisedAt < 700) return;   // the tap that left the box (and raised it to the minimum) only shows the new amount
      if (!(cents >= K.min)) { say(under(), true); paint(); return; }
      if (cents > MAX) { say(`Please choose ${usd(MAX)} or less here.`, true); other.focus(); return; }
      busy = true; go.disabled = true; say('Opening Square’s secure checkout…');
      const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 20000);
      try {
        const r = await fetch(CHECKOUT_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ product, monthly, cents }), signal: ctl.signal });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.url) throw new Error(j.error || 'The checkout did not open. Please try again.');
        location.href = j.url;
      } catch (err) { busy = false; paint(); say(err.name === 'AbortError' ? 'Square did not answer in time. Please tap again.' : err.message, true); }
      finally { clearTimeout(timer); }
    });
  }

  /* ---------- release: at 8 AM Eastern on October 20, 2026 (EDT, 12:00 UTC) the pre-order wording becomes the release wording.
     A page left open switches on the minute. The book itself is emailed by the store worker, not by this page. ---------- */
  const RELEASE_AT = Date.parse('2026-10-20T12:00:00Z');
  const release = () => $$('[data-release-text]').forEach((el) => {
    const t = [...el.childNodes].find((n) => n.nodeType === 3 && n.nodeValue.trim());
    if (t) t.nodeValue = el.dataset.releaseText + (/\s$/.test(t.nodeValue) ? ' ' : '');
  });
  const untilRelease = RELEASE_AT - Date.now();
  if (untilRelease <= 0) release(); else if (untilRelease < 2 ** 31 - 1) setTimeout(release, untilRelease);

  /* ---------- the audiobook (2026-10-20): its package stays hidden until PitchZing says its files are up and it is on sale
     (the store answers ready, with how long it is); then its card, the "or the audiobook" mentions and its fine print show. ---------- */
  if ($('[data-audiobook]')) {
    fetch('https://pitchzing-haro.pitchzing.workers.dev/public/book-store/audiobook').then((r) => r.json()).then((j) => {
      if (!j || !j.ready) return;
      const what = $('#audiobookWhat');
      if (what && j.hours) what.textContent = `About ${j.hours} hours in ${j.chapters} chapters, the whole book in the author’s own voice, with the ebook. It plays in your protected copy, chapter by chapter, and keeps your place.`;
      // its fixed-price button (from Nov 4) needs its Square payment link; until that is in the page it stays hidden
      const buy = $('[data-audiobook-buy]');
      if (buy && /#preorder$/.test(buy.getAttribute('href') || '')) buy.removeAttribute('data-paid');
      $$('[data-audiobook]').forEach((el) => { el.hidden = false; });
    }).catch(() => {});
  }

  /* ---------- the audiobook's free sample (Jason, 2026-10-27: "I want visitors to be able to listen to half of the
     Introduction and then it will fade out"): assets/audiobook-sample.mp3 already fades out, so the player only plays,
     pauses, shows the time left and lets a tap on the line jump. It lives in the audiobook card, so it appears with it. ---------- */
  const sample = $('[data-sample]');
  if (sample) {
    const audio = $('[data-sample-audio]', sample), btn = $('[data-sample-btn]', sample);
    const fill = $('[data-sample-fill]', sample), bar = $('[data-sample-bar]', sample), left = $('[data-sample-time]', sample);
    const LEN = 117.2;   // the file's length, until the browser has read it
    const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    const dur = () => (Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : LEN);
    const show = () => { fill.style.width = `${(audio.currentTime / dur() * 100).toFixed(2)}%`; left.textContent = fmt(Math.max(0, dur() - audio.currentTime)); };
    const state = (on) => { sample.classList.toggle('is-playing', on); btn.setAttribute('aria-label', on ? 'Pause the sample' : 'Play a sample of the audiobook'); };
    btn.addEventListener('click', () => { if (audio.paused) audio.play().catch(() => state(false)); else audio.pause(); });
    bar.addEventListener('click', (e) => {
      const r = bar.getBoundingClientRect();
      audio.currentTime = clamp((e.clientX - r.left) / r.width, 0, 1) * dur(); show();
      if (audio.paused) audio.play().catch(() => {});
    });
    audio.addEventListener('play', () => state(true));
    audio.addEventListener('pause', () => state(false));
    audio.addEventListener('timeupdate', show);
    audio.addEventListener('ended', () => { state(false); audio.currentTime = 0; show(); });
  }

  /* ---------- thank-you pop-up: Square sends a donor back here (?donated=ebook|bundle|audiobook; the opening screen is skipped).
     The book goes to the address typed at Square's checkout as a private reader link; the pop-up says so. ---------- */
  const thanks = $('#thanks');
  const donatedFor = new URLSearchParams(location.search).get('donated');
  if (thanks && (donatedFor === 'ebook' || donatedFor === 'bundle' || donatedFor === 'audiobook')) {
    history.replaceState(null, '', location.pathname + location.hash);   // a refresh or a shared link does not reopen it
    $('#thanksWhat').textContent = donatedFor === 'bundle' ? 'the ebook and the Master Claims document' : donatedFor === 'audiobook' ? 'the audiobook and the ebook' : 'the ebook';
    if (Date.now() >= RELEASE_AT) $('#thanksWhen').textContent = 'within a minute';
    // tell the book store to look at Square now, so the copy is emailed within seconds (bookstore.mjs ping; it reads
    // Square itself, so this only says "look now")
    try { fetch('https://pitchzing-haro.pitchzing.workers.dev/public/book-store/ping', { method: 'POST', keepalive: true, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ from: 'thank-you', for: donatedFor }) }).catch(() => {}); } catch {}
    if (Date.now() >= FULL_AT) {   // donations no longer come with a package once the giveaway is over
      $('#thanksSent').textContent = 'Your support means a great deal.';
      $('#thanksHow').hidden = true;
    }
    $$('[data-close]', thanks).forEach((b) => b.addEventListener('click', () => thanks.close()));
    thanks.addEventListener('click', (e) => { if (e.target === thanks) thanks.close(); });   // a click on the dimmed backdrop
    if (typeof thanks.showModal === 'function') thanks.showModal(); else thanks.setAttribute('open', '');
  }

  /* ---------- links from earlier emails ---------- */
  const qp = new URLSearchParams(location.search);
  if (fresh && (qp.has('amount') || qp.has('section'))) setTimeout(() => $('#notify')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }), 600);
  if (qp.get('payment') === 'success') setTimeout(() => toast('Thank you for supporting the book.'), 800);

  const yr = $('#year'); if (yr) yr.textContent = String(new Date().getFullYear());
})();
