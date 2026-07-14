import { colors, primitiveColors } from './colors';
import { layoutSpacing, spacing } from './spacing';
import { typography } from './typography';
import { radius } from './radius';
import { shadow } from './shadow';
import { signals } from './signals';

export const breakpoints = {
  mobile: '0px',
  tablet: '640px',
  laptop: '1024px',
  desktop: '1280px',
} as const;

export const layout = {
  headerHeight: '56px',
  sidebarWidth: '240px',
  rightRailWidth: '320px',
  containerMaxWidth: '1440px',
  contentPaddingDesktop: spacing[32],
  contentPaddingMobile: spacing[16],
  cardMinWidth: '280px',
  cardIdealWidth: '360px',
  gridColumnsDesktop: 12,
  gridColumnsTablet: 8,
  gridColumnsMobile: 4,
} as const;

export const animation = {
  durationFast: '120ms',
  durationNormal: '180ms',
  durationSlow: '240ms',
  easing: 'cubic-bezier(0.2, 0, 0, 1)',
} as const;

export const icon = {
  xs: '12px',
  sm: '16px',
  md: '20px',
  lg: '24px',
  defaultSize: '16px',
  buttonGap: spacing[8],
} as const;

export const alphaTheme = {
  name: 'alpha-terminal-dark',
  colors,
  primitiveColors,
  spacing,
  layoutSpacing,
  typography,
  radius,
  shadow,
  signals,
  layout,
  breakpoints,
  animation,
  icon,
} as const;

export type BreakpointToken = keyof typeof breakpoints;
export type LayoutToken = keyof typeof layout;
export type AnimationToken = keyof typeof animation;
export type IconToken = keyof typeof icon;
