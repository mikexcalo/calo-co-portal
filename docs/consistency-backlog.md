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

## 6. Job screens on a phone — M

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
