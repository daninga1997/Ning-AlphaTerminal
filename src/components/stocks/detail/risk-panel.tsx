import type { StockAnalysis } from "@/types/stock";

export function getRiskItems(stock: StockAnalysis): string[] {
  const risks = new Set<string>();

  if (stock.riskLevel === "high") risks.add("当前风险等级为高，不能作为激进开仓依据。");
  if (stock.tradeLevels.invalidReason) risks.add(stock.tradeLevels.invalidReason);
  for (const warning of stock.shortTermScore.warnings) risks.add(warning);
  for (const warning of stock.midTermScore.warnings) risks.add(warning);
  if (stock.sectorScore < 75) risks.add("板块强度下降，需警惕主线退潮。");
  if (stock.indicators.sma20 !== null && stock.indicators.sma60 !== null && stock.indicators.sma20 < stock.indicators.sma60) {
    risks.add("MA20 弱于 MA60，技术结构存在破坏信号。");
  }

  return Array.from(risks);
}

export function RiskPanel({ stock }: { stock: StockAnalysis }) {
  const risks = getRiskItems(stock);

  return (
    <section className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-100/80">
        Risk & Invalid Conditions
      </p>
      <h2 className="mt-1 text-lg font-semibold text-amber-50">风险与失效条件</h2>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <RiskBlock title="当前主要风险" items={risks.length > 0 ? risks : ["暂无额外风险警告，但仍需遵守交易计划。"]} />
        <RiskBlock
          title="计划失效条件"
          items={[
            `跌破止损位 ${stock.tradeLevels.stopLoss.toFixed(2)}，当前计划失效。`,
            `价格高于放弃追高价 ${stock.tradeLevels.chaseLimit.toFixed(2)}，不追入。`,
            "未触及建仓条件不提前开仓。",
          ]}
        />
        <RiskBlock
          title="板块退潮信号"
          items={[
            "板块强度持续下降。",
            "同板块高评分股票同步转弱。",
            "放量上涨后无法维持趋势结构。",
          ]}
        />
        <RiskBlock
          title="数据真实性说明"
          items={[
            "当前页面使用 Mock 模拟行情与规则计算结果。",
            "演示数据不代表真实行情。",
            "页面结论不构成投资建议。",
          ]}
        />
      </div>
    </section>
  );
}

function RiskBlock({ items, title }: { items: string[]; title: string }) {
  return (
    <div className="rounded-lg border border-amber-300/20 bg-[#090A0D]/80 p-4">
      <h3 className="text-sm font-semibold text-amber-50">{title}</h3>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-amber-50/80">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
