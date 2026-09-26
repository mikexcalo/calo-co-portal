'use client';

/**
 * The bar that says you are editing somebody else's business.
 *
 * View mode's bar is blue and says read-only. This one is amber and says the
 * opposite, and the colours are doing real work: the two modes look nothing
 * alike from across a desk, which is the only kind of recognition that helps
 * when you have four workspaces open.
 *
 * The sentence changes with how you got here, and the difference matters more
 * than it reads. "because Dana asked for help" is a fact about consent. Going
 * in yourself is allowed and is announced as what it is - you in their
 * workspace, them told about every change - with no implication that anybody
 * invited you.
 *
 * "Done, hand it back" rather than "Leave". Leaving is what you do to a room;
 * this is somebody's business and you are giving it back to them.
 */

import { useEffect, useState } from 'react';
import { useOrg } from '@/lib/spine/org';
import { useViewAs } from '@/lib/spine/viewas';
import { clientOwner, type ClientOwner } from '@/lib/spine/client-view';
import { handBack, studioFor, type Studio } from '@/lib/spine/workin';
import supabase from '@/lib/supabase';
import { C, radius, useIsPhone } from './ui';

/** How tall the bar is, so the shell can lay the frame out under it. */
export const WORK_BAR = 48;
/** How tall it is on a phone, where the sentence wraps above the button. */
export const WORK_BAR_PHONE = 92;

export function WorkModeBar() {
  const { org, orgs, switchOrg } = useOrg();
  const { work, setWork } = useViewAs();
  const phone = useIsPhone();
  const [owner, setOwner] = useState<ClientOwner | null>(null);
  const [me, setMe] = useState<string>('');
  const [studio, setStudio] = useState<Studio | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let off = false;
    (async () => {
      if (!org?.id) return;
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user?.id ?? null;
      const [found, mine, mystudio] = await Promise.all([
        clientOwner(org.id, uid),
        uid
          ? supabase.from('profiles').select('full_name').eq('id', uid).maybeSingle()
          : Promise.resolve({ data: null }),
        /* The same lookup the client's own Get help button uses, so the
           notice names the business they think they are dealing with. */
        studioFor(org.id),
      ]);
      if (off) return;
      setOwner(found);
      const whole = ((mine as { data: { full_name?: string } | null }).data?.full_name ?? '').trim();
      setMe(whole ? whole.split(/\s+/)[0] : '');
      setStudio(mystudio.studio);
    })();
    return () => { off = true; };
  }, [org?.id]);

  if (!work || !org) return null;

  const them = owner?.firstName;
  /*
    She, he, or they.

    Nothing in this product records anybody's pronouns, so inventing one from a
    name would be guessing about a real person on their own screen. "They" is
    correct for everyone and costs nothing.
  */
  const asked = Boolean(work.grantedBy);
  const sentence = asked
    ? `because ${them ?? 'they'} asked for help. ${them ?? 'They'}${them ? ' is' : "'re"} told about every change.`
    : `${them ?? 'They'}${them ? ' is' : "'re"} told about every change.`;

  const done = async () => {
    setBusy(true);
    /*
      The studio that set this workspace up, and never a stand-in word.

      A notice reading "Somebody from CALO&CO worked in your workspace" is the
      sentence a client screenshots and asks about, and a hard-coded name is
      the same problem one step earlier: it could be the wrong studio
      entirely. Both come from the data, and where the person's name has not
      loaded the studio's stands alone.
    */
    const house = studio?.name ?? '';
    const out = await handBack(work, { person: me || house, studio: house });
    /*
      Still in it, if they could not be told.

      Leaving anyway is the version of this feature that does not work: the
      changes stand, the session is closed, and the one person entitled to
      know hears nothing. save() has already put the reason on screen, so the
      bar stays up and the button can be pressed again.
    */
    if (out.error) { setBusy(false); return; }
    setWork(null);
    /*
      Back to the studio you came from, which is the one that set this
      workspace up rather than whichever agency row happened to be first in
      your list. Falls back to any agency you belong to, for the case where
      you were working in somebody else's client.
    */
    const home =
      orgs.find((o) => o.id === studio?.orgId) ?? orgs.find((o) => o.kind === 'agency');
    if (home && home.id !== org.id) await switchOrg(home.id);
    setBusy(false);
  };

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 140,
        minHeight: phone ? WORK_BAR_PHONE : WORK_BAR,
        boxSizing: 'border-box',
        background: C.working, color: C.workingInk,
        display: 'flex', alignItems: 'center',
        flexDirection: phone ? 'column' : 'row',
        gap: phone ? 8 : 14,
        padding: phone ? '10px 14px' : '0 18px',
      }}
    >
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 9, flex: 1, minWidth: 0,
          alignSelf: phone ? 'flex-start' : 'auto',
        }}
      >
        {/* A pencil, because this mode writes. The eye is View mode's. */}
        <svg
          width="17" height="17" viewBox="0 0 16 16" fill="none"
          stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
          aria-hidden style={{ flexShrink: 0 }}
        >
          <path d="M11.4 1.9a1.5 1.5 0 0 1 2.1 2.1L5.2 12.3l-3 .9.9-3z" />
        </svg>
        <span style={{ fontSize: 14, lineHeight: 1.35, minWidth: 0 }}>
          <strong style={{ fontWeight: 700 }}>Working in {org.name}</strong> {sentence}
        </span>
      </div>

      <button
        onClick={done}
        disabled={busy}
        style={{
          background: C.workingInk, border: `1px solid ${C.workingInk}`,
          color: C.working,
          borderRadius: radius.pill, padding: '6px 15px',
          fontSize: 13.5, fontWeight: 700, fontFamily: 'inherit',
          cursor: busy ? 'wait' : 'pointer', whiteSpace: 'nowrap',
          flexShrink: 0, alignSelf: phone ? 'flex-start' : 'auto',
          opacity: busy ? 0.7 : 1,
        }}
      >
        {busy ? 'Handing back…' : 'Done, hand it back'}
      </button>
    </div>
  );
}

