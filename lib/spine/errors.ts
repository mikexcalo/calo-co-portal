/**
 * Turning what the database said into what a person needs to hear.
 *
 * "Could not find the table 'public.drops' in the schema cache" went on a
 * client's screen. It names a table she has never heard of, implies she broke
 * it, and does not answer the only three questions anybody has: what
 * happened, was it my fault, and is trying again worth it.
 *
 * Deliberately short. A message that explains the architecture is still a
 * message written for the person who built it.
 */

export function human(raw: unknown, fallback = 'That did not work. Try again, and tell us if it keeps happening.'): string {
  const msg =
    raw instanceof Error ? raw.message
    : typeof raw === 'string' ? raw
    : typeof raw === 'object' && raw && 'message' in raw ? String((raw as { message: unknown }).message)
    : '';

  if (!msg) return fallback;

  // A missing table or column means a database change has not been applied.
  // Nothing the person did, and nothing trying again will fix.
  if (/schema cache|does not exist|relation .* does not exist|column .* does not exist/i.test(msg)) {
    return 'This part is not switched on yet — a database change behind it has not been applied. Nothing you did.';
  }
  if (/row-level security|permission denied|not authorized|403/i.test(msg)) {
    return 'You do not have access to do that here. Ask whoever set this workspace up.';
  }
  if (/duplicate key|already exists|unique constraint/i.test(msg)) {
    return 'That already exists. Look for it rather than adding it again.';
  }
  if (/violates check constraint|invalid input|out of range/i.test(msg)) {
    return 'Something in that is not a value this will accept. Check the fields and try again.';
  }
  if (/foreign key/i.test(msg)) {
    return 'That is still attached to something else, so it cannot be changed on its own.';
  }
  if (/jwt|token|session|401/i.test(msg)) {
    return 'Your sign-in has expired. Reload the page and sign in again.';
  }
  if (/network|failed to fetch|timeout|econn/i.test(msg)) {
    return 'No connection to the server. Try again in a moment.';
  }
  if (/payload too large|size/i.test(msg) && /large|exceed/i.test(msg)) {
    return 'That file is too big.';
  }
  return fallback;
}
