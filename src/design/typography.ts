export const fontFamily = {
  sans: [
    'Inter',
    'SF Pro Display',
    'SF Pro Text',
    'PingFang SC',
    'Microsoft YaHei',
    'Noto Sans SC',
    'system-ui',
    'sans-serif',
  ],
  mono: ['SF Mono', 'Roboto Mono', 'JetBrains Mono', 'Consolas', 'monospace'],
} as const;

export const fontSize = {
  pageTitle: '28px',
  sectionTitle: '20px',
  cardTitle: '16px',
  subtitle: '14px',
  body: '14px',
  smallBody: '13px',
  caption: '12px',
  label: '12px',
  button: '14px',
  number: '16px',
  largeNumber: '24px',
  stockCode: '12px',
  percent: '14px',
} as const;

export const lineHeight = {
  pageTitle: '36px',
  sectionTitle: '28px',
  cardTitle: '24px',
  subtitle: '22px',
  body: '22px',
  smallBody: '20px',
  caption: '18px',
  label: '16px',
  button: '20px',
  number: '22px',
  largeNumber: '30px',
  stockCode: '16px',
  percent: '20px',
} as const;

export const fontWeight = {
  regular: 400,
  medium: 500,
  semibold: 600,
  strong: 650,
} as const;

export const typography = {
  pageTitle: {
    fontSize: fontSize.pageTitle,
    lineHeight: lineHeight.pageTitle,
    fontWeight: fontWeight.strong,
  },
  sectionTitle: {
    fontSize: fontSize.sectionTitle,
    lineHeight: lineHeight.sectionTitle,
    fontWeight: fontWeight.semibold,
  },
  cardTitle: {
    fontSize: fontSize.cardTitle,
    lineHeight: lineHeight.cardTitle,
    fontWeight: fontWeight.semibold,
  },
  subtitle: {
    fontSize: fontSize.subtitle,
    lineHeight: lineHeight.subtitle,
    fontWeight: fontWeight.medium,
  },
  body: {
    fontSize: fontSize.body,
    lineHeight: lineHeight.body,
    fontWeight: fontWeight.regular,
  },
  smallBody: {
    fontSize: fontSize.smallBody,
    lineHeight: lineHeight.smallBody,
    fontWeight: fontWeight.regular,
  },
  caption: {
    fontSize: fontSize.caption,
    lineHeight: lineHeight.caption,
    fontWeight: fontWeight.regular,
  },
  label: {
    fontSize: fontSize.label,
    lineHeight: lineHeight.label,
    fontWeight: fontWeight.semibold,
  },
  button: {
    fontSize: fontSize.button,
    lineHeight: lineHeight.button,
    fontWeight: fontWeight.semibold,
  },
  number: {
    fontSize: fontSize.number,
    lineHeight: lineHeight.number,
    fontWeight: fontWeight.semibold,
    fontFamily: fontFamily.mono,
  },
  largeNumber: {
    fontSize: fontSize.largeNumber,
    lineHeight: lineHeight.largeNumber,
    fontWeight: fontWeight.strong,
    fontFamily: fontFamily.mono,
  },
  stockCode: {
    fontSize: fontSize.stockCode,
    lineHeight: lineHeight.stockCode,
    fontWeight: fontWeight.medium,
    fontFamily: fontFamily.mono,
  },
  percent: {
    fontSize: fontSize.percent,
    lineHeight: lineHeight.percent,
    fontWeight: fontWeight.strong,
    fontFamily: fontFamily.mono,
  },
} as const;

export type TypographyToken = keyof typeof typography;
