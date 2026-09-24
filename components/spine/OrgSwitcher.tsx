'use client';

import { useEffect, useRef, useState } from 'react';
import { useOrg } from '@/lib/spine/org';
import { useViewAs } from '@/lib/spine/viewas';
import { Avatar, C, useModKey } from './ui';
import supabase from '@/lib/supabase';
import { brandAssetUrl } from '@/lib/spine/db';

/**
 * Which business am I looking at right now.
 *
 * Deliberately prominent and always visible — the single most dangerous
 * mistake in a multi-business tool is logging Mammoth's hours against a
 * CALO&CO engagement because you didn't notice which one was active.
 */

/*
  The logo, where there is one.

  The tiles were drawing monograms for every business while Mammoth's mark sat
  in its own brand kit — the whole point of putting an avatar here was that it
  fills in with the real thing as each kit gets built, and nothing was reading
  the kit.

  The ground comes from the brand too: a business whose darkest colour is
  near-black gets a near-black tile, which is what CALO&CO's Ink is. A monogram
  on the brand's own colour looks deliberate where one on default grey looks
  like a placeholder nobody replaced.
*/
/*
  The logo a client is already shown by, not a second one.

  This read the org's own brand kit. The Clients list reads the logo uploaded
  against the customer record. Both exist for Mammoth, and they are different
  pictures: the brand kit holds a wordmark, which at twenty pixels in a
  switcher is a grey smear, while the customer record holds the mark, which is
  the one you recognise. So the same company looked like two companies
  depending on which screen you were on.

  The customer record wins, because that is the one somebody chose while
  looking at a list of clients at this size.
*/
function brandOf(o: { settings?: Record<string, unknown> | null }) {
  const b = ((o.settings ?? {}) as Record<string, unknown>).brand as
    | { logoLight?: string; logos?: string[]; colors?: Array<{ hex?: string }> }
    | undefined;
  const logo = (b?.logoLight || b?.logos?.[0] || '').trim() || null;
  const hex = (b?.colors ?? []).map((c) => (c?.hex ?? '').trim()).filter(Boolean)[0] ?? null;
  return { logo, hex };
}

const KIND_LABEL: Record<string, string> = {
  agency: 'Agency',
  contractor: 'Contractor',
  rep: 'Rep',
};

