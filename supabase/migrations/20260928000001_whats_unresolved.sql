-- ============================================================================
-- WHAT IS ACTUALLY UNRESOLVED
-- ============================================================================
-- Today said "nothing needs you right now" while a client was waiting on a
-- reply, an engagement had sixteen steps with nobody assigned, six findings
-- were flagged as worth acting on and seven setup items were open.
--
-- It was not broken. It was measuring money, and there is no money in here
-- yet, so every check it ran passed. The screen whose whole job is to say what
-- needs you was answering a narrower question than the one it appeared to
-- answer.
--
-- One view, everything unresolved, so a new kind of unresolved thing shows up
-- on Today by existing rather than by somebody remembering to add a check.
-- ============================================================================

create or replace view public.unresolved as

  -- Somebody is waiting on you, and has been for long enough to notice.
  select
    'waiting'::text        as kind,
    c.org_id,
    c.name                 as who,
    'They have not heard back since ' || to_char(c.awaiting_reply_since, 'Mon DD') as what,
    '/customers/' || c.id  as href,
    (current_date - c.awaiting_reply_since)::int as age_days,
    3                      as urgency
  from customers c
  where c.awaiting_reply_since is not null
    and c.awaiting_reply_since <= current_date - 2

  union all

  -- A plan exists and nobody has said who is doing any of it. The work is not
  -- late; it has not started, which is a different and quieter failure.
  select
    'unassigned',
    j.org_id,
    coalesce(c.name, j.name),
    count(*) || ' steps planned and nobody assigned to any of them',
    '/jobs/' || j.id,
    (current_date - j.created_at::date)::int,
    2
  from job_tasks t
  join jobs j on j.id = t.job_id
  left join customers c on c.id = j.customer_id
  where t.owner = 'unassigned' and t.status <> 'done'
  group by j.org_id, j.id, j.name, c.name, j.created_at

  union all

  -- Findings marked as worth acting on, that nobody has acted on.
  select
    'findings',
    d.org_id,
    c.name,
    count(*) || ' things they told you are flagged and unused',
    '/customers/' || c.id,
    (current_date - min(d.answered_on))::int,
    2
  from discovery d
  join customers c on c.id = d.customer_id
  where d.flagged
  group by d.org_id, c.id, c.name

  union all

  -- A brief nobody has touched. Stale is worse than absent: it reads as current.
  select
    'stale_brief',
    c.org_id,
    c.name,
    'The brief has not been touched since ' || to_char(c.brief_updated_at, 'Mon DD'),
    '/customers/' || c.id,
    (current_date - c.brief_updated_at::date)::int,
    1
  from customers c
  where c.brief_updated_at is not null
    and c.brief_updated_at < now() - interval '45 days'

  union all

  -- Written and never sent. The most expensive thing on this list.
  select
    'unsent_proposal',
    e.org_id,
    coalesce(c.name, j.name),
    'A proposal is written and has never been sent',
    '/jobs/' || j.id,
    (current_date - e.created_at::date)::int,
    3
  from estimates e
  join jobs j on j.id = e.job_id
  left join customers c on c.id = j.customer_id
  where e.status = 'draft'
    and e.created_at < now() - interval '2 days';

comment on view public.unresolved is
  'Everything open across the product, not only the money. Today reads this, so a new kind of unresolved thing appears by existing rather than by somebody remembering to add a check for it.';
