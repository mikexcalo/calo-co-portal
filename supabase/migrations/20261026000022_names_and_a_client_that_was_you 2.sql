-- ============================================================================
-- A BUSINESS THAT WAS ITS OWN CUSTOMER, AND NAMES IN LOWER CASE
-- ============================================================================
-- Mammoth's Customers screen listed Mammoth Construction as a client of
-- Mammoth Construction, and People showed the homeowner as somebody who
-- "works at a client" — that client being Mark's own company.
--
-- It came from reading an estimate PDF. The reader took the name off the
-- letterhead, which on a contractor's estimate is the contractor, and filed it
-- as the client. So the renovation at 1018 B Cushing Dr was booked against
-- Mark rather than against the person who lives there.
--
-- The person is already on the record with the title "home owner". That is the
-- customer.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A name written the way a person writes it.
--
-- Only words that are entirely lower case get touched, so CALO&CO stays
-- CALO&CO and McCallum stays McCallum. Somebody typing "nikhail" in a hurry
-- gets "Nikhail" and the screen stops looking careless.
-- ---------------------------------------------------------------------------

create or replace function public.tidy_person_name(n text)
returns text
language sql
immutable
as $$
  select nullif(
    (select string_agg(
       case when w = lower(w) then upper(left(w, 1)) || substr(w, 2) else w end,
       ' ' order by i)
     from unnest(string_to_array(regexp_replace(trim(coalesce(n, '')), '\s+', ' ', 'g'), ' '))
          with ordinality as t(w, i)),
    '')
$$;

comment on function public.tidy_person_name is
  'Capitalises words that are entirely lower case and leaves every other word alone.';

create or replace function public.tidy_names()
returns trigger
language plpgsql
as $$
begin
  if TG_TABLE_NAME = 'customer_contacts' then
    new.name := public.tidy_person_name(new.name);
  else
    new.contact_name := public.tidy_person_name(new.contact_name);
  end if;
  return new;
end;
$$;

drop trigger if exists tidy_contact_name on customer_contacts;
create trigger tidy_contact_name
  before insert or update of name on customer_contacts
  for each row execute function public.tidy_names();

drop trigger if exists tidy_customer_contact on customers;
create trigger tidy_customer_contact
  before insert or update of contact_name on customers
  for each row execute function public.tidy_names();

-- Everything already on file.
update customer_contacts set name = public.tidy_person_name(name)
  where name is not null and name <> public.tidy_person_name(name);
update customers set contact_name = public.tidy_person_name(contact_name)
  where contact_name is not null and contact_name <> public.tidy_person_name(contact_name);

-- ---------------------------------------------------------------------------
-- The client that was actually the business itself.
--
-- Renamed rather than deleted. The job, its estimate and the homeowner all
-- hang off this row, and deleting it would take a $20,847 estimate with it.
-- The row was always meant to be the customer; it just had the wrong name on
-- it, taken off the wrong part of the page.
-- ---------------------------------------------------------------------------

do $$
declare r record; who text;
begin
  for r in
    select c.id, c.org_id, c.name
    from customers c join orgs o on o.id = c.org_id
    where lower(c.name) = lower(o.name)
  loop
    select public.tidy_person_name(cc.name) into who
      from customer_contacts cc
     where cc.customer_id = r.id
     order by cc.created_at
     limit 1;

    if who is null then
      -- Nobody to name it after. Say plainly that it needs a name rather than
      -- inventing one, and get it out of the customer list meanwhile.
      update customers set relationship = 'other' where id = r.id;
      raise notice 'Self-named client % has no contact; moved to Other.', r.name;
    else
      update customers
         set name = who,
             contact_name = coalesce(contact_name, who)
       where id = r.id;
      raise notice 'Client % renamed to %.', r.name, who;
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- And stop it happening again.
--
-- A business is never its own customer. The reader cannot know that a name on
-- a letterhead is the sender rather than the recipient, but the database knows
-- exactly which org it is writing into, so the check belongs here — one rule,
-- rather than a guard in every path that can create a client.
-- ---------------------------------------------------------------------------

create or replace function public.no_self_customer()
returns trigger
language plpgsql
as $$
declare mine text;
begin
  select name into mine from orgs where id = new.org_id;
  if mine is not null and lower(trim(new.name)) = lower(trim(mine)) then
    raise exception 'A business cannot be its own customer: "%" is you. Name the person or company you are doing the work FOR.', new.name
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists no_self_customer on customers;
create trigger no_self_customer
  before insert or update of name on customers
  for each row execute function public.no_self_customer();
