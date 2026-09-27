/*
  The note written to check that sorting from a job screen records what it
  cost.

  Kept unread on the Harbor Light engagement while the reader was
  unreachable, then sorted from the job page once it was back. It reads as
  Northwind's own note about a ridge cap. Proven and removed, like the
  walkthroughs before it, and the cost goes with it so the usage tile in
  Overheads is back to showing nothing.
*/
delete from public.customer_notes
 where body like '%TEST NOTE D, delete me%'
    or title = 'South run ridge cap lifting';
