(function () {
  'use strict';
  var API = 'https://pitchzing-haro.pitchzing.workers.dev/public/book-store';
  var SITEKEY = '0x4AAAAAAFW8xroLmVpmYKc-';
  var DAYS = 30;   // reading time left after cancelling (the server's ACCESS_AFTER_CANCEL_DAYS; it says the exact date)
  var $ = function (id) { return document.getElementById(id); };
  var token = (location.hash || '').replace(/^#/, '').replace(/[^A-Za-z0-9]/g, '');
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var money = function (c) { return c == null ? null : '$' + (c / 100).toFixed(2); };
  var day = function (d) { return d ? new Date(String(d).slice(0, 10) + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : ''; };
  function say(text, kind) { var m = $('msg'); m.className = 'msg' + (kind ? ' ' + kind : ''); m.textContent = text || ''; }
  function call(path, body) {
    return fetch(API + path, { method: body ? 'POST' : 'GET', headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { j._status = r.status; return j; }); })
      .catch(function () { return { error: 'No connection. Check your signal and try again.' }; });
  }

  // ---- Cloudflare Turnstile ("Confirm you are human")
  var tsLib = null;
  function turnstile() {
    return tsLib || (tsLib = new Promise(function (res, rej) {
      window.__tsReady = function () { res(window.turnstile); };
      var s = document.createElement('script'); s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=__tsReady'; s.async = true;
      s.onerror = function () { rej(new Error('blocked')); };
      document.head.appendChild(s);
    }));
  }
  // one widget: { token, id, ready(promise of a token) }; appearance 'always' shows the check, 'interaction-only' hides it unless needed
  function widget(el, appearance, onChange) {
    var w = { token: '', id: null, waiters: [] };
    turnstile().then(function (ts) {
      w.id = ts.render(el, { sitekey: SITEKEY, appearance: appearance, action: 'cancel',
        callback: function (t) { w.token = t; w.waiters.splice(0).forEach(function (f) { f(t); }); if (onChange) onChange(); },
        'expired-callback': function () { w.token = ''; if (onChange) onChange(); },
        'error-callback': function () { w.token = ''; w.waiters.splice(0).forEach(function (f) { f(''); }); if (onChange) onChange(); } });
    }).catch(function () { w.waiters.splice(0).forEach(function (f) { f(''); }); });
    w.take = function (ms) { return new Promise(function (res) { if (w.token) return res(w.token); w.waiters.push(res); setTimeout(function () { res(''); }, ms || 15000); }); };
    w.reset = function () { w.token = ''; try { window.turnstile.reset(w.id); } catch (e) {} if (onChange) onChange(); };
    return w;
  }

  // ---- ask for a link by email
  var askHuman = null;
  function showAsk(afterList) { $('ask').hidden = false; $('askSep').hidden = !afterList; if (!askHuman) askHuman = widget($('human'), 'interaction-only'); }
  $('askForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var email = $('email').value.trim(), btn = $('askBtn');
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) { say('Please enter the email address you donate with.', 'err'); $('email').focus(); return; }
    btn.disabled = true; btn.textContent = 'Sending…'; say('');
    askHuman.take().then(function (t) { return call('/cancel-request', { email: email, human: t }); }).then(function (r) {
      btn.disabled = false; btn.textContent = 'Email me a link to cancel'; askHuman.reset();
      if (r.error) return say(r.error, 'err');
      say(r.message || 'If that address has a monthly donation, we have emailed it a link to cancel.', 'ok');
    });
  });

  // ---- with a link: the address's monthly donations, each with its own Cancel
  var info = null;
  function render(d) {
    info = d;
    var list = $('list'); list.hidden = false;
    var active = (d.donations || []).filter(function (x) { return !x.cancelled; });
    if (!(d.donations || []).length) {
      list.innerHTML = '';
      say('There is no active monthly donation for ' + d.email + '. Donated with a different address? Ask for a link below.');
      return showAsk(true);
    }
    say(active.length ? 'Monthly donations for ' + d.email + ':' : 'Every monthly donation for ' + d.email + ' is already cancelled.');
    list.innerHTML = d.donations.map(function (x) {
      var amt = money(x.cents) ? money(x.cents) + ' a month' : 'Monthly donation';
      // the plan's name when it is not a donation (2026-11-13): Ask the Book, or one of its upgrades (PitchZing's describe)
      var what = x.what && x.what !== 'Monthly donation' ? x.what : '';
      if (x.cancelled) return '<div class="don is-done"><p class="don__amt">' + esc(amt) + '</p><p class="don__meta">Cancelled' + (x.endsOn ? ' · no further charges after ' + esc(day(x.endsOn)) : '') + (d.accessUntil ? ' · you can enjoy the book until ' + esc(day(d.accessUntil)) : '') + '</p></div>';
      return '<div class="don" data-id="' + esc(x.id) + '" data-amt="' + esc(amt) + '" data-what="' + esc(what) + '"><p class="don__amt">' + esc(amt) + (what ? ' <span class="don__what">' + esc(what) + '</span>' : '') + '</p><p class="don__meta">' + (x.startDate ? 'Since ' + esc(day(x.startDate)) : '') + (x.paidThrough ? ' · paid through ' + esc(day(x.paidThrough)) : '') + '</p><div class="act"><button class="btn btn--red" type="button" data-act="ask">Cancel this monthly donation</button></div></div>';
    }).join('');
  }
  // "Are you sure?": thanks, 30 more days, the Yes choice, then the human check; the button works only with both
  function sure(box) {
    var id = box.getAttribute('data-id'), amt = box.getAttribute('data-amt'), plan = box.getAttribute('data-what') || '', until = new Date(Date.now() + (info.accessAfterCancelDays || DAYS) * 86400e3);
    var act = box.querySelector('.act');
    act.innerHTML = '<div class="sure" role="group" aria-labelledby="sure-' + esc(id) + '"><h2 id="sure-' + esc(id) + '">Are you sure you wish to cancel?</h2>' +
      (plan ? '<p>If you cancel <b>' + esc(plan) + '</b> (' + esc(amt) + '), it stops at the end of the month already paid. Your copy of the book is not affected.</p>'
        : '<p>If you cancel your ' + esc(amt.replace(' a month', '')) + ' monthly donation, you can still visit and enjoy the book for another ' + (info.accessAfterCancelDays || DAYS) + ' days, until <b>' + esc(day(until.toISOString())) + '</b>.</p>') +
      '<p>Thank you for supporting the book and Jason Sullivan’s ongoing work. Donations already made are final.</p>' +
      '<label class="yes"><input type="radio" name="yes-' + esc(id) + '" value="yes"><span>Yes, I wish to cancel ' + (plan ? esc(plan) : 'my monthly donation') + '.</span></label>' +
      '<p class="human-box__label">Confirm you are human</p><div class="human-box"></div>' +
      '<div class="row"><button class="btn btn--red" type="button" data-act="yes" disabled>Cancel my monthly donation</button><button class="btn btn--ghost" type="button" data-act="keep">Keep my donation</button></div></div>';
    var yes = act.querySelector('input[type=radio]'), go = act.querySelector('[data-act="yes"]');
    var check = function () { go.disabled = !(yes.checked && w.token); };
    var w = widget(act.querySelector('.human-box'), 'always', check);
    box._human = w;
    yes.addEventListener('change', check);
    yes.focus();
  }
  $('list').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var box = b.closest('.don'), id = box.getAttribute('data-id'), amt = box.getAttribute('data-amt');
    var what = b.getAttribute('data-act');
    if (what === 'ask') return sure(box);
    if (what === 'keep') return load();
    var w = box._human, yes = box.querySelector('input[type=radio]');
    if (!yes || !yes.checked) return say('Please choose “Yes, I wish to cancel my monthly donation” first.', 'err');
    if (!w || !w.token) return say('Please confirm you are human first.', 'err');
    b.disabled = true; b.textContent = 'Cancelling…'; say('');
    call('/cancel/' + token, { subscriptionId: id, confirm: true, human: w.token }).then(function (r) {
      if (r.error) { w.reset(); b.textContent = 'Cancel my monthly donation'; return say(r.error, 'err'); }
      var c = r.cancelled || {};
      box.className = 'don is-done';
      box.innerHTML = '<p class="don__amt">' + esc(amt) + '</p><p class="don__meta">Cancelled · no further charges' + (r.accessUntil ? ' · you can enjoy the book until ' + esc(day(r.accessUntil)) : '') + '</p>';
      say('Your monthly donation is cancelled, and you will not be charged again. ' + (r.accessUntil ? 'You can keep visiting and enjoying the book until ' + day(r.accessUntil) + '. ' : 'Your copy of the book stays yours. ') + 'A confirmation is on its way to your inbox. Thank you for supporting the book and Jason Sullivan’s ongoing work.', 'ok');
    });
  });
  function load() {
    say('Finding your monthly donations…');
    call('/cancel/' + token).then(function (r) {
      if (r.error) { say(r.error, 'err'); return showAsk(false); }
      render(r);
    });
  }
  if (token) load(); else showAsk(false);
})();
