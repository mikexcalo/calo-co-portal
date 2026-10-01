# Nautilus — how this codebase actually works

This file used to describe `components/shared/PageLayout`, `lib/design-tokens.ts`
and a `#f4f5f7` page background. None of those exist and none of those tokens
appear anywhere in the app — it described an architecture that was replaced and
then kept giving instructions about it. What follows is checked against the
code.

## Read the rulebook first

**`docs/ux-rulebook.md` before changing any screen.** Every session, every
time. It is the one written answer to "how do we do this here" — the shell,
the type scale, one of each component with its exact values, the phone rules,
how errors are worded, and what a brief has to verify before it is called
done. Without it every brief re-decides, which is how the product came to have
sixteen kinds of button.

`docs/consistency-backlog.md` is the list of screens that break it today,
grouped so each group is one brief.

## The spine

Everything real lives under `lib/spine/`:

| File | What it holds |
|---|---|
| `ui.tsx` | `Page`, `Card`, `Button`, `Tabs`, `Sheet`, `Select`, `Empty`, `SectionLabel`, `Table`, `Row`, `Pill`, `Field` |
| `tokens.ts` | `C` (colors), `DISPLAY`, `radius`. Import these; never hardcode a hex |
| `modules.ts` | What each business sees: `navFor`, `pathAllowed`, `modulesFor`, and the `MODULE_*` maps |
| `db.ts` | Plain query functions. Writes go through `unwrap`, which throws |
| `errors.ts` | `human(e)` — turns a database error into a sentence. Never show a raw one |
| `save.ts` | `save(builder)` — wraps a write so its failure is visible |

Screens are in `app/`, shared pieces in `components/spine/`.

**Use the primitives.** This table used to say `ui.tsx` held "the tab strips".
It did not — it exported tab *data* (`CLIENT_TABS`, `MONEY_TABS` and the rest)
and no component to render it, so 53 files hand-wrote the pill strip, 29
dropped a raw `<select>` into otherwise custom controls, and every overlay in
the product was built from scratch with its own backdrop and its own idea of
whether escape should close it.

`Tabs`, `Sheet` and `Select` exist now. A new tab strip, dialog or dropdown
written by hand is a bug, not a style choice. There are zero raw `<select>`
elements outside `ui.tsx`; keep it that way.

`Sheet` closes on Escape and on a click outside, and asks first when
something in it has been typed into - worked out by comparing the fields
against what they held when it opened, so a panel that opens full of existing
values does not claim to be unsaved. Pass `unsaved` to override that where a
caller knows better.

Six overlays are deliberately **not** Sheets: the photo lightbox, the command
palette, the tutorial drawer, the phone nav drawer, and the two anchored menus
(profile, notifications). A menu that grows a backdrop and a title stops being
a menu. They share the behaviour instead, through `useEscape`.

## Navigation is generated, not hand-written

A module needs an entry in every `MODULE_*` map in `modules.ts`. Anything
switched on and unplaced gets a sidebar row automatically, so a module cannot
exist with no way in.

`MODULE_TAB_PARENT` says a module is a tab of another rather than its own row.
A screen is reached one way. Two rows at the same URL, a page in two tab
families, or a sidebar label that disagrees with its tab all fail the build.

```
npm run sitemap     # prints the whole map
```

Run it before pushing. It is deliberately **not** wired into `prebuild`: it
was, and a failure there killed every deployment for hours with no signal
except a stale site. A check that can block a deploy has to be one you can see
failing.

## Writing

- **American English.** "colors", not "colours".
- **Say what the screen is, not how it works.** "Receipts, filed against jobs"
  beats "photograph a receipt and it becomes a job cost". The label is the
  instruction; a hint only earns its place if it says what you need before you
  start.
