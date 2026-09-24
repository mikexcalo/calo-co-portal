-- The same bug as seo_tasks, in the table next to it.
--
--   CREATE UNIQUE INDEX seo_profile_one_per_client
--     ON seo_profile (org_id, COALESCE(customer_id, '000...'::uuid))
--
-- An expression index, because customer_id is nullable and NULL never equals
-- NULL. PostgREST's onConflict can only name plain columns, so
-- "org_id,customer_id" matched no inferrable constraint and every save of the
-- details form was rejected with 42P10.
--
-- That form is the one the whole Search tab is built around — it writes the
-- name, phone, address, category, services and towns that the address block,
-- the structured data and the page titles are all generated from. None of it
-- has ever saved.
--
-- Found by checking every upsert in the codebase against the indexes that
-- actually exist, after the identical fault turned up on seo_tasks this
-- morning. It was the only other one.

drop index if exists seo_profile_one_per_client;

create unique index seo_profile_one_per_client
  on public.seo_profile (org_id, customer_id)
  nulls not distinct;
