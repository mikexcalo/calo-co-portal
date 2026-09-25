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

/**
 * How settled a thing is, and who settled it.
 *
 * Three words with precise meanings, and the distance between them is the
 * whole point. "Decided" means the studio committed to it. "Proposed" means
 * somebody drew it and nobody has argued. "Not decided" means there is no
 * answer yet and anybody acting as if there were is guessing.
 *
 * Deliberately not a boolean. A brand mid-flight is mostly the middle value,
 * and collapsing it into done/not-done is how a proposal ends up on a crate.
 */
export type ItemStatus = 'Decided by CALO&CO' | 'Proposed' | 'Not decided';

/**
 * A stamp any item in a kit can carry.
 *
 * Separate from the status because they answer different questions. The studio
 * deciding something and the client agreeing to it are two events, and a kit
 * that cannot tell them apart will eventually present the first as the second
 * in front of the person who never said yes.
 *
 * Both optional. An item with no stamp is an item nobody has ruled on, which
 * is a real state and is shown as nothing rather than as a guess.
 */
export interface Stamped {
  status?: ItemStatus;
  /** Whether the client has signed off. Absent means nobody recorded either way. */
  clientApproved?: boolean;
  /** A caveat that belongs with the status, where one was written down. */
  statusNote?: string;
}

export interface KitColor extends Stamped {
  hex: string;
  name: string;
  /** What it is for, in words. */
  role?: string;
  /** The CSS custom property it ships as, where the brand has been built. */
  token?: string;
  /** Print and screen values, as written down. Absent where never specified. */
  rgb?: string;
  cmyk?: string;
  pantone?: string;
}

