export const commonStrategyConfig = {
  version: "alpha-strategy-common-v1",
  marketScore: {
    blockShortTermBelow: 40,
    observeBelow: 55,
    selectiveBelow: 70,
    normalBelow: 85,
    partialPositionCap: 20,
  },
  sectorScore: {
    mainline: 85,
    strong: 70,
    rotation: 55,
    weak: 40,
  },
  grades: {
    S: 90,
    A: 80,
    B: 65,
    C: 45,
  },
} as const;
