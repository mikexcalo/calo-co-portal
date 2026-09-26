/*
  The send lock, below postEmail.

  postEmail() is a real server-side check and it stays. But it is one function
  in one file, and a send route that reaches Resend some other way - or a new
  one written next month - walks straight past it. A boundary that depends on
  every future caller remembering it is a convention, not a boundary.

  So the second layer is on the record rather than the message. Marking an
  estimate or an invoice as sent is a write, and a write can be refused by the
  database. Somebody who got an email out some other way still cannot record
  it as sent, and the client's own screens keep telling the truth.

  Why this and not "block the API route": the route is our code and can be
  changed by us. The row is the thing every path has to touch.
*/

create or replace function public.guard_sending()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  started boolean;
  allowed boolean;
begin
  if auth.uid() is null then
    return new;
  end if;

  /* Only the transition into sent matters. Editing a draft, recording a
     payment, voiding - none of those reach a customer. */
  started := (tg_table_name = 'estimates'
                and new.sent_at is not null
                and (old.sent_at is null))
          or (tg_table_name = 'job_invoices'
                and new.status = 'sent'
                and coalesce(old.status, '') <> 'sent');

  if not started then
    return new;
  end if;

  /*
    A live work session on this workspace is the only case that is restricted.
    The client sending from their own workspace, and the studio sending from
    its own, are ordinary business and are not touched.
  */
  select g.can_send into allowed
  from public.work_sessions s
  join public.work_grants g
    on g.org_id = s.org_id
   and g.granted_to = s.user_id
   and g.revoked_at is null
   and g.ended_at is null
  where s.user_id = auth.uid()
    and s.org_id = new.org_id
    and s.ended_at is null
  order by s.started_at desc
  limit 1;

  /* A view-mode session, or a work session whose grant has gone, has no row
     here at all - and the write guard has already refused those. What is left
     is a live work session, where can_send decides. */
  if found and not coalesce(allowed, false) then
    raise exception
      'Nothing was sent. Sending to customers is theirs, and they have not allowed it.';
  end if;

  return new;
end;
$$;

comment on function public.guard_sending() is
  'Refuses the write that marks an estimate or invoice as sent, when the caller is inside a work session the client has not allowed to send. The second layer under postEmail: the message may be stoppable in one function, the record is stoppable everywhere.';

drop trigger if exists estimates_send_guard on public.estimates;
create trigger estimates_send_guard
  before update on public.estimates
  for each row execute function public.guard_sending();

drop trigger if exists job_invoices_send_guard on public.job_invoices;
create trigger job_invoices_send_guard
  before update on public.job_invoices
  for each row execute function public.guard_sending();
