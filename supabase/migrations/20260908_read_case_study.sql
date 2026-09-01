-- ============================================================================
-- READING A PUBLISHED CASE STUDY WITHOUT AN ACCOUNT
-- ============================================================================
-- Same shape as read_pitch: security definer, one row by token, nothing about
-- the workspace leaking out with it.
--
-- ONE RULE ENFORCED HERE RATHER THAN IN THE PAGE
--
-- An unsourced claim is not returned. Not hidden by the template, not filtered
-- in the component, not returned at all.
--
-- The brand framework's argument applies most sharply here: a placeholder is
-- dangerous precisely because it reads well, and the results line is the one a
-- prospect repeats back to you in a meeting. A filter in a React component is
-- one refactor away from being dropped, and the person who drops it will not
-- know what it was for. The database is the only place this holds.
-- ============================================================================

create or replace function public.read_case_study(token text)
returns json
language sql
security definer
set search_path = public
as $function$
  select json_build_object(
    'client',     c.client,
    'title',      c.title,
    'summary',    c.summary,
    'sector',     c.sector,
    'year',       c.year,
    'roles',      c.roles,
    'situation',  c.situation,
    'approach',   c.approach,
    'execution',  c.execution,
    'enablement', c.enablement,
    'outcome',    c.outcome,
    'claims', coalesce((
      select json_agg(json_build_object(
               'claim',  k.claim,
               'source', k.source,
               'dated',  k.dated,
               'status', k.status
             ) order by k.created_at)
      from case_study_claims k
      where k.case_id = c.id
        -- The rule. Unsourced never leaves the building.
        and k.status in ('sourced', 'estimated')
    ), '[]'::json),
    'org', json_build_object('name', o.name)
  )
  from case_studies c
  join orgs o on o.id = c.org_id
  where c.public_token = token
    and c.status = 'published'
  limit 1;
$function$;

revoke all on function public.read_case_study(text) from public;
grant execute on function public.read_case_study(text) to anon, authenticated;

comment on function public.read_case_study(text) is
  'One published case study by token. Unsourced claims are excluded here rather than in the page, because a filter in a component is one refactor away from being dropped by somebody who does not know what it was for.';
