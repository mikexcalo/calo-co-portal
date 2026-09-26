/**
 * How a client's business presents itself on a document its customer opens.
 *
 * A proposal and an invoice are the same business seen twice, and they were
 * resolving that business independently: the proposal read `brand.logos`, the
 * invoice read only `brand.logoLight`, and both fell back to near-black while
 * a real colour sat in `settings.workspace_color`. So Harbor Light's teal was
 * on every screen of the app and on neither of the two documents its
 * customers actually receive.
 *
 * One resolver, no React, no client component — both pages are server
 * components and this runs before anything renders.
 *
 * EVERYTHING HERE CAN BE ABSENT, AND ABSENT IS A REAL ANSWER. A business with
 * no logo gets its initials. A business with no phone gets no Call button. A
 * customer must never be shown a bracketed placeholder where a fact should be.
 */

export interface ClientFace {
  name: string;
  /** A logo URL, when the brand kit holds one. */
  logo: string | null;
  /** Up to two letters, for when it does not. */
  initials: string;
  /** The one colour this document is allowed to fill with. */
  accent: string;
  /** Readable ink for text sitting on `accent`. */
  accentInk: string;
  phone: string | null;
  address: string | null;
  email: string | null;
  /**
   * A contractor's licence number, where they have one.
   *
   * Optional and frequently absent, and the approved mock carries
   * "[LICENSE NO.]" in the header - which is exactly what must never reach a
   * customer. Empty means the line is not drawn at all.
   */
  license: string | null;
}

/** The shape the two pages select out of `orgs`. */
export interface OrgRow {
  name?: string | null;
  kind?: string | null;
  settings?: unknown;
}

const trimmed = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim() : '';
  return s.length ? s : null;
};

/**
 * Two letters from a business name.
 *
 * Two words give their initials; one word gives its first two letters. Good
 * enough for every name in here and it never returns an empty square, which
 * is the failure that matters — a blank tile at the top of an invoice reads
 * as a broken image.
 */
export function initialsOf(name: string): string {
  /*
    Letters and digits only.

    Splitting on whitespace alone turned "Demo (UX audit)" into "D(" on the
    foot of a proposal: the second word started with a bracket, and a bracket
    is not an initial. Punctuation is stripped before anything is counted, and
    a name that is entirely punctuation falls through to the question mark
    rather than rendering an empty square.
  */
  const words = name
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean);
  if (!words.length) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/**
 * Black or white on a given background, by luminance.
 *
 * Harbor Light's teal takes white; a pale brand would take black. Deciding it
 * per business rather than assuming white is the difference between a
 * readable Pay button and a white-on-cream one nobody can see.
 */
export function inkOn(hex: string): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  if (full.length !== 6) return '#FFFFFF';
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.45 ? '#111111' : '#FFFFFF';
}

export function clientFace(org: OrgRow | null): ClientFace {
  const settings = (org?.settings ?? {}) as Record<string, unknown>;
  const brand = (settings.brand ?? {}) as {
    colors?: Array<{ hex?: string; role?: string }>;
    logoLight?: string;
    logos?: string[];
  };

  const name = trimmed(org?.name) ?? '';

  /*
    The colour, in the order the business actually decided it.

    A brand kit's primary is a deliberate choice and wins. The workspace
    colour is the next most deliberate - somebody picked it, it is on the
    strip of every screen they use, and it was being ignored on the one
    surface their customers see. Near-black only when nothing has been chosen
    at all, which is a document with no colour rather than a document wearing
    ours.
  */
  const fromKit =
    brand.colors?.find((c) => /primary/i.test(c.role ?? ''))?.hex ??
    brand.colors?.[0]?.hex ??
    null;
  const accent = trimmed(fromKit) ?? trimmed(settings.workspace_color) ?? '#1D1F24';

  return {
    name,
    logo: trimmed(brand.logoLight) ?? trimmed(brand.logos?.[0]) ?? null,
    initials: initialsOf(name),
    accent,
    accentInk: inkOn(accent),
    phone: trimmed(settings.phone),
    address: trimmed(settings.address),
    email: trimmed(settings.email),
    license: trimmed(settings.license_no),
  };
}

/** Digits only: a tel: href with brackets and spaces in it does not dial. */
export const telHref = (phone: string): string => `tel:${phone.replace(/[^\d+]/g, '')}`;
