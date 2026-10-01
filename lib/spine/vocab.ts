/**
 * What a workspace calls the things in it.
 *
 * WHY THIS IS NOT IN `org.tsx` ANY MORE
 *
 * It was, and `org.tsx` opens with `'use client'` because it holds the React
 * context that resolves the current workspace. A server component that
 * imports from a client module does not get the function; it gets a reference
 * to something that will exist in the browser, and calling it on the server
 * throws `vocabFor is not a function`.
 *
 * Nothing caught it for two days because every other caller is a client
 * screen, where the import works exactly as written. The two that are not are
 * the two documents a customer receives - the proposal at `/e/[token]` and the
 * invoice at `/i/[token]` - which are server-rendered on purpose, so they load
 * fast on a phone in a driveway and print properly.
 *
 * So the words live here: no React, no `'use client'`, no browser client,
 * nothing either side cannot import. `org.tsx` re-exports every one of them,
 * so the fifty-odd screens that import them from there are untouched.
 */

import type { Org } from './types';

export interface Vocab {
  job: string;
  jobPlural: string;
  customer: string;
  customerPlural: string;
  estimate: string;
  /** Shown on the pipeline board's first column. */
  lead: string;
}

/*
  Proposal, not estimate, and the same word for all three kinds.

  Three kinds of business meant three words for one document - estimate,
  proposal, quote - which read as three features. The sidebar said one, the
  job screen said another and the page a customer opened said a third, and
  nobody could search the product for the thing they were looking at.

  Proposal is the word that is true of all of them. An estimate is a guess at
  a number; what this document actually carries is scope, exclusions, terms,
  a deposit and a signature line, and a customer accepts or declines it. That
  is a proposal whoever sends it. A business that disagrees sets its own word,
  which is what `estimate_word` is for and why it keeps winning below.
*/
const CONTRACTOR: Vocab = {
  job: 'Job',
  jobPlural: 'Jobs',
  customer: 'Customer',
  customerPlural: 'Customers',
  estimate: 'Proposal',
  lead: 'Lead',
};

/*
  Projects, not engagements.

  "Engagement" is consultancy-speak. It is the word a firm uses on an invoice
  to a procurement department, and it means nothing to anybody standing in
  front of the actual work — Mike opened his own sidebar and could not say what
  the row was for or how it differed from Home. A word you have to translate
  before you can use the screen is a bad word, however correct it is.

  Project is what the thing is: a named piece of work for one client, with a
  start, a cost and an end. Same record, same table; the contractor still calls
  it a Job.
*/
const AGENCY: Vocab = {
  job: 'Project',
  jobPlural: 'Projects',
  customer: 'Client',
  customerPlural: 'Clients',
  estimate: 'Proposal',
  lead: 'Prospect',
};

/*
  A rep's words are neither set.

  He has no jobs and no customers in the sense either of the others mean. The
  companies on his Clients screen are the ones he REPRESENTS - they pay him,
  they do not buy from him.

  The document word used to be Quote here, because what a rep sends is priced
  off somebody else's sheet rather than estimated off his own costs. It is
  Proposal now like everywhere else: the distinction was real and invisible,
  and the one business it was drawn for had already overridden it to Proposal
  by hand.
*/
const REP: Vocab = {
  job: 'Project',
  jobPlural: 'Projects',
  customer: 'Principal',
  customerPlural: 'Principals',
  estimate: 'Proposal',
  lead: 'Buyer',
};

/**
 * "a" or "an", decided by the word rather than by the sentence.
 *
 * The words this is used on are the ones a business can change, so a
 * sentence that hardcodes the article is wrong for somebody: "an estimate"
 * and "an engagement" are right, "an quote" and "an proposal" are not.
 */
export const aWord = (word: string) =>
  `${/^[aeiou]/i.test(word.trim()) ? 'an' : 'a'} ${word.toLowerCase()}`;

/** First letter up, for a vocabulary word that has to open a sentence. */
export const capWord = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * The word for the thing you send before the invoice.
 *
 * Every kind says Proposal now. The override stays and still wins, because
 * this word is on a document a customer receives and a business that has
 * decided what to call its own paperwork outranks a default. One business has
 * set one, and it set it to Proposal.
 *
 * The rest of the vocabulary still comes from what kind of business it is.
 */
export const vocabFor = (kind: Org['kind'] | undefined, settings?: Record<string, unknown> | null): Vocab => {
  const base = kind === 'agency' ? AGENCY : kind === 'rep' ? REP : CONTRACTOR;
  const word = typeof settings?.estimate_word === 'string' ? settings.estimate_word.trim() : '';
  return word ? { ...base, estimate: word } : base;
};
