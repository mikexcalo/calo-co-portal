/**
 * What became of a message after we handed it over.
 *
 * `mail_sends` records that Resend accepted something and gives back the id it
 * accepted it under. That is where the product's knowledge used to stop, and
 * it is one step short of the only question anybody actually asks: did it
 * arrive. Resend keeps the answer against that id, so this fetches it and
 * writes it down.
 *
 * WHY IT IS PULLED AND NOT PUSHED
 *
 * A webhook would be better and is the right end state. This is the half that
 * can exist today without a public endpoint to register, a signing secret to
 * hold, or a deployment that has to be reachable before a status is knowable.
 * Somebody looking at a reminder presses once and finds out.
 *
 * It refuses to tell one workspace about another's mail: the row has to belong
 * to the org the caller is standing in. The service key reads it, so RLS is
 * not doing that work and this handler has to.
 */

import { NextRequest, NextResponse } from 'next/server';
import { whoIsCalling, serviceClient } from '@/lib/spine/api-caller';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Resend's event names, in the words a person would use.
 *
 * `delivered` is the only one that means it arrived. `sent` means the same
 * thing "Sent 1 reminder" used to mean: handed over, nothing more.
 */
const PLAIN: Record<string, string> = {
  sent: 'Handed to the mail service. No confirmation yet.',
  delivered: 'Delivered to their mail server.',
  delivery_delayed: 'Delayed. Their mail server has not taken it yet.',
  complained: 'Delivered, then marked as spam by the recipient.',
  bounced: 'Bounced. It did not reach them.',
  opened: 'Delivered, and opened.',
  clicked: 'Delivered, and a link in it was clicked.',
  queued: 'Queued at the mail service.',
  scheduled: 'Scheduled to go out later.',
  failed: 'The mail service could not send it.',
};

function plainStatus(status: string | null | undefined): string | null {
  if (!status) return null;
  return PLAIN[status] ?? status.replace(/_/g, ' ');
}

export async function POST(req: NextRequest) {
  const caller = await whoIsCalling();
  if (!caller?.userId) {
    return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  }
  const db = serviceClient();
  if (!db) {
    return NextResponse.json({ error: 'The server is not configured to read mail status.' }, { status: 500 });
  }

  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id) return NextResponse.json({ error: 'Which send?' }, { status: 400 });

  const { data: profile } = await db
    .from('profiles').select('active_org_id').eq('id', caller.userId).maybeSingle();
  const orgId = (profile as { active_org_id?: string } | null)?.active_org_id ?? null;

  const { data: row, error } = await db
    .from('mail_sends')
    .select('id, org_id, provider_id, outcome, detail, status')
    .eq('id', id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!row || (row.org_id && row.org_id !== orgId)) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  /* Nothing was handed over, so there is nothing to ask about. What we already
     know is the whole answer. */
  if (row.outcome !== 'handed_over' || !row.provider_id) {
    return NextResponse.json({ outcome: row.outcome, detail: row.detail, status: row.status });
  }

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return NextResponse.json({
      outcome: row.outcome,
      status: row.status,
      detail: 'Email is not switched on here, so the mail service cannot be asked.',
    });
  }

  const res = await fetch(`https://api.resend.com/emails/${row.provider_id}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  const body = (await res.json().catch(() => null)) as
    | { last_event?: string; to?: string[]; message?: string; error?: string }
    | null;

  if (!res.ok) {
    const why = body?.message || body?.error || `the mail service answered ${res.status}`;
    return NextResponse.json({ outcome: row.outcome, status: row.status, detail: why });
  }

  const status = body?.last_event ?? null;
  await db.from('mail_sends')
    .update({ status, status_at: new Date().toISOString() })
    .eq('id', row.id);

  return NextResponse.json({ outcome: row.outcome, status, detail: plainStatus(status) });
}
