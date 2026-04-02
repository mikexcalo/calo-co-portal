# CALO&CO Portal — Development Rules

## Shared Components (MANDATORY)
Always use these from `@/components/shared/PageLayout`:
- `PageLayout` — wraps every full-width page (title, subtitle, action button, children)
- `TwoColumnLayout` — wraps every two-column page (left content, right sidebar)
- `MetricCard` — every summary number card (label, value, color, onClick)
- `SectionLabel` — every section heading (10px uppercase muted)

## Design Tokens
Import from `@/lib/design-tokens.ts`. Never hardcode these values:
- Page bg: #f4f5f7
- Card bg: #ffffff
- Border: 0.5px solid #e5e7eb
- Border radius: 8px
- Text primary: #111827
- Text secondary: #6b7280
- Text muted: #9ca3af
- Primary blue: #2563eb
- Amber (warning/outstanding): #D97706
- Red (critical/overdue): #DC2626
- Green (success/paid): #16a34a

## Page Layout Rules
- Every page wraps content in `<PageLayout>` or `<TwoColumnLayout>`
- Max width: 960px (handled by layout components)
- Padding: 24px 32px (handled by layout components)
- Content aligns left, close to sidebar — never centered
- Page title: 20px, fontWeight 500
- Page subtitle: 13px, #9ca3af

## Component Patterns
- Metric cards: always use `<MetricCard>` component, never hand-build
- Section labels: always use `<SectionLabel>` component
- Tables: CSS Grid (not HTML table elements), header row bg #f9fafb, 10px uppercase labels
- Status pills: 10px, padding 2px 8px, borderRadius 10px. Amber bg for unpaid, green for paid, red for overdue
- Buttons: primary = bg #2563eb, white text, 8px 16px padding, 8px radius, 13px font
- Cards: white bg, 0.5px solid #e5e7eb border, 8px radius
- Icons: SVG stroke only, #6b7280, never emoji

## Color Rules
Colors have meaning — never decorative:
- Red = overdue / critical
- Amber = needs attention / outstanding
- Green = complete / paid / healthy
- Blue = primary actions / informational
- Gray = neutral / structural

## Git Rules
Always end with: git add -A && git commit -m "[message]" && git push origin main && git push origin master
Never use --force.

## File Locations
- Shared components: components/shared/PageLayout.tsx
- Design tokens: lib/design-tokens.ts
- Sidebar: components/Sidebar.tsx
- Top bar: components/TopBar.tsx
- Global layout: app/layout.tsx
- Brand Builder templates: components/brand-builder/templates/
