// CALO&CO Portal Design System
// Single source of truth for all UI constants.
// Import from here instead of hardcoding values.

export const colors = {
  // Backgrounds
  pageBg: '#f4f5f7',
  cardBg: '#ffffff',
  surfaceBg: '#f9fafb',     // table headers, hover states
  placeholder: '#f1f3f5',   // empty logo boxes, skeleton states

  // Brand
  primaryBlue: '#2563eb',
  navBg: '#ffffff',

  // Text hierarchy
  textPrimary: '#111827',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',

  // Borders
  border: '#e5e7eb',
  borderLight: 'rgba(0,0,0,0.08)',

  // Semantic — status meaning only
  red: {
    bg: '#FEF2F2',
    border: 'rgba(252,165,165,0.27)',
    accent: '#DC2626',
    text: '#991B1B',
    textLight: '#B91C1C',
  },
  amber: {
    bg: '#FFFBEB',
    border: 'rgba(245,158,11,0.2)',
    accent: '#F59E0B',
    text: '#92400E',
    textLight: '#B45309',
    value: '#D97706',
  },
  green: {
    bg: '#ECFDF5',
    border: 'rgba(16,185,129,0.2)',
    accent: '#10B981',
    text: '#065F46',
    textLight: '#047857',
    value: '#16a34a',
  },
  blue: {
    bg: '#EFF6FF',
    border: 'rgba(59,130,246,0.2)',
    text: '#1E40AF',
  },
} as const;

export const spacing = {
  pagePadding: '32px 40px',
  cardPadding: '12px',
  cardPaddingLg: '16px',
  sectionGap: '24px',
  cardGap: '6px',
  metricGap: '8px',
} as const;

export const radii = {
  sm: '4px',
  md: '6px',
  default: '8px',
  lg: '12px',
} as const;

export const borders = {
  default: `0.5px solid #e5e7eb`,
  light: `0.5px solid rgba(0,0,0,0.08)`,
  accentLeft: (color: string) => `3px solid ${color}`,
} as const;

export const typography = {
  fontFamily: 'inherit',

  // Page titles
  h1: { fontSize: '20px', fontWeight: 500 },
  // Card/section titles
  h2: { fontSize: '16px', fontWeight: 500 },
  // Sub-headings
  h3: { fontSize: '14px', fontWeight: 500 },

  // Section labels (ACTION ITEMS, CLIENTS, RECENT, etc.)
  sectionLabel: {
    fontSize: '10px',
    fontWeight: 600,
    color: '#9ca3af',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    margin: '0 0 8px',
  },

  // Metric card label
  metricLabel: {
    fontSize: '10px',
    color: '#9ca3af',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.3px',
    margin: '0 0 2px',
  },

  // Metric card value
  metricValue: { fontSize: '20px', fontWeight: 500 },

  // Body text
  body: { fontSize: '13px', color: '#111827' },
  bodySmall: { fontSize: '12px', color: '#111827' },
  caption: { fontSize: '11px', color: '#9ca3af' },
  micro: { fontSize: '10px', color: '#9ca3af' },

  // Table header
  tableHeader: {
    fontSize: '10px',
    fontWeight: 600,
    color: '#9ca3af',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.3px',
  },
} as const;

export const layout = {
  sidebar: { width: '200px', bg: '#ffffff' },
  topBar: { height: '48px', bg: '#ffffff' },
  dashboard: {
    leftFlex: 3,
    rightFlex: 2,
    gap: '24px',
  },
} as const;

// Reusable component style objects
export const cardStyles = {
  base: {
    background: colors.cardBg,
    border: borders.default,
    borderRadius: radii.default,
    padding: spacing.cardPadding,
  },
  metric: {
    background: colors.cardBg,
    border: borders.default,
    borderRadius: radii.default,
    padding: spacing.cardPadding,
    cursor: 'pointer' as const,
  },
  clientRow: {
    background: colors.cardBg,
    border: borders.default,
    borderRadius: radii.default,
    padding: '10px 12px',
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: '10px',
    cursor: 'pointer' as const,
  },
  actionItem: (urgencyBg: string, urgencyBorder: string, accentColor: string) => ({
    background: urgencyBg,
    border: `0.5px solid ${urgencyBorder}`,
    borderLeft: `3px solid ${accentColor}`,
    borderRadius: radii.md,
    padding: '10px 14px',
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    cursor: 'pointer' as const,
  }),
  moduleTitle: {
    background: colors.cardBg,
    border: borders.default,
    borderRadius: radii.default,
    padding: '14px',
    textAlign: 'center' as const,
    cursor: 'pointer' as const,
  },
} as const;

// === DARK THEME TOKENS (Brief 30+31) — use `useTheme().t` for dynamic tokens ===
export const tokens = {
  bg: {
    primary: '#111113',
    surface: '#1a1a1d',
    surfaceHover: '#222225',
    elevated: '#222225',
    sidebar: '#111113',
  },
  border: {
    default: 'rgba(255, 255, 255, 0.08)',
    hover: 'rgba(255, 255, 255, 0.15)',
    active: 'rgba(255, 255, 255, 0.2)',
  },
  text: {
    primary: '#f5f5f5',
    secondary: '#8a8a8d',
    tertiary: '#5a5a5d',
    inverse: '#111113',
  },
  accent: {
    primary: '#0ea5e9',
    primaryHover: '#38bdf8',
    subtle: 'rgba(14, 165, 233, 0.08)',
    text: '#38bdf8',
  },
  status: {
    success: '#00c853',
    warning: '#ffab00',
    danger: '#ff3d3d',
    info: '#4da6ff',
  },
  radius: { sm: '6px', md: '8px', lg: '12px' },
  shadow: {
    card: '0 1px 2px rgba(0, 0, 0, 0.3)',
    elevated: '0 4px 12px rgba(0, 0, 0, 0.4)',
  },
} as const;

// Status pill styles
export const pillStyles = {
  unpaid: {
    fontSize: '10px',
    padding: '2px 8px',
    borderRadius: '10px',
    background: colors.amber.bg,
    color: colors.amber.text,
  },
  paid: {
    fontSize: '10px',
    padding: '2px 8px',
    borderRadius: '10px',
    background: colors.green.bg,
    color: colors.green.text,
  },
  overdue: {
    fontSize: '10px',
    padding: '2px 8px',
    borderRadius: '10px',
    background: colors.red.bg,
    color: colors.red.text,
  },
  badge: (bg: string, color: string) => ({
    fontSize: '9px',
    background: bg,
    color: color,
    padding: '1px 6px',
    borderRadius: '10px',
    fontWeight: 500,
    flexShrink: 0,
  }),
} as const;
