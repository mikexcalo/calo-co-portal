# Handoff — 25 September 2026

Written at the end of a long session, for whoever picks this up next. It
covers what shipped, what is open, how Mike wants to be worked with, and the
traps that cost real time today so nobody pays for them twice.

---

## Shipped today

All on `main`, all deployed to the `nautilus` Vercel project
(`nautilusapp.vercel.app`). **Not** `calo-co-portal` — that project is stale
and has had no push in months; anything configured there goes nowhere.

### The six UX-audit fixes

The audit is at `~/Downloads/ux-audit.md`. Mike picked six items and asked,
for each, whether real clients were affected before anything was changed.

**1. Proposal terms.** Every customer-facing proposal printed CALO&CO's own
retainer wording — total labelled `MONTHLY`, and a note reading "The $40
covers the platform and your hosting" — on every business's document. Harbor's
$24,680 re-roof read as $24,680 a month.

*Real impact:* none yet. The only two proposals sent to real clients were
CALO&CO's own $40/month deals, where the wording was accurate. But **Mammoth
has a draft $20,847.04 proposal to Nikhail** that would have been wrong the
moment Mark sent it.

The shape of an arrangement is now worked out once at the top of
`app/e/[token]/page.tsx` (`recurringLines` / `ratedLines` / `fixedLines` /
`isRetainer`). "Monthly" only when every priced line recurs. The hardcoded
note is gone.

**2. Public pages rendered inside the app.** Signed out, pitches, enquiry
forms and the trust page showed the full shell — logo, search, Add a note, Log
time.

*Could a stranger write anything?* **No.** Tested against the live API with
only the public key: every insert returns `42501, new row violates row-level
security`; every select returns empty. It was a trust problem, not a hole.

Five paths were missing from `PUBLIC` in `components/AppShell.tsx`: `/p/`,
`/new/`, `/q/`, `/r/`, `/trust`. `/security` is deliberately *not* public — it
is the two-factor screen for a signed-in person.

**3. Personal data in client-facing places.** `DIGITAL_PLAN` names one
person's domain, a friend's site, and "So searching Mike Calo finds you rather
than an actor, a basketball player and a college pitcher."

*Real impact:* **yes.** Lakemere has no Digital override, so the contractor
default turns it on — Marcie's workspace showed it. GSEA and Mammoth have
Digital off.

Gated behind `isPlatformOrg()` in `lib/spine/platform.ts`. `SUPPORT_EMAIL` was
a hardcoded personal Gmail on `/login` and `/trust`; it reads
`NEXT_PUBLIC_SUPPORT_EMAIL` now and is **empty by default**, and both pages
drop the link rather than render a broken one. `/new` and `/p` set their own
metadata, so a client's enquiry form no longer says "CALO&CO" in the tab.

**4. "Off" modules opened by URL.** `modulesFor` and `pathAllowed` were both
already correct; the failure was that the check ran in an effect calling
`router.replace` *after* the page had painted. Blocked before children mount
now, via `blocked` in `AppShell`.

**This is a product control, not a security boundary.** A switched-off module
is still that workspace's own data, so RLS has no reason to refuse it.
Server-side enforcement would mean a DB lookup in middleware on every request.
Right level for "you did not buy this", wrong level for a secret — and nothing
secret is behind one. Say this plainly if it comes up again.

**5. Platform to-dos on a studio owner's Home.** All seven items in
`lib/spine/setup.ts` are maintenance of this software and two name real
clients. All flagged `platformOnly: true`, same `isPlatformOrg()` gate. Zero
remain for any non-platform workspace.

**6. Log time went to the wrong job.** It picked `rows[0]` — most recently
updated across the workspace — wherever it was opened from.

*Real impact:* none. Only three real time entries exist, all CALO&CO's, all at
the correct $60.

