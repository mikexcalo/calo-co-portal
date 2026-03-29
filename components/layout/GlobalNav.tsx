'use client';

import { useRouter, usePathname } from 'next/navigation';

const NAV_LINKS = [
  { label: 'Dashboard', href: '/' },
  { label: 'Clients', href: '/' },
  { label: 'Invoices', href: '/invoices' },
  { label: 'Financials', href: '/financials' },
];

export default function GlobalNav() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <nav
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        height: '56px',
        background: '#1a1f2e',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {/* Left: Wordmark */}
      <div
        onClick={() => router.push('/')}
        style={{
          fontSize: '16px',
          fontWeight: 700,
          color: '#ffffff',
          letterSpacing: '0.04em',
          cursor: 'pointer',
        }}
      >
        CALO&CO
      </div>

      {/* Center: Nav links */}
      <div style={{ display: 'flex', gap: '28px' }}>
        {NAV_LINKS.map((link) => {
          const isActive =
            link.href === '/'
              ? pathname === '/'
              : pathname.startsWith(link.href);

          return (
            <button
              key={link.label}
              onClick={() => router.push(link.href)}
              style={{
                background: 'none',
                border: 'none',
                color: isActive ? '#ffffff' : 'rgba(255,255,255,0.6)',
                fontSize: '13px',
                fontWeight: isActive ? 600 : 400,
                cursor: 'pointer',
                padding: '4px 0',
                borderBottom: isActive ? '2px solid #ffffff' : '2px solid transparent',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {link.label}
            </button>
          );
        })}
      </div>

      {/* Right: Settings + Brand Kit */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          onClick={() => router.push('/brand-kit')}
          style={{
            background: 'none',
            border: 'none',
            color: pathname === '/brand-kit' ? '#ffffff' : 'rgba(255,255,255,0.6)',
            fontSize: '13px',
            fontWeight: pathname === '/brand-kit' ? 600 : 400,
            cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          Brand Kit
        </button>
        <button
          onClick={() => router.push('/settings')}
          title="Settings"
          style={{
            background: 'none',
            border: 'none',
            color: pathname === '/settings' ? '#ffffff' : 'rgba(255,255,255,0.6)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>
    </nav>
  );
}
