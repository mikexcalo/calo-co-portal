# The forty em dashes that predate the check

40 occurrences across 38 lines in 13 files, all of them in text a person
reads. They are recorded in `scripts/em-dash-baseline.json`, so the pre-push
check passes today and fails on anything new. Nothing here has been changed.

Not counted, and correctly so: comments, the four `app/api/*/extract` model
prompts, the en dash used as the empty-cell glyph and in ranges, and the two
detector regexes. See backlog #21 for why each is out.

**The house separator is the middle dot.** The product already uses it —
"Who is this about? · optional", "$60.00/hr · friends and family", "Harbor
Light Roofing · Sep 27, 2026". Where a dash is doing a separator's job rather
than a sentence's, `·` is the swap that needs no rewriting and matches what is
already on screen. Where it is punctuating a sentence, the rulebook's answer is
a comma or a full stop.

**Recommendation in one line:** fix 35, keep 3.

---

## Fix — prose a customer reads

### `app/api/estimates/send/route.ts` (2)

| Line | Now | Why |
|---|---|---|
| 202 | ``subject: `Your estimate from ${org} — ${job}` `` | Email subject to a customer. Colon: `from ${org}: ${job}`. |
| 208 | "accept or decline from that page — no account needed." | Sentence in a customer email. Full stop. |

The highest-stakes two on the list: they leave our infrastructure and land in
a stranger's inbox under the client's name.

### `app/api/leads/ingest/route.ts` (4)

| Line | Now | Why |
|---|---|---|
| 236 | `` `New lead — ${name}` `` | Notification title. Colon. |
| 239 | "No email yet — get one when you call back." | Sentence. Full stop. |
| 271 | `` subject: `New ${label} lead — ${name}` `` | Email subject. Colon. |
| 276 | "No email — capture one on the callback" | Sentence fragment in an HTML email. Comma. |

### `app/api/invoices/send/route.ts` (1)

| Line | Now | Why |
|---|---|---|
| 228 | `` `${job.name} — ${invoice.number}` `` | Stripe line-item description. It shows on a card statement and a Stripe receipt, so it is customer-facing. Colon. |

### `app/api/stripe/webhook/route.ts` (1)

| Line | Now | Why |
|---|---|---|
| 155 | `` `Payment failed — ${number}` `` | Notification title. Colon. |

### `lib/spine/db.ts` (2)

| Line | Now | Why |
|---|---|---|
| 1138 | `` `Labor — ${worker_name}` `` | Invoice line description, printed on the invoice a customer pays. Comma. |
| 1269 | `` `${pct}% progress draw — ${job}` `` | Same, on a progress draw. Comma. |

Worth care rather than a sweep: both are defaults that only apply when nobody
typed a description, so changing them changes what new invoices say and
nothing already sent.

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

## Keep

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

1. **The nine that reach a customer** — `estimates/send`, `leads/ingest`,
   `invoices/send`, `stripe/webhook`, and the two invoice descriptions in
   `db.ts`. Highest stakes, smallest count, and each needs the surrounding
   sentence read rather than the dash swapped.
2. **The sixteen in owner-facing prose** — `answers.ts`, `signature.ts`,
   `tutorial.tsx`, `mfa.ts`, `site-requests/approve:165`. Mechanical once
   you accept the comma-or-full-stop rule, but it is the voice, so read them.
3. **The ten labels** — `logos.ts`, `payments.ts`. Genuinely mechanical.

After each, `npm run words:accept` to shrink the baseline, and commit the
baseline with the fix so the two never drift apart.
