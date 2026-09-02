-- ============================================================================
-- WHOSE LIST IS THIS
-- ============================================================================
-- targets.customer_id answers "who did this target become". Nothing answered
-- "whose campaign is this", so John's hundred and four prospects belong to
-- nobody, and the second client doing outbound would have their list silently
-- merged into his.
--
-- Two different questions were being asked of one column, which is why the
-- names are now explicit. for_client_id is the client the work is for.
-- became_customer_id is the client it turned into. A target can have both, and
-- they are rarely the same company.
-- ============================================================================

alter table public.targets
  add column if not exists for_client_id uuid references customers(id) on delete cascade;

comment on column public.targets.for_client_id is
  'The client this list is being worked for. Null means it is your own list. Cascades, because a target list has no meaning without the client it belongs to.';

alter table public.targets
  rename column customer_id to became_customer_id;

comment on column public.targets.became_customer_id is
  'Who this target became once they said yes. Different question from for_client_id, and rarely the same company.';

create index if not exists targets_for_client_idx on public.targets(for_client_id);

-- The duplicate rule was per workspace, which would have stopped two clients
-- from both targeting Sysco. It is per list.
drop index if exists targets_no_duplicates;
create unique index if not exists targets_no_duplicates
  on public.targets(org_id, coalesce(for_client_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

alter table public.targets drop constraint if exists targets_won_has_customer;
alter table public.targets add constraint targets_won_has_customer
  check (status <> 'won' or became_customer_id is not null);
