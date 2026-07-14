import { colors } from './colors';

export const signalKeys = ['buy', 'wait', 'hold', 'reduce', 'avoid'] as const;

export type SignalKey = (typeof signalKeys)[number];

export const signals = {
  buy: {
    label: '可以买',
    color: colors.success,
    background: 'rgba(34, 197, 94, 0.12)',
    border: 'rgba(34, 197, 94, 0.28)',
  },
  wait: {
    label: '等待',
    color: colors.warning,
    background: 'rgba(245, 158, 11, 0.12)',
    border: 'rgba(245, 158, 11, 0.28)',
  },
  hold: {
    label: '持股',
    color: colors.primary,
    background: 'rgba(79, 140, 255, 0.12)',
    border: 'rgba(79, 140, 255, 0.28)',
  },
  reduce: {
    label: '减仓',
    color: colors.warning,
    background: 'rgba(245, 158, 11, 0.12)',
    border: 'rgba(245, 158, 11, 0.28)',
  },
  avoid: {
    label: '回避',
    color: colors.danger,
    background: 'rgba(239, 68, 68, 0.12)',
    border: 'rgba(239, 68, 68, 0.28)',
  },
} satisfies Record<
  SignalKey,
  {
    label: string;
    color: string;
    background: string;
    border: string;
  }
>;
