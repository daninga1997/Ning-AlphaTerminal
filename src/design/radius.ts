export const radius = {
  card: '8px',
  button: '6px',
  input: '6px',
  badge: '999px',
} as const;

export type RadiusToken = keyof typeof radius;
