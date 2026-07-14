import { mockStocks } from "./mock-stocks";
import type { DailyBar } from "../types/market";

const baseDate = new Date(Date.UTC(2026, 0, 2));

function formatDate(offset: number): string {
  const date = new Date(baseDate);
  date.setUTCDate(baseDate.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function codeSeed(code: string): number {
  return code.split("").reduce((sum, char) => sum + Number(char), 0);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function makeDailyHistory(code: string, latestPrice: number, changePercent: number): DailyBar[] {
  const seed = codeSeed(code);
  const drift = ((seed % 7) - 2) * 0.0009;
  const amplitude = 0.012 + (seed % 5) * 0.002;
  const startPrice = Math.max(3, latestPrice * (0.72 + (seed % 6) * 0.035));
  const bars: DailyBar[] = [];
  let close = startPrice;

  for (let index = 0; index < 120; index += 1) {
    const wave = Math.sin((index + seed) / 6) * amplitude;
    const pulse = Math.cos((index + seed) / 13) * 0.006;
    const step = drift + wave + pulse;
    const open = close * (1 + Math.sin((index + seed) / 9) * 0.004);
    close = Math.max(2, close * (1 + step));

    if (index === 119) {
      close = latestPrice;
    }
    if (index === 118) {
      close = latestPrice / (1 + changePercent / 100);
    }

    const highBase = Math.max(open, close);
    const lowBase = Math.min(open, close);
    const range = Math.max(0.03, close * (0.012 + ((index + seed) % 6) * 0.002));
    const high = highBase + range;
    const low = Math.max(0.01, lowBase - range * 0.85);
    const volume = Math.round(
      800000 + seed * 15000 + index * 4200 + Math.abs(Math.sin(index / 5)) * 260000,
    );
    const turnover = round2((volume * close) / 100000000);

    bars.push({
      date: formatDate(index),
      open: round2(open),
      high: round2(Math.max(high, open, close, low)),
      low: round2(Math.min(low, open, close, high)),
      close: round2(close),
      volume,
      turnover,
    });
  }

  return bars;
}

export const mockMarketHistory: Record<string, DailyBar[]> = Object.fromEntries(
  mockStocks.map((stock) => [
    stock.code,
    makeDailyHistory(stock.code, stock.currentPrice, stock.changePercent),
  ]),
);
