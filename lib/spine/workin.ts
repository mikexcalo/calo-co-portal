'use client';

/**
 * Working in a client's workspace, with their consent and in the open.
 *
 * View mode answers "what do they see". This answers "fix it for them", and it
 * is the more dangerous of the two by a distance: it writes to somebody else's
 * business. So three things hold it together, and all three are here.
 *
 *   A grant, which is consent with a start and an end.
 *   A change log, written at the same choke point that refuses writes in View
 *   mode, so no screen has to remember to record anything.
 *   A notice to the client when the session ends, built from that log.
 *
 * WHAT IT DOES NOT DO
 *
 * It does not give anybody access they did not have. The studio owner already
 * holds an owner membership in every client workspace it set up, so the
 * database already permits all of this. The grant is a record of consent and a
 * switch the product obeys; the send lock stops the product, not the person.
 * That is stated plainly in the migration and in the bar the whole time a
 * session is open.
 */

import supabase from '@/lib/supabase';
import { save } from './save';
import { human } from './errors';

export interface Grant {
  id: string;
  orgId: string;
  feedbackId: string | null;
  grantedBy: string | null;
  grantedTo: string;
  canEdit: boolean;
  canSend: boolean;
  grantedAt: string;
}

export interface HelpRequest {
  id: string;
  orgId: string;
  body: string;
  createdAt: string;
  authorId: string | null;
}

const row = (r: Record<string, unknown>): Grant => ({
  id: String(r.id),
  orgId: String(r.org_id),
  feedbackId: (r.feedback_id as string | null) ?? null,
  grantedBy: (r.granted_by as string | null) ?? null,
  grantedTo: String(r.granted_to),
  canEdit: Boolean(r.can_edit),
  canSend: Boolean(r.can_send),
  grantedAt: String(r.granted_at),
});

/** The open session for this person in this workspace, if there is one. */
export async function openGrant(orgId: string, userId: string): Promise<Grant | null> {
  const res = await supabase
    .from('work_grants')
    .select('*')
    .eq('org_id', orgId)
    .eq('granted_to', userId)
    .is('revoked_at', null)
    .is('ended_at', null)
    .order('granted_at', { ascending: false })
    .limit(1);
  const first = (res.data ?? [])[0] as Record<string, unknown> | undefined;
  return first ? row(first) : null;
}

/**
 * One session by id, still open.
 *
 * Used to restore after a page load. Returns null for a grant that has been
 * revoked or ended, which is the point: the row is the authority, not the
 * browser that remembered it.
 */
export async function grantById(id: string): Promise<Grant | null> {
  const res = await supabase
    .from('work_grants')
    .select('*')
    .eq('id', id)
    .is('revoked_at', null)
    .is('ended_at', null)
    .maybeSingle();
  return res.data ? row(res.data as Record<string, unknown>) : null;
}

/**
 * Start a session the studio asked for itself.
 *
 * granted_by stays null and that is the whole point: nobody said yes. The bar
 * reads differently for this case, and the notice the client gets at the end
 * does not say "like you asked", because they did not.
 *
 * can_send is false. A session nobody requested cannot reach their customers.
 */
export async function startOwnSession(orgId: string, userId: string): Promise<Grant | null> {
  const existing = await openGrant(orgId, userId);
  if (existing) return existing;

  /*
    Wrapped, because a session that fails to start has to say so.

    It did not. The insert was refused, the function returned null, the caller
    checked `if (grant)` and did nothing, and the button sat there looking
    pressable. Twenty minutes went into finding that, and the fix is the rule
    this codebase already has written down in save.ts: a write nobody looks at
    is a write that fails in silence.
  */
  const res = await save(
    supabase
      .from('work_grants')
      .insert({ org_id: orgId, granted_to: userId, can_edit: true, can_send: false })
      .select()
      .maybeSingle(),
    'Starting a work session'
  );
  return res.data ? row(res.data as Record<string, unknown>) : null;
}

/**
 * Accept a client's request, on the terms they set.
 *
 * The two booleans come from the request rather than from whoever is
 * accepting it. Reading them off the message is what makes "you can take this
 * back at any time" mean something: the studio never chooses its own
 * permissions.
 */
export async function acceptRequest(
  req: { id: string; orgId: string; canEdit: boolean; canSend: boolean; authorId: string | null },
  userId: string
): Promise<Grant | null> {
  const existing = await openGrant(req.orgId, userId);
  if (existing) return existing;

  const res = await supabase
    .from('work_grants')
    .insert({
      org_id: req.orgId,
      feedback_id: req.id,
      granted_by: req.authorId,
      granted_to: userId,
      can_edit: req.canEdit,
      can_send: req.canSend,
    })
    .select()
    .maybeSingle();

  if (res.data) {
    await supabase.from('feedback').update({ status: 'building' }).eq('id', req.id);
  }
  return res.data ? row(res.data as Record<string, unknown>) : null;
}

