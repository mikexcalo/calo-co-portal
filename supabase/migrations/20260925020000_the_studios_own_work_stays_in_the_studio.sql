-- A client can read the studio's internal job about them, the hours on it,
-- the rate charged, and invoices that have not been sent.
--
-- Tested as Mark, signed into Mammoth Construction:
--
--   JOBS      CALO&CO :: Platform Access & Ongoing Development
--   TIME      1.00h @ 60.00 "Setup and support"
--   INVOICES  MMTH-001  draft  80.00
--   NOTES     none
--
-- So: the name of the internal engagement, the hours logged against it, the
-- hourly rate, and a draft invoice that had deliberately not been approved or
-- sent. Notes were already safe.
--
-- These read-throughs exist for a good reason — "Bills to You" has to show a
-- client what they owe — and they were drawn one table too wide. A client
-- needs the bill. They do not need the timesheet behind it, the job record it
-- hangs off, or a draft the sender has not decided to send.
--
-- Three policies change, and one view is rebuilt so the legitimate screen
-- keeps working without the broad access it was leaning on.

-- ── 1. The job row itself ───────────────────────────────────────────────────
-- job_is_billed_to_current_org is SECURITY DEFINER, so the invoice and
-- estimate read-throughs that call it keep working with this gone.
drop policy if exists jobs_billed_to_me on public.jobs;

-- ── 2. The hours and the rate ───────────────────────────────────────────────
-- What the client is entitled to see is the invoice and its lines, which say
-- what they are paying for. The timesheet is how the studio arrived at it.
drop policy if exists time_entries_billed_to_me on public.time_entries;

-- ── 3. Drafts ───────────────────────────────────────────────────────────────
-- A draft is not a bill. estimates already had exactly this rule and invoices
-- did not, which is why Mark could see MMTH-001 before it was approved.
drop policy if exists job_invoices_billed_to_me on public.job_invoices;

create policy job_invoices_billed_to_me on public.job_invoices
  for select
  using (status <> 'draft' and job_is_billed_to_current_org(job_id));

-- Lines follow their invoice, so a draft's lines go with it.
drop policy if exists job_invoice_lines_billed_to_me on public.job_invoice_lines;

create policy job_invoice_lines_billed_to_me on public.job_invoice_lines
  for select
  using (
    exists (
      select 1 from public.job_invoices i
       where i.id = job_invoice_lines.invoice_id
         and i.status <> 'draft'
         and job_is_billed_to_current_org(i.job_id)
    )
  );

-- ── 4. Bills to You, without the broad access ───────────────────────────────
-- client_account selects from jobs and time_entries, and ran as the caller —
-- so it only worked because of the two policies just dropped. Rebuilt as
-- SECURITY DEFINER with the scope moved inside it: one workspace's own
-- account, decided by the view rather than by whoever calls it.
--
-- Definer is safe here precisely because the filter is no longer optional.
-- The page used to pass .eq('client_org_id', ...) and a caller that forgot to
-- would have seen every client's account; now it cannot.
create or replace view public.client_account as
select
  j.id                                   as job_id,
  j.name                                 as engagement,
  j.billing_period,
  j.last_billed_on,
  c.linked_org_id                        as client_org_id,
  o.name                                 as agency_name,
  coalesce(t.hours, 0::numeric)          as hours_logged,
  coalesce(t.unbilled_value, 0::numeric) as accruing,
  coalesce(i.invoiced, 0::numeric)       as invoiced_total,
  coalesce(i.paid, 0::numeric)           as paid_total,
  (coalesce(i.invoiced, 0::numeric) - coalesce(i.paid, 0::numeric)) as owed,
  coalesce(i.drafted, 0::numeric)        as drafted_total
from jobs j
join customers c on c.id = j.customer_id
join orgs o on o.id = j.org_id
left join (
  select time_entries.job_id,
         sum(time_entries.hours) as hours,
         sum(case when time_entries.invoiced_on is null
                  then time_entries.hours * time_entries.rate else 0::numeric end) as unbilled_value
    from time_entries
   where time_entries.billable
   group by time_entries.job_id
) t on t.job_id = j.id
left join (
  select job_invoices.job_id,
         sum(job_invoices.total)       filter (where job_invoices.status <> 'draft') as invoiced,
         sum(job_invoices.amount_paid) filter (where job_invoices.status <> 'draft') as paid,
         sum(job_invoices.total)       filter (where job_invoices.status =  'draft') as drafted
    from job_invoices
   where job_invoices.status <> 'void'
   group by job_invoices.job_id
) i on i.job_id = j.id
where c.linked_org_id is not null
  /* The scope, inside the view, so no caller can widen it. A client sees the
     account that is theirs; the agency sees the accounts it bills. */
  and (c.linked_org_id = current_org_id() or j.org_id = current_org_id());

alter view public.client_account set (security_invoker = false);

grant select on public.client_account to authenticated;
