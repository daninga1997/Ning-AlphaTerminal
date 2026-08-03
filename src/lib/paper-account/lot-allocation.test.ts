import { describe, expect, it } from "vitest";

import { allocateLotsFifo } from "./lot-allocation";

describe("paper lot FIFO allocation", () => {
  it("allocates a sell across two lots in FIFO order", () => {
    expect(
      allocateLotsFifo(
        [
          { lotId: "a", acquiredSequence: 1, remainingQuantity: 100 },
          { lotId: "b", acquiredSequence: 2, remainingQuantity: 200 },
        ],
        150,
      ),
    ).toEqual({
      allocations: [
        { lotId: "a", quantity: 100 },
        { lotId: "b", quantity: 50 },
      ],
      allocatedQuantity: 150,
    });
  });

  it("sorts an unsorted input by acquired sequence", () => {
    expect(
      allocateLotsFifo(
        [
          { lotId: "third", acquiredSequence: 3, remainingQuantity: 100 },
          { lotId: "first", acquiredSequence: 1, remainingQuantity: 100 },
          { lotId: "second", acquiredSequence: 2, remainingQuantity: 100 },
        ],
        200,
      ).allocations,
    ).toEqual([
      { lotId: "first", quantity: 100 },
      { lotId: "second", quantity: 100 },
    ]);
  });

  it("preserves original order when lots have the same acquired sequence", () => {
    expect(
      allocateLotsFifo(
        [
          {
            lotId: "first-in-input",
            acquiredSequence: 1,
            remainingQuantity: 100,
          },
          {
            lotId: "second-in-input",
            acquiredSequence: 1,
            remainingQuantity: 100,
          },
        ],
        150,
      ).allocations,
    ).toEqual([
      {
        lotId: "first-in-input",
        quantity: 100,
      },
      {
        lotId: "second-in-input",
        quantity: 50,
      },
    ]);
  });

  it("partially allocates a single lot", () => {
    expect(
      allocateLotsFifo(
        [{ lotId: "a", acquiredSequence: 1, remainingQuantity: 200 }],
        50,
      ).allocations,
    ).toEqual([{ lotId: "a", quantity: 50 }]);
  });

  it("fully allocates a single lot", () => {
    expect(
      allocateLotsFifo(
        [{ lotId: "a", acquiredSequence: 1, remainingQuantity: 100 }],
        100,
      ).allocations,
    ).toEqual([{ lotId: "a", quantity: 100 }]);
  });

  it("skips empty lots", () => {
    expect(
      allocateLotsFifo(
        [
          { lotId: "empty", acquiredSequence: 1, remainingQuantity: 0 },
          { lotId: "available", acquiredSequence: 2, remainingQuantity: 100 },
        ],
        100,
      ).allocations,
    ).toEqual([{ lotId: "available", quantity: 100 }]);
  });

  it("rejects a sell when available lots are insufficient", () => {
    expect(() =>
      allocateLotsFifo(
        [
          { lotId: "a", acquiredSequence: 1, remainingQuantity: 100 },
          { lotId: "b", acquiredSequence: 2, remainingQuantity: 200 },
        ],
        301,
      ),
    ).toThrow("INSUFFICIENT_SELLABLE_LOTS");
  });

  it("validates every lot before allocating any quantity", () => {
    expect(() =>
      allocateLotsFifo(
        [
          {
            lotId: "valid",
            acquiredSequence: 1,
            remainingQuantity: 100,
          },
          {
            lotId: "",
            acquiredSequence: 2,
            remainingQuantity: 100,
          },
        ],
        50,
      ),
    ).toThrow("LOT_ID_INVALID");
  });

  it.each([
    ["zero", 0],
    ["a negative quantity", -1],
    ["a fractional quantity", 1.5],
    ["NaN", Number.NaN],
    ["infinity", Number.POSITIVE_INFINITY],
    ["an unsafe integer", Number.MAX_SAFE_INTEGER + 1],
  ])("rejects %s as a sell quantity", (_description, quantity) => {
    expect(() => allocateLotsFifo([], quantity)).toThrow(
      "SELL_QUANTITY_INVALID",
    );
  });

  it.each(["", "   "])("rejects an invalid lot id", (lotId) => {
    expect(() =>
      allocateLotsFifo([{ lotId, acquiredSequence: 1, remainingQuantity: 1 }], 1),
    ).toThrow("LOT_ID_INVALID");
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    "rejects an invalid acquired sequence",
    (acquiredSequence) => {
      expect(() =>
        allocateLotsFifo(
          [{ lotId: "a", acquiredSequence, remainingQuantity: 1 }],
          1,
        ),
      ).toThrow("LOT_SEQUENCE_INVALID");
    },
  );

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    "rejects an invalid remaining quantity",
    (remainingQuantity) => {
      expect(() =>
        allocateLotsFifo(
          [{ lotId: "a", acquiredSequence: 1, remainingQuantity }],
          1,
        ),
      ).toThrow("LOT_REMAINING_QUANTITY_INVALID");
    },
  );

  it("does not mutate the caller's lot array or lot objects", () => {
    const lots = [
      { lotId: "later", acquiredSequence: 2, remainingQuantity: 200 },
      { lotId: "earlier", acquiredSequence: 1, remainingQuantity: 100 },
    ];
    const originalLots = lots.map((lot) => ({ ...lot }));

    allocateLotsFifo(lots, 150);

    expect(lots).toEqual(originalLots);
  });

  it("reports an allocated quantity equal to the requested quantity", () => {
    expect(
      allocateLotsFifo(
        [{ lotId: "a", acquiredSequence: 1, remainingQuantity: 75 }],
        75,
      ).allocatedQuantity,
    ).toBe(75);
  });
});
