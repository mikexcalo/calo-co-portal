/*
  A client can read the basics of its own record, and none of our working notes.

  WHAT WAS WRONG

  `customers_client_reads_itself` let a client read the whole customer row the
  studio keeps about them. The intent was right and the width was not: row-level
  security has no column list, so "you may read the row that is you" also handed
  over `notes`, `stage`, `stage_why`, `next_action`, `waiting_on`, `brief` and
  `tags` - the studio's private working fields.

  Not theoretical. Marcie Tomlinson, who owns Lakemere Services, could read 86
  characters of CALO&CO's notes about Lakemere and see that CALO&CO had her
  filed at stage `trying`.

  WHY A VIEW AND NOT A NARROWER POLICY

  A policy cannot restrict columns, and column GRANTs apply to the role, not to
  the policy - every signed-in person is `authenticated`, so revoking a column
  there would take it from the studio too. The row has to stop being readable,
  and the safe fields have to arrive by another door.

  WHY client_awaiting CHANGES

  It is the only thing that needed the policy. It is `security_invoker`, so its
  joins run as the client, and it joins `customers` purely to reach
  `linked_org_id`. With the policy gone the join would drop the row and a client
  would see an empty Home - the exact failure 20260924170000 was written to fix.

  It runs as its owner now. Its WHERE clause is the boundary and always was:
  `c.linked_org_id = current_org_id()` and `e.status = 'sent'`. That is the same
  scoping the policy provided, written once where it can be read.

  NO ROW IS EDITED. Lakemere's notes stay exactly as they are; what changes is
  who can see them.
*/

-- The whole row stops being readable by the client it describes.
drop policy if exists customers_client_reads_itself on public.customers;

/*
  The basics, by name, for the one row that is you.

  Security definer, because the row it reads is deliberately unreadable now.
  The filter is the same one the dropped policy used, and the column list is
  the point of the whole migration: identity and contact details, nothing the
  studio wrote down while deciding what to do about them.
*/
create or replace view public.my_business_record
with (security_invoker = false) as
select
  c.id,
  c.linked_org_id,
  c.name,
  c.contact_name,
  c.contact_title,
  c.email,
  c.phone,
  c.address,
  c.website,
  c.logo_url
from public.customers c
where c.linked_org_id is not null
  and c.linked_org_id = public.current_org_id();

comment on view public.my_business_record is
  'What a client may read about the record their studio keeps on them: who they are and how to reach them. Never notes, stage, stage_why, next_action, waiting_on, brief or tags.';

grant select on public.my_business_record to authenticated;

/*
  Runs as its owner, so it no longer needs the client to be able to read the
  customers row it joins through. Its WHERE clause does the scoping.
*/
alter view public.client_awaiting set (security_invoker = false);
