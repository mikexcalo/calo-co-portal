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
  | 'business';

const CONTRACTOR: ModuleId[] = [
  'jobs',
  'customers',
  'documents',
  'billing',
  'pl',
  'website',
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
