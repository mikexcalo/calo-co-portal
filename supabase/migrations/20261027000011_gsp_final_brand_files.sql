/*
  Global Seafood Partners: the final brand files replace the morning's.

  WHAT WENT AND WHY

  The three marks stored this morning by 20261027000010 were an earlier cut.
  Their files are gone from client-assets and their rows go from kit.assets
  here. Nothing is lost: the originals are still in Mike's Downloads and their
  checksums were read back off disk immediately before the delete.

  Of the three names, only gsp-mark-tide.svg comes back, and it is not the same
  file: the old one was a 512px disc with the artwork knocked out of it, the
  new one is the transparent mark. Anything holding the old path now holds
  nothing, which is the correct outcome for a superseded logo and the reason
  this replaces rather than adds.

  WHAT ARRIVED

  Eighteen files, uploaded byte for byte at their real content types and read
  straight back out: all eighteen identical to source, verified with cmp and
  SHA-256. Seventeen images plus the handoff spec.

  NO CONTENT CREDENTIALS IN THIS SET, and that is worth writing down because
  the morning's files had them and the check is easy to assume. Every one of
  these eighteen was scanned for c2pa, JUMBF, PNG iTXt/tEXt/eXIf and SVG
  <metadata>, and every one came back with none. So "nothing stripped" is true
  and also uneventful: there was nothing to strip. If a later export claims a
  provenance chain for these, it is inventing one.

  needs_approval CARRIES THE BRIEF'S OWN WORDS

  Three groups are labelled "proposed, not reviewed" and those files are
  flagged, which is what makes the brand page count them as not cleared and
  tint them rather than showing them beside approved artwork. The stacked
  lockup and the mark are the primary logo and are not flagged. The spec's own
  Section 5 agrees: the horizontal lockup, the icons and the share image are
  proposed in the handoff and not reviewed.

  THE SPEC IS A REFERENCE, NOT A SOURCE

  Its Section 6 is draft copy written for a mock, and the document says so
  itself: "The platform's stored client information is the source of truth for
  all case-study messaging, and it overrides everything below." So it lands in
  two places that nothing reads as fact - the file in client-assets under
  docs/, and a reference_docs row carrying the text - and in neither
  brands.messaging, brands.guardrails, customers.brief, discovery nor
  brand_proof, which are the five the case study drafter actually reads.
*/

do $$
declare
  gsp_brand    constant uuid := 'c3d27556-fb60-40db-83d7-cb263edbcb92';
  gsp_customer constant uuid := 'c1d7c180-3e79-4f04-b721-f4b752354836';
  calo_org     uuid;
  target       record;
