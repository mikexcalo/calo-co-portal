-- customers has TWO columns for "which workspace is this client", and they
-- disagree.
--
--   Mammoth         workspace_id set   linked_org_id set     agree
--   Global Seafood  workspace_id set   linked_org_id set     agree
--   Lakemere        workspace_id set   linked_org_id NULL    disagree
--
-- linked_org_id is the one the product runs on: nineteen references in the
-- app and both of the row-level policies written today. workspace_id has
-- five, all on the Access screen, plus customer_summary.has_login.
--
-- So Marcie's workspace is half-linked, and everything keyed on linked_org_id
-- silently leaves her out:
--
--   client_awaiting                 a proposal sent to her would never show
--   estimates/send notification     she would never be told one arrived
--   customers_client_reads_itself   she cannot read her own customer record
--
-- Exactly the failure Mark hit two days ago, still live for the third client,
-- and invisible because every one of those paths returns "nothing found"
-- rather than an error.

update public.customers
   set linked_org_id = workspace_id
 where linked_org_id is null
   and workspace_id is not null;

comment on column public.customers.workspace_id is
  'DEPRECATED. The same fact as linked_org_id, which is what the product and '
  'the RLS policies use. Kept only until the Access screen moves across. Two '
  'columns for one fact is how Lakemere ended up half-linked.';

-- has_login was computed from workspace_id, and the id itself was never
-- exposed — so the workspace switcher could not look up a linked client's
-- logo and every client in the menu fell back to initials.
--
-- Rewritten from the live definition rather than from memory, with two lines
-- changed and everything else left exactly as it was.
create or replace view public.customer_summary as
select
  c.id as customer_id,
  c.org_id,
  c.name,
  coalesce(c.contact_name, pc.name)   as contact_name,
  coalesce(c.contact_title, pc.title) as contact_title,
  coalesce(c.email, pc.email)         as email,
  coalesce(c.phone, pc.phone)         as phone,
  c.avatar_url,
  c.stage,
  c.next_action,
  c.next_action_on,
  c.last_contacted_on,
  coalesce(j.job_count, 0::bigint)    as jobs,
  coalesce(j.open_jobs, 0::bigint)    as open_jobs,
  coalesce(l.invoiced, 0::numeric)    as invoiced,
  coalesce(l.collected, 0::numeric)   as collected,
  (coalesce(l.invoiced, 0::numeric) - coalesce(l.collected, 0::numeric)) as owed,
  coalesce(l.unbilled, 0::numeric)    as unbilled,
  n.last_note_on,
  c.brief,
  (c.linked_org_id is not null) as has_login,  -- was c.workspace_id
  c.logo_url,
  customer_logo_path(c.id)            as logo_path,
  c.waiting_on,
  c.relationship,
  /* Appended, not inserted: create-or-replace can add columns to a view but
     cannot reorder or rename the ones already there. */
  c.linked_org_id
from customers c
left join lateral (
  select cc.name, cc.title, cc.email, cc.phone
    from customer_contacts cc
   where cc.customer_id = c.id and cc.name is not null and cc.name <> ''
   order by cc.created_at, cc.id
   limit 1
) pc on true
left join (
  select jobs.customer_id,
         count(*) as job_count,
         count(*) filter (
           where jobs.status = any (array['lead'::text,'estimating'::text,'won'::text,'active'::text])
         ) as open_jobs
    from jobs
   where jobs.customer_id is not null
   group by jobs.customer_id
) j on j.customer_id = c.id
left join (
  select jb.customer_id,
         sum(lg.invoiced_total) as invoiced,
         sum(lg.collected)      as collected,
         sum(lg.unbilled_labor + lg.unbilled_cost) as unbilled
    from job_ledger lg
    join jobs jb on jb.id = lg.job_id
   where jb.customer_id is not null
   group by jb.customer_id
) l on l.customer_id = c.id
left join (
  select customer_notes.customer_id, max(customer_notes.happened_on) as last_note_on
    from customer_notes
   group by customer_notes.customer_id
) n on n.customer_id = c.id;
