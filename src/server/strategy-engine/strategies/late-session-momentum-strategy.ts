import { lateSessionConfig } from "../config/late-session-config";
import { marketFactor, marketInvalidReasons } from "../factors/market-factors";
import { sectorFactor, sectorInvalidReasons } from "../factors/sector-factors";
import { trendFactor } from "../factors/trend-factors";
import { lateSessionFactor, hasLateSessionWindow } from "../factors/late-session-factors";
import { commonDataInvalidReasons } from "../strategy-guard";
import type { StrategyDefinition, StrategyInput } from "../types/strategy";
import { factor } from "../types/factor";
import { buildStrategyResult } from "./strategy-result-factory";

export const lateSessionMomentumStrategy: StrategyDefinition = {
  id: "late_session_momentum_v1",
  name: "尾盘趋势确认",
  version: lateSessionConfig.version,
  run(input: StrategyInput) {
    const gainOk = input.quote ? input.quote.changePercent >= lateSessionConfig.minGainPercent && input.quote.changePercent <= lateSessionConfig.maxGainPercent : false;
    const turnoverOk = input.quote ? input.quote.turnoverRate >= lateSessionConfig.minTurnoverRate && input.quote.turnoverRate <= lateSessionConfig.maxTurnoverRate : false;
    const lateWindowOk = hasLateSessionWindow(input.minuteBars);
    const invalidReasons = [
      ...commonDataInvalidReasons(input, { needsDaily: 120, needsMinute: true, shortTerm: true }),
      ...marketInvalidReasons(input, true),
      ...sectorInvalidReasons(input, lateSessionConfig.minSectorScore),
      ...(lateWindowOk ? [] : ["缺少14:30后分钟数据"]),
      ...(gainOk ? [] : ["当日涨幅不在2.5%-6%"]),
    ];
    const factors = [
      marketFactor(input, 15),
      sectorFactor(input, 20),
      trendFactor(input.dailyBars, 20),
      factor("intraday_price", "当日量价", input.quote?.changePercent ?? null, gainOk && turnoverOk ? 15 : 6, 15, "quote", "涨幅与换手区间"),
      lateSessionFactor(input.minuteBars, 20),
      factor("risk_reward_placeholder", "风险收益比", 1.6, 8, 10, "trade-levels", "入场计划生成后复核"),
    ];
    return buildStrategyResult(input, {
      strategyId: "late_session_momentum_v1",
      strategyName: "尾盘趋势确认",
      strategyVersion: lateSessionConfig.version,
      score: factors.reduce((sum, item) => sum + item.score, 0),
      factors,
      matchedConditions: lateWindowOk ? ["14:30后分钟数据存在", "尾盘量能增强"] : [],
      failedConditions: lateWindowOk ? [] : ["缺少14:30后分钟数据"],
      warnings: ["本策略默认只生成尾盘试仓和次日退出计划"],
      invalidReasons,
      holdingPeriod: "尾盘至下一交易日",
    });
  },
};
