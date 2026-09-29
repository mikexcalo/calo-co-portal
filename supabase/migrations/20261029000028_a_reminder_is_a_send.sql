/*
  Chasing a customer for money is sending them something.

  `guard_sending()` only ever looked at one transition: a proposal getting a
  `sent_at`, or an invoice's status becoming 'sent'. That was right for the
  two acts it was written for and wrong the moment a third appeared. A
  reminder writes `nudged_at` and leaves the status alone, so a studio inside
  a client's workspace on a session with `can_send = false` could chase that
  client's customers for money and the database would not blink.

  The browser refused it - /api/followups/send is in SEND_ROUTES, and
  postEmail() refuses server-side - but neither of those is the rule. The rule
  is here, and it was silent on a thing that reaches a customer under the
  client's name.

  Now the same three words decide it: a send is a proposal going out, an
  invoice going out, or either of them being chased.

  WHAT DOES NOT TRIP IT: clearing `nudged_at`, or a write that leaves it where
  it was. Only a fresh stamp counts, which is what a reminder is.
*/

create or replace function public.guard_sending()
  returns trigger
  language plpgsql
  security definer
  set search_path to 'public'
as $function$
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
                and coalesce(old.status, '') <> 'sent')
          /* And chasing, which is the third way a customer hears from us. */
          or (new.nudged_at is not null
                and new.nudged_at is distinct from old.nudged_at
                and (old.nudged_at is null or new.nudged_at > old.nudged_at));

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
$function$;

comment on function public.guard_sending() is
  'Refuses a send from a studio without permission. A send is a proposal going out, an invoice going out, or either of them being chased.';
