-- The funnel keeps itself up to date, and says why.
--
-- Every CRM that a small business abandons is abandoned for the same reason:
-- the stages are accurate on the day you set them up and lie within a month,
-- because moving cards is work that never has a deadline. So the board stops
-- being trusted, and an untrusted board is worse than none.
--
-- The system already holds the evidence. It knows you sent them something and
-- whether anything came back. Those are exactly the first two transitions, so
-- it makes them itself and records the reason, and the reason is what makes it
-- safe: nobody is asked to trust a number that moved on its own without being
-- told what moved it.
--
-- WHAT IT WILL NOT DO
--
-- It only ever moves forward, and only into reached or talking. Proposed, won,
-- past and cold are decisions a person makes, and inferring won from an invoice
-- would mean a mis-filed invoice quietly closing a deal. It also never touches a
-- record that has already gone past talking, so a note logged against a client
-- of six years cannot drag them back into the pipeline.

create or replace function advance_stage_from_contact()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current text;
begin
  if new.customer_id is null then
    return new;
  end if;

  select stage into current from customers where id = new.customer_id;

  -- Anything at proposed or beyond is being steered by a person.
  if current is null or current not in ('noticed', 'reached') then
    return new;
  end if;

  -- They replied. That is the difference between a list and a conversation,
  -- and it is the single most useful fact a pipeline holds.
  if new.direction = 'in' then
    update customers
       set stage = 'talking',
           stage_changed_on = current_date,
           stage_why = 'They replied on ' || to_char(coalesce(new.happened_on, current_date), 'FMDD Month')
     where id = new.customer_id;
    return new;
  end if;

  -- You reached out and have heard nothing yet.
  if new.direction = 'out' and current = 'noticed' then
    update customers
       set stage = 'reached',
           stage_changed_on = current_date,
           stage_why = 'You contacted them on ' || to_char(coalesce(new.happened_on, current_date), 'FMDD Month')
     where id = new.customer_id;
  end if;

  return new;
end;
$$;

drop trigger if exists customer_notes_advance_stage on customer_notes;
create trigger customer_notes_advance_stage
  after insert on customer_notes
  for each row
  execute function advance_stage_from_contact();

-- John and Luis spoke on the phone before John wrote the recap, which the note
-- says in its first line and which no direction flag can carry. Corrected by
-- hand, which is the case the undo exists for.
update customers
   set stage = 'talking',
       stage_changed_on = current_date,
       stage_why = 'They spoke on a call before the recap went out'
 where name = 'Pacific Empress'
   and stage = 'reached';
