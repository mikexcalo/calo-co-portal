-- ============================================================================
-- PITCHES — a link instead of an attachment
-- ============================================================================
-- Sending a deck as a PowerPoint has three failure modes and all of them are
-- invisible to the sender. It lands in a spam folder because of the
-- attachment. It opens with the fonts substituted and the layout broken. And
-- once it is sent it is frozen, so the version being forwarded around a
-- prospect's office is whatever was true the day it left.
--
-- Worse, you learn nothing. A deck that was never opened and a deck that was
-- read three times look exactly the same from the outside, and the follow-up
-- email is written blind.
--
-- A link fixes all four. It renders the same everywhere, it can be corrected
-- after sending, and it can tell you it was read.
-- ============================================================================

create table if not exists public.pitches (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references orgs(id) on delete cascade,
  title         text not null,
  -- Who it is for. Shown on the page so it does not read like a form letter.
  recipient     text,
  customer_id   uuid references customers(id) on delete set null,

  -- Sections, in order. Held as JSON rather than as rows because a deck is
  -- edited as a whole document and never queried section by section.
  sections      jsonb not null default '[]'::jsonb,

  -- Unguessable, and only set when published. An unpublished pitch has no
  -- address at all, which is a stronger guarantee than a page that checks a
  -- flag before rendering.
  public_token  text unique,
  published_at  timestamptz,

  views         integer not null default 0,
  last_viewed_at timestamptz,

  archived      boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists pitches_org_idx   on public.pitches(org_id);
create index if not exists pitches_token_idx on public.pitches(public_token) where public_token is not null;

alter table public.pitches enable row level security;

drop policy if exists pitches_own on public.pitches;
create policy pitches_own on public.pitches
  for all to authenticated
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

drop trigger if exists pitches_updated_at on public.pitches;
create trigger pitches_updated_at
  before update on public.pitches
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Views.
--
-- One row per open, so "read four times" can become "read four times, three of
-- them the morning of the board meeting" — which is the version that tells you
-- when to call.
--
-- Nothing identifying is kept: no IP address, no cookie, no fingerprint. A
-- timestamp and whether it was a phone. Enough to know the deck landed,
-- not enough to follow somebody around.
-- ---------------------------------------------------------------------------

create table if not exists public.pitch_views (
  id         uuid primary key default gen_random_uuid(),
  pitch_id   uuid not null references pitches(id) on delete cascade,
  viewed_at  timestamptz not null default now(),
  device     text
);

create index if not exists pitch_views_idx on public.pitch_views(pitch_id, viewed_at desc);

alter table public.pitch_views enable row level security;

drop policy if exists pitch_views_own on public.pitch_views;
create policy pitch_views_own on public.pitch_views
  for select to authenticated
  using (exists (
    select 1 from pitches p
    where p.id = pitch_views.pitch_id and p.org_id = current_org_id()
  ));

-- ---------------------------------------------------------------------------
-- Reading a published pitch.
--
-- SECURITY DEFINER so an anonymous visitor holding the link can render the
-- page without being able to read the pitches table. Returns only what the
-- page draws, and only for something actually published.
-- ---------------------------------------------------------------------------

create or replace function public.read_pitch(token text, is_mobile boolean)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  found_pitch record;
  brand jsonb;
begin
  select p.id, p.title, p.recipient, p.sections, p.org_id
    into found_pitch
    from pitches p
   where p.public_token = token
     and p.published_at is not null
     and p.archived = false;

  if not found then
    return null;
  end if;

  insert into pitch_views (pitch_id, device)
  values (found_pitch.id, case when is_mobile then 'mobile' else 'desktop' end);

  update pitches
     set views = views + 1,
         last_viewed_at = now()
   where id = found_pitch.id;

  select jsonb_build_object(
           'name', o.name,
           'brand', coalesce(o.settings -> 'brand', '{}'::jsonb)
         )
    into brand
    from orgs o
   where o.id = found_pitch.org_id;

  return jsonb_build_object(
    'title',     found_pitch.title,
    'recipient', found_pitch.recipient,
    'sections',  found_pitch.sections,
    'org',       brand
  );
end;
$function$;

grant execute on function public.read_pitch(text, boolean) to anon, authenticated;

comment on function public.read_pitch is
  'Renders a published pitch for whoever holds the link, and counts the read. Returns nothing for an unpublished or archived one.';
