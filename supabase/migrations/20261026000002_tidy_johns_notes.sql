-- Tidying John's notes. A data fix rather than a schema one, which is unusual
-- for a migration, but it is the honest way to make a change that has to
-- happen exactly once and be recorded as having happened.
--
-- Three things went wrong: the file that sent his notes was run twice, an
-- older domain note still tells him to change nameservers Cloudflare will not
-- let him change, and both name mike@askcolette.ai — which is Colette's
-- address, not the one he should be inviting.

delete from public.notifications
 where org_id = '11acc27d-54bc-40a1-a759-83eb04f486c6'
   and kind = 'system'
   and title = 'Buy your domain name';

delete from public.notifications
 where id in (
   select id from (
     select id, row_number() over (partition by title order by created_at) as n
       from public.notifications
      where org_id = '11acc27d-54bc-40a1-a759-83eb04f486c6'
        and kind = 'system'
   ) ranked
   where n > 1
 );

update public.notifications
   set body = replace(body, 'mike@askcolette.ai', 'mikexcalo@gmail.com')
 where body like '%askcolette%';
