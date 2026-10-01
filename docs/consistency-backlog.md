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

## 7. Tab strips drawn by hand — DONE 27 Sept 2026

`app/pl` and `app/site-requests` had already been moved onto `Page tabs=`
before this. The one left was **`app/business`**, which this entry never
named: an underline strip in `C.blue` at 14.5px beside a product whose every
other strip is the pill at 13.5px. That was the third style the audit found,
and it is gone.

Every strip in the app now renders through `Tabs`. Navigating strips reach it
via `Page tabs=` → `PageTabs` (which also filters on `pathAllowed`, so a
module a business has not bought is not offered); state strips call `Tabs`
directly, in `app/business`, `app/customers/[id]` and `app/brand-kit`. Same
44px strip, same 36px pill, same active treatment, both kinds.

Two phone behaviours came with it, in the one shared place:

- **The active tab is scrolled into view.** At 390px four tabs are ~540px of
  strip in a 324px box, so landing on the fourth showed the first three and no
  highlight anywhere. Set through `scrollLeft` rather than `scrollIntoView`,
  which also scrolls the page vertically and throws away wherever you were.
- **The edge that still has tabs behind it fades.** The strip already scrolled
  inside itself, which is the rulebook's rule, but a pill sliced by the
  container edge reads as a rendering fault rather than an invitation to
  swipe.

Verified at desktop and 390px: both strips on `/business` measure identically,
selecting the last tab brings it into view and flips the fade to the left, and
no page scrolls sideways.

---

## 8. Home: a heading with nothing under it — DONE 27 Sept 2026

It was two headings, not one. "Your move" has the same shape - `AskedOfYou`,
`FeedbackInbox`, `Unresolved` and `YourSetup` all return null when empty - and
on the demo both stood alone over white space at once.

Each heading is wrapped with its own content in a `.homeGroup`, and the group
hides its heading when nothing else in it rendered:

```css
.homeGroup:not(:has(> :not(.colHead))) > .colHead { display: none; }
```

CSS rather than a flag threaded out of each child, because the failure mode
was that a child could be added without anybody remembering, and CSS cannot
forget. Written as `:not(:has(...))` on purpose: a browser without `:has()`
drops the rule and the heading shows, which is the old behaviour. The other
way round would hide every heading everywhere.

Verified both directions at desktop and 390px: with the demo quiet both
headings are `display: none` while "Where the time went" still shows, and
appending any child to the group brings its heading straight back.

---

## 9. Words that aren't the workspace's own — DONE 27 Sept 2026

A scan of every string literal and JSX text node in `app` and `components`,
with table names, column lists, URLs and log tags filtered out, found 127
candidates across 52 files. About a hundred of those were fixed; 27 remain and
are deliberate, listed below.

All three examples this entry named are gone:

- **"Free trial" on a roofer's pipeline.** It was the label on the `trying`
  stage, which is software's word and nobody else's. The stage means the same
  thing in every trade - they have it, nothing is agreed - so it reads
  "Trying it" now.
- **A Photos card about "a problem you found behind a wall"** on a SaaS
  customer. Now "anything you found on the way that somebody will ask about
  later".
