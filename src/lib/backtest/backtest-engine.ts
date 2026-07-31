import type {
  BacktestEquityPoint,
  BacktestReport,
  BacktestTrade,
  RunBacktestInput,
} from "@/types/backtest";
import type { MarketDailyBar } from "@/types/market-data";
import { evaluateBacktestSignal } from "./backtest-strategies";

const LOT_SIZE = 100;
const SLIPPAGE_RATE = 0.0005;
const COMMISSION_RATE = 0.0003;
const MIN_COMMISSION = 5;
const SELL_SIDE_RATE = 0.0005;
// A 股主板涨跌停阈值：±10%，留 0.2% 缓冲（回测数据源限定深市主板）
const LIMIT_UP_RATIO = 1.098;
const LIMIT_DOWN_RATIO = 0.902;

type PendingOrder = {
  side: "buy" | "sell";
  signalDate: string;
  reason: string;
};

type OpenPosition = {
  signalDate: string;
  entryDate: string;
  entryPrice: number;
  entryCommission: number;
  quantity: number;
  totalCost: number;
};

export function runBacktest(input: RunBacktestInput): BacktestReport {
  validateInput(input);

  let cash = input.initialCapital;
  let position: OpenPosition | null = null;
  let pendingOrder: PendingOrder | null = null;
  const trades: BacktestTrade[] = [];
  const equityCurve: BacktestEquityPoint[] = [];

  input.bars.forEach((bar, index) => {
    const previousClose = index > 0 ? input.bars[index - 1]!.close : bar.open;
    if (pendingOrder) {
      if (pendingOrder.side === "buy" && !position) {
        // 一字涨停无法买入，订单当日失效
        if (!isLimitUpOpen(bar, previousClose)) {
          const opened = openPosition(bar, pendingOrder, cash);
          if (opened) {
            position = opened.position;
            cash = opened.cash;
          }
        }
      } else if (pendingOrder.side === "sell" && position) {
        // 一字跌停无法卖出，订单当日失效，持仓顺延
        if (!isLimitDownOpen(bar, previousClose)) {
          const closed = closePosition(bar, position, pendingOrder.reason, false);
          cash += closed.netProceeds;
          trades.push(closed.trade);
          position = null;
        }
      }
      pendingOrder = null;
    }

    equityCurve.push(toEquityPoint(bar, cash, position));
    const signal = evaluateBacktestSignal({
      strategy: input.strategy,
      bars: input.bars,
      index,
      breakoutLookback: input.breakoutLookback,
    });

    if (index < input.bars.length - 1) {
      if (position && signal.exit) {
        pendingOrder = { side: "sell", signalDate: bar.date, reason: signal.reason ?? "策略退出" };
      } else if (!position && signal.entry) {
        pendingOrder = { side: "buy", signalDate: bar.date, reason: signal.reason ?? "策略入场" };
      }
    }
  });

  const lastBar = input.bars.at(-1);
  if (position && lastBar) {
    const closed = closePosition(lastBar, position, "区间结算", true);
    cash += closed.netProceeds;
    trades.push(closed.trade);
    position = null;
    equityCurve[equityCurve.length - 1] = toEquityPoint(lastBar, cash, position);
  }

  const finalEquity = roundMoney(cash);
  return {
    initialCapital: input.initialCapital,
    finalEquity,
    totalReturnPercent: percentage(finalEquity / input.initialCapital - 1),
    annualizedReturnPercent: calculateAnnualizedReturn(input.bars, input.initialCapital, finalEquity),
    maxDrawdownPercent: calculateMaxDrawdown(equityCurve),
    winRatePercent: calculateWinRate(trades),
    profitLossRatio: calculateProfitLossRatio(trades),
    completedTradeCount: trades.length,
    equityCurve,
    trades,
  };
}

function validateInput(input: RunBacktestInput): void {
  if (!Number.isFinite(input.initialCapital) || input.initialCapital <= 0) throw new Error("初始资金必须大于0");
  if (!Number.isInteger(input.breakoutLookback) || input.breakoutLookback < 5 || input.breakoutLookback > 120) {
    throw new Error("突破周期必须在5至120之间");
  }
  if (input.bars.some((bar) => ![bar.open, bar.high, bar.low, bar.close, bar.volume].every(Number.isFinite))) {
    throw new Error("历史日线包含无效数值");
  }
}

