/**
 * The questions this product can answer about its own data.
 *
 * WHY THIS IS A FIXED LIST AND NOT GENERATED SQL
 *
 * The obvious build is to let a model write SQL against the schema. It demos
 * beautifully and it is the wrong shape here, for two reasons.
 *
 * Safety: generated SQL against a multi-tenant database is one missing where
 * clause away from returning another business's invoices. Row level security
 * would catch most of it, and "most" is not a standard worth accepting on
 * somebody's customer list.
 *
 * Arithmetic: a model asked "who owes me money" from a dump of forty invoices
 * will usually add them up correctly. Usually is the problem. These queries
 * are answered by Postgres, and the model's only job is deciding which
 * question was asked.
 *
 * So the model classifies and the database answers. The failure mode becomes
 * "it picked the wrong question", which the person reading it spots
 * immediately, rather than "the number is subtly wrong", which nobody spots.
 */

export interface Question {
  id: string;
  /** Shown when the model cannot match anything, so the list is discoverable. */
  example: string;
  /** What this answers, for the classifier. */
  description: string;
  /**
   * The query itself lives in the answer_question() migration, not here.
   *
   * One copy, in the place where row level security applies to it. A second
   * copy in TypeScript would be the one that drifts, and it would drift
   * silently because nothing executes it.
   *
   * What lives here is the wording: what to call the question, and how to say
   * the answer out loud.
   */
  /** Turns rows into a sentence a person reads, in plain language. */
  format: (rows: Record<string, unknown>[]) => string;
}

const money = (n: unknown) =>
  `$${Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const list = (items: string[], limit = 8) => {
  const shown = items.slice(0, limit);
  const rest = items.length - shown.length;
  return shown.join('\n') + (rest > 0 ? `\n…and ${rest} more` : '');
};

export const QUESTIONS: Question[] = [
  {
    id: 'who_owes_money',
    example: 'Who owes me money?',
    description: 'Customers with unpaid or part-paid invoices, and how much each owes.',
    format: (rows) => {
      if (!rows.length) return 'Nobody owes you anything right now.';
      const total = rows.reduce((s, r) => s + Number(r.owed ?? 0), 0);
      return (
        `${money(total)} outstanding across ${rows.length} ${rows.length === 1 ? 'customer' : 'customers'}.\n\n` +
        list(rows.map((r) => `${r.customer}: ${money(r.owed)}${r.oldest_due ? `, oldest due ${r.oldest_due}` : ''}`))
      );
    },
  },
  {
    id: 'overdue_invoices',
    example: 'What is past due?',
    description: 'Invoices whose due date has passed and are not fully paid.',
    format: (rows) => {
      if (!rows.length) return 'Nothing is past due.';
      const total = rows.reduce((s, r) => s + Number(r.owed ?? 0), 0);
      return (
        `${rows.length} past due, ${money(total)} in total.\n\n` +
        list(rows.map((r) => `${r.customer}: ${money(r.owed)}, ${r.days_late} days late`))
      );
    },
  },
  {
    id: 'unbilled_work',
    example: 'What have I done but not billed?',
    description: 'Work and costs recorded against jobs that have not been put on an invoice yet.',
    format: (rows) => {
      if (!rows.length) return 'Everything you have logged has been billed.';
      const total = rows.reduce((s, r) => s + Number(r.unbilled ?? 0), 0);
      return (
        `${money(total)} of work logged and not yet invoiced.\n\n` +
        list(rows.map((r) => `${r.name}: ${money(r.unbilled)}`))
      );
    },
  },
  {
    id: 'job_margin',
    example: 'Which jobs are making money?',
    description: 'Profit or loss so far on each job, worst first.',
    format: (rows) => {
      if (!rows.length) return 'No jobs have money on them yet.';
      const losing = rows.filter((r) => Number(r.margin_to_date) < 0);
      const head = losing.length
        ? `${losing.length} ${losing.length === 1 ? 'job is' : 'jobs are'} underwater.\n\n`
        : 'Every job with money on it is ahead.\n\n';
      return head + list(rows.map((r) => `${r.name}: ${money(r.margin_to_date)}`));
    },
  },
  {
    id: 'this_week',
    example: 'What is happening this week?',
    description: 'Scheduled work in the next seven days across every job.',
    format: (rows) => {
      if (!rows.length) return 'Nothing scheduled in the next seven days.';
      return (
        `${rows.length} ${rows.length === 1 ? 'thing' : 'things'} scheduled.\n\n` +
        list(rows.map((r) => `${r.starts_on}: ${r.name}, ${r.customer_name ?? r.job_name}${r.assignee ? ` (${r.assignee})` : ''}`), 12)
      );
    },
  },
  {
    id: 'late_work',
    example: 'What is running late?',
    description: 'Scheduled steps that should have finished and have not.',
    format: (rows) => {
      if (!rows.length) return 'Nothing is running late.';
      return (
        `${rows.length} ${rows.length === 1 ? 'step is' : 'steps are'} late.\n\n` +
        list(rows.map((r) => `${r.name} on ${r.customer_name ?? r.job_name}: ${r.days_late} days late`))
      );
    },
  },
  {
    id: 'quiet_clients',
    example: 'Who has gone quiet on me?',
    description: 'Customers who were contacted and have not replied.',
    format: (rows) => {
      if (!rows.length) return 'Nobody owes you a reply.';
      return (
        `${rows.length} ${rows.length === 1 ? 'person has' : 'people have'} not replied.\n\n` +
        list(rows.map((r) => `${r.name}: ${r.days_waiting} days since you reached out`))
      );
    },
  },
  {
    id: 'revenue_this_year',
    example: 'How much have I made this year?',
    description: 'Invoiced and collected totals for the current calendar year.',
    format: (rows) => {
      const r = rows[0] ?? {};
      if (!Number(r.invoices)) return 'Nothing invoiced yet this year.';
      return `${money(r.invoiced)} invoiced this year across ${r.invoices} invoices. ${money(r.collected)} of it has been paid.`;
    },
  },
  {
    id: 'open_jobs',
    example: 'What am I working on?',
    description: 'Jobs that are currently open or in progress.',
    format: (rows) => {
      if (!rows.length) return 'No open jobs.';
      return (
        `${rows.length} open.\n\n` +
        list(rows.map((r) => `${r.name}${r.customer ? `, ${r.customer}` : ''} (${r.status})`))
      );
    },
  },
  {
    id: 'tax_set_aside',
    example: 'How much should I be setting aside for tax?',
    description: 'The tax hold-back on money actually collected this year.',
    format: (rows) => {
      const r = rows[0] ?? {};
      if (r.pct == null) return 'No set-aside rate has been chosen yet. Business, What you charge.';
      const amount = (Number(r.collected) * Number(r.pct)) / 100;
      return `${money(amount)}, which is ${r.pct}% of the ${money(r.collected)} you have collected this year.`;
    },
  },
];

export const QUESTION_IDS = QUESTIONS.map((q) => q.id);
