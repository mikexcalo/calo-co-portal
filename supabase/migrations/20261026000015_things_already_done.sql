-- Marking off what has actually happened.
--
-- The task list has been telling Mike to invite the people who need a login,
-- naming Mark specifically as the one who cannot get in. Mark has had an
-- account since this morning, has signed in, has dropped two files and left
-- feedback. John has one too. A list that nags about finished work is a list
-- people stop reading, and then it stops working for the unfinished ones.
--
-- Nothing else on it is provable from here. Whether somebody actually sent
-- themselves a test email, or claimed a Google profile, is not something the
-- database knows, and marking those done on a guess is how the list starts
-- lying in the other direction.

insert into public.setup_items (org_id, key, status, steps_done)
select o.id, 'invite_team', 'done', array[0,1,2]
  from public.orgs o
 where o.name = 'CALO&CO'
   and exists (
     select 1 from public.memberships m
      join public.orgs client on client.id = m.org_id
     where client.kind = 'contractor'
       and m.user_id <> (select id from auth.users where email = 'mikexcalo@gmail.com' limit 1)
   )
on conflict (org_id, key) do update set status = 'done';
