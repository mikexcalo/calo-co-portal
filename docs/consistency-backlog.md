# Consistency backlog

Every screen that breaks `docs/ux-rulebook.md` as of 26 Sept 2026, grouped so
each group is one brief. Ordered by what clients and their customers see most.

Counted against the code, not against Cowork's audit — several of the audit's
findings have since been fixed (public pages no longer render inside the app
shell, invoices carry pay methods, the proposal's retainer copy is conditional,
the phone can switch workspace, the sidebar says who actually set the workspace
up). Anything still listed here was verified present today.

Sizes: **S** an afternoon · **M** a day · **L** more than a day, or needs a
decision first.

---

## 1. Public and customer-facing pages don't use the design system at all — L

**Twelve pages, every one of them something a client or their customer sees,
and not one imports `spine/ui` or `spine/tokens`.**

`app/login`, `app/welcome`, `app/reset`, `app/not-found.tsx`, `app/trust`,
`app/c/[slug]`, `app/e/[token]` (proposal), `app/i/[token]` (invoice),
`app/p/[token]` (pitch), `app/s/[token]` (case study), `app/preview/[token]`,
`app/new/[token]/Form.tsx` (enquiry).

They carry **194 hardcoded hex values** between them — 28 in `welcome`, 18 each
in `login` and `/c`, 16 in `preview`, 13 in the invoice, 11 in the proposal.
Every colour, radius, font size and input style is typed in by hand, which is
why these pages are the ones that look least like each other and least like the
product.

This is the single largest break in the rulebook and it is on the pages with
the widest audience. It is **L** because some of it is deliberate — a customer
document should not inherit app chrome — so the brief has to decide what a
public page may take from the spine (tokens, type scale, `Button`, `Field`,
`Pill`) and what it must not (`Page`, the shell). Until that is decided,
nothing here should be "tidied".

Also in this group:
- The enquiry form uses placeholder-only labels that vanish when you type.
- `not-found.tsx` shows the customer's expired-link wording to a signed-in
  owner who mistyped a URL. Wrong audience, wrong advice.

---

## 2. Errors — DONE 26 Sept 2026

`human()` no longer falls back to "That did not work". Every branch says what
happened, whether anything was saved and what to do next; `save()` passes a
write-specific fallback and reads get one that claims nothing about saving.
The five save paths get named causes wherever Postgres names a constraint or
a column. Verified against a real refusal on the demo.

## 3. Fifteen hand-written overlays instead of `Sheet` — DONE 26 Sept 2026

`Sheet` exists, handles escape, the backdrop, focus return and the phone
bottom-sheet shape. Fifteen files still build their own from
`position: fixed; inset: 0`:

`app/card`, `app/people`, `app/billing`, `app/proposals`, `components/TopBar`
(the Add a note overlay), `components/Sidebar`, `components/AppShell`,
`spine/TutorialPanel`, `spine/Notifications`, `spine/Confirm`,
`spine/GetHelp`, `spine/InvitePerson`, `spine/OrgSwitcher`,
`spine/CommandBar`, `spine/ExtractionReview`.

Some are legitimate — `AppShell`'s mode frames and `OrgSwitcher` are shell, not
dialogs, and `CommandBar` is a palette. The rest are dialogs that should be
`Sheet`. Splitting that list is most of the work; the swaps are mechanical.

Do `TopBar`'s note overlay first: it is the same `DropIt` the capture sheet
already renders inside a `Sheet`, so the two currently disagree about what a
note dialog looks like on the same account.

---

## 4. Fifteen raw `<select>` instead of `Select` — DONE 26 Sept 2026

`app/traffic`, `app/brand-kit` (2), `app/brands/[id]/intel`, `app/jobs/[id]`,
`app/jobs/[id]/estimate`, `app/seo`, `app/pricing` (2), `spine/QrStudio`,
`spine/DropIt`, `spine/QrCampaigns`, `spine/ClientUpdate`, `spine/ClientIntake`,
`spine/InvitePerson`, `spine/ExtractionReview` (2), `spine/ClientDocs`.

