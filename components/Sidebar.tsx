'use client';

/**
 * Sidebar.
 *
 * Grouped and labeled, because a flat list of nine items has no shape and
 * you end up reading all of it every time. Which items appear depends on the
 * business you're in — a contractor has no use for a client-request inbox.
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useOrg } from '@/lib/spine/org';
import { navFor } from '@/lib/spine/modules';
import { OrgSwitcher } from '@/components/spine/OrgSwitcher';
import { C, radius } from '@/components/spine/ui';
import { PRODUCT } from '@/lib/brand';

/**
 * Nav icons.
 *
 * Drawn at 1.75 stroke rather than 1.4 so they hold up next to the text
 * weight, and chosen to say what the thing IS rather than reaching for the
 * nearest generic glyph — a yard sign for jobs, a hard hat for customers, a
 * receipt for documents, a folder for files.
 */
const icons: Record<string, React.ReactNode> = {
  dashboard: (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 6.6 8 2l6 4.6" /><path d="M3.4 7.6V13a.8.8 0 0 0 .8.8h7.6a.8.8 0 0 0 .8-.8V7.6" />
      <path d="M6.4 13.8V9.6h3.2v4.2" />
    </svg>
  ),
  // A yard sign — what a contractor plants on a job.
  yardSign: (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.2" y="2" width="11.6" height="7.2" rx="1.1" />
      <path d="M5.2 5.1h5.6M5.2 7h3.4" />
      <path d="M8 9.2V14" /><path d="M5.6 14h4.8" />
    </svg>
  ),
  // A hard hat — the people a contractor deals with.
  clients: (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.2 11.4a5.8 5.8 0 0 1 11.6 0" />
      <path d="M6.2 6.1V3.4a.9.9 0 0 1 .9-.9h1.8a.9.9 0 0 1 .9.9v2.7" />
      <path d="M1.4 11.4h13.2" />
    </svg>
  ),
  // A receipt, torn edge and all.
  quotes: (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.4 1.8h9.2v11.4l-1.8-1.1-1.8 1.1-1.8-1.1-1.8 1.1-1.8-1.1z" />
      <path d="M5.8 5h4.4M5.8 7.8h3" />
    </svg>
  ),
  // A price tag.
  financials: (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.3 1.9H14v5.7L7.4 14.2a1 1 0 0 1-1.4 0L1.8 10a1 1 0 0 1 0-1.4z" />
      <circle cx="11.1" cy="4.8" r="1.05" />
    </svg>
  ),
  // A folder — records you keep.
  folder: (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.8 12.6V3.6a.9.9 0 0 1 .9-.9h3.1l1.5 1.8h6a.9.9 0 0 1 .9.9v7.2a.9.9 0 0 1-.9.9H2.7a.9.9 0 0 1-.9-.9z" />
    </svg>
  ),
  // Banknote.
  invoices: (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.4" y="3.6" width="13.2" height="8.8" rx="1.2" />
      <circle cx="8" cy="8" r="1.9" /><path d="M4.1 8h.02M11.9 8h.02" />
    </svg>
  ),
  // Bar chart with a rising line.
  chart: (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 13.6h12.2" />
      <path d="M4.2 13.6V9.4M7.4 13.6V6.2M10.6 13.6V8M13.8 13.6V3.4" />
    </svg>
  ),
  // Browser window — website work.
  designStudio: (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="2.6" width="13" height="10.8" rx="1.2" />
      <path d="M1.5 5.9h13" /><path d="M3.6 4.25h.02M5.5 4.25h.02" />
    </svg>
  ),
  // Paint swatches.
  brandKit: (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.7" y="1.7" width="5.6" height="5.6" rx="1" />
      <rect x="8.7" y="1.7" width="5.6" height="5.6" rx="1" />
      <rect x="1.7" y="8.7" width="5.6" height="5.6" rx="1" />
      <circle cx="11.5" cy="11.5" r="2.8" />
    </svg>
  ),
  // A signed document — a proposal awaiting a decision.
  proposal: (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 2.4h6.3L13 6v7.6a.9.9 0 0 1-.9.9H3.9a.9.9 0 0 1-.9-.9z" />
      <path d="M9.2 2.4V6H13" />
      <path d="M5.4 10.6c.9-1 1.6.9 2.5 0s1.6.6 2.5-.4" />
    </svg>
  ),
  // Wrench — setup.
  settings: (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.4 5.6a2.9 2.9 0 0 1-3.7 3.7l-4 4a1.3 1.3 0 0 1-1.9-1.9l4-4a2.9 2.9 0 0 1 3.7-3.7L7 5.2l.6 2.2 2.2.6z" />
    </svg>
  ),
  // Wrenches were doing duty for both Security and Business, which meant two
  // unrelated destinations looked identical and neither looked like itself.
  // A shield reads as protection; a storefront reads as the business.
  storefront: (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.3 6.2 3.4 2.6h9.2l1.1 3.6" />
      <path d="M2.3 6.2a1.8 1.8 0 0 0 3.5 0 1.8 1.8 0 0 0 3.5 0 1.8 1.8 0 0 0 3.5 0" />
      <path d="M3.1 7.6v5.8h9.8V7.6" />
      <path d="M6.4 13.4v-3.3h3.2v3.3" />
    </svg>
  ),
  wallet: (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4.6v7.2a1.4 1.4 0 0 0 1.4 1.4h9.2a1.4 1.4 0 0 0 1.4-1.4V6.8a1.4 1.4 0 0 0-1.4-1.4H3.4A1.4 1.4 0 0 1 2 4v0a1.4 1.4 0 0 1 1.4-1.4h8" />
      <path d="M11.2 9.2h.01" />
    </svg>
  ),
  // A page with writing on it. Notes and Proposals were sharing one glyph,
  // which reads as a rendering fault rather than a design.
  notes: (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.2 2.2h9.6v11.6H3.2z" />
      <path d="M5.6 5.4h4.8M5.6 8h4.8M5.6 10.6h3" />
    </svg>
  ),
  // A tray. Things arriving that you have to deal with.
  inbox: (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.9 8.6 3.6 2.9h8.8l1.7 5.7" />
      <path d="M1.9 8.6h3.4l.9 1.8h3.6l.9-1.8h3.4v3.8a.9.9 0 0 1-.9.9H2.8a.9.9 0 0 1-.9-.9z" />
    </svg>
  ),
  // A banknote with an arrow in. What somebody else is billing you.
  incoming: (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.6" y="4.4" width="12.8" height="8.2" rx="1.2" />
      <path d="M8 1.6v3.4" /><path d="M6.4 3.6 8 5.2l1.6-1.6" />
      <circle cx="8" cy="8.5" r="1.6" />
    </svg>
  ),
  // Announcing something. Pitches go out to people who have not asked yet.
  /**
   * Digital: a globe. The row asked for this and the set did not have it, so
   * the module has been rendering with no icon at all since it was renamed.
   */
  globe: (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="5.8" />
      <path d="M2.2 8h11.6" />
      <path d="M8 2.2c1.5 1.7 2.3 3.7 2.3 5.8S9.5 12.1 8 13.8C6.5 12.1 5.7 10.1 5.7 8S6.5 3.9 8 2.2z" />
    </svg>
  ),
  /**
   * People: a network, not a second copy of the clients icon.
   *
   * People and Clients were both asking for `clients`, so two adjacent rows
   * carried an identical glyph, which is worse than no icon: it says the two
   * rows are the same kind of thing when the whole point is that one is
   * companies and the other is humans. Nodes joined by lines, because that is
   * what an address book is.
   */
  network: (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="3.2" r="1.7" />
      <circle cx="3.4" cy="11.6" r="1.7" />
      <circle cx="12.6" cy="11.6" r="1.7" />
      <path d="M6.9 4.7 4.5 10.1M9.1 4.7l2.4 5.4M5.1 11.6h5.8" />
    </svg>
  ),
  search: (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7.2" cy="7.2" r="4.6" />
      <path d="M10.6 10.6 13.6 13.6" />
    </svg>
  ),
  crosshair: (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="5.6" /><circle cx="8" cy="8" r="1.6" />
      <path d="M8 .9v2.2M8 12.9v2.2M.9 8h2.2M12.9 8h2.2" />
    </svg>
  ),
  star: (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1.9l1.86 3.77 4.16.6-3.01 2.94.71 4.14L8 11.4l-3.72 1.95.71-4.14L1.98 6.27l4.16-.6z" />
    </svg>
  ),
  book: (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.3 2.6h4.2c.9 0 1.5.6 1.5 1.5v9.3c0-.7-.6-1.2-1.5-1.2H2.3z" />
      <path d="M13.7 2.6H9.5C8.6 2.6 8 3.2 8 4.1v9.3c0-.7.6-1.2 1.5-1.2h4.2z" />
    </svg>
  ),
  megaphone: (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.2 6.4v3.2a1 1 0 0 0 1 1h1.5l5.8 2.9V2.5L4.7 5.4H3.2a1 1 0 0 0-1 1z" />
      <path d="M12.6 6.2a2.6 2.6 0 0 1 0 3.6" />
    </svg>
  ),
  // Overlapping swatches. Brand Kit is your own identity; this is the shelf of
  // everyone else's.
  palette: (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1.9a6.1 6.1 0 1 0 0 12.2c.9 0 1.4-.6 1.4-1.3 0-.8-.7-1.2-.7-1.9 0-.6.5-1.1 1.2-1.1h1.2A3.1 3.1 0 0 0 14.1 6.7C13.7 4 11.1 1.9 8 1.9z" />
      <circle cx="5.2" cy="6.4" r=".85" /><circle cx="8" cy="4.9" r=".85" /><circle cx="10.8" cy="6.4" r=".85" />
    </svg>
  ),
  shield: (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1.6 2.9 3.8v3.5c0 3 2.1 5.7 5.1 6.9 3-1.2 5.1-3.9 5.1-6.9V3.8z" />
      <path d="M6.1 7.9 7.5 9.3l2.6-2.7" />
    </svg>
  ),
};

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { org, vocab } = useOrg();

  /**
   * Library covers three screens behind one entry, so it stays lit on any of
   * them. Everything else matches its own path.
   */
  /**
   * A sidebar row covers every tab underneath it.
   *
   * Money is one row and five screens. Without this, opening Receipts
   * un-highlights Money and nothing in the sidebar is lit — so the app looks
   * like it has lost track of where you are, on the screen you are looking at.
   */
  /**
   * Only Library covers more than one screen.
   *
   * This map is left over from the version where Money and Grow were single
   * rows with tabs behind them. Those became visible rows again and the
   * families stayed, so standing on Profit & Loss lit Profit & Loss AND
   * Invoices — two rows claiming to be where you are.
   */
  const GROUPS: Record<string, string[]> = {
    '/pricing': ['/pricing', '/records'],
    '/records': ['/pricing', '/records'],
  };

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    const family = GROUPS[href];
    if (family) return family.some((h) => pathname === h || pathname.startsWith(h + '/'));
    return pathname === href || pathname.startsWith(href + '/');
  };

  const navBtn = (label: string, href: string, iconKey: string) => {
    const active = isActive(href);
    return (
      <button
        key={href}
        className="navItem"
        onClick={() => router.push(href)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 11,
          width: '100%',
          padding: '6px 12px',
          margin: '1px 0',
          borderRadius: radius.md,
          border: 'none',
          /**
           * Darker and evenly weighted, but not larger.
           *
           * Dimming every unselected row was the real mistake: it made fourteen
           * items read as one active thing and thirteen disabled ones, so the
           * eye had to work to find anything not already open. Selection is
           * carried by the background and the icon instead, and every
           * destination is set in the same weight because every one of them is
           * equally real.
           *
           * The size went with it and should not have. Carta's rows are roomy
           * because Carta's sidebar holds five of them; the same spacing across
           * fourteen items and three group headings is a column you scroll
           * rather than scan. Density is a function of how much is in the list,
           * not a house style you can copy across.
           */
          fontSize: 14,
          color: C.text,
          fontWeight: 500,
          letterSpacing: '-0.005em',
          background: active ? C.accentSoft : 'transparent',
          cursor: 'pointer',
          fontFamily: 'inherit',
          textAlign: 'left',
        }}
      >
        <span
          className="navIcon"
          data-icon={iconKey}
          style={{
            width: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            color: active ? C.accent : C.dim,
          }}
        >
          {icons[iconKey]}
        </span>
        {label}
      </button>
    );
  };

  const groups = navFor(org, vocab);

  /**
   * Collapsed sections, remembered.
   *
   * Fourteen rows is more than anyone scans; it gets read once and then
   * navigated by muscle memory, which is how items become invisible. Folding
   * a section away is the difference between a list you skim and a list you
   * ignore.
   *
   * The choice persists per browser rather than per account. It is a
   * preference about this screen on this machine, not a fact about the
   * business, and syncing it would mean a phone deciding what a desktop looks
   * like.
   */
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      /**
       * Versioned, so restructuring the nav resets the defaults once.
       *
       * Without this, a preference saved against the old group names survives
       * a rename and the new defaults never apply: the groups meant to start
       * folded stay open, and the sidebar somebody was told would be nine rows
       * is sixteen. A stored choice about a nav that no longer exists is not a
       * choice worth honoring.
       */
      const saved = window.localStorage.getItem('nav.closed.v2');
      if (saved) {
        setClosed(new Set(JSON.parse(saved) as string[]));
      } else {
        // First visit: honor the defaults the nav declares.
        setClosed(new Set(groups.filter((g) => g.defaultOpen === false).map((g) => g.heading).filter((h): h is string => Boolean(h))));
      }
    } catch {
      // A browser refusing storage is not a reason to render nothing.
    }
    setReady(true);
    // Runs once. Re-running on every nav change would reset the user's
    // choice every time they switch business.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleGroup = useCallback((heading: string) => {
    setClosed((prev) => {
      const next = new Set(prev);
      if (next.has(heading)) next.delete(heading);
      else next.add(heading);
      try {
        window.localStorage.setItem('nav.closed.v2', JSON.stringify([...next]));
      } catch {
        // Storage unavailable; the choice still applies for this session.
      }
      return next;
    });
  }, []);

  return (
    <div
      style={{
        width: 212,
        flexShrink: 0,
        background: C.rail,
        borderRight: `1px solid ${C.border}`,
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        fontFamily: 'inherit',
      }}
    >
      <div
        style={{
          height: 56,
          display: 'flex',
          alignItems: 'center',
          padding: '0 18px',
          flexShrink: 0,
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <span
          onClick={() => router.push('/')}
          style={{
            fontSize: 16.5,
            fontWeight: 600,
            color: C.text,
            letterSpacing: '-0.3px',
            cursor: 'pointer',
          }}
        >
          {PRODUCT}
        </span>
      </div>

      <div style={{ padding: '12px 12px 6px' }}>
        <OrgSwitcher />
      </div>

      <div style={{ flex: 1, padding: '8px 8px 8px', overflowY: 'auto' }}>
        {navBtn('Needs you', '/', 'dashboard')}

        {groups.map((g) => {
          // A collapsed section that hides the page you are on would leave you
          // unable to see where you are. Force it open in that case.
          const holdsCurrent = g.items.some((i) => isActive(i.href));
          const isClosed = ready && g.heading && closed.has(g.heading) && !holdsCurrent;

          return (
            <div key={g.heading || g.items[0]?.href} style={{ marginTop: g.heading ? 15 : 6 }}>
              {g.heading && (
                <button
                  onClick={() => toggleGroup(g.heading as string)}
                  aria-expanded={!isClosed}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    fontSize: 10,
                    textTransform: 'uppercase',
                    letterSpacing: '0.09em',
                    color: C.faint,
                    fontWeight: 600,
                    padding: '0 12px 5px',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    textAlign: 'left',
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      display: 'inline-block',
                      fontSize: 8,
                      transform: isClosed ? 'rotate(-90deg)' : 'none',
                      transition: 'transform .18s ease',
                    }}
                  >
                    ▼
                  </span>
                  {g.heading}
                  {isClosed && (
                    <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>
                      {g.items.length}
                    </span>
                  )}
                </button>
              )}
              {!isClosed && g.items.map((i) => navBtn(i.label, i.href, i.icon))}
            </div>
          );
        })}
      </div>


    </div>
  );
}
