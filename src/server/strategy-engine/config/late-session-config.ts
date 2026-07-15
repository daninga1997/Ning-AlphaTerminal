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
  minSectorScore: 55,
} as const;
