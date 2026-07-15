import type { MarketDataMode } from "../../types/market-data";
import type { DataIntegrityIssue, SourceConsistencyResult, DataIntegrityIssueCode } from "../../types/data-integrity";

export interface SourceEntry {
  source: string;
  mode: MarketDataMode;
  isDemo: boolean;
}

export interface SourceConsistencyInput {
  quote: SourceEntry | null;
  daily: SourceEntry | null;
  minute: SourceEntry | null;
}

/**
 * 数据来源一致性校验
 *
 * Mock/Live 混合、Replay/Live 混合会被阻断。
 * 两个Live源可以组合但会记录警告。
 */
export function checkSourceConsistency(input: SourceConsistencyInput): SourceConsistencyResult {
  const issues: DataIntegrityIssue[] = [];
  const sources = buildSourceMap(input);

  // 检查 Mock 与 Live 混合
  const hasMock = sources.some((s) => s.mode === "mock");
  const hasLive = sources.some((s) => s.mode === "live");
  const hasReplay = sources.some((s) => s.mode === "replay");

  if (hasMock && hasLive) {
    issues.push(issue("MOCK_LIVE_MIXED", "演示数据与真实数据混合，禁止生成正式交易计划"));
  }

  if (hasReplay && hasLive) {
    issues.push(issue("REPLAY_LIVE_MIXED", "回放数据与实时数据混合，禁止生成正式交易计划"));
  }

  // 检查来源冲突（两个不同Live源价格差异大时）
  if (hasLive && sources.filter((s) => s.mode === "live").length > 1) {
    const uniqueLiveSources = new Set(
      sources.filter((s) => s.mode === "live").map((s) => s.source),
    );
    if (uniqueLiveSources.size > 1) {
      issues.push({
        code: "SOURCE_CONFLICT" as DataIntegrityIssueCode,
        message: `多个Live数据源：${Array.from(uniqueLiveSources).join(", ")}，已记录但允许使用`,
        isCritical: false,
      });
    }
  }

  return {
    isConsistent: issues.filter((i) => i.isCritical).length === 0,
    issues,
    sources: {
      quote: input.quote ? { source: input.quote.source, mode: input.quote.mode, isDemo: input.quote.isDemo } : null,
      daily: input.daily ? { source: input.daily.source, mode: input.daily.mode, isDemo: input.daily.isDemo } : null,
      minute: input.minute ? { source: input.minute.source, mode: input.minute.mode, isDemo: input.minute.isDemo } : null,
    },
  };
}

function buildSourceMap(input: SourceConsistencyInput): SourceEntry[] {
  const entries: SourceEntry[] = [];
  if (input.quote) entries.push(input.quote);
  if (input.daily) entries.push(input.daily);
  if (input.minute) entries.push(input.minute);
  return entries;
}

function issue(code: DataIntegrityIssueCode, message: string): DataIntegrityIssue {
  return {
    code,
    message,
    isCritical: true,
  };
}