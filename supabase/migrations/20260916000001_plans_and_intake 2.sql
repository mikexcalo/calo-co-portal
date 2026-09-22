-- ============================================================================
-- PLANS, PER-CLIENT MODULES, AND A PUBLIC WAY IN
-- ============================================================================

-- ---------------------------------------------------------------------------
-- What a business is paying for.
--
-- The plan sets the default module list. orgs.modules still overrides it in
-- both directions, which is what makes "set it up for them, hand it over when
-- they pay" a flag rather than a deployment. It also means a module can be
-- switched on for one client as a thank you without inventing a plan for them.
-- ---------------------------------------------------------------------------

alter table public.orgs
  add column if not exists plan text not null default 'core'
    check (plan in ('core', 'grow', 'agency'));

comment on column public.orgs.plan is
  'What they pay for. Sets the default module list; orgs.modules overrides it either way.';

-- ---------------------------------------------------------------------------
-- The public way in.
--
-- A link a business can put on a yard sign, an email footer, or their website,
-- which drops an enquiry straight into the client list.
--
-- A token rather than the org id, because the id appears in internal URLs and
-- a public form should not be a place where internal identifiers are learned.
-- ---------------------------------------------------------------------------

alter table public.orgs
  add column if not exists intake_token text unique;

update public.orgs
   set intake_token = encode(gen_random_bytes(9), 'hex')
 where intake_token is null;

comment on column public.orgs.intake_token is
  'Public token for the enquiry form. Separate from the org id so a public page never reveals an internal identifier.';

-- ---------------------------------------------------------------------------
-- Chasing, without chasing twice.
--
-- An estimate sent and never opened, and an invoice past its date, are the two
-- places money quietly goes missing. Both are already visible on a screen, and
-- a screen is only useful to somebody who opens it.
--
-- The stamps live on the row rather than in a log, because the only question
-- ever asked is "have we already nudged this one, and when".
-- ---------------------------------------------------------------------------

alter table public.estimates
  add column if not exists nudged_at timestamptz;

alter table public.job_invoices
  add column if not exists nudged_at timestamptz;

-- ---------------------------------------------------------------------------
-- Who to chase.
--
-- Deliberately conservative on both. An estimate gets one nudge after four
-- days, not a sequence: a second reminder about a quote reads as needing the
-- work, which is the wrong position to negotiate from. An invoice gets one a
-- week, because that one is owed.
-- ---------------------------------------------------------------------------

create or replace view public.follow_ups as
  select
    'estimate'::text as kind,
    e.id,
    e.org_id,
    e.public_token as token,
    c.name  as customer_name,
    c.email as customer_email,
    j.name  as job_name,
    e.total as amount,
    e.sent_at::date as sent_on,
    (current_date - e.sent_at::date) as days,
    e.nudged_at
  from estimates e
  join jobs j on j.id = e.job_id
  left join customers c on c.id = j.customer_id
  where e.status = 'sent'
    and e.sent_at is not null
    and c.email is not null
    and e.sent_at::date <= current_date - 4
    -- Give up after three weeks. A quote nobody answered in that time is a no.
    and e.sent_at::date >= current_date - 21
    and e.nudged_at is null

  union all

  select
    'invoice'::text,
    i.id,
    i.org_id,
    i.public_token,
    c.name,
    c.email,
    j.name,
    (i.total - i.amount_paid),
    i.due_on,
    (current_date - i.due_on),
    i.nudged_at
  from job_invoices i
  left join jobs j on j.id = i.job_id
  left join customers c on c.id = j.customer_id
  where i.status <> 'void'
    and i.due_on < current_date
    and i.total > i.amount_paid
    and c.email is not null
    and (i.nudged_at is null or i.nudged_at < now() - interval '7 days');

comment on view public.follow_ups is
  'Quotes gone quiet and invoices past due. One nudge for a quote because a second reads as needing the work; weekly for an invoice because that one is owed.';
