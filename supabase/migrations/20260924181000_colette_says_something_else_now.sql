-- Colette's messaging, from the site as it stands today.
--
-- The sheet this came off was written against an older Colette: "the first
-- communication & collaboration platform built specifically for how
-- restaurants actually work", pillars of Collaborative / Intelligent /
-- Hospitable, and an elevator pitch ending "helps you get shit done".
--
-- askcolette.ai does not say any of that any more. The line is "Nobody runs a
-- great restaurant alone", the mission is Eli Feldman's and is quoted on the
-- site, the pricing is public, and the three things the product claims are
-- the thread, the record, and the systems answering in the same place. The
-- old pillars were adjectives about the software; the live site argues from
-- what happens on a shift.
--
-- Everything below is on the public site. Nothing is invented.

insert into public.brand_message
  (org_id, brand_id, promise, positioning, audience, mission, tone, elevator, pillars)
values (
  '3404f233-379d-4fa9-95b8-9b37a8dd8634',
  'bbbd306a-54e4-40cd-829a-8af4ef1eed48',

  'Nobody runs a great restaurant alone.',

  'Colette is where a restaurant''s team communicates, collaborates and makes the '
  'decisions that matter — one thread for the people, one place for what the '
  'restaurant knows, connected to the POS, the schedule and the invoices they '
  'already run. Not another app to check: one more conversation instead of one '
  'more login.',

  'Restaurant operators and their teams — the owner or GM who carries the night '
  'in their head, and the managers, chefs and closers on their feet who never '
  'open a dashboard. Sold per location at $200 a month, or $160 billed '
  'annually, with unlimited users, so it is priced for whole teams rather than '
  'seats.',

  'To change how restaurant teams communicate and collaborate, so they can run '
  'profitably and keep providing for the people who work in them. The vision '
  'behind it: an industry where the people who chose this life are bonded by '
  'what they build, not just what they survive, and where a restaurant job is a '
  'career worth keeping.',

  'From the floor, not from the software. Plain, warm and unsentimental — the '
  'way a good operator talks on a Tuesday. It names the actual thing: the bulb '
  'over table twelve, the walk-in fix, the vendor callback. No enterprise '
  'vocabulary, no adjectives the team would not use out loud, and the hard part '
  'of the job is respected rather than explained.',

  'The great nights are never one person carrying the room; it is the whole '
  'house moving as one. Colette keeps a restaurant''s team in one thread and its '
  'knowledge in one place, connected to the systems you already run, so the '
  'people who know the room have what they need to run it. The night gets '
  'written down where the team already talks, last night''s numbers come up in '
  'the same thread you are asking in, and the things that need doing get '
  'assigned out of the night and tracked until they are done. Built inside a '
  'restaurant, not for one, by an operator and two people who had already built '
  'restaurant software at scale.',

  '[
    {
      "name": "The team is in one thread",
      "headline": "Your entire team, on the same page.",
      "support": [
        "One place to communicate and collaborate, built for people working in kitchens and dining rooms and on their feet.",
        "Unlimited users at every location, so nobody is left off to save a seat.",
        "Built for a team that does not sit at a desk, rather than a desk tool pointed at a restaurant."
      ]
    },
    {
      "name": "The night gets written down",
      "headline": "Nothing slips through the cracks.",
      "support": [
        "The closer writes it where the team already talks, which is why the record actually gets kept.",
        "Nobody has to open another app to log it.",
        "Everything the restaurant works out stays with the restaurant, as a source of truth."
      ]
    },
    {
      "name": "The systems answer in the thread",
      "headline": "You stop being the reminder.",
      "support": [
        "Pricing a menu and need last night''s pmix? It comes up in the thread, so everyone is looking at the same number in the same place.",
        "The bulb over table twelve, the walk-in fix, the vendor callback — each one gets assigned out of the night and tracked until it is done.",
        "POS, schedule and invoices all connect in, so the team gets one more conversation instead of one more login."
      ]
    }
  ]'::jsonb
)
on conflict (org_id, brand_id) do update set
  promise     = excluded.promise,
  positioning = excluded.positioning,
  audience    = excluded.audience,
  mission     = excluded.mission,
  tone        = excluded.tone,
  elevator    = excluded.elevator,
  pillars     = excluded.pillars,
  updated_at  = now();
