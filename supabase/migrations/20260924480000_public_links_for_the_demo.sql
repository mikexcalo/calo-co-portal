-- Public tokens for the seeded records, so the customer-facing pages can be
-- opened during the audit.
--
-- Real records get these when the send route runs — 36 hex characters from
-- crypto.randomBytes(18). The seed wrote the rows directly, so it bypassed
-- that and left them null, which means /e/, /i/ and /p/ had nothing to open.
--
-- Same length and same alphabet, generated the same way a real one is: 18
-- random bytes as hex. Nothing weaker, because these pages are reachable
-- without signing in and a guessable token is the whole of their security.
--
-- Only rows that have been sent or published get one. A draft has no public
-- page by design and giving it one would misrepresent how the product works.

set local search_path = public, extensions;

update public.estimates e
   set public_token = encode(gen_random_bytes(18), 'hex')
  from public.orgs o
 where o.id = e.org_id and o.is_demo
   and e.public_token is null
   and e.status in ('sent','accepted','declined');

update public.job_invoices i
   set public_token = encode(gen_random_bytes(18), 'hex')
  from public.orgs o
 where o.id = i.org_id and o.is_demo
   and i.public_token is null
   and i.status <> 'draft';

update public.pitches p
   set public_token = encode(gen_random_bytes(18), 'hex')
  from public.orgs o
 where o.id = p.org_id and o.is_demo
   and p.public_token is null
   and p.published_at is not null;

-- The enquiry form at /new/<token> is per workspace and is how a stranger
-- reaches a business. Each demo workspace gets one so the form can be seen.
update public.orgs
   set intake_token = encode(gen_random_bytes(18), 'hex')
 where is_demo and intake_token is null;
