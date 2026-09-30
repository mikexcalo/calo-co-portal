-- ============================================================================
-- AN ANSWER ENDS THE WAIT
-- ============================================================================
-- Harbor Light's Home said two things at once. "Dunmore Storage accepted
-- Burnet Rd unit 4 and 5 re-roof." sat at the top of the screen, and eight
-- rows down "3 people haven't replied" counted Dunmore among them.
--
-- `quiet_customers` asked only whether `awaiting_reply_since` was set and four
-- days old. Nothing ever cleared that column, so it recorded when the waiting
-- started and never that it had stopped. A customer who answers stays "quiet"
-- forever.
--
-- The route now clears it on any decision, which fixes it from here on. This
-- fixes the count for everything already recorded: a customer who decided
-- after the date you started waiting is not somebody you are waiting on.
--
-- Deliberately written as "decided on or after `awaiting_reply_since`" rather
-- than "has any accepted estimate". An estimate accepted in July says nothing
-- about a message sent in September, and Costa is exactly that case: accepted
-- 13 July, chased again 2 September, still genuinely quiet.
-- ============================================================================

create or replace function public.home_signals()
returns table (
  customers_no_email   integer,
  unconfirmed_prices   integer,
  draft_estimates      integer,
  stale_estimates      integer,
  expiring_records     integer,
  docs_needing_review  integer,
  open_requests        integer,
  jobs_no_customer     integer,
  customer_count       integer,
  quiet_customers      integer,
  reminders_due        integer
)
language sql
stable
set search_path to 'public'
as $function$
  select
    (select count(*) from customers
      where email is null and stage in ('won','past')
        and coalesce(relationship,'customer') = 'customer')::int,
    (select count(*) from price_items where confirmed = false)::int,
    (select count(*) from estimates where status = 'draft')::int,
    (select count(*) from estimates
      where status = 'sent' and sent_at < now() - interval '7 days')::int,
    (select count(*) from business_files
      where expires_on is not null and expires_on <= current_date + 45)::int,
    (select count(*) from documents where status = 'needs_review')::int,
    (select count(*) from site_requests where status in ('submitted','needs_info'))::int,
    (select count(*) from jobs
      where customer_id is null and status not in ('closed','lost'))::int,
    (select count(*) from customers)::int,
    (select count(*) from customers c
      where c.awaiting_reply_since is not null
        and c.awaiting_reply_since <= current_date - 4
        and not exists (
          select 1
            from estimates e
            join jobs j on j.id = e.job_id
           where j.customer_id = c.id
             and e.decided_at is not null
             and e.decided_at::date >= c.awaiting_reply_since
        ))::int,
    (select count(*) from reminders
      where done_at is null and due_on <= current_date)::int
$function$;

comment on function public.home_signals() is
  'Counts behind the Needs you list on Home. quiet_customers excludes anybody who answered after the date the waiting started, so an acceptance and a chase cannot both be true of the same person on the same screen.';

-- ---------------------------------------------------------------------------
-- The two rows the demo already carries.
--
-- The function above makes the count right without touching anybody's data,
-- which is what it is for: no real workspace has its records rewritten by a
-- Home fix. These two are demo fixtures in Harbor Light, and they are what a
-- reviewer opens, so they are corrected in place as well.
-- ---------------------------------------------------------------------------

-- Dunmore answered on 26 September. Nobody is waiting on them.
update public.customers c
   set awaiting_reply_since = null
  from public.orgs o
 where o.id = c.org_id
   and o.slug = 'harbor-light-demo'
   and c.awaiting_reply_since is not null
   and exists (
     select 1 from public.estimates e
       join public.jobs j on j.id = e.job_id
      where j.customer_id = c.id
        and e.decided_at is not null
        and e.decided_at::date >= c.awaiting_reply_since
   );

/*
  `accepted` has to be a kind before anything can be one.

  `notifications_kind_check` is an allow-list, so both the route and the
  backfill below would be refused without this. Added rather than dropped: an
  open column is how a typo becomes a kind nobody renders.
*/
alter table public.notifications
  drop constraint if exists notifications_kind_check;

alter table public.notifications
  add constraint notifications_kind_check
  check (kind in ('system', 'lead', 'invoice_overdue', 'accepted'));

/*
  The acceptance that appeared twice, once with no thousands separator.

  `AskedOfYou` lists unread `system` notifications under "Waiting on you", so
  this showed there as well as in "Just accepted", written "$24680.00" in one
  place and "$24,680.00" in the other. Its own kind keeps it in the bell and
  off the list of things still to do, and the body is rewritten the way the
  rest of the product writes money.
*/
update public.notifications n
   set kind = 'accepted',
       body = regexp_replace(n.body, '\$([0-9]+)([0-9]{3}\.[0-9]{2})', '$\1,\2')
  from public.orgs o
 where o.id = n.org_id
   and n.kind = 'system'
   and n.title like '%accepted your%';
