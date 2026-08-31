/**
 * Which modules a business sees.
 *
 * The first cut showed every business every module, which made Mammoth's
 * portal look like Mammoth runs a web agency. Mammoth pours concrete. What a
 * contractor needs is the work — jobs, receipts, invoices, whether the month
 * made money — plus a way to ask their agency for a website change.
 *
 * Defaults come from the business kind. `orgs.modules` overrides them, so
 * turning something on for one client later is a flag, not a deploy.
 */

import type { Org } from './types';

export type ModuleId =
  | 'jobs'
  | 'customers'
  | 'receipts'
  | 'notes'
  | 'pitches'
  | 'billing'
  | 'pl'
  | 'website'        // client-facing: ask my agency for a site change
  | 'client_requests' // agency-facing: the inbox of client requests
  | 'brand_kit'
  | 'account'        // client-facing: what I owe my agency
  | 'pricing'
  | 'records'
  | 'proposals'
  | 'team'
  | 'expenses'
  | 'security'
  | 'business';

const CONTRACTOR: ModuleId[] = [
  'jobs',
  'customers',
  'receipts',
  'notes',
  'pitches',
  'proposals',
  'billing',
  'pl',
  'expenses',
  'pricing',
  'records',
  'brand_kit',
  'website',
  // 'account' — deliberately NOT here. "Bills to You" is what you owe the
  // agency that set your workspace up, which is true of Mammoth and false of
  // an artist or a builder who came to this on their own. A permanently empty
  // nav row teaches people the app is full of things that do nothing. Turned
  // on per business via orgs.modules where it is actually true.
  'team',
  'security',
  'business',
];

const AGENCY: ModuleId[] = [
  'jobs',
  'customers',
  'receipts',
  'notes',
  'pitches',
  'proposals',
  'billing',
  'pl',
  'expenses',
  'pricing',
  'records',
  'brand_kit',
  'client_requests',
  'team',
  'security',
  'business',
];

export function modulesFor(org: Org | null): Set<ModuleId> {
  if (!org) return new Set();

  const base = org.kind === 'agency' ? AGENCY : CONTRACTOR;
  const overrides = (org.modules ?? {}) as Partial<Record<ModuleId, boolean>>;

  const out = new Set<ModuleId>(base);
  for (const [id, enabled] of Object.entries(overrides)) {
    if (enabled) out.add(id as ModuleId);
    else out.delete(id as ModuleId);
  }
  return out;
}

/**
 * Which route belongs to which module. Used to catch the case where you're
 * looking at a page, switch to a business that doesn't have it, and end up
 * stranded on a screen that isn't in their nav.
 */
const ROUTE_MODULE: Array<[string, ModuleId]> = [
  ['/jobs', 'jobs'],
  ['/customers', 'customers'],
  ['/documents', 'receipts'],
  ['/notes', 'notes'],
  ['/pitches', 'pitches'],
  ['/billing', 'billing'],
  ['/pl', 'pl'],
  ['/expenses', 'expenses'],
  ['/website', 'website'],
  ['/requests', 'client_requests'],
  ['/brand-kit', 'brand_kit'],
  ['/business', 'business'],
  ['/team', 'team'],
  ['/pricing', 'pricing'],
  ['/records', 'records'],
  ['/proposals', 'proposals'],
  ['/account', 'account'],
];

/**
 * Routes every business can reach regardless of modules.
 *
 * /security belongs here rather than in ROUTE_MODULE: it protects the person,
 * not the business, and switching to a business that happened to have the
 * module turned off should never be able to strand someone halfway through
 * setting up two-factor.
 */
const ALWAYS = ['/', '/login', '/welcome', '/security', '/trust'];

/**
 * Is this path reachable for this business? Returns false only for a route
 * that maps to a module the business doesn't have.
 */
