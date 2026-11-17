/* The buyer's private shirt order page (/order/?t=<token>, 2026-11-16): PitchZing's GET /public/merch/order and, inside the
   first 60 minutes, POST /public/merch/cancel. Everything shown comes from PitchZing; nothing is kept in the browser. */
(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const API = 'https://pitchzing-haro.pitchzing.workers.dev/public/merch';
  const usd = (c) => `$${(c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const day = (iso) => { try { return new Date(iso).toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }); } catch { return ''; } };
  const msg = (text, kind) => { const m = $('#msg'); m.textContent = text || ''; m.className = `msg${kind ? ` ${kind}` : ''}`; };
  const t = new URLSearchParams(location.search).get('t') || '';
  let O = null, tick = 0;

  const STAGE_HINT = { received: 'We have your order. It is made after the first hour.', preparing: 'Your order is being prepared for printing.', printing: 'Your shirt is being printed.', shipped: 'On its way to you.', delivered: '' };
  const CARRIER = { usps: 'USPS', ups: 'UPS', fedex: 'FedEx', dhl: 'DHL', dhl_ecommerce: 'DHL eCommerce' };

  function render(o) {
    O = o;
    $('#title').textContent = `Order ${o.number}`;
    $('#placed').textContent = o.placedAt ? `Placed ${day(o.placedAt)}` : '';
    const note = $('#note'); note.textContent = o.note || ''; note.hidden = !o.note;
    const ended = ['canceled', 'refunded'].includes(o.stage);
    $('#ended').hidden = !ended || !!o.note; $('#ended').textContent = ended && !o.note ? (o.stage === 'canceled' ? 'This order was canceled.' : 'This order was refunded.') : '';   // the note already says it
    const keys = (o.stages || []).map((s) => s[0]), at = keys.indexOf(o.stage);
    $('#steps').hidden = ended;
    $('#steps').innerHTML = (o.stages || []).map(([k, label], i) => `<li class="${i < at || (k === 'delivered' && o.stage === 'delivered') ? 'done' : i === at ? 'now' : ''}"${i === at ? ' aria-current="step"' : ''}><span>${esc(label)}${i === at && STAGE_HINT[k] ? `<small>${esc(STAGE_HINT[k])}</small>` : ''}</span></li>`).join('');
    const s = o.shipment, ship = $('#ship');
    if (s || o.shipTo) {
      const to = o.shipTo ? `<p>To ${esc(o.shipTo.name || '')}${o.shipTo.city ? `, ${esc(o.shipTo.city)}` : ''}${o.shipTo.state ? `, ${esc(o.shipTo.state)}` : ''}. Free shipping.</p>` : '';
      const track = s ? `<p>${esc(CARRIER[String(s.carrier || '').toLowerCase()] || s.carrier || 'Carrier')} tracking: ${s.url && /^https:\/\//.test(s.url) ? `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.number)}</a>` : `<b>${esc(s.number)}</b>`}</p>${s.shippedAt ? `<p>Shipped ${esc(day(s.shippedAt))}${s.deliveredAt ? ` · delivered ${esc(day(s.deliveredAt))}` : ''}</p>` : ''}` : '';
      $('#shipBody').innerHTML = track + to; ship.hidden = false;
    } else ship.hidden = true;
    $('#items').innerHTML = (o.items || []).map((i) => `<li><span>${esc(i.name)}${i.quantity > 1 ? ` × ${i.quantity}` : ''}</span><b>${usd(i.unitCents * i.quantity)}</b></li>`).join('');
    $('#sum').innerHTML = `<div><span>Subtotal</span><span>${usd(o.subtotalCents)}</span></div>${o.taxCents ? `<div><span>Nevada sales tax</span><span>${usd(o.taxCents)}</span></div>` : ''}<div><span>Shipping</span><span>Free</span></div><div class="total"><span>Total</span><span>${usd(o.totalCents)}</span></div>${o.refundedCents ? `<div><span>Refunded</span><span>${usd(o.refundedCents)}</span></div>` : ''}`;
    $('#cancel').hidden = !o.canCancel;
    $('#sureAmt').textContent = usd(o.totalCents - (o.refundedCents || 0));
    clearInterval(tick);
    if (o.canCancel) { clock(); tick = setInterval(clock, 1000); }
    $('#view').hidden = false;
  }
  // the time left to cancel, by the second; at zero the button goes and the page reads the order again
  function clock() {
    const left = Date.parse(O.cancelDeadline) - Date.now();
    if (!(left > 0)) { clearInterval(tick); $('#cancel').hidden = true; load(); return; }
    const m = Math.floor(left / 60e3), s = Math.floor((left % 60e3) / 1e3);
    $('#clock').textContent = `${m}:${String(s).padStart(2, '0')}`;
  }

  async function load() {
    if (!/^[a-f0-9]{48}$/.test(t)) { $('#title').textContent = 'Order not found'; msg('This order link is not complete. Open it again from your confirmation email.', 'err'); return; }
    try {
      const r = await fetch(`${API}/order?t=${t}`, { cache: 'no-store' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { $('#title').textContent = 'Order not found'; msg(j.error || 'This order link is not valid.', 'err'); return; }
      render(j);
    } catch { msg('Your order could not be loaded. Please check your connection and refresh the page.', 'err'); }
  }

  $('#cancelBtn').addEventListener('click', () => { $('#cancelRow').hidden = true; $('#sure').hidden = false; $('#sureNo').focus(); });
  $('#sureNo').addEventListener('click', () => { $('#sure').hidden = true; $('#cancelRow').hidden = false; $('#cancelBtn').focus(); });
  $('#sureYes').addEventListener('click', async () => {
    const yes = $('#sureYes'), no = $('#sureNo');
    yes.disabled = true; no.disabled = true; yes.textContent = 'Canceling…'; msg('');
    try {
      const r = await fetch(`${API}/cancel`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ t }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'The order could not be canceled. Please write to books@theciaasset.com.');
      msg(`Your order is canceled. ${j.refundedCents ? `${usd(j.refundedCents)} is being refunded to your card; it usually appears within 5–10 business days.` : 'Your refund is on its way to your card.'} A confirmation email is on its way.`, 'ok');
      await load();
    } catch (e) { msg(e.message, 'err'); yes.disabled = false; no.disabled = false; yes.textContent = 'Yes, cancel my order'; }
  });
  load();
})();
