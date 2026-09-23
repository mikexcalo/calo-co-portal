-- ============================================================================
-- Retire "Business setup and launch".
--
-- It was created for Global Seafood alongside Platform Access, and every hour
-- of John's work went onto Platform Access instead, because that is where the
-- draft invoice was. So it has carried nothing since the day it was made: no
-- hours, no receipts, no invoice, no estimate. It shows up in the Log time
-- picker and on the board as a second thing to choose between, and choosing
-- between two things when one of them is empty is a decision nobody should
-- have to make twice a day.
--
-- Guarded rather than a bare delete: if anything has landed on it since this
-- was written, it stays and says so, because a project with work on it is a
-- record of that work and deleting it takes the evidence with it.
-- ============================================================================

do $$
declare
  jid uuid;
  n   int;
begin
  select j.id into jid
    from public.jobs j
    join public.customers c on c.id = j.customer_id
   where c.name = 'Global Seafood Partners'
     and j.name = 'Business setup and launch';

  if jid is null then
    raise notice 'Already gone.';
    return;
  end if;

  select (select count(*) from public.time_entries where job_id = jid)
       + (select count(*) from public.costs where job_id = jid)
       + (select count(*) from public.job_invoices where job_id = jid)
       + (select count(*) from public.estimates where job_id = jid)
    into n;

  if n > 0 then
    raise exception 'Not empty: % rows attached. Close it instead of removing it.', n;
  end if;

  delete from public.jobs where id = jid;
  raise notice 'Removed.';
end $$;
