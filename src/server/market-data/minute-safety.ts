import type { MarketDataStatus, TradingSession } from "../../types/market-data";
import type { StockSignal } from "../../types/stock";

export function applyMinuteConfirmationGuard({
  signal,
  minuteStatus,
  latestPrice,
  chaseLimit,
  stopLoss,
  recentFiveMinuteVolume,
  hasDataGap = false,
  tradingSession,
}: {
  signal: StockSignal;
  minuteStatus: MarketDataStatus;
  latestPrice?: number;
  chaseLimit?: number;
  stopLoss?: number;
  recentFiveMinuteVolume?: number;
  hasDataGap?: boolean;
  tradingSession?: TradingSession;
}): { signal: StockSignal; confirmed: boolean; reason: string } {
  if (signal !== "buy") return { signal, confirmed: false, reason: "原评分模型未产生buy。" };
  if (minuteStatus === "stale" || minuteStatus === "unavailable") {
    return { signal: "wait", confirmed: false, reason: "分钟行情不可用，等待确认。" };
  }
  if (latestPrice !== undefined && chaseLimit !== undefined && latestPrice > chaseLimit) {
    return { signal: "wait", confirmed: false, reason: "最新价超过放弃追高价。" };
  }
  if (latestPrice !== undefined && stopLoss !== undefined && latestPrice < stopLoss) {
    return { signal: "wait", confirmed: false, reason: "最新价跌破止损位。" };
  }
  if (recentFiveMinuteVolume !== undefined && recentFiveMinuteVolume <= 0) {
    return { signal: "wait", confirmed: false, reason: "最近5分钟成交量为0。" };
  }
  if (hasDataGap) return { signal: "wait", confirmed: false, reason: "分钟数据存在断档。" };
  if (tradingSession === "lunch_break" || tradingSession === "non_trading_day") {
    return { signal: "wait", confirmed: false, reason: "当前不处于连续交易时段。" };
  }
  return { signal: "buy", confirmed: true, reason: "分钟确认条件通过。" };
}
