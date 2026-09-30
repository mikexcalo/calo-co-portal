/**
 * A brand's logo set, as a matrix rather than a list of files.
 *
 * WHY A MATRIX
 *
 * A kit arrives as a flat list - eighteen files with names and a sentence
 * each about what they are for. That is how it was stored and how the Logos
 * tab drew it, which meant nobody could see what was missing: three stacked
 * lockups and three marks look complete until you ask "in how many colors,
 * and is there a horizontal one".
 *
 * So this reads the flat list into version x color, which is the shape the
 * question actually has. What is present fills in; what is absent is a hole
 * you can point at. `gapsIn` below returns the holes.
 *
 * WHY THE RULES DECIDE THE COLUMNS
 *
 * The standard asks for every brand color plus white and black. A brand's own
 * rules routinely forbid most of that - GSP's say in as many words "Don't use
 * Mussel for any part of the logo" and name exactly three approved color
 * versions. Offering a Mussel lockup because the palette has a Mussel in it
 * would be the product overruling the brand it is supposed to be serving. So
 * the approved list comes from `logo_rules.color_versions` where a kit states
 * one, and only falls back to the palette where it does not.
 */

/** The four things a logo set should contain. */
export const VERSIONS = [
  { id: 'stacked', label: 'Full logo, stacked', match: ['stacked', 'lockup'] },
  { id: 'horizontal', label: 'Full logo, horizontal', match: ['horizontal', 'wordmark-right', 'inline'] },
  { id: 'mark', label: 'Mark only', match: ['mark', 'icon', 'favicon'] },
  { id: 'watermark', label: 'Watermark', match: ['watermark'] },
] as const;

export type VersionId = (typeof VERSIONS)[number]['id'];

/**
 * The ladder every file is offered in.
 *
 * SVG is the master. PNG at three sizes because "give me the logo" means a
 * different number of pixels to a printer, a slide and a signature. PDF
 * because print buyers ask for it and a raster in a PDF is not print-ready.
 *
 * EPS is not here. Producing one means Ghostscript or Illustrator, and this
 * runs on a serverless function with neither. A file named .eps that is
 * really a PDF is worse than no file, because it fails at the printer rather
 * than here.
 */
export const FORMATS = [
  { id: 'svg', label: 'SVG', note: 'The master. Scales to anything, smallest file.' },
  { id: 'png-2048', label: 'PNG · large', note: 'Transparent, 2048px. Print-ish, big screens.' },
  { id: 'png-1024', label: 'PNG · medium', note: 'Transparent, 1024px. Slides, documents.' },
  { id: 'png-512', label: 'PNG · small', note: 'Transparent, 512px. Web, email, avatars.' },
  { id: 'pdf', label: 'PDF', note: 'Vector, for print. Send this to a printer.' },
] as const;

export type FormatId = (typeof FORMATS)[number]['id'];

export interface KitAsset {
  name?: string;
  group?: string;
  for?: string;
  storage_path?: string;
  path?: string;
}

export interface SetEntry {
  version: VersionId;
  versionLabel: string;
  /** The color version, in the brand's own words. */
  color: string;
  /** Which ground it is drawn for, so the preview is honest. */
  ground: 'light' | 'dark';
  /** Storage key of the SVG master, relative to the asset prefix. */
  svgPath: string | null;
  /** Storage key of a raster, where there is no SVG. */
  rasterPath: string | null;
  fileStem: string;
}

const lower = (v: unknown) => (typeof v === 'string' ? v.toLowerCase() : '');

/**
 * Which of the four a file is. Possibly more than one.
 *
 * A file can genuinely be two versions at once, and a kit says so when it
 * means it: GSP's mark files read "Mark alone, and the watermark on light
 * grounds". Treating that as a mark and reporting the watermark as missing
 * would send somebody off to draw a file the brand already has and has
 * already said is the same drawing.
 */
function versionsOf(a: KitAsset): VersionId[] {
  const hay = `${lower(a.group)} ${lower(a.name)} ${lower(a.for)}`;
  const out: VersionId[] = [];
  for (const v of VERSIONS) {
    if (v.match.some((m) => hay.includes(m))) out.push(v.id);
  }
  /* 'lockup' and 'mark' both appear in a lockup's sentence often enough that
     the more specific one wins: a stacked lockup is not also the mark. */
  if (out.includes('stacked') || out.includes('horizontal')) {
    return out.filter((v) => v !== 'mark' && v !== 'watermark');
  }
  return out;
}

