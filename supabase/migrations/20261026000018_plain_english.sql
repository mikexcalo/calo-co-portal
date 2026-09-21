-- ============================================================================
-- SAY IT THE WAY YOU'D SAY IT
-- ============================================================================
-- The proposals went out written like a policy document. Mike's words: too much
-- text, too much jargon, and getting cute — "Hosting — runs whether or not
-- anything is asked for this month" is a web hosting fee, and should say
-- "Web hosting".
--
-- Contractions everywhere. "It is" becomes "it's", "you will" becomes "you'll".
-- Nothing is being explained twice, and no line says in twenty words what it
-- can say in four.
-- ============================================================================

do $$
declare
  co  uuid;
  r   record;
begin
  select id into co from orgs where name = 'CALO&CO';
  if co is null then return; end if;

  for r in
    select e.id as est_id, t.hourly_rate, t.standard_rate, t.monthly_fee,
           t.pay_by, t.bills_on
    from estimates e
    join jobs j           on j.id = e.job_id
    join customers c      on c.id = j.customer_id
    join customer_terms t on t.customer_id = c.id and t.org_id = e.org_id
    where e.org_id = co and e.status = 'draft'
  loop
    update estimates set
      scope_in = jsonb_build_array(
        'Your workspace — your people, your records, everything in it, kept running.',
        'Work on your account at $' || trim(to_char(r.hourly_rate,'999990')) ||
          ' an hour, logged as it happens so you can see where it went.',
        'Web hosting, $' || trim(to_char(r.monthly_fee,'999990')) || ' a month.',
        'Fixes and changes to what you''ve already got.'
      ),
      scope_out = jsonb_build_array(
        'Anything you haven''t asked for. Work starts when you ask for it.',
        'Costs we pay on your behalf — domains, ad spend, a paid tool. Passed through at cost, never marked up.',
        'The platform fee. It isn''t set yet.'
      ),
      notes =
        'What you''ll pay' || chr(10) ||
        '$' || trim(to_char(r.monthly_fee,'999990')) || ' a month for hosting, plus $' ||
        trim(to_char(r.hourly_rate,'999990')) || ' an hour for work — and you''re only billed for hours' || chr(10) ||
        'you actually use. There''s no fixed price here because the work isn''t fixed.' || chr(10) || chr(10) ||
        'Your rate' || chr(10) ||
        '$' || trim(to_char(r.hourly_rate,'999990')) || ' an hour. Standard''s $' ||
        trim(to_char(coalesce(r.standard_rate,120),'999990')) ||
        '. You''re at half because you''re friends and family,' || chr(10) ||
        'and it doesn''t expire.' || chr(10) || chr(10) ||
        'The platform fee' || chr(10) ||
        'There''ll be one, but it isn''t set yet. That''s why it''s on here at zero —' || chr(10) ||
        'nothing''s being charged for it. You''ll get the number and we''ll agree it' || chr(10) ||
        'before it ever shows up on an invoice.' || chr(10) || chr(10) ||
        'Billing' || chr(10) ||
        'The ' || r.bills_on || 'st, for the month just gone, by ' || coalesce(r.pay_by,'Venmo or PayPal') || '.' || chr(10) ||
        'Every invoice is built from logged hours and filed receipts. Nothing''s typed' || chr(10) ||
        'in by hand.'
    where id = r.est_id;

    update estimate_lines set description = 'Web hosting'
      where estimate_id = r.est_id and position = 1;

    update estimate_lines set description =
      'Work on your account — $' || trim(to_char(r.hourly_rate,'999990')) ||
      ' an hour, billed only for hours used. Standard''s $' ||
      trim(to_char(coalesce(r.standard_rate,120),'999990')) || '.'
      where estimate_id = r.est_id and position = 2;

    update estimate_lines set description =
      'Platform fee — not set yet. You''ll get the number before it''s ever billed.'
      where estimate_id = r.est_id and position = 3;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- The ampersand mark is not the logo.
--
-- CALO&CO's brand kit held three files — icon-1024, icon-192 and
-- apple-touch-icon — which are the site's favicon, an ampersand in a rounded
-- black square. They were in the logos array, the proposal takes the first
-- logo it finds, so every proposal was headed with a favicon.
--
-- Removed rather than reordered: Mike says it is not the mark and it should
-- not be in the kit. With none left the proposal prints the company name,
-- which is correct until the real file is added.
-- ---------------------------------------------------------------------------

update orgs
set settings = jsonb_set(settings, '{brand,logos}', '[]'::jsonb)
where name = 'CALO&CO'
  and settings->'brand'->'logos' is not null;
