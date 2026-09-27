/*
  The note written while checking that an unread note can be saved.

  It reads as Harbor Light's own record of a delivery that never happened, so
  it goes the same way the four hours and the ridge-vent photo did. What it
  was there to prove is proved: the text reached the database word for word,
  with sorted_at null, filed against both the job and the customer.
*/
delete from public.customer_notes
 where job_id = '4a090a1f-a023-496d-8121-d09033c43f0f'
   and sorted_at is null
   and body like 'Ridge vents delivered two short%';
