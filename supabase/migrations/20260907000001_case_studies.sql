-- ============================================================================
-- CASE STUDIES
-- ============================================================================
-- WHY THIS IS NOT A KIND OF PITCH
--
-- The instinct to file it under pitches is understandable, and wrong for one
-- reason: lifecycle. A pitch is written for one prospect, sent once, and is
-- finished whether it wins or loses. A case study is written once and reused
-- for years, across many pitches, the website, and a proposal you have not
-- thought of yet.
--
-- Nest the durable thing inside the disposable one and reuse becomes copying.
-- Copies drift, and six months later three versions of the HotSchedules story
-- disagree about what the results were. The relationship runs the other way:
-- a pitch cites case studies.
--
-- It is also the back end of the website, which settles it. A page on
-- calo.company cannot be a child of a pitch that was sent to somebody else.
-- ============================================================================

create table if not exists public.case_studies (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id) on delete cascade,

  -- Optional. The best case studies are often for companies that were never
  -- clients of this workspace: past employers, agency work, things predating
  -- the business entirely.
  customer_id uuid references customers(id) on delete set null,

  client      text not null,
  title       text not null,
  summary     text,
  sector      text,
  year        text,

  /**
   * What you actually did. A list, because agency work is never one thing and
   * "brand" as a single word tells a reader nothing.
   */
  roles       jsonb not null default '[]'::jsonb,

  /**
   * The five movements of a case study, as named fields rather than free
   * sections.
   *
   * Named because the shape is the useful part. Every one of these should
   * answer the same five questions in the same order, and a blank `outcome` is
   * then a visible gap rather than a section somebody quietly left out.
   */
  situation   text,
  approach    text,
  execution   text,
  enablement  text,
  outcome     text,

  status      text not null default 'draft'
              check (status in ('draft', 'ready', 'published')),

  -- Same mechanism as estimates and pitches: a link anybody can open, with no
  -- account, that stops working the moment it is unpublished.
  public_token text unique,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists case_studies_org_idx on public.case_studies(org_id);

alter table public.case_studies enable row level security;

drop policy if exists case_studies_own on public.case_studies;
create policy case_studies_own on public.case_studies
  for all to authenticated
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

-- ---------------------------------------------------------------------------
-- Claims, with a source.
--
-- The same rule the brand framework already enforces on proof, applied where
-- it matters most. "Reached millions of views" is the sentence a reader
-- remembers and the one a prospect will repeat back to you in a meeting. If
-- nobody can say where the number came from, it is a gap dressed as a result.
--
-- Separate from the prose so the check is mechanical. A number buried in a
-- paragraph cannot be counted; a row with a null source can.
-- ---------------------------------------------------------------------------

create table if not exists public.case_study_claims (
  id        uuid primary key default gen_random_uuid(),
  org_id    uuid not null references orgs(id) on delete cascade,
  case_id   uuid not null references case_studies(id) on delete cascade,

  claim     text not null,
  -- Where the number came from and when it was true. Null is the whole point:
  -- it makes an unsourced claim visible instead of plausible.
  source    text,
  dated     text,

  /**
   * sourced   somebody can point at where this came from
   * estimated directionally true, stated as an estimate, never as a figure
   * unsourced we believe it and cannot show it
   */
  status    text not null default 'unsourced'
            check (status in ('sourced', 'estimated', 'unsourced')),

  created_at timestamptz not null default now()
);

create index if not exists case_study_claims_case_idx on public.case_study_claims(case_id);

alter table public.case_study_claims enable row level security;

drop policy if exists case_study_claims_own on public.case_study_claims;
create policy case_study_claims_own on public.case_study_claims
  for all to authenticated
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

/**
 * Sourced has to be able to show its work.
 *
 * Enforced rather than documented, for the same reason the proof table
 * enforces it: the failure mode is somebody marking a claim sourced while
 * meaning "I am fairly sure that is right", after which it is indistinguishable
 * from one that was actually checked.
 */
alter table public.case_study_claims drop constraint if exists case_study_claims_sourced_has_source;
alter table public.case_study_claims add constraint case_study_claims_sourced_has_source
  check (status <> 'sourced' or (source is not null and length(btrim(source)) > 0));

comment on table public.case_study_claims is
  'Every number a case study asserts, with where it came from. An unsourced claim is a gap dressed as a result, and this is the highest stakes place for one.';

-- ---------------------------------------------------------------------------
-- Publishing needs a token, and unpublishing has to actually revoke.
-- ---------------------------------------------------------------------------

create or replace function public.case_study_token()
returns trigger language plpgsql as $function$
begin
  if new.status = 'published' and new.public_token is null then
    new.public_token := encode(gen_random_bytes(16), 'hex');
  end if;

  -- Dropping the token is what makes unpublishing mean something. Leaving it
  -- in place would keep every link anybody had already been sent alive.
  if new.status <> 'published' then
    new.public_token := null;
  end if;

  new.updated_at := now();
  return new;
end;
$function$;

drop trigger if exists case_studies_token on public.case_studies;
create trigger case_studies_token
  before insert or update on public.case_studies
  for each row execute function public.case_study_token();
