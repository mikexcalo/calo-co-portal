/*
  Who wrote each piece of messaging, recorded per piece.

  THE RULE

  Whoever wrote it owns it. A studio's piece is read-only to the client, the
  way it is today. A client's own piece stays the client's to edit, and keeps
  being theirs after a studio arrives. The studio can still change a client's
  piece, but only from inside Work in it, where the change is recorded and the
  client is told - which is the same bargain as every other edit a studio makes
  in somebody else's workspace.

  WHY PER PIECE AND NOT PER ROW

  Ownership was the row: a whole `brand_message` either belonged to the studio
  or to the business. That is only true until the two of them fill in different
  halves of the same framework, which is the ordinary case - the client knows
  its own promise and the studio writes the positioning. One flag for seven
  pieces cannot describe that, so it is a flag per piece.

  `authors` maps a field name to 'studio' or 'client'. Pillars carry their own
  `author` inside each pillar object, because a pillar is a piece too and the
  list is open-ended.

  BACKFILL, WITHOUT TOUCHING A WORD

  A row stored under a studio's org against a client's brand was written by that
  studio; anything else was written by the business whose row it is. That is the
  whole test, and it is structural - nothing is guessed from content and no
  wording is read or changed.

  Only pieces that have something in them are stamped. An empty field was never
  written by anybody, and belongs to whoever fills it in.
*/

alter table public.brand_message
  add column if not exists authors jsonb not null default '{}'::jsonb;

comment on column public.brand_message.authors is
  'Who wrote each piece: field name to ''studio'' or ''client''. A piece with no entry has not been written yet and belongs to whoever writes it. Pillars carry their own author inside each pillar object.';

/* Stamp the six text pieces on every existing row. */
update public.brand_message m
   set authors = (
     select coalesce(jsonb_object_agg(k, v), '{}'::jsonb)
       from (
         select k, case
                  when exists (
                    select 1 from public.brands b
                      join public.customers c on c.id = b.customer_id
                     where b.id = m.brand_id and c.org_id = m.org_id
                  ) then 'studio' else 'client' end as v
           from (values ('promise'), ('positioning'), ('audience'),
                        ('mission'), ('tone'), ('elevator')) as f(k)
          where coalesce(btrim(
                  case k
                    when 'promise'     then m.promise
                    when 'positioning' then m.positioning
                    when 'audience'    then m.audience
                    when 'mission'     then m.mission
                    when 'tone'        then m.tone
                    when 'elevator'    then m.elevator
                  end), '') <> ''
       ) t
   )
 where m.authors = '{}'::jsonb;

/* And every pillar, in place, leaving its name, headline and support alone. */
update public.brand_message m
   set pillars = (
     select coalesce(jsonb_agg(
              case when p ? 'author' then p
                   else p || jsonb_build_object('author',
                     case when exists (
                       select 1 from public.brands b
                         join public.customers c on c.id = b.customer_id
                        where b.id = m.brand_id and c.org_id = m.org_id
                     ) then 'studio' else 'client' end)
              end
              order by ord), '[]'::jsonb)
       from jsonb_array_elements(m.pillars) with ordinality as e(p, ord)
   )
 where jsonb_typeof(m.pillars) = 'array'
   and jsonb_array_length(m.pillars) > 0;
