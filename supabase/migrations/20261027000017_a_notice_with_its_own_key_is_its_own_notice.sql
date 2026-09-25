/*
  Two work sessions, one notice.

  notifications_one_per_title is unique on (org_id, title) for unread system
  rows, and it is right about what it was built for: "No payment methods set"
  is a standing condition, and three copies of it unread is three copies of
  one fact.

  A hand-back notice is not a condition, it is an event, and its title is the
  same sentence every time - "Demo from CALO&CO worked in your workspace
  today". So the first one landed, and every session after it was refused by
  the index until somebody happened to read the first. The client was told
  once per workspace, ever. That is precisely the promise the amber bar makes
  in every screen of a work session, and it was being quietly broken by an
  index.

  A row that carries a dedupe_key has already said what makes it unique, and
  notifications_dedupe already enforces it. The title index only needs to
  cover the rows that have not said.
*/

drop index if exists public.notifications_one_per_title;

create unique index notifications_one_per_title
  on public.notifications (org_id, title)
  where read_at is null and kind = 'system' and dedupe_key is null;

comment on index public.notifications_one_per_title is
  'One unread system notice per title, for notices with no key of their own. A keyed notice is deduped by notifications_dedupe instead: it is an event, not a standing condition.';