`components/spine/LogTime.tsx` reads the pathname now: `/jobs/<id>` means that
job, `/customers/<id>` means that client's most recent job, anything else
keeps the old guess. The rate was never independently wrong —
`listBillableJobs` already resolves it per job from the client's agreed terms.

### Identity: the strip and the plate

- **Strip** — 4px, fixed, full width, above everything, signed-in pages only.
  `#111111` in an agency workspace *always* (even though CALO&CO has a brand
  colour) so "mine or a client's" is answered by a colour that cannot be
  confused. Client colour otherwise.
- **Plate** — replaces the product name at the top of the sidebar. 34px mark
  in the workspace colour, logo or initials, name at 14px semibold, and a
  second line with the business type and the DEMO tag. Opens the switcher.
- One resolver, `lib/spine/workspace-color.ts`, shared by both so they cannot
  drift. Order: explicit `settings.workspace_color`, then the first colour in
  the workspace's brand kit, then `#64748B`.
- The colour control is on **Settings → What You See**, behind the same gate
  the modules use.

**Fonts, unchanged:** Figtree (display/headings, 500/600/700), Inter (body and
UI), Geist Mono (figures). Do not change these without being asked.

### The switcher

`window.location.reload()` was the 6–13 seconds: a full document load, and it
reloaded the *current* URL, which is why switching from a client's Settings
landed on the next client's Settings.

Now: `setKnownOrg`, swap the context in memory, `router.replace('/')`.
`AppShell` keys its children on `org?.id`, so React tears the subtree down and
rebuilds it — the guarantee the reload was buying, for the cost of a
client-side navigation.

The panel (`components/spine/OrgSwitcher.tsx`) is panel-only now — the plate
is the trigger. "You are here" first, then the studio, then clients. Each row
carries a real status line: an overdue invoice if there is one, else when you
were last in (from `access_events`), else nothing. **It never invents a
status.** Type to filter, arrows, Enter, Escape. On a phone it is a bottom
sheet, and the phone header shows the workspace instead of the product name —
switching at that width was previously impossible.

### Signing in crashed the app, for 2h 47m

Shipped as `30bf90a`. `AppShell` declared one `useState` *after*
`if (isBarePage) return children`, so a bare page ran twelve hooks and an
in-app page ran thirteen. The first client-side move across that line renders
more hooks than the render before it and React throws #310: "Application
error: a client-side exception has occurred", and nothing else on the page.

Signing in is that move. `/login` is bare, the login page ends with
`router.push('/')`, and `/` is not. Every other way into the app is a full
document load, which resets the count, which is why it hid.

It went live at 13:40 UTC with `645d0d4` and was fixed at 16:27 UTC.
**No real client was affected.** The crash fires *after*
`signInWithPassword` succeeds, so anyone who typed a correct password would
have left a session row and a fresh `last_sign_in_at` even though the app died
in front of them. There are none: every session created that day belongs to
the demo account, and `access_events` since 13:00 UTC is Mike and the demo
account only. The caveat, stated rather than glossed: `auth.audit_log_entries`
holds **zero rows** on this project, so somebody who opened the login page and
never finished leaves no trace anywhere that can be read.

### The studio's work stopped leaking into client workspaces

The serious one. Tested as Mark in Mammoth, he could read:

```
JOBS      CALO&CO :: Platform Access & Ongoing Development
TIME      1.00h @ 60.00 "Setup and support"
INVOICES  MMTH-001  draft  80.00
NOTES     none
```

The engagement name, the hours, **the rate**, and a draft invoice deliberately
not approved. Fixed by dropping `jobs_billed_to_me` and
`time_entries_billed_to_me`, adding `status <> 'draft'` to the invoice and
invoice-line read-throughs, and rebuilding `client_account` as SECURITY
DEFINER with the scope moved *inside* the view.

After: Mark sees his own two jobs, no time, no invoices, and Bills to You
still renders. Mike sees everything he did before.

### Was anyone exposed during the twenty-minute view leak?

