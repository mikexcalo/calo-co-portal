'use client';

import { useState } from 'react';
import { useOrg } from '@/lib/spine/org';
import { useViewAs } from '@/lib/spine/viewas';
import { Avatar, C } from './ui';

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
function brandOf(o: { settings?: Record<string, unknown> | null }) {
  const b = ((o.settings ?? {}) as Record<string, unknown>).brand as
    | { logoLight?: string; logos?: string[]; colors?: Array<{ hex?: string }> }
    | undefined;
  const logo = (b?.logoLight || b?.logos?.[0] || '').trim() || null;
  const hex = (b?.colors ?? []).map((c) => (c?.hex ?? '').trim()).filter(Boolean)[0] ?? null;
  return { logo, hex };
}

export function OrgSwitcher() {
  const { org, orgs, loading, switchOrg } = useOrg();
  const { viewAs } = useViewAs();
  const [open, setOpen] = useState(false);

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

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => !single && setOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          padding: '9px 12px',
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
        <Avatar name={org.name} src={brandOf(org).logo} tint={brandOf(org).hex} size={20} shape="company" />
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
              position: 'absolute',
              bottom: 'calc(100% + 6px)',
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
              boxShadow: '0 -8px 30px rgba(0,0,0,.13)',
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
              #141414 for an agency — colour used as decoration, which this
              palette forbids in as many words: green means settled, amber
              means needs you, red means wrong, and none of them mean
              construction. The word beside it already said which kind it was.

              In its place, the monogram. Avatar draws a logo when there is one
              and the initials when there is not, so this does not go sloppy
              while some businesses have a mark and others do not — every row
              is the same shape either way, and real logos appear as they land
              without the layout moving.
            */}
            {orgs.map((o) => (
              <button
                key={o.id}
                onClick={() => {
                  setOpen(false);
                  if (o.id !== org.id) switchOrg(o.id);
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
                <Avatar name={o.name} src={brandOf(o).logo} tint={brandOf(o).hex} size={22} shape="company" />
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
                  {o.is_demo ? 'Demo' : o.kind === 'agency' ? 'Agency' : 'Contractor'}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
