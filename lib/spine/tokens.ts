/**
 * Design tokens.
 *
 * Back to the original dark direction. The Carta-inspired light theme is
 * parked, not discarded — see docs/design-directions.md for the palette and
 * the reasoning, so picking it back up later is a token swap rather than
 * archaeology.
 */

export const C = {
  bg: '#111113',
  panel: '#18181b',
  panelAlt: '#1f1f23',
  rail: '#18181b',
  ink: '#f5f5f5',

  text: '#f5f5f5',
  dim: '#9b9ba3',
  faint: '#6b6b73',

  border: '#2a2a30',
  borderStrong: '#3a3a42',

  accent: '#3b82f6',
  accentSoft: '#1e3a5f',

  green: '#22c55e',
  greenSoft: '#12281a',
  amber: '#f59e0b',
  amberSoft: '#2a1f08',
  red: '#ef4444',
  redSoft: '#2a1414',
  blue: '#3b82f6',
  blueSoft: '#15233d',
} as const;

/** Headings use the body face. The serif experiment is parked. */
export const SERIF = 'inherit';

export const radius = {
  sm: 5,
  md: 7,
  lg: 10,
} as const;
