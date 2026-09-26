/*
  Terms that belong to an arrangement, not to a component.

  Three sentences about a monthly platform retainer were compiled into the
  proposal page and printed under every proposal this product sent, including
  a roofer's $24,680 re-roof and a studio's eight-week pilot. The words were
  not the mistake. Their address was.

  Two tables' worth of idea:

    proposal_terms   named, reusable sets a workspace writes once
    estimates.terms  a FROZEN COPY of the sections as they stood when the
                     proposal was sent

  The copy is the part that matters. A saved set gets edited next month, and
  somebody who accepted last month has to keep the words they agreed to. Same
  rule work_grants follows for consent: record it at the moment it is given,
  not at the moment somebody goes looking for it.
*/

create table if not exists public.proposal_terms (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.orgs(id) on delete cascade,
  name        text not null,
  /* [{ "heading": "...", "body": "..." }] - the same shape Faq renders and
     the same shape the estimate freezes. One format, no translation. */
  sections    jsonb not null default '[]'::jsonb,
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

/* A workspace cannot have two live sets with the same name, because the
   picker shows the name and nothing else. Archived ones are allowed to
   collide with live ones: the old "Monthly retainer" stays readable on the
   proposals that used it. */
create unique index if not exists proposal_terms_live_name
  on public.proposal_terms (org_id, lower(name)) where archived_at is null;

create index if not exists proposal_terms_org on public.proposal_terms (org_id);

alter table public.proposal_terms enable row level security;

create policy proposal_terms_own on public.proposal_terms
  for all using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

comment on table public.proposal_terms is
  'Reusable sets of proposal terms, per workspace. What goes ON a proposal is a frozen copy in estimates.terms, never a reference to a row that can change afterwards.';

/* ── The copy that travels with the proposal ───────────────────────────── */

alter table public.estimates
  add column if not exists terms jsonb not null default '[]'::jsonb;

alter table public.estimates
  add column if not exists terms_set_id uuid references public.proposal_terms(id) on delete set null;

comment on column public.estimates.terms is
  'The terms as they stood when this was sent. A copy on purpose: the set it came from may have been edited or archived since, and this is what somebody agreed to.';

comment on column public.estimates.terms_set_id is
  'Which set it came from, for provenance only. Never read to render a proposal.';

/* ── CALO&CO''s retainer terms, as the first saved set ─────────────────── */
/*
  Word for word, because they are good and they are true - of a monthly
  platform retainer, which is the one arrangement they were ever written for.
  They stop being a fact about the software and become a set belonging to the
  workspace that means them.
*/
insert into public.proposal_terms (org_id, name, sections)
select o.id, 'Monthly retainer', jsonb_build_array(
  jsonb_build_object(
    'heading', 'What happens when you approve',
    'body',
      'Nothing changes today. You keep using it exactly as you are.' || E'\n\n' ||
      'Your first invoice arrives on the first of the month, covering the month just gone. Every line is built from hours logged and receipts filed, so you can check it against something that actually happened.' || E'\n\n' ||
      'Want to stop? Tell me and I''ll switch it off that day. No notice period, nothing to cancel, no last invoice for a month you did not use.'
  )
)
from public.orgs o
where o.name = 'CALO&CO'
  and not exists (
    select 1 from public.proposal_terms t
    where t.org_id = o.id and lower(t.name) = 'monthly retainer' and t.archived_at is null
  );

/* ── Backfill: one proposal, and only one ──────────────────────────────── */
/*
  John Litton opened the page on 23 Sept at 01:26 and accepted it on the page
  a minute later, so those three sentences are part of what he agreed to and
  his record should say so.

  Mark Mesedahl's is deliberately left empty. viewed_at is null - he never
  opened the page - and he accepted by email. Writing terms into his record
  would be inventing an agreement to words he never saw, which is a worse
  version of the problem this migration exists to fix.
*/
update public.estimates e
set terms = t.sections,
    terms_set_id = t.id
from public.proposal_terms t, public.orgs o, public.jobs j, public.customers c
where t.org_id = o.id
  and lower(t.name) = 'monthly retainer'
  and o.name = 'CALO&CO'
  and e.org_id = o.id
  and j.id = e.job_id
  and c.id = j.customer_id
  and c.name = 'Global Seafood Partners'
  and e.status = 'accepted'
  and e.viewed_at is not null
  and e.decided_via = 'platform'
  and e.terms = '[]'::jsonb;
