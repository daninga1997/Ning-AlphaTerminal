import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const now = new Date("2026-07-14T01:30:00.000Z");

const basePlans = [
  ["seed-short-002472", "002472", "双环传动", "机器人", "short_term", "active", "mock", true, "buy", 88],
  ["seed-short-002317", "002317", "众生药业", "创新药", "short_term", "triggered", "mock", true, "buy", 86],
  ["seed-short-000661", "000661", "长春高新", "创新药", "short_term", "completed", "mock", true, "hold", 84],
  ["seed-swing-002050", "002050", "三花智控", "机器人", "swing", "cancelled", "replay", true, "wait", 81],
  ["seed-swing-000988", "000988", "华工科技", "AI硬件", "swing", "invalidated", "replay", true, "reduce", 78],
  ["seed-swing-000063", "000063", "中兴通讯", "AI硬件", "swing", "expired", "replay", true, "wait", 79],
  ["seed-mid-000738", "000738", "航发控制", "军工", "mid_term", "completed", "mock", true, "hold", 83],
  ["seed-mid-000400", "000400", "许继电气", "电力设备", "mid_term", "draft", "mock", true, "wait", 76],
  ["seed-mid-002335", "002335", "科华数据", "电力设备", "mid_term", "completed", "replay", true, "hold", 82],
];

async function main() {
  for (const [idempotencyKey, code, name, sector, planType, status, mode, isDemo, signal, score] of basePlans) {
    await prisma.tradingPlan.deleteMany({ where: { idempotencyKey } });
    const plan = await prisma.tradingPlan.create({
      data: {
        idempotencyKey,
        planDate: "2026-07-14",
        code,
        name,
        sector,
        planType,
        status,
        originalSignal: signal,
        finalSignal: status === "invalidated" ? "avoid" : signal,
        shortTermScore: Number(score),
        midTermScore: Number(score) - 4,
        totalScore: Number(score) - 2,
        firstEntryLow: 28,
        firstEntryHigh: 30,
        secondEntryLow: 25,
        secondEntryHigh: 27,
        chaseLimit: 33,
        stopLoss: 24,
        firstTarget: 36,
        secondTarget: 40,
        riskRewardRatio: 2,
        suggestedPositionPercent: Number(score) >= 85 ? 20 : 10,
        thesis: "固定演示计划，用于交易记忆页面和接口验收。",
        reasons: JSON.stringify(["趋势结构保持", "量能配合"]),
        warnings: JSON.stringify(["演示数据，不构成投资建议"]),
        invalidReason: status === "invalidated" ? "跌破计划失效条件" : null,
        marketDataMode: mode,
        marketDataSource: `${mode}-seed`,
        marketTimestamp: now,
        calculatedAt: now,
        isDemo: Boolean(isDemo),
      },
    });

    await prisma.signalSnapshot.create({
      data: {
        tradingPlanId: plan.id,
        snapshotTime: now,
        quoteJson: JSON.stringify({ code, name, price: 30 }),
        indicatorsJson: JSON.stringify({ ma5: 29, ma20: 27 }),
        shortScoreJson: JSON.stringify({ total: Number(score) }),
        midScoreJson: JSON.stringify({ total: Number(score) - 4 }),
        tradeLevelsJson: JSON.stringify({ firstEntryLow: 28, stopLoss: 24, firstTarget: 36 }),
        dataStatus: mode === "replay" ? "historical_replay" : "fresh",
        dataSource: `${mode}-seed`,
        isDemo: Boolean(isDemo),
      },
    });

    await prisma.planEvent.createMany({
      data: [
        {
          tradingPlanId: plan.id,
          eventType: "created",
          eventTime: now,
          description: "Seed创建演示交易计划",
          source: "seed",
          metadata: "{}",
        },
        ...(status !== "draft"
          ? [
              {
                tradingPlanId: plan.id,
                eventType: status === "active" ? "activated" : status === "triggered" ? "entry_zone_touched" : "completed",
                eventTime: new Date("2026-07-14T02:00:00.000Z"),
                description: "Seed生成的生命周期事件",
                source: "seed",
                metadata: "{}",
              },
            ]
          : []),
      ],
    });

    if (["completed", "cancelled", "invalidated", "expired"].includes(status)) {
      const exitPrice = status === "completed" ? 34 : 26;
      const entryPrice = 30;
      await prisma.planReview.create({
        data: {
          tradingPlanId: plan.id,
          reviewDate: "2026-07-14",
          outcome: status === "completed" ? "first_target" : status === "expired" ? "expired" : "cancelled",
          entryPrice,
          exitPrice,
          highestPrice: status === "completed" ? 36 : 31,
          lowestPrice: status === "completed" ? 29 : 25,
          returnPercent: Number((((exitPrice - entryPrice) / entryPrice) * 100).toFixed(2)),
          maxFavorableExcursionPercent: status === "completed" ? 20 : 3.33,
          maxAdverseExcursionPercent: status === "completed" ? -3.33 : -16.67,
          holdingDays: 3,
          followedPlan: status !== "invalidated",
          executionNotes: "Seed复盘，仅用于演示。",
          whatWorked: "计划字段完整保留。",
          whatFailed: status === "invalidated" ? "结构失效后未继续跟踪。" : "",
          lesson: "演示记录不代表真实收益。",
          isDemo: true,
        },
      });
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
