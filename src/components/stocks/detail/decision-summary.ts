import type { ScoreResult } from "@/types/scoring";
import type { StockAnalysis, StockSignal } from "@/types/stock";
import { getSignalPresentation } from "../../../lib/presentation/signal-presentation";

type DecisionInput = Pick<StockAnalysis, "signal" | "shortTermScore" | "midTermScore" | "tradeLevels">;

export type DecisionSummary = {
  actionLabel: string;
  summary: string;
  isOpenAllowed: boolean;
};

export function getEffectiveActionLabel({
  signal,
  riskRewardRatio,
  invalidReason,
}: {
  signal: StockSignal;
  riskRewardRatio: number;
  invalidReason: string | null;
}): string {
  if (invalidReason || riskRewardRatio < 1.5) return "当前不开仓";
  return getSignalPresentation(signal).chineseLabel;
}

function hasSevereWarning(score: ScoreResult<string>): boolean {
  return score.warnings.some((warning) => warning.includes("追高") || warning.includes("风险收益比"));
}

export function getDecisionSummary(stock: DecisionInput): DecisionSummary {
  const { signal, shortTermScore, midTermScore, tradeLevels } = stock;
  const actionLabel = getEffectiveActionLabel({
    signal,
    riskRewardRatio: tradeLevels.riskRewardRatio,
    invalidReason: tradeLevels.invalidReason,
  });
  const isOpenAllowed = actionLabel !== "当前不开仓" && signal === "buy";

  if (tradeLevels.invalidReason || tradeLevels.riskRewardRatio < 1.5) {
    return {
      actionLabel,
      isOpenAllowed: false,
      summary: `风险收益比不足，${tradeLevels.invalidReason ?? "当前计划无效"}，暂不建议开仓。`,
    };
  }

  if (signal === "buy" && shortTermScore.total >= 80 && midTermScore.total >= 70) {
    return {
      actionLabel,
      isOpenAllowed,
      summary: "趋势结构保持完整，可等待第一建仓区。",
    };
  }

  if (signal === "buy" && hasSevereWarning(shortTermScore)) {
    return {
      actionLabel,
      isOpenAllowed,
      summary: "短线动量偏强，但当前位置不适合追高。",
    };
  }

  if (signal === "wait") {
    return {
      actionLabel,
      isOpenAllowed: false,
      summary: "条件尚未完全确认，等待回踩或量能进一步配合。",
    };
  }

  if (signal === "hold") {
    return {
      actionLabel,
      isOpenAllowed: false,
      summary: "已进入跟踪状态，继续按既定计划观察止损与目标。",
    };
  }

  if (signal === "reduce") {
    return {
      actionLabel,
      isOpenAllowed: false,
      summary: "风险信号升高，优先降低仓位并等待结构重新确认。",
    };
  }

  return {
    actionLabel,
    isOpenAllowed: false,
    summary: "技术结构或风险条件不满足，当前回避。",
  };
}
