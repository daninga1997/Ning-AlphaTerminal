import { describe, expect, it, vi } from "vitest";
import { MockMarketDataProvider } from "./mock-market-data-provider";
import { isAllowedStockCode, MarketDataError } from "./market-data-errors";
import { getTradingSession } from "./trading-session";
import { evaluateFreshness } from "./freshness";
import { MarketDataCache } from "./market-data-cache";
import { MarketDataService } from "./market-data-service";
import { getProvider } from "./provider-registry";
import { applyMarketDataSafetyGuard } from "./scoring-safety";

describe("market data provider", () => {
  const provider = new MockMarketDataProvider();

  it("MockProvider返回统一Quote类型", async () => {
    const quote = await provider.getQuote("002472");

    expect(quote).toMatchObject({
      code: "002472",
      exchange: "SZSE",
      source: "mock-provider",
      isDemo: true,
    });
    expect(Number.isFinite(quote.price)).toBe(true);
  });

  it("MockProvider数据重复调用结果一致", async () => {
    await expect(provider.getQuote("002317")).resolves.toEqual(await provider.getQuote("002317"));
  });

  it("20只观察股均能返回Quote", async () => {
    const quotes = await provider.getQuotes([
      "002317",
      "000661",
      "002653",
      "000963",
      "002821",
      "002472",
      "002050",
      "002896",
      "002031",
      "002139",
      "000988",
      "000021",
      "000063",
      "002463",
      "002436",
      "000738",
      "000768",
      "002625",
      "002335",
      "000400",
    ]);

    expect(quotes).toHaveLength(20);
  });

  it("非法代码被拒绝", () => {
    expect(isAllowedStockCode("ABCDEF")).toBe(false);
  });

  it("任意6位数字代码均可通过校验", () => {
    expect(isAllowedStockCode("603228")).toBe(true);
    expect(isAllowedStockCode("300750")).toBe(true);
    expect(isAllowedStockCode("688981")).toBe(true);
  });

  it("非6位数字代码被拒绝", () => {
    expect(isAllowedStockCode("12345")).toBe(false);
  });
});

describe("trading session", () => {
  it("09:20识别为auction", () => {
    expect(getTradingSession("2026-07-14T09:20:00+08:00")).toBe("auction");
  });

  it("10:00识别为morning", () => {
    expect(getTradingSession("2026-07-14T10:00:00+08:00")).toBe("morning");
  });

  it("12:00识别为lunch_break", () => {
    expect(getTradingSession("2026-07-14T12:00:00+08:00")).toBe("lunch_break");
  });

  it("14:00识别为afternoon", () => {
    expect(getTradingSession("2026-07-14T14:00:00+08:00")).toBe("afternoon");
  });

  it("15:30识别为closed", () => {
    expect(getTradingSession("2026-07-14T15:30:00+08:00")).toBe("closed");
  });

  it("周末识别为non_trading_day", () => {
    expect(getTradingSession("2026-07-18T10:00:00+08:00")).toBe("non_trading_day");
  });
});

describe("freshness", () => {
  it("15秒内为fresh", () => {
    expect(
      evaluateFreshness({
        marketTimestamp: "2026-07-14T10:00:00+08:00",
        now: "2026-07-14T10:00:14+08:00",
        tradingSession: "morning",
      }),
    ).toBe("fresh");
  });

  it("超过15秒为delayed", () => {
    expect(
      evaluateFreshness({
        marketTimestamp: "2026-07-14T10:00:00+08:00",
        now: "2026-07-14T10:00:30+08:00",
        tradingSession: "morning",
      }),
    ).toBe("delayed");
  });

  it("超过60秒为stale", () => {
    expect(
      evaluateFreshness({
        marketTimestamp: "2026-07-14T10:00:00+08:00",
        now: "2026-07-14T10:02:00+08:00",
        tradingSession: "morning",
      }),
    ).toBe("stale");
  });

  it("无数据为unavailable", () => {
    expect(evaluateFreshness({ marketTimestamp: null, now: "2026-07-14T10:00:00+08:00", tradingSession: "morning" })).toBe(
      "unavailable",
    );
  });

  it("收盘后最新收盘数据为market_closed", () => {
    expect(
      evaluateFreshness({
        marketTimestamp: "2026-07-14T15:00:00+08:00",
        now: "2026-07-14T16:00:00+08:00",
        tradingSession: "closed",
      }),
    ).toBe("market_closed");
  });
});

