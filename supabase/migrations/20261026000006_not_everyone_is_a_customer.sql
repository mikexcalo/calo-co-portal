-- A company you deal with is not necessarily a company you sell to.
--
-- Austin Energy is the utility Mark files permits with. Sysco is a distributor
-- John watches prices from and never sells to. Neither is a customer, and both
-- ended up in the customer list because that was the only list a company could
-- be in — which puts them in the count you measure revenue against and offers
-- to invoice them.
--
-- A fourth module was the obvious answer and the wrong one. This is one fact
-- about a company, not a separate kind of thing with its own screens, its own
-- notes and its own empty state. Price lists already carry the same
-- distinction from the other direction — belongs_to is ours or supplier — so
-- this is that field arriving on the company it belongs to.

alter table public.customers
  add column if not exists relationship text not null default 'customer'
    check (relationship in ('customer', 'supplier', 'other'));

comment on column public.customers.relationship is
  'customer: somebody you sell to. supplier: somebody you buy from — a warehouse, a distributor. other: a company you deal with but no money moves either way, like the utility you file permits with. Only customers are counted as revenue or offered an invoice.';

create index if not exists customers_relationship
  on public.customers (org_id, relationship);

-- The stage lane only means something for somebody you are selling to. A
-- supplier is not "won", and leaving them at a sales stage is what made them
-- show up in the pipeline being chased.
update public.customers set stage = 'won'
 where relationship <> 'customer' and stage not in ('won', 'past');

-- ---------------------------------------------------------------------------
-- Carried onto the view the Clients screen reads.
-- ---------------------------------------------------------------------------

create or replace view public.customer_summary as
 SELECT c.id AS customer_id, c.org_id, c.name,
    COALESCE(c.contact_name, pc.name) AS contact_name,
    COALESCE(c.contact_title, pc.title) AS contact_title,
    COALESCE(c.email, pc.email) AS email,
    COALESCE(c.phone, pc.phone) AS phone,
    c.avatar_url, c.stage, c.next_action, c.next_action_on,
    c.last_contacted_on,
    COALESCE(j.job_count, 0::bigint) AS jobs,
    COALESCE(j.open_jobs, 0::bigint) AS open_jobs,
    COALESCE(l.invoiced, 0::numeric) AS invoiced,
    COALESCE(l.collected, 0::numeric) AS collected,
    COALESCE(l.invoiced, 0::numeric) - COALESCE(l.collected, 0::numeric) AS owed,
    COALESCE(l.unbilled, 0::numeric) AS unbilled,
    n.last_note_on, c.brief,
    c.workspace_id IS NOT NULL AS has_login,
    c.logo_url,
    public.customer_logo_path(c.id) AS logo_path,
    c.waiting_on,
    -- Appended, because replacing a view can only add columns at the end.
    c.relationship
   FROM customers c
     LEFT JOIN LATERAL (
       SELECT cc.name, cc.title, cc.email, cc.phone
         FROM customer_contacts cc
        WHERE cc.customer_id = c.id AND cc.name IS NOT NULL AND cc.name <> ''
        ORDER BY cc.created_at, cc.id
        LIMIT 1
     ) pc ON true
     LEFT JOIN ( SELECT jobs.customer_id, count(*) AS job_count,
            count(*) FILTER (WHERE jobs.status = ANY (ARRAY['lead'::text, 'estimating'::text, 'won'::text, 'active'::text])) AS open_jobs
           FROM jobs WHERE jobs.customer_id IS NOT NULL GROUP BY jobs.customer_id) j ON j.customer_id = c.id
     LEFT JOIN ( SELECT jb.customer_id, sum(lg.invoiced_total) AS invoiced,
            sum(lg.collected) AS collected,
            sum(lg.unbilled_labor + lg.unbilled_cost) AS unbilled
           FROM job_ledger lg JOIN jobs jb ON jb.id = lg.job_id
          WHERE jb.customer_id IS NOT NULL GROUP BY jb.customer_id) l ON l.customer_id = c.id
     LEFT JOIN ( SELECT customer_notes.customer_id, max(customer_notes.happened_on) AS last_note_on
           FROM customer_notes GROUP BY customer_notes.customer_id) n ON n.customer_id = c.id;

alter view public.customer_summary set (security_invoker = true);

-- ---------------------------------------------------------------------------
-- The one row this was written for.
--
-- Austin Energy is a utility on a permit, not somebody Mark invoices.
-- ---------------------------------------------------------------------------

update public.customers
   set relationship = 'other'
 where lower(name) = 'austin energy';
