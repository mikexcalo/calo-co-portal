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
  return fetch('https://api.resend.com/emails', init);
}
