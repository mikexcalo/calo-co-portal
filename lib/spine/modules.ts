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
  | 'documents'
  | 'billing'
  | 'pl'
  | 'website'        // client-facing: ask my agency for a site change
  | 'client_requests' // agency-facing: the inbox of client requests
  | 'brand_kit'
  | 'account'        // client-facing: what I owe my agency
  | 'business';

const CONTRACTOR: ModuleId[] = [
  'jobs',
  'customers',
  'documents',
  'billing',
  'pl',
  'website',
  'account',
  'business',
];

const AGENCY: ModuleId[] = [
  'jobs',
  'customers',
  'documents',
  'billing',
  'pl',
  'client_requests',
  'brand_kit',
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
  ['/documents', 'documents'],
  ['/billing', 'billing'],
  ['/pl', 'pl'],
  ['/website', 'website'],
  ['/requests', 'client_requests'],
  ['/brand-kit', 'brand_kit'],
  ['/business', 'business'],
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

  const groups: NavGroup[] = [
    {
      heading: 'The work',
      items: [
        { id: 'jobs', label: vocab.jobPlural, href: '/jobs', icon: 'yardSign' },
        { id: 'customers', label: vocab.customerPlural, href: '/customers', icon: 'clients' },
        { id: 'documents', label: 'Documents', href: '/documents', icon: 'quotes' },
      ].filter((i) => has(i.id as ModuleId)) as NavGroup['items'],
    },
    {
      heading: 'Money',
      items: [
        { id: 'billing', label: 'Billing', href: '/billing', icon: 'invoices' },
        { id: 'pl', label: 'Profit & Loss', href: '/pl', icon: 'financials' },
      ].filter((i) => has(i.id as ModuleId)) as NavGroup['items'],
    },
    {
      // Named for what it is from each side: a client asks, an agency answers.
      heading: org?.kind === 'agency' ? 'Clients' : 'Your website',
      items: [
        { id: 'client_requests', label: 'Client requests', href: '/requests', icon: 'designStudio' },
        { id: 'website', label: 'Request a change', href: '/website', icon: 'designStudio' },
        { id: 'account', label: 'Your account', href: '/account', icon: 'invoices' },
        { id: 'brand_kit', label: 'Brand Kit', href: '/brand-kit', icon: 'brandKit' },
      ].filter((i) => has(i.id as ModuleId)) as NavGroup['items'],
    },
    {
      heading: 'Setup',
      items: [
        { id: 'business', label: 'Business', href: '/business', icon: 'settings' },
      ].filter((i) => has(i.id as ModuleId)) as NavGroup['items'],
    },
  ];

  return groups.filter((g) => g.items.length > 0);
}
