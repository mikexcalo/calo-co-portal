-- Two things: the note John needs to finish his domain, and making sure a note
-- can only be sent once.
--
-- The second is the reason the first is written the way it is. Sending a note
-- has been a plain insert, so running the file twice sent it twice, and John
-- has already had a cleanup migration for exactly that. A title is what
-- somebody recognises a note by, so a business cannot have the same unread
-- note twice.

create unique index if not exists notifications_one_per_title
  on public.notifications (org_id, title)
  where read_at is null and kind = 'system';

-- ---------------------------------------------------------------------------
-- Finishing the domain.
--
-- The nameservers stay with Cloudflare — a Cloudflare-registered domain cannot
-- point anywhere else, which an earlier note got wrong. Two A records do the
-- job instead, and the orange cloud has to be off or the certificate never
-- issues.
-- ---------------------------------------------------------------------------

insert into public.notifications (org_id, kind, title, body)
values (
  '11acc27d-54bc-40a1-a759-83eb04f486c6',
  'system',
  'Two records to add, and one switch to turn off',
  'Your domain is registered and the site is waiting for it. Two records in Cloudflare finish it.

In Cloudflare, open globalseafood.partners, then DNS, then Records, then Add record.

First record:
  Type: A
  Name: @
  IPv4 address: 76.76.21.21
  Proxy status: click the orange cloud so it turns grey and says DNS only
  Save

Second record, same again:
  Type: A
  Name: www
  IPv4 address: 76.76.21.21
  Proxy status: grey, DNS only
  Save

The grey cloud is the part people miss. Orange means Cloudflare answers for the site itself, and the security certificate never gets issued — the site loads with a warning or does not load at all. Grey means Cloudflare just points at us, which is what we want.

It usually works within a few minutes. Nothing else to do after that.'
)
on conflict do nothing;
