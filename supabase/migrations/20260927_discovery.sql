-- ============================================================================
-- THE QUESTIONS YOU ASKED, AND WHAT CAME BACK
-- ============================================================================
-- John's answers are the single most useful thing anybody has given us, and
-- they are currently seven thousand characters of prose inside a document. The
-- document has a summary above it now, which tells you whether to open it, and
-- then you are reading a wall.
--
-- A discovery answer is not a paragraph in a file. It is a question somebody
-- asked, an answer somebody gave, about a specific subject, that informs a
-- specific decision. Stored that way it can be sorted, filtered, quoted, and
-- pointed at from the framework module it feeds. Stored as prose it can only
-- be read from the top.
--
-- This is the same argument as proof and guardrails: the value is in the grain.
-- ============================================================================

create table if not exists public.discovery (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,

  /**
   * What the question is about.
   *
   * Free text because a client with two principals has three subjects and a
   * client with none has one, and a fixed list would be wrong by the second
   * engagement.
   */
  subject     text,

  question    text not null,
  answer      text,

  /**
   * Which framework module this feeds.
   *
   * The reason to keep discovery structured rather than as prose: an answer
   * about what people did before you existed is brand_idea input, and being
   * able to ask "what do I have for positioning" is the difference between a
   * framework you fill in and a framework you assemble.
   */
  informs     text,

  -- Worth coming back to. An answer that changes what you would do, or one
  -- that is thin and needs asking again.
  flagged     boolean not null default false,
  note        text,

  asked_on    date,
  answered_on date,
  -- Where it came from, so a quote can be traced to a document.
  source_id   uuid references brand_intel(id) on delete set null,

  position    int not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists discovery_customer_idx on public.discovery(customer_id, position);

alter table public.discovery enable row level security;

drop policy if exists discovery_own on public.discovery;
create policy discovery_own on public.discovery
  for all to authenticated
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

comment on table public.discovery is
  'Questions asked and answers given, one row each. Prose can only be read from the top; this can be sorted, filtered, quoted and pointed at from the module it feeds.';
