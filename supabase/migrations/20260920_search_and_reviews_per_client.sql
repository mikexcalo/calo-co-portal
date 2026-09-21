-- ============================================================================
-- SEARCH AND REVIEWS, FOR A CLIENT RATHER THAN A WORKSPACE
-- ============================================================================
-- Both were attached to the workspace. That is right for Mammoth running their
-- own, and wrong for an agency doing it on their behalf, which is the thing
-- being sold.
--
-- The effect was that the only way to set up Mammoth's search was to switch
-- into Mammoth's workspace, so the work you sold could not be done from the
-- place you sold it. And the review link was one per workspace, so an agency
-- could hold exactly one of them.
--
-- The pattern is already right elsewhere: brands and case studies both carry a
-- client, null meaning it is your own. This makes search and reviews match.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Search profile: one per client, plus one for yourself.
--
-- The primary key was org_id, which is what made it one per workspace. It
-- becomes a surrogate key with a uniqueness rule that treats "mine" as a
-- distinct row rather than a special case.
-- ---------------------------------------------------------------------------

alter table public.seo_profile drop constraint if exists seo_profile_pkey;

alter table public.seo_profile
  add column if not exists id uuid not null default gen_random_uuid();

alter table public.seo_profile
  add column if not exists customer_id uuid references customers(id) on delete cascade;

alter table public.seo_profile add primary key (id);

/**
 * Null means your own business.
 *
 * Coalesced to a fixed uuid rather than left null, because a unique index
 * ignores null and would happily allow two "your own" profiles.
 */
create unique index if not exists seo_profile_one_per_client
  on public.seo_profile(org_id, coalesce(customer_id, '00000000-0000-0000-0000-000000000000'::uuid));

comment on column public.seo_profile.customer_id is
  'Whose search this is. Null means your own business, which is why the unique index coalesces it rather than relying on null.';

-- ---------------------------------------------------------------------------
-- Tasks and directories follow the profile.
-- ---------------------------------------------------------------------------

alter table public.seo_tasks
  add column if not exists customer_id uuid references customers(id) on delete cascade;

drop index if exists seo_tasks_one_per_key;
create unique index if not exists seo_tasks_one_per_key
  on public.seo_tasks(org_id, coalesce(customer_id, '00000000-0000-0000-0000-000000000000'::uuid), key);

alter table public.seo_citations
  add column if not exists customer_id uuid references customers(id) on delete cascade;

drop index if exists seo_citations_one_per_name;
create unique index if not exists seo_citations_one_per_name
  on public.seo_citations(org_id, coalesce(customer_id, '00000000-0000-0000-0000-000000000000'::uuid), name);

-- ---------------------------------------------------------------------------
-- The review link belongs to the business being reviewed.
--
-- On the client rather than a separate table: it is one string about them, the
-- same way their website is, and a table holding one column per client would
-- be a join for nothing.
-- ---------------------------------------------------------------------------

alter table public.customers
  add column if not exists review_link text;

comment on column public.customers.review_link is
  'This client''s own Google review link, when you run reviews for them. The workspace link is used when this is null.';

-- ---------------------------------------------------------------------------
-- Asking uses whichever link applies.
--
-- The client's own link wins; the workspace link is the fallback. Which means
-- a contractor running their own reviews sets it once on the business and
-- never thinks about it, and an agency sets it per client, and neither has to
-- know the other case exists.
-- ---------------------------------------------------------------------------

create or replace view public.review_due as
  select
    j.id          as job_id,
    j.org_id,
    j.customer_id,
    j.name        as job_name,
    c.name        as customer_name,
    c.email       as customer_email,
    j.completed_on,
    coalesce(c.review_link, o.review_link) as review_link,
    o.review_delay_days
  from jobs j
  join orgs o on o.id = j.org_id
  left join customers c on c.id = j.customer_id
  where j.status = 'complete'
    and j.completed_on is not null
    and coalesce(c.review_link, o.review_link) is not null
    and c.email is not null
    and j.completed_on <= current_date - o.review_delay_days
    and j.completed_on >= current_date - 30
    and not exists (select 1 from review_requests r where r.job_id = j.id)
    and not exists (
      select 1 from job_invoices i
      where i.job_id = j.id
        and i.status <> 'void'
        and i.total > i.amount_paid
    );

-- The hop has to resolve the same way, or a click would land somewhere the ask
-- did not point at.
create or replace function public.follow_review(t text)
returns text
language plpgsql
security definer
set search_path = public
as $function$
declare
  dest text;
begin
  update review_requests r
     set clicked_at = coalesce(r.clicked_at, now())
    from orgs o
    left join customers c on c.id = (select customer_id from review_requests where token = t)
   where r.token = t
     and o.id = r.org_id
  returning coalesce(c.review_link, o.review_link) into dest;

  return dest;
end;
$function$;
