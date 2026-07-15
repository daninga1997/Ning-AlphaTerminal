import { trendSwingConfig } from "../config/trend-swing-config";
import { marketFactor } from "../factors/market-factors";
import { sectorFactor, sectorInvalidReasons } from "../factors/sector-factors";
import { trendFactor, movingAverages, maxDrawdownPercent } from "../factors/trend-factors";
import { momentumFactor } from "../factors/momentum-factors";
import { volumeFactor } from "../factors/volume-factors";
import { commonDataInvalidReasons } from "../strategy-guard";
import type { StrategyDefinition, StrategyInput } from "../types/strategy";
import { factor } from "../types/factor";
import { buildStrategyResult } from "./strategy-result-factory";

export const trendSwingStrategy: StrategyDefinition = {
  id: "trend_swing_v1",
  name: "趋势波段",
  version: trendSwingConfig.version,
  run(input: StrategyInput) {
    const ma = movingAverages(input.dailyBars);
    const drawdown = maxDrawdownPercent(input.dailyBars);
    const trendOk = ma.ma20 !== null && ma.ma60 !== null && ma.ma20 > ma.ma60;
    const drawdownOk = drawdown <= trendSwingConfig.maxDrawdownPercent;
    const invalidReasons = [
      ...commonDataInvalidReasons(input, { needsDaily: trendSwingConfig.minDailyBars }),
      ...sectorInvalidReasons(input, trendSwingConfig.minSectorScore),
      ...(trendOk ? [] : ["MA20未高于MA60"]),
      ...(drawdownOk ? [] : ["最大回撤过大"]),
    ];
    const factors = [
      marketFactor(input, 10),
      sectorFactor(input, 20),
      trendFactor(input.dailyBars, 25),
      momentumFactor(input.dailyBars, 15),
      volumeFactor(input.dailyBars, 15),
      factor("drawdown_risk", "回撤风险", drawdown, drawdownOk ? 10 : 2, 10, "daily-bars", "近区间最大回撤"),
      factor("risk_reward_placeholder", "风险收益比", 1.6, 4, 5, "trade-levels", "入场计划生成后复核"),
    ];
    return buildStrategyResult(input, {
      strategyId: "trend_swing_v1",
      strategyName: "趋势波段",
      strategyVersion: trendSwingConfig.version,
      score: factors.reduce((sum, item) => sum + item.score, 0),
      factors,
      matchedConditions: trendOk ? ["MA20高于MA60", "中期趋势向上"] : [],
      failedConditions: trendOk ? [] : ["中期趋势不足"],
      warnings: ["波段计划需等待回踩或突破确认"],
      invalidReasons,
      holdingPeriod: "5-20个交易日",
    });
  },
};
