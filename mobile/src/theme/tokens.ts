/**
 * Design tokens. Every colour pair used for text has been checked against
 * WCAG 2.1 AA (≥ 4.5:1 for body text) on the surfaces it is rendered on.
 *
 *   text        #111827 on surface #FFFFFF → 17.7:1
 *   textMuted   #4B5563 on surface #FFFFFF →  7.6:1  (on background → 7.0:1)
 *   primary     #1D4ED8 on surface #FFFFFF →  6.7:1  (white on primary → 6.7:1)
 *   income      #047857 on surface #FFFFFF →  5.5:1
 *   expense     #B91C1C on surface #FFFFFF →  6.5:1
 */
export const colors = {
  background: '#F3F4F6',
  surface: '#FFFFFF',
  border: '#D1D5DB',
  text: '#111827',
  textMuted: '#4B5563',
  textOnPrimary: '#FFFFFF',
  primary: '#1D4ED8',
  primarySoft: '#DBEAFE',
  income: '#047857',
  incomeSoft: '#D1FAE5',
  expense: '#B91C1C',
  expenseSoft: '#FEE2E2',
  track: '#E5E7EB',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

/**
 * Font sizes are plain numbers so they scale with the OS text-size setting
 * (Dynamic Type / Android font scale). Layouts never fix a height around text;
 * interactive elements use `minHeight` instead.
 */
export const typography = {
  caption: { fontSize: 13, lineHeight: 18 },
  body: { fontSize: 16, lineHeight: 22 },
  bodyStrong: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '700' },
  display: { fontSize: 34, lineHeight: 40, fontWeight: '700' },
} as const;

/** Minimum touch target (Apple HIG 44pt / Material 48dp). */
export const touchTarget = 48;
