-- ============================================================================
-- PAYMENT METHODS
-- ============================================================================
-- Card processing costs about 2.9% everywhere. On a $19,433 remodel that is
-- $564 to move money that a bank transfer moves for $5. For a contractor
-- working in five-figure invoices, being forced through cards is a real cost.
--
-- So a business lists whatever it actually accepts — Venmo, PayPal, Zelle,
-- check, bank transfer, cash, card — and the customer picks. Card stops being
-- the only option and becomes the convenient one people pay a premium for.
--
-- WHAT IS DELIBERATELY NOT STORED: bank account and routing numbers. A Venmo
-- handle or a PayPal address is a public identifier — it is designed to be
-- shared, and knowing it lets someone send you money, not take it. Account and
-- routing numbers are the opposite, and holding them would make this database
-- worth attacking. Bank transfer says "ask for details" instead.
-- ============================================================================

alter table orgs add column if not exists payment_methods jsonb not null default '[]'::jsonb;

comment on column orgs.payment_methods is
  'How this business accepts money. Handles only — never account or routing numbers.';

-- ---------------------------------------------------------------------------
-- Invoices get their own public link, the same shape as estimates.
--
-- Without this, sending an invoice meant sending it through Stripe, which
-- meant card fees whether or not the customer wanted to pay by card.
-- ---------------------------------------------------------------------------

alter table job_invoices add column if not exists public_token text unique;
alter table job_invoices add column if not exists viewed_at timestamptz;
alter table job_invoices add column if not exists paid_via text;
alter table job_invoices add column if not exists payment_note text;

create index if not exists job_invoices_token_idx on job_invoices(public_token)
  where public_token is not null;

comment on column job_invoices.paid_via is
  'Which method the money actually arrived by. Worth knowing: it is what tells you whether card fees are worth what they cost you.';
