'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useTutorial } from '@/lib/spine/tutorial';
import { C } from '@/components/spine/ui';
import { Notifications } from '@/components/spine/Notifications';

const TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/jobs': 'Jobs',
  '/customers': 'Customers',
  '/documents': 'Receipts',
  '/billing': 'Billing',
  '/pl': 'Profit & Loss',
  '/records': 'Records',
  '/proposals': 'Proposals',
  '/pricing': 'Price List',
  '/requests': 'Site requests',
  '/brand-kit': 'Brand Kit',
  '/business': 'Business',
  '/settings': 'Settings',
};

export default function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { openPanel } = useTutorial();

  const title =
    TITLES[pathname] ??
    pathname
      .split('/')
      .filter(Boolean)[0]
      ?.replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase()) ??
    '';

  return (
    <div
      style={{
        height: 56,
        flexShrink: 0,
        background: C.bg,
        borderBottom: `1px solid ${C.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        fontFamily: 'inherit',
      }}
    >
      <span style={{ fontSize: 13, color: C.faint }}>{title}</span>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Notifications />
        {/* Was a dark/light toggle. A theme switch doubled every color
            decision and taught nobody anything; guided paths do. */}
        <button
          onClick={openPanel}
          title="Learn Nautilus"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            height: 32,
            padding: '0 12px',
            borderRadius: 7,
            border: `1px solid ${C.border}`,
            background: 'transparent',
            cursor: 'pointer',
            color: C.dim,
            fontSize: 12.5,
            fontWeight: 500,
            fontFamily: 'inherit',
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2 3.5h4.5A1.5 1.5 0 0 1 8 5v8a1.2 1.2 0 0 0-1.2-1.2H2z" />
            <path d="M14 3.5H9.5A1.5 1.5 0 0 0 8 5v8a1.2 1.2 0 0 1 1.2-1.2H14z" />
          </svg>
          Learn
        </button>

        <button
          onClick={() => router.push('/settings')}
          title="Settings"
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: C.blue,
            border: 'none',
            color: '#fff',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          MC
        </button>
      </div>
    </div>
  );
}