Each is a native dropdown with its own padding and border beside spine controls
that have neither. Mechanical, but `Select`'s API has to cover every case
before the sweep, so check the awkward ones (`pricing`, `estimate`) first.

---

## 5. Bare "Loading…" screens — money screens DONE 26 Sept 2026

The money half is done. Home, Invoices, Profit & Loss, Receipts, Overheads,
Price List, a single invoice, plus Jobs, Proposals, Account and Customers — all
of which carry figures — now show a placeholder the shape of the content, and
none of them renders a number or a reassurance before the data is there. A
failed load says so and shows no strip at all. `Skeleton`, `TilesLoading` and
`RowsLoading` live in `ui.tsx`.

**Still open: the non-money screens.** Around thirty files still show a bare
"Loading…" — brands, team, business, records, security, traffic, targets,
site-requests and the rest. Same sweep, same three primitives, no new
decisions needed. Nothing on them is a number somebody acts on, which is why
they were not done first.

## 6. Job screens on a phone — DONE 27 Sept 2026

`app/jobs/[id]` and `app/jobs/[id]/estimate`.

The estimate line builder collapses below about 420px: the kind dropdown and
quantity overlap, the description field disappears and the remove control is
pushed off-screen. The Hours and Costs tables lose their right-hand columns
with no scroll hint. The `OPTIONAL` checkbox is 12×12, a quarter of the 48px
floor.

These are the screens a contractor is most likely to open standing up, and they
are the ones the phone shell brief did not reach. Needs the rulebook's table
rule — scroll in its own container, or stack.

---

## 7. Tab strips drawn by hand — S

`app/pl` and `app/site-requests` still map over tab data and draw the pill
strip themselves, against `Tabs` used in three files. Two files, mechanical.

Worth doing early because it is small and it removes the last of the three tab
styles the audit found.

---

## 8. Home: a heading with nothing under it — S

`app/page.tsx`. "Waiting on others" renders `FollowUps`, `SoldNotLive` and
`WeekAhead`, each of which returns null when empty, so on a quiet morning the
heading stands alone over white space. The rulebook says render the empty state
or drop the heading.

Same screen, same brief: check that every `colHead` has either content or a
line under it.

---

## 9. Words that aren't the workspace's own — M

Screens that type a noun instead of reading `vocab`. The audit found a SaaS
customer record with a Photos card about "a problem you found behind a wall", a
roofer's pipeline with a "Free trial" stage, and estimate placeholders written
for an agency ("Brand and messaging framework") shown to a roofer.

This is a sweep with judgement in it: every hardcoded "job", "client",
"estimate" and every placeholder string, checked against `vocabFor`. Needs one
pass per business kind on the demo, which is why it is M rather than S.

---

## 10. Destructive actions — DONE 26 Sept 2026

Bare glyphs replaced with the word. Three deletes that did not confirm now do
(schedule steps, saved views, an unused job). Every confirmation names the
thing it is about to remove and tells the truth about whether it can be
undone. Buttons meet the 48px floor on a phone, which the confirmation itself
was failing.

## 11. The acceptance email goes to us, not to the business — DONE 26 Sept 2026

When a customer accepts a proposal, `app/api/estimates/decide/route.ts` sends
the alert to `ALERT_EMAIL`, which is CALO&CO. The person who needs to know is
the owner of the business whose customer just accepted: it is their proposal,
their customer, and their deposit draft waiting to be reviewed.

`whoToTell()` resolves it now: the business's own senior person, with the
studio copied. It asks `memberships.origin`, not `role` - `role = 'owner'` in
a client workspace is still the studio, so the obvious query would have sent
the mail straight back where it came from. The six em dashes went with it.

With nobody reachable in the business it falls back to the studio and logs
which workspace could not be written to, rather than passing in silence.

---

## 12. The client does not own their own workspace — M

In every client workspace the studio is `owner` and the client is `admin`:

| Lakemere Services | Mike `owner` · Marcie `admin` |
| Mammoth Construction | Mike `owner` · Mark `admin` |
| Global Seafood Partners | Mike `owner` · John `admin` |

