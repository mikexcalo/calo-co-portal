/**
 * No em dashes in text a person reads.
 *
 * The house rule has been written down twice - `docs/ux-rulebook.md` section
 * 6 and the "How Mike wants to be worked with" list in `docs/handoff.md` -
 * and swept by hand twice. 181 went out on 22 September; 22 more had arrived
 * in user-facing copy within five days. A rule nobody can see being broken is
 * a rule that gets broken.
 *
 * `lib/spine/guardrails.ts` already holds the matcher and already flags
 * `em_dash` by default. It only ever runs against a *brand's* copy, from the
 * Messaging screen and OutboundCheck, so the product has been checking its
 * clients' writing and not its own. This is the same rule pointed inward.
 *
 * WHAT COUNTS
 *
 * Only strings and JSX text. Comments keep theirs, because the rule is about
 * what a reader sees and the comments in this codebase are long-form prose
 * written for whoever picks it up next. Model prompts do not count either:
 * nobody reads a system prompt, and rewriting one to dodge a punctuation rule
 * changes what the model is told for no gain to any person.
 *
 * WHERE IT RUNS
 *
 * The pre-push hook, not `prebuild`. `npm run sitemap` was in prebuild once
 * and a missing devDependency on the builder killed every deployment for
 * hours with no signal but a stale site. A check that can block a deploy has
 * to be one you can watch fail, so this one fails on your own machine before
 * the push leaves it. Install it with `npm run hooks`.
 */

import { readdirSync, statSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

/*
  The em dash only, never the en dash.

  `guardrails.ts` matches both, which is right for a brand's prose and wrong
  here. This codebase uses the en dash for two things that are correct
  typography and were never the complaint: the standalone empty-cell glyph
  ('–' where a table has no value, which the 22 September sweep broke in 24
  places), and ranges - "$800–1,200", "Jun 1 – Jun 30". The house rule in the
  rulebook and the handoff both say em dash, and that is what this enforces.
*/
const DASH = /—/;
const ROOTS = ['app', 'components', 'lib', 'scripts'];

/**
 * Lines that hold a dash on purpose.
 *
 * Kept as file plus a fragment of the line rather than a line number, so
 * moving code around does not silently re-arm or silently exempt something.
 * Every entry needs a reason; an exception nobody can justify is a rule with
 * a hole in it.
 */
const ALLOWED: Array<{ file: string; contains: string; why: string }> = [
  {
    file: 'components/spine/ui.tsx',
    contains: 'hideAtZero',
    why: 'The em dash IS the empty-cell glyph. This regex recognises it so a tile holding no value can be hidden; the 22 September sweep broke 24 placeholders by rewriting exactly this kind of line.',
  },
  {
    file: 'lib/spine/guardrails.ts',
    contains: 'test: /[—–]/g',
    why: 'The detector itself. It has to contain what it looks for.',
  },
  {
    file: 'scripts/em-dash-check.ts',
    contains: '',
    why: 'This file. Same reason.',
  },
  {
    file: 'app/api/enrich/route.ts',
    contains: 'title.split',
    why: 'Splits a fetched page title on whatever separator the site used. Matching a dash is the point; it is never shown.',
  },
  {
    file: 'app/api/stories/draft/route.ts',
    contains: 'p.attribution',
    why: 'Builds the block of context handed to the model when drafting a case study. Nobody reads it. The file also holds user-facing strings, so it cannot be exempted wholesale the way the extract routes are.',
  },
  {
    file: 'app/api/site-requests/approve/route.ts',
    contains: '| Site | ${opts.siteName}',
    why: 'A cell in the markdown table of a GitHub issue body. An engineering ticket, not product copy.',
  },
  {
    file: 'app/api/site-requests/approve/route.ts',
    contains: 'never push red',
    why: 'A build rule inside the same GitHub issue body. Written for whoever picks the ticket up; the house voice governs what clients and owners read, not what we put in a work ticket.',
  },
];

/**
 * Whole files whose strings are written for a model, not a person.
 *
 * A system prompt and a JSON-schema description are instructions to Haiku.
 * Nobody reads them, and bending one around a punctuation rule risks changing
 * what the model does to satisfy a style guide it cannot see.
 */
const MODEL_FACING = [
  'app/api/notes/extract/route.ts',
  'app/api/documents/extract/route.ts',
  'app/api/pricing/import/route.ts',
  'app/api/people/extract/route.ts',
];

interface Hit { file: string; line: number; kind: 'string' | 'jsx'; text: string }

/**
 * The ones that were already here.
 *
 * Roughly forty predate the check and each is a judgement call - a label
 * separator in `logos.ts` reads differently from a sentence in `signature.ts`
 * - so they are recorded rather than rewritten in a hurry. New ones fail;
 * these do not, until somebody decides about them one file at a time.
 *
 * Keyed on the file and the line's text, never the line number, so shifting
 * code up or down neither re-arms a known one nor quietly excuses a new one.
 * Run `npm run words:accept` after fixing a batch to shrink the list.
 */
const BASELINE_FILE = 'scripts/em-dash-baseline.json';
const key = (h: Hit) => `${h.file}\u0000${h.text}`;

/**
 * Where each character sits: code, a comment, or inside a quoted string.
 *
 * Written as a scanner rather than a regex because the question "is this dash
 * inside a string" cannot be answered by looking at the line. A `/* *\/` block
 * spans lines, and a grep for quotes counts the apostrophe in "don't" as one.
 * Template literals nest `${...}`, which is code again, so a dash inside an
 * interpolation is not copy.
 */
function scan(path: string, src: string): Hit[] {
  const hits: Hit[] = [];
  const lines = src.split('\n');
  let inBlock = false;

  for (let n = 0; n < lines.length; n++) {
    const line = lines[n];
    let i = 0;
    let state: 'code' | 'block' | 'str' = inBlock ? 'block' : 'code';
    let quote = '';
    /* Depth of ${ } inside a template literal. Above zero we are in code. */
    let interp = 0;

    while (i < line.length) {
      const c = line[i];
      const two = line.slice(i, i + 2);

      if (state === 'block') {
        if (two === '*/') { state = 'code'; inBlock = false; i += 2; continue; }
        i++; continue;
      }
      if (state === 'str') {
        if (c === '\\') { i += 2; continue; }
        if (quote === '`' && two === '${') { interp++; state = 'code'; i += 2; continue; }
        if (c === quote) { state = 'code'; quote = ''; i++; continue; }
        if (DASH.test(c)) hits.push({ file: path, line: n + 1, kind: 'string', text: line.trim() });
        i++; continue;
      }

      /* state === 'code' */
      if (two === '/*') { state = 'block'; inBlock = true; i += 2; continue; }
      /* A line comment runs to the end of the line, so there is nothing
         left on it that a reader could see. */
      if (two === '//') break;
      if (c === '}' && interp > 0) { interp--; state = 'str'; quote = '`'; i++; continue; }
      if (c === '"' || c === "'" || c === '`') { state = 'str'; quote = c; i++; continue; }
      /* A bare dash in code is JSX text: nothing else puts one there. */
      if (DASH.test(c)) hits.push({ file: path, line: n + 1, kind: 'jsx', text: line.trim() });
      i++;
    }
  }
  return hits;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.next') continue;
    const fp = join(dir, e);
    if (statSync(fp).isDirectory()) walk(fp, out);
    else if (/\.tsx?$/.test(e)) out.push(fp);
  }
  return out;
}

