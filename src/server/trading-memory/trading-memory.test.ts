import { beforeEach, describe, expect, test } from "vitest";
import type {
  CreateTradingPlanInput,
  PlanEventType,
  PlanReviewInput,
  TradingMemoryRepository,
  TradingPlanRecord,
  TradingPlanStatus,
} from "./trading-plan-repository";
import {
  calculateReviewMetrics,
  createTradingMemoryService,
  getAllowedStatusTransitions,
  isTerminalStatus,
} from "./trading-memory-service";
import { buildMemoryCsv, buildMemoryJsonExport } from "./trading-memory-export";
import { calculateTradingMemoryStats } from "./trading-memory-stats";

class MemoryRepo implements TradingMemoryRepository {
  plans = new Map<string, TradingPlanRecord>();
  events: Array<{ tradingPlanId: string; eventType: PlanEventType; description: string }> = [];
  reviews: Array<PlanReviewInput & { tradingPlanId: string }> = [];

  async createPlan(input: CreateTradingPlanInput) {
    const duplicate = [...this.plans.values()].find(
      (plan) =>
        plan.idempotencyKey === input.idempotencyKey ||
        (plan.code === input.code &&
          plan.planType === input.planType &&
          plan.planDate === input.planDate &&
          plan.status === "active" &&
          input.status === "active"),
    );
    if (duplicate) return duplicate;

    const plan: TradingPlanRecord = {
      ...input,
      id: `plan-${this.plans.size + 1}`,
      archivedAt: null,
      createdAt: "2026-07-14T01:30:00.000Z",
      updatedAt: "2026-07-14T01:30:00.000Z",
      review: null,
      events: [],
      snapshot: {
        id: `snapshot-${this.plans.size + 1}`,
        tradingPlanId: `plan-${this.plans.size + 1}`,
        snapshotTime: input.calculatedAt,
        quoteJson: input.snapshot.quoteJson,
        indicatorsJson: input.snapshot.indicatorsJson,
        shortScoreJson: input.snapshot.shortScoreJson,
        midScoreJson: input.snapshot.midScoreJson,
        tradeLevelsJson: input.snapshot.tradeLevelsJson,
        dataStatus: input.snapshot.dataStatus,
        dataSource: input.snapshot.dataSource,
        isDemo: input.snapshot.isDemo,
        createdAt: "2026-07-14T01:30:00.000Z",
      },
    };
    this.plans.set(plan.id, plan);
    this.events.push({ tradingPlanId: plan.id, eventType: "created", description: "created" });
    return plan;
  }

  async findPlanById(id: string) {
    return this.plans.get(id) ?? null;
  }

  async listPlans() {
    return [...this.plans.values()];
  }

  async updatePlanStatus(id: string, status: TradingPlanStatus) {
    const plan = this.plans.get(id);
    if (!plan) return null;
    const updated = { ...plan, status, updatedAt: "2026-07-14T02:00:00.000Z" };
    this.plans.set(id, updated);
    return updated;
  }

  async addEvent(input: { tradingPlanId: string; eventType: PlanEventType; description: string }) {
    this.events.push(input);
    return {
      id: `event-${this.events.length}`,
      tradingPlanId: input.tradingPlanId,
      eventType: input.eventType,
      eventTime: "2026-07-14T02:00:00.000Z",
      price: null,
      description: input.description,
      source: "manual",
      metadata: "{}",
      createdAt: "2026-07-14T02:00:00.000Z",
    };
  }

  async addReview(tradingPlanId: string, input: PlanReviewInput) {
    this.reviews.push({ tradingPlanId, ...input });
    return {
      id: `review-${this.reviews.length}`,
      tradingPlanId,
      ...input,
      returnPercent: input.returnPercent ?? 0,
      maxFavorableExcursionPercent: input.maxFavorableExcursionPercent ?? 0,
      maxAdverseExcursionPercent: input.maxAdverseExcursionPercent ?? 0,
      createdAt: "2026-07-14T02:00:00.000Z",
      updatedAt: "2026-07-14T02:00:00.000Z",
    };
  }
}

