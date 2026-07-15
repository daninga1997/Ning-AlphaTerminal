export const tradeLevelConfig = {
  version: "trade-level-v1.0",
  supportClusterTolerancePercent: 3,
  watchZoneWidthPercent: 1.2,
  firstEntryPaddingPercent: 0.8,
  deepEntryAtrMultiplier: 1.1,
  chaseAtrMultiplier: 1.2,
  stopAtrMultiplier: 1.4,
  firstTargetRiskReward: 1.6,
  secondTargetRiskReward: 2.6,
} as const;
