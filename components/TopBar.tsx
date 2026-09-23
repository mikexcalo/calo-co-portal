'use client';

import { useViewAs } from '@/lib/spine/viewas';
import { CommandBar } from '@/components/spine/CommandBar';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import { useTutorial } from '@/lib/spine/tutorial';
import { useOrg } from '@/lib/spine/org';
import { OrgSwitcher } from '@/components/spine/OrgSwitcher';
import { useIsPhone, radius, SectionLabel } from '@/components/spine/ui';
import { C } from '@/components/spine/ui';
import { Notifications } from '@/components/spine/Notifications';
import { DropIt } from '@/components/spine/DropIt';
import LogTime from '@/components/spine/LogTime';
import { PRODUCT } from '@/lib/brand';

/**
 * Page titles, in the business's own words.
 *
 * This was a fixed map, so the sidebar said Clients and the bar above it said
 * Customers on the same screen. Two names for one thing, six inches apart, is
 * the kind of detail that makes software feel unfinished.
 */
const titlesFor = (vocab: { jobPlural: string; customerPlural: string; estimate: string }) => ({
  '/': 'Home',
  '/jobs': vocab.jobPlural,
  '/customers': vocab.customerPlural,
  '/people': 'People',
  '/access': 'Access',
  '/digital': 'Digital',
  '/traffic': 'Digital',
  '/seo': 'Digital',
  '/reviews': 'Digital',
  '/documents': 'Receipts',
  '/billing': 'Invoices',
  '/pl': 'Profit & Loss',
  '/records': 'Records',
  '/notes': 'Notes',
  '/expenses': 'Overheads',
  '/proposals': `${vocab.estimate}s`,
  '/pricing': 'Price List',
  '/requests': 'Requests',
  '/pitches': 'Pitches',
  '/brand-kit': 'Brand Kit',
  '/security': 'Security',
  '/team': 'Team',
  '/business': 'Settings',
} as Record<string, string>);