That is backwards, and now that `memberships.origin` exists it is also
unnecessary. The studio needed `owner` when `owner` was the only role that
could do anything; a standing grant is what actually carries the studio's
access today, and it is the thing the client can take back.

**How to do it safely.** The order matters, because every step in the wrong
direction locks somebody out of their own business.

1. **Check what `owner` is load-bearing for first.** Grep every policy and
   guard for `role = 'owner'`. Some of them almost certainly mean "the one
   person who set this up" and some mean "anybody senior". Until that is
   separated, promoting the client changes more than it looks.
2. **Promote the client before demoting the studio.** Two owners for a moment
   is safe. Zero owners is a workspace nobody can administer, and it is one
   failed statement away if the order is reversed.
3. **Demote the studio to a plain member**, not remove it. The membership is
   how the studio can open the workspace at all; the standing grant is what
   lets it change anything. Removing the row would break View mode, the change
   log and Get help all at once.
4. **Check `new_auth_user` and the setup flow** stamp the new shape, or the
   next workspace created undoes this by hand.

**What the studio keeps**: its membership (so it can open the workspace), its
standing grant (edit yes, send no), View mode, the change log, and Get help.
**What it gives up**: the `owner` role, and with it whatever that role is
quietly load-bearing for - which is step 1's whole point. **What the client
gains**: the ability to remove the studio entirely, which today they cannot.

Worth doing on one real workspace first, with the owner watching.

---

## 13. A failed read says "Nothing was saved" — DONE 27 Sept 2026

`human()` defaults its fallback to `WRITE_FAILED`, and about twenty-eight
catch blocks around **reads** take that default. So a read that fails prints:

> Nothing was saved. We could not tell why. Check your connection and try
> again. If it keeps happening, use Tell Us and we will look.

Nothing was being saved. Nothing was refused. The commonest trigger is
`"The user aborted a request."` - tapping a row and navigating before the
request finishes, which is ordinary use on a phone.

It mattered less when that sentence was only a fallback. It matters now:
`guard_session_writes()` and `guard_sending()` open with the same words, so
"Nothing was saved" is the product's way of saying *the database refused you*.
A cancelled read now impersonates a permission failure.

The fix is one argument per site - `human(msg, READ_FAILED)` - plus a sweep
for reads that went through `save()`. The wording already exists and reads
correctly: "The server did not answer, so this screen has nothing to show."

Worth doing with a rule that makes it hard to regress: reads should not reach
for a function whose default is about saving.

---

## 14. A note cannot be saved without the note reader — DONE 27 Sept 2026

`DropIt` is the only way to add a note, and its one button is "Scan and sort",
which calls the extraction service. Where that service is unconfigured or
down, the sheet says "Note reading is not configured yet" and there is no
second path: the text somebody typed cannot be kept at all.

Found while walking a job on a phone, which is exactly where it bites - the
note is being written standing on a roof, and the answer to a service being
unreachable should not be "type it again later".

It needs a plain save that files the words against the chosen customer, with
the reader as the thing that happens on top when it is available.

---

## 15. The owner cannot preview a decided proposal — S

`/proposals` opens the preview with `?preview=1`, and for an accepted or
declined proposal the public page still answers "This link isn't working. It
may have been replaced by a newer version, or the estimate may have already
been decided."

That sentence is right for a customer following an old link and wrong for the
business looking at its own record. Three of the four demo proposals are
decided, so in practice the preview only works on the one nobody has answered
yet - which is the one the owner least needs to check.

`?preview=1` already exists as the flag for "this is the owner looking". The
public page should honour it for a decided proposal too, showing the document
as the customer saw it, ideally with a line saying it has since been accepted
or declined. The expired-link wording stays for everybody without the flag.

---

## 16. A note never needs a customer — DONE 27 Sept 2026

No migration. `drops` was already the To file inbox: nullable customer, job
and person, `filed_at` null meaning nobody has said what it is about, and a
nav row that has read "Drops" all along. An unattributed note is a drop.

