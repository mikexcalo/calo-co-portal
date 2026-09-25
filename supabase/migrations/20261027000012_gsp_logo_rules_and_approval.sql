/*
  Global Seafood Partners: the logo rules and where everything stands.

  Both halves are patterns, not one-offs. kit.logo_rules and the per-item
  status stamp read on any brand; every brand but this one has neither and
  renders nothing for both, which is the same rule kit.pairings already
  follows.

  WHAT A STATUS IS

  Three words with precise meanings, lifted from the spec's own Section 5:
  "Decided by CALO&CO", "Proposed", "Not decided". Client approval is tracked
  separately and is false on every item here, because Section 5 opens by saying
  nothing in the document has been shown to the client. Those are two different
  events and a kit that cannot tell them apart will eventually present the
  first as the second in front of the person who never said yes.

  SIX ITEMS CARRY NO STATUS, ON PURPOSE

  Section 5 rules on sixteen things. It does not rule on these:

    Text alignment (flush left)          in the construction table
    Overall proportion (2.83 by 1)       in the construction table
    Wordmark only (no mark)              Section 1 says "Not designed"
    Vertical lockup (mark above text)    Section 1 says "Not designed"
    The three color versions of the logo Section 1 states them, 5 is silent
    gsp-brand-spec.md                    the document does not rule on itself

  They are stored with their content and no stamp. The renderer prints nothing
  where there is no stamp, so the gap is visible as a gap. Guessing "Proposed"
  for any of them would have been indistinguishable from a decision nobody
  made, which is the failure this whole change exists to prevent.

  ONE PLACE THE SPEC DISAGREES WITH ITSELF, KEPT AS THE SPEC HAS IT

  Section 5 marks the palette "Decided by CALO&CO" and the colour NAMES
  "Proposed, not objected to, never explicitly confirmed". A colour carries one
  status, so each of the five is stamped Decided, which is the value of the
  colour rather than what it is called. The names being unconfirmed is recorded
  in the report and not invented into a field the shape does not have.

  CMYK AND PANTONE ARE WRITTEN, NOT OMITTED

  Both are "Not decided" on all five. A blank where a Pantone belongs reads as
  an oversight and gets filled in from a converter by somebody helpful; the
  words are what stop that. Section 2's table says "Not defined" and Section 5
  says "Not decided"; Section 5 wins because it is the status column.
*/

do $$
declare
  gsp_brand constant uuid := 'c3d27556-fb60-40db-83d7-cb263edbcb92';
  target    record;
  additions jsonb;
  item      jsonb;
