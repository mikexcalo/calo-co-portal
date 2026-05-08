# CALO&CO

**Operating thesis.**

---

## What we are

CALO&CO is a boutique growth and design studio for small businesses. We help operators figure out what they need to grow — and then we build, run, and execute it. The work spans whatever the business actually needs: brand, website, GTM strategy, direct mail, lead generation, content, positioning, sales enablement, ops. We're consultants where strategy is the gap, and operators where execution is the gap. Most engagements are both.

The agency is the brand. Nautilus is the platform we built to deliver the work at scale. Some Nautilus modules are internal-only. Some are client-facing. The strongest ones eventually become standalone products.

## The three rings

**Ring 1 — Internal.** Nautilus modules only Mike touches. Design Studio, Brand Builder canvas, rapid-site-deploy, AI brief generation, internal CRM. The leverage layer. One operator shipping at the speed of twenty.

**Ring 2 — Client-facing.** Modules every CALO&CO client logs into through a branded portal at their own subdomain. Brand Kit, Quote → Invoice → P&L, Lead inbox, Asset library. The portal is the retention — months of financial data plus their full brand system inside Nautilus and the relationship compounds.

**Ring 3 — Productized.** Modules battle-tested through real Ring 2 use, eventually packaged as standalone SKUs. Strongest candidates: Quote → Invoice → P&L, Brand Kit, Quote Generator. Preserved options created automatically by building Ring 2 well.

Each ring funds and de-risks the next. The agency earns the right to ship product by being the agency first.

## Build philosophy

Nautilus is AI-native by default. Generation, extraction, summarization, and reasoning are first-class operations across every module — not features bolted on. This is what makes a one-operator studio capable of agency-of-twenty output, and what makes the eventual standalone products defensible.

## The module map

The actual roadmap. Build order is set by Ring 2 readiness, not feature appeal — we ship what the next active CALO&CO client needs.

| Module | Purpose | Ring | Status |
|---|---|---|---|
| Branded site builder | Ship client websites in days | 1 → 2 | Internal pipeline working, client-facing Q3 |
| Brand Kit | Logos, colors, typography, downloads | 2 | Mostly built, needs permission layer |
| CRM + Lifecycle | Lead → client → retention tracking | 1 → 2 | Wave 1.5 shipped, AI Ingest Hub next |
| Quote → Invoice → P&L | Financial OS for service businesses | 2 → 3 | Mammoth Path B next milestone |
| Lead inbox + capture | Site forms land in Nautilus | 1 → 2 | Wires up after site port |
| Strategy briefs | GTM plans, positioning docs, campaign briefs | 2 | Q3 |
| Direct mail + campaigns | Postcard generation, list mgmt, send | 2 | Q3 |
| Email/SMS automation | Lifecycle sequences | 2 | Q3 |
| Reviews + reputation | Inbound review workflows | 2 | Q4 |
| Asset library | Photo, video, social templates | 2 | Q4 |

Mammoth defines the Q2 module set. LG and Stevie's expand it.

## Architecture

Internal routes (`/design`, `/brand-kit` admin, `/clients`) stay as Mike's view. Client routes scope to one client at `nautilus.calo-co.com/c/[slug]` or a subdomain. Auth splits — admin sees everything, clients see only their workspace, no Nautilus branding visible. Module flags per client become a pricing lever.

Most of Nautilus is already pointed where this strategy needs it — the work is naming and finishing.

## Marketing site

CALO&CO leads. Nautilus is invisible to prospects — selling the platform dilutes the offer. Sell the outcome: figure out what your business needs to grow, and we build it. The portal shows up as a benefit on How We Work and inside case studies. Section 004 Who We Serve doubles as the productization roadmap: trades → P&L tool → eventual "books for trades" SKU. Studios → Brand Kit → eventual "brand hub for creatives" SKU. Agency work is product R&D.

## The plan

**This week.** Port v139 → Next.js with new framing. Inventory → repo + Vercel pipeline → section-by-section port.

**Next week.** Backend doubles up. Scaffold client-facing layer — `portal_enabled` flag, `/c/[slug]` route, simple auth. Lead capture wires site → Nautilus. Brand Kit becomes first proof module.

**Week after.** Mammoth onboards as first portal client (Path B beta).

**Month 2–3.** Quote → Invoice → P&L hardens through Mammoth + LG. Productizable SKU plus three case studies on the other side. Decide whether to package.

## Frame

Agency-funded. AI-native. Built for the operators big platforms ignore. Optionality on SaaS without depending on it.

A studio with a system — and the system is a product in waiting.
