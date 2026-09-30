/**
 * The brand a workspace actually has, wherever it is kept.
 *
 * There are two places a brand can live and they are not interchangeable.
 * A business that set itself up keeps a few fields on `orgs.settings.brand`.
 * A business an agency built for keeps a whole kit on a `brands` row, and
 * that row belongs to the AGENCY, pointing at the customer record which in
 * turn links to the client's own workspace. John's colors, logos and rules
 * are in CALO&CO's `brands` table; his own workspace's settings hold none of
 * it, which is why a Brand screen reading only `settings.brand` shows a
 * client an empty page about their own identity.
 *
 * So this follows the same link `studio_for()` and `membership_origin()`
 * already use - `customers.linked_org_id` - and answers one question for any
 * workspace: what is this business's name, its dark color, and its stacked
 * logo.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface BrandFacts {
  /** The business's own name, as it should appear to a customer. */
  name: string;
  /** The darkest brand color, for a logo on a white ground. */
  dark: string;
  /** Storage key of the dark stacked lockup, relative to the asset prefix. */
  lockupPath: string | null;
  /** The prefix every storage key in this kit sits under. */
  assetPrefix: string | null;
  /** Where the kit was found, which the caller may want to say out loud. */
  source: 'brands' | 'settings' | 'none';
  /*
    The two things every caller went back to the database for.

    This used to answer the brand question and nothing else, so the signature
    endpoint asked for the org row a second time to read its settings and
    walked customers -> brands a second time to read the kit's site_url. Eight
    round trips to answer one question, five of them repeats of a query that
    had already run, all in a row: about three seconds of a screen saying
    "Reading your brand." with nothing behind it.

    Carrying them costs nothing. Everything here was already in hand.
  */
  /** `orgs.settings`, as it was read. */
  settings: Record<string, unknown>;
  /** The kit's own `site_url`, where there is a kit. */
  siteUrl: string | null;
  /*
    The whole kit, for callers that want more than a logo and a dark color.

    The Brand screen needs the colors, the type and every asset, and this
    function has already read the row they are on. Handing the object back
    costs nothing and saves the screen a second walk down the same link.
  */
  /** The agency's `brands.kit`, verbatim. Null where there is no kit. */
  kit: Record<string, unknown> | null;
}

const FALLBACK_DARK = '#1D1F24';

/** Hex, or nothing. Keeps a typo in a kit out of an email's markup. */
function hex(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : '';
  return /^#[0-9a-fA-F]{6}$/.test(s) ? s.toUpperCase() : null;
}

/**
 * The stacked lockup meant for a white ground.
 *
 * Every kit names its assets differently, so this asks what each one is FOR
 * rather than matching on file names. The dark lockup is the one whose note
 * mentions the light grounds; failing that, any PNG lockup, because a logo
 * that is the wrong color still beats a broken image.
 */
function darkLockup(assets: Array<Record<string, unknown>>): string | null {
  const png = assets.filter(
    (a) => String(a.name ?? '').toLowerCase().endsWith('.png') &&
           String(a.group ?? '').toLowerCase().includes('lockup')
  );
  if (!png.length) return null;

  const onLight = png.find((a) => {
    const f = String(a.for ?? '').toLowerCase();
    return f.includes('white') || f.includes('sea salt') || f.includes('light');
  });
  const chosen = onLight ?? png[0];
  const path = chosen.storage_path ?? chosen.path;
  return typeof path === 'string' && path ? path : null;
}

export async function brandForOrg(db: SupabaseClient, orgId: string): Promise<BrandFacts> {
  /*
    The org row and the agency's customer row are both keyed on the org id and
    neither needs the other, so they are asked for at the same time. Only the
    kit has to wait, because it is keyed on the customer.

    The kit is found by the link the database already keeps. A workspace
    nobody built for simply has no row here, which is not an error - it falls
    through to whatever it set for itself.
  */
  const [{ data: org }, { data: linked }] = await Promise.all([
    db.from('orgs').select('name, settings').eq('id', orgId).maybeSingle(),
    db.from('customers').select('id').eq('linked_org_id', orgId).limit(1).maybeSingle(),
  ]);
  const name = (org as { name?: string } | null)?.name ?? 'Your business';
  const settings = ((org as { settings?: Record<string, unknown> } | null)?.settings ?? {});

  if (linked?.id) {
    const { data: brand } = await db
      .from('brands').select('kit, asset_prefix, site_url').eq('customer_id', linked.id).maybeSingle();
    const kit = (brand as { kit?: Record<string, unknown> } | null)?.kit;
    if (kit) {
      const colors = (kit.colors as Array<Record<string, unknown>>) ?? [];
      /* The darkest of them, measured rather than named: a kit may call its
         dark anything, but it cannot hide how dark it is. */
      const withHex = colors.map((c) => hex(c.hex)).filter(Boolean) as string[];
      const darkest = withHex.sort((a, b) => luma(a) - luma(b))[0] ?? null;
      return {
        name,
        dark: darkest ?? FALLBACK_DARK,
        lockupPath: darkLockup((kit.assets as Array<Record<string, unknown>>) ?? []),
        assetPrefix: (brand as { asset_prefix?: string } | null)?.asset_prefix ?? null,
        source: 'brands',
        settings,
        siteUrl: (brand as { site_url?: string } | null)?.site_url?.trim() || null,
        kit,
      };
    }
  }

  const own = (settings.brand as Record<string, unknown> | undefined) ?? {};
  return {
    name,
    dark: hex(own.ink) ?? hex(own.dark) ?? FALLBACK_DARK,
    lockupPath: null,
    assetPrefix: null,
    source: Object.keys(own).length ? 'settings' : 'none',
    settings,
    siteUrl: null,
    kit: null,
  };
}

/** Perceived brightness, so "which of these is the dark one" has an answer. */
function luma(h: string): number {
  const n = parseInt(h.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