- **Estimate placeholders written for an agency** ("Brand and messaging
  framework") shown to a roofer. Replaced with placeholders that describe the
  shape of an answer rather than supplying somebody else's.

Two helpers came out of it, next to `vocabFor` in `lib/spine/org.tsx`:
`aWord()` picks "a" or "an" by the word, because a sentence that hardcodes the
article is wrong for somebody ("an estimate" and "an engagement" are right,
"an quote" is not), and `capWord()` capitalises one that has to open a
sentence.

**The pattern worth knowing.** Three of the worst cases were module-level
arrays - `DATA_FACTS` on Security, `WHAT` on What You See and on Access,
`ROLES` on InvitePerson. Nothing in the component reads them, so a hardcoded
noun sits there invisibly. Each is a function of `vocab` now. Any new
module-level copy in this codebase should be too.

Verified on two demo workspaces, desktop and 390px: the same screens read
"New job / Job name / Customer / Create job" in Harbor Light Roofing and
"New project / Project name / Client / Create project" in Northwind Studio.

**Left alone, on purpose:**

- `PlatformVoice` - the voice guide, whose examples are quotations of real
  copy and have to stay as they were written.
- `Workspaces`, `ClientScope`, `BrandSpecimen`, `app/access` module notes
  about what a *client's* workspace holds: the word that belongs there is the
  client's own, which is not the vocabulary of the org you are signed into.
  Getting that right means resolving a second workspace's vocab, which is its
  own brief.
- `ClientGrowth`, `Messaging`, `SiteSection`, `app/seo` - these say "customer"
  about *the client's* customers, which is correct and is not our noun.
- `app/welcome` - the signup flow, before a business kind exists to have a
  vocabulary.
- `app/brands/[id]` "Customer logos" - a brand-kit asset category, not the
  business's word for who it sells to.
- Model prompts in `app/api/*/extract` and column lists, for the reasons the
  em dash check already skips them.

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

## 12. The client does not own their own workspace — DONE 28 Sept 2026

**Step 1, what `owner` is load-bearing for.** Almost nowhere. Every check in
the product asks `role in ('owner','admin')`: the orgs update policy, the
commercial-columns guard, the invite route, Overheads' usage tile,
`client_usage`, and every setup item. A client moving from admin to owner
gains nothing in any of them.

Exactly four things ask for `owner` alone, and all four mean "who is the
senior person here" rather than "what may they do": `studio_for()`,
`doc-owner.ts` (whose name signs a customer document), `who-to-tell.ts`, and
two `setup.ts` items that are also `platformOnly` and gated on the slug.

**What must stay studio-only, and does.** Modules and plan are
`orgs_guard_commercial_columns`, which allows the workspace's own owner or
admin only when `self_serve_modules` is true, and otherwise only an
owner/admin of the agency found through `customers.workspace_id`. Ownership
alone changes nothing. Studio-level screens are unreachable because
`modulesFor` keys them on the org's kind, and other workspaces are
unreachable because reach is `memberships` plus `current_org_id()`. Neither
reads the role.

**One flag to watch: `self_serve_modules` is true on Lakemere.** On that one
workspace, and only that one, promoting the client to owner would hand them
the module switchboard, because the guard's first branch allows it. It has to
go false before Lakemere is promoted.

**What was built.** `remove_studio(workspace)`, SECURITY DEFINER and narrow:
it revokes every live grant and deletes every membership stamped `studio`,
and only for a caller who is that workspace's own owner. A function rather
than a policy because `memberships` has RLS with a single SELECT policy and
no write path at all, which is the right shape. `RemoveStudio` renders it on
the Security page under Who can work in this, for an owner whose origin is
`own`, where a studio membership exists.

**Demo.** Harbor Light has its own person now (the demo had one account
holding owner of everything, so "the client" and "the studio" were the same
person and none of this could be tested). Promoted first, then the studio
demoted to member, keeping its membership, its standing grant, View mode, the
change log and Get help.

Verified against the database as each person, with `scripts/try-as.sh`:

| | |
|---|---|
| Client toggles a module | refused, "Modules and plan are set by the agency" |
| Studio toggles a module | allowed |
| Client removes the studio | allowed |
| Studio calls remove_studio | refused |
| Client removes a studio elsewhere | refused |
| Both do ordinary work | allowed |

On screen: the studio does not see the removal card inside Harbor Light, the
module switchboard is absent and says the agency sets it, Get help still
renders. The client's own view was not seen in a browser - the demo client
has no password, by the same design that protects the demo account - so the
positive render is verified by its gate values and the function, not by a
session.

**Real workspaces, applied 28 Sept 2026.** Marcie owns Lakemere, Mark owns
Mammoth, John owns Global Seafood; the studio is a `member` in all three and
keeps its standing grant, which was already can_edit true and can_send false
on each. Promoted everywhere first, then demoted, with the migration refusing
to demote into a workspace that had no own-side owner.

Verified read-only afterwards, every client and the studio, with
`scripts/try-as.sh` so nothing was left behind: all three clients refused on
modules and on plan; the studio still opens View mode and Work in it on all
three and still switches their modules; the clients still run their own
businesses; and each can now remove the studio. Plans, module maps and grants
are unchanged. No probe rows: the harness rolls back.

The visible change for their customers is the name on a document. `doc-owner`
reads the org's `owner`, so proposals and invoices now say Marcie Tomlinson,
Mark Mesedahl and John Litton rather than the studio's owner. See `docs/handoff.md`.

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

## 15. The owner cannot preview a decided proposal — DONE 27 Sept 2026

**The symptom this entry described was already fixed.** An accepted or
declined proposal opened with `?preview=1` renders the document with its
decision banner and no not-found; verified against all three demo states
before any code changed. `notFound()` fires only when the token does not
resolve, and the decided banner predates 22 September. The "This link isn't
working" string does appear in the HTML of a working page, which is probably
how the entry came to be written: it is the not-found boundary inside the RSC
flight payload, not anything rendered.

**What was actually broken was one step further out.** A public token is
minted when a proposal is sent, so a draft and every superseded version have
none, and `/proposals` had nothing to open: it fell through to the job
screen. On the demo that is three of eleven proposals the owner could not
preview at all.

Two changes:

- **An owner route into the same document.** `/e/[token]` now also accepts an
  estimate **id**, but only with `?preview=1` and only for a signed-in member
  of the org that owns it. The alternative was minting a token on preview,
  which would create a permanent public URL for a document nobody has decided
  to send. An id with no session is the same not-found a wrong token has
  always been, and a token without `?preview=1` behaves exactly as before.
- **Actions are inert in a preview.** A sent proposal previewed by its owner
  showed a live Accept button, so the business could record a decision its
  customer never made, under whatever name it typed. The panel still renders,
  because the point of a preview is seeing what they see, but it is wrapped
  in `inert` and carries a line saying so. `inert` rather than `disabled`:
  it takes the whole subtree out of reach of mouse, keyboard and screen
  reader, where greying a button leaves the name field focusable.

Verified on the demo at desktop and 390px across five states - accepted,
declined, sent, draft and superseded - plus the customer's own view, which is
unchanged and still live. The decline was made through the real customer
route because the demo had none, and `20261029000016` puts it back.

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

`scripts/em-dash-check.ts`, wired to a pre-push hook. `npm run words` runs it
by hand.

It installs itself: `prepare` points `core.hooksPath` at `.githooks` on every
npm install, because a hook you have to turn on by hand is one a fresh clone
skips, which is exactly what happened to this one. `|| true` keeps it from
failing an install with no `.git` directory, which is what the Vercel builder
does. `npm run hooks` still turns it on without reinstalling.

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

The forty that predated the check were held in a baseline while they were
worked through. All forty are gone now (see #22), so the baseline and its
`words:accept` companion went with them: an empty baseline is a mechanism
earning nothing. If a batch ever lands at once it is a reasonable thing to
reintroduce.

The rule itself now lives in `docs/ux-rulebook.md` section 6, which is where
"how we do this here" belongs.

## 22. The forty em dashes that predate the check — DONE 27 Sept 2026

All forty: 10 customer-facing reworded, 3 exempted by name in `ALLOWED`, and
the last 25 reworded in one pass. `npm run words` passes at zero.

The owner-facing prose in `answers.ts`, `signature.ts`, `tutorial.tsx`,
`mfa.ts` and `site-requests/approve` was reworded rather than repunctuated:
most of those dashes were introducing a list or a reason, so they became a
colon or a second sentence. The label separators in `logos.ts` and
`payments.ts` became the middle dot, which is what the rest of the product
already uses.

`docs/em-dash-survivors.md` is deleted. It was a list of what was left and
nothing is left; the conventions worth keeping moved into the rulebook.
CLAUDE.md opens by describing what happens when a doc outlives the thing it
describes.

---

## 23. The first-run flow — DONE 28 Sept 2026

`/welcome` was uninspectable: signed out it redirects to `/login`, signed in
it bailed the moment it saw `onboarded_at`, and every account was onboarded.
`20261029000025` and `20261029000026` add two accounts that genuinely have not
finished setup - a brand-new owner of an empty workspace, and somebody invited
into one that has run for years - so both halves of the flow can be opened.
Before in `docs/audit/public-pages/welcome-*`, after in
`docs/audit/public-pages/welcome-fixed/`, both widths, both people.

What the look found, and what it is now:

- ~~**The promise changes under you.**~~ It opened "3 quick questions" and
  became "6 quick questions" the moment you answered the third. The question
  that decides the length is asked first now, no count is claimed until it is
  answered, and after that the number can only move if the person changes that
  answer themselves. Verified: nothing until a role is picked, then
  "6 questions in all" and "QUESTION 1 OF 6" together, holding to 6 through
  the run.

- ~~**"Nothing was saved. We could not tell why. Check your connection."**~~
  GoTrue is not Postgres and none of `human()`'s branches matched a word of
  what it says, so every refusal it gave came out as the write fallback.
  `BY_AUTH` in `errors.ts` covers the six it actually raises. The one that
  mattered now reads "That is the password you already have, so nothing
  changed. Pick a different one, or skip this question and keep the one you
  have."

- ~~**Step two asks for a password that already exists.**~~ Skipped outright
  for anybody who signed in with one. The obvious test is useless -
  `encrypted_password` is non-null on all eight accounts, because
  `new_auth_user()` and the invite route both write a bcrypt of something
  nobody will ever see - so it reads the session's `amr` claim instead, which
  records the method the session was opened with. `password` is proof;
  `recovery`, `magiclink` and `otp` prove nothing and get asked. Unreadable
  gets asked too: one question too many is a cost, being locked out is not.

- ~~**Their sign-in address is pre-filled as the business email.**~~ Asked, as
  "Where should customer replies go?", with the field empty and the sign-in
  address offered as a one-tap chip underneath.

- ~~**13x13px checkboxes.**~~ A native checkbox will not take a size, so the
  hit area is a box around it: 48x48 on a phone, measured, with the row at
  least as tall. Option buttons and the buttons at the foot get the same floor.

- ~~**Two ways out that read the same.**~~ "Skip this question" moves on;
  "Finish setup later" ends setup and says where the rest is waiting. The
  second only appears once there is a name and a role, because the shell sends
  people back here until it has both, so offering it sooner would be a door
  onto a wall.

- ~~**Saturated colour, from the payment marks.**~~ All seven badges are black.
  The glyph is what made the list scannable; the colour was somebody else's.

Three things the fix uncovered that were worse than anything on the list:

- **It never saved a word of what it asked.** `profiles` had a SELECT policy
  and an UPDATE policy and no INSERT policy, and PostgREST's upsert is
  `INSERT ... ON CONFLICT`, so every write this screen made to the person's own
  row was refused. Nothing said so: `save()` announces a refusal through an
  event AppShell turns into a message, and this is a bare page with no AppShell
  on it. The business half saved fine, the person half was refused, and the
  shell then sent them back to question one for want of a name. Fixed in
  `20261029000027`, and the page now raises a refused profile write into its
  own banner instead of trusting the announcement.

- **Signing in with a password never reached setup at all.** The shell and the
  workspace provider both read the session once, when they mount, and they
  mount on `/login` where there is nobody to read. `router.push('/')` left them
  holding that: an invited client landed on a Home headed "Home" over "this
  business", with an error on it, and never saw setup. Sign-in does a whole
  page load now.

- **The joining half of the file was unreachable.** `alreadySetUp`, the plan
  filter and the copy that goes with them were written for somebody invited
  into an existing business, and the page left on `onboarded_at` before any of
  it could run - so that person ping-ponged between Home and setup. Being
  finished is a fact about the person; being set up is a fact about the
  business, and it only decides which questions are worth asking. They get two:
  who they are, and what they are called.

---

## View mode had no interface, only a guard — DONE 29 Sept 2026

`readonly.ts` refused every write at the two doors and nothing on screen said
so, which is the half that makes a product look broken rather than careful:
New job opened a full form with a Create job button on it, the button did
nothing anybody could see, and the only way to find out why was to press it.

Fenced at the shared pieces rather than at call sites, so a screen written next
month is covered without anybody remembering:

- `Page`'s action slot, which is where all 34 screen-level create buttons live,
  and `SectionHead`'s, which is where the per-section ones live. Both swap the
  button for a quiet "Read-only".
- `Sheet`. Every create and edit dialog in the product is one. In View mode it
  says "Read-only. Leave View mode to change anything here", takes its whole
  body out of reach with `inert`, and grows a Close, because inert takes the
  panel's own Cancel with it. Opt out with `readOnlySafe` for a panel that
  changes nothing; `bare` viewers are exempt already.
- `Select`. There is no read-only reason to change one.
- The top bar's Add a note and Log time, and the raised `+` in the phone bottom
  bar, and the two keyboard shortcuts behind them, which are the entry points
  that survive a hidden button.
- `/jobs/new`, the one create screen with an address of its own, so a bookmark
  or a Back button lands on the reason rather than on a live form.
- `Schedule`'s Add a step, which was a hand-built header row rather than a
  `SectionHead` and so had been missed by the sweep that component exists for.

`useReadOnly()` in `viewas.tsx` is what they all read: the same fact as
`readonly.ts` holds, from the context, so a screen redraws when the mode
changes. Work mode is deliberately not read-only.

WHAT IS STILL LIVE, and was left deliberately rather than missed: individual
`<Button>`s inside cards and table rows that write - Dismiss on a Home signal,
a row's own Remove. There are 281 Button call sites and most of them navigate,
so a default-deny there would grey out half the product's way of getting
around. The guard still refuses each one, so the failure is a message rather
than a change. Worth a pass of its own with the list in front of you.

Verified on Harbor Light in View mode at desktop and 390px: Home, Jobs, a job
detail, the job edit panel, and /jobs/new by address. Leaving View mode brings
all of it back.

---

## Smaller, not yet grouped

- ~~**Price list tiers**~~ **DONE 27 Sept 2026.** Three columns, Friends /
  Standard / Enterprise, were hardcoded in `app/pricing` and printed for every
  business, while `rate_tiers` holds rows for exactly one org - so everybody
  else saw the same figure three times under three names they never chose.
  Not deleted, because that would take a real feature off the one business
  using it: the columns follow the data now, one per tier the business has
  defined, and a single Price column when it has none.
- ~~**Stage chips wrap badly**~~ **DONE 27 Sept 2026.** They were flex items
  at `1 1 92px`, and flex grows the last line to fill it, so at 390px the lane
  broke four-and-two and "Won" became a full-width bar that reads as the
  selected stage. A grid with `repeat(auto-fit, minmax(84px, 1fr))` gives the
  wrapped chip a column instead: measured at 390px, all six are 91px.
- ~~**The profile menu email breaks mid-word.**~~ **DONE 27 Sept 2026.**
  `word-break: break-all` split wherever the line ran out, so an address
  wrapped as "someone@exampl / e.com". A `<wbr>` after the @ gives the wrap
  somewhere sensible to land, with `overflow-wrap: anywhere` kept only as the
  fallback for a local part too long to fit alone.
- ~~**Browser tab titles are generic**~~ **DONE 27 Sept 2026.** Every tab said
  CALO&CO, because the app's only title is the root layout's and every screen
  under it is a client component, which cannot export metadata. `Page` sets it
  now - it is the one thing every in-app screen goes through and it already
  knows the heading - as "[Screen] · [Workspace]". A screen whose heading is
  still a skeleton passes `tabTitle` once the record loads, and until then the
  tab keeps what it said rather than flashing the product name and back.
  Public documents set their own metadata and never render `Page`.
- ~~**`/whats-new`**~~ **DONE 27 Sept 2026.** An internal feature catalogue
  with sales notes in it ("the sentence that makes it worth paying for"),
  reachable by any client who typed the address. Deleted, with
  `lib/spine/shipped.ts` which nothing else read, and its entries in `ALWAYS`
  and the site-map check.
- ~~**Wide screens**~~ **DONE 27 Sept 2026.** Measured first: `Page` caps at
  1100px at every width, so lines have never stretched. What 1512 and 1920
  actually showed was that cap pinned hard left against the sidebar with a
  third to a half of the window empty on the right. The cap is unchanged and
  the leftover space is shared instead, above 1512 only - on a 1280 or 1440
  laptop there is little enough spare that centring just pushes the work away
  from the sidebar. At 1920 the column measures 1100 wide at x=516, centred
  in the 1708px main area.

## 24. Costa's demo invoice ignores the actuals it is supposed to be built from — DONE

Found while reconciling a $6 gap between Costa Residence's accepted estimate
($3,890, now $3,896) and invoice CR-001 ($3,896). The gap was a fixture typo
and is fixed. What it uncovered is not.

`Ramsey Ave storm repair` is `billing_type = 'tm'`, and CLAUDE.md is explicit
that invoices are built from actuals. CR-001 is not. Its three lines are
typed fixed-price entries with `source_time_entry_id` and `source_cost_id`
both null:

    Emergency call-out                       1 call  x $275   $275.00
    Storm repair, north slope, 9 square      9 sq    x $385  $3,465.00
    Deck repair, 2 sheets                    2 sheet x $78     $156.00

Meanwhile the job's real logged work sits on no invoice at all: 10.5 hours at
$85 ($892.50) across two entries, and one $980 material cost from Finn
Roofing Supply. All three rows are `billable = true` with `invoiced_on` null.
$1,872.50 of actuals, unbilled, on a completed time-and-materials job.

So the demo teaches the opposite of the rule. Somebody reading Costa's job to
learn how T&M billing works sees an invoice that owes nothing to the hours or
the receipt beside it, and a Home that counts $1,872.50 as unbilled against an
invoice already marked overdue.

Rebuild the fixture so CR-001 comes from the actuals: bill the two time
entries and the cost, stamp their `invoiced_on`, and let the total be whatever
they add up to rather than a number chosen first. If Costa is meant to
demonstrate a fixed-price job instead, change `billing_type` and say so on the
job, but it cannot stay as both.

Deliberately out of scope of the brief that found it, which was told to change
one value and nothing else.

**Done, 1 Oct 2026.** `20261030120000_costas_invoice_comes_from_the_work.sql`.
CR-001 is three lines now - 6.5 hr and 4 hr at $85, and the $980 shingle - each
carrying the id of the entry or cost it came from, totalling $1,872.50. The
three source rows are stamped billed, so the job reads Unbilled $0, Outstanding
$1,873, Margin $893, and the proposal stays at $3,896 as the forecast a T&M job
came in under.

---

## 25. A client's Messaging tab has no owner — DONE

Found while making every Brand tab read the brand through `brandForOrg`, so a
client whose kit belongs to their studio sees their own colors, type and
logos. Colors, Logos and Voice now do. Messaging does not, because it is not
in the kit at all.

Messaging reads `brand_message`, keyed on `org_id` with `brand_id is null`.
There are two rows in the whole database and neither belongs to a client
workspace: Colette Intelligence's messaging is stored under **CALO&CO's**
`org_id` with a `brand_id`, which is the studio's copy, and Tideline's under
its own. So the query has the same cross-org gap the brand kit had, and the
first client whose studio writes their messaging will open the tab and find
it empty.

It is not a read-path bug to fix in isolation, because the read path is a
consequence of a decision nobody has made: who owns a client's messaging.

The answer this should take: **the studio owns messaging it wrote, and the
client can read it and not change it, the same as the brand kit.** That
means Messaging joins `/api/brand/kit` - same `customers.linked_org_id` walk,
same `editable: false`, same line at the top saying where it is kept - and
the tab stops writing to a table the client's own session can reach.

The open question is what happens to messaging a client wrote for itself
before a studio existed, since `brand_message` has one row per org and no
notion of two authors. Tideline has exactly that row. Decide that before
writing any of it.

**Done, 1 Oct 2026.** `/api/brand/messaging` walks the same
`customers.linked_org_id` link the brand kit does and answers with the
messaging, whether it may be changed, and who keeps it. The studio's copy wins
where there is one; otherwise the workspace's own row is returned and stays
editable. The Brand screen's Messaging tab passes `resolved`; the two
studio-side screens keep the direct path, because there the caller is the
author by construction.

Three things came out of it:

- The own-row lookup insisted on `brand_id is null`. Tideline's row carries a
  brand id, so Tideline had written messaging and a tab that showed none of it.
  The org is the key worth asking on; one row per org is what the table holds.
- `brandForOrg` treated `{}` as a kit, because an empty object is truthy. A
  `brands` row created before anybody filled it in - which is what starting a
  client's brand looks like - returned no colors, no type and no logos,
  overriding whatever the business had set for itself.
- The Brand page's Save writes the brand fields only, and rendered on every
  tab. On Messaging that put two Save buttons on one screen meaning different
  things. It now shows on the two tabs it acts on.

Still open, and smaller than this entry was: a business that wrote its own
messaging and later gains a studio that writes some ends up with both rows. The
studio's wins and the earlier one is left alone rather than deleted, which is
recoverable but not visible. A two-author view is its own brief.

---

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
