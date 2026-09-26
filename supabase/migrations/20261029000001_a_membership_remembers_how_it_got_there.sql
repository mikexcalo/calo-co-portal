/*
  Which side of the table a member sits on.

  Every guard written so far reads a session row: a person declares "I am
  looking" or "I am working in this", and the database holds them to it. That
  works right up to the moment nobody declares anything. A studio owner has a
  real membership in every client workspace - that is how they can open it at
  all - so with no session declared, RLS sees an owner and takes the write.

  The gap is not in the guard. It is that a membership does not say how it got
  there. Marcie at Lakemere and the studio that built Lakemere are the same
  row shape, and the database has no way to tell a client's own team from the
  people they hired.

  So the row says. 'own' is the business's own people. 'studio' is somebody
  who is here because their studio set this workspace up, which is already
  knowable - `customers.linked_org_id` is the link `studio_for()` reads - and
  is written down once instead of being re-derived on every write.

  The studio's own workspace is untouched. Nothing links to CALO&CO, so
  everybody in it is 'own', including the owner.
*/

alter table public.memberships
  add column if not exists origin text not null default 'own';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'memberships_origin_known'
  ) then
    alter table public.memberships
      add constraint memberships_origin_known check (origin in ('own', 'studio'));
  end if;
end $$;

comment on column public.memberships.origin is
  'own = the business''s own team. studio = here because their studio set this workspace up, via customers.linked_org_id. Read by guard_session_writes(): a studio member with no live grant cannot change anything.';

/*
  How a membership classifies itself.

  A studio member is somebody who is also a member of an org whose customer
  record links to this workspace. Written as a function because the backfill
  and the trigger have to agree exactly; two copies of this rule would drift
  and the drift would be silent.
*/
create or replace function public.membership_origin(member uuid, workspace uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case when exists (
    select 1
    from public.customers c
    join public.memberships sm
      on sm.org_id = c.org_id
     and sm.user_id = member
    where c.linked_org_id = workspace
      /* A workspace does not hire itself. Without this, a studio that keeps a
         customer record pointing at its own org would lock itself out. */
      and c.org_id <> workspace
  ) then 'studio' else 'own' end;
$$;

comment on function public.membership_origin(uuid, uuid) is
  'Whether this person is in this workspace as the business''s own team or as the studio that set it up. One rule, used by both the backfill and the insert trigger.';

update public.memberships m
   set origin = public.membership_origin(m.user_id, m.org_id);

/* And from now on it is decided when the membership is made, not later. */
create or replace function public.stamp_membership_origin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.origin := public.membership_origin(new.user_id, new.org_id);
  return new;
end;
$$;

drop trigger if exists memberships_stamp_origin on public.memberships;
create trigger memberships_stamp_origin
  before insert on public.memberships
  for each row execute function public.stamp_membership_origin();
