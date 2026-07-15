import type { StrategyInput, StrategySectorSnapshot } from "../types/strategy";
import { factor } from "../types/factor";
import type { FactorBreakdownItem } from "../types/factor";

export function getPrimarySector(input: StrategyInput): StrategySectorSnapshot | null {
  return input.sectorSnapshots.find((sector) => input.sectorIds.includes(sector.sectorId)) ?? input.sectorSnapshots[0] ?? null;
}

export function getSectorScore(input: StrategyInput): number {
  return getPrimarySector(input)?.strengthScore ?? 0;
}

export function sectorState(score: number): string {
  if (score >= 85) return "主线";
  if (score >= 70) return "强势";
  if (score >= 55) return "轮动";
  if (score >= 40) return "偏弱";
  return "退潮";
}

export function sectorFactor(input: StrategyInput, maxScore: number): FactorBreakdownItem {
  const sector = getPrimarySector(input);
  const score = sector?.strengthScore ?? 0;
  return factor("sector_strength", "板块强度", score, Math.min(maxScore, Math.round((score / 100) * maxScore)), maxScore, sector?.source ?? "missing", `${sector?.sectorName ?? "未知板块"}：${sectorState(score)}`);
}

export function sectorInvalidReasons(input: StrategyInput, minScore: number): string[] {
  const sector = getPrimarySector(input);
  const reasons: string[] = [];
  if (!sector) reasons.push("板块数据缺失");
  if ((sector?.strengthScore ?? 0) < minScore) reasons.push(`板块评分低于${minScore}`);
  if (sector?.dataStatus === "partial") reasons.push("板块数据partial，不能作为完整A级依据");
  return reasons;
}
