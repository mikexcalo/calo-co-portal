/*
  The send guard was written when the only way in was a session.

  guard_sending() asks one question: is the caller inside a live work session
  whose grant says can_send = false? That was the whole shape of the feature
  in October - you entered Work in it, or you were not working in anybody's
  workspace at all.

  Standing grants broke the assumption the same afternoon they were issued.
  The studio now works in three real client workspaces with no session
  declared, and with no session there is no row for that query to find, so
  `found` is false and the send goes through - past a grant that says
  can_send = false in plain text. The three grants issued in
  20261029000005 would have carried a permission nobody granted.

  So the question becomes the right one: what is this person allowed to do
  here, however they got in. Inside a session, the session's grant decides, as
  before. With no session, a studio member is decided by their live grants -
  which is the standing one. The client sending from their own workspace is
  untouched, and so is the studio sending from its own.
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
  guest   boolean;
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

  if found then
    /* A view-mode session, or a work session whose grant has gone, has no row
       here at all - and the write guard has already refused those. What is
       left is a live work session, where can_send decides. */
    if not coalesce(allowed, false) then
      raise exception
        'Nothing was sent. Sending to customers is theirs, and they have not allowed it.';
    end if;
    return new;
  end if;

  /*
    No session. Which used to mean "not my business", and now means the
    studio working under a standing grant.
  */
  select (m.origin = 'studio') into guest
  from public.memberships m
  where m.user_id = auth.uid()
    and m.org_id = new.org_id;

  if coalesce(guest, false) and public.studio_rule_applies(new.org_id) then
    /* The write guard has already established a live grant exists, or this
       update would not have got here. Whether any of them carries a send is
       the only open question. */
    select bool_or(g.can_send) into allowed
    from public.work_grants g
    where g.org_id = new.org_id
      and g.granted_to = auth.uid()
      and g.revoked_at is null
      and g.ended_at is null;

    if not coalesce(allowed, false) then
      raise exception
        'Nothing was sent. Sending to customers is theirs, and they have not allowed it. Ask them, or start a session they can see.';
    end if;
  end if;

  return new;
end;
$$;

comment on function public.guard_sending() is
  'Refuses the write that marks an estimate or invoice as sent when the caller has no permission to send in that workspace - whether they are inside a work session or working under a standing grant. The second layer under postEmail: the message may be stoppable in one function, the record is stoppable everywhere.';
