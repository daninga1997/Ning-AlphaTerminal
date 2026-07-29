import type { MarketDataMeta, MarketDataMode, MarketDataStatus } from "../../types/market-data";
import type { ProviderHealth } from "./market-data-provider";

export type DataCapabilityKey = "quotes" | "dailyBars" | "minuteBars" | "marketOverview" | "sectors";

export type DataCapability = {
  label: string;
  supported: boolean;
  currentStatus: MarketDataStatus;
  lastSuccessAt: string | null;
  strategyUsed: string | null;
  source: string;
  disclaimer: string;
};

export type DataCapabilityMatrix = Record<DataCapabilityKey, DataCapability>;

type MatrixInput = {
  mode: MarketDataMode;
  providerName: string;
  health: ProviderHealth & Record<string, unknown>;
  quoteMeta?: MarketDataMeta | null;
  dailyMeta?: MarketDataMeta | null;
  minuteMeta?: MarketDataMeta | null;
};

const defaultDisclaimer = "公开数据接口，稳定性和时效性不等同于交易所或券商专业行情。";

function statusFromMeta(meta: MarketDataMeta | null | undefined): MarketDataStatus | null {
  return meta?.status ?? null;
}

function statusFromLast(success?: unknown, failure?: unknown): MarketDataStatus {
  if (success) return "delayed";
  if (failure) return "unavailable";
  return "unavailable";
}

function quoteStatus(health: ProviderHealth & Record<string, unknown>, quoteMeta?: MarketDataMeta | null): MarketDataStatus {
  const metaStatus = statusFromMeta(quoteMeta);
  if (metaStatus) return metaStatus;
  if (health.quoteCircuitState === "open" && !health.quoteLastSuccessAt) return "unavailable";
  return statusFromLast(health.quoteLastSuccessAt, health.quoteLastFailureAt);
}

function sourceLabel(source: string | undefined, fallback: string): string {
  const resolvedSource = source || fallback;
  if (resolvedSource === "tencent") return "腾讯财经";
  if (resolvedSource.includes("tencent") || resolvedSource.includes("gtimg")) return "腾讯财经";
  if (resolvedSource === "AKShare stock_zh_a_spot") return "腾讯财经";
  if (resolvedSource === "AKShare stock_zh_a_spot_em") return "腾讯财经";
  return resolvedSource || "腾讯财经";
}

function sourceFromQuoteStrategy(strategy: string | null): string | null {
  if (strategy === "sina_spot") return "腾讯财经";
  if (strategy === "eastmoney_spot") return "腾讯财经";
  return null;
}

export function buildCapabilityMatrix(input: MatrixInput): DataCapabilityMatrix {
  const { health } = input;
  const disclaimer = health.disclaimer ?? defaultDisclaimer;
  const quoteStrategy = input.quoteMeta?.strategyUsed ?? health.quoteStrategyUsed ?? null;
  const quoteSource = sourceLabel(input.quoteMeta?.source, sourceFromQuoteStrategy(quoteStrategy) ?? input.providerName);

  return {
    quotes: {
      label: "Quotes",
      supported: health.capabilities.supportsQuotes,
      currentStatus: health.capabilities.supportsQuotes ? quoteStatus(health, input.quoteMeta) : "unavailable",
      lastSuccessAt: input.quoteMeta?.receivedAt ?? health.quoteLastSuccessAt ?? null,
      strategyUsed: quoteStrategy,
      source: quoteSource,
      disclaimer,
    },
    dailyBars: {
      label: "Daily Bars",
      supported: health.capabilities.supportsDailyBars,
      currentStatus: health.capabilities.supportsDailyBars
        ? statusFromMeta(input.dailyMeta) ?? statusFromLast(health.dailyBarsLastSuccessAt, health.dailyBarsLastFailureAt)
        : "unavailable",
      lastSuccessAt: input.dailyMeta?.receivedAt ?? health.dailyBarsLastSuccessAt ?? null,
      strategyUsed: null,
      source: sourceLabel(input.dailyMeta?.source, input.providerName),
      disclaimer,
    },
    minuteBars: {
      label: "Minute Bars",
      supported: health.capabilities.supportsMinuteBars,
      currentStatus: health.capabilities.supportsMinuteBars
        ? statusFromMeta(input.minuteMeta) ?? statusFromLast(health.minuteBarsLastSuccessAt, health.minuteBarsLastFailureAt)
        : "unavailable",
      lastSuccessAt: input.minuteMeta?.receivedAt ?? health.minuteBarsLastSuccessAt ?? null,
      strategyUsed: null,
      source: sourceLabel(input.minuteMeta?.source, input.providerName),
      disclaimer,
    },
    marketOverview: {
      label: "Market Overview",
      supported: health.capabilities.supportsMarketOverview,
      currentStatus: health.capabilities.supportsMarketOverview ? "delayed" : "unavailable",
      lastSuccessAt: null,
      strategyUsed: null,
      source: input.providerName,
      disclaimer,
    },
    sectors: {
      label: "Sectors",
      supported: health.capabilities.supportsSectors,
      currentStatus: health.capabilities.supportsSectors ? "delayed" : "unavailable",
      lastSuccessAt: null,
      strategyUsed: null,
      source: input.providerName,
      disclaimer,
    },
  };
}

function capabilityWord(status: MarketDataStatus): string {
  if (status === "fresh" || status === "delayed" || status === "market_closed") return "可用";
  if (status === "stale") return "延迟";
  return "不可用";
}

export function getCapabilityBadgeText(matrix: DataCapabilityMatrix): string {
  const source = matrix.quotes.source.startsWith("AKShare") ? "腾讯财经" : matrix.quotes.source;
  return `${source} · 报价${capabilityWord(matrix.quotes.currentStatus)} · 分钟线${capabilityWord(
    matrix.minuteBars.currentStatus,
  )}`;
}

export function getCapabilityWord(status: MarketDataStatus): string {
  return capabilityWord(status);
}

export function getSourceDisplayName(source?: string | null): string {
  return sourceLabel(source ?? undefined, "腾讯财经");
}