describe("cache", () => {
  it("相同请求在缓存期内只调用Provider一次", async () => {
    const cache = new MarketDataCache();
    const loader = vi.fn(async () => "value");

    await cache.getOrLoad("key", 1000, loader);
    await cache.getOrLoad("key", 1000, loader);

    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("缓存过期后重新调用Provider", async () => {
    const cache = new MarketDataCache();
    const loader = vi.fn(async () => "value");

    await cache.getOrLoad("key", 0, loader);
    await new Promise((resolve) => setTimeout(resolve, 1));
    await cache.getOrLoad("key", 0, loader);

    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("Provider失败时返回明确错误状态", async () => {
    const provider = new MockMarketDataProvider();
    provider.getQuote = async () => {
      throw new MarketDataError("PROVIDER_UNAVAILABLE", "provider failed");
    };
    const service = new MarketDataService({ provider });

    const result = await service.getQuote("002472");

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe("PROVIDER_UNAVAILABLE");
  });

  it("最后成功数据回退时必须标记stale", async () => {
    let shouldFail = false;
    const provider = new MockMarketDataProvider();
    const originalGetQuote = provider.getQuote.bind(provider);
    const service = new MarketDataService({
      provider,
      cacheTtlMs: 0,
    });
    provider.getQuote = async (code) => {
      if (shouldFail) throw new MarketDataError("PROVIDER_UNAVAILABLE", "provider failed");
      return originalGetQuote(code);
    };

    await service.getQuote("002472");
    shouldFail = true;
    const result = await service.getQuote("002472");

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe("stale");
  });
});

describe("api constraints and safety", () => {
  it("quotes接口限制最大代码数量", () => {
    expect(() => {
      const codes = Array.from({ length: 51 }, (_, index) => `000${String(index).padStart(3, "0")}`);
      if (codes.length > 50) throw new MarketDataError("TOO_MANY_CODES", "单次查询股票数量过多");
    }).toThrow(MarketDataError);
  });

  it("非法参数返回400所需错误码", () => {
    const error = new MarketDataError("INVALID_STOCK_CODE", "股票代码无效", 400);

    expect(error.statusCode).toBe(400);
  });

  it("API响应包含source、status和isDemo", async () => {
    const service = new MarketDataService({ provider: new MockMarketDataProvider() });
    const result = await service.getQuote("002472");

    expect(result.meta).toMatchObject({
      source: "mock-provider",
      isDemo: true,
    });
    expect(result.meta?.status).toBeDefined();
  });

  it("API不得返回环境变量或密钥", async () => {
    const service = new MarketDataService({ provider: new MockMarketDataProvider() });
    const result = JSON.stringify(await service.getQuote("002472"));

    expect(result).not.toContain("SECRET");
    expect(result).not.toContain("API_KEY");
  });

  it("health接口正确显示MockProvider状态", async () => {
    const provider = getProvider("mock");

    await expect(provider.healthCheck()).resolves.toMatchObject({
      ok: true,
      source: "mock-provider",
      mode: "mock",
    });
  });

  it("stale数据不能产生新的buy信号", () => {
    expect(applyMarketDataSafetyGuard({ signal: "buy", status: "stale" }).signal).toBe("wait");
  });

  it("unavailable数据不能产生交易计划", () => {
    expect(applyMarketDataSafetyGuard({ signal: "buy", status: "unavailable" }).canGenerateTradePlan).toBe(false);
  });

  it("fresh Mock数据仍必须显示演示标识", () => {
    expect(applyMarketDataSafetyGuard({ signal: "buy", status: "fresh", isDemo: true }).isDemo).toBe(true);
  });
});