begin
  select b.id, b.name, o.name as org, o.id as org_id, b.status
    into target
    from public.brands b
    join public.orgs o on o.id = b.org_id
   where b.id = gsp_brand;

  if target.id is null then
    raise exception 'Brand % not found.', gsp_brand;
  end if;
  if target.name <> 'Global Seafood Partners' or target.org <> 'CALO&CO' then
    raise exception 'Brand % is "%" in "%". Refusing to touch it.', gsp_brand, target.name, target.org;
  end if;
  calo_org := target.org_id;

  /* Colours, fonts and pairings are untouched: this replaces the file list
     only, and jsonb_set leaves every other key exactly as it was. */
  update public.brands
     set kit = jsonb_set(kit, '{assets}', $assets$[
  {
    "name": "gsp-lockup-slate-on-white.svg",
    "path": "assets/lockups/gsp-lockup-slate-on-white.svg",
    "storage_path": "assets/lockups/gsp-lockup-slate-on-white.svg",
    "group": "Stacked lockup",
    "for": "Slate on white, background built in",
    "bytes": 22734,
    "needs_approval": false
  },
  {
    "name": "gsp-lockup-white-on-slate.svg",
    "path": "assets/lockups/gsp-lockup-white-on-slate.svg",
    "storage_path": "assets/lockups/gsp-lockup-white-on-slate.svg",
    "group": "Stacked lockup",
    "for": "White on slate, background built in",
    "bytes": 22734,
    "needs_approval": false
  },
  {
    "name": "gsp-lockup-tide-on-white.svg",
    "path": "assets/lockups/gsp-lockup-tide-on-white.svg",
    "storage_path": "assets/lockups/gsp-lockup-tide-on-white.svg",
    "group": "Stacked lockup",
    "for": "Tide on white, background built in",
    "bytes": 22734,
    "needs_approval": false
  },
  {
    "name": "gsp-lockup-slate-transparent.svg",
    "path": "assets/lockups/gsp-lockup-slate-transparent.svg",
    "storage_path": "assets/lockups/gsp-lockup-slate-transparent.svg",
    "group": "Stacked lockup",
    "for": "Slate, transparent. For White or Salt",
    "bytes": 22685,
    "needs_approval": false
  },
  {
    "name": "gsp-lockup-white-transparent.svg",
    "path": "assets/lockups/gsp-lockup-white-transparent.svg",
    "storage_path": "assets/lockups/gsp-lockup-white-transparent.svg",
    "group": "Stacked lockup",
    "for": "White, transparent. For Wet slate only",
    "bytes": 22685,
    "needs_approval": false
  },
  {
    "name": "gsp-lockup-tide-transparent.svg",
    "path": "assets/lockups/gsp-lockup-tide-transparent.svg",
    "storage_path": "assets/lockups/gsp-lockup-tide-transparent.svg",
    "group": "Stacked lockup",
    "for": "Tide, transparent. For White or Salt",
    "bytes": 22685,
    "needs_approval": false
  },
  {
    "name": "gsp-lockup-horizontal-slate-transparent.svg",
    "path": "assets/lockups/gsp-lockup-horizontal-slate-transparent.svg",
    "storage_path": "assets/lockups/gsp-lockup-horizontal-slate-transparent.svg",
    "group": "Horizontal lockup (proposed, not reviewed)",
    "for": "One-line lockup. Proposed only. Use not decided",
    "bytes": 23040,
    "needs_approval": true
  },
  {
    "name": "gsp-lockup-horizontal-white-transparent.svg",
    "path": "assets/lockups/gsp-lockup-horizontal-white-transparent.svg",
    "storage_path": "assets/lockups/gsp-lockup-horizontal-white-transparent.svg",
    "group": "Horizontal lockup (proposed, not reviewed)",
    "for": "One-line lockup. Proposed only. Use not decided",
    "bytes": 23040,
    "needs_approval": true
  },
  {
    "name": "gsp-lockup-horizontal-tide-transparent.svg",
    "path": "assets/lockups/gsp-lockup-horizontal-tide-transparent.svg",
    "storage_path": "assets/lockups/gsp-lockup-horizontal-tide-transparent.svg",
    "group": "Horizontal lockup (proposed, not reviewed)",
    "for": "One-line lockup. Proposed only. Use not decided",
    "bytes": 23040,
    "needs_approval": true
  },
  {
    "name": "gsp-mark-slate.svg",
    "path": "assets/marks/gsp-mark-slate.svg",
    "storage_path": "assets/marks/gsp-mark-slate.svg",
    "group": "Mark",
    "for": "Slate, transparent. For White or Salt",
    "bytes": 16790,
    "needs_approval": false
  },
  {
    "name": "gsp-mark-white.svg",
    "path": "assets/marks/gsp-mark-white.svg",
    "storage_path": "assets/marks/gsp-mark-white.svg",
    "group": "Mark",
    "for": "White, transparent. For Wet slate only",
    "bytes": 16790,
    "needs_approval": false
  },
  {
    "name": "gsp-mark-tide.svg",
    "path": "assets/marks/gsp-mark-tide.svg",
    "storage_path": "assets/marks/gsp-mark-tide.svg",
    "group": "Mark",
    "for": "Tide, transparent. For White or Salt",
    "bytes": 16790,
    "needs_approval": false
  },
  {
    "name": "gsp-favicon.svg",
    "path": "assets/icons/gsp-favicon.svg",
    "storage_path": "assets/icons/gsp-favicon.svg",
    "group": "Icons (proposed, not reviewed)",
    "for": "Simplified mark. For use under 24px only",
    "bytes": 14425,
    "needs_approval": true
  },
  {
    "name": "gsp-favicon-32.png",
    "path": "assets/icons/gsp-favicon-32.png",
    "storage_path": "assets/icons/gsp-favicon-32.png",
    "group": "Icons (proposed, not reviewed)",
    "for": "32 x 32",
    "bytes": 1459,
    "needs_approval": true
  },
  {
    "name": "gsp-icon-180.png",
    "path": "assets/icons/gsp-icon-180.png",
    "storage_path": "assets/icons/gsp-icon-180.png",
    "group": "Icons (proposed, not reviewed)",
    "for": "180 x 180",
    "bytes": 6984,
    "needs_approval": true
  },
  {
    "name": "gsp-icon-512.png",
    "path": "assets/icons/gsp-icon-512.png",
    "storage_path": "assets/icons/gsp-icon-512.png",
    "group": "Icons (proposed, not reviewed)",
    "for": "512 x 512",
    "bytes": 21055,
    "needs_approval": true
  },
  {
    "name": "gsp-og-image.png",
    "path": "assets/social/gsp-og-image.png",
    "storage_path": "assets/social/gsp-og-image.png",
    "group": "Social (proposed, not reviewed)",
    "for": "Share image, 1200 x 630",
    "bytes": 35286,
    "needs_approval": true
  },
  {
    "name": "gsp-brand-spec.md",
    "path": "docs/gsp-brand-spec.md",
    "storage_path": "docs/gsp-brand-spec.md",
    "group": "Documents",
    "for": "Brand spec — CALO&CO handoff, 25 Sept 2026",
    "bytes": 15853,
    "needs_approval": false
  }
]$assets$::jsonb, true),
         updated_at = now()
   where id = gsp_brand;

  /*
    The document, recorded as a document.

    reference_docs is the one table in this schema whose job is "a titled
    document with a source and a date". Nothing automated reads it; the Market
    page renders it as markdown for a person. Worth knowing that CALO&CO's plan
    does not include the market module, so this is stored and addressable but
    not currently in the sidebar - the file on the brand page is where it will
    actually be found today.
  */
  delete from public.reference_docs
   where org_id = calo_org
     and customer_id = gsp_customer
     and title = 'Brand spec — CALO&CO handoff, 25 Sept 2026';

  insert into public.reference_docs (org_id, customer_id, title, subject, source, as_of, body)
  values (
    calo_org,
    gsp_customer,
    'Brand spec — CALO&CO handoff, 25 Sept 2026',
    'Brand',
    'CALO&CO handoff, 25 September 2026. Reference only: Section 6 is draft copy, not approved, and not a source for messaging.',
    date '2026-09-25',
    $spec$# Global Seafood Partners — Brand Spec

Prepared by CALO&CO. Handoff version, September 25, 2026.

**Read Section 5 before using anything here in a case study.** Nothing in this document has been approved by the client. It records what CALO&CO decided internally and what was only proposed.

Files referenced below are in `gsp-brand-files.zip`.

---

## 1. Logo

### Versions

| Version | Files | Status |
|---|---|---|
| Stacked lockup (primary): mark left, GLOBAL / SEAFOOD / PARTNERS in three lines | `lockups/gsp-lockup-{slate-on-white, white-on-slate, tide-on-white}.svg` and `lockups/gsp-lockup-{slate, white, tide}-transparent.svg` | Primary logo |
| Mark alone | `marks/gsp-mark-{slate, white, tide}.svg` | Primary logo |
| Horizontal lockup: mark left, GLOBAL SEAFOOD PARTNERS on one line | `lockups/gsp-lockup-horizontal-{slate, white, tide}-transparent.svg` | Appeared only in the case-study mock. Never reviewed on its own. |
| Simplified favicon mark: same drawing with bolder, even tentacles | `icons/gsp-favicon.svg` and icon PNGs | For small icon sizes only |
| Wordmark only (no mark) | None | Not designed |
| Vertical lockup (mark above text) | None | Not designed |

All SVGs have text converted to shapes. The mark is one solid shape with the tentacles cut out, so the background shows through them on any surface.

The lockup files include the required clear space inside the artboard. The files with backgrounds open looking exactly as named. The transparent files have no background, so the white versions will look blank until placed on a dark surface.

### When to use which

- **Stacked lockup:** the default wherever the brand is introduced, such as website headers, documents, packaging, and signage.
- **Mark alone:** square or very small spaces (app icons, social avatars, favicons, crate stamps), or where the full name already appears nearby.
- **Horizontal lockup:** proposed only for wide, short spaces like a thin website header. Its use is not decided.

### Construction of the stacked lockup

All measurements use **X**, the cap height of the wordmark (the height of a flat capital like E).

| Rule | Spec |
|---|---|
| Typeface | Archivo Narrow Medium (500), all caps. Always use the files; never retype the wordmark. |
| Letter spacing | −0.01 em |
| Line spacing | 0.9 em baseline to baseline (about 1.31X) |
| Text alignment | Flush left |
| Mark diameter | Equal to the full height of the text stack (about 3.66X) |
| Mark alignment | The circle's top lines up with the tops of the round letters in GLOBAL (G, O). Its bottom lines up with the bottom of the S in PARTNERS. |
| Gap between mark and text | ½X (about 14% of the mark diameter) |
| Overall proportion | About 2.83 wide by 1 tall, excluding clear space |

### Clear space

X on all four sides. Nothing else may enter this zone. It is built into every lockup file.

### Minimum sizes

| Item | Screen | Print |
|---|---|---|
| Stacked lockup (height) | 36 px | 12 mm |
| Mark alone (diameter) | 24 px | 8 mm |
| Below 24 px (favicons) | Use the simplified favicon mark | Not defined |

At 32 px the simplified favicon still shows the coil. At 16 px it reads as a striped globe, and the coil is not distinguishable.

### Don'ts

- Don't rotate or flip the mark. Its angle is final and built into the files.
- Don't stretch, squash, or change the proportions.
- Don't recolor outside the three approved color versions below.
- Don't use Buoy for any part of the logo.
- Don't make the mark and the wordmark different colors.
- Don't change the gap, line spacing, or letter spacing.
- Don't retype the wordmark or swap the font.
- Don't add effects such as shadows, glows, outlines, gradients, or bevels.
- Don't place the logo on busy photography without a solid panel behind it.
- Don't go below the minimum sizes. Use the simplified favicon under 24 px.
- Don't put the white logo on White or Salt, or the slate or Tide logo on Wet slate.

### Color versions of the logo

- **Slate:** Wet slate on White or Salt.
- **White:** White on Wet slate.
- **Tide:** Tide on White or Salt.

---

## 2. Colors

| Name | Hex | RGB | CMYK | Pantone | Role |
|---|---|---|---|---|---|
| Wet slate | #2A2A2A | 42, 42, 42 | Not defined | Not defined | Primary ink: logo, body text, dark backgrounds |
| White | #FFFFFF | 255, 255, 255 | Not defined | Not defined | Main background |
| Salt | #F6F7F7 | 246, 247, 247 | Not defined | Not defined | The single off-white: quiet panels and section breaks |
| Tide | #0068C9 | 0, 104, 201 | Not defined | Not defined | Brand accent: Tide logo version, accent backgrounds with white text, accent text on light backgrounds |
| Buoy | #FF5A2A | 255, 90, 42 | Not defined | Not defined | Signal color for tags, labels, and callouts (for example "Keep frozen"). Never used for the logo. |

### The three color rules

1. Text on Buoy is always Wet slate, never white.
2. Buoy is never used as text on White or Salt.
3. Tide and Buoy never carry text on each other.

### Text-on-background pairings

Contrast ratios are measured by WCAG. AA requires 4.5:1 for normal text.

| Text \ Background | Wet slate | White | Salt | Tide | Buoy |
|---|---|---|---|---|---|
| **Wet slate** | — | Allowed (14.4:1) | Allowed (13.4:1) | Not allowed (2.6:1, fails contrast) | Allowed (4.6:1). This is the only allowed text on Buoy. |
| **White** | Allowed (14.4:1) | — | Not allowed (1.1:1) | Allowed (5.5:1) | Not allowed (rule 1; 3.1:1) |
| **Salt** | Allowed (13.4:1) | Not allowed (1.1:1) | — | Allowed (5.1:1) | Not allowed (rule 1; 2.9:1) |
| **Tide** | Not allowed (2.6:1, fails contrast) | Allowed (5.5:1) | Allowed (5.1:1) | — | Not allowed (rule 3; 1.8:1) |
| **Buoy** | Allowed (4.6:1) | Not allowed (rule 2; 3.1:1) | Not allowed (rule 2; 2.9:1) | Not allowed (rule 3; 1.8:1) | — |

Notes:

- Slate on Tide and Tide on slate are not covered by the three rules. They're marked not allowed only because they fail contrast.
- Buoy text on Wet slate isn't forbidden by the rules and passes AA. However, it has never been used or discussed.

---

## 3. Typography

### Archivo Narrow

- **Source:** Google Fonts (free, open license).
- **Weight:** Medium (500) is the only weight decided. Bold (700) and SemiBold (600) were considered and not chosen.
- **Case:** All caps for the wordmark. The mocks also set headlines, product names, and labels in all caps, but no rule was decided for headlines.
- **Letter spacing:** −0.01 em for the wordmark. The mocks used +0.02 to +0.08 em on small uppercase labels, but that is not a decided rule.
- **Line height:** 0.9 em for the stacked wordmark. The mocks used about 0.9 to 1.1 for display headlines, but that is not a decided rule.
- **Use:** The wordmark, plus headlines as shown in the mocks.

### Body and small text

Not decided. The case-study mock used CALO&CO's studio fonts for body text around the Global Seafood Partners work. Those are not part of this brand.

### Type scale for web

Not decided. The scale below is a starting point proposed in this document for the first time. It has not been reviewed.

| Level | Font | Size | Line height | Notes |
|---|---|---|---|---|
| Headline | Archivo Narrow Medium, all caps | 48 px | 0.95 | −0.01 em |
| Subhead | Archivo Narrow Medium, all caps | 24 px | 1.1 | +0.02 em |
| Body | Not decided | 16 px | 1.6 | |
| Small | Not decided | 13 px | 1.5 | |

---

## 4. Design rationale

### The mark

The mark is a circle holding four tapering tentacles.

The circle is the globe, the literal "Global" in the name. The tentacles stand for the product. They were drawn with cephalopods like octopus and squid in mind, but the core species was never confirmed.

The tentacles run edge to edge through the circle, so the arms seem to keep going beyond it. At the final angle they lie nearly level, like latitude lines on a globe, so one drawing reads as both "world" and "catch." They taper like real arms, and one ends in an open coil, the single expressive gesture in an otherwise calm mark.

The mark was kept deliberately restrained, with one gesture and steady spacing. The goal was for it to share the temperament of the wordmark: even, sturdy, and plain-spoken.

### Color names and choices

The names come from the working waterfront.

- **Wet slate:** Carries over the dark charcoal of the starting logo.
- **Salt:** A barely-there cool off-white. The first version was a warm beige. It was rejected because it looked like a generic default and sat too close to CALO&CO's own Sand color.
- **Tide:** A deep cerulean, blue with a trace of teal. It stands apart from the navy and royal blue common in seafood, and it stays clear of CALO&CO's own blues and teals.
- **Buoy:** Safety orange from marine signage. It was brightened slightly so Wet slate text on it passes accessibility contrast.

The whole palette was checked against WCAG contrast. The three color rules come from those checks.

### Typeface

The starting logo used a bold, condensed grotesque. Four candidates were compared: Inter Tight, Archivo Narrow, Roboto Condensed, and Barlow Semi Condensed.

Archivo Narrow was chosen because it's condensed enough to fit long product names on labels while staying open and legible. Medium was chosen over Bold to take the edge off while keeping the stamped, confident feel.

### Directions explored and rejected

**Frame.** The starting logo used a square frame. A redrawn square was used as a placeholder, then replaced with a circle to represent the globe.

**Early tentacle drawings.**

- Plain wave lines, rejected as not reading as tentacles.
- Tentacles that curled and stopped inside the circle, rejected: they needed to pass through the circle, and they were too thin.
- Bold, even bands, rejected as not clearly tentacles and too uniform.
- Suckers, tried and then removed.

**Adding more.**

- A fifth tentacle, including versions with a second coil and a hooked tip.
- A second coil on the existing tentacles.
- A denser six-tentacle version with counter-motion.

All were rejected as busier than the wordmark could support.

**Alternative concepts.**

- Squid-inspired fans with arms spreading from one point.
- Rearrangements of the same four tentacles.
- A "globe" version with tentacles as latitude bands.
- A braided "partnership" version.
- A "one body" version with all arms coming from one off-screen source.
- A "reaching arms" version with two coils meeting in the center.

None was chosen.

**Palette.**

- Tide went from a muted teal, to a vivid blue, to a cerulean judged too muted, to a final choice among four vivid blues.
- Salt went from warm beige, to a cool tinted gray judged too colored, to White as the main ground with one near-white Salt.

**Rotation.** The final four-tentacle drawing was mirrored and tried at many angles. −22° was chosen first, then changed to −57°.

### Process notes

The identity was developed in rounds of side-by-side comparisons inside an HTML design canvas. Every candidate was shown in the full lockup, not in isolation.

The final mark was rebuilt as a single vector shape with the tentacles cut out. The wordmark was converted to outlines. A simplified mark with bolder tentacles was made for favicon sizes.

---

## 5. Approval status

**Client approval (John): none recorded.** Nothing in this document has been shown to or approved by the client, as far as this project's records show. Nothing here should be presented as client-approved in a case study until it is.

Everything below is either decided internally by CALO&CO (Mike) or proposed and not yet confirmed by Mike.

| Item | Status |
|---|---|
| Archivo Narrow Medium (500) as the wordmark font | Decided by CALO&CO. Not client-approved. |
| Wordmark in all caps, three stacked lines | Decided by CALO&CO. Not client-approved. |
| Circle (globe) mark with four tapering tentacles, one open coil, no suckers | Decided by CALO&CO. Not client-approved. |
| Final mark orientation (mirrored, −57°) | Decided by CALO&CO. Not client-approved. |
| Palette: Wet slate, White (main ground), Salt #F6F7F7, Tide #0068C9 | Decided by CALO&CO. Not client-approved. |
| Buoy as a vivid orange-red | Decided by CALO&CO. The exact value #FF5A2A was adjusted for contrast and not separately confirmed. Not client-approved. |
| Color names (Wet slate, Salt, Tide, Buoy) | Proposed, not objected to, never explicitly confirmed. Not client-approved. |
| Requirement that all colors be accessible | Decided by CALO&CO. |
| The three color rules and the pairing table | Proposed from contrast checks. Not explicitly confirmed. Not client-approved. |
| Lockup construction (mark matches the text stack) | Decided by CALO&CO. Not client-approved. |
| Gap, letter spacing, line spacing, clear space, minimum sizes | Proposed. Not explicitly confirmed. Not client-approved. |
| Horizontal one-line lockup | Proposed in the mock only. Not reviewed. Not client-approved. |
| Simplified favicon mark and icon PNGs | Proposed in this handoff. Not reviewed. |
| Social share image | Proposed in this handoff. Not reviewed. |
| Web type scale; body and small fonts | Not decided (scale proposed in this document only). |
| CMYK and Pantone values | Not decided. |
| All messaging and copy (Section 6) | Draft. Not approved. |

---

## 6. Copy written so far — DRAFT, not approved

All of the following was written for the case-study mock and the application mockups. None of it is approved, and none of it came from the client or from stored platform data.

The platform's stored client information is the source of truth for all case-study messaging, and it overrides everything below.

### Case-study page (DRAFT)

- **Hero headline:** "A mark for a seafood company that moves with the water, not against it."
- **Services line:** "Identity, typography, color, applications"
- **Brief paragraph:** "Global Seafood Partners needed an identity that could sit as comfortably on a shipping crate as on a boardroom slide: credible to buyers, honest about where the product comes from."
- **Mark section headline:** "The catch, wrapped around the world."
- **Mark section body:** "Four tentacles reach through a globe from every direction, tapering as they go, one coiling on its way through: a nod to the octopus and squid at the heart of the business. The circle says global reach; the tentacles say the product is alive and in motion. Simple enough to hold up on a crate stamp or an app icon."
  - Note: "octopus and squid" is an unconfirmed assumption.
- **Mark section labels:** "01 — Globe", "02 — Tentacle", "03 — Current"
- **Logo system:** "One mark, every surface." / "Primary lockup, reversed, horizontal and standalone mark. Set in Archivo Narrow Medium throughout."
- **Typography:** "Narrow, sturdy, readable on a crate." / "Archivo Narrow Medium carries the wordmark and every headline. Condensed enough to fit long product names on a label, open enough to stay legible across a loading dock."
- **Color:** "Pulled from the working coast."
- **Applications:** "From the dock to the deal."

### Placeholders still open

Challenge, approach, year, all results metrics, client quote, contact details, product origin, and the next case study.

### Application mockups (DRAFT sample content, not real product data)

- **Website hero:** "Sourced right. Delivered cold." with the button "Talk to our team"
- **Case label:** "Atlantic Cod Loins", "Keep frozen", lot, weight, origin, and packed-date fields
- **Type specimen line:** "Lot 0417 · Atlantic Cod · Product of [ORIGIN]"

These are samples only. They are not confirmed products, and "Atlantic cod" does not match the tentacle concept.

### Retired drafts (replaced, do not use)

- "Water, carved into a square."
- "The world's water, in one circle."
- "The catch, curled around the world."

### Taglines

None written. Not decided.
$spec$
  );

  raise notice 'GSP brand files replaced. status left as %.', target.status;
end
$$;
