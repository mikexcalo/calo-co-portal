-- Fixing it on Mike's Home did not put it on Mark's.
--
-- client_awaiting is security_invoker, so every join in it runs as the person
-- asking. Mark passes two of the four and fails the other two:
--
--   estimates  estimates_client_read   job_is_billed_to_current_org(job_id)   OK
--   jobs       jobs_billed_to_me       job_is_billed_to_current_org(id)       OK
--   customers  customers_org_wall      org_id = current_org_id()              NO
--   orgs       orgs_own                membership in that org                 NO
--
-- The customer row is CALO&CO's record OF Mark, and the org row is CALO&CO
-- itself. He is a member of neither, so both joins drop the row and the view
-- returns nothing. He would have signed in to an empty Home again.
--
-- This is the failure mode the last migration's own comment warned about, and
-- I checked it for estimates and then not for the three tables it joins to.
--
-- Two policies, each as narrow as the sentence that justifies it.

-- ----------------------------------------------------------------------------
-- You may read the customer record that IS you.
--
-- Not the agency's other customers — the single row whose linked_org_id points
-- at the workspace you are signed into. It holds your own name, your own
-- email, your own terms. There is at most one per agency.
-- ----------------------------------------------------------------------------
drop policy if exists customers_client_reads_itself on public.customers;

create policy customers_client_reads_itself on public.customers
  for select
  using (linked_org_id is not null and linked_org_id = current_org_id());

-- ----------------------------------------------------------------------------
-- You may read the name of an agency that has you on its books.
--
-- Scoped to agencies that already bill you, which is a relationship they
-- created by adding you. "CALO&CO sent you a proposal" needs the name, and
-- the alternative is denormalising it into every view that ever says who
-- sent something.
-- ----------------------------------------------------------------------------
drop policy if exists orgs_client_reads_its_agency on public.orgs;

create policy orgs_client_reads_its_agency on public.orgs
  for select
  using (
    exists (
      select 1
        from public.customers c
       where c.org_id = orgs.id
         and c.linked_org_id = current_org_id()
    )
  );

comment on policy customers_client_reads_itself on public.customers is
  'A linked client reads the one row that represents them, and nothing else.';
comment on policy orgs_client_reads_its_agency on public.orgs is
  'A linked client reads the name of the agency that bills them.';
