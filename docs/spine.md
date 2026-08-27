# The Nautilus spine

How a receipt becomes an invoice line, and why the app is shaped this way.

---

## The one idea

**A job is the unit of work.** Everything hangs off it.

The old model was client-centric — invoices attached to a *client*, which is how
an agency thinks (bill the same customer monthly, forever). A contractor thinks
in jobs: "how is the Gorshteyn bathroom doing, and am I making money on it."

A **lead is just a job at status `lead`**. There is no separate leads module.
The same record moves left to right through the pipeline:

```
lead → estimating → won → active → complete → closed
                                        ↘ lost
```

That's what makes the app process-oriented instead of a pile of screens.

---

## Why time & materials makes documents the main event

**Fixed price:** the quote is a promise. The invoice repeats the quote.
Documents are filing.

**Time & materials:** the quote is only an *estimate*. The invoice is built
from what actually happened — hours worked and materials actually bought.

Which means **the receipts and time entries ARE the invoice.** They aren't
records of the job, they're the billing input. Organizing the paperwork isn't
a side feature; it's the billing engine.

```
   photo of a receipt
          │
          ▼
   ┌─────────────┐   read once, ~$0.005
   │  documents  │   vendor, date, amount, category
   └─────────────┘
          │  file to a job
          ▼
   ┌─────────────┐   what the job cost you
   │    costs    │   (+ markup when billing)
   └─────────────┘
          │
          │   ┌──────────────┐   what you're owed for labor
          │   │ time_entries │   hours × rate
          │   └──────────────┘
          │          │
          ▼          ▼
   ┌──────────────────────────┐
   │  job_invoice_lines       │  each line keeps a pointer back:
   │  source_cost_id          │  source_time_entry_id
   └──────────────────────────┘
```

**Fixed-price is the same model with the estimate locked.** Actuals then affect
your margin instead of the customer's bill. Build T&M and fixed-price comes
nearly free — which is why "T&M, I think" was enough to start on.

---

## The tables

| Table | What it holds |
|---|---|
| `orgs` | Multi-tenancy. CALO&CO is one org, Mammoth is another. |
| `customers` | Who an org bills. For Mammoth: homeowners. |
| `jobs` | **The spine.** Leads and jobs are the same record. |
| `estimates` / `estimate_lines` | Versioned. A revision supersedes rather than overwrites. |
| `time_entries` | Labor actuals. Half the T&M billing input. |
| `costs` | Material actuals. The other half. Points back at its receipt. |
| `documents` | The shoebox. Extraction output + what it cost to read. |
| `job_invoices` / `job_invoice_lines` | Assembled from actuals, not typed by hand. |
| `job_ledger` (view) | Money for every job in one query. |

### Why `job_invoices` and not `invoices`

The old `invoices` table still exists during the transition. At sunset:

```sql
drop table invoices;
alter table job_invoices rename to invoices;
alter table job_invoice_lines rename to invoice_lines;
```

---

## The core move

`draftInvoiceFromActuals()` in `lib/spine/db.ts`:

1. Find every unbilled time entry and unbilled cost on the job
2. Hours → labor lines (qty × rate)
3. Costs → material lines (amount + markup)
4. Stamp each source as billed so it can't land on a second invoice
5. Each line keeps `source_time_entry_id` or `source_cost_id`

**Nobody types an invoice. They approve one.**

Voiding releases the sources back to unbilled so they can be re-invoiced.
Without that, a mistaken invoice silently eats revenue.

---

## What this deliberately does NOT do

**No LLM search. No chat over your data.** Those are unbounded recurring
costs — every question costs money, forever, and gets more expensive as data
grows.

Extraction is the opposite shape: **one cost per document, once, ever.**

- A receipt is ~2,000 input + ~500 output tokens
- On Haiku 4.5 ($1/MTok in, $5/MTok out) ≈ **half a cent per document**
- 1,000 documents ≈ **$5 total**, and never again

The measured cost of every extraction is stored on the document row and the
running total is shown on the Documents page. Not hidden — the number is small
and seeing it is the point.

---

## Beyond contractors

Mammoth is the first user, not the only intended one. The spine is already
industry-neutral where it counts:

- A **job** is any unit of work with money in, money out and a margin. A
  remodel, a design engagement, a legal matter, an event.
- **Time & materials vs fixed price** is how most service businesses bill,
  not a construction idea.
- **Receipts becoming job costs** is universal to anyone who spends to deliver.
- Vocabulary already swaps by business kind (`lib/spine/org.tsx`) — Jobs and
  Customers for a contractor, Engagements and Clients for an agency. Adding a
  third vocabulary is a few lines, not a rebuild.

What is genuinely contractor-shaped and would need generalizing later:
material markup, the trade categories in the price list, and some copy in the
guided paths. None of it is structural.

The rule: resist adding anything that only makes sense for construction
unless it earns its place for Mammoth *now*. A permit tracker would be a trap.

## Rules for building on this

1. **Never loop queries over a list.** If you need totals across many jobs,
   read `job_ledger`. The old financials page ran one round trip per client;
   that's what the view exists to prevent.
2. **No global mutable cache.** `lib/spine/db.ts` is plain functions that
   return what they read. Components own their state. The old
   `lib/database.ts` (1,593 lines) is what happens otherwise.
3. **Nothing about a company is hardcoded.** Rates, markup, tax, payment
   details live on `orgs`. The old code hardcoded `CALO&CO`, `Mike Calo`,
   and personal Venmo handles as app defaults.
4. **RLS on every table, walled by org**, resolved through `current_org_id()`.

---

## Setup before first use

The migration creates the tables but not your org. Run once:

```sql
insert into orgs (name, slug, kind, default_labor_rate, default_material_markup_pct, tax_rate)
values ('Mammoth Construction', 'mammoth', 'contractor', 85, 15, 5.5);

update profiles
set org_id = (select id from orgs where slug = 'mammoth')
where id = '<your-auth-user-id>';
```

Without `profiles.org_id` set, RLS correctly returns nothing and every new
screen will look empty.

---

## Not built yet

Deliberately deferred — the spine supports them, they're bolt-ons:

- **Stripe Invoicing** — `job_invoices.external_ref` is reserved for it.
  Replaces manual "mark paid" and the hand-built PDF machinery.
- **E-signature** — DocuSign or in-platform, on estimates.
- **Texting** — job-scoped SMS.
- **File storage** — `documents.storage_path` currently records
  `pending/<filename>`; wiring Supabase Storage makes documents re-viewable
  after upload.