export function OrgSwitcher() {
  const { org, orgs, loading, switchOrg } = useOrg();

  /* One query, once: the logo each linked client was given in Clients. */
  const [clientLogos, setClientLogos] = useState<Record<string, string>>({});
  useEffect(() => {
    let off = false;
    (async () => {
      const res = await supabase
        .from('customer_summary')
        .select('linked_org_id, logo_path')
        .not('linked_org_id', 'is', null);
      if (off || res.error) return;
      const out: Record<string, string> = {};
      for (const r of (res.data ?? []) as Array<{ linked_org_id: string; logo_path: string | null }>) {
        if (r.logo_path) out[r.linked_org_id] = brandAssetUrl(r.logo_path) ?? '';
      }
      setClientLogos(out);
    })();
    return () => { off = true; };
  }, []);
  const { viewAs } = useViewAs();
  const [open, setOpen] = useState(false);

  /*
    Click, read five, click. Four times an hour.

    Switching workspace is the most repeated action in the product and it cost
    two clicks and a read every time, because the menu had to be opened before
    it would tell you anything. Three changes, none of them clever:

    Hover opens it, so looking is free and the click is only for choosing.

    The one you were last in sits directly under your own, because switching
    is almost always a bounce between two — the agency and whichever client
    you are working on this afternoon — and that pair was buried in
    alphabetical order.

    Ctrl or Cmd and a number jumps straight there. The handlers for J, K and L
    already existed; this is the same shape.
  */
  const mod = useModKey();
  const [previous, setPrevious] = useState<string | null>(null);
  const hoverOff = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* The keydown handler is registered once. Refs keep it reading the current
     list instead of the one that existed when it was bound. */
  const orgsRef = useRef<typeof orgs>(orgs);
  const orgRef = useRef<string | null>(org?.id ?? null);
  useEffect(() => {
    orgsRef.current = [
      ...orgs.filter((o) => o.id === org?.id),
      ...orgs.filter((o) => o.id === previous && o.id !== org?.id),
      ...orgs.filter((o) => o.id !== org?.id && o.id !== previous),
    ];
    orgRef.current = org?.id ?? null;
  }, [orgs, org?.id, previous]);

  const openNow = () => {
    if (hoverOff.current) clearTimeout(hoverOff.current);
    if (!single) setOpen(true);
  };
  /* A short grace period. A menu that vanishes the instant the pointer
     crosses a 2px gap is a menu you fight. */
  const closeSoon = () => {
    if (hoverOff.current) clearTimeout(hoverOff.current);
    hoverOff.current = setTimeout(() => setOpen(false), 220);
  };

  /*
    Ctrl/Cmd + 1..9 jumps straight to a workspace, in the order they are
    listed. Both modifiers, because the handlers for J, K and L already accept
    either and a shortcut that only works on a Mac is a shortcut that lies.
  */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) return;
      const n = Number(e.key);
      if (!n || n < 1 || n > 9) return;
      const target = orgsRef.current[n - 1];
      if (!target || target.id === orgRef.current) return;
      e.preventDefault();
      setPrevious(orgRef.current);
      switchOrg(target.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [switchOrg]);

  if (loading || !org) return null;

  /*
    In a preview, this is the one control that was still telling the truth
    about you.

    The bar at the top says "what they would be shown", and then the switcher
    underneath it listed all five businesses Mike belongs to — so a preview of
    what Mark sees opened with a menu of every client Mike has. Nothing leaked:
    the list is Mike's own memberships, rendered in Mike's own session, and
    every read still runs under his row-level rules. But it is the single most
    alarming thing the preview could draw, and it is wrong: Mark belongs to one
    business and would see no menu at all.

    Somebody being previewed has exactly the org you are standing in. So while
    a preview is on, this collapses to that one name and stops being a menu.
  */
  const single = orgs.length <= 1 || viewAs !== null;

  /* Where you are, then where you just were, then everybody else. */
  const ordered = [
    ...orgs.filter((o) => o.id === org.id),
    ...orgs.filter((o) => o.id === previous && o.id !== org.id),
    ...orgs.filter((o) => o.id !== org.id && o.id !== previous),
  ];

  return (
    <div
      style={{ position: 'relative' }}
      onMouseEnter={openNow}
      onMouseLeave={closeSoon}
    >
      <button
        onClick={() => !single && setOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          padding: '6px 11px',
          borderRadius: 999,
          border: `1px solid ${C.border}`,
          background: C.panelAlt,
          color: C.text,
          // The workspace name sits at the top of the sidebar and names the
          // business you are inside, so it takes the heading face too.
          fontFamily: 'var(--font-display), var(--font-sans), system-ui, sans-serif',
          fontSize: 14,
          fontWeight: 500,
          cursor: single ? 'default' : 'pointer',
          textAlign: 'left',
        }}
      >
        <Avatar name={org.name} src={clientLogos[org.id] || brandOf(org).logo} tint={brandOf(org).hex} size={20} shape="company" />
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {org.name}
        </span>
        {org.is_demo && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '.04em',
              textTransform: 'uppercase',
              color: C.amber,
              border: `1px solid ${C.amber}55`,
              borderRadius: 4,
              padding: '1px 5px',
              flexShrink: 0,
            }}
          >
            Demo
          </span>
        )}
        {!single && <span style={{ color: C.faint, fontSize: 11 }}>▾</span>}
      </button>

      {open && !single && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 40 }}
          />
          <div
            style={{
              /*
                It opens upward, because it lives at the bottom.

                The switcher moved to the foot of the sidebar and kept opening
                downward, so the list unrolled off the bottom of the window and
                the businesses underneath the first one were unreachable
                without scrolling a menu that does not scroll.
              */
              /* Back in the chrome at the top, so it opens downward again. */
              position: 'absolute',
              top: 'calc(100% + 6px)',
              left: 0,
              maxHeight: 'min(60vh, 420px)',
              overflowY: 'auto',
              minWidth: '100%',
              width: 'max-content',
              maxWidth: 340,
              background: C.panel,
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              padding: 5,
              zIndex: 41,
              boxShadow: '0 10px 30px rgba(0,0,0,.13)',
            }}
          >
            {/*
              A list you can run your eye down.

              It was as wide as the sidebar, so "Global Seafood Partners" broke
              across three lines, the kind label floated somewhere beside the
              middle one, and four businesses already needed sorting out by
              reading. At twenty it would be unusable.

              Three things fixed it. The panel sets its own width instead of
              inheriting the sidebar's, so names get one line each and the tail
              of a long one is clipped rather than wrapped. Every row is the
              same height, so the kind labels line up in a column you can scan
              instead of scattering. And the name starts at the same x on every
              row, which is what actually makes a list sortable by eye.

              The coloured dot is gone. It was green for a contractor and
              #141414 for an agency, colour used as decoration, which this
              palette forbids in as many words: green means settled, amber
              means needs you, red means wrong, and none of them mean
              construction. The word beside it already said which kind it was.

              In its place, the monogram. Avatar draws a logo when there is one
              and the initials when there is not, so this does not go sloppy
              while some businesses have a mark and others do not, every row
              is the same shape either way, and real logos appear as they land
              without the layout moving.
            */}
            {ordered.map((o, n) => (
              <button
                key={o.id}
                onClick={() => {
                  setOpen(false);
                  if (o.id !== org.id) { setPrevious(org.id); switchOrg(o.id); }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  height: 40,
                  padding: '0 10px',
                  borderRadius: 8,
                  border: 'none',
                  background: o.id === org.id ? C.panelAlt : 'transparent',
                  color: o.id === org.id ? C.text : C.dim,
                  fontSize: 14,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <Avatar name={o.name} src={clientLogos[o.id] || brandOf(o).logo} tint={brandOf(o).hex} size={22} shape="company" />
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontWeight: o.id === org.id ? 500 : 400,
                  }}
                >
                  {o.name}
                </span>
                {/*
                  One badge, not two. A business called "Demo" was drawing the
                  word DEMO beside its own name.
                */}
                <span style={{ fontSize: 11, color: o.is_demo ? C.amber : C.faint, flexShrink: 0 }}>
                  {/* Contractor was the fallback for anything not an agency,
                      so a seafood sales rep read as one beside a lawn care
                      business. The kind chooses the whole template; the label
                      should say which template. */}
                  {o.is_demo ? 'Demo' : KIND_LABEL[o.kind] ?? 'Contractor'}
                </span>
                {/* The shortcut, where you find it by accident. A key hint
                    nobody can see is a key hint nobody uses. */}
                {n < 9 && (
                  <span
                    style={{
                      fontSize: 10.5, color: C.faint, flexShrink: 0,
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                      border: `1px solid ${C.border}`, borderRadius: 4, padding: '1px 4px',
                    }}
                  >
                    {mod}{n + 1}
                  </span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
