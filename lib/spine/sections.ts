/**
 * The section library.
 *
 * Every site you build is made of the same handful of blocks in a different
 * order with different words. This is that handful, defined once.
 *
 * WHY THE FIELDS ARE LISTED HERE AND NOT DRAWN FREEHAND
 *
 * A hero has a headline, a line under it and a button. It does not have
 * "a text box you can put anywhere", because the moment it does you are
 * maintaining a layout engine and every site you ship looks like whoever
 * dragged it. Naming the fields is what makes a section reusable: the fifth
 * client's hero is five strings, not a build.
 *
 * WHY VARIANTS ARE FEW AND NAMED
 *
 * Two or three cuts of each section, each with a reason to exist. A variant is
 * a decision you have already made about when to use it, which is the opposite
 * of a settings panel. If you find yourself wanting a fourth, that is real
 * information and it belongs here as code rather than as an exception on one
 * client's site.
 */

export type FieldKind = 'line' | 'text' | 'url' | 'list';

export interface SectionField {
  key: string;
  label: string;
  kind: FieldKind;
  /** What good looks like, said as an instruction rather than a placeholder. */
  hint?: string;
}

export interface SectionVariant {
  id: string;
  label: string;
  /** When to reach for this one instead of the others. */
  when: string;
}

export interface SectionSpec {
  kind: string;
  label: string;
  /** What this block is for, in a sentence somebody would say out loud. */
  purpose: string;
  variants: SectionVariant[];
  fields: SectionField[];
}

export const SECTIONS: SectionSpec[] = [
  {
    kind: 'hero',
    label: 'Hero',
    purpose:
      'The first screen. It has one job: say what this is, to whom, clearly enough that somebody knows within a second whether to keep reading.',
    variants: [
      { id: 'centered', label: 'Centered', when: 'A statement. Nothing competes with the headline.' },
      { id: 'split', label: 'Split', when: 'There is an image or a screenshot worth showing beside the words.' },
    ],
    fields: [
      { key: 'eyebrow', label: 'Eyebrow', kind: 'line', hint: 'Three or four words above the headline. Optional, and usually better left empty.' },
      { key: 'headline', label: 'Headline', kind: 'line', hint: 'The one line from your messaging. Not a slogan you invented for this page.' },
      { key: 'sub', label: 'Underneath', kind: 'text', hint: 'One sentence saying who it is for and what actually happens.' },
      { key: 'cta', label: 'Button', kind: 'line', hint: 'A verb. Book a call, not Learn more.' },
      { key: 'cta_url', label: 'Button goes to', kind: 'url' },
      { key: 'image', label: 'Image', kind: 'url', hint: 'Split variant only.' },
    ],
  },
  {
    kind: 'proof',
    label: 'Proof',
    purpose:
      'Evidence that somebody already trusted you. It goes directly under the hero because the first question after "what is this" is "who else".',
    variants: [
      { id: 'logos', label: 'Logos', when: 'The names are recognisable on their own.' },
      { id: 'quote', label: 'One quote', when: 'One client said something better than you could.' },
      { id: 'numbers', label: 'Numbers', when: 'You have figures that are true and checkable.' },
    ],
    fields: [
      { key: 'heading', label: 'Heading', kind: 'line', hint: 'Optional. Often stronger with none.' },
      { key: 'items', label: 'Items', kind: 'list', hint: 'One per line. Logo variant: client names. Numbers: "40% · fewer unpaid invoices".' },
      { key: 'quote', label: 'Quote', kind: 'text', hint: 'Quote variant only. Their words, not tidied.' },
      { key: 'attribution', label: 'Who said it', kind: 'line', hint: 'Name, role, company.' },
    ],
  },
  {
    kind: 'services',
    label: 'What you do',
    purpose:
      'The work, in the buyer\'s words. Three or four things, each one a job somebody would come to you having already decided they need.',
    variants: [
      { id: 'grid', label: 'Grid', when: 'Three or four things of equal weight.' },
      { id: 'stack', label: 'Stacked', when: 'Each one needs a paragraph rather than a line.' },
    ],
    fields: [
      { key: 'heading', label: 'Heading', kind: 'line' },
      { key: 'intro', label: 'Intro', kind: 'text', hint: 'Optional. One sentence framing the list.' },
      { key: 'items', label: 'The things', kind: 'list', hint: 'One per line, "Title · what it actually is".' },
    ],
  },
  {
    kind: 'founder',
    label: 'Who you are',
    purpose:
      'For a business of one to ten, the person is a reason to buy. This is the section that turns a company into somebody accountable.',
    variants: [
      { id: 'portrait', label: 'With a photo', when: 'You have a photograph you would actually use.' },
      { id: 'letter', label: 'As a note', when: 'The words carry it and a portrait would feel staged.' },
    ],
    fields: [
      { key: 'name', label: 'Name', kind: 'line' },
      { key: 'role', label: 'Role', kind: 'line' },
      { key: 'body', label: 'What they say', kind: 'text', hint: 'First person. Short. Why this work, and what they will not do.' },
      { key: 'image', label: 'Photo', kind: 'url' },
      { key: 'link', label: 'Link', kind: 'url', hint: 'A profile, or a longer page about them.' },
    ],
  },
  {
    kind: 'contact',
    label: 'How to start',
    purpose:
      'The last screen, and the only one with a job that can fail. One action, no form fields nobody wants to fill in.',
    variants: [
      { id: 'call', label: 'Book a call', when: 'The sale needs a conversation, which for this work it does.' },
      { id: 'email', label: 'Just an address', when: 'You would rather they wrote than booked.' },
    ],
    fields: [
      { key: 'heading', label: 'Heading', kind: 'line' },
      { key: 'sub', label: 'Underneath', kind: 'text', hint: 'What happens after they click. Removing uncertainty is the whole job here.' },
      { key: 'cta', label: 'Button', kind: 'line' },
      { key: 'cta_url', label: 'Goes to', kind: 'url' },
    ],
  },
];

export const specFor = (kind: string) => SECTIONS.find((s) => s.kind === kind) ?? null;

/**
 * How this works, in the order you do it.
 *
 * Written out in the product rather than in a document nobody opens, because a
 * tool that needs explaining and does not explain itself is a tool you use
 * once.
 */
export const HOW_IT_WORKS: { step: string; detail: string }[] = [
  {
    step: 'Your site is a list of sections',
    detail:
      'A hero, then proof, then what you do, and so on. Each one is a block of content sitting in this platform. The code that draws it lives here too, written once and reused for every site you build after this one.',
  },
  {
    step: 'Edit the words, not the layout',
    detail:
      'You change what a section says and which cut of it you want. You never set padding, type size or colour, and that is deliberate: it is what keeps every site you ship looking like you made it, and it is the exact thing page builders give away.',
  },
  {
    step: 'Nothing you type is live',
    detail:
      'Edits are saved as a draft against the section. The published version sits untouched beside it, so a half-finished thought is never on the internet.',
  },
  {
    step: 'Look at it on a real link',
    detail:
      'Preview opens a genuine web page at its own address. Open it on your phone, send it to a client, sleep on it. It shows drafts; the live site does not.',
  },
  {
    step: 'Publish when you are happy',
    detail:
      'Publishing copies the draft over the published version. One section at a time or the whole page at once, and it is reversible until you overwrite it again.',
  },
  {
    step: 'The site reads from here',
    detail:
      'calo.company asks this platform for its published sections. That is the last piece and it needs a change on the site itself, so for now Preview is the real output and publishing sets what the site will collect once it is wired.',
  },
];
