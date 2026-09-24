-- Heals the demo account after deliberately reproducing the fault.
--
-- The previous migration set confirmation_token back to NULL on that one row
-- to prove the cause rather than infer it. /auth/v1/recover returned 500,
-- unexpected_failure — the same failure the sign-in page reports as "That did
-- not work" — which confirms a single NULL in one of those four columns is
-- enough to stop the reset flow dead.
--
-- Idempotent and scoped to the fault, so it is safe to run at any time.
update auth.users
   set confirmation_token     = coalesce(confirmation_token, ''),
       recovery_token         = coalesce(recovery_token, ''),
       email_change           = coalesce(email_change, ''),
       email_change_token_new = coalesce(email_change_token_new, '')
 where confirmation_token is null
    or recovery_token is null
    or email_change is null
    or email_change_token_new is null;
