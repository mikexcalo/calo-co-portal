/*
  Clear the read-receipts that were logged as changes.

  The recorder wrote a row for every write during a work session, which is the
  right default and was too broad by four tables. Marking a notification read
  alters no number, no date and no document; reporting it to the client as a
  change to their business buries the line that matters under noise they cannot
  act on.

  The exclusion is in lib/spine/readonly.ts now. This removes the rows written
  before it existed, because a notice built from them would say "he changed 1
  notification_reads", and that sentence is worse than useless: it is wrong in
  the one direction this feature cannot afford to be wrong in.

  Only the named tables. Anything else stays, including anything nobody has
  thought about, which is the correct way round for a record the client is
  promised.
*/

delete from public.work_changes
 where entity in ('work_changes', 'work_grants', 'notification_reads', 'access_events');
