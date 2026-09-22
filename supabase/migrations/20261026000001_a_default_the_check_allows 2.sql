-- A default its own constraint rejects.
--
-- 20261012 replaced the stage values with one lane — noticed, reached,
-- talking, proposed, won, past, cold — and rewrote every existing row. What
-- it did not do is change the column default, which is still 'active'.
--
-- So any insert that does not name a stage gets 'active', fails the check it
-- was just given, and comes back as "something in that is not a value this
-- will accept". Creating a customer from a dropped document, from the import
-- screen, or from the new-job form all hit it. Only the pipeline screen
-- worked, because it happens to pass a stage explicitly.
--
-- Nobody noticed because everything that already existed had been migrated;
-- it is only new rows that break.

alter table public.customers
  alter column stage set default 'noticed';

-- Anything that slipped in before the constraint was tightened.
update public.customers
   set stage = 'noticed'
 where stage not in ('noticed','reached','talking','proposed','won','past','cold');

select column_default
  from information_schema.columns
 where table_schema = 'public' and table_name = 'customers' and column_name = 'stage';
