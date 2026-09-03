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

/**
 * Wrapped, because this one builds a zip in memory.
 *
 * Any single unreadable asset threw and the whole download failed with a stack
 * trace instead of a file. A person clicking Export twice and getting nothing
 * twice has no way to learn that one font is missing.
 */
export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    return await buildExport(req, ctx);
  } catch (e) {
    return NextResponse.json(
      { error: `Could not build the export: ${(e as Error).message}` },
      { status: 500 }
    );
  }
}

async function buildExport(req: NextRequest, { params }: { params: { id: string } }) {
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

  const guard = (brand.guardrails ?? {}) as { never?: Array<{ term: string; reason?: string }> };
  const banned = guard.never ?? [];

  // --- messaging ------------------------------------------------------------
  /**
   * The framework as a document somebody is handed, not a dump of fields.
   *
   * It was ten headings and their contents, which is a database export with
   * markdown syntax. What a client is handed has to say what each thing is for
   * and what state it is in, because the whole argument of the framework is
   * that a locked line and a line somebody is still testing are different
   * things and look identical on a page.
   */
  const modules = (brand.messaging ?? []) as Array<{
    id: string; name: string; note: string; job: string; state: string; content: string;
  }>;
  const written = modules.filter((m) => m.content?.trim());

  if (written.length) {
    const locked = written.filter((m) => m.state === 'locked');
    const testing = written.filter((m) => m.state === 'testing');
    const open = modules.filter((m) => !m.content?.trim());

    const md: string[] = [
      `# ${brand.name}`,
      '',
      'Brand and messaging platform.',
      `Exported ${new Date().toISOString().slice(0, 10)}.`,
      '',
      '## How to read this',
      '',
      'Ten modules, in the order the decisions have to be made. Each is an input to',
      'the next, so the order is not presentation: positioning cannot be written',
      'before the audience is defined.',
      '',
      'Every module carries a state, and the state is the useful part:',
      '',
      '- **Locked** is decided. Changing it is a decision, not an edit.',
      '- **Testing** is written and in front of people, not settled.',
      '- **Open** has not been decided yet, which is different from being empty.',
      '',
      `Right now: ${locked.length} locked, ${testing.length} testing, ${open.length} still open.`,
      '',
    ];

    for (const m of written) {
      md.push(`## ${m.name}`);
      md.push(`*${m.state}${m.note ? ` · ${m.note}` : ''}*`);
      md.push('');
      if (m.job) { md.push(`**What it does.** ${m.job}`); md.push(''); }
      md.push(m.content.trim());
      md.push('');
    }

    if (open.length) {
      md.push('## Not decided yet');
      md.push('');
      md.push('Listed rather than omitted. A module missing from a document reads as an');
      md.push('oversight; a module named as undecided reads as a decision nobody has made,');
      md.push('which is what it is.');
      md.push('');
      for (const m of open) md.push(`- **${m.name}.** ${m.job}`);
      md.push('');
    }

    /**
     * The never list ships with the document.
     *
     * It is the only part anybody has to obey, and leaving it in the software
     * means the person writing the next page never sees it.
     */
    if (banned.length) {
      md.push('## Never say');
      md.push('');
      md.push('Each carries its reason. Rules with reasons survive; rules without them get');
      md.push('relitigated every quarter by whoever is loudest.');
      md.push('');
      for (const b of banned) md.push(`- **${b.term}** ${b.reason ?? ''}`.trimEnd());
      md.push('');
    }

    root.file('brand-and-messaging.md', md.join('\n'));
  }

  // --- readme ---------------------------------------------------------------
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
    written.length ? '- `brand-and-messaging.md` the framework, with what each module is for and what state it is in.' : '',
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
