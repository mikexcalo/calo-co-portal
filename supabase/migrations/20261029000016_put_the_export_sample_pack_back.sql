/*
  The demo had no declined proposal, so one was declined to check the preview.

  "Export sample pack" for Ember & Ash was the only sent proposal that could
  be declined without rewriting a decision somebody already made. It went
  through the real customer route, so the decline wrote four things: the
  estimate's status and decision, the customer's last contact date, a system
  note on their record, and a notification. All four go back.

  Ember & Ash is a wholesale account with an open sample-pack quote, and it
  should read that way again rather than as a client who said no.
*/

update public.estimates
   set status = 'sent',
       decided_at = null,
       decided_by_name = null
 where id = '67da404e-f290-4ebb-92b6-adde187155b1';

update public.customers c
   set last_contacted_on = '2026-09-21'
  from public.jobs j
 where j.id = (select job_id from public.estimates where id = '67da404e-f290-4ebb-92b6-adde187155b1')
   and c.id = j.customer_id;

delete from public.customer_notes
 where job_id = (select job_id from public.estimates where id = '67da404e-f290-4ebb-92b6-adde187155b1')
   and kind = 'system'
   and source = 'estimate'
   and title like 'Declined:%';

delete from public.notifications
 where title like '%declined%'
   and created_at > now() - interval '1 day'
   and org_id = (select org_id from public.estimates where id = '67da404e-f290-4ebb-92b6-adde187155b1');
