-- ============================================================================
-- ORG MEMBERSHIP — one login, many businesses
-- ============================================================================
-- Replaces the single profiles.org_id with two distinct concepts:
--
--   memberships          which orgs you MAY access
--   profiles.active_org  which org you are CURRENTLY looking at
--
-- Keeping these separate is what makes the switcher safe. Setting active_org
-- to an org you don't belong to grants nothing, because current_org_id()
-- verifies membership before returning it.
--
-- This is also what makes the whole thing a template: adding a third business
-- is one org row plus one membership row.
-- ============================================================================

create table if not exists memberships (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  org_id      uuid not null references orgs(id) on delete cascade,
  role        text not null default 'member'
                check (role in ('owner','admin','member')),
  created_at  timestamptz not null default now(),
  unique (user_id, org_id)
);

create index if not exists memberships_user_idx on memberships(user_id);
create index if not exists memberships_org_idx on memberships(org_id);

alter table profiles add column if not exists active_org_id uuid references orgs(id) on delete set null;

-- Carry over whatever the old single-org column said.
insert into memberships (user_id, org_id, role)
select id, org_id, 'owner' from profiles where org_id is not null
on conflict (user_id, org_id) do nothing;

update profiles set active_org_id = org_id where active_org_id is null and org_id is not null;

-- ---------------------------------------------------------------------------
-- The security-critical function. Returns the active org ONLY when the caller
-- actually belongs to it — so flipping active_org_id can never grant access.
-- ---------------------------------------------------------------------------

create or replace function current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.active_org_id
  from profiles p
  where p.id = auth.uid()
    and exists (
      select 1 from memberships m
      where m.user_id = p.id and m.org_id = p.active_org_id
    )
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table memberships enable row level security;

-- You can see your own memberships. That's what populates the switcher.
drop policy if exists memberships_own on memberships;
create policy memberships_own on memberships
  for select to authenticated
  using (user_id = auth.uid());

alter table profiles enable row level security;

drop policy if exists profiles_self_select on profiles;
create policy profiles_self_select on profiles
  for select to authenticated
  using (id = auth.uid());

-- Needed so the switcher can write active_org_id. The WITH CHECK is the
-- guard: you may only point yourself at an org you're a member of.
drop policy if exists profiles_self_update on profiles;
create policy profiles_self_update on profiles
  for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and (
      active_org_id is null
      or exists (
        select 1 from memberships m
        where m.user_id = auth.uid() and m.org_id = active_org_id
      )
    )
  );

-- orgs: you can read any org you're a member of (the switcher needs names).
drop policy if exists orgs_own on orgs;
create policy orgs_own on orgs
  for select to authenticated
  using (exists (
    select 1 from memberships m
    where m.user_id = auth.uid() and m.org_id = orgs.id
  ));

drop policy if exists orgs_admin_update on orgs;
create policy orgs_admin_update on orgs
  for update to authenticated
  using (exists (
    select 1 from memberships m
    where m.user_id = auth.uid() and m.org_id = orgs.id
      and m.role in ('owner','admin')
  ))
  with check (exists (
    select 1 from memberships m
    where m.user_id = auth.uid() and m.org_id = orgs.id
      and m.role in ('owner','admin')
  ));

-- ---------------------------------------------------------------------------
-- profiles.org_id is now derived, not authoritative. Left in place so the
-- legacy modules keep working; drop it when they're sunset.
-- ---------------------------------------------------------------------------

comment on column profiles.org_id is
  'DEPRECATED — superseded by memberships + profiles.active_org_id. Kept only for legacy modules.';
