import type React from 'react';

/**
 * Design tokens.
 *
 * Light. Plain and functional on purpose — the visual direction is a later
 * pass, and the parked Carta palette lives in docs/design-directions.md.
 * This is meant to be legible and unremarkable so the plumbing can be judged
 * without paint in the way.
 */

export const C = {
  bg: '#FFFFFF',
  panel: '#FFFFFF',
  panelAlt: '#F4F5F6',
  rail: '#FFFFFF',
  ink: '#141414',

  text: '#1D1F24',
  // Contrast-checked against both #FFFFFF and the #F7F7F5 page background.
  // Cool grays taken from Polymarket's palette, with one deliberate
  // departure: their own muted gray is #A0A3B1, which reads at 2.5:1 on
  // white — below the 4.5:1 floor for body text and exactly the "I can't
  // read this" problem we already fixed twice. Structure and hue borrowed,
  // legibility kept.
  // Darkened a step toward how Carta sets a dense interface: body copy close
  // to black, and gray reserved for text that genuinely is secondary. Small
  // gray text everywhere is the default look of an admin panel nobody chose
  // to use, and it was the single thing making this read as a tool rather
  // than a product.
  dim: '#383D45',   // 10.9:1
  faint: '#5B6069', //  6.3:1 — well past the 4.5:1 floor, because passing
                    //  a threshold and being comfortable to read are not
                    //  the same thing.

  border: '#E7E8EB',
  borderStrong: '#DFE0E5',

  /**
   * CALO&CO's own call-to-action blue, taken from calo.company rather than
   * approximated. The previous value was a generic framework blue that looked
   * close and was not the brand.
   *
   * 4.66:1 with white text, which clears the 4.5 floor for buttons and links.
   */
  accent: '#006AFF',
  accentSoft: '#E8F1FF',

  green: '#15803D',
  greenSoft: '#ECF6F0',
  amber: '#B45309',
  amberSoft: '#FDF4E8',
  red: '#B91C1C',
  redSoft: '#FCEDED',
  /**
   * The same blue, darkened for text.
   *
   * #006AFF is right on a white button and wrong as small text on a pale blue
   * panel, where it measures 4.1:1 against the 4.5 floor. Rather than wash the
   * panel out until the maths passes, the fill stays exactly the brand blue
   * and the writing sits a few steps darker. Nobody reads the two as different
   * colors; everybody can read the second one.
   */
  blue: '#0052C9',
  blueSoft: '#E8F1FF',
} as const;

/**
 * Display type.
 *
 * Was a serif. Polymarket carries its whole hierarchy on one grotesque and
 * varies weight and tracking instead, so headings now do the same — the
 * emphasis comes from -0.02em and 600, not from a second typeface.
 */
export const SERIF = 'inherit';
export const DISPLAY: React.CSSProperties = {
  fontWeight: 600,
  letterSpacing: '-0.021em',
};

export const radius = {
  sm: 5,
  md: 7,
  lg: 10,
} as const;
