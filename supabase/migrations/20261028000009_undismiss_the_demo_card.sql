/* Cleared while testing the Dismiss button. Put back so the demo still shows
   the card, and because the deposit draft it points at is genuinely unsent. */
update public.estimates e
set acceptance_dismissed_at = null
from public.orgs o
where o.id = e.org_id and o.is_demo
  and e.deposit_invoice_id is not null;