- **No aphorisms in the interface.** A subtitle is a label.
- **Empty states name the next step**, or they are just a statement of fact.
- **Never a real person's name** as placeholder or example text.
- **Errors say what happened, whose fault it is, and whether retrying helps.**
- **"Nothing was saved" belongs to writes only.** `human()` defaults to
  `WRITE_FAILED`; a read must pass `READ_FAILED`. The phrase is what
  `guard_session_writes()` and `guard_sending()` open with, so a read that
  borrows it impersonates a permission refusal. Three named causes - missing
  migration, permission denied, expired sign-in - can happen either way and
  branch on the fallback.

## Rules that are already load-bearing

- **Light theme only.** Dark has been rejected twice.
- **A job is the unit of work.** A lead is a job at status `lead`.
- **Invoices are built from actuals** — logged hours and filed receipts.
- **No unbounded per-query AI billing.** Document extraction is allowed because
  it is one bounded cost per document, and the running total is shown on purpose.
- **Never guess a financial parameter.** An obviously wrong number is safer than
  a plausible one.
- **Rates are per-org.** One business having them unset says nothing about another.
- **`role = 'owner'` is not the business.** In a client workspace the studio
  holds that seat and the client is `admin`. To reach the business's own
  people, ask `memberships.origin = 'own'`. Backlog #12 is the plan to undo
  the arrangement; until then, every query that means "them" and asks for
  "owner" gets us.

## View mode, Work in it and sending are database rules

`lib/spine/readonly.ts` holds the mode in a module variable and greys the
buttons. That is the browser telling itself a rule, and it is not the
enforcement — the same user is an owner of the client workspace either way, so
PostgREST took every write View mode was hiding.

The fact now lives in a row. `work_sessions` says who is in which workspace in
which mode, and under which grant. `guard_session_writes()` is on 37
org-scoped tables and `guard_sending()` is on `estimates` and `job_invoices`:

| Situation | What the database does |
|---|---|
| View mode | Refuses every write |
| Work in it, no grant | Refuses every write |
| Work in it, grant revoked or expired | Refuses every write, immediately |
| Work in it, `can_send = false` | Takes the edit, refuses the send |
| No session, and you are the client's own team | Normal. RLS is the only rule |
| No session, and you are their studio | Refuses every write unless a grant is live |

Two consequences for anything you write:

- **`work_sessions` is exempt from the browser write guard**, in
  `WRITABLE_WHILE_VIEWING`. Closing a session is the act of leaving the mode;
  a guard that blocked it would strand somebody read-only with no way out.
- **A mode that cannot be recorded is not entered.** `openSession` returns
  false and `viewas.tsx` drops straight back out with a message, rather than
  showing a padlock the database will ignore.

**A membership says which side of the table you are on.** `memberships.origin`
is `own` or `studio`, stamped on insert by `membership_origin()`, which reads
the same `customers.linked_org_id` link `studio_for()` uses. Without it the
guards only bound people who declared a mode, and declaring nothing was the
one route past every check. The studio's own workspace is unaffected: nothing
links to it, so everybody in it is `own`.

On everywhere since 26 Sept 2026. `studio_rule_applies()` is kept as the one
switch if it ever has to come off, rather than an emergency migration dropping
triggers off 37 tables.

**A standing grant has no end.** `work_grants.standing` survives handing back
— `handBack` skips it and `keep_standing_grants_open()` holds the line if
anything else tries. Only the client revoking it closes it, from
`WhoCanWorkInThis` on the Security page. That is not a lock-out: a revoked
studio can still start its own session, which is the loud kind the client is
told about every time.

The service role has no session and is exempt by design — `auth.uid()` is null
and the trigger returns early. Anything running with the service key is
already past every check in this product.

## Migrations

`supabase/migrations/`, named `YYYYMMDD_lower_case_phrase.sql`.

14-digit timestamps, one file each. For most of this project there were three
copies of everything — an 8-digit original, a 14-digit rename, and a set of
Finder duplicates ending ` 2.sql` — 216 of 343 files, all byte-identical to a
twin. `supabase db push` refused to do anything while they existed, so every
migration went in by hand through the dashboard. That is what produced a
migration nobody ran and an afternoon spent misdiagnosing why.

They are deleted. The CLI works:

