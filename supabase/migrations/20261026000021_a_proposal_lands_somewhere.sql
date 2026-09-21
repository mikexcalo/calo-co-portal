-- ============================================================================
-- WHERE A SENT PROPOSAL ACTUALLY GOES
-- ============================================================================
-- Mike asked where a proposal lands for John once it is sent. The honest
-- answer was: nowhere.
--
-- estimates carried exactly one policy — org_id = current_org_id() — so a
-- proposal is visible to the business that WROTE it and to nobody else. jobs
-- has a second policy, jobs_billed_to_me, letting the client read the
-- engagement they are being billed for. estimates never got the equivalent, so
-- the proposal existed for John only as a link in an email. Lose the email,
-- lose the document.
--
-- And Global Seafood's customer record was never linked to Global Seafood's
-- org, so even the invoice read-through that does exist showed him nothing.
-- Mammoth's was linked. John's was not.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Link the record to the business, the way Mammoth's already is.
-- ---------------------------------------------------------------------------

update customers c
set linked_org_id = o.id
from orgs o
where c.name = 'Global Seafood Partners'
  and o.name = 'Global Seafood Partners'
  and c.linked_org_id is null;

-- ---------------------------------------------------------------------------
-- A proposal the client can read.
--
-- Same shape as jobs_billed_to_me and the same limit: SELECT only, and only
-- where the customer record points back at the caller's own business. Nothing
-- here lets a client see a draft — an estimate nobody has sent is not theirs
-- to read, and showing it would leak a price before it was decided.
-- ---------------------------------------------------------------------------

drop policy if exists estimates_billed_to_me on estimates;
create policy estimates_billed_to_me on estimates
  for select to authenticated
  using (
    status <> 'draft'
    and job_is_billed_to_current_org(job_id)
  );

-- The lines too, or the client sees a total with nothing behind it.
drop policy if exists estimate_lines_billed_to_me on estimate_lines;
create policy estimate_lines_billed_to_me on estimate_lines
  for select to authenticated
  using (
    exists (
      select 1 from estimates e
      where e.id = estimate_lines.estimate_id
        and e.status <> 'draft'
        and job_is_billed_to_current_org(e.job_id)
    )
  );

comment on policy estimates_billed_to_me on estimates is
  'A client can read a proposal that has been sent to them. Drafts stay with the business that wrote them.';
