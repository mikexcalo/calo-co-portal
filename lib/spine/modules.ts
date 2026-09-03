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
  | 'stories'
  | 'ask'
  | 'reviews'
  | 'seo'
  | 'targets'
  | 'account'        // client-facing: what I owe my agency
  | 'pricing'
  | 'records'
  | 'proposals'
  | 'people'         // the address book: everybody, not only clients
  | 'traffic'        // who arrived at their site, and how far they got
  | 'team'
  | 'expenses'
  | 'security'
  | 'business';

const CONTRACTOR: ModuleId[] = [
  'ask',
  'reviews',
  'seo',
  'traffic',
  'jobs',
  'customers',
  'people',
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
  'ask',
  'reviews',
  'seo',
  'traffic',
  'targets',
  'jobs',
  'customers',
  'people',
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
  'stories',
  'client_requests',
  'team',
  'security',
  'business',
];

/**
 * What each plan includes, on top of the business kind.
 *
 * Core is the spine: record the work, get paid, know whether the month made
 * money. Everything in it costs nothing per customer to run, which is why it
 * can be generous. Grow is the machinery that goes looking for work, and it is
 * where the value tracks the size of the business rather than the software.
 *
 * A module missing from a plan is still reachable by flipping orgs.modules,
 * which is deliberate: setting something up for a client before they pay for
 * it should not require a deployment.
 */
const PLAN_MODULES: Record<string, ModuleId[]> = {
  core: [
    'jobs', 'customers', 'people', 'receipts', 'notes', 'billing', 'pl', 'expenses',
    'records', 'business', 'security', 'reviews',
  ],
  grow: [
    'jobs', 'customers', 'people', 'receipts', 'notes', 'billing', 'pl', 'expenses',
    'records', 'business', 'security', 'reviews',
    'seo', 'ask', 'pricing', 'client_requests', 'team', 'website', 'targets',
    'traffic',
  ],
  // The agency plan is this product's own workspace and gets everything its
  // kind allows. Gating yourself is a way to forget a feature exists.
  agency: [],
};

/**
 * Capabilities that are not navigation.
 *
 * Optional line items live inside the estimate screen and the intake form is a
 * public page, so neither has a sidebar row to hide. They still belong to a
 * plan, so they are named here rather than being quietly available to
 * everybody because nobody thought about where to put the check.
 */
export type Feature = 'optional_lines' | 'intake_form' | 'follow_ups' | 'ask';

const PLAN_FEATURES: Record<string, Feature[]> = {
  core: [],
  grow: ['optional_lines', 'intake_form', 'follow_ups', 'ask'],
  agency: ['optional_lines', 'intake_form', 'follow_ups', 'ask'],
};

/** Human names for every module, so a switchboard is readable. */
export const MODULE_LABEL: Record<ModuleId, string> = {
  jobs: 'Jobs and engagements',
  customers: 'Clients',
  people: 'People',
  traffic: 'Website traffic',
  receipts: 'Receipts',
  notes: 'Capture',
  pitches: 'Pitches',
  proposals: 'Proposals',
  billing: 'Invoices',
  pl: 'Profit and loss',
  expenses: 'Overheads',
  pricing: 'Price book',
  records: 'Records',
  brand_kit: 'Brand kit',
  brands: 'Brand framework',
  stories: 'Case studies',
  ask: 'Ask',
  reviews: 'Reviews',
  seo: 'Digital presence',
  targets: 'Pipeline',
  client_requests: 'Requests',
  website: 'Website',
  team: 'Team',
  security: 'Security',
  business: 'Business settings',
  account: 'Bills to you',
};

export function planAllows(org: Org | null, feature: Feature): boolean {
  if (!org) return false;
  const overrides = (org.modules ?? {}) as Record<string, boolean>;
  // An explicit flag wins, so a feature can be handed to one client early.
  if (typeof overrides[feature] === 'boolean') return overrides[feature];
  return (PLAN_FEATURES[org.plan ?? 'core'] ?? []).includes(feature);
}