function openPosition(bar: MarketDailyBar, order: PendingOrder, cash: number): { position: OpenPosition; cash: number } | null {
  const entryPrice = roundMoney(bar.open * (1 + SLIPPAGE_RATE));
  const quantity = Math.floor(cash / (entryPrice * (1 + COMMISSION_RATE)) / LOT_SIZE) * LOT_SIZE;
  if (quantity < LOT_SIZE) return null;

  const grossCost = roundMoney(entryPrice * quantity);
  const entryCommission = commission(grossCost);
  const totalCost = roundMoney(grossCost + entryCommission);
  if (totalCost > cash) return null;

  return {
    cash: roundMoney(cash - totalCost),
    position: {
      signalDate: order.signalDate,
      entryDate: bar.date,
      entryPrice,
      entryCommission,
      quantity,
      totalCost,
    },
  };
}

function closePosition(
  bar: MarketDailyBar,
  position: OpenPosition,
  reason: string,
  atFinalClose: boolean,
): { netProceeds: number; trade: BacktestTrade } {
  const referencePrice = atFinalClose ? bar.close : bar.open;
  const exitPrice = roundMoney(referencePrice * (1 - SLIPPAGE_RATE));
  const grossProceeds = roundMoney(exitPrice * position.quantity);
  const exitCommission = commission(grossProceeds);
  const sellSideCharge = roundMoney(grossProceeds * SELL_SIDE_RATE);
  const netProceeds = roundMoney(grossProceeds - exitCommission - sellSideCharge);
  const profitLoss = roundMoney(netProceeds - position.totalCost);

  return {
    netProceeds,
    trade: {
      code: bar.code,
      signalDate: position.signalDate,
      entryDate: position.entryDate,
      entryPrice: position.entryPrice,
      entryCommission: position.entryCommission,
      quantity: position.quantity,
      exitDate: bar.date,
      exitPrice,
      exitCommission,
      sellSideCharge,
      exitReason: reason,
      holdingDays: Math.max(0, tradingDaysBetween(position.entryDate, bar.date)),
      profitLoss,
      returnPercent: percentage(profitLoss / position.totalCost),
    },
  };
}

function toEquityPoint(bar: MarketDailyBar, cash: number, position: OpenPosition | null): BacktestEquityPoint {
  const marketValue = position ? roundMoney(position.quantity * bar.close) : 0;
  return { date: bar.date, cash: roundMoney(cash), marketValue, equity: roundMoney(cash + marketValue) };
}

function commission(grossAmount: number): number {
  return roundMoney(Math.max(MIN_COMMISSION, grossAmount * COMMISSION_RATE));
}

function isLimitUpOpen(bar: MarketDailyBar, previousClose: number): boolean {
  return previousClose > 0 && bar.open >= previousClose * LIMIT_UP_RATIO;
}

function isLimitDownOpen(bar: MarketDailyBar, previousClose: number): boolean {
  return previousClose > 0 && bar.open <= previousClose * LIMIT_DOWN_RATIO;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function percentage(value: number): number {
  return Math.round((value * 100 + Number.EPSILON) * 10_000) / 10_000;
}

function calculateAnnualizedReturn(bars: MarketDailyBar[], initialCapital: number, finalEquity: number): number {
  const firstDate = bars[0]?.date;
  const lastDate = bars.at(-1)?.date;
  if (!firstDate || !lastDate || finalEquity <= 0) return 0;
  const durationDays = Math.max(1, Math.round((Date.parse(lastDate) - Date.parse(firstDate)) / 86_400_000));
  return percentage((finalEquity / initialCapital) ** (365 / durationDays) - 1);
}

function calculateMaxDrawdown(points: BacktestEquityPoint[]): number {
  let peak = 0;
  let maximum = 0;
  for (const point of points) {
    peak = Math.max(peak, point.equity);
    if (peak > 0) maximum = Math.max(maximum, (peak - point.equity) / peak);
  }
  return percentage(maximum);
}

function calculateWinRate(trades: BacktestTrade[]): number | null {
  if (trades.length === 0) return null;
  return percentage(trades.filter((trade) => trade.profitLoss > 0).length / trades.length);
}

function calculateProfitLossRatio(trades: BacktestTrade[]): number | null {
  const profits = trades.filter((trade) => trade.profitLoss > 0).map((trade) => trade.profitLoss);
  const losses = trades.filter((trade) => trade.profitLoss < 0).map((trade) => Math.abs(trade.profitLoss));
  if (losses.length === 0) return null;
  const averageProfit = profits.reduce((sum, value) => sum + value, 0) / profits.length;
  const averageLoss = losses.reduce((sum, value) => sum + value, 0) / losses.length;
  return averageLoss === 0 ? null : roundMoney(averageProfit / averageLoss);
}

function tradingDaysBetween(entryDate: string, exitDate: string): number {
  const entry = Date.parse(entryDate);
  const exit = Date.parse(exitDate);
  return Number.isFinite(entry) && Number.isFinite(exit) ? Math.max(0, Math.round((exit - entry) / 86_400_000)) : 0;
}
