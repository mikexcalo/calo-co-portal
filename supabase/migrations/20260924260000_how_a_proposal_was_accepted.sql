-- Mark approved by email. The platform has no way to record that.
--
-- estimates knows decided_at and decided_by_name, and nothing about HOW. A
-- proposal accepted with the button on /e/<token> and one accepted in a Gmail
-- thread land in the database looking identical — same status, same name
-- somebody typed, same timestamp. That is fine right up until somebody says
-- they never agreed.
--
-- What makes a record hold up is not the status. It is the channel, the
-- address it came from, and the words they used, kept verbatim and not
-- summarised. Mike said it plainly: he trusts Mark, and will not always be
-- dealing with Mark.
--
--   decided_via     how it was accepted, so the two are never confused again
--   decided_by_email  the address it came from, which is the identifying part
--   decided_words   what they actually wrote or said, kept as sent

alter table public.estimates
  add column if not exists decided_via text
    check (decided_via in ('platform', 'email', 'phone', 'in_person', 'paper')),
  add column if not exists decided_by_email text,
  add column if not exists decided_words text;

comment on column public.estimates.decided_via is
  'How the decision reached us. platform means they pressed the button, which '
  'is the only one the system witnessed itself.';
comment on column public.estimates.decided_words is
  'Verbatim. A summary of an agreement is not evidence of one.';

-- Everything already accepted came through the document, because until now
-- that was the only route.
update public.estimates
   set decided_via = 'platform'
 where status in ('accepted', 'declined')
   and decided_via is null;

-- Mark's approval, 24 September 2026, by reply to the proposal email.
update public.estimates
   set status           = 'accepted',
       decided_at       = timestamptz '2026-09-24 13:53:00-07',
       decided_by_name  = 'Mark Mesedahl',
       decided_by_email = 'mark@mammothconstructiontx.com',
       decided_via      = 'email',
       decided_words    = 'Hey Mike,' || chr(10) || chr(10) ||
                          'We approve this proposal.' || chr(10) || chr(10) ||
                          'Thanks,' || chr(10) ||
                          'Have a great day.' || chr(10) ||
                          'Take care, and talk soon!' || chr(10) || chr(10) ||
                          'Mark'
 where sent_to = 'mark@mammothconstructiontx.com'
   and status = 'sent';

-- And on the client's record, where you would go looking for it.
insert into public.customer_notes
  (org_id, customer_id, job_id, kind, source, direction, happened_on, title, body)
select
  e.org_id, j.customer_id, e.job_id, 'email', 'imported', 'in', date '2026-09-24',
  'Accepted the proposal ($40.00) by email',
  'Mark Mesedahl <mark@mammothconstructiontx.com>, 24 Sep 2026, replying to '
  || 'the proposal sent to markmesedahl@gmail.com:' || chr(10) || chr(10)
  || '"We approve this proposal."' || chr(10) || chr(10)
  || 'Recorded here because it did not come through the platform. The full '
  || 'wording is on the proposal itself.'
from public.estimates e
join public.jobs j on j.id = e.job_id
where e.decided_by_email = 'mark@mammothconstructiontx.com'
  and not exists (
    select 1 from public.customer_notes n
     where n.job_id = e.job_id
       and n.title like 'Accepted the proposal%by email'
  );
