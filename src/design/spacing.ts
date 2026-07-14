export const spacing = {
  4: '4px',
  8: '8px',
  12: '12px',
  16: '16px',
  20: '20px',
  24: '24px',
  32: '32px',
  40: '40px',
  48: '48px',
  64: '64px',
} as const;

export const layoutSpacing = {
  iconGap: spacing[8],
  controlGap: spacing[8],
  compactPadding: spacing[12],
  cardPadding: spacing[16],
  cardGap: spacing[20],
  sectionGap: spacing[32],
  pageGap: spacing[40],
  wideGap: spacing[64],
} as const;

export type SpacingToken = keyof typeof spacing;
export type LayoutSpacingToken = keyof typeof layoutSpacing;