**No real client was signed in.** Checked afterwards, on request.

The window opened at **18:36:53 UTC on 24 September** — the timestamp of the
backfill in `20260924300000`, the migration that rebuilt `customer_summary`
and silently dropped `security_invoker` — and closed about twenty minutes
later when `20260924320000` put it back.

Every `access_events` row between 18:30 and 19:10 UTC belongs to
`mikexcalo@gmail.com`, and the only two inside the window itself are Mike in
CALO&CO at 18:44. The client accounts were nowhere near it:

| Account | Last active | Relative to the window |
|---|---|---|
| mark@mammothconstructiontx.com | 24 Sep 16:49 UTC | 1h 47m before it opened |
| john.littonny@gmail.com | 22 Sep 16:13 UTC | two days before |
| marcietomlinson@gmail.com | never signed in | — |

**One caveat, stated rather than glossed:** `access_events` records page
loads. A client holding an already-open tab that fired a background query
without a navigation would not appear. `customer_summary` is read by the
workspace switcher on page load, so a load is what it would have taken — and
the nearest client load was Mark's, nearly two hours earlier. The practical
answer is no exposure; the precise answer is no exposure that this table
could have recorded.

### Speed, so far

Measured, not guessed:

- Every query Home fires, timed in the database: **under 150ms total**, worst
  is `home_signals` at 65ms. The database is not the problem.
- The same calls over the wire: **230–800ms each, averaging ~350ms**, mostly
  connect and TLS.

So the cost is the *number of serial hops*. Three were removed: `forgetOrg()`
forcing a re-read of a column we had just written, `load()` re-confirming what
the UPDATE already confirmed, and the cache-honesty effect clearing instead of
setting. **About 1 second.**

---

## Open

**Switching: profiled in a browser, fixed, built, NOT measured, parked on
branch `speed-fix`.** Do not merge it on anybody's say-so, including this
file's. It typechecks and builds; it has never been run in a browser and the
"after" number does not exist yet.

Measured before, on the live site, Chrome, tab visible and focused, demo
account, click to the new workspace's Home fully rendered: 1.03s, 1.62s,
1.68s, 2.42s, 2.96s across five switches. Median 1.7s. Not the database and
not the amount of data, because Blank Co is empty and took 2.4s. Seven serial
round trips at 150-500ms each: the `profiles` write, the RSC payload for `/`,
two `auth.getUser()` calls, then Home's three query waves.

The one worth carrying forward even if the branch is thrown away:
**`auth.getUser()` in a mount effect stalls the whole screen.** It is a
network call to the auth server, and gotrue holds its lock while it runs, so
every other Supabase query queues behind it. Four panels were doing it. Use
`getSession()`; the id is already in the browser and nothing on that path is a
permission decision. Same lesson as `orgNow()` in db.ts.

**Measure with the tab actually visible.** The first four runs read 5.8s to
10.1s and were all wrong: the MCP tab was `visibilityState: hidden`, and
Chrome de-prioritizes network in a background tab, so every Supabase call
inflated three to sevenfold. The control that proved it: fourteen parallel
unauthenticated requests to the same origin, in that same hidden tab, all
returned in about 85ms. `osascript` can bring the right tab to the front.

**The product-name row is held and not started.** Mike sent the brief, then
said explicitly to hold it and do it as a separate piece with its own report.
The brief: a 16px dashed-outline mark and the text `[Product name]` above the
plate, Figtree 13px semibold `#6B7280`, both from a single setting, not
clickable, not on public pages. Plus: in client workspaces change "Powered by
CALO&CO" to "Set up by CALO&CO", and remove that line entirely in the studio.
**Do not start it without being asked.**

