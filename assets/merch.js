/* theciaasset.com: the official shirt (2026-11-16). The book's front cover on a premium tee, unisex and women's slim, black
   or white. Everything that matters is PitchZing's (worker/src/merch-*.mjs): the catalog (sizes, prices, what is in stock),
   the price at checkout, the order and its page. This file shows the products, keeps the cart in this browser, and opens the
   site's own checkout window (site.js, window.TCA.checkout) with the cart: SKUs and quantities only, never a price.
   Hidden while the store is closed; the owner previews it with ?merch=<preview key> (kept for this tab). A family-and-friends
   link (?wholesale=<key>, made on the owner page, 2026-11-17) shows every shirt at cost plus a small cushion, priced and charged by PitchZing.
   The Richardson 112 hat (2026-11-17) shows only when PitchZing lists it (HAT_OPEN, or the owner's preview): its own card with a
   gallery, one size, the shirts to wear it with; the cart offers it once a shirt is in and it is not ("Complete the set").
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
  // the hat (2026-11-17, the Richardson 112): Printify's renders of the real product with the production embroidery file at its
  // real size and place (front, three-quarter and side on a person, back, a close-up of the front, worn), kept on this site
  const HAT = 'TCA-R112-BW';
  const HAT_SHOTS = [
    ['front', 'Front', 'The hat from the front: black front panels and visor, white mesh sides, the white and red embroidery centred on the front with theciaasset.com in grey beneath it'],
    ['three-quarter', 'Three-quarter', 'The hat worn, seen from the front at an angle, the embroidery on the black front and the white mesh at the side'],
    ['side', 'Side and mesh', 'The hat worn, seen from the side and back: the white mesh panels and the snapback'],
    ['back', 'Back', 'The back of the hat: white mesh and the adjustable plastic snapback'],
    ['detail', 'Embroidery', 'Close-up of the front embroidery: JEFFREY EPSTEIN WAS A CIA ASSET, RELEASE THE FILES in white and red thread, theciaasset.com in grey'],
    ['lifestyle', 'Worn', 'The hat worn, seen from the front'],
  ].map(([k, label, alt]) => ({ src: `assets/hats/r112-${k}.jpg?v=3`, thumb: `assets/hats/r112-${k}-thumb.jpg?v=3`, label, alt }));   // v2: the crisp art (hat-v2); v3: our own clean embroidery renders (see below)
  // the baseball cap (2026-11-17, OTTO 31-069): Printify's renders of the real product per colour — front, both sides with
  // theciaasset.com, back, a close-up of the front embroidery and one of the side — kept on this site
  const CAP_VIEWS = [['front', 'Front'], ['left', 'Left side'], ['right', 'Right side'], ['back', 'Back'], ['detail', 'Embroidery'], ['side', 'Side close-up']];
  const capShots = (c) => { const n = c === 'black' ? 'black' : 'white', thread = c === 'black' ? 'white and red' : 'black and red';
    const alt = { front: `The ${n} cap from the front: the design embroidered across the front panel in ${thread} thread`, left: `The ${n} cap from the left: theciaasset.com embroidered in grey on the side`,
      right: `The ${n} cap from the right: theciaasset.com embroidered in grey on the side`, back: `The back of the ${n} cap with its adjustable snapback`,
      detail: `Close-up of the front embroidery on the ${n} cap`, side: `Close-up of theciaasset.com embroidered on the side of the ${n} cap` };
    return CAP_VIEWS.map(([k, label]) => ({ src: `assets/caps/oc31069-${c}-${k}.jpg?v=4`, thumb: `assets/caps/oc31069-${c}-${k}-thumb.jpg?v=4`, label, alt: alt[k] })); };
  // v4 (2026-11-17, Jason: "improve the preview simulations on my website, because they look like shit!"): the hats and caps are
  // no longer Printify's stitch simulation but our own clean embroidery render of the production files, wrapped onto Printify's
  // blank renders of the same products through Printify's own projection (measured with dot grids), so every letter sits where
  // Printify renders and makes it (PitchZing merch-art/sim)   // v2: the URL on one line (cap-v2); v3: the side close-up from the right-side render at its actual pixels (the left render's stitch simulation smears small text; both sides are the same file)
  const SHOTSETS = { R112: { blackwhite: HAT_SHOTS }, OC31069: { black: capShots('black'), white: capShots('white') } };
  const photoOf = (code, color, fallback) => (SHOTSETS[code] ? (SHOTSETS[code][color] || Object.values(SHOTSETS[code])[0])[0].thumb : SHOTS[code]?.[color] || fallback || null);
  const isHat = (it) => it?.product?.kind === 'hat';
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
    if (!it || !it.available) { say(isHat(it) ? 'The hat is not available right now.' : 'That size is not available right now.'); return false; }
    const line = cart.find((l) => l.sku === sku);
    if (line) {
      if (line.qty >= MAX_QTY) { say(`At most ${MAX_QTY} of one item per order.`); return false; }
      line.qty = Math.min(MAX_QTY, line.qty + qty);
    } else {
      if (cart.length >= MAX_LINES) { say(`At most ${MAX_LINES} different items per order.`); return false; }
      cart.push({ sku, qty: Math.min(MAX_QTY, qty) });
    }
    saveCart(); track('add_to_cart', sku);
    cartBtn?.classList.remove('is-bump'); void cartBtn?.offsetWidth; cartBtn?.classList.add('is-bump');
    return true;
  }

  function renderCart() {
    const n = units();
    if (cartBtn) { cartBtn.hidden = !n || !CAT; $('#cartCount').textContent = String(n); cartBtn.setAttribute('aria-label', `Cart, ${n} ${n === 1 ? 'item' : 'items'}`); }
    if (!cartDlg) return;
    const list = $('#cartLines');
    list.innerHTML = cart.map((l, i) => {
      const it = bySku.get(l.sku);
      const name = it ? `${it.product.label}` : 'This item';
      const what = it ? (it.product.oneSize ? it.colorName : `${it.colorName} · ${it.size}`) : 'No longer available';   // the hat: one size
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
    renderUpsell();
  }

  // ---- complete the set (2026-11-17): the hat offered once there is a shirt in the cart and no hat; never a pop-up ----------
  const hatItem = () => { const h = bySku.get(HAT); return h && h.available ? h : null; };
  const wantsHat = () => !!hatItem() && cart.some((l) => !isHat(bySku.get(l.sku))) && !cart.some((l) => l.sku === HAT);
  let upsellSeen = false;
  const seenUpsell = () => { if (!upsellSeen) { upsellSeen = true; track('upsell_view', HAT); } };
  function upsellHtml(kind) {
    const h = hatItem(); if (!h) return '';
    return `<div class="upsell upsell--${kind}"><img class="upsell__img" src="${esc(HAT_SHOTS[0].thumb)}" alt="" loading="lazy" width="64" height="64">
      <div class="upsell__what"><b>Complete the set</b><span>${esc(h.product.label)} · ${esc(h.colorName)}</span><small>${usd(h.priceCents)}${CAT?.wholesale ? ' · family price' : ' · free US shipping'}</small></div>
      <button type="button" class="btn btn--ghost upsell__add" data-upsell>Add the hat</button></div>`;
  }
  function renderUpsell() {
    if (!cartDlg) return;
    let box = $('#cartUpsell');
    if (!box) { box = document.createElement('div'); box.id = 'cartUpsell'; $('#cartSum')?.before(box); }
    box.innerHTML = wantsHat() ? upsellHtml('cart') : '';
    if (box.innerHTML && cartDlg.open) seenUpsell();
  }
  const addHatFromUpsell = () => { if (addToCart(HAT, 1)) { track('upsell_add', HAT); say('The hat is in your cart.'); } };

  if (cartDlg) {
    $('#cartLines').addEventListener('click', (e) => {
      const li = e.target.closest('.cart__line'); if (!li) return;
      const i = Number(li.dataset.i), line = cart[i]; if (!line) return;
      if (e.target.closest('[data-upsell]')) return;
      const step = e.target.closest('[data-step]');
      if (step) { line.qty = Math.min(MAX_QTY, Math.max(1, line.qty + Number(step.dataset.step))); saveCart(); $(`.cart__line[data-i="${i}"] [data-step="${step.dataset.step}"]`)?.focus(); return; }
      if (e.target.closest('[data-rm]')) { cart.splice(i, 1); saveCart(); if (!cart.length) $('[data-close]', cartDlg)?.focus(); }
    });
    $$('[data-close]', cartDlg).forEach((b) => b.addEventListener('click', () => cartDlg.close()));
    cartDlg.addEventListener('click', (e) => { if (e.target.closest('#cartUpsell [data-upsell]')) { addHatFromUpsell(); return; } if (TCA.onBackdrop && TCA.onBackdrop(cartDlg, e)) cartDlg.close(); });
    $('#cartGo').addEventListener('click', () => {
      const msg = $('#cartMsg'); msg.textContent = '';
      const gone = cart.filter((l) => !bySku.get(l.sku)?.available);
      if (gone.length) { msg.textContent = 'Remove the items that are no longer available, then continue.'; return; }
      if (!cart.length) return;
      const req = { kind: 'merch', cart: cart.map((l) => ({ sku: l.sku, qty: l.qty })), ...(preview ? { preview } : {}), ...(wholesale ? { wholesale } : {}) };
      if (!TCA.checkout) { msg.textContent = 'The checkout did not load. Please refresh the page and try again.'; return; }
      cartDlg.close();
      if (!TCA.checkout(req)) { cartDlg.showModal(); msg.textContent = 'The secure checkout is still loading. Please try again in a moment.'; return; }
      track('checkout_started');
      if (cart.some((l) => l.sku === HAT)) track('checkout_hat', HAT);
    });
  }
  cartBtn?.addEventListener('click', () => { renderCart(); $('#cartMsg').textContent = ''; cartDlg.showModal(); if ($('#cartUpsell')?.innerHTML) seenUpsell(); });
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
    el.className = `tee tee--${fit}`; el.dataset.code = p.code;
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
        if (addToCart(z.sku, st.qty)) {
          msg.innerHTML = `Added to your cart: ${esc(colorOf().name)}, ${esc(z.size)}${st.qty > 1 ? ` × ${st.qty}` : ''}. <button type="button" class="tee__view">View cart</button>${wantsHat() ? upsellHtml('card') : ''}`;
          if (wantsHat()) seenUpsell();
          st.qty = 1; draw();
        }
      }
      if (b.hasAttribute('data-upsell')) { addHatFromUpsell(); msg.innerHTML = `The hat is in your cart too. <button type="button" class="tee__view">View cart</button>`; return; }
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

  // ---- the hat card: a gallery, the copy, one size, quantity, and the shirts to wear it with ------------------------------
  function hatCard(p) {
    const el = document.createElement('article');
    el.className = 'hat'; el.id = p.code === 'R112' ? 'hat' : `hat-${p.code.toLowerCase()}`; el.dataset.code = p.code;
    // (2026-11-17: the cap comes in black and white — a colour choice, each colour its own photos and SKU)
    const st = { qty: 1, shot: 0, color: (p.colors.find((cc) => cc.sizes.some((z) => z.available)) || p.colors[0]).color };
    const colorOf = () => p.colors.find((cc) => cc.color === st.color), sizeOf = () => colorOf().sizes[0];
    const shots = () => SHOTSETS[p.code]?.[st.color] || [];
    const shirts = CAT.products.filter((x) => x.kind !== 'hat');
    const pairPrice = (x) => { const ps = x.colors.flatMap((cc) => cc.sizes.filter((z) => z.available).map((z) => z.priceCents)).filter((v) => v != null); return ps.length ? Math.min(...ps) : null; };
    const what = p.product === 'cap' ? 'cap' : 'hat';
    const colourText = (cc) => (cc.name.includes(' / ') ? `${cc.name.replace(' / ', ' front / ')} mesh` : cc.name);
    el.innerHTML = `
      <div class="hat__gallery">
        <figure class="hat__shot"><img data-hatimg alt="" decoding="async"><figcaption class="tee__shown" data-hatcap></figcaption></figure>
        <div class="hat__thumbs" role="group" aria-label="Views of the ${what}" data-thumbs></div>
      </div>
      <div class="hat__body">
        <p class="hat__kicker">${p.onSale === false ? 'Owner’s preview · not on sale yet' : `New · The official ${what}`}</p>
        <div class="pkg__head">
          <h3 class="pkg__name">${esc(p.label)}</h3>
          <p class="pkg__price"><b data-price></b><span class="pkg__later">${CAT.wholesale ? 'Family price, shipping included' : 'Free US shipping'}</span></p>
        </div>
        <p class="hat__desc">${esc(p.description || '')}</p>
        <ul class="hat__specs">${(p.specs || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
        ${p.colors.length > 1 ? `<div class="tee__group hat__colorgroup">
          <p class="hc__label" id="${p.code}-cl">Colour <small data-colorname></small></p>
          <div class="tee__colors" role="radiogroup" aria-labelledby="${p.code}-cl">
            ${p.colors.map((cc) => `<button type="button" class="tee__color tee__color--${cc.color}" role="radio" aria-checked="false" data-color="${cc.color}"><i aria-hidden="true"></i>${esc(cc.name)}</button>`).join('')}
          </div>
        </div>` : ''}
        <p class="tee__fit">${esc(p.fitNote || '')}</p>
        <dl class="hat__facts">
          <div><dt>Colour</dt><dd data-colourfact></dd></div>
          <div><dt>Fit</dt><dd>${esc(p.fit || '')}</dd></div>
          <div><dt>Materials</dt><dd>${esc(p.fabric || '')}</dd></div>
          <div><dt>Embroidery</dt><dd data-embfact></dd></div>
          <div><dt>Delivery</dt><dd>Embroidered for you when you order; most orders arrive in 5–10 business days. With shirts in the same order it can arrive in its own package.</dd></div>
          <div><dt>Returns</dt><dd>If it arrives damaged, with an embroidery defect or not as ordered, write to <a href="mailto:books@theciaasset.com">books@theciaasset.com</a> within 30 days of delivery with a photo and we’ll replace it free. One size and adjustable, so there is no size to exchange.</dd></div>
        </dl>
        <div class="tee__buy">
          <div class="hc__qty" role="group" aria-label="Quantity">
            <button type="button" class="hc__step" data-q="-1" aria-label="One fewer">−</button>
            <output class="hc__n" data-qn aria-live="polite">1</output>
            <button type="button" class="hc__step" data-q="1" aria-label="One more">+</button>
          </div>
          <button type="button" class="btn btn--red btn--lg tee__add" data-add>Add to cart <span aria-hidden="true">→</span></button>
        </div>
        <p class="tee__msg" data-msg role="status" aria-live="polite"></p>
        ${shirts.length ? `<div class="hat__pair"><p class="hc__label">Wear it with the shirt</p><div class="hat__pairs">${shirts.map((x) => { const col = x.colors[0]; const img = photoOf(x.code, col.color, col.image); const from = pairPrice(x);
          return `<button type="button" class="hat__pairbtn" data-pair="${esc(x.code)}">${img ? `<img src="${esc(img)}" alt="" loading="lazy" width="56" height="56">` : ''}<span><b>${esc(x.label)}</b><small>${from != null ? `${CAT.wholesale ? 'from ' : ''}${usd(from)}` : ''}${CAT.wholesale ? '' : ' · free US shipping'}</small></span></button>`; }).join('')}</div></div>` : ''}
      </div>`;
    let thumbsFor = null;
    function draw() {
      const cc = colorOf(), s = sizeOf(), list = shots(), shot = list[st.shot] || list[0], pw = s.printWidth;
      if (thumbsFor !== st.color) {   // the views of the chosen colour
        $('[data-thumbs]', el).innerHTML = list.map((x, i) => `<button type="button" class="hat__thumb" data-shotn="${i}" aria-pressed="false" aria-label="${esc(x.label)}"><img src="${esc(x.thumb)}" alt="" loading="lazy" width="64" height="64"></button>`).join('');
        thumbsFor = st.color; for (const x of list) { const im = new Image(); im.src = x.src; }
      }
      if (shot) { const img = $('[data-hatimg]', el); img.src = shot.src; img.alt = shot.alt; $('[data-hatcap]', el).textContent = `${shot.label}${pw && st.shot === 0 ? ` · embroidery ${inches(pw)} wide` : ''}`; }
      $$('[data-shotn]', el).forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.shotn) === st.shot)));
      $$('[data-color]', el).forEach((b) => b.setAttribute('aria-checked', String(b.dataset.color === st.color)));
      const cn = $('[data-colorname]', el); if (cn) cn.textContent = cc.name;
      $('[data-colourfact]', el).textContent = colourText(cc);
      $('[data-embfact]', el).textContent = p.embroidery || `White and red thread on the front${pw ? `, the design ${inches(pw)} wide` : ''}, with theciaasset.com in grey beneath it.`;
      $('[data-price]', el).textContent = s.priceCents != null ? usd(s.priceCents) : '';
      $('[data-qn]', el).textContent = String(st.qty);
      $('[data-q="-1"]', el).disabled = st.qty <= 1; $('[data-q="1"]', el).disabled = st.qty >= MAX_QTY;
      $('[data-add]', el).disabled = !s.available;
      $('[data-msg]', el).textContent = s.available ? ($('[data-msg]', el).dataset.keep ? $('[data-msg]', el).textContent : '') : `${p.colors.length > 1 ? cc.name : 'This ' + what} is not available right now.`;
    }
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b || b.disabled) return;
      const msg = $('[data-msg]', el);
      if (b.dataset.color) { st.color = b.dataset.color; st.shot = 0; delete msg.dataset.keep; draw(); return; }
      if (b.dataset.shotn) { st.shot = Number(b.dataset.shotn); draw(); return; }
      if (b.dataset.q) { st.qty = Math.min(MAX_QTY, Math.max(1, st.qty + Number(b.dataset.q))); draw(); return; }
      if (b.dataset.pair) { const card = $(`.tee[data-code="${CSS.escape(b.dataset.pair)}"]`); if (card) { card.scrollIntoView({ block: 'start', behavior: 'smooth' }); $('.tee__size:not([disabled])', card)?.focus({ preventScroll: true }); } return; }
      if (b.hasAttribute('data-add')) { const s = sizeOf(); if (addToCart(s.sku, st.qty)) { msg.dataset.keep = '1'; msg.innerHTML = `Added to your cart: the ${what}${p.colors.length > 1 ? `, ${esc(colorOf().name)}` : ''}${st.qty > 1 ? ` × ${st.qty}` : ''}. <button type="button" class="tee__view">View cart</button>`; st.qty = 1; draw(); } return; }
      if (b.classList.contains('tee__view')) cartBtn?.click();
    });
    // arrow keys move within the colour choice, like radio buttons
    el.addEventListener('keydown', (e) => {
      const g = e.target.closest('[role="radiogroup"]'); if (!g || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
      const opts = $$('button:not([disabled])', g), i = opts.indexOf(e.target); if (i < 0) return;
      e.preventDefault(); const n = opts[(i + (e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1) + opts.length) % opts.length]; n.click(); n.focus();
    });
    draw();
    if ('IntersectionObserver' in window) new IntersectionObserver((es, io) => { if (es.some((x) => x.isIntersecting)) { io.disconnect(); track('hat_view', sizeOf().sku); } }, { threshold: 0.35 }).observe(el);
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
    for (const p of c.products.filter((x) => x.kind !== 'hat')) grid.append(card(p));
    // every hat PitchZing lists (on sale, or the owner's preview): a card the size of a shirt card, side by side right under
    // the two shirts (the trucker, the cap; 2026-11-17)
    const hats = c.products.filter((x) => x.kind === 'hat');
    for (const h of hats) grid.append(hatCard(h));
    if (hats.length) {
      const words = hats.some((h) => h.product === 'cap') ? (hats.some((h) => h.product === 'hat') ? ['shirt, hat and cap', 'hat and cap are'] : ['shirt and cap', 'cap is']) : ['shirt and hat', 'hat is'];
      const k = $('.shirts__head .kicker'); if (k) k.textContent = `The official ${words[0]}`;
      const fine = $('.shirts__fine'); if (fine && !fine.dataset.hat) { fine.dataset.hat = '1'; fine.insertAdjacentText('beforeend', ` The ${words[1]} embroidered for you when you order and ship${words[1].endsWith('are') ? '' : 's'} free too; if it arrives damaged or with an embroidery defect, the same 30-day replacement applies.`); }
    }
    $$('[data-merch]').forEach((x) => { x.hidden = false; });
    renderCart();
    // a view is counted once, when the section is first seen
    if ('IntersectionObserver' in window) new IntersectionObserver((es, io) => { if (es.some((x) => x.isIntersecting)) { io.disconnect(); track('view'); } }, { threshold: 0.25 }).observe(section);
    if (location.hash === '#shirts') setTimeout(() => section.scrollIntoView({ block: 'start' }), 50);
  }).catch(() => renderCart());
})();
