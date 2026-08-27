# Blocked on Mike

Things only you can do. I'll remind you as these come up.

Last updated: 2026-08-26

---

## Open

### 1. Stripe keys — deferred by you, 2026-08-26
Blocks: sending invoices for payment, automatic paid marking.
Built and waiting; the routes return a clear message until the keys exist.

- `STRIPE_SECRET_KEY` — test mode (`sk_test_…`) is fine to start
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase dashboard → Project Settings → API
- Later: a webhook pointing at `https://nautilusapp.vercel.app/api/stripe/webhook`,
  then its signing secret as `STRIPE_WEBHOOK_SECRET`

Until then: "Mark sent by hand" and "Mark paid" work fine.

### 2. Mammoth's real rates
Blocks: any invoice being correct.
Both businesses have hourly rate, material markup and tax at **0**, so every
invoice totals zero. Left at zero deliberately — an obviously wrong number is
safer than a plausible guessed one.

Set at **/business**, per business. Need from Mark: hourly rate, material
markup %, and whether Mammoth charges sales tax on labour in Maine.

### 3. Anthropic key in `.env.local`
Blocks: testing receipt reading on localhost only. **Production already works.**
`ANTHROPIC_API_KEY` is present but empty in `.env.local` and `.env.prod`.

### 4. Test the receipt reader on a real receipt
Blocks: knowing whether this actually works.
Still never been run against a real crumpled receipt. Everything else about
the pipeline is verified; this is the one unproven link.

### 5. Move Supabase off the free plan (or set a reminder)
Blocks: nothing today. Prevents a repeat of the July outage — the project was
culled after 51 idle days and took the site down with it.

---

## Decisions I still need from you

- **Legacy data migration.** Old `clients`, `contacts`, `invoices`, `quotes`
  tables still hold real records. Do you want them moved onto the new spine, or
  are they abandonable? This decides whether the legacy modules get deleted or
  converted.
- **Brand Kit.** Currently reads the old `brand_kits` table, which is not
  org-aware. Rebuild it on the spine, or leave as-is?

---

## Done

- ~~Supabase login so migrations could run~~ — done 2026-08-21
- ~~Restore the paused Supabase project~~ — done 2026-08-20

---

## Flagged 2026-08-26 — Mammoth's form doesn't reach Nautilus

Mammoth's contact form posts to **Web3Forms** (`api.web3forms.com`), which
emails `info@mammothconstructiontx.com`. It has never touched Nautilus, so
Mammoth leads do not appear in the CRM at all.

calo-co-site is wired correctly (`source: "calo-co-site-contact-form"`).

**Fix:** add a second POST to `https://nautilusapp.vercel.app/api/leads/ingest`
in `~/Desktop/mammoth-construction-site/index.html` (around line 1958, alongside
the existing Web3Forms call), with `source: "mammoth-construction-site"`. Keep
Web3Forms so their email notification doesn't change.

Not done yet — that's a client's live site in another repo and needs your say-so.
