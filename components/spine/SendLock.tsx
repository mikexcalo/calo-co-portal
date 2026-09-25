'use client';

/**
 * Why the send button will not do anything, said next to the send button.
 *
 * A disabled control with no explanation is the thing people file bugs about,
 * and this one has a particularly bad failure mode: somebody assumes the
 * product is broken, sends the estimate from their own email instead, and the
 * client's customer gets a document from the wrong business.
 *
 * So the sentence names whose decision it was. Not "you do not have
 * permission", which reads as the software refusing you. The relationship with
 * their customers belongs to them and they have not handed it over, which is a
 * fact about them, and it is the sentence you could repeat to them without
 * embarrassment.
 *
 * Renders nothing outside a work session and nothing when sending is allowed,
 * so it can sit beside any send button in the product without a condition at
 * the call site.
 */

import { useEffect, useState } from 'react';
import { useOrg } from '@/lib/spine/org';
import { useViewAs } from '@/lib/spine/viewas';
import { clientOwner } from '@/lib/spine/client-view';
import supabase from '@/lib/supabase';
import { C } from './ui';

/** Whether sending is currently held back. Use it to disable the control. */
export function useSendLocked(): boolean {
  const { work, viewAs } = useViewAs();
  if (viewAs) return true;
  return Boolean(work) && !work?.canSend;
}

export function SendLock({ align = 'right' }: { align?: 'left' | 'right' }) {
  const { org } = useOrg();
  const { work } = useViewAs();
  const locked = useSendLocked();
  const [owner, setOwner] = useState<string | null>(null);

  useEffect(() => {
    let off = false;
    (async () => {
      if (!org?.id || !locked) return;
      const { data } = await supabase.auth.getSession();
      const found = await clientOwner(org.id, data.session?.user?.id ?? null);
      if (!off) setOwner(found?.firstName ?? null);
    })();
    return () => { off = true; };
  }, [org?.id, locked]);

  if (!locked || !work) return null;

  const whose = owner ?? 'Theirs';
  const they = owner ?? 'They';

  return (
    <div
      style={{
        fontSize: 12.5,
        color: C.faint,
        marginTop: 6,
        textAlign: align,
        lineHeight: 1.5,
      }}
    >
      {owner ? `Sending is ${whose}'s.` : 'Sending is theirs.'}{' '}
      {they} {owner ? "hasn't" : "haven't"} allowed you to send.
    </div>
  );
}

/**
 * A mark on something this session changed.
 *
 * The client is told what was touched; the person doing the touching needs the
 * same thing on the screen, or the third edit is made without remembering the
 * first two. It reads "changed by Mike" rather than "edited" because the name
 * is the part that matters on a screen belonging to somebody else.
 *
 * Takes ids rather than fetching per row: one query for the session, a set to
 * test against, and a list of any length costs nothing.
 */
export interface ChangedHere {
  /** Whether this row was changed during the open session. */
  has: (id: string) => boolean;
  /** Whoever is doing the changing, by first name. */
  who: string;
}

export function useChangedHere(entity: string): ChangedHere {
  const { work } = useViewAs();
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [who, setWho] = useState('them');

  useEffect(() => {
    let off = false;
    setIds(new Set());
    if (!work) return;
    (async () => {
      const [rows, prof] = await Promise.all([
        supabase.from('work_changes').select('entity_id').eq('grant_id', work.id).eq('entity', entity),
        supabase.from('profiles').select('full_name').eq('id', work.grantedTo).maybeSingle(),
      ]);
      if (off) return;
      setIds(new Set(
        ((rows.data ?? []) as Array<{ entity_id: string | null }>)
          .map((r) => r.entity_id)
          .filter(Boolean) as string[]
      ));
      const whole = ((prof.data as { full_name?: string } | null)?.full_name ?? '').trim();
      if (whole) setWho(whole.split(/\s+/)[0]);
    })();
    return () => { off = true; };
  }, [work, entity]);

  return { has: (id: string) => ids.has(id), who };
}

export function ChangedBy({ who }: { who: string }) {
  return (
    <span
      style={{
        fontSize: 11.5,
        fontWeight: 600,
        color: C.working,
        whiteSpace: 'nowrap',
      }}
    >
      · changed by {who}
    </span>
  );
}
