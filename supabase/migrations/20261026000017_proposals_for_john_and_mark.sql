-- ============================================================================
-- WHAT JOHN AND MARK HAVE NOT ACTUALLY BEEN TOLD
-- ============================================================================
-- The terms are in customer_terms and have been since this morning: $60 an
-- hour against a $120 standard, $20 a month for hosting, platform use not
-- priced, billed on the 1st, paid by Venmo or PayPal. The note on both rows
-- says it out loud — "Platform use will be charged on top once the amount is
-- decided. Nothing is being invoiced yet."
--
-- None of which either of them has seen. Two draft proposals, one each, saying
-- the same numbers in the form they can read and accept.
--
-- DRAFTS. Nothing is sent by this migration. Mike reads them, changes what he
-- wants, and sends them himself.
--
-- The platform fee is left at zero and SAID to be undecided rather than
-- guessed at. An invented number on the one document that sets what somebody
-- pays is the worst possible place for the "obviously wrong beats plausible"
-- rule to be broken.
-- ============================================================================

do $$
declare
  co       uuid;
  tier_std numeric;
  r        record;
  est      uuid;
begin
  select id into co from orgs where name = 'CALO&CO';
  if co is null then raise notice 'No CALO&CO; nothing written.'; return; end if;

  select hourly_rate into tier_std from rate_tiers where org_id = co and key = 'standard';

  for r in
    select j.id as job_id, c.name as customer, t.hourly_rate, t.monthly_fee,
           t.monthly_fee_for, t.pay_by, t.bills_on
    from jobs j
    join customers c      on c.id = j.customer_id
    join customer_terms t on t.customer_id = c.id and t.org_id = j.org_id
    where j.org_id = co
      and j.name = 'Platform and support'
      and c.name in ('Global Seafood Partners', 'Mammoth Construction')
  loop
    -- Idempotent: re-running must not stack up drafts on the same engagement.
    if exists (select 1 from estimates where job_id = r.job_id) then
      raise notice 'Proposal already exists for %, skipping.', r.customer;
      continue;
    end if;

    insert into estimates (
      org_id, job_id, version, status, total, base_total, valid_until,
      public_token, scope_in, scope_out, notes
    )
    values (
      co, r.job_id, 1, 'draft',
      r.monthly_fee, r.monthly_fee,
      current_date + 30,
      replace(gen_random_uuid()::text, '-', ''),
      jsonb_build_array(
        'The platform itself — your workspace, your people, your records, kept running and kept current.',
        'Work on your account billed by the hour at $' || trim(to_char(r.hourly_rate,'999990.00')) || ', logged as it happens so you can see it against the hour it was spent.',
        r.monthly_fee_for || ', at $' || trim(to_char(r.monthly_fee,'999990.00')) || ' a month.',
        'Changes to what you already have — copy, pricing, a page that is wrong — handled as they come up.'
      ),
      jsonb_build_array(
        'Anything you have not asked for. Work starts when you ask for it, not on a schedule.',
        'Third-party costs paid on your behalf — domains, ad spend, a paid tool — passed through at what they cost, never marked up.',
        'Platform use itself, which is not priced yet. See the note below.'
      ),
      'What this is' || chr(10) ||
      'A rate, not a quote. There is no fixed price here because the work is not' || chr(10) ||
      'fixed — you are charged for the hours you actually use and the one monthly' || chr(10) ||
      'cost that runs whether you use it or not.' || chr(10) || chr(10) ||
      'The rate' || chr(10) ||
      '$' || trim(to_char(r.hourly_rate,'999990.00')) || ' an hour. The standard rate is $' ||
        trim(to_char(coalesce(tier_std,120),'999990.00')) || '; yours is held at half that as' || chr(10) ||
      'friends and family, and it is not a promotional rate that expires. It is' || chr(10) ||
      'written down so neither of us has to remember what was said.' || chr(10) || chr(10) ||
      'The platform fee, which you have not been told yet' || chr(10) ||
      'There will be one, and it is not decided. It is on this proposal at zero' || chr(10) ||
      'because a number invented here is a number you would be agreeing to, and' || chr(10) ||
      'nothing is being charged for it now. You will be told the figure and asked' || chr(10) ||
      'before it appears on any invoice — this line exists so it is not a' || chr(10) ||
      'surprise later rather than to collect anything today.' || chr(10) || chr(10) ||
      'How it is billed' || chr(10) ||
      'On the ' || r.bills_on || 'st, for the month just finished, by ' || coalesce(r.pay_by,'agreement') || '.' || chr(10) ||
      'Every invoice is built from logged hours and filed receipts, each line' || chr(10) ||
      'pointing back at what it came from. Nothing is typed in by hand.'
    )
    returning id into est;

    insert into estimate_lines (estimate_id, kind, description, qty, unit, unit_price, total, position, optional, selected)
    values
      (est, 'other',
       r.monthly_fee_for || ' — runs whether or not anything is asked for this month',
       1, 'month', r.monthly_fee, r.monthly_fee, 1, false, true),

      (est, 'labor',
       'Work on your account, at $' || trim(to_char(r.hourly_rate,'999990.00')) ||
       ' an hour (standard $' || trim(to_char(coalesce(tier_std,120),'999990.00')) ||
       '). Billed for the hours actually used, so this is $0 in a month nobody asks for anything.',
       0, 'hour', r.hourly_rate, 0, 2, false, true),

      (est, 'other',
       'Platform use — not priced yet, and not being charged. You will be told the figure and asked before it is ever billed.',
       0, 'month', 0, 0, 3, true, false);

    raise notice 'Draft proposal written for %.', r.customer;
  end loop;
end $$;