/**
 * Which color a file is, read off the file name against the approved list.
 *
 * File names are the only place the color is stated per file; the `for`
 * sentence describes the ground, not the ink. Matching on the approved names
 * rather than guessing means a file whose color is not approved does not
 * quietly become a column.
 */
function colorOf(a: KitAsset, approved: string[]): string | null {
  const stem = lower(a.name).replace(/\.[a-z0-9]+$/, '');
  const hit = approved.find((c) => stem.includes(c.toLowerCase().replace(/\s+/g, '-')));
  return hit ?? null;
}

/**
 * Light or dark ground, from what the kit says the file is for.
 *
 * A white logo previewed on white is a blank card, which is how a kit comes
 * to look half-empty. The kit already says which surface each file is for.
 */
function groundOf(a: KitAsset): 'light' | 'dark' {
  const f = lower(a.for);
  /* The sentence names the surface the file goes ON, so "on white or Sea
     Salt" is a light ground and "on Wet Slate, High Tide, or photography" is
     a dark one. Reading it the other way round previews the dark-ink logo on
     dark, which is the blank card this is meant to prevent. */
  if (/\bon (white|sea salt)/.test(f) || /\blight grounds?\b/.test(f)) return 'light';
  if (/wet slate|high tide|photograph|dark/.test(f)) return 'dark';
  return 'light';
}

/** The color versions this brand actually permits, in its own words. */
export function approvedColors(kit: Record<string, unknown> | null): string[] {
  const rules = (kit?.logo_rules ?? {}) as { color_versions?: Array<{ name?: string }> };
  const named = (rules.color_versions ?? []).map((c) => String(c.name ?? '').trim()).filter(Boolean);
  if (named.length) return named;
  /* No stated list. Fall back to the palette plus the two neutrals the
     standard always asks for, which is a guess and is why a kit should
     state one. */
  const colors = ((kit?.colors ?? []) as Array<{ name?: string }>).map((c) => String(c.name ?? '').trim());
  return [...colors.filter(Boolean), 'White', 'Black'];
}

/** Everything the kit actually holds, arranged version x color. */
export function setFromKit(kit: Record<string, unknown> | null): SetEntry[] {
  const approved = approvedColors(kit);
  const assets = ((kit?.assets ?? []) as KitAsset[]).filter((a) => /\.(svg|png)$/i.test(String(a.name ?? '')));

  const byKey = new Map<string, SetEntry>();
  for (const a of assets) {
    const color = colorOf(a, approved);
    if (!color) continue;
    const path = String(a.storage_path ?? a.path ?? '');
    const isSvg = /\.svg$/i.test(path);
    const stem = String(a.name ?? '').replace(/\.[a-z0-9]+$/i, '');

    for (const version of versionsOf(a)) {
      const key = `${version}:${color}`;
      const existing = byKey.get(key);
      if (existing) {
        if (isSvg) existing.svgPath = path;
        else existing.rasterPath ??= path;
        continue;
      }
      byKey.set(key, {
        version,
        versionLabel: VERSIONS.find((v) => v.id === version)!.label,
        color,
        ground: groundOf(a),
        svgPath: isSvg ? path : null,
        rasterPath: isSvg ? null : path,
        fileStem: stem,
      });
    }
  }

  const order = VERSIONS.map((v) => v.id);
  return [...byKey.values()].sort(
    (a, b) => order.indexOf(a.version) - order.indexOf(b.version) || a.color.localeCompare(b.color)
  );
}

export interface Gap {
  version: VersionId;
  versionLabel: string;
  color: string;
  /** Why it is missing: absent, or ruled out by the brand itself. */
  why: 'missing' | 'not approved';
}

/**
 * What the standard asks for and this kit does not have.
 *
 * Only across the colors the brand approves. A "missing" Mussel lockup is not
 * missing, it is forbidden, and reporting it as a hole would send somebody off
 * to draw a thing the rules say must not exist.
 */
export function gapsIn(kit: Record<string, unknown> | null): Gap[] {
  const have = new Set(setFromKit(kit).map((e) => `${e.version}:${e.color}`));
  const approved = approvedColors(kit);
  const out: Gap[] = [];
  for (const v of VERSIONS) {
    for (const c of approved) {
      if (!have.has(`${v.id}:${c}`)) {
        out.push({ version: v.id, versionLabel: v.label, color: c, why: 'missing' });
      }
    }
  }
  return out;
}
