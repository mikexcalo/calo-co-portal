/*
  Lakemere ran its own module switchboard. Only the studio should.

  `orgs_guard_commercial_columns` has a first branch that lets a workspace's
  own owner or admin change modules when `self_serve_modules` is true, and
  Lakemere is the only workspace in the product where it is. Checked before
  changing it, as Marcie, with auth.uid() set to her: the update was ALLOWED.

  That is a live break of the rule the guard exists to state - what a
  workspace can open is set by the agency that set it up - and it is also the
  one thing that would turn backlog #12's promotion into a mistake. Promoting
  her to owner while this flag is true would hand her the switchboard along
  with ownership, which is exactly what #12 says ownership must not carry.

  This removes a power, nothing else. Her role, her data, her modules and her
  plan are untouched: the same modules are live after as before, and she is
  still an admin of her own business who can do everything she could
  yesterday except the one thing that was never meant to be hers.

  Deliberately narrow. The flag stays available for a workspace that really
  does run itself; this is one row, named, with a reason.
*/

update public.orgs
   set self_serve_modules = false
 where name = 'Lakemere Services'
   and self_serve_modules is true;
