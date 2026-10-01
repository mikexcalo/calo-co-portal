/*
  Backlog #25's actual case, in the demo.

  The rule is that a studio owns messaging it wrote and the client reads it
  without changing it. Nothing in the demo exercised that: the only two
  `brand_message` rows are Tideline's own, and Colette Intelligence's, whose
  workspace does not exist. So the read-only path could be built and not seen.

  Northwind Studio writes Harbor Light's messaging here, which is the thing the
  product is for. Harbor Light's own Brand screen will show it and offer no
  Save, with a line naming who keeps it.

  The brand row carries the message. `brand_message.brand_id` is how a studio's
  copy is told from a business's own, and Harbor Light had no `brands` row
  under Northwind at all - which is also why its Colors tab reads from
  `orgs.settings` today rather than from a kit.

  Demo only: both orgs are `is_demo`, and the insert is keyed on their ids.
*/

insert into public.brands (org_id, customer_id, name, status)
select '912fe1dc-5b79-4f6f-b954-761fc4111f1d',
       'fefb9967-1a7a-4460-a814-6ebcb8527c1c',
       'Harbor Light Roofing',
       'active'
 where not exists (
   select 1 from public.brands
    where customer_id = 'fefb9967-1a7a-4460-a814-6ebcb8527c1c'
 );

insert into public.brand_message
  (org_id, brand_id, promise, positioning, audience, mission, tone, elevator, pillars)
select
  '912fe1dc-5b79-4f6f-b954-761fc4111f1d',
  b.id,
  'The roof is on before the next storm.',
  'The roofer Austin property managers call when a building cannot wait. Not the cheapest quote and not a year-long job list: a crew that turns up when the damage is found.',
  'Property managers and landlords with more than one building, and the facilities people who answer to them. The person who signs is rarely the person who found the leak.',
  'Keep buildings dry and keep the people responsible for them out of trouble.',
  'Plain, quick, no trade jargon. Says what it found, what it costs, and when it can start.',
  'Harbor Light re-roofs and repairs commercial and residential buildings around Austin. Storm damage gets looked at the same week, the quote comes with photographs, and the work is billed from the hours and materials it actually took.',
  jsonb_build_array(
    jsonb_build_object(
      'name', 'There when it happens',
      'headline', 'Storm damage looked at the same week, not the next quarter.',
      'support', jsonb_build_array(
        'Emergency call-outs are a standing part of the schedule, not an interruption to it.',
        'Every assessment comes back with photographs of what was found.')),
    jsonb_build_object(
      'name', 'Billed from the work',
      'headline', 'The invoice is the hours and the materials, itemised.',
      'support', jsonb_build_array(
        'Time and materials jobs are billed from logged hours and filed receipts.',
        'The proposal is a forecast and is said to be one.')),
    jsonb_build_object(
      'name', 'One crew, one number',
      'headline', 'The person who quoted it is the person on the roof.',
      'support', jsonb_build_array(
        'No subcontracted crews on commercial work.',
        'Licensed in Texas, RCL-114862.'))
  )
  from public.brands b
 where b.customer_id = 'fefb9967-1a7a-4460-a814-6ebcb8527c1c'
   and not exists (select 1 from public.brand_message m where m.brand_id = b.id);
