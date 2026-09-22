-- A website, broken into the blocks it is actually made of.
--
-- Editing calo.company means opening a code editor, finding the string,
-- deploying, and hoping. Doing that for a fourth and fifth client site means
-- doing it four and five times, and the reason each one costs the same as the
-- last is that nothing from the previous one was reusable.
--
-- WHAT THIS IS NOT
--
-- Not a page builder. Wix and its kind let you draw anything, which means
-- infinite components, a canvas, drag targets and z-index, and a year of work
-- before it beats writing HTML by hand. Building a worse Wix is the failure
-- mode here and it is worth naming in the schema.
--
-- WHAT IT IS
--
-- A section library. The unit is a whole section — a hero, a proof strip, a
-- services list — never an element inside one. You edit the words and choose
-- between two or three variants of the section; you never touch padding, font
-- size or colour. That constraint is the product: it is what keeps every site
-- looking like you made it, and it is exactly what a page builder throws away.
--
-- A section is a template plus content. The template is code, written once and
-- reused across every client. The content is a row here. That is what makes
-- the fifth site a content entry rather than a build.
--
-- DRAFT AND LIVE ARE TWO COLUMNS, NOT TWO TABLES
--
-- `content` is what the world sees. `draft` is what you are working on. They
-- sit side by side so a preview and the live site can be rendered from one
-- read, and publishing is a copy rather than a migration between tables.

create table if not exists site_sections (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references orgs(id) on delete cascade,

  -- Null means your own site. Set means a client's, so one library serves
  -- every site you run rather than one per client.
  customer_id  uuid references customers(id) on delete cascade,

  -- Which template renders it: hero, proof, services, founder, contact.
  kind         text not null,
  -- Which cut of that template. The whole point of the constraint: a choice
  -- between three, not a canvas.
  variant      text not null default 'default',

  -- The words. Shape belongs to the template, which is why this is not columns.
  content      jsonb not null default '{}',
  -- What you are editing. Null when there is nothing pending.
  draft        jsonb,

  sort         integer not null default 0,
  -- Off means the section exists and is not on the site. Deleting a section
  -- you might want back in a month is worse than hiding it.
  live         boolean not null default true,

  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists site_sections_site on site_sections (org_id, customer_id, sort);
alter table site_sections enable row level security;

drop policy if exists site_sections_own on site_sections;
create policy site_sections_own on site_sections
  for all using (org_id = current_org_id()) with check (org_id = current_org_id());

comment on table site_sections is
  'A site as a list of sections. Template is code, content is a row. draft holds unpublished edits; publishing copies draft into content.';

-- --------------------------------------------------------------- preview ---

-- A link you can open on a phone or send to a client.
--
-- A preview behind a login is a preview you cannot show anybody, and the whole
-- point of reviewing a change is looking at it somewhere other than the screen
-- you made it on. The token is random and per site, so a link can be revoked
-- by changing it without touching the content.
alter table orgs add column if not exists site_preview_token text;

update orgs
   set site_preview_token = regexp_replace(lower(encode(gen_random_bytes(12), 'base64')), '[^a-z0-9]', '', 'g')
 where site_preview_token is null;

create unique index if not exists orgs_site_preview_token on orgs (site_preview_token);
