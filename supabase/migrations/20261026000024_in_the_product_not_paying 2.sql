-- ============================================================================
-- THE GAP BETWEEN "PROPOSED" AND "CLIENT"
-- ============================================================================
-- Keith has a login. Marcie has a login. They are in the product using it
-- every day and neither of them is paying a penny. The lane had nowhere to put
-- that, so they were marked won — which is the word for "they are a client" —
-- and they landed in the client list, the client count, and every screen that
-- means revenue by it.
--
-- This is not a one-off. Mike will have testers, Mark will have a homeowner who
-- has said yes but not signed, John will have a kitchen taking a first order on
-- approval. Every one of them is the same shape: the relationship is real, the
-- money is not agreed yet.
--
-- The rule worth keeping is that a stage says where the RELATIONSHIP is, and
-- has nothing to do with what somebody is allowed to open. Access is a
-- membership, and that is already its own fact. Conflating the two is how a
-- tester ends up counted as revenue.
-- ============================================================================

alter table customers drop constraint if exists customers_stage_check;

alter table customers add constraint customers_stage_check
  check (stage = any (array[
    'noticed', 'reached', 'talking', 'proposed',
    'trying',
    'won', 'past', 'cold'
  ]));

comment on column customers.stage is
  'Where the relationship is. "trying" means they are in and using it with nothing agreed — not a client, and not a lost deal.';

-- Jobs run the same lane, so the same word has to be legal there.
do $$
begin
  if exists (
    select 1 from pg_constraint
     where conrelid = 'jobs'::regclass and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%proposed%'
  ) then
    raise notice 'jobs has its own stage-like constraint; left alone deliberately.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- The two who are actually in this position.
-- ---------------------------------------------------------------------------

update customers
set stage = 'trying'
where name = 'Lakemere Services'
  and stage = 'won';
