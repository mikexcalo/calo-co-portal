import { readFileSync } from 'fs';
import { navFor, MODULE_TAB_PARENT, MODULE_LABEL, MODULE_HREF } from '../lib/spine/modules';

const org = { id: 'x', name: 'CALO&CO', slug: 'calo', kind: 'agency', plan: 'agency',
  modules: {}, settings: {}, payment_methods: [], default_labor_rate: 0,
  default_material_markup_pct: 0, tax_rate: 0, onboarded_at: null, billing_style: null } as never;
const vocab = { jobPlural: 'Engagements', customerPlural: 'Clients', estimate: 'Proposal' };

const groups = navFor(org, vocab);
const rows: { label: string; href: string }[] = [];
console.log('SIDEBAR');
for (const g of groups) {
  console.log(`  ${g.heading ?? '(top)'}`);
  for (const i of g.items) { console.log(`     ${i.label.padEnd(20)} ${i.href}`); rows.push(i); }
}

const src = readFileSync('components/spine/ui.tsx', 'utf8');
const strips: Record<string, { label: string; href: string }[]> = {};
for (const m of src.matchAll(/export const (\w+_TABS)[^=]*=\s*\[([\s\S]*?)\n\];/g)) {
  strips[m[1]] = [...m[2].matchAll(/label: '([^']+)', href: '([^']+)'/g)].map((t) => ({ label: t[1], href: t[2] }));
}
console.log('\nTAB STRIPS');
const fams = new Map<string, string[]>();
for (const [name, tabs] of Object.entries(strips)) {
  console.log(`  ${name.replace('_TABS','').padEnd(9)} ${tabs.map((t) => t.label).join(' · ')}`);
  for (const t of tabs) fams.set(t.href, [...(fams.get(t.href) ?? []), name]);
}

console.log('\nPROBLEMS');
let bad = 0;
const parents = new Set<string>([
  ...Object.values(MODULE_TAB_PARENT).map((p) => MODULE_HREF[p as never]),
  // A family's own page legitimately heads its strip.
  ...Object.values(strips).map((ts) => ts[0]?.href).filter(Boolean),
]);
for (const r of rows) if (fams.has(r.href) && !parents.has(r.href)) { console.log(`  row AND tab      ${r.href}`); bad++; }
for (const [h, f] of fams) if (f.length > 1) { console.log(`  two families     ${h}  ${f.join(', ')}`); bad++; }
for (const [id, parent] of Object.entries(MODULE_TAB_PARENT)) {
  const href = MODULE_HREF[id as never];
  if (!fams.has(href)) { console.log(`  tab of ${parent} but in no strip: ${id} ${href}`); bad++; }
  const t = Object.values(strips).flat().find((x) => x.href === href);
  if (t && t.label !== MODULE_LABEL[id as never]) { console.log(`  label mismatch   ${id}: sidebar "${MODULE_LABEL[id as never]}" vs tab "${t.label}"`); bad++; }
}

import { readdirSync, statSync } from 'fs';
import { join } from 'path';

/*
  A page that wears somebody else's tabs.

  Records is its own sidebar row and rendered the Settings strip — Settings,
  What you see, Security — so the strip on screen had no tab for the page you
  were standing on, and three of the four links left the section. Price list
  did the same thing from the other direction: it belongs to Money and wore
  Settings' tabs.

  The rule is simply that if a page shows a strip, it has to be in it.
*/
const stripOf: Record<string, string> = {};
(function walkTabs(dir: string) {
  for (const e of readdirSync(dir)) {
    const fp = join(dir, e);
    if (statSync(fp).isDirectory()) { walkTabs(fp); continue; }
    if (e !== 'page.tsx') continue;
    const m = readFileSync(fp, 'utf8').match(/tabs=\{(\w+_TABS)\}/);
    if (!m) continue;
    const r = '/' + dir.replace(/^app\/?/, '');
    stripOf[r === '/' ? '/' : r.replace(/\/$/, '')] = m[1];
  }
})('app');

for (const [route, strip] of Object.entries(stripOf)) {
  const tabs = strips[strip];
  if (!tabs) continue;
  if (!tabs.some((t) => t.href === route)) {
    console.log(`  wears ${strip} but is not in it: ${route}`);
    bad++;
  }
}

/*
  The row you clicked and the page you landed on have to say the same word.

  The sidebar said Drops and the page said Unfiled, which reads as having
  clicked the wrong thing.
*/
for (const r of rows) {
  const dir = r.href === '/' ? 'app' : 'app' + r.href;
  let title: string | null = null;
  try {
    const m = readFileSync(join(dir, 'page.tsx'), 'utf8').match(/\btitle=(?:"([^"]+)"|\{`([^`]+)`\}|\{([\w.]+)\})/);
    title = m ? (m[1] ?? m[2] ?? m[3]) : null;
  } catch { /* generated or dynamic */ }
  if (!title) continue;
  if (/[${]/.test(title) || /^vocab\./.test(title)) continue;   // computed from vocabulary
  title = title.replace(/&amp;/g, '&').replace(/&apos;/g, "'");
  if (title !== r.label) { console.log(`  row says "${r.label}", page says "${title}"   ${r.href}`); bad++; }
}

// ---- reachability: every screen must be a row, a tab, or reached from one ----
const pages: string[] = [];
(function walk(dir: string) {
  for (const e of readdirSync(dir)) {
    const f = join(dir, e);
    if (statSync(f).isDirectory()) walk(f);
    else if (e === 'page.tsx') {
      const r = '/' + dir.replace(/^app\/?/, '');
      pages.push(r === '/' ? '/' : r.replace(/\/$/, ''));
    }
  }
})('app');

const reachable = new Set<string>([...rows.map((r) => r.href), ...fams.keys(), '/']);
// Linked from inside another screen rather than from navigation.
const linkedFromCode = new Set<string>();
for (const f of ['app', 'components', 'lib']) {
  (function walk2(dir: string) {
    for (const e of readdirSync(dir)) {
      const fp = join(dir, e);
      if (statSync(fp).isDirectory()) walk2(fp);
      else if (/\.tsx?$/.test(e)) {
        for (const m of readFileSync(fp, 'utf8').matchAll(/["'`](\/[a-z0-9\-\/]*)["'`]/g)) linkedFromCode.add(m[1]);
      }
    }
  })(f);
}

const orphans = pages.filter((r) => {
  if (reachable.has(r)) return false;
  if (r.includes('[')) return false;               // detail pages, reached from their list
  if (/^\/(login|reset|welcome|trust|whats-new|what-you-see|access|preview)/.test(r)) return false; // entered directly, or arrived at from an email
  return !linkedFromCode.has(r);
});
if (orphans.length) { console.log('\nUNREACHABLE SCREENS'); orphans.forEach((o) => console.log('  ' + o)); bad += orphans.length; }

console.log(bad ? `\n${bad} problems` : '\n  none');
if (bad) process.exit(1);
