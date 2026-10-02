/*
  The studio write guard was never put on the brand tables.

  `guard_session_writes()` is on 37 org-scoped tables and refuses a write by a
  studio standing in a client's workspace without a live grant. Four tables that
  hold a client's identity were not among them:

    brand_message   what the business says
    brands          the kit: colours, type, logos
    brand_intel     research gathered about them
    brand_proof     the evidence behind a claim

  Measured rather than assumed. As the studio in Tideline, with no work session,
  an update to `customer_notes` was refused with "This is their workspace and
  you are in it as their studio"; the identical update to `brand_message`
  returned `rows=1`.

  That matters now because messaging has an owner per piece. The screen stops a
  studio editing a client's piece outside Work in it, and the screen is the
  browser telling itself a rule - the same gap View mode had before
  `work_sessions` existed. The rule has to be in the database or it is decoration.

  Nothing changes for a business writing in its own workspace, or for a studio
  writing its own rows in its own workspace: the guard only fires when the row's
  org is not yours and you are their studio. The service role is exempt as
  always, because `auth.uid()` is null and the function returns early.
*/

create trigger brand_message_session_guard
  before insert or delete or update on public.brand_message
  for each row execute function guard_session_writes();

create trigger brands_session_guard
  before insert or delete or update on public.brands
  for each row execute function guard_session_writes();

create trigger brand_intel_session_guard
  before insert or delete or update on public.brand_intel
  for each row execute function guard_session_writes();

create trigger brand_proof_session_guard
  before insert or delete or update on public.brand_proof
  for each row execute function guard_session_writes();
