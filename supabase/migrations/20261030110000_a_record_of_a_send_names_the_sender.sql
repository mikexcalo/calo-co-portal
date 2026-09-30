-- A record of a send that omits the sender is half a record. Three reminders
-- vanished between Resend and an inbox, and the first question - what did the
-- envelope actually say - could not be answered from the table that exists to
-- answer exactly that.
alter table public.mail_sends
  add column if not exists from_email text;

comment on column public.mail_sends.from_email is
  'The From header as sent, display name included. The half Gmail weighs against the sending domain.';
