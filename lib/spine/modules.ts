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
  | 'feedback'       // tell us what is wrong with this
  | 'routes'         // the order to drive the day in
  | 'inbox'          // anything that arrived before its subject did
  | 'jobs'
  | 'customers'
  | 'receipts'
  | 'notes'
  | 'pitches'
  | 'billing'
  | 'pl'
  | 'website'        // client-facing: ask my agency for a site change
  | 'learn'          // what the product does, and how
  | 'client_requests' // agency-facing: the inbox of client requests
  | 'brand_kit'
  | 'brands'
  | 'stories'
  | 'ask'
  | 'reviews'
  | 'seo'
  | 'targets'
  | 'catalog'       // what a client sells, priced. Lives on the client record.
  | 'market'        // what the market wants. Belongs to the business, not a client.
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
  'learn',
  'feedback',
  'routes',
  'inbox',
  'ask',
  'targets',
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
  'learn',
  'feedback',
  'routes',
  'inbox',
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
 * A REP SELLS SOMEBODY ELSE'S PRODUCT FOR A CUT.
 *
 * Everything a contractor gets that a rep does not: Route, because there is no
 * site to drive to; Receipts and Overheads job costing, because there is no
 * job to cost; Price list, because the prices that matter are the principal's
 * and they hang off the principal, not off you.
 *
 * What it adds is the catalog. A rep with no line card has nothing to sell.
 */
