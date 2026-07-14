import { describe, expect, it, vi } from "vitest";
import { evaluateFreshness } from "../../freshness";
import { getProvider } from "../../provider-registry";
import { applyMarketDataSafetyGuard } from "../../scoring-safety";
import { AkShareProvider } from "./akshare-provider";
import { normalizeAkShareQuoteResponse } from "./akshare-response-normalizer";

const quotePayload = {
  success: true as const,
  data: [
    {
      code: "002472",
      name: "双环传动",
      exchange: "SZSE" as const,
      price: 25.5,
      previousClose: 25,
      open: 25.2,
      high: 26,
      low: 25.1,
      change: 0.5,
      changePercent: 2,
      volume: 100000,
      amount: 2550000,
      turnoverRate: 1.2,
      volumeRatio: 1.5,
      bidPrice: 25.49,
      askPrice: 25.51,
      marketTimestamp: "2026-07-14T10:30:00+08:00",
      receivedAt: "2026-07-14T10:30:05+08:00",
      status: "delayed" as const,
      source: "AKShare stock_zh_a_spot_em",
      isDemo: false,
    },
  ],
  meta: {
    provider: "akshare",
    source: "AKShare stock_zh_a_spot_em",
    market_timestamp: "2026-07-14T10:30:00+08:00",
    received_at: "2026-07-14T10:30:05+08:00",
    status: "delayed" as const,
    is_demo: false,
  },
};

function response(payload: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => payload,
  } as Response;
}

describe("AkShareProvider", () => {
  it("implements the market data provider interface for quotes", async () => {
    const fetcher = vi.fn(async () => response(quotePayload));
    const provider = new AkShareProvider({
      baseUrl: "http://127.0.0.1:8001",
      timeoutMs: 12000,
      fetcher,
    });

    const quotes = await provider.getQuotes(["002472"]);

    expect(quotes[0]).toMatchObject({
      code: "002472",
      source: "AKShare stock_zh_a_spot_em",
      isDemo: false,
    });
    expect(fetcher).toHaveBeenCalledWith("http://127.0.0.1:8001/quotes?codes=002472", expect.any(Object));
  });

  it("returns a clear failure when the Python service is unavailable", async () => {
    const provider = new AkShareProvider({
      baseUrl: "http://127.0.0.1:8001",
      timeoutMs: 12000,
      fetcher: vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    });

    await expect(provider.getQuotes(["002472"])).rejects.toMatchObject({
      code: "AKSHARE_SERVICE_UNAVAILABLE",
    });
  });

  it("does not fall back to mock when live akshare is selected", () => {
    vi.stubEnv("MARKET_DATA_MODE", "live");
    vi.stubEnv("MARKET_DATA_LIVE_PROVIDER", "akshare");
    vi.stubEnv("AKSHARE_SERVICE_BASE_URL", "http://127.0.0.1:8001");

    const provider = getProvider();

    expect(provider).toBeInstanceOf(AkShareProvider);
    expect(provider.source).toBe("akshare");
    vi.unstubAllEnvs();
  });

  it("normalizes AkShare quote responses to StockQuote", () => {
    expect(normalizeAkShareQuoteResponse(quotePayload)[0]).toMatchObject({
      code: "002472",
      price: 25.5,
      receivedAt: "2026-07-14T10:30:05+08:00",
      status: "delayed",
    });
  });

  it("keeps stale data from generating a buy signal", () => {
    expect(applyMarketDataSafetyGuard({ signal: "buy", status: "stale" }).signal).toBe("wait");
  });

  it("marks closed sessions as market_closed", () => {
    expect(
      evaluateFreshness({
        marketTimestamp: "2026-07-14T15:00:00+08:00",
        now: "2026-07-14T18:00:00+08:00",
        tradingSession: "closed",
      }),
    ).toBe("market_closed");
  });

  it("maps provider health without leaking stack traces", async () => {
    const provider = new AkShareProvider({
      baseUrl: "http://127.0.0.1:8001",
      timeoutMs: 12000,
      fetcher: vi.fn(async () =>
        response({
          success: true,
          data: {
            ok: true,
            provider: "akshare",
            akshareVersion: "1.16.98",
            lastSuccessAt: "2026-07-14T10:30:00+08:00",
            cache: { entries: 1, lastSuccessEntries: 1 },
            capabilities: {
              quotes: true,
              dailyBars: true,
              minuteBars: true,
              supportedMinutePeriods: ["1m", "5m"],
              maxSymbolsPerRequest: 20,
            },
          },
        }),
      ),
    });

    await expect(provider.healthCheck()).resolves.toMatchObject({
      ok: true,
      source: "akshare",
      message: "AKShare服务可用",
    });
  });
});
