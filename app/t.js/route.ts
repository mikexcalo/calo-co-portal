/**
 * The tracker, served as one file.
 *
 * One script tag with a token on it, and nothing else to install. It is served
 * from here rather than pasted into each site so that a fix reaches every site
 * at once instead of needing somebody to re-paste a snippet into Wix.
 *
 * Constraints it is built to:
 *
 *   No cookies, no localStorage. The session key is derived server side, so
 *   the page stores nothing and needs no consent banner.
 *
 *   Never breaks the host page. Every listener is inside a try, sends use
 *   sendBeacon where it exists, and a failure is silent. Somebody's site going
 *   down because analytics threw is not a trade worth making.
 *
 *   Path only. The query string never leaves the page, because query strings
 *   carry email addresses and reset tokens.
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const SCRIPT = String.raw`(function () {
  try {
    var el = document.currentScript;
    var token = el && el.getAttribute('data-site');
    if (!token) return;
    var endpoint = (el.src || '').replace(/\/t\.js.*$/, '') + '/api/track';

    function send(payload) {
      try {
        payload.t = token;
        payload.p = location.pathname;
        payload.vw = window.innerWidth;
        var body = JSON.stringify(payload);
        if (navigator.sendBeacon) {
          navigator.sendBeacon(endpoint, new Blob([body], { type: 'application/json' }));
        } else {
          var x = new XMLHttpRequest();
          x.open('POST', endpoint, true);
          x.setRequestHeader('Content-Type', 'application/json');
          x.send(body);
        }
      } catch (e) {}
    }

    var q = new URLSearchParams(location.search);

    // The arrival. Referrer is sent whole and reduced to a host on the server,
    // so the rule about what gets kept lives in one place.
    send({
      ev: 'view',
      ref: document.referrer || null,
      utm: {
        source: q.get('utm_source'),
        medium: q.get('utm_medium'),
        campaign: q.get('utm_campaign')
      }
    });

    /**
     * Clicks, bucketed to a 20px grid.
     *
     * Sent as grid cells rather than coordinates because the useful question
     * is "does anyone press this" and the precise version answers questions
     * nobody should be asking. Labels come from an explicit attribute or the
     * element's own text, capped, so a heatmap can be read without guessing.
     */
    document.addEventListener('click', function (e) {
      try {
        var t = e.target;
        if (!t || !t.closest) return;
        var a = t.closest('a,button,[data-track]');
        var label = null;
        if (a) {
          label = a.getAttribute('data-track') ||
                  (a.textContent || '').trim().slice(0, 60) || null;
        }
        send({
          ev: a && a.getAttribute('data-goal') ? 'goal' : 'click',
          gx: Math.floor(e.clientX / 20),
          gy: Math.floor((e.clientY + (window.scrollY || 0)) / 20),
          label: label
        });
      } catch (err) {}
    }, true);

    /**
     * Scroll depth, at quarters, each reported once.
     *
     * The only metric here that says whether the page works: plenty of people
     * arrive, and the question is whether any of them reach the part that
     * asks them to do something.
     */
    var hit = {};
    function depth() {
      try {
        var h = document.documentElement;
        var full = Math.max(h.scrollHeight - window.innerHeight, 1);
        var pct = ((window.scrollY || 0) / full) * 100;
        [25, 50, 75, 100].forEach(function (m) {
          if (pct >= m && !hit[m]) {
            hit[m] = 1;
            send({ ev: 'scroll', scroll: m });
          }
        });
      } catch (e) {}
    }

    var waiting = false;
    window.addEventListener('scroll', function () {
      if (waiting) return;
      waiting = true;
      // Once a frame at most. An unthrottled scroll handler is how analytics
      // gets blamed for a page feeling slow.
      requestAnimationFrame(function () { waiting = false; depth(); });
    }, { passive: true });

    depth();
  } catch (e) {}
})();`;

export async function GET(_req: NextRequest) {
  return new NextResponse(SCRIPT, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      // Long enough to stay out of the way, short enough that a fix lands the
      // same day rather than whenever somebody's cache expires.
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
