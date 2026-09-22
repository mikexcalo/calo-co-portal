-- Customers said "nobody on file" while People, one row down, listed somebody
-- who works there.
--
-- Both were reading honestly and reading different places. The Customers list
-- takes its WHO column from customers.contact_name — a single text field typed
-- on the company record — and People reads customer_contacts, which is the
-- table anything dropped in writes to. So every contact read off a document
-- landed somewhere the company row could not see.
--
-- contact_name stays, because somebody who typed a name there meant it. What
-- changes is that when it is empty the first real contact answers instead.

create or replace view public.customer_summary as
 SELECT c.id AS customer_id, c.org_id, c.name,
    COALESCE(c.contact_name, pc.name) AS contact_name,
    COALESCE(c.contact_title, pc.title) AS contact_title,
    COALESCE(c.email, pc.email) AS email,
    COALESCE(c.phone, pc.phone) AS phone,
    c.avatar_url, c.stage, c.next_action, c.next_action_on,
    c.last_contacted_on,
    COALESCE(j.job_count, 0::bigint) AS jobs,
    COALESCE(j.open_jobs, 0::bigint) AS open_jobs,
    COALESCE(l.invoiced, 0::numeric) AS invoiced,
    COALESCE(l.collected, 0::numeric) AS collected,
    COALESCE(l.invoiced, 0::numeric) - COALESCE(l.collected, 0::numeric) AS owed,
    COALESCE(l.unbilled, 0::numeric) AS unbilled,
    n.last_note_on, c.brief,
    c.workspace_id IS NOT NULL AS has_login,
    c.logo_url,
    public.customer_logo_path(c.id) AS logo_path,
    c.waiting_on
   FROM customers c
     -- Oldest first, so the answer does not change every time somebody is added.
     LEFT JOIN LATERAL (
       SELECT cc.name, cc.title, cc.email, cc.phone
         FROM customer_contacts cc
        WHERE cc.customer_id = c.id AND cc.name IS NOT NULL AND cc.name <> ''
        ORDER BY cc.created_at, cc.id
        LIMIT 1
     ) pc ON true
     LEFT JOIN ( SELECT jobs.customer_id, count(*) AS job_count,
            count(*) FILTER (WHERE jobs.status = ANY (ARRAY['lead'::text, 'estimating'::text, 'won'::text, 'active'::text])) AS open_jobs
           FROM jobs WHERE jobs.customer_id IS NOT NULL GROUP BY jobs.customer_id) j ON j.customer_id = c.id
     LEFT JOIN ( SELECT jb.customer_id, sum(lg.invoiced_total) AS invoiced,
            sum(lg.collected) AS collected,
            sum(lg.unbilled_labor + lg.unbilled_cost) AS unbilled
           FROM job_ledger lg JOIN jobs jb ON jb.id = lg.job_id
          WHERE jb.customer_id IS NOT NULL GROUP BY jb.customer_id) l ON l.customer_id = c.id
     LEFT JOIN ( SELECT customer_notes.customer_id, max(customer_notes.happened_on) AS last_note_on
           FROM customer_notes GROUP BY customer_notes.customer_id) n ON n.customer_id = c.id;

-- Restated because replacing a view resets it, and that flag is the tenancy wall.
alter view public.customer_summary set (security_invoker = true);
