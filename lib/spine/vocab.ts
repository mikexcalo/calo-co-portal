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

const CONTRACTOR: Vocab = {
  job: 'Job',
  jobPlural: 'Jobs',
  customer: 'Customer',
  customerPlural: 'Customers',
  estimate: 'Estimate',
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
  companies on his Clients screen are the ones he REPRESENTS — they pay him,
  they do not buy from him — and what he sends a buyer is a quote off somebody
  else's sheet, not an estimate for work he will do.
*/
const REP: Vocab = {
  job: 'Project',
  jobPlural: 'Projects',
  customer: 'Principal',
  customerPlural: 'Principals',
  estimate: 'Quote',
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
 * Two kinds was one too few. A contractor sends an estimate, an agency sends a
 * proposal, and John — who distributes seafood — sends neither: he quotes. The
 * kind of business gets it right most of the time and the exception is not
 * rare enough to live with, because this word is on the document a client
 * receives.
 *
 * So the business can override it, and the rest of the vocabulary still comes
 * from what kind of business it is.
 */
export const vocabFor = (kind: Org['kind'] | undefined, settings?: Record<string, unknown> | null): Vocab => {
  const base = kind === 'agency' ? AGENCY : kind === 'rep' ? REP : CONTRACTOR;
  const word = typeof settings?.estimate_word === 'string' ? settings.estimate_word.trim() : '';
  return word ? { ...base, estimate: word } : base;
};