export function modulesFor(org: Org | null): Set<ModuleId> {
  if (!org) return new Set();

  const kindBase = org.kind === 'agency' ? AGENCY : CONTRACTOR;

  /**
   * The plan narrows what the kind allows; it never widens it.
   *
   * A contractor on the grow plan does not get Brand Framework, because that
   * is not a thing contractors do. Plan and kind answer different questions:
   * one is what they paid for, the other is what would make sense to them.
   */
  const allowed = PLAN_MODULES[org.plan ?? 'core'];
  const base = allowed?.length ? kindBase.filter((m) => allowed.includes(m)) : kindBase;
  const overrides = (org.modules ?? {}) as Record<string, unknown>;

  const out = new Set<ModuleId>(base);
  for (const [id, raw] of Object.entries(overrides)) {
    const st = moduleState(raw);
    // Only `live` grants access. `sold` and `building` are commercial facts
    // about work in progress, and treating them as access is how a client gets
    // shown a half-built screen they have already paid for.
    if (st === 'live') out.add(id as ModuleId);
    else if (st !== 'plan') out.delete(id as ModuleId);
  }
  return out;
}

/**
 * What a module is to a particular client.
 *
 * Five states, because two of them are commercial rather than technical:
 *
 *   plan      follow the plan. Not a decision, an absence of one.
 *   sold      they have agreed to pay for it. Nothing built yet.
 *   building  being built. Still invisible to them.
 *   live      switched on. They can see it.
 *   off       deliberately denied, and stays denied through an upgrade.
 *
 * `sold` and `building` exist because the module is the product being sold.
 * Without them the only way to record "Mammoth is paying me to build their
 * traffic dashboard" is to switch it on early, which shows them an empty
 * screen and makes the thing they bought look broken.
 *
 * Legacy booleans are read as live and off, so nothing written before this
 * has to be migrated in the browser.
 */
export type ModuleState = 'plan' | 'sold' | 'building' | 'live' | 'off';

export function moduleState(raw: unknown): ModuleState {
  if (raw === true) return 'live';
  if (raw === false) return 'off';
  if (raw === 'sold' || raw === 'building' || raw === 'live' || raw === 'off') return raw;
  return 'plan';
}

/** In the order somebody clicks through them while selling the thing. */
export const MODULE_STATES: { id: ModuleState; label: string; note: string }[] = [
  { id: 'plan', label: 'Follows plan', note: 'No decision made. Their plan decides.' },
  { id: 'sold', label: 'Sold', note: 'They have agreed to pay. Nothing built yet.' },
  { id: 'building', label: 'Building', note: 'Being built. They cannot see it.' },
  { id: 'live', label: 'Live', note: 'Switched on. They can see it.' },
  { id: 'off', label: 'Off', note: 'Denied, and stays denied through an upgrade.' },
];

/**
 * Which route belongs to which module. Used to catch the case where you're
 * looking at a page, switch to a business that doesn't have it, and end up
 * stranded on a screen that isn't in their nav.
 */
