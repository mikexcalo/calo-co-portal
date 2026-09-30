-- ============================================================================
-- EVERY SEND LEAVES A RECORD
-- ============================================================================
-- A reminder went out on 29 Sept, the product said "Sent 1 reminder", and the
-- email never arrived. There was no way to find out what happened, because
-- there was nothing to look at: `postEmail` called Resend, read `res.ok`, and
-- threw the response body away. Resend returns a message id on every accepted
-- send and that id is the only handle on what the message did afterwards.
--
-- So a send that is accepted and then dropped, bounced, or filed as spam is
-- indistinguishable here from one sitting in somebody's inbox. "Sent" was
-- never a claim the product could support; it only ever knew "handed over".
--
-- This table is the difference. One row per attempt, written whatever the
-- outcome: handed over, refused by the send lock, skipped as a reserved test
-- address, or rejected by the provider with a reason.
--
-- WHY IT RECORDS SKIPS AND REFUSALS TOO
--
-- Those are the two cases most likely to be mistaken for delivery. A skipped
-- send to an @example.com demo contact returns ok to every caller on purpose,
-- and a refusal by the send lock is a 403 that a screen may summarise. Both
-- end with nothing in anybody's inbox, and both should be visible as exactly
-- that rather than absent.
-- ============================================================================

create table if not exists public.mail_sends (
  id uuid primary key default gen_random_uuid(),

  /**
   * Whose workspace the send was made from, where that is knowable.
   *
   * Null for a cron job or a webhook, which have no caller and no active org.
   * Those still get a row: an unattributed record beats no record.
   */
  org_id uuid references public.orgs(id) on delete cascade,

  to_email  text not null,
  subject   text,

  /**
   * What the message was about, where the caller knows.
   *
   * Loose on purpose - a table name and an id rather than a foreign key -
   * because mail is sent about six different kinds of thing and a column per
   * kind would be five nulls on every row. Nothing joins on it; it is there so
   * a screen showing an invoice can find the sends that mentioned it.
   */
  about_table text,
  about_id    uuid,

  provider    text not null default 'resend',
  /** Resend's message id. The handle on everything that happens next. */
  provider_id text,

  /**
   * What happened at the moment of sending, which is not the same question as
   * whether it arrived.
   *
   *   handed_over  the provider accepted it and gave us an id
   *   skipped      a reserved test address, never sent, on purpose
   *   refused      the send lock said no
   *   failed       the provider rejected it, with a reason in `detail`
   */
  outcome text not null
    check (outcome in ('handed_over', 'skipped', 'refused', 'failed')),
  detail  text,

  /**
   * What the provider says became of it, read back later.
   *
   * Separate from `outcome` because they answer different questions and the
   * gap between them is the whole point: `handed_over` with a `status` of
   * `bounced` is the case that went unnoticed for a week.
   */
  status    text,
  status_at timestamptz,

  created_at timestamptz not null default now()
);

create index if not exists mail_sends_org_idx
  on public.mail_sends(org_id, created_at desc);
create index if not exists mail_sends_about_idx
  on public.mail_sends(about_table, about_id, created_at desc);

alter table public.mail_sends enable row level security;

/*
  Readable by the workspace it was sent from, and by nobody else.

  A send record carries a customer's address and the subject line of a message
  about their money, so it belongs to the business that sent it on exactly the
  same terms as the invoice does.
*/
drop policy if exists mail_sends_read on public.mail_sends;
create policy mail_sends_read on public.mail_sends
  for select to authenticated
  using (org_id = current_org_id());

/*
  Written only by the service role.

  Rows are made inside `postEmail`, which runs on the server with the service
  key. There is no case where a browser should be able to write one: a mail
  record a client could forge is worse than none.
*/

comment on table public.mail_sends is
  'One row per attempted send. Records the provider message id so a silent non-delivery can be looked up rather than guessed at.';
