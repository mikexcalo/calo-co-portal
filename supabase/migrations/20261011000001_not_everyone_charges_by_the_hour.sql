-- How the money works, for businesses that do not bill hours.
--
-- The first thing a new account is told to do is set an hourly rate, on the
-- reasoning that without one every invoice comes out at zero. True for a
-- contractor. False for John, who is paid commission by the principals he
-- represents at five percent on new accounts he originates, six to seven on
-- strategic and private label programs, two to three on house accounts handed
-- to him, and three to four on spot. There is no hour anywhere in that, and
-- being asked for an hourly rate on day one tells him the software was built
-- for somebody else.
--
-- Two changes, both small. Commission joins the ways a business can charge, and
-- there is somewhere to write down an arrangement that no rate field can hold.
-- A percentage that varies by how the account was won is not a number, it is a
-- sentence, and pretending otherwise is how you end up with five nullable
-- columns and still no way to say the true thing.

alter table orgs drop constraint if exists orgs_billing_style_check;
alter table orgs add constraint orgs_billing_style_check
  check (billing_style = any (array['hourly', 'fixed', 'both', 'retainer', 'commission']));

alter table orgs add column if not exists billing_note text;

comment on column orgs.billing_note is
  'How the money works, in the business own words. For arrangements no rate column can hold: tiered commission, per container, per account won.';

-- What we already know about John, from his own plan, so his first screen is
-- not asking him a question we have the answer to.
update orgs
   set billing_style = 'commission',
       billing_note = '5% on new accounts he originates. 6 to 7% on strategic or private label programs. 2 to 3% on house accounts handed to him. 2 to 3% on container commodity. 3 to 4% on spot. Paid only after the principal is paid.'
 where slug = 'global-seafood'
   and billing_style is null;
