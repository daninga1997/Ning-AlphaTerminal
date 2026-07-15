export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function percentChange(current: number, previous: number): number {
  if (previous === 0) return 0;
  return round2(((current - previous) / previous) * 100);
}
