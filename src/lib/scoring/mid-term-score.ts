import type { IndicatorSnapshot } from "@/types/market";
import type { MidTermGrade, ScoreBreakdownItem, ScoreResult } from "@/types/scoring";

type MidTermInput = {
  indicators: IndicatorSnapshot;
  sectorScore: number;
};

const calculatedAt = new Date().toISOString();

function clamp(score: number, maxScore: number): number {
  return Math.max(0, Math.min(maxScore, Math.round(score)));
}

function gradeFromTotal(total: number): MidTermGrade {
  if (total >= 85) return "strong";
  if (total >= 70) return "holding";
  if (total >= 55) return "watch";
  return "weak";
}

export function calculateMidTermScore({
  indicators,
  sectorScore,
}: MidTermInput): ScoreResult<MidTermGrade> {
  const reasons: string[] = [];
  const warnings: string[] = [];
  const sector = clamp((sectorScore / 100) * 20, 20);
  let trend = 0;
  let cycle = 0;
  let drawdown = 0;
  let structure = 0;

  if (indicators.sma20 !== null && indicators.sma60 !== null) {
    if (indicators.sma20 > indicators.sma60) {
      trend += 12;
      reasons.push("MA20 高于 MA60，中期趋势结构较好。");
    } else {
      warnings.push("MA20 未站上 MA60，中期趋势仍需观察。");
    }
  }
  if (indicators.change60 !== null) {
    if (indicators.change60 > 18) trend += 9;
    else if (indicators.change60 > 5) trend += 6;
    else if (indicators.change60 < -5) warnings.push("近 60 日涨跌幅偏弱。");
  }
  if (indicators.macd !== null && indicators.macd.dif > indicators.macd.dea) trend += 4;

  if (indicators.high20 !== null && indicators.low20 !== null && indicators.sma20 !== null) {
    const range = indicators.high20 - indicators.low20;
    const position = range > 0 ? (indicators.sma20 - indicators.low20) / range : 0.5;
    if (position >= 0.45 && position <= 0.85) cycle = 16;
    else if (position > 0.85) {
      cycle = 12;
      warnings.push("价格接近 20 日高位，注意阶段性过热。");
    } else {
      cycle = 8;
    }
  }

  if (indicators.maxDrawdown !== null) {
    if (indicators.maxDrawdown <= 12) drawdown = 15;
    else if (indicators.maxDrawdown <= 22) drawdown = 10;
    else {
      drawdown = 5;
      warnings.push("最大回撤较大，中线风险分下降。");
    }
  }

  if (indicators.volumeRatio20 !== null) {
    if (indicators.volumeRatio20 >= 0.8 && indicators.volumeRatio20 <= 2.5) structure += 9;
    if (indicators.volumeRatio20 > 3) {
      structure += 4;
      warnings.push("量能过度放大，可能存在筹码松动。");
    }
  }
  if (indicators.change20 !== null && indicators.change60 !== null) {
    if (indicators.change20 > 0 && indicators.change60 > 0) structure += 7;
    if (indicators.change20 < -8) warnings.push("近 20 日表现偏弱。");
  }
  if (indicators.kdj !== null && indicators.kdj.k > indicators.kdj.d && indicators.kdj.k < 90)
    structure += 4;

  trend = clamp(trend, 25);
  cycle = clamp(cycle, 20);
  drawdown = clamp(drawdown, 15);
  structure = clamp(structure, 20);

  const breakdown: ScoreBreakdownItem[] = [
    {
      key: "sector",
      label: "板块和产业逻辑",
      score: sector,
      maxScore: 20,
      reason: "当前没有真实基本面，使用模拟板块评分。",
      isDemoInput: true,
    },
    {
      key: "trend",
      label: "中期趋势",
      score: trend,
      maxScore: 25,
      reason: "参考 MA20/MA60、60 日涨跌幅和 MACD。",
    },
    {
      key: "cycle",
      label: "周期位置",
      score: cycle,
      maxScore: 20,
      reason: "参考价格在近 20 日高低区间的位置。",
    },
    {
      key: "drawdown",
      label: "波动和回撤",
      score: drawdown,
      maxScore: 15,
      reason: "参考最大回撤。",
    },
    {
      key: "structure",
      label: "筹码及量价结构代理指标",
      score: structure,
      maxScore: 20,
      reason: "用量比、20/60 日表现和 KDJ 做代理。",
    },
  ];
  const total = breakdown.reduce((sum, item) => sum + item.score, 0);

  return {
    total,
    grade: gradeFromTotal(total),
    breakdown,
    reasons,
    warnings,
    calculatedAt,
  };
}