export default function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { openPanel } = useTutorial();
  const { org, orgs, vocab } = useOrg();
  const orgCount = orgs?.length ?? 0;
  const phone = useIsPhone();
  const { viewAs, setViewAs } = useViewAs();

  /**
   * The business's own website, one click away from anywhere.
   *
   * The point is not convenience for its own sake. If this is where the work
   * lives, then checking that a change actually went live has to happen from
   * here — otherwise the loop runs through a bookmark, a browser window and a
   * guess about which tab was the current one.
   */
  const [siteUrl, setSiteUrl] = useState<string | null>(null);
  const [dropping, setDropping] = useState(false);
  const [logging, setLogging] = useState(false);

  /**
   * Opened by keyboard and from Home, not by a blue button in the chrome.
   *
   * A note gets written a few times a day. A permanent primary-colored button
   * next to the workspace name is the loudest thing on every screen, forever,
   * for something that is not the loudest thing you do.
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setDropping(true);
      }
      /* The same reach as a note, because it is the same kind of act. */
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        setLogging(true);
      }
    };
    const onAsk = () => setDropping(true);
    const onLog = () => setLogging(true);
    const onLearn = () => openPanel();
    window.addEventListener('keydown', onKey);
    window.addEventListener('calo:drop-note', onAsk);
    window.addEventListener('calo:log-time', onLog);
    window.addEventListener('calo:learn', onLearn);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('calo:drop-note', onAsk);
      window.removeEventListener('calo:log-time', onLog);
      window.removeEventListener('calo:learn', onLearn);
    };
  }, []);

  useEffect(() => {
    if (!org) { setSiteUrl(null); return; }
    let canceled = false;
    supabase
      .from('client_sites')
      .select('url')
      .eq('org_id', org.id)
      .not('url', 'is', null)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!canceled) setSiteUrl(data?.url ?? null);
      });
    return () => { canceled = true; };
  }, [org]);

  /**
   * Detail routes fall back to their section's title.
   *
   * /customers/<id> never matched the map, so it dropped through to a
   * capitalised URL segment and produced "Customers" on a screen whose
   * sidebar said "Clients". Two names for one thing, six inches apart.
   */
  const titles = titlesFor(vocab);
  const section = '/' + (pathname.split('/').filter(Boolean)[0] ?? '');

  const title =
    titles[pathname] ??
    titles[section] ??
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
      {/*
        The page name is gone and the search takes its place.
        
        Every screen already has its name in its own heading, at a size you can
        read, so the small grey copy of it up here was telling you something
        you were already looking at. The search is the way into everything and
        now sits where your eye lands first.
      */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: 8 }}>
        {/* On a phone only: the sidebar carries it everywhere else. */}
        {/*
          The workspace, beside the things you do to it.

          At the foot of the sidebar this read as a footer item, under a
          "powered by" line, which is where a product puts what it hopes you
          ignore. Switching business is the most frequent action of the day for
          the person who has more than one, so it sits in the chrome.
        */}
        {orgCount > 1 && (
          <div style={{ minWidth: 170, maxWidth: 240 }}>
            <OrgSwitcher />
          </div>
        )}

        <CommandBar trigger={phone} />

        {/*
          Beside the search, not opposite it.

          Search and this are the two things you reach for without deciding to,
          so they sit together at the left where the eye lands. It was on the
          right in primary blue, which made the loudest element on every screen
          a thing used a few times a day; and before that it was six clicks
          deep on one tab of one client, which meant it did not happen at all.
        */}
        <button
          onClick={() => setDropping(true)}
          title="Add a note — type, talk or paste  (⌘J)"
          style={{
            display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0,
            background: 'transparent', border: `1px solid ${C.border}`,
            borderRadius: radius.pill, padding: '6px 13px', fontSize: 13.5, fontWeight: 500,
            color: C.dim, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
          }}
        >
          {/*
            A sticky note, because that is what this is.

            It was a download arrow, a tray with something dropping into it , 
            which is the universal symbol for "save this file to my computer",
            the exact opposite of what pressing it does. Next to the words
            "Drop a note" it read as downloading your notes.

            A square with the corner turned up is a sticky note and nothing
            else, at any size.
          */}
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M2.4 3.4a1 1 0 0 1 1-1h9.2a1 1 0 0 1 1 1v5.9L9.3 13.6H3.4a1 1 0 0 1-1-1z" />
            <path d="M13.6 9.3H10.3a1 1 0 0 0-1 1v3.3" />
            <path d="M5.1 6h5.8M5.1 8.4h3.1" />
          </svg>
          {/*
            "Drops" and "Drop a note" are two different things sharing a word.

            Drops is the shelf of files you have not filed. This writes a note
            against a client. Same verb, unrelated destinations, one of them in
            the sidebar and one in the chrome directly above it — so the first
            genuine question anybody asks is which is which.

            Files go in Drops. Words are a note.
          */}
          Add a note
        </button>

        {/*
          Logging an hour is not a trip to a client record.

          It was four screens deep: the client, then the job inside it, then
          the hours panel, then a rate you had to remember. That is the thing
          an agency does more often than anything else, so putting it that far
          away means it happens on the 30th from memory, and hours
          reconstructed from memory are always fewer than hours that happened.

          Beside Drop a note, because they are the same kind of act: something
          you record in ten seconds without leaving what you were doing.
        */}
        <button
          onClick={() => setLogging(true)}
          title="Log time against a client  (⌘L)"
          style={{
            display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0,
            background: 'transparent', border: `1px solid ${C.border}`,
            borderRadius: radius.pill, padding: '6px 13px', fontSize: 13.5, fontWeight: 500,
            color: C.dim, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="8" cy="8.6" r="5.6" />
            <path d="M8 5.6v3l1.9 1.2" />
            <path d="M6.2 1.6h3.6" />
          </svg>
          Log time
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/*
          What they see, one press.

          This was four roles in a dropdown in the sidebar footer, below the
          fold on the screen you check it from. It is the control you reach for
          right before sending somebody a link, so it belongs where the rest of
          the controls are, and it only needs the one role: the person you are
          about to send it to owns their business.

          Hidden inside your own agency, where previewing "the owner" previews
          you.
        */}
        {org && org.kind !== 'agency' && (
          <button
            onClick={() =>
              setViewAs(viewAs ? null : { role: 'owner', label: 'somebody who owns it' })
            }
            title={
              viewAs
                ? 'Back to your own view'
                : 'Show this screen the way the person who owns this business sees it'
            }
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              background: viewAs ? C.text : 'transparent',
              border: `1px solid ${viewAs ? C.text : C.border}`,
              color: viewAs ? C.panel : C.dim,
              borderRadius: radius.pill, padding: '6px 13px',
              fontSize: 13.5, fontWeight: 500, whiteSpace: 'nowrap',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M1 8s2.6-4.5 7-4.5S15 8 15 8s-2.6 4.5-7 4.5S1 8 1 8Z" />
              <circle cx="8" cy="8" r="1.9" />
            </svg>
            {viewAs ? 'Back to my view' : 'What they see'}
          </button>
        )}

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
              borderRadius: radius.pill,
              padding: '6px 11px',
              fontSize: 13.5,
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
        {logging && <LogTime onClose={() => setLogging(false)} />}

        {dropping && (
          <div
            onClick={() => setDropping(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 60,
              background: 'rgba(0,0,0,.35)',
              display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
              paddingTop: '9vh',
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: 'min(680px, 92vw)', maxHeight: '80vh', overflowY: 'auto',
                background: C.panel, border: `1px solid ${C.border}`,
                borderRadius: 12, padding: 18,
                boxShadow: '0 20px 60px rgba(0,0,0,.35)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 15, fontWeight: 500, color: C.text }}>Add a note</span>
                <button
                  onClick={() => setDropping(false)}
                  style={{ background: 'transparent', border: 'none', color: C.faint, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Close
                </button>
              </div>
              <DropIt onClose={() => setDropping(false)} />
            </div>
          </div>
        )}
        {/* Was a dark/light toggle. A theme switch doubled every color
            decision and taught nobody anything; guided paths do. */}
        {/*
          Learn was permanent chrome pointing at a first-run walkthrough.

          The paths are "set your hourly rate", "add a customer", "create your
          first job". Useful on day one. A button in the top bar of every
          screen forever, on a workspace with three live clients and invoices
          going out, is the product not noticing it has been used — and it was
          the second Learn on Home, which had its own in the page header.

          Onboarding belongs where onboarding happens: Home's empty state
          already offers "Walk me through it", and the command bar has it for
          anybody who wants it later.
        */}

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
  const { viewAs, setViewAs } = useViewAs();
  const [email, setEmail] = useState<string | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      setEmail(data?.user?.email ?? null);
      if (!data?.user) return;
      const p = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', data.user.id)
        .maybeSingle();
      setAvatar(p.data?.avatar_url ?? null);
    });
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
    fontSize: 14,
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
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
          overflow: 'hidden',
          padding: 0,
        }}
      >
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          initials
        )}
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
              <SectionLabel>Signed in as</SectionLabel>
              <div style={{ fontSize: 13.5, color: C.text, marginTop: 3, wordBreak: 'break-all' }}>
                {email ?? '–'}
              </div>
            </div>
            {/*
              Labelled, because "Business, Team, Security" under a photograph
              reads as account settings for the person rather than the place
              the whole business is configured. Somebody looking for Team was
              looking under a face.
            */}
            <SectionLabel>Settings</SectionLabel>
            <button
              style={item}
              onClick={() => { setOpen(false); router.push('/business'); }}
            >
              The business
            </button>
            <button
              style={item}
              onClick={() => { setOpen(false); router.push('/team'); }}
            >
              Team and invites
            </button>
            <button
              style={item}
              onClick={() => { setOpen(false); router.push('/what-you-see'); }}
            >
              What you see
            </button>
            <button
              style={item}
              onClick={() => { setOpen(false); router.push('/security'); }}
            >
              Security
            </button>
            {/*
              See it as somebody else.

              Everything here bends to who is looking, and none of it could be
              checked without their password. This changes what is rendered and
              nothing else, so it answers what would they be shown rather than
              what can they reach.
            */}
            {/*
              The four roles became one button in the bar itself.

              Owner is the only one that gets used, because the question is
              always "what does the person I am about to send this to see", and
              that person owns their business. The other three answered a
              question nobody was asking from a menu nobody opened. The toggle
              is in the top bar now; see WhatTheySee below.
            */}

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
