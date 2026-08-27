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

const icons: Record<string, React.ReactNode> = {
  dashboard: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/></svg>,
  yardSign: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="3" y="1.5" width="10" height="8" rx="1"/><line x1="6" y1="9.5" x2="6" y2="14.5" strokeLinecap="round"/><line x1="10" y1="9.5" x2="10" y2="14.5" strokeLinecap="round"/></svg>,
  clients: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="6" cy="5" r="2.5"/><path d="M1.5 14c0-2.5 2-4.5 4.5-4.5s4.5 2 4.5 4.5"/><circle cx="11" cy="4.5" r="2"/><path d="M14.5 13c0-2 1.5-3.5-1.5-3.5"/></svg>,
  quotes: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3 1.5h7L13 4.5v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2.5a1 1 0 0 1 1-1z"/><path d="M10 1.5v3h3"/><line x1="5" y1="8" x2="10" y2="8"/><line x1="5" y1="11" x2="9" y2="11"/></svg>,
  invoices: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="6.5"/><path d="M10 5.5c-.5-.6-1.3-1-2.1-1-1.3 0-2.4.8-2.4 1.8S6.6 8 7.9 8s2.4.8 2.4 1.8-1.1 1.8-2.4 1.8c-.9 0-1.7-.4-2.1-1"/><line x1="8" y1="3" x2="8" y2="4.5"/><line x1="8" y1="11.6" x2="8" y2="13"/></svg>,
  financials: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><line x1="2" y1="14" x2="14" y2="14"/><line x1="4" y1="14" x2="4" y2="10" strokeWidth="1.8"/><line x1="8" y1="14" x2="8" y2="7" strokeWidth="1.8"/><line x1="12" y1="14" x2="12" y2="4" strokeWidth="1.8"/></svg>,
  designStudio: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><rect x="1.5" y="3" width="13" height="9" rx="1"/><line x1="1.5" y1="6" x2="14.5" y2="6"/><circle cx="3.6" cy="4.5" r="0.5" fill="currentColor"/></svg>,
  brandKit: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="12" height="12" rx="1.5"/><rect x="4" y="4.5" width="4.5" height="3" rx="0.5" fill="currentColor" stroke="none"/><line x1="4" y1="9.5" x2="12" y2="9.5"/><line x1="4" y1="11.5" x2="10" y2="11.5"/></svg>,
  settings: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
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
