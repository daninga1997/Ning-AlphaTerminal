import { describe, expect, it } from "vitest";
import {
  buildBatchQuoteUrl,
  getQuoteCodesKey,
  shouldRestartQuoteRefresh,
} from "./watchlist-quote-refresh";

describe("watchlist quote refresh dependencies", () => {
  it("keeps the same dependency key when unrelated renders recreate the same codes array", () => {
    const firstRenderCodes = ["002472", "002317"];
    const secondRenderCodes = ["002472", "002317"];

    const firstKey = getQuoteCodesKey(firstRenderCodes);
    const secondKey = getQuoteCodesKey(secondRenderCodes);

    expect(firstRenderCodes).not.toBe(secondRenderCodes);
    expect(firstKey).toBe(secondKey);
    expect(shouldRestartQuoteRefresh(firstKey, secondKey)).toBe(false);
  });

  it("changes the dependency key and request url when stock codes change", () => {
    const previousKey = getQuoteCodesKey(["002472", "002317"]);
    const nextCodes = ["002472", "000661"];
    const nextKey = getQuoteCodesKey(nextCodes);

    expect(shouldRestartQuoteRefresh(previousKey, nextKey)).toBe(true);
    expect(buildBatchQuoteUrl(nextCodes)).toBe("/api/market/quotes?codes=002472,000661");
  });
});
