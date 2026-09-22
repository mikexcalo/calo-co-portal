-- ============================================================================
-- OPTIONAL LINES: LETTING THE CUSTOMER ADD TO THE JOB THEMSELVES
-- ============================================================================
-- The cheapest revenue in any trade. Not finding a new customer, not raising
-- prices: giving the one already reading your estimate a way to say yes to
-- something else.
--
-- Nobody upsells on a quote because it feels like pushing, and asking out loud
-- is a conversation most people avoid. A tick box is not a conversation. It
-- sits there, costs nothing to ignore, and turns the awkward part into the
-- customer's own decision.
--
-- WHAT THIS IS CAREFUL ABOUT
--
-- The customer's selection is a fact about what they agreed to buy, so it is
-- recorded when they accept and never inferred afterwards. And the accepted
-- total is computed in the database from what was actually selected, because a
-- total that arrives from a browser is a number anybody can edit.
-- ============================================================================

alter table public.estimate_lines
  add column if not exists optional boolean not null default false;

comment on column public.estimate_lines.optional is
  'A line the customer can take or leave. Excluded from the base price and added only if they tick it.';

/**
 * Whether they took it.
 *
 * Null while the estimate is open, true or false once decided. Null is
 * meaningfully different from false: nobody has answered yet, versus they
 * looked at it and said no. The second is worth knowing when you are deciding
 * whether to offer it again next time.
 */
alter table public.estimate_lines
  add column if not exists selected boolean;

-- What the estimate is worth if they take nothing extra. Kept beside the total
-- so both numbers are readable without recomputing either.
alter table public.estimates
  add column if not exists base_total numeric(12,2);

comment on column public.estimates.base_total is
  'The price without any optional lines. estimates.total is base plus whatever was selected.';

-- ---------------------------------------------------------------------------
-- Totals computed from the lines, always.
--
-- The same rule the rest of the money already follows. An estimate total that
-- can disagree with its own lines is the bug that let a browser write qty 10 x
-- $250 = $50, and it is not a bug worth having twice.
-- ---------------------------------------------------------------------------

create or replace function public.sync_estimate_total()
returns trigger
language plpgsql
as $function$
declare
  eid uuid := coalesce(new.estimate_id, old.estimate_id);
  base numeric(12,2);
  extra numeric(12,2);
begin
  select
    coalesce(sum(total) filter (where not optional), 0),
    -- Before a decision, an optional line counts toward nothing. After it, it
    -- counts only if the customer said yes.
    coalesce(sum(total) filter (where optional and selected is true), 0)
  into base, extra
  from estimate_lines
  where estimate_id = eid;

  update estimates
     set base_total = base,
         total      = base + extra,
         updated_at = now()
   where id = eid;

  return null;
end;
$function$;

drop trigger if exists estimate_lines_total on public.estimate_lines;
create trigger estimate_lines_total
  after insert or update or delete on public.estimate_lines
  for each row execute function public.sync_estimate_total();

-- ---------------------------------------------------------------------------
-- Accepting, with the selection recorded.
--
-- One function so the decision and the selection land together. Doing it in
-- two calls from the application leaves a window where an estimate is accepted
-- with nobody having recorded what was accepted.
--
-- security definer because the customer has no account, and scoped entirely by
-- a token they were sent.
-- ---------------------------------------------------------------------------

create or replace function public.accept_estimate_lines(t text, chosen uuid[])
returns numeric
language plpgsql
security definer
set search_path = public
as $function$
declare
  eid uuid;
  final numeric(12,2);
begin
  select id into eid
    from estimates
   where public_token = t
     and status in ('sent', 'draft')
   limit 1;

  if eid is null then
    return null;
  end if;

  -- Every optional line gets an answer, not only the ticked ones. "They said
  -- no" is worth knowing next time you write a quote for them.
  update estimate_lines
     set selected = (id = any(coalesce(chosen, '{}')))
   where estimate_id = eid
     and optional;

  select total into final from estimates where id = eid;
  return final;
end;
$function$;

revoke all on function public.accept_estimate_lines(text, uuid[]) from public;
grant execute on function public.accept_estimate_lines(text, uuid[]) to anon, authenticated;

comment on function public.accept_estimate_lines(text, uuid[]) is
  'Records which optional lines a customer took and returns the recomputed total. The total comes from the database, never from the browser.';
