import { MarketDataError } from "../market-data/market-data-errors";

export function assertLocalSyncRequest(request: Request): void {
  const host = request.headers.get("host") ?? "";
  const isLocalHost = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  const hasLocalHeader = request.headers.get("x-alpha-local-sync") === "true";
  if (!isLocalHost || !hasLocalHeader) {
    throw new MarketDataError("LOCAL_SYNC_ONLY", "同步接口仅允许本地脚本调用", 403);
  }
}
