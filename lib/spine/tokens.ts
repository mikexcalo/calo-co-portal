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
  // Cool greys taken from Polymarket's palette, with one deliberate
  // departure: their own muted grey is #A0A3B1, which reads at 2.5:1 on
  // white — below the 4.5:1 floor for body text and exactly the "I can't
  // read this" problem we already fixed twice. Structure and hue borrowed,
  // legibility kept.
  dim: '#444952',   //  9.1:1    // 11.3:1
  faint: '#646973', //  5.5:1  //  7.0:1 — well past the 4.5:1 floor, because passing
                     //  a threshold and being comfortable to read are not
                     //  the same thing.

  border: '#E7E8EB',
  borderStrong: '#DFE0E5',

  accent: '#2563EB',
  accentSoft: '#EEF2FF',

  green: '#15803D',
  greenSoft: '#ECF6F0',
  amber: '#B45309',
  amberSoft: '#FDF4E8',
  red: '#B91C1C',
  redSoft: '#FCEDED',
  blue: '#2563EB',
  blueSoft: '#EEF2FF',
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
