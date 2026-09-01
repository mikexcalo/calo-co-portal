/**
 * Local search, as a checklist that knows what you have already done.
 *
 * Search is treated as a dark art and mostly is not. For a business that
 * serves a place, it is four levers, and three of them are administration:
 * fill in the Google profile properly, write the name and address identically
 * everywhere, collect reviews, and have a website that says what you do and
 * where. None of it is clever. It is an afternoon of boring work that gets
 * abandoned in the second hour.
 *
 * So the value here is not advice. It is state, generated artifacts, and a
 * reason attached to every item, because a checklist without reasons gets
 * skipped at the first tedious one.
 *
 * WHAT IS GENERATED RATHER THAN EXPLAINED
 *
 * The address block, the schema markup, the title tags. Those are mechanical,
 * they are where mistakes actually happen, and a person copying them by hand
 * is the reason the mistakes happen. Nothing here costs a model call.
 */

export interface SeoTask {
  key: string;
  title: string;
  /** Why it matters, in terms of what it costs to skip. */
  why: string;
  /** What to actually do. Specific enough to follow without a tab open. */
  how: string[];
  /** local: only meaningful for a business that serves a place. */
  applies: 'all' | 'local';
  effort: 'minutes' | 'an hour' | 'ongoing';
}

export const SEO_TASKS: SeoTask[] = [
  {
    key: 'gbp_claim',
    title: 'Claim and verify the Google Business Profile',
    why: 'This is most of local search. The map results above the normal results are drawn almost entirely from this profile, and an unclaimed one can be edited by anybody, including a competitor.',
    how: [
      'Search your business name on Google. If a profile exists, choose Own this business.',
      'If none exists, create one at business.google.com.',
      'Verification is usually a postcard to the address, which takes about a week. Start it before anything else here, because everything else waits on it.',
    ],
    applies: 'local',
    effort: 'minutes',
  },
  {
    key: 'gbp_category',
    title: 'Set the primary category to the narrowest true one',
    why: 'The primary category decides which searches you are eligible for at all. Most people pick the broadest thing that is true, which puts them in the largest possible pool. Narrow beats broad: a bathroom remodeler competes with bathroom remodelers, a general contractor competes with everybody.',
    how: [
      'Pick the single most specific category that genuinely describes the work you most want.',
      'Add secondary categories for everything else you do. Those are close to free.',
      'Revisit it if the work changes. Most people set it once and never look again.',
    ],
    applies: 'local',
    effort: 'minutes',
  },
  {
    key: 'nap',
    title: 'Write the name, address and phone identically everywhere',
    why: 'The most common local search mistake, and the one nobody notices. Ste 4 in one place and Suite 4 in another, a cell number on one directory and an office line on another, and search engines lose confidence that the listings are the same business. Nothing errors. You simply rank worse and never learn why.',
    how: [
      'Decide the exact wording once, below, and copy it from there every time.',
      'Never retype it. Retyping is how the variants appear.',
      'Use one phone number publicly, even if you answer three.',
    ],
    applies: 'all',
    effort: 'minutes',
  },
  {
    key: 'services',
    title: 'List services in the words a customer would type',
    why: 'People do not search for what you call your work, they search for what they think they need. The gap between "tile and stone installation" and "bathroom tile" is the gap between being found and not.',
    how: [
      'Write each service as somebody would say it out loud.',
      'Add them to the Google profile under Services, with a sentence each.',
      'Include the ones you want more of, not only the ones you do most.',
    ],
    applies: 'all',
    effort: 'an hour',
  },
  {
    key: 'service_areas',
    title: 'Name the towns you actually serve',
    why: 'Near me searches match against a service area, not a guess. Listing towns you do not serve wastes calls; leaving out ones you do serve costs them.',
    how: [
      'List the towns you would genuinely drive to.',
      'Twenty is the Google limit and is more than most businesses need.',
      'If you have a storefront customers visit, use the address instead of an area.',
    ],
    applies: 'local',
    effort: 'minutes',
  },
  {
    key: 'photos',
    title: 'Add real photos, and keep adding them',
    why: 'Profiles with photos get contacted more, and the effect is not subtle. Stock photography does the opposite: people recognize it instantly and it reads as a business with nothing of its own to show.',
    how: [
      'Ten to start: finished work, the van, the team, the storefront if there is one.',
      'Before and after pairs outperform everything else for trades.',
      'Add a few every month. Recency counts, which is why this never quite finishes.',
    ],
    applies: 'local',
    effort: 'ongoing',
  },
  {
    key: 'reviews',
    title: 'Ask every finished job for a review',
    why: 'Volume and recency both count, and recency is why this cannot be done once. Ten reviews from two years ago reads worse than five from this quarter.',
    how: [
      'Set the review link in Business and the portal asks automatically.',
      'Nobody who still owes money gets asked, which is deliberate.',
      'Reply to every review, including the bad ones. Replies are visible and a calm reply to a complaint sells better than a wall of five stars.',
    ],
    applies: 'all',
    effort: 'ongoing',
  },
  {
    key: 'schema',
    title: 'Put structured data on the website',
    why: 'It tells a search engine what the page is rather than making it guess: this is a business, here is the address, the phone, the hours. It is the difference between being read and being parsed.',
    how: [
      'Copy the generated block below into the site, inside the head tag.',
      'One per site, not one per page.',
      'Check it with the Google Rich Results Test afterwards.',
    ],
    applies: 'all',
    effort: 'minutes',
  },
  {
    key: 'titles',
    title: 'Write page titles that name the service and the place',
    why: 'The title tag is still the strongest single signal on a page, and it is the line people read in the results. Home is the most common title on the internet and tells a searcher nothing.',
    how: [
      'Service, then place, then business name.',
      'Around sixty characters, or it gets truncated.',
      'One page per service you care about, each with its own title.',
    ],
    applies: 'all',
    effort: 'an hour',
  },
  {
    key: 'pages',
    title: 'Give each main service its own page',
    why: 'One page listing eight services ranks for none of them. Search engines match a page to an intent, and a page about everything matches nothing in particular.',
    how: [
      'Start with the two or three services you most want more of.',
      'Each page: what it is, what it costs roughly, photos of yours, and how to get in touch.',
      'Write for somebody deciding, not for a search engine. The two want the same thing more often than people expect.',
    ],
    applies: 'all',
    effort: 'ongoing',
  },
  {
    key: 'citations',
    title: 'Claim the directories that matter',
    why: 'Each one is another place the details must match. The listings themselves send little traffic; their value is corroboration, and their risk is contradicting each other.',
    how: [
      'Work the list below, pasting the same address block every time.',
      'Apple Maps and Bing matter more than people assume, because phones and cars use them.',
      'Ignore anyone selling you two hundred directory submissions.',
    ],
    applies: 'local',
    effort: 'an hour',
  },
  {
    key: 'posts',
    title: 'Post to the Google profile occasionally',
    why: 'Posts show on the profile and signal that the business is active. This is the lowest-value item on this list and it is here so it can be honestly deprioritized rather than worried about.',
    how: [
      'A finished job with a photo, once or twice a month.',
      'They expire, so this is maintenance rather than a task.',
      'If you only do one ongoing thing, make it reviews instead.',
    ],
    applies: 'local',
    effort: 'ongoing',
  },
];

