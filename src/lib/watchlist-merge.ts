/**
 * Watchlist 合并展示工具
 *
 * 将核心观察池（StockAnalysis[]）和动态观察池（DynamicWatchlistEntry[]）
 * 合并为统一的 WatchlistItem[]，支持按数据状态、信号有效期排序。
 */
import type { StockAnalysis, StockSignal } from "@/types/stock";
import type { DynamicWatchlistEntry } from "@/server/watchlist-storage/dynamic-watchlist-repository";
import type { StrategyAction } from "@/types/strategy-action";

export type WatchlistItem = {
  code: string;
  name: string;
  source: "核心观察池" | "策略自动加入";
  signal: StockSignal | StrategyAction | null;
  lastAction: StrategyAction | null;
  lastAnalyzedAt: string | null;
  dataStatus: "就绪" | "阻断" | "过期";
  signalExpired: boolean;
  signalValidUntil: string | null;
  totalScore?: number;
  currentPrice?: number;
  changePercent?: number;
  sector?: string;
};

const CORE_CODES = new Set([
  "002896","000988","002317","000661","002472","002463",
  "002335","002050","000021","002436","002653","000963",
  "002139","002821","000400","002653","000963","002653","000963","002653"
]);

export function mergeWatchlist(
  core: StockAnalysis[],
  dynamic: DynamicWatchlistEntry[],
): WatchlistItem[] {
  const now = new Date();
  const coreCodeSet = new Set(core.map((s) => s.code));
  const items: WatchlistItem[] = [];

  // 核心观察池条目
  for (const stock of core) {
    items.push({
      code: stock.code,
      name: stock.name,
      source: "核心观察池",
      signal: stock.signal ?? null,
      lastAction: null,
      lastAnalyzedAt: stock.dataUpdatedAt ?? null,
      dataStatus: "就绪",
      signalExpired: false,
      signalValidUntil: null,
      totalScore: stock.totalScore,
      currentPrice: stock.currentPrice,
      changePercent: stock.changePercent,
      sector: stock.sector,
    });
  }

  // 动态观察池条目（排除已在核心池中的）
  for (const entry of dynamic) {
    if (coreCodeSet.has(entry.code)) continue;

    const isExpired = entry.signalValidUntil
      ? new Date(entry.signalValidUntil) < now
      : false;

    const dataStatus: "就绪" | "阻断" | "过期" = entry.dataBlockers.length > 0
      ? "阻断"
      : isExpired
        ? "过期"
        : "就绪";

    items.push({
      code: entry.code,
      name: entry.name,
      source: "策略自动加入",
      signal: entry.lastAction as StrategyAction,
      lastAction: entry.lastAction as StrategyAction,
      lastAnalyzedAt: entry.lastAnalyzedAt,
      dataStatus,
      signalExpired: isExpired,
      signalValidUntil: entry.signalValidUntil,
    });
  }

  // 排序：就绪核心 → 就绪动态 → 过期/阻断（按最后分析时间倒序）
  const orderRank = (item: WatchlistItem) => {
    if (item.source === "核心观察池" && item.dataStatus === "就绪") return 0;
    if (item.source === "策略自动加入" && item.dataStatus === "就绪") return 1;
    return 2;
  };

  return items.sort((a, b) => {
    const rankDiff = orderRank(a) - orderRank(b);
    if (rankDiff !== 0) return rankDiff;
    const aTime = a.lastAnalyzedAt ? new Date(a.lastAnalyzedAt).getTime() : 0;
    const bTime = b.lastAnalyzedAt ? new Date(b.lastAnalyzedAt).getTime() : 0;
    return bTime - aTime;
  });
}