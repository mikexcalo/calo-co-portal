-- Every receipt anybody ever uploaded failed to read, and nobody knew.
--
-- The schema sent to the model declared category as ['string','null'] and then
-- listed string values in its enum, which the API rejects outright — the
-- request 400'd before the model ever saw the document. So the upload
-- succeeded, the row was written, the read failed, and the screen showed a
-- receipt with no vendor and no amount as though the paper had been illegible.
--
-- John's Cloudflare invoice failed twice in forty-four seconds, which is what
-- somebody does when they think they did it wrong.
--
-- The code is fixed and checked against the real API. These two rows are the
-- wreckage: same file, same failure, nothing extracted. Removing them so the
-- retry is a clean one rather than a fourth copy.

delete from public.documents
 where status = 'failed'
   and extracted is null
   and extraction_error like '%does not match declared type%';

insert into public.notifications (org_id, kind, title, body)
values (
  '11acc27d-54bc-40a1-a759-83eb04f486c6',
  'system',
  'Your Cloudflare invoice — that was us, not you',
  'You uploaded the Cloudflare invoice twice and nothing came of it. That was a bug at our end, not anything you did, and it was failing for everyone who tried it.

It is fixed. The two failed copies have been cleared out so you are not looking at a pile of them.

Open Receipts and upload it once more. It should come back with Cloudflare as the vendor, the date, and the amount, for you to check before it saves.

Once it does, it counts as a business expense and shows up against your profit.'
)
on conflict do nothing;