export function pathAllowed(org: Org | null, pathname: string): boolean {
  if (ALWAYS.includes(pathname)) return true;

  const entry = ROUTE_MODULE.find(
    ([prefix]) => pathname === prefix || pathname.startsWith(prefix + '/')
  );
  if (!entry) return true; // unmapped routes aren't gated

  return modulesFor(org).has(entry[1]);
}

/** Nav grouping. Order and headings come from here so the sidebar reads. */
export interface NavGroup {
  heading: string;
  items: Array<{ id: ModuleId; label: string; href: string; icon: string }>;
  /**
   * Whether the group starts open.
   *
   * Setup starts closed. It is a handful of screens you visit twice in the
   * first week and then rarely again, and keeping it permanently expanded
   * spends five rows of a fourteen-row sidebar on the least-used part of the
   * product.
   */
  defaultOpen?: boolean;
}

export function navFor(
  org: Org | null,
  vocab: { jobPlural: string; customerPlural: string; estimate: string }
): NavGroup[] {
  const on = modulesFor(org);
  const has = (id: ModuleId) => on.has(id);

  // Every destination visible. The previous attempt hid these behind section
  // tabs and cut the sidebar from thirteen items to six — which looked tidier
  // and made Brand Kit impossible to find. A list you can scan beats a short
  // list that hides things; the fix for "too long" is grouping, not hiding.
  /**
   * Four groups, named for what you are trying to do rather than for what the
   * screens are.
   *
   * The previous shape had problems that only show up once the list is long.
   * "Clients" was a heading AND a row inside a different heading, so the word
   * meant two things on one screen. Receipts sat with the daily work when it
   * is really a cost that becomes a line on an invoice. Brand Kit was filed
   * under reference material when it is the opposite: the thing you reach for
   * when you are trying to win something.
   *
   * The grouping now follows the four jobs a small business actually does in
   * a day, which is also the order they happen in.
   */
  /**
   * Seven rows, no headings.
   *
   * Fifteen rows across four headings was a table of contents, not a
   * navigation. Nobody reads a list that long — they learn two or three
   * positions by muscle memory and the rest becomes invisible, which is a
   * worse outcome than not building the screens at all.
   *
   * What changed and why:
   *
   * Money became one destination with tabs. Invoices, estimates, receipts,
   * overheads and profit are one subject seen from five angles, not five
   * subjects. Five rows made them look unrelated and pushed everything else
   * down the page.
   *
   * Grow became one destination the same way, for the same reason.
   *
   * Business, Team and Security left the sidebar entirely and live under the
   * avatar, where every other product puts them. You configure them twice in
   * the first week and then never again; three permanent rows for that is
   * three rows stolen from the work.
   *
   * No group headings. At seven items they were labelling the obvious and
   * costing four rows of vertical space, which matters most on the phone
   * where this gets used standing up.
   */
  const items: NavGroup['items'] = [
    { id: 'jobs', label: vocab.jobPlural, href: '/jobs', icon: 'yardSign' },
    { id: 'customers', label: vocab.customerPlural, href: '/customers', icon: 'clients' },
    { id: 'notes', label: 'Notes', href: '/notes', icon: 'proposal' },
    // Money lands on Invoices, the one people open unprompted.
    { id: 'billing', label: 'Money', href: '/billing', icon: 'invoices' },
    ...(has('pricing') || has('records')
      ? [{
          id: (has('pricing') ? 'pricing' : 'records') as ModuleId,
          label: 'Library',
          href: has('pricing') ? '/pricing' : '/records',
          icon: 'folder',
        }]
      : []),
    { id: 'pitches', label: 'Grow', href: '/pitches', icon: 'designStudio' },
    { id: 'account', label: 'Bills to You', href: '/account', icon: 'proposal' },
  ].filter((i) => has(i.id as ModuleId)) as NavGroup['items'];

  const groups: NavGroup[] = [{ heading: '', items }];

  return groups.filter((g) => g.items.length > 0);
}