/**
 * The order to do it in, which is not the order the checklist is written in.
 *
 * Verification is a postcard and takes about a week, so it starts first and
 * everything else happens while it is in the mail. Getting this order wrong is
 * how somebody spends an afternoon writing service pages and then waits a week
 * before any of it can help.
 */
export const SETUP_ORDER: Array<{ step: string; note: string }> = [
  {
    step: 'Claim the Google Business Profile and start verification',
    note: 'A postcard to the address, roughly a week. Everything else waits on it, so post it before you do anything else on this page.',
  },
  {
    step: 'Set the primary category to the narrowest true one',
    note: 'This decides which searches you are eligible for at all. Narrow competes with people who do your thing; broad competes with everybody.',
  },
  {
    step: 'Fill in the details below',
    note: 'Five minutes, and it generates the address block, the structured data and every page title.',
  },
  {
    step: 'Paste the structured data into the website head',
    note: 'Once per site, not per page. Check it afterwards with the Google Rich Results Test.',
  },
  {
    step: 'Work the directory list with the copied address block',
    note: 'Copy it every time. Retyping is how the same business ends up listed three slightly different ways.',
  },
  {
    step: 'Turn on the review link and let it ask by itself',
    note: 'Reviews are the only lever on this page that keeps paying after the setup is done.',
  },
];

/** The directories worth the time, in order of how much they matter. */
export const DEFAULT_CITATIONS: Array<{ name: string; url: string; note: string }> = [
  { name: 'Google Business Profile', url: 'https://business.google.com', note: 'The one that matters most' },
  { name: 'Apple Business Connect', url: 'https://businessconnect.apple.com', note: 'Apple Maps, and every iPhone' },
  { name: 'Bing Places', url: 'https://www.bingplaces.com', note: 'Also feeds several in-car systems' },
  { name: 'Facebook Page', url: 'https://facebook.com/pages/create', note: 'Often the second result for a business name' },
  { name: 'Yelp', url: 'https://biz.yelp.com', note: 'Ranks high for trades whether you engage or not' },
  { name: 'Better Business Bureau', url: 'https://www.bbb.org', note: 'Trust signal for larger jobs' },
  { name: 'Nextdoor', url: 'https://business.nextdoor.com', note: 'Where neighbours ask for recommendations' },
  { name: 'Angi', url: 'https://www.angi.com', note: 'Worth claiming, not worth paying for at first' },
];