```
npx supabase db push --linked      # apply anything new
scripts/ask-db.sh "select ..."     # read production
```

Name a new one `YYYYMMDDHHMMSS_lower_case_phrase.sql`, and sort it after the
last one the remote has tracked or push will refuse it.

## Never hand-write an INSERT into auth.users

`auth` is Supabase's schema and we do not own it, so `ALTER TABLE auth.users`
is refused. That matters because four of its token columns —
`confirmation_token`, `recovery_token`, `email_change`,
`email_change_token_new` — have **no default**, while the four beside them do.

GoTrue reads those columns into plain Go strings, not nullable ones. A single
NULL makes the lookup fail before it reaches anything useful, so password
reset returns a 500 and the sign-in page says "That did not work". The account
looks fine in every other respect.

That is how the demo account shipped broken: the INSERT named none of the
eight, four defaulted to `''`, four came out NULL.

```sql
select public.new_auth_user('someone@example.com', 'Their Name');
```

`new_auth_user` names every column GoTrue reads, sets a password nobody can
know so the account is only reachable by reset, and creates the email identity
without which sign-in fails outright. Use it, or use the Supabase dashboard.

## Client folders in Google Drive

Every client gets the same six, in this order, and the numbers are part of the
names so they sort:

    1 Brand · 2 Website · 3 Photos · 4 Documents · 5 Working · 6 Archive

`4 Documents` is paperwork we keep and refer to. `5 Working` is drafts still
in motion. `6 Archive` is superseded, and nothing is ever deleted from a
client folder - anything doubtful goes there instead of into a decision.

**A client site's code lives in `2 Website/source/`, and GitHub stays the
master.** The Drive copy is a reference for somebody who does not have the
repo, so it is refreshed in the same step as any change to a client site:
deploy the site, refresh the Drive copy, in one go. A Drive copy that silently
drifts from the deployed site is worse than no copy, because somebody will
read it and believe it.

**Use rclone, never a hand-copy.** `~/bin/rclone`, remote `gdrive:`, pointed at
My Drive with no `team_drive` set. The refresh is one command per site, run
after any change to that site:

```
rclone sync sites/global-seafood "gdrive,root_folder_id=<folder id>:" \
  --exclude '.env*' --exclude 'node_modules/**' --exclude '.git/**' \
  --exclude '.vercel/**' --exclude '.DS_Store' --exclude '**/.DS_Store' \
  --checksum --dry-run          # drop --dry-run when the file list reads right
```

Address the destination by folder id, not by path. The client folders live
under `CALO&CO/Active Projects/`, and an ampersand in a path is one more thing
to get wrong at the moment you are overwriting somebody's files.

    2 Website/source      GSP 1UFKlBLP_PN8d3mrLFrhwpSJwwi5RRjrh
                      Mammoth 1ApKjUglospR21Uj3ErYw0Hj7pfss3Mxj

`sync` is deliberately one-way, code to Drive. Nothing is ever pulled back:
the repo is the master and a file that arrived from Drive has no history.

The exclusions are not optional. `.env*` holds keys - GSP's carries a live
`VERCEL_OIDC_TOKEN` - and anything holding a key or a token stays out.

Check the sizes afterwards, every time:

```
rclone check <src> "gdrive,root_folder_id=<folder id>:" --size-only <same excludes>
```

It should say `0 differences found`. Uploading by hand through the Drive API
corrupts text instead: XML and JSON come back escaped and land at a
plausible-looking size. `sitemap.xml` went up at 452 bytes against 338 on disk
that way, and only the size check caught it.

## Deploys

Vercel builds on push to `main`. Every route redirects to `/login` when signed
out, so curling a URL proves nothing about whether a deploy landed — check the
build, or `npm run sitemap` locally.

## Git

```
git add -A && git commit -m "…" && git push origin main
```

Never `--force`. `master` is stale and holds nothing `main` does not; it cannot
be deleted until GitHub's default branch is changed, which needs a human with
repo admin. Until then do not push to it — two branches that disagree is worse
than one that is out of date.
