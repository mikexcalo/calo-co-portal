/**
 * Walkthroughs, as click-along tours rather than recorded video.
 *
 * A screen recording is out of date the day after it is made, cannot be
 * followed at somebody else's pace, and shows a person data that is not
 * theirs. A tour that runs inside the product uses their workspace, their
 * clients and their numbers, and stays true because it points at real screens.
 *
 * WHY EACH STEP IS ALSO A DESTINATION
 *
 * A tour that only narrates is a slideshow. Every step names the screen it is
 * about, so following it means actually arriving there — which is the thing
 * being taught. Nobody learns where Access lives by watching a cursor.
 *
 * WHY IT IS TIMED
 *
 * Because the question after building an onboarding flow is always "how long
 * does this take", and guessing is how a twenty minute demo gets sold as five.
 * The clock runs while somebody walks it, so the answer is measured.
 */

export interface TourStep {
  /** Where this step happens. */
  href: string;
  title: string;
  /** What to say, in the words you would use in the room. */
  body: string;
  /** What they should actually do here, if anything. */
  todo?: string;
}

export interface Tour {
  id: string;
  title: string;
  who: string;
  summary: string;
  steps: TourStep[];
}

export const TOURS: Tour[] = [
  {
    id: 'first-day',
    title: 'The first ten minutes',
    who: 'Somebody opening this for the first time',
    summary: 'The shape of the product: where the work lives, where the money lives, and what to do first.',
    steps: [
      {
        href: '/',
        title: 'Home is what needs you',
        body:
          'This is not a dashboard of numbers. It is the short list of things that will cost you something if you leave them: money owed, people who have gone quiet, and the setup tasks only you can do. When it is empty, you are up to date.',
        todo: 'Read the top item. That is genuinely the most expensive thing waiting.',
      },
      {
        href: '/customers',
        title: 'Clients are the people you have',
        body:
          'Everyone you work with, with what they owe, who to speak to, and what you said you would do next. Clicking one opens the record everything else hangs off.',
        todo: 'Open a client and look at the tabs across the top.',
      },
      {
        href: '/targets',
        title: 'Pipeline is the people you want',
        body:
          'Same table, read from the other end. A company moves from Noticed to Reached the first time you write to them, and to Talking when they reply, without you dragging anything. Pressing a stage files the note that justifies it.',
        todo: 'Press a stage on any row and watch what it records.',
      },
      {
        href: '/billing',
        title: 'Money is one place',
        body:
          'Invoices here, quotes under Proposals, and Profit and Loss holds the overheads and receipts that feed it. Nothing about money lives anywhere else.',
      },
      {
        href: '/learn',
        title: 'Everything else is written down',
        body:
          'When something is not obvious, it is explained here rather than in a chat message that scrolled away. Each entry says what the thing does, and what it does not do yet.',
        todo: 'Skim the titles. You will come back to two of them.',
      },
    ],
  },
  {
    id: 'website-review',
    title: 'Running a website review',
    who: 'You, before you send a client a link',
    summary: 'Edit sections, preview on a real link, collect comments, push the change out to be built.',
    steps: [
      {
        href: '/website',
        title: 'The site is a list of sections',
        body:
          'Hero, then proof, then what you do. You edit the words and pick between two or three cuts of each section. You never set padding or type size, which is what keeps every site you ship looking like you made it.',
        todo: 'Open a section and change one line. It saves as a draft, not live.',
      },
      {
        href: '/website',
        title: 'Preview is a real page',
        body:
          'The link needs no login and works on a phone. It shows your drafts, so it is the version you are proposing rather than the one that is live.',
        todo: 'Open the preview link in another tab.',
      },
      {
        href: '/website',
        title: 'They can comment on it',
        body:
          'Anybody holding that link hovers a section and leaves a note. It comes back attached to that block and appears inside the section here, above the fields they were talking about. This is the part that replaces the email thread.',
        todo: 'Leave yourself a note on the preview, then come back and find it.',
      },
      {
        href: '/website/queue',
        title: 'Send it out to be built',
        body:
          'Publishing files a request holding both versions of every field that changed. Somebody with the site checked out makes it real, and you watch it here.',
      },
    ],
  },
];

export const tourById = (id: string) => TOURS.find((t) => t.id === id) ?? null;
