/**
 * Addresses that must never be posted to a mail provider.
 *
 * Added for the demo workspaces, where every contact is @example.com so a UX
 * audit cannot reach a real person. Blocking them at the point of send is the
 * only way to make that a guarantee rather than a hope: the demo data being
 * harmless depends on the data staying harmless, and one pasted real address
 * during an audit would undo it.
 *
 * It is also simply correct for the live product. example.com, example.net,
 * example.org and the .test, .invalid and .localhost suffixes are reserved by
 * the IETF (RFC 2606 and RFC 6761) precisely so they can never be registered
 * or receive mail. Handing one to Resend produces a hard bounce, and enough
 * hard bounces is how a sending domain's reputation goes.
 *
 * So this is not a demo feature bolted on. It is a rule the product should
 * always have had, and it happens to make the demo safe.
 */

const RESERVED_DOMAINS = new Set([
  'example.com',
  'example.net',
  'example.org',
]);

/** Reserved by RFC 6761. Nothing under them resolves, anywhere. */
const RESERVED_SUFFIXES = ['.test', '.invalid', '.localhost', '.example'];

/**
 * True when this address could conceivably reach a person.
 *
 * Deliberately narrow: it answers "is this a reserved test address", not "is
 * this a valid address". Anything it cannot recognise is treated as real,
 * because the cost of wrongly blocking a client's invoice is much higher than
 * the cost of one bounce.
 */
export function deliverable(to: string | null | undefined): boolean {
  const addr = (to ?? '').trim().toLowerCase();
  if (!addr || !addr.includes('@')) return false;
  const domain = addr.slice(addr.lastIndexOf('@') + 1);
  if (!domain) return false;
  if (RESERVED_DOMAINS.has(domain)) return false;
  return !RESERVED_SUFFIXES.some((s) => domain === s.slice(1) || domain.endsWith(s));
}

/** What to say when something was not sent because of the above. */
export const NOT_DELIVERABLE =
  'That address is a reserved test address, so nothing was sent. Demo and ' +
  'sample data uses these on purpose.';

/**
 * fetch() to Resend, unless the address is reserved.
 *
 * Returns a Response either way so every caller's `.ok` and `.json()` keep
 * working untouched — a skipped send looks like a successful one to the code
 * around it, which is correct: nothing failed, there was simply nobody real
 * to send to. The skip is logged so it is never silent.
 */
/**
 * What a send was about, where the caller knows.
 *
 * Optional everywhere. A route that does not pass it still gets a recorded
 * row; it simply cannot be found from the screen showing the invoice.
 */
export interface MailAbout {
  table: 'job_invoices' | 'estimates';
  id: string;
}

/**
 * One row per attempt, whatever the attempt did.
 *
 * Deliberately swallows its own failures. This is bookkeeping about a send,
 * not part of it, and a mail that goes out but cannot be written down is much
 * better than a mail that does not go out because the writing down failed.
 */
async function record(entry: {
  to: string;
  init: RequestInit;
  outcome: 'handed_over' | 'skipped' | 'refused' | 'failed';
  providerId?: string | null;
  detail?: string | null;
  about?: MailAbout;
}): Promise<void> {
  try {
    const { serviceClient, whoIsCalling } = await import('./api-caller');
    const db = serviceClient();
    if (!db) return;

    let orgId: string | null = null;
    try {
      const who = await whoIsCalling();
      if (who?.userId) {
        const { data } = await db
          .from('profiles').select('active_org_id').eq('id', who.userId).maybeSingle();
        orgId = (data as { active_org_id?: string } | null)?.active_org_id ?? null;
      }
    } catch {
      /* A cron job or a webhook. The row is still worth having. */
    }

    let subject: string | null = null;
    let from: string | null = null;
    try {
      const sent = JSON.parse(String(entry.init.body ?? '{}')) as { subject?: string; from?: string };
      subject = sent.subject ?? null;
      /*
        The envelope, not just the contents.

        Three reminders vanished between Resend and an inbox and the first
        question was "what did it actually say it was from" - which nothing
        had written down, so it could not be answered without sending a
        fourth. A record of a send that omits the sender is half a record.
      */
      from = sent.from ?? null;
    } catch {
      /* Not our JSON. The rest of the row still stands. */
    }

    await db.from('mail_sends').insert({
      org_id: orgId,
      to_email: entry.to,
      from_email: from,
      subject,
      about_table: entry.about?.table ?? null,
      about_id: entry.about?.id ?? null,
      provider_id: entry.providerId ?? null,
      outcome: entry.outcome,
      detail: entry.detail ?? null,
    });
  } catch (e) {
    console.error('[mail] could not record the send:', e);
  }
}

