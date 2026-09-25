/*
  The hand-back was logging itself.

  Ending a session writes two rows: the notice to the client, and the request
  marked done. Both happen while the mode is still on, so both were recorded as
  changes, and the list the client opens to see what was done to their business
  contained the message telling them what was done to their business.

  The notice body was right - it is built before those writes - but /changed
  reads the rows, so it showed four where two were the machinery. Excluded in
  lib/spine/readonly.ts now; this clears the ones already written.
*/

delete from public.work_changes where entity in ('notifications', 'feedback');
