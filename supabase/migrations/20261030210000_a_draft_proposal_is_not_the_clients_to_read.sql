/*
  A draft proposal stops being readable by the client it is about.

  `job_invoices_billed_to_me` and `job_invoice_lines_billed_to_me` both carry
  `status <> 'draft'`, because a bill that has not been sent is not the
  customer's business yet. `estimates_client_read` was written without it, so a
  proposal the studio was still drafting was readable by the client the moment
  the job pointed at them.

  Latent rather than live: no draft estimate currently belongs to a job billed
  to a client who has a workspace, so nothing was exposed. It would have been
  the first time a studio started a proposal for a linked client, which is the
  ordinary case.

  `estimates_billed_to_me` already has the guard and is left alone.
*/

drop policy if exists estimates_client_read on public.estimates;

create policy estimates_client_read on public.estimates
  for select
  using (status <> 'draft' and job_is_billed_to_current_org(job_id));
