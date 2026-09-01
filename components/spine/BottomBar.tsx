'use client';

/**
 * The phone navigation.
 *
 * A drawer behind a hamburger is a desktop sidebar wearing a disguise. It
 * costs a tap before you can even see your options, and it puts those options
 * at the top of the screen, which is the part of a phone a thumb reaches
 * last.
 *
 * A contractor standing in a driveway does four things: check what needs
 * doing, open a job, look somebody up, and put something in — a receipt, a
 * photo, a note about what was just said. Those four are here, permanently
 * visible, at the bottom where the thumb already is. Everything else is behind
 * More, which is honest: it is the desk work.
 *
 * The drawer stays for More rather than being replaced, because it already
 * holds the full navigation and duplicating that list here would mean two
 * places to keep in step.
 */

import { usePathname, useRouter } from 'next/navigation';
import { C } from './ui';

const ICON = {
  today: (
    <>
      <path d="M2 6.6 8 2l6 4.6" />
      <path d="M3.4 7.6V13a.8.8 0 0 0 .8.8h7.6a.8.8 0 0 0 .8-.8V7.6" />
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

export function BottomBar({
  vocab,
  onMore,
  onAdd,
}: {
  vocab: { jobPlural: string; customerPlural: string };
  onMore: () => void;
  onAdd: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const items = [
    { label: 'Today', href: '/', icon: ICON.today },
    { label: vocab.jobPlural, href: '/jobs', icon: ICON.jobs },
    { label: vocab.customerPlural, href: '/customers', icon: ICON.people },
  ];

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
    // 56px of height so the tap target clears the 44px minimum with room to
    // spare, because this gets used with gloves on.
    minHeight: 56,
    padding: '6px 2px',
    fontSize: 11.5,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
  };

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
      {items.map((i) => {
        const on = active(i.href);
        return (
          <button
            key={i.href}
            onClick={() => router.push(i.href)}
            style={{ ...cell, color: on ? C.accent : C.faint }}
          >
            <Glyph d={i.icon} />
            {i.label}
          </button>
        );
      })}

      {/*
        Add sits in the middle-right rather than being buried, because putting
        something in is the single most common thing anybody does on a phone
        here, and it was previously three taps deep.
      */}
      <button onClick={onAdd} style={{ ...cell, color: C.accent }}>
        <span
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            background: C.accent,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            lineHeight: 1,
            fontWeight: 400,
          }}
          aria-hidden
        >
          +
        </span>
        Add
      </button>

      <button onClick={onMore} style={{ ...cell, color: C.faint }}>
        <Glyph d={ICON.more} />
        More
      </button>
    </nav>
  );
}
