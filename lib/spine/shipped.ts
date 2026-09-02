/**
 * What exists, where it is, and what it is for.
 *
 * A list of features is normally marketing. This one is navigation: enough has
 * shipped in a short time that finding a thing is now harder than using it,
 * and a person who cannot find a feature has the same experience as a person
 * who does not have it.
 *
 * Written for the owner rather than for a customer, so it says what each thing
 * is actually for, including the ones that turned out to matter less than
 * expected.
 */

export interface Shipped {
  name: string;
  where: string;
  href?: string;
  what: string;
  /** Whether this is worth selling, and if so, how it is described. */
  sells?: string;
}

export const SHIPPED: Array<{ group: string; items: Shipped[] }> = [
  {
    group: 'The work',
    items: [
      { name: 'Jobs and engagements', where: 'The Work, Engagements', href: '/jobs',
        what: 'Every piece of work, with hours, costs and margin against it.' },
      { name: 'Schedule', where: 'Inside any engagement',
        what: 'Steps with dates and dependencies. Move one and everything waiting on it moves too.',
        sells: 'A schedule that stays right when a date slips, which is the reason people abandon schedules.' },
      { name: 'This week', where: 'Today', href: '/',
        what: 'Every job’s work for the next seven days, grouped by day, with late work pulled to the top.' },
      { name: 'Clients', where: 'The Work, Clients', href: '/customers',
        what: 'Companies you work with, the people inside them, and every conversation.' },
      { name: 'Notes and transcripts', where: 'The Work, Notes', href: '/notes',
        what: 'Paste a call or a page of notes and it pulls out the people, tasks, dates and amounts.' },
    ],
  },
  {
    group: 'Money',
    items: [
      { name: 'Estimates', where: 'Inside any engagement',
        what: 'Sent as a link. The client accepts by name without an account.' },
      { name: 'Optional line items', where: 'Estimate builder',
        what: 'Add-ons the customer ticks themselves. The total is recomputed by the database, never the browser.',
        sells: 'The cheapest revenue there is: the customer already reading your quote, given a way to say yes to more.' },
      { name: 'Scope in and out', where: 'Estimate builder',
        what: 'What the price covers and what it does not, on the page they accept.',
        sells: 'The single most common way a fixed-fee job loses money.' },
      { name: 'Invoices and payment', where: 'Money, Invoices', href: '/billing',
        what: 'Sent as a link with every way to pay on it.' },
      { name: 'Follow-ups', where: 'Today', href: '/',
        what: 'Quotes gone quiet and invoices past due, with one nudge each.',
        sells: 'One recovered quote a year pays for the software for a decade.' },
      { name: 'Profit and loss', where: 'Money, Profit & Loss', href: '/pl',
        what: 'Revenue, costs, margin, unbilled work, and anything paid in something other than cash.' },
      { name: 'Tax set-aside', where: 'Business, What you charge', href: '/business',
        what: 'A share of what you collect, held back. Nobody is withholding on your behalf.' },
      { name: 'Retainers', where: 'New engagement',
        what: 'A flat monthly fee and the hours it assumes, so overdelivery is visible.',
        sells: 'The invoice never changes, so nothing else can show you the month you worked sixty hours against a fee that assumed twenty.' },
    ],
  },
  {
    group: 'Find work',
    items: [
      { name: 'Targets', where: 'Find work, Targets', href: '/targets',
        what: 'Companies you are going after, kept apart from clients so the client list stays useful.',
        sells: 'A worked list with a next step on every row, not a spreadsheet nobody opens.' },
      { name: 'Reviews', where: 'Find work, Reviews', href: '/reviews',
        what: 'Every finished job asked once, and never anyone who still owes money.',
        sells: 'For a trade this is the marketing. Forty reviews get called, four do not.' },
      { name: 'Search', where: 'Find work, Search', href: '/seo',
        what: 'The local search checklist, plus a generated address block, structured data and page titles.',
        sells: 'An afternoon of admin that everybody abandons halfway, held as state instead of advice.' },
      { name: 'Enquiry link', where: 'Business settings', href: '/business',
        what: 'A public form for a yard sign or an email footer. Fills straight into your clients.',
        sells: 'A lead that arrives written down instead of as a voicemail.' },
      { name: 'QR campaigns', where: 'Brand, Kit and assets', href: '/brand-kit',
        what: 'Tracked codes per print run, so you know which sign worked.' },
      { name: 'Pitches', where: 'Find work, Pitches', href: '/pitches',
        what: 'A link instead of an attachment, and you can see whether it was opened.' },
    ],
  },
  {
    group: 'Brand',
    items: [
      { name: 'Brand framework', where: 'Brand, Framework', href: '/framework',
        what: 'Ten modules in the order the decisions have to be made, with what each one needs.',
        sells: 'The engagement itself. The framework is the deliverable and the process at once.' },
      { name: 'Source material', where: 'Inside any brand',
        what: 'Paste a call or photograph handwritten notes and it proposes the framework from them.' },
      { name: 'Guardrail check', where: 'Inside any brand',
        what: 'Runs copy against that brand’s banned list. Free, so it can run on every draft.' },
      { name: 'Case studies', where: 'Brand, Case Studies', href: '/stories',
        what: 'Five movements, and claims that cannot be published without a source.' },
      { name: 'Brand kit export', where: 'Inside any brand',
        what: 'One zip: tokens, fonts, assets, messaging, with contrast measured at export.',
        sells: 'Answers "can you send the design files" in one click instead of three emails.' },
    ],
  },
  {
    group: 'Running it',
    items: [
      { name: 'Ask', where: 'Top bar, or ⌘K', href: '/ask',
        what: 'Questions about your own numbers. The model picks the question, the database answers it.' },
      { name: 'Search everything', where: 'Top bar, ⌘K',
        what: 'Clients, jobs, brand colors, typefaces and case studies. Instant and free.' },
      { name: 'Workspaces', where: 'Running it, Workspaces', href: '/workspaces',
        what: 'What each business is on and what they can reach. Set a module up before they pay, hand it over after.' },
      { name: 'Overheads', where: 'Money, Overheads', href: '/expenses',
        what: 'What the business costs to run, including what the software itself costs.' },
      { name: 'Two-factor', where: 'Security', href: '/security',
        what: 'Enforced in the database, so a session owing a second factor can read nothing.' },
    ],
  },
];
