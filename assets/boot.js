/* a refresh opens at the very top, never where the reader left off */ if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
/* the opening screen: the visitor enters an email to open the file, and that tap or key press turns the sound on.
   A donor sent back from Square (?donated=…) skips it: the thank-you pop-up opens instead. A visitor who has entered an
   email before gets it with no email to type (gate-back, Jason, 2026-10-17): "Welcome back" and one tap, which opens the
   file and turns the shutter sound on (a browser plays sound only after a tap). This browser remembers them, or else
   site.js asks PitchZing whether this network and browser signed up (gate-ask keeps the form out of sight meanwhile). */
/* The direct pre-order link (?preorder=1, 2026-11-23, sent to readers by email) skips it too: the pre-order window opens. */
if (!/[?&](donated|preorder)=/.test(location.search)) { var seen = false; try { seen = !!(localStorage.getItem('cia_in') || localStorage.getItem('cia_email')); } catch (e) {} document.documentElement.classList.add('gate-on', seen ? 'gate-back' : 'gate-ask'); }
/* the safety net (2026-11-21): only site.js shows the opening screen's form and lets the visitor in. If site.js never runs
   (a download that failed or stalled, or a browser too old to read it), a first-time visitor was left on a blank dark
   screen with no way in; YouTube viewers reported exactly that ("When you click the link to buy it the screen goes blank").
   site.js sets window.__ciaReady once the opening screen is wired. If it has not by the time the page has been read (the
   moment site.js, a deferred script, has run or failed), or 10 s after this line for a download that hangs, the site opens
   without the opening screen, and the text that site.js would fade in on scroll (.reveal, invisible until .is-in) is shown
   at once. The page as written still holds the pre-release wording and the giveaway prices; site.js swaps them by date,
   and every one of those dates has passed, so the safety net makes the same swaps (site.js: "release", "toPaid", the
   November 4 prices). It also turns the One-time / Monthly switch to One-time: the One-time ebook buttons are plain Square
   links that work without site.js, while every Monthly button needs it. Safe to run twice. Kept to ES5 so every browser
   that runs this file can run this too. */
(function () {
  var each = function (sel, fn) { var l = document.querySelectorAll(sel); for (var i = 0; i < l.length; i++) fn(l[i]); };
  var giveUp = function () {
    if (window.__ciaReady) return;
    var c = document.documentElement.classList;
    c.remove('gate-on'); c.remove('gate-ask'); c.remove('gate-back');
    each('.reveal', function (el) { el.classList.add('is-in'); });
    each('[data-early]', function (el) { if (el.parentNode) el.parentNode.removeChild(el); });
    each('[data-price]', function (el) { el.textContent = el.getAttribute('data-price'); });
    each('[data-giveaway]', function (el) { el.hidden = true; });
    each('[data-paid]', function (el) { el.hidden = false; });
    each('[data-release-text]', function (el) {
      for (var n = el.firstChild; n; n = n.nextSibling) {
        if (n.nodeType === 3 && n.nodeValue.replace(/\s/g, '')) { n.nodeValue = el.getAttribute('data-release-text') + (/\s$/.test(n.nodeValue) ? ' ' : ''); break; }
      }
    });
    var pre = document.getElementById('preorder');
    if (pre) pre.setAttribute('data-freq', 'once');
    each('.freq__opt', function (el) { el.setAttribute('aria-checked', el.getAttribute('data-freq') === 'once' ? 'true' : 'false'); });
    var note = document.getElementById('freqNote');   // "Continue to support… Cancel anytime." is for Monthly only
    if (note) note.hidden = true;
  };
  document.addEventListener('DOMContentLoaded', giveUp);
  setTimeout(giveUp, 10000);
})();
