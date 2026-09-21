-- ============================================================================
-- INTEGRITY FIXES
-- ============================================================================
-- Three bugs found in review. All three are the kind that stay quiet until
-- there is real money in the system.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. An estimate's total could disagree with the sum of its lines.
--
-- The total was computed once at creation. Edit, add or remove a line
-- afterwards and the header silently stops matching — the customer sees one
-- number on the page and a different one in the summary, and there is no way
-- to tell which is right. That is exactly the 99c gap on Turks Cap.
--
-- Enforced in the database rather than the app, because the app is not the
-- only thing that will ever write to these tables.
-- ---------------------------------------------------------------------------

create or replace function sync_estimate_total()
returns trigger
language plpgsql
as $$
declare
  target uuid := coalesce(new.estimate_id, old.estimate_id);
begin
  update estimates
  set total = coalesce((
        select round(sum(total)::numeric, 2)
        from estimate_lines where estimate_id = target
      ), 0)
  where id = target;
  return null;
end;
$$;

drop trigger if exists estimate_lines_sync_total on estimate_lines;
create trigger estimate_lines_sync_total
  after insert or update or delete on estimate_lines
  for each row execute function sync_estimate_total();

-- Bring existing rows into line, including the Turks Cap discrepancy.
update estimates e
set total = coalesce((
      select round(sum(l.total)::numeric, 2)
      from estimate_lines l where l.estimate_id = e.id
    ), e.total);

-- ---------------------------------------------------------------------------
-- 2. Invoice numbering: a race, and a sort that breaks at 10,000.
--
-- The old approach read the highest existing number as TEXT and added one.
-- Two invoices raised at the same moment both read INV-0003 and both try
-- INV-0004; the unique constraint catches it, but the second person gets a
-- database error instead of an invoice. And "INV-9999" sorts above
-- "INV-10000" lexically, so numbering would silently restart.
--
-- A real integer column fixes both: numeric ordering, and a value the
-- database assigns rather than the client guessing.
-- ---------------------------------------------------------------------------

alter table job_invoices add column if not exists seq integer;

-- Backfill from whatever numbers already exist.
with ordered as (
  select id, org_id,
         row_number() over (partition by org_id order by created_at) as rn
  from job_invoices
)
update job_invoices i set seq = o.rn from ordered o where o.id = i.id and i.seq is null;

create unique index if not exists job_invoices_org_seq_idx on job_invoices(org_id, seq);

/**
 * Assign the next number inside the insert, so two concurrent inserts cannot
 * land on the same one. The unique index is what makes the retry necessary,
 * and the loop is what makes it survivable.
 */
create or replace function assign_invoice_seq()
returns trigger
language plpgsql
as $$
declare
  attempt integer := 0;
begin
  if new.seq is not null then
    return new;
  end if;

  loop
    select coalesce(max(seq), 0) + 1 into new.seq
    from job_invoices where org_id = new.org_id;

    new.number := 'INV-' || lpad(new.seq::text, 4, '0');

    begin
      return new;
    exception when unique_violation then
      attempt := attempt + 1;
      if attempt > 5 then raise; end if;
    end;
  end loop;
end;
$$;

drop trigger if exists job_invoices_assign_seq on job_invoices;
create trigger job_invoices_assign_seq
  before insert on job_invoices
  for each row execute function assign_invoice_seq();

-- ---------------------------------------------------------------------------
-- 3. last_billed_on was read but never written.
--
-- The retainer cadence works out when a job next falls due FROM this column.
-- Nothing ever set it, so once a retainer became due it stayed due forever —
-- the prompt would fire every single day regardless of being acted on, and a
-- prompt that never goes away is one people stop reading.
-- ---------------------------------------------------------------------------

create or replace function stamp_last_billed()
returns trigger
language plpgsql
as $$
begin
  update jobs
  set last_billed_on = coalesce(new.issued_on, current_date)
  where id = new.job_id;
  return new;
end;
$$;

drop trigger if exists job_invoices_stamp_last_billed on job_invoices;
create trigger job_invoices_stamp_last_billed
  after insert on job_invoices
  for each row execute function stamp_last_billed();
