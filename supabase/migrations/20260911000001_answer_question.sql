-- ============================================================================
-- ANSWERING A QUESTION ABOUT YOUR OWN DATA
-- ============================================================================
-- The queries live here rather than in the application, for one reason: this
-- function runs as the person who called it, so row level security applies
-- exactly as it does everywhere else. current_org_id() is the same choke point
-- every policy already depends on, and it is stated again in each query rather
-- than assumed, because tenancy is the one thing that must never rely on being
-- remembered.
--
-- Deliberately not generated SQL. A model writing queries against a shared
-- database is one missing where clause from returning another business's
-- invoices, and row level security catching most of that is not a standard
-- worth accepting on somebody's customer list. The model picks which of these
-- to run and nothing else.
--
-- security invoker is the default and is load-bearing here. Marking this
-- definer would run every query as the owner and silently defeat the point.
-- ============================================================================

create or replace function public.answer_question(qid text)
returns table (result jsonb)
language plpgsql
stable
as $function$
begin
  case qid
    when 'who_owes_money' then
      return query select coalesce(jsonb_agg(t), '[]'::jsonb) from (select coalesce(c.name, 'Unknown customer') as customer,
             sum(i.total - i.amount_paid) as owed,
             count(*) as invoices,
             min(i.due_on) as oldest_due
      from job_invoices i
      left join jobs j on j.id = i.job_id
      left join customers c on c.id = j.customer_id
      where i.org_id = current_org_id()
        and i.status <> 'void'
        and i.total > i.amount_paid
      group by c.name
      order by owed desc) t;
    when 'overdue_invoices' then
      return query select coalesce(jsonb_agg(t), '[]'::jsonb) from (select coalesce(c.name, 'Unknown customer') as customer,
             i.number, i.due_on,
             (i.total - i.amount_paid) as owed,
             (current_date - i.due_on) as days_late
      from job_invoices i
      left join jobs j on j.id = i.job_id
      left join customers c on c.id = j.customer_id
      where i.org_id = current_org_id()
        and i.status <> 'void'
        and i.due_on < current_date
        and i.total > i.amount_paid
      order by i.due_on) t;
    when 'unbilled_work' then
      return query select coalesce(jsonb_agg(t), '[]'::jsonb) from (select name, unbilled_labor, unbilled_cost,
             (unbilled_labor + unbilled_cost) as unbilled
      from job_ledger
      where org_id = current_org_id()
        and (unbilled_labor + unbilled_cost) > 0
      order by unbilled desc) t;
    when 'job_margin' then
      return query select coalesce(jsonb_agg(t), '[]'::jsonb) from (select name, invoiced_total, cost_total, margin_to_date
      from job_ledger
      where org_id = current_org_id()
        and (invoiced_total > 0 or cost_total > 0)
      order by margin_to_date) t;
    when 'this_week' then
      return query select coalesce(jsonb_agg(t), '[]'::jsonb) from (select name, job_name, customer_name, starts_on, ends_on, assignee
      from week_ahead
      where org_id = current_org_id()
        and starts_on <= current_date + 7
        and coalesce(ends_on, starts_on) >= current_date
      order by starts_on) t;
    when 'late_work' then
      return query select coalesce(jsonb_agg(t), '[]'::jsonb) from (select name, job_name, customer_name, ends_on,
             (current_date - ends_on) as days_late
      from week_ahead
      where org_id = current_org_id() and overdue
      order by ends_on) t;
    when 'quiet_clients' then
      return query select coalesce(jsonb_agg(t), '[]'::jsonb) from (select name, awaiting_reply_since,
             (current_date - awaiting_reply_since) as days_waiting
      from customers
      where org_id = current_org_id()
        and awaiting_reply_since is not null
      order by awaiting_reply_since) t;
    when 'revenue_this_year' then
      return query select coalesce(jsonb_agg(t), '[]'::jsonb) from (select sum(total) as invoiced,
             sum(amount_paid) as collected,
             count(*) as invoices
      from job_invoices
      where org_id = current_org_id()
        and status <> 'void'
        and issued_on >= date_trunc('year', current_date)) t;
    when 'open_jobs' then
      return query select coalesce(jsonb_agg(t), '[]'::jsonb) from (select j.name, j.status, c.name as customer, j.scheduled_start
      from jobs j
      left join customers c on c.id = j.customer_id
      where j.org_id = current_org_id()
        and j.status not in ('done', 'cancelled')
      order by j.scheduled_start nulls last) t;
    when 'tax_set_aside' then
      return query select coalesce(jsonb_agg(t), '[]'::jsonb) from (select o.tax_set_aside_pct as pct,
             coalesce(sum(i.amount_paid), 0) as collected
      from orgs o
      left join job_invoices i
        on i.org_id = o.id
       and i.status <> 'void'
       and i.issued_on >= date_trunc('year', current_date)
      where o.id = current_org_id()
      group by o.tax_set_aside_pct) t;
    else
      return query select '[]'::jsonb;
  end case;
end;
$function$;

revoke all on function public.answer_question(text) from public;
grant execute on function public.answer_question(text) to authenticated;

comment on function public.answer_question(text) is
  'Runs one of a fixed set of questions as the calling user, so RLS applies. The model chooses the id; it never writes the query.';
