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
  | 'brands'
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
  'brands',
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
  ['/brands', 'brands'],
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
   * Named rows, grouped, foldable. Nothing hidden behind a tab that isn't a
   * different view of the same thing.
   *
   * This is the third arrangement, and the two failures either side of it are
   * worth recording because they are opposite mistakes with the same cause.
   *
   * Fifteen flat rows was a table of contents: everything visible, nothing
   * prominent, so people learned three positions and the rest went unread.
   *
   * Seven rows with everything folded into tabs was worse. It looked tidy and
   * made the product unusable, because a tab is invisible until you are
   * already on the page that holds it. You cannot look for Receipts if
   * nothing on screen says the word.
   *
   * THE RULE THAT SETTLED IT: tabs are for alternate views of the same
   * thing. Rows are for different tasks. Price List and Records are both
   * "look something up", so they share a row. Estimates and Invoices are
   * quoting and billing — two different jobs on two different days — so they
   * get their own rows and their own names.
   *
   * Length is handled by folding a section you don't use, not by hiding
   * things you might.
   */
  const groups: NavGroup[] = [
    {
      heading: 'The Work',
      items: [
        { id: 'jobs', label: vocab.jobPlural, href: '/jobs', icon: 'yardSign' },
        { id: 'customers', label: vocab.customerPlural, href: '/customers', icon: 'clients' },
        { id: 'receipts', label: 'Receipts', href: '/documents', icon: 'quotes' },
        { id: 'notes', label: 'Notes', href: '/notes', icon: 'notes' },
        ...(has('pricing') || has('records')
          ? [{
              id: (has('pricing') ? 'pricing' : 'records') as ModuleId,
              label: 'Library',
              href: has('pricing') ? '/pricing' : '/records',
              icon: 'folder',
            }]
          : []),
      ].filter((i) => has(i.id as ModuleId)) as NavGroup['items'],
    },
    {
      heading: 'Money',
      items: [
        { id: 'proposals', label: `${vocab.estimate}s`, href: '/proposals', icon: 'proposal' },
        { id: 'billing', label: 'Invoices', href: '/billing', icon: 'invoices' },
        { id: 'expenses', label: 'Overheads', href: '/expenses', icon: 'wallet' },
        { id: 'pl', label: 'Profit & Loss', href: '/pl', icon: 'chart' },
        { id: 'account', label: 'Bills to You', href: '/account', icon: 'incoming' },
      ].filter((i) => has(i.id as ModuleId)) as NavGroup['items'],
    },
    {
      heading: 'Grow',
      // Folded by default. Winning work matters, but not every day, and this
      // is the section somebody can lose without losing the product.
      defaultOpen: false,
      items: [
        { id: 'pitches', label: 'Pitches', href: '/pitches', icon: 'megaphone' },
        { id: 'brand_kit', label: 'Brand Kit', href: '/brand-kit', icon: 'brandKit' },
        // Client identities, which only an agency holds.
        { id: 'brands', label: 'Brands', href: '/brands', icon: 'palette' },
        { id: 'client_requests', label: 'Requests', href: '/requests', icon: 'inbox' },
        { id: 'website', label: 'Your Website', href: '/website', icon: 'designStudio' },
      ].filter((i) => has(i.id as ModuleId)) as NavGroup['items'],
    },
  ];

  return groups.filter((g) => g.items.length > 0);
}
