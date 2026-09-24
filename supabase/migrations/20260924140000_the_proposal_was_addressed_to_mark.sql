-- Mike's Home was showing him a proposal his own agency had sent.
--
--   NEEDS YOU (1)
--   CALO&CO sent you a proposal
--   Platform Access & Ongoing Development — $40.
--   Read it and accept or decline; nothing happens until you do.
--
-- It is Mark's proposal, sitting unanswered, and it is correct that something
-- is shouting about it. It is shouting in the wrong workspace.
--
-- client_awaiting selects every sent, undecided estimate whose customer has a
-- linked workspace, and says nothing about WHICH workspace is asking. The view
-- is security_invoker, so I leaned on RLS to do the scoping — and RLS does
-- scope it, correctly, for the client: estimates_client_read lets Mark read
-- the estimate billed to Mark.
--
-- What I missed is that the agency passes too. Mike can read every estimate
-- CALO&CO owns, through the policy that has always existed. So in his own
-- workspace the view returns his entire outbox, relabelled as though each one
-- were addressed to him.
--
-- RLS decides what you are allowed to see. It cannot decide who a row is
-- about. That has to be in the view.

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
  and c.linked_org_id = current_org_id()   -- addressed to whoever is asking
  and e.status = 'sent'
  and e.sent_at is not null;

alter view public.client_awaiting set (security_invoker = true);

comment on view public.client_awaiting is
  'Proposals sent TO the workspace you are signed into and not yet answered. '
  'The linked_org_id test is what makes it "to you" rather than "exists" — '
  'without it the agency sees its own outbox as its own inbox.';
