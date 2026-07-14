import type { IndicatorSnapshot } from "@/types/market";

function formatNumber(value: number | null): string {
  return value === null ? "--" : value.toFixed(2);
}

function trendStatus(current: number | null, reference: number | null): string {
  if (current === null || reference === null) return "数据不足";
  if (current > reference) return "偏强";
  if (current < reference) return "转弱";
  return "中性";
}

function macdStatus(indicators: IndicatorSnapshot): string {
  const macd = indicators.macd;
  if (!macd) return "数据不足";
  if (macd.bullishCross) return "金叉";
  if (macd.histogram > (macd.previousHistogram ?? macd.histogram)) return "偏强";
  if (macd.dif < macd.dea) return "转弱";
  return "中性";
}

function kdjStatus(indicators: IndicatorSnapshot): string {
  const kdj = indicators.kdj;
  if (!kdj) return "数据不足";
  if (kdj.k > 90) return "超买";
  if (kdj.k > kdj.d) return "偏强";
  if (kdj.k < kdj.d) return "转弱";
  return "中性";
}

function rsiStatus(value: number | null): string {
  if (value === null) return "数据不足";
  if (value > 80) return "超买";
  if (value >= 50 && value <= 70) return "偏强";
  if (value < 45) return "转弱";
  return "中性";
}

function volumeStatus(value: number | null): string {
  if (value === null) return "数据不足";
  if (value > 3) return "过热";
  if (value >= 1.2) return "偏强";
  if (value < 0.8) return "转弱";
  return "中性";
}

function changeStatus(value: number | null): string {
  if (value === null) return "数据不足";
  if (value > 8) return "偏强";
  if (value < -5) return "转弱";
  return "中性";
}

function drawdownStatus(value: number | null): string {
  if (value === null) return "数据不足";
  if (value > 22) return "转弱";
  if (value > 12) return "中性";
  return "偏强";
}

export function TechnicalSnapshot({ indicators }: { indicators: IndicatorSnapshot }) {
  const items = [
    { label: "MA5", value: formatNumber(indicators.sma5), status: trendStatus(indicators.sma5, indicators.sma20) },
    { label: "MA10", value: formatNumber(indicators.sma10), status: trendStatus(indicators.sma10, indicators.sma20) },
    { label: "MA20", value: formatNumber(indicators.sma20), status: trendStatus(indicators.sma20, indicators.sma60) },
    { label: "MA60", value: formatNumber(indicators.sma60), status: "中期基准" },
    { label: "MACD状态", value: indicators.macd ? formatNumber(indicators.macd.histogram) : "--", status: macdStatus(indicators) },
    { label: "KDJ状态", value: indicators.kdj ? `${formatNumber(indicators.kdj.k)}/${formatNumber(indicators.kdj.d)}` : "--", status: kdjStatus(indicators) },
    { label: "RSI14", value: formatNumber(indicators.rsi14), status: rsiStatus(indicators.rsi14) },
    { label: "ATR14", value: formatNumber(indicators.atr14), status: indicators.atr14 === null ? "数据不足" : "波动参考" },
    { label: "量能/20日均量", value: formatNumber(indicators.volumeRatio20), status: volumeStatus(indicators.volumeRatio20) },
    { label: "近20日涨跌幅", value: `${formatNumber(indicators.change20)}%`, status: changeStatus(indicators.change20) },
    { label: "近60日涨跌幅", value: `${formatNumber(indicators.change60)}%`, status: changeStatus(indicators.change60) },
    { label: "最大回撤", value: `${formatNumber(indicators.maxDrawdown)}%`, status: drawdownStatus(indicators.maxDrawdown) },
  ];

  return (
    <section className="rounded-lg border border-[#252A33] bg-[#111318] p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#586174]">
        Technical Snapshot
      </p>
      <h2 className="mt-1 text-lg font-semibold text-[#F4F7FB]">技术快照</h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <div className="rounded-lg border border-[#252A33] bg-[#090A0D] p-3" key={item.label}>
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-[#8B95A7]">{item.label}</div>
              <span className="rounded-full border border-[#252A33] px-2 py-0.5 text-[11px] text-[#DCE4F0]">
                {item.status}
              </span>
            </div>
            <div className="mt-2 font-mono text-lg font-semibold text-[#F4F7FB]">{item.value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
