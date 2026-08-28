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
  | 'business';

const CONTRACTOR: ModuleId[] = [
  'jobs',
  'customers',
  'receipts',
  'proposals',
  'billing',
  'pl',
  'pricing',
  'records',
  'website',
  'account',
  'team',
  'business',
];

const AGENCY: ModuleId[] = [
  'jobs',
  'customers',
  'receipts',
  'proposals',
  'billing',
  'pl',
  'pricing',
  'records',
  'brand_kit',
  'client_requests',
  'team',
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
  ['/billing', 'billing'],
  ['/pl', 'pl'],
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

/** Routes every business can reach regardless of modules. */
const ALWAYS = ['/', '/settings', '/login', '/welcome'];

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
}

export function navFor(
  org: Org | null,
  vocab: { jobPlural: string; customerPlural: string }
): NavGroup[] {
  const on = modulesFor(org);
  const has = (id: ModuleId) => on.has(id);

  // One entry per SECTION, not per screen. Thirteen destinations across five
  // headings had stopped being navigation and become a list you re-read every
  // time. Related screens now sit behind tabs on the page they land on — see
  // components/spine/SectionTabs.tsx.
  //
  // The link points at the first tab the business actually has, so a
  // contractor without Brand Kit still lands somewhere real.
  const first = (ids: ModuleId[], hrefs: Record<string, string>) => {
    const found = ids.find((id) => has(id));
    return found ? hrefs[found] : null;
  };

  const moneyHref = first(
    ['proposals', 'billing', 'pl'],
    { proposals: '/proposals', billing: '/billing', pl: '/pl' }
  );
  const libraryHref = first(
    ['pricing', 'records', 'brand_kit'],
    { pricing: '/pricing', records: '/records', brand_kit: '/brand-kit' }
  );
  const setupHref = first(
    ['business', 'team'],
    { business: '/business', team: '/team' }
  );

  const groups: NavGroup[] = [
    {
      heading: 'The Work',
      items: [
        { id: 'jobs', label: vocab.jobPlural, href: '/jobs', icon: 'yardSign' },
        { id: 'customers', label: vocab.customerPlural, href: '/customers', icon: 'clients' },
        { id: 'receipts', label: 'Receipts', href: '/documents', icon: 'quotes' },
      ].filter((i) => has(i.id as ModuleId)) as NavGroup['items'],
    },
    {
      heading: '',
      items: [
        ...(moneyHref
          ? [{ id: 'billing' as ModuleId, label: 'Money', href: moneyHref, icon: 'invoices' }]
          : []),
        ...(libraryHref
          ? [{ id: 'pricing' as ModuleId, label: 'Library', href: libraryHref, icon: 'folder' }]
          : []),
      ] as NavGroup['items'],
    },
    {
      heading: org?.kind === 'agency' ? 'Clients' : 'Your Website',
      items: [
        { id: 'client_requests', label: 'Client Requests', href: '/requests', icon: 'designStudio' },
        { id: 'website', label: 'Request a Change', href: '/website', icon: 'designStudio' },
        { id: 'account', label: 'Your Account', href: '/account', icon: 'proposal' },
      ].filter((i) => has(i.id as ModuleId)) as NavGroup['items'],
    },
    {
      heading: '',
      items: (setupHref
        ? [{ id: 'business' as ModuleId, label: 'Setup', href: setupHref, icon: 'settings' }]
        : []) as NavGroup['items'],
    },
  ];

  return groups.filter((g) => g.items.length > 0);
}
