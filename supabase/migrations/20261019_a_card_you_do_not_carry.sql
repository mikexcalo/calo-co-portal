-- A business card that lives on a phone.
--
-- The paper version has two failure modes and both are fatal to a follow-up.
-- You run out, or they lose it. A printed QR fixes neither: it is still a card
-- somebody has to keep, and it points at whatever you decided six months ago.
--
-- This is a page at a short address, and the QR for it is drawn on your screen
-- rather than printed on anything. You hold your phone up, they scan, and they
-- land somewhere you can change tomorrow.
--
-- WHY IT IS NOT JUST A LINK TO THE HOMEPAGE
--
-- A homepage answers "what is this company". Somebody who just met you is
-- asking a different question: who were you, and how do I get hold of you. A
-- card answers that in one screen, saves to their contacts in one tap, and
-- then offers the site to the ones who want more. Sending them to the homepage
-- makes every one of them do the work of finding you again later.

create table if not exists cards (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id) on delete cascade,

  -- The whole address. Short because it is read aloud and typed by hand more
  -- often than anybody expects.
  slug        text not null unique
              check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}$'),

  name        text not null,
  title       text,
  company     text,
  email       text,
  phone       text,
  website     text,
  photo_url   text,
  tagline     text,

  -- One action. A card with four buttons is a menu, and a menu is a decision
  -- somebody makes by leaving.
  cta_label   text,
  cta_url     text,

  -- Anything else worth reaching: LinkedIn, a portfolio, a calendar.
  links       jsonb not null default '[]',

  live        boolean not null default true,
  -- Counted so the thing can be judged. A card nobody scans is a card to change.
  scans       integer not null default 0,
  last_scan   timestamptz,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists cards_org on cards (org_id);
alter table cards enable row level security;

drop policy if exists cards_own on cards;
create policy cards_own on cards
  for all using (org_id = current_org_id()) with check (org_id = current_org_id());

comment on table cards is
  'A digital business card at /c/<slug>. Public by design; the QR for it is drawn on screen rather than printed, so where it points can change without reprinting anything.';

-- Counting a scan without a session.
--
-- The card is read by somebody with no account, so the increment cannot go
-- through row level security. Definer rights, one column, no way to read
-- anything back: the worst somebody can do by calling it is inflate a number
-- on their own visit, which they were about to do anyway by visiting.
create or replace function note_card_scan(card_slug text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update cards
     set scans = scans + 1,
         last_scan = now()
   where slug = card_slug and live;
end;
$$;

revoke all on function note_card_scan(text) from public;
grant execute on function note_card_scan(text) to anon, authenticated;