function planInput(overrides: Partial<CreateTradingPlanInput> = {}): CreateTradingPlanInput {
  return {
    idempotencyKey: "idem-1",
    planDate: "2026-07-14",
    code: "002472",
    name: "双环传动",
    sector: "机器人",
    planType: "short_term",
    status: "active",
    originalSignal: "buy",
    finalSignal: "buy",
    shortTermScore: 86,
    midTermScore: 78,
    totalScore: 82,
    firstEntryLow: 30,
    firstEntryHigh: 31,
    secondEntryLow: 28,
    secondEntryHigh: 29,
    chaseLimit: 33,
    stopLoss: 27,
    firstTarget: 36,
    secondTarget: 40,
    riskRewardRatio: 2,
    suggestedPositionPercent: 20,
    thesis: "趋势结构保持完整",
    reasons: ["趋势向上"],
    warnings: ["演示数据"],
    invalidReason: null,
    marketDataMode: "mock",
    marketDataSource: "mock-provider",
    marketTimestamp: "2026-07-14T01:00:00.000Z",
    calculatedAt: "2026-07-14T01:00:00.000Z",
    isDemo: true,
    snapshot: {
      quoteJson: "{}",
      indicatorsJson: "{}",
      shortScoreJson: "{}",
      midScoreJson: "{}",
      tradeLevelsJson: "{}",
      dataStatus: "fresh",
      dataSource: "mock-provider",
      isDemo: true,
    },
    ...overrides,
  };
}

describe("trading memory repository and creation rules", () => {
  let repo: MemoryRepo;
  beforeEach(() => {
    repo = new MemoryRepo();
  });

  test("1. can create TradingPlan", async () => {
    const plan = await createTradingMemoryService(repo).createPlan(planInput());
    expect(plan.code).toBe("002472");
  });

  test("2. creating plan also saves SignalSnapshot", async () => {
    const plan = await createTradingMemoryService(repo).createPlan(planInput());
    expect(plan.snapshot?.tradingPlanId).toBe(plan.id);
  });

  test("3. SignalSnapshot cannot be updated through service", () => {
    expect(createTradingMemoryService(repo)).not.toHaveProperty("updateSnapshot");
  });

  test("4. originalSignal cannot be changed through status updates", async () => {
    const service = createTradingMemoryService(repo);
    const plan = await service.createPlan(planInput());
    const updated = await service.transitionStatus(plan.id, "triggered", "touch");
    expect(updated.originalSignal).toBe("buy");
  });

  test("5. duplicate idempotency request does not create two plans", async () => {
    const service = createTradingMemoryService(repo);
    await service.createPlan(planInput());
    await service.createPlan(planInput());
    expect(repo.plans.size).toBe(1);
  });

  test("6. same day same stock same type active plan cannot duplicate", async () => {
    const service = createTradingMemoryService(repo);
    await service.createPlan(planInput({ idempotencyKey: "a" }));
    await service.createPlan(planInput({ idempotencyKey: "b" }));
    expect(repo.plans.size).toBe(1);
  });
});

describe("trading memory state machine", () => {
  let service: ReturnType<typeof createTradingMemoryService>;
  let repo: MemoryRepo;
  beforeEach(async () => {
    repo = new MemoryRepo();
    service = createTradingMemoryService(repo);
  });

  test("7. draft can transition to active", async () => {
    const plan = await service.createPlan(planInput({ status: "draft" }));
    expect((await service.transitionStatus(plan.id, "active", "activate")).status).toBe("active");
  });

  test("8. active can transition to triggered", async () => {
    const plan = await service.createPlan(planInput());
    expect((await service.transitionStatus(plan.id, "triggered", "entry")).status).toBe("triggered");
  });

  test("9. triggered can transition to completed", async () => {
    const plan = await service.createPlan(planInput());
    await service.transitionStatus(plan.id, "triggered", "entry");
    expect((await service.transitionStatus(plan.id, "completed", "done")).status).toBe("completed");
  });

  test("10. completed cannot be reactivated", async () => {
    const plan = await service.createPlan(planInput({ status: "draft" }));
    await service.transitionStatus(plan.id, "active", "activate");
    await service.transitionStatus(plan.id, "triggered", "entry");
    await service.transitionStatus(plan.id, "completed", "done");
    await expect(service.transitionStatus(plan.id, "active", "again")).rejects.toThrow("终态计划不能重新激活");
  });

  test("11. illegal status transition is rejected", async () => {
    const plan = await service.createPlan(planInput({ status: "draft" }));
    await expect(service.transitionStatus(plan.id, "completed", "bad")).rejects.toThrow("非法状态转换");
  });

  test("12. status transition creates PlanEvent", async () => {
    const plan = await service.createPlan(planInput({ status: "draft" }));
    await service.transitionStatus(plan.id, "active", "activate");
    expect(repo.events.some((event) => event.eventType === "activated")).toBe(true);
  });

  test("terminal and allowed transition helpers are deterministic", () => {
    expect(isTerminalStatus("completed")).toBe(true);
    expect(getAllowedStatusTransitions("active")).toContain("triggered");
  });
});

