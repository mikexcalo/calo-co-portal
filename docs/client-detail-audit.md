# Client Detail Audit

**File:** `app/clients/[id]/page.tsx`
**Date:** 2026-05-05

## Sections inventory

### 1. Edit Client Form (full-page takeover)
- **Component:** Inline in `app/clients/[id]/page.tsx` (lines 237-277)
- **Data:** `clients` table (read + upsert via `saveClient`), `contacts` table (read + upsert via `saveContact`)
- **Current style:** Full-page takeover — replaces entire page content when `isEditOpen === true`. 2-column grid form with hardcoded inline styles. Includes company, code, name fields, contact fields, address fields, state dropdown.
- **Matches new CRM style:** NO
- **Notes:** This is the oldest UI pattern on the page. Uses raw inline styles, not Brand.tsx components. No cancel-without-losing-data protection. The form conflates client fields and primary contact fields into one form — architecturally questionable now that contacts are a separate entity. The `contacts` dropdown in the header (section 3) uses the legacy `Contact` type from `DB.contacts`, while the contacts panel (section 8) uses the new `CrmContact` type from `loadClientContacts`. These are two separate data paths for the same underlying table.

### 2. Client Info Bar (header)
- **Component:** `<InfoBar>` from `components/shared/PageLayout.tsx`
- **Data:** `clients` table (client name, logo), computed `missing` array for profile completeness
- **Current style:** Horizontal bar with avatar/initial, company name, profile completeness indicator, legacy contacts dropdown button, "Edit Client" button. Uses `InfoBar` shared component.
- **Matches new CRM style:** PARTIAL
- **Notes:** The `InfoBar` wrapper matches the new style, but the contents are mixed. The "Contacts" dropdown button (section 3) is a legacy pattern that duplicates the ContactsList panel (section 8). The profile completeness check references brand kit logos/colors — still valid but could be simplified.

### 3. Legacy Contacts Dropdown (in header)
- **Component:** Inline in `app/clients/[id]/page.tsx` (lines 299-330)
- **Data:** `DB.contacts[clientId]` — legacy `Contact` type loaded via `loadContacts()`
- **Current style:** Button with chevron in the InfoBar. Click opens an absolute-positioned dropdown showing name/title/email/phone for each contact. Uses legacy `Contact` type (not `CrmContact`).
- **Matches new CRM style:** NO
- **Notes:** This is redundant with the ContactsList panel (section 8) which uses the newer `CrmContact` type and `loadClientContacts()`. The dropdown reads from `DB.contacts` (legacy cache), while the panel reads from `loadClientContacts` (new CRM query). Should be removed — the ContactsList panel in the right rail is the canonical contacts UI now.

### 4. Transcript Parser
- **Component:** `<TranscriptParser>` from `components/shared/TranscriptParser.tsx`
- **Data:** Calls `/api/parse-transcript`, then creates events/tasks via `createClientEvent`/`createClientTask`
- **Current style:** Button that expands to textarea + parse + review panel. New CRM style.
- **Matches new CRM style:** YES
- **Notes:** Clean. No changes needed.

### 5. Events Section
- **Component:** `<EventsList>` from `components/shared/EventsList.tsx`, `<AddEventInline>` from `components/shared/AddEventInline.tsx`
- **Data:** `events` table via `loadClientEvents(clientId)`
- **Current style:** Panel with header + list + inline add form. Purple date tiles. Hover delete.
- **Matches new CRM style:** YES
- **Notes:** Clean. No changes needed.

### 6. Tasks Section ("Next actions")
- **Component:** `<TasksList>` from `components/shared/TasksList.tsx`, `<AddTaskInline>` from `components/shared/AddTaskInline.tsx`
- **Data:** `tasks` table via `loadClientTasks(clientId)`, effective due dates computed from `events`
- **Current style:** Panel with header + checkbox list + event chips + inline add form. Hover delete.
- **Matches new CRM style:** YES
- **Notes:** Clean. No changes needed.

### 7. Activity Section (notes composer + timeline)
- **Component:** `<Composer>` from `components/shared/Composer.tsx`, `<ActivityTimeline>` from `components/shared/ActivityTimeline.tsx`
- **Data:** `notes` table via `loadClientNotes(clientId)`, `createClientNote`, `deleteNote`
- **Current style:** Composer textarea with Save button, vertical timeline with relative timestamps, hover delete.
- **Matches new CRM style:** YES
- **Notes:** Clean. This IS the new CRM style — it defined it. No changes needed.

### 8. Contacts Panel (right rail)
- **Component:** `<ContactsList>` from `components/shared/ContactsList.tsx`, `<AddContactInline>` from `components/shared/AddContactInline.tsx`
- **Data:** `contacts` table via `loadClientContacts(clientId)` (new `CrmContact` type)
- **Current style:** Compact panel with initials avatars, name/role, primary/billing flags, inline add form.
- **Matches new CRM style:** YES
- **Notes:** Clean. No changes needed.

### 9. Quick Links Grid (right rail)
- **Component:** `<CardGrid>` + `<Card>` from `components/shared/PageLayout.tsx`
- **Data:** Computed metadata strings (brand kit status, invoice counts, financials summary)
- **Current style:** 2-column grid of cards with SVG icons, title, subtitle. Each links to a sub-route (design, brand-kit, invoices, financials).
- **Matches new CRM style:** PARTIAL
- **Notes:** Uses shared `CardGrid`/`Card` components which are clean. The computed metadata (bkMeta, invMeta, finMeta) is verbose inline code that could be extracted. The `sigMeta` and `sigHasData` computations (email signature) are computed but never rendered — dead code from a removed section.

## Recommended restyle batches

### Batch 1: "Header cleanup" (small)
- **Sections:** 2 (Info Bar), 3 (Legacy Contacts Dropdown)
- **Work:**
  - Remove the legacy "Contacts" dropdown button from the InfoBar (lines 299-330). The ContactsList panel in the right rail (section 8) is the canonical contacts UI.
  - Remove the `contacts` state (legacy `Contact[]` type) and the `loadContacts(clientId)` call — redundant with `crmContacts` state and `loadClientContacts`.
  - Remove the `contactsOpen` state.
  - Clean up dead `sigMeta`/`sigHasData` computations that aren't rendered.
- **Complexity:** Small

### Batch 2: "Edit form extraction" (medium)
- **Sections:** 1 (Edit Client Form)
- **Work:**
  - Extract the full-page edit form into a standalone component (e.g. `components/shared/EditClientForm.tsx`)
  - Split client fields (company, code, address, website) from contact fields (name, title, email, phone) — these are now separate entities
  - Use Brand.tsx input patterns instead of raw inline styles
  - Consider converting to an inline panel (like AddContactInline) rather than full-page takeover
  - Remove the form's contact-saving logic — editing a contact should happen via the ContactsList panel or a future inline edit on ContactsList rows
- **Complexity:** Medium

### Batch 3: "Quick links modernization" (small)
- **Sections:** 9 (Quick Links Grid)
- **Work:**
  - Remove dead `sigMeta`/`sigHasData`/`finScopeExp` computations
  - Consider whether Quick Links still earns its real estate now that Events/Tasks/Activity fill the left column — it may be more useful as a compact row of icon buttons rather than a 2x2 card grid
- **Complexity:** Small

## Sections to leave alone

- **Section 4 (Transcript Parser)** — new, clean, no changes needed
- **Section 5 (Events)** — new, clean, no changes needed
- **Section 6 (Tasks)** — new, clean, no changes needed
- **Section 7 (Activity)** — new, clean, defines the target style
- **Section 8 (Contacts Panel)** — new, clean, no changes needed
