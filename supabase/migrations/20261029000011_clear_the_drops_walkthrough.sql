/*
  The note written to check that a note with nobody picked still gets kept.

  It reads as Northwind's own record of a conversation at a supply counter,
  filed against a real demo project. Proven and removed, like the four hours
  and the ridge-vent photo before it.
*/
delete from public.drops
 where kind = 'note'
   and body like 'Guy at the supply counter%';
