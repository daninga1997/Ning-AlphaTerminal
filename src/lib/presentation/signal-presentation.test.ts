import { describe, expect, it } from "vitest";
import type { StockSignal } from "@/types/stock";
import { getSignalPresentation, signalLabels, signalPresentation } from "./signal-presentation";

const signals: StockSignal[] = ["buy", "wait", "hold", "reduce", "avoid"];

describe("signal presentation", () => {
  it("covers every stock signal with labels, classes, descriptions, and priority", () => {
    for (const signal of signals) {
      const presentation = getSignalPresentation(signal);

      expect(presentation.chineseLabel).toBeTruthy();
      expect(presentation.englishLabel).toBeTruthy();
      expect(presentation.badgeClassName).toContain("border-");
      expect(presentation.shortDescription).toBeTruthy();
      expect(presentation.priority).toBeGreaterThan(0);
      expect(signalLabels[signal]).toBe(presentation.chineseLabel);
    }
  });

  it("keeps signal priority deterministic", () => {
    expect(signals.map((signal) => signalPresentation[signal].priority)).toEqual([1, 2, 3, 4, 5]);
  });
});
