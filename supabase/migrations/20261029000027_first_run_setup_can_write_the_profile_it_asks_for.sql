/*
  The setup flow could not save a single answer it asked for.

  `profiles` carried a SELECT policy and an UPDATE policy and no INSERT policy
  at all. PostgREST's upsert is INSERT ... ON CONFLICT DO UPDATE, and Postgres
  checks the INSERT policy on that statement whichever branch it takes, so
  every write /welcome makes to the person's own row was refused:

    new row violates row-level security policy for table "profiles"

  Nothing said so. `save()` announces a failed write by dispatching an event
  that AppShell turns into a message, and /welcome is a bare page with no
  AppShell on it, so the event went into an empty room. The business half of
  the flow saved correctly - rate, reply-to address, payment handles,
  onboarded_at - and then the shell looked at the profile, found no name, and
  sent the person straight back to question one. Round and round, with the
  answers apparently accepted every time.

  Verified with scripts/try-as.sh as newstart@example.com before and after.

  WHAT THIS DOES NOT OPEN UP: the same person could already change every
  column on this row through profiles_self_update, `role` included. The check
  is copied from it verbatim so the two cannot drift, and it is the one that
  matters: you cannot point your profile at a workspace you are not a member
  of, which is what active_org_id decides.
*/

drop policy if exists profiles_self_insert on public.profiles;

create policy profiles_self_insert on public.profiles
  for insert to authenticated
  with check (
    id = auth.uid()
    and (
      active_org_id is null
      or exists (
        select 1 from public.memberships m
         where m.user_id = auth.uid()
           and m.org_id = profiles.active_org_id
      )
    )
  );
