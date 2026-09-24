/**
 * THE DIGITAL PLAN, IN ORDER.
 *
 * There were four overlapping lists. A Search tab with a seven-step setup
 * order, a seven-item checklist underneath it saying much the same thing, a
 * directory list, and a set of Home tasks covering the same ground again. Some
 * of it applied to a bathroom remodeler with a van, none of it said what to do
 * first, and two of them contradicted each other on whether to keep the old
 * domain.
 *
 * Three tracks, done in this order, because each one is worth less without the
 * one before it. Owning the name comes first — there is no point measuring
 * traffic to a site nobody can find, or claiming a map listing for a business
 * nobody is searching for by name.
 *
 * Every step names the place, the button and the words. Anything that could be
 * done from here has been done from here, and says so.
 */

export interface PlanStep {
  /** Stable, because progress is stored against it. */
  key: string;
  do: string;
  /** Why, or the part people get wrong. Shown when the step is open. */
  note?: string;
  /** Already done, and by whom. */
  done?: 'built' | null;
  where?: { label: string; href: string };
}

export interface PlanTrack {
  key: string;
  title: string;
  /** One line. What this track buys you. */
  promise: string;
  steps: PlanStep[];
}

export const DIGITAL_PLAN: PlanTrack[] = [
  {
    key: 'name',
    title: 'Own your name in Google',
    promise: 'So searching Mike Calo finds you rather than an actor, a basketball player and a college pitcher.',
    steps: [
      {
        key: 'name_schema',
        do: 'Person schema on calo.company/mike-calo',
        note:
          'Done. The site emitted FAQPage from its root layout and nothing else, so the one page about a human being carried no signal saying so. It now declares a Person with your job title, your headshot and a sameAs pointing at your LinkedIn.',
        done: 'built',
        where: { label: 'See the page', href: 'https://calo.company/mike-calo' },
      },
      {
        key: 'name_linkedin',
        do: 'Add calo.company to your LinkedIn profile',
        note:
          'This is the half only you can do, and the schema above does very little without it. Edit your profile, Contact info, Website, and put in https://calo.company/mike-calo. Schema on one end and a link on the other is what lets Google treat the profile and the page as one person — and lend a four-month-old domain the standing an eleven-year-old profile already has.',
        where: { label: 'Your profile', href: 'https://www.linkedin.com/in/mikecalo/' },
      },
      {
        key: 'name_stevie',
        do: "Change the link in Stevie's site footer to calo.company",
        note:
          'The only inbound link to mikecalo.co that anybody knows about, and you control it. Changing it is the entire reason you might otherwise have needed a redirect.',
      },
      {
        key: 'name_expire',
        do: 'Let mikecalo.co expire on 28 September. No redirect.',
        note:
          'It is four pages, two of which are Wix template leftovers — /book-online and /hotschedules. A 301 only transfers anything while somebody can still follow it, and Google asks for a year, which means paying for a domain you do not want to keep so it can pass across the authority of an abandoned site. Change the one link above and there is nothing left to catch. If the name ever matters again there is roughly a month of grace after the 28th to change your mind.',
      },
      {
        key: 'name_console',
        do: 'Verify calo.company in Search Console',
        note:
          'Add property, choose Domain, type calo.company. Google gives you a TXT record — put it in Vercel DNS as Type TXT, Name @. The nameservers are already Vercel’s so it takes a minute. It keeps no history from before the day you do this, which is the argument for doing it today rather than next month.',
        where: { label: 'Search Console', href: 'https://search.google.com/search-console' },
      },
      {
        key: 'name_sitemap',
        do: 'Submit the sitemap, then request indexing on the Mike Calo page',
        note:
          'Sitemaps, then sitemap.xml. Then URL Inspection on calo.company/mike-calo and Request Indexing. This is the payoff: it tells you whether Google knows that page exists, which right now nobody does.',
      },
    ],
  },

  {
    key: 'traffic',
    title: 'See who is visiting',
    promise: 'Who arrives, what they landed on, and where they came from — in here, not in Google Analytics.',
    steps: [
      {
        key: 'traffic_tag',
        do: 'Tag on calo.company',
        note:
          'Done. The tag was never on the site, which is the whole reason this screen has been empty since it was built. One script, no cookies, nothing stored in the browser, so it needs no consent banner.',
        done: 'built',
      },
      {
        key: 'traffic_on',
        do: 'Press Start collecting',
        note:
          'On the Traffic tab. Numbers begin from the moment you press it and not before, so there is no backfill to wait for.',
        where: { label: 'Traffic', href: '/traffic' },
      },
      {
        key: 'traffic_check',
        do: 'Open calo.company in a private window, then come back',
        note:
          'One visit is enough to prove the loop works end to end. If nothing appears within a minute, the tag is loading but the collection switch is still off.',
      },
      {
        key: 'traffic_gsea',
        do: 'Do the same for globalseafood.partners',
        note:
          'John’s site carries no tag either. Switch to his workspace, copy the tag from his Traffic tab — the token is per site, so his is not yours — and send it over. It goes into his site in one line.',
      },
    ],
  },

  {
    key: 'map',
    title: 'Show up on the map',
    promise: 'A Google Business Profile for a business with no shopfront, which is the case nobody explains properly.',
    steps: [
      {
        key: 'map_create',
        do: 'Search your business name at business.google.com',
        note:
          'If something already exists, press it and choose Claim this business. If not, Add your business. Either route ends in the same place.',
        where: { label: 'business.google.com', href: 'https://business.google.com' },
      },
      {
        key: 'map_noaddress',
        do: 'When it asks whether customers can visit, say No',
        note:
          'This is the question people get wrong, because it reads as though saying no hides you from search. It does not. Google still takes an address to verify you and simply does not publish it. You are choosing not to show it, which is a different thing entirely. Say yes and your home address is on the internet permanently.',
      },
      {
        key: 'map_area',
        do: 'Set the service area to the places you actually work',
        note:
          'Cities or a radius. For a digital business this is what replaces the address, and it decides which local searches you are eligible for.',
      },
      {
        key: 'map_category',
        do: 'Pick the narrowest category that is genuinely true',
        note:
          '"Marketing agency" competes with everybody. "Brand consultant" competes with people who do your job. You can add more later, but the first one decides which searches you appear in at all.',
      },
      {
        key: 'map_verify',
        do: 'Request verification and leave it — the postcard takes about a week',
        note:
          'It goes to the address you gave even though it is hidden. Nothing else here finishes until the code arrives, so start it and carry on.',
      },
      {
        key: 'map_review',
        do: 'Paste your review link into Reviews so it asks by itself',
        note:
          'Once verified: Read reviews, then Get more reviews, which gives you a short g.page link. Put it in and every finished, paid job asks automatically. It is the only thing on this page that keeps working after the setup is done.',
        where: { label: 'Reviews', href: '/reviews' },
      },
    ],
  },
];
