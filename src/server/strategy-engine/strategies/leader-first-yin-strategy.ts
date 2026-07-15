import { leaderFirstYinConfig } from "../config/leader-first-yin-config";
import { marketFactor } from "../factors/market-factors";
import { sectorFactor, sectorInvalidReasons } from "../factors/sector-factors";
import { hasFirstYinRepairStructure, findRecentLaunchIndex } from "../factors/leader-factors";
import { volumeFactor } from "../factors/volume-factors";
import { riskRewardFactor } from "../factors/risk-factors";
import { commonDataInvalidReasons } from "../strategy-guard";
import type { StrategyDefinition, StrategyInput } from "../types/strategy";
import { factor } from "../types/factor";
import { buildStrategyResult } from "./strategy-result-factory";

export const leaderFirstYinStrategy: StrategyDefinition = {
  id: "leader_first_yin_v1",
  name: "龙头首阴修复",
  version: leaderFirstYinConfig.version,
  run(input: StrategyInput) {
    const launchIndex = findRecentLaunchIndex(input.dailyBars);
    const hasStructure = hasFirstYinRepairStructure(input.dailyBars);
    const invalidReasons = [
      ...commonDataInvalidReasons(input, { needsDaily: 20, shortTerm: true }),
      ...sectorInvalidReasons(input, leaderFirstYinConfig.minSectorScore),
      ...(hasStructure ? [] : ["未形成合法首阴修复结构"]),
    ];
    const factors = [
      marketFactor(input, 10),
      sectorFactor(input, 20),
      factor("leader_identity", "龙头/辨识度", launchIndex >= 0, launchIndex >= 0 ? 16 : 0, 20, "daily-bars", "20日内强启动"),
      factor("launch_quality", "启动质量", launchIndex >= 0, launchIndex >= 0 ? 12 : 0, 15, "daily-bars", "涨停或强启动质量"),
      factor("first_yin_acceptance", "首阴承接", hasStructure, hasStructure ? 18 : 0, 20, "daily-bars", "缩量首阴且支撑未破"),
      volumeFactor(input.dailyBars, 10),
      riskRewardFactor(1.6, 5),
    ];
    const score = factors.reduce((sum, item) => sum + item.score, 0);
    return buildStrategyResult(input, {
      strategyId: "leader_first_yin_v1",
      strategyName: "龙头首阴修复",
      strategyVersion: leaderFirstYinConfig.version,
      score,
      factors,
      matchedConditions: hasStructure ? ["20日内强启动", "首阴缩量承接", "修复确认"] : [],
      failedConditions: hasStructure ? [] : ["普通下跌或结构不完整"],
      warnings: ["buy_allowed不等于自动下单"],
      invalidReasons,
      holdingPeriod: "1-5个交易日",
    });
  },
};