/**
 * What they asked for, pinned where the work happens.
 *
 * A request read once on the way in is a request half-remembered by the third
 * screen. It stays at the top of every page for the whole session, with the
 * two permissions beside it, because "can I send this" is a question that
 * arrives at the moment somebody reaches for the send button and is answered
 * too late anywhere else.
 */
export function WorkRequest({ body, at, canSend }: { body: string; at: string; canSend: boolean }) {
  const { work } = useViewAs();
  const { org } = useOrg();
  const [owner, setOwner] = useState<ClientOwner | null>(null);

  useEffect(() => {
    let off = false;
    (async () => {
      if (!org?.id) return;
      const { data } = await supabase.auth.getSession();
      const found = await clientOwner(org.id, data.session?.user?.id ?? null);
      if (!off) setOwner(found);
    })();
    return () => { off = true; };
  }, [org?.id]);

  if (!work) return null;

  const when = new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const whose = owner?.firstName ? `${owner.firstName}'s request` : 'Their request';

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
        background: C.panelAlt, border: `1px solid ${C.border}`,
        borderRadius: radius.lg, padding: '11px 14px', marginBottom: 18,
      }}
    >
      <div style={{ flex: 1, minWidth: 240, fontSize: 14, lineHeight: 1.5, color: C.text }}>
        <strong style={{ fontWeight: 700 }}>{whose}, {when}:</strong>{' '}
        <span>&ldquo;{body}&rdquo;</span>
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <Chip tone="allow">Can edit</Chip>
        <Chip tone={canSend ? 'allow' : 'deny'}>{canSend ? 'Can send' : "Can't send"}</Chip>
      </div>
    </div>
  );
}

function Chip({ tone, children }: { tone: 'allow' | 'deny'; children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap',
        color: tone === 'allow' ? C.working : C.text,
        background: tone === 'allow' ? `${C.working}1A` : C.panel,
        border: `1px solid ${tone === 'allow' ? `${C.working}55` : C.borderStrong}`,
        borderRadius: radius.pill, padding: '3px 10px',
      }}
    >
      {children}
    </span>
  );
}
