export const shadow = {
  card: '0 1px 2px rgba(0, 0, 0, 0.24)',
  popup: '0 16px 40px rgba(0, 0, 0, 0.42)',
  hover: '0 8px 24px rgba(0, 0, 0, 0.28)',
} as const;

export type ShadowToken = keyof typeof shadow;
