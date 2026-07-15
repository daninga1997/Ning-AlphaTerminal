import type { MarketDataMode } from "../../types/market-data";
import type { DataIntegrityStatus } from "../../types/data-integrity";

export interface StatusResolverInput {
  completenessPercent: number;
  quoteValid: boolean;
  dailyValid: boolean;
  minuteValid: boolean;
  sourceConsistent: boolean;
  hasCriticalIssues: boolean;
  mode: MarketDataMode;
}

/**
 * 根据完整度和校验结果确定数据完整性状态
 */
export function resolveDataIntegrityStatus(input: StatusResolverInput): DataIntegrityStatus {
  if (input.mode === "mock") return "demo_only";

  if (!input.quoteValid || !input.dailyValid) return "unavailable";

  if (!input.sourceConsistent) return "conflicting";

  if (input.hasCriticalIssues) return "stale";

  if (input.completenessPercent >= 85) return "complete";
  if (input.completenessPercent >= 60) return "partial";
  if (input.completenessPercent >= 40) return "stale";

  return "unavailable";
}