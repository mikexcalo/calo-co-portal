-- ============================================================================
-- BRAND AND MESSAGING PLATFORM
-- ============================================================================
-- The ten-module framework, held as data rather than as a document.
--
-- The difference matters. A document describes the rules; this enforces two of
-- them. Proof carries a status and the app can refuse to let a placeholder
-- reach a customer. Guardrails carry reasons and the app can check copy
-- against them. The template says it plainly: "An automated check finds this.
-- A human reviewer does not."
--
-- Everything else in the framework is judgement, and judgement stays where it
-- belongs, with the person writing. What gets automated is only the part a
-- person reliably fails at: remembering a banned phrase six weeks later while
-- editing something unrelated.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- The modules.
--
-- Ordered, because each is an input to the next: positioning cannot be written
-- before the audience is defined, and identity cannot start before the pillars
-- are locked.
--
-- state is the mechanism the framework actually turns on. "Most drift comes
-- from quietly rewriting a locked line while editing something else", so a
-- locked module is marked, and the app can say so at the moment somebody edits
-- it rather than in a paragraph nobody rereads.
-- ---------------------------------------------------------------------------

alter table public.brands
  add column if not exists messaging jsonb not null default '[]'::jsonb;

comment on column public.brands.messaging is
  'The ten modules, in order, each with its state and content. Order is not cosmetic: every module is an input to the next.';

-- ---------------------------------------------------------------------------
-- Proof, with permission attached.
--
-- A separate table rather than a blob because these are queried: "show me
-- everything not cleared", "is anything on this page a placeholder". The
-- framework's whole point is that a placeholder is dangerous precisely
-- because it reads well.
-- ---------------------------------------------------------------------------

create table if not exists public.brand_proof (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id) on delete cascade,
  brand_id    uuid not null references brands(id) on delete cascade,

  kind        text not null check (kind in ('quote', 'stat', 'logo')),
  body        text not null,

  -- Who said it, or what the number measures.
  attribution text,
  source      text,
  dated       date,

  /**
   * real        verified, permissioned, safe to publish
   * placeholder written by us to show the shape, never ships
   * gap         we want this and do not have it yet
   */
  status      text not null default 'gap'
              check (status in ('real', 'placeholder', 'gap')),

  permission_on_file boolean not null default false,

  created_at  timestamptz not null default now()
);

create index if not exists brand_proof_brand_idx on public.brand_proof(brand_id);

alter table public.brand_proof enable row level security;

drop policy if exists brand_proof_own on public.brand_proof;
create policy brand_proof_own on public.brand_proof
  for all to authenticated
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

/**
 * "Real requires a name, a title, a company, and written permission on file."
 *
 * Enforced rather than documented, because the failure mode is somebody
 * marking a quote real while meaning "I am fairly sure we can use this", and
 * that quote is then indistinguishable from one that was actually cleared.
 */
alter table public.brand_proof drop constraint if exists brand_proof_real_is_cleared;
alter table public.brand_proof add constraint brand_proof_real_is_cleared
  check (status <> 'real' or (permission_on_file and attribution is not null));

comment on table public.brand_proof is
  'Every quote, statistic and logo with its permission status. A placeholder is dangerous precisely because it reads well.';

-- ---------------------------------------------------------------------------
-- Guardrails.
--
-- Held on the brand as a list of banned terms, each with the reason it is
-- banned. "Rules with reasons survive. Rules without reasons get relitigated
-- every quarter."
-- ---------------------------------------------------------------------------

alter table public.brands
  add column if not exists guardrails jsonb not null default '{"say":[],"never":[]}'::jsonb;

comment on column public.brands.guardrails is
  'What we say, and what we never say with the reason why. The never list is run as a check against copy, not offered as a page to memorise.';