**Signing out signs you out everywhere, on every device.**
`components/TopBar.tsx:549` calls `supabase.auth.signOut()` with no scope, and
Supabase's default scope is global: it revokes every session that user holds.
Found the hard way. Signing out of the demo account on the live site killed a
demo session running against a local build at the same moment, and
`auth.sessions` showed all four of that day's demo sessions gone at once. So
if Mark signs out on his phone, his laptop is signed out too. If that is not
wanted it is `signOut({ scope: 'local' })`. Nobody has asked for either
behaviour yet, so it is written down rather than changed.

**Never verified in a browser this session:** the strip, the plate, the
switcher, phone width, and the switch timing. All were verified in code, in
the database, or over HTTP. Say so rather than implying otherwise.

### Mike's own outstanding items (his, not ours)

- **Approve both invoices around the 30th** so they go out on the 1st. The
  reminder fires on the last day of the month.
- **Stripe:** he has the account. Needs `STRIPE_SECRET_KEY` and
  `STRIPE_WEBHOOK_SECRET` in Vercel (project `nautilus`), and a webhook at
  `/api/stripe/webhook` for `invoice.paid`, `invoice.payment_failed`,
  `invoice.updated`, `invoice.voided`. He adds these himself — never ask for a
  key in chat.
- **Email replies:** MX on `in.calo.company`, Resend receiving, webhook, then
  `MAIL_INBOUND_DOMAIN` and `RESEND_WEBHOOK_SECRET`.
- **Next.js 14 → 16** upgrade, long deferred.
- **17 files still use a raw `<select>`** instead of the `Select` primitive.
- **31 discarded write errors** remain, all low-stakes (viewed_at,
  notifications). The two on money paths were fixed. A blanket rewrite of 33
  call sites is how three files got broken earlier; do them individually if at
  all.

---

## How Mike wants to be worked with

These were learned the hard way. They are not style preferences.

- **One brief at a time.** He will send a new brief mid-turn; if he says hold
  it, hold it, finish the current one, and report separately.
- **Report what the system PERMITS, not what a screen shows.** This cost
  credibility today: "the jobs returned are Harbor Light's own" was true of
  the app's query and false of RLS, which is the boundary that matters. When
  asked about access, test as that user against the database.
- **Always say what you could not verify.** Never imply a browser check that
  did not happen.
- **Every change must work at phone width.** Switching was impossible below
  720px for months because the only control lived in a bar that does not
  render there.
- **Check real-client impact before fixing.** For anything customer-facing, his
  first question is always "has a real client seen this?" Answer it with data
  before describing the fix.
- **Never send, publish or email anything to a real client while testing.**
- **Never invent a financial parameter.** A blank is safer than a plausible
  number, because a plausible one gets quoted.
- **Make the call.** He would rather have a decision with the reasoning than a
  menu of options. But flag genuine judgement calls so he can overrule.
- **Write like a person.** No em dashes in prose, no "AI riddles", contractions
  fine, say the thing and stop. `Brand → Platform` in the app holds the full
  voice guide, built from this product's own past mistakes.
- Module titles are Title Case. American English.

---

## Traps that cost real time today

**`scripts/ask-db.sh` is read-only by design.** It wraps the query in a
migration that deliberately raises, so nothing commits. Writes need a real
migration.

**Always `npx supabase db push --linked --include-all`.** Without
`--include-all` it refuses anything dated before the last applied migration.

**Never delete a migration file after it has been applied.** The CLI then
refuses everything with `LegacyDbPushMissingLocalError`. Recover with
`npx supabase migration repair --status reverted <version> --linked`. Cost
fifteen minutes today.

**`CREATE OR REPLACE VIEW` drops the view's options.** This is how I leaked
every customer to every client for twenty minutes: rebuilding
`customer_summary` silently removed `security_invoker`, so it ran as owner and
bypassed RLS. **Always re-apply `ALTER VIEW ... SET (security_invoker = true)`
after replacing a view**, and check with:

```sql
select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='v'
  and not coalesce((select option_value='true' from pg_options_to_table(c.reloptions)
                    where option_name='security_invoker'), false);
```

