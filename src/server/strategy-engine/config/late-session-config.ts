export const lateSessionConfig = {
  version: "late-session-momentum-v1.0",
  minGainPercent: 2.5,
  maxGainPercent: 6,
  minTurnoverRate: 5,
  maxTurnoverRate: 15,
  startMinute: "14:30",
  latestEntryMinute: "14:55",
  minTailVolumeRatio: 1.15,
  maxLast15MinuteJumpPercent: 3,
  // 拿不到分钟线时，允许用收盘后的日线数据确认尾盘趋势（涨幅 + 当日量/20日均量）
  allowDailyCloseConfirmation: true,
  minDailyVolumeRatio: 1.1,
  minSectorScore: 55,
} as const;