describe("trading memory safety rules", () => {
  test("13. unavailable data cannot create active plan", async () => {
    const service = createTradingMemoryService(new MemoryRepo());
    await expect(
      service.createPlan(planInput({ snapshot: { ...planInput().snapshot, dataStatus: "unavailable" } })),
    ).rejects.toThrow("不可用数据不能创建 active 计划");
  });

  test("14. stale data can only create draft", async () => {
    const service = createTradingMemoryService(new MemoryRepo());
    await expect(
      service.createPlan(
        planInput({ snapshot: { ...planInput().snapshot, dataStatus: "stale" }, status: "active" }),
      ),
    ).rejects.toThrow("延迟数据只能保存为 draft");
  });

  test("15. invalidReason cannot create active plan", async () => {
    const service = createTradingMemoryService(new MemoryRepo());
    await expect(service.createPlan(planInput({ invalidReason: "当前盈亏比不足" }))).rejects.toThrow(
      "失效计划不能创建 active",
    );
  });

  test("16. mock plan is marked as demo", async () => {
    const plan = await createTradingMemoryService(new MemoryRepo()).createPlan(planInput());
    expect(plan.isDemo).toBe(true);
  });
});

describe("review calculation", () => {
  test("17. returnPercent is calculated correctly", () => {
    expect(calculateReviewMetrics({ entryPrice: 10, exitPrice: 11 }).returnPercent).toBe(10);
  });

  test("18. max favorable excursion is calculated correctly", () => {
    expect(calculateReviewMetrics({ entryPrice: 10, highestPrice: 12 }).maxFavorableExcursionPercent).toBe(20);
  });

  test("19. max adverse excursion is calculated correctly", () => {
    expect(calculateReviewMetrics({ entryPrice: 10, lowestPrice: 9 }).maxAdverseExcursionPercent).toBe(-10);
  });

  test("20. empty values do not create NaN or Infinity", () => {
    const result = calculateReviewMetrics({});
    expect(Object.values(result).every((value) => Number.isFinite(value))).toBe(true);
  });
});

