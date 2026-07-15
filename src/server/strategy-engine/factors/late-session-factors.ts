import type { MinuteBar } from "@/types/market-data";
import { factor } from "../types/factor";

function minuteOf(timestamp: string): number {
  const date = new Date(timestamp);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Shanghai", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(date);
  return Number(parts.find((part) => part.type === "hour")?.value ?? 0) * 60 + Number(parts.find((part) => part.type === "minute")?.value ?? 0);
}

export function barsAfter1430(bars: MinuteBar[]): MinuteBar[] {
  return bars.filter((bar) => minuteOf(bar.timestamp) >= 14 * 60 + 30 && minuteOf(bar.timestamp) <= 14 * 60 + 55);
}

export function lateSessionFactor(bars: MinuteBar[], maxScore: number) {
  const before = bars.filter((bar) => minuteOf(bar.timestamp) < 14 * 60 + 30);
  const after = barsAfter1430(bars);
  const avgBefore = before.length ? before.reduce((sum, bar) => sum + bar.volume, 0) / before.length : 0;
  const avgAfter = after.length ? after.reduce((sum, bar) => sum + bar.volume, 0) / after.length : 0;
  const ratio = avgBefore > 0 ? avgAfter / avgBefore : 0;
  return factor("late_session_volume", "尾盘资金行为", Number(ratio.toFixed(2)), ratio >= 1.15 ? maxScore : Math.round(maxScore * ratio * 0.6), maxScore, "minute-bars", "14:30后平均成交量相对前段");
}

export function hasLateSessionWindow(bars: MinuteBar[]): boolean {
  return barsAfter1430(bars).length >= 5;
}
