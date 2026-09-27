/*
  The three notes written to prove a note survives the reader being down.

  One read normally with a client picked, one kept word for word while the
  reader was unreachable and then sorted once it came back, and one kept with
  nobody picked so it went to Drops. All three read as Harbor Light roof work
  in Northwind's demo workspace. Proven and removed, like the walkthroughs
  before them.

  The costs go with them, so the usage tile in Overheads goes back to showing
  nothing rather than carrying half a cent of test reading forever.
*/
delete from public.customer_notes
 where body like '%TEST NOTE A, delete me%'
    or body like '%TEST NOTE B, delete me%';

delete from public.drops
 where kind = 'note'
   and body like '%TEST NOTE C, delete me%';
