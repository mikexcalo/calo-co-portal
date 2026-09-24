-- The code now records a contact when somebody signs a proposal. This is the
-- one that already happened: John accepted on 23 September and the record
-- still said 1 September, three lines above the history entry proving it.
update public.customers
   set last_contacted_on = date '2026-09-23'
 where name = 'Global Seafood Partners'
   and (last_contacted_on is null or last_contacted_on < date '2026-09-23');
