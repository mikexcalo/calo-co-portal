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
  /**
   * One line, always visible, in plain terms: what you lose by not doing it.
   *
   * The note below was doing this job and it was hidden behind How, so the
   * list read as a set of chores with no stated stake. Somebody deciding what
   * to do on a Tuesday needs the reason before the instructions, not after.
   */
  why: string;
  /** The actual clicks. Shown when the step is opened. */
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
        why: 'Without it Google has no idea that page is about a person.',
        note:
          'Done. The site emitted FAQPage from its root layout and nothing else, so the one page about a human being carried no signal saying so. It now declares a Person with your job title, your headshot and a sameAs pointing at your LinkedIn.',
        done: 'built',
        where: { label: 'See the page', href: 'https://calo.company/mike-calo' },
      },
      {
        key: 'name_linkedin',
        do: 'Add calo.company to your LinkedIn profile',
        why: 'The schema above is half a handshake until this is done.',
        note:
          'This is the half only you can do, and the schema above does very little without it. Edit your profile, Contact info, Website, and put in https://calo.company/mike-calo. Schema on one end and a link on the other is what lets Google treat the profile and the page as one person — and lend a four-month-old domain the standing an eleven-year-old profile already has.',
        where: { label: 'Your profile', href: 'https://www.linkedin.com/in/mikecalo/' },
      },
      {
        key: 'name_stevie',
        do: "Change the link in Stevie's site footer to calo.company",
        why: 'The only link to the old domain that anybody can still click.',
        note:
          'The only inbound link to mikecalo.co that anybody knows about, and you control it. Changing it is the entire reason you might otherwise have needed a redirect.',
      },
      {
        key: 'name_expire',
        do: 'Let mikecalo.co expire on 28 September. No redirect.',
        why: 'Saves you paying for a year of a domain you do not want.',
        note:
          'It is four pages, two of which are Wix template leftovers — /book-online and /hotschedules. A 301 only transfers anything while somebody can still follow it, and Google asks for a year, which means paying for a domain you do not want to keep so it can pass across the authority of an abandoned site. Change the one link above and there is nothing left to catch. If the name ever matters again there is roughly a month of grace after the 28th to change your mind.',
      },
      {
        key: 'name_console',
        do: 'Verify calo.company in Search Console',
        why: 'Until you do this you are guessing at what people search.',
        note:
          '1. Open Search Console and press "Add property" (top left, the dropdown).\n'
          + '2. Pick the LEFT box, "Domain". Not "URL prefix" — Domain covers www and everything under it.\n'
          + '3. Type: calo.company — no https://, no www.\n'
          + '4. Google shows you one long line starting google-site-verification=. Copy the whole thing.\n'
          + '5. Paste it here in chat and I will put it into Vercel DNS for you — I have access, and it is the step people get stuck on.\n'
          + '6. Come back to Google and press Verify.\n\n'
          + 'It keeps no history from before the day you do this, which is the whole argument for doing it today rather than next month.',
        where: { label: 'Search Console', href: 'https://search.google.com/search-console' },
      },
      {
        key: 'name_sitemap',
        do: 'Submit the sitemap, then request indexing on the Mike Calo page',
        why: 'Google will find the page eventually; this is weeks instead of months.',
        note:
          '1. In Search Console, left menu, press "Sitemaps".\n'
          + '2. In the box, type: sitemap.xml — then Submit. It already exists and lists both pages.\n'
          + '3. Paste https://calo.company/mike-calo into the search bar at the very top (it says "Inspect any URL").\n'
          + '4. Press "Request Indexing" and wait for the tick.\n\n'
          + 'This is the payoff. It tells you whether Google knows that page exists at all, which right now nobody does.',
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
        why: 'Nothing was measuring the site, so Traffic has always been empty.',
        note:
          'Done. The tag was never on the site, which is the whole reason this screen has been empty since it was built. One script, no cookies, nothing stored in the browser, so it needs no consent banner.',
        done: 'built',
      },
      {
        key: 'traffic_on',
        do: 'Press Start collecting',
        why: 'Nothing is recorded until you press it, and there is no backfill.',
        note:
          'On the Traffic tab. Numbers begin from the moment you press it and not before, so there is no backfill to wait for.',
        where: { label: 'Traffic', href: '/traffic' },
      },
      {
        key: 'traffic_check',
        do: 'Open calo.company in a private window, then come back',
        why: 'Proves the whole loop works before you rely on the numbers.',
        note:
          'One visit is enough to prove the loop works end to end. If nothing appears within a minute, the tag is loading but the collection switch is still off.',
      },
      {
        key: 'traffic_gsea',
        do: 'Do the same for globalseafood.partners',
        why: 'John is paying for hosting and cannot see a single visitor.',
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
        why: 'The map results above the normal ones come almost entirely from this.',
        note:
          'If something already exists, press it and choose Claim this business. If not, Add your business. Either route ends in the same place.',
        where: { label: 'business.google.com', href: 'https://business.google.com' },
      },
      {
        key: 'map_noaddress',
        do: 'When it asks whether customers can visit, say No',
        why: 'Get this wrong and your home address is on the internet permanently.',
        note:
          'This is the question people get wrong, because it reads as though saying no hides you from search. It does not. Google still takes an address to verify you and simply does not publish it. You are choosing not to show it, which is a different thing entirely. Say yes and your home address is on the internet permanently.',
      },
      {
        key: 'map_area',
        do: 'Set the service area to the places you actually work',
        why: 'For a business with no shopfront this is what decides where you appear.',
        note:
          'Cities or a radius. For a digital business this is what replaces the address, and it decides which local searches you are eligible for.',
      },
      {
        key: 'map_category',
        do: 'Pick the narrowest category that is genuinely true',
        why: 'Decides which searches you are eligible for at all.',
        note:
          '"Marketing agency" competes with everybody. "Brand consultant" competes with people who do your job. You can add more later, but the first one decides which searches you appear in at all.',
      },
      {
        key: 'map_verify',
        do: 'Request verification and leave it — the postcard takes about a week',
        why: 'Nothing else here counts until the code arrives, and it takes a week.',
        note:
          'It goes to the address you gave even though it is hidden. Nothing else here finishes until the code arrives, so start it and carry on.',
      },
      /*
        These three were the tail of SETUP_ORDER, which rendered as a plain
        numbered list on the Search tab with no checkboxes on it — a second
        copy of this track, in a second place, that could not record that you
        had done any of it. They are steps here, and the tools they need still
        live on Search, which is what `where` is for.
      */
      {
        key: 'map_details',
        do: 'Fill in the details form on Search, then Save',
        why: 'Write your name, phone and address once and three other things get written for you.',
        note:
          'Name, phone, address, website, category, services and towns. Five minutes. It writes the address block, the structured data and the page titles from what you enter, so you are not typing the same business three times and getting it slightly different each time.',
        where: { label: 'Search', href: '/seo' },
      },
      {
        key: 'map_schema',
        do: 'Put the structured data into your site',
        why: 'It is how Google reads your hours and phone number instead of guessing them.',
        note:
          'Search generates it from the form above. Once for the whole site, not per page \u2014 in the head, or the page layout on a site built here, which means calo.company is mine to do. Paste your homepage into Google\u2019s Rich Results Test afterwards to confirm it reads.',
        where: { label: 'Search', href: '/seo' },
      },
      {
        key: 'map_directories',
        do: 'Paste the address block into each directory, unchanged',
        why: 'Three slightly different spellings read to Google as three businesses.',
        note:
          'Copy it every time rather than retyping. Retyping is how one business ends up listed as Ltd, Limited and nothing at all, and Google treats those as three separate businesses that each know a third as much about you. The list and the block are both on Search.',
        where: { label: 'Search', href: '/seo' },
      },
      {
        key: 'map_review',
        do: 'Paste your review link into Reviews so it asks by itself',
        why: 'The only thing on this page that keeps working after setup.',
        note:
          'Once verified: Read reviews, then Get more reviews, which gives you a short g.page link. Put it in and every finished, paid job asks automatically. It is the only thing on this page that keeps working after the setup is done.',
        where: { label: 'Reviews', href: '/reviews' },
      },
    ],
  },
];
