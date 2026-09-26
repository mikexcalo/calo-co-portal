/*
  A demo workspace with its own terms, so the two states are both visible.

  Harbor Light's sent re-roof carries a set and shows it. Tideline's pilot
  carries none and shows nothing - which is the more important of the two,
  because "nothing" is what most proposals should say and the old page could
  not say it.

  Written as a roofer would, not as a template would: what the deposit is for,
  and what the guarantee actually covers.
*/
insert into public.proposal_terms (org_id, name, sections)
select o.id, 'Re-roof, fixed price', jsonb_build_array(
  jsonb_build_object(
    'heading', 'How payment works',
    'body',
      '30% when you approve, which books the crew and orders the material.' || E'\n\n' ||
      'The balance when the job passes inspection, not when we leave the site. If the inspector wants something changed, that is ours to fix before you pay the rest.'
  ),
  jsonb_build_object(
    'heading', 'What is guaranteed',
    'body',
      'Ten years on our workmanship. If it leaks and the cause is how we fitted it, we come back and it costs you nothing.' || E'\n\n' ||
      'The shingles carry the manufacturer''s own warranty, which is longer and is between you and them. We register it in your name on the day we finish and send you the paperwork.'
  )
)
from public.orgs o
where o.name = 'Harbor Light Roofing' and o.is_demo
  and not exists (
    select 1 from public.proposal_terms t
    where t.org_id = o.id and lower(t.name) = 're-roof, fixed price' and t.archived_at is null
  );

/* Frozen onto the proposal that is already out, as if it had been chosen
   when it was sent. */
update public.estimates e
set terms = t.sections, terms_set_id = t.id
from public.proposal_terms t, public.orgs o
where t.org_id = o.id
  and lower(t.name) = 're-roof, fixed price'
  and o.name = 'Harbor Light Roofing' and o.is_demo
  and e.org_id = o.id
  and e.status = 'sent'
  and e.total = 24680
  and e.terms = '[]'::jsonb;