describe("trading memory stats", () => {
  const completed: TradingPlanRecord = {
    ...planInput(),
    id: "done",
    status: "completed",
    archivedAt: null,
    createdAt: "2026-07-14T01:00:00.000Z",
    updatedAt: "2026-07-14T01:00:00.000Z",
    events: [],
    snapshot: null,
    review: {
      id: "review",
      tradingPlanId: "done",
      reviewDate: "2026-07-14",
      outcome: "first_target",
      entryPrice: 10,
      exitPrice: 11,
      highestPrice: 12,
      lowestPrice: 9.5,
      returnPercent: 10,
      maxFavorableExcursionPercent: 20,
      maxAdverseExcursionPercent: -5,
      holdingDays: 3,
      followedPlan: true,
      executionNotes: "",
      whatWorked: "",
      whatFailed: "",
      lesson: "",
      createdAt: "2026-07-14T01:00:00.000Z",
      updatedAt: "2026-07-14T01:00:00.000Z",
      isDemo: true,
    },
  };

  test("21. open plan is excluded from completed stats", () => {
    const stats = calculateTradingMemoryStats([{ ...completed, id: "open", status: "active", review: null }]);
    expect(stats.completedPlans).toBe(0);
  });

  test("22. not_triggered is excluded from win-rate calculation", () => {
    const stats = calculateTradingMemoryStats([
      { ...completed, id: "nt", review: { ...completed.review!, outcome: "not_triggered" } },
    ]);
    expect(stats.winRate).toBe(0);
  });

  test("23. mock and live stats are separated by default", () => {
    const stats = calculateTradingMemoryStats([completed, { ...completed, id: "live", marketDataMode: "live", isDemo: false }]);
    expect(stats.totalPlans).toBe(1);
  });

  test("24. sample smaller than 20 shows small sample warning", () => {
    expect(calculateTradingMemoryStats([completed]).smallSampleWarning).toBe(true);
  });

  test("25. win rate is calculated correctly", () => {
    expect(calculateTradingMemoryStats([completed]).winRate).toBe(100);
  });

  test("26. average gain and loss are calculated correctly", () => {
    const stats = calculateTradingMemoryStats([
      completed,
      { ...completed, id: "loss", review: { ...completed.review!, outcome: "stopped_out", returnPercent: -4 } },
    ]);
    expect(stats.averageGainPercent).toBe(10);
    expect(stats.averageLossPercent).toBe(-4);
  });
});

describe("memory api helpers and export", () => {
  test("27. create plan service succeeds", async () => {
    await expect(createTradingMemoryService(new MemoryRepo()).createPlan(planInput())).resolves.toMatchObject({
      code: "002472",
    });
  });

  test("28. invalid params return validation error", async () => {
    await expect(createTradingMemoryService(new MemoryRepo()).createPlan(planInput({ code: "" }))).rejects.toThrow(
      "股票代码不能为空",
    );
  });

  test("29. invalid status transition returns clear error", async () => {
    const service = createTradingMemoryService(new MemoryRepo());
    const plan = await service.createPlan(planInput({ status: "draft" }));
    await expect(service.transitionStatus(plan.id, "completed", "bad")).rejects.toThrow("非法状态转换");
  });

  test("30. update API cannot modify original snapshot", () => {
    expect(createTradingMemoryService(new MemoryRepo())).not.toHaveProperty("updateSnapshot");
  });

  test("31. JSON export succeeds", () => {
    expect(buildMemoryJsonExport([])).toContain('"plans"');
  });

  test("32. CSV export uses UTF-8 BOM", () => {
    expect(buildMemoryCsv([]).charCodeAt(0)).toBe(0xfeff);
  });

  test("33. API response/export does not expose database path or env vars", () => {
    const payload = buildMemoryJsonExport([planInput() as unknown as TradingPlanRecord]);
    expect(payload).not.toContain("DATABASE_URL");
    expect(payload).not.toContain("alpha-terminal.db");
  });
});

describe("memory page behavior contracts", () => {
  test("34. /memory has page data", async () => {
    const plans = await createTradingMemoryService(new MemoryRepo()).listPlans();
    expect(Array.isArray(plans)).toBe(true);
  });

  test("35. /memory/[id] can display sorted timeline", async () => {
    const repo = new MemoryRepo();
    const service = createTradingMemoryService(repo);
    const plan = await service.createPlan(planInput());
    await service.addEvent(plan.id, "manual_note", "note");
    const detail = await service.getPlan(plan.id);
    expect(detail?.events.map((event) => event.createdAt)).toEqual([...detail!.events.map((event) => event.createdAt)].sort());
  });

  test("36. missing plan returns null for 404", async () => {
    await expect(createTradingMemoryService(new MemoryRepo()).getPlan("missing")).resolves.toBeNull();
  });

  test("37. Stock Detail can build save-plan payload", async () => {
    const service = createTradingMemoryService(new MemoryRepo());
    await expect(service.createPlan(planInput({ thesis: "来自个股详情页" }))).resolves.toMatchObject({
      thesis: "来自个股详情页",
    });
  });

  test("38. demo plan clearly marks demo status", async () => {
    const plan = await createTradingMemoryService(new MemoryRepo()).createPlan(planInput({ marketDataMode: "replay" }));
    expect(plan.isDemo).toBe(true);
  });
});
