import type { TradingPlanRecord } from "./trading-plan-repository";

export function buildMemoryJsonExport(plans: TradingPlanRecord[]) {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      format: "alpha-terminal-trading-memory-v1",
      plans: plans.map(sanitizePlan),
    },
    null,
    2,
  );
}

export function buildMemoryCsv(plans: TradingPlanRecord[]) {
  const headers = [
    "id",
    "planDate",
    "code",
    "name",
    "sector",
    "planType",
    "status",
    "originalSignal",
    "finalSignal",
    "totalScore",
    "riskRewardRatio",
    "marketDataMode",
    "isDemo",
    "reviewOutcome",
    "returnPercent",
  ];
  const rows = plans.map((plan) =>
    [
      plan.id,
      plan.planDate,
      plan.code,
      plan.name,
      plan.sector,
      plan.planType,
      plan.status,
      plan.originalSignal,
      plan.finalSignal,
      plan.totalScore,
      plan.riskRewardRatio,
      plan.marketDataMode,
      plan.isDemo ? "演示" : "真实",
      plan.review?.outcome ?? "",
      plan.review?.returnPercent ?? "",
    ]
      .map(csvCell)
      .join(","),
  );
  return `\uFEFF${headers.join(",")}\n${rows.join("\n")}`;
}

function csvCell(value: unknown) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function sanitizePlan(plan: TradingPlanRecord) {
  return {
    ...plan,
    snapshot: plan.snapshot
      ? {
          id: plan.snapshot.id,
          tradingPlanId: plan.snapshot.tradingPlanId,
          snapshotTime: plan.snapshot.snapshotTime,
          dataStatus: plan.snapshot.dataStatus,
          dataSource: plan.snapshot.dataSource,
          isDemo: plan.snapshot.isDemo,
          createdAt: plan.snapshot.createdAt,
        }
      : null,
  };
}
