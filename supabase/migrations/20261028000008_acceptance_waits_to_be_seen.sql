/*
  An acceptance somebody has dealt with.

  A customer saying yes is the best news this product carries, and until now
  it landed as one line in the notification tray, which is where things go to
  be missed. It becomes a card on Home instead - and a card that will not go
  away on its own needs a way to say "seen it".

  Two ways off the screen, and only two: the deposit draft gets sent, or the
  owner dismisses it. Both are deliberate acts, which is the point. A card
  that expires by itself is a card that can take an unsent invoice with it.
*/
alter table public.estimates
  add column if not exists acceptance_dismissed_at timestamptz;

comment on column public.estimates.acceptance_dismissed_at is
  'When the owner cleared the acceptance card off Home. Null means it is still waiting to be dealt with.';
