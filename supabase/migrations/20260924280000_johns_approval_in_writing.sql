-- John's approval, for the record.
--
-- He pressed accept on the proposal — decided_via is already 'platform' and
-- that stays, because the system witnessed that itself and it is the
-- strongest kind of record there is. What was missing is that he also wrote
-- it down, from his business address, in a sentence that says plainly what he
-- was agreeing to.
--
-- Two records of the same agreement is not redundancy. If the platform one is
-- ever questioned — a shared login, a misclick, a date nobody can place — the
-- email is the thing that does not depend on this software being trusted.
update public.estimates
   set decided_by_email = 'globalseafood.partners@gmail.com',
       decided_words    = 'I approve the proposal. Do I need to Venmo?'
 where sent_to = 'john.littonny@gmail.com'
   and status = 'accepted'
   and decided_words is null;

insert into public.customer_notes
  (org_id, customer_id, job_id, kind, source, direction, happened_on, title, body)
select
  e.org_id, j.customer_id, e.job_id, 'email', 'imported', 'in', date '2026-09-23',
  'Approved the proposal in writing as well',
  'John Litton <globalseafood.partners@gmail.com>, 23 Sep 2026, 8:42am:'
  || chr(10) || chr(10)
  || '"I approve the proposal. Do I need to Venmo?"'
  || chr(10) || chr(10)
  || 'He had already accepted it on the proposal itself. Kept because a '
  || 'written approval from his own address does not depend on this platform '
  || 'being trusted.'
from public.estimates e
join public.jobs j on j.id = e.job_id
where e.decided_by_email = 'globalseafood.partners@gmail.com'
  and not exists (
    select 1 from public.customer_notes n
     where n.job_id = e.job_id
       and n.title = 'Approved the proposal in writing as well'
  );
