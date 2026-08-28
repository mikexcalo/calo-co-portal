# Blocked on Mike

Things only you can do. I'll remind you as these come up.

Last updated: 2026-08-26

---

## Open

### 0. Verify calo.company for email — 2026-08-27
Blocks: Mark's invite arriving and not looking like phishing.

DNS for calo.company is on **Vercel**, with no MX or SPF records today, so
nothing conflicts.

1. Resend → Domains → add `calo.company`
2. Paste the 3-4 records into Vercel's DNS tab for the domain
3. Set `MAIL_FROM` in Vercel to `CALO&CO <nautilus@calo.company>`
4. Supabase → Authentication → SMTP Settings → point at Resend
   (`smtp.resend.com`, port 465, user `resend`, password = Resend API key)

The sending address does NOT need a real mailbox and does not need Google
Workspace. Full detail in docs/email-setup.md.

### 0b. Supabase Pro — $25/month
Blocks: nothing today. Prevents the project pausing on inactivity, which is
what took the site down in July, and adds daily backups. Once Mark has real
job data in there, this stops being optional.

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

---

## Project plan — deferred, not forgotten

### Vercel Pro — $20/month
Deferred until Mark is up and running in Nautilus.

The Hobby plan is **non-commercial**. Hosting a paying client's marketing site
already stretches it; running their business software on it breaks it
outright. The $20 covers every project on the account, not per site, so one
charge carries all client hosting.

Worth knowing when pricing: passing through even $15/month of it to a client
covers most of the cost, and every client after the first is pure margin.

### Supabase Pro — $25/month
Also deferred. Free-tier projects sleep after about a week of inactivity,
which is what took the site down in July. Fine while it is only Mike using it
daily. Not fine the day Mark depends on it.

### Payment handles
Venmo, PayPal and Zelle handles for CALO&CO and Mammoth still need entering at
**Business → How you get paid**. Handles only — never account or routing
numbers; that text appears on customer-facing invoices.
