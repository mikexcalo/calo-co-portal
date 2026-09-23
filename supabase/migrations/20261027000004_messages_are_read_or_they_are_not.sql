-- ============================================================================
-- A message is read or it is not, and that is not the same as open.
--
-- feedback has had a status since it was written — open, building, done, wont
-- — which is what YOU are going to do about it. It has never had any record of
-- whether anybody looked at the thing. Those are different facts and the
-- screen needs both: Mike has read Lakemere's message a dozen times and it
-- still sits there looking exactly as new as the first time, because nothing
-- anywhere knows he has seen it.
--
-- Every inbox ever built solves this the same way and people already know how
-- it works. Unread is bold. Read is not. Nothing else changes.
-- ============================================================================

alter table public.feedback
  add column if not exists read_at timestamptz;

comment on column public.feedback.read_at is
  'When somebody on the receiving side opened it. Null means unread. Separate from status, which is what is being done about it.';

create index if not exists feedback_unread
  on public.feedback (org_id, read_at) where read_at is null;

-- Anything already answered has obviously been read, so the inbox does not
-- open on a pile of bold messages somebody dealt with weeks ago.
update public.feedback
   set read_at = coalesce(closed_at, created_at)
 where read_at is null
   and (status <> 'open' or reply is not null);
