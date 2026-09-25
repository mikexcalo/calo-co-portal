'use client';

/**
 * Sidebar.
 *
 * Grouped and labeled, because a flat list of nine items has no shape and
 * you end up reading all of it every time. Which items appear depends on the
 * business you're in — a contractor has no use for a client-request inbox.
 */

import { useCallback, useEffect, useState } from 'react';
import supabase from '@/lib/supabase';
import { useRouter, usePathname } from 'next/navigation';
import { useOrg } from '@/lib/spine/org';
import { useViewAs } from '@/lib/spine/viewas';
import { clientOwner, type ClientOwner } from '@/lib/spine/client-view';
import { OrgSwitcher } from '@/components/spine/OrgSwitcher';
import {
  workspaceColor,
  workspaceKindLabel,
  workspaceInitials,
  workspaceLogo,
  readableOn,
} from '@/lib/spine/workspace-color';
import { modulesFor, navFor } from '@/lib/spine/modules';
import { C, radius } from '@/components/spine/ui';
import { PRODUCT_MARK, PROVIDER } from '@/lib/brand';

/**
 * Nav icons.
 *
 * Drawn at 1.75 stroke rather than 1.4 so they hold up next to the text
 * weight, and chosen to say what the thing IS rather than reaching for the
 * nearest generic glyph — a yard sign for jobs, a hard hat for customers, a
 * receipt for documents, a folder for files.
 */
/**
 * Exported, because Access shows the same list of modules and was drawing
 * twenty rows of identical text. A row there and the row a client will see in
 * their own sidebar should be recognisably the same object.
 */
/*
  Parking is gone.

  A minus on every nav row moved it to a "Not using" group at the bottom. The
  idea was that half the sidebar is a reminder a screen exists rather than
  somewhere anybody goes, and letting somebody file those away would keep the
  list short without losing them.

  It cost more than it saved. A hover control on fourteen rows, a group whose
  contents were invisible until you opened it, a stored preference that had to
  be keyed per workspace, and a row that rearranged itself under the click that
  opened it. Three bugs for a list of eighteen items that fits on the screen.

  The sidebar is the map. If a row does not belong in it, the answer is to turn
  the module off in Access, not to hide the row and keep the module.
*/

