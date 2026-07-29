import { expect, it, vi } from "vitest";
import { TencentStockSearchService } from "./tencent-stock-search-service";

it("maps Tencent results and filters non-mainboard candidates", async () => {
  const fetchImpl = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        success: true,
        data: [
          { code: "002594", name: "比亚迪", exchange: "SZSE", source: "tencent_smartbox" },
          { code: "300750", name: "宁德时代", exchange: "SZSE", source: "tencent_smartbox" },
        ],
      }),
    ),
  );
  const service = new TencentStockSearchService({ fetchImpl, baseUrl: "http://search.test" });

  await expect(service.search("比亚迪")).resolves.toEqual({
    success: true,
    data: [{ code: "002594", name: "比亚迪", exchange: "SZSE", source: "tencent_smartbox" }],
  });
});

it("does not expose upstream failures", async () => {
  const fetchImpl = vi.fn().mockRejectedValue(new Error("connection refused: http://127.0.0.1:8001"));
  const service = new TencentStockSearchService({ fetchImpl, baseUrl: "http://search.test" });

  await expect(service.search("比亚迪")).resolves.toEqual({
    success: false,
    error: { code: "UPSTREAM_UNAVAILABLE", message: "股票搜索服务暂不可用" },
  });
});
