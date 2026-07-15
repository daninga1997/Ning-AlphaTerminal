import { factor } from "../types/factor";

export function riskRewardFactor(riskRewardRatio: number, maxScore: number) {
  const score = riskRewardRatio >= 2 ? maxScore : riskRewardRatio >= 1.5 ? maxScore * 0.8 : riskRewardRatio >= 1.2 ? maxScore * 0.45 : 0;
  return factor("risk_reward", "风险收益比", Number(riskRewardRatio.toFixed(2)), score, maxScore, "trade-levels", "第一目标收益/止损距离");
}
