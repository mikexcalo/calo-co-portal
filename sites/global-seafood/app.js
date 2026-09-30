/* Global Seafood Partners: the three things the page does.
   The pop-up, the phone's side tabs, and the reveal on scroll. */
(function () {
  'use strict';

  /* ------------------------------------------------------------- the pop-up
     Every "Get in touch" opens it. The form posts to the same endpoint the
     holding page posted to, with the same fields and the same source, because
     that source is how Nautilus decides whose book a lead lands in. */
  var pop = document.getElementById('pop');
  var form = document.getElementById('enquiry');
  var note = document.getElementById('pop-note');
  var send = document.getElementById('pop-send');
  var lastFocus = null;

  function openPop(e) {
    if (e) e.preventDefault();
    lastFocus = document.activeElement;
    closeDrawer();
    pop.hidden = false;
    document.body.style.overflow = 'hidden';
    var first = form.querySelector('input:not([tabindex="-1"])');
    if (first) first.focus();
  }

  function closePop() {
    pop.hidden = true;
    document.body.style.overflow = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  Array.prototype.forEach.call(document.querySelectorAll('[data-pop]'), function (el) {
    el.addEventListener('click', openPop);
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-pop-close]'), function (el) {
    el.addEventListener('click', closePop);
  });

  /* Escape closes, and a click on the dimmed page behind it closes. Both are
     what anybody expects of a dialog, and neither loses anything typed that
     the person did not choose to lose. */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !pop.hidden) closePop();
    if (e.key === 'Escape' && !drawer.hidden) closeDrawer();
  });

  /* Focus stays inside the dialog while it is open. */
  pop.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab') return;
    var f = pop.querySelectorAll('button, [href], input, textarea');
    var list = Array.prototype.filter.call(f, function (el) { return el.offsetParent !== null || el === document.activeElement; });
    if (!list.length) return;
    var first = list[0], last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var data = {};
    new FormData(form).forEach(function (v, k) { data[k] = String(v); });
    /* Names the source, which is how Nautilus decides whose book it lands in. */
    data.source = 'globalseafood.partners';
    note.textContent = 'Sending…';
    note.className = 'pop__note';
    send.disabled = true;

    fetch('https://nautilusapp.vercel.app/api/leads/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(function (r) {
      if (!r.ok) throw new Error('bad status');
      note.textContent = 'Got it. We’ll come back to you shortly.';
      note.className = 'pop__note ok';
      form.reset();
      setTimeout(closePop, 2200);
    }).catch(function () {
      /* Never a dead end: if the post fails, hand them the address. */
      note.innerHTML = 'That didn’t send. Email <a href="mailto:john.littonny@gmail.com">john.littonny@gmail.com</a>.';
      note.className = 'pop__note';
    }).then(function () { send.disabled = false; });
  });

  /* ------------------------------------------------------------- the drawer
     The phone header has no room for four links, so they live behind the
     burger. */
  var drawer = document.getElementById('drawer');
  function closeDrawer() { if (drawer) { drawer.hidden = true; document.body.style.overflow = pop.hidden ? '' : 'hidden'; } }
  Array.prototype.forEach.call(document.querySelectorAll('[data-drawer-open]'), function (el) {
    el.addEventListener('click', function () { drawer.hidden = false; document.body.style.overflow = 'hidden'; });
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-drawer-close]'), function (el) {
    el.addEventListener('click', closeDrawer);
  });

  /* --------------------------------------------------------- pick your side
     Hover does the picking on a desktop, where there is room for both panels
     at once. A phone gets two tabs, because it has neither. */
  var tabs = document.querySelectorAll('.tab');
  if (tabs.length) {
    Array.prototype.forEach.call(tabs, function (tab) {
      tab.addEventListener('click', function () {
        var want = tab.getAttribute('data-side');
        Array.prototype.forEach.call(tabs, function (t) {
          t.setAttribute('aria-selected', String(t.getAttribute('data-side') === want));
        });
        Array.prototype.forEach.call(document.querySelectorAll('.side'), function (s) {
          s.hidden = window.matchMedia('(max-width: 899px)').matches && s.getAttribute('data-side') !== want;
          /* The panel that was hidden never crossed the viewport, so the
             observer never saw it arrive and it is still at opacity zero.
             Switching tabs is the arrival. */
          if (!s.hidden) s.classList.add('seen');
        });
      });
    });
    /* Both panels are in the markup for a desktop, so the phone hides one only
       once it is actually a phone, and shows both again if the window grows. */
    var phone = window.matchMedia('(max-width: 899px)');
    var sync = function () {
      var want = document.querySelector('.tab[aria-selected="true"]');
      want = want ? want.getAttribute('data-side') : 'prod';
      Array.prototype.forEach.call(document.querySelectorAll('.side'), function (s) {
        s.hidden = phone.matches && s.getAttribute('data-side') !== want;
      });
    };
    sync();
    if (phone.addEventListener) phone.addEventListener('change', sync);
    else if (phone.addListener) phone.addListener(sync);
  }

  /* ------------------------------------------------------------- the hero
     Low Power Mode refuses autoplay, and iOS does not tell the page it has:
     play() returns a promise that rejects and the poster sits there looking
     like a still. The first thing the visitor does - a touch, a scroll, a
     key - is permission enough, so try again then, once.

     Only when it is actually stopped. Calling play() on a video that is
     already running is harmless but the listeners are not worth keeping
     bound for a case that has not happened. */
  var hero = document.querySelector('.hero__media');
  if (hero) {
    var nudge = function () {
      if (!hero.paused) return;
      var p = hero.play();
      if (p && p.catch) p.catch(function () { /* still refused; the poster stands */ });
    };
    var first = function () {
      nudge();
      ['touchstart', 'scroll', 'keydown', 'pointerdown'].forEach(function (ev) {
        window.removeEventListener(ev, first);
      });
    };
    nudge();
    ['touchstart', 'scroll', 'keydown', 'pointerdown'].forEach(function (ev) {
      window.addEventListener(ev, first, { passive: true });
    });
  }

  /* ------------------------------------------------------------ you are here
     The underline follows the section being read, so the nav answers "where
     am I" on a page that is one long scroll. `aria-current="page"` already
     covers About, and this covers the two sections of the home page.

     Whichever section covers the middle of the window wins. Comparing
     distance to the viewport's centre rather than "is it visible" stops the
     mark flickering between two sections that are both on screen. */
  var spied = [];
  Array.prototype.forEach.call(document.querySelectorAll('.nav a[href*="#"], .drawer nav a[href*="#"]'), function (a) {
    var id = (a.getAttribute('href') || '').split('#')[1];
    var section = id && document.getElementById(id);
    if (section) spied.push({ link: a, section: section });
  });

  if (spied.length) {
    var here = null;
    var mark = function () {
      var middle = window.scrollY + window.innerHeight / 2;
      var best = null, bestGap = Infinity;
      spied.forEach(function (s) {
        var box = s.section.getBoundingClientRect();
        var top = box.top + window.scrollY;
        if (middle < top || middle > top + box.height) return;
        var gap = Math.abs(middle - (top + box.height / 2));
        if (gap < bestGap) { bestGap = gap; best = s.link; }
      });
      if (best === here) return;
      if (here) here.classList.remove('is-here');
      if (best) best.classList.add('is-here');
      here = best;
    };
    var ticking = false;
    var onScroll = function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () { mark(); ticking = false; });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    mark();
  }

  /* ------------------------------------------------------ sections arriving
     Once each, on the way in. Never replays, never delays reading: anything
     the observer cannot watch is simply shown. */
  var reveals = document.querySelectorAll('.reveal');
  var wantsLess = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!('IntersectionObserver' in window) || wantsLess) {
    Array.prototype.forEach.call(reveals, function (el) { el.classList.add('seen'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        /* Above the fold counts as arrived. Anyone who lands on #partners, or
           restores a scrolled page, skips past these sections without ever
           crossing them, and a section that never arrives never appears. */
        var passed = entry.boundingClientRect.top < 0;
        if (!entry.isIntersecting && !passed) return;
        entry.target.classList.add('seen');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -12% 0px' });
    Array.prototype.forEach.call(reveals, function (el) { io.observe(el); });
  }
})();
