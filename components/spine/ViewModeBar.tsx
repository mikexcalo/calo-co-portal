'use client';

/**
 * The bar that says whose screen you are looking at.
 *
 * It replaces a 32px near-black strip that said "Seeing this as somebody who
 * owns it". That was a caption. This is a statement of state: full width, the
 * only saturated colour in the product, naming the business and the person,
 * and carrying the two ways out. The workspace under it is framed in the same
 * blue, so there is no angle at which you can be in View mode and not know.
 *
 * Three things the wording has to do.
 *
 * Name the business, because the studio owner has five open and the whole
 * point of the mode is that the screen looks like somebody else's.
 *
 * Say read-only in the same breath, so the first question the mode raises is
 * answered before it is asked.
 *
 * Say the client is not told. That is the question anybody decent asks second,
 * and leaving it to be guessed at is worse than either answer.
 *
 * When there is no second person in the workspace — which is every workspace
 * the studio set up and has not handed over — the name is dropped rather than
 * filled in. "exactly as they see it" is true; naming yourself is not.
 */

import { useEffect, useState } from 'react';
import { useOrg } from '@/lib/spine/org';
import { useViewAs } from '@/lib/spine/viewas';
import { clientOwner, type ClientOwner } from '@/lib/spine/client-view';
import supabase from '@/lib/supabase';
import { C, radius, useIsPhone } from './ui';

/** How tall the bar is, so the shell can lay the frame out under it. */
export const VIEW_BAR = 48;
/** How tall it is on a phone, where the sentence wraps and the buttons stack. */
export const VIEW_BAR_PHONE = 92;

export function ViewModeBar() {
  const { org, orgs, switchOrg } = useOrg();
  const { viewAs, setViewAs } = useViewAs();
  const phone = useIsPhone();
  const [owner, setOwner] = useState<ClientOwner | null>(null);

  useEffect(() => {
    let off = false;
    (async () => {
      if (!org?.id) return;
      /* getSession, not getUser: the id is already in the browser and this is
         not a permission decision, only "is that person me". */
      const { data } = await supabase.auth.getSession();
      const found = await clientOwner(org.id, data.session?.user?.id ?? null);
      if (!off) setOwner(found);
    })();
    return () => { off = true; };
  }, [org?.id]);

  if (!viewAs || !org) return null;

  const them = owner?.firstName;
  const pronoun = them ? `${them}` : 'they';

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 140,
        minHeight: phone ? VIEW_BAR_PHONE : VIEW_BAR,
        boxSizing: 'border-box',
        background: C.viewing, color: C.viewingInk,
        display: 'flex', alignItems: 'center',
        flexDirection: phone ? 'column' : 'row',
        gap: phone ? 8 : 14,
        padding: phone ? '10px 14px' : '0 18px',
      }}
    >
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 9,
          flex: 1, minWidth: 0,
          alignSelf: phone ? 'flex-start' : 'auto',
        }}
      >
        <svg
          width="17" height="17" viewBox="0 0 16 16" fill="none"
          stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
          aria-hidden style={{ flexShrink: 0 }}
        >
          <path d="M1 8s2.6-4.5 7-4.5S15 8 15 8s-2.6 4.5-7 4.5S1 8 1 8Z" />
          <circle cx="8" cy="8" r="1.9" />
        </svg>
        <span style={{ fontSize: 14, lineHeight: 1.35, minWidth: 0 }}>
          <strong style={{ fontWeight: 700 }}>Viewing {org.name}</strong>{' '}
          exactly as {pronoun} see{them ? 's' : ''} it. Read-only.{' '}
          {them ? `${them} isn't told.` : "They aren't told."}
        </span>
      </div>

      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 9,
          flexShrink: 0, alignSelf: phone ? 'flex-start' : 'auto',
        }}
      >
        {/*
          Disabled, and disabled honestly.

          Working in a client's workspace is the next brief, so this is not a
          button that will do something once the data loads. The title says
          which, because a control that never responds and never explains is
          the thing people file bugs about.
        */}
        <button
          disabled
          title="Not built yet. View mode is read-only for now."
          style={{
            background: 'transparent',
            border: `1px solid rgba(255,255,255,.45)`,
            color: C.viewingInk, opacity: 0.55,
            borderRadius: radius.pill, padding: '6px 15px',
            fontSize: 13.5, fontWeight: 500, fontFamily: 'inherit',
            cursor: 'not-allowed', whiteSpace: 'nowrap',
          }}
        >
          Work in it
        </button>
        {/*
          Back to your studio, not just out of View mode.

          Leaving the mode and standing in the client's workspace as yourself
          is the state this whole feature exists to make unmistakable, so
          landing there by pressing the way out would be an odd trick to play.
          The button says studio and goes to the studio. If there is no agency
          workspace to go to — which cannot happen for the person this mode is
          built for, but can happen to a member of a client workspace who
          somehow got here — it does the honest half and drops the mode.
        */}
        <button
          onClick={() => {
            setViewAs(null);
            const studio = orgs.find((o) => o.kind === 'agency');
            if (studio && studio.id !== org.id) void switchOrg(studio.id);
          }}
          style={{
            background: C.viewingInk, border: `1px solid ${C.viewingInk}`,
            color: C.viewing,
            borderRadius: radius.pill, padding: '6px 15px',
            fontSize: 13.5, fontWeight: 700, fontFamily: 'inherit',
            cursor: 'pointer', whiteSpace: 'nowrap',
          }}
        >
          Back to your studio
        </button>
      </div>
    </div>
  );
}
