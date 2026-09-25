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
export async function postEmail(
  to: string | null | undefined,
  init: RequestInit
): Promise<Response> {
  if (!deliverable(to)) {
    console.log('[mail] skipped, reserved test address:', to);
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
    return Response.json({ error: SEND_NOT_GRANTED, refused: true }, { status: 403 });
  }

  return fetch('https://api.resend.com/emails', init);
}

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
