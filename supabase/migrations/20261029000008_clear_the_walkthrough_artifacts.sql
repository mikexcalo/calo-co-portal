/*
  Putting the demo back after walking a job end to end on a phone.

  The walk-through was the verification the brief asked for - open today's
  job, move its status, log time, add a note, add a photo - and every step of
  it wrote a real row. Left in place they read as the business's own records:
  four hours nobody worked, a canvas-drawn photo captioned "ridge vent,
  unit 4", and a re-roof in progress that the Home card still describes as
  just accepted.

  Status goes back to `won`, which is what the accepted-proposal card and the
  DS-001 deposit draft are both describing.

  The storage object behind the photo is left alone. Deleting a file is the
  one step here with no undo, the row is what made it visible anywhere in the
  product, and an orphan in a demo bucket costs nothing.
*/
delete from public.time_entries
 where job_id = '4a090a1f-a023-496d-8121-d09033c43f0f'
   and hours = 4
   and created_at > now() - interval '2 hours';

delete from public.documents
 where job_id = '4a090a1f-a023-496d-8121-d09033c43f0f'
   and file_name = 'ridge-vent.jpg';

update public.jobs
   set status = 'won'
 where id = '4a090a1f-a023-496d-8121-d09033c43f0f';
