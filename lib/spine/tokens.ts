import type React from 'react';

/**
 * Design tokens.
 *
 * Greyscale, deliberately. This product holds other people's brands, so it has
 * no brand color of its own on screen: color means state, or it belongs to a
 * client. See the note on accent below.
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
   * There is no accent color.
   *
   * The platform was carrying CALO&CO's own blue on every button, every link,
   * every active tab, in an app whose entire job is holding other people's
   * brands. Colette's green, Mammoth's ochre and a seafood importer's identity
   * all sat inside a blue frame that belonged to none of them, and the frame
   * was the loudest thing on the screen.
   *
   * So the interface is greyscale, and color is reserved for two things only.
   *
   * MEANING. Green is settled, amber needs you, red is wrong. Three words,
   * never decoration, so a colored thing on a grey screen is always worth
   * looking at.
   *
   * THE CLIENT. Their logo, their swatches, their photographs. The only
   * decorative color in the product comes from what has been put into it,
   * which is the correct relationship: the software is the frame and the
   * client is the picture.
   *
   * Prominence replaces hue as the interactive signal. Body copy is grey,
   * actions are near-black, and the contrast between them does the work a
   * blue used to do. 15.9:1 on white, which no accent color ever manages.
   */
  accent: '#141414',
  accentSoft: '#F1F1F2',

  green: '#15803D',
  greenSoft: '#ECF6F0',
  amber: '#B45309',
  amberSoft: '#FDF4E8',
  red: '#B91C1C',
  redSoft: '#FCEDED',
  /**
   * Inline actions: the same ink, named separately because it is used as text
   * rather than as a fill and the two may want to diverge later.
   */
  blue: '#141414',
  blueSoft: '#F1F1F2',
} as const;

/**
 * Display type.
 *
 * Was a serif. Polymarket carries its whole hierarchy on one grotesque and
 * varies weight and tracking instead, so headings now do the same — the
 * emphasis comes from -0.02em and 600, not from a second typeface.
 */
export const SERIF = 'inherit';

/**
 * Figtree for anything that titles something.
 *
 * One grotesque carried the whole hierarchy, with weight and tracking doing
 * the work a second face normally does. That is a reasonable way to build an
 * interface and it left every screen sounding the same. Figtree has more
 * character in its terminals and a rounder bowl than Inter, so a heading now
 * announces itself as a heading rather than as bolder body copy.
 *
 * Headings only. Inter keeps the paragraphs, the tables and every number,
 * because it is the better face for dense data and because two display faces
 * fighting over a table is how a product starts to look designed rather than
 * made.
 */
export const DISPLAY: React.CSSProperties = {
  fontFamily: 'var(--font-display), var(--font-sans), system-ui, sans-serif',
  fontWeight: 600,
  letterSpacing: '-0.021em',
};

export const radius = {
  sm: 5,
  md: 7,
  lg: 10,
} as const;
