/**
 * One shape for a brand, whichever table it came out of.
 *
 * There were two, and they never met. An org's own identity lives in
 * orgs.settings.brand as { colors, logos, fontHeading, fontBody, voice } — two
 * typefaces, as bare strings. A client's lives in brands.kit as { colors,
 * fonts, assets }, where a colour carries the CSS token it is published under
 * and a face carries its role, its weights and its tracking.
 *
 * The second is the better model by a distance, and the split is the reason
 * the two were separate screens: you could not put a picker at the top of one
 * page when the page underneath had to be rebuilt depending on the answer.
 * So the richer shape wins, the poorer one is widened to fit it, and there is
 * one renderer.
 *
 * Nothing is migrated. Both rows stay exactly as they are on disk; this reads
 * them into a common shape at the point of use, which is reversible and cannot
 * lose anybody's data.
 */

export interface KitColor {
  hex: string;
  name: string;
  /** What it is for, in words. */
  role?: string;
  /** The CSS custom property it ships as, where the brand has been built. */
  token?: string;
}

export interface KitFont {
  family: string;
  role: string;
  weight?: string;
  tracking?: string;
  source?: string;
  /**
   * How the face is set, where the brand has decided.
   *
   * Not a preference. A wordmark specified in uppercase is wrong in sentence
   * case, and the person who needs to know that is reading the kit rather than
   * the brand document it came from.
   */
  case?: 'uppercase' | 'lowercase' | 'sentence' | 'title';
}

/**
 * A rule about which colours may sit on which, in the brand's own words.
 *
 * Distinct from the contrast matrix, and both belong. The matrix is
 * arithmetic: it will tell you Wet slate on Buoy is 3.9:1 and let you draw
 * your own conclusion. This is the decision somebody made, which can be
 * stricter than the arithmetic, can be a rule the arithmetic has no opinion
 * about, and is the thing that actually gets broken.
 *
 * Free text on purpose. A structured grammar of allowed pairs would have to be
 * invented for each brand and would still not express "never as text on", so
 * the sentence as written is kept and shown.
 */
export type KitPairing = string;

export interface Kit {
  name: string;
  colors: KitColor[];
  fonts: KitFont[];
  /** Stated colour rules, shown under the palette. Empty for most brands. */
  pairings: KitPairing[];
  logos: string[];
  voice: string;
  /** Where this came from, so the page knows whether it can be edited here. */
  origin: 'org' | 'client';
  /** Only set for a client brand, for the link out to its own screens. */
  brandId?: string;
}

const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/** An org's own identity, widened into the client shape. */
export function kitFromOrg(name: string, settings: unknown): Kit {
  const b = ((settings as Record<string, unknown>)?.brand ?? {}) as Record<string, unknown>;
  const fonts: KitFont[] = [];
  const heading = str(b.fontHeading).trim();
  const body = str(b.fontBody).trim();
  if (heading) fonts.push({ family: heading, role: 'Display and headlines' });
  if (body) fonts.push({ family: body, role: 'Body and UI' });

  return {
    name,
    colors: asArray(b.colors).map((c) => {
      const o = c as Record<string, unknown>;
      return { hex: str(o.hex), name: str(o.name), role: str(o.role) || undefined };
    }).filter((c) => c.hex),
    fonts,
    pairings: asArray(b.pairings).map(str).map((x) => x.trim()).filter(Boolean),
    logos: [str(b.logoLight), ...asArray(b.logos).map(str)].map((u) => u.trim()).filter(Boolean),
    voice: str(b.voice),
    origin: 'org',
  };
}

/** A client identity, which is already this shape. */
export function kitFromBrand(row: { id: string; name: string; kit: unknown }): Kit {
  const k = (row.kit ?? {}) as Record<string, unknown>;
  return {
    name: row.name,
    colors: asArray(k.colors).map((c) => {
      const o = c as Record<string, unknown>;
      return {
        hex: str(o.hex),
        name: str(o.name),
        role: str(o.role) || undefined,
        token: str(o.token) || undefined,
      };
    }).filter((c) => c.hex),
    fonts: asArray(k.fonts).map((f) => {
      const o = f as Record<string, unknown>;
      return {
        family: str(o.family),
        role: str(o.role) || 'Type',
        weight: str(o.weight) || undefined,
        tracking: str(o.tracking) || undefined,
        source: str(o.source) || undefined,
        case: (['uppercase', 'lowercase', 'sentence', 'title'] as const).find((c) => c === str(o.case)),
      };
    }).filter((f) => f.family),
    pairings: asArray(k.pairings).map(str).map((x) => x.trim()).filter(Boolean),
    logos: asArray(k.assets).map(str).filter(Boolean),
    voice: str(k.voice),
    origin: 'client',
    brandId: row.id,
  };
}

/* ---------------------------------------------------------------------------
   Contrast.

   A kit that lists colours tells you what they are. A kit worth using tells
   you which ones can sit on which — that is the rule people actually break,
   and the one nobody can check by eye. The numbers are WCAG 2.1 relative
   luminance, which is the same arithmetic an accessibility audit will run.
   --------------------------------------------------------------------------- */

export function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0;
  const n = parseInt(m[1], 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Black or white, whichever can actually be read on this ground. */
export function readableOn(hex: string): string {
  return contrast(hex, '#FFFFFF') >= contrast(hex, '#000000') ? '#FFFFFF' : '#000000';
}

/**
 * What a ratio means, in the words of the standard.
 *
 * 4.5 is the floor for body text and 3 for large text; below 3 nothing is
 * legible on it and the pairing is simply wrong.
 */
export function grade(ratio: number): { label: string; tone: 'green' | 'amber' | 'red' } {
  if (ratio >= 7) return { label: 'AAA', tone: 'green' };
  if (ratio >= 4.5) return { label: 'AA', tone: 'green' };
  if (ratio >= 3) return { label: 'Large text only', tone: 'amber' };
  return { label: 'Fails', tone: 'red' };
}
