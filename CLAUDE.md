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
written by hand is a bug, not a style choice.

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
