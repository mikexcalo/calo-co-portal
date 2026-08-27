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

  const groups: NavGroup[] = [
    {
      // Doing the work. Receipts sits here because photographing one is an
      // action you take on site, not something you look up.
      heading: 'The Work',
      items: [
        { id: 'jobs', label: vocab.jobPlural, href: '/jobs', icon: 'yardSign' },
        { id: 'customers', label: vocab.customerPlural, href: '/customers', icon: 'clients' },
        { id: 'receipts', label: 'Receipts', href: '/documents', icon: 'quotes' },
      ].filter((i) => has(i.id as ModuleId)) as NavGroup['items'],
    },
    {
      // The money, in the order it moves: quote it, bill it, see what's left.
      heading: 'Money',
      items: [
        { id: 'proposals', label: 'Proposals', href: '/proposals', icon: 'proposal' },
        { id: 'billing', label: 'Billing', href: '/billing', icon: 'invoices' },
        { id: 'pl', label: 'Profit & Loss', href: '/pl', icon: 'chart' },
      ].filter((i) => has(i.id as ModuleId)) as NavGroup['items'],
    },
    {
      // Things you consult rather than work through.
      heading: 'Reference',
      items: [
        { id: 'pricing', label: 'Price List', href: '/pricing', icon: 'financials' },
        { id: 'records', label: 'Records', href: '/records', icon: 'folder' },
        { id: 'brand_kit', label: 'Brand Kit', href: '/brand-kit', icon: 'brandKit' },
      ].filter((i) => has(i.id as ModuleId)) as NavGroup['items'],
    },
    {
      heading: org?.kind === 'agency' ? 'Clients' : 'Your Website',
      items: [
        { id: 'client_requests', label: 'Client Requests', href: '/requests', icon: 'designStudio' },
        { id: 'website', label: 'Request a Change', href: '/website', icon: 'designStudio' },
        { id: 'account', label: 'Your Account', href: '/account', icon: 'invoices' },
      ].filter((i) => has(i.id as ModuleId)) as NavGroup['items'],
    },
    {
      heading: 'Setup',
      items: [
        { id: 'business', label: 'Business', href: '/business', icon: 'settings' },
        { id: 'team', label: 'Team', href: '/team', icon: 'clients' },
      ].filter((i) => has(i.id as ModuleId)) as NavGroup['items'],
    },
  ];

  return groups.filter((g) => g.items.length > 0);
}
