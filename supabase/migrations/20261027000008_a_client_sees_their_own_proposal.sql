-- ============================================================================
-- A client signs in and nothing tells them there is a proposal waiting.
--
-- Mark's proposal was sent on 22 September and has never been opened. He has
-- an email address on file and a workspace of his own, and the only route to
-- that document was an email he did not see. Signing in told him nothing: his
-- Home shows his own jobs, his own invoices and his own drafts, and says
-- nothing about what the agency has sent him.
--
-- The read-through already exists for invoices — job_is_billed_to_current_org,
-- written when the same question came up for Bills to You. This is the same
-- shape for the document that comes before the invoice.
--
-- Only sent, and only undecided. A draft is not theirs to see, and one they
-- have already answered is not waiting on anybody.
-- ============================================================================

create or replace view public.client_awaiting as
select
  e.id,
  e.public_token,
  e.total,
  e.sent_at,
  e.viewed_at,
  j.name                as engagement,
  o.name                as agency_name,
  c.linked_org_id       as client_org_id
from estimates e
join jobs j      on j.id = e.job_id
join customers c on c.id = j.customer_id
join orgs o      on o.id = e.org_id
where c.linked_org_id is not null
  and e.status = 'sent'
  and e.sent_at is not null;

alter view public.client_awaiting set (security_invoker = true);

-- ----------------------------------------------------------------------------
-- The client can read the row that is addressed to them, and nothing else.
--
-- security_invoker means the view runs as the person asking, so this policy on
-- the underlying table is what decides it. Without it the view returns nothing
-- to the client, which is the failure mode this pattern already had once.
-- ----------------------------------------------------------------------------
drop policy if exists estimates_client_read on public.estimates;

create policy estimates_client_read on public.estimates
  for select
  using (job_is_billed_to_current_org(job_id));

comment on view public.client_awaiting is
  'Proposals sent to the workspace you are signed into and not yet answered. Sent only: a draft is not theirs to see.';
