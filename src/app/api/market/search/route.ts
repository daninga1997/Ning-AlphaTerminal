import { NextResponse } from "next/server";
import { TencentStockSearchService } from "@/server/market-data/tencent-stock-search-service";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q") ?? "";
  const result = await new TencentStockSearchService().search(query);
  const status = result.success ? 200 : result.error.code === "EMPTY_QUERY" ? 400 : 503;
  return NextResponse.json(result, { status });
}