const REP: ModuleId[] = [
  'learn',
  'feedback',
  'inbox',
  'ask',
  'targets',      // the distributors and chefs he is trying to place product with
  'jobs',
  'customers',    // the principals he represents
  'catalog',      // their line card, which is the product
  'people',
  'notes',
  'proposals',
  'billing',
  'pl',
  'expenses',
  'records',
  'brand_kit',
  'seo',
  'reviews',
  'traffic',
  'website',
  'pitches',
  'stories',
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
    'feedback', 'inbox', 'routes', 'jobs', 'customers', 'people', 'receipts', 'notes', 'billing', 'pl', 'expenses',
    'records', 'business', 'security', 'reviews', 'targets', 'learn',
  ],
  grow: [
    'feedback', 'inbox', 'routes', 'jobs', 'customers', 'people', 'receipts', 'notes', 'billing', 'pl', 'expenses',
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


/**
 * Which sidebar glyph belongs to each thing you can switch on.
 *
 * Access listed twenty rows of identical text, so the only way to find the one
 * you meant was to read every label. These are the same marks the sidebar
 * uses, so a row here and the row a client will see are recognisably the same
 * object.
 */
export const MODULE_ICON: Record<ModuleId, string> = {
  feedback: 'megaphone',
  routes: 'yardSign',
  inbox: 'drop',
  customers: 'clients',
  people: 'network',
  jobs: 'quotes',
  targets: 'crosshair',
  market: 'book',
  billing: 'invoices',
  proposals: 'proposal',
  pitches: 'send',
  pl: 'chart',
  account: 'incoming',
  seo: 'globe',
  expenses: 'wallet',
  receipts: 'folder',
  notes: 'notes',
  reviews: 'star',
  traffic: 'chart',
  website: 'inbox',
  learn: 'book',
  client_requests: 'megaphone',
  brand_kit: 'brandKit',
  brands: 'palette',
  stories: 'book',
  catalog: 'quotes',
  ask: 'search',
  pricing: 'financials',
  records: 'folder',
  team: 'network',
  security: 'shield',
  business: 'settings',
};

/**
 * A place, or a capability.
 *
 * Twenty switches read as one flat list of equivalent things, and they are not.
 * Most put a row in somebody's sidebar. A few change what an existing screen
 * can do and add no navigation at all, so switching one on and then looking
 * for it in the nav finds nothing. Saying which is which is the difference
 * between a switchboard you can reason about and a wall of toggles.
 */
export type ModuleKind = 'place' | 'capability';

/**
 * Which part of the sidebar a module lands in.
 *
 * Access listed everything in one column, so reading it meant holding the
 * sidebar's grouping in your head and mapping each row onto it. Same headings,
 * same order, so the switchboard and the thing it controls are laid out the
 * same way.
 */
/*
  Four sections, because three were doing five jobs.

  "The work" had grown to hold seven rows that are not the same kind of thing:
  who you work with, what you are doing for them, the order you drive the day
  in, your insurance certificates, and an inbox of client asks. A heading that
  covers all of that is not a heading, it is a shrug.

  The work is now who and what — clients, the people at them, the projects.
  Growth is everything aimed at winning more. Running it is the rest of what
  keeping a business open involves: the day's route, the filing cabinet, and
  what people are asking you for.
*/
export type NavSection = 'The work' | 'Money' | 'Growth' | 'Running it' | 'Setup';

export const MODULE_SECTION: Record<ModuleId, NavSection> = {
  feedback: 'Setup',
  routes: 'Running it',
  inbox: 'The work',
  customers: 'The work',
  people: 'The work',
  jobs: 'The work',
  targets: 'The work',
  market: 'The work',
  catalog: 'The work',
  notes: 'The work',
  client_requests: 'Running it',

  billing: 'Money',
  proposals: 'Money',
  pl: 'Money',
  account: 'Money',
  expenses: 'Money',
  receipts: 'Money',
  pricing: 'Money',

  pitches: 'Growth',
  seo: 'Growth',
  traffic: 'Growth',
  reviews: 'Growth',
  brands: 'Growth',
  brand_kit: 'Growth',
  stories: 'Growth',
  website: 'Growth',
  learn: 'Setup',
  ask: 'Growth',

  team: 'Setup',
  security: 'Setup',
  business: 'Setup',
  records: 'Running it',
};

export const NAV_SECTIONS: NavSection[] = ['The work', 'Money', 'Growth', 'Running it', 'Setup'];

export const MODULE_KIND: Record<ModuleId, ModuleKind> = {
  // Places: they appear in the sidebar, or as a tab of something that does.
  feedback: 'place',
  routes: 'place',
  inbox: 'place',
  customers: 'place',
  people: 'place',
  jobs: 'place',
  targets: 'place',
  market: 'place',
  billing: 'place',
  proposals: 'place',
  pitches: 'place',
  pl: 'place',
  account: 'place',
  seo: 'place',
  brand_kit: 'place',
  brands: 'place',
  stories: 'place',
  website: 'place',
  learn: 'place',
  client_requests: 'place',
  traffic: 'place',
  team: 'place',
  security: 'place',
  business: 'place',
  records: 'place',
  pricing: 'place',
  expenses: 'place',
  receipts: 'place',

  // Capabilities: they change what an existing screen can do.
  // Catalog is a tab that only appears on a client record. Capture is a button
  // in the top bar. Ask is a question box rather than a destination. Switching
  // any of them on adds nothing to the sidebar, which is exactly why they were
  // confusing to find sitting in the same list as Invoices.
  catalog: 'capability',
  notes: 'capability',
  ask: 'capability',
  reviews: 'capability',
};

/**
 * Human names for every module, in Title Case.
 *
 * Half of these were sentence case and half were single words, so a sidebar of
 * eighteen rows read "Price list" under "Invoices" next to "Case studies" —
 * the same kind of thing, capitalised three different ways down one column.
 * Every one of them is the name of a place, and names take capitals.
 */
export const MODULE_LABEL: Record<ModuleId, string> = {
  feedback: 'Tell Us',
  routes: 'Route',
  inbox: 'Drops',
  jobs: 'Jobs and Engagements',
  customers: 'Clients',
  people: 'People',
  traffic: 'Traffic',
  receipts: 'Receipts',
  notes: 'Capture',
  pitches: 'Pitches',
  proposals: 'Proposals',
  billing: 'Invoices',
  pl: 'Profit and Loss',
  expenses: 'Overheads',
  pricing: 'Price List',
  records: 'Records',
  brand_kit: 'Brand',
  brands: 'Client Brands',
  stories: 'Case Studies',
  ask: 'Ask',
  reviews: 'Reviews',
  seo: 'Digital',
  targets: 'Pipeline',
  catalog: 'What They Sell',
  market: 'Market',
  client_requests: 'Requests',
  website: 'Site Requests',
  learn: 'Learn',
  team: 'Team',
  security: 'Security',
  business: 'Settings',
  account: 'Bills to You',
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

  const kindBase =
    org.kind === 'agency' ? AGENCY : org.kind === 'rep' ? REP : CONTRACTOR;

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
  ['/feedback', 'feedback'],
  ['/routes', 'routes'],
  ['/inbox', 'inbox'],
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
  ['/learn', 'learn'],
  ['/site-requests', 'website'],
  ['/traffic', 'traffic'],
  ['/digital', 'seo'],
  ['/requests', 'client_requests'],
  ['/brand-kit', 'brand_kit'],
  ['/messaging', 'brand_kit'],
  ['/card', 'brand_kit'],
  ['/ask', 'ask'],
  ['/reviews', 'reviews'],
  ['/seo', 'seo'],
  ['/targets', 'targets'],
  ['/market', 'market'],
  /* '/framework' was here for a page that no longer exists. Left out rather
     than left in: an allow-list entry for a missing route is a 404 somebody
     eventually links to. */
  ['/stories', 'stories'],
  ['/brands', 'brands'],
  ['/business', 'business'],
  ['/what-you-see', 'business'],
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
  '/seo', '/pricing', '/records', '/requests',
  '/notes', '/pitches', '/stories', '/brand-kit', '/website', '/expenses', '/documents',
];

/**
 * Is this path reachable for this business? Returns false only for a route
 * that maps to a module the business doesn't have.
 */
export function pathAllowed(org: Org | null, pathname: string): boolean {
  if (ALWAYS.includes(pathname)) return true;

  /*
    Handing somebody a login to this platform is an agency act.

    Access was a tab on every Customers screen, so a contractor was being
    offered a way to give a homeowner a seat in Nautilus. What his customers
    should see is an invoice and the things that need them to do something,
    which is a different screen and a much shorter list. Hiding the tab is not
    enough on its own — the URL has to say no too.
  */
  if (pathname === '/access' || pathname.startsWith('/access/')) {
    return org?.kind === 'agency';
  }

  const entry = ROUTE_MODULE.find(
    ([prefix]) => pathname === prefix || pathname.startsWith(prefix + '/')
  );
  if (!entry) return true; // unmapped routes aren't gated

  return modulesFor(org).has(entry[1]);
}

/** Nav grouping. Order and headings come from here so the sidebar reads. */
/**
 * Where each module lives.
 *
 * Kept beside the section and label maps so a module cannot exist with a name,
 * an icon and a home section but no way to get to it — which is exactly how
 * Price list, Records, Receipts, Overheads, Reviews, Case studies, Traffic,
 * Team, Security and Business settings ended up with no row in the sidebar.
 */
export const MODULE_HREF: Record<ModuleId, string> = {
  feedback: '/feedback',
  routes: '/routes',
  inbox: '/inbox',
  jobs: '/jobs',
  customers: '/customers',
  people: '/people',
  targets: '/targets',
  market: '/market',
  catalog: '/customers',
  notes: '/notes',
  client_requests: '/requests',

  billing: '/billing',
  proposals: '/proposals',
  pl: '/pl',
  account: '/account',
  expenses: '/expenses',
  receipts: '/documents',
  pricing: '/pricing',

  pitches: '/pitches',
  seo: '/digital',
  traffic: '/traffic',
  reviews: '/reviews',
  brands: '/brands',
  brand_kit: '/brand-kit',
  stories: '/stories',
  website: '/site-requests',
  ask: '/ask',

  learn: '/learn',
  team: '/team',
  security: '/security',
  business: '/business',
  records: '/records',
};

/**
 * Which modules are a tab of something else rather than a destination.
 *
 * A screen should be reachable one way. Traffic was a module with its own
 * sidebar row AND a tab under Digital AND a tab under Website, so the same
 * page had three parents and clicking it from one of them silently moved you
 * into another family's tab strip. Price list was a row and a tab under
 * Business. Receipts and Overheads were rows and tabs under Profit & Loss.
 *
 * Naming the parent here keeps them out of the sidebar without hiding them:
 * the parent has the row, and its tabs are one click in.
 */
/**
 * Reached outside the grouped nav — the top bar, or a fixed row of its own.
 *
 * Without this the auto-completer below does its job and gives them a second
 * row inside a section, which is how Drops ended up both beside Home and
 * under The work.
 */
export const MODULE_IN_TOPBAR: ModuleId[] = [
  /** Its own row beside Home. Things land here before they are anything. */
  'inbox',
  /** Its own row at the foot of the sidebar, where help lives. */
  'feedback',
  'learn',
  /**
   * Settings belongs to you, not to the work.
   *
   * It sat in the sidebar as its own section, which put "how this business
   * charges" at the same level as the jobs you are doing today. It is reached
   * from your own face in the top bar, which is where every other product on
   * a laptop keeps it.
   */
  'business',
];

/**
 * A TAB IS ANOTHER VIEW OF THE SAME THING. NOTHING ELSE.
 *
 * This map decided which screens get no sidebar row, and it had been used for
 * "related to" rather than "the same object as". Nine screens ended up
 * reachable only by landing on a sibling first: you got to Expenses by opening
 * Profit & Loss and noticing a tab. If you did not already know it was there,
 * it did not exist — which is the failure recorded in this file's own history,
 * where folding everything into tabs "looked tidy and made the product
 * unusable, because a tab is invisible until you are already on the page that
 * holds it".
 *
 * Expenses is not a view of Profit & Loss. It is a different task that happens
 * to be money-shaped, and it wants a row. Team and Security genuinely are two
 * views of one object — your business — so they stay.
 *
 * The rule, applied: same object, tab. Different task, row. Length is handled
 * by folding a section you do not use, or parking a row you do not want, not
 * by making the screen unfindable.
 */
export const MODULE_TAB_PARENT: Partial<Record<ModuleId, ModuleId>> = {
  // Two views of your business, which is one object.
  team:     'business',
  security: 'business',
  /*
    Digital's Overview is not a fifth sibling, it is the sum of the others:
    four cards showing what Traffic, Search and Reviews each say. A parent that
    summarises its children is the case tabs are for, so these stay.
  */
  traffic:  'seo',
  reviews:  'seo',
  /*
    A case study is not a destination.

    I promoted this to its own row on the rule that a tab is another view of
    the same object, and a case study is not a view of a pitch. That was the
    wrong read. Its only jobs are to go into a pitch, go into a proposal, or go
    on the site — you never open it to do work, you open it to fetch one. That
    is a library, and a library lives with whatever consumes it most.

    One untitled draft did not earn a row in a sidebar of eighteen.
  */
  stories:  'pitches',
  // Not a tab: the Brand row already points at the kit, and a second row for
  // the same page under a different name is the duplication this map exists
  // to stop.
  brands: 'brand_kit',
  website: 'seo',
};

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
        /**
         * Engagements gets its row back.
         *
         * It was removed on the reasoning that it held one card and its work
         * really lives on the client as the Plan. Both true, and it left the
         * screen reachable and unreachable at once: opening an engagement from
         * a client record, or pressing All engagements once there, lands you on
         * a page with no back link and no row in the sidebar to return by. A
         * dead end inside your own product.
         */
        { id: 'jobs', label: vocab.jobPlural, href: '/jobs', icon: 'quotes' },
        { id: 'market', label: 'Market', href: '/market', icon: 'book' },
        /**
         * Last, and called Unfiled rather than Inbox.
         *
         * Two things called Inbox — this and the bell — is one too many, and
         * the bell already owns the word. Unfiled says what the row holds
         * rather than what it resembles. It sits below the real work because
         * it is a shelf, not a place you go to get something done.
         */
      ].filter((i) => has(i.id as ModuleId)) as NavGroup['items'],
    },
    {
      heading: 'Money',
      items: [
        // No row. It held one card, its stages are a funnel Proposals and
        // Invoices already report, and the actual work lives on the client as
        // the Plan. Reachable from a client, which is where you think of it.
        /*
          The order is the order it happens in.

          You quote, then you bill. Invoices sat above the thing that has to
          exist before them, which reads as though billing were the first act
          of a job rather than the last.
        */
        { id: 'proposals', label: vocab.estimate + 's', href: '/proposals', icon: 'proposal' },
        { id: 'billing', label: 'Invoices', href: '/billing', icon: 'invoices' },
        // Overheads and receipts are tabs inside this one.
        { id: 'pl', label: 'Profit & Loss', href: '/pl', icon: 'chart' },
        { id: 'account', label: 'Bills to You', href: '/account', icon: 'incoming' },
      ].filter((i) => has(i.id as ModuleId)) as NavGroup['items'],
    },
    {
      heading: 'Running it',
      defaultOpen: false,
      items: [
        /*
          What keeping the doors open involves, as against the work itself.

          The order you drive the day in, the filing cabinet, and what people
          are asking you for. None of those is a client or a project, and all
          three were sitting under The work making that heading meaningless.
        */
        { id: 'routes', label: 'Route', href: '/routes', icon: 'yardSign' },
        { id: 'records', label: 'Records', href: '/records', icon: 'folder' },
        { id: 'client_requests', label: 'Requests', href: '/requests', icon: 'megaphone' },
      ].filter((i) => has(i.id as ModuleId)) as NavGroup['items'],
    },
    {
      heading: 'Growth',
      defaultOpen: false,
      items: [
        /**
         * A pitch is how you win work, not how you get paid for it.
         *
         * It sat under Money next to Invoices and Profit and Loss, which put
         * the thing you send a stranger in the same group as the thing you
         * send a client who already owes you. Grow is where the work comes
         * from: the pipeline, the digital presence, the brand.
         */
        { id: 'pitches', label: 'Pitches', href: '/pitches', icon: 'send' },
        { id: 'seo', label: 'Digital', href: '/digital', icon: 'globe' },
        /**
         * A module is a row in this sidebar. Website was a tab under Brand,
         * which made it a view of your identity; it is the place the site
         * itself is built and tuned, so it is its own row.
         */
        /**
         * Brand opens on yours.
         *
         * The row pointed at /framework, so clicking Brand in your own
         * workspace showed a grid of three clients and their progress through
         * a ten step method. Whatever that page is, it is not your brand. Your
         * logos, colours, type and voice are in the kit, so that is where the
         * word goes.
         */
        { id: 'brand_kit', label: 'Brand', href: '/brand-kit', icon: 'brandKit' },
        /**
         * Learn is a module, not a help panel.
         *
         * A feature nobody was told about is a feature nobody uses, and the
         * same explanation kept being typed into a chat window and scrolling
         * away. This is also what a client is handed the day they get a login:
         * training and enablement are one problem seen from two sides.
         */
      ].filter((i) => has(i.id as ModuleId)) as NavGroup['items'],
    },
  ];

  /**
   * Anything allowed and still missing gets a row.
   *
   * The curated groups above are the considered order, and they were also an
   * allow-list by omission: a module could be switched on, have a label, an
   * icon and a section, and still appear nowhere. Ten did. This closes the
   * gap by construction, so the next module added cannot go missing — it lands
   * in its own section whether or not anybody remembered to place it.
   */
  const placed = new Set(groups.flatMap((g) => g.items.map((i) => i.id)));
  const missing = ([...on] as ModuleId[]).filter(
    (id) =>
      MODULE_KIND[id] === 'place' &&
      !placed.has(id) &&
      MODULE_HREF[id] &&
      // A tab is reached through its parent, never as a second row of its own.
      !MODULE_TAB_PARENT[id] &&
      !MODULE_IN_TOPBAR.includes(id)
  );

  for (const id of missing) {
    const heading = MODULE_SECTION[id];
    let group = groups.find((g) => g.heading === heading);
    if (!group) {
      group = { heading, items: [], defaultOpen: heading !== 'Setup' };
      groups.push(group);
    }
    group.items.push({
      id,
      label: MODULE_LABEL[id],
      href: MODULE_HREF[id],
      icon: MODULE_ICON[id],
    });
  }

  // Setup last, whatever order it was created in.
  groups.sort((a, b) => Number(a.heading === 'Setup') - Number(b.heading === 'Setup'));

  return groups.filter((g) => g.items.length > 0);
}
