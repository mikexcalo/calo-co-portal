'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import { useTutorial } from '@/lib/spine/tutorial';
import { useOrg } from '@/lib/spine/org';
import { C } from '@/components/spine/ui';
import { Notifications } from '@/components/spine/Notifications';
import { PRODUCT } from '@/lib/brand';

const TITLES: Record<string, string> = {
  '/': 'Today',
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
};

export default function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { openPanel } = useTutorial();
  const { org } = useOrg();

  /**
   * The business's own website, one click away from anywhere.
   *
   * The point is not convenience for its own sake. If this is where the work
   * lives, then checking that a change actually went live has to happen from
   * here — otherwise the loop runs through a bookmark, a browser window and a
   * guess about which tab was the current one.
   */
  const [siteUrl, setSiteUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!org) { setSiteUrl(null); return; }
    let cancelled = false;
    supabase
      .from('client_sites')
      .select('url')
      .eq('org_id', org.id)
      .not('url', 'is', null)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setSiteUrl(data?.url ?? null);
      });
    return () => { cancelled = true; };
  }, [org]);

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
        {siteUrl && (
          <a
            href={siteUrl}
            target="_blank"
            rel="noopener noreferrer"
            title={`Open ${siteUrl.replace(/^https?:\/\/(www\.)?/, '')} in a new tab`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              background: 'transparent',
              border: `1px solid ${C.border}`,
              borderRadius: 7,
              padding: '6px 11px',
              fontSize: 12.5,
              fontWeight: 500,
              color: C.dim,
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="8" cy="8" r="6.3" />
              <path d="M1.7 8h12.6" />
              <path d="M8 1.7a10 10 0 0 1 0 12.6 10 10 0 0 1 0-12.6" />
            </svg>
            Your site
          </a>
        )}
        <Notifications />
        {/* Was a dark/light toggle. A theme switch doubled every color
            decision and taught nobody anything; guided paths do. */}
        <button
          onClick={openPanel}
          title={`Learn ${PRODUCT}`}
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

        <AccountMenu />
      </div>
    </div>
  );
}


/**
 * Who you are, and the things you set up once.
 *
 * Business, Team and Security used to be three permanent sidebar rows. You
 * configure them twice in the first week and then never again, so three rows
 * of a seven-row navigation was a poor trade — especially on a phone, where
 * every row costs a thumb-reach.
 *
 * Under the avatar is where every other product puts them, which means people
 * already know to look here.
 */
function AccountMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data?.user?.email ?? null));
  }, []);

  const initials = (email ?? '?')
    .split('@')[0]
    .split(/[.\-_]/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('') || '?';

  const item: React.CSSProperties = {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '9px 12px',
    background: 'transparent',
    border: 'none',
    fontSize: 13,
    color: C.text,
    cursor: 'pointer',
    fontFamily: 'inherit',
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        title={email ?? 'Account'}
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: C.accent,
          border: 'none',
          color: '#fff',
          fontSize: 11,
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        {initials}
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 50 }} />
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              right: 0,
              minWidth: 210,
              background: C.panel,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              zIndex: 51,
              padding: 4,
              boxShadow: '0 10px 26px rgba(0,0,0,.12)',
            }}
          >
            <div style={{ padding: '9px 12px', borderBottom: `1px solid ${C.border}`, marginBottom: 4 }}>
              <div style={{ fontSize: 10.5, color: C.faint, textTransform: 'uppercase', letterSpacing: '.07em', fontWeight: 600 }}>
                Signed in as
              </div>
              <div style={{ fontSize: 12.5, color: C.text, marginTop: 3, wordBreak: 'break-all' }}>
                {email ?? '—'}
              </div>
            </div>
            <button
              style={item}
              onClick={() => { setOpen(false); router.push('/business'); }}
            >
              Business
            </button>
            <button
              style={item}
              onClick={() => { setOpen(false); router.push('/team'); }}
            >
              Team
            </button>
            <button
              style={item}
              onClick={() => { setOpen(false); router.push('/security'); }}
            >
              Security
            </button>
            <div style={{ height: 1, background: C.border, margin: '4px 0' }} />
            <button
              style={{ ...item, color: C.red }}
              onClick={async () => {
                await supabase.auth.signOut();
                router.push('/login');
              }}
            >
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
