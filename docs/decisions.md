# Decisions we might want to reverse

Things that were argued out rather than defaulted into, with the options that
lost and what would make them win. Written so a later change is a decision
rather than an archaeology exercise.

Last updated: 2026-08-31

---

## Where brands live

**Now:** a brand is its own record, owned by the agency, pointing at the client
it belongs to. It surfaces as a section on the client record. `/brands` still
exists and still works, but it is not in the sidebar.

**Why.** Every brand belongs to a client. There is no brand you hold for
nobody, so the door belongs where you already are when you want it: on the
client. A sidebar row implies a separate workflow, and there isn't one. Nobody
wakes up thinking "let me look at brands" — they think "what's the state of
Colette".

At two brands, a wall view of all of them is a page you visit once.

### Option A — promote `/brands` back to the sidebar

**What would make it right:** roughly ten clients, or any client with more than
two brands.

The value of a wall view is cross-brand pattern spotting: three clients sharing
a typeface, four blocked on the same kind of permission, a palette that keeps
recurring. Those observations are impossible from inside one client record and
genuinely useful once the portfolio is big enough to have patterns.

**Cost to do it:** one line in `lib/spine/modules.ts`. The page is already
built and already correct. Nothing about the data model changes.

### Option B — a tab on the client record

Considered and rejected, but only just.

A tab is invisible until you are already on the page holding it, which is the
exact fault that made the seven-row navigation unusable in August. A visible
section costs a little vertical space and never hides.

**What would make it right:** the client record getting long enough that
sections stop being scannable. If that happens, tabs across the top of the
client record — Overview, Brand, History, Money — beat scrolling.

### Option C — back onto `orgs.settings.brand`

**Do not.** This is what caused the original problem.

One brand field per org assumes a business has exactly one identity: its own.
An agency holds its own plus one per client. Colette's palette on the CALO&CO
org would overwrite CALO&CO's own, and giving every client a workspace means
provisioning logins for people who never asked for one.

It also breaks the moment a client has two brands, which a parent company with
sub-brands always could in reality.

---

## What is deliberately not shown on a brand

Two sections were built, shipped, and removed at Mike's request:

- **Launch blockers** — unlicensed fonts, uncleared photography, logos used
  without written permission.
- **Voice rules** — the never-use and always lists, rhythm and structure rules.

**The data is still on the record** in `brands.open_items` and
`brands.kit.voice`. Only the display went, so bringing either back is a render
change and not a re-ingest.

**If voice comes back it needs better parsing.** The chips were built by
splitting the rules on commas, which cut `data on its own (name the thing:
last night's pmix, food cost)` into two fragments with stray quotation marks.
It needs something that understands the sentence.

---

## Card payments and whose account they land in

**Now:** one platform Stripe key, and card payment is offered only to the
business named in `STRIPE_OWNER_ORG`, defaulting to `calo-co`. Guarded in the
setup screen, the send route and the customer-facing pay page.

**Why the guard exists:** money paid through that key lands in the account it
belongs to. Without the guard, Mammoth ticking "card" would send their
customers' payments to CALO&CO — the money arriving in the wrong bank account,
and the first person to notice being a contractor asking where his payment
went.

**The real fix is Stripe Connect.** Each business links their own account and
their customers pay them directly, with an optional platform fee. Required
before any client takes card payments. Until then the guard is what makes it
safe to ship.

---

## The authenticator name is baked in at enrolment

`AUTH_ISSUER` in `lib/brand.ts` is deliberately separate from `PRODUCT`.

The string is written into the QR code when somebody sets up two-factor.
Changing it renames nothing for anyone already enrolled — they keep seeing the
old label until they turn two-factor off and set it up again.

So it moves on a considered decision, not as a side effect of editing a
heading. Any rename needs to tell existing users why their authenticator still
says the old thing.
