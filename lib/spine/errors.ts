/**
 * Turning what the database said into what a person needs to hear.
 *
 * "Could not find the table 'public.drops' in the schema cache" went on a
 * client's screen. It names a table she has never heard of, implies she broke
 * it, and does not answer the only three questions anybody has: what
 * happened, was it my fault, and is trying again worth it.
 *
 * Deliberately short. A message that explains the architecture is still a
 * message written for the person who built it.
 */

/**
 * What a message has to answer, in this order.
 *
 *   1. What happened, in the reader's terms.
 *   2. Whether anything was saved. This is the question people actually have
 *      and it was the one always left out.
 *   3. The one thing to do next, with a real route where a route is the
 *      answer.
 *
 * Tell Us is that route. It is a button in the sidebar of every workspace and
 * it writes a row somebody reads, which is the difference between a next step
 * and the words "tell us" with nothing behind them.
 */
const TELL_US = 'If it keeps happening, use Tell Us and we will look.';

/**
 * The fallback for a write, when nothing matched.
 *
 * It still answers all three. "Nothing was saved" is safe to assert here
 * because save() only reaches this after the server has answered with an
 * error - a refused write wrote nothing. The one case where that is not known
 * is a connection that died mid-request, and that has its own branch below
 * which deliberately does not claim either way.
 */
export const WRITE_FAILED =
  `Nothing was saved. We could not tell why. Check your connection and try again. ${TELL_US}`;

/**
 * The fallback for a read. Says nothing about saving, because nothing was
 * being saved, and a message claiming otherwise is noise at best.
 */
export const READ_FAILED =
  `That did not load, and we could not tell why. Reload the screen and try again. ${TELL_US}`;

/**
 * Constraints worth naming.
 *
 * Postgres puts the constraint's name in the message, so a failure that has a
 * knowable cause can be turned into the sentence somebody needs rather than
 * into "check the fields". These are the five paths people use most -
 * invoices, estimates, jobs, customers, time - and the failures they can
 * actually produce.
 *
 * Keyed on the constraint name rather than on the text around it, because the
 * text varies by Postgres version and the name does not.
 */
const BY_CONSTRAINT: Array<[string, string]> = [
  [
    'job_invoices_org_id_number_key',
    `There is already an invoice with that number. Nothing was saved. Give this one a different number and save again.`,
  ],
  [
    'estimates_job_id_version_key',
    `Another version of this was saved while you were working on it. Nothing was saved, and your text is still on screen. Open the job in a new tab to see the newer version before you save over it.`,
  ],
  [
    'jobs_retainer_has_amount',
    `A retainer needs an amount. Nothing was saved. Fill in what the retainer is worth, or change how this is billed.`,
  ],
  [
    'jobs_retainer_amount_check',
    `A retainer amount cannot be negative. Nothing was saved. Check the number and save again.`,
  ],
  [
    'jobs_retainer_hours_check',
    `Retainer hours cannot be negative. Nothing was saved. Check the number and save again.`,
  ],
  [
    'time_entries_job_id_fkey',
    `The job these hours belong to is no longer there. Nothing was saved. Reload the screen; if the job was removed, log the hours against another one.`,
  ],
  [
    'job_invoices_job_id_fkey',
    `The job this invoice belongs to is no longer there. Nothing was saved. Reload the screen and check the job still exists.`,
  ],
  [
    'estimates_job_id_fkey',
    `The job this belongs to is no longer there. Nothing was saved. Reload the screen and check the job still exists.`,
  ],
  [
    'jobs_customer_id_fkey',
    `That customer is no longer there. Nothing was saved. Reload the screen and pick the customer again.`,
  ],
];

/**
 * Columns worth naming, for the two failures that carry one: a required field
 * left empty, and a value the column will not take.
 *
 * Anything not on this list falls through to its column name, which is ugly
 * and honest. The fix is to add the word here rather than to invent a
 * friendlier guess.
 */
const FIELD_WORDS: Record<string, string> = {
  hours: 'A number of hours',
  rate: 'A rate',
  amount: 'An amount',
  total: 'A total',
  number: 'An invoice number',
  name: 'A name',
  worked_on: 'The date the work was done',
  purchased_on: 'The date it was bought',
  due_on: 'A due date',
  job_id: 'A job',
  customer_id: 'A customer',
  org_id: 'A workspace',
  status: 'A status',
  billing_type: 'A way of billing it',
  stage: 'A stage',
  relationship: 'A kind of contact',
};

const word = (col: string) => FIELD_WORDS[col] ?? `The field "${col}"`;

