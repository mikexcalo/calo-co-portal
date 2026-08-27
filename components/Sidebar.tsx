'use client';

/**
 * Sidebar.
 *
 * Grouped and labelled, because a flat list of nine items has no shape and
 * you end up reading all of it every time. Which items appear depends on the
 * business you're in — a contractor has no use for a client-request inbox.
 */

import { useRouter, usePathname } from 'next/navigation';
import { useOrg } from '@/lib/spine/org';
import { navFor } from '@/lib/spine/modules';
import { OrgSwitcher } from '@/components/spine/OrgSwitcher';
import { C, radius } from '@/components/spine/ui';

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
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 6.6 8 2l6 4.6" /><path d="M3.4 7.6V13a.8.8 0 0 0 .8.8h7.6a.8.8 0 0 0 .8-.8V7.6" />
      <path d="M6.4 13.8V9.6h3.2v4.2" />
    </svg>
  ),
  // A yard sign — what a contractor plants on a job.
  yardSign: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.2" y="2" width="11.6" height="7.2" rx="1.1" />
      <path d="M5.2 5.1h5.6M5.2 7h3.4" />
      <path d="M8 9.2V14" /><path d="M5.6 14h4.8" />
    </svg>
  ),
  // A hard hat — the people a contractor deals with.
  clients: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.2 11.4a5.8 5.8 0 0 1 11.6 0" />
      <path d="M6.2 6.1V3.4a.9.9 0 0 1 .9-.9h1.8a.9.9 0 0 1 .9.9v2.7" />
      <path d="M1.4 11.4h13.2" />
    </svg>
  ),
  // A receipt, torn edge and all.
  quotes: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.4 1.8h9.2v11.4l-1.8-1.1-1.8 1.1-1.8-1.1-1.8 1.1-1.8-1.1z" />
      <path d="M5.8 5h4.4M5.8 7.8h3" />
    </svg>
  ),
  // A price tag.
  financials: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.3 1.9H14v5.7L7.4 14.2a1 1 0 0 1-1.4 0L1.8 10a1 1 0 0 1 0-1.4z" />
      <circle cx="11.1" cy="4.8" r="1.05" />
    </svg>
  ),
  // A folder — records you keep.
  folder: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.8 12.6V3.6a.9.9 0 0 1 .9-.9h3.1l1.5 1.8h6a.9.9 0 0 1 .9.9v7.2a.9.9 0 0 1-.9.9H2.7a.9.9 0 0 1-.9-.9z" />
    </svg>
  ),
  // Banknote.
  invoices: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.4" y="3.6" width="13.2" height="8.8" rx="1.2" />
      <circle cx="8" cy="8" r="1.9" /><path d="M4.1 8h.02M11.9 8h.02" />
    </svg>
  ),
  // Bar chart with a rising line.
  chart: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 13.6h12.2" />
      <path d="M4.2 13.6V9.4M7.4 13.6V6.2M10.6 13.6V8M13.8 13.6V3.4" />
    </svg>
  ),
  // Browser window — website work.
  designStudio: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="2.6" width="13" height="10.8" rx="1.2" />
      <path d="M1.5 5.9h13" /><path d="M3.6 4.25h.02M5.5 4.25h.02" />
    </svg>
  ),
  // Paint swatches.
  brandKit: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.7" y="1.7" width="5.6" height="5.6" rx="1" />
      <rect x="8.7" y="1.7" width="5.6" height="5.6" rx="1" />
      <rect x="1.7" y="8.7" width="5.6" height="5.6" rx="1" />
      <circle cx="11.5" cy="11.5" r="2.8" />
    </svg>
  ),
  // Wrench — setup.
  settings: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.4 5.6a2.9 2.9 0 0 1-3.7 3.7l-4 4a1.3 1.3 0 0 1-1.9-1.9l4-4a2.9 2.9 0 0 1 3.7-3.7L7 5.2l.6 2.2 2.2.6z" />
    </svg>
  ),
};

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { org, vocab } = useOrg();

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/');

  const navBtn = (label: string, href: string, icon: React.ReactNode) => {
    const active = isActive(href);
    return (
      <button
        key={href}
        onClick={() => router.push(href)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          padding: '7px 12px',
          margin: '1px 0',
          borderRadius: radius.md,
          border: 'none',
          fontSize: 13.5,
          color: active ? C.text : C.dim,
          fontWeight: active ? 500 : 400,
          background: active ? C.accentSoft : 'transparent',
          cursor: 'pointer',
          fontFamily: 'inherit',
          textAlign: 'left',
        }}
      >
        <span
          style={{
            width: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            color: active ? C.accent : C.faint,
          }}
        >
          {icon}
        </span>
        {label}
      </button>
    );
  };

  const groups = navFor(org, vocab);

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
          Nautilus
        </span>
      </div>

      <div style={{ padding: '12px 12px 6px' }}>
        <OrgSwitcher />
      </div>

      <div style={{ flex: 1, padding: '8px 8px 8px', overflowY: 'auto' }}>
        {navBtn('Dashboard', '/', icons.dashboard)}

        {groups.map((g) => (
          <div key={g.heading} style={{ marginTop: 16 }}>
            <div
              style={{
                fontSize: 9.5,
                textTransform: 'uppercase',
                letterSpacing: '0.09em',
                color: C.faint,
                fontWeight: 600,
                padding: '0 12px 5px',
              }}
            >
              {g.heading}
            </div>
            {g.items.map((i) => navBtn(i.label, i.href, icons[i.icon]))}
          </div>
        ))}
      </div>

      <div style={{ padding: '8px', borderTop: `1px solid ${C.border}` }}>
        {navBtn('Settings', '/settings', icons.settings)}
      </div>
    </div>
  );
}
