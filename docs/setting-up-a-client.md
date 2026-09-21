# Setting up a client from scratch

Written from doing it for Global Seafood Partners on 21 September 2026, while
it was still fresh. Every step here is something that actually had to be done,
in the order it had to be done in, with the thing that went wrong beside it.

The point of writing it down is that it should not stay a document. Steps 2
to 5 are all SQL today and all of them are a form waiting to be built — see
"What this should become" at the bottom.

---

## 0. Before anything: do they already exist?

A client may already be a `customers` row in CALO&CO without having a
workspace. Those are different things:

| | |
|---|---|
| `customers` row | what **you** know about them |
| `orgs` row | where **they** sign in |
| `customers.linked_org_id` | the join between the two |

Check first, or you end up with two records for one business.

---

## 1. Their workspace

An `orgs` row. `kind` decides the vocabulary they read for the life of the
account:

- `contractor` → Customers, Jobs
- `agency` → Clients, Engagements

Global Seafood was created as `agency` and read "Clients / Engagements" for a
week before anybody noticed. A distributor is a contractor. **Get this right
on day one** — changing it later changes every noun they have learned.

---

## 2. What they can see

`orgs.modules`, a JSON map of module → state. Explicit `live` and `off` beats
leaving it to the plan, because the plan is a guess about a category and this
is a decision about a business.

For John, a seafood distributor, fifteen on and sixteen off:

```
CRM        customers, people, jobs
Content    inbox, records
Money      billing, proposals, pl, receipts, expenses, pricing
Account    business, security, learn
```

**Jobs stays on even for a business that does not do "jobs".** Invoices are
built from hours and receipts logged against one, so switching it off leaves
the money modules with nothing to bill from — simple-looking and broken.

---

## 3. Empty it

A workspace reused from an earlier attempt carries old rows. Do not chase
tables by hand; walk every table with an `org_id` and clear that org's rows,
keeping only the workspace and its memberships. Five passes, because a child
row blocks its parent and the order is not worth maintaining.

The first attempt at this only cleared `customers` and `customer_contacts`,
and a contact called Luis was still standing there when the client opened it.

---

## 4. Give the owner a login

People → their record → **Give them a login** → pick the business → "Can run
the business".

They get an email from calo.company with a set-password link, and **the link
is shown on screen with a copy button** so it can be texted if the email is
slow. It is a one-time recovery link: they land on `/welcome`, set a password
as the second step, and answer their name, their role, and the business name.

The money questions — how you charge, how you get paid — both take
"I'll do this later". Somebody three minutes in does not know their rate, and
making them invent one is how a wrong number reaches an invoice.

---

## 5. Tell them what to do next

Client record → **Ask them for something**. It lands in their notification
tray and at the top of their home screen and stays until they press Done.

One task at a time. The first draft of John's domain note also explained
email hosting; it was cut because two decisions in one message is how neither
gets made.

What John got, in order:

1. **Turn the price lists you dropped into real prices** — he had pasted two
   supplier sheets into Drops expecting them to populate something. They do
   not; Drops holds, and "Read it" turns one into records.
2. **Buy your domain name** — Cloudflare Registrar, about $10/year, he owns
   it. Two nameservers to paste: `ns1.vercel-dns.com`, `ns2.vercel-dns.com`.
   Email deliberately left out of this one; it is a separate purchase and a
   later conversation.

---

## What went wrong, so it does not again

- **Two Vercel projects building one repo.** Seven builds queued on a single
  slot and nothing reached production for hours. One project per repo.
- **`prebuild` running a check.** It killed every deploy silently. A guard
  that can stop a release has to be one you can watch fail.
- **Read state shared across a workspace.** The agency looking in and pressing
  Done cleared the client's task off their own screen.
- **Placeholder text naming real people.** A real customer's name and their
  bathroom remodel were the example text in the new-job form.

---

## What this should become

Steps 1 to 5 are one screen: **Set up a client**.

Name, kind, a module preset per trade, invite the owner, and a checklist of
starting tasks that get sent as asks. Everything above is currently SQL
pasted into a dashboard, which works exactly once per person who knows to do
it.

The presets are the valuable part. "Landscaping", "Distribution", "General
contractor" — each a module set and a starting task list, learned from a real
client rather than imagined. This file is the first one.
