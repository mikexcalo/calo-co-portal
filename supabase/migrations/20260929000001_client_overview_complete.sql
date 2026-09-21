-- ============================================================================
-- ONE QUERY FOR A CLIENT RECORD
-- ============================================================================
-- Opening a client fired roughly twenty round trips, several of them waterfalls
-- because each component fetched after it mounted. At a third of a second each
-- that is the page taking seconds to settle, and it is entirely self-inflicted:
-- this view was built for exactly this and then never used.
--
-- Everything the record counts, in one row.
-- ============================================================================

-- Dropped and recreated rather than replaced: create or replace cannot reorder
-- columns, and this view gained several. Nothing depends on it, which is what
-- makes that safe.
drop view if exists public.client_overview;

create view public.client_overview as
  select
    c.id,
    c.org_id,
    c.name,
    c.stage,
    c.workspace_id,
    (c.workspace_id is not null) as has_login,
    c.plan,
    c.brief,
    c.brief_updated_at,
    c.modules,
    c.email,
    c.website,

    (select count(*) from jobs j where j.customer_id = c.id)                              as engagements,
    (select count(*) from jobs j where j.customer_id = c.id
       and j.status not in ('done','cancelled','lost'))                                   as open_engagements,
    (select count(*) from targets t where t.for_client_id = c.id)                          as targets,
    (select count(*) from targets t where t.for_client_id = c.id
       and t.status not in ('won','passed'))                                               as targets_open,
    (select count(*) from brands b where b.customer_id = c.id)                             as brands,
    (select id from brands b where b.customer_id = c.id limit 1)                           as brand_id,
    (select count(*) from brand_intel i where i.customer_id = c.id)                        as documents,
    (select count(*) from discovery d where d.customer_id = c.id)                          as answers,
    (select count(*) from discovery d where d.customer_id = c.id and d.flagged)            as answers_flagged,
    (select count(*) from customer_notes n where n.customer_id = c.id)                     as notes,
    (select count(*) from case_studies s where s.customer_id = c.id)                       as case_studies,
    (select count(*) from pitches p where p.customer_id = c.id)                            as pitches,
    (select count(*) from review_requests r where r.customer_id = c.id)                    as reviews_asked,
    (select count(*) from review_requests r where r.customer_id = c.id
       and r.clicked_at is not null)                                                       as reviews_followed,
    (select count(*) from seo_profile s where s.customer_id = c.id)                        as has_search,

    (select coalesce(sum(i.total - i.amount_paid), 0)
       from job_invoices i join jobs j on j.id = i.job_id
      where j.customer_id = c.id and i.status <> 'void')                                   as owed,
    (select coalesce(sum(l.unbilled_labor + l.unbilled_cost), 0)
       from job_ledger l where l.customer_id = c.id)                                       as unbilled
  from customers c;

comment on view public.client_overview is
  'Everything a client record counts, in one row. Built to replace roughly twenty round trips per page load with one.';
