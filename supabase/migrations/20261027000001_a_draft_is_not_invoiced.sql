-- ============================================================================
-- A draft is not a debt.
--
-- job_ledger summed every invoice that was not void, so the moment the monthly
-- run drafted GSEA-001 and MMTH-001 the platform began reporting $160 owed.
-- Nobody had been asked for it. Nobody could have paid it. It read as "OWING
-- YOU $160" on Clients, "AWAITING PAYMENT $160" on Projects, "$80 owed" on
-- both project cards, and a green $80 margin on Home.
--
-- Profit & Loss had already been corrected in the app, which made it worse
-- rather than better: its summary excluded drafts while its per-project table
-- read this view, so one screen showed no revenue and $160 invoiced at once.
--
-- Money moves unbilled -> drafted -> invoiced -> collected. The view had no
-- middle step, so drafted work had to be counted as one end or the other.
-- drafted_total is that step, and invoiced_total now means what it says.
--
-- The rest of this view is carried over unchanged from
-- 20260906000001_ledger_carries_terms.sql, because create or replace view
-- restates the whole thing.
-- ============================================================================

create or replace view public.job_ledger as
 SELECT j.id AS job_id,
    j.org_id,
    j.name,
    j.status,
    j.billing_type,
    j.customer_id,
    COALESCE(l.hours, 0::numeric) AS hours_logged,
    COALESCE(l.labor_value, 0::numeric) AS labor_value,
    COALESCE(l.unbilled_labor, 0::numeric) AS unbilled_labor,
    COALESCE(c.cost_total, 0::numeric) AS cost_total,
    COALESCE(c.unbilled_cost, 0::numeric) AS unbilled_cost,
    COALESCE(i.invoiced_total, 0::numeric) AS invoiced_total,
    COALESCE(i.collected, 0::numeric) AS collected,
    COALESCE(e.estimate_total, 0::numeric) AS estimate_total,
    COALESCE(i.invoiced_total, 0::numeric) - COALESCE(c.cost_total, 0::numeric) AS margin_to_date,
    -- Hours remaining against what the fee assumed. Null unless this is a
    -- retainer with a stated expectation, because there is nothing to compare
    -- against otherwise and a zero would read as "on budget".
    CASE
        WHEN j.billing_type = 'retainer' AND j.retainer_hours IS NOT NULL
        THEN j.retainer_hours - COALESCE(l.hours, 0::numeric)
        ELSE NULL
    END AS retainer_variance,
    -- Appended rather than placed beside billing_type: create or replace view
    -- cannot reorder existing columns, and dropping the view to get a tidier
    -- column order would take every policy and grant on it with it.
    j.consideration,
    j.consideration_note,
    j.retainer_amount,
    j.retainer_hours,
    -- Appended, because create or replace view can only add columns at the end.
    COALESCE(i.drafted_total, 0::numeric) AS drafted_total
   FROM jobs j
     LEFT JOIN ( SELECT time_entries.job_id,
            sum(time_entries.hours) AS hours,
            sum(time_entries.hours * time_entries.rate) AS labor_value,
            sum(
                CASE
                    WHEN time_entries.invoiced_on IS NULL AND time_entries.billable THEN time_entries.hours * time_entries.rate
                    ELSE 0::numeric
                END) AS unbilled_labor
           FROM time_entries
          GROUP BY time_entries.job_id) l ON l.job_id = j.id
     LEFT JOIN ( SELECT costs.job_id,
            sum(costs.amount) AS cost_total,
            sum(
                CASE
                    WHEN costs.invoiced_on IS NULL AND costs.billable THEN costs.amount
                    ELSE 0::numeric
                END) AS unbilled_cost
           FROM costs
          GROUP BY costs.job_id) c ON c.job_id = j.id
     LEFT JOIN ( SELECT job_invoices.job_id,
            -- Issued means it left the building.
            sum(job_invoices.total) FILTER (WHERE job_invoices.status <> 'draft') AS invoiced_total,
            sum(job_invoices.amount_paid) FILTER (WHERE job_invoices.status <> 'draft') AS collected,
            -- Written, not sent. Real work, but not yet a claim on anybody.
            sum(job_invoices.total) FILTER (WHERE job_invoices.status = 'draft') AS drafted_total
           FROM job_invoices
          WHERE job_invoices.status <> 'void'::text
          GROUP BY job_invoices.job_id) i ON i.job_id = j.id
     LEFT JOIN ( SELECT estimates.job_id,
            estimates.total AS estimate_total
           FROM estimates
          WHERE estimates.status = 'accepted'::text) e ON e.job_id = j.id;

alter view public.job_ledger set (security_invoker = true);
