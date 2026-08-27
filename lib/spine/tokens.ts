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
  dim: '#5A5A5A',
  faint: '#8A8A88',

  border: '#E4E4E0',
  borderStrong: '#CFCFC9',

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
