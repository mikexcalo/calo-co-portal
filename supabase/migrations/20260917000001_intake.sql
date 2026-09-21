-- ============================================================================
-- AN ENQUIRY FROM SOMEBODY WITH NO ACCOUNT
-- ============================================================================
-- A link for a yard sign, an email footer, or a website. Somebody fills it in
-- and they are in the client list as a prospect, with what they asked for
-- written down.
--
-- The alternative it replaces is a phone call at 6pm that gets remembered
-- wrong, or a form on a website that emails an address nobody reads twice.
--
-- Definer, because the person filling it in has no account and never will.
-- Scoped entirely by a token, and it writes rather than reads, so there is
-- nothing here to leak even if the token is passed around.
-- ============================================================================

create or replace function public.submit_enquiry(
  t text,
  who text,
  contact_email text,
  contact_phone text,
  detail text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
declare
  o uuid;
  cust uuid;
begin
  select id into o from orgs where intake_token = t limit 1;
  if o is null then
    return false;
  end if;

  -- Length caps rather than validation. This endpoint is open to the internet,
  -- and the useful protection is refusing to store a megabyte, not guessing
  -- whether a name is real.
  who := left(btrim(coalesce(who, '')), 120);
  contact_email := left(btrim(coalesce(contact_email, '')), 200);
  contact_phone := left(btrim(coalesce(contact_phone, '')), 40);
  detail := left(btrim(coalesce(detail, '')), 4000);

  if who = '' then
    return false;
  end if;

  insert into customers (org_id, name, email, phone, stage)
  values (o, who, nullif(contact_email, ''), nullif(contact_phone, ''), 'prospect')
  returning id into cust;

  /**
   * What they wrote goes in as an inbound note.
   *
   * Direction matters: this is them getting in touch, which means nobody owes
   * them a reply yet in the way an unanswered outbound message does.
   */
  /**
   * Where they came from is recorded in the note rather than a column.
   *
   * customers has no source field, and adding one for a single value would be
   * a column that is null on every row somebody types in by hand. The note is
   * the honest place: it is what happened, dated.
   */
  insert into customer_notes (org_id, customer_id, kind, direction, body, happened_on)
  values (
    o, cust, 'note', 'in',
    'Came in through the enquiry form.' || case when detail <> '' then E'\n\n' || detail else '' end,
    current_date
  );

  insert into notifications (org_id, kind, title, body, href)
  values (o, 'lead', 'New enquiry', who || coalesce(' · ' || nullif(contact_phone, ''), ''), '/customers/' || cust);

  return true;
end;
$function$;

revoke all on function public.submit_enquiry(text, text, text, text, text) from public;
grant execute on function public.submit_enquiry(text, text, text, text, text) to anon, authenticated;

comment on function public.submit_enquiry(text, text, text, text, text) is
  'Writes an enquiry straight into the client list as a prospect. Write only, token scoped, length capped because it is open to the internet.';
