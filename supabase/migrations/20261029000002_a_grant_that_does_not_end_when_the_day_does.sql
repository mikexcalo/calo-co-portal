/*
  A grant that outlasts the session.

  Every grant so far is a visit. The studio is let in, does the thing, hands
  it back, and `ended_at` closes the row - which is right for "can you fix
  this one invoice" and wrong for a workspace the studio runs day to day. On
  that footing, handing back at the end of every afternoon means being locked
  out by the next morning.

  A standing grant is the same row with no end to it. It is not a different
  kind of permission and it is not quieter: the client sees it in the same
  list, with the same Revoke beside it, and still gets told what changed.
  The only difference is that handing back does not close it.

  Taking one back is not a trap either. The studio can still ask, or start a
  session of its own, which is the loud version - the client is told each
  time. Revoking says "tell me each time", not "never again".
*/

alter table public.work_grants
  add column if not exists standing boolean not null default false;

comment on column public.work_grants.standing is
  'A grant with no end. handBack() leaves it open; only the client revoking it closes it. Everything else about it - the permissions, the change log, the notice at the end of a session - is unchanged.';

/*
  Handing back must not close one, whoever writes the update.

  The app already knows this, and the app is not the place it can be relied
  on: `handBack` is one caller and a standing grant closed by a stray update
  is a studio locked out of a workspace it runs, with no obvious cause. The
  row defends itself.

  Revoking still works. So does the client ending it deliberately - that sets
  `revoked_at`, which is the client's word, not a session tidying up after
  itself.
*/
create or replace function public.keep_standing_grants_open()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.standing
     and old.ended_at is null
     and new.ended_at is not null
     and new.revoked_at is null then
    new.ended_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists work_grants_standing_stays on public.work_grants;
create trigger work_grants_standing_stays
  before update on public.work_grants
  for each row execute function public.keep_standing_grants_open();
