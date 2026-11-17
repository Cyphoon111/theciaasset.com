/* theciaasset.com: the official shirt (2026-11-16). The book's front cover on a premium tee, unisex and women's slim, black
   or white. Everything that matters is PitchZing's (worker/src/merch-*.mjs): the catalog (sizes, prices, what is in stock),
   the price at checkout, the order and its page. This file shows the products, keeps the cart in this browser, and opens the
   site's own checkout window (site.js, window.TCA.checkout) with the cart: SKUs and quantities only, never a price.
   Hidden while the store is closed; the owner previews it with ?merch=<preview key> (kept for this tab). A family-and-friends
   link (?wholesale=<key>, made on the owner page, 2026-11-17) shows every shirt at cost plus a small cushion, priced and charged by PitchZing.
   No dependencies. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const section = $('#shirts');
  if (!section) return;
  const TCA = window.TCA || {};
  const API = String(TCA.storeApi || 'https://pitchzing-haro.pitchzing.workers.dev/public/book-store').replace(/\/book-store$/, '/merch');
  const usd = (c) => `$${(c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const say = (m) => (TCA.toast ? TCA.toast(m) : null);
  const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private window */ } } };
  const tab = { get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { sessionStorage.setItem(k, v); } catch { /* private window */ } } };
  const MAX_QTY = 10, MAX_LINES = 10;

  // the owner's preview key: from the link once, then for this tab; taken out of the address bar so it is not shared by accident
  const qp = new URLSearchParams(location.search);
  // (PitchZing's preview link says ?merch=<key>; ?shirts= works too)
  let preview = qp.get('merch') || qp.get('shirts') || tab.get('tca-shirts') || '';
  if (qp.has('merch') || qp.has('shirts')) {
    if (preview) tab.set('tca-shirts', preview);
    qp.delete('merch'); qp.delete('shirts'); history.replaceState(null, '', `${location.pathname}${qp.toString() ? `?${qp}` : ''}${location.hash || '#shirts'}`);
  }
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(preview)) preview = '';
  // a family-and-friends link: the same, kept for this tab (prices and the checkout are PitchZing's, for that link only)
  let wholesale = qp.get('wholesale') || tab.get('tca-wholesale') || '';
  if (qp.has('wholesale')) {
    if (wholesale) tab.set('tca-wholesale', wholesale);
    qp.delete('wholesale'); history.replaceState(null, '', `${location.pathname}${qp.toString() ? `?${qp}` : ''}${location.hash || '#shirts'}`);
  }
  if (!/^[a-f0-9]{32}$/.test(wholesale)) wholesale = '';

  // ---- analytics (counts only: PitchZing merch_stats) ----------------------------------------------------------------
  const track = (event, sku) => { try { fetch(`${API}/track`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ event, ...(sku ? { sku } : {}) }), keepalive: true }).catch(() => {}); } catch { /* never in the way */ } };

  // ---- the shirt drawn in its colour with the cover on its chest, until Printify's own product photo is in ---------------
  const SHAPES = {
    unisex: { body: 'M152 26C170 54 230 54 248 26L310 44Q352 60 392 120L350 176Q326 162 306 150L310 440Q200 452 90 440L94 150Q74 162 50 176L8 120Q48 60 90 44Z', neck: 'M152 26C170 54 230 54 248 26', back: 'M152 26Q200 12 248 26C230 54 170 54 152 26Z', print: { x: 136, y: 84, w: 128, h: 192 } },
    womens: { body: 'M160 30C176 60 224 60 240 30L300 48Q336 66 360 116L326 150Q312 140 298 134Q286 210 296 300Q302 380 300 438Q200 450 100 438Q98 380 104 300Q114 210 102 134Q88 140 74 150L40 116Q64 66 100 48Z', neck: 'M160 30C176 60 224 60 240 30', back: 'M160 30Q200 16 240 30C224 60 176 60 160 30Z', print: { x: 145, y: 88, w: 110, h: 165 } },
  };
  let svgN = 0;
  function teeSvg(fit, color, label) {
    const s = SHAPES[fit] || SHAPES.unisex, dark = color === 'black', id = `tee${++svgN}`;
    const fill = dark ? '#17171a' : '#f5f4f0', edge = dark ? '#0b0b0d' : '#d8d4ca', inner = dark ? '#0a0a0b' : '#e3e0d8', band = dark ? '#232327' : '#ebe8e1';
    const p = s.print;
    return `<svg class="tee__svg" viewBox="0 0 400 460" role="img" aria-label="${esc(label)}">
      <defs>
        <linearGradient id="${id}s" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity="${dark ? 0.35 : 0.1}"/><stop offset=".22" stop-color="#000" stop-opacity="0"/><stop offset=".78" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="${dark ? 0.35 : 0.1}"/></linearGradient>
        <linearGradient id="${id}h" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="${dark ? 0.07 : 0.5}"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient>
        <clipPath id="${id}c"><path d="${s.body}"/></clipPath>
      </defs>
      <path d="${s.back}" fill="${inner}"/>
      <path d="${s.body}" fill="${fill}" stroke="${edge}" stroke-width="1.5" stroke-linejoin="round"/>
      <g clip-path="url(#${id}c)"><rect width="400" height="460" fill="url(#${id}s)"/><rect width="400" height="460" fill="url(#${id}h)"/></g>
      <path d="${s.neck}" fill="none" stroke="${band}" stroke-width="8" stroke-linecap="round"/>
      <image href="assets/cover-760.jpg" x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" preserveAspectRatio="xMidYMid slice"/>
      <rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="none" stroke="#000" stroke-opacity="${dark ? 0 : 0.06}"/>
    </svg>`;
  }

  // ---- the photos (2026-11-16, Jason: "THESE ARE THE IMAGE I EXPECT TO BE PRESENTED ON MY WEBSITE. AND THE PRODUCT THAT WE
  // DELIVER ... MUST ABSOLUTELY REPRESENT PRECISELY WHAT WE ARE REPRESENTING"): Jason's own four example photos. Each shirt now
  // prints the design taken from his photo of that shirt; in each photo the design is re-placed at the size and position the
  // printer really prints it on size L (width and top below the collar, as shares of the chest, from Printify's render of the
  // real product), the shirt where it used to reach filled with that shirt's own fabric. Since v4 (Jason: "Yes, trim it") the
  // design's outer smoke and drips are trimmed so its face and lettering print at his examples' own size on the unisex tee
  // (92 % on the women's, the most its printers allow). Built in the scratchpad art lab
  // (extract.html → the print files, truesize.html → these photos); rebuild them whenever the art, the printer or the
  // placement changes.
  const SHOTS = { NL3600: { black: 'assets/shirts/unisex-black-L.jpg?v=4', white: 'assets/shirts/unisex-white-L.jpg?v=4' }, BC6004: { black: 'assets/shirts/womens-black-L.jpg?v=4', white: 'assets/shirts/womens-white-L.jpg?v=4' } };
  const SHOWN = 'L';
  const photoOf = (code, color, fallback) => SHOTS[code]?.[color] || fallback || null;
  const inches = (n) => `${Number(n).toFixed(1)}\u2033`;

  // ---- the catalog --------------------------------------------------------------------------------------------------
  let CAT = null;
  const bySku = new Map();   // sku → { product, color, size, priceCents, available }
  const FIT = { NL3600: 'unisex', BC6004: 'womens' };

  // ---- the cart: [{ sku, qty }] in this browser, every line checked against the catalog ------------------------------
  let cart = [];
  try { cart = JSON.parse(store.get('tca-cart') || '[]'); } catch { cart = []; }
  if (!Array.isArray(cart)) cart = [];
  cart = cart.filter((l) => l && typeof l.sku === 'string' && /^TCA-[A-Z0-9-]{4,40}$/.test(l.sku)).map((l) => ({ sku: l.sku, qty: Math.min(MAX_QTY, Math.max(1, Math.floor(Number(l.qty)) || 1)) })).slice(0, MAX_LINES);
  const saveCart = () => { store.set('tca-cart', JSON.stringify(cart)); renderCart(); };
  const units = () => cart.reduce((a, l) => a + l.qty, 0);
  const cartBtn = $('#cartBtn'), cartDlg = $('#cart');

  function addToCart(sku, qty) {
    const it = bySku.get(sku);
    if (!it || !it.available) { say('That size is not available right now.'); return false; }
    const line = cart.find((l) => l.sku === sku);
    if (line) {
      if (line.qty >= MAX_QTY) { say(`At most ${MAX_QTY} of one shirt per order.`); return false; }
      line.qty = Math.min(MAX_QTY, line.qty + qty);
    } else {
      if (cart.length >= MAX_LINES) { say(`At most ${MAX_LINES} different shirts per order.`); return false; }
      cart.push({ sku, qty: Math.min(MAX_QTY, qty) });
    }
    saveCart(); track('add_to_cart', sku);
    cartBtn?.classList.remove('is-bump'); void cartBtn?.offsetWidth; cartBtn?.classList.add('is-bump');
    return true;
  }

  function renderCart() {
    const n = units();
    if (cartBtn) { cartBtn.hidden = !n || !CAT; $('#cartCount').textContent = String(n); cartBtn.setAttribute('aria-label', `Cart, ${n} ${n === 1 ? 'shirt' : 'shirts'}`); }
    if (!cartDlg) return;
    const list = $('#cartLines');
    list.innerHTML = cart.map((l, i) => {
      const it = bySku.get(l.sku);
      const name = it ? `${it.product.label}` : 'This shirt';
      const what = it ? `${it.colorName} · ${it.size}` : 'No longer available';
      const price = it ? usd(it.priceCents * l.qty) : '';
      return `<li class="cart__line${it && it.available ? '' : ' is-gone'}" data-i="${i}">
        <div class="cart__thumb" aria-hidden="true">${it ? (it.image ? `<img src="${esc(it.image)}" alt="" loading="lazy">` : teeSvg(FIT[it.product.code], it.color, '')) : ''}</div>
        <div class="cart__what"><b>${esc(name)}</b><span>${esc(what)}</span>${it ? `<small>${usd(it.priceCents)} each</small>` : ''}</div>
        <div class="cart__qty" role="group" aria-label="Quantity of ${esc(name)}, ${esc(what)}">
          <button type="button" class="hc__step cart__step" data-step="-1" aria-label="One fewer"${l.qty <= 1 ? ' disabled' : ''}>−</button>
          <output class="cart__n" aria-live="polite">${l.qty}</output>
          <button type="button" class="hc__step cart__step" data-step="1" aria-label="One more"${l.qty >= MAX_QTY || !(it && it.available) ? ' disabled' : ''}>+</button>
        </div>
        <b class="cart__price">${price}</b>
        <button type="button" class="cart__rm" data-rm aria-label="Remove ${esc(name)}, ${esc(what)}">Remove</button>
      </li>`;
    }).join('');
    const sub = cart.reduce((a, l) => { const it = bySku.get(l.sku); return a + (it ? it.priceCents * l.qty : 0); }, 0);
    $('#cartSub').textContent = usd(sub);
    $('#cartEmpty').hidden = cart.length > 0;
    $('#cartSum').hidden = !cart.length;
    $('#cartGo').hidden = !cart.length;
    $('#cartGo').innerHTML = `Secure checkout · ${usd(sub)} <span aria-hidden="true">→</span>`;   // short enough for a small phone
  }

  if (cartDlg) {
    $('#cartLines').addEventListener('click', (e) => {
      const li = e.target.closest('.cart__line'); if (!li) return;
      const i = Number(li.dataset.i), line = cart[i]; if (!line) return;
      const step = e.target.closest('[data-step]');
      if (step) { line.qty = Math.min(MAX_QTY, Math.max(1, line.qty + Number(step.dataset.step))); saveCart(); $(`.cart__line[data-i="${i}"] [data-step="${step.dataset.step}"]`)?.focus(); return; }
      if (e.target.closest('[data-rm]')) { cart.splice(i, 1); saveCart(); if (!cart.length) $('[data-close]', cartDlg)?.focus(); }
    });
    $$('[data-close]', cartDlg).forEach((b) => b.addEventListener('click', () => cartDlg.close()));
    cartDlg.addEventListener('click', (e) => { if (TCA.onBackdrop && TCA.onBackdrop(cartDlg, e)) cartDlg.close(); });
    $('#cartGo').addEventListener('click', () => {
      const msg = $('#cartMsg'); msg.textContent = '';
      const gone = cart.filter((l) => !bySku.get(l.sku)?.available);
      if (gone.length) { msg.textContent = 'Remove the shirts that are no longer available, then continue.'; return; }
      if (!cart.length) return;
      const req = { kind: 'merch', cart: cart.map((l) => ({ sku: l.sku, qty: l.qty })), ...(preview ? { preview } : {}), ...(wholesale ? { wholesale } : {}) };
      if (!TCA.checkout) { msg.textContent = 'The checkout did not load. Please refresh the page and try again.'; return; }
      cartDlg.close();
      if (!TCA.checkout(req)) { cartDlg.showModal(); msg.textContent = 'The secure checkout is still loading. Please try again in a moment.'; return; }
      track('checkout_started');
    });
  }
  cartBtn?.addEventListener('click', () => { renderCart(); $('#cartMsg').textContent = ''; cartDlg.showModal(); });
  // a paid order empties the cart (site.js payThanks)
  document.addEventListener('tca:merch-paid', () => { cart = []; saveCart(); });

  // ---- the size guide -----------------------------------------------------------------------------------------------
  const sizeDlg = $('#sizeguide');
  function openSizes(p) {
    if (!sizeDlg) return;
    $('#sizeKicker').textContent = p.label;
    $('#sizeRows').innerHTML = p.sizeGuide.rows.map((r) => `<tr><th scope="row">${esc(r.size)}</th><td>${r.width ?? ''} in</td><td>${r.length ?? ''} in</td><td class="size__print">${r.printWidth != null ? `${Number(r.printWidth).toFixed(1)} in` : ''}</td></tr>`).join('');
    const fit = $('#sizeFit'); fit.textContent = p.fitNote || ''; fit.hidden = !p.fitNote;
    sizeDlg.showModal(); track('size_guide');
  }
  if (sizeDlg) {
    $$('[data-close]', sizeDlg).forEach((b) => b.addEventListener('click', () => sizeDlg.close()));
    sizeDlg.addEventListener('click', (e) => { if (TCA.onBackdrop && TCA.onBackdrop(sizeDlg, e)) sizeDlg.close(); });
  }

  // ---- the product cards --------------------------------------------------------------------------------------------
  function card(p) {
    const el = document.createElement('article');
    const fit = FIT[p.code] || 'unisex';
    el.className = `tee tee--${fit}`;
    const st = { color: (p.colors.find((c) => c.sizes.some((s) => s.available)) || p.colors[0]).color, size: null, qty: 1 };
    el.innerHTML = `
      <figure class="tee__shot" data-shot></figure>
      <div class="tee__body">
        <div class="pkg__head">
          <h3 class="pkg__name">${esc(p.label)}</h3>
          <p class="pkg__price"><b data-price></b><span class="pkg__later">${CAT.wholesale ? 'Family price, shipping included' : 'Free US shipping'}</span></p>
        </div>
        <p class="pkg__what">${esc(p.fit)} ${esc(p.fabric)}, ${esc(p.weight)}.</p>
        <div class="tee__group">
          <p class="hc__label" id="${p.code}-cl">Colour <small data-colorname></small></p>
          <div class="tee__colors" role="radiogroup" aria-labelledby="${p.code}-cl">
            ${p.colors.map((c) => `<button type="button" class="tee__color tee__color--${c.color}" role="radio" aria-checked="false" data-color="${c.color}"><i aria-hidden="true"></i>${esc(c.name)}</button>`).join('')}
          </div>
        </div>
        <div class="tee__group">
          <div class="tee__sizehead">
            <p class="hc__label" id="${p.code}-sl">Size <small data-sizehint>Choose your size</small></p>
            <button type="button" class="tee__guide" data-guide aria-haspopup="dialog">Size guide</button>
          </div>
          <div class="tee__sizes" role="radiogroup" aria-labelledby="${p.code}-sl" data-sizes></div>
          ${p.fitNote ? `<p class="tee__fit">${esc(p.fitNote)}</p>` : ''}
        </div>
        <div class="tee__buy">
          <div class="hc__qty" role="group" aria-label="Quantity">
            <button type="button" class="hc__step" data-q="-1" aria-label="One fewer">−</button>
            <output class="hc__n" data-qn aria-live="polite">1</output>
            <button type="button" class="hc__step" data-q="1" aria-label="One more">+</button>
          </div>
          <button type="button" class="btn btn--red btn--lg tee__add" data-add>Add to cart <span aria-hidden="true">→</span></button>
        </div>
        <p class="tee__msg" data-msg role="status" aria-live="polite"></p>
      </div>`;
    const colorOf = () => p.colors.find((c) => c.color === st.color);
    // the design's printed width on each size in the chosen colour (PitchZing: the main printer's width, the one the shop
    // advertises; each colour's print file is its own photo's design, so white can print a little wider than black)
    const printOf = (size) => colorOf()?.sizes.find((s) => s.size === size)?.printWidth ?? p.sizeGuide?.rows?.find((r) => r.size === size)?.printWidth ?? null;
    const sizeOf = () => colorOf().sizes.find((s) => s.size === st.size) || null;
    function draw() {
      const c = colorOf();
      $$('[data-color]', el).forEach((b) => b.setAttribute('aria-checked', String(b.dataset.color === st.color)));
      $('[data-colorname]', el).textContent = c.name;
      const shot = $('[data-shot]', el);
      const photo = photoOf(p.code, c.color, c.image), shownW = printOf(SHOWN);
      const alt = `${p.label} in ${c.name}, size ${SHOWN}, with the Release the Files design${shownW ? ` printed ${inches(shownW)} wide` : ''} across the front`;
      shot.classList.toggle('tee__shot--photo', !!SHOTS[p.code]?.[c.color]);
      shot.innerHTML = photo ? `<img src="${esc(photo)}" alt="${esc(alt)}" loading="lazy" decoding="async">${SHOTS[p.code]?.[c.color] ? `<figcaption class="tee__shown">Shown: size ${SHOWN}${shownW ? ` · print ${inches(shownW)} wide` : ''}</figcaption>` : ''}` : teeSvg(fit, c.color, alt);
      if (st.size && !c.sizes.some((s) => s.size === st.size && s.available)) st.size = null;   // that size is out in this colour
      $('[data-sizes]', el).innerHTML = c.sizes.map((s) => `<button type="button" class="tee__size" role="radio" aria-checked="${s.size === st.size}" data-size="${esc(s.size)}"${s.available ? '' : ' disabled aria-disabled="true" title="Sold out in this colour"'}>${esc(s.size)}${s.available ? '' : '<span class="sr"> (sold out)</span>'}</button>`).join('');
      const z = sizeOf();
      // at cost each shirt has its own price: before a size is chosen, the card shows its own lowest one
      const own = CAT.wholesale ? Math.min(...p.colors.flatMap((cc) => cc.sizes.map((x) => x.priceCents)).filter((x) => x != null)) : null;
      $('[data-price]', el).textContent = z ? usd(z.priceCents) : CAT.wholesale ? `From ${usd(own)}` : usd(CAT.priceCents);
      const pw = z ? printOf(z.size) : null;
      $('[data-sizehint]', el).textContent = z ? [z.size, z.priceCents > CAT.priceCents ? usd(z.priceCents) : null, pw ? `print ${inches(pw)} wide` : null].filter(Boolean).join(' · ') : 'Choose your size';
      $('[data-qn]', el).textContent = String(st.qty);
      $('[data-q="-1"]', el).disabled = st.qty <= 1; $('[data-q="1"]', el).disabled = st.qty >= MAX_QTY;
      const none = !c.sizes.some((s) => s.available);
      $('[data-add]', el).disabled = none;
      if (none) $('[data-msg]', el).textContent = `${c.name} is sold out for now.`;
    }
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b || b.disabled) return;
      const msg = $('[data-msg]', el);
      if (b.dataset.color) { st.color = b.dataset.color; msg.textContent = ''; draw(); return; }
      if (b.dataset.size) { st.size = b.dataset.size; msg.textContent = ''; draw(); $(`[data-size="${CSS.escape(st.size)}"]`, el)?.focus(); return; }
      if (b.dataset.q) { st.qty = Math.min(MAX_QTY, Math.max(1, st.qty + Number(b.dataset.q))); draw(); return; }
      if (b.hasAttribute('data-guide')) { openSizes(p); return; }
      if (b.hasAttribute('data-add')) {
        const z = sizeOf();
        if (!z) { msg.textContent = 'Choose your size first.'; $('.tee__size:not([disabled])', el)?.focus(); return; }
        if (addToCart(z.sku, st.qty)) { msg.innerHTML = `Added to your cart: ${esc(colorOf().name)}, ${esc(z.size)}${st.qty > 1 ? ` × ${st.qty}` : ''}. <button type="button" class="tee__view">View cart</button>`; st.qty = 1; draw(); }
      }
      if (b.classList.contains('tee__view')) cartBtn?.click();
    });
    // arrow keys move within the colour and size choices, like radio buttons
    el.addEventListener('keydown', (e) => {
      const g = e.target.closest('[role="radiogroup"]'); if (!g || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
      const opts = $$('button:not([disabled])', g), i = opts.indexOf(e.target); if (i < 0) return;
      e.preventDefault(); const n = opts[(i + (e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1) + opts.length) % opts.length]; n.click(); n.focus();
    });
    for (const col of p.colors) { const src = photoOf(p.code, col.color, col.image); if (src) { const im = new Image(); im.src = src; } }   // both colours ready
    draw();
    return el;
  }

  // ---- load ---------------------------------------------------------------------------------------------------------
  const catalogUrl = (w) => `${API}/catalog?${new URLSearchParams({ ...(preview ? { preview } : {}), ...(w ? { wholesale: w } : {}) })}`;
  const loadCatalog = () => fetch(catalogUrl(wholesale)).then(async (r) => {
    const j = await r.json().catch(() => null);
    // a link that has been switched off: say so once, then show the shop as everyone sees it
    if (wholesale && j && j.wholesaleOff) { wholesale = ''; tab.set('tca-wholesale', ''); say(j.error); return fetch(catalogUrl('')).then((x) => (x.ok ? x.json() : null)); }
    return r.ok ? j : null;
  });
  loadCatalog().then((c) => {
    if (!c || !Array.isArray(c.products) || !(c.open || c.preview)) { renderCart(); return; }
    CAT = c;
    for (const p of c.products) for (const col of p.colors) for (const s of col.sizes) bySku.set(s.sku, { product: p, color: col.color, colorName: col.name, image: photoOf(p.code, col.color, col.image), size: s.size, priceCents: s.priceCents, available: !!s.available });
    if (c.wholesale) {
      // the family-and-friends prices: from the cheapest shirt to the dearest, cost plus the store's small cushion (2026-11-17)
      $('#shirtsPrice').textContent = `From ${usd(c.priceCents)}`;
      $('#shirtsPlus').textContent = c.plusPriceCents > c.priceCents ? `up to ${usd(c.plusPriceCents)}` : '';
      const ship = $('.shirts__ship'); if (ship) ship.textContent = 'Family price: shipping included.';
      const fam = $('#shirtsFamily'), cushion = c.wholesale.cushionCents;
      if (fam) { fam.textContent = `Family & friends price${c.wholesale.label ? ` for ${c.wholesale.label}` : ''}: each shirt at what it costs us (the printer's price, its shipping and the card fee)${cushion ? ` plus ${usd(cushion)} a shirt so the store never comes up short` : ''}. Nevada addresses add Nevada tax at checkout.`; fam.hidden = false; }
    } else {
      $('#shirtsPrice').textContent = usd(c.priceCents);
      $('#shirtsPlus').textContent = c.plusPriceCents > c.priceCents ? `2XL and up ${usd(c.plusPriceCents)}` : '';
    }
    $('#shirtsPreview').hidden = !!(c.open || c.wholesale);
    const grid = $('#shirtsGrid'); grid.textContent = '';
    for (const p of c.products) grid.append(card(p));
    $$('[data-merch]').forEach((x) => { x.hidden = false; });
    renderCart();
    // a view is counted once, when the section is first seen
    if ('IntersectionObserver' in window) new IntersectionObserver((es, io) => { if (es.some((x) => x.isIntersecting)) { io.disconnect(); track('view'); } }, { threshold: 0.25 }).observe(section);
    if (location.hash === '#shirts') setTimeout(() => section.scrollIntoView({ block: 'start' }), 50);
  }).catch(() => renderCart());
})();
