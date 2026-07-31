import { lateSessionConfig } from "../config/late-session-config";
import { marketFactor, marketInvalidReasons } from "../factors/market-factors";
import { sectorFactor, sectorInvalidReasons } from "../factors/sector-factors";
import { trendFactor } from "../factors/trend-factors";
import { lateSessionFactor, hasLateSessionWindow } from "../factors/late-session-factors";
import { averageVolume } from "../factors/volume-factors";
import { commonDataInvalidReasons } from "../strategy-guard";
import type { MarketDailyBar } from "@/types/market-data";
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
    // 分钟线缺失时切换到“收盘后日线确认”模式：用当日量能代替 14:30 分钟量能
    const closeConfirmMode = input.minuteBars.length === 0 && lateSessionConfig.allowDailyCloseConfirmation;
    const volumeRatio = latestVolumeRatio(input.dailyBars);
    const dailyVolumeOk = volumeRatio !== null && volumeRatio >= lateSessionConfig.minDailyVolumeRatio;
    const invalidReasons = [
      ...commonDataInvalidReasons(input, { needsDaily: 120, needsMinute: !closeConfirmMode, shortTerm: true }),
      ...marketInvalidReasons(input, true),
      ...sectorInvalidReasons(input, lateSessionConfig.minSectorScore),
      ...(closeConfirmMode
        ? dailyVolumeOk
          ? []
          : ["收盘量能不足（低于20日均量1.1倍）"]
        : lateWindowOk
          ? []
          : ["缺少14:30后分钟数据"]),
      ...(gainOk ? [] : ["当日涨幅不在2.5%-6%"]),
    ];
    const factors = [
      marketFactor(input, 15),
      sectorFactor(input, 20),
      trendFactor(input.dailyBars, 20),
      factor("intraday_price", "当日量价", input.quote?.changePercent ?? null, gainOk && turnoverOk ? 15 : 6, 15, "quote", "涨幅与换手区间"),
      closeConfirmMode
        ? factor("close_volume_confirm", "收盘量能确认", volumeRatio, dailyVolumeOk ? 20 : Math.round(20 * (volumeRatio ?? 0) * 0.6), 20, "daily-bars", `当日量/20日均量 ${volumeRatio ?? "-"}`)
        : lateSessionFactor(input.minuteBars, 20),
      factor("risk_reward_placeholder", "风险收益比", 1.6, 8, 10, "trade-levels", "入场计划生成后复核"),
    ];
    return buildStrategyResult(input, {
      strategyId: "late_session_momentum_v1",
      strategyName: "尾盘趋势确认",
      strategyVersion: lateSessionConfig.version,
      score: factors.reduce((sum, item) => sum + item.score, 0),
      factors,
      matchedConditions: closeConfirmMode
        ? ["收盘后日线确认（无分钟线）", "收盘量能增强"]
        : lateWindowOk
          ? ["14:30后分钟数据存在", "尾盘量能增强"]
          : [],
      failedConditions: closeConfirmMode
        ? dailyVolumeOk
          ? []
          : ["收盘量能不足"]
        : lateWindowOk
          ? []
          : ["缺少14:30后分钟数据"],
      warnings: [
        ...(closeConfirmMode ? ["分钟线缺失，已切换为收盘后日线确认模式"] : []),
        "本策略默认只生成尾盘试仓和次日退出计划",
      ],
      invalidReasons,
      holdingPeriod: closeConfirmMode ? "收盘确认，次一交易日按计划执行" : "尾盘至下一交易日",
    });
  },
};

function latestVolumeRatio(bars: MarketDailyBar[]): number | null {
  const latest = bars.at(-1);
  const avg20 = averageVolume(bars, 20);
  if (!latest || !avg20 || avg20 <= 0) return null;
  return Math.round((latest.volume / avg20) * 100) / 100;
}
