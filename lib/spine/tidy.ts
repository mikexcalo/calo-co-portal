/**
 * An address written the way somebody would write it on an envelope.
 *
 * "1018 b cushing dr, round rock, TX" is what gets typed on a phone, and it is
 * what the customer screen printed back — in grey, at 12.5px, floating loose
 * beside a website link with no label saying what it was.
 *
 * Only words that are entirely lower case get touched, so TX stays TX and
 * McAllen keeps its capital. Street abbreviations that are really words get
 * their capital and nothing more: this is not trying to be a postal
 * normaliser, it is trying to stop a screen looking careless.
 */

const ALWAYS_UPPER = new Set(['nw', 'ne', 'sw', 'se', 'po']);

export function tidyAddress(a: string | null | undefined): string {
  const text = (a ?? '').trim();
  if (!text) return '';

  return text
    .split(/\s+/)
    .map((w) => {
      const bare = w.replace(/[^a-zA-Z]/g, '');
      if (!bare) return w;
      if (ALWAYS_UPPER.has(bare.toLowerCase())) return w.toUpperCase();
      // Already carrying a capital — a state code, a name — is left alone.
      if (w !== w.toLowerCase()) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(' ');
}
