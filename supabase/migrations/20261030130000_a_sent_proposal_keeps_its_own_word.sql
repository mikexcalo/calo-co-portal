/*
  The word a proposal went out with, kept on the proposal.

  WHY

  The document a customer opens gets its name - Proposal, Estimate, Quote -
  resolved at render time from the sending business's current settings. So the
  business changing its word, or the product changing a default, silently
  rewrites the heading, the reference and the PDF filename on every document
  already in somebody's inbox. A customer who agreed to "Estimate 003" comes
  back to a page calling it something else, and the number they are being asked
  to pay is attached to a document that no longer matches what they were sent.

  `estimates.terms` already works this way: the terms in force are frozen onto
  the row when it is sent, rather than followed live. The word is the same kind
  of fact and gets the same treatment.

  WHAT IS AND IS NOT RECOVERABLE

  This freezes today's wording. It cannot restore yesterday's: nine demo
  proposals read "Estimate" before the rename earlier today and read "Proposal"
  now, and there is no record of the former. No real customer document changed
  - the only two that are sent belong to an agency, which has said Proposal
  throughout - so nothing anybody has received is being papered over.

  INVOICES ARE NOT PART OF THIS

  The invoice page uses no vocabulary at all. "Invoice" is a fixed word
  everywhere in the product and nothing can change it, so there is nothing on
  an invoice to stamp.

  NULL MEANS NOT SENT YET

  A draft has no word because it has not gone anywhere; it follows the
  workspace until it does. The public page falls back to resolving it live, so
  a row that somehow misses the stamp still renders rather than showing a gap.
*/

alter table estimates add column if not exists doc_word text;

comment on column estimates.doc_word is
  'The word this document went out with, frozen at send. Null until sent. The public page prefers it over resolving the sender''s current vocabulary.';

/*
  Backfill: what each sent proposal renders today, which is what its reader is
  looking at right now. A business that has set its own word keeps it; every
  other kind now defaults to Proposal.
*/
update estimates e
   set doc_word = coalesce(nullif(btrim(o.settings->>'estimate_word'), ''), 'Proposal')
  from orgs o
 where o.id = e.org_id
   and e.sent_at is not null
   and e.doc_word is null;