const ROUTE_MODULE: Array<[string, ModuleId]> = [
  ['/jobs', 'jobs'],
  ['/customers', 'customers'],
  ['/people', 'people'],
  ['/access', 'customers'],
  ['/documents', 'receipts'],
  ['/notes', 'notes'],
  ['/pitches', 'pitches'],
  ['/billing', 'billing'],
  ['/pl', 'pl'],
  ['/expenses', 'expenses'],
  ['/website', 'website'],
  ['/traffic', 'traffic'],
  ['/digital', 'seo'],
  ['/requests', 'client_requests'],
  ['/brand-kit', 'brand_kit'],
  ['/ask', 'ask'],
  ['/reviews', 'reviews'],
  ['/seo', 'seo'],
  ['/targets', 'targets'],
  ['/framework', 'brands'],
  ['/stories', 'stories'],
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
 * /brands is deliberately not in the sidebar. Every brand belongs to a client,
 * so the door is on the client record. The wall view of every brand at once
 * earns its own row at ten clients and not at two, and this keeps it built and
 * reachable until then. See docs/decisions.md.
 *
 * /security belongs here rather than in ROUTE_MODULE: it protects the person,
 * not the business, and switching to a business that happened to have the
 * module turned off should never be able to strand someone halfway through
 * setting up two-factor.
 */
/**
 * /workspaces is reachable, not listed. It is the agency's own switchboard,
 * and the row level policy already limits it to workspaces you belong to, so
 * a client following the URL sees only their own.
 */
/**
 * Reachable without a sidebar row.
 *
 * Targets and Search are opened from a client, price list and records from
 * Business. A route being unlisted is not a route being hidden: it means the
 * place you reach it from is somewhere that already knows what you are doing.
 */
const ALWAYS = [
  '/', '/login', '/welcome', '/security', '/trust', '/brands', '/ask', '/whats-new',
  '/targets', '/seo', '/pricing', '/records', '/requests',
  '/notes', '/pitches', '/stories', '/brand-kit', '/website', '/expenses', '/documents',
];

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
  /** Absent for the top group, which is one row and needs no label over it. */
  heading?: string;
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
  /**
   * Short on purpose.
   *
   * The sidebar had grown to five groups and twenty rows, which is a list you
   * scroll rather than scan, and scrolling a navigation is the point at which
   * people stop using anything below the fold.
   *
   * Two things let it shrink. The command bar indexes everything and is one
   * keystroke away, so the sidebar no longer has to be a map of every
   * capability. And the client record became the hub, so most client work is
   * reached by opening the client rather than by finding the feature.
   *
   * What stays here is what you open without knowing which client it concerns:
   * the day, the people, the money, and the few lists you work down.
   */
  /**
   * One test decides whether something gets a row.
   *
   * Do you open it to find something out, or did you open it once so that
   * something else would work? A price list is the second kind: you write it
   * and from then on it feeds estimates. Records, receipts and your own rates
   * are the same. Each of those had a row, which put the tax number typed in
   * March at the same level as who owes you money.
   *
   * The second test is whose it is. Targets and Search are per client now, and
   * a hundred and four seafood distributors are John's list, not yours. They
   * belong on his record, reached by opening him, not by finding a feature in
   * a sidebar that never mentions him.
   *
   * What survives is what you open without already knowing which client it
   * concerns.
   */
  /**
   * Nine rows, and every one of them is a place you go rather than a thing you
   * file.
   *
   * The vocabulary was nineteen nouns for three clients, accumulated one
   * defensible addition at a time. Nobody chose nineteen. What came out was not
   * deleted, it was merged into the thing it belongs to:
   *
   *   Profit and loss holds overheads and receipts, because those are its
   *   inputs and neither is somewhere you go.
   *
   *   Brand holds the framework, case studies, the kit and the website, which
   *   were four rows describing four views of one job.
   *
   *   Pipeline holds targets and pitches, which were consecutive steps of the
   *   same motion filed as if they were different subjects.
   *
   *   Capture stopped being a row at all. It is a verb, and it now lives as a
   *   button on the client it files against.
   */
  const groups: NavGroup[] = [
    {
      heading: 'The work',
      items: [
        { id: 'customers', label: vocab.customerPlural, href: '/customers', icon: 'clients' },
        { id: 'people', label: 'People', href: '/people', icon: 'network' },
      ].filter((i) => has(i.id as ModuleId)) as NavGroup['items'],
    },
    {
      heading: 'Money',
      items: [
        // Its stages are lead, estimating, won, in progress, complete, and its
        // numbers are unbilled and awaiting payment. That is a funnel with
        // money on it, not a project management view, so it sits with money.
        { id: 'jobs', label: vocab.jobPlural, href: '/jobs', icon: 'quotes' },
        { id: 'billing', label: 'Invoices', href: '/billing', icon: 'invoices' },
        { id: 'proposals', label: vocab.estimate + 's', href: '/proposals', icon: 'proposal' },
        // Overheads and receipts are tabs inside this one.
        { id: 'pl', label: 'Profit & Loss', href: '/pl', icon: 'chart' },
        { id: 'account', label: 'Bills to You', href: '/account', icon: 'incoming' },
      ].filter((i) => has(i.id as ModuleId)) as NavGroup['items'],
    },
    {
      heading: 'Grow',
      defaultOpen: false,
      items: [
        { id: 'targets', label: 'Pipeline', href: '/targets', icon: 'crosshair' },
        { id: 'seo', label: 'Digital', href: '/digital', icon: 'globe' },
        { id: 'brands', label: 'Brand', href: '/framework', icon: 'brandKit' },
      ].filter((i) => has(i.id as ModuleId)) as NavGroup['items'],
    },
  ];

  return groups.filter((g) => g.items.length > 0);
}
