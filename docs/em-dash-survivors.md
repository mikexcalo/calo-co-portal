# The em dashes that predate the check

**Updated 27 Sept 2026.** The ten that reach a customer are fixed and the
three "keep" lines are now line-level `ALLOWED` entries in
`scripts/em-dash-check.ts` rather than baseline. **27 occurrences across 25
lines remain**, all owner-facing, recorded in `scripts/em-dash-baseline.json`.

The original count was 40 across 38 lines in 13 files. This file said "the
nine that reach a customer" and there were ten; the list under that heading
was right and the number above it was not.

Not counted, and correctly so: comments, the four `app/api/*/extract` model
prompts, the en dash used as the empty-cell glyph and in ranges, and the two
detector regexes. See backlog #21 for why each is out.

**The house separator is the middle dot.** The product already uses it —
"Who is this about? · optional", "$60.00/hr · friends and family", "Harbor
Light Roofing · Sep 27, 2026". Where a dash is doing a separator's job rather
than a sentence's, `·` is the swap that needs no rewriting and matches what is
already on screen. Where it is punctuating a sentence, the rulebook's answer is
a comma or a full stop.

**Recommendation in one line:** fix 35, keep 3. Of those, the 10 customer-
facing fixes and all 3 keeps are done; **25 owner-facing fixes remain**.

---

## DONE 27 Sept 2026 — the ten that reach a customer

Reworded rather than repunctuated, because each of these goes out under a
client's name.

### `app/api/estimates/send/route.ts`

**202** — email subject
- before: `` `Your estimate from ${org} — ${job}` ``
- after: `` job?.name ? `Your estimate for ${job.name}` : `Your estimate from ${org}` ``
- Also fixes a real defect: with no job name the old line sent a subject
  ending in a bare dash.

**208** — customer email body
- before: "accept or decline from that page — no account needed."
- after: "accept or decline from that page without making an account."

### `app/api/leads/ingest/route.ts`

**236** — notification title
- before: `` `New lead — ${name}` `` → after: `` `New lead from ${name}` ``

**239** — notification body
- before: "No email yet — get one when you call back."
- after: "They left no email. Get one when you call back."

**271** — email subject
- before: `` `New ${label} lead — ${name}` `` → after: `` `New ${label} lead from ${name}` ``

**276** — HTML email
- before: "No email — capture one on the callback"
- after: "No email on file. Capture one on the callback."

### `app/api/invoices/send/route.ts`

**228** — Stripe invoice description, seen on a card statement and receipt
- before: `` `${job.name} — ${invoice.number}` ``
- after: `` `${job.name} (${invoice.number})` ``

### `app/api/stripe/webhook/route.ts`

**155** — notification title
- before: `` `Payment failed — ${number}` `` → after: `` `Payment failed on ${number}` ``

### `lib/spine/db.ts`

**1138** — labor line on an invoice the customer pays
- before: `` `Labor — ${worker_name} (${worked_on})` ``
- after: `` `Labor by ${worker_name} (${worked_on})` ``

**1269** — progress draw line
- before: `` `${pct}% progress draw — ${job}` ``
- after: `` `${pct}% progress draw on ${job ?? 'the contract'}` ``

Both are defaults that apply only when nobody typed a description, so this
changes what new invoices say and nothing already sent.

---

## Fix — prose the business owner reads

### `lib/spine/answers.ts` (6 across 5 lines)

Lines 136, 144, 152, 162 (twice), 174. These are the help answers, the longest
continuous prose in the product and the place the voice is most visible. All
five are mid-sentence asides: "The words change too — a Job in one is an
Engagement in the other." Every one takes a comma or a full stop without
losing anything.

### `lib/spine/signature.ts` (6)

Lines 144, 153, 168, 193, 209, 220. Step-by-step instructions for installing
an email signature, one per mail client. Same shape throughout: an instruction,
a dash, the reason. "Untick Always match my default message font — this
matters, it strips your formatting otherwise." A full stop is better than a
comma here, because several already contain a comma.

### `lib/spine/tutorial.tsx` (3)

Lines 73, 89, 308. Tutorial copy. Same aside pattern. Comma.

### `lib/spine/mfa.ts` (1)

Line 128: "Codes change every 30 seconds — check your app and try the current
one." An error message, so the rulebook's three questions apply and it already
answers them. Full stop.

### `app/api/site-requests/approve/route.ts` (1 of its 3)

Line 165: "nothing was filed — the brief is saved on the request." Shown in the
product after approving a site request. Full stop.

---

## Fix — labels where the dash is a separator

These are the ones where `·` is the answer rather than a rewrite.

### `lib/spine/logos.ts` (8 across 7 lines)

| Line | Now | Suggested |
|---|---|---|
| 31–34 | `Large — 1024px`, `Medium — 512px`, `Small — 256px`, `Email — 240px` | `Large · 1024px` and so on |
| 139 | `Icon — light` / `Icon — dark` | `Icon · light` / `Icon · dark` |
| 148 | `Full logo — reversed` | `Full logo · reversed` |
| 156 | `Full logo — primary` | `Full logo · primary` |

Line 39 is the odd one in this file: "No transparency — the background is
filled in." is a sentence, not a label, and wants a full stop.

These eight are the weakest case for changing anything, and the reason to do
it anyway is that they are download filenames and option labels sitting beside
controls that already use `·`. One separator, not two.

### `lib/spine/payments.ts` (1)

Line 89: `costLabel: 'Free — bank to bank'` → `'Free · bank to bank'`.

---

## DONE 27 Sept 2026 — Keep, as ALLOWED entries

### `app/api/stories/draft/route.ts` line 180

`` `[${p.status}] ${p.body}${p.attribution ? ` — ${p.attribution}` : ''}` ``

This builds `material`, the block of context handed to the model when drafting
a case study. Nobody reads it. It is in the same file as user-facing strings,
so the file cannot be exempted wholesale the way the four extract routes are.

**Recommendation:** a line-level entry in `ALLOWED` in
`scripts/em-dash-check.ts`, keyed on `p.attribution`, with the reason written
down. That takes it out of the baseline rather than leaving it in a list of
things to fix.

### `app/api/site-requests/approve/route.ts` lines 65 and 76

Both are inside `briefFor()`, which builds the body of a GitHub issue:

- 65: `` | Site | ${siteName} — ${siteUrl} | `` — a markdown table cell.
- 76: "If it fails, fix it or stop — never push red." — a rule for whoever
  picks the issue up.

This is an engineering document, not product copy. It is read by a person, so
the check is right to see it, but the house voice governs what clients and
owners read, not what we write in a work ticket.

**Recommendation:** a line-level `ALLOWED` entry scoped to `briefFor`, same as
above. If that feels too loose, the alternative is to fix them — neither would
be worse for a comma — and the reason to prefer the exemption is that the next
person editing that brief should not have to think about the product's voice
rules while writing instructions for a build agent.

---

## Doing it

Not one sweep. The last two produced their own casualties: 24 empty-cell
placeholders in `e60d8c4`, a sixth in `af47304`. Three sittings, each one
verifiable on its own:

1. ~~The ten that reach a customer.~~ **Done 27 Sept 2026.**
2. **The sixteen in owner-facing prose** — `answers.ts`, `signature.ts`,
   `tutorial.tsx`, `mfa.ts`, `site-requests/approve:165`. Mechanical once
   you accept the comma-or-full-stop rule, but it is the voice, so read them.
3. **The ten labels** — `logos.ts`, `payments.ts`. Genuinely mechanical.

After each, `npm run words:accept` to shrink the baseline, and commit the
baseline with the fix so the two never drift apart.
