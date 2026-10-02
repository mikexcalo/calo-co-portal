# The audit, closed — 2 October 2026

Opened against Cowork's review of 24 September. Closed here because every item
on it is either done or has been moved somewhere it will be seen again.

## Done

**The nine numbered items.** #1 through #9, including the two that turned out
to be bigger than their line in the list: the proposal word and the demo
fixtures.

**Wording.** Eighteen spots rewritten against the rulebook. "The principal"
became a person's job, empty states name a next step, and no subtitle is an
aphorism any more.

**Lint.** There was no ESLint config, so `next lint` had never run — it stops
to ask how you want it configured and nobody had answered. Configured, and it
found two React crashes waiting to happen: hooks below an early return in
`AppShell` and in `Notifications`. Both fixed. Now 0 errors, 0 warnings.

**The word, stamped.** A sent document keeps the word it was sent with, in
`estimates.doc_word`, so renaming Proposal to Quote tomorrow does not rewrite
what a client already received.

**Backlog #25, #26, #27.**

**Two live privacy leaks.** Lakemere's customer notes were readable by Marcie,
a member of another workspace, and draft estimates leaked the same way. Both
were policy bugs, fixed in the policy. No client rows were touched.

**The invoice "viewed" stamp.** Opening an invoice from the sending side
marked it viewed, so three invoices claimed a customer had read them when
nobody had. Preview and the sender's own visit no longer write. Two false
stamps cleared on request, one at a time.

**Speed.** Home went from 61 requests to 48, Team from 26 to 4. The remaining
Home work is its own branch and is not part of this.

**The invoice PDF.** Rebuilt as a drawn document rather than a print of the
page: four columns, work grouped by month, struck standard prices, a savings
line that means something next to the price above it.

**Two-author messaging.** Whoever wrote a piece owns it. A studio piece is
read-only to the client; a client piece stays theirs, and the studio can only
change it from inside Work in it, where the change log records it. Existing
wording was backfilled without a word of it changing.

**The write guard reaches the brand tables.** Described as covering every
org-scoped table, and did not: `brand_message`, `brands`, `brand_intel` and
`brand_proof` were outside it. A studio standing in a client's workspace with
no session could rewrite their promise and their colors. `customer_notes`
refused the identical write; `brand_message` took it. Now all four refuse.

## Deferred, on purpose

**The client-login walk.** Supabase's redirect allow list has no localhost
entry, so a client session cannot be held locally, and the two ways around
that are moving a real token or clicking in production. Neither is worth it.
The database check covers the same ground and is stronger: it tests the rule
rather than the screen that draws it.

**Home speed, part 3.** 48 requests down toward 30, on its own branch.

**Backlog #12.** `role = 'owner'` still means the studio in a client
workspace. Unchanged, and still the reason every query meaning "them" has to
ask `memberships.origin = 'own'`.

## What the refusals actually say

Three different messages, because three different things are wrong, and a
person reading one needs to know which:

| When | What they are told |
|---|---|
| View mode, in the browser | Nothing was saved. View mode cannot change anything. Leave View mode to make this change. |
| No session, or never let in | Nothing was saved. This is their workspace and you are in it as their studio. They have to let you work in it first. |
| Session open, grant closed | Nothing was saved. That work session has ended or been taken back. Ask them to let you back in. |

None of them is a database error, and none of them says "permission denied".