export async function postEmail(
  to: string | null | undefined,
  init: RequestInit,
  about?: MailAbout
): Promise<Response> {
  if (!deliverable(to)) {
    console.log('[mail] skipped, reserved test address:', to);
    await record({
      to: (to ?? '').trim(), init, about,
      outcome: 'skipped', detail: NOT_DELIVERABLE,
    });
    return Response.json({ id: 'skipped-reserved-address', skipped: true });
  }

  /*
    One gate, and no route had to be edited to get it.

    Every mail route in this product already funnels through here, which is why
    the reserved-address rule works, and it is why the send lock belongs here
    too. Threading "who is doing this, and in whose workspace" through ten
    handlers would be ten chances to forget, and the tenth is the one that
    sends.
  */
  if (!(await sendingAllowed())) {
    await record({
      to: (to ?? '').trim(), init, about,
      outcome: 'refused', detail: SEND_NOT_GRANTED,
    });
    return Response.json({ error: SEND_NOT_GRANTED, refused: true }, { status: 403 });
  }

  /*
    Read the body once, here, and keep the id.

    Every caller does its own `res.json()` afterwards, and a Response body can
    only be read once, so this hands back a fresh Response carrying the same
    bytes. Without that, recording the id would break every route that reads
    the reply - which is all of them.
  */
  const res = await fetch('https://api.resend.com/emails', init);
  const text = await res.text();
  let parsed: { id?: string; message?: string; error?: string; name?: string } | null = null;
  try { parsed = JSON.parse(text); } catch { /* not JSON; `text` is the detail */ }

  await record({
    to: (to ?? '').trim(), init, about,
    outcome: res.ok ? 'handed_over' : 'failed',
    providerId: res.ok ? parsed?.id ?? null : null,
    detail: res.ok ? null : parsed?.message || parsed?.error || text.slice(0, 500) || `the mail service answered ${res.status}`,
  });

  return new Response(text, {
    status: res.status,
    statusText: res.statusText,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}

/*
  THE NAME ON THE ENVELOPE IS OURS.

  `fromAs()` lived here and put the client's business in the From display
  name, on the reasoning that a roofer's customer should not be chased for
  money by a company they have never heard of. The reasoning was right and the
  place was wrong. Four reminders sent that way were accepted by Gmail and
  then kept nowhere at all, while every other email from this same address
  arrived; "Harbor Light Roofing via CALO&CO" fared no better than the plain
  form. A display name that claims a company unrelated to the sending domain
  is indistinguishable from a spoof, and the message behind it carries an
  invoice and a payment button.

  So the envelope says CALO&CO, which is true and which the domain can prove,
  and the business's name moved into the subject line and the first sentence,
  where the customer reads it and no filter is weighing it.
*/

/** What to say when a send was refused because the client did not allow it. */
export const SEND_NOT_GRANTED =
  'Nothing was sent. Sending to customers is theirs, and they have not allowed it.';

/**
 * May whoever is calling send right now.
 *
 * Answers yes in the ordinary case, which is the one to get right: somebody
 * sending from their own workspace has no grant and needs none. It only ever
 * says no while a studio is inside somebody else's workspace on a session that
 * did not include permission to send.
 *
 * WHOSE WORKSPACE, WITHOUT BEING TOLD
 *
 * profiles.active_org_id already says which workspace the caller is standing
 * in - it is what every row filter in the database reads - so the org does not
 * have to be passed in and cannot be passed in wrongly. During a work session
 * that value IS the client's workspace, because working in it is a switch into
 * it.
 *
 * WHAT THIS IS AND IS NOT
 *
 * Server side, so it cannot be turned off from a browser, and that is worth
 * having. It is still not a wall against the studio owner, who holds an owner
 * membership in the workspace and could reach a customer by a route that does
 * not pass through here. It closes the product's own doors. Closing all of
 * them needs the studio's membership narrowed, and is its own brief.
 *
 * Fails open only where there is nobody to check: a cron run or a webhook has
 * no cookies and is the platform acting rather than a person, and refusing
 * those would stop invoices going out on the 1st. Fails CLOSED on every error
 * once a caller is known, because a send that goes out because a permission
 * check timed out is the exact outcome this exists to prevent.
 */
export async function sendingAllowed(): Promise<boolean> {
  let senderId: string | null = null;
  try {
    const { whoIsCalling } = await import('./api-caller');
    senderId = (await whoIsCalling())?.userId ?? null;
  } catch {
    /* No request scope: a cron job or a webhook. Not a studio session. */
    return true;
  }
  if (!senderId) return true;

  const { serviceClient } = await import('./api-caller');
  const db = serviceClient();
  if (!db) {
    console.error('[mail] no service client, refusing the send');
    return false;
  }

  try {
    const { data: profile, error: pErr } = await db
      .from('profiles')
      .select('active_org_id')
      .eq('id', senderId)
      .maybeSingle();
    if (pErr) {
      console.error('[mail] profile lookup failed, refusing:', pErr.message);
      return false;
    }
    const orgId = profile?.active_org_id;
    if (!orgId) return true;

    const { data, error } = await db
      .from('work_grants')
      .select('can_send')
      .eq('org_id', orgId)
      .eq('granted_to', senderId)
      .is('revoked_at', null)
      .is('ended_at', null)
      .limit(1);

    if (error) {
      console.error('[mail] grant lookup failed, refusing the send:', error.message);
      return false;
    }

    /* No open session: not a studio working inside somebody else's
       workspace. Ordinary sending, allowed. */
    if (!data?.length) return true;

    return Boolean(data[0].can_send);
  } catch (e) {
    console.error('[mail] grant lookup threw, refusing the send:', e);
    return false;
  }
}
