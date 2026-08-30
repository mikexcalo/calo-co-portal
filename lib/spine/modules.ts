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
  'proposals',
  'billing',
  'pl',
  'expenses',
  'pricing',
  'records',
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
  const groups: NavGroup[] = [
    {
      // The sidebar should hold what gets touched most. A contractor
      // photographs receipts daily, so Receipts belongs up here for them; an
      // agency files a handful a month, so it sits in Library instead.
      heading: 'The Work',
      items: [
        { id: 'jobs', label: vocab.jobPlural, href: '/jobs', icon: 'yardSign' },
        { id: 'customers', label: vocab.customerPlural, href: '/customers', icon: 'clients' },
        // Receipts sits here for every kind of business. Splitting it by org
        // kind left agencies with a single row under a heading of its own,
        // which is the exact furniture the last pass set out to remove.
        { id: 'receipts', label: 'Receipts', href: '/documents', icon: 'quotes' },
        { id: 'notes', label: 'Notes', href: '/notes', icon: 'proposal' },
        // Library lived under a heading called "Library", which is a label
        // introducing itself. Price lists, records and brand assets are
        // reference material for doing the work, so they belong with it.
        ...(has('pricing') || has('records') || has('brand_kit')
          ? [{
              id: (has('pricing') ? 'pricing' : has('records') ? 'records' : 'brand_kit') as ModuleId,
              label: 'Library',
              href: has('pricing') ? '/pricing' : has('records') ? '/records' : '/brand-kit',
              icon: 'folder',
            }]
          : []),
      ].filter((i) => has(i.id as ModuleId)) as NavGroup['items'],
    },
    {
      heading: 'Money',
      items: [
        // One thing, one name. This was "Proposals" in the sidebar and
        // "Estimate" on the job screen — two words for the same object, in a
        // product where the object is what someone owes you money for.
        { id: 'proposals', label: `${vocab.estimate}s`, href: '/proposals', icon: 'proposal' },
        { id: 'billing', label: 'Billing', href: '/billing', icon: 'invoices' },
        { id: 'pl', label: 'Profit & Loss', href: '/pl', icon: 'chart' },
        // Overheads are money out that no job caused. Without somewhere to put
        // them, Profit & Loss shows what the work earned and none of what it
        // costs to be open.
        { id: 'expenses', label: 'Overheads', href: '/expenses', icon: 'wallet' },
        // What you owe your agency is money, not a website thing. It sat
        // under "Your Website" because that is who it comes from, which is
        // not how anyone looks for a bill.
        { id: 'account', label: 'Bills to You', href: '/account', icon: 'proposal' },
      ].filter((i) => has(i.id as ModuleId)) as NavGroup['items'],
    },
    {
      // A heading over a single row is furniture. "Your Website" says what the
      // destination is; "Request a Change" described the form inside it, which
      // is not how anyone looks for their own website.
      heading: org?.kind === 'agency' ? 'Clients' : '',
      items: [
        // Under a heading that already says Clients, the word was doing the
        // job twice.
        { id: 'client_requests', label: 'Requests', href: '/requests', icon: 'designStudio' },
        { id: 'website', label: 'Your Website', href: '/website', icon: 'designStudio' },
      ].filter((i) => has(i.id as ModuleId)) as NavGroup['items'],
    },
    {
      heading: 'Setup',
      defaultOpen: false,
      items: [
        { id: 'business', label: 'Business', href: '/business', icon: 'storefront' },
        { id: 'team', label: 'Team', href: '/team', icon: 'clients' },
        // Visible rather than buried in Business. Nobody goes looking for
        // two-factor; they have to trip over it to turn it on.
        { id: 'security', label: 'Security', href: '/security', icon: 'shield' },
      ].filter((i) => has(i.id as ModuleId)) as NavGroup['items'],
    },
  ];

  return groups.filter((g) => g.items.length > 0);
}
