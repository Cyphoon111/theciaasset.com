/* theciaasset.com interactions (2026-10-10). No dependencies. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

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

  /* ---------- stamp ---------- */
  const stamp = $('#stamp'), stage = $('.hero__stage');
  if (stamp && !reduce) setTimeout(() => { stamp.classList.add('is-in'); setTimeout(() => stage && stage.classList.add('is-thud'), 170); }, 1700);

  /* ---------- lens: floating viewfinder that racks focus onto the subject ---------- */
  const lens = $('#lens');
  if (lens) {
    const frame = $('#lensFrame'), ticks = $('#scopeTicks');
    const tcEl = $('#hudTc'), distEl = $('#hudDist'), statusEl = $('#hudStatus'), needle = $('#hudNeedle');
    const FX = parseFloat(lens.dataset.fx) / 100, FY = parseFloat(lens.dataset.fy) / 100, FR = parseFloat(lens.dataset.fr) || 0.17;
    const NS = 'http://www.w3.org/2000/svg';
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

    let W = 0, H = 0, R = 90, SD = 214;
    const measure = () => {
      const b = frame.getBoundingClientRect(), w0 = W, h0 = H;
      W = b.width; H = b.height; R = Math.max(52, Math.round(W * FR)); SD = Math.round((240 * R) / 101);
      frame.style.setProperty('--fw', `${W}px`); frame.style.setProperty('--fh', `${H}px`);
      frame.style.setProperty('--d', `${R * 2}px`); frame.style.setProperty('--sd', `${SD}px`);
      if (w0 && h0) { x *= W / w0; y *= H / h0; tx *= W / w0; ty *= H / h0; }
    };
    let x = 0, y = 0, vx = 0, vy = 0, tx = 0, ty = 0;
    let f = 1, fv = 0, lastF = 1, ring = 0, locked = false, settle = 0;
    const set = (k, v) => frame.style.setProperty(k, v);
    const apply = (px, py) => {
      const blur = 8 * Math.min(1.2, Math.abs(f)), zoom = 1.05 + 0.13 * (1 - clamp(Math.abs(f), 0, 1));
      set('--wx', `${(px - R).toFixed(1)}px`); set('--wy', `${(py - R).toFixed(1)}px`);
      set('--ix', `${(R - px).toFixed(1)}px`); set('--iy', `${(R - py).toFixed(1)}px`);
      set('--ox', `${px.toFixed(1)}px`); set('--oy', `${py.toFixed(1)}px`);
      set('--sx', `${(px - SD / 2).toFixed(1)}px`); set('--sy', `${(py - SD / 2).toFixed(1)}px`);
      set('--focus', `${blur.toFixed(2)}px`); set('--zoom', zoom.toFixed(3));
      set('--snap', (1 + 0.34 * clamp(Math.abs(f) * 1.4, 0, 1)).toFixed(3)); set('--ring', `${ring.toFixed(1)}deg`);
    };
    const faceX = () => FX * W, faceY = () => FY * H;
    const status = (s) => { if (statusEl.textContent !== s) statusEl.textContent = s; };
    const lock = () => {
      locked = true; lens.classList.remove('is-locked'); void lens.offsetWidth; lens.classList.add('is-locked');
      status(Math.hypot(x - faceX(), y - faceY()) < R * 0.7 ? 'SUBJECT ACQUIRED' : 'FOCUS LOCK');
    };
    const unlock = (s) => { if (locked) { locked = false; lens.classList.remove('is-locked'); } status(s); };

    // timecode, 24 fps
    const tcBase = ((0 * 60 + 47) * 60 + 12) * 24, t0 = performance.now();
    const pad = (n) => String(n).padStart(2, '0');
    const tc = (now) => { const fr = tcBase + Math.floor(((now - t0) / 1000) * 24); const ff = fr % 24, s = Math.floor(fr / 24); tcEl.textContent = `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}:${pad(ff)}`; };

    measure();
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => { measure(); if (reduce) { x = faceX(); y = faceY(); apply(x, y); } }).observe(frame);

    if (reduce) {
      x = faceX(); y = faceY(); f = 0; apply(x, y); lock();
    } else {
      // choreography: drift across the frame, hunt, then rack focus onto the face
      const intro = [[0.18, 0.74], [0.74, 0.58], [0.3, 0.4], [FX, FY]];
      let mode = 'wait', wp = 0, modeAt = performance.now(), nextDrift = 0, ptr = null, ptrAt = 0;
      x = intro[0][0] * W; y = intro[0][1] * H; tx = x; ty = y; apply(x, y); status('SEARCHING');
      const toFace = () => { tx = faceX(); ty = faceY(); };
      const scheduleDrift = (now) => { nextDrift = now + 7000 + Math.random() * 4000; };

      if (fine) {
        frame.addEventListener('pointermove', (e) => {
          const b = frame.getBoundingClientRect();
          ptr = [clamp(e.clientX - b.left, 0, W), clamp(e.clientY - b.top, 0, H)]; ptrAt = performance.now();
          if (mode !== 'follow') { mode = 'follow'; unlock('TRACKING'); }
        });
        frame.addEventListener('pointerleave', () => { ptr = null; mode = 'return'; toFace(); unlock('RE-ACQUIRING'); });
      }

      let running = false, last = 0, raf = 0;
      const step = (now) => {
        if (!running) return;
        const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
        tc(now);

        // targets by mode
        if (mode === 'wait') { if (now - modeAt > 700) { mode = 'intro'; wp = 1; tx = intro[1][0] * W; ty = intro[1][1] * H; status('SEARCHING'); } }
        else if (mode === 'intro') {
          const d = Math.hypot(tx - x, ty - y);
          if (wp < intro.length - 1 && d < W * 0.07) { wp++; tx = intro[wp][0] * W; ty = intro[wp][1] * H; if (wp === intro.length - 1) status('FOCUSING'); }
          if (wp === intro.length - 1) toFace();
          if (locked && wp === intro.length - 1) { mode = 'hold'; scheduleDrift(now); }
        } else if (mode === 'hold') {
          toFace();
          if (now > nextDrift) { mode = 'drift'; modeAt = now; const a = Math.random() * Math.PI * 2; tx = clamp(faceX() + Math.cos(a) * W * 0.16, R * 0.4, W - R * 0.4); ty = clamp(faceY() + Math.abs(Math.sin(a)) * H * 0.12, R * 0.4, H - R * 0.4); unlock('ADJUSTING'); }
        } else if (mode === 'drift') {
          if (now - modeAt > 1100) { mode = 'return'; toFace(); status('RE-ACQUIRING'); }
        } else if (mode === 'return') {
          toFace(); if (locked) { mode = 'hold'; scheduleDrift(now); }
        } else if (mode === 'follow' && ptr) { tx = ptr[0]; ty = ptr[1]; }

        // camera-operator motion: a slightly under-damped spring toward the target
        const k = mode === 'follow' ? 30 : mode === 'intro' ? 9.5 : 12, c = mode === 'follow' ? 9.5 : 5.6;
        vx += (k * (tx - x) - c * vx) * dt; vy += (k * (ty - y) - c * vy) * dt;
        x += vx * dt; y += vy * dt;
        const speed = Math.hypot(vx, vy), dist = Math.hypot(tx - x, ty - y);

        // focus: loose while moving, then a quick rack with one or two hunts before it bites
        const still = dist < 3 && speed < 22 && (mode !== 'follow' || now - ptrAt > 140);
        const fT = still ? 0 : clamp(speed / 360 + dist / (W * 0.5), 0.15, 1);
        fv += (60 * (fT - f) - 7.2 * fv) * dt; f += fv * dt;
        ring += (f - lastF) * 260; lastF = f;
        if (!locked && still && Math.abs(f) < 0.035 && Math.abs(fv) < 0.4) { settle += dt; if (settle > 0.16) lock(); } else if (!still) settle = 0;
        if (locked && (dist > 7 || speed > 70)) unlock(mode === 'follow' ? 'TRACKING' : 'FOCUSING');

        // handheld micro-movement only while holding focus
        const t = now / 1000, amp = locked ? 1.3 : 0;
        const jx = amp * (Math.sin(t * 1.31) + 0.6 * Math.sin(t * 2.73 + 1.1) + 0.3 * Math.sin(t * 5.2 + 2.3));
        const jy = amp * (Math.sin(t * 1.07 + 0.5) + 0.55 * Math.sin(t * 2.41 + 2.2) + 0.3 * Math.sin(t * 4.6 + 0.7));
        apply(x + jx, y + jy);
        distEl.textContent = (2.4 + 5.2 * clamp(Math.abs(f), 0, 1)).toFixed(1);
        if (needle) needle.style.setProperty('--needle', (Math.sin(t * 0.7) * 4 + Math.sin(t * 2.3) * 1.5).toFixed(1));
        raf = requestAnimationFrame(step);
      };
      new IntersectionObserver((es) => es.forEach((e) => {
        if (e.isIntersecting && !running) { running = true; last = 0; raf = requestAnimationFrame(step); }
        else if (!e.isIntersecting && running) { running = false; cancelAnimationFrame(raf); }
      }), { threshold: 0.05 }).observe(lens);
    }
  }

  /* ---------- chain thread draws as you scroll ---------- */
  const files = $('#files');
  if (files) {
    let tick = false;
    const draw = () => { tick = false; const b = files.getBoundingClientRect(); const p = clamp((innerHeight * 0.6 - b.top) / b.height, 0, 1); files.style.setProperty('--thread', `${(p * 100).toFixed(1)}%`); };
    addEventListener('scroll', () => { if (!tick) { tick = true; requestAnimationFrame(draw); } }, { passive: true });
    draw();
  }

  /* ---------- CCTV: the timestamp jumps past midnight ---------- */
  const cctv = $('#cctv');
  if (cctv) {
    const dEl = $('#cctvDate'), tEl = $('#cctvTime');
    const showGap = () => { dEl.textContent = '8/10/2019'; tEl.textContent = '12:00:00 AM'; cctv.classList.add('is-gap'); };
    if (reduce) showGap();
    else {
      let timer = 0, active = false;
      const wait = (ms) => new Promise((r) => { timer = setTimeout(r, ms); });
      const run = async () => {
        while (active) {
          cctv.classList.remove('is-gap', 'is-glitch'); dEl.textContent = '8/9/2019';
          for (const s of ['55', '56', '57', '58']) { if (!active) return; tEl.textContent = `11:58:${s} PM`; await wait(720); }
          if (!active) return;
          cctv.classList.add('is-glitch'); await wait(360); cctv.classList.remove('is-glitch');
          showGap();
          for (const s of ['01', '02', '03']) { await wait(900); if (!active) return; tEl.textContent = `12:00:${s} AM`; }
          await wait(1600);
        }
      };
      new IntersectionObserver((es) => es.forEach((e) => {
        if (e.isIntersecting && !active) { active = true; run(); }
        else if (!e.isIntersecting && active) { active = false; clearTimeout(timer); }
      }), { threshold: 0.35 }).observe(cctv);
    }
  }

  /* ---------- notify form ---------- */
  const form = $('#notifyForm');
  if (form) {
    const msg = $('#nMsg'), btn = $('#nBtn');
    const btnHtml = btn.innerHTML;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = $('#nEmail').value.trim(), role = $('#nRole').value;
      msg.classList.remove('is-err');
      if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) { msg.textContent = 'Please enter a valid email address.'; msg.classList.add('is-err'); $('#nEmail').focus(); return; }
      btn.disabled = true; btn.textContent = 'Sending…';
      try {
        const r = await fetch('https://pitchzing-haro.pitchzing.workers.dev/public/book-site/notify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, role, site: 'theciaasset.com', page: location.href }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || `The sign-up service answered ${r.status}.`);
        form.reset(); msg.textContent = 'You are on the list. Watch your inbox for launch news.'; toast('You are on the list.');
      } catch (err) {
        msg.textContent = err && err.message && !/Failed to fetch|NetworkError/i.test(err.message) ? err.message : 'The sign-up could not be sent. Check your connection and try again.';
        msg.classList.add('is-err');
      } finally { btn.disabled = false; btn.innerHTML = btnHtml; }
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
  if (qp.has('amount') || qp.has('section')) setTimeout(() => $('#notify')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }), 600);
  if (qp.get('payment') === 'success') setTimeout(() => toast('Thank you for supporting the book.'), 800);

  const yr = $('#year'); if (yr) yr.textContent = String(new Date().getFullYear());
})();
