/* a refresh opens at the very top, never where the reader left off */ if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
/* the opening screen: the visitor enters an email to open the file, and that tap or key press turns the sound on.
   A donor sent back from Square (?donated=…) skips it: the thank-you pop-up opens instead. A visitor who has entered an
   email before gets it with no email to type (gate-back, Jason, 2026-10-17): "Welcome back" and one tap, which opens the
   file and turns the shutter sound on (a browser plays sound only after a tap). This browser remembers them, or else
   site.js asks PitchZing whether this network and browser signed up (gate-ask keeps the form out of sight meanwhile). */
if (!/[?&]donated=/.test(location.search)) { var seen = false; try { seen = !!(localStorage.getItem('cia_in') || localStorage.getItem('cia_email')); } catch (e) {} document.documentElement.classList.add('gate-on', seen ? 'gate-back' : 'gate-ask'); }
