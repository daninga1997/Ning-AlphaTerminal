import type { IndicatorSnapshot } from "@/types/market";
import type { ScoreBreakdownItem, ScoreResult, ShortTermGrade } from "@/types/scoring";

type ShortTermInput = {
  indicators: IndicatorSnapshot;
  tradeLevels: {
    riskRewardRatio: number;
    invalidReason: string | null;
  };
  sectorScore: number;
};

const calculatedAt = new Date().toISOString();

function clamp(score: number, maxScore: number): number {
  return Math.max(0, Math.min(maxScore, Math.round(score)));
}

function gradeFromTotal(total: number, riskRewardRatio: number): ShortTermGrade {
  if (total >= 85 && riskRewardRatio >= 1.5) return "A";
  if (total >= 75) return "B";
  if (total >= 60) return "C";
  return "D";
}

export function calculateShortTermScore({
  indicators,
  tradeLevels,
  sectorScore,
}: ShortTermInput): ScoreResult<ShortTermGrade> {
  const reasons: string[] = [];
  const warnings: string[] = [];
  const latestCloseProxy = indicators.sma5;
  let sector = clamp((sectorScore / 100) * 20, 20);
  let trend = 0;
  let volume = 0;
  let momentum = 0;
  let riskReward = 0;

  if (sector >= 16) reasons.push("板块演示强度较高，对短线情绪有正向贡献。");

  if (
    latestCloseProxy !== null &&
    indicators.sma5 !== null &&
    indicators.sma10 !== null &&
    indicators.sma20 !== null
  ) {
    if (latestCloseProxy >= indicators.sma5) trend += 4;
    if (latestCloseProxy >= indicators.sma10) trend += 4;
    if (latestCloseProxy >= indicators.sma20) trend += 4;
    if (indicators.sma5 > indicators.sma10) trend += 4;
    if (indicators.sma10 > indicators.sma20) trend += 4;
    if (latestCloseProxy < indicators.sma20) {
      trend -= 8;
      warnings.push("价格弱于 MA20，短线趋势分下降。");
    }
  }

  if (indicators.volumeRatio20 !== null) {
    if (indicators.volumeRatio20 >= 1.2 && indicators.volumeRatio20 <= 2.5) {
      volume = 18;
      reasons.push("当前量能处于 20 日均量的 1.2 至 2.5 倍区间。");
    } else if (indicators.volumeRatio20 > 3) {
      volume = 12;
      warnings.push("当前量能超过 20 日均量 3 倍，存在高波动风险。");
    } else if (indicators.volumeRatio20 < 0.8) {
      volume = 7;
      warnings.push("缩量状态下不支持高短线评分。");
    } else {
      volume = 12;
    }
  }

  if (indicators.macd !== null) {
    if (
      indicators.macd.bullishCross ||
      indicators.macd.histogram > (indicators.macd.previousHistogram ?? -Infinity)
    ) {
      momentum += 7;
      reasons.push("MACD 金叉或红柱扩大。");
    }
  }
  if (indicators.kdj !== null) {
    if (indicators.kdj.k > indicators.kdj.d && indicators.kdj.k < 85) momentum += 6;
    if (indicators.kdj.k > 90) {
      momentum -= 3;
      warnings.push("KDJ 偏高，追涨容忍度降低。");
    }
  }
  if (indicators.rsi14 !== null) {
    if (indicators.rsi14 >= 50 && indicators.rsi14 <= 70) momentum += 7;
    if (indicators.rsi14 > 80) {
      momentum -= 6;
      warnings.push("RSI 超过 80，存在追高风险。");
    }
  }

  if (tradeLevels.riskRewardRatio >= 2) {
    riskReward = 20;
  } else if (tradeLevels.riskRewardRatio >= 1.5) {
    riskReward = 14;
  } else {
    riskReward = 6;
    warnings.push(tradeLevels.invalidReason ?? "风险收益比低于 1.5，不能获得 A 级。");
  }

  sector = clamp(sector, 20);
  trend = clamp(trend, 20);
  volume = clamp(volume, 20);
  momentum = clamp(momentum, 20);
  riskReward = clamp(riskReward, 20);

  const breakdown: ScoreBreakdownItem[] = [
    {
      key: "sector",
      label: "板块强度",
      score: sector,
      maxScore: 20,
      reason: "使用模拟板块强度输入。",
      isDemoInput: true,
    },
    {
      key: "trend",
      label: "价格趋势",
      score: trend,
      maxScore: 20,
      reason: "参考 MA5、MA10、MA20 和均线多头排列。",
    },
    {
      key: "volume",
      label: "成交量",
      score: volume,
      maxScore: 20,
      reason: "参考当前成交量相对 20 日均量比例。",
    },
    {
      key: "momentum",
      label: "动量指标",
      score: momentum,
      maxScore: 20,
      reason: "参考 MACD、KDJ、RSI14。",
    },
    {
      key: "riskReward",
      label: "风险收益比",
      score: riskReward,
      maxScore: 20,
      reason: "参考第一目标收益与止损距离之比。",
    },
  ];
  const total = breakdown.reduce((sum, item) => sum + item.score, 0);

  return {
    total,
    grade: gradeFromTotal(total, tradeLevels.riskRewardRatio),
    breakdown,
    reasons,
    warnings,
    calculatedAt,
  };
}
