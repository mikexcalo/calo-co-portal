-- ============================================================================
-- THE THREE THINGS AN AGENCY NEEDS THAT A CONTRACTOR DOES NOT
-- ============================================================================
-- Non-cash payment, flat retainers, and a written scope. Each exists because
-- of one sentence: a contractor sells a defined thing and carries schedule
-- risk, an agency sells judgement and carries scope risk, and sometimes gets
-- paid in something other than money.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. PAID IN SOMETHING THAT IS NOT MONEY
--
-- Colette pays in equity. The platform had no field anywhere that could hold
-- that, so Colette showed nothing invoiced, nothing owed and nothing unbilled,
-- which reads exactly like a client who never paid. That was not a gap, it was
-- a false statement, and profit and loss repeated it.
--
-- Held on the engagement rather than on the client, because the same client
-- can pay cash for one piece of work and equity for another, and usually
-- eventually does.
-- ---------------------------------------------------------------------------

alter table public.jobs
  add column if not exists consideration text not null default 'cash'
    check (consideration in ('cash', 'equity', 'trade', 'pro_bono', 'deferred'));

comment on column public.jobs.consideration is
  'What you are actually being paid in. cash is the default; the rest exist so that work paid for in another way stops looking like work nobody paid for.';

/**
 * What the non-cash arrangement is, in words.
 *
 * Deliberately text rather than a number. "0.5% on a 4 year vest with a 1 year
 * cliff" is the real answer and no amount column can hold it. Putting a
 * guessed dollar value on equity in your own P&L is how a business talks
 * itself into believing something it has not been paid.
 */
alter table public.jobs
  add column if not exists consideration_note text;

comment on column public.jobs.consideration_note is
  'The non-cash terms in plain words. Not valued, on purpose: a guessed valuation in your own accounts is a story, not a number.';


-- ---------------------------------------------------------------------------
-- 2. RETAINERS THAT HOLD A FEE
--
-- billing_type allowed fixed and tm. A billing period then billed whatever
-- hours had been logged, which is progress billing. An agency retainer is a
-- flat monthly amount whether or not an hour was logged.
--
-- The schema was already contradicting itself: orgs.billing_style accepted
-- 'retainer' while no engagement could be one.
-- ---------------------------------------------------------------------------

alter table public.jobs drop constraint if exists jobs_billing_type_check;
alter table public.jobs add constraint jobs_billing_type_check
  check (billing_type in ('fixed', 'tm', 'retainer'));

alter table public.jobs
  add column if not exists retainer_amount numeric(12,2)
    check (retainer_amount is null or retainer_amount >= 0);

/**
 * The hours the fee assumes.
 *
 * This is the whole reason to build retainers rather than just tagging them.
 * The invoice on a flat monthly is never the interesting number, because it is
 * the same every month by definition. The interesting number is the month you
 * did sixty hours against a fee that assumed twenty, and without a stated
 * expectation there is nothing to compare against. That is how retainers go
 * bad, and they go bad quietly.
 */
alter table public.jobs
  add column if not exists retainer_hours numeric(6,2)
    check (retainer_hours is null or retainer_hours >= 0);

comment on column public.jobs.retainer_hours is
  'Hours the monthly fee assumes. Exists so overdelivery is visible, which is the only reason a flat fee needs software at all.';

-- A retainer with no fee is an engagement nobody will remember to bill.
alter table public.jobs drop constraint if exists jobs_retainer_has_amount;
alter table public.jobs add constraint jobs_retainer_has_amount
  check (billing_type <> 'retainer' or retainer_amount is not null);


-- ---------------------------------------------------------------------------
-- 3. WHAT WAS BOUGHT, AND WHAT WAS NOT
--
-- An accepted estimate recorded a number, a date and a name, but never what
-- the number was for. For a contractor that is survivable, because a bathroom
-- is a bathroom. For brand and messaging work "a website" means four pages to
-- one party and eleven to the other, and the disagreement surfaces in week six.
--
-- On the estimate rather than the engagement, because the estimate is already
-- the thing the client reads and accepts by name. A scope the client never saw
-- settles no argument.
-- ---------------------------------------------------------------------------

alter table public.estimates
  add column if not exists scope_in jsonb not null default '[]'::jsonb;

alter table public.estimates
  add column if not exists scope_out jsonb not null default '[]'::jsonb;

comment on column public.estimates.scope_out is
  'What this price does not cover. The more valuable of the two lists, and the one nobody writes without being asked.';


-- ---------------------------------------------------------------------------
-- 4. TAX SET ASIDE
--
-- Nobody withholds anything on behalf of someone self employed. Overheads
-- tracked spending and profit and loss reported earnings, but nothing moved a
-- share of each payment into a column marked do not touch.
--
-- Kept on the business rather than in a separate ledger, because the balance
-- is a calculation over money already recorded. A second store of the same
-- fact would drift, and the one that drifts is always the one you check.
--
-- This is per business, so Mammoth gets it too. Their exposure is the same as
-- yours the moment they take card payments.
-- ---------------------------------------------------------------------------

alter table public.orgs
  add column if not exists tax_set_aside_pct numeric(5,2)
    check (tax_set_aside_pct is null or (tax_set_aside_pct >= 0 and tax_set_aside_pct <= 60));

comment on column public.orgs.tax_set_aside_pct is
  'Share of collected income to hold back for tax. Null means the owner has not chosen one, which is different from choosing zero.';

alter table public.orgs
  add column if not exists tax_set_aside_note text;
