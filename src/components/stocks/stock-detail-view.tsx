import type { DailyBar } from "@/types/market";
import type { StockAnalysis } from "@/types/stock";
import type { DataIntegrityReport } from "@/types/data-integrity";
import { ScoreBreakdownPanel } from "./detail/score-breakdown-panel";
import { RiskPanel } from "./detail/risk-panel";
import { StockDecisionHeader } from "./detail/stock-decision-header";
import { StockChartPeriodPanel } from "./detail/stock-chart-period-panel";
import { TechnicalSnapshot } from "./detail/technical-snapshot";
import { TradingPlanCard } from "./detail/trading-plan-card";
import { SaveTradingPlanButton } from "./detail/save-trading-plan-button";
import { PaperTradePanel } from "./detail/paper-trade-panel";
import { StockIntegrityCard } from "../data-integrity/stock-integrity-card";
import { StockStrategyPanel } from "../strategy/strategy-plan-panel";
import type { StrategyEngineOutput } from "@/server/strategy-engine/types/strategy-result";

export function StockDetailView({ stock, bars, integrityReport, strategyOutput }: { stock: StockAnalysis; bars: DailyBar[]; integrityReport?: DataIntegrityReport; strategyOutput?: StrategyEngineOutput | null }) {
  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4">
      {integrityReport && <StockIntegrityCard report={integrityReport} />}
      <StockDecisionHeader stock={stock} />
      <StockStrategyPanel output={strategyOutput ?? null} />
      <TradingPlanCard stock={stock} />
      <PaperTradePanel code={stock.code} />
      <SaveTradingPlanButton stock={stock} />
      <div className="grid gap-4 xl:grid-cols-2">
        <ScoreBreakdownPanel
          score={stock.shortTermScore}
          subtitle="板块强度、价格趋势、成交量、动量指标、风险收益比"
          title="短线评分分解"
        />
        <ScoreBreakdownPanel
          score={stock.midTermScore}
          subtitle="板块与产业逻辑、中期趋势、周期位置、波动与回撤、量价结构代理指标"
          title="中线评分分解"
        />
      </div>
      <TechnicalSnapshot indicators={stock.indicators} />
      <StockChartPeriodPanel bars={bars} code={stock.code} meta={stock.technicalDataMeta} />
      <RiskPanel stock={stock} />
    </div>
  );
}
