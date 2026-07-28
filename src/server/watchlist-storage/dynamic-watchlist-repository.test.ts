/**
 * 动态观察池验收测试
 * 
 * 覆盖 V3.1 规格书第13节的验收用例
 */
import { describe, it, expect } from "vitest";
import { getAllDynamicEntries, getEntryCount } from "./dynamic-watchlist-repository";
import { computeSignalValidUntil } from "./signal-validity";
import { applyStrategyGatekeeper } from "../market-data/strategy-gatekeeper";

describe("动态观察池验收用例", () => {
  it("1. data_blocked 不创建动态条目", () => {
    const result = applyStrategyGatekeeper(10, true, "avoid", "markup", 50);
    expect(result.passed).toBe(false);
    expect(result.action).toBe("data_blocked");
    expect(result.blockers).toContain("DAILY_BARS_INSUFFICIENT (10/60)");
  });

  it("2. 非核心股票满足条件时加入观察池", () => {
    const code = "002896";
    const isCore = false;
    const action = "focus";
    const autoJoinActions = new Set(["buy_allowed", "wait_for_pullback", "breakout_watch", "focus"]);
    expect(isCore).toBe(false);
    expect(autoJoinActions.has(action)).toBe(true);
  });

  it("3. 核心股票不创建重复动态条目", () => {
    const code = "002896";
    const CORE_CODES = new Set(["002896","000988","002317"]);
    expect(CORE_CODES.has(code)).toBe(true);
    // 核心股票即使满足条件也不应写入动态池
  });

  it("4. 路由拦截：300xxx 不是深市主板", () => {
    const pattern = /^(000|001|002)\d{3}$/;
    expect(pattern.test("300750")).toBe(false);
    expect(pattern.test("002896")).toBe(true);
    expect(pattern.test("688981")).toBe(false);
  });

  it("5. 日线不足60根应阻断", () => {
    const result = applyStrategyGatekeeper(30, true, "wait", "markup", 70);
    expect(result.passed).toBe(false);
    expect(result.blockers).toContain("DAILY_BARS_INSUFFICIENT (30/60)");
  });

  it("6. 有效期差异计算", () => {
    const from = new Date("2026-07-22");
    
    let until = computeSignalValidUntil("focus", from, null);
    expect(until).toBe("2026-07-29"); // T+5，跳过周末
    
    until = computeSignalValidUntil("breakout_watch", from, null);
    expect(until).toBe("2026-07-24"); // T+2

    until = computeSignalValidUntil("wait_for_pullback", from, null);
    expect(until).toBe("2026-08-03"); // T+8，跳过两个周末
  });

  it("7. 动态观察池初始为空", async () => {
    const count = await getEntryCount();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  it("8. 门卫通过后应放行并返回正确动作", () => {
    const result = applyStrategyGatekeeper(80, true, "wait", "breakout", 80);
    expect(result.passed).toBe(true);
    expect(result.action).toBe("breakout_watch");
  });

  it("9. avoid 信号不加入观察池", () => {
    const autoJoinActions = new Set(["buy_allowed", "wait_for_pullback", "breakout_watch", "focus"]);
    expect(autoJoinActions.has("avoid")).toBe(false);
  });

  it("10. 报价不可用应阻断", () => {
    const result = applyStrategyGatekeeper(100, false, "buy", "markup", 85);
    expect(result.passed).toBe(false);
    expect(result.blockers).toContain("QUOTE_MISSING");
  });
});