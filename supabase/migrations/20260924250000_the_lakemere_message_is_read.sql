-- Marcie's note from 15 September, said out loud on Home every day since.
--
-- Mike has raised this four times. The reason it survived every previous fix
-- is that the fixes were all to the wording and the placement, and the thing
-- driving it is a row: feedback.read_at is null, and the ONLY way to set it
-- was to switch into Lakemere's workspace and open the message there.
--
-- From the agency's Home the line is a link. Following it changes workspace,
-- and reading it in passing does not count as reading it, so the counter
-- never moved. He addressed this with Marcie in person over a week ago; the
-- platform had no way to be told that.
--
-- Marked read. The component now also lets it be marked read from where it
-- is shown, so nothing can get stuck like this again.
update public.feedback
   set read_at = now()
 where read_at is null
   and created_at < now();