export interface KitFont extends Stamped {
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
export interface KitPairing extends Stamped {
  /** The sentence, as the brand wrote it. */
  rule: string;
}

/**
 * The logo, as rules rather than as files.
 *
 * Every field is optional and an empty one renders nothing, because most
 * brands have some of this and almost none have all of it. A brand with only
 * a don'ts list is a brand with a don'ts list, not a broken record.
 */
export interface KitLogoRules {
  /** Each version, what it is for, and whether anybody signed it off. */
  versions?: Array<Stamped & { name: string; use?: string; files?: string }>;
  /** The measured construction, one row per rule. */
  construction?: Array<Stamped & { rule: string; spec: string }>;
  clearSpace?: Stamped & { rule: string };
  minimumSizes?: Array<Stamped & { item: string; screen?: string; print?: string }>;
  colorVersions?: Array<Stamped & { name: string; rule: string }>;
  /** Prohibitions, as written. Rarely stamped: they follow from the rest. */
  donts?: string[];
  /** Anything that qualifies the above without being a rule itself. */
  notes?: string[];
}

export interface Kit {
  name: string;
  colors: KitColor[];
  fonts: KitFont[];
  /** Stated colour rules, shown under the palette. Empty for most brands. */
  pairings: KitPairing[];
  /** How the logo may be built and used. Absent for most brands. */
  logoRules?: KitLogoRules;
  /**
   * Where the brand stands with the person whose brand it is.
   *
   * Brand level rather than per item, because "the client has not seen any of
   * this" is one fact about the whole thing and repeating it eighteen times
   * would make it easy to stop reading.
   */
  approval?: { client?: string; note?: string };
  logos: string[];
  voice: string;
  /** Where this came from, so the page knows whether it can be edited here. */
  origin: 'org' | 'client';
  /** Only set for a client brand, for the link out to its own screens. */
  brandId?: string;
}

const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Record<string, unknown> =>
  (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

const STATUSES: ItemStatus[] = ['Decided by CALO&CO', 'Proposed', 'Not decided'];

/** The stamp on any item, read leniently: an unknown status is no status. */
function stamp(v: unknown): Stamped {
  const o = obj(v);
  const status = STATUSES.find((x) => x === str(o.status));
  const approved =
    typeof o.client_approved === 'boolean' ? o.client_approved
    : typeof o.clientApproved === 'boolean' ? (o.clientApproved as boolean)
    : undefined;
  const note = str(o.status_note) || str(o.statusNote) || undefined;
  return {
    ...(status ? { status } : {}),
    ...(approved === undefined ? {} : { clientApproved: approved }),
    ...(note ? { statusNote: note } : {}),
  };
}

/**
 * A rule that may be a bare sentence or a stamped object.
 *
 * kit.pairings shipped as an array of strings and the first brand to use it
 * still has them that way. Widening in the reader rather than migrating the
 * row keeps that brand working and costs four lines; the alternative is a
 * migration per brand and a window where one of them is broken.
 */
function pairing(v: unknown): KitPairing | null {
  if (typeof v === 'string') return v.trim() ? { rule: v.trim() } : null;
  const o = obj(v);
  const rule = str(o.rule).trim();
  return rule ? { rule, ...stamp(o) } : null;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/**
 * The logo rules, read the same lenient way as everything else.
 *
 * Every branch drops what it cannot read rather than throwing, so a kit typed
 * by hand in the dashboard degrades to the parts that parsed instead of taking
 * the brand page down.
 */
function logoRules(v: unknown): KitLogoRules | undefined {
  const o = obj(v);
  if (!Object.keys(o).length) return undefined;

  const versions = asArray(o.versions).map((x) => {
    const r = obj(x);
    return str(r.name) ? { name: str(r.name), use: str(r.use) || undefined, files: str(r.files) || undefined, ...stamp(r) } : null;
  }).filter(Boolean) as NonNullable<KitLogoRules['versions']>;

  const construction = asArray(o.construction).map((x) => {
    const r = obj(x);
    return str(r.rule) ? { rule: str(r.rule), spec: str(r.spec), ...stamp(r) } : null;
  }).filter(Boolean) as NonNullable<KitLogoRules['construction']>;

  const minimumSizes = asArray(o.minimum_sizes).map((x) => {
    const r = obj(x);
    return str(r.item) ? { item: str(r.item), screen: str(r.screen) || undefined, print: str(r.print) || undefined, ...stamp(r) } : null;
  }).filter(Boolean) as NonNullable<KitLogoRules['minimumSizes']>;

  const colorVersions = asArray(o.color_versions).map((x) => {
    const r = obj(x);
    return str(r.name) ? { name: str(r.name), rule: str(r.rule), ...stamp(r) } : null;
  }).filter(Boolean) as NonNullable<KitLogoRules['colorVersions']>;

  const cs = obj(o.clear_space);
  const clearSpace = str(cs.rule) ? { rule: str(cs.rule), ...stamp(cs) } : undefined;

  const donts = asArray(o.donts).map(str).map((x) => x.trim()).filter(Boolean);
  const notes = asArray(o.notes).map(str).map((x) => x.trim()).filter(Boolean);

  const out: KitLogoRules = {
    ...(versions.length ? { versions } : {}),
    ...(construction.length ? { construction } : {}),
    ...(clearSpace ? { clearSpace } : {}),
    ...(minimumSizes.length ? { minimumSizes } : {}),
    ...(colorVersions.length ? { colorVersions } : {}),
    ...(donts.length ? { donts } : {}),
    ...(notes.length ? { notes } : {}),
  };
  return Object.keys(out).length ? out : undefined;
}

function approval(v: unknown): Kit['approval'] {
  const o = obj(v);
  const client = str(o.client).trim();
  const note = str(o.note).trim();
  return client || note ? { ...(client ? { client } : {}), ...(note ? { note } : {}) } : undefined;
}

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
    pairings: asArray(b.pairings).map(pairing).filter(Boolean) as KitPairing[],
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
        rgb: str(o.rgb) || undefined,
        cmyk: str(o.cmyk) || undefined,
        pantone: str(o.pantone) || undefined,
        ...stamp(o),
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
        ...stamp(o),
      };
    }).filter((f) => f.family),
    pairings: asArray(k.pairings).map(pairing).filter(Boolean) as KitPairing[],
    logoRules: logoRules(k.logo_rules),
    approval: approval(k.approval),
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
