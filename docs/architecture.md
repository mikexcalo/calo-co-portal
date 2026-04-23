# Helm — Architecture & Mental Model
**Version:** 1.0
**Last updated:** April 2026
**Owner:** Mike / CALO&CO

---

## Purpose of this doc

This is the single source of truth for how Helm is structured, why it's structured that way, and how new modules should be designed to fit. Every future brief — Helm platform work, CALO&CO website work, future client sites — references this doc.

If a design decision conflicts with this doc, we either update the doc or rethink the decision. No exceptions.

---

## 1. What Helm is (and isn't)

**Helm is a modular suite with a shared spine.**

- **Not a monolith** — modules are distinct, each does one job well
- **Not a product family (Atlassian-style)** — users never re-authenticate, re-learn UI, or re-configure between modules
- **Not two products wearing one skin** — agency-facing and field-facing are user *modes*, not separate apps

Reference points in the same family: Notion, HubSpot, Linear, Basecamp. Shared auth, shared data primitives, distinct modules.

---

## 2. The three-layer model

```
┌─────────────────────────────────────────┐
│            HELM SHELL                   │
│   sidebar · auth · routing · theme      │
└────────────────┬────────────────────────┘
                 │
    ┌────────────┼────────────┐
    │            │            │
┌───▼───┐    ┌───▼───┐    ┌───▼────┐
│AGENCY │    │ FIELD │    │ PUBLIC │
│ MODE  │    │ MODE  │    │ SITES  │
└───┬───┘    └───┬───┘    └───┬────┘
    │            │            │
    └────────────┼────────────┘
                 │
    ┌────────────▼────────────┐
    │    SHARED SPINE         │
    │  brand record · client  │
    │  record · auth · events │
    └─────────────────────────┘
```

### Shell
The persistent UI chrome. Sidebar, top bar, routing, auth state, theme tokens. Rarely changes. Owned entirely by Helm.

### Modes
Not separate apps — user contexts. The same codebase renders different views based on who's logged in:

- **Agency Mode** — Mike running CALO&CO. Sees all clients, design tools, website deployer, brand kit editor.
- **Field Mode** — A client (LG Flooring, Mammoth) running their business. Sees only their data: invoices, quotes, P&L, leads.
- **Public Sites** — The marketing websites themselves. Read-only consumers of the shared spine per client.

### Shared Spine
The data and infrastructure every module reads from and writes to. If two modules need the same information, it lives in the spine. If it's module-specific, it lives in the module.

---

## 3. Modules, by mode

### Agency Mode (Mike's operator view)
- **Dashboard** — all clients at a glance
- **Clients** — workspace management, onboarding new clients
- **Brand Kit Editor** — edit any client's brand record
- **Design Studio** — template builder (yard signs, business cards, etc.)
- **Website Deployer** *(Tier 3b)* — spin up and monitor client sites
- **Financials (aggregate)** — across all clients

### Field Mode (client's operator view)
- **Dashboard** — their business at a glance
- **Quotes** — create, send, track
- **Invoices** — create, send, mark paid
- **P&L** — simple four-number view (invoiced, paid, outstanding, by month)
- **Brand Kit (viewer)** — see their brand assets, download files
- **Leads** — from their website, Wix forms, manual entry

### Public Sites (external consumers)
- Marketing websites per client
- Read brand record at build time (theming)
- Write to leads/quote_requests tables (form submissions)
- Never authenticate, never edit — pure read/write via scoped APIs

---

## 4. Shared Spine — the foundational tables

Everything downstream depends on these being right. Change them carefully.

### `clients`
The root record. Everything else keys off `client_id`.
```
id, name, slug, created_at, status, tier, primary_contact
```

### `brand_record`
One per client. The single source of truth for brand identity. Consumed by Brand Kit UI, Design Studio, invoice/quote templates, email signatures, and public websites.

See Section 5 below for full schema.

### `users` + `memberships`
Auth layer. A user can be an operator (Mike) with access to all clients, or a client user with access to only their own `client_id`. Role-gated views in the shell.

### `events` *(future)*
Event bus for module communication. When a lead comes in, an event fires. When an invoice is marked paid, an event fires. Modules subscribe. Not urgent, but design with this in mind.

---

## 5. Brand Record schema

**This is the most important schema in Helm.** Get it right once, every downstream module inherits correctly. Get it wrong, every downstream module inherits the mess.

Fields are grouped by purpose. Every field is optional unless marked required — Helm should render gracefully with partial data.

### Identity
- `company_name` *(required)*
- `tagline`
- `mission`
- `tone_of_voice` — enum: professional, friendly, bold, warm, authoritative, playful
- `tone_keywords` — array, for copy generation ("confident, warm, architectural")

### Visual — logos
- `logo_primary` — full-color primary logo (SVG preferred)
- `logo_secondary` — alternate (mono, reversed, simplified)
- `logo_mark` — icon/symbol only (for favicons, avatars)
- `favicon`

### Visual — color
- `color_primary` *(required)* — hex
- `color_secondary` — hex
- `color_accent` — hex
- `color_neutral_palette` — array of 3–5 neutral hex values
- `color_usage_rules` — free-text guidance

### Visual — typography
- `font_display` — display/heading font (Google Fonts name or custom URL)
- `font_body` — body font
- `font_mono` — monospace (optional, for code/data)
- `font_fallbacks` — system fallback stack

