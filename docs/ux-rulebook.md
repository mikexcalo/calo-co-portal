# The UX rulebook

One way to do each thing.

Cowork's audit of 24 Sept 2026 counted, among other things, sixteen kinds of
button, eighteen kinds of card, nine kinds of table, three kinds of tab and
seven kinds of empty state. None of that was decided; it accumulated, a screen
at a time, because there was no written answer to "how do we do this here" and
every brief had to invent one.

This is that answer. Where the codebase does a thing several ways, one way is
picked here and the others are named as **replaces** so they can be found and
removed. Where the product has been rebuilt recently — the strip and plate,
View mode, Work in it, the phone shell — the new thing is the rule, because it
is the most considered version and the one the designs were approved against.

Every value below is the value in the code today, not an aspiration. If a
number here and a number in `lib/spine/tokens.ts` disagree, the token wins and
this file is wrong; fix it.

**Read this before changing any screen.** The backlog of what currently breaks
it is `docs/consistency-backlog.md`.

---

## 1. The shell

Four things say where you are, top to bottom. They are not decoration and
nothing else may occupy their positions.

### The product row
16×16 mark and the product's name, above the workspace plate. Figtree, 13px,
600, `C.quiet` (#6B7280) — deliberately lighter than `C.faint`, and the only
place that is true, because the row names the software and the plate under it
names the business whose money is on screen. Not clickable. Never on a public
page. Both the mark and the name come from `lib/brand.ts`, so naming the
product is one edit.

### The workspace plate
Initials square, business name, kind, and the demo badge where it applies.
Tapping it opens the switcher, which is a sheet from the bottom on a phone.
This is the only thing that answers "whose workspace is this", so it is on
every width including phone.

**Replaces:** the truncated grey chip in the top bar, and the phone header that
said only the product name.

### The identity strip
A 4px band in the workspace's colour, directly under the plate, from
`workspace-color.ts`. The studio has its own colour and every client has
theirs. You should never have to read a word to know which workspace you are
in.

### The two modes
Only two saturated colours exist in this product and both are here.

| | Colour | Height | Means |
|---|---|---|---|
| View mode | `C.viewing` #1B4DE4 | `VIEW_BAR` 48 / `VIEW_BAR_PHONE` 92 | Looking. Every write refused. They are not told. |
| Work in it | `C.working` #B4470E | `WORK_BAR` 48 / `WORK_BAR_PHONE` 92 | Editing with consent. Every change recorded. Sending locked unless they allowed it. |

Both draw a bar fixed to the top and a frame of the same colour around the
whole workspace, at every width. The two must not be tellable apart by reading
— blue and burnt orange at a glance, an eye and a pencil, different sentences.

If either colour appears on a button, the button is wrong.

**Replaces:** the "What they see" preview whose banner admitted it proved
nothing and whose sidebar was identical to the owner's.

### Phone tabs and the + sheet
Under 720px the drawer stops being the main navigation. A bottom bar carries at
most four tabs plus a raised capture button; the drawer stays under **More**.

Tabs come from `modulesFor(org)` and the workspace's own vocabulary — never a
list written into the bar. A module that is off has no tab. A service business
gets Today / Jobs / Money / More; a studio gets Today / Clients / Money / More;
both because the data says so.

The + opens Capture: four tiles, each routed into a flow that already exists.
A phone shortcut that writes its own version of a record is how two halves of
one product start disagreeing about what an hour is.

**Replaces:** the ☰ drawer as primary navigation, and the old Add sheet.

---

## 2. Type

Three faces, each with one job. Loaded in `app/layout.tsx`.

| Face | Variable | Used for |
|---|---|---|
| Figtree | `--font-display` | Anything that titles something |
| Inter | `--font-sans` | Body, tables, labels, everything else |
| Geist Mono | `--font-mono` | Figures in columns, reference codes |

Headings run through `Page` or `SectionLabel`, so the face is set in two places
and never typed into a screen.

Sizes in use:

| Thing | Size | Weight | Colour |
|---|---|---|---|
| Page title (`Page` h1) | 23 desktop / 20 phone | 600, -0.021em | `C.text` |
| Page subtitle | 14 | 400 | `C.faint` |
| Section label | 11, uppercase, 0.08em | 600 | `C.faint` |
| Body | 14 | 400 | `C.text` |
| Secondary body | 13.5 | 400 | `C.dim` |
| Table cell | 13.5 | 400 | `C.text` |
| Small print | 12.5 | 400 | `C.faint` |
| Button | 13.5 (17 on `size="thumb"`) | 500 (600 thumb) | per variant |

A subtitle is a label. It says what the screen is, not how it works, and it
carries no aphorism.

---

## 3. Colour

There is no brand accent. This product holds other people's brands, so colour
means one of two things and nothing else.

**State.** Green `#008738` settled. Amber `#B26200` needs you. Red `#E01B1B`
wrong or overdue. Each is the most saturated value in its hue that still clears
4.5:1 on white. Red is for overdue and error only — a number that is merely
large is not red.

**The client.** Their logo, their swatches, their photographs. The only
decorative colour in the product is what somebody put into it.

Interactive weight comes from prominence, not hue: body copy grey, actions
near-black `C.accent` #141414 at 15.9:1.

**Never write a hex into a screen.** Import from `C`.

---

## 4. Components

One of each. Exact values. All from `components/spine/ui.tsx` unless stated.

### Buttons
Two, and a third only on a phone.

```
<Button>                 primary   fill C.accent, white text, 6px 15px, radius 999, 13.5/500
<Button variant="ghost"> secondary transparent, 1px C.border, C.dim text, same metrics
<Button size="thumb">    phone     full width, minHeight 56, 17px/600
```

`variant="danger"` exists for destructive text and is the only other one.

**Replaces:** the sixteen button kinds in the audit's inventory — the black
"Cancel" that was a primary because it toggled a form, the four disabled
treatments, tiny ghost boxes, bare `×` row-deletes, and the top-bar icon pills
drawn per screen. A destructive action is `variant="danger"` with a word on it,
never a bare glyph.

### Cards
`<Card>` — `C.panel`, 1px `C.border`, radius 10, padding 18. One card.

**Replaces:** the eighteen card variants. A stat tile is `Tiles`; a status card
is a `Card` with a `Pill` and a `Button`; a banner is a `Card` with a tone.

### Tables
`<Table>` with `<Row cols="…">`. Radius 10, 1px `C.border`, header row in
`C.panelAlt` with caps labels.

On a phone a table does not crop. Either it scrolls inside its own
`overflow-x: auto` container with a visible edge, or it stacks — never columns
falling off the right with no hint.

### Forms
`<Field label>` + `inputStyle`: `C.panelAlt` fill, 1px `C.border`, radius 7,
9px 11px, 14px. Label above, always visible, 12.5/500 `C.dim`.

Dropdowns are `<Select>`. Overlays are `<Sheet>`. Tab strips are `<Tabs>`.
A hand-written one of any of these is a bug, not a style choice.

**Replaces:** placeholder-only labels, white outlined inputs on public pages,
and the three tab styles.

### Status pills
`<Pill tone>` — 11.5/600, 3px 9px, radius 20.

| Tone | Background | Text | Means |
|---|---|---|---|
| neutral | `C.panelAlt` | `C.dim` | a count, a state with no urgency |
| green | `C.greenSoft` | `C.green` | settled, paid, done |
| amber | `C.amberSoft` | `C.amber` | needs you |
| red | `C.redSoft` | `C.red` | overdue, failed |

`blue` is an alias of neutral and is not a colour.

### Section labels
`<SectionLabel>`. A heading with nothing under it is a bug — either render the
empty state or drop the heading.

### Empty states
Two shapes, no more.

**Compact** — one line inside the container, naming the next step:
"No steps yet. Add the ones that have dates and the rest can wait."

**Rich** — `<Empty hero>` for a screen that is empty because nothing exists
yet: a sentence, then one action.

Every empty state names the next step or it is only a statement of fact.

**Replaces:** the seven variants, including bare grey text under a heading and
the heading with nothing under it at all.

### Loading states
Never a bare "Loading…", and never a zero that will change. A tile reading
"$0 · Nothing overdue" while the real figure loads is a false reassurance in
the one place it costs money.

Show the shell with the shape of what is coming. Where a number is not known
yet, show nothing in its place, not a nought.

---

## 4b. Public pages

A proposal, an invoice, a pitch, an enquiry form and the sign-in page are not
screens in our product. They are documents from the client's business, opened
by somebody who has never heard of us and is not going to. So the rule is
narrower than "use the design system".

**They may take the parts that are craft, not identity.**

- The type faces and the size scale. Figtree titles, Inter body, Geist Mono
  figures, at the sizes in section 2. Legibility is not branding.
- The spacing and `radius` scale.
- The neutral greys — `C.text`, `C.dim`, `C.faint`, `C.border`, `C.panel`.
  These are contrast decisions, not a palette.
- The three state colours, which mean the same thing to a customer as to an
  owner: green settled, amber needs you, red overdue.
- The *shape* of `Card`, `Button`, `Field`, `Pill` and a table — the metrics,
  the radius, the 48px touch floor.

**They may not take anything that says "you are inside an application".**

- `Page`, the sidebar, the top bar, the identity strip, the workspace plate,
  the product row and `[Product name]`, the phone tabs, the capture sheet, the
  View mode and Work in it bars. None of it belongs on a document; a customer
  who sees "Add a note" and "Log time" above a quote has been shown the inside
  of somebody else's software.
- **`C.accent`.** This is the one that matters. Our near-black is the app's
  interactive colour, and on a customer document the one filled thing on the
  page — Accept, Pay — must be the client's colour, not ours. Resolve it from
  the brand kit, fall back to the workspace colour, and only then to near-black.
- Our name, anywhere except one line of small print at the foot: "Sent
  securely through CALO&CO". That line is the whole of our presence.

**The client's brand is the hero and it comes from the data.** Their logo or
their initials, their colour, their phone, their address. Every one of those
is often empty, and an empty one is left out rather than filled with a
placeholder — a customer must never see `[LICENSE NO.]`.

---

## 5. Phone

Under 720px — the same line `useIsPhone` draws. Change it in one place or the
component and the stylesheet will disagree and both layouts will render.

- **48px minimum** for anything touchable. Tabs are 56, the capture button 60,
  steppers 56, the thumb button 56.
- **Steppers, not keyboards, for numbers.** The answer is almost always a whole
  or half of something and a wet thumb is not going to type ".5". The number
  between the buttons is not an input: making it one summons a keyboard over
  the screen the control exists to avoid.
- **Nothing reachable only by hover.** No tooltips carrying information, no
  actions that appear on hover, no truncation whose full value is a title
  attribute.
- **Nothing cropped.** No horizontal page scroll at 390px, ever. Wide content
  scrolls inside its own container.
- **Desktop is the same page.** Fold desk work away with a media query rather
  than building a phone copy of a screen. Two implementations drift.

---

## 6. Words

**Plain English.** No jargon, no internal vocabulary, nothing a reader has to
translate before they can use the screen.

**American English.** "colors", not "colours".

**Each workspace's own words.** `vocabFor` gives job/jobPlural, customer/
customerPlural, estimate and lead from the business kind, and a business can
override the estimate word. A contractor has Jobs and Customers, a studio has
Projects and Clients, a rep has Principals and quotes. Never type "job" into a
screen.

**Say what the screen is, not how it works.** "Receipts, filed against jobs"
beats "photograph a receipt and it becomes a job cost". The label is the
instruction; a hint earns its place only if it says what you need before you
start.

**No aphorisms in the interface.** A subtitle is a label.

**Never a real person's name** as placeholder or example text.

**They/them.** Nothing in this product records anybody's pronouns and a name
does not supply them.

### Errors

Every error answers three questions, in this order:

1. **What happened** — in the reader's terms, not the database's.
2. **Whether anything was saved.** This is the question people actually have
   and the one most often left out.
3. **What to do next** — one action, with a real contact where a contact is
   the answer.

**"That did not work. Try again, and tell us if it keeps happening." is
banned.** It answers none of the three, and "tell us" is not a link. It is
currently the fallback in `lib/spine/errors.ts` and it reaches a screen every
time a database message does not match a known pattern.

Good, and already in the product:

> Nothing was saved. View mode cannot change anything. Leave View mode to make
> this change.

> This part is not switched on yet — a database change behind it has not been
> applied. Nothing you did.

Both say what happened, that nothing was written, and the one way forward.

### Confirmations
A save that says nothing is indistinguishable from a save that failed. Say what
was written and what happens to it next:

> 1 hour on Brandt & Sons Builders, $88.00. It goes on the invoice drafted on
> the 1st.

---

## 7. Data

**Only show what the data supports.** Leave a line out rather than invent it.

The approved Today design showed "Crew A · 7:30 AM" on the next-job card.
`jobs` carries `scheduled_start` as a date; there is no time-of-day column and
no crew table anywhere, so neither is drawn. A 7:30 invented from a date is
what somebody sets an alarm by, and being wrong about it once costs more than
never having shown it.

The same rule one level down: Directions and Call appear only where the address
and the phone number exist. A Call button that dials nothing is worse than a
card with one button on it.

**Never guess a financial parameter.** An obviously wrong number is safer than
a plausible one. Rates are per-org; one business having them unset says nothing
about another.

**No dead buttons.** A control that does nothing teaches people the screen is
broken, and then they stop pressing the ones that work. If a feature is not
built, leave it out and write the brief. Hold to talk and offline saving are
both out of the capture sheet for exactly this reason.

**No promise the product cannot keep.** "Everything saves on the phone and
sends when you're back online" is believed at exactly the moment it fails.

---

## 8. Rules for every brief

These are about how work gets done, not how it looks.

**Verify on the demo, at both widths.** Desktop, and a 390px frame. The frame
method: inject a same-origin iframe at 390px into a signed-in tab, because
resizing the window is unreliable when somebody has Chrome in fullscreen. State
which method was used and what it cannot show.

**Measure with the tab actually visible.** Chrome de-prioritises network in a
background tab; the first timings of the switch-speed work read 5.8–10.1s and
were all wrong for that reason.

**Report what the system PERMITS, not what a screen shows.** A greyed-out
button is not a boundary. Say where the real refusal is, whether it is
app-level or enforced by the database, and try it: the send lock was verified
by attempting a send and reading the 403 and the empty network panel, not by
looking at the button.

**Say what could not be verified.** A check that did not happen is a finding.
The demo had no scheduled job in the whole database, so Today's hero could not
be seen until two dates were set; that belongs in the report, not in silence.

**Check real-client impact before describing a fix.** Before saying a bug is
fixed, find out who hit it. The sign-in crash was live for 2h 47m; the question
"did a real client try to sign in in that window" is part of the report.

**Never touch real client data to test.** The demo workspaces exist for this.
Never send, publish or email anything to a real client while testing, and never
sign the demo out — `supabase.auth.signOut()` defaults to global scope and
revokes every session.

**Never invent a key, and never ask for one in chat.**

**One brief, one change.** If something else is broken, write it down in the
backlog and finish what was asked.