Home says how many and offers the one tap; the shelf grew the filing control
its `filingOptions` prop had been waiting for since it was written; and the
inbox offers live jobs as well as people and clients, because half of what
lands there is about a job.

---

## 17. Loading states, part 2 — the remaining screens — DONE 27 Sept 2026

Part 1 did the fifteen busiest. Still bare: `traffic`, `seo`, `reviews`,
`digital`, `qr`, `market`, `stories`, `pitches`, `pitches/[id]`,
`site-requests`, `requests`, `signature`, `what-you-see`, `welcome`,
`changed/[id]`, `brands/[id]`, `brands/[id]/messaging`,
`brands/[id]/intel`, plus `Workspaces`, `Messaging` and the shell's own
sidebar "Loading…" - which is the one people see most and the one part 1 did
not touch, because the shell is chrome rather than a screen and wants its own
decision.

No new decisions needed for the rest: same three primitives, same rule.

---

## 18. The Notes screen cannot save without a customer — DONE 27 Sept 2026

A note with nobody picked goes to Drops, and the reading it was charged for
goes with it. Verified on the demo at 390px: saved with no customer, landed
unfiled in Drops with `extraction_cost_cents` 0.24, and Overheads showed
0.2¢ against one read. The test note was deleted afterwards.

`drops.extraction_cost_cents` is a real column rather than a key in `meta`,
because `meta` says of itself that it never holds anything that costs per
read. `ai_usage` gained a third branch and counts it as a `note`, so the
Overheads tile does not under-report. That view had **never returned a row**
before this: the count across `documents`, `customer_notes` and `drops` was
zero, which confirms the recording had never once succeeded.

Three things came out of doing it that were not in the entry:

- **`DropIt.fileIt` had the identical NOT NULL insert** and failed the same
  way with nobody picked, while the confirmation underneath still said it had
  been filed. Fixed with it, since it is the same defect one file over.
- **Neither DropIt path recorded the cost at all**, filed or unfiled. Both do
  now.
- **The shelf offered "Scan and sort" on a note that had already been read**,
  which is the same model spend a second time for an answer already in the
  row. A drop carrying a cost is no longer offered a re-read.

The note route's 400 now reads "That's too short to be worth reading. Save it
as it stands instead."

---

## 19. Migration files are duplicating themselves again — S

332 files in `supabase/migrations`, 202 tracked by git. The other 130 are
macOS duplicate copies named `… 2.sql` and `… 3.sql` - the exact problem
CLAUDE.md records as fixed, returned.

They are iCloud placeholders: `ls` reports 2241 bytes, reading one returns
nothing at all. The project lives in `~/Desktop`, which iCloud Drive is
syncing, and that same sync is the likeliest explanation for the `.git/index`
that vanished mid-session.

They break `supabase db push`, which counts 332 local migrations against 202
remote rows and refuses. `scripts/ask-db.sh` pushes a probe migration, so
every read through it fails too.

Deleting the 130 untracked copies fixes it and touches nothing in the
database. The deeper question is whether this repository should live inside
an iCloud-synced folder at all.

---

## 20. The Notes screen has no way to keep a note the reader cannot read — DONE 27 Sept 2026

The screen now follows DropIt. When the reader fails the one button becomes
Save note, the words are kept exactly as typed - no title, no summary, nothing
invented - and the note is marked not sorted yet. With a client picked it goes
on their record; with nobody picked it goes to Drops. Sort it in the list below
reads it later and records what that read cost.

The read failure uses `READ_FAILED`. It printed "Nothing was saved. We could
not tell why", which is the sentence `guard_session_writes()` opens with, so a
missing API key was impersonating a permission refusal.

`ANTHROPIC_API_KEY` was **empty in `.env.local`**, so note reading had never
worked on a local dev server. Filled from `.env.production.local`. `.env.local`
is gitignored, so nothing left the machine.

**A bigger thing turned up underneath.** `sorted_at` was added with no default,
and null is the state meaning "saved as typed, never read". The backfill in
`20261029000009` stamped every row that existed, so the table looked healthy
and every row written *after* it landed null - including notes that had just
been through the reader with a title, a summary and a recorded cost. `JobNotes`
reads null as "offer Sort it", so the product was offering a paid re-read on
notes it had already paid to read, and on system notes that were never raw text
at all. `20261029000013` sets the default to `now()` and backfills; the two
deliberately-unread paths pass an explicit null, which beats a default.

