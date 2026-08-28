'use client';

/**
 * Tabs within a section.
 *
 * The sidebar had grown to thirteen destinations across five headings, and we
 * aren't finished. A sidebar that long stops being navigation and becomes a
 * list you re-read every time.
 *
 * So related screens collapse behind one sidebar entry and separate into tabs
 * here. Six things to choose from is navigation; thirteen is a menu.
 */

import { usePathname, useRouter } from 'next/navigation';
import { C, radius, useIsPhone } from './ui';

export interface Tab {
  label: string;
  href: string;
}

export function SectionTabs({ tabs }: { tabs: Tab[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const phone = useIsPhone();

  if (tabs.length < 2) return null;

  return (
    <div
      style={{
        display: 'flex',
        gap: 2,
        marginBottom: 22,
        borderBottom: `1px solid ${C.border}`,
        // Many tabs on a narrow screen scroll rather than wrap into a block.
        overflowX: phone ? 'auto' : 'visible',
      }}
    >
      {tabs.map((t) => {
        const active = pathname === t.href || pathname.startsWith(t.href + '/');
        return (
          <button
            key={t.href}
            onClick={() => router.push(t.href)}
            style={{
              padding: '9px 14px',
              border: 'none',
              borderBottom: `2px solid ${active ? C.accent : 'transparent'}`,
              background: 'transparent',
              color: active ? C.text : C.dim,
              fontSize: 13.5,
              fontWeight: active ? 500 : 400,
              cursor: 'pointer',
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
              marginBottom: -1,
              borderRadius: `${radius.sm}px ${radius.sm}px 0 0`,
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Which tabs belong to which section. Kept here so the sidebar and the tab
 * bars cannot drift apart.
 */
export const SECTIONS = {
  money: [
    { label: 'Proposals', href: '/proposals' },
    { label: 'Billing', href: '/billing' },
    { label: 'Profit & Loss', href: '/pl' },
  ],
  library: [
    { label: 'Price List', href: '/pricing' },
    { label: 'Records', href: '/records' },
    { label: 'Brand Kit', href: '/brand-kit' },
  ],
  setup: [
    { label: 'Business', href: '/business' },
    { label: 'Team', href: '/team' },
  ],
} as const;
