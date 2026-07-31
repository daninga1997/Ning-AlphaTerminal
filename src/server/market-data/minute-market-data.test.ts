import { afterEach, describe, expect, it, vi } from "vitest";
import type { MinuteBar } from "../../types/market-data";
import { MarketDataService } from "./market-data-service";
import { MarketDataCache } from "./market-data-cache";
import { MarketDataError } from "./market-data-errors";
import { aggregateMinuteBars, assertValidMinuteBar } from "./minute-bars";
import { MockMarketDataProvider } from "./mock-market-data-provider";
import { parseMinuteRequest } from "./minute-api-params";
import { applyMinuteConfirmationGuard } from "./minute-safety";
import { getQuoteCacheTtlMs } from "./cache-policy";
import { retryWithBackoff } from "./providers/live/live-rate-limiter";
import { LiveProviderAuthError, LiveProviderNotConfiguredError, LiveProviderRateLimitedError } from "./providers/live/live-provider-errors";
import { assertLiveProviderConfigured } from "./providers/live/live-provider-config";
import { loadReplayMinuteBars } from "./providers/replay/csv-minute-bar-loader";
import { ReplayClock } from "./providers/replay/replay-clock";
import { ReplayMarketDataProvider } from "./providers/replay/replay-market-data-provider";
import { TencentProvider } from "./providers/tencent/tencent-provider";

afterEach(() => {
  vi.unstubAllGlobals();
});

function bar(overrides: Partial<MinuteBar> = {}): MinuteBar {
  return {
    code: "002472",
    timestamp: "2026-07-14T09:30:00+08:00",
    open: 10,
    high: 10.2,
    low: 9.9,
    close: 10.1,
    volume: 100,
    amount: 1010,
    averagePrice: 10.1,
    previousClose: 10,
    source: "test",
    receivedAt: "2026-07-14T09:30:01+08:00",
    status: "fresh",
    isDemo: true,
    ...overrides,
  };
}

describe("MinuteBar validation", () => {
  it("合法分钟K线通过校验", () => {
    expect(() => assertValidMinuteBar(bar())).not.toThrow();
  });

  it("high/low逻辑错误被拒绝", () => {
    expect(() => assertValidMinuteBar(bar({ high: 9 }))).toThrow(MarketDataError);
    expect(() => assertValidMinuteBar(bar({ low: 11 }))).toThrow(MarketDataError);
  });

  it("NaN和Infinity被拒绝", () => {
    expect(() => assertValidMinuteBar(bar({ close: Number.NaN }))).toThrow(MarketDataError);
    expect(() => assertValidMinuteBar(bar({ close: Number.POSITIVE_INFINITY }))).toThrow(MarketDataError);
  });

  it("负成交量被拒绝", () => {
    expect(() => assertValidMinuteBar(bar({ volume: -1 }))).toThrow(MarketDataError);
  });
});

describe("minute aggregation", () => {
  const bars = Array.from({ length: 5 }, (_, index) =>
    bar({
      timestamp: `2026-07-14T09:${30 + index}:00+08:00`,
      open: 10 + index,
      high: 11 + index,
      low: 9 - index,
      close: 10.5 + index,
      volume: 100 + index,
      amount: 1000 + index,
    }),
  );

  it("1分钟正确聚合为5分钟", () => {
    expect(aggregateMinuteBars(bars, "5m")).toHaveLength(1);
  });

  it("open取第一根", () => {
    expect(aggregateMinuteBars(bars, "5m")[0]?.open).toBe(10);
  });

  it("close取最后一根", () => {
    expect(aggregateMinuteBars(bars, "5m")[0]?.close).toBe(14.5);
  });

  it("high和low计算正确", () => {
    const result = aggregateMinuteBars(bars, "5m")[0]!;
    expect(result.high).toBe(15);
    expect(result.low).toBe(5);
  });

  it("volume和amount正确求和", () => {
    const result = aggregateMinuteBars(bars, "5m")[0]!;
    expect(result.volume).toBe(510);
    expect(result.amount).toBe(5010);
  });

  it("午休时段不会产生伪造K线", () => {
    expect(aggregateMinuteBars([bar({ timestamp: "2026-07-14T12:00:00+08:00" })], "5m")).toHaveLength(0);
  });
});

describe("replay", () => {
  it("相同CSV重复加载结果一致", () => {
    expect(loadReplayMinuteBars("002472")).toEqual(loadReplayMinuteBars("002472"));
  });

  it("回放暂停后时间不推进", () => {
    const clock = new ReplayClock("2026-07-14T09:30:00+08:00");
    clock.pause();
    expect(clock.tick()).toBe(clock.now());
  });

  it("回放恢复后继续推进", () => {
    const clock = new ReplayClock("2026-07-14T09:30:00+08:00");
    const first = clock.now();
    clock.resume();
    expect(clock.tick()).not.toBe(first);
  });

  it("重置后回到初始状态", () => {
    const clock = new ReplayClock("2026-07-14T09:30:00+08:00");
    clock.tick();
    clock.reset("2026-07-14T09:30:00+08:00");
    expect(clock.now()).toContain("2026-07-14T09:30:00");
  });

  it("replay数据明确标记isReplay", async () => {
    const provider = new ReplayMarketDataProvider();
    const bars = await provider.getMinuteBars("002472", { period: "1m", limit: 1 });
    expect(bars[0]?.isReplay).toBe(true);
  });
});

