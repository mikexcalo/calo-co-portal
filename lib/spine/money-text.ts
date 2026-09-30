/**
 * Money, for anything the server writes.
 *
 * WHY THIS EXISTS RATHER THAN toLocaleString
 *
 * Every mail route already had a `money()` built on
 * `toLocaleString('en-US', { minimumFractionDigits: 2 })`, which is correct
 * and which works perfectly in a browser. Production emails still came out
 * "$3896.00". Not one route: the invoice, the estimate and the reminder all
 * did it, on the same day, while the same numbers rendered "$3,896.00" on
 * every screen.
 *
 * The difference is ICU. A browser ships the full locale database; a Node
 * runtime may ship a cut-down one, and on a small-icu build `toLocaleString`
 * quietly ignores the locale it was handed and returns an ungrouped number.
 * No error, no warning, just a missing comma in every invoice a customer
 * reads.
 *
 * So this groups the digits itself. It cannot be affected by which build of
 * Node a deployment happens to run on, which is the only property that
 * matters for text going to somebody else's inbox.
 *
 * The browser keeps `money()` from the design system. This is for the server.
 */

export function moneyText(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v)) return '$0.00';

  const negative = v < 0;
  const [whole, cents] = Math.abs(v).toFixed(2).split('.');
  /* Three at a time from the right, which is the whole of the rule. */
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}$${grouped}.${cents}`;
}
