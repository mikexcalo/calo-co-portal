/**
 * Design tokens.
 *
 * Light. Plain and functional on purpose — the visual direction is a later
 * pass, and the parked Carta palette lives in docs/design-directions.md.
 * This is meant to be legible and unremarkable so the plumbing can be judged
 * without paint in the way.
 */

export const C = {
  bg: '#F7F7F5',
  panel: '#FFFFFF',
  panelAlt: '#F2F2EF',
  rail: '#FFFFFF',
  ink: '#141414',

  text: '#1A1A1A',
  // Contrast-checked against both #FFFFFF and the #F7F7F5 page background.
  // The old faint (#8A8A88) came out at 3.2:1 — below the 4.5:1 minimum for
  // body text, which is exactly why labels were hard to read.
  dim: '#4A4A4A',    // 8.3:1
  faint: '#6B6B68',  // 5.0:1

  border: '#E4E4E0',
  borderStrong: '#C4C4BE',

  accent: '#2563EB',
  accentSoft: '#EEF3FD',

  green: '#15803D',
  greenSoft: '#EDF6F0',
  amber: '#B45309',
  amberSoft: '#FDF4E7',
  red: '#B91C1C',
  redSoft: '#FBEDED',
  blue: '#2563EB',
  blueSoft: '#EEF3FD',
} as const;

export const SERIF = 'inherit';

export const radius = {
  sm: 5,
  md: 7,
  lg: 10,
} as const;
