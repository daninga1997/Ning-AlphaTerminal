import type { StockSignal } from "@/types/stock";

export type SignalPresentation = {
  chineseLabel: string;
  englishLabel: string;
  colorToken: "success" | "warning" | "primary" | "orange" | "danger";
  badgeClassName: string;
  shortDescription: string;
  priority: number;
};

export const signalPresentation: Record<StockSignal, SignalPresentation> = {
  buy: {
    chineseLabel: "可以买",
    englishLabel: "Buy",
    colorToken: "success",
    badgeClassName: "border-emerald-400/30 bg-emerald-400/12 text-emerald-100",
    shortDescription: "买入条件基本满足，但仍需按交易计划执行。",
    priority: 1,
  },
  wait: {
    chineseLabel: "等待",
    englishLabel: "Wait",
    colorToken: "warning",
    badgeClassName: "border-amber-400/30 bg-amber-400/12 text-amber-100",
    shortDescription: "条件尚未完全确认，等待回踩、量能或风险收益比改善。",
    priority: 2,
  },
  hold: {
    chineseLabel: "持股",
    englishLabel: "Hold",
    colorToken: "primary",
    badgeClassName: "border-blue-400/30 bg-blue-400/12 text-blue-100",
    shortDescription: "继续按既定计划跟踪止损、目标和结构变化。",
    priority: 3,
  },
  reduce: {
    chineseLabel: "减仓",
    englishLabel: "Reduce",
    colorToken: "orange",
    badgeClassName: "border-orange-400/30 bg-orange-400/12 text-orange-100",
    shortDescription: "风险开始升高，优先控制仓位。",
    priority: 4,
  },
  avoid: {
    chineseLabel: "回避",
    englishLabel: "Avoid",
    colorToken: "danger",
    badgeClassName: "border-red-400/30 bg-red-400/12 text-red-100",
    shortDescription: "结构或风险条件不满足，当前不参与。",
    priority: 5,
  },
};

export function getSignalPresentation(signal: StockSignal): SignalPresentation {
  return signalPresentation[signal];
}

export const signalLabels = Object.fromEntries(
  Object.entries(signalPresentation).map(([signal, presentation]) => [signal, presentation.chineseLabel]),
) as Record<StockSignal, string>;