**`CREATE OR REPLACE VIEW` cannot reorder or rename columns.** New ones must be
appended at the end.

**`onConflict` needs a plain unique index, not an expression index.** A unique
index on `(org_id, COALESCE(customer_id, '000...'))` cannot be inferred, so
every upsert fails with 42P10 and the caller usually discards the error. This
bit `seo_tasks` and `seo_profile`; both had **zero rows, ever**. Use
`nulls not distinct`. Audit all upserts against real indexes before trusting
any of them.

**`auth` is Supabase's schema and we do not own it.** `ALTER TABLE auth.users`
is refused. Four of its token columns — `confirmation_token`,
`recovery_token`, `email_change`, `email_change_token_new` — have **no
default**, and GoTrue reads them into plain Go strings, so a single NULL makes
password reset return 500. **Never hand-write an INSERT into `auth.users`;**
use `public.new_auth_user(email, name)`. Also documented in `CLAUDE.md`.

**There is no service-role key available.** It is a Vercel secret Vercel will
not return. Everything is done through migrations or the public anon key.

**Supabase round trips are ~350ms from a browser** while the database work is
under 20ms. Latency, not work. When something feels slow, count serial hops
first.

**Run `npx tsc --noEmit` for the fast check** and `npm run build` before
pushing. **Run `npm run sitemap`** — it catches orphan routes and label
mismatches, and is deliberately not in `prebuild` because a failure there once
killed deploys silently.

**A hook cannot sit behind a conditional return.** `AppShell` had one
`useState` below `if (isBarePage) return children`, which crashed the app on
sign-in for nearly three hours. A component with an early return needs every
hook declared above it. `npm run build` does not catch this and neither does
`tsc`; it only shows on a client-side navigation across the branch.

**JSX: `{cond && (...)}` accepts exactly one child, and a `{/* comment */}`
counts as a child.** Broke the build three times today. Put the comment above
the conditional.

**The repo lives in iCloud Desktop**, which creates ` 2.sql` conflict copies
that break `supabase db push`. `npm run tidy` clears them. Claude Cowork is
moving the repo out; `BRIEF-move-repo-off-icloud.md` is on the Desktop.

---

## The demo account

`mikexcalo+demo@gmail.com`. **The password is not known to anyone, by design**
— it is a bcrypt hash of a UUID generated inside a migration and never
recorded. Reach it only via "Forgot your password?".

Five workspaces, all `is_demo = true`:

| Workspace | Kind | Strip | Notes |
|---|---|---|---|
| Northwind Studio | agency | `#111111` | the studio; lands here |
| Harbor Light Roofing | contractor | `#1F6F78` | roofer, fully seeded |
| Ember & Ash Hot Sauce | contractor | `#B23A19` | wholesale, catalog-led |
| Tideline | contractor | `#0B1F2A` | startup, brand + pipeline |
| Blank Co | contractor | grey | empty, new-signup case |

Three-tier shape, copied exactly from the real one: an `agency` org, an
`owner` membership in each client org, and a `customers` row in the agency
with `linked_org_id` pointing at that org.

**Demo safety, verified:** 55 addresses across all demo data, none outside
`@example.com`. All ten mail routes refuse reserved test addresses via
`lib/spine/deliverable.ts` (`postEmail`). Zero demo rows point at a real org;
zero cross-memberships either way. Isolation tested per user, including
forcing `active_org_id` to CALO&CO — `current_org_id()` returns NULL and
nothing is visible.

## Real workspaces

`CALO&CO` (agency, slug `calo-co` — this is the platform owner, see
`isPlatformOrg`), `Global Seafood Partners` (rep, John Litton),
`Mammoth Construction` (contractor, Mark Mesedahl), `Lakemere Services`
(contractor, Marcie — testing on her husband's behalf).

Both September invoices are drafted and correct and await approval.
