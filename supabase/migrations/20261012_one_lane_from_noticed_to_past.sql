-- A company is one record from the first time you notice it to the last
-- invoice you send it.
--
-- There were two tables for the same thing at two moments in its life. A target
-- was a company you wanted; a customer was a company you had. Different status
-- words on each, researching / approached / talking / won / passed against
-- prospect / active / past / lost, and a link from the old row to the new one
-- when it converted.
--
-- That link is where the damage was. Every note taken while chasing them, every
-- contact found, every thing learned, stayed on a row nobody opens again, and
-- the client record started empty on the day it mattered most. A funnel is a
-- position in a relationship, not a different kind of record.
--
-- So: one table, one lane, and two windows onto it. Pipeline is the part before
-- Won and Clients is the part from Won onward.
--
-- WHY THESE SEVEN STAGES
--
--   noticed   on the list, nobody has been contacted
--   reached   you contacted them and heard nothing back yet
--   talking   a real conversation is happening
--   proposed  a number is in front of them
--   won       they are a client
--   past      they were a client and are not now
--   cold      it closed the other way
--
-- Reached and talking are separate because the difference between them is
-- whether anybody replied, which is the single most useful fact in a pipeline
-- and the one a status of "in progress" throws away.
--
-- WHY TAGS AND NOT FIELDS
--
-- targets carried segment, region and size as columns, which is three questions
-- asked of every company whether or not they apply and a fourth that cannot be
-- asked at all. A field builder is the thing that turns a CRM into a project.
-- One text array holds all of it, takes any word, and is the shape a person
-- actually reaches for.

-- ------------------------------------------------------------- the lane ----

alter table customers add column if not exists tags text[] not null default '{}';
alter table customers add column if not exists stage_changed_on date;
-- Why it moved, when the move was inferred rather than chosen. Shown quietly
-- next to the stage with an undo, so nobody has to trust it blindly.
alter table customers add column if not exists stage_why text;

create index if not exists customers_stage on customers (org_id, stage);
create index if not exists customers_tags on customers using gin (tags);

alter table customers drop constraint if exists customers_stage_check;

-- Old vocabulary first, so nothing is orphaned between the two constraints.
update customers set stage = case stage
  when 'active'   then 'won'
  when 'lost'     then 'cold'
  when 'past'     then 'past'
  -- A prospect who has been written to or replied to is further along than one
  -- sitting on a list. Derived from what is recorded rather than guessed, so
  -- nobody arrives at a stage the evidence does not support.
  when 'prospect' then (
    case
      when exists (select 1 from customer_notes n
                    where n.customer_id = customers.id and n.direction = 'in')
        then 'talking'
      when exists (select 1 from customer_notes n where n.customer_id = customers.id)
        then 'reached'
      else 'noticed'
    end)
  else stage
end
where stage in ('active', 'lost', 'past', 'prospect');

alter table customers add constraint customers_stage_check
  check (stage = any (array['noticed','reached','talking','proposed','won','past','cold']));

-- ------------------------------------------------- targets become records ---

insert into customers (
  org_id, name, website, address, notes, stage, tags,
  contact_name, email, phone, next_action, last_contacted_on, created_at
)
select
  t.org_id,
  t.name,
  t.website,
  t.address,
  t.note,
  case t.status
    when 'researching' then 'noticed'
    when 'approached'  then 'reached'
    when 'talking'     then 'talking'
    when 'won'         then 'won'
    when 'passed'      then 'cold'
    else 'noticed'
  end,
  -- Three columns of taxonomy become tags, blanks dropped rather than stored
  -- as empty strings that later render as a tag with no word in it.
  array_remove(array_remove(array[
    nullif(btrim(t.segment), ''),
    nullif(btrim(t.region), ''),
    -- size is a number of locations, not a word, so it is labeled
    -- rather than dropped into the tag list bare.
    case when t.size is null then null else t.size::text || ' locations' end
  ], null), ''),
  t.contact_name,
  t.contact_email,
  t.contact_phone,
  t.next_step,
  t.last_touch,
  t.created_at
from targets t
where
  -- A target that already converted has a customer record. Bringing it across
  -- again would put the same company on the list twice, which is the exact
  -- failure this migration exists to end.
  t.became_customer_id is null
  and not exists (
    select 1 from customers c
     where c.org_id = t.org_id and lower(c.name) = lower(t.name)
  );

-- The person named on a target becomes a contact, so the address book is not
-- two places either.
insert into customer_contacts (org_id, customer_id, name, email, phone, is_primary, relationship)
select c.org_id, c.id, t.contact_name, t.contact_email, t.contact_phone, true, 'client'
  from targets t
  join customers c on c.org_id = t.org_id and lower(c.name) = lower(t.name)
 where coalesce(btrim(t.contact_name), '') <> ''
   and not exists (select 1 from customer_contacts k where k.customer_id = c.id);

-- Everything is across. The table stays, empty, for one release rather than
-- being dropped in the same change that moves the data: if the merge is wrong,
-- the way back should not require a backup.
delete from targets;

comment on table targets is
  'Emptied 2026-09-05. Companies you want and companies you have are one table now; see customers.stage. Kept empty for one release as a way back, then dropped.';

comment on column customers.stage is
  'noticed, reached, talking, proposed, won, past, cold. Pipeline is everything before won; Clients is won and past.';