export function human(raw: unknown, fallback = WRITE_FAILED): string {
  /*
    message, details and hint together.

    PostgREST splits a failure across all three: the constraint name is in
    `message`, the column and the offending value are in `details`, and the
    way out is sometimes in `hint`. Reading only `message` is why a unique
    violation on an invoice number used to come out as "that already exists"
    with no idea what already existed.
  */
  const parts: string[] = [];
  if (raw instanceof Error) parts.push(raw.message);
  else if (typeof raw === 'string') parts.push(raw);
  else if (typeof raw === 'object' && raw) {
    const o = raw as Record<string, unknown>;
    for (const k of ['message', 'details', 'hint'] as const) {
      if (typeof o[k] === 'string' && o[k]) parts.push(o[k] as string);
    }
  }
  const msg = parts.join(' | ');

  if (!msg) return fallback;

  /*
    Messages that are already a person's sentence, passed through word for
    word.

    Everything else in this function translates a database message. These two
    were written for a reader and already answer the three questions, and
    running them through the fallback turned "nothing was saved, and here is
    how to save it" into "we could not tell why" - which is wrong, because we
    could.
  */
  if (/^Nothing was saved\. View mode/.test(msg)) return msg;
  if (/^Nothing was sent\./.test(msg)) return msg;

  /* A named constraint beats every guess below it. */
  for (const [name, sentence] of BY_CONSTRAINT) {
    if (msg.includes(name)) return sentence;
  }

  /*
    A required field left empty.

    Postgres says: null value in column "hours" of relation "time_entries"
    violates not-null constraint. The column is the whole answer, and this was
    previously flattened into "check the fields and try again" on a form with
    fourteen of them.
  */
  const missing = msg.match(/null value in column "([^"]+)"/i);
  if (missing) {
    return `${word(missing[1])} is needed. Nothing was saved. Fill it in and save again.`;
  }

  // A missing table or column means a database change has not been applied.
  // Nothing the person did, and nothing trying again will fix.
  if (/schema cache|does not exist|relation .* does not exist|column .* does not exist/i.test(msg)) {
    return `This part is not switched on yet — a database change behind it has not been applied. Nothing you did, and nothing was saved. ${TELL_US}`;
  }
  if (/row-level security|permission denied|not authorized|403/i.test(msg)) {
    return 'Nothing was saved. You do not have access to do that here. Ask whoever set this workspace up to give you it.';
  }
  if (/duplicate key|already exists|unique constraint/i.test(msg)) {
    return 'That already exists. Nothing was saved. Look for the existing one rather than adding it again.';
  }
  if (/violates check constraint/i.test(msg)) {
    /* The constraint name usually carries the column: jobs_status_check. */
    /* The raw column reads better here than a looked-up phrase: "The stage
       you chose" is grammatical for every column, where "A stage is not one
       of the values" is grammatical for none of them. */
    const col = msg.match(/constraint "[a-z_]*?_([a-z_]+)_check"/i);
    return col
      ? `The ${col[1].replace(/_/g, ' ')} you chose is not one this accepts. Nothing was saved. Change it and save again.`
      : 'Something in that is not a value this will accept. Nothing was saved. Check the fields and save again.';
  }
  if (/invalid input|out of range|numeric field overflow/i.test(msg)) {
    return 'One of the numbers is not a number this will take. Nothing was saved. Check it and save again.';
  }
  if (/foreign key/i.test(msg)) {
    return 'That is still attached to something else, so it cannot be changed on its own. Nothing was saved. Detach it first, then try again.';
  }
  if (/jwt|token|session|401/i.test(msg)) {
    return 'Nothing was saved. Your sign-in has expired. Reload the page, sign in again, and redo this.';
  }
  /*
    The one case where we genuinely do not know.

    The request may have reached the server and been written before the
    connection dropped, so claiming either way would be a guess about somebody
    else's data. It says so, and the next step is to look rather than to
    retry - a blind retry is how one invoice becomes two.
  */
  if (/network|failed to fetch|timeout|econn/i.test(msg)) {
    /* A load and a save have different questions. "We cannot tell whether
       this saved" on a screen that was only reading is an invitation to
       worry about something that never happened; the caller says which by
       which fallback it asked for. */
    return fallback === READ_FAILED
      ? 'The server did not answer, so this screen has nothing to show. Check your connection and reload.'
      : 'The server did not answer, so we cannot tell whether this saved. Check your connection, then reload the screen and look before trying again.';
  }
  if (/payload too large|size/i.test(msg) && /large|exceed/i.test(msg)) {
    return 'That file is too big, so nothing was saved. Try a smaller one.';
  }
  return fallback;
}

/**
 * WHAT AN API ROUTE SHOULD HAND BACK.
 *
 * Twenty-two of them returned error.message straight from Postgres or an
 * upstream API, into the browser. It is how a JSON schema complaint and a
 * request id ended up in the answer box on Home, and how a client could be
 * shown "duplicate key value violates unique constraint".
 *
 * The real message is worth having, so it goes to the server log where it is
 * searchable and nobody has to read it. What comes back is human(): the same
 * translation the database layer has used for months.
 *
 * Returns the body to send, not a Response, so the caller keeps the status
 * code — a 502 and a 500 mean different things to the thing that called it.
 */
export function apiError(where: string, raw: unknown, fallback?: string): { error: string } {
  const detail = raw instanceof Error ? raw.message : String((raw as { message?: unknown })?.message ?? raw);
  console.error(`[${where}]`, detail);
  return { error: human(raw, fallback) };
}