const allowed = (h: Hit) =>
  ALLOWED.some((a) => a.file === h.file && (a.contains === '' || h.text.includes(a.contains)));

const baseline: string[] = existsSync(BASELINE_FILE)
  ? (JSON.parse(readFileSync(BASELINE_FILE, 'utf8')) as { known: string[] }).known
  : [];

const hits: Hit[] = [];
for (const root of ROOTS) {
  for (const file of walk(root)) {
    if (MODEL_FACING.includes(file)) continue;
    const src = readFileSync(file, 'utf8');
    if (!DASH.test(src)) continue;
    for (const h of scan(file, src)) if (!allowed(h)) hits.push(h);
  }
}

if (process.argv.includes('--accept')) {
  const known = [...new Set(hits.map(key))].sort();
  writeFileSync(BASELINE_FILE, `${JSON.stringify({ known }, null, 2)}\n`);
  console.log(`Recorded ${known.length} known em dashes in ${BASELINE_FILE}.`);
  process.exit(0);
}

const seen = new Set(baseline);
const fresh = hits.filter((h) => !seen.has(key(h)));

/* A baseline entry whose line no longer exists has been fixed. Say so, so
   the list shrinks instead of quietly protecting text that is already gone. */
const live = new Set(hits.map(key));
const stale = baseline.filter((k) => !live.has(k)).length;
if (stale > 0) {
  console.log(`${stale} known em dash${stale === 1 ? '' : 'es'} no longer there. Run: npm run words:accept`);
}

if (fresh.length === 0) {
  console.log(
    baseline.length > 0
      ? `Em dashes: no new ones. ${hits.length} known, listed in ${BASELINE_FILE}.`
      : 'Em dashes: none in text a person reads.'
  );
  process.exit(0);
}

console.log(`\nNew em dashes in text a person reads: ${fresh.length}\n`);
for (const h of fresh) {
  /* file:line first and unpadded, so an editor and a terminal can both jump
     to it by click. */
  console.log(`  ${h.file}:${h.line}  (${h.kind})`);
  const shown = h.text.length > 120 ? `${h.text.slice(0, 117)}...` : h.text;
  console.log(`    ${shown}`);
}
console.log(
  '\nUse a comma, a colon or a full stop. The rule is docs/ux-rulebook.md section 6.\n' +
  'Comments are exempt, and so are the model prompts in app/api/*/extract.\n' +
  'Something genuinely needs one? Add it to ALLOWED in scripts/em-dash-check.ts with a reason.\n'
);
process.exit(1);
