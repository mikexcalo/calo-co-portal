-- The trigger that numbers an invoice has to agree with the two that were just
-- renumbered by hand, or the third one raised goes back to INV-0003.
--
-- Per client, counting from one. A client's own sequence is the only one they
-- ever see, so it never leaks how many others there are — INV-0087 tells a new
-- customer exactly how big the book is, and 001 tells them nothing.
--
-- seq stays global and unchanged. It is what makes the sort stable and the
-- concurrency safe; the number is what people read.

create or replace function public.assign_invoice_seq()
returns trigger
language plpgsql
as $$
declare
  attempt integer := 0;
  code text;
  mine integer;
begin
  if new.seq is not null and new.number is not null then
    return new;
  end if;

  select c.code into code
    from public.jobs j
    join public.customers c on c.id = j.customer_id
   where j.id = new.job_id;

  loop
    select coalesce(max(seq), 0) + 1 into new.seq
      from public.job_invoices where org_id = new.org_id;

    if code is null then
      -- A job with no client attached still has to produce something unique.
      new.number := 'INV-' || lpad(new.seq::text, 4, '0');
    else
      select count(*) + 1 into mine
        from public.job_invoices i
        join public.jobs j on j.id = i.job_id
       where j.customer_id = (select customer_id from public.jobs where id = new.job_id);
      new.number := code || '-' || lpad(mine::text, 3, '0');
    end if;

    begin
      return new;
    exception when unique_violation then
      attempt := attempt + 1;
      if attempt > 5 then raise; end if;
    end;
  end loop;
end;
$$;

-- A new client gets a code the moment it is created, rather than the first
-- time somebody tries to invoice it and finds there is nothing to prefix with.
create or replace function public.assign_customer_code()
returns trigger
language plpgsql
as $$
declare
  base text;
  try text;
  n int := 1;
begin
  if new.code is not null then return new; end if;
  base := public.suggest_code(new.name);
  try := base;
  while exists (
    select 1 from public.customers
     where org_id = new.org_id and upper(code) = upper(try)
  ) loop
    n := n + 1;
    try := base || n::text;
  end loop;
  new.code := try;
  return new;
end;
$$;

drop trigger if exists customers_assign_code on public.customers;
create trigger customers_assign_code
  before insert on public.customers
  for each row execute function public.assign_customer_code();
