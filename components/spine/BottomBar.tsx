'use client';

/**
 * The phone navigation.
 *
 * A drawer behind a hamburger is a desktop sidebar wearing a disguise. It
 * costs a tap before you can even see your options, and it puts those options
 * at the top of the screen, which is the part of a phone a thumb reaches
 * last.
 *
 * Four tabs and a capture button, permanently visible, at the bottom where
 * the thumb already is. Everything else is behind More, which is honest: it
 * is the desk work. The drawer stays for More rather than being replaced,
 * because it already holds the full navigation and duplicating that list here
 * would mean two places to keep in step.
 *
 * THE TABS ARE THE WORKSPACE'S OWN
 *
 * They are not a fixed list. A roofer's second tab is Jobs and a studio's is
 * Clients, and both come from `modulesFor` and the workspace's vocabulary
 * rather than from a switch on `kind` written here - which means a business
 * with billing turned off gets three tabs and a gap where Money would have
 * been, instead of a tab that leads to a screen it is not allowed to open.
 */

import { usePathname, useRouter } from 'next/navigation';
import { MODULE_HREF, modulesFor, type ModuleId } from '@/lib/spine/modules';
import type { Org } from '@/lib/spine/types';
import { C } from './ui';

const ICON = {
  today: (
    <>
      <rect x="2.2" y="3" width="11.6" height="10.6" rx="1.4" />
      <path d="M2.2 6.2h11.6" />
      <path d="M5.4 1.8v2.4M10.6 1.8v2.4" />
    </>
  ),
  jobs: (
    <>
      <rect x="2.2" y="2" width="11.6" height="7.2" rx="1.1" />
      <path d="M8 9.2V14" />
      <path d="M5.6 14h4.8" />
    </>
  ),
  people: (
    <>
      <path d="M2.2 11.4a5.8 5.8 0 0 1 11.6 0" />
      <path d="M6.2 6.1V3.4a.9.9 0 0 1 .9-.9h1.8a.9.9 0 0 1 .9.9v2.7" />
    </>
  ),
  money: (
    <>
      <rect x="1.8" y="4" width="12.4" height="8" rx="1.4" />
      <circle cx="8" cy="8" r="1.9" />
    </>
  ),
  more: (
    <>
      <circle cx="3.4" cy="8" r="1.1" />
      <circle cx="8" cy="8" r="1.1" />
      <circle cx="12.6" cy="8" r="1.1" />
    </>
  ),
};

function Glyph({ d }: { d: React.ReactNode }) {
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {d}
    </svg>
  );
}

interface Tab {
  label: string;
  href: string;
  icon: React.ReactNode;
}

/**
 * Which three destinations sit either side of the capture button.
 *
 * Today is always there; it is this screen. The middle one is whatever this
 * business spends its day inside - jobs for somebody who goes to sites,
 * clients for a studio - and falls back to the other if the first is off.
 * Money is billing. Any of them that the workspace does not have simply does
 * not appear; the brief's four is the maximum, not a quota to fill.
 */
export function phoneTabs(
  org: Org | null,
  vocab: { jobPlural: string; customerPlural: string }
): Tab[] {
  const on = modulesFor(org);
  const has = (id: ModuleId) => on.has(id);

  const tabs: Tab[] = [{ label: 'Today', href: '/', icon: ICON.today }];

  const work =
    org?.kind === 'agency'
      ? ([
          ['customers', vocab.customerPlural, ICON.people],
          ['jobs', vocab.jobPlural, ICON.jobs],
        ] as const)
      : ([
          ['jobs', vocab.jobPlural, ICON.jobs],
          ['customers', vocab.customerPlural, ICON.people],
        ] as const);

  const pick = work.find(([id]) => has(id as ModuleId));
  if (pick) tabs.push({ label: pick[1], href: MODULE_HREF[pick[0] as ModuleId], icon: pick[2] });

  if (has('billing')) tabs.push({ label: 'Money', href: MODULE_HREF.billing, icon: ICON.money });

  return tabs;
}

export function BottomBar({
  org,
  vocab,
  onMore,
  onAdd,
  readOnly = false,
}: {
  org: Org | null;
  vocab: { jobPlural: string; customerPlural: string };
  onMore: () => void;
  onAdd: () => void;
  /**
   * Looking, not working.
   *
   * The raised button in the middle of the bar is the loudest thing on a
   * phone and the fastest way to write something into a business you are only
   * supposed to be reading. It says why it is gone rather than sitting there
   * doing nothing.
   */
  readOnly?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const tabs = phoneTabs(org, vocab);

  const active = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/');

  const cell: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    background: 'transparent',
    border: 'none',
    // 56px, so the tap target clears the 48px minimum with room to spare.
    // This gets used with gloves on.
    minHeight: 56,
    padding: '6px 2px',
    fontSize: 11.5,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
  };

  const tab = (t: Tab) => {
    const on = active(t.href);
    return (
      <button
        key={t.href}
        onClick={() => router.push(t.href)}
        aria-current={on ? 'page' : undefined}
        style={{ ...cell, color: on ? C.text : C.faint, fontWeight: on ? 700 : 500 }}
      >
        <Glyph d={t.icon} />
        {t.label}
      </button>
    );
  };

  /* Split around the capture button so it sits in the middle of the bar
     rather than in the middle of the list, whatever the list turned out to
     be. With three tabs it lands between the second and the third. */
  const half = Math.ceil(tabs.length / 2);

  return (
    <nav
      style={{
        position: 'sticky',
        bottom: 0,
        zIndex: 30,
        display: 'flex',
        alignItems: 'stretch',
        background: C.panel,
        borderTop: `1px solid ${C.border}`,
        // Clears the home indicator on a modern iPhone. Without it the last
        // few pixels of the bar are unreachable.
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {tabs.slice(0, half).map(tab)}

      {/*
        Putting something in is the single most common thing anybody does on a
        phone here, so it is not a tab among tabs. It sits raised in the
        middle of the bar, a thumb's width across, and it is the only filled
        shape on the screen.
      */}
      <div style={{ width: 84, position: 'relative', flexShrink: 0 }}>
        {readOnly ? (
          <div
            style={{
              position: 'absolute', left: '50%', top: -4, transform: 'translateX(-50%)',
              fontSize: 11, color: C.faint, fontWeight: 600, whiteSpace: 'nowrap',
              letterSpacing: '.02em',
            }}
          >
            Read-only
          </div>
        ) : (
        <button
          onClick={onAdd}
          aria-label="Capture"
          style={{
            position: 'absolute',
            left: '50%',
            top: -20,
            transform: 'translateX(-50%)',
            width: 60,
            height: 60,
            borderRadius: 30,
            background: C.text,
            color: C.panel,
            border: `4px solid ${C.panel}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 30,
            lineHeight: 1,
            fontWeight: 300,
            cursor: 'pointer',
            fontFamily: 'inherit',
            boxShadow: '0 4px 16px rgba(0,0,0,.18)',
          }}
        >
          +
        </button>
        )}
      </div>

      {tabs.slice(half).map(tab)}

      <button onClick={onMore} style={{ ...cell, color: C.faint }}>
        <Glyph d={ICON.more} />
        More
      </button>
    </nav>
  );
}
