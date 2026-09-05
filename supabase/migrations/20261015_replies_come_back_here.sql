-- An address per client, so a reply files itself.
--
-- The plan was Gmail read-only sync. It is the right answer for a funded CRM
-- and the wrong first move for this one: gmail.readonly is a Google restricted
-- scope, which means a CASA security assessment by an approved lab, renewed
-- every year, six to twelve weeks for a first submission and thousands of
-- dollars. Below that you sit in testing mode, capped at a hundred users, each
-- added by hand, each shown an unverified-app warning. Survivable for one
-- person. A wall the day a client needs it, which is the entire point.
--
-- Reply routing does the same job for one DNS record. Mail we send carries a
-- Reply-To pointing back at us, the client replies from whatever mail app they
-- already use, and it arrives as an inbound note against the right company. The
-- stage trigger then does what it already does and moves them to Talking.
--
-- WHY A RANDOM KEY AND NOT THE ID
--
-- The address is public the moment an email is sent: it sits in the headers of
-- something a stranger now has. A customer id in that position would let anyone
-- who received one email guess the addresses of other records, and posting to
-- those would write notes into a CRM they have nothing to do with. The key is
-- random, unguessable, and revocable by changing it.

create extension if not exists pgcrypto;

alter table customers add column if not exists reply_key text;

-- Base32-ish over a random 8 bytes: short enough to survive a mail client
-- wrapping the header, long enough that guessing is not a strategy.
update customers
   set reply_key = lower(replace(encode(gen_random_bytes(8), 'base64'), '/', ''))
 where reply_key is null;

update customers
   set reply_key = regexp_replace(reply_key, '[^a-z0-9]', '', 'g')
 where reply_key is not null;

alter table customers alter column reply_key set not null;

create unique index if not exists customers_reply_key on customers (reply_key);

comment on column customers.reply_key is
  'Appears in the Reply-To of mail we send, as reply+<key>@in.<domain>. Public once sent, so random rather than derived. Change it to revoke.';

-- New records get one without anybody remembering to.
create or replace function customers_set_reply_key()
returns trigger
language plpgsql
as $$
begin
  if new.reply_key is null or new.reply_key = '' then
    new.reply_key := regexp_replace(
      lower(encode(gen_random_bytes(8), 'base64')), '[^a-z0-9]', '', 'g');
  end if;
  return new;
end;
$$;

drop trigger if exists customers_reply_key_default on customers;
create trigger customers_reply_key_default
  before insert on customers
  for each row
  execute function customers_set_reply_key();