begin
  select b.id, b.name, o.name as org into target
    from public.brands b join public.orgs o on o.id = b.org_id
   where b.id = gsp_brand;

  if target.id is null then
    raise exception 'Brand % not found.', gsp_brand;
  end if;
  if target.name <> 'Global Seafood Partners' or target.org <> 'CALO&CO' then
    raise exception 'Brand % is "%" in "%". Refusing to touch it.', gsp_brand, target.name, target.org;
  end if;

  /*
    Merged, not replaced.

    `||` at the top level overwrites the six keys named below and leaves
    anything else in the object untouched, so a key added by hand in the
    dashboard between now and this running does not vanish.
  */
  update public.brands
     set kit = kit || $kit${
  "fonts": [
    {
      "family": "Archivo Narrow",
      "role": "Display, headlines and wordmark",
      "weight": "500",
      "case": "uppercase",
      "source": "Google Fonts",
      "client_approved": false,
      "status": "Decided by CALO&CO"
    }
  ],
  "colors": [
    {
      "name": "Wet slate",
      "hex": "#2A2A2A",
      "role": "Primary text and dark grounds",
      "token": "--wet-slate",
      "rgb": "42, 42, 42",
      "cmyk": "Not decided",
      "pantone": "Not decided",
      "client_approved": false,
      "status": "Decided by CALO&CO"
    },
    {
      "name": "White",
      "hex": "#FFFFFF",
      "role": "Primary ground",
      "token": "--white",
      "rgb": "255, 255, 255",
      "cmyk": "Not decided",
      "pantone": "Not decided",
      "client_approved": false,
      "status": "Decided by CALO&CO"
    },
    {
      "name": "Salt",
      "hex": "#F6F7F7",
      "role": "Secondary ground",
      "token": "--salt",
      "rgb": "246, 247, 247",
      "cmyk": "Not decided",
      "pantone": "Not decided",
      "client_approved": false,
      "status": "Decided by CALO&CO"
    },
    {
      "name": "Tide",
      "hex": "#0068C9",
      "role": "Primary accent",
      "token": "--tide",
      "rgb": "0, 104, 201",
      "cmyk": "Not decided",
      "pantone": "Not decided",
      "client_approved": false,
      "status": "Decided by CALO&CO"
    },
    {
      "name": "Buoy",
      "hex": "#FF5A2A",
      "role": "Signal accent",
      "token": "--buoy",
      "rgb": "255, 90, 42",
      "cmyk": "Not decided",
      "pantone": "Not decided",
      "client_approved": false,
      "status": "Decided by CALO&CO",
      "status_note": "The exact value #FF5A2A was adjusted for contrast and not separately confirmed."
    }
  ],
  "pairings": [
    {
      "rule": "Text on Buoy is always Wet slate, never white",
      "client_approved": false,
      "status": "Proposed"
    },
    {
      "rule": "Buoy is never used as text on White or Salt",
      "client_approved": false,
      "status": "Proposed"
    },
    {
      "rule": "Tide and Buoy never carry text on each other",
      "client_approved": false,
      "status": "Proposed"
    }
  ],
  "logo_rules": {
    "versions": [
      {
        "name": "Stacked lockup (primary): mark left, GLOBAL / SEAFOOD / PARTNERS in three lines",
        "use": "The default wherever the brand is introduced, such as website headers, documents, packaging, and signage.",
        "files": "lockups/gsp-lockup-{slate-on-white, white-on-slate, tide-on-white}.svg and lockups/gsp-lockup-{slate, white, tide}-transparent.svg",
        "client_approved": false,
        "status": "Decided by CALO&CO"
      },
      {
        "name": "Mark alone",
        "use": "Square or very small spaces (app icons, social avatars, favicons, crate stamps), or where the full name already appears nearby.",
        "files": "marks/gsp-mark-{slate, white, tide}.svg",
        "client_approved": false,
        "status": "Decided by CALO&CO"
      },
      {
        "name": "Horizontal lockup: mark left, GLOBAL SEAFOOD PARTNERS on one line",
        "use": "Proposed only for wide, short spaces like a thin website header. Its use is not decided.",
        "files": "lockups/gsp-lockup-horizontal-{slate, white, tide}-transparent.svg",
        "client_approved": false,
        "status": "Proposed",
        "status_note": "Appeared only in the case-study mock. Never reviewed on its own."
      },
      {
        "name": "Simplified favicon mark: same drawing with bolder, even tentacles",
        "use": "For small icon sizes only",
        "files": "icons/gsp-favicon.svg and icon PNGs",
        "client_approved": false,
        "status": "Proposed"
      },
      {
        "name": "Wordmark only (no mark)",
        "use": "Not designed",
        "files": "None"
      },
      {
        "name": "Vertical lockup (mark above text)",
        "use": "Not designed",
        "files": "None"
      }
    ],
    "construction": [
      {
        "rule": "Typeface",
        "spec": "Archivo Narrow Medium (500), all caps. Always use the files; never retype the wordmark.",
        "client_approved": false,
        "status": "Decided by CALO&CO"
      },
      {
        "rule": "Letter spacing",
        "spec": "−0.01 em",
        "client_approved": false,
        "status": "Proposed"
      },
      {
        "rule": "Line spacing",
        "spec": "0.9 em baseline to baseline (about 1.31X)",
        "client_approved": false,
        "status": "Proposed"
      },
      {
        "rule": "Text alignment",
        "spec": "Flush left"
      },
      {
        "rule": "Mark diameter",
        "spec": "Equal to the full height of the text stack (about 3.66X)",
        "client_approved": false,
        "status": "Decided by CALO&CO"
      },
      {
        "rule": "Mark alignment",
        "spec": "The circle's top lines up with the tops of the round letters in GLOBAL (G, O). Its bottom lines up with the bottom of the S in PARTNERS.",
        "client_approved": false,
        "status": "Decided by CALO&CO"
      },
      {
        "rule": "Gap between mark and text",
        "spec": "½X (about 14% of the mark diameter)",
        "client_approved": false,
        "status": "Proposed"
      },
      {
        "rule": "Overall proportion",
        "spec": "About 2.83 wide by 1 tall, excluding clear space"
      }
    ],
    "clear_space": {
      "rule": "X on all four sides. Nothing else may enter this zone. It is built into every lockup file.",
      "client_approved": false,
      "status": "Proposed"
    },
    "minimum_sizes": [
      {
        "item": "Stacked lockup (height)",
        "screen": "36 px",
        "print": "12 mm",
        "client_approved": false,
        "status": "Proposed"
      },
      {
        "item": "Mark alone (diameter)",
        "screen": "24 px",
        "print": "8 mm",
        "client_approved": false,
        "status": "Proposed"
      },
      {
        "item": "Below 24 px (favicons)",
        "screen": "Use the simplified favicon mark",
        "print": "Not defined",
        "client_approved": false,
        "status": "Proposed"
      }
    ],
    "color_versions": [
      {
        "name": "Slate",
        "rule": "Wet slate on White or Salt."
      },
      {
        "name": "White",
        "rule": "White on Wet slate."
      },
      {
        "name": "Tide",
        "rule": "Tide on White or Salt."
      }
    ],
    "donts": [
      "Don't rotate or flip the mark. Its angle is final and built into the files.",
      "Don't stretch, squash, or change the proportions.",
      "Don't recolor outside the three approved color versions below.",
      "Don't use Buoy for any part of the logo.",
      "Don't make the mark and the wordmark different colors.",
      "Don't change the gap, line spacing, or letter spacing.",
      "Don't retype the wordmark or swap the font.",
      "Don't add effects such as shadows, glows, outlines, gradients, or bevels.",
      "Don't place the logo on busy photography without a solid panel behind it.",
      "Don't go below the minimum sizes. Use the simplified favicon under 24 px.",
      "Don't put the white logo on White or Salt, or the slate or Tide logo on Wet slate."
    ],
    "notes": [
      "All SVGs have text converted to shapes. The mark is one solid shape with the tentacles cut out, so the background shows through them on any surface.",
      "The lockup files include the required clear space inside the artboard. The files with backgrounds open looking exactly as named. The transparent files have no background, so the white versions will look blank until placed on a dark surface.",
      "At 32 px the simplified favicon still shows the coil. At 16 px it reads as a striped globe, and the coil is not distinguishable."
    ]
  },
  "approval": {
    "client": "none recorded",
    "note": "Nothing in this document has been shown to or approved by the client, as far as this project's records show. Nothing here should be presented as client-approved in a case study until it is."
  },
  "assets": [
    {
      "name": "gsp-lockup-slate-on-white.svg",
      "path": "assets/lockups/gsp-lockup-slate-on-white.svg",
      "storage_path": "assets/lockups/gsp-lockup-slate-on-white.svg",
      "group": "Stacked lockup",
      "for": "Slate on white, background built in",
      "bytes": 22734,
      "needs_approval": false,
      "client_approved": false,
      "status": "Decided by CALO&CO"
    },
    {
      "name": "gsp-lockup-white-on-slate.svg",
      "path": "assets/lockups/gsp-lockup-white-on-slate.svg",
      "storage_path": "assets/lockups/gsp-lockup-white-on-slate.svg",
      "group": "Stacked lockup",
      "for": "White on slate, background built in",
      "bytes": 22734,
      "needs_approval": false,
      "client_approved": false,
      "status": "Decided by CALO&CO"
    },
    {
      "name": "gsp-lockup-tide-on-white.svg",
      "path": "assets/lockups/gsp-lockup-tide-on-white.svg",
      "storage_path": "assets/lockups/gsp-lockup-tide-on-white.svg",
      "group": "Stacked lockup",
      "for": "Tide on white, background built in",
      "bytes": 22734,
      "needs_approval": false,
      "client_approved": false,
      "status": "Decided by CALO&CO"
    },
    {
      "name": "gsp-lockup-slate-transparent.svg",
      "path": "assets/lockups/gsp-lockup-slate-transparent.svg",
      "storage_path": "assets/lockups/gsp-lockup-slate-transparent.svg",
      "group": "Stacked lockup",
      "for": "Slate, transparent. For White or Salt",
      "bytes": 22685,
      "needs_approval": false,
      "client_approved": false,
      "status": "Decided by CALO&CO"
    },
    {
      "name": "gsp-lockup-white-transparent.svg",
      "path": "assets/lockups/gsp-lockup-white-transparent.svg",
      "storage_path": "assets/lockups/gsp-lockup-white-transparent.svg",
      "group": "Stacked lockup",
      "for": "White, transparent. For Wet slate only",
      "bytes": 22685,
      "needs_approval": false,
      "client_approved": false,
      "status": "Decided by CALO&CO"
    },
    {
      "name": "gsp-lockup-tide-transparent.svg",
      "path": "assets/lockups/gsp-lockup-tide-transparent.svg",
      "storage_path": "assets/lockups/gsp-lockup-tide-transparent.svg",
      "group": "Stacked lockup",
      "for": "Tide, transparent. For White or Salt",
      "bytes": 22685,
      "needs_approval": false,
      "client_approved": false,
      "status": "Decided by CALO&CO"
    },
    {
      "name": "gsp-lockup-horizontal-slate-transparent.svg",
      "path": "assets/lockups/gsp-lockup-horizontal-slate-transparent.svg",
      "storage_path": "assets/lockups/gsp-lockup-horizontal-slate-transparent.svg",
      "group": "Horizontal lockup (proposed, not reviewed)",
      "for": "One-line lockup. Proposed only. Use not decided",
      "bytes": 23040,
      "needs_approval": true,
      "client_approved": false,
      "status": "Proposed",
      "status_note": "Appeared only in the case-study mock. Never reviewed on its own."
    },
    {
      "name": "gsp-lockup-horizontal-white-transparent.svg",
      "path": "assets/lockups/gsp-lockup-horizontal-white-transparent.svg",
      "storage_path": "assets/lockups/gsp-lockup-horizontal-white-transparent.svg",
      "group": "Horizontal lockup (proposed, not reviewed)",
      "for": "One-line lockup. Proposed only. Use not decided",
      "bytes": 23040,
      "needs_approval": true,
      "client_approved": false,
      "status": "Proposed",
      "status_note": "Appeared only in the case-study mock. Never reviewed on its own."
    },
    {
      "name": "gsp-lockup-horizontal-tide-transparent.svg",
      "path": "assets/lockups/gsp-lockup-horizontal-tide-transparent.svg",
      "storage_path": "assets/lockups/gsp-lockup-horizontal-tide-transparent.svg",
      "group": "Horizontal lockup (proposed, not reviewed)",
      "for": "One-line lockup. Proposed only. Use not decided",
      "bytes": 23040,
      "needs_approval": true,
      "client_approved": false,
      "status": "Proposed",
      "status_note": "Appeared only in the case-study mock. Never reviewed on its own."
    },
    {
      "name": "gsp-mark-slate.svg",
      "path": "assets/marks/gsp-mark-slate.svg",
      "storage_path": "assets/marks/gsp-mark-slate.svg",
      "group": "Mark",
      "for": "Slate, transparent. For White or Salt",
      "bytes": 16790,
      "needs_approval": false,
      "client_approved": false,
      "status": "Decided by CALO&CO"
    },
    {
      "name": "gsp-mark-white.svg",
      "path": "assets/marks/gsp-mark-white.svg",
      "storage_path": "assets/marks/gsp-mark-white.svg",
      "group": "Mark",
      "for": "White, transparent. For Wet slate only",
      "bytes": 16790,
      "needs_approval": false,
      "client_approved": false,
      "status": "Decided by CALO&CO"
    },
    {
      "name": "gsp-mark-tide.svg",
      "path": "assets/marks/gsp-mark-tide.svg",
      "storage_path": "assets/marks/gsp-mark-tide.svg",
      "group": "Mark",
      "for": "Tide, transparent. For White or Salt",
      "bytes": 16790,
      "needs_approval": false,
      "client_approved": false,
      "status": "Decided by CALO&CO"
    },
    {
      "name": "gsp-favicon.svg",
      "path": "assets/icons/gsp-favicon.svg",
      "storage_path": "assets/icons/gsp-favicon.svg",
      "group": "Icons (proposed, not reviewed)",
      "for": "Simplified mark. For use under 24px only",
      "bytes": 14425,
      "needs_approval": true,
      "client_approved": false,
      "status": "Proposed",
      "status_note": "Proposed in this handoff. Not reviewed."
    },
    {
      "name": "gsp-favicon-32.png",
      "path": "assets/icons/gsp-favicon-32.png",
      "storage_path": "assets/icons/gsp-favicon-32.png",
      "group": "Icons (proposed, not reviewed)",
      "for": "32 x 32",
      "bytes": 1459,
      "needs_approval": true,
      "client_approved": false,
      "status": "Proposed",
      "status_note": "Proposed in this handoff. Not reviewed."
    },
    {
      "name": "gsp-icon-180.png",
      "path": "assets/icons/gsp-icon-180.png",
      "storage_path": "assets/icons/gsp-icon-180.png",
      "group": "Icons (proposed, not reviewed)",
      "for": "180 x 180",
      "bytes": 6984,
      "needs_approval": true,
      "client_approved": false,
      "status": "Proposed",
      "status_note": "Proposed in this handoff. Not reviewed."
    },
    {
      "name": "gsp-icon-512.png",
      "path": "assets/icons/gsp-icon-512.png",
      "storage_path": "assets/icons/gsp-icon-512.png",
      "group": "Icons (proposed, not reviewed)",
      "for": "512 x 512",
      "bytes": 21055,
      "needs_approval": true,
      "client_approved": false,
      "status": "Proposed",
      "status_note": "Proposed in this handoff. Not reviewed."
    },
    {
      "name": "gsp-og-image.png",
      "path": "assets/social/gsp-og-image.png",
      "storage_path": "assets/social/gsp-og-image.png",
      "group": "Social (proposed, not reviewed)",
      "for": "Share image, 1200 x 630",
      "bytes": 35286,
      "needs_approval": true,
      "client_approved": false,
      "status": "Proposed",
      "status_note": "Proposed in this handoff. Not reviewed."
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
  ]
}$kit$::jsonb,
         updated_at = now()
   where id = gsp_brand;

  /*
    Three items added to the two already there, and only if they are not.

    open_items is a list somebody works through, so appending blindly would
    hand them the same three again every time this file is replayed. Matching
    on the item text is enough: these are sentences, not ids.
  */
  additions := $items$[
    {
      "item": "Present the identity to John for approval.",
      "why": "Nothing has been shown to or approved by the client."
    },
    {
      "item": "Choose a body font.",
      "why": "Archivo Narrow covers the logo and headlines only. Body and small text are not decided."
    },
    {
      "item": "Decide CMYK and Pantone values.",
      "why": "Needed before anything is printed."
    }
  ]$items$::jsonb;

  for item in select * from jsonb_array_elements(additions) loop
    if not exists (
      select 1 from public.brands b, jsonb_array_elements(coalesce(b.open_items, '[]'::jsonb)) o
       where b.id = gsp_brand and o->>'item' = item->>'item'
    ) then
      update public.brands
         set open_items = coalesce(open_items, '[]'::jsonb) || jsonb_build_array(item)
       where id = gsp_brand;
    end if;
  end loop;

  raise notice 'GSP logo rules and approval status written.';
end
$$;
