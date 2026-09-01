/**
 * "Can you send the design files?" "One moment."
 *
 * One request, one zip, everything a developer or a designer needs to build
 * something on-brand without asking a follow-up question. The alternative is
 * what this replaces: forty files attached to an email over three messages,
 * with the fonts forgotten the first time and the color values pasted into the
 * body as text.
 *
 * WHAT IS IN IT AND WHY
 *
 *   tokens.css     generated from the kit, so it cannot drift from it
 *   README.md      what each thing is and the rules that come with it
 *   messaging.md   the framework, when one exists
 *   fonts/         the faces we are actually licensed to pass on
 *   assets/        filed the way the brand kit files them
 *
 * WHAT IS DELIBERATELY LEFT OUT
 *
 * Anything not cleared. An asset flagged needs_approval is named in the README
 * rather than shipped, because the whole point of a permission flag is that it
 * survives contact with somebody in a hurry. A zip is exactly where that flag
 * gets lost, since the recipient never sees the screen that carried it.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import JSZip from 'jszip';
import { tokensCss } from '@/lib/spine/tokensCss';

export const runtime = 'nodejs';
export const maxDuration = 120;

interface Asset {
  name?: string;
  path: string;
  group?: string;
  bytes?: number;
  storage_path?: string;
  needs_approval?: boolean;
}

interface FontFile { label: string; storage_path?: string }
interface Font {
  family: string;
  role?: string;
  weight?: string;
  tracking?: string;
  source?: string;
  storage_path?: string;
  files?: FontFile[];
}

const safe = (s: string) => s.replace(/[^\w.\- ]+/g, '-').trim();

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return NextResponse.json({ error: 'Not configured.' }, { status: 500 });
  }

  /**
   * Read as the signed-in person, not as the service role.
   *
   * The download has to obey the same tenancy rule as the screen it came from.
   * Fetching the brand with a service key would hand any authenticated user
   * any workspace's brand kit by guessing a UUID, which is precisely the class
   * of hole the audit found last time.
   */
  const store = cookies();
  const supabase = createServerClient(url, anon, {
    cookies: {
      get: (name: string) => store.get(name)?.value,
      set: () => {},
      remove: () => {},
    },
  });

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  }

  const { data: brand, error } = await supabase
    .from('brands')
    .select('id, name, site_url, kit, messaging, guardrails')
    .eq('id', params.id)
    .maybeSingle();

  if (error || !brand) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  const kit = (brand.kit ?? {}) as {
    colors?: Array<{ name: string; hex: string; role?: string; token?: string }>;
    fonts?: Font[];
    assets?: Asset[];
  };
  const colors = kit.colors ?? [];
  const fonts = kit.fonts ?? [];
  const assets = kit.assets ?? [];

  const zip = new JSZip();
  const folder = safe(brand.name);
  const root = zip.folder(folder)!;

  // --- tokens ---------------------------------------------------------------
  root.file('tokens.css', tokensCss(brand.name, colors, fonts));

  // --- files ---------------------------------------------------------------
  /**
   * Storage read as the same person, deliberately.
   *
   * A service key here would work and would be wrong: it would download files
   * on behalf of somebody the bucket's own policies might refuse. Using the
   * session means the zip can never contain a file its recipient could not
   * have opened one at a time, which keeps one rule instead of two.
   */
  const storage = supabase;

  const held: string[] = [];
  const missing: string[] = [];
  let included = 0;

  for (const a of assets) {
    if (!a.storage_path) continue;
    if (a.needs_approval) {
      held.push(a.name ?? a.path);
      continue;
    }
    const dl = await storage.storage.from('client-assets').download(a.storage_path);
    if (dl.error || !dl.data) {
      missing.push(a.name ?? a.path);
      continue;
    }
    const buf = Buffer.from(await dl.data.arrayBuffer());
    const group = safe(a.group || 'other');
    root.file(`assets/${group}/${safe(a.name ?? a.path.split('/').pop() ?? 'file')}`, buf);
    included += 1;
  }

  // Fonts are filed apart from the rest, because the person wiring up a site
  // needs them at a known path and does not want to hunt through a category
  // called Documents for an .otf.
  const fontNotes: string[] = [];
  for (const f of fonts) {
    const files = f.files?.length ? f.files : f.storage_path ? [{ label: 'Regular', storage_path: f.storage_path }] : [];
    for (const file of files) {
      if (!file.storage_path) continue;
      const dl = await storage.storage.from('client-assets').download(file.storage_path);
      if (dl.error || !dl.data) { missing.push(`${f.family} ${file.label}`); continue; }
      const buf = Buffer.from(await dl.data.arrayBuffer());
      const ext = file.storage_path.split('.').pop() ?? 'otf';
      root.file(`fonts/${safe(f.family)}-${safe(file.label)}.${ext}`, buf);
      included += 1;
    }
    if (/google/i.test(f.source ?? '')) {
      fontNotes.push(`${f.family} loads from Google Fonts and is not included as a file.`);
    }
  }

  // --- messaging ------------------------------------------------------------
  const modules = (brand.messaging ?? []) as Array<{ name: string; state: string; content: string; note: string }>;
  const written = modules.filter((m) => m.content?.trim());
  if (written.length) {
    const md = [
      `# ${brand.name} messaging`,
      '',
      'Only modules with something written in them appear here. A module that is',
      'missing has not been decided yet, which is different from being empty.',
      '',
      ...written.flatMap((m) => [
        `## ${m.name}`,
        `*${m.state}${m.note ? ` · ${m.note}` : ''}*`,
        '',
        m.content.trim(),
        '',
      ]),
    ];
    root.file('messaging.md', md.join('\n'));
  }

  // --- readme ---------------------------------------------------------------
  const guard = (brand.guardrails ?? {}) as { never?: Array<{ term: string; reason?: string }> };
  const banned = guard.never ?? [];

  const readme = [
    `# ${brand.name}`,
    '',
    brand.site_url ? `${brand.site_url}\n` : '',
    `Exported ${new Date().toISOString().slice(0, 10)}. ${included} file${included === 1 ? '' : 's'}.`,
    '',
    '## What is here',
    '',
    '- `tokens.css` every color and typeface as CSS custom properties, with measured',
    '  contrast for each pairing in a comment at the bottom. Generated from the brand',
    '  kit, so do not edit it by hand: change the kit and export again.',
    written.length ? '- `messaging.md` the decided parts of the messaging framework.' : '',
    '- `fonts/` the faces we host and are able to pass on.',
    '- `assets/` filed by what each thing is for.',
    '',
    fontNotes.length ? `## Fonts\n\n${fontNotes.map((n) => `- ${n}`).join('\n')}\n` : '',
    banned.length
      ? [
          '## Never say',
          '',
          'Each of these has cost somebody a rewrite. The reason matters more than the rule.',
          '',
          ...banned.map((b) => `- **${b.term}** ${b.reason ?? ''}`.trimEnd()),
          '',
        ].join('\n')
      : '',
    held.length
      ? [
          '## Not included, on purpose',
          '',
          'These are in the kit but not cleared for use, so they are named here rather',
          'than shipped. Ask before using any of them.',
          '',
          ...held.map((h) => `- ${h}`),
          '',
        ].join('\n')
      : '',
    missing.length
      ? [
          '## Could not be read',
          '',
          ...missing.map((m) => `- ${m}`),
          '',
        ].join('\n')
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  root.file('README.md', readme);

  const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${folder}-brand-kit.zip"`,
      'Content-Length': String(buf.length),
      // Never cached: the kit changes and a stale zip is worse than a slow one.
      'Cache-Control': 'no-store',
    },
  });
}
