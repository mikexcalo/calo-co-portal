/**
 * Design tokens — Carta-inspired.
 *
 * Editorial, unhurried, serious about money. The serif headline carries all
 * the personality; everything else stays quiet. One accent colour, used
 * sparingly, so that when something IS orange it means something.
 *
 * Light by default and only light. The old app carried a dark/light toggle
 * that doubled every colour decision and earned nothing.
 */

export const C = {
  // Surfaces — warm off-white, not clinical grey
  bg: '#FAF9F7',
  panel: '#FFFFFF',
  panelAlt: '#F5F3F0',
  rail: '#FFFFFF',
  ink: '#111111',

  // Text
  text: '#1A1A1A',
  dim: '#5C5C5C',
  faint: '#8A8A85',

  // Hairlines — the whole layout is built from these, so they stay light
  border: '#E6E3DE',
  borderStrong: '#D4D0C9',

  // The one accent
  accent: '#D2703A',
  accentSoft: '#FBF0E8',

  // Meaning colours. Muted on purpose — a red that shouts on a white page
  // makes every screen feel like an emergency.
  green: '#2F7D4F',
  greenSoft: '#EAF3ED',
  amber: '#B67A12',
  amberSoft: '#FBF3E3',
  red: '#B3392E',
  redSoft: '#FAECEA',
  blue: '#2C5F8A',
  blueSoft: '#EAF0F6',
} as const;

/** Applied to headings. Set in layout.tsx via next/font. */
export const SERIF = 'var(--font-serif), Georgia, "Times New Roman", serif';

export const radius = {
  sm: 4,
  md: 6,
  lg: 8,
} as const;
