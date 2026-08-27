# Design directions

The current app is the dark direction. The light, Carta-inspired direction is
parked here so picking it back up later is a token swap, not archaeology.

---

## Parked: Carta-inspired light

Built 2026-08-26, reverted the same day — the direction was right but it was
early. Aesthetics come after the plumbing.

### What made it work

The serif headline does **all** the personality work and everything else shuts
up. One accent colour, used only for wayfinding — never on a button — so that
when something is orange it actually means something.

### Palette

```
bg           #FAF9F7   warm off-white, not clinical grey
panel        #FFFFFF
panelAlt     #F5F3F0
ink          #111111   solid black buttons
text         #1A1A1A
dim          #5C5C5C
faint        #8A8A85
border       #E6E3DE   hairlines; the whole layout is built from these
borderStrong #D4D0C9
accent       #D2703A   terracotta — wayfinding only
accentSoft   #FBF0E8

green #2F7D4F / #EAF3ED
amber #B67A12 / #FBF3E3
red   #B3392E / #FAECEA
blue  #2C5F8A / #EAF0F6
```

Meaning colours are muted on purpose: a red that shouts on a white page makes
every screen feel like an emergency.

### Type

- **Headings + figures** — `Source_Serif_4` from `next/font/google`, weights
  400/600, as `--font-serif`. Carta's own face reads like **Tiempos** (Klim),
  which is licensed; Source Serif 4 is the closest genuinely good free match.
- **Body** — Geist Sans, already in the project. Carta's body sans is
  essentially Inter; Geist sits in the same neutral-grotesque family.
- Headline scale was 32px / 400 weight / -0.01em, dropping to 26px on phones.
  Metric figures at 27px in the serif — a number set in a serif reads
  considered rather than generated.

### To restore

1. Copy the palette above into `lib/spine/tokens.ts`
2. Set `SERIF = 'var(--font-serif), Georgia, serif'`
3. Re-add the `Source_Serif_4` import in `app/layout.tsx`, put
   `serif.variable` on `<html>`, set the body background to `#FAF9F7`
4. `Button` primary back to `background: C.ink, color: '#fff'`
5. `Page` h1 and `Metric` value back to `fontFamily: SERIF` at the sizes above

Everything else is token-driven and follows automatically.

---

## Current: dark

The original direction. Near-black surfaces, blue primary, colour used for
status meaning only. It is not precious — it exists so the plumbing can be
judged without the paint distracting.
