/**
 * What this product can do, written down.
 *
 * Two things kept happening. Features shipped and were never found, because
 * knowing a preview link takes comments requires somebody to have told you.
 * And the same explanation got typed into a chat window, scrolled away, and
 * typed again slightly differently.
 *
 * So it lives here, in the product, in the words somebody would use out loud.
 * It is also what gets handed to a client the day they are given a login: the
 * same page serves training and enablement, because they are the same problem
 * seen from two sides.
 *
 * WHY IT IS A FILE AND NOT A TABLE
 *
 * These describe what the software does, so they change when the software
 * changes and belong in the same commit as the change. A table would let them
 * drift, and documentation that quietly stops being true is worse than none.
 */

export interface Lesson {
  id: string;
  /** The module it belongs to, matching the sidebar. */
  area: string;
  title: string;
  /** One line. What it is, said plainly. */
  summary: string;
  /** The whole thing, in paragraphs. */
  body: string[];
  /** Where to go and do it. */
  href?: string;
  /** Worth knowing before you rely on it. */
  caveat?: string;
}

export const LESSONS: Lesson[] = [
  {
    id: 'preview-comments',
    area: 'Website',
    title: 'Clients can comment on a preview',
    summary: 'Send a link. They mark up the page. No account, nothing to install.',
    body: [
      'Every site in here has a preview link of its own. It needs no login, works on a phone, and shows drafts, so it is the version you are proposing rather than the one that is live.',
      'Anybody holding that link can hover a section and leave a note. They type their name and what they would change, and it arrives attached to the block they were looking at.',
      'Back in the Website module those notes appear inside the section, directly above the fields the person was talking about. So "the second bit reads oddly" never has to be decoded again: the comment and its subject travel together. Mark one done and it clears.',
      'For a website review this replaces the whole email thread. They look, they comment, you edit, you send the link again.',
    ],
    href: '/website',
    caveat:
      'No email arrives when a note is left, so you find them by opening the module. Anybody with the link can leave notes, so treat it like an unlisted URL rather than a password.',
  },
  {
    id: 'send-to-build',
    area: 'Website',
    title: 'Editing the site, and what publishing really does',
    summary: 'Edit the words, preview, then push the change out to be built.',
    body: [
      'The site is a list of sections. You change what a section says and pick between two or three cuts of it. You never set padding, type size or colour, and that constraint is deliberate: it is what keeps every site you ship looking like you made it.',
      'Nothing you type is live. Edits are saved as a draft beside the published version, so a half-finished thought is never on the internet.',
      'Send to build files a request holding both versions of every field that changed, and it lands in the Build queue. Somebody with the site checked out makes it real.',
    ],
    href: '/website',
    caveat:
      'calo.company is a separate repository, so nothing in this platform changes the live site by itself. Preview is the real output until that is wired up.',
  },
  {
    id: 'stage-moves-itself',
    area: 'Pipeline',
    title: 'The pipeline keeps itself up to date',
    summary: 'Contact moves a company along, and the record says why.',
    body: [
      'Every CRM a small business abandons is abandoned the same way: the stages are right on the day you set them and wrong a month later, because dragging cards is work with no deadline.',
      'So it moves itself. Filing an outbound note moves a company from Noticed to Reached. A reply moves either to Talking. Underneath the stage it says what moved it, and you can override with one click.',
      'Pressing a stage on the pipeline list also writes the note that justifies it. A stage reading Reached with nothing anywhere saying you contacted them is the lie that makes a board stale.',
    ],
    href: '/targets',
  },
  {
    id: 'talk-it-in',
    area: 'Clients',
    title: 'Talk a note in instead of typing it',
    summary: 'Say what happened. It files itself and proposes what changed.',
    body: [
      'Drop a note, in the top bar, takes speech or pasted text from anywhere. It works out which client it is about from what you said.',
      'It comes back with the note written up, anything you committed to, and proposed changes to what we know about that client, each with the old text beside the new one.',
      'Nothing is written until you take it. A rambling five minutes about shipping must never quietly overwrite a paragraph somebody wrote carefully about the economics.',
    ],
    href: '/customers',
  },
  {
    id: 'what-you-see',
    area: 'Setup',
    title: 'Turn off what you are not using',
    summary: 'The sidebar should hold your work, not every feature that exists.',
    body: [
      'A product that shows you everything it can do makes you feel behind on all of it. Under Setup, What you see switches any module off for your own workspace.',
      'Nothing is deleted. A row you switch off stops appearing and comes straight back when you want it.',
      'The same screen for a client is Access, under Clients, which decides what they can open when they log in.',
    ],
    href: '/what-you-see',
  },
  {
    id: 'brand-download',
    area: 'Brand',
    title: 'Hand over a brand without a meeting',
    summary: 'Type, colors and every asset, as files somebody can keep.',
    body: [
      'The kit holds logos, colors, type and voice. Colors are editable behind the pencil, and the whole type system downloads as a file: the website faces, the platform faces, and every colour with its hex.',
      'On a client record, Brand holds theirs, with Download everything for a handoff.',
      'Messaging is separate from the kit on purpose. Voice is how you sound; messaging is what you claim, and everything you send is written out of it.',
    ],
    href: '/brand-kit',
  },
];

export const LEARN_AREAS = Array.from(new Set(LESSONS.map((l) => l.area)));