// ---------------------------------------------------------------------------
// Generated artifacts. All deterministic, none of them a model call.
// ---------------------------------------------------------------------------

export interface Profile {
  legal_name?: string | null;
  phone?: string | null;
  street?: string | null;
  city?: string | null;
  region?: string | null;
  postcode?: string | null;
  country?: string | null;
  primary_category?: string | null;
  service_areas?: string[];
  services?: string[];
  site_url?: string | null;
  description?: string | null;
}

/**
 * The address block, written once and copied everywhere.
 *
 * The entire point is that it is copied rather than retyped, because retyping
 * is how Ste 4 and Suite 4 end up on different directories.
 */
export function napBlock(p: Profile): string {
  return [
    p.legal_name,
    p.street,
    // "Fort Worth, TX 76164". The ZIP follows the state with a space, not a
    // comma, and this string is pasted verbatim into a dozen directories.
    [[p.city, p.region].filter(Boolean).join(', '), p.postcode].filter(Boolean).join(' '),
    p.phone,
    p.site_url,
  ]
    .filter(Boolean)
    .join('\n');
}

/** LocalBusiness structured data, ready to paste into the head. */
export function schemaMarkup(p: Profile): string {
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: p.legal_name ?? '',
    telephone: p.phone ?? '',
    url: p.site_url ?? '',
  };

  if (p.street || p.city) {
    data.address = {
      '@type': 'PostalAddress',
      streetAddress: p.street ?? '',
      addressLocality: p.city ?? '',
      addressRegion: p.region ?? '',
      postalCode: p.postcode ?? '',
      addressCountry: p.country ?? 'US',
    };
  }

  if (p.service_areas?.length) {
    data.areaServed = p.service_areas.map((a) => ({ '@type': 'City', name: a }));
  }

  if (p.services?.length) {
    data.hasOfferCatalog = {
      '@type': 'OfferCatalog',
      name: 'Services',
      itemListElement: p.services.map((s) => ({
        '@type': 'Offer',
        itemOffered: { '@type': 'Service', name: s },
      })),
    };
  }

  if (p.description) data.description = p.description;

  return `<script type="application/ld+json">\n${JSON.stringify(data, null, 2)}\n</script>`;
}

/**
 * A title tag per service and town.
 *
 * Capped at sixty characters because search results truncate past roughly
 * there, and a title that ends in an ellipsis wastes the words after it.
 */
export function titleTags(p: Profile): Array<{ page: string; title: string; over: boolean }> {
  const name = p.legal_name ?? '';
  const town = p.service_areas?.[0] ?? p.city ?? '';
  const out: Array<{ page: string; title: string; over: boolean }> = [];

  const add = (page: string, title: string) =>
    out.push({ page, title, over: title.length > 60 });

  /**
   * "Service in Town | Business", not three pipe-separated fragments.
   *
   * The pipe separates the page from the brand. Putting one inside the phrase
   * breaks "bathroom remodel in Fort Worth" into two things that no longer
   * read as the sentence somebody actually typed.
   */
  const phrase = (what: string) => (town ? `${what} in ${town}` : what);
  const withName = (what: string) => [phrase(what), name].filter(Boolean).join(' | ');

  if (p.primary_category) add('Home', withName(p.primary_category));
  for (const s of p.services ?? []) add(s, withName(s));

  return out;
}

/**
 * A profile description, assembled rather than written.
 *
 * Deliberately plain. This field is read by a person deciding whether to call,
 * and the register that wins there is the one that sounds like the business
 * rather than like marketing. It is a starting point to edit, which is stated
 * on the screen.
 */
export function gbpDescription(p: Profile): string {
  const services = p.services ?? [];
  const areas = p.service_areas ?? [];
  const bits: string[] = [];

  if (p.legal_name && p.primary_category) {
    bits.push(`${p.legal_name} is a ${p.primary_category.toLowerCase()}${areas.length ? ` serving ${areas.slice(0, 3).join(', ')}` : ''}.`);
  }
  if (services.length) {
    // Lowercased because these are written as page headings elsewhere and
    // arrive capitalized, which reads wrong in the middle of a sentence.
    const named = services.slice(0, 4).map((s) => s.charAt(0).toLowerCase() + s.slice(1));
    const listed =
      named.length === 1
        ? named[0]
        : `${named.slice(0, -1).join(', ')} and ${named[named.length - 1]}`;
    bits.push(`We do ${listed}.`);
  }
  if (p.phone) bits.push(`Call ${p.phone} to talk it through.`);

  return bits.join(' ');
}
