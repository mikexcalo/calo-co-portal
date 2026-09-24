-- "How is Mammoth quiet when I recorded their approval today?"
--
-- Because last_contacted_on is a field somebody has to remember to set, and
-- every new way of touching a client forgets it.
--
--   Mammoth  last_contacted_on 2026-09-01   newest note 2026-09-24
--
-- It has had, at various points, exactly one writer: the Log something
-- button. This morning I added a second in /api/estimates/decide. Mark's
-- approval went in through a migration, which was a third path, and it
-- updated the notes and not this. SaidYesElsewhere is a fourth and does the
-- same. Every new route is another chance to forget.
--
-- The fact is already recorded — it is the newest customer_note. So the
-- column stops being something anybody maintains and starts being derived
-- from the thing that is always written.
--
-- Kept as a column rather than moved into the view because Clients sorts and
-- filters on it, and several screens read it directly.

create or replace function public.touch_last_contacted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.customers c
     set last_contacted_on = greatest(
           coalesce(c.last_contacted_on, '-infinity'::date),
           coalesce(new.happened_on, current_date)
         )
   where c.id = new.customer_id;
  return new;
end $$;

drop trigger if exists customer_notes_touch_last_contacted on public.customer_notes;

create trigger customer_notes_touch_last_contacted
  after insert on public.customer_notes
  for each row
  when (new.customer_id is not null)
  execute function public.touch_last_contacted();

comment on column public.customers.last_contacted_on is
  'Maintained by a trigger from the newest customer_note. Do not set it by '
  'hand: four different code paths used to, and three of them forgot.';

-- Every client that has been contacted since the column last moved.
update public.customers c
   set last_contacted_on = n.newest
  from (
    select customer_id, max(happened_on) as newest
      from public.customer_notes
     where customer_id is not null
     group by customer_id
  ) n
 where n.customer_id = c.id
   and (c.last_contacted_on is null or c.last_contacted_on < n.newest);