/* ------------------------------------------------------------ the change log */

/**
 * One line per thing touched, in the client's words rather than the schema's.
 *
 * `jobs` is not a word anybody outside this codebase uses, and a notice
 * reading "he changed 1 row in job_invoices" is worse than no notice. Anything
 * not on this list is described by its own table name, which is ugly and
 * honest; the fix is to add it here rather than to invent a friendlier guess.
 */
const ENTITY_WORDS: Record<string, [string, string]> = {
  estimates: ['estimate', 'estimates'],
  estimate_lines: ['line on an estimate', 'lines on estimates'],
  job_invoices: ['invoice', 'invoices'],
  job_invoice_lines: ['line on an invoice', 'lines on invoices'],
  jobs: ['job', 'jobs'],
  customers: ['customer', 'customers'],
  time_entries: ['time entry', 'time entries'],
  price_items: ['price', 'prices'],
  documents: ['document', 'documents'],
  customer_notes: ['note', 'notes'],
  reminders: ['reminder', 'reminders'],
};

export const entityWords = (table: string, n: number): string =>
  (ENTITY_WORDS[table] ?? [table, table])[n === 1 ? 0 : 1];

export interface Change {
  entity: string;
  entityId: string | null;
  action: string;
  label: string | null;
  at: string;
}

/** Everything done during one session, newest first. */
export async function changesFor(grantId: string): Promise<Change[]> {
  const res = await supabase
    .from('work_changes')
    .select('entity, entity_id, action, label, at')
    .eq('grant_id', grantId)
    .order('at', { ascending: false });
  return ((res.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    entity: String(r.entity),
    entityId: (r.entity_id as string | null) ?? null,
    action: String(r.action),
    label: (r.label as string | null) ?? null,
    at: String(r.at),
  }));
}

/**
 * What the client is told, in one sentence, built from what happened.
 *
 * Counts by kind rather than listing every row, because "he changed 14 things"
 * is not reassuring and fourteen bullet points is not readable. Two kinds get
 * both named; three or more collapses to a number, and the detail is behind
 * "See what changed" rather than lost.
 *
 * Returns null when nothing was changed. A session where the studio looked and
 * left is a session the client does not need telling about, which is the same
 * rule View mode follows.
 */
export function describeChanges(changes: Change[]): string | null {
  if (!changes.length) return null;

  const counts = new Map<string, number>();
  for (const c of changes) counts.set(c.entity, (counts.get(c.entity) ?? 0) + 1);

  const parts = [...counts.entries()].map(([table, n]) => `${n} ${entityWords(table, n)}`);
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/**
 * End the session and tell them what happened.
 *
 * The notice is written before the grant is closed, so a failure to write it
 * leaves the session open and visible rather than silently ended with the
 * client never told. Getting that order wrong is how somebody's data changes
 * and nobody says so.
 */
export async function handBack(
  grant: Grant,
  studio: { person: string; studio: string }
): Promise<{ told: boolean; summary: string | null; error?: string }> {
  const changes = await changesFor(grant.id);
  const summary = describeChanges(changes);

  if (summary) {
    const asked = grant.grantedBy ? ', like you asked' : '';
    /*
      Wrapped, and the session stays open if it fails.

      The comment above said the order protected the client. It did not: the
      insert's result was thrown away, so a refused notice ended the grant
      anyway and the client was never told a thing had been changed. That is
      the precise failure this whole feature exists to prevent, and it got in
      by the oldest route in this codebase - a write nobody looked at.
    */
    const told = await save(
      supabase.from('notifications').insert({
        org_id: grant.orgId,
        kind: 'system',
        title:
        studio.person === studio.studio
          ? `${studio.studio} worked in your workspace today`
          : `${studio.person} from ${studio.studio} worked in your workspace today`,
        body: `${studio.person} changed ${summary}${asked}.`,
        href: `/changed/${grant.id}`,
        dedupe_key: `work:${grant.id}`,
      }),
      'Telling them what changed'
    );
    if (told.error) return { told: false, summary, error: human(told.error) };
  }

  await supabase.from('work_grants').update({ ended_at: new Date().toISOString() }).eq('id', grant.id);

  if (grant.feedbackId) {
    await supabase
      .from('feedback')
      .update({ status: 'done', closed_at: new Date().toISOString() })
      .eq('id', grant.feedbackId);
  }

  return { told: Boolean(summary), summary };
}

/** The client stopping it, which is not the same as the studio finishing. */
export async function revokeGrant(grantId: string): Promise<void> {
  await supabase
    .from('work_grants')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', grantId);
}
