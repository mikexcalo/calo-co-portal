/* The note written on the demo deposit draft carried an em dash, which this
   product removed from everything a person reads. Same sentence, same
   meaning, punctuation this codebase actually uses. */
update public.job_invoices
set notes = 'Deposit on acceptance. A draft, not sent. The balance is invoiced from the work as it happens.'
where notes like 'Deposit on acceptance. Draft %not sent.%';