### Visual — imagery
- `photography_style` — free-text or enum: documentary, editorial, product, illustration, mixed
- `illustration_style` — free-text
- `icon_style` — enum: outline, filled, duotone, custom

### Applied templates
- `email_signature_template` — HTML/string with variable substitution
- `quote_template_id` — references design template
- `invoice_template_id` — references design template
- `business_card_template_id`
- `yard_sign_template_id`

### Web-ready fields *(feeds public sites)*
- `domain` — primary domain
- `meta_description` — SEO default
- `meta_keywords` — array
- `og_image` — social share default
- `primary_cta_text` — e.g., "Get a quote"
- `primary_cta_link` — e.g., "/contact"
- `social_links` — object with platform → url

### Asset library
- `assets` — array of files with: url, type, tags, filename, uploaded_at

---

## 6. Module design rules

Every new module must answer these questions before implementation:

1. **What mode does it live in?** Agency, Field, Public, or multiple with role-gated views?
2. **Does it read from the Brand Record?** If yes, which fields?
3. **Does it write to the Brand Record?** If yes, it must go through the Brand Kit Editor UI — no other module writes to brand data.
4. **Does it create its own tables?** If so, they must `foreign key → client_id` and respect the same auth boundaries.
5. **What does it do when data is missing?** Graceful degradation is required. No white screens when a field is null.

### Upstream/downstream dependency rule

```
Brand Record (most upstream)
     ↓
Brand Kit Editor ← reads/writes
     ↓
Design Studio           ← reads only
Invoice template        ← reads only
Quote template          ← reads only
Email signature         ← reads only
Public website theme    ← reads only
```

**Only one module writes to the Brand Record: the Brand Kit Editor.**
If another module needs to change brand data, it routes the user to Brand Kit.

---

## 7. Priority stack (Q2 2026)

Ship top-down. Don't cross tiers until the one above is stable.

### Tier 0 — Stable, don't touch
Sidebar, auth, routing, client switching, Brand component library, visual identity.

### Tier 1 — Field revenue spine *(ship first)*
Everything a client needs to send an invoice and get paid.
- Invoice module (finish Mammoth Path B)
- Quote Generator (moved from Identity layer)
- Payment confirmation flow (Resend email, mark-paid, receipt)
- Per-client P&L (invoiced, paid, outstanding, by month)

**Done when:** Mammoth completes quote → invoice → paid → P&L updated, entirely in Helm.

### Tier 2 — Agency spine + Brand Kit restructure
What Mike needs to run CALO&CO through Helm.
- Brand Record schema implementation (this doc, Section 5)
- Brand Kit Editor UI rebuild against the schema
- Clean new-client onboarding flow
- Website module stub (placeholder tab, fill in Tier 3b)

**Done when:** new client onboarding takes <10 minutes and spins up a complete workspace.

### Tier 3a — CALO&CO marketing site *(standalone, not integrated)*
Ship the CALO&CO marketing site as its own Next.js project. No Helm integration required. This is R&D for the future website module, built by dogfooding.

**Done when:** calo-co.com is live, on-brand, capturing leads somewhere (even just email).

### Tier 3b — Helm Website Module *(after 2nd client site demand)*
Extract patterns from 3a into a reusable template. Build the Helm-side "Website" tab that ties sites to clients. Wire lead ingestion from public sites into Helm.

**Done when:** a new client site can be spun up in <15 minutes from the template, pointed at their brand record.

### Tier 4 — Parked (not Q2)
Square POS, AI receptionist, local SEO / Nextdoor / GBP, outbound email/SMS, scheduling, review management, team management.

---

## 8. Two user types, one codebase

The single most important implementation principle:

> Every UI surface must answer: *what does the operator (Mike) see here? what does the client see here?*

If a module doesn't have a clear answer for both, it's not designed yet.

Role-gated rendering examples:
- Agency Dashboard shows all clients. Field Dashboard shows only the logged-in client's data.
- Agency Brand Kit can edit any client. Field Brand Kit is view-only for the logged-in client.
- Agency Invoices shows aggregate across clients. Field Invoices shows only the client's own.

One codebase. One database. One auth. Two views.

---

## 9. Relationship to the public website

The CALO&CO marketing site *and* client marketing sites are **Public Sites** in the architecture. They:

- Live in separate Next.js repos (one per client, for now)
- Are deployed on separate Vercel projects
- Read from the shared spine (brand record) of their client
- Write to the shared spine (leads, quote_requests)
- Never render Helm's UI shell
- Never authenticate end users

CALO&CO's own site is the first Public Site. Client sites come later, use the same pattern, read from their own client's brand record.

Wix / Squarespace / external sites still integrate, but as API bridges:
- Form submissions POST to `/api/leads/ingest` on Helm
- No shared database access
- Helm is the CRM layer, not the frontend

---

## 10. Change log

- **v1.0 (Apr 2026)** — Initial draft. Establishes suite model, three-layer architecture, Brand Record schema v1, Q2 priority stack.

---

## 11. How to use this doc

- **Before writing a new brief:** skim Sections 2, 3, 6. Make sure the work fits the model.
- **Before adding a Brand Record field:** check Section 5. Only add if the field serves multiple consumers or is web-ready.
- **Before changing priorities:** update Section 7 and note it in the change log.
- **When onboarding someone (including future Claude instances):** read start to finish. ~10 minutes.
