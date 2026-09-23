/**
 * A LIMIT ON HOW OFTEN ONE CALLER CAN WRITE.
 *
 * There was none anywhere. The audit said two routes had one; that was wrong —
 * those two were handling a 429 coming BACK from Anthropic, which is the
 * opposite thing. Zero of forty-one.
 *
 * It matters on exactly two of them. /api/leads/ingest and /api/enquiry are
 * open by design, because they are the forms on client websites, and they
 * write rows with the service key. The only gate was a honeypot field, which
 * stops a naive bot and nothing else. Nobody can read anything back, so this
 * is not exposure — it is somebody filling a client's list with rubbish faster
 * than they can delete it.
 *
 * WHAT THIS IS NOT
 *
 * In-memory, so it holds per serverless instance rather than globally. A
 * determined flood spread across instances gets through proportionally more.
 * The honest fix is a shared counter, which means Redis or a table and a
 * migration, and neither is worth it to slow down form spam on a business with
 * two clients. This raises the cost of the realistic attack — one script, one
 * address — from free to tedious, and it is ten lines rather than a dependency.
 *
 * Revisit it when there is a reason to.
 */

type Hit = { n: number; until: number };

const buckets = new Map<string, Hit>();

/** Keep the map from growing forever on a long-lived instance. */
function sweep(now: number) {
  if (buckets.size < 500) return;
  for (const [k, v] of buckets) if (v.until < now) buckets.delete(k);
}

export interface Limit {
  /** How many are allowed inside the window. */
  max: number;
  /** How long the window is, in seconds. */
  windowSec: number;
}

/**
 * Returns null when the caller may proceed, or the seconds they should wait.
 *
 * Keyed on whatever the caller passes — an IP, or an IP and a route together,
 * so one busy form does not lock somebody out of another.
 */
export function overLimit(key: string, { max, windowSec }: Limit): number | null {
  const now = Date.now();
  sweep(now);
  const hit = buckets.get(key);

  if (!hit || hit.until < now) {
    buckets.set(key, { n: 1, until: now + windowSec * 1000 });
    return null;
  }
  hit.n += 1;
  if (hit.n <= max) return null;
  return Math.max(1, Math.ceil((hit.until - now) / 1000));
}

/**
 * The caller's address, as far as it can be known behind a proxy.
 *
 * x-forwarded-for is a list, appended to at each hop, and the first entry is
 * the one the client supplied — so it is spoofable and the last entries are
 * the proxies. Vercel puts the real one in x-real-ip; the forwarded list is a
 * fallback for anywhere else this runs.
 */
export function callerIp(h: Headers): string {
  return (
    h.get('x-real-ip') ||
    (h.get('x-forwarded-for') ?? '').split(',')[0].trim() ||
    'unknown'
  );
}