Verified on the demo at 390px, twice: once with reading working, once with the
key blanked and the server restarted so the route really returned its 500. Both
saves landed correctly, Sort it closed the loop at 0.24 cents, no horizontal
scroll. The three test notes were deleted in `20261029000014`.

## 21. Em dashes have no check on our own copy — DONE 27 Sept 2026

`scripts/em-dash-check.ts`, wired to a pre-push hook. `npm run hooks` turns it
on; `npm run words` runs it by hand.

Not in `prebuild`. That is where the site map check lived when a missing
devDependency on the builder killed every deployment for hours with no signal
but a stale site, and the rule written down after it was that a check which can
block a deploy has to be one you can watch fail. This one fails on the machine
doing the pushing, and `git push --no-verify` is the escape hatch.

It scans `app`, `components`, `lib` and `scripts` with a character scanner
rather than a regex, because "is this dash inside a string" cannot be answered
by looking at a line: block comments span lines, the apostrophe in "don't"
looks like a quote, and `${...}` inside a template literal is code again. Only
strings and JSX text count. Comments keep theirs. The four `app/api/*/extract`
routes are exempt because their strings are instructions to a model, and
bending a system prompt around a punctuation rule risks changing what the model
does.

**Em dash only, not the en dash.** `guardrails.ts` matches both, which is right
for a brand's prose and wrong here: this codebase uses the en dash for the
empty-cell glyph and for ranges, and rewriting those is what broke 24
placeholders on 22 September.

The forty that predate the check are recorded in
`scripts/em-dash-baseline.json`, keyed on file plus line text rather than line
number, so moving code neither re-arms nor excuses anything. New ones fail the
push; the known ones do not. `npm run words:accept` shrinks the list as they
are fixed, and the check says so when a baseline entry is no longer there.

Still to decide, one file at a time: see #22.

## 22. The forty em dashes that predate the check — S

Recorded in the baseline, not fixed. Grouped by file with a recommendation
each, in `docs/em-dash-survivors.md`.

---

## Smaller, not yet grouped

- **Price list tiers** (Friends / Standard / Enterprise) are identical for every
  business and unused by the estimate picker. Probably deletion, not a fix. S
- **Stage chips wrap badly** on a customer record: "Won" takes a full row. S
- **The profile menu email breaks mid-word.** S
- **Browser tab titles are generic** ("CALO&CO" on every page). S
- **`/whats-new`** is an internal feature catalogue with sales notes in it,
  reachable by anybody who types the address. Decide whether it should exist. S
- **Wide screens**: `Page` caps at 1100px, leaving a third of a 1512px screen
  empty. A decision, not a bug — but it is the rulebook's silence, not its
  rule, so it belongs in a brief.

---

## Done since this list was written

- **Server-enforced View mode, work grants and send lock** (26 Sept 2026).
  `work_sessions` records which mode somebody is in, and
  `guard_session_writes()` on 37 tables plus `guard_sending()` on `estimates`
  and `job_invoices` refuse the write in the database rather than in the
  browser. Verified by writing directly to PostgREST in all four states.
- **A studio is a guest until it is asked** (26 Sept 2026). `memberships.origin`
  records whether somebody is the business's own team or the studio that set
  the workspace up, so the guards no longer depend on anybody declaring a
  mode. `work_grants.standing` is a grant with no end, shown to the client on
  the Security page with a Revoke beside it - the first thing ever to call
  `revokeGrant`, which had shipped with no caller. Demo only so far; real
  workspaces are gated on `studio_rule_applies()`.

---

## Known gaps that are not backlog

Written up as their own briefs in `docs/handoff.md`, not counted here because
nothing is broken — the features are absent on purpose:

- Hold to talk on the capture sheet.
- Saving on the phone and sending when signal returns.
- A general logo uploader.
