-- Global Seafood Partners gets its own side of the portal.
--
-- Until now they were a record in CALO&CO: a brief, a job, a contact, notes.
-- That is the right shape for a client you do work for and the wrong shape for
-- one who will eventually run their own accounts, product list and commission
-- statements in here. Mammoth already has this and Global Seafood does not,
-- which is the only reason the two clients behave differently.
--
-- WHY EVERY MODULE IS OFF
--
-- A workspace with nothing switched on is a login and a Home screen, which is
-- exactly what was asked for. What John needs a place for is not yet decided,
-- and switching modules on before that decision is how you end up with six
-- empty screens and a client who concludes the thing is unfinished. Access is
-- where they get turned on, one at a time, when there is something behind them.
--
-- WHY NOBODY IS INVITED
--
-- Creating the workspace is internal and reversible. Sending John a login is
-- neither: it is an email to a client from a domain that is not verified yet,
-- which lands in spam and reads like phishing. That step is deliberately not
-- in here.

insert into orgs (name, slug, kind, plan, modules)
select 'Global Seafood Partners', 'global-seafood', 'agency', 'core', '{}'::jsonb
 where not exists (select 1 from orgs where slug = 'global-seafood');

-- Mike owns it, the same as every other workspace. Without a membership row
-- the org exists and nobody, including him, can read a thing inside it.
insert into memberships (user_id, org_id, role)
select m.user_id, w.id, 'owner'
  from orgs w
  join memberships m on m.org_id = (select id from orgs where slug = 'calo-co')
                    and m.role = 'owner'
 where w.slug = 'global-seafood'
   and not exists (
     select 1 from memberships x where x.org_id = w.id and x.user_id = m.user_id
   );

-- The link that makes the client record and the workspace the same business.
-- Access reads this to decide whether a switch is decorative: without it, a
-- module turned on writes to the customer row and the client's own copy never
-- hears about it.
update customers
   set workspace_id = (select id from orgs where slug = 'global-seafood'),
       modules = '{}'::jsonb
 where name = 'Global Seafood Partners'
   and workspace_id is null;
