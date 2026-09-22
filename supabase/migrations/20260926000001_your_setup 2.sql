-- ============================================================================
-- THE THINGS YOU OWE THE PLATFORM
-- ============================================================================
-- Stripe keys, the Supabase upgrade, inviting Mark, the Google profile. Real
-- work with real consequences, and every one of them has lived in a chat
-- message that scrolled away, which is why the same question keeps getting
-- asked.
--
-- They belong on Today for the same reason a late invoice does: they are
-- yours, they are blocking something, and nobody else is going to do them.
-- The difference from every other task in here is that the steps matter as
-- much as the item, because the reason these get postponed is not that they
-- are hard, it is that nobody remembers which screen the button is on.
-- ============================================================================

create table if not exists public.setup_items (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references orgs(id) on delete cascade,
  key        text not null,
  status     text not null default 'todo'
             check (status in ('todo', 'doing', 'done', 'skipped')),
  note       text,
  done_at    timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists setup_items_one_per_key
  on public.setup_items(org_id, key);

alter table public.setup_items enable row level security;

drop policy if exists setup_items_own on public.setup_items;
create policy setup_items_own on public.setup_items
  for all to authenticated
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

create or replace function public.stamp_setup_done()
returns trigger language plpgsql as $function$
begin
  if new.status = 'done' and (old.status is distinct from 'done') then
    new.done_at := now();
  elsif new.status <> 'done' then
    new.done_at := null;
  end if;
  return new;
end;
$function$;

drop trigger if exists setup_items_stamp on public.setup_items;
create trigger setup_items_stamp
  before insert or update on public.setup_items
  for each row execute function public.stamp_setup_done();

comment on table public.setup_items is
  'What the owner owes the platform, tracked. The catalog and the steps live in code; this is only which ones are done.';
