-- Two things reading a permit got wrong, cleaned up for Mark.
--
-- His own name and email are on the Austin Energy form he filed, so the
-- reader added him as a contact at a company he owns. And everything it
-- created went in at 'noticed', the top of the prospect lane, so Customers
-- never showed the company while the person beside it read "works at a
-- client" — two screens disagreeing about the same relationship.

-- 1. Nobody is a contact at their own business.
delete from public.customer_contacts cc
 using auth.users u, public.memberships m
 where cc.org_id = m.org_id
   and m.user_id = u.id
   and lower(cc.email) = lower(u.email);

-- 2. Anything read out of a document and left in the pipeline by accident.
--    Only rows with no contact history — an untouched 'noticed' created
--    today is the reader's doing, not somebody working a list.
update public.customers
   set stage = 'won'
 where stage = 'noticed'
   and last_contacted_on is null
   and created_at > now() - interval '2 days';
