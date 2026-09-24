-- The Digital checklist never saved. Not once — the table is empty.
--
-- seo_tasks had a unique index, so it looked covered:
--
--   CREATE UNIQUE INDEX seo_tasks_one_per_key
--     ON seo_tasks (org_id, COALESCE(customer_id, '000...'::uuid), key)
--
-- The COALESCE is there because customer_id is nullable and NULL never equals
-- NULL, so a plain unique index would have let a workspace-level task be
-- written twice. Reasonable at the time.
--
-- But it makes the index an EXPRESSION index, and PostgREST's onConflict
-- parameter can only name plain columns. So "onConflict: org_id,customer_id,key"
-- matched no inferrable constraint and Postgres rejected every upsert with
-- 42P10. The client discarded the result, so the checkbox went green and the
-- write went nowhere. You ticked two boxes, reloaded, and they were gone.
--
-- Postgres 15 added NULLS NOT DISTINCT, which does the same job as the
-- COALESCE trick using real columns, so the index becomes inferrable.

drop index if exists seo_tasks_one_per_key;

create unique index seo_tasks_one_per_key
  on public.seo_tasks (org_id, customer_id, key)
  nulls not distinct;
