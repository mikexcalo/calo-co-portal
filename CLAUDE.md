# Nautilus — how this codebase actually works

This file used to describe `components/shared/PageLayout`, `lib/design-tokens.ts`
and a `#f4f5f7` page background. None of those exist and none of those tokens
appear anywhere in the app — it described an architecture that was replaced and
then kept giving instructions about it. What follows is checked against the
code.

## The spine

Everything real lives under `lib/spine/`:

| File | What it holds |
|---|---|
| `ui.tsx` | `Page`, `Card`, `Button`, `Empty`, `SectionLabel`, `Table`, `Row`, `Pill`, `DropZone`, the tab strips |
| `tokens.ts` | `C` (colors), `DISPLAY`, `radius`. Import these; never hardcode a hex |
| `modules.ts` | What each business sees: `navFor`, `pathAllowed`, `modulesFor`, and the `MODULE_*` maps |
| `db.ts` | Plain query functions. Writes go through `unwrap`, which throws |
| `errors.ts` | `human(e)` — turns a database error into a sentence. Never show a raw one |
| `save.ts` | `save(builder)` — wraps a write so its failure is visible |

Screens are in `app/`, shared pieces in `components/spine/`.

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

It runs on `prebuild`, so a regression stops the deploy instead of reaching
somebody's screen.

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

## Rules that are already load-bearing

- **Light theme only.** Dark has been rejected twice.
- **A job is the unit of work.** A lead is a job at status `lead`.
- **Invoices are built from actuals** — logged hours and filed receipts.
- **No unbounded per-query AI billing.** Document extraction is allowed because
  it is one bounded cost per document, and the running total is shown on purpose.
- **Never guess a financial parameter.** An obviously wrong number is safer than
  a plausible one.
- **Rates are per-org.** One business having them unset says nothing about another.

## Migrations

`supabase/migrations/`, named `YYYYMMDD_lower_case_phrase.sql`.

They are **8-digit dates, not 14-digit timestamps**, so the Supabase CLI will
not track them — `supabase db push` believes none have been applied and would
try to re-run all 98. Apply new ones by pasting into the dashboard SQL editor:

```
https://supabase.com/dashboard/project/qwncdybiluseypcovitd/sql/new
```

Renaming them all to 14-digit versions would fix this properly and has not been
done.

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
