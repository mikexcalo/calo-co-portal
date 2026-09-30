/**
 * The brand this workspace actually has, in the shape the Brand screen draws.
 *
 * WHY THIS EXISTS
 *
 * The Brand screen read `orgs.settings.brand` and nothing else. That is the
 * right place for a business that set itself up, and the wrong place for every
 * business an agency built for: their colors, type and logos are a `brands`
 * row owned by the AGENCY, reached through `customers.linked_org_id`. So a
 * client opened the screen about their own identity and was told "No colors
 * yet" while a finished kit sat one join away.
 *
 * The Signature tab already read it correctly, through `brandForOrg`. This is
 * the same walk, returning the whole kit rather than a logo and a dark color,
 * so every tab on the screen can agree about whose brand it is showing.
 *
 * WHY THE SERVER ANSWERS
 *
 * The kit belongs to the agency. A client's own session cannot see across into
 * the agency's tables and should not be able to. The service role reads it for
 * the one workspace the caller is actually standing in, and nothing else
 * crosses over.
 *
 * WHY SIGNED URLS AND NOT PATHS
 *
 * Kit assets live in `client-assets`, which is private: a client's artwork is
 * not ours to publish. The screen gets URLs that last an hour, which is a
 * screen's lifetime. The one asset that has to outlive that - the signature's
 * logo - has its own permanent door at /api/brand/logo.
 */

import { NextResponse } from 'next/server';
import { whoIsCalling, serviceClient } from '@/lib/spine/api-caller';
import { brandForOrg } from '@/lib/spine/brand-for-org';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** An hour. Long enough to read a brand, short enough not to be a publication. */
const SIGNED_FOR = 60 * 60;

interface KitColor { name: string; hex: string; role?: string; token?: string }
interface KitFont { role?: string; family?: string; weight?: string; source?: string }
interface KitAsset {
  name?: string; group?: string; for?: string; bytes?: number;
  storage_path?: string; path?: string;
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/**
 * Which face does what.
 *
 * A kit names roles in prose - "Display and headlines", "Body and UI" - and
 * the screen has two slots. Matching on the words rather than on position,
 * because a kit may list a wordmark face first, as GSP's does, and that is
 * not the heading face.
 */
function facesFrom(fonts: KitFont[]): { heading: string; body: string } {
  const has = (f: KitFont, ...words: string[]) => {
    const r = (f.role ?? '').toLowerCase();
    return words.some((w) => r.includes(w));
  };
  const heading = fonts.find((f) => has(f, 'display', 'headline', 'heading'));
  const body = fonts.find((f) => has(f, 'body'));
  return {
    heading: str(heading?.family) || str(fonts[0]?.family),
    body: str(body?.family) || str(fonts[1]?.family) || str(fonts[0]?.family),
  };
}

export async function GET() {
  const caller = await whoIsCalling();
  if (!caller?.userId) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const db = serviceClient();
  if (!db) return NextResponse.json({ error: 'Server is not configured.' }, { status: 500 });

  const { data: profile } = await db
    .from('profiles').select('active_org_id').eq('id', caller.userId).maybeSingle();
  const orgId = (profile as { active_org_id?: string } | null)?.active_org_id;
  if (!orgId) return NextResponse.json({ error: 'No workspace open.' }, { status: 400 });

  const facts = await brandForOrg(db, orgId);

  /*
    A business that keeps its own brand keeps it in the shape the screen
    already edits, so there is nothing to translate and nothing to lock.
  */
  if (facts.source !== 'brands' || !facts.kit) {
    return NextResponse.json({
      source: facts.source,
      business: facts.name,
      editable: true,
      /* Their own dark, for previews that need a dark ground. brandForOrg
         measures it rather than trusting a name. */
      dark: facts.dark,
      colors: [], fonts: [], fontHeading: '', fontBody: '', logos: [], voice: '',
    });
  }

  const kit = facts.kit;
  const colors = ((kit.colors as KitColor[]) ?? [])
    .filter((c) => str(c.hex))
    .map((c) => ({ name: str(c.name), hex: str(c.hex), role: str(c.role), token: str(c.token) }));

  const fonts = ((kit.fonts as KitFont[]) ?? []).map((f) => ({
    role: str(f.role), family: str(f.family), weight: str(f.weight), source: str(f.source),
  }));
  const { heading, body } = facesFrom(fonts);

  /*
    Every drawable asset, signed in one round trip rather than eighteen.

    Only the images are offered: a kit lists PDFs and documents too, and a
    logo grid that shows a broken tile for each of them is worse than a grid
    that does not mention them.
  */
  const assets = ((kit.assets as KitAsset[]) ?? []).filter((a) =>
    /\.(png|svg|jpe?g|webp|gif)$/i.test(str(a.storage_path) || str(a.path) || str(a.name))
  );
  const paths = assets.map((a) => `${facts.assetPrefix}/${str(a.storage_path) || str(a.path)}`);

  let logos: Array<{ name: string; group: string; for: string; url: string }> = [];
  if (facts.assetPrefix && paths.length) {
    const { data: signed } = await db.storage
      .from('client-assets').createSignedUrls(paths, SIGNED_FOR);
    logos = (signed ?? []).flatMap((s, i) =>
      s.signedUrl
        ? [{
            name: str(assets[i].name) || str(assets[i].storage_path),
            group: str(assets[i].group),
            for: str(assets[i].for),
            url: s.signedUrl,
          }]
        : []
    );
  }

  return NextResponse.json({
    source: 'brands',
    business: facts.name,
    /* The darkest colour in the kit, measured. A reversed logo previewed on
       the platform's navy was a fourth brand on somebody's own brand page. */
    dark: facts.dark,
    /* The mark on its own, for a badge too small to take a lockup. */
    hasMark: Boolean(facts.markOnDark || facts.markOnLight),
    /*
      Read-only, and said out loud rather than left for a failed save to
      explain. The row belongs to the agency; a Save here would write to
      `orgs.settings.brand`, which nothing reads once a kit exists, so the
      edit would look accepted and then vanish on the next load.
    */
    editable: false,
    colors,
    fonts,
    fontHeading: heading,
    fontBody: body,
    logos,
    voice: str((kit as { voice?: string }).voice),
  });
}
