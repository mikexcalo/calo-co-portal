-- ============================================================================
-- FOLLOWING A REVIEW LINK
-- ============================================================================
-- The customer has no account and never will, so this runs as definer and is
-- scoped by a token nobody can guess. It records the click and hands back
-- where to go.
--
-- Deliberately returns only the destination. A token is a public string in an
-- email that may be forwarded, so this must never expose who was asked, which
-- job it was about, or anything else about the business.
-- ============================================================================

create or replace function public.follow_review(t text)
returns text
language plpgsql
security definer
set search_path = public
as $function$
declare
  dest text;
begin
  update review_requests r
     set clicked_at = coalesce(r.clicked_at, now())   -- first click is the honest one
    from orgs o
   where r.token = t
     and o.id = r.org_id
  returning o.review_link into dest;

  return dest;
end;
$function$;

revoke all on function public.follow_review(text) from public;
grant execute on function public.follow_review(text) to anon, authenticated;

comment on function public.follow_review(text) is
  'Records a review link click and returns where to send them. Returns the destination and nothing else: the token travels in a forwardable email.';