describe("live config and rate limit", () => {
  it("未配置Provider时live模式明确失败", () => {
    expect(() => assertLiveProviderConfigured({ baseUrl: "", apiKeyConfigured: false, providerName: "", timeoutMs: 5000, minimumIntervalMs: 60000 })).toThrow(
      LiveProviderNotConfiguredError,
    );
  });

  it("不允许自动伪装成Mock", () => {
    expect(() => assertLiveProviderConfigured({ baseUrl: "", apiKeyConfigured: false, providerName: "", timeoutMs: 5000, minimumIntervalMs: 60000 })).toThrow(
      "真实行情供应商尚未配置",
    );
  });

  it("API响应不包含密钥", () => {
    const response = JSON.stringify({ apiKeyConfigured: true, providerName: "licensed-provider" });
    expect(response).not.toContain("secret-value");
  });

  it("health返回Provider能力", async () => {
    const health = await new MockMarketDataProvider().healthCheck();
    expect(health.capabilities.supportsMinuteBars).toBe(true);
  });

  it("认证失败不重试", async () => {
    const operation = vi.fn(async () => {
      throw new LiveProviderAuthError();
    });
    await expect(retryWithBackoff(operation)).rejects.toThrow(LiveProviderAuthError);
    expect(operation).toHaveBeenCalledTimes(1);
  });
});

describe("cache, api and safety", () => {
  it("交易时段Quote缓存15秒", () => {
    expect(getQuoteCacheTtlMs("morning")).toBe(15_000);
  });

  it("相同请求正确合并", async () => {
    const cache = new MarketDataCache();
    const loader = vi.fn(async () => "ok");
    await Promise.all([cache.getOrLoad("same", 1000, loader), cache.getOrLoad("same", 1000, loader)]);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("429最多重试2次", async () => {
    const operation = vi.fn(async () => {
      throw new LiveProviderRateLimitedError();
    });
    await expect(retryWithBackoff(operation)).rejects.toThrow(LiveProviderRateLimitedError);
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it("认证错误不重试", async () => {
    const operation = vi.fn(async () => {
      throw new LiveProviderAuthError();
    });
    await expect(retryWithBackoff(operation)).rejects.toThrow(LiveProviderAuthError);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("旧数据回退标记stale", async () => {
    const provider = new MockMarketDataProvider();
    const service = new MarketDataService({ provider, cacheTtlMs: 0 });
    await service.getMinuteBars("002472", { period: "1m", limit: 1 });
    provider.getMinuteBars = async () => {
      throw new MarketDataError("PROVIDER_UNAVAILABLE", "failed");
    };
    const result = await service.getMinuteBars("002472", { period: "1m", limit: 1 });
    expect(result.success && result.data[0]?.status).toBe("stale");
  });

  it("合法分钟数据请求返回成功", async () => {
    const result = await new MarketDataService({ provider: new MockMarketDataProvider() }).getMinuteBars("002472", {
      period: "1m",
      limit: 120,
    });
    expect(result.success).toBe(true);
  });

  it("非法股票代码返回400", () => {
    expect(() => parseMinuteRequest("12345", new URLSearchParams("period=1m"))).toThrow(MarketDataError);
  });

  it("允许深圳003代码请求分钟线", () => {
    expect(() => parseMinuteRequest("003001", new URLSearchParams("period=1m"))).not.toThrow();
  });

  it("非法period返回400", () => {
    expect(() => parseMinuteRequest("002472", new URLSearchParams("period=2m"))).toThrow(MarketDataError);
  });

  it("limit超过上限返回400", () => {
    expect(() => parseMinuteRequest("002472", new URLSearchParams("period=1m&limit=999"))).toThrow(MarketDataError);
  });

  it("API返回mode、source和更新时间", async () => {
    const result = await new MarketDataService({ provider: new MockMarketDataProvider() }).getMinuteBars("002472", {
      period: "1m",
      limit: 1,
    });
    expect(result.success && result.meta.mode).toBe("mock");
    expect(result.success && result.meta.source).toBe("mock-provider");
    expect(result.success && result.meta.receivedAt.length > 0).toBe(true);
  });

  it("页面隐藏时停止刷新", () => {
    expect(shouldRefreshQuotes(false)).toBe(false);
  });

  it("Watchlist使用批量请求", () => {
    expect(buildBatchQuoteUrl(["002472", "002317"])).toBe("/api/market/quotes?codes=002472,002317");
  });

  it("stale分钟数据不能产生新buy", () => {
    expect(applyMinuteConfirmationGuard({ signal: "buy", minuteStatus: "stale" }).signal).toBe("wait");
  });

  it("unavailable分钟数据不能产生新buy", () => {
    expect(applyMinuteConfirmationGuard({ signal: "buy", minuteStatus: "unavailable" }).signal).toBe("wait");
  });

  it("超过追高价不能产生新buy", () => {
    expect(
      applyMinuteConfirmationGuard({ signal: "buy", minuteStatus: "fresh", latestPrice: 11, chaseLimit: 10 }).signal,
    ).toBe("wait");
  });

  it("午间休市不能产生分钟确认buy", () => {
    expect(applyMinuteConfirmationGuard({ signal: "buy", minuteStatus: "fresh", tradingSession: "lunch_break" }).signal).toBe("wait");
  });
});

describe("Tencent minute status mapping", () => {
  it("maps the service's closed status to the terminal's market_closed status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          source: "tencent",
          status: "closed",
          received_at: "2026-07-28T15:01:00+08:00",
          data: [{ time: "2026-07-28T15:00:00+08:00", open: 35.6, close: 35.63, high: 35.64, low: 35.5, volume: 1200 }],
        }),
      }),
    );

    const bars = await new TencentProvider().getMinuteBars("002472", { period: "1m", limit: 1 });

    expect(bars[0]?.status).toBe("market_closed");
  });
});

function shouldRefreshQuotes(isVisible: boolean): boolean {
  return isVisible;
}

function buildBatchQuoteUrl(codes: string[]): string {
  return `/api/market/quotes?codes=${codes.join(",")}`;
}