export const NAV_ICONS: Record<string, React.ReactNode> = {
  dashboard: (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 6.6 8 2l6 4.6" /><path d="M3.4 7.6V13a.8.8 0 0 0 .8.8h7.6a.8.8 0 0 0 .8-.8V7.6" />
      <path d="M6.4 13.8V9.6h3.2v4.2" />
    </svg>
  ),
  /*
    A map.

    Two tries at this. It was a yard sign — the board planted on a finished job
    — and then a trail running to a dropped pin, which was closer but still a
    diagram of a journey rather than the thing you open. Route is where you
    look to see the day laid out, so it is a folded map: three panels, the
    shape every map has had since before any of this was on a screen, and
    nothing to work out at seventeen pixels.
  */
  yardSign: (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.8 4.3 5.9 2.5v9.2L1.8 13.5z" />
      <path d="M5.9 2.5l4.2 1.8v9.2L5.9 11.7z" />
      <path d="M10.1 4.3l4.1-1.8v9.2l-4.1 1.8z" />
    </svg>
  ),
  /*
    Third go at this one.

    It was a hard hat — said out loud once and it could not be unseen. I
    replaced it with two buildings, which is a real thing but is also what
    every property app in the world uses, and it still reads as architecture
    rather than as the people you work for.

    A client is somebody you have an ongoing relationship with, so: a person,
    with a second one behind them. People next door is a network of nodes —
    the address book, everyone you know — and these two are not the same
    picture at seventeen pixels.
  */
  clients: (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6.1" cy="5.4" r="2.5" />
      <path d="M1.9 13.4a4.2 4.2 0 0 1 8.4 0" />
      <path d="M10.7 3.3a2.5 2.5 0 0 1 0 4.2" />
      <path d="M12.3 9.6a4.2 4.2 0 0 1 1.8 3.8" />
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
  /*
    Two files, one behind the other.

    A single folder outline is the same glyph as every Documents row in every
    product, and Records is not a folder — it is the drawer: insurance,
    licenses, contracts, the things you keep rather than the things you are
    working on. A filled tab sitting behind a clear one says "more than one,
    filed" at a glance, and reads at seventeen pixels where a stack of thin
    outlines would turn to mush.
  */
  folder: (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {/* Just the tab of the one behind, showing past the edge. Filling the
          whole shape turned it into a drop shadow. */}
      <path d="M4.4 2.6h2.4l1.2 1.45h4.9" />
      <path d="M1.5 13.2V5.1a.9.9 0 0 1 .9-.9h2.9l1.35 1.65h5.5a.9.9 0 0 1 .9.9v6.45a.9.9 0 0 1-.9.9H2.4a.9.9 0 0 1-.9-.9z" fill="var(--panel, #FFFFFF)" />
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
  /**
   * Brand: three swatches fanned out, the way you hold paint chips.
   *
   * It was a two-by-two grid with a dot in one corner, which is the glyph
   * every product uses for "apps" or "dashboard" and said nothing about
   * colour, type or a mark. This is the one object that only ever means brand.
   */
  /*
    A painter's palette.

    Third go at this. A grid of swatch cards read as "apps", a drop of colour
    read as a teardrop, and a tag read as a price label — each one a picture of
    something adjacent to brand rather than of brand. A palette is the object a
    person holds while choosing colour, and nothing else in a sidebar looks
    remotely like one.

    The thumb hole is what makes it read at seventeen pixels; without it the
    outline is just a blob.
  */
  brandKit: (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1.6c-3.5 0-6.4 2.7-6.4 6.1 0 3.4 2.9 6.1 6.4 6.1.9 0 1.6-.6 1.6-1.4 0-.4-.2-.7-.4-1a1.3 1.3 0 0 1 1-2.2h1.1c1.8 0 3.1-1.3 3.1-3 0-2.6-2.8-4.6-6.4-4.6Z" />
      <circle cx="4.9" cy="7.7" r=".85" />
      <circle cx="6.9" cy="4.8" r=".85" />
      <circle cx="10.4" cy="5.3" r=".85" />
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
  // An arrow falling into a circle. Somewhere things land.
  drop: (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="6.2" />
      <path d="M8 4.9v5.4" />
      <path d="M5.9 8.4 8 10.5l2.1-2.1" />
    </svg>
  ),
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
  // Pitches: a paper plane. Moved to Money when Pipeline was retired, and the
  // sidebar set had no glyph for it.
  send: (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13.9 2.5 7.3 9.1" />
      <path d="M13.9 2.5 9.6 13.8 7.3 9.1 2.6 6.8z" />
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
  /*
    There was a GROUPS map here, and the comment above it described exactly
    the bug it still had:

      '/pricing': ['/pricing', '/records'],
      '/records': ['/pricing', '/records'],

    Left over from when Money was one row with tabs behind it. Those became
    real rows and the family stayed, so standing on Price List lit Price List
    AND Records — two rows both claiming to be where you are, which is what
    makes the sidebar feel like it moves under you when you click.

    A row is where you are, or it is not. There is no family.
  */
  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(href + '/');
  };

  const navBtn = (label: string, href: string, iconKey: string) => {
    const active = isActive(href);
    return (
      <div key={href} className="navRow" style={{ position: 'relative' }}>
      <button
        className="navItem"
        onClick={() => router.push(href)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 11,
          width: '100%',
          padding: '6px 12px',
          margin: '1px 0',
          borderRadius: 999,
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
          // Figtree. Every row here names a place, and naming things is what
          // the display face is for.
          fontFamily: 'var(--font-display), var(--font-sans), system-ui, sans-serif',
          fontSize: 14,
          color: C.text,
          fontWeight: 500,
          letterSpacing: '-0.005em',
          background: active ? C.accentSoft : 'transparent',
          cursor: 'pointer',
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
          {NAV_ICONS[iconKey]}
        </span>
        {label}
        {/* Not red. Red is for money that is late and things that are broken;
            this is "somebody left you something", which is a different
            feeling and should not borrow the alarm. */}
        {!!counts[href] && (
          <span
            aria-label={`${counts[href]} waiting`}
            style={{
              marginLeft: 'auto', flexShrink: 0,
              minWidth: 18, height: 18, borderRadius: 999,
              padding: '0 5px', display: 'inline-flex',
              alignItems: 'center', justifyContent: 'center',
              background: C.accentSoft, color: C.accent,
              fontSize: 11, fontWeight: 600, fontVariantNumeric: 'tabular-nums',
            }}
          >
            {counts[href]}
          </span>
        )}
      </button>
      </div>
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



  /**
   * A BADGE IS A PROMISE THAT SOMETHING ARRIVED.
   *
   * The tempting version of this puts a count on every module — invoices,
   * projects, clients, the lot. It fails, and it fails in a way that takes the
   * useful badges down with it: a count derived from your own data never
   * reaches zero. You will always have invoices. So the badge becomes
   * permanent decoration, the eye stops reading any of them, and the one that
   * actually meant "a client just asked you for something" stops working.
   *
   * The test is whether you could know without being told, and whether looking
   * clears it. Drops and Requests both pass: somebody else put them there
   * while you were elsewhere, and opening the screen is the end of it.
   * Everything else on this sidebar is your own book, already counted on the
   * screen it belongs to, and Home carries what needs you today.
   *
   * Two counts, fetched once when the workspace loads.
   */
  const [counts, setCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!org?.id) { setCounts({}); return; }
    let off = false;
    (async () => {
      const [drops, reqs] = await Promise.all([
        supabase.from('documents').select('id', { count: 'exact', head: true })
          .eq('org_id', org.id).is('job_id', null).is('customer_id', null),
        supabase.from('site_requests').select('id', { count: 'exact', head: true })
          .eq('org_id', org.id).eq('status', 'open'),
      ]);
      if (off) return;
      setCounts({ '/inbox': drops.count ?? 0, '/requests': reqs.count ?? 0 });
    })();
    return () => { off = true; };
  }, [org?.id]);

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
        /* The row that holds it decides how tall it is. It used to say 100vh,
           which is right until something sits above it: in View mode the
           column starts below a 48px bar and inside an 8px frame, and a
           viewport-height sidebar in a shorter box hangs its own foot off the
           bottom. Stretching to the parent is correct in both layouts. */
        height: '100%',
        minHeight: 0,
        fontFamily: 'inherit',
      }}
    >
      {/*
        The product's name, above the business's.

        The plate answers "whose data is this", which is the question that
        costs money to get wrong, so it keeps the size and the weight. This
        answers "what am I in", which somebody asks once and then never again,
        so it sits above it small and grey and takes no room.

        Not a button. Everything else in this column goes somewhere, and a row
        that looks like the rest and does nothing when pressed is worse than no
        row. There is nowhere for it to go: the product has no page about
        itself.

        Never on a public page, and not by a rule written here. The shell
        returns bare children for /login, /e/, /i/, /p/ and the rest, so the
        sidebar is not built at all on any page a client or a stranger opens.
      */}
      <ProductName />

      <div
        style={{
          minHeight: 56,
          display: 'flex',
          alignItems: 'center',
          padding: '10px 18px',
          flexShrink: 0,
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        {/*
          The workspace, not the product.

          This said CALO&CO on every screen of every business, because the
          switcher in the top bar was carrying the identity. That put the one
          fact you most need — whose data am I about to change — in a pill on
          the far side of the screen, and the biggest, boldest thing in the
          corner named the software instead.

          The plate is the identity and the control. The pill in the top bar
          is gone, so there is one of these and not two.
        */}
        <NamePlate />
      </div>

      {/*
        Search, above everything it searches.

        It lived in the top bar across the content, which is a fine place for
        it and the wrong place to learn it exists, the sidebar is where
        somebody looks for a way into something. It is the first row now, above
        Home, because it reaches every row under it.
      */}
      <div style={{ padding: '10px 8px 2px' }}>
        <button
          onClick={() => window.dispatchEvent(new Event('calo:open-search'))}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 9,
            padding: '8px 10px', borderRadius: radius.md,
            border: `1px solid ${C.border}`, background: C.panelAlt,
            color: C.faint, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit',
            textAlign: 'left',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
            <circle cx="7.1" cy="7.1" r="4.6" />
            <path d="m10.6 10.6 3 3" />
          </svg>
          <span style={{ flex: 1 }}>Search or ask</span>
          <span style={{ fontSize: 11.5 }}>&#8984;K</span>
        </button>
      </div>

      {/*
        The nav takes the room it needs, and gives it back when there is none.

        It used to take every spare pixel, so on a business with eight rows the
        controls at the foot were shoved to the bottom of a tall empty column
        and the sidebar read as half-loaded. Hence "no more than it needs", and
        the gap below being just gap.

        But it was also `flexShrink: 0`, which is the other half of that
        sentence and was missing. A column fixed at 100vh whose contents cannot
        shrink does not scroll, it overflows: on Harbor Light, at a 763px
        window, "Set up by CALO&CO" sat at 806px. Off the bottom of the screen,
        in a workspace whose owner is the one person that line is written for.
        Measured in Chrome, not reasoned about.

        `0 1 auto` keeps "no more than it needs" and adds "less, if that is all
        there is". `minHeight: 0` is what actually permits it, because a flex
        item will not shrink below its content without it, and then the rows
        scroll inside the nav rather than pushing the foot off the screen.
      */}
      <div style={{ flex: '0 1 auto', minHeight: 0, padding: '8px 8px 8px', overflowY: 'auto' }}>
        {navBtn('Home', '/', 'dashboard')}
        {/*
          Drops belongs beside Home, not inside The work.
          
          It is where something lands before anybody has decided what it is,
          which is the opposite of the work, and filed under a heading it
          made no sense under, nobody could say what it was for.
        */}
        {/* Asked of the modules directly. Checking the groups meant Drops
            vanished the moment it stopped being in one, which is exactly what
            moving it here did. */}
        {modulesFor(org).has('inbox') && navBtn('Drops', '/inbox', 'drop')}

        {groups.map((g0) => {
          const g = g0;
          // A collapsed section that hides the page you are on would leave you
          // unable to see where you are. Force it open in that case.
          const holdsCurrent = g.items.some((i) => isActive(i.href));
          /*
            A heading over two rows is heavier than the two rows.

            These labels were written for the agency sidebar, where Money is
            seven rows and The Work is four and the headings genuinely sort
            them. Mark's workspace has three modules in total, so he was
            getting THE WORK over one row and MONEY over two — more chrome
            than content, and nothing being organised.

            Three rows earns a label. Under that the rows stand on their own.
          */
          const worthLabelling = g.items.length >= 3;
          const isClosed = ready && g.heading && worthLabelling && closed.has(g.heading) && !holdsCurrent;

          return (
            <div key={g.heading || g.items[0]?.href} style={{ marginTop: g.heading && worthLabelling ? 15 : 6 }}>
              {g.heading && worthLabelling && (
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
                    fontFamily: 'var(--font-display), var(--font-sans), system-ui, sans-serif',
                    fontSize: 10,
                    textTransform: 'uppercase',
                    letterSpacing: '0.09em',
                    color: C.faint,
                    fontWeight: 600,
                    padding: '0 12px 5px',
                    cursor: 'pointer',
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

      {/*
        Where help sits in every product anybody has used: the bottom.
        
        The box for this was at the foot of the home screen and exactly one
        person ever found it. A beta lives on what its testers tell you, so it
        gets an address.
      */}
      {/*
        Not on the agency's own workspace.

        Tell us is how a client reaches us, and the role preview below it is
        for checking what somebody with fewer permissions sees. On CALO&CO both
        are pointed at the person already reading them: telling yourself
        something, and previewing a role nobody else holds. This is the screen
        everything is administered from, and a control that does nothing here
        is worse than one that is missing.
      */}
      <div style={{ flex: 1, minHeight: 12 }} />

      {/*
        A button, shaped like one.

        It was a nav row, identical to Home and Jobs, so it read as another
        place in the product rather than as the way to say something to a
        person. And the megaphone made it worse: a megaphone is somebody
        broadcasting AT you, so next to "Tell us" it looked like announcements
        from us rather than a line back. It is a speech bubble, which is the
        direction this actually goes.
      */}
      {org?.kind !== 'agency' && modulesFor(org).has('feedback') && (
        <div style={{ padding: '2px 10px 8px' }}>
          <button
            onClick={() => router.push('/feedback')}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 8, padding: '9px 12px', borderRadius: radius.pill,
              border: `1px solid ${C.borderStrong ?? C.border}`, background: C.panel,
              color: C.text, fontSize: 13.5, fontWeight: 500,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M13.8 9.4a1.4 1.4 0 0 1-1.4 1.4H5.6L2.8 13.5V3.6a1.4 1.4 0 0 1 1.4-1.4h8.2a1.4 1.4 0 0 1 1.4 1.4z" />
            </svg>
            Tell Us
          </button>
        </div>
      )}

      {/*
        Whose account it is, which in View mode is not yours.

        The client's own sidebar ends with the person signed into it. Yours
        ends with an avatar in the top bar, and in View mode the top bar is not
        drawn, so without this the one thing on screen that says whose session
        this is would be missing from a mode whose whole claim is "exactly as
        they see it".

        Only in View mode, and only when there is a real name to print. A
        workspace the studio set up and has not handed over has no second
        person in it, and a tile reading "Mike Calo, Owner" at the foot of a
        client's sidebar would say the opposite of what this mode means.
      */}
      <ClientIdentity />

      {/*
        Whose software this is, where an attribution belongs.

        "Powered by" was wrong in both workspaces it appeared in.

        In the studio it was CALO&CO telling CALO&CO who powers CALO&CO. An
        attribution is for somebody else's benefit; there is nobody else here,
        and a line of small print saying your own name back to you is noise at
        the bottom of every screen you work on. Gone.

        In a client's workspace "powered by" describes a hosting arrangement.
        The relationship is not that. Mike sat down with these people, set the
        workspace up and still runs it, and "Set up by" is what actually
        happened. It also reads as a person having done something rather than
        an infrastructure credit, which is the difference worth paying for.

        Still a link out, because the one person who clicks it is a client
        wondering who to call.

        The comment sits above the conditional rather than inside it: an
        `{x && (...)}` takes exactly one child and a comment counts as one.
      */}
      {org?.kind !== 'agency' && (
        <div style={{ padding: '4px 14px 8px' }}>
          <a
            href="https://calo.company"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 11.5, color: C.faint, textDecoration: 'none' }}
          >
            Set up by {PROVIDER}
          </a>
        </div>
      )}

      {/*
        Switching moved to the top bar.

        It sat at the foot of the sidebar, which is where you put something
        nobody uses. Mike is in and out of four workspaces all day, so it
        belongs in the chrome beside the other things you do to the whole
        screen rather than at the bottom of a list of places.
      */}

      {/*
        The preview toggle moved to the top bar.

        It was a dropdown in the sidebar footer offering four roles. Two
        problems: it was the last thing on a scrolling column, so it was below
        the fold on Home, and four roles is three more than gets used, the
        question anybody actually asks is "what does the person I am about to
        send this to see", and that person owns their business. It is one
        button in the top bar now, beside the rest of the controls.
      */}
    </div>
  );
}

/**
 * What this software is called, in the one place it gets to say so.
 *
 * Same in every workspace. It is not the client's, it is not the studio's, it
 * is the product's, and it does not change when you switch. That is the only
 * thing on this column that is true everywhere, which is why it sits above
 * the line rather than inside the navigation.
 *
 * Both the mark and the words come from PRODUCT_MARK in lib/brand.ts, so
 * naming the product is one edit in one file. Until there is a name it draws
 * a dashed outline and the words `[Product name]`: a blank that reads as a
 * blank. A real mark goes in the same place at the same size the moment the
 * logo exists.
 *
 * An empty name removes the row, which is the escape hatch if the answer
 * turns out to be that the product should not sign its own name at all.
 */
function ProductName() {
  const label = PRODUCT_MARK.name.trim();
  if (!label) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '12px 18px 0',
        flexShrink: 0,
      }}
    >
      {PRODUCT_MARK.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={PRODUCT_MARK.logo}
          alt=""
          aria-hidden
          style={{ width: 16, height: 16, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }}
        />
      ) : (
        <span
          aria-hidden
          style={{
            width: 16,
            height: 16,
            borderRadius: 4,
            border: `1px dashed ${C.quiet}`,
            flexShrink: 0,
          }}
        />
      )}
      <span
        style={{
          fontFamily: 'var(--font-display), var(--font-sans), system-ui, sans-serif',
          fontSize: 13,
          fontWeight: 600,
          color: C.quiet,
          letterSpacing: '-0.1px',
          /* The sidebar is 212px wide and a real product name could be long.
             It gets cut rather than wrapping the row onto a second line and
             pushing the plate down. */
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
    </div>
  );
}

/**
 * The person whose screen this is, at the foot of it.
 *
 * View mode only. See the note at the call site for why it exists and why it
 * declines to draw itself rather than guess at a name.
 */
function ClientIdentity() {
  const { org } = useOrg();
  const { viewAs } = useViewAs();
  const [owner, setOwner] = useState<ClientOwner | null>(null);

  useEffect(() => {
    let off = false;
    setOwner(null);
    if (!viewAs || !org?.id) return;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const found = await clientOwner(org.id, data.session?.user?.id ?? null);
      if (!off) setOwner(found);
    })();
    return () => { off = true; };
  }, [viewAs, org?.id]);

  if (!viewAs || !owner) return null;

  const initials = owner.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px 8px', margin: '0 0 0',
        borderTop: `1px solid ${C.border}`,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 28, height: 28, borderRadius: 999, flexShrink: 0,
          background: C.panelAlt, color: C.dim,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700,
        }}
      >
        {initials}
      </span>
      <span style={{ minWidth: 0 }}>
        <span
          style={{
            display: 'block', fontSize: 13.5, fontWeight: 600, color: C.text,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
        >
          {owner.name}
        </span>
        <span style={{ display: 'block', fontSize: 11.5, color: C.faint }}>{owner.role}</span>
      </span>
    </div>
  );
}

/**
 * Who you are working as, at the top of the sidebar.
 *
 * Colour, mark, name, and what kind of business it is. The colour is the same
 * one the strip across the top uses, from the same resolver, so the two
 * cannot drift apart.
 *
 * Pressing it opens the switcher that used to live in the top bar. The plate
 * shows where you are; the switcher is how you leave.
 */
function NamePlate() {
  const { org } = useOrg();
  const color = workspaceColor(org);
  const logo = workspaceLogo(org);
  const [open, setOpen] = useState(false);

  if (!org) {
    return <span style={{ fontSize: 13, color: C.faint }}>Loading…</span>;
  }

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Switch workspace"
        style={{
          display: 'flex', alignItems: 'center', gap: 10, width: '100%',
          background: 'transparent', border: 'none', padding: 0,
          cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
        }}
      >
        {/*
          The mark. A logo when the business has one, its initials when not,
          on the workspace colour either way — so the shape and the position
          never move between workspaces, only the colour and the letters.
        */}
        <span
          style={{
            width: 34, height: 34, borderRadius: 9, flexShrink: 0,
            background: color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logo}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <span
              style={{
                fontFamily: 'var(--font-display), var(--font-sans), system-ui, sans-serif',
                fontSize: 13, fontWeight: 700, letterSpacing: '-0.2px',
                color: readableOn(color),
              }}
            >
              {workspaceInitials(org.name)}
            </span>
          )}
        </span>

        <span style={{ minWidth: 0, flex: 1 }}>
          {/* The name gets the whole line. The DEMO tag sat beside it and
              truncated "Harbor Light Roofing" to "Harbor Ligh…" — the tag
              costing more than it is worth on the one word that identifies
              the business. It sits on the second line now, next to the
              business type, where there is room. */}
          <span
            style={{
              display: 'block',
              fontFamily: 'var(--font-display), var(--font-sans), system-ui, sans-serif',
              fontSize: 14, fontWeight: 600, color: C.text,
              letterSpacing: '-0.1px',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            {org.name}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 1 }}>
            <span
              style={{
                fontSize: 11, color: C.faint,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}
            >
              {workspaceKindLabel(org.kind)}
            </span>
            {org.is_demo && (
              <span
                style={{
                  fontSize: 9, fontWeight: 600, letterSpacing: '.06em',
                  textTransform: 'uppercase', color: C.amber,
                  border: `1px solid ${C.amber}55`, borderRadius: 4,
                  padding: '0 4px', flexShrink: 0, lineHeight: '14px',
                }}
              >
                Demo
              </span>
            )}
          </span>
        </span>
      </button>

      {/* The existing switcher, unchanged, hung off the plate. */}
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 50 }}>
            <OrgSwitcher />
          </div>
        </>
      )}
    </div>
  );
}
